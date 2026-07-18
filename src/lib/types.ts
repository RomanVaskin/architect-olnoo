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

export interface SourceFile {
  id: string;
  name: string;
  kind: "photo" | "drawing" | "document";
  uploadedAt: string;
}

export interface Concept {
  id: string;
  label: string;
  createdAt: string;
  state: ProjectState;
  summary: string;
  changeExplanation: string;
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
  concepts: Concept[];
  selectedConceptId: string | null;
  versions: ConceptVersionEntry[];
  feedback: Feedback[];
  activity: ActivityEvent[];
}
