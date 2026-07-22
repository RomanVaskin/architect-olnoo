import type { Concept, Project, SourceFile, SourceView } from "./types";

/**
 * Single rule for "which image represents this project", shared by every
 * surface that shows a project preview: the /projects list, the dashboard's
 * recent-projects section, and the project detail overview. A generated
 * concept is the actual point of the product, so the most recently created
 * concept that has a generated image wins over the confirmed Primary Source
 * View photo; only when no concept has been generated yet does the source
 * photo stand in as the preview.
 */
export function findLatestGeneratedConcept(concepts: Concept[]): Concept | undefined {
  return [...concepts].reverse().find((concept) => concept.generatedImage);
}

export function findPrimarySourceFile(sourceViews: SourceView[] | undefined, sourceFiles: SourceFile[]): SourceFile | undefined {
  const primaryView = (sourceViews ?? []).find((view) => view.isPrimary);
  if (!primaryView) return undefined;
  return sourceFiles.find((file) => file.id === primaryView.sourceImageId);
}

export interface ProjectCoverSource {
  url?: string;
  blob?: Blob;
}

/**
 * Resolves the cover for a fully hydrated project — a server detail response
 * (signed Storage URLs) or a hydrated local IndexedDB record (in-memory
 * Blobs). Callers turn this into a displayable `src` themselves: a URL
 * string can be used directly, a Blob needs `useBlobUrl`.
 */
export function resolveProjectCover(concepts: Concept[], sourceViews: SourceView[] | undefined, sourceFiles: SourceFile[]): ProjectCoverSource {
  const latestConcept = findLatestGeneratedConcept(concepts);
  if (latestConcept?.generatedImage) {
    return { url: latestConcept.generatedImage.url, blob: latestConcept.generatedImage.blob };
  }
  const primarySource = findPrimarySourceFile(sourceViews, sourceFiles);
  if (primarySource) {
    return { url: primarySource.imageUrl, blob: primarySource.imageBlob };
  }
  return {};
}

/**
 * `coverImage`/`coverImageBlob` pair for a hydrated local (IndexedDB)
 * project, in the shape every card-rendering surface (ProjectCard,
 * dashboard-merge.ts) expects — a signed/local project never needs both at
 * once, but a local project can have a Blob without ever having had a URL.
 */
export function projectCoverFields(project: Pick<Project, "concepts" | "sourceViews" | "sourceFiles">): { coverImage: string; coverImageBlob?: Blob } {
  const cover = resolveProjectCover(project.concepts, project.sourceViews, project.sourceFiles);
  return { coverImage: cover.url ?? "", coverImageBlob: cover.blob };
}
