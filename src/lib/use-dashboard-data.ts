"use client";

import { useEffect, useState } from "react";
import { buildDashboardView, type DashboardView } from "./dashboard-merge";
import { getLocalProjectSync, listLocalProjects, type LocalProjectSyncRecord } from "./mvp-local-project-store";
import { mergeProjectSources } from "./project-list-merge";
import { fetchDashboardSummary, fetchServerProjects, ServerProjectError } from "./server-project-client";
import type { DashboardSummary } from "./server/dashboard-repository";

export interface DashboardDataState extends DashboardView {
  loading: boolean;
  cloudError: string | null;
}

const EMPTY_VIEW = buildDashboardView(null, [], []);

/**
 * Gathers cloud (Supabase) and local (IndexedDB, unsynced only — see
 * project-list-merge.ts) data for the real Dashboard. A cloud fetch failure
 * never renders as an empty account: `cloudError` is surfaced separately
 * while local data (if any) still shows, mirroring use-project-list.ts.
 */
export function useDashboardData(): DashboardDataState {
  const [state, setState] = useState<{ view: DashboardView; loading: boolean; cloudError: string | null }>({
    view: EMPTY_VIEW,
    loading: true,
    cloudError: null,
  });

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const [summaryResult, projectsResult, localProjects] = await Promise.all([
        fetchDashboardSummary().then(
          (value) => ({ ok: true as const, value }),
          (error: unknown) => ({ ok: false as const, error }),
        ),
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

      const cloudSummary: DashboardSummary | null = summaryResult.ok ? summaryResult.value : null;
      const cloudProjects = projectsResult.ok ? projectsResult.value : [];
      const failure = !summaryResult.ok ? summaryResult.error : !projectsResult.ok ? projectsResult.error : null;
      const cloudError = failure
        ? failure instanceof ServerProjectError
          ? failure.message
          : "Не удалось загрузить облачные данные."
        : null;

      const { local: unsyncedLocal } = mergeProjectSources(cloudProjects, localProjects, syncRecords, []);

      setState({
        view: buildDashboardView(cloudSummary, cloudProjects, unsyncedLocal),
        loading: false,
        cloudError,
      });
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  return { ...state.view, loading: state.loading, cloudError: state.cloudError };
}
