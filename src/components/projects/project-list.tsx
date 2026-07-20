"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { ProjectCard, type ProjectCardData } from "@/components/projects/project-card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingState } from "@/components/ui/loading-state";
import { PROJECT_STATE_LABELS, type ProjectState } from "@/lib/types";
import type { ProjectListState } from "@/lib/use-project-list";

const STATE_FILTERS: { value: ProjectState | "all"; label: string }[] = [
  { value: "all", label: "Все статусы" },
  ...(Object.entries(PROJECT_STATE_LABELS) as [ProjectState, string][]).map(([value, label]) => ({
    value,
    label,
  })),
];

function matches(project: ProjectCardData, query: string, stateFilter: ProjectState | "all") {
  const normalizedQuery = query.trim().toLowerCase();
  const matchesQuery =
    normalizedQuery.length === 0 ||
    project.name.toLowerCase().includes(normalizedQuery) ||
    project.site.address.toLowerCase().includes(normalizedQuery);
  const matchesState = stateFilter === "all" || project.state === stateFilter;
  return matchesQuery && matchesState;
}

function Section({ title, badge, items }: { title: string; badge: React.ReactNode; items: ProjectCardData[] }) {
  if (items.length === 0) return null;
  return (
    <div className="flex flex-col gap-3">
      <h2 className="text-sm font-medium text-ink-secondary">{title}</h2>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((project) => (
          <ProjectCard key={project.id} project={project} originBadge={badge} />
        ))}
      </div>
    </div>
  );
}

export function ProjectList({ cloud, local, demo, loading, cloudError }: ProjectListState) {
  const [query, setQuery] = useState("");
  const [stateFilter, setStateFilter] = useState<ProjectState | "all">("all");

  const filteredCloud = useMemo(() => cloud.filter((project) => matches(project, query, stateFilter)), [cloud, query, stateFilter]);
  const filteredLocal = useMemo(() => local.filter((project) => matches(project, query, stateFilter)), [local, query, stateFilter]);
  const filteredDemo = useMemo(() => demo.filter((project) => matches(project, query, stateFilter)), [demo, query, stateFilter]);

  const hasRealProjects = cloud.length > 0 || local.length > 0;
  const hasAnyResult = filteredCloud.length > 0 || filteredLocal.length > 0 || filteredDemo.length > 0;

  if (loading) return <LoadingState label="Загрузка проектов…" />;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="flex flex-1 items-center gap-2 rounded-xl border border-border px-4 py-2 text-sm">
          <Search className="h-4 w-4 text-ink-secondary" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Поиск по названию или адресу…"
            className="w-full bg-transparent text-ink outline-none placeholder:text-ink-secondary"
          />
        </div>
        <select
          value={stateFilter}
          onChange={(event) => setStateFilter(event.target.value as ProjectState | "all")}
          className="rounded-xl border border-border bg-surface px-4 py-2 text-sm text-ink outline-none"
        >
          {STATE_FILTERS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      {cloudError ? (
        <p role="alert" className="rounded-xl border border-border bg-surface-soft px-4 py-3 text-sm text-ink-secondary">
          {cloudError}
        </p>
      ) : null}

      {!hasRealProjects ? (
        <EmptyState
          title="Проектов пока нет"
          description="Создайте первый проект — он появится здесь сразу после сохранения, локально или в облаке."
        />
      ) : !hasAnyResult ? (
        <EmptyState title="Ничего не найдено" description="Попробуйте изменить запрос или сбросить фильтр по статусу." />
      ) : (
        <>
          <Section title="В облаке" badge={<Badge variant="positive">В облаке</Badge>} items={filteredCloud} />
          <Section title="Локально (не синхронизировано)" badge={<Badge variant="accent">Локально</Badge>} items={filteredLocal} />
        </>
      )}

      <Section title="Демо" badge={<Badge>Демо</Badge>} items={filteredDemo} />
    </div>
  );
}
