import { NextRequest, NextResponse } from "next/server";
import { isServerProjectId } from "@/lib/project-id";
import { getSignedFileUrl } from "@/lib/server/project-repository";
import { errorResponse, failureResponse, repositoryErrorResponse, resolveProjectRouteContext } from "@/lib/server/project-route-helpers";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

/** Re-signs one file's URL — used by the workspace when a previously loaded signed URL expires (see useRefreshableImageUrl). */
export async function GET(request: NextRequest, { params }: { params: Promise<{ projectId: string; fileId: string }> }) {
  const context = await resolveProjectRouteContext(request);
  if (!context.ok) return failureResponse(context);

  const { projectId, fileId } = await params;
  if (!isServerProjectId(projectId) || !isServerProjectId(fileId)) return errorResponse("not-found", "Файл не найден или недоступен.", 404);

  try {
    const url = await getSignedFileUrl(await createClient(), projectId, fileId);
    return NextResponse.json({ url });
  } catch (error) {
    return repositoryErrorResponse(error, "projects/file-url");
  }
}
