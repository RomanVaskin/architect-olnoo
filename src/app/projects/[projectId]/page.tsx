import { notFound } from "next/navigation";
import { CheckCircle2, Circle } from "lucide-react";
import { getProjectById } from "@/lib/mock-data";
import { Card } from "@/components/ui/card";
import { ActivityFeed } from "@/components/workspace/activity-feed";
import { PROJECT_LIFECYCLE_LABELS } from "@/lib/types";

export default async function ProjectOverviewPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const project = getProjectById(projectId);
  if (!project) notFound();

  const nextSteps = [
    { label: "Заполнить бриф проекта", done: project.brief.goal.length > 0 && project.brief.mustKeep.length > 0 },
    { label: "Загрузить исходные материалы", done: project.sourceFiles.length > 0 },
    { label: "Сгенерировать концепции", done: project.concepts.length > 0 },
    { label: "Выбрать основную концепцию", done: Boolean(project.selectedConceptId) },
  ];

  return (
    <div className="flex flex-col gap-8">
      <Card className="p-5">
        <h2 className="text-sm font-medium text-ink-secondary">Текущая стадия</h2>
        <p className="mt-1 text-lg font-semibold text-ink">{PROJECT_LIFECYCLE_LABELS[project.lifecycleStage]}</p>
        <p className="mt-2 text-sm text-ink-secondary">{project.brief.goal}</p>
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold text-ink">Ближайшие шаги</h2>
          <Card className="divide-y divide-border">
            {nextSteps.map((step) => (
              <div key={step.label} className="flex items-center gap-3 px-4 py-3">
                {step.done ? (
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-positive" strokeWidth={1.5} />
                ) : (
                  <Circle className="h-4 w-4 shrink-0 text-ink-secondary" strokeWidth={1.5} />
                )}
                <span className={step.done ? "text-sm text-ink-secondary line-through" : "text-sm text-ink"}>
                  {step.label}
                </span>
              </div>
            ))}
          </Card>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold text-ink">Активность проекта</h2>
          <ActivityFeed events={project.activity} />
        </section>
      </div>
    </div>
  );
}
