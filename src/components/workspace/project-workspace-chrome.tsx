"use client";

import type { ReactNode } from "react";
import { useProjectContext } from "@/lib/project-context";
import { LoadingState } from "@/components/ui/loading-state";
import { EmptyState } from "@/components/ui/empty-state";
import { LinkButton } from "@/components/ui/button";
import { WorkspaceHeader } from "@/components/workspace/workspace-header";
import { WorkspaceNav } from "@/components/workspace/workspace-nav";
import { AiPanel } from "@/components/workspace/ai-panel";

export function ProjectWorkspaceChrome({ projectId, children }: { projectId: string; children: ReactNode }) {
  const { project, loading } = useProjectContext();

  if (loading) {
    return <LoadingState />;
  }

  if (!project) {
    return (
      <EmptyState
        title="Проект не найден"
        description="Такого проекта нет ни среди демо-проектов, ни в локальном хранилище браузера."
        action={<LinkButton href="/projects">К проектам</LinkButton>}
      />
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <WorkspaceHeader project={project} />
      <div className="flex flex-col gap-6 md:flex-row">
        <WorkspaceNav projectId={projectId} />
        <div className="min-w-0 flex-1">{children}</div>
        <AiPanel />
      </div>
    </div>
  );
}
