"use client";

import { useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { requestAndDecodeConcepts, extractRecoveryState, GenerationFlowError } from "@/lib/concept-generation-flow";
import { prepareConceptCorrection } from "@/lib/concept-correction";
import { persistConceptsIndividually, type PersistableConcept } from "@/lib/concept-persistence";
import { logGenerationDiagnostic } from "@/lib/generation-diagnostics";
import { createGenerationAttempt, saveGeneratedConcept } from "@/lib/mvp-local-project-store";
import { useConceptReview } from "@/lib/use-concept-review";
import { ConceptCard } from "./concept-card";
import { ConceptComparison } from "./concept-comparison";
import { ConceptCorrectionDialog } from "./concept-correction-dialog";
import { ConceptDetail } from "./concept-detail";
import type { Concept, GenerationMode, Project } from "@/lib/types";

type View = "gallery" | "compare" | "detail";

export function ConceptsWorkspace({ project }: { project: Project }) {
  const { selectedConceptId, feedback, selectConcept, addFeedback } = useConceptReview(
    project.id,
    project.selectedConceptId,
    project.feedback,
  );
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
  const correctionAbortRef = useRef<AbortController | null>(null);

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
    setCorrectionAttemptId(null);
    setPendingCorrection(null);
    setCorrectionPersistenceFailed(false);
    setRequiresCorrectionAcknowledgement(false);
    setCorrectionAcknowledged(false);
  }

  function closeCorrection() {
    if (isCorrecting) return;
    setCorrectionConcept(null);
    setCorrectionError(null);
    setPendingCorrection(null);
    setCorrectionPersistenceFailed(false);
    setRequiresCorrectionAcknowledgement(false);
    setCorrectionAcknowledged(false);
  }

  async function persistCorrection(attemptId: string, concept: PersistableConcept) {
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

  async function runCorrection() {
    if (!correctionConcept || isCorrecting || correctionPersistenceFailed) return;
    if (requiresCorrectionAcknowledgement && !correctionAcknowledged) return;

    setIsCorrecting(true);
    setCorrectionError(null);
    setPendingCorrection(null);
    setCorrectionPersistenceFailed(false);
    setRequiresCorrectionAcknowledgement(false);
    setCorrectionAcknowledged(false);

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
      await persistCorrection(result.attemptId, corrected);
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
      setIsCorrecting(false);
      correctionAbortRef.current = null;
    }
  }

  async function retryCorrectionSave() {
    if (!pendingCorrection || !correctionAttemptId || isRetryingCorrectionSave) return;
    setIsRetryingCorrectionSave(true);
    setCorrectionError(null);
    try {
      // IndexedDB-only recovery. This path has no fetch dependency and can
      // never start another paid generation or reviewer call.
      await persistCorrection(correctionAttemptId, pendingCorrection);
    } finally {
      setIsRetryingCorrectionSave(false);
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
        <ConceptDetail
          concept={detailConcept}
          isSelected={detailConcept.id === selectedConceptId}
          feedback={feedback.filter((item) => item.conceptId === detailConcept.id)}
          onAddFeedback={(comment) => addFeedback(detailConcept.id, comment)}
          onSelect={() => selectAndReturn(detailConcept.id)}
          onBack={() => setView("gallery")}
          onCreateCorrection={() => openCorrection(detailConcept)}
        />
        {correctionDialog}
      </>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {project.concepts.map((concept) => (
          <ConceptCard
            key={concept.id}
            concept={concept}
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
    </div>
  );
}
