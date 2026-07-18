import Link from "next/link";
import { Card } from "@/components/ui/card";
import { ProjectStateBadge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";
import type { Concept, Project } from "@/lib/types";

interface PendingDecisionsProps {
  items: { concept: Concept; project: Project }[];
}

export function PendingDecisions({ items }: PendingDecisionsProps) {
  if (items.length === 0) {
    return <p className="text-sm text-ink-secondary">Сейчас нет концепций, ожидающих решения.</p>;
  }

  return (
    <Card className="divide-y divide-border">
      {items.map(({ concept, project }) => (
        <Link
          key={concept.id}
          href={`/projects/${project.id}/concepts`}
          className="flex items-center justify-between gap-4 px-4 py-3 hover:bg-surface-soft"
        >
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-ink">{concept.label}</p>
            <p className="truncate text-xs text-ink-secondary">
              {project.name} · сгенерировано {formatDate(concept.createdAt)}
            </p>
          </div>
          <ProjectStateBadge state={concept.state} />
        </Link>
      ))}
    </Card>
  );
}
