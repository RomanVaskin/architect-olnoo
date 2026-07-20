import { NextRequest, NextResponse } from "next/server";
import { isServerProjectId } from "@/lib/project-id";
import { setSelectedConcept } from "@/lib/server/project-repository";
import { errorResponse, failureResponse, repositoryErrorResponse, resolveProjectRouteContext } from "@/lib/server/project-route-helpers";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function POST(request: NextRequest, { params }: { params: Promise<{ projectId: string }> }) {
  const context = await resolveProjectRouteContext(request);
  if (!context.ok) return failureResponse(context);

  const { projectId } = await params;
  if (!isServerProjectId(projectId)) return errorResponse("not-found", "Проект не найден или недоступен.", 404);

  let conceptId: string | null;
  try {
    const body: unknown = await request.json();
    if (!isRecord(body) || !("conceptId" in body)) throw new Error("Missing conceptId.");
    if (body.conceptId !== null && !isServerProjectId(String(body.conceptId))) throw new Error("Invalid conceptId.");
    conceptId = body.conceptId === null ? null : String(body.conceptId);
  } catch {
    return errorResponse("invalid-request", "Некорректный запрос.", 400);
  }

  try {
    await setSelectedConcept(await createClient(), projectId, conceptId);
    return NextResponse.json({ selectedConceptId: conceptId });
  } catch (error) {
    return repositoryErrorResponse(error, "projects/selected-concept");
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
