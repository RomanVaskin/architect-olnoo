"use client";

import type { ReactNode } from "react";
import { useProjectContext } from "@/lib/project-context";
import { LoadingState } from "@/components/ui/loading-state";
import { EmptyState } from "@/components/ui/empty-state";
import { LinkButton } from "@/components/ui/button";
import { WorkspaceHeader } from "@/components/workspace/workspace-header";
import { WorkspaceNav } from "@/components/workspace/workspace-nav";
import { AiPanel } from "@/components/workspace/ai-panel";
import type { ProjectResolutionError } from "@/lib/use-project-data";

function errorCopy(error: ProjectResolutionError | undefined): { title: string; description: string; action: ReactNode } {
  switch (error?.kind) {
    case "authentication-required":
      return {
        title: "Нужно войти в аккаунт",
        description: error.message,
        action: <LinkButton href="/login">Войти</LinkButton>,
      };
    case "temporary-error":
      return {
        title: "Временная ошибка сервера",
        description: error.message,
        action: <LinkButton href="/projects">К проектам</LinkButton>,
      };
    case "local-unavailable":
      return {
        title: "Проект недоступен в этом браузере",
        description: error.message,
        action: <LinkButton href="/projects">К проектам</LinkButton>,
      };
    default:
      return {
        title: "Проект не найден",
        description: error?.message ?? "Такого проекта нет ни среди демо-проектов, ни в локальном хранилище браузера, ни в облаке.",
        action: <LinkButton href="/projects">К проектам</LinkButton>,
      };
  }
}

export function ProjectWorkspaceChrome({ projectId, children }: { projectId: string; children: ReactNode }) {
  const { project, loading, error } = useProjectContext();

  if (loading) {
    return <LoadingState />;
  }

  if (!project) {
    const copy = errorCopy(error);
    return <EmptyState title={copy.title} description={copy.description} action={copy.action} />;
  }

  return (
    <div className="flex flex-col gap-6">
      <WorkspaceHeader project={project} />
      <div className="flex flex-col gap-6 md:flex-row">
        <WorkspaceNav projectId={projectId} />
        <div className="min-w-0 flex-1">{children}</div>
        <AiPanel project={project} />
      </div>
    </div>
  );
}
