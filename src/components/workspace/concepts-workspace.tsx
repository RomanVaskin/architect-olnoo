"use client";

import { useMemo, useRef, useState } from "react";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { requestAndDecodeConcepts, extractRecoveryState, GenerationFlowError } from "@/lib/concept-generation-flow";
import { prepareConceptCorrection } from "@/lib/concept-correction";
import { persistConceptsIndividually, type PersistableConcept } from "@/lib/concept-persistence";
import { logGenerationDiagnostic } from "@/lib/generation-diagnostics";
import { createGenerationAttempt, saveGeneratedConcept } from "@/lib/mvp-local-project-store";
import { useProjectConceptReview } from "@/lib/use-project-concept-review";
import { isLocalProjectId, isServerProjectId } from "@/lib/project-id";
import { base64ToBlob } from "@/lib/base64";
import { CloudGenerationRequestError, requestCloudCorrection, requestCloudGeneration } from "@/lib/cloud-generation-client";
import { useLocalConceptGeneration } from "@/lib/use-local-concept-generation";
import { GenerationConfirmDialog } from "@/components/projects/generation-confirm-dialog";
import { ConceptCard } from "./concept-card";
import { ConceptComparison } from "./concept-comparison";
import { ConceptCorrectionDialog } from "./concept-correction-dialog";
import { ConceptDetail } from "./concept-detail";
import { CloudGenerateDialog } from "./cloud-generate-dialog";
import type { Concept, GenerationMode, Project } from "@/lib/types";

type View = "gallery" | "compare" | "detail";

export function ConceptsWorkspace({ project, onRefresh }: { project: Project; onRefresh?: () => Promise<void> }) {
  const isCloudProject = isServerProjectId(project.id);
  const { selectedConceptId, feedback, selectConcept, addFeedback, error: reviewError } = useProjectConceptReview(project);
  const [view, setView] = useState<View>("gallery");
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [correctionConcept, setCorrectionConcept] = useState<Concept | null>(null);
  const [correctionMode, setCorrectionMode] = useState<GenerationMode>("balanced");
  const [isCorrecting, setIsCorrecting] = useState(false);
  const [correctionError, setCorrectionError] = useState<string | null>(null);
  const [correctionAttemptId, setCorrectionAttemptId] = useState<string | null>(null);
  const [pendingCorrection, setPendingCorrection] = useState<PersistableConcept | null>(null);
  const [correctionPersistenceFailed, setCorrectionPersistenceFailed] = useState(false);
  const [isRetryingCorrectionSave, setIsRetryingCorrectionSave] = useState(false);
  const [requiresCorrectionAcknowledgement, setRequiresCorrectionAcknowledgement] = useState(false);
  const [correctionAcknowledged, setCorrectionAcknowledged] = useState(false);
  const [cloudCorrectionRawImage, setCloudCorrectionRawImage] = useState<{ base64: string; mimeType: string } | null>(null);
  const correctionAbortRef = useRef<AbortController | null>(null);

  const [showCloudGenerateDialog, setShowCloudGenerateDialog] = useState(false);
  const [cloudGenerateAttemptKey, setCloudGenerateAttemptKey] = useState<string | null>(null);
  const [cloudGenerateMode, setCloudGenerateMode] = useState<GenerationMode>("balanced");
  const [cloudGenerateAutoReview, setCloudGenerateAutoReview] = useState(true);
  const [isCloudGenerating, setIsCloudGenerating] = useState(false);
  const [cloudGenerateError, setCloudGenerateError] = useState<string | null>(null);
  const [cloudGenerateRequiresAck, setCloudGenerateRequiresAck] = useState(false);
  const [cloudGenerateAcknowledged, setCloudGenerateAcknowledged] = useState(false);
  const [cloudGeneratePersistenceFailed, setCloudGeneratePersistenceFailed] = useState(false);
  const [cloudGenerateRawImage, setCloudGenerateRawImage] = useState<{ base64: string; mimeType: string } | null>(null);
  const [isRetryingCloudGenerateSave, setIsRetryingCloudGenerateSave] = useState(false);

  // Paid generation started later from a saved local draft (see specs — a
  // draft saved without generation keeps the full local workflow available).
  const localGeneration = useLocalConceptGeneration(project, onRefresh);

  function toggleCompare(conceptId: string) {
    setCompareIds((prev) => {
      if (prev.includes(conceptId)) return prev.filter((id) => id !== conceptId);
      if (prev.length >= 2) return prev;
      return [...prev, conceptId];
    });
  }

  function openDetail(conceptId: string) {
    setDetailId(conceptId);
    setView("detail");
  }

  function selectAndReturn(conceptId: string) {
    selectConcept(conceptId);
    setView("gallery");
    setCompareIds([]);
  }

  function openCorrection(concept: Concept) {
    setCorrectionConcept(concept);
    setCorrectionMode(concept.generatedImage?.mode ?? "balanced");
    setCorrectionError(null);
    setCorrectionAttemptId(isCloudProject ? crypto.randomUUID() : null);
    setPendingCorrection(null);
    setCorrectionPersistenceFailed(false);
    setRequiresCorrectionAcknowledgement(false);
    setCorrectionAcknowledged(false);
    setCloudCorrectionRawImage(null);
  }

  function closeCorrection() {
    if (isCorrecting) return;
    setCorrectionConcept(null);
    setCorrectionError(null);
    setPendingCorrection(null);
    setCorrectionPersistenceFailed(false);
    setRequiresCorrectionAcknowledgement(false);
    setCorrectionAcknowledged(false);
    setCloudCorrectionRawImage(null);
  }

  async function persistLocalCorrection(attemptId: string, concept: PersistableConcept) {
    const result = await persistConceptsIndividually(
      { persistConcept: saveGeneratedConcept, onDiagnostic: logGenerationDiagnostic },
      attemptId,
      project.id,
      [concept],
    );
    if (result.failedKeys.length > 0) {
      setCorrectionPersistenceFailed(true);
      setCorrectionError(
        "Платное исправление и повторная проверка завершены, но новую версию не удалось сохранить в этом браузере. Не запускайте AI повторно — скачайте результат или повторите только сохранение.",
      );
      return false;
    }
    window.location.reload();
    return true;
  }

  async function runLocalCorrection() {
    if (!correctionConcept) return;
    const controller = new AbortController();
    correctionAbortRef.current = controller;
    let currentAttemptId = "unknown";

    try {
      // All local source preparation happens before the paid request. If an
      // original view is unavailable, the flow stops without contacting AI.
      let prepared;
      try {
        prepared = await prepareConceptCorrection(project, correctionConcept);
      } catch (error) {
        setCorrectionError(
          error instanceof Error
            ? error.message
            : "Не удалось подготовить исходные изображения для исправления. Платный запрос не отправлялся.",
        );
        return;
      }
      const result = await requestAndDecodeConcepts(
        {
          persistDraft: async () => project.id,
          persistAttempt: (projectId, attemptId) =>
            createGenerationAttempt(projectId, attemptId, correctionConcept.sourceProvenance),
          requestGeneration: (signal) => {
            const formData = new FormData();
            prepared.files.forEach((file) => formData.append("images", file));
            formData.append("roles", JSON.stringify(prepared.roles));
            formData.append("sourceConceptId", correctionConcept.id);
            formData.append("goal", project.brief.goal);
            formData.append("explicitChanges", correctionConcept.changeExplanation);
            formData.append("mustKeep", JSON.stringify(project.brief.mustKeep));
            formData.append("mayChange", JSON.stringify(project.brief.mayChange));
            formData.append("findings", JSON.stringify(prepared.findings));
            formData.append("mode", correctionMode);
            return fetch("/api/concepts/correct", { method: "POST", body: formData, signal });
          },
          onDiagnostic: logGenerationDiagnostic,
        },
        controller.signal,
      );

      currentAttemptId = result.attemptId;
      setCorrectionAttemptId(result.attemptId);
      const decoded = result.decoded[0];
      const corrected: PersistableConcept = {
        ...decoded,
        label: `${correctionConcept.label} · исправленная версия`,
        summary: "Исправленная версия по замечаниям Quality Gate",
        changeExplanation: `Исправлены замечания: ${prepared.findings.join("; ")}`,
        sourceProvenance: correctionConcept.sourceProvenance,
        parentConceptId: correctionConcept.id,
      };
      setPendingCorrection(corrected);
      await persistLocalCorrection(result.attemptId, corrected);
    } catch (error) {
      const recovery = extractRecoveryState(error);
      if (error instanceof GenerationFlowError && recovery) {
        setCorrectionAttemptId(recovery.attemptId);
        setRequiresCorrectionAcknowledgement(recovery.requiresAcknowledgement);
        setCorrectionError(recovery.message);
      } else {
        logGenerationDiagnostic(currentAttemptId, "unknown", error);
        setCorrectionError(
          error instanceof Error
            ? error.message
            : "Не удалось подготовить или выполнить исправление. Платный повторный запуск не выполнен автоматически.",
        );
      }
    } finally {
      correctionAbortRef.current = null;
    }
  }

  async function runCloudCorrection() {
    if (!correctionConcept) return;
    const acknowledging = requiresCorrectionAcknowledgement && correctionAcknowledged;
    const attemptKey = acknowledging || !correctionAttemptId ? crypto.randomUUID() : correctionAttemptId;
    setCorrectionAttemptId(attemptKey);
    setRequiresCorrectionAcknowledgement(false);
    setCorrectionAcknowledged(false);

    try {
      const result = await requestCloudCorrection(project.id, correctionConcept.id, { attemptKey, mode: correctionMode });
      if (result.status === "succeeded") {
        setCorrectionConcept(null);
        await onRefresh?.();
        return;
      }
      if (result.status === "persistence-failed") {
        setCorrectionPersistenceFailed(true);
        setCloudCorrectionRawImage({ base64: result.imageBase64, mimeType: result.mimeType });
        setPendingCorrection({
          key: attemptKey,
          label: "Исправленная версия",
          summary: "",
          changeExplanation: "",
          blob: base64ToBlob(result.imageBase64, result.mimeType),
          mimeType: result.mimeType,
          mode: correctionMode,
          warnings: [],
        });
        setCorrectionError(result.error.message);
        return;
      }
      setRequiresCorrectionAcknowledgement(result.requiresAcknowledgement);
      setCorrectionError(result.error.message);
    } catch (error) {
      if (error instanceof CloudGenerationRequestError) {
        setRequiresCorrectionAcknowledgement(error.requiresAcknowledgement);
        setCorrectionError(error.message);
      } else {
        setCorrectionError("Не удалось выполнить исправление из-за непредвиденной ошибки браузера.");
      }
    }
  }

  async function runCorrection() {
    if (!correctionConcept || isCorrecting || correctionPersistenceFailed) return;
    if (requiresCorrectionAcknowledgement && !correctionAcknowledged) return;

    setIsCorrecting(true);
    setCorrectionError(null);
    setPendingCorrection(null);
    setCorrectionPersistenceFailed(false);

    try {
      if (isCloudProject) {
        await runCloudCorrection();
      } else {
        setRequiresCorrectionAcknowledgement(false);
        setCorrectionAcknowledged(false);
        await runLocalCorrection();
      }
    } finally {
      setIsCorrecting(false);
    }
  }

  async function retryCorrectionSave() {
    if (isRetryingCorrectionSave || !correctionConcept) return;
    setIsRetryingCorrectionSave(true);
    setCorrectionError(null);
    try {
      if (isCloudProject) {
        if (!correctionAttemptId || !cloudCorrectionRawImage) return;
        const result = await requestCloudCorrection(project.id, correctionConcept.id, {
          attemptKey: correctionAttemptId,
          mode: correctionMode,
          retryImageBase64: cloudCorrectionRawImage.base64,
          retryMimeType: cloudCorrectionRawImage.mimeType,
        });
        if (result.status === "succeeded") {
          setCorrectionPersistenceFailed(false);
          setCorrectionConcept(null);
          await onRefresh?.();
          return;
        }
        setCorrectionError(result.error.message);
        return;
      }
      if (!pendingCorrection || !correctionAttemptId) return;
      // IndexedDB-only recovery. This path has no fetch dependency and can
      // never start another paid generation or reviewer call.
      await persistLocalCorrection(correctionAttemptId, pendingCorrection);
    } finally {
      setIsRetryingCorrectionSave(false);
    }
  }

  function openCloudGenerate() {
    setShowCloudGenerateDialog(true);
    setCloudGenerateAttemptKey(crypto.randomUUID());
    setCloudGenerateError(null);
    setCloudGenerateRequiresAck(false);
    setCloudGenerateAcknowledged(false);
    setCloudGeneratePersistenceFailed(false);
    setCloudGenerateRawImage(null);
  }

  function closeCloudGenerate() {
    if (isCloudGenerating) return;
    setShowCloudGenerateDialog(false);
  }

  async function runCloudGenerate() {
    if (isCloudGenerating || cloudGeneratePersistenceFailed) return;
    if (cloudGenerateRequiresAck && !cloudGenerateAcknowledged) return;
    setIsCloudGenerating(true);
    setCloudGenerateError(null);

    const acknowledging = cloudGenerateRequiresAck && cloudGenerateAcknowledged;
    const attemptKey = acknowledging || !cloudGenerateAttemptKey ? crypto.randomUUID() : cloudGenerateAttemptKey;
    setCloudGenerateAttemptKey(attemptKey);
    setCloudGenerateRequiresAck(false);
    setCloudGenerateAcknowledged(false);

    try {
      const result = await requestCloudGeneration(project.id, { attemptKey, mode: cloudGenerateMode, autoReview: cloudGenerateAutoReview });
      if (result.status === "succeeded") {
        setShowCloudGenerateDialog(false);
        await onRefresh?.();
        return;
      }
      if (result.status === "persistence-failed") {
        setCloudGeneratePersistenceFailed(true);
        setCloudGenerateRawImage({ base64: result.imageBase64, mimeType: result.mimeType });
        setCloudGenerateError(result.error.message);
        return;
      }
      setCloudGenerateRequiresAck(result.requiresAcknowledgement);
      setCloudGenerateError(result.error.message);
    } catch (error) {
      if (error instanceof CloudGenerationRequestError) {
        setCloudGenerateRequiresAck(error.requiresAcknowledgement);
        setCloudGenerateError(error.message);
      } else {
        setCloudGenerateError("Не удалось выполнить генерацию из-за непредвиденной ошибки браузера.");
      }
    } finally {
      setIsCloudGenerating(false);
    }
  }

  async function retryCloudGenerateSave() {
    if (!cloudGenerateAttemptKey || !cloudGenerateRawImage || isRetryingCloudGenerateSave) return;
    setIsRetryingCloudGenerateSave(true);
    setCloudGenerateError(null);
    try {
      const result = await requestCloudGeneration(project.id, {
        attemptKey: cloudGenerateAttemptKey,
        mode: cloudGenerateMode,
        autoReview: cloudGenerateAutoReview,
        retryImageBase64: cloudGenerateRawImage.base64,
        retryMimeType: cloudGenerateRawImage.mimeType,
      });
      if (result.status === "succeeded") {
        setCloudGeneratePersistenceFailed(false);
        setShowCloudGenerateDialog(false);
        await onRefresh?.();
        return;
      }
      setCloudGenerateError(result.error.message);
    } catch (error) {
      setCloudGenerateError(error instanceof CloudGenerationRequestError ? error.message : "Повторное сохранение не удалось.");
    } finally {
      setIsRetryingCloudGenerateSave(false);
    }
  }

  const compareConcepts = useMemo(
    () => project.concepts.filter((concept) => compareIds.includes(concept.id)),
    [project.concepts, compareIds],
  );

  const detailConcept = useMemo(
    () => project.concepts.find((concept) => concept.id === detailId) ?? null,
    [project.concepts, detailId],
  );

  const correctionDialog = correctionConcept ? (
    <ConceptCorrectionDialog
      concept={correctionConcept}
      mode={correctionMode}
      onModeChange={setCorrectionMode}
      isGenerating={isCorrecting}
      error={correctionError}
      attemptId={correctionAttemptId}
      requiresAcknowledgement={requiresCorrectionAcknowledgement}
      acknowledged={correctionAcknowledged}
      onAcknowledgedChange={setCorrectionAcknowledged}
      persistenceFailed={correctionPersistenceFailed}
      pendingCorrection={pendingCorrection}
      isRetryingSave={isRetryingCorrectionSave}
      onConfirm={runCorrection}
      onCancelGeneration={() => correctionAbortRef.current?.abort()}
      onRetrySave={retryCorrectionSave}
      onClose={closeCorrection}
    />
  ) : null;

  const cloudGenerateDialog = showCloudGenerateDialog ? (
    <CloudGenerateDialog
      mode={cloudGenerateMode}
      onModeChange={setCloudGenerateMode}
      autoReview={cloudGenerateAutoReview}
      onAutoReviewChange={setCloudGenerateAutoReview}
      isGenerating={isCloudGenerating}
      error={cloudGenerateError}
      requiresAcknowledgement={cloudGenerateRequiresAck}
      acknowledged={cloudGenerateAcknowledged}
      onAcknowledgedChange={setCloudGenerateAcknowledged}
      persistenceFailed={cloudGeneratePersistenceFailed}
      isRetryingSave={isRetryingCloudGenerateSave}
      onConfirm={runCloudGenerate}
      onRetrySave={retryCloudGenerateSave}
      onClose={closeCloudGenerate}
    />
  ) : null;

  const generateButton = isCloudProject ? (
    <Button type="button" size="sm" onClick={openCloudGenerate}>
      <Sparkles className="h-4 w-4" />
      Сгенерировать концепцию
    </Button>
  ) : null;

  // Generation started later from a saved local draft — only offered when the
  // stored materials are actually sufficient (exactly one Primary View with
  // persisted bytes and dimensions), so the empty state never promises a
  // generation that would fail before dispatch.
  const localGenerateButton = localGeneration.canGenerate ? (
    <Button type="button" size="sm" disabled={localGeneration.isPreparing} onClick={localGeneration.open}>
      <Sparkles className="h-4 w-4" />
      {localGeneration.isPreparing ? "Подготовка ракурса…" : "Сгенерировать концепцию"}
    </Button>
  ) : null;

  const localGenerateDialog = localGeneration.isOpen && localGeneration.prepared ? (
    <GenerationConfirmDialog
      fileCount={localGeneration.prepared.views.length}
      sourcePreviews={localGeneration.prepared.views.map((view) => ({
        blob: view.file,
        sourceFileName: view.sourceFileName,
        role: view.role,
        width: view.dimensions.width,
        height: view.dimensions.height,
        sizeBytes: view.payloadSizeBytes,
        isPrimary: view.isPrimary,
      }))}
      mode={localGeneration.mode}
      onModeChange={localGeneration.setMode}
      variantCount={localGeneration.variantCount}
      onVariantCountChange={localGeneration.setVariantCount}
      autoReview={localGeneration.autoReview}
      onAutoReviewChange={localGeneration.setAutoReview}
      isGenerating={localGeneration.isGenerating}
      error={localGeneration.error}
      onConfirm={localGeneration.confirm}
      onCancelGeneration={localGeneration.cancel}
      onClose={localGeneration.close}
      persistenceFailed={localGeneration.persistenceFailed}
      isRetryingSave={localGeneration.isRetryingSave}
      recoveryConcepts={localGeneration.pendingConcepts}
      onRetrySave={localGeneration.retrySave}
      attemptId={localGeneration.attemptId}
      draftProjectId={project.id}
      requiresRetryAcknowledgement={localGeneration.requiresRetryAcknowledgement}
      retryAcknowledged={localGeneration.retryAcknowledged}
      onRetryAcknowledgedChange={localGeneration.setRetryAcknowledged}
    />
  ) : null;

  if (view === "compare" && compareConcepts.length === 2) {
    return (
      <ConceptComparison
        concepts={[compareConcepts[0], compareConcepts[1]]}
        project={project}
        selectedConceptId={selectedConceptId}
        onSelect={selectAndReturn}
        onBack={() => setView("gallery")}
      />
    );
  }

  if (view === "detail" && detailConcept) {
    return (
      <>
        {reviewError ? <p role="alert" className="rounded-xl border border-border bg-surface-soft px-4 py-3 text-sm text-action">{reviewError}</p> : null}
        <ConceptDetail
          concept={detailConcept}
          projectId={project.id}
          isSelected={detailConcept.id === selectedConceptId}
          feedback={feedback.filter((item) => item.conceptId === detailConcept.id)}
          onAddFeedback={(comment) => addFeedback(detailConcept.id, comment)}
          onSelect={() => selectAndReturn(detailConcept.id)}
          onBack={() => setView("gallery")}
          onCreateCorrection={isLocalProjectId(project.id) || isCloudProject ? () => openCorrection(detailConcept) : undefined}
        />
        {correctionDialog}
        {cloudGenerateDialog}
      </>
    );
  }

  if (project.concepts.length === 0) {
    return (
      <>
        <EmptyState
          title="Концепции ещё не сгенерированы"
          description={
            isCloudProject
              ? "Сгенерируйте первую концепцию по подтверждённому основному ракурсу и брифу этого проекта."
              : localGeneration.canGenerate
                ? "Материалы, основной ракурс и бриф уже сохранены в этом черновике. Генерация — платный запрос к внешнему AI-сервису; запустите её, когда будете готовы."
                : "Заполните бриф и загрузите исходные материалы, чтобы AI Architect предложил варианты."
          }
          action={generateButton ?? localGenerateButton}
        />
        {localGeneration.prepareError ? (
          <p role="alert" className="rounded-xl border border-border bg-surface-soft px-4 py-3 text-sm text-action">
            {localGeneration.prepareError}
          </p>
        ) : null}
        {cloudGenerateDialog}
        {localGenerateDialog}
      </>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {reviewError ? <p role="alert" className="rounded-xl border border-border bg-surface-soft px-4 py-3 text-sm text-action">{reviewError}</p> : null}
      {generateButton ? <div className="flex justify-end">{generateButton}</div> : null}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {project.concepts.map((concept) => (
          <ConceptCard
            key={concept.id}
            concept={concept}
            projectId={project.id}
            isSelected={concept.id === selectedConceptId}
            isComparing={compareIds.includes(concept.id)}
            compareDisabled={compareIds.length >= 2 && !compareIds.includes(concept.id)}
            onToggleCompare={() => toggleCompare(concept.id)}
            onSelect={() => selectConcept(concept.id)}
            onDetail={() => openDetail(concept.id)}
          />
        ))}
      </div>

      {compareIds.length > 0 ? (
        <Card className="sticky bottom-4 z-10 flex flex-wrap items-center justify-between gap-3 px-4 py-3">
          <p className="text-sm text-ink-secondary">
            {compareIds.length === 1
              ? "Выбрана 1 концепция для сравнения. Выберите ещё одну."
              : "Выбрано 2 концепции для сравнения."}
          </p>
          <div className="flex items-center gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={() => setCompareIds([])}>
              Отменить
            </Button>
            <Button type="button" size="sm" disabled={compareIds.length !== 2} onClick={() => setView("compare")}>
              Сравнить
            </Button>
          </div>
        </Card>
      ) : null}

      {correctionDialog}
      {cloudGenerateDialog}
      {localGenerateDialog}
    </div>
  );
}
