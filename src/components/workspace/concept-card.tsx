import { Card } from "@/components/ui/card";
import { ProjectStateBadge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";
import type { Concept } from "@/lib/types";

export function ConceptCard({ concept, isSelected }: { concept: Concept; isSelected?: boolean }) {
  const variant = concept.id.charCodeAt(concept.id.length - 1) % 3;
  const sceneClass = variant === 0 ? "architect-scene--graphite" : variant === 1 ? "architect-scene--wood" : "";

  return (
    <Card className={isSelected ? "overflow-hidden border-accent/60" : "overflow-hidden"}>
      <div className={`architect-scene h-36 ${sceneClass}`}>
        {isSelected ? <span className="absolute left-3 top-3 z-10 rounded-full bg-accent px-2.5 py-1 text-[11px] font-medium text-white">Выбрано</span> : null}
      </div>
      <div className="flex flex-col gap-2 p-4">
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
