import { resolveAuthRuntimePolicy } from "./auth-policy";
import { isSupabaseConfigured } from "./supabase/config";
import { createClient } from "./supabase/server";

export interface AuthIdentity {
  ok: true;
  userId: string;
  email?: string;
  localDevelopment: boolean;
}

export interface AuthFailure {
  ok: false;
  status: 401 | 503;
  code: "authentication-required" | "authentication-unavailable" | "auth-not-configured";
  message: string;
}

export type AuthResult = AuthIdentity | AuthFailure;

export async function requireAuthenticatedUser(request: Request): Promise<AuthResult> {
  const policy = resolveAuthRuntimePolicy(isSupabaseConfigured(), process.env.NODE_ENV, new URL(request.url).hostname);
  if (policy === "local-development-bypass") {
    return { ok: true, userId: "local-development", localDevelopment: true };
  }
  if (policy === "configuration-required") {
    return {
      ok: false,
      status: 503,
      code: "auth-not-configured",
      message: "Серверная авторизация ещё не настроена. Добавьте параметры Supabase перед публикацией приложения.",
    };
  }

  let data;
  try {
    const supabase = await createClient();
    const result = await supabase.auth.getClaims();
    data = result.data;
  } catch {
    return {
      ok: false,
      status: 503,
      code: "authentication-unavailable",
      message: "Сервис авторизации временно недоступен. Платный AI-запрос не отправлялся.",
    };
  }

  const subject = typeof data?.claims?.sub === "string" ? data.claims.sub : null;
  if (!subject) return { ok: false, status: 401, code: "authentication-required", message: "Войдите в аккаунт OLNOO, чтобы продолжить." };

  const email = typeof data?.claims?.email === "string" ? data.claims.email : undefined;
  return { ok: true, userId: subject, ...(email ? { email } : {}), localDevelopment: false };
}
