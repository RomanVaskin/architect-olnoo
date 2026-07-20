"use client";

import { CheckCircle2, Circle } from "lucide-react";
import { useProjectContext } from "@/lib/project-context";
import { Card } from "@/components/ui/card";
import { ActivityFeed } from "@/components/workspace/activity-feed";
import { ConceptVisual } from "@/components/workspace/concept-visual";
import { ProjectThumbnail } from "@/components/projects/project-thumbnail";
import { EmptyState } from "@/components/ui/empty-state";
import { LinkButton } from "@/components/ui/button";
import { PROJECT_LIFECYCLE_LABELS } from "@/lib/types";
import { GeometryVerificationLine } from "@/components/workspace/geometry-verification-summary";
import { isLocalProjectId, isServerProjectId } from "@/lib/project-id";

export default function ProjectOverviewPage() {
  const { project } = useProjectContext();
  if (!project) return null;

  const nextSteps = [
    { label: "Заполнить бриф проекта", done: project.brief.goal.length > 0 && project.brief.mustKeep.length > 0 },
    { label: "Загрузить исходные материалы", done: project.sourceFiles.length > 0 },
    { label: "Сгенерировать концепции", done: project.concepts.length > 0 },
    { label: "Выбрать основную концепцию", done: Boolean(project.selectedConceptId) },
  ];

  // Wizard-created and server (Supabase) projects only ever hold a real
  // generated image or nothing at all — they must never show the decorative
  // demo scene or claim geometry was preserved/verified.
  const isRealProject = isLocalProjectId(project.id) || isServerProjectId(project.id);
  const latestGeneratedConcept = [...project.concepts].reverse().find((concept) => concept.generatedImage);

  return (
    <div className="flex flex-col gap-8">
      {isRealProject ? (
        latestGeneratedConcept ? (
          <Card className="overflow-hidden">
            <ConceptVisual concept={latestGeneratedConcept} projectId={project.id} heightClassName="h-[260px] w-full sm:h-[340px]" />
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-5 py-4">
              <div>
                <p className="text-sm font-medium text-ink">Последняя сгенерированная концепция «{latestGeneratedConcept.label}»</p>
                <GeometryVerificationLine concept={latestGeneratedConcept} className="mt-1" />
              </div>
              <LinkButton href={`/projects/${project.id}/concepts`} variant="secondary" size="sm">
                Все концепции
              </LinkButton>
            </div>
          </Card>
        ) : (
          <EmptyState
            title="Концепция ещё не сгенерирована"
            description="Как только генерация будет завершена и сохранена, здесь появится настоящее изображение результата."
            action={<LinkButton href={`/projects/${project.id}/concepts`}>Перейти к концепциям</LinkButton>}
          />
        )
      ) : (
        <Card className="overflow-hidden">
          <ProjectThumbnail seed={project.id} className="h-[260px] w-full sm:h-[340px]" />
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-5 py-4">
            <div>
              <p className="text-sm font-medium text-ink">Демонстрационное изображение</p>
              <p className="mt-1 text-xs text-ink-secondary">Иллюстрация демо-проекта, не результат генерации</p>
            </div>
          </div>
        </Card>
      )}

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
