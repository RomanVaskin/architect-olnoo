import { notFound } from "next/navigation";
import { getProjectById } from "@/lib/mock-data";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { formatDate } from "@/lib/utils";

export default async function VersionsPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const project = getProjectById(projectId);
  if (!project) notFound();

  if (project.versions.length === 0) {
    return (
      <EmptyState
        title="Пока нет версий"
        description="История версий появится здесь после первой доработки выбранной концепции."
      />
    );
  }

  return (
    <Card className="divide-y divide-border">
      {[...project.versions].reverse().map((version) => (
        <div key={version.id} className="flex items-start gap-4 px-4 py-4">
          <div className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-accent" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-ink">{version.label}</p>
            <p className="mt-0.5 text-sm text-ink-secondary">{version.changeSummary}</p>
            <p className="mt-1 text-xs text-ink-secondary">{formatDate(version.createdAt)}</p>
          </div>
        </div>
      ))}
    </Card>
  );
}
