import { notFound } from "next/navigation";
import { getProjectById } from "@/lib/mock-data";
import { ConceptsWorkspace } from "@/components/workspace/concepts-workspace";
import { EmptyState } from "@/components/ui/empty-state";

export default async function ConceptsPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const project = getProjectById(projectId);
  if (!project) notFound();

  if (project.concepts.length === 0) {
    return (
      <EmptyState
        title="Концепции ещё не сгенерированы"
        description="Заполните бриф и загрузите исходные материалы, чтобы AI Architect предложил варианты."
      />
    );
  }

  return <ConceptsWorkspace project={project} />;
}
