"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { ProjectCard } from "@/components/projects/project-card";
import { EmptyState } from "@/components/ui/empty-state";
import { PROJECT_STATE_LABELS, type Project, type ProjectState } from "@/lib/types";

const STATE_FILTERS: { value: ProjectState | "all"; label: string }[] = [
  { value: "all", label: "Все статусы" },
  ...(Object.entries(PROJECT_STATE_LABELS) as [ProjectState, string][]).map(([value, label]) => ({
    value,
    label,
  })),
];

export function ProjectList({ projects }: { projects: Project[] }) {
  const [query, setQuery] = useState("");
  const [stateFilter, setStateFilter] = useState<ProjectState | "all">("all");

  const filtered = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return projects.filter((project) => {
      const matchesQuery =
        normalizedQuery.length === 0 ||
        project.name.toLowerCase().includes(normalizedQuery) ||
        project.site.address.toLowerCase().includes(normalizedQuery);
      const matchesState = stateFilter === "all" || project.state === stateFilter;
      return matchesQuery && matchesState;
    });
  }, [projects, query, stateFilter]);

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

      {filtered.length === 0 ? (
        <EmptyState
          title="Ничего не найдено"
          description="Попробуйте изменить запрос или сбросить фильтр по статусу."
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((project) => (
            <ProjectCard key={project.id} project={project} />
          ))}
        </div>
      )}
    </div>
  );
}
