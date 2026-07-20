import type { NextRequest } from "next/server";
import { requireAuthenticatedUser } from "@/lib/auth";
import { validateProjectImportManifest, type ProjectImportManifest } from "@/lib/project-import-contract";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export type ImportRouteContext =
  | { ok: true; userId: string; manifest: ProjectImportManifest }
  | { ok: false; status: number; code: string; message: string };

export async function resolveImportRouteContext(request: NextRequest): Promise<ImportRouteContext> {
  const auth = await requireAuthenticatedUser(request);
  if (!auth.ok) return auth;
  if (!isSupabaseConfigured() || auth.localDevelopment) {
    return { ok: false, status: 503, code: "backend-not-configured", message: "Подключите Supabase перед сохранением проекта в облаке." };
  }
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (Number.isFinite(contentLength) && contentLength > 2 * 1024 * 1024) {
    return { ok: false, status: 413, code: "manifest-too-large", message: "Описание проекта превышает лимит синхронизации." };
  }
  try {
    const body: unknown = await request.json();
    if (!isRecord(body) || !("manifest" in body)) throw new Error("Manifest missing.");
    validateProjectImportManifest(body.manifest);
    return { ok: true, userId: auth.userId, manifest: body.manifest };
  } catch {
    return { ok: false, status: 400, code: "invalid-import", message: "Не удалось проверить данные проекта. Локальная копия не изменена." };
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
