import { Bell, LogOut } from "lucide-react";
import { MobileNav } from "@/components/layout/mobile-nav";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export function Topbar() {
  return (
    <header className="flex h-16 shrink-0 items-center justify-between border-b border-border px-4 sm:px-8">
      <MobileNav />
      <div className="hidden md:block" />
      <div className="flex items-center gap-3">
        <button
          type="button"
          aria-label="Уведомления"
          className="flex h-9 w-9 items-center justify-center rounded-full text-ink-secondary hover:bg-surface-soft"
        >
          <Bell className="h-4 w-4" />
        </button>
        <div className="flex items-center gap-2 rounded-full border border-border py-1 pl-1 pr-3">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-surface-soft text-xs font-medium text-ink">
            РВ
          </div>
          <span className="hidden text-sm font-medium text-ink sm:inline">Роман Васкин</span>
        </div>
        {isSupabaseConfigured() ? (
          <form action="/auth/signout" method="post">
            <button type="submit" aria-label="Выйти" title="Выйти" className="flex h-9 w-9 items-center justify-center rounded-full text-ink-secondary hover:bg-surface-soft">
              <LogOut className="h-4 w-4" />
            </button>
          </form>
        ) : null}
      </div>
    </header>
  );
}
