import Link from "next/link";
import { Card } from "@/components/ui/card";
import { ProjectStateBadge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";
import type { DashboardPendingItem } from "@/lib/dashboard-merge";

interface PendingDecisionsProps {
  items: DashboardPendingItem[];
}

export function PendingDecisions({ items }: PendingDecisionsProps) {
  if (items.length === 0) {
    return <p className="text-sm text-ink-secondary">Сейчас нет концепций, ожидающих решения.</p>;
  }

  return (
    <Card className="divide-y divide-border">
      {items.map((item) => (
        <Link
          key={item.conceptId}
          href={`/projects/${item.projectId}/concepts`}
          className="flex items-center justify-between gap-4 px-4 py-3 hover:bg-surface-soft"
        >
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-ink">{item.conceptLabel}</p>
            <p className="truncate text-xs text-ink-secondary">
              {item.projectName} · сгенерировано {formatDate(item.conceptCreatedAt)}
            </p>
          </div>
          <ProjectStateBadge state={item.conceptState} />
        </Link>
      ))}
    </Card>
  );
}
