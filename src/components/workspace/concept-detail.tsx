"use client";

import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ProjectStateBadge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";
import { GENERATION_MODE_LABELS } from "@/lib/types";
import { ConceptFeedback } from "./concept-feedback";
import { ConceptVisual } from "./concept-visual";
import type { Concept, Feedback } from "@/lib/types";
import { GeometryVerificationLine, GeometryVerificationPanel } from "./geometry-verification-summary";
import { canCreateCorrectedVersion } from "@/lib/concept-correction";

interface ConceptDetailProps {
  concept: Concept;
  isSelected: boolean;
  feedback: Feedback[];
  onAddFeedback: (comment: string) => void;
  onSelect: () => void;
  onBack: () => void;
  onCreateCorrection?: () => void;
}

export function ConceptDetail({ concept, isSelected, feedback, onAddFeedback, onSelect, onBack, onCreateCorrection }: ConceptDetailProps) {
  return (
    <div className="flex flex-col gap-6">
      <Button type="button" variant="secondary" size="sm" className="self-start" onClick={onBack}>
        <ArrowLeft className="h-4 w-4" />
        Вернуться к вариантам
      </Button>

      <Card className="overflow-hidden">
        <ConceptVisual
          concept={concept}
          heightClassName="h-56"
          badge={
            isSelected ? (
              <span className="absolute left-3 top-3 z-10 rounded-full bg-action px-2.5 py-1 text-[11px] font-medium text-action-ink">
                Выбрано
              </span>
            ) : null
          }
        />
        <div className="flex flex-col gap-4 p-5">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h2 className="text-lg font-semibold text-ink">{concept.label}</h2>
              <p className="mt-1 text-sm text-ink-secondary">Сгенерировано {formatDate(concept.createdAt)}</p>
            </div>
            <ProjectStateBadge state={concept.state} />
          </div>
          <p className="text-sm text-ink">{concept.summary}</p>
          {concept.generatedImage ? (
            <p className="text-xs text-ink-secondary">
              Режим генерации: {GENERATION_MODE_LABELS[concept.generatedImage.mode]}
            </p>
          ) : null}
          {concept.generatedImage ? <GeometryVerificationLine concept={concept} /> : null}

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

      <GeometryVerificationPanel report={concept.geometryVerification} />

      {onCreateCorrection && canCreateCorrectedVersion(concept) ? (
        <Card className="p-5">
          <h3 className="text-sm font-medium text-ink">Исправить найденные расхождения</h3>
          <p className="mt-1 text-sm leading-6 text-ink-secondary">
            Создать новую связанную версию, сохранив текущий дизайн и исправив только конкретные замечания Quality Gate.
            Перед запуском потребуется отдельное подтверждение платных AI-запросов.
          </p>
          <Button type="button" className="mt-4" onClick={onCreateCorrection}>Создать исправленную версию</Button>
        </Card>
      ) : null}

      <Card className="p-5">
        <h3 className="text-sm font-medium text-ink-secondary">Обратная связь</h3>
        <ConceptFeedback feedback={feedback} onSubmit={onAddFeedback} />
      </Card>
    </div>
  );
}
