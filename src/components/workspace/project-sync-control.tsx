"use client";

import { useEffect, useState } from "react";
import { Check, CloudUpload, ExternalLink, LoaderCircle } from "lucide-react";
import { Button, LinkButton } from "@/components/ui/button";
import { getLocalProjectSync, saveLocalProjectSync, type LocalProjectSyncRecord } from "@/lib/mvp-local-project-store";
import { ProjectSyncError, syncLocalProject } from "@/lib/project-sync";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export function ProjectSyncControl({ projectId }: { projectId: string }) {
  const [record, setRecord] = useState<LocalProjectSyncRecord | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const configured = isSupabaseConfigured();

  useEffect(() => {
    if (!projectId.startsWith("local-")) return;
    let active = true;
    getLocalProjectSync(projectId).then(async (value) => {
      if (!active) return;
      if (value?.status === "syncing") {
        const interrupted: LocalProjectSyncRecord = {
          localProjectId: projectId,
          status: "failed",
          errorCode: "sync-interrupted",
          updatedAt: new Date().toISOString(),
        };
        await saveLocalProjectSync(interrupted);
        if (active) {
          setRecord(interrupted);
          setMessage("Предыдущее сохранение было прервано. Можно безопасно повторить: локальная копия сохранена, а сервер продолжит тот же импорт.");
        }
        return;
      }
      setRecord(value ?? null);
    }).catch(() => {
      if (active) setMessage("Не удалось прочитать статус синхронизации.");
    });
    return () => { active = false; };
  }, [projectId]);

  if (!projectId.startsWith("local-")) return null;
  const syncing = record?.status === "syncing";
  const synced = record?.status === "synced";

  async function sync() {
    setMessage(null);
    setRecord({ localProjectId: projectId, status: "syncing", updatedAt: new Date().toISOString() });
    try {
      const result = await syncLocalProject(projectId);
      setRecord({ localProjectId: projectId, status: "synced", serverProjectId: result.serverProjectId, updatedAt: result.importedAt });
      setMessage("Проект сохранён в защищённом облачном хранилище. Локальная копия оставлена в браузере.");
    } catch (error) {
      const text = error instanceof ProjectSyncError ? error.message : "Не удалось сохранить проект в облаке. Локальная копия не изменена.";
      const latest = await getLocalProjectSync(projectId).catch(() => undefined);
      setRecord(latest ?? { localProjectId: projectId, status: "failed", updatedAt: new Date().toISOString() });
      setMessage(text);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1.5">
      <div className="flex flex-wrap items-center justify-end gap-2">
        {synced && record?.serverProjectId ? (
          <LinkButton href={`/projects/${record.serverProjectId}`} variant="secondary" size="sm">
            <ExternalLink className="h-4 w-4" />
            Открыть облачный проект
          </LinkButton>
        ) : null}
        <Button type="button" variant="secondary" onClick={sync} disabled={!configured || syncing} title={!configured ? "Сначала подключите Supabase" : undefined}>
          {syncing ? <LoaderCircle className="h-4 w-4 animate-spin" /> : synced ? <Check className="h-4 w-4 text-positive" /> : <CloudUpload className="h-4 w-4" />}
          {syncing ? "Сохраняем…" : synced ? "Обновить облачную копию" : "Сохранить в облаке"}
        </Button>
      </div>
      {!configured ? <span className="text-xs text-ink-secondary">Сначала подключите Supabase</span> : null}
      {message ? <span role={record?.status === "failed" ? "alert" : "status"} className="max-w-sm text-right text-xs text-ink-secondary">{message}</span> : null}
    </div>
  );
}
