import { FileStack } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";

export default function DocumentsPage() {
  return (
    <EmptyState
      icon={<FileStack className="h-5 w-5" strokeWidth={1.5} />}
      title="Документов пока нет"
      description="Профессиональная и строительная документация не входит в границы MVP (см. What Is Explicitly Excluded from MVP в 01-PRODUCT.md) — раздел появится на следующих этапах."
    />
  );
}
