"use client";

import { ArrowLeft, CheckCircle2, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ProjectStateBadge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";
import { ConceptFeedback } from "./concept-feedback";
import type { Concept, Feedback } from "@/lib/types";

const PRESERVED_CONSTRAINTS = [
  {
    key: "geometry",
    label: "Геометрия и пропорции",
    description: "Габариты, этажность и пропорции здания сохранены без изменений.",
  },
  {
    key: "roof",
    label: "Форма крыши",
    description: "Форма и уклон кровли соответствуют исходному зданию.",
  },
  {
    key: "openings",
    label: "Расположение окон и дверей",
    description: "Проёмы окон и дверей остаются на исходных местах.",
  },
] as const;

function sceneClassFor(conceptId: string) {
  const variant = conceptId.charCodeAt(conceptId.length - 1) % 3;
  return variant === 0 ? "architect-scene--graphite" : variant === 1 ? "architect-scene--wood" : "";
}

interface ConceptDetailProps {
  concept: Concept;
  isSelected: boolean;
  feedback: Feedback[];
  onAddFeedback: (comment: string) => void;
  onSelect: () => void;
  onBack: () => void;
}

export function ConceptDetail({ concept, isSelected, feedback, onAddFeedback, onSelect, onBack }: ConceptDetailProps) {
  const needsSpecialistReview = concept.state === "needs-specialist-review";

  return (
    <div className="flex flex-col gap-6">
      <Button type="button" variant="secondary" size="sm" className="self-start" onClick={onBack}>
        <ArrowLeft className="h-4 w-4" />
        Вернуться к вариантам
      </Button>

      <Card className="overflow-hidden">
        <div className={`architect-scene h-56 ${sceneClassFor(concept.id)}`}>
          {isSelected ? (
            <span className="absolute left-3 top-3 z-10 rounded-full bg-action px-2.5 py-1 text-[11px] font-medium text-action-ink">
              Выбрано
            </span>
          ) : null}
        </div>
        <div className="flex flex-col gap-4 p-5">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h2 className="text-lg font-semibold text-ink">{concept.label}</h2>
              <p className="mt-1 text-sm text-ink-secondary">Сгенерировано {formatDate(concept.createdAt)}</p>
            </div>
            <ProjectStateBadge state={concept.state} />
          </div>
          <p className="text-sm text-ink">{concept.summary}</p>

          <Button
            type="button"
            variant={isSelected ? "secondary" : "primary"}
            disabled={isSelected}
            onClick={onSelect}
            className="self-start"
          >
            {isSelected ? "Эта концепция выбрана" : "Выбрать эту концепцию"}
          </Button>
        </div>
      </Card>

      <Card className="p-5">
        <h3 className="text-sm font-medium text-ink-secondary">Объяснение изменений</h3>
        <p className="mt-2 text-sm text-ink">{concept.changeExplanation}</p>
      </Card>

      <Card className="p-5">
        <h3 className="text-sm font-medium text-ink-secondary">Сохранённые ограничения</h3>
        <div className="mt-3 flex flex-col divide-y divide-border">
          {PRESERVED_CONSTRAINTS.map((constraint) => (
            <div key={constraint.key} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
              {needsSpecialistReview ? (
                <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-action" strokeWidth={1.5} />
              ) : (
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-positive" strokeWidth={1.5} />
              )}
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-medium text-ink">{constraint.label}</p>
                  <span className={needsSpecialistReview ? "text-xs font-medium text-action" : "text-xs font-medium text-positive"}>
                    {needsSpecialistReview ? "Требует проверки специалиста" : "Проверено"}
                  </span>
                </div>
                <p className="mt-1 text-sm text-ink-secondary">{constraint.description}</p>
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card className="p-5">
        <h3 className="text-sm font-medium text-ink-secondary">Обратная связь</h3>
        <ConceptFeedback feedback={feedback} onSubmit={onAddFeedback} />
      </Card>
    </div>
  );
}
