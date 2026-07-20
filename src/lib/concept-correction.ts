import { cropImageToBlob, type CropRect } from "./crop-image";
import type { Concept, ConceptSourceViewProvenance, Project, SourceViewRole } from "./types";

type CropImage = (source: Blob, crop: CropRect, mimeType?: string) => Promise<Blob>;

export interface PreparedCorrectionInput {
  files: File[];
  roles: SourceViewRole[];
  findings: string[];
}

export function correctionFindings(concept: Concept): string[] {
  return (concept.geometryVerification?.checks ?? [])
    .filter((check) => check.status === "possible-deviation")
    .map((check) => `${check.key}: ${check.explanation}`);
}

export function canCreateCorrectedVersion(concept: Concept): boolean {
  return Boolean(
    concept.generatedImage &&
      concept.sourceProvenance &&
      concept.geometryVerification?.status === "possible-deviations" &&
      correctionFindings(concept).length > 0,
  );
}

export async function prepareConceptCorrection(
  project: Project,
  concept: Concept,
  cropImage: CropImage = cropImageToBlob,
): Promise<PreparedCorrectionInput> {
  if (!canCreateCorrectedVersion(concept) || !concept.generatedImage?.blob || !concept.sourceProvenance) {
    throw new Error("Для этой концепции нет конкретных замечаний Reviewer или исходных данных для исправления.");
  }

  const current = new File([concept.generatedImage.blob], "generated-concept-to-correct.png", {
    type: concept.generatedImage.mimeType,
  });
  const primary = await sourceViewFile(project, concept.sourceProvenance, "original-primary", cropImage);
  const referenceProvenance = concept.sourceProvenance.referenceViews?.[0];
  const reference = referenceProvenance
    ? await sourceViewFile(project, referenceProvenance, "original-reference", cropImage)
    : null;

  return {
    files: reference ? [current, primary.file, reference.file] : [current, primary.file],
    roles: reference ? ["other", primary.role, reference.role] : ["other", primary.role],
    findings: correctionFindings(concept),
  };
}

async function sourceViewFile(
  project: Project,
  provenance: ConceptSourceViewProvenance,
  name: string,
  cropImage: CropImage,
): Promise<{ file: File; role: SourceViewRole }> {
  const source = project.sourceFiles.find((item) => item.id === provenance.sourceFileId);
  if (!source?.imageBlob) throw new Error(`Исходное изображение «${provenance.sourceFileName}» недоступно в этом браузере.`);
  const mimeType = source.mimeType || source.imageBlob.type || provenance.payload.mimeType || "image/png";
  const dimensions = source.dimensions;
  const isFullFrame = Boolean(
    dimensions &&
      provenance.crop.x === 0 &&
      provenance.crop.y === 0 &&
      provenance.crop.width === dimensions.width &&
      provenance.crop.height === dimensions.height,
  );
  const blob = isFullFrame ? source.imageBlob : await cropImage(source.imageBlob, provenance.crop, mimeType);
  if (blob.size === 0) throw new Error("Не удалось подготовить исходный ракурс для исправления.");
  return { file: new File([blob], `${name}.${extensionForMimeType(mimeType)}`, { type: mimeType }), role: provenance.role };
}

function extensionForMimeType(mimeType: string): string {
  if (mimeType === "image/jpeg") return "jpg";
  if (mimeType === "image/webp") return "webp";
  return "png";
}
