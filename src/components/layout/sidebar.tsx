"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, FolderKanban, Plus, Search, Settings } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  {
    href: "/",
    label: "Обзор",
    icon: <LayoutDashboard className="h-4 w-4" />,
    match: (path: string) => path === "/",
  },
  {
    href: "/projects",
    label: "Проекты",
    icon: <FolderKanban className="h-4 w-4" />,
    match: (path: string) => path.startsWith("/projects"),
  },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden w-[280px] shrink-0 flex-col border-r border-border bg-surface px-4 py-5 md:flex">
      <Link href="/" className="flex items-center px-2 py-2">
        <Image src="/olnoo-logo.svg" alt="Architect OLNOO" width={100} height={42} priority className="h-auto w-[100px]" />
      </Link>

      <div className="mt-6 flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-2 text-sm text-ink-secondary">
        <Search className="h-4 w-4 shrink-0" />
        <span className="truncate">Поиск проектов…</span>
        <kbd className="ml-auto rounded border border-border px-1.5 py-0.5 text-[11px] text-ink-secondary">⌘K</kbd>
      </div>

      <Link
        href="/projects/new"
        className="mt-4 inline-flex items-center justify-center gap-2 rounded-full bg-accent px-4 py-2 text-sm font-medium text-accent-ink hover:opacity-90"
      >
        <Plus className="h-4 w-4" />
        Новый проект
      </Link>

      <nav className="mt-6 flex flex-1 flex-col gap-1">
        {NAV_ITEMS.map((item) => {
          const isActive = item.match(pathname);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-xl border-l-2 border-transparent px-3 py-2 text-sm font-medium text-ink-secondary transition-colors",
                isActive
                  ? "border-l-accent bg-surface-soft text-ink"
                  : "hover:bg-surface-soft hover:text-ink",
              )}
            >
              {item.icon}
              {item.label}
            </Link>
          );
        })}
      </nav>

      <Link
        href="/settings"
        className={cn(
          "flex items-center gap-3 rounded-xl border-l-2 border-transparent px-3 py-2 text-sm font-medium text-ink-secondary transition-colors",
          pathname.startsWith("/settings")
            ? "border-l-accent bg-surface-soft text-ink"
            : "hover:bg-surface-soft hover:text-ink",
        )}
      >
        <Settings className="h-4 w-4" />
        Настройки
      </Link>
    </aside>
  );
}
