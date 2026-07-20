"use client";

import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ProjectStateBadge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";
import { GENERATION_MODE_LABELS } from "@/lib/types";
import { useProjectConceptReview } from "@/lib/use-project-concept-review";
import { ConceptVisual } from "./concept-visual";
import type { Project } from "@/lib/types";
import { GeometryVerificationLine, GeometryVerificationPanel } from "./geometry-verification-summary";

export function SelectedConceptView({ project }: { project: Project }) {
  const { selectedConceptId } = useProjectConceptReview(project);
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
      <ConceptVisual concept={selected} projectId={project.id} heightClassName="h-48" />
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
            Режим генерации: {GENERATION_MODE_LABELS[selected.generatedImage.mode]}
          </p>
        ) : null}
        {selected.generatedImage ? <GeometryVerificationLine concept={selected} className="mt-1" /> : null}
        <div className="mt-4 border-t border-border pt-4">
          <h3 className="text-sm font-medium text-ink-secondary">Что изменилось и почему</h3>
          <p className="mt-2 text-sm text-ink">{selected.changeExplanation}</p>
        </div>
      </div>
      <div className="border-t border-border p-5">
        <GeometryVerificationPanel report={selected.geometryVerification} />
      </div>
    </Card>
  );
}
