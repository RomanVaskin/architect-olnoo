import { NextRequest, NextResponse } from "next/server";
import { prepareProjectImportInSupabase, ProjectImportRepositoryError } from "@/lib/server/project-import-repository";
import { resolveImportRouteContext } from "@/lib/server/project-import-route";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const context = await resolveImportRouteContext(request);
  if (!context.ok) return errorResponse(context.code, context.message, context.status);
  try {
    const result = await prepareProjectImportInSupabase(await createClient(), context.userId, context.manifest);
    return NextResponse.json(result);
  } catch (error) {
    return repositoryError(error, "prepare");
  }
}

function repositoryError(error: unknown, fallbackStage: string) {
  const known = error instanceof ProjectImportRepositoryError ? error : null;
  console.warn("[projects/import]", { stage: known?.stage ?? fallbackStage, code: known?.code ?? "UnknownError" });
  const notReady = known?.code === "backend-not-ready";
  return errorResponse(
    known?.code ?? "import-failed",
    notReady ? "Серверное хранилище ещё не подготовлено. Локальная копия проекта не изменена." : "Не удалось подготовить облачное сохранение. Локальная копия проекта не изменена.",
    notReady ? 503 : 500,
  );
}

function errorResponse(code: string, message: string, status: number) {
  return NextResponse.json({ error: { code, message } }, { status });
}
