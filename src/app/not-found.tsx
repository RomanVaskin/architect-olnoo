import { EmptyState } from "@/components/ui/empty-state";
import { LinkButton } from "@/components/ui/button";

export default function NotFound() {
  return (
    <EmptyState
      title="Страница не найдена"
      description="Такой страницы нет. Возможно, ссылка устарела или адрес введён с ошибкой."
      action={<LinkButton href="/projects">К проектам</LinkButton>}
    />
  );
}
