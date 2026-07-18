"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { FolderKanban, LayoutDashboard, Menu, Plus, Settings, X } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/", label: "Обзор", icon: <LayoutDashboard className="h-4 w-4" /> },
  { href: "/projects", label: "Проекты", icon: <FolderKanban className="h-4 w-4" /> },
  { href: "/settings", label: "Настройки", icon: <Settings className="h-4 w-4" /> },
];

export function MobileNav() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  return (
    <div className="md:hidden">
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Открыть навигацию"
        className="flex h-9 w-9 items-center justify-center rounded-full border border-border text-ink-secondary hover:bg-surface-soft"
      >
        <Menu className="h-4 w-4" />
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 flex">
          <div className="flex w-72 flex-col bg-surface px-4 py-5">
            <div className="flex items-center justify-between px-2">
              <Image src="/olnoo-logo.svg" alt="Architect OLNOO" width={88} height={37} className="h-auto w-[88px]" />
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Закрыть навигацию"
                className="flex h-8 w-8 items-center justify-center rounded-full text-ink-secondary hover:bg-surface-soft"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <Link
              href="/projects/new"
              onClick={() => setOpen(false)}
              className="mt-4 inline-flex items-center justify-center gap-2 rounded-xl bg-action px-4 py-2 text-sm font-medium text-action-ink hover:bg-action-hover"
            >
              <Plus className="h-4 w-4" />
              Новый проект
            </Link>

            <nav className="mt-6 flex flex-col gap-1">
              {NAV_ITEMS.map((item) => {
                const isActive = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setOpen(false)}
                    className={cn(
                      "flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium text-ink-secondary",
                      isActive ? "bg-surface-soft text-ink" : "hover:bg-surface-soft hover:text-ink",
                    )}
                  >
                    {item.icon}
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </div>
          <button
            type="button"
            aria-label="Закрыть навигацию"
            className="flex-1 bg-ink/20"
            onClick={() => setOpen(false)}
          />
        </div>
      ) : null}
    </div>
  );
}
