import { Layers } from "lucide-react";
import { Card } from "@/components/ui/card";
import { ProjectStateBadge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";
import type { Concept } from "@/lib/types";

export function ConceptCard({ concept, isSelected }: { concept: Concept; isSelected?: boolean }) {
  return (
    <Card className={isSelected ? "border-ink/30 p-4" : "p-4"}>
      <div className="flex h-28 items-center justify-center rounded-xl bg-icon-bg">
        <Layers className="h-7 w-7 text-ink-secondary" strokeWidth={1.5} />
      </div>
      <div className="mt-3 flex flex-col gap-2">
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-sm font-medium text-ink">{concept.label}</h3>
          <ProjectStateBadge state={concept.state} />
        </div>
        <p className="text-sm text-ink-secondary">{concept.summary}</p>
        <p className="text-xs text-ink-secondary">Сгенерировано {formatDate(concept.createdAt)}</p>
      </div>
    </Card>
  );
}
