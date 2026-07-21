"use client";

import { useEffect } from "react";
import { EmptyState } from "@/components/ui/empty-state";
import { Button, LinkButton } from "@/components/ui/button";

export default function RootError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("[app-error]", error);
  }, [error]);

  return (
    <EmptyState
      title="Что-то пошло не так"
      description={
        error.digest
          ? `Произошла непредвиденная ошибка. Попробуйте обновить страницу. Код для поддержки: ${error.digest}.`
          : "Произошла непредвиденная ошибка. Попробуйте обновить страницу."
      }
      action={
        <div className="flex flex-wrap items-center justify-center gap-2">
          <Button type="button" variant="secondary" onClick={reset}>Попробовать снова</Button>
          <LinkButton href="/projects">К проектам</LinkButton>
        </div>
      }
    />
  );
}
