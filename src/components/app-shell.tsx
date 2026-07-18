"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bell,
  Blocks,
  ChevronDown,
  FolderKanban,
  Home,
  LifeBuoy,
  Plus,
  Search,
  Settings,
  Sparkles,
} from "lucide-react";
import type { ReactNode } from "react";

const nav = [
  { href: "/", label: "Home", icon: Home },
  { href: "/projects", label: "Projects", icon: FolderKanban },
  { href: "/projects/pine-ridge", label: "AI Architect", icon: Sparkles },
  { href: "/library", label: "Library", icon: Blocks },
];

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen">
      <aside className="desktop-sidebar fixed inset-y-0 left-0 z-40 flex w-[248px] flex-col border-r border-[#dfe4e0] bg-[#f9faf8]/95 px-3 py-4 backdrop-blur-xl">
        <Link href="/" className="mb-7 flex items-center gap-3 px-2">
          <div className="grid h-9 w-9 place-items-center rounded-[11px] bg-[#203f35] text-sm font-semibold text-white shadow-sm">O</div>
          <div>
            <div className="text-[14px] font-semibold tracking-[-.02em]">Architect</div>
            <div className="text-[10px] font-semibold tracking-[.19em] text-[#88908b]">BY OLNOO</div>
          </div>
        </Link>

        <nav className="space-y-1">
          {nav.map(({ href, label, icon: Icon }) => {
            const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
            return (
              <Link key={href} href={href} className={`flex h-10 items-center gap-3 rounded-xl px-3 text-[13px] font-medium transition ${active ? "bg-white text-[#1d382f] shadow-[0_1px_2px_rgba(24,45,37,.06),0_0_0_1px_rgba(34,62,52,.06)]" : "text-[#6d7570] hover:bg-white/70 hover:text-[#253a32]"}`}>
                <Icon size={16} strokeWidth={1.8} />
                {label}
              </Link>
            );
          })}
        </nav>

        <div className="mt-7 px-3 text-[10px] font-semibold uppercase tracking-[.16em] text-[#a1a7a3]">Workspace</div>
        <button className="mt-2 flex h-10 items-center justify-between rounded-xl px-3 text-left text-[13px] font-medium text-[#606963] hover:bg-white/70">
          <span className="flex items-center gap-3"><span className="h-2 w-2 rounded-full bg-[#a9b9ae]" />Personal</span>
          <ChevronDown size={14} />
        </button>

        <div className="mt-auto space-y-1 border-t border-[#e3e7e4] pt-3">
          <Link href="/settings" className="flex h-9 items-center gap-3 rounded-xl px-3 text-[12px] text-[#707873] hover:bg-white"><Settings size={15} />Settings</Link>
          <button className="flex h-9 w-full items-center gap-3 rounded-xl px-3 text-[12px] text-[#707873] hover:bg-white"><LifeBuoy size={15} />Help & feedback</button>
          <div className="mt-2 flex items-center gap-3 rounded-xl p-2 hover:bg-white">
            <div className="grid h-8 w-8 place-items-center rounded-full bg-[#dac9b2] text-xs font-semibold text-[#594937]">RV</div>
            <div className="min-w-0 flex-1"><p className="truncate text-xs font-medium">Roman Vaskin</p><p className="text-[10px] text-[#969c98]">Pro workspace</p></div>
            <ChevronDown size={13} className="text-[#8b938e]" />
          </div>
        </div>
      </aside>

      <nav className="fixed inset-x-3 bottom-3 z-50 flex h-14 items-center justify-around rounded-2xl border border-[#dce2de] bg-white/92 px-2 shadow-[0_12px_35px_rgba(27,45,38,.16)] backdrop-blur-xl lg:hidden">
        {nav.map(({ href, label, icon: Icon }) => {
          const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
          return <Link key={href} href={href} className={`flex min-w-[56px] flex-col items-center gap-1 text-[8px] font-medium ${active ? "text-[#24483a]" : "text-[#8a928d]"}`}><Icon size={17} strokeWidth={active ? 2.2 : 1.7}/><span>{label === "AI Architect" ? "AI" : label}</span></Link>;
        })}
      </nav>

      <main className="app-main min-h-screen pb-20 lg:ml-[248px] lg:pb-0">
        <header className="sticky top-0 z-30 flex h-[64px] items-center justify-between border-b border-[#e2e6e3] bg-[#f6f7f5]/85 px-5 backdrop-blur-xl md:px-8">
          <button className="flex h-9 w-full max-w-[320px] items-center gap-2 rounded-xl border border-[#e0e4e1] bg-white/80 px-3 text-left text-xs text-[#969c98] shadow-[0_1px_2px_rgba(23,33,29,.03)]">
            <Search size={15} /><span className="flex-1">Search projects and files</span><kbd className="rounded-md border border-[#e2e5e3] bg-[#f7f8f7] px-1.5 py-0.5 text-[10px]">⌘ K</kbd>
          </button>
          <div className="ml-4 flex items-center gap-2">
            <button aria-label="Notifications" className="grid h-9 w-9 place-items-center rounded-xl border border-transparent text-[#717a74] hover:border-[#e0e4e1] hover:bg-white"><Bell size={17} /></button>
            <Link href="/projects/new" className="flex h-9 items-center gap-2 rounded-xl bg-[#203f35] px-3 text-xs font-semibold text-white shadow-[0_6px_16px_rgba(32,63,53,.16)] transition hover:bg-[#18332a] sm:px-4"><Plus size={15} /><span className="hidden sm:inline">New project</span></Link>
          </div>
        </header>
        {children}
      </main>
    </div>
  );
}
