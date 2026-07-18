import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ProjectStateBadge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";
import { GEOMETRY_VERIFICATION_NOTE } from "@/lib/types";
import type { Concept } from "@/lib/types";
import { ConceptVisual } from "./concept-visual";

interface ConceptCardProps {
  concept: Concept;
  isSelected?: boolean;
  isComparing?: boolean;
  compareDisabled?: boolean;
  onToggleCompare?: () => void;
  onSelect?: () => void;
  onDetail?: () => void;
}

export function ConceptCard({
  concept,
  isSelected,
  isComparing,
  compareDisabled,
  onToggleCompare,
  onSelect,
  onDetail,
}: ConceptCardProps) {
  return (
    <Card className={isSelected ? "flex flex-col overflow-hidden border-accent/60" : "flex flex-col overflow-hidden"}>
      <ConceptVisual
        concept={concept}
        heightClassName="h-36"
        badge={
          isSelected ? (
            <span className="absolute left-3 top-3 z-10 rounded-full bg-action px-2.5 py-1 text-[11px] font-medium text-action-ink">
              Выбрано
            </span>
          ) : null
        }
      />
      <div className="flex flex-1 flex-col gap-2 p-4">
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-sm font-medium text-ink">{concept.label}</h3>
          <ProjectStateBadge state={concept.state} />
        </div>
        <p className="text-sm text-ink-secondary">{concept.summary}</p>
        <p className="text-xs text-ink-secondary">Сгенерировано {formatDate(concept.createdAt)}</p>
        {concept.generatedImage ? <p className="text-xs text-ink-secondary">{GEOMETRY_VERIFICATION_NOTE}</p> : null}

        {onToggleCompare || onSelect || onDetail ? (
          <div className="mt-2 flex flex-wrap items-center gap-2 border-t border-border pt-3">
            {onToggleCompare ? (
              <Button
                type="button"
                variant={isComparing ? "primary" : "secondary"}
                size="sm"
                disabled={!isComparing && compareDisabled}
                title={!isComparing && compareDisabled ? "Можно сравнить не более двух концепций" : undefined}
                onClick={onToggleCompare}
              >
                {isComparing ? "Убрать из сравнения" : "Сравнить"}
              </Button>
            ) : null}
            {onSelect ? (
              <Button type="button" variant={isSelected ? "secondary" : "primary"} size="sm" disabled={isSelected} onClick={onSelect}>
                {isSelected ? "Выбрана" : "Выбрать концепцию"}
              </Button>
            ) : null}
            {onDetail ? (
              <Button type="button" variant="ghost" size="sm" onClick={onDetail}>
                Подробнее
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>
    </Card>
  );
}
