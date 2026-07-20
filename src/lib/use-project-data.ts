"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getProjectById } from "@/lib/mock-data";
import { getLocalProject } from "@/lib/mvp-local-project-store";
import { isDemoProjectId, isLocalProjectId, isServerProjectId } from "@/lib/project-id";
import { fetchServerProject, ServerProjectError } from "@/lib/server-project-client";
import type { Project } from "@/lib/types";

export type ProjectResolutionErrorKind = "not-found" | "authentication-required" | "temporary-error" | "local-unavailable";

export interface ProjectResolutionError {
  kind: ProjectResolutionErrorKind;
  message: string;
}

export interface ProjectDataState {
  project: Project | undefined;
  loading: boolean;
  error?: ProjectResolutionError;
  /**
   * Re-fetches the current project without a full page reload or losing the
   * caller's workspace section (see specs Part 5 — used after cloud
   * generation/correction/concept selection/feedback instead of
   * `window.location.reload()`). A no-op for demo projects. Does not flip
   * `loading` back to true — callers that want an in-place refresh keep
   * their existing UI mounted while it resolves.
   */
  refresh: () => Promise<void>;
}

const LOCAL_UNAVAILABLE_ERROR: ProjectResolutionError = {
  kind: "local-unavailable",
  message: "Этот локальный проект не найден в этом браузере — он мог быть создан на другом устройстве или в другом браузере, либо локальные данные были очищены.",
};

const NOT_FOUND_ERROR: ProjectResolutionError = {
  kind: "not-found",
  message: "Такого проекта нет ни среди демо-проектов, ни в локальном хранилище браузера, ни в облаке.",
};

/**
 * Resolves a project id in the order required by docs/06-BACKEND.md —
 * Project Resolution: demo id -> mock data (synchronous, no loading
 * flicker), `local-*` id -> IndexedDB, otherwise (a real uuid) -> the
 * Supabase-backed server repository. Surfaces a typed error so the workspace
 * chrome can tell "not found" apart from "sign in required" and "temporary
 * backend failure" instead of collapsing every case into one generic message.
 */
export function useProjectData(projectId: string): ProjectDataState {
  const demoProject = isDemoProjectId(projectId) ? getProjectById(projectId) : undefined;
  const [state, setState] = useState<{ project: Project | undefined; loading: boolean; error?: ProjectResolutionError }>({
    project: undefined,
    loading: !demoProject,
  });
  const cancelledRef = useRef(false);

  const resolve = useCallback(
    async (options: { showLoading: boolean }) => {
      if (demoProject) return;
      cancelledRef.current = false;
      if (options.showLoading) setState({ project: undefined, loading: true });

      if (isLocalProjectId(projectId)) {
        try {
          const project = await getLocalProject(projectId);
          if (cancelledRef.current) return;
          setState(project ? { project, loading: false } : { project: undefined, loading: false, error: LOCAL_UNAVAILABLE_ERROR });
        } catch {
          if (!cancelledRef.current) setState({ project: undefined, loading: false, error: LOCAL_UNAVAILABLE_ERROR });
        }
        return;
      }

      if (isServerProjectId(projectId)) {
        try {
          const project = await fetchServerProject(projectId);
          if (cancelledRef.current) return;
          setState({ project, loading: false });
        } catch (error) {
          if (cancelledRef.current) return;
          const resolved = error instanceof ServerProjectError
            ? { kind: mapServerErrorKind(error.kind), message: error.message }
            : { kind: "temporary-error" as const, message: "Не удалось связаться с сервером. Проверьте соединение и повторите попытку." };
          setState({ project: undefined, loading: false, error: resolved });
        }
        return;
      }

      if (!cancelledRef.current) setState({ project: undefined, loading: false, error: NOT_FOUND_ERROR });
    },
    [projectId, demoProject],
  );

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- resets to a loading state when projectId changes, before the IndexedDB/network lookup below can resolve; mirrors src/lib/use-blob-url.ts.
    resolve({ showLoading: true });
    return () => {
      cancelledRef.current = true;
    };
  }, [resolve]);

  const refresh = useCallback(() => resolve({ showLoading: false }), [resolve]);

  if (demoProject) return { project: demoProject, loading: false, refresh: async () => {} };
  return { ...state, refresh };
}

function mapServerErrorKind(kind: ServerProjectError["kind"]): ProjectResolutionErrorKind {
  if (kind === "authentication-required") return "authentication-required";
  if (kind === "not-found") return "not-found";
  return "temporary-error";
}
