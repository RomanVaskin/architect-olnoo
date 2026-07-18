"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { GENERATION_MODE_LABELS, type GenerationMode } from "@/lib/types";

const MODES: GenerationMode[] = ["auto", "fast", "balanced", "maximum-quality"];
const VARIANT_COUNTS = [1, 3] as const;

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
}: GenerationConfirmDialogProps) {
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

        <div className="mt-5">
          <p className="text-sm font-medium text-ink">Режим генерации</p>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {MODES.map((item) => (
              <button
                key={item}
                type="button"
                disabled={isGenerating}
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
                disabled={isGenerating}
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

        <div className="mt-6 flex items-center justify-end gap-2">
          {isGenerating ? (
            <Button type="button" variant="secondary" onClick={onCancelGeneration}>
              Отменить генерацию
            </Button>
          ) : (
            <>
              <Button type="button" variant="ghost" onClick={onClose}>
                Отмена
              </Button>
              <Button type="button" onClick={onConfirm}>
                Начать генерацию
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
