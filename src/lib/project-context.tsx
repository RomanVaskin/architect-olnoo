"use client";

import { createContext, useContext, type ReactNode } from "react";
import { useProjectData, type ProjectDataState } from "@/lib/use-project-data";

const ProjectContext = createContext<ProjectDataState | null>(null);

/**
 * Resolves the current project (mock or local/IndexedDB, see
 * use-project-data.ts) once per workspace navigation and shares it with the
 * layout chrome and every leaf page, so both agree on loading/not-found
 * state instead of each running its own lookup.
 */
export function ProjectDataProvider({ projectId, children }: { projectId: string; children: ReactNode }) {
  const state = useProjectData(projectId);
  return <ProjectContext.Provider value={state}>{children}</ProjectContext.Provider>;
}

export function useProjectContext(): ProjectDataState {
  const context = useContext(ProjectContext);
  if (!context) {
    throw new Error("useProjectContext must be used within ProjectDataProvider");
  }
  return context;
}
