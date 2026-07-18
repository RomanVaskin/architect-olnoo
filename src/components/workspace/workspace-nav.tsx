"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

interface WorkspaceNavProps {
  projectId: string;
}

const SECTIONS = [
  { segment: "", label: "Обзор" },
  { segment: "brief", label: "Бриф" },
  { segment: "source-materials", label: "Исходные материалы" },
  { segment: "site-climate", label: "Участок и климат" },
  { segment: "ai-dialogue", label: "AI-диалог" },
  { segment: "concepts", label: "Концепции" },
  { segment: "selected-concept", label: "Выбранная концепция" },
  { segment: "versions", label: "Версии" },
  { segment: "documents", label: "Документы" },
  { segment: "activity", label: "События" },
];

export function WorkspaceNav({ projectId }: WorkspaceNavProps) {
  const pathname = usePathname();
  const base = `/projects/${projectId}`;

  return (
    <nav className="scrollbar-none flex shrink-0 gap-1 overflow-x-auto border-b border-border pb-2 md:w-[205px] md:flex-col md:overflow-visible md:border-b-0 md:pb-0">
      {SECTIONS.map((section) => {
        const href = section.segment ? `${base}/${section.segment}` : base;
        const isActive = pathname === href;
        return (
          <Link
            key={section.label}
            href={href}
            className={cn(
              "whitespace-nowrap rounded-lg border-l-2 border-transparent px-3 py-2 text-sm font-medium text-ink-secondary transition-colors",
              isActive ? "border-l-accent bg-surface-soft text-ink" : "hover:bg-surface-soft hover:text-ink",
            )}
          >
            {section.label}
          </Link>
        );
      })}
    </nav>
  );
}
