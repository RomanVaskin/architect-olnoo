import { notFound } from "next/navigation";
import { getProjectById } from "@/lib/mock-data";
import { ActivityFeed } from "@/components/workspace/activity-feed";

export default async function ActivityPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const project = getProjectById(projectId);
  if (!project) notFound();

  return <ActivityFeed events={project.activity} emptyLabel="По этому проекту пока нет событий." />;
}
