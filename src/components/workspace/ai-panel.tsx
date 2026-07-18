import { Bot, CheckCircle2, Paperclip, Send, Sparkles } from "lucide-react";
import { Card } from "@/components/ui/card";

export function AiPanel() {
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
        <span className="h-2 w-2 rounded-full bg-positive" />
      </div>

      <div className="flex flex-col gap-4 overflow-y-auto p-4">
        <div className="ml-8 rounded-2xl rounded-tr-md bg-surface-soft px-3 py-2.5 text-sm leading-5 text-ink">
          Сохрани геометрию дома и предложи более светлый современный фасад для холодного климата.
        </div>
        <div className="flex gap-2.5">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent text-white"><Sparkles className="h-3.5 w-3.5" /></span>
          <div className="text-sm leading-5 text-ink-secondary">
            <p>Подготовлены три направления. Положение окон, крыша и основные пропорции сохранены.</p>
            <div className="mt-3 rounded-xl border border-border p-3">
              <p className="font-medium text-ink">Что изменилось</p>
              <ul className="mt-2 space-y-1 text-xs">
                <li>• светлая минеральная штукатурка</li>
                <li>• акцент из натурального дерева</li>
                <li>• тёмные оконные профили</li>
              </ul>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 rounded-xl border border-[#dceadd] bg-[#f5faf6] p-3">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-positive" />
          <div><p className="text-xs font-medium text-ink">Проверка результата</p><p className="mt-0.5 text-[11px] text-ink-secondary">Геометрия исходного дома сохранена</p></div>
        </div>
      </div>

      <div className="border-t border-border p-3">
        <div className="rounded-2xl border border-border bg-surface p-2 focus-within:border-ink/25">
          <textarea aria-label="Сообщение AI Architect" placeholder="Опишите, что хотите изменить…" className="h-16 w-full resize-none bg-transparent px-2 py-1 text-sm text-ink outline-none placeholder:text-ink-secondary" />
          <div className="flex items-center justify-between"><button type="button" aria-label="Прикрепить файл" className="flex h-8 w-8 items-center justify-center rounded-full text-ink-secondary hover:bg-surface-soft"><Paperclip className="h-4 w-4" /></button><button type="button" aria-label="Отправить сообщение" className="flex h-8 w-8 items-center justify-center rounded-full bg-accent text-white"><Send className="h-3.5 w-3.5" /></button></div>
        </div>
        <p className="mt-2 text-center text-[10px] text-ink-secondary">Профессиональные решения требуют проверки специалиста</p>
      </div>
    </Card>
  );
}
