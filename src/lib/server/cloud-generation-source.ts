import sharp from "sharp";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { SourceImageInput } from "@/lib/ai/types";
import type { ConceptSourceProvenance, ConceptSourceViewProvenance, ProjectBrief, SourceViewCropRect, SourceViewRole } from "@/lib/types";
import { cropImageBuffer } from "./image-crop";
import { asBrief, mapSourceViewRow, type SourceViewRow } from "./project-row-mapping";

/**
 * Loads the real stored source material for a cloud project's paid
 * generation/correction request (see specs — "generation must use the
 * project's real stored source files and confirmed source views"). Runs
 * entirely under the caller's own RLS session (`supabase`), so it can never
 * read another user's project, files, or Storage objects — there is no path
 * for a request body to choose an arbitrary Storage path, since every path
 * used here comes from a project_files row this query already scoped to
 * `projectId`.
 */
export class CloudGenerationSourceError extends Error {
  readonly code: "not-found" | "no-primary-view" | "storage-failed" | "database-failed";
  readonly stage: string;

  constructor(code: CloudGenerationSourceError["code"], stage: string) {
    super(code);
    this.name = "CloudGenerationSourceError";
    this.code = code;
    this.stage = stage;
  }
}

export interface CloudGenerationSource {
  workspaceId: string;
  brief: ProjectBrief;
  /** Primary View first, then up to two reference views — the exact order sent to the provider. */
  images: SourceImageInput[];
  sourceProvenance: ConceptSourceProvenance;
}

function fail(error: { message?: string } | null, stage: string): void {
  if (!error) return;
  throw new CloudGenerationSourceError("database-failed", stage);
}

export async function loadProjectBrief(supabase: SupabaseClient, projectId: string): Promise<{ workspaceId: string; brief: ProjectBrief }> {
  const projectResult = await supabase.from("projects").select("workspace_id,brief").eq("id", projectId).maybeSingle();
  fail(projectResult.error, "project");
  const projectRow = projectResult.data as { workspace_id: string; brief: unknown } | null;
  if (!projectRow) throw new CloudGenerationSourceError("not-found", "project");
  return { workspaceId: String(projectRow.workspace_id), brief: asBrief(projectRow.brief) };
}

/** Downloads one project_files row's bytes and crops them to `crop` unless it already covers the whole image. */
async function downloadAndCropSourceFile(
  supabase: SupabaseClient,
  projectId: string,
  fileId: string,
  crop: SourceViewCropRect,
): Promise<{ bytes: Buffer; mimeType: string; fileName: string }> {
  const fileResult = await supabase.from("project_files").select("name,mime_type,storage_path").eq("project_id", projectId).eq("id", fileId).maybeSingle();
  fail(fileResult.error, "source-file");
  const file = fileResult.data as { name: string; mime_type: string | null; storage_path: string | null } | null;
  if (!file?.storage_path) throw new CloudGenerationSourceError("storage-failed", "missing-file");

  const downloadResult = await supabase.storage.from("project-assets").download(file.storage_path);
  if (downloadResult.error || !downloadResult.data) throw new CloudGenerationSourceError("storage-failed", "download");
  const raw = Buffer.from(await downloadResult.data.arrayBuffer());
  const mimeType = file.mime_type || "image/jpeg";

  const metadata = await sharp(raw).metadata();
  const isFullFrame = crop.x === 0 && crop.y === 0 && crop.width === metadata.width && crop.height === metadata.height;
  const bytes = isFullFrame ? raw : await cropImageBuffer(raw, crop, mimeType);
  return { bytes, mimeType, fileName: file.name };
}

/** Loads the project's currently confirmed Primary View plus up to two reference views — used for a fresh (Part 2) generation. */
export async function loadCloudGenerationSource(supabase: SupabaseClient, projectId: string): Promise<CloudGenerationSource> {
  const { workspaceId, brief } = await loadProjectBrief(supabase, projectId);

  const viewsResult = await supabase
    .from("source_views")
    .select("id,source_file_id,role,crop,sort_order,is_primary")
    .eq("project_id", projectId)
    .order("sort_order");
  fail(viewsResult.error, "source-views");
  const views = ((viewsResult.data ?? []) as SourceViewRow[]).map(mapSourceViewRow);

  const primary = views.find((view) => view.isPrimary);
  if (!primary) throw new CloudGenerationSourceError("no-primary-view", "no-primary-view");
  const references = views.filter((view) => !view.isPrimary).sort((a, b) => a.order - b.order).slice(0, 2);
  const selected = [primary, ...references];

  const images: SourceImageInput[] = [];
  const provenanceViews: ConceptSourceViewProvenance[] = [];

  for (const [index, view] of selected.entries()) {
    const { bytes, mimeType, fileName } = await downloadAndCropSourceFile(supabase, projectId, view.sourceImageId, view.crop);
    images.push({ data: bytes, mimeType, role: view.role, purpose: index === 0 ? "primary" : "reference" });
    provenanceViews.push({
      sourceFileId: view.sourceImageId,
      sourceViewId: view.id,
      sourceFileName: fileName,
      role: view.role,
      crop: view.crop,
      payload: { mimeType, width: view.crop.width, height: view.crop.height, sizeBytes: bytes.length },
    });
  }

  const [primaryProvenance, ...referenceProvenance] = provenanceViews;
  const sourceProvenance: ConceptSourceProvenance = {
    ...primaryProvenance,
    ...(referenceProvenance.length > 0 ? { referenceViews: referenceProvenance } : {}),
  };

  return { workspaceId, brief, images, sourceProvenance };
}

/**
 * Re-downloads and re-crops the exact source view a previously generated
 * concept used (see specs Part 3 — "use the original project source
 * provenance"). Reads `provenance.sourceFileId`/`crop` rather than the
 * project's current `source_views` rows, so a correction always reproduces
 * the same geometry reference the original concept was judged against, even
 * if the project's confirmed views changed since.
 */
export async function loadProvenanceSourceImage(
  supabase: SupabaseClient,
  projectId: string,
  provenance: ConceptSourceViewProvenance,
  purpose: "primary" | "reference",
): Promise<SourceImageInput> {
  const { bytes, mimeType } = await downloadAndCropSourceFile(supabase, projectId, provenance.sourceFileId, provenance.crop);
  return { data: bytes, mimeType, role: provenance.role as SourceViewRole, purpose };
}
