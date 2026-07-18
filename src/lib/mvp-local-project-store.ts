import type {
  Concept,
  GenerationMode,
  Project,
  ProjectBrief,
  Site,
  SourceFile,
} from "@/lib/types";

/**
 * Temporary MVP-only frontend persistence for projects created through the
 * New Project Wizard (see docs/01-PRODUCT.md — Single Source of Truth: this
 * is a local snapshot, not the platform's future backend). It exists only
 * because there is still no approved writable backend for Architect OLNOO —
 * once one exists, wizard-created projects should be written there instead
 * and this module retired.
 *
 * Stores project drafts, source-file metadata, and generated concept
 * metadata in one object store, and generated concept image bytes (as Blob,
 * never base64 in localStorage) in a second object store, keyed separately
 * so a project record stays small and JSON-serializable.
 *
 * Browser-only: every export here must be called from a Client Component.
 */

const DB_NAME = "architect-olnoo-mvp";
const DB_VERSION = 1;
const PROJECTS_STORE = "projects";
const IMAGES_STORE = "concept-images";

interface StoredGeneratedImage {
  imageKey: string;
  mimeType: string;
  mode: GenerationMode;
  warnings: string[];
}

interface StoredConcept extends Omit<Concept, "generatedImage"> {
  generatedImage?: StoredGeneratedImage;
}

interface StoredProject extends Omit<Project, "concepts"> {
  concepts: StoredConcept[];
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(PROJECTS_STORE)) {
        db.createObjectStore(PROJECTS_STORE, { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains(IMAGES_STORE)) {
        db.createObjectStore(IMAGES_STORE, { keyPath: "imageKey" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function putProjectRecord(record: StoredProject): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(PROJECTS_STORE, "readwrite");
  tx.objectStore(PROJECTS_STORE).put(record);
  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function getProjectRecord(id: string): Promise<StoredProject | undefined> {
  const db = await openDb();
  const tx = db.transaction(PROJECTS_STORE, "readonly");
  const record = await requestToPromise<StoredProject | undefined>(tx.objectStore(PROJECTS_STORE).get(id));
  return record ?? undefined;
}

async function putImageBlob(imageKey: string, blob: Blob): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(IMAGES_STORE, "readwrite");
  tx.objectStore(IMAGES_STORE).put({ imageKey, blob });
  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function getImageBlob(imageKey: string): Promise<Blob | undefined> {
  const db = await openDb();
  const tx = db.transaction(IMAGES_STORE, "readonly");
  const record = await requestToPromise<{ imageKey: string; blob: Blob } | undefined>(
    tx.objectStore(IMAGES_STORE).get(imageKey),
  );
  return record?.blob;
}

export interface DraftProjectInput {
  name: string;
  buildingType: string;
  site: Site;
  brief: ProjectBrief;
  sourceFiles: Pick<SourceFile, "name" | "kind">[];
}

/** Creates and persists a new project draft, returning its id. */
export async function createDraftProject(input: DraftProjectInput): Promise<string> {
  const id = `local-${crypto.randomUUID()}`;
  const now = new Date().toISOString();

  const record: StoredProject = {
    id,
    name: input.name,
    buildingType: input.buildingType,
    coverImage: id,
    lifecycleStage: "intake",
    state: "draft",
    updatedAt: now,
    site: input.site,
    brief: input.brief,
    sourceFiles: input.sourceFiles.map((file, index) => ({
      id: `${id}-src-${index}`,
      name: file.name,
      kind: file.kind,
      uploadedAt: now,
    })),
    concepts: [],
    selectedConceptId: null,
    versions: [],
    feedback: [],
    activity: [{ id: `${id}-a-0`, actor: "Пользователь", actorType: "user", action: "Проект создан в мастере", createdAt: now }],
  };

  await putProjectRecord(record);
  return id;
}

export interface GeneratedConceptInput {
  label: string;
  summary: string;
  changeExplanation: string;
  blob: Blob;
  mimeType: string;
  mode: GenerationMode;
  warnings: string[];
}

/** Appends successfully generated concepts to an existing draft project. */
export async function saveGeneratedConcepts(projectId: string, generated: GeneratedConceptInput[]): Promise<void> {
  const record = await getProjectRecord(projectId);
  if (!record) throw new Error(`Local project ${projectId} not found`);

  const now = new Date().toISOString();
  const newConcepts: StoredConcept[] = [];

  for (const [index, item] of generated.entries()) {
    const conceptId = `${projectId}-concept-${record.concepts.length + index + 1}`;
    const imageKey = `${projectId}:${conceptId}`;
    await putImageBlob(imageKey, item.blob);
    newConcepts.push({
      id: conceptId,
      label: item.label,
      createdAt: now,
      state: "awaiting-review",
      summary: item.summary,
      changeExplanation: item.changeExplanation,
      generatedImage: { imageKey, mimeType: item.mimeType, mode: item.mode, warnings: item.warnings },
    });
  }

  const updated: StoredProject = {
    ...record,
    lifecycleStage: "concept",
    state: "awaiting-review",
    updatedAt: now,
    concepts: [...record.concepts, ...newConcepts],
    activity: [
      {
        id: `${projectId}-a-${record.activity.length}`,
        actor: "AI Architect",
        actorType: "agent",
        action: `Сгенерировано ${generated.length} ${generated.length === 1 ? "концепция" : "концепции"}`,
        createdAt: now,
      },
      ...record.activity,
    ],
  };

  await putProjectRecord(updated);
}

/** Reads a local project back, reattaching generated-image blobs in memory. */
export async function getLocalProject(id: string): Promise<Project | undefined> {
  const record = await getProjectRecord(id);
  if (!record) return undefined;

  const concepts: Concept[] = await Promise.all(
    record.concepts.map(async (concept): Promise<Concept> => {
      const { generatedImage, ...rest } = concept;
      if (!generatedImage) return rest;
      const blob = await getImageBlob(generatedImage.imageKey);
      if (!blob) return rest;
      return {
        ...rest,
        generatedImage: {
          blob,
          mimeType: generatedImage.mimeType,
          mode: generatedImage.mode,
          warnings: generatedImage.warnings,
        },
      };
    }),
  );

  return { ...record, concepts };
}
