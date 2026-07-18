import Link from "next/link";
import { Download } from "lucide-react";
import { LifecycleStageBadge, ProjectStateBadge } from "@/components/ui/badge";
import type { Project } from "@/lib/types";

export function WorkspaceHeader({ project }: { project: Project }) {
  return (
    <div className="flex flex-col gap-4 border-b border-border pb-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="min-w-0">
          <nav className="text-sm text-ink-secondary">
            <Link href="/projects" className="hover:text-ink hover:underline">
              Проекты
            </Link>
            <span className="mx-1.5">/</span>
            <span className="text-ink">{project.name}</span>
          </nav>
          <h1 className="mt-1 truncate text-2xl font-semibold text-ink sm:text-3xl">{project.name}</h1>
          <p className="mt-1 text-sm text-ink-secondary">
            {project.buildingType} · {project.site.address}
          </p>
        </div>
        <button
          type="button"
          disabled
          title="Export Center появится на следующем этапе"
          className="inline-flex items-center gap-2 rounded-xl border border-border px-4 py-2 text-sm font-medium text-ink-secondary opacity-50"
        >
          <Download className="h-4 w-4" />
          Экспорт
        </button>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <LifecycleStageBadge stage={project.lifecycleStage} />
        <ProjectStateBadge state={project.state} />
      </div>
    </div>
  );
}
