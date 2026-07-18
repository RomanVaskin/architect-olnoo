"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

interface WorkspaceNavProps {
  projectId: string;
}

const SECTIONS = [
  { segment: "", label: "Overview" },
  { segment: "brief", label: "Brief" },
  { segment: "source-materials", label: "Source Materials" },
  { segment: "site-climate", label: "Site and Climate" },
  { segment: "ai-dialogue", label: "AI Dialogue" },
  { segment: "concepts", label: "Concepts" },
  { segment: "selected-concept", label: "Selected Concept" },
  { segment: "versions", label: "Versions" },
  { segment: "documents", label: "Documents" },
  { segment: "activity", label: "Activity" },
];

export function WorkspaceNav({ projectId }: WorkspaceNavProps) {
  const pathname = usePathname();
  const base = `/projects/${projectId}`;

  return (
    <nav className="flex shrink-0 flex-col gap-1 md:w-[220px]">
      {SECTIONS.map((section) => {
        const href = section.segment ? `${base}/${section.segment}` : base;
        const isActive = pathname === href;
        return (
          <Link
            key={section.label}
            href={href}
            className={cn(
              "rounded-lg border-l-2 border-transparent px-3 py-2 text-sm font-medium text-ink-secondary transition-colors",
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
