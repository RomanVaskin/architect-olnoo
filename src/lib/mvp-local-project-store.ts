import type {
  Concept,
  ConceptSourceProvenance,
  GenerationMode,
  Project,
  ProjectBrief,
  Site,
  SourceFile,
  SourceView,
} from "@/lib/types";
import { ConceptPersistError, safeErrorCode } from "./generation-diagnostics";
import {
  blobToStoredImageRecord,
  storedImageRecordToBlob,
  type AnyStoredImageRecord,
} from "./concept-image-codec";
import { buildSourceRecords, type SourceFileRecordInput, type SourceViewRecordInput } from "./source-view-builder";

/**
 * Temporary MVP-only frontend persistence for projects created through the
 * New Project Wizard (see docs/01-PRODUCT.md — Single Source of Truth: this
 * is a local snapshot, not the platform's future backend). It exists only
 * because there is still no approved writable backend for Architect OLNOO —
 * once one exists, wizard-created projects should be written there instead
 * and this module retired.
 *
 * Stores project drafts, source-file metadata, and generated concept
 * metadata in one object store, and generated concept image bytes — as a
 * structured-clone-safe `{ imageKey, bytes: ArrayBuffer, mimeType }` record,
 * never a raw Blob (see `concept-image-codec.ts` — storing a Blob directly
 * threw `DataCloneError` in production) — in a second object store, keyed
 * separately so a project record stays small and JSON-serializable.
 *
 * Browser-only: every export here must be called from a Client Component.
 */

const DB_NAME = "architect-olnoo-mvp";
const DB_VERSION = 3;
const PROJECTS_STORE = "projects";
const IMAGES_STORE = "concept-images";
const ATTEMPTS_STORE = "generation-attempts";
const SOURCE_IMAGES_STORE = "source-images";

interface StoredGeneratedImage {
  imageKey: string;
  mimeType: string;
  mode: GenerationMode;
  warnings: string[];
}

interface StoredConcept extends Omit<Concept, "generatedImage"> {
  generatedImage?: StoredGeneratedImage;
}

interface StoredProject extends Omit<Project, "concepts" | "sourceFiles"> {
  sourceFiles: SourceFile[];
  sourceViews: SourceView[];
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
      if (!db.objectStoreNames.contains(ATTEMPTS_STORE)) {
        db.createObjectStore(ATTEMPTS_STORE, { keyPath: "attemptId" });
      }
      if (!db.objectStoreNames.contains(SOURCE_IMAGES_STORE)) {
        db.createObjectStore(SOURCE_IMAGES_STORE, { keyPath: "imageKey" });
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
  // Records written before sourceViews existed have no such field — normalize
  // once here so every other function can rely on it always being an array.
  return record ? { ...record, sourceViews: record.sourceViews ?? [] } : undefined;
}

async function putImageRecord(imageKey: string, blob: Blob, mimeType: string): Promise<void> {
  const record = await blobToStoredImageRecord(imageKey, blob, mimeType);
  const db = await openDb();
  const tx = db.transaction(IMAGES_STORE, "readwrite");
  tx.objectStore(IMAGES_STORE).put(record);
  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function getStoredImageRecord(imageKey: string): Promise<AnyStoredImageRecord | undefined> {
  const db = await openDb();
  const tx = db.transaction(IMAGES_STORE, "readonly");
  return requestToPromise<AnyStoredImageRecord | undefined>(tx.objectStore(IMAGES_STORE).get(imageKey));
}

async function getImageBlob(imageKey: string): Promise<Blob | undefined> {
  const record = await getStoredImageRecord(imageKey);
  return record ? storedImageRecordToBlob(record) : undefined;
}

async function putSourceImageRecord(imageKey: string, blob: Blob, mimeType: string): Promise<void> {
  const record = await blobToStoredImageRecord(imageKey, blob, mimeType);
  const db = await openDb();
  const tx = db.transaction(SOURCE_IMAGES_STORE, "readwrite");
  tx.objectStore(SOURCE_IMAGES_STORE).put(record);
  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function getSourceImageBlob(imageKey: string): Promise<Blob | undefined> {
  const db = await openDb();
  const tx = db.transaction(SOURCE_IMAGES_STORE, "readonly");
  const record = await requestToPromise<AnyStoredImageRecord | undefined>(tx.objectStore(SOURCE_IMAGES_STORE).get(imageKey));
  return record ? storedImageRecordToBlob(record) : undefined;
}

export interface DraftSourceFileInput extends SourceFileRecordInput {
  /** Raw bytes for a raster photo — present iff hasImage is true. Never written into the project's JSON record (see buildSourceRecords). */
  file?: File;
}

export interface DraftProjectInput {
  name: string;
  buildingType: string;
  site: Site;
  brief: ProjectBrief;
  sourceFiles: DraftSourceFileInput[];
  /** Confirmed Source Views (see Source Views confirmation step) — never persisted here as bytes, only as crop metadata pointing at a sourceFiles[].imageKey. */
  sourceViews?: SourceViewRecordInput[];
}

/**
 * Creates and persists a new project draft, returning its id. Source-image
 * bytes are written to the source-images store before the project's JSON
 * metadata record is written, and the metadata record itself is
 * structured-clone-checked first — the same defensive order already used by
 * saveGeneratedConcept, so a bug that leaks a File/Blob into the metadata
 * fails loudly here instead of throwing DataCloneError deep inside IndexedDB.
 */
export async function createDraftProject(input: DraftProjectInput): Promise<string> {
  const id = `local-${crypto.randomUUID()}`;
  const now = new Date().toISOString();

  const { sourceFiles, sourceViews } = buildSourceRecords(id, now, input.sourceFiles, input.sourceViews ?? []);

  await Promise.all(
    input.sourceFiles.map(async (fileInput, index) => {
      if (!fileInput.file) return;
      const imageKey = sourceFiles[index].imageKey;
      if (!imageKey) return;
      await putSourceImageRecord(imageKey, fileInput.file, fileInput.mimeType ?? fileInput.file.type);
    }),
  );

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
    sourceFiles,
    sourceViews,
    concepts: [],
    selectedConceptId: null,
    versions: [],
    feedback: [],
    activity: [{ id: `${id}-a-0`, actor: "Пользователь", actorType: "user", action: "Проект создан в мастере", createdAt: now }],
  };

  await putProjectRecord(structuredClone(record));
  return id;
}

/**
 * Records that a paid generation attempt was about to be sent, before the
 * request goes out, so a lost or failed response can still be traced back
 * to the project it was billed against.
 */
export async function createGenerationAttempt(
  projectId: string,
  attemptId: string,
  sourceProvenance?: ConceptSourceProvenance,
): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(ATTEMPTS_STORE, "readwrite");
  tx.objectStore(ATTEMPTS_STORE).put({
    attemptId,
    projectId,
    createdAt: new Date().toISOString(),
    ...(sourceProvenance ? { sourceProvenance: structuredClone(sourceProvenance) } : {}),
  });
  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export interface GeneratedConceptInput {
  label: string;
  summary: string;
  changeExplanation: string;
  blob: Blob;
  mimeType: string;
  mode: GenerationMode;
  warnings: string[];
  sourceProvenance?: ConceptSourceProvenance;
}

/**
 * Persists a single generated concept onto an existing draft project.
 * Called once per variant (never as a batch) so that if IndexedDB fails
 * partway through, the concepts that already saved are not lost or retried.
 *
 * The image and the project-metadata record are written in two separate
 * steps, each with its own diagnostics (`ConceptPersistError.stage`), so a
 * failure on one side can be told apart from a failure on the other. If the
 * image write succeeds but the metadata write then fails, the image is left
 * behind as a recoverable orphan — see `findOrphanImageKeys`/`recoverOrphanImage`.
 */
export async function saveGeneratedConcept(projectId: string, item: GeneratedConceptInput): Promise<string> {
  const record = await getProjectRecord(projectId);
  if (!record) throw new Error(`Local project ${projectId} not found`);

  const now = new Date().toISOString();
  const conceptId = `${projectId}-concept-${record.concepts.length + 1}`;
  const imageKey = `${projectId}:${conceptId}`;

  try {
    await putImageRecord(imageKey, item.blob, item.mimeType);
  } catch (error) {
    console.warn("[mvp-local-project-store]", { stage: "persist-concept-image", imageKey, code: safeErrorCode(error) });
    throw new ConceptPersistError("persist-concept-image");
  }

  const newConcept: StoredConcept = {
    id: conceptId,
    label: item.label,
    createdAt: now,
    state: "awaiting-review",
    summary: item.summary,
    changeExplanation: item.changeExplanation,
    generatedImage: { imageKey, mimeType: item.mimeType, mode: item.mode, warnings: [...item.warnings] },
    ...(item.sourceProvenance ? { sourceProvenance: structuredClone(item.sourceProvenance) } : {}),
  };

  const updated: StoredProject = {
    ...record,
    lifecycleStage: "concept",
    state: "awaiting-review",
    updatedAt: now,
    concepts: [...record.concepts, newConcept],
    activity: [
      {
        id: `${projectId}-a-${record.activity.length}`,
        actor: "AI Architect",
        actorType: "agent",
        action: `Сгенерирована концепция «${item.label}»`,
        createdAt: now,
      },
      ...record.activity,
    ],
  };

  try {
    // structuredClone both validates and produces a plain deep copy — the same
    // check IndexedDB performs internally, but run explicitly so a clone
    // failure is caught here and reported as a metadata (not image) failure.
    await putProjectRecord(structuredClone(updated));
  } catch (error) {
    console.warn("[mvp-local-project-store]", { stage: "persist-concept-metadata", projectId, conceptId, code: safeErrorCode(error) });
    throw new ConceptPersistError("persist-concept-metadata");
  }

  return conceptId;
}

/**
 * Every imageKey currently referenced by a concept, across all local
 * projects — used to tell a live image apart from an orphan.
 */
async function allReferencedImageKeys(): Promise<Set<string>> {
  const db = await openDb();
  const tx = db.transaction(PROJECTS_STORE, "readonly");
  const records = await requestToPromise<StoredProject[]>(tx.objectStore(PROJECTS_STORE).getAll());
  const keys = new Set<string>();
  for (const record of records) {
    for (const concept of record.concepts) {
      if (concept.generatedImage) keys.add(concept.generatedImage.imageKey);
    }
  }
  return keys;
}

/**
 * Image records saved by `saveGeneratedConcept` with no concept referencing
 * them — this happens only when the image write succeeded but the following
 * project-metadata write then failed (a paid, decoded image whose bytes are
 * safe in IndexedDB, but not yet attached to any project).
 */
export async function findOrphanImageKeys(): Promise<string[]> {
  const db = await openDb();
  const tx = db.transaction(IMAGES_STORE, "readonly");
  const records = await requestToPromise<AnyStoredImageRecord[]>(tx.objectStore(IMAGES_STORE).getAll());
  const referenced = await allReferencedImageKeys();
  return records.map((imageRecord) => imageRecord.imageKey).filter((imageKey) => !referenced.has(imageKey));
}

/**
 * Attaches an orphaned image (see `findOrphanImageKeys`) to its project as a
 * recovered concept. Local-only: it never calls the generation API — the
 * image bytes already exist in IndexedDB from the original paid request.
 */
export async function recoverOrphanImage(imageKey: string): Promise<string> {
  const projectId = imageKey.split(":")[0];
  const record = await getProjectRecord(projectId);
  if (!record) throw new Error(`Local project ${projectId} not found for orphan image ${imageKey}`);

  const imageRecord = await getStoredImageRecord(imageKey);
  if (!imageRecord) throw new Error(`Orphan image ${imageKey} not found`);
  const mimeType = "mimeType" in imageRecord ? imageRecord.mimeType : imageRecord.blob.type;

  const now = new Date().toISOString();
  const conceptId = `${projectId}-concept-recovered-${record.concepts.length + 1}`;
  const newConcept: StoredConcept = {
    id: conceptId,
    label: "Восстановленная концепция",
    createdAt: now,
    state: "awaiting-review",
    summary: "Изображение восстановлено локально после сбоя сохранения — повторный запрос к AI-провайдеру не выполнялся.",
    changeExplanation: "Восстановлено из ранее сохранённого изображения этого проекта.",
    generatedImage: { imageKey, mimeType, mode: "auto", warnings: ["recovered-locally"] },
  };

  const updated: StoredProject = {
    ...record,
    lifecycleStage: "concept",
    state: "awaiting-review",
    updatedAt: now,
    concepts: [...record.concepts, newConcept],
    activity: [
      {
        id: `${projectId}-a-${record.activity.length}`,
        actor: "Пользователь",
        actorType: "user",
        action: "Локально восстановлено ранее сохранённое изображение",
        createdAt: now,
      },
      ...record.activity,
    ],
  };

  await putProjectRecord(structuredClone(updated));
  return conceptId;
}

/** Reads a local project back, reattaching generated-image and source-image blobs in memory. */
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

  const sourceFiles: SourceFile[] = await Promise.all(
    record.sourceFiles.map(async (file): Promise<SourceFile> => {
      if (!file.imageKey) return file;
      const imageBlob = await getSourceImageBlob(file.imageKey);
      return imageBlob ? { ...file, imageBlob } : file;
    }),
  );

  return { ...record, sourceFiles, concepts };
}
