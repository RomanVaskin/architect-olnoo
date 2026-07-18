import Link from "next/link";
import { Plus } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { StatTile } from "@/components/ui/stat-tile";
import { ProjectCard } from "@/components/projects/project-card";
import { PendingDecisions } from "@/components/dashboard/pending-decisions";
import { ActivityFeed } from "@/components/workspace/activity-feed";
import {
  projects,
  getActiveProjectsCount,
  getConceptsAwaitingReview,
  getApprovedConceptsCount,
  getPendingDecisions,
  getRecentActivity,
} from "@/lib/mock-data";

export default function DashboardPage() {
  const recentProjects = [...projects]
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .slice(0, 3);

  return (
    <div className="flex flex-col gap-10">
      <PageHeader
        title="С возвращением, Роман"
        description="Вот что происходит в ваших проектах прямо сейчас."
        action={
          <Link
            href="/projects/new"
            className="inline-flex items-center justify-center gap-2 rounded-full bg-accent px-4 py-2 text-sm font-medium text-accent-ink hover:opacity-90"
          >
            <Plus className="h-4 w-4" />
            Новый проект
          </Link>
        }
      />

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatTile label="Активные проекты" value={getActiveProjectsCount()} />
        <StatTile label="Концепции ждут решения" value={getConceptsAwaitingReview()} />
        <StatTile label="Одобрено концепций" value={getApprovedConceptsCount()} />
        <StatTile label="Событий за неделю" value={getRecentActivity(100).length} />
      </div>

      <section className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-ink">Последние проекты</h2>
          <Link href="/projects" className="text-sm font-medium text-ink-secondary hover:text-ink">
            Все проекты →
          </Link>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {recentProjects.map((project) => (
            <ProjectCard key={project.id} project={project} />
          ))}
        </div>
      </section>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        <section className="flex flex-col gap-4">
          <h2 className="text-lg font-semibold text-ink">Ждут вашего решения</h2>
          <PendingDecisions items={getPendingDecisions()} />
        </section>

        <section className="flex flex-col gap-4">
          <h2 className="text-lg font-semibold text-ink">Последние события</h2>
          <ActivityFeed events={getRecentActivity()} />
        </section>
      </div>
    </div>
  );
}
