import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { getProjectById } from "@/lib/mock-data";
import { WorkspaceHeader } from "@/components/workspace/workspace-header";
import { WorkspaceNav } from "@/components/workspace/workspace-nav";
import { AiPanel } from "@/components/workspace/ai-panel";

export default async function ProjectWorkspaceLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const project = getProjectById(projectId);

  if (!project) {
    notFound();
  }

  return (
    <div className="flex flex-col gap-6">
      <WorkspaceHeader project={project} />
      <div className="flex flex-col gap-6 md:flex-row">
        <WorkspaceNav projectId={project.id} />
        <div className="min-w-0 flex-1">{children}</div>
        <AiPanel />
      </div>
    </div>
  );
}
