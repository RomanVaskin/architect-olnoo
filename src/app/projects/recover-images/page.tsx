"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { findOrphanImageKeys, recoverOrphanImage } from "@/lib/mvp-local-project-store";

/**
 * Diagnostic-only recovery tool for images left in IndexedDB without a
 * concept referencing them — the state a project is left in if the image
 * write in `saveGeneratedConcept` succeeds but the following project-metadata
 * write then fails. Attaching one here never calls the generation API: the
 * image bytes already exist locally from the original paid request.
 */
export default function RecoverOrphanImagesPage() {
  const [status, setStatus] = useState<"loading" | "ready">("loading");
  const [orphanKeys, setOrphanKeys] = useState<string[]>([]);
  const [recoveredConceptId, setRecoveredConceptId] = useState<Record<string, string>>({});
  const [recoverError, setRecoverError] = useState<Record<string, boolean>>({});
  const [recoveringKey, setRecoveringKey] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    findOrphanImageKeys().then((keys) => {
      if (cancelled) return;
      setOrphanKeys(keys);
      setStatus("ready");
    });
    return () => {
      cancelled = true;
    };
  }, []);

  async function recover(imageKey: string) {
    setRecoveringKey(imageKey);
    setRecoverError((prev) => ({ ...prev, [imageKey]: false }));
    try {
      const conceptId = await recoverOrphanImage(imageKey);
      setRecoveredConceptId((prev) => ({ ...prev, [imageKey]: conceptId }));
    } catch {
      setRecoverError((prev) => ({ ...prev, [imageKey]: true }));
    } finally {
      setRecoveringKey(null);
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Восстановление изображений"
        description="Изображения, сохранённые в этом браузере, но не привязанные ни к одному проекту — например, после сбоя сохранения уже оплаченной генерации. Восстановление работает только с уже сохранёнными локально данными и не отправляет новых запросов к AI-провайдеру."
      />

      {status === "loading" ? <p className="text-sm text-ink-secondary">Проверка локального хранилища…</p> : null}

      {status === "ready" && orphanKeys.length === 0 ? (
        <p className="text-sm text-ink-secondary">Изображений без привязки к проекту не найдено.</p>
      ) : null}

      {orphanKeys.length > 0 ? (
        <div className="divide-y divide-border rounded-2xl border border-border">
          {orphanKeys.map((imageKey) => {
            const projectId = imageKey.split(":")[0];
            const conceptId = recoveredConceptId[imageKey];
            return (
              <div key={imageKey} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-ink">{imageKey}</p>
                  <p className="text-xs text-ink-secondary">Проект: {projectId}</p>
                  {recoverError[imageKey] ? (
                    <p className="mt-1 text-xs text-action">Не удалось восстановить это изображение локально.</p>
                  ) : null}
                </div>
                {conceptId ? (
                  <Link
                    href={`/projects/${projectId}/concepts`}
                    className="text-xs font-medium text-action underline underline-offset-2"
                  >
                    Открыть восстановленную концепцию
                  </Link>
                ) : (
                  <Button type="button" size="sm" onClick={() => recover(imageKey)} disabled={recoveringKey === imageKey}>
                    {recoveringKey === imageKey ? "Восстановление…" : "Восстановить как концепцию"}
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
