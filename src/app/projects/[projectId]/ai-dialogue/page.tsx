import { notFound } from "next/navigation";
import { Bot, User } from "lucide-react";
import { getProjectById } from "@/lib/mock-data";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export default async function AiDialoguePage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const project = getProjectById(projectId);
  if (!project) notFound();

  const transcript = [
    { author: "user" as const, text: project.brief.goal || "Опишите, что вы хотите изменить в доме." },
    {
      author: "agent" as const,
      text:
        project.concepts.length > 0
          ? `Проанализировал исходные материалы. Сохраняю геометрию и пропорции дома и готовлю ${project.concepts.length} вариант(а) концепции.`
          : "Загрузите фотографии или чертежи дома, чтобы я мог предложить варианты.",
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <Card className="flex flex-col gap-4 p-4">
        {transcript.map((message, index) => (
          <div
            key={index}
            className={cn("flex items-start gap-3", message.author === "user" && "flex-row-reverse text-right")}
          >
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-icon-bg text-ink-secondary">
              {message.author === "agent" ? (
                <Bot className="h-3.5 w-3.5" strokeWidth={1.5} />
              ) : (
                <User className="h-3.5 w-3.5" strokeWidth={1.5} />
              )}
            </div>
            <p className="max-w-lg rounded-2xl bg-surface-soft px-4 py-2 text-sm text-ink">{message.text}</p>
          </div>
        ))}
      </Card>
      <div className="rounded-xl border border-border px-4 py-2 text-sm text-ink-secondary opacity-50">
        Полноценный диалог с AI Architect появится на следующем этапе (см. AI Conversation Panel в 01-PRODUCT.md)…
      </div>
    </div>
  );
}
