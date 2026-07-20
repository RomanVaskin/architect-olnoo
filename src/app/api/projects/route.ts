import { NextRequest, NextResponse } from "next/server";
import { listServerProjects } from "@/lib/server/project-repository";
import { failureResponse, repositoryErrorResponse, resolveProjectRouteContext } from "@/lib/server/project-route-helpers";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const context = await resolveProjectRouteContext(request);
  if (!context.ok) return failureResponse(context);
  try {
    const projects = await listServerProjects(await createClient());
    return NextResponse.json({ projects });
  } catch (error) {
    return repositoryErrorResponse(error, "projects/list");
  }
}
