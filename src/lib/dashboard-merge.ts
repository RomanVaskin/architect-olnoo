import type { Project, ProjectState, Site } from "./types";
import { projectCoverFields } from "./project-cover";
import type { ServerProjectSummary } from "./server/project-repository";
import type { DashboardActivityItem, DashboardPendingDecision, DashboardSummary } from "./server/dashboard-repository";

/**
 * Pure aggregation for the real Dashboard (`/`, see src/app/page.tsx and
 * src/lib/use-dashboard-data.ts for the client hook that gathers the raw
 * inputs). Combines cloud (Supabase, via GET /api/dashboard + GET
 * /api/projects) and local (IndexedDB, already filtered to unsynced by the
 * caller — see project-list-merge.ts) sources into one honest view: no
 * fake counts, no demo data mixed into real totals.
 */

export interface DashboardRecentProject {
  id: string;
  name: string;
  buildingType: string;
  site: Site;
  lifecycleStage: Project["lifecycleStage"];
  state: ProjectState;
  updatedAt: string;
  coverImage: string;
  /** Set only for local (IndexedDB) projects — see resolveProjectCover. */
  coverImageBlob?: Blob;
  origin: "cloud" | "local";
}

export interface DashboardPendingItem {
  conceptId: string;
  conceptLabel: string;
  conceptState: ProjectState;
  conceptCreatedAt: string;
  projectId: string;
  projectName: string;
}

export interface DashboardActivityRow {
  id: string;
  actor: string;
  actorType: "user" | "agent";
  action: string;
  createdAt: string;
  projectId?: string;
  projectName?: string;
}

export interface DashboardView {
  cloudProjectCount: number;
  localUnsyncedCount: number;
  conceptsAwaitingReview: number;
  projectsNeedingSpecialistReview: number;
  recentProjects: DashboardRecentProject[];
  pendingDecisions: DashboardPendingItem[];
  recentActivity: DashboardActivityRow[];
  hasAnyRealProject: boolean;
}

const RECENT_PROJECTS_LIMIT = 6;
const PENDING_LIMIT = 6;
const ACTIVITY_LIMIT = 8;
const PENDING_CONCEPT_STATES: ProjectState[] = ["awaiting-review", "needs-specialist-review"];

function byDateDesc(a: string, b: string): number {
  return new Date(b).getTime() - new Date(a).getTime();
}

function localPendingDecisions(localProjects: Project[]): DashboardPendingItem[] {
  return localProjects.flatMap((project) =>
    project.concepts
      .filter((concept) => PENDING_CONCEPT_STATES.includes(concept.state))
      .map((concept) => ({
        conceptId: concept.id,
        conceptLabel: concept.label,
        conceptState: concept.state,
        conceptCreatedAt: concept.createdAt,
        projectId: project.id,
        projectName: project.name,
      })),
  );
}

function localActivity(localProjects: Project[]): DashboardActivityRow[] {
  return localProjects.flatMap((project) =>
    project.activity.map((event) => ({
      id: event.id,
      actor: event.actor,
      actorType: event.actorType,
      action: event.action,
      createdAt: event.createdAt,
      projectId: project.id,
      projectName: project.name,
    })),
  );
}

function cloudPendingToView(item: DashboardPendingDecision): DashboardPendingItem {
  return {
    conceptId: item.conceptId,
    conceptLabel: item.conceptLabel,
    conceptState: item.conceptState,
    conceptCreatedAt: item.conceptCreatedAt,
    projectId: item.projectId,
    projectName: item.projectName,
  };
}

function cloudActivityToView(item: DashboardActivityItem): DashboardActivityRow {
  return {
    id: item.id,
    actor: item.actor,
    actorType: item.actorType,
    action: item.action,
    createdAt: item.createdAt,
    projectId: item.projectId,
    projectName: item.projectName,
  };
}

export function buildDashboardView(
  cloudSummary: DashboardSummary | null,
  cloudProjects: ServerProjectSummary[],
  localProjects: Project[],
): DashboardView {
  const cloudRecent: DashboardRecentProject[] = cloudProjects.map((project) => ({
    id: project.id,
    name: project.name,
    buildingType: project.buildingType,
    site: project.site,
    lifecycleStage: project.lifecycleStage,
    state: project.state,
    updatedAt: project.updatedAt,
    coverImage: project.coverImage,
    origin: "cloud",
  }));
  const localRecent: DashboardRecentProject[] = localProjects.map((project) => ({
    id: project.id,
    name: project.name,
    buildingType: project.buildingType,
    site: project.site,
    lifecycleStage: project.lifecycleStage,
    state: project.state,
    updatedAt: project.updatedAt,
    ...projectCoverFields(project),
    origin: "local",
  }));

  const recentProjects = [...cloudRecent, ...localRecent].sort((a, b) => byDateDesc(a.updatedAt, b.updatedAt)).slice(0, RECENT_PROJECTS_LIMIT);

  const pendingDecisions = [
    ...(cloudSummary?.pendingDecisions.map(cloudPendingToView) ?? []),
    ...localPendingDecisions(localProjects),
  ]
    .sort((a, b) => byDateDesc(a.conceptCreatedAt, b.conceptCreatedAt))
    .slice(0, PENDING_LIMIT);

  const recentActivity = [...(cloudSummary?.recentActivity.map(cloudActivityToView) ?? []), ...localActivity(localProjects)]
    .sort((a, b) => byDateDesc(a.createdAt, b.createdAt))
    .slice(0, ACTIVITY_LIMIT);

  const localConceptsAwaitingReview = localProjects.reduce(
    (count, project) => count + project.concepts.filter((concept) => concept.state === "awaiting-review").length,
    0,
  );
  const localProjectsNeedingSpecialistReview = localProjects.filter((project) => project.state === "needs-specialist-review").length;

  return {
    cloudProjectCount: cloudProjects.length,
    localUnsyncedCount: localProjects.length,
    conceptsAwaitingReview: (cloudSummary?.conceptsAwaitingReview ?? 0) + localConceptsAwaitingReview,
    projectsNeedingSpecialistReview: (cloudSummary?.projectsNeedingSpecialistReview ?? 0) + localProjectsNeedingSpecialistReview,
    recentProjects,
    pendingDecisions,
    recentActivity,
    hasAnyRealProject: cloudProjects.length > 0 || localProjects.length > 0,
  };
}
