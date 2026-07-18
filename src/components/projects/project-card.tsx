import Link from "next/link";
import type { Project } from "@/lib/types";
import { Card } from "@/components/ui/card";
import { ProjectStateBadge, LifecycleStageBadge } from "@/components/ui/badge";
import { ProjectThumbnail } from "@/components/projects/project-thumbnail";
import { formatDate } from "@/lib/utils";

export function ProjectCard({ project }: { project: Project }) {
  return (
    <Link href={`/projects/${project.id}`} className="group block">
      <Card className="overflow-hidden transition-colors group-hover:border-ink/20">
        <ProjectThumbnail seed={project.id} className="h-36 w-full" />
        <div className="flex flex-col gap-3 p-4">
          <div>
            <h3 className="font-medium text-ink">{project.name}</h3>
            <p className="mt-0.5 text-sm text-ink-secondary">
              {project.buildingType} · {project.site.address}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <LifecycleStageBadge stage={project.lifecycleStage} />
            <ProjectStateBadge state={project.state} />
          </div>
          <p className="text-xs text-ink-secondary">Обновлено {formatDate(project.updatedAt)}</p>
        </div>
      </Card>
    </Link>
  );
}
