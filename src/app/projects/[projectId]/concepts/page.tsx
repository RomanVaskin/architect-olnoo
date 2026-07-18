"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useProjectContext } from "@/lib/project-context";
import { ConceptsWorkspace } from "@/components/workspace/concepts-workspace";
import { EmptyState } from "@/components/ui/empty-state";

export default function ConceptsPage() {
  return (
    <Suspense fallback={null}>
      <ConceptsPageContent />
    </Suspense>
  );
}

function ConceptsPageContent() {
  const { project } = useProjectContext();
  const searchParams = useSearchParams();
  const justGenerated = searchParams.get("generated") === "1";
  const isPartial = searchParams.get("partial") === "1";

  if (!project) return null;

  if (project.concepts.length === 0) {
    return (
      <EmptyState
        title="Концепции ещё не сгенерированы"
        description="Заполните бриф и загрузите исходные материалы, чтобы AI Architect предложил варианты."
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {justGenerated && isPartial ? (
        <div className="rounded-2xl border border-border bg-surface-soft px-4 py-3 text-sm text-ink-secondary">
          Готовы не все запрошенные варианты — один или несколько не удалось сгенерировать. Ниже показаны концепции, которые получилось создать.
        </div>
      ) : null}
      <ConceptsWorkspace project={project} />
    </div>
  );
}
