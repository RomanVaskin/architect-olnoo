import Link from "next/link";
import { ArrowUpRight, MoreHorizontal } from "lucide-react";
import type { Project } from "@/lib/mock-data";

const statusStyles = {
  "In design": "bg-[#e8f0eb] text-[#315c4c]",
  Review: "bg-[#f3eddf] text-[#7c6032]",
  Draft: "bg-[#eceeed] text-[#6a716c]",
};

export function ProjectCard({ project }: { project: Project }) {
  return (
    <Link href={`/projects/${project.id}`} className="group overflow-hidden rounded-[20px] border border-[#e1e5e2] bg-white shadow-[0_1px_2px_rgba(23,33,29,.03)] transition duration-300 hover:-translate-y-0.5 hover:shadow-[0_16px_40px_rgba(28,48,40,.10)]">
      <div className={`house-scene concept-${project.tone} h-[180px]`}>
        <div className="absolute inset-x-0 top-0 z-10 flex items-center justify-between p-4">
          <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${statusStyles[project.status]}`}>{project.status}</span>
          <span aria-label="Project options" className="grid h-8 w-8 place-items-center rounded-full bg-white/75 text-[#53605a] opacity-0 backdrop-blur transition group-hover:opacity-100"><MoreHorizontal size={16} /></span>
        </div>
      </div>
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div><h3 className="text-[15px] font-semibold tracking-[-.02em]">{project.title}</h3><p className="mt-1 text-[11px] text-[#8b928e]">{project.location}</p></div>
          <ArrowUpRight size={16} className="mt-0.5 text-[#9aa09c] transition group-hover:text-[#294b3f]" />
        </div>
        <div className="mt-5 flex items-center gap-3">
          <div className="h-1 flex-1 overflow-hidden rounded-full bg-[#edf0ee]"><div className="h-full rounded-full bg-[#668477]" style={{ width: `${project.progress}%` }} /></div>
          <span className="text-[10px] font-medium text-[#8d948f]">{project.progress}%</span>
        </div>
        <p className="mt-3 text-[10px] text-[#a0a6a2]">Updated {project.updated}</p>
      </div>
    </Link>
  );
}
