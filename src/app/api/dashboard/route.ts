import { NextRequest, NextResponse } from "next/server";
import { DashboardRepositoryError, getDashboardSummary } from "@/lib/server/dashboard-repository";
import { errorResponse, failureResponse, resolveProjectRouteContext } from "@/lib/server/project-route-helpers";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const context = await resolveProjectRouteContext(request);
  if (!context.ok) return failureResponse(context);

  try {
    const summary = await getDashboardSummary(await createClient());
    return NextResponse.json({ summary });
  } catch (error) {
    const known = error instanceof DashboardRepositoryError ? error : null;
    console.warn("[dashboard]", { stage: known?.message ?? "unknown", code: known?.code ?? "UnknownError" });
    return errorResponse("temporary-error", "Сервис временно недоступен. Повторите попытку позже.", 503);
  }
}
