import { notFound } from "next/navigation";
import { getProjectById } from "@/lib/mock-data";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";

function BriefList({ title, items }: { title: string; items: string[] }) {
  return (
    <Card className="p-4">
      <h3 className="text-sm font-medium text-ink-secondary">{title}</h3>
      {items.length === 0 ? (
        <p className="mt-2 text-sm text-ink-secondary">Пока не указано.</p>
      ) : (
        <ul className="mt-2 flex flex-col gap-1.5">
          {items.map((item) => (
            <li key={item} className="text-sm text-ink">
              · {item}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

export default async function BriefPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const project = getProjectById(projectId);
  if (!project) notFound();

  if (!project.brief.goal && project.brief.mustKeep.length === 0) {
    return (
      <EmptyState
        title="Бриф ещё не заполнен"
        description="Опишите цель проекта в диалоге с AI Architect — платформа соберёт бриф автоматически."
      />
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <Card className="p-4">
        <h3 className="text-sm font-medium text-ink-secondary">Цель</h3>
        <p className="mt-2 text-sm text-ink">{project.brief.goal}</p>
        {project.brief.budgetNote ? (
          <p className="mt-2 text-sm text-ink-secondary">{project.brief.budgetNote}</p>
        ) : null}
      </Card>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <BriefList title="Elements that must remain unchanged" items={project.brief.mustKeep} />
        <BriefList title="Elements that may be modified" items={project.brief.mayChange} />
        <BriefList title="Elements the user wants changed" items={project.brief.wantsChanged} />
      </div>
    </div>
  );
}
