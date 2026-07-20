import { NextRequest, NextResponse } from "next/server";
import { isServerProjectId } from "@/lib/project-id";
import { getServerProjectDetail } from "@/lib/server/project-repository";
import { errorResponse, failureResponse, repositoryErrorResponse, resolveProjectRouteContext } from "@/lib/server/project-route-helpers";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function GET(request: NextRequest, { params }: { params: Promise<{ projectId: string }> }) {
  const context = await resolveProjectRouteContext(request);
  if (!context.ok) return failureResponse(context);

  const { projectId } = await params;
  if (!isServerProjectId(projectId)) return errorResponse("not-found", "Проект не найден или недоступен.", 404);

  try {
    const project = await getServerProjectDetail(await createClient(), projectId);
    return NextResponse.json({ project });
  } catch (error) {
    return repositoryErrorResponse(error, "projects/detail");
  }
}
