"use client";

import { useRef, useState } from "react";
import { MAX_TOTAL_INLINE_IMAGE_BYTES, formatCombinedImageSizeError } from "@/lib/ai/request-validation";
import { GenerationFlowError, extractRecoveryState, requestAndDecodeConcepts } from "./concept-generation-flow";
import { persistConceptsIndividually, type PersistableConcept } from "./concept-persistence";
import { logGenerationDiagnostic } from "./generation-diagnostics";
import { createGenerationAttempt, saveGeneratedConcept } from "./mvp-local-project-store";
import {
  buildConceptSourceProvenance,
  prepareGenerationViews,
  type PreparedGenerationViews,
} from "./primary-view-generation";
import { isLocalProjectId } from "./project-id";
import {
  buildLocalGenerationFormData,
  buildStoredProjectGenerationInputs,
  canGenerateFromStoredProject,
} from "./stored-project-generation";
import type { GenerationMode, Project } from "./types";

const CONCEPT_LABELS = ["A", "B", "C"];

export interface LocalConceptGeneration {
  /** True only for a local project whose stored materials are sufficient for a paid generation. */
  canGenerate: boolean;
  isPreparing: boolean;
  prepareError: string | null;
  isOpen: boolean;
  prepared: PreparedGenerationViews | null;
  mode: GenerationMode;
  setMode: (mode: GenerationMode) => void;
  variantCount: 1 | 3;
  setVariantCount: (count: 1 | 3) => void;
  autoReview: boolean;
  setAutoReview: (enabled: boolean) => void;
  isGenerating: boolean;
  error: string | null;
  attemptId: string | null;
  pendingConcepts: PersistableConcept[];
  persistenceFailed: boolean;
  isRetryingSave: boolean;
  requiresRetryAcknowledgement: boolean;
  retryAcknowledged: boolean;
  setRetryAcknowledged: (value: boolean) => void;
  open: () => Promise<void>;
  close: () => void;
  confirm: () => Promise<void>;
  cancel: () => void;
  retrySave: () => Promise<void>;
}

/**
 * Paid concept generation started later from a saved local draft's Concepts
 * section. Deliberately mirrors the New Project wizard's flow step for step —
 * same preparation (prepareGenerationViews over the stored source images and
 * confirmed views), same confirmation dialog contract, same
 * requestAndDecodeConcepts safeguards (attempt persisted before dispatch,
 * risky-retry acknowledgement, recoverable lost-save state), and the same
 * POST /api/concepts/generate body (buildLocalGenerationFormData) — with one
 * difference: persistDraft resolves to the existing project id, so starting
 * generation later can never create a second project.
 */
export function useLocalConceptGeneration(project: Project, onCompleted?: () => Promise<void> | void): LocalConceptGeneration {
  const abortControllerRef = useRef<AbortController | null>(null);

  const [isOpen, setIsOpen] = useState(false);
  const [prepared, setPrepared] = useState<PreparedGenerationViews | null>(null);
  const [isPreparing, setIsPreparing] = useState(false);
  const [prepareError, setPrepareError] = useState<string | null>(null);
  const [mode, setMode] = useState<GenerationMode>("auto");
  const [variantCount, setVariantCount] = useState<1 | 3>(1);
  const [autoReview, setAutoReview] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [pendingConcepts, setPendingConcepts] = useState<PersistableConcept[]>([]);
  const [persistedKeys, setPersistedKeys] = useState<string[]>([]);
  const [persistenceFailed, setPersistenceFailed] = useState(false);
  const [isRetryingSave, setIsRetryingSave] = useState(false);
  const [requiresRetryAcknowledgement, setRequiresRetryAcknowledgement] = useState(false);
  const [retryAcknowledged, setRetryAcknowledged] = useState(false);

  const canGenerate = isLocalProjectId(project.id) && canGenerateFromStoredProject(project);

  async function open() {
    if (isPreparing || isOpen) return;
    setIsPreparing(true);
    setPrepareError(null);
    try {
      // Local-only preparation: reads stored bytes and crops in the browser.
      // Nothing is sent anywhere until the user confirms in the dialog.
      const inputs = buildStoredProjectGenerationInputs(project);
      const nextPrepared = await prepareGenerationViews(inputs.files, inputs.views, inputs.dimensionsByFileKey);
      if (nextPrepared.totalPayloadSizeBytes > MAX_TOTAL_INLINE_IMAGE_BYTES) {
        setPrepareError(formatCombinedImageSizeError(nextPrepared.totalPayloadSizeBytes));
        return;
      }
      setPrepared(nextPrepared);
      setError(null);
      setIsOpen(true);
    } catch (caught) {
      setPrepareError(
        caught instanceof Error ? caught.message : "Не удалось подготовить сохранённые ракурсы для генерации. Платный запрос не отправлялся.",
      );
    } finally {
      setIsPreparing(false);
    }
  }

  function close() {
    if (isGenerating) return;
    setIsOpen(false);
  }

  function cancel() {
    abortControllerRef.current?.abort();
  }

  async function persistDecoded(currentAttemptId: string, concepts: PersistableConcept[]): Promise<boolean> {
    const result = await persistConceptsIndividually(
      { persistConcept: saveGeneratedConcept, onDiagnostic: logGenerationDiagnostic },
      currentAttemptId,
      project.id,
      concepts,
    );
    setPersistedKeys(result.persistedKeys);
    if (result.failedKeys.length > 0) {
      setPersistenceFailed(true);
      setError(
        "Платная генерация завершена и изображения получены, но сохранить часть концепций в этом браузере не удалось. Не запускайте генерацию заново — скачайте изображения и повторите сохранение, когда будете готовы.",
      );
      return false;
    }
    return true;
  }

  async function confirm() {
    if (isGenerating || persistenceFailed) return; // guard against duplicate submissions and re-billing after a lost save
    if (requiresRetryAcknowledgement && !retryAcknowledged) return;
    if (!prepared || prepared.views.length === 0) {
      setError("Сохранённые ракурсы не подготовлены. Закройте окно и попробуйте ещё раз.");
      return;
    }

    setIsGenerating(true);
    setError(null);
    setPendingConcepts([]);
    setPersistedKeys([]);
    setRequiresRetryAcknowledgement(false);
    setRetryAcknowledged(false);

    const controller = new AbortController();
    abortControllerRef.current = controller;
    const primaryView = prepared.views[0];
    const referenceViews = prepared.views.slice(1);
    let currentAttemptId: string | null = null;

    try {
      const result = await requestAndDecodeConcepts(
        {
          // The draft already exists in IndexedDB — generation later must never create a second project.
          persistDraft: async () => project.id,
          persistAttempt: (projectId, newAttemptId) =>
            createGenerationAttempt(projectId, newAttemptId, buildConceptSourceProvenance(projectId, primaryView, referenceViews)),
          requestGeneration: (signal) =>
            fetch("/api/concepts/generate", {
              method: "POST",
              body: buildLocalGenerationFormData(prepared, project.brief, { mode, variantCount, autoReview }),
              signal,
            }),
          onDiagnostic: logGenerationDiagnostic,
        },
        controller.signal,
      );

      currentAttemptId = result.attemptId;
      setAttemptId(result.attemptId);

      const concepts: PersistableConcept[] = result.decoded.map((variant, index) => ({
        ...variant,
        label: `Концепция ${CONCEPT_LABELS[index] ?? index + 1}`,
        summary: project.brief.goal,
        changeExplanation: project.brief.wantsChanged.join("; ") || project.brief.goal,
        sourceProvenance: buildConceptSourceProvenance(project.id, primaryView, referenceViews),
      }));
      setPendingConcepts(concepts);

      if (await persistDecoded(result.attemptId, concepts)) {
        setIsOpen(false);
        await onCompleted?.();
      }
    } catch (caught) {
      if (caught instanceof GenerationFlowError) {
        const recovery = extractRecoveryState(caught);
        if (recovery?.attemptId) setAttemptId(recovery.attemptId);
        setRequiresRetryAcknowledgement(recovery?.requiresAcknowledgement ?? false);
        setError(recovery?.message ?? caught.message);
      } else {
        logGenerationDiagnostic(currentAttemptId ?? "unknown", "unknown", caught);
        setError("Не удалось выполнить запрос генерации из-за непредвиденной ошибки браузера. Проверьте консоль диагностики, прежде чем запускать генерацию снова.");
      }
    } finally {
      setIsGenerating(false);
      abortControllerRef.current = null;
    }
  }

  async function retrySave() {
    if (!attemptId || isRetryingSave) return;
    const pending = pendingConcepts.filter((concept) => !persistedKeys.includes(concept.key));
    if (pending.length === 0) {
      setPersistenceFailed(false);
      setIsOpen(false);
      await onCompleted?.();
      return;
    }

    setIsRetryingSave(true);
    setError(null);
    try {
      // persistConceptsIndividually only ever calls persistConcept (IndexedDB) — it has no
      // dependency capable of reaching /api/concepts/generate, so this can never re-bill.
      const result = await persistConceptsIndividually(
        { persistConcept: saveGeneratedConcept, onDiagnostic: logGenerationDiagnostic },
        attemptId,
        project.id,
        pending,
      );
      setPersistedKeys((previous) => [...previous, ...result.persistedKeys]);

      if (result.failedKeys.length > 0) {
        setError(
          "Повторное сохранение снова не удалось для части концепций. Изображения остаются доступны для скачивания — оплата уже выполнена, поэтому просто повторите сохранение позже.",
        );
        return;
      }

      setPersistenceFailed(false);
      setIsOpen(false);
      await onCompleted?.();
    } finally {
      setIsRetryingSave(false);
    }
  }

  return {
    canGenerate,
    isPreparing,
    prepareError,
    isOpen,
    prepared,
    mode,
    setMode,
    variantCount,
    setVariantCount,
    autoReview,
    setAutoReview,
    isGenerating,
    error,
    attemptId,
    pendingConcepts,
    persistenceFailed,
    isRetryingSave,
    requiresRetryAcknowledgement,
    retryAcknowledged,
    setRetryAcknowledged,
    open,
    close,
    confirm,
    cancel,
    retrySave,
  };
}
