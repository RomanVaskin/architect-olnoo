import type { Feedback, Project } from "@/lib/types";
import type { ServerProjectSummary } from "@/lib/server/project-repository";

/**
 * Browser-side fetch wrappers for the /api/projects/* Route Handlers (see
 * src/app/api/projects/). Mirrors the request/error-mapping shape already
 * used by src/lib/project-sync.ts (`requestJson` + a typed error) so both
 * the sync flow and the read/write project flow fail the same way.
 */

export type ServerProjectErrorKind = "not-found" | "authentication-required" | "temporary-error" | "invalid-request";

export class ServerProjectError extends Error {
  readonly kind: ServerProjectErrorKind;

  constructor(kind: ServerProjectErrorKind, message: string) {
    super(message);
    this.name = "ServerProjectError";
    this.kind = kind;
  }
}

function kindForStatus(status: number, code: string): ServerProjectErrorKind {
  if (status === 401) return "authentication-required";
  if (status === 404 || code === "not-found") return "not-found";
  if (status === 400 || code === "invalid-request") return "invalid-request";
  return "temporary-error";
}

async function requestJson(url: string, init?: RequestInit): Promise<unknown> {
  let response: Response;
  try {
    response = await fetch(url, init);
  } catch {
    throw new ServerProjectError("temporary-error", "Не удалось связаться с сервером. Проверьте соединение и повторите попытку.");
  }
  const body = await readJson(response);
  if (!response.ok) {
    const error = isRecord(body) && isRecord(body.error) ? body.error : null;
    const code = typeof error?.code === "string" ? error.code : "unknown";
    const message = typeof error?.message === "string" ? error.message : "Сервис временно недоступен. Повторите попытку позже.";
    throw new ServerProjectError(kindForStatus(response.status, code), message);
  }
  return body;
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export async function fetchServerProjects(): Promise<ServerProjectSummary[]> {
  const body = await requestJson("/api/projects");
  return isRecord(body) && Array.isArray(body.projects) ? (body.projects as ServerProjectSummary[]) : [];
}

export async function fetchServerProject(projectId: string): Promise<Project> {
  const body = await requestJson(`/api/projects/${projectId}`);
  if (!isRecord(body) || !isRecord(body.project)) {
    throw new ServerProjectError("temporary-error", "Сервер вернул неполные данные проекта.");
  }
  return body.project as unknown as Project;
}

export async function postSelectedConcept(projectId: string, conceptId: string | null): Promise<void> {
  await requestJson(`/api/projects/${projectId}/selected-concept`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ conceptId }),
  });
}

export async function postConceptFeedback(projectId: string, conceptId: string, comment: string): Promise<Feedback> {
  const body = await requestJson(`/api/projects/${projectId}/feedback`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ conceptId, comment }),
  });
  if (!isRecord(body) || !isRecord(body.feedback)) {
    throw new ServerProjectError("temporary-error", "Сервер не подтвердил сохранение отзыва.");
  }
  return body.feedback as unknown as Feedback;
}
