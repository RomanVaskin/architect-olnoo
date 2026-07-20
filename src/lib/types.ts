/**
 * Conceptual UI types for the MVP prototype, mirroring the Core Entities and
 * Project Lifecycle / Project States defined in docs/01-PRODUCT.md.
 * Not a database schema — see docs/03-DATABASE.md for that.
 */

export type ProjectLifecycleStage =
  | "intake"
  | "concept"
  | "design-development"
  | "professional-documentation"
  | "construction-documentation"
  | "construction-support"
  | "operation-modernization";

export type ProjectState =
  | "draft"
  | "in-progress"
  | "awaiting-review"
  | "needs-specialist-review"
  | "approved"
  | "blocked"
  | "archived";

export const PROJECT_LIFECYCLE_LABELS: Record<ProjectLifecycleStage, string> = {
  intake: "Приём материалов",
  concept: "Концепция",
  "design-development": "Проработка решения",
  "professional-documentation": "Профессиональная документация",
  "construction-documentation": "Документация для строительства",
  "construction-support": "Сопровождение строительства",
  "operation-modernization": "Эксплуатация и модернизация",
};

export const PROJECT_STATE_LABELS: Record<ProjectState, string> = {
  draft: "Черновик",
  "in-progress": "В работе",
  "awaiting-review": "Ждёт решения",
  "needs-specialist-review": "Нужна проверка специалиста",
  approved: "Утверждено",
  blocked: "Заблокировано",
  archived: "В архиве",
};

export interface Site {
  address: string;
  climateZone: string;
  areaSqm: number;
}

export interface ProjectBrief {
  goal: string;
  mustKeep: string[];
  mayChange: string[];
  wantsChanged: string[];
  budgetNote?: string;
}

export interface SourceImageDimensions {
  width: number;
  height: number;
}

export interface SourceFile {
  id: string;
  name: string;
  kind: "photo" | "drawing" | "document";
  uploadedAt: string;
  /** Key into the source-image byte store (see mvp-local-project-store.ts) — present only for raster photos whose bytes were persisted. */
  imageKey?: string;
  mimeType?: string;
  dimensions?: SourceImageDimensions;
  /** Attached in memory only when a local project is read back from IndexedDB; never serialized. */
  imageBlob?: Blob;
}

/**
 * A view is a rectangular region of a source photo — either the whole photo
 * (the common case) or one panel of a vertically stacked multi-view collage
 * (see src/lib/collage-detector.ts). Purely descriptive metadata: the crop
 * is applied at render time against the original stored bytes, which are
 * never modified or re-encoded.
 */
export type SourceViewRole = "front" | "side" | "rear" | "detail" | "other";

export const SOURCE_VIEW_ROLE_LABELS: Record<SourceViewRole, string> = {
  front: "Главный фасад",
  side: "Боковой фасад",
  rear: "Задний фасад",
  detail: "Деталь",
  other: "Другое",
};

export interface SourceViewCropRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Only the Primary View (`isPrimary: true`) is sent to generation. Other
 * confirmed views remain project materials and provenance references.
 */
export interface SourceView {
  id: string;
  sourceImageId: string;
  crop: SourceViewCropRect;
  order: number;
  role: SourceViewRole;
  isPrimary: boolean;
  imageKey: string;
}

/**
 * Product-facing generation modes (see specs/exterior-agent.md). These names
 * are shown to the user and passed to the API; the underlying provider and
 * model identifiers are resolved server-side only (src/lib/ai/model-registry.ts).
 */
export type GenerationMode = "auto" | "fast" | "balanced" | "maximum-quality";

export const GENERATION_MODE_LABELS: Record<GenerationMode, string> = {
  auto: "Автоматически",
  fast: "Быстро",
  balanced: "Сбалансировано",
  "maximum-quality": "Максимальное качество",
};

/**
 * Shown wherever a generated image is displayed. Generation and geometry
 * verification are separate processes (see docs/01-PRODUCT.md — Human Control) —
 * the interface must never claim geometry constraints were verified automatically.
 */
export const GEOMETRY_VERIFICATION_NOTE = "Автоматическая проверка геометрии не выполнена";
export const GEOMETRY_SPECIALIST_REVIEW_NOTE = "Требует проверки специалиста";

export type GeometryCheckKey = "camera" | "volumes" | "roof" | "openings" | "proportions";
export type GeometryCheckStatus = "consistent" | "possible-deviation" | "uncertain";
export type GeometryVerificationStatus =
  | "no-obvious-deviations"
  | "possible-deviations"
  | "inconclusive"
  | "not-run";

export interface GeometryVerificationCheck {
  key: GeometryCheckKey;
  status: GeometryCheckStatus;
  confidence: number;
  explanation: string;
}

/**
 * Advisory AI comparison of the Primary View and a generated concept. It is
 * deliberately not an approval/certification and never replaces review by an
 * architect or another qualified specialist.
 */
export interface GeometryVerificationReport {
  status: GeometryVerificationStatus;
  confidence: number;
  summary: string;
  checks: GeometryVerificationCheck[];
  advisory: string;
  /** Primary View plus reference source views actually supplied to Reviewer. */
  reviewedSourceViews?: number;
}

/**
 * Present only for concepts produced by the real generation pipeline (see
 * src/app/api/concepts/generate/route.ts). The blob is attached in-memory by
 * the local project store (src/lib/mvp-local-project-store.ts) when a concept
 * is read back from IndexedDB — it is never serialized to localStorage or JSON.
 */
export interface GeneratedConceptImage {
  blob: Blob;
  mimeType: string;
  mode: GenerationMode;
  warnings: string[];
}

export interface ConceptSourceViewProvenance {
  sourceFileId: string;
  sourceViewId: string;
  sourceFileName: string;
  role: SourceViewRole;
  crop: SourceViewCropRect;
  payload: {
    mimeType: string;
    width: number;
    height: number;
    sizeBytes: number;
  };
}

/** Exact Primary View plus optional reference-view payloads used for a generated concept. */
export interface ConceptSourceProvenance extends ConceptSourceViewProvenance {
  referenceViews?: ConceptSourceViewProvenance[];
}

export interface Concept {
  id: string;
  label: string;
  createdAt: string;
  state: ProjectState;
  summary: string;
  changeExplanation: string;
  generatedImage?: GeneratedConceptImage;
  /** Present for concepts produced after the Phase 2 Primary View pipeline. */
  sourceProvenance?: ConceptSourceProvenance;
  /** Present when Phase 4 automatic visual comparison was requested. */
  geometryVerification?: GeometryVerificationReport;
  /** Present for a paid Phase 6 correction derived from another concept. */
  parentConceptId?: string;
}

export interface ConceptVersionEntry {
  id: string;
  conceptId: string;
  label: string;
  createdAt: string;
  changeSummary: string;
}

export interface Feedback {
  id: string;
  conceptId: string;
  author: string;
  createdAt: string;
  comment: string;
}

export interface ActivityEvent {
  id: string;
  actor: string;
  actorType: "user" | "agent";
  action: string;
  createdAt: string;
}

export interface Project {
  id: string;
  name: string;
  buildingType: string;
  coverImage: string;
  lifecycleStage: ProjectLifecycleStage;
  state: ProjectState;
  updatedAt: string;
  site: Site;
  brief: ProjectBrief;
  sourceFiles: SourceFile[];
  /** Optional so existing mock projects don't need a value; wizard-created projects always set it (possibly []). */
  sourceViews?: SourceView[];
  concepts: Concept[];
  selectedConceptId: string | null;
  versions: ConceptVersionEntry[];
  feedback: Feedback[];
  activity: ActivityEvent[];
}
