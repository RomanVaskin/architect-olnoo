"use client";

import { Layers } from "lucide-react";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ProjectStateBadge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";
import { useConceptReview } from "@/lib/use-concept-review";
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
    <Card className="p-5">
      <div className="flex h-48 items-center justify-center rounded-xl bg-icon-bg">
        <Layers className="h-10 w-10 text-ink-secondary" strokeWidth={1.5} />
      </div>
      <div className="mt-4 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold text-ink">{selected.label}</h2>
          <p className="mt-1 text-sm text-ink-secondary">Сгенерировано {formatDate(selected.createdAt)}</p>
        </div>
        <ProjectStateBadge state={selected.state} />
      </div>
      <p className="mt-4 text-sm text-ink">{selected.summary}</p>
      <div className="mt-4 border-t border-border pt-4">
        <h3 className="text-sm font-medium text-ink-secondary">Что изменилось и почему</h3>
        <p className="mt-2 text-sm text-ink">{selected.changeExplanation}</p>
      </div>
    </Card>
  );
}
