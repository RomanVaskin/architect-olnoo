import Link from "next/link";
import { Filter, Grid2X2, List, Plus, Search } from "lucide-react";
import { ProjectCard } from "@/components/project-card";
import { projects } from "@/lib/mock-data";

export default function ProjectsPage() {
  return (
    <div className="mx-auto max-w-[1440px] px-5 py-8 md:px-8 xl:px-12">
      <div className="flex flex-col justify-between gap-5 md:flex-row md:items-end">
        <div><p className="text-xs font-medium text-[#77817b]">Workspace</p><h1 className="mt-2 text-[34px] font-semibold tracking-[-.045em]">Projects</h1><p className="mt-2 text-[12px] text-[#89908c]">All architectural work, from early ideas to approved concepts.</p></div>
        <Link href="/projects/new" className="flex w-fit items-center gap-2 rounded-xl bg-[#203f35] px-4 py-2.5 text-xs font-semibold text-white"><Plus size={15} />New project</Link>
      </div>
      <div className="mt-8 flex flex-col justify-between gap-3 border-y border-[#e1e5e2] py-3 md:flex-row md:items-center">
        <div className="flex gap-1"><button className="rounded-lg bg-white px-3 py-2 text-[11px] font-semibold shadow-sm">All <span className="ml-1 text-[#9aa19c]">3</span></button><button className="rounded-lg px-3 py-2 text-[11px] text-[#777f7a]">Active</button><button className="rounded-lg px-3 py-2 text-[11px] text-[#777f7a]">Archived</button></div>
        <div className="flex items-center gap-2"><button className="flex h-9 items-center gap-2 rounded-lg border border-[#e0e4e1] bg-white px-3 text-[11px] text-[#727b75]"><Search size={14} />Search</button><button className="flex h-9 items-center gap-2 rounded-lg border border-[#e0e4e1] bg-white px-3 text-[11px] text-[#727b75]"><Filter size={14} />Filter</button><div className="flex rounded-lg border border-[#e0e4e1] bg-white p-1"><button className="rounded-md bg-[#eef1ef] p-1.5"><Grid2X2 size={13} /></button><button className="p-1.5 text-[#9aa09c]"><List size={13} /></button></div></div>
      </div>
      <div className="mt-6 grid gap-5 md:grid-cols-2 xl:grid-cols-3">{projects.map((project) => <ProjectCard key={project.id} project={project} />)}</div>
    </div>
  );
}
