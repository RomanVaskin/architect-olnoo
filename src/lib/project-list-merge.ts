import type { Project } from "./types";
import type { LocalProjectSyncRecord } from "./mvp-local-project-store";
import type { ServerProjectSummary } from "./server/project-repository";

export interface MergedProjectLists {
  cloud: ServerProjectSummary[];
  local: Project[];
  demo: Project[];
}

/**
 * Pure merge for the /projects screen (see use-project-list.ts for the
 * client hook that gathers the three inputs). A local project that has been
 * synced (see project-sync.ts) is dropped from `local` — its data now shows
 * as a cloud card instead — so a synced project is never listed twice.
 */
export function mergeProjectSources(
  server: ServerProjectSummary[],
  local: Project[],
  syncRecordsByLocalId: ReadonlyMap<string, LocalProjectSyncRecord>,
  demo: Project[],
): MergedProjectLists {
  const unsyncedLocal = local.filter((project) => syncRecordsByLocalId.get(project.id)?.status !== "synced");
  return { cloud: server, local: unsyncedLocal, demo };
}
