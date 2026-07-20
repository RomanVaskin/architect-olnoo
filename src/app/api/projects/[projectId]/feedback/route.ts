import { NextRequest, NextResponse } from "next/server";
import { isServerProjectId } from "@/lib/project-id";
import { addConceptFeedback } from "@/lib/server/project-repository";
import { errorResponse, failureResponse, repositoryErrorResponse, resolveProjectRouteContext } from "@/lib/server/project-route-helpers";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const MAX_COMMENT_LENGTH = 5000;

export async function POST(request: NextRequest, { params }: { params: Promise<{ projectId: string }> }) {
  const context = await resolveProjectRouteContext(request);
  if (!context.ok) return failureResponse(context);

  const { projectId } = await params;
  if (!isServerProjectId(projectId)) return errorResponse("not-found", "Проект не найден или недоступен.", 404);

  let conceptId: string;
  let comment: string;
  try {
    const body: unknown = await request.json();
    if (!isRecord(body) || typeof body.conceptId !== "string" || !isServerProjectId(body.conceptId)) throw new Error("Invalid conceptId.");
    if (typeof body.comment !== "string" || body.comment.trim().length === 0 || body.comment.length > MAX_COMMENT_LENGTH) throw new Error("Invalid comment.");
    conceptId = body.conceptId;
    comment = body.comment;
  } catch {
    return errorResponse("invalid-request", "Некорректный запрос.", 400);
  }

  try {
    const authorName = context.email ?? "Пользователь";
    const feedback = await addConceptFeedback(await createClient(), projectId, conceptId, comment, context.userId, authorName);
    return NextResponse.json({ feedback });
  } catch (error) {
    return repositoryErrorResponse(error, "projects/feedback");
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
