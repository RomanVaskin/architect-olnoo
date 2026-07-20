"use client";

import { Button } from "@/components/ui/button";
import { GENERATION_MODE_LABELS, type Concept, type GenerationMode } from "@/lib/types";
import { correctionFindings } from "@/lib/concept-correction";
import { useBlobUrl } from "@/lib/use-blob-url";

const MODES: GenerationMode[] = ["auto", "fast", "balanced", "maximum-quality"];

interface PendingCorrection {
  blob: Blob;
  mimeType: string;
  label: string;
}

interface ConceptCorrectionDialogProps {
  concept: Concept;
  mode: GenerationMode;
  onModeChange: (mode: GenerationMode) => void;
  isGenerating: boolean;
  error: string | null;
  attemptId: string | null;
  requiresAcknowledgement: boolean;
  acknowledged: boolean;
  onAcknowledgedChange: (value: boolean) => void;
  persistenceFailed: boolean;
  pendingCorrection: PendingCorrection | null;
  isRetryingSave: boolean;
  onConfirm: () => void;
  onCancelGeneration: () => void;
  onRetrySave: () => void;
  onClose: () => void;
}

function DownloadCorrection({ concept }: { concept: PendingCorrection }) {
  const url = useBlobUrl(concept.blob);
  return (
    <a href={url} download="architect-olnoo-corrected-concept.png" className="text-xs font-medium text-action underline underline-offset-4">
      Скачать полученное изображение
    </a>
  );
}

export function ConceptCorrectionDialog(props: ConceptCorrectionDialogProps) {
  const findings = correctionFindings(props.concept);
  const controlsDisabled = props.isGenerating || props.persistenceFailed;
  const confirmationBlocked = props.requiresAcknowledgement && !props.acknowledged;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-ink/40 p-4" role="dialog" aria-modal="true" aria-labelledby="correction-dialog-title">
      <div className="my-auto max-h-[calc(100vh-2rem)] w-full max-w-lg overflow-y-auto rounded-2xl border border-border bg-surface p-6 shadow-xl">
        <h2 id="correction-dialog-title" className="text-lg font-semibold text-ink">Создать исправленную версию</h2>
        <p className="mt-2 text-sm leading-6 text-ink-secondary">
          Будет выполнена новая платная генерация по замечаниям Quality Gate, а затем отдельная повторная AI-проверка результата.
          Это два внешних AI-вызова. Исправление не запускается автоматически.
        </p>
        <p className="mt-2 text-xs leading-5 text-ink-secondary">
          Отмена после отправки не гарантирует отсутствие оплаты. Новая версия сохранит связь с исходной концепцией, но всё равно потребует проверки специалиста.
        </p>

        <div className="mt-5 rounded-xl border border-border bg-surface-soft p-4">
          <p className="text-sm font-medium text-ink">Замечания, передаваемые в исправление</p>
          <ul className="mt-2 flex flex-col gap-1.5">
            {findings.map((finding) => <li key={finding} className="text-sm text-ink-secondary">· {finding}</li>)}
          </ul>
        </div>

        <div className="mt-5">
          <p className="text-sm font-medium text-ink">Режим генерации</p>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {MODES.map((item) => (
              <button
                key={item}
                type="button"
                disabled={controlsDisabled}
                onClick={() => props.onModeChange(item)}
                className={props.mode === item
                  ? "rounded-xl border border-accent/60 bg-accent-soft px-3 py-2 text-left text-sm text-ink"
                  : "rounded-xl border border-border px-3 py-2 text-left text-sm text-ink-secondary hover:border-accent/40"}
              >
                {GENERATION_MODE_LABELS[item]}
              </button>
            ))}
          </div>
        </div>

        {props.isGenerating ? (
          <div className="mt-5 flex items-center gap-3 rounded-xl border border-border bg-surface-soft p-4">
            <span className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-border border-t-action" />
            <p className="text-sm text-ink-secondary">Создание и повторная проверка исправленной версии…</p>
          </div>
        ) : null}

        {props.error ? <p role="alert" className="mt-4 text-sm text-action">{props.error}</p> : null}
        {props.attemptId && props.error ? <p className="mt-2 text-xs text-ink-secondary">ID попытки: {props.attemptId}</p> : null}

        {props.requiresAcknowledgement ? (
          <label className="mt-4 flex items-start gap-3 rounded-xl border border-border bg-surface-soft p-4 text-sm text-ink-secondary">
            <input type="checkbox" checked={props.acknowledged} onChange={(event) => props.onAcknowledgedChange(event.target.checked)} className="mt-0.5 h-4 w-4 accent-[var(--color-action)]" />
            <span>Понимаю, что предыдущая попытка могла быть оплачена, и подтверждаю новый платный запуск.</span>
          </label>
        ) : null}

        {props.persistenceFailed && props.pendingCorrection ? (
          <div className="mt-4 rounded-xl border border-border bg-surface-soft p-4">
            <p className="text-sm font-medium text-action">Результат получен — не запускайте генерацию повторно</p>
            <p className="mt-1 text-sm leading-6 text-ink-secondary">Не удалось сохранить версию локально. Можно скачать изображение или повторить только сохранение без обращения к AI.</p>
            <div className="mt-3"><DownloadCorrection concept={props.pendingCorrection} /></div>
          </div>
        ) : null}

        <div className="mt-6 flex justify-end gap-2">
          {props.isGenerating ? (
            <Button type="button" variant="secondary" onClick={props.onCancelGeneration}>Отменить</Button>
          ) : props.persistenceFailed ? (
            <>
              <Button type="button" variant="ghost" onClick={props.onClose}>Закрыть</Button>
              <Button type="button" onClick={props.onRetrySave} disabled={props.isRetryingSave}>
                {props.isRetryingSave ? "Сохранение…" : "Повторить сохранение"}
              </Button>
            </>
          ) : (
            <>
              <Button type="button" variant="ghost" onClick={props.onClose}>Отмена</Button>
              <Button type="button" onClick={props.onConfirm} disabled={confirmationBlocked}>Запустить платное исправление</Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
