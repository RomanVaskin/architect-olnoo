import { Card } from "@/components/ui/card";

export function LoadingState({ label = "Загрузка проекта…" }: { label?: string }) {
  return (
    <Card className="flex flex-col items-center gap-3 px-6 py-16 text-center">
      <span className="h-5 w-5 animate-spin rounded-full border-2 border-border border-t-action" />
      <p className="text-sm text-ink-secondary">{label}</p>
    </Card>
  );
}
