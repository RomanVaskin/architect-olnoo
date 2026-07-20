import { NextRequest, NextResponse } from "next/server";
import { completeProjectImportInSupabase, ProjectImportRepositoryError } from "@/lib/server/project-import-repository";
import { resolveImportRouteContext } from "@/lib/server/project-import-route";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const context = await resolveImportRouteContext(request);
  if (!context.ok) return errorResponse(context.code, context.message, context.status);
  try {
    const result = await completeProjectImportInSupabase(await createClient(), context.userId, context.manifest);
    return NextResponse.json(result);
  } catch (error) {
    const known = error instanceof ProjectImportRepositoryError ? error : null;
    console.warn("[projects/import]", { stage: known?.stage ?? "complete", code: known?.code ?? "UnknownError" });
    const notReady = known?.code === "backend-not-ready";
    return errorResponse(
      known?.code ?? "import-failed",
      notReady ? "Серверное хранилище ещё не подготовлено. Локальная копия проекта не изменена." : "Не удалось подтвердить облачное сохранение. Повтор продолжит тот же импорт; локальная копия не изменена.",
      notReady ? 503 : 500,
    );
  }
}

function errorResponse(code: string, message: string, status: number) {
  return NextResponse.json({ error: { code, message } }, { status });
}
