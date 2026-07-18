"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useConceptReview } from "@/lib/use-concept-review";
import { ConceptCard } from "./concept-card";
import { ConceptComparison } from "./concept-comparison";
import { ConceptDetail } from "./concept-detail";
import type { Project } from "@/lib/types";

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

  const compareConcepts = useMemo(
    () => project.concepts.filter((concept) => compareIds.includes(concept.id)),
    [project.concepts, compareIds],
  );

  const detailConcept = useMemo(
    () => project.concepts.find((concept) => concept.id === detailId) ?? null,
    [project.concepts, detailId],
  );

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
      <ConceptDetail
        concept={detailConcept}
        isSelected={detailConcept.id === selectedConceptId}
        feedback={feedback.filter((item) => item.conceptId === detailConcept.id)}
        onAddFeedback={(comment) => addFeedback(detailConcept.id, comment)}
        onSelect={() => selectAndReturn(detailConcept.id)}
        onBack={() => setView("gallery")}
      />
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
    </div>
  );
}
