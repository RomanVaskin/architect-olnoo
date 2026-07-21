"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useDialogA11y } from "@/lib/use-dialog-a11y";
import { GENERATION_MODE_LABELS, type GenerationMode } from "@/lib/types";

const MODES: GenerationMode[] = ["auto", "fast", "balanced", "maximum-quality"];

interface CloudGenerateDialogProps {
  mode: GenerationMode;
  onModeChange: (mode: GenerationMode) => void;
  autoReview: boolean;
  onAutoReviewChange: (enabled: boolean) => void;
  isGenerating: boolean;
  error: string | null;
  requiresAcknowledgement: boolean;
  acknowledged: boolean;
  onAcknowledgedChange: (value: boolean) => void;
  persistenceFailed: boolean;
  isRetryingSave: boolean;
  onConfirm: () => void;
  onRetrySave: () => void;
  onClose: () => void;
}

/**
 * Confirms a cloud (Supabase project) paid generation — see specs Part 2.
 * Unlike GenerationConfirmDialog (local `local-*` projects), there are no
 * client-side source-image previews to show: the server loads the
 * project's own confirmed Primary View and reference views itself, so the
 * client only ever picks mode and whether to run the automatic AI review.
 */
export function CloudGenerateDialog({
  mode,
  onModeChange,
  autoReview,
  onAutoReviewChange,
  isGenerating,
  error,
  requiresAcknowledgement,
  acknowledged,
  onAcknowledgedChange,
  persistenceFailed,
  isRetryingSave,
  onConfirm,
  onRetrySave,
  onClose,
}: CloudGenerateDialogProps) {
  const controlsDisabled = isGenerating || persistenceFailed;
  const confirmBlocked = requiresAcknowledgement && !acknowledged;
  // A dispatched paid request can't be dismissed by Escape while isGenerating — mirrors the disabled Cancel button below.
  const dialogRef = useDialogA11y({ onClose, closeDisabled: isGenerating });

  return (
    <div ref={dialogRef} tabIndex={-1} className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-ink/40 p-4" role="dialog" aria-modal="true" aria-labelledby="cloud-generate-dialog-title">
      <div className="my-auto max-h-[calc(100vh-2rem)] w-full max-w-lg overflow-y-auto rounded-2xl border border-border bg-surface p-6 shadow-xl">
        <h2 id="cloud-generate-dialog-title" className="text-lg font-semibold text-ink">
          Сгенерировать концепцию
        </h2>
        <p className="mt-2 text-sm leading-6 text-ink-secondary">
          Генерация использует платный внешний AI-сервис и подтверждённый основной ракурс этого проекта. Результат — концептуальная
          визуализация; проверка специалиста потребуется независимо от результата AI-анализа.
        </p>

        <label className="mt-5 flex items-start gap-3 rounded-xl border border-border bg-surface-soft p-4 text-sm text-ink-secondary">
          <input
            type="checkbox"
            checked={autoReview}
            disabled={controlsDisabled}
            onChange={(event) => onAutoReviewChange(event.target.checked)}
            className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--color-action)] disabled:opacity-50"
          />
          <span>
            <strong className="font-medium text-ink">Выполнить предварительную AI-проверку геометрии</strong>
            <span className="mt-1 block text-xs leading-5">
              Отдельный AI-запрос сравнит результат с основным и доступными опорными ракурсами. Может увеличить стоимость и время
              обработки. Результат не является профессиональным заключением.
            </span>
          </span>
        </label>

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

        {isGenerating ? (
          <div className="mt-5 flex items-center gap-3 rounded-xl border border-border bg-surface-soft p-4">
            <span className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-border border-t-action" />
            <p className="text-sm text-ink-secondary">Генерация концепции… это может занять минуту.</p>
          </div>
        ) : null}

        {error ? (
          <p role="alert" className="mt-4 text-sm text-action">
            {error}
          </p>
        ) : null}

        {requiresAcknowledgement ? (
          <label className="mt-3 flex items-start gap-3 rounded-xl border border-border bg-surface-soft p-4 text-sm text-ink-secondary">
            <input
              type="checkbox"
              checked={acknowledged}
              onChange={(event) => onAcknowledgedChange(event.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--color-action)]"
            />
            <span>
              Понимаю, что предыдущая попытка могла быть оплачена AI-провайдером — независимо от того, известен её результат или
              нет, — и всё равно подтверждаю запуск новой платной генерации.
            </span>
          </label>
        ) : null}

        {persistenceFailed ? (
          <div className="mt-4 rounded-xl border border-border bg-surface-soft p-4">
            <p className="text-sm font-medium text-action">Оплаченная генерация завершена — не запускайте её повторно</p>
            <p className="mt-1 text-sm leading-6 text-ink-secondary">
              Изображение получено и оплачено, но сохранить его в облаке пока не удалось. Повторите только сохранение — новый запрос
              к AI-провайдеру отправляться не будет.
            </p>
          </div>
        ) : null}

        <div className="mt-6 flex items-center justify-end gap-2">
          {persistenceFailed ? (
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
              <Button type="button" variant="ghost" onClick={onClose} disabled={isGenerating}>
                Отмена
              </Button>
              <Button type="button" onClick={onConfirm} disabled={isGenerating || confirmBlocked}>
                {isGenerating ? "Генерация…" : "Начать генерацию"}
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
