import Link from "next/link";
import { Bot, User } from "lucide-react";
import { Card } from "@/components/ui/card";
import { formatDateTime } from "@/lib/utils";
import type { ActivityEvent } from "@/lib/types";

interface ActivityFeedProps {
  events: (ActivityEvent & { projectId?: string; projectName?: string })[];
  emptyLabel?: string;
}

export function ActivityFeed({ events, emptyLabel = "Пока нет событий." }: ActivityFeedProps) {
  if (events.length === 0) {
    return <p className="text-sm text-ink-secondary">{emptyLabel}</p>;
  }

  return (
    <Card className="divide-y divide-border">
      {events.map((event) => {
        return (
          <div key={event.id} className="flex items-start gap-3 px-4 py-3">
            <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-icon-bg text-ink-secondary">
              {event.actorType === "agent" ? (
                <Bot className="h-3.5 w-3.5" strokeWidth={1.5} />
              ) : (
                <User className="h-3.5 w-3.5" strokeWidth={1.5} />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm text-ink">
                <span className="font-medium">{event.actor}</span> — {event.action}
                {event.projectId && event.projectName ? (
                  <>
                    {" "}
                    ·{" "}
                    <Link href={`/projects/${event.projectId}`} className="text-ink-secondary hover:text-ink hover:underline">
                      {event.projectName}
                    </Link>
                  </>
                ) : null}
              </p>
              <p className="mt-0.5 text-xs text-ink-secondary">{formatDateTime(event.createdAt)}</p>
            </div>
          </div>
        );
      })}
    </Card>
  );
}
