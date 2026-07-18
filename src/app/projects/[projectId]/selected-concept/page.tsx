"use client";

import { useProjectContext } from "@/lib/project-context";
import { SelectedConceptView } from "@/components/workspace/selected-concept-view";

export default function SelectedConceptPage() {
  const { project } = useProjectContext();
  if (!project) return null;

  return <SelectedConceptView project={project} />;
}
