import type { ConceptSourceProvenance, GenerationMode, GeometryVerificationReport } from "@/lib/types";
import { ConceptPersistError, type GenerationStage } from "./generation-diagnostics";

export interface PersistableConcept {
  key: string;
  label: string;
  summary: string;
  changeExplanation: string;
  blob: Blob;
  mimeType: string;
  mode: GenerationMode;
  warnings: string[];
  sourceProvenance?: ConceptSourceProvenance;
  geometryVerification?: GeometryVerificationReport;
  parentConceptId?: string;
}

/**
 * Dependency shape deliberately has no request/fetch slot: a value of this
 * type cannot reach the network, so any function that only takes deps of
 * this shape structurally cannot re-trigger the paid generation call.
 */
export interface PersistConceptsDeps {
  persistConcept: (projectId: string, concept: PersistableConcept) => Promise<string>;
  onDiagnostic?: (attemptId: string, stage: GenerationStage, error: unknown) => void;
}

export interface PersistConceptsResult {
  persistedKeys: string[];
  conceptIdsByKey: Record<string, string>;
  failedKeys: string[];
}

/**
 * Persists each concept one at a time so a single IndexedDB failure doesn't
 * discard the concepts that already saved. Safe to call again with only the
 * previously failed concepts — it never touches the generation API.
 */
export async function persistConceptsIndividually(
  deps: PersistConceptsDeps,
  attemptId: string,
  projectId: string,
  concepts: PersistableConcept[],
): Promise<PersistConceptsResult> {
  const persistedKeys: string[] = [];
  const failedKeys: string[] = [];
  const conceptIdsByKey: Record<string, string> = {};

  for (const concept of concepts) {
    try {
      const conceptId = await deps.persistConcept(projectId, concept);
      conceptIdsByKey[concept.key] = conceptId;
      persistedKeys.push(concept.key);
    } catch (error) {
      const stage: GenerationStage = error instanceof ConceptPersistError ? error.stage : "persist-concept";
      deps.onDiagnostic?.(attemptId, stage, error);
      failedKeys.push(concept.key);
    }
  }

  return { persistedKeys, conceptIdsByKey, failedKeys };
}
