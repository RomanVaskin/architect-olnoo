"use client";

import { useMemo, useRef, useState, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  Check,
  FileImage,
  FileText,
  Home,
  Map,
  Trash2,
  Upload,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { GenerationMode } from "@/lib/types";
import { createDraftProject, saveGeneratedConcepts } from "@/lib/mvp-local-project-store";
import { GenerationConfirmDialog } from "@/components/projects/generation-confirm-dialog";
import { MAX_TOTAL_INLINE_IMAGE_BYTES, formatCombinedImageSizeError } from "@/lib/ai/request-validation";
import {
  MAX_GENERATION_IMAGES,
  fileKey,
  isRasterImage,
  reconcileGenerationSelection,
  toggleGenerationSelection,
} from "@/lib/wizard-generation-selection";

const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
const MAX_FILE_SIZE = 20 * 1024 * 1024;
const MAX_FILES = 12;

const projectTypes = [
  {
    id: "existing-house",
    icon: Home,
    title: "Изменить существующий дом",
    description: "Загрузить фотографии или чертежи и сохранить исходную геометрию.",
    available: true,
  },
  {
    id: "new-house",
    icon: Building2,
    title: "Спроектировать новый дом",
    description: "Начать с участка, требований и архитектурного направления.",
    available: false,
  },
  {
    id: "settlement",
    icon: Map,
    title: "Спланировать посёлок",
    description: "Разработать мастер-план, участки и общую инфраструктуру.",
    available: false,
  },
  {
    id: "import",
    icon: Upload,
    title: "Импортировать проект",
    description: "Продолжить работу с PDF, чертежами или существующей BIM-моделью.",
    available: false,
  },
] as const;

const steps = ["Тип проекта", "Материалы", "Пожелания", "Ограничения"];

const DEFAULT_MUST_KEEP = ["Геометрия и основные пропорции", "Форма и уклон крыши", "Положение окон и дверей"];
const DEFAULT_MAY_CHANGE = ["Материалы фасада", "Цветовая палитра", "Наружное освещение"];

interface GenerateVariantResponse {
  status: "succeeded" | "failed";
  mode: string;
  mimeType?: string;
  imageBase64?: string;
  warnings: string[];
  error?: { code: string; message: string };
}

function formatFileSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.ceil(bytes / 1024)} КБ`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} МБ`;
}

const CONCEPT_LABELS = ["A", "B", "C"];

export function NewProjectWizard() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const [step, setStep] = useState(0);
  const [projectType, setProjectType] = useState("existing-house");
  const [files, setFiles] = useState<File[]>([]);
  const [fileError, setFileError] = useState("");
  const [projectName, setProjectName] = useState("");
  const [location, setLocation] = useState("");
  const [goal, setGoal] = useState("");
  const [mustKeep, setMustKeep] = useState(DEFAULT_MUST_KEEP);
  const [mayChange, setMayChange] = useState(DEFAULT_MAY_CHANGE);
  const [explicitChanges, setExplicitChanges] = useState("");

  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [mode, setMode] = useState<GenerationMode>("auto");
  const [variantCount, setVariantCount] = useState<1 | 3>(1);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [generationKeys, setGenerationKeys] = useState<string[]>([]);

  const rasterFiles = useMemo(() => files.filter(isRasterImage), [files]);
  const generationFiles = useMemo(
    () => rasterFiles.filter((file) => generationKeys.includes(fileKey(file))),
    [rasterFiles, generationKeys],
  );
  const generationBytes = useMemo(() => generationFiles.reduce((sum, file) => sum + file.size, 0), [generationFiles]);

  const canContinue = useMemo(() => {
    if (step === 0) return projectType === "existing-house";
    if (step === 1) return files.length > 0;
    if (step === 2) return projectName.trim().length > 1 && goal.trim().length > 15;
    return mustKeep.length > 0 && explicitChanges.trim().length > 5;
  }, [explicitChanges, files.length, goal, mustKeep.length, projectName, projectType, step]);

  function addFiles(event: ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(event.target.files ?? []);
    const invalidType = selected.find((file) => !ACCEPTED_TYPES.includes(file.type));
    const invalidSize = selected.find((file) => file.size > MAX_FILE_SIZE);

    if (invalidType) {
      setFileError(`Файл «${invalidType.name}» имеет неподдерживаемый формат.`);
      event.target.value = "";
      return;
    }
    if (invalidSize) {
      setFileError(`Файл «${invalidSize.name}» больше 20 МБ.`);
      event.target.value = "";
      return;
    }

    const unique = [...files, ...selected].filter(
      (file, index, all) => all.findIndex((candidate) => candidate.name === file.name && candidate.size === file.size) === index,
    );
    if (unique.length > MAX_FILES) {
      setFileError(`Можно загрузить не более ${MAX_FILES} файлов.`);
      event.target.value = "";
      return;
    }

    setFiles(unique);
    setGenerationKeys((prev) => reconcileGenerationSelection(unique, prev));
    setFileError("");
    event.target.value = "";
  }

  function removeFile(file: File) {
    const next = files.filter((item) => item !== file);
    setFiles(next);
    setGenerationKeys((prev) => reconcileGenerationSelection(next, prev));
  }

  function toggleGeneration(file: File) {
    setGenerationKeys((prev) => toggleGenerationSelection(prev, fileKey(file)));
  }

  function toggleConstraint(value: string, group: "must" | "may") {
    const list = group === "must" ? mustKeep : mayChange;
    const setList = group === "must" ? setMustKeep : setMayChange;
    setList(list.includes(value) ? list.filter((item) => item !== value) : [...list, value]);
  }

  function continueFlow() {
    if (!canContinue) return;
    if (step < steps.length - 1) {
      setStep(step + 1);
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    if (generationFiles.length === 0) {
      setFileError("Для генерации нужна хотя бы одна выбранная фотография в формате JPEG, PNG или WebP (PDF пока не поддерживается моделью).");
      setStep(1);
      return;
    }
    setGenerationError(null);
    setShowConfirmDialog(true);
  }

  function cancelGeneration() {
    abortControllerRef.current?.abort();
  }

  async function confirmAndGenerate() {
    if (isGenerating) return; // guard against duplicate submissions
    if (generationBytes > MAX_TOTAL_INLINE_IMAGE_BYTES) {
      setGenerationError(formatCombinedImageSizeError(generationBytes));
      return;
    }
    setIsGenerating(true);
    setGenerationError(null);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const formData = new FormData();
      generationFiles.forEach((file) => formData.append("images", file));
      formData.append("goal", goal);
      formData.append("explicitChanges", explicitChanges);
      formData.append("mustKeep", JSON.stringify(mustKeep));
      formData.append("mayChange", JSON.stringify(mayChange));
      formData.append("mode", mode);
      formData.append("variantCount", String(variantCount));

      const response = await fetch("/api/concepts/generate", {
        method: "POST",
        body: formData,
        signal: controller.signal,
      });

      const payload = await response.json();

      if (!response.ok) {
        setGenerationError(payload?.error?.message ?? "Не удалось сгенерировать концепции. Попробуйте ещё раз.");
        return;
      }

      const variants = (payload.variants ?? []) as GenerateVariantResponse[];
      const succeeded = variants.filter((variant) => variant.status === "succeeded" && variant.imageBase64);

      if (succeeded.length === 0) {
        const firstError = variants.find((variant) => variant.error)?.error?.message;
        setGenerationError(firstError ?? "Не удалось сгенерировать ни одной концепции. Попробуйте ещё раз.");
        return;
      }

      const generatedConcepts = await Promise.all(
        succeeded.map(async (variant, index) => {
          const blob = await (await fetch(`data:${variant.mimeType};base64,${variant.imageBase64}`)).blob();
          return {
            label: `Концепция ${CONCEPT_LABELS[index] ?? index + 1}`,
            summary: goal.trim(),
            changeExplanation: explicitChanges.trim() || goal.trim(),
            blob,
            mimeType: variant.mimeType ?? "image/png",
            mode: variant.mode as GenerationMode,
            warnings: variant.warnings,
          };
        }),
      );

      const projectId = await createDraftProject({
        name: projectName.trim(),
        buildingType: "Частный дом",
        site: {
          address: location.trim() || "Не указано",
          climateZone: "Не указано",
          areaSqm: 0,
        },
        brief: {
          goal: goal.trim(),
          mustKeep,
          mayChange,
          wantsChanged: explicitChanges.trim() ? [explicitChanges.trim()] : [],
        },
        sourceFiles: files.map((file) => ({
          name: file.name,
          kind: file.type === "application/pdf" ? "document" : "photo",
        })),
      });

      await saveGeneratedConcepts(projectId, generatedConcepts);

      const partial = succeeded.length < variants.length ? "&partial=1" : "";
      router.push(`/projects/${projectId}/concepts?generated=1${partial}`);
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        setGenerationError("Генерация отменена. Данные брифа сохранены — можно запустить снова.");
      } else {
        setGenerationError("Не удалось связаться с сервером генерации. Проверьте подключение и попробуйте снова.");
      }
    } finally {
      setIsGenerating(false);
      abortControllerRef.current = null;
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-8">
      <div>
        <p className="text-xs font-medium uppercase tracking-[0.14em] text-action">
          Новый проект · шаг {step + 1} из {steps.length}
        </p>
        <div className="mt-4 grid grid-cols-4 gap-2" aria-label="Прогресс создания проекта">
          {steps.map((label, index) => (
            <div key={label}>
              <div className={cn("h-1 rounded-full", index <= step ? "bg-action" : "bg-border")} />
              <p className={cn("mt-2 hidden text-xs sm:block", index === step ? "text-ink" : "text-ink-secondary")}>{label}</p>
            </div>
          ))}
        </div>
      </div>

      {step === 0 ? (
        <section aria-labelledby="project-type-title">
          <h1 id="project-type-title" className="text-3xl font-semibold tracking-tight text-ink sm:text-4xl">Что будем проектировать?</h1>
          <p className="mt-2 max-w-2xl text-sm text-ink-secondary sm:text-base">Выберите отправную точку. Первый MVP работает с изменением существующего дома.</p>
          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            {projectTypes.map(({ id, icon: Icon, title, description, available }) => {
              const selected = projectType === id;
              return (
                <button
                  key={id}
                  type="button"
                  disabled={!available}
                  onClick={() => setProjectType(id)}
                  className={cn(
                    "relative rounded-2xl border p-5 text-left transition-colors",
                    selected ? "border-accent/60 bg-accent-soft" : "border-border bg-surface",
                    available ? "hover:border-accent/50" : "cursor-not-allowed opacity-55",
                  )}
                >
                  <span className="flex items-start justify-between gap-4">
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-surface-soft text-ink-secondary"><Icon className="h-5 w-5" strokeWidth={1.5} /></span>
                    {available ? <span className="flex h-6 w-6 items-center justify-center rounded-full bg-action text-action-ink"><Check className="h-3.5 w-3.5" /></span> : <span className="rounded-full bg-surface-soft px-2.5 py-1 text-[11px] text-ink-secondary">Позже</span>}
                  </span>
                  <span className="mt-5 block font-medium text-ink">{title}</span>
                  <span className="mt-2 block text-sm leading-5 text-ink-secondary">{description}</span>
                </button>
              );
            })}
          </div>
        </section>
      ) : null}

      {step === 1 ? (
        <section aria-labelledby="source-files-title">
          <h1 id="source-files-title" className="text-3xl font-semibold tracking-tight text-ink sm:text-4xl">Добавьте исходные материалы</h1>
          <p className="mt-2 max-w-2xl text-sm text-ink-secondary sm:text-base">Начните с фотографии главного фасада. Дополнительно можно приложить другие ракурсы и PDF-чертежи.</p>
          <p className="mt-2 max-w-2xl text-xs text-ink-secondary">
            PDF-файлы сохраняются в проекте, но пока не передаются в модель генерации изображений — для генерации нужна хотя бы одна фотография в формате JPEG, PNG или WebP.
          </p>
          <input ref={inputRef} id="source-files" type="file" multiple accept="image/jpeg,image/png,image/webp,application/pdf" onChange={addFiles} className="sr-only" />
          <button type="button" onClick={() => inputRef.current?.click()} className="mt-8 flex min-h-56 w-full flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-surface px-6 text-center transition-colors hover:border-accent/60 hover:bg-accent-soft">
            <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-surface-soft text-ink-secondary"><Upload className="h-5 w-5" strokeWidth={1.5} /></span>
            <span className="mt-4 font-medium text-ink">Выбрать фотографии или PDF</span>
            <span className="mt-2 text-sm text-ink-secondary">JPG, PNG, WebP или PDF · до 20 МБ · максимум 12 файлов</span>
          </button>
          {fileError ? <p role="alert" className="mt-3 text-sm text-action">{fileError}</p> : null}
          {rasterFiles.length > MAX_GENERATION_IMAGES ? (
            <p className="mt-3 rounded-xl border border-border bg-surface-soft px-4 py-3 text-sm text-ink-secondary">
              Для одной генерации можно использовать не более {MAX_GENERATION_IMAGES} фотографий — отмечено {generationFiles.length} из {MAX_GENERATION_IMAGES}. Остальные фотографии останутся в проекте как материалы, но не будут отправлены в модель.
            </p>
          ) : null}
          {generationBytes > MAX_TOTAL_INLINE_IMAGE_BYTES ? (
            <p role="alert" className="mt-3 text-sm text-action">{formatCombinedImageSizeError(generationBytes)}</p>
          ) : null}
          {files.length > 0 ? (
            <div className="mt-5 divide-y divide-border rounded-2xl border border-border">
              {files.map((file) => {
                const showGenerationToggle = isRasterImage(file) && rasterFiles.length > MAX_GENERATION_IMAGES;
                const isSelectedForGeneration = generationKeys.includes(fileKey(file));
                return (
                  <div key={fileKey(file)} className="flex items-center gap-3 px-4 py-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-surface-soft text-ink-secondary">{file.type === "application/pdf" ? <FileText className="h-4 w-4" /> : <FileImage className="h-4 w-4" />}</span>
                    <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium text-ink">{file.name}</span><span className="text-xs text-ink-secondary">{formatFileSize(file.size)}</span></span>
                    {showGenerationToggle ? (
                      <label className="flex shrink-0 items-center gap-2 text-xs text-ink-secondary">
                        <input
                          type="checkbox"
                          checked={isSelectedForGeneration}
                          disabled={!isSelectedForGeneration && generationKeys.length >= MAX_GENERATION_IMAGES}
                          onChange={() => toggleGeneration(file)}
                          className="h-4 w-4 accent-[var(--color-action)]"
                        />
                        Для генерации
                      </label>
                    ) : null}
                    <button type="button" onClick={() => removeFile(file)} aria-label={`Удалить ${file.name}`} className="flex h-9 w-9 items-center justify-center rounded-full text-ink-secondary hover:bg-surface-soft hover:text-ink"><Trash2 className="h-4 w-4" /></button>
                  </div>
                );
              })}
            </div>
          ) : null}
        </section>
      ) : null}

      {step === 2 ? (
        <section aria-labelledby="project-brief-title">
          <h1 id="project-brief-title" className="text-3xl font-semibold tracking-tight text-ink sm:text-4xl">Опишите желаемый результат</h1>
          <p className="mt-2 max-w-2xl text-sm text-ink-secondary sm:text-base">Пишите обычными словами. Architect OLNOO самостоятельно сформирует рабочий бриф.</p>
          <div className="mt-8 grid gap-6">
            <label className="grid gap-2 text-sm font-medium text-ink">Название проекта<input value={projectName} onChange={(event) => setProjectName(event.target.value)} placeholder="Например, Дом у озера" className="rounded-xl border border-border bg-surface px-4 py-3 font-normal outline-none placeholder:text-ink-secondary focus:border-ink/30" /></label>
            <label className="grid gap-2 text-sm font-medium text-ink">Местоположение <span className="font-normal text-ink-secondary">(необязательно)</span><input value={location} onChange={(event) => setLocation(event.target.value)} placeholder="Город, регион или климатическая зона" className="rounded-xl border border-border bg-surface px-4 py-3 font-normal outline-none placeholder:text-ink-secondary focus:border-ink/30" /></label>
            <label className="grid gap-2 text-sm font-medium text-ink">Что вы хотите получить?<textarea value={goal} onChange={(event) => setGoal(event.target.value)} placeholder="Например: сделать фасад светлее и современнее в скандинавском стиле, сохранив площадь и расположение окон" className="min-h-36 resize-y rounded-xl border border-border bg-surface px-4 py-3 font-normal leading-6 outline-none placeholder:text-ink-secondary focus:border-ink/30" /></label>
          </div>
        </section>
      ) : null}

      {step === 3 ? (
        <section aria-labelledby="constraints-title">
          <h1 id="constraints-title" className="text-3xl font-semibold tracking-tight text-ink sm:text-4xl">Зафиксируйте ограничения</h1>
          <p className="mt-2 max-w-2xl text-sm text-ink-secondary sm:text-base">По умолчанию Architect OLNOO сохраняет геометрию существующего дома. Вы можете уточнить правила до запуска.</p>
          <div className="mt-8 grid gap-5 sm:grid-cols-2">
            <fieldset className="rounded-2xl border border-border p-5"><legend className="px-2 text-sm font-medium text-ink">Обязательно сохранить</legend><div className="mt-2 grid gap-3">{DEFAULT_MUST_KEEP.map((item) => <label key={item} className="flex items-start gap-3 text-sm text-ink"><input type="checkbox" checked={mustKeep.includes(item)} onChange={() => toggleConstraint(item, "must")} className="mt-0.5 h-4 w-4 accent-[var(--color-action)]" /><span>{item}</span></label>)}</div></fieldset>
            <fieldset className="rounded-2xl border border-border p-5"><legend className="px-2 text-sm font-medium text-ink">Можно изменить</legend><div className="mt-2 grid gap-3">{DEFAULT_MAY_CHANGE.map((item) => <label key={item} className="flex items-start gap-3 text-sm text-ink"><input type="checkbox" checked={mayChange.includes(item)} onChange={() => toggleConstraint(item, "may")} className="mt-0.5 h-4 w-4 accent-[var(--color-action)]" /><span>{item}</span></label>)}</div></fieldset>
          </div>
          <label className="mt-6 grid gap-2 text-sm font-medium text-ink">Что нужно изменить обязательно?<textarea value={explicitChanges} onChange={(event) => setExplicitChanges(event.target.value)} placeholder="Например: заменить облицовочный кирпич светлой штукатуркой и добавить деревянные панели" className="min-h-28 resize-y rounded-xl border border-border bg-surface px-4 py-3 font-normal leading-6 outline-none placeholder:text-ink-secondary focus:border-ink/30" /></label>
          <div className="mt-6 rounded-2xl bg-surface-soft p-5"><p className="text-sm font-medium text-ink">После запуска</p><p className="mt-1 text-sm leading-6 text-ink-secondary">AI проанализирует {files.length} {files.length === 1 ? "файл" : "файлов"}, зафиксирует ограничения и подготовит несколько вариантов концепции. Источники и принятые решения сохранятся в проекте.</p></div>
        </section>
      ) : null}

      <div className="flex items-center justify-between border-t border-border pt-6">
        <Button variant="ghost" type="button" onClick={() => step === 0 ? router.push("/projects") : setStep(step - 1)}><ArrowLeft className="h-4 w-4" />{step === 0 ? "К проектам" : "Назад"}</Button>
        <div className="text-right">
          {!canContinue ? <p className="mb-2 text-xs text-ink-secondary">{step === 1 ? "Добавьте хотя бы один файл" : step === 2 ? "Заполните название и подробно опишите цель" : step === 3 ? "Укажите обязательное изменение" : ""}</p> : null}
          <Button type="button" disabled={!canContinue} onClick={continueFlow}>{step === steps.length - 1 ? "Создать проект" : "Продолжить"}<ArrowRight className="h-4 w-4" /></Button>
        </div>
      </div>

      {showConfirmDialog ? (
        <GenerationConfirmDialog
          fileCount={generationFiles.length}
          mode={mode}
          onModeChange={setMode}
          variantCount={variantCount}
          onVariantCountChange={setVariantCount}
          isGenerating={isGenerating}
          error={generationError}
          onConfirm={confirmAndGenerate}
          onCancelGeneration={cancelGeneration}
          onClose={() => setShowConfirmDialog(false)}
        />
      ) : null}
    </div>
  );
}
