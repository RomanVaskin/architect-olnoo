import Link from "next/link";
import { ArrowLeft, ArrowRight, Building2, Home, Map, Upload } from "lucide-react";

export default function NewProjectPage() {
  return (
    <div className="mx-auto max-w-4xl px-5 py-10 md:px-8">
      <Link href="/projects" className="inline-flex items-center gap-2 text-xs font-medium text-[#6f7973]"><ArrowLeft size={14} />Back to projects</Link>
      <div className="mt-10 max-w-xl"><span className="text-[10px] font-semibold uppercase tracking-[.18em] text-[#789084]">New project · Step 1 of 4</span><h1 className="mt-3 text-4xl font-semibold tracking-[-.05em]">What are we designing?</h1><p className="mt-3 text-[13px] leading-6 text-[#7e8781]">Choose the starting point. Architect OLNOO will adapt the brief and workflow to your project.</p></div>
      <div className="mt-10 grid gap-4 md:grid-cols-2">
        {[{icon:Home,title:'Redesign an existing house',text:'Upload photographs or drawings and preserve the building geometry.'},{icon:Building2,title:'Design a new house',text:'Start with a site, requirements and architectural direction.'},{icon:Map,title:'Plan a settlement',text:'Explore master plans, plot layouts and shared infrastructure.'},{icon:Upload,title:'Import an existing project',text:'Continue from drawings, PDF documents or a BIM model.'}].map(({icon:Icon,title,text},i)=><button key={title} className={`group rounded-[20px] border p-5 text-left transition hover:border-[#8ca094] hover:bg-white ${i===0?'border-[#7f998c] bg-white shadow-[0_10px_30px_rgba(34,61,51,.08)]':'border-[#dfe4e1] bg-white/50'}`}><div className="grid h-10 w-10 place-items-center rounded-xl bg-[#edf2ef] text-[#345448]"><Icon size={19}/></div><h2 className="mt-5 text-[15px] font-semibold">{title}</h2><p className="mt-2 text-[11px] leading-5 text-[#858d88]">{text}</p></button>)}
      </div>
      <div className="mt-9 flex justify-end"><Link href="/projects/pine-ridge" className="flex items-center gap-2 rounded-xl bg-[#203f35] px-5 py-3 text-xs font-semibold text-white">Continue <ArrowRight size={15}/></Link></div>
    </div>
  );
}
