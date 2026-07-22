"use client";

import type { ProjectCardData } from "@/components/projects/project-card";
import { useEffect, useState } from "react";
import { projects as demoProjects } from "./mock-data";
import { getLocalProjectSync, listLocalProjects, type LocalProjectSyncRecord } from "./mvp-local-project-store";
import { mergeProjectSources } from "./project-list-merge";
import { projectCoverFields } from "./project-cover";
import { fetchServerProjects, ServerProjectError } from "./server-project-client";
import type { ServerProjectSummary } from "./server/project-repository";
import type { Project } from "./types";

export interface ProjectListState {
  cloud: ServerProjectSummary[];
  local: ProjectCardData[];
  demo: Project[];
  loading: boolean;
  cloudError: string | null;
}

interface MergedCardLists {
  cloud: ServerProjectSummary[];
  local: ProjectCardData[];
  demo: Project[];
}

const EMPTY: MergedCardLists = { cloud: [], local: [], demo: [] };

/** Local projects store their preview as a Blob in IndexedDB, not a URL — resolve it here via the same rule the detail page and cloud list use. */
function toLocalCardData(project: Project): ProjectCardData {
  return {
    id: project.id,
    name: project.name,
    buildingType: project.buildingType,
    site: project.site,
    lifecycleStage: project.lifecycleStage,
    state: project.state,
    updatedAt: project.updatedAt,
    ...projectCoverFields(project),
  };
}

/** Gathers cloud (Supabase), local (IndexedDB), and demo projects for the /projects screen and merges them via project-list-merge.ts so a synced local project never appears twice. */
export function useProjectList(): ProjectListState {
  const [state, setState] = useState<{ merged: MergedCardLists; loading: boolean; cloudError: string | null }>({
    merged: EMPTY,
    loading: true,
    cloudError: null,
  });

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const [serverResult, localProjects] = await Promise.all([
        fetchServerProjects().then(
          (value) => ({ ok: true as const, value }),
          (error: unknown) => ({ ok: false as const, error }),
        ),
        listLocalProjects().catch(() => []),
      ]);

      const syncRecords = new Map<string, LocalProjectSyncRecord>();
      await Promise.all(
        localProjects.map(async (project) => {
          const record = await getLocalProjectSync(project.id).catch(() => undefined);
          if (record) syncRecords.set(project.id, record);
        }),
      );

      if (cancelled) return;
      const server = serverResult.ok ? serverResult.value : [];
      const cloudError = serverResult.ok
        ? null
        : serverResult.error instanceof ServerProjectError
          ? serverResult.error.message
          : "Не удалось загрузить облачные проекты.";

      const merged = mergeProjectSources(server, localProjects, syncRecords, demoProjects);
      setState({
        merged: { cloud: merged.cloud, local: merged.local.map(toLocalCardData), demo: merged.demo },
        loading: false,
        cloudError,
      });
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  return { ...state.merged, loading: state.loading, cloudError: state.cloudError };
}
