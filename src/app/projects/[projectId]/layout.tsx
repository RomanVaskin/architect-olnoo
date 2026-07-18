import type { ReactNode } from "react";
import { ProjectDataProvider } from "@/lib/project-context";
import { ProjectWorkspaceChrome } from "@/components/workspace/project-workspace-chrome";

export default async function ProjectWorkspaceLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;

  return (
    <ProjectDataProvider projectId={projectId}>
      <ProjectWorkspaceChrome projectId={projectId}>{children}</ProjectWorkspaceChrome>
    </ProjectDataProvider>
  );
}
