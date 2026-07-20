"use client";

import { useEffect, useState } from "react";
import { projects as demoProjects } from "./mock-data";
import { getLocalProjectSync, listLocalProjects, type LocalProjectSyncRecord } from "./mvp-local-project-store";
import { mergeProjectSources, type MergedProjectLists } from "./project-list-merge";
import { fetchServerProjects, ServerProjectError } from "./server-project-client";

export interface ProjectListState extends MergedProjectLists {
  loading: boolean;
  cloudError: string | null;
}

const EMPTY: MergedProjectLists = { cloud: [], local: [], demo: [] };

/** Gathers cloud (Supabase), local (IndexedDB), and demo projects for the /projects screen and merges them via project-list-merge.ts so a synced local project never appears twice. */
export function useProjectList(): ProjectListState {
  const [state, setState] = useState<{ merged: MergedProjectLists; loading: boolean; cloudError: string | null }>({
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

      setState({
        merged: mergeProjectSources(server, localProjects, syncRecords, demoProjects),
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
