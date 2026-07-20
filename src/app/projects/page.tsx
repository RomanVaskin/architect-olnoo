"use client";

import Link from "next/link";
import { Plus } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { ProjectList } from "@/components/projects/project-list";
import { useProjectList } from "@/lib/use-project-list";

export default function ProjectsPage() {
  const projectList = useProjectList();

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Проекты"
        description="Все проекты вашего рабочего пространства."
        action={
          <Link
            href="/projects/new"
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-action px-4 py-2 text-sm font-medium text-action-ink hover:bg-action-hover"
          >
            <Plus className="h-4 w-4" />
            Создать проект
          </Link>
        }
      />
      <ProjectList {...projectList} />
    </div>
  );
}
