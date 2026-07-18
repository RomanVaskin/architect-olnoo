"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Check, ChevronDown, Download, Expand, FileText, History, Image as ImageIcon, MessageSquare, MoreHorizontal, Paperclip, Play, Send, SlidersHorizontal, Sparkles, X } from "lucide-react";
import { concepts } from "@/lib/mock-data";

const tabs = ["Overview", "Brief", "Source materials", "Concepts", "Versions", "Documents", "Activity"];

export default function ProjectWorkspacePage() {
  const [activeTab, setActiveTab] = useState("Concepts");
  const [selected, setSelected] = useState("a");
  const [chatOpen, setChatOpen] = useState(true);

  return (
    <div className="flex h-[calc(100vh-64px)] flex-col overflow-hidden bg-[#f3f4f2]">
      <div className="flex h-[70px] shrink-0 items-center justify-between border-b border-[#dfe4e1] bg-white px-5">
        <div className="flex min-w-0 items-center gap-3"><Link href="/projects" className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-[#e0e4e1] text-[#707974]"><ArrowLeft size={14}/></Link><div className="min-w-0"><div className="flex items-center gap-2"><h1 className="truncate text-[14px] font-semibold">Pine Ridge House</h1><span className="rounded-full bg-[#e8f0eb] px-2 py-0.5 text-[9px] font-semibold text-[#38604f]">In design</span></div><p className="mt-1 text-[10px] text-[#969d98]">Ontario, Canada · Updated 12 min ago</p></div></div>
        <div className="flex items-center gap-2"><button className="hidden h-9 items-center gap-2 rounded-xl border border-[#dfe4e1] bg-white px-3 text-[11px] font-medium text-[#5e6a64] md:flex"><History size={14}/>Version 4<ChevronDown size={12}/></button><button className="flex h-9 items-center gap-2 rounded-xl bg-[#203f35] px-3.5 text-[11px] font-semibold text-white"><Download size={14}/>Export</button><button className="grid h-9 w-9 place-items-center rounded-xl border border-[#dfe4e1] text-[#727a75]"><MoreHorizontal size={15}/></button></div>
      </div>
      <div className="scrollbar-none flex h-[47px] shrink-0 items-center gap-1 overflow-x-auto border-b border-[#dfe4e1] bg-white px-5">
        {tabs.map((tab)=><button key={tab} onClick={()=>setActiveTab(tab)} className={`h-full whitespace-nowrap border-b-2 px-3 text-[11px] font-medium transition ${activeTab===tab?'border-[#294c3f] text-[#203f35]':'border-transparent text-[#8a918d] hover:text-[#45534c]'}`}>{tab}</button>)}
      </div>

      <div className="flex min-h-0 flex-1">
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex h-[52px] shrink-0 items-center justify-between border-b border-[#dfe4e1] bg-[#fafbf9] px-4">
            <div className="flex items-center gap-2"><button className="flex h-8 items-center gap-2 rounded-lg border border-[#dde2df] bg-white px-3 text-[10px] font-medium"><ImageIcon size={13}/>Exterior · Front</button><button className="hidden h-8 items-center gap-2 rounded-lg px-3 text-[10px] text-[#7d8680] md:flex"><SlidersHorizontal size={13}/>Display</button></div>
            <div className="flex items-center gap-2"><span className="hidden text-[10px] text-[#929994] md:block">AI analysis complete</span><span className="h-1.5 w-1.5 rounded-full bg-[#5f8b75]"/><button className="grid h-8 w-8 place-items-center rounded-lg border border-[#dde2df] bg-white"><Expand size={13}/></button><button onClick={()=>setChatOpen(!chatOpen)} className={`grid h-8 w-8 place-items-center rounded-lg border ${chatOpen?'border-[#9aafa4] bg-[#edf2ef] text-[#294b3e]':'border-[#dde2df] bg-white text-[#78817c]'}`}><MessageSquare size={14}/></button></div>
          </div>

          <div className="architect-canvas relative min-h-0 flex-1 p-4 md:p-6">
            <div className="house-scene concept-light h-full min-h-[360px] overflow-hidden rounded-[18px] border border-white/70 shadow-[0_20px_55px_rgba(30,46,39,.16)]">
              <div className="absolute left-4 top-4 z-20 flex items-center gap-2 rounded-xl bg-[#17231f]/75 px-3 py-2 text-white backdrop-blur"><span className="text-[10px] font-semibold">Concept A</span><span className="h-3 w-px bg-white/25"/><span className="text-[9px] text-white/65">Nordic light</span></div>
              <div className="absolute bottom-4 left-4 z-20 flex gap-2"><span className="rounded-lg bg-white/82 px-2.5 py-1.5 text-[9px] font-medium text-[#44524b] backdrop-blur">Geometry locked</span><span className="rounded-lg bg-white/82 px-2.5 py-1.5 text-[9px] font-medium text-[#44524b] backdrop-blur">Cold climate</span></div>
            </div>
          </div>

          <div className="shrink-0 border-t border-[#dfe4e1] bg-white px-4 py-3">
            <div className="flex items-center justify-between"><div><p className="text-[11px] font-semibold">Concepts</p><p className="mt-0.5 text-[9px] text-[#9aa09c]">3 generated · Version 4</p></div><div className="flex gap-2"><button className="rounded-lg border border-[#dde2df] px-3 py-2 text-[10px] font-medium">Compare</button><button className="rounded-lg bg-[#eaf0ec] px-3 py-2 text-[10px] font-semibold text-[#315446]">Use selected</button></div></div>
            <div className="scrollbar-none mt-3 flex gap-3 overflow-x-auto pb-1">{concepts.map((concept)=><button key={concept.id} onClick={()=>setSelected(concept.id)} className={`flex min-w-[210px] items-center gap-3 rounded-xl border p-2 text-left transition ${selected===concept.id?'border-[#6d8a7c] bg-[#f3f7f5] shadow-[0_0_0_1px_rgba(78,112,96,.08)]':'border-[#e2e6e3] hover:bg-[#fafbfa]'}`}><span className={`house-scene concept-${concept.tone} h-12 w-16 shrink-0 rounded-lg`}/><span className="min-w-0 flex-1"><span className="block truncate text-[10px] font-semibold">{concept.name}</span><span className="mt-1 block truncate text-[8px] text-[#929994]">{concept.note}</span></span>{selected===concept.id&&<span className="grid h-5 w-5 place-items-center rounded-full bg-[#345a4a] text-white"><Check size={11}/></span>}</button>)}</div>
          </div>
        </div>

        {chatOpen && <aside className="hidden w-[350px] shrink-0 flex-col border-l border-[#dfe4e1] bg-white xl:flex">
          <div className="flex h-[52px] items-center justify-between border-b border-[#e4e8e5] px-4"><div className="flex items-center gap-2"><span className="grid h-7 w-7 place-items-center rounded-lg bg-[#e9f0ec] text-[#315546]"><Sparkles size={14}/></span><div><p className="text-[11px] font-semibold">AI Architect</p><p className="text-[8px] text-[#829087]">Context: Concept A</p></div></div><button onClick={()=>setChatOpen(false)} className="text-[#8b938e]"><X size={14}/></button></div>
          <div className="scrollbar-none flex-1 overflow-y-auto px-4 py-5">
            <div className="flex justify-end"><div className="max-w-[86%] rounded-2xl rounded-tr-md bg-[#edf1ef] px-3.5 py-3 text-[10px] leading-5 text-[#3f4d46]">Make the façade lighter and more Scandinavian. Keep the roof, window positions and overall geometry unchanged.</div></div>
            <div className="mt-5 flex gap-2.5"><span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-[#203f35] text-white"><Sparkles size={13}/></span><div className="text-[10px] leading-5 text-[#56635c]"><p>I created three façade directions while preserving all locked geometry.</p><div className="mt-3 rounded-xl border border-[#e1e6e3] bg-[#fafbfa] p-3"><p className="font-semibold text-[#33463e]">What changed</p><ul className="mt-2 space-y-1 text-[#6f7a74]"><li>• Warm white mineral render</li><li>• Natural oak entrance accent</li><li>• Slimmer dark window frames</li></ul></div><p className="mt-3">Concept A has the strongest balance between your brief and local climate constraints.</p></div></div>
            <div className="mt-5 flex items-center gap-2 rounded-xl border border-[#dce5e0] bg-[#f1f6f3] p-3"><span className="relative flex h-6 w-6 items-center justify-center"><span className="absolute h-full w-full animate-ping rounded-full bg-[#88a899]/25"/><Play size={11} fill="currentColor" className="text-[#466a5b]"/></span><div><p className="text-[9px] font-semibold">Reviewer agent</p><p className="mt-0.5 text-[8px] text-[#7d8982]">Checking geometry consistency…</p></div></div>
          </div>
          <div className="border-t border-[#e5e8e6] p-3"><div className="rounded-2xl border border-[#dce2de] bg-[#fafbfa] p-2 shadow-[0_4px_18px_rgba(28,44,37,.05)]"><textarea aria-label="Message AI Architect" placeholder="Describe what you want to change…" className="h-16 w-full resize-none bg-transparent px-2 py-1 text-[10px] outline-none placeholder:text-[#a5aaa7]"/><div className="flex items-center justify-between"><div className="flex gap-1"><button className="grid h-7 w-7 place-items-center rounded-lg text-[#78817c] hover:bg-white"><Paperclip size={13}/></button><button className="flex h-7 items-center gap-1 rounded-lg px-2 text-[9px] text-[#718079]"><FileText size={12}/>Brief</button></div><button className="grid h-7 w-7 place-items-center rounded-lg bg-[#203f35] text-white"><Send size={12}/></button></div></div><p className="mt-2 text-center text-[8px] text-[#a1a6a3]">AI can make mistakes. Professional review may be required.</p></div>
        </aside>}
      </div>
    </div>
  );
}
