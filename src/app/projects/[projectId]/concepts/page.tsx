import { notFound } from "next/navigation";
import { getProjectById } from "@/lib/mock-data";
import { ConceptCard } from "@/components/workspace/concept-card";
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

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {project.concepts.map((concept) => (
        <ConceptCard key={concept.id} concept={concept} isSelected={concept.id === project.selectedConceptId} />
      ))}
    </div>
  );
}
