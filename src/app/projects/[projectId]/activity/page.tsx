"use client";

import { useProjectContext } from "@/lib/project-context";
import { ActivityFeed } from "@/components/workspace/activity-feed";

export default function ActivityPage() {
  const { project } = useProjectContext();
  if (!project) return null;

  return <ActivityFeed events={project.activity} emptyLabel="По этому проекту пока нет событий." />;
}
