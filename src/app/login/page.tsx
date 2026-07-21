import Image from "next/image";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { safeRedirectPath } from "@/lib/safe-redirect-path";
import { signIn, signUp } from "./actions";

const ERROR_MESSAGES: Record<string, string> = {
  "auth-not-configured": "Supabase ещё не подключён. Добавьте URL проекта и publishable key в .env.local.",
  "missing-credentials": "Введите email и пароль.",
  "invalid-credentials": "Не удалось войти. Проверьте email и пароль.",
  "weak-credentials": "Для регистрации укажите email и пароль не короче 8 символов.",
  "signup-failed": "Не удалось создать аккаунт. Возможно, он уже существует.",
  "callback-failed": "Не удалось подтвердить вход. Запросите новое письмо.",
};

const INFO_MESSAGES: Record<string, string> = {
  "check-email": "Проверьте почту и подтвердите создание аккаунта.",
  "signed-out": "Вы вышли из аккаунта.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; message?: string; next?: string }>;
}) {
  const params = await searchParams;
  const configured = isSupabaseConfigured();
  const error = params.error ? ERROR_MESSAGES[params.error] ?? "Не удалось выполнить вход." : null;
  const message = params.message ? INFO_MESSAGES[params.message] ?? null : null;
  // Re-validated server-side in signIn/signUp — this only avoids rendering an obviously unsafe value into the hidden field.
  const next = safeRedirectPath(params.next);

  return (
    <main className="flex min-h-screen items-center justify-center bg-surface px-4 py-12">
      <div className="w-full max-w-md">
        <Image src="/olnoo-logo.svg" alt="OLNOO" width={104} height={36} priority className="h-auto w-[104px]" />
        <div className="mt-10 rounded-2xl border border-border bg-surface p-7">
          <h1 className="text-3xl font-semibold tracking-tight text-ink">Вход в Architect OLNOO</h1>
          <p className="mt-2 text-sm leading-6 text-ink-secondary">Ваши проекты, исходные материалы и AI-генерации будут доступны только после подтверждённого входа.</p>

          {!configured && !error ? (
            <p role="status" className="mt-5 rounded-xl border border-border bg-surface-soft p-3 text-sm leading-5 text-ink-secondary">
              Supabase ещё не подключён. Добавьте URL проекта и publishable key в <code>.env.local</code>, затем перезапустите приложение.
            </p>
          ) : null}
          {error ? <p role="alert" className="mt-5 rounded-xl border border-accent/20 bg-accent-soft p-3 text-sm text-action">{error}</p> : null}
          {message ? <p className="mt-5 rounded-xl border border-positive-border bg-positive-soft p-3 text-sm text-positive">{message}</p> : null}

          <form className="mt-6 flex flex-col gap-4">
            <input type="hidden" name="next" value={next} />
            <label className="flex flex-col gap-1.5 text-sm font-medium text-ink">
              Email
              <input name="email" type="email" autoComplete="email" required disabled={!configured} className="h-11 rounded-xl border border-border bg-surface px-3 text-sm outline-none transition focus:border-accent" />
            </label>
            <label className="flex flex-col gap-1.5 text-sm font-medium text-ink">
              Пароль
              <input name="password" type="password" autoComplete="current-password" minLength={8} required disabled={!configured} className="h-11 rounded-xl border border-border bg-surface px-3 text-sm outline-none transition focus:border-accent" />
            </label>
            <button formAction={signIn} disabled={!configured} className="mt-1 h-11 rounded-xl bg-action px-4 text-sm font-medium text-action-ink transition hover:bg-action-hover disabled:cursor-not-allowed disabled:opacity-50">Войти</button>
            <button formAction={signUp} disabled={!configured} className="h-11 rounded-xl border border-border px-4 text-sm font-medium text-ink transition hover:bg-surface-soft disabled:cursor-not-allowed disabled:opacity-50">Создать аккаунт</button>
          </form>
        </div>
        <p className="mt-5 text-xs leading-5 text-ink-secondary">Пароль обрабатывается Supabase Auth и не сохраняется в данных проекта Architect OLNOO.</p>
      </div>
    </main>
  );
}
