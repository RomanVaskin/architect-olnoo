import Link from "next/link";
import { ArrowRight, Clock3, FolderOpen, Sparkles, WandSparkles } from "lucide-react";
import { ProjectCard } from "@/components/project-card";
import { projects } from "@/lib/mock-data";

export default function DashboardPage() {
  return (
    <div className="mx-auto max-w-[1440px] px-5 py-8 md:px-8 md:py-10 xl:px-12">
      <section className="flex flex-col justify-between gap-5 md:flex-row md:items-end">
        <div><p className="text-xs font-medium text-[#7d8680]">Saturday, 18 July</p><h1 className="mt-2 text-[30px] font-semibold tracking-[-.045em] md:text-[38px]">Good morning, Roman</h1><p className="mt-2 max-w-xl text-[13px] leading-6 text-[#7c847f]">Continue shaping your projects or start a new architectural concept.</p></div>
        <Link href="/projects/new" className="flex w-fit items-center gap-2 rounded-xl border border-[#dce2de] bg-white px-4 py-2.5 text-xs font-semibold text-[#2a463c] shadow-sm hover:border-[#becbc4]"><WandSparkles size={15} />Create with AI</Link>
      </section>

      <section className="mt-9 grid gap-4 md:grid-cols-3">
        <div className="rounded-[20px] border border-[#dfe5e1] bg-[#203f35] p-5 text-white shadow-[0_18px_50px_rgba(30,61,50,.16)]">
          <div className="flex items-center justify-between"><span className="text-[11px] font-medium text-white/65">Active projects</span><FolderOpen size={17} className="text-white/55" /></div><p className="mt-7 text-3xl font-semibold tracking-[-.05em]">03</p><p className="mt-2 text-[10px] text-white/55">2 concepts need your review</p>
        </div>
        <div className="rounded-[20px] border border-[#e1e5e2] bg-white p-5">
          <div className="flex items-center justify-between"><span className="text-[11px] font-medium text-[#818983]">AI generations</span><Sparkles size={17} className="text-[#789084]" /></div><p className="mt-7 text-3xl font-semibold tracking-[-.05em]">24</p><p className="mt-2 text-[10px] text-[#9ba19d]">8 concepts created this month</p>
        </div>
        <div className="rounded-[20px] border border-[#e1e5e2] bg-white p-5">
          <div className="flex items-center justify-between"><span className="text-[11px] font-medium text-[#818983]">Design time saved</span><Clock3 size={17} className="text-[#789084]" /></div><p className="mt-7 text-3xl font-semibold tracking-[-.05em]">18.5h</p><p className="mt-2 text-[10px] text-[#9ba19d]">Estimated across active projects</p>
        </div>
      </section>

      <section className="mt-11">
        <div className="mb-5 flex items-center justify-between"><div><h2 className="text-lg font-semibold tracking-[-.025em]">Recent projects</h2><p className="mt-1 text-[11px] text-[#929994]">Pick up where you left off</p></div><Link href="/projects" className="flex items-center gap-1.5 text-xs font-semibold text-[#49675c] hover:text-[#203f35]">View all <ArrowRight size={14} /></Link></div>
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">{projects.map((project) => <ProjectCard key={project.id} project={project} />)}</div>
      </section>

      <section className="mt-11 grid gap-5 xl:grid-cols-[1.4fr_.6fr]">
        <div className="rounded-[22px] border border-[#dfe4e1] bg-white p-5 md:p-6">
          <div className="flex items-center justify-between"><div><h2 className="text-[15px] font-semibold">Activity</h2><p className="mt-1 text-[10px] text-[#979e99]">Latest changes across your workspace</p></div><button className="text-[11px] font-medium text-[#60776d]">View history</button></div>
          <div className="mt-5 divide-y divide-[#edf0ee]">
            {[['Concept B is ready for review','Pine Ridge House','12 min'],['Roman added feedback to Nordic light','Pine Ridge House','1h'],['Export package completed','Fjord Cabin','Yesterday']].map(([title, project, time], i) => <div key={title} className="flex items-center gap-3 py-3"><span className={`h-2 w-2 rounded-full ${i === 0 ? 'bg-[#5c806f]' : 'bg-[#c9cfcb]'}`} /><div className="min-w-0 flex-1"><p className="truncate text-[12px] font-medium">{title}</p><p className="mt-0.5 text-[10px] text-[#969d98]">{project}</p></div><span className="text-[10px] text-[#a2a8a4]">{time}</span></div>)}
          </div>
        </div>
        <div className="rounded-[22px] border border-[#cfdad4] bg-[#eaf0ec] p-6">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-white text-[#335446] shadow-sm"><Sparkles size={18} /></div><h2 className="mt-6 text-xl font-semibold tracking-[-.035em]">Design with confidence</h2><p className="mt-2 text-[12px] leading-5 text-[#6b7a72]">Your AI Architect keeps geometry, climate and project constraints aligned while you explore.</p><Link href="/projects/pine-ridge" className="mt-6 inline-flex items-center gap-2 text-xs font-semibold text-[#29483b]">Open AI Architect <ArrowRight size={14} /></Link>
        </div>
      </section>
    </div>
  );
}
