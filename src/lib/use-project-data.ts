"use client";

import { useEffect, useState } from "react";
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

  useEffect(() => {
    if (demoProject) return undefined;
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- resets to a loading state when projectId changes, before the IndexedDB/network lookup below can resolve; mirrors src/lib/use-blob-url.ts.
    setState({ project: undefined, loading: true });

    async function resolve() {
      if (isLocalProjectId(projectId)) {
        try {
          const project = await getLocalProject(projectId);
          if (cancelled) return;
          setState(project ? { project, loading: false } : { project: undefined, loading: false, error: LOCAL_UNAVAILABLE_ERROR });
        } catch {
          if (!cancelled) setState({ project: undefined, loading: false, error: LOCAL_UNAVAILABLE_ERROR });
        }
        return;
      }

      if (isServerProjectId(projectId)) {
        try {
          const project = await fetchServerProject(projectId);
          if (!cancelled) setState({ project, loading: false });
        } catch (error) {
          if (cancelled) return;
          const resolved = error instanceof ServerProjectError
            ? { kind: mapServerErrorKind(error.kind), message: error.message }
            : { kind: "temporary-error" as const, message: "Не удалось связаться с сервером. Проверьте соединение и повторите попытку." };
          setState({ project: undefined, loading: false, error: resolved });
        }
        return;
      }

      if (!cancelled) setState({ project: undefined, loading: false, error: NOT_FOUND_ERROR });
    }

    resolve();
    return () => {
      cancelled = true;
    };
  }, [projectId, demoProject]);

  if (demoProject) return { project: demoProject, loading: false };
  return state;
}

function mapServerErrorKind(kind: ServerProjectError["kind"]): ProjectResolutionErrorKind {
  if (kind === "authentication-required") return "authentication-required";
  if (kind === "not-found") return "not-found";
  return "temporary-error";
}
