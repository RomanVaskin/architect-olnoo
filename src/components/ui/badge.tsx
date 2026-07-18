import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";
import {
  PROJECT_LIFECYCLE_LABELS,
  PROJECT_STATE_LABELS,
  type ProjectLifecycleStage,
  type ProjectState,
} from "@/lib/types";

type BadgeVariant = "neutral" | "accent" | "positive";

const variantClasses: Record<BadgeVariant, string> = {
  neutral: "bg-surface-soft text-ink-secondary",
  accent: "bg-accent/10 text-accent",
  positive: "bg-positive/10 text-positive",
};

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
}

export function Badge({ variant = "neutral", className, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium",
        variantClasses[variant],
        className,
      )}
      {...props}
    />
  );
}

const stateVariant: Record<ProjectState, BadgeVariant> = {
  draft: "neutral",
  "in-progress": "neutral",
  "awaiting-review": "accent",
  "needs-specialist-review": "accent",
  approved: "positive",
  blocked: "accent",
  archived: "neutral",
};

export function ProjectStateBadge({ state }: { state: ProjectState }) {
  return <Badge variant={stateVariant[state]}>{PROJECT_STATE_LABELS[state]}</Badge>;
}

export function LifecycleStageBadge({ stage }: { stage: ProjectLifecycleStage }) {
  return <Badge variant="neutral">{PROJECT_LIFECYCLE_LABELS[stage]}</Badge>;
}
