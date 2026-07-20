import type { SupabaseClient } from "@supabase/supabase-js";
import type { ProjectState } from "@/lib/types";

/**
 * Aggregate read-only queries backing the real Dashboard (`/`, see
 * src/app/page.tsx and specs/... — replaces the previous mock-data-only
 * homepage). Every query relies on RLS (see
 * supabase/migrations/202607200001_backend_foundation.sql) to scope results
 * to the caller's own workspaces — nothing here filters by user id itself,
 * the same pattern as project-repository.ts.
 */

export interface DashboardPendingDecision {
  conceptId: string;
  conceptLabel: string;
  conceptState: ProjectState;
  conceptCreatedAt: string;
  projectId: string;
  projectName: string;
}

export interface DashboardActivityItem {
  id: string;
  actor: string;
  actorType: "user" | "agent";
  action: string;
  createdAt: string;
  projectId: string;
  projectName: string;
}

export interface DashboardSummary {
  projectsNeedingSpecialistReview: number;
  conceptsAwaitingReview: number;
  pendingDecisions: DashboardPendingDecision[];
  recentActivity: DashboardActivityItem[];
}

const PENDING_CONCEPT_STATES: ProjectState[] = ["awaiting-review", "needs-specialist-review"];
const RECENT_LIMIT = 8;

export class DashboardRepositoryError extends Error {
  readonly code: "database-failed";
  constructor(stage: string) {
    super(stage);
    this.name = "DashboardRepositoryError";
    this.code = "database-failed";
  }
}

function failOnDatabaseError(error: { message?: string } | null, stage: string): void {
  if (!error) return;
  throw new DashboardRepositoryError(stage);
}

export async function getDashboardSummary(supabase: SupabaseClient): Promise<DashboardSummary> {
  const [specialistReviewResult, conceptsAwaitingResult, pendingConceptsResult, activityResult] = await Promise.all([
    supabase.from("projects").select("id", { count: "exact", head: true }).eq("state", "needs-specialist-review"),
    supabase.from("concepts").select("id", { count: "exact", head: true }).eq("state", "awaiting-review"),
    supabase
      .from("concepts")
      .select("id,label,state,created_at,project_id,projects(name)")
      .in("state", PENDING_CONCEPT_STATES)
      .order("created_at", { ascending: false })
      .limit(RECENT_LIMIT),
    supabase
      .from("activity_events")
      .select("id,actor_type,action,metadata,created_at,project_id,projects(name)")
      .order("created_at", { ascending: false })
      .limit(RECENT_LIMIT),
  ]);

  failOnDatabaseError(specialistReviewResult.error, "specialist-review-count");
  failOnDatabaseError(conceptsAwaitingResult.error, "concepts-awaiting-count");
  failOnDatabaseError(pendingConceptsResult.error, "pending-decisions");
  failOnDatabaseError(activityResult.error, "recent-activity");

  const pendingDecisions = ((pendingConceptsResult.data ?? []) as PendingConceptRow[])
    .map(mapPendingDecision)
    .filter((item): item is DashboardPendingDecision => item !== null);

  const recentActivity = ((activityResult.data ?? []) as ActivityRow[])
    .map(mapActivityItem)
    .filter((item): item is DashboardActivityItem => item !== null);

  return {
    projectsNeedingSpecialistReview: specialistReviewResult.count ?? 0,
    conceptsAwaitingReview: conceptsAwaitingResult.count ?? 0,
    pendingDecisions,
    recentActivity,
  };
}

interface PendingConceptRow {
  id: string;
  label: string;
  state: string;
  created_at: string;
  project_id: string;
  projects: { name: string } | { name: string }[] | null;
}

interface ActivityRow {
  id: string;
  actor_type: string;
  action: string;
  metadata: unknown;
  created_at: string;
  project_id: string;
  projects: { name: string } | { name: string }[] | null;
}

function projectName(projects: PendingConceptRow["projects"]): string | null {
  if (!projects) return null;
  const row = Array.isArray(projects) ? projects[0] : projects;
  return row?.name ?? null;
}

export function mapPendingDecision(row: PendingConceptRow): DashboardPendingDecision | null {
  const name = projectName(row.projects);
  if (!name) return null;
  return {
    conceptId: row.id,
    conceptLabel: row.label,
    conceptState: row.state as ProjectState,
    conceptCreatedAt: row.created_at,
    projectId: row.project_id,
    projectName: name,
  };
}

export function mapActivityItem(row: ActivityRow): DashboardActivityItem | null {
  const name = projectName(row.projects);
  if (!name) return null;
  const metadata = isRecord(row.metadata) ? row.metadata : {};
  const actorType = row.actor_type === "agent" ? "agent" : "user";
  return {
    id: row.id,
    actor: typeof metadata.actorName === "string" ? metadata.actorName : actorType === "agent" ? "AI Architect" : "Пользователь",
    actorType,
    action: row.action,
    createdAt: row.created_at,
    projectId: row.project_id,
    projectName: name,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
