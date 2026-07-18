import { Bot } from "lucide-react";
import { Card } from "@/components/ui/card";

export function AiPanel() {
  return (
    <Card className="hidden h-fit shrink-0 flex-col gap-3 p-4 lg:flex lg:w-[300px]">
      <div className="flex items-center gap-2">
        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-icon-bg text-ink-secondary">
          <Bot className="h-3.5 w-3.5" strokeWidth={1.5} />
        </div>
        <p className="text-sm font-medium text-ink">AI Architect</p>
      </div>
      <p className="text-sm text-ink-secondary">
        Диалог с AI Architect появится здесь на следующем этапе — это будет основной способ формулировать
        задачи и следить за работой агентов (см. AI Workflow в 01-PRODUCT.md).
      </p>
      <div className="rounded-full border border-border px-3 py-2 text-sm text-ink-secondary opacity-50">
        Спросите AI Architect…
      </div>
    </Card>
  );
}
