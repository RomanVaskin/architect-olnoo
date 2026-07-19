"use client";

import { useCallback, useMemo, useRef, useState, type ChangeEvent } from "react";
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
import type { GenerationMode, SourceImageDimensions } from "@/lib/types";
import {
  createDraftProject,
  createGenerationAttempt,
  saveGeneratedConcept,
  type DraftProjectInput,
} from "@/lib/mvp-local-project-store";
import { GenerationConfirmDialog } from "@/components/projects/generation-confirm-dialog";
import { SourceViewsStep, type ConfirmedSourceView, type SourceViewsChange } from "@/components/projects/source-views-step";
import { MAX_TOTAL_INLINE_IMAGE_BYTES, formatCombinedImageSizeError } from "@/lib/ai/request-validation";
import { requestAndDecodeConcepts, reuseOrCreateDraft, extractRecoveryState, GenerationFlowError } from "@/lib/concept-generation-flow";
import { persistConceptsIndividually, type PersistableConcept } from "@/lib/concept-persistence";
import { logGenerationDiagnostic } from "@/lib/generation-diagnostics";
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

const steps = ["Тип проекта", "Материалы", "Ракурсы", "Пожелания", "Ограничения"];

const DEFAULT_MUST_KEEP = ["Геометрия и основные пропорции", "Форма и уклон крыши", "Положение окон и дверей"];
const DEFAULT_MAY_CHANGE = ["Материалы фасада", "Цветовая палитра", "Наружное освещение"];

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

  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [draftProjectId, setDraftProjectId] = useState<string | null>(null);
  const [pendingConcepts, setPendingConcepts] = useState<PersistableConcept[]>([]);
  const [persistedKeys, setPersistedKeys] = useState<string[]>([]);
  const [persistenceFailed, setPersistenceFailed] = useState(false);
  const [isRetryingSave, setIsRetryingSave] = useState(false);
  const [requiresRetryAcknowledgement, setRequiresRetryAcknowledgement] = useState(false);
  const [retryAcknowledged, setRetryAcknowledged] = useState(false);

  const [confirmedSourceViews, setConfirmedSourceViews] = useState<ConfirmedSourceView[]>([]);
  const [sourceDimensions, setSourceDimensions] = useState<Record<string, SourceImageDimensions>>({});
  const handleSourceViewsChange = useCallback((change: SourceViewsChange) => {
    setConfirmedSourceViews(change.views);
    setSourceDimensions(change.dimensionsByFileKey);
  }, []);

  const rasterFiles = useMemo(() => files.filter(isRasterImage), [files]);
  const generationFiles = useMemo(
    () => rasterFiles.filter((file) => generationKeys.includes(fileKey(file))),
    [rasterFiles, generationKeys],
  );
  const generationBytes = useMemo(() => generationFiles.reduce((sum, file) => sum + file.size, 0), [generationFiles]);

  const canContinue = useMemo(() => {
    if (step === 0) return projectType === "existing-house";
    if (step === 1) return files.length > 0;
    if (step === 2) return true; // Source Views is a review step — nothing is required to move past it
    if (step === 3) return projectName.trim().length > 1 && goal.trim().length > 15;
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

  /** Persists successful variants one at a time; on partial failure, keeps them in state for recovery instead of navigating away. */
  async function persistAndProceed(attempt: string, projectId: string, concepts: PersistableConcept[], partial: boolean) {
    const result = await persistConceptsIndividually(
      { persistConcept: saveGeneratedConcept, onDiagnostic: logGenerationDiagnostic },
      attempt,
      projectId,
      concepts,
    );
    setPersistedKeys(result.persistedKeys);

    if (result.failedKeys.length > 0) {
      setPersistenceFailed(true);
      setGenerationError(
        "Платная генерация завершена и изображения получены, но сохранить часть концепций в этом браузере не удалось. Не запускайте генерацию заново — скачайте изображения ниже и повторите сохранение, когда будете готовы.",
      );
      return;
    }

    router.push(`/projects/${projectId}/concepts?generated=1${partial ? "&partial=1" : ""}`);
  }

  async function confirmAndGenerate() {
    if (isGenerating || persistenceFailed) return; // guard against duplicate submissions and re-billing after a lost save
    if (requiresRetryAcknowledgement && !retryAcknowledged) return; // an unresolved risky-retry failure must be acknowledged first
    if (generationBytes > MAX_TOTAL_INLINE_IMAGE_BYTES) {
      setGenerationError(formatCombinedImageSizeError(generationBytes));
      return;
    }
    setIsGenerating(true);
    setGenerationError(null);
    setPendingConcepts([]);
    setPersistedKeys([]);
    setRequiresRetryAcknowledgement(false);
    setRetryAcknowledged(false);

    const controller = new AbortController();
    abortControllerRef.current = controller;
    let currentAttemptId: string | null = null;

    // Reused verbatim if a draft project already exists for this wizard session (see persistDraft below) —
    // only used to create a brand new draft on the very first attempt.
    const draftInput: DraftProjectInput = {
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
        hasImage: isRasterImage(file),
        mimeType: file.type,
        dimensions: sourceDimensions[fileKey(file)],
        file: isRasterImage(file) ? file : undefined,
      })),
      sourceViews: confirmedSourceViews.map((view) => ({
        sourceFileIndex: files.findIndex((file) => fileKey(file) === view.fileKey),
        crop: view.crop,
        order: view.order,
        role: view.role,
        isPrimary: view.isPrimary,
      })),
    };

    try {
      const result = await requestAndDecodeConcepts(
        {
          // Reuse the draft created by an earlier attempt in this session instead of creating a new one on every retry.
          persistDraft: () => reuseOrCreateDraft(draftProjectId, () => createDraftProject(draftInput)),
          persistAttempt: (projectId, attempt) => createGenerationAttempt(projectId, attempt),
          requestGeneration: (signal) => {
            const formData = new FormData();
            generationFiles.forEach((file) => formData.append("images", file));
            formData.append("goal", goal);
            formData.append("explicitChanges", explicitChanges);
            formData.append("mustKeep", JSON.stringify(mustKeep));
            formData.append("mayChange", JSON.stringify(mayChange));
            formData.append("mode", mode);
            formData.append("variantCount", String(variantCount));
            return fetch("/api/concepts/generate", { method: "POST", body: formData, signal });
          },
          onDiagnostic: logGenerationDiagnostic,
        },
        controller.signal,
      );

      currentAttemptId = result.attemptId;
      setAttemptId(result.attemptId);
      setDraftProjectId(result.projectId);

      const concepts: PersistableConcept[] = result.decoded.map((variant, index) => ({
        ...variant,
        label: `Концепция ${CONCEPT_LABELS[index] ?? index + 1}`,
        summary: goal.trim(),
        changeExplanation: explicitChanges.trim() || goal.trim(),
      }));
      setPendingConcepts(concepts);

      await persistAndProceed(result.attemptId, result.projectId, concepts, result.partial);
    } catch (error) {
      if (error instanceof GenerationFlowError) {
        // requestAndDecodeConcepts already logged a safe diagnostic for this stage
        // (including for a wrapped AbortError — cancellation is never rethrown raw).
        // Keep the draft reachable — it exists whenever the error carries a projectId.
        const recovery = extractRecoveryState(error);
        if (recovery?.attemptId) setAttemptId(recovery.attemptId);
        if (recovery?.projectId) setDraftProjectId(recovery.projectId);
        setRequiresRetryAcknowledgement(recovery?.requiresAcknowledgement ?? false);
        setGenerationError(recovery?.message ?? error.message);
      } else {
        logGenerationDiagnostic(currentAttemptId ?? "unknown", "unknown", error);
        setGenerationError(
          "Не удалось выполнить запрос генерации из-за непредвиденной ошибки браузера. Проверьте консоль диагностики, прежде чем запускать генерацию снова.",
        );
      }
    } finally {
      setIsGenerating(false);
      abortControllerRef.current = null;
    }
  }

  async function retrySave() {
    if (!attemptId || !draftProjectId || isRetryingSave) return;
    const pending = pendingConcepts.filter((concept) => !persistedKeys.includes(concept.key));
    if (pending.length === 0) {
      router.push(`/projects/${draftProjectId}/concepts?generated=1`);
      return;
    }

    setIsRetryingSave(true);
    setGenerationError(null);
    try {
      // persistConceptsIndividually only ever calls persistConcept (IndexedDB) — it has no
      // dependency capable of reaching /api/concepts/generate, so this can never re-bill.
      const result = await persistConceptsIndividually(
        { persistConcept: saveGeneratedConcept, onDiagnostic: logGenerationDiagnostic },
        attemptId,
        draftProjectId,
        pending,
      );
      setPersistedKeys((prev) => [...prev, ...result.persistedKeys]);

      if (result.failedKeys.length > 0) {
        setGenerationError(
          "Повторное сохранение снова не удалось для части концепций. Изображения остаются доступны для скачивания ниже — оплата уже выполнена, поэтому просто повторите сохранение позже.",
        );
        return;
      }

      setPersistenceFailed(false);
      router.push(`/projects/${draftProjectId}/concepts?generated=1`);
    } finally {
      setIsRetryingSave(false);
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
        <section aria-labelledby="source-views-title">
          <h1 id="source-views-title" className="text-3xl font-semibold tracking-tight text-ink sm:text-4xl">Проверьте ракурсы</h1>
          <p className="mt-2 max-w-2xl text-sm text-ink-secondary sm:text-base">
            Если одна фотография на самом деле содержит несколько видов дома, поставленных друг над другом (коллаж), Architect OLNOO
            предложит разделить её на отдельные ракурсы для проверки.
          </p>
          <SourceViewsStep files={files} onChange={handleSourceViewsChange} />
        </section>
      ) : null}

      {step === 3 ? (
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

      {step === 4 ? (
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
          {!canContinue ? <p className="mb-2 text-xs text-ink-secondary">{step === 1 ? "Добавьте хотя бы один файл" : step === 3 ? "Заполните название и подробно опишите цель" : step === 4 ? "Укажите обязательное изменение" : ""}</p> : null}
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
          persistenceFailed={persistenceFailed}
          isRetryingSave={isRetryingSave}
          recoveryConcepts={pendingConcepts}
          onRetrySave={retrySave}
          attemptId={attemptId}
          draftProjectId={draftProjectId}
          requiresRetryAcknowledgement={requiresRetryAcknowledgement}
          retryAcknowledged={retryAcknowledged}
          onRetryAcknowledgedChange={setRetryAcknowledged}
        />
      ) : null}
    </div>
  );
}
