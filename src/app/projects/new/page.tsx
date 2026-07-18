import Link from "next/link";
import { ArrowLeft, ArrowRight, Building2, Home, Map, Upload } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";

const projectTypes = [
  { icon: Home, title: "Изменить существующий дом", description: "Загрузить фотографии или чертежи и сохранить исходную геометрию." },
  { icon: Building2, title: "Спроектировать новый дом", description: "Начать с участка, требований и архитектурного направления." },
  { icon: Map, title: "Спланировать посёлок", description: "Разработать мастер-план, участки и общую инфраструктуру." },
  { icon: Upload, title: "Импортировать проект", description: "Продолжить работу с чертежами, PDF или существующей BIM-моделью." },
];

export default function NewProjectPage() {
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-8">
      <Link href="/projects" className="inline-flex w-fit items-center gap-2 text-sm text-ink-secondary hover:text-ink"><ArrowLeft className="h-4 w-4" />К проектам</Link>
      <PageHeader
        title="Что будем проектировать?"
        description="Выберите отправную точку. Architect OLNOO адаптирует бриф и рабочий процесс под вашу задачу."
      />
      <p className="text-xs font-medium uppercase tracking-[0.16em] text-accent">Новый проект · шаг 1 из 4</p>
      <div className="grid gap-4 sm:grid-cols-2">
        {projectTypes.map(({ icon: Icon, title, description }, index) => (
          <button key={title} type="button" className={`rounded-2xl border p-5 text-left transition-colors hover:border-accent/50 ${index === 0 ? "border-accent/60 bg-[#fffaf8]" : "border-border bg-surface"}`}>
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-surface-soft text-ink-secondary"><Icon className="h-5 w-5" strokeWidth={1.5} /></span>
            <span className="mt-5 block font-medium text-ink">{title}</span>
            <span className="mt-2 block text-sm leading-5 text-ink-secondary">{description}</span>
          </button>
        ))}
      </div>
      <div className="flex justify-end"><Link href="/projects/dom-na-valdae" className="inline-flex items-center gap-2 rounded-full bg-accent px-5 py-2.5 text-sm font-medium text-white">Продолжить <ArrowRight className="h-4 w-4" /></Link></div>
    </div>
  );
}
