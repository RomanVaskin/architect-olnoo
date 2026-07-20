import { NextResponse, type NextRequest } from "next/server";
import { requireAuthenticatedUser } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { classifyRepositoryError, ProjectRepositoryError } from "./project-repository";

/**
 * Shared by every /api/projects/* route handler (list, detail,
 * selected-concept, feedback, file url) — one place enforcing "authenticated
 * session + real Supabase backend" so no route can accidentally fall back to
 * the local-development auth bypass (see requireAuthenticatedUser) against a
 * real database.
 */
export interface ProjectRouteContext {
  ok: true;
  userId: string;
  email?: string;
}

export type ProjectRouteFailure = { ok: false; status: number; code: string; message: string };

export async function resolveProjectRouteContext(request: NextRequest): Promise<ProjectRouteContext | ProjectRouteFailure> {
  const auth = await requireAuthenticatedUser(request);
  if (!auth.ok) return auth;
  if (!isSupabaseConfigured() || auth.localDevelopment) {
    return { ok: false, status: 503, code: "backend-not-configured", message: "Облачные проекты ещё не подключены." };
  }
  return { ok: true, userId: auth.userId, ...(auth.email ? { email: auth.email } : {}) };
}

export function errorResponse(code: string, message: string, status: number) {
  return NextResponse.json({ error: { code, message } }, { status });
}

export function failureResponse(context: ProjectRouteFailure) {
  return errorResponse(context.code, context.message, context.status);
}

/** Maps a ProjectRepositoryError to a safe HTTP response — never forwards a raw Postgres/Storage error message (see classifyRepositoryError for the testable mapping). */
export function repositoryErrorResponse(error: unknown, routeLabel: string) {
  const known = error instanceof ProjectRepositoryError ? error : null;
  console.warn(`[${routeLabel}]`, { stage: known?.stage ?? "unknown", code: known?.code ?? "UnknownError" });
  const classified = classifyRepositoryError(error);
  return errorResponse(classified.code, classified.message, classified.status);
}
