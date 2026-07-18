import Link from "next/link";
import { Plus } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { ProjectList } from "@/components/projects/project-list";
import { projects } from "@/lib/mock-data";

export default function ProjectsPage() {
  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Проекты"
        description="Все проекты вашего рабочего пространства."
        action={
          <Link
            href="/projects/new"
            className="inline-flex items-center justify-center gap-2 rounded-full bg-accent px-4 py-2 text-sm font-medium text-accent-ink hover:opacity-90"
          >
            <Plus className="h-4 w-4" />
            Создать проект
          </Link>
        }
      />
      <ProjectList projects={projects} />
    </div>
  );
}
