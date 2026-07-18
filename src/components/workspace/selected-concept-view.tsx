"use client";

import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ProjectStateBadge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";
import { GENERATION_MODE_LABELS, GEOMETRY_VERIFICATION_NOTE } from "@/lib/types";
import { useConceptReview } from "@/lib/use-concept-review";
import { ConceptVisual } from "./concept-visual";
import type { Project } from "@/lib/types";

export function SelectedConceptView({ project }: { project: Project }) {
  const { selectedConceptId } = useConceptReview(project.id, project.selectedConceptId, project.feedback);
  const selected = project.concepts.find((concept) => concept.id === selectedConceptId);

  if (!selected) {
    return (
      <EmptyState
        title="Основная концепция ещё не выбрана"
        description="Откройте «Концепции» и отметьте один из вариантов как основной для дальнейшей доработки."
      />
    );
  }

  return (
    <Card className="overflow-hidden p-0">
      <ConceptVisual concept={selected} heightClassName="h-48" />
      <div className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h2 className="text-lg font-semibold text-ink">{selected.label}</h2>
            <p className="mt-1 text-sm text-ink-secondary">Сгенерировано {formatDate(selected.createdAt)}</p>
          </div>
          <ProjectStateBadge state={selected.state} />
        </div>
        <p className="mt-4 text-sm text-ink">{selected.summary}</p>
        {selected.generatedImage ? (
          <p className="mt-2 text-xs text-ink-secondary">
            Режим генерации: {GENERATION_MODE_LABELS[selected.generatedImage.mode]} · {GEOMETRY_VERIFICATION_NOTE}
          </p>
        ) : null}
        <div className="mt-4 border-t border-border pt-4">
          <h3 className="text-sm font-medium text-ink-secondary">Что изменилось и почему</h3>
          <p className="mt-2 text-sm text-ink">{selected.changeExplanation}</p>
        </div>
      </div>
    </Card>
  );
}
