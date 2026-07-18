import { Sparkles } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { LinkButton } from "@/components/ui/button";

export default function NewProjectPage() {
  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Новый проект"
        description="Пошаговое создание проекта — от загрузки материалов до первых концепций."
      />
      <EmptyState
        icon={<Sparkles className="h-5 w-5" strokeWidth={1.5} />}
        title="New Project Wizard в разработке"
        description="Этот раздел ещё не реализован. Пока вы можете посмотреть на уже существующие проекты и их рабочие пространства."
        action={<LinkButton href="/projects" variant="secondary">К проектам</LinkButton>}
      />
    </div>
  );
}
