"use client";

import Link from "next/link";
import { Plus } from "lucide-react";
import { StatTile } from "@/components/ui/stat-tile";
import { ProjectCard } from "@/components/projects/project-card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingState } from "@/components/ui/loading-state";
import { PendingDecisions } from "@/components/dashboard/pending-decisions";
import { ActivityFeed } from "@/components/workspace/activity-feed";
import { useDashboardData } from "@/lib/use-dashboard-data";

const NEW_PROJECT_ACTION = (
  <Link
    href="/projects/new"
    className="inline-flex items-center justify-center gap-2 rounded-xl bg-action px-4 py-2 text-sm font-medium text-action-ink hover:bg-action-hover"
  >
    <Plus className="h-4 w-4" />
    Новый проект
  </Link>
);

export default function DashboardPage() {
  const {
    loading,
    cloudError,
    cloudProjectCount,
    localUnsyncedCount,
    conceptsAwaitingReview,
    projectsNeedingSpecialistReview,
    recentProjects,
    pendingDecisions,
    recentActivity,
    hasAnyRealProject,
  } = useDashboardData();

  return (
    <div className="flex flex-col gap-10">


      {loading ? (
        <LoadingState label="Загрузка дашборда…" />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <StatTile label="Проектов в облаке" value={cloudProjectCount} />
            <StatTile label="Локальных (не сохранено в облаке)" value={localUnsyncedCount} />
            <StatTile label="Концепции ждут решения" value={conceptsAwaitingReview} />
            <StatTile label="Нужна проверка специалиста" value={projectsNeedingSpecialistReview} />
          </div>

          <section className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-ink">Последние проекты</h2>
              {hasAnyRealProject ? (
                <Link href="/projects" className="text-sm font-medium text-ink-secondary hover:text-ink">
                  Все проекты →
                </Link>
              ) : null}
            </div>
            {hasAnyRealProject ? (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {recentProjects.map((project) => (
                  <ProjectCard
                    key={project.id}
                    project={project}
                    originBadge={project.origin === "cloud" ? <Badge variant="positive">В облаке</Badge> : <Badge variant="accent">Локально</Badge>}
                  />
                ))}
              </div>
            ) : (
              <EmptyState
                title="Проектов пока нет"
                description="Создайте первый проект — он появится здесь сразу после сохранения, локально или в облаке."
                action={NEW_PROJECT_ACTION}
              />
            )}
          </section>

          <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
            <section className="flex flex-col gap-4">
              <h2 className="text-lg font-semibold text-ink">Ждут вашего решения</h2>
              <PendingDecisions items={pendingDecisions} />
            </section>

            <section className="flex flex-col gap-4">
              <h2 className="text-lg font-semibold text-ink">Последние события</h2>
              <ActivityFeed events={recentActivity} />
            </section>
          </div>

        </>
      )}
    </div>
  );
}
