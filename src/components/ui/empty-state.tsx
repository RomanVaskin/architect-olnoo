import type { ReactNode } from "react";
import { Card } from "@/components/ui/card";

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <Card className="flex flex-col items-center gap-3 px-6 py-16 text-center">
      {icon ? <div className="rounded-full bg-icon-bg p-3 text-ink-secondary">{icon}</div> : null}
      <h3 className="text-lg font-semibold text-ink">{title}</h3>
      {description ? <p className="max-w-md text-sm text-ink-secondary">{description}</p> : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </Card>
  );
}
