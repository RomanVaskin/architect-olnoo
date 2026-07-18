"use client";

import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ProjectStateBadge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";
import { PROJECT_STATE_LABELS } from "@/lib/types";
import { ConceptVisual } from "./concept-visual";
import type { Concept, Project } from "@/lib/types";

interface ConceptComparisonProps {
  concepts: [Concept, Concept];
  project: Project;
  selectedConceptId: string | null;
  onSelect: (conceptId: string) => void;
  onBack: () => void;
}

export function ConceptComparison({ concepts, project, selectedConceptId, onSelect, onBack }: ConceptComparisonProps) {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-ink">Сравнение концепций</h2>
          <p className="mt-1 text-sm text-ink-secondary">Две концепции показаны рядом для принятия решения.</p>
        </div>
        <Button type="button" variant="secondary" size="sm" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" />
          Вернуться к вариантам
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {concepts.map((concept) => {
          const isSelected = concept.id === selectedConceptId;
          return (
            <Card
              key={concept.id}
              className={isSelected ? "flex flex-col overflow-hidden border-accent/60" : "flex flex-col overflow-hidden"}
            >
              <ConceptVisual
                concept={concept}
                heightClassName="h-40"
                badge={
                  isSelected ? (
                    <span className="absolute left-3 top-3 z-10 rounded-full bg-action px-2.5 py-1 text-[11px] font-medium text-action-ink">
                      Выбрано
                    </span>
                  ) : null
                }
              />
              <div className="flex flex-1 flex-col gap-4 p-5">
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-base font-semibold text-ink">{concept.label}</h3>
                    <ProjectStateBadge state={concept.state} />
                  </div>
                  <p className="mt-1 text-xs text-ink-secondary">Сгенерировано {formatDate(concept.createdAt)}</p>
                </div>

                <p className="text-sm text-ink">{concept.summary}</p>

                <div className="border-t border-border pt-3">
                  <h4 className="text-xs font-medium uppercase tracking-wide text-ink-secondary">Что изменилось</h4>
                  <p className="mt-2 text-sm text-ink">{concept.changeExplanation}</p>
                </div>

                <div className="border-t border-border pt-3">
                  <h4 className="text-xs font-medium uppercase tracking-wide text-ink-secondary">Что осталось без изменений</h4>
                  {project.brief.mustKeep.length === 0 ? (
                    <p className="mt-2 text-sm text-ink-secondary">Ограничения ещё не зафиксированы.</p>
                  ) : (
                    <ul className="mt-2 flex flex-col gap-1.5">
                      {project.brief.mustKeep.map((item) => (
                        <li key={item} className="text-sm text-ink">
                          · {item}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div className="border-t border-border pt-3">
                  <h4 className="text-xs font-medium uppercase tracking-wide text-ink-secondary">Текущее состояние</h4>
                  <p className="mt-2 text-sm text-ink">{PROJECT_STATE_LABELS[concept.state]}</p>
                </div>

                <Button
                  type="button"
                  variant={isSelected ? "secondary" : "primary"}
                  disabled={isSelected}
                  onClick={() => onSelect(concept.id)}
                  className="mt-auto"
                >
                  {isSelected ? "Эта концепция выбрана" : "Выбрать эту концепцию"}
                </Button>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
