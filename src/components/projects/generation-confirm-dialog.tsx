"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { GENERATION_MODE_LABELS, type GenerationMode } from "@/lib/types";
import { useBlobUrl } from "@/lib/use-blob-url";

const MODES: GenerationMode[] = ["auto", "fast", "balanced", "maximum-quality"];
const VARIANT_COUNTS = [1, 3] as const;

interface RecoveryConcept {
  key: string;
  label: string;
  blob: Blob;
  mimeType: string;
}

function extensionForMimeType(mimeType: string): string {
  if (mimeType === "image/jpeg") return "jpg";
  if (mimeType === "image/webp") return "webp";
  return "png";
}

function ConceptDownloadLink({ concept }: { concept: RecoveryConcept }) {
  const url = useBlobUrl(concept.blob);
  return (
    <a
      href={url}
      download={`${concept.label.replace(/\s+/g, "-")}.${extensionForMimeType(concept.mimeType)}`}
      className="inline-flex items-center gap-2 rounded-xl border border-border bg-surface px-3 py-1.5 text-xs font-medium text-ink transition-colors hover:bg-surface-soft"
    >
      Скачать «{concept.label}»
    </a>
  );
}

interface GenerationConfirmDialogProps {
  fileCount: number;
  mode: GenerationMode;
  onModeChange: (mode: GenerationMode) => void;
  variantCount: 1 | 3;
  onVariantCountChange: (count: 1 | 3) => void;
  isGenerating: boolean;
  error: string | null;
  onConfirm: () => void;
  onCancelGeneration: () => void;
  onClose: () => void;
  persistenceFailed: boolean;
  isRetryingSave: boolean;
  recoveryConcepts: RecoveryConcept[];
  onRetrySave: () => void;
  attemptId: string | null;
  draftProjectId: string | null;
  ambiguousFailure: boolean;
  acknowledgedAmbiguous: boolean;
  onAcknowledgeAmbiguousChange: (acknowledged: boolean) => void;
}

export function GenerationConfirmDialog({
  fileCount,
  mode,
  onModeChange,
  variantCount,
  onVariantCountChange,
  isGenerating,
  error,
  onConfirm,
  onCancelGeneration,
  onClose,
  persistenceFailed,
  isRetryingSave,
  recoveryConcepts,
  onRetrySave,
  attemptId,
  draftProjectId,
  ambiguousFailure,
  acknowledgedAmbiguous,
  onAcknowledgeAmbiguousChange,
}: GenerationConfirmDialogProps) {
  const controlsDisabled = isGenerating || persistenceFailed;
  const confirmBlockedByAmbiguity = ambiguousFailure && !acknowledgedAmbiguous;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4" role="dialog" aria-modal="true" aria-labelledby="generation-dialog-title">
      <div className="w-full max-w-lg rounded-2xl border border-border bg-surface p-6 shadow-xl">
        <h2 id="generation-dialog-title" className="text-lg font-semibold text-ink">
          Подтвердите генерацию концепций
        </h2>
        <p className="mt-2 text-sm leading-6 text-ink-secondary">
          Генерация использует платный внешний AI-сервис и обработает {fileCount} {fileCount === 1 ? "изображение" : "изображения"}.
          Результат — концептуальная визуализация; геометрия дома не проверяется автоматически (проверка специалиста потребуется отдельно).
        </p>
        <p className="mt-2 text-xs leading-5 text-ink-secondary">
          Черновик проекта сохраняется локально в начале процесса, до отправки платного запроса. Если генерацию отменить в браузере,
          запрос к AI-провайдеру мог уже уйти — отмена не гарантирует, что оплата не будет выставлена.
        </p>

        <div className="mt-5">
          <p className="text-sm font-medium text-ink">Режим генерации</p>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {MODES.map((item) => (
              <button
                key={item}
                type="button"
                disabled={controlsDisabled}
                onClick={() => onModeChange(item)}
                className={cn(
                  "rounded-xl border px-3 py-2 text-left text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-50",
                  mode === item ? "border-accent/60 bg-accent-soft text-ink" : "border-border text-ink-secondary hover:border-accent/40",
                )}
              >
                {GENERATION_MODE_LABELS[item]}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-5">
          <p className="text-sm font-medium text-ink">Количество вариантов</p>
          <div className="mt-2 flex gap-2">
            {VARIANT_COUNTS.map((count) => (
              <button
                key={count}
                type="button"
                disabled={controlsDisabled}
                onClick={() => onVariantCountChange(count)}
                className={cn(
                  "rounded-xl border px-4 py-2 text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-50",
                  variantCount === count ? "border-accent/60 bg-accent-soft text-ink" : "border-border text-ink-secondary hover:border-accent/40",
                )}
              >
                {count} {count === 1 ? "вариант" : "варианта"}
              </button>
            ))}
          </div>
        </div>

        {isGenerating ? (
          <div className="mt-5 flex items-center gap-3 rounded-xl border border-border bg-surface-soft p-4">
            <span className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-border border-t-action" />
            <p className="text-sm text-ink-secondary">Генерация концепций… это может занять минуту.</p>
          </div>
        ) : null}

        {error ? (
          <p role="alert" className="mt-4 text-sm text-action">
            {error}
          </p>
        ) : null}

        {draftProjectId && !isGenerating && (error || persistenceFailed) ? (
          <div className="mt-3 flex flex-wrap items-center gap-3 rounded-xl border border-border bg-surface-soft px-4 py-3">
            <p className="text-xs text-ink-secondary">
              Черновик проекта сохранён{attemptId ? ` · ID попытки генерации: ${attemptId}` : ""}. Доступ к нему не теряется.
            </p>
            <Link
              href={`/projects/${draftProjectId}`}
              className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-border bg-surface px-3 py-1.5 text-xs font-medium text-ink transition-colors hover:bg-surface-soft"
            >
              Открыть сохранённый черновик
            </Link>
          </div>
        ) : null}

        {ambiguousFailure ? (
          <label className="mt-3 flex items-start gap-3 rounded-xl border border-border bg-surface-soft p-4 text-sm text-ink-secondary">
            <input
              type="checkbox"
              checked={acknowledgedAmbiguous}
              onChange={(event) => onAcknowledgeAmbiguousChange(event.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--color-action)]"
            />
            <span>
              Я проверил(а) статус этой попытки и подтверждаю запуск новой платной генерации, даже если предыдущий запрос уже был
              принят провайдером.
            </span>
          </label>
        ) : null}

        {persistenceFailed ? (
          <div className="mt-4 rounded-xl border border-border bg-surface-soft p-4">
            <p className="text-sm font-medium text-action">Оплаченная генерация завершена — не запускайте её повторно</p>
            <p className="mt-1 text-sm leading-6 text-ink-secondary">
              Изображения уже получены и оплачены, но локально сохранить их пока не удалось. Скачайте нужные варианты на устройство
              и повторите только сохранение — новый запрос к AI-провайдеру отправляться не будет. Пока страница открыта, изображения
              остаются в памяти вкладки; при перезагрузке страницы они будут потеряны, если их не скачать или не сохранить.
            </p>
            {recoveryConcepts.length > 0 ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {recoveryConcepts.map((concept) => (
                  <ConceptDownloadLink key={concept.key} concept={concept} />
                ))}
              </div>
            ) : null}
          </div>
        ) : null}

        <div className="mt-6 flex items-center justify-end gap-2">
          {isGenerating ? (
            <Button type="button" variant="secondary" onClick={onCancelGeneration}>
              Отменить генерацию
            </Button>
          ) : persistenceFailed ? (
            <>
              <Button type="button" variant="ghost" onClick={onClose}>
                Закрыть
              </Button>
              <Button type="button" onClick={onRetrySave} disabled={isRetryingSave}>
                {isRetryingSave ? "Повторное сохранение…" : "Повторить сохранение"}
              </Button>
            </>
          ) : (
            <>
              <Button type="button" variant="ghost" onClick={onClose}>
                Отмена
              </Button>
              <Button type="button" onClick={onConfirm} disabled={confirmBlockedByAmbiguity}>
                Начать генерацию
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
