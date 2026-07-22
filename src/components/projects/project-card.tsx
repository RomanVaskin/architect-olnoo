import Link from "next/link";
import type { ReactNode } from "react";
import type { Project } from "@/lib/types";
import { Card } from "@/components/ui/card";
import { ProjectStateBadge, LifecycleStageBadge } from "@/components/ui/badge";
import { ProjectThumbnail } from "@/components/projects/project-thumbnail";
import { formatDate } from "@/lib/utils";

/**
 * Only the fields ProjectCard renders — deliberately narrower than Project so
 * a /projects list summary (which has no sourceFiles/concepts/etc. loaded)
 * can be passed here without faking empty arrays. `coverImageBlob` is set
 * only for local (IndexedDB) projects, whose preview image lives as an
 * in-memory Blob rather than a URL — see resolveProjectCover.
 */
export type ProjectCardData = Pick<Project, "id" | "name" | "buildingType" | "site" | "lifecycleStage" | "state" | "updatedAt" | "coverImage"> & {
  coverImageBlob?: Blob;
};

export function ProjectCard({ project, originBadge }: { project: ProjectCardData; originBadge?: ReactNode }) {
  return (
    <Link href={`/projects/${project.id}`} className="group block">
      <Card className="overflow-hidden transition-colors group-hover:border-ink/20">
        <ProjectThumbnail seed={project.id} imageUrl={project.coverImage} imageBlob={project.coverImageBlob} className="h-36 w-full" />
        <div className="flex flex-col gap-3 p-4">
          <div>
            <div className="flex items-start justify-between gap-2">
              <h3 className="font-medium text-ink">{project.name}</h3>
              {originBadge}
            </div>
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
