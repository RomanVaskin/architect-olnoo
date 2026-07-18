import { Bot, Paperclip, Send } from "lucide-react";
import { Card } from "@/components/ui/card";
import { GEOMETRY_VERIFICATION_NOTE } from "@/lib/types";
import type { Project } from "@/lib/types";

/**
 * Reflects only what's actually saved on `project` — no scripted
 * conversation, change list, or "geometry preserved" claim. Automatic
 * geometry verification does not exist yet (see GEOMETRY_VERIFICATION_NOTE),
 * so this panel must never imply otherwise.
 */
export function AiPanel({ project }: { project: Project }) {
  const conceptCount = project.concepts.length;

  return (
    <Card className="hidden h-fit max-h-[calc(100vh-130px)] shrink-0 flex-col overflow-hidden lg:flex lg:w-[320px]">
      <div className="flex items-center justify-between border-b border-border p-4">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-surface-soft text-accent">
            <Bot className="h-4 w-4" strokeWidth={1.5} />
          </div>
          <div>
            <p className="text-sm font-medium text-ink">AI Architect</p>
            <p className="text-[11px] text-ink-secondary">Контекст текущего проекта</p>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-3 overflow-y-auto p-4">
        {conceptCount === 0 ? (
          <p className="text-sm leading-5 text-ink-secondary">Концепция ещё не сохранена для этого проекта.</p>
        ) : (
          <div className="rounded-xl border border-border p-3 text-sm leading-5 text-ink-secondary">
            <p>{conceptCount === 1 ? "Сохранена 1 концепция." : `Сохранено концепций: ${conceptCount}.`}</p>
            <p className="mt-2 text-xs">{GEOMETRY_VERIFICATION_NOTE}</p>
            <p className="mt-1 text-xs">Требует проверки специалиста</p>
          </div>
        )}
      </div>

      <div className="border-t border-border p-3">
        <div className="rounded-2xl border border-border bg-surface p-2 focus-within:border-ink/25">
          <textarea aria-label="Сообщение AI Architect" placeholder="Опишите, что хотите изменить…" className="h-16 w-full resize-none bg-transparent px-2 py-1 text-sm text-ink outline-none placeholder:text-ink-secondary" />
          <div className="flex items-center justify-between"><button type="button" aria-label="Прикрепить файл" className="flex h-8 w-8 items-center justify-center rounded-full text-ink-secondary hover:bg-surface-soft"><Paperclip className="h-4 w-4" /></button><button type="button" aria-label="Отправить сообщение" className="flex h-8 w-8 items-center justify-center rounded-full bg-action text-action-ink hover:bg-action-hover"><Send className="h-3.5 w-3.5" /></button></div>
        </div>
        <p className="mt-2 text-center text-[10px] text-ink-secondary">Профессиональные решения требуют проверки специалиста</p>
      </div>
    </Card>
  );
}
