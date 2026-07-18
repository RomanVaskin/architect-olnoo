"use client";

import { useEffect, useState } from "react";
import { getProjectById } from "@/lib/mock-data";
import { getLocalProject } from "@/lib/mvp-local-project-store";
import type { Project } from "@/lib/types";

export interface ProjectDataState {
  project: Project | undefined;
  loading: boolean;
}

/**
 * Resolves a project either from the static mock dataset (existing demo
 * projects, resolved synchronously — no loading flicker) or, when not found
 * there, from the temporary MVP IndexedDB store used by wizard-created
 * projects (see mvp-local-project-store.ts). Mock projects always take
 * precedence and never touch IndexedDB.
 */
export function useProjectData(projectId: string): ProjectDataState {
  const mockProject = getProjectById(projectId);
  const [localProject, setLocalProject] = useState<Project | null | undefined>(undefined);

  useEffect(() => {
    if (mockProject) return undefined;
    let cancelled = false;
    getLocalProject(projectId)
      .then((project) => {
        if (!cancelled) setLocalProject(project ?? null);
      })
      .catch(() => {
        if (!cancelled) setLocalProject(null);
      });
    return () => {
      cancelled = true;
      setLocalProject(undefined);
    };
  }, [projectId, mockProject]);

  if (mockProject) return { project: mockProject, loading: false };
  if (localProject === undefined) return { project: undefined, loading: true };
  return { project: localProject ?? undefined, loading: false };
}
