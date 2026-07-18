import { notFound } from "next/navigation";
import { getProjectById } from "@/lib/mock-data";
import { SelectedConceptView } from "@/components/workspace/selected-concept-view";

export default async function SelectedConceptPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const project = getProjectById(projectId);
  if (!project) notFound();

  return <SelectedConceptView project={project} />;
}
