const MAX_LENGTH = 2000;

/**
 * Validates a post-login redirect target from untrusted form data (the
 * `next` hidden field on the login form, itself sourced from the `next`
 * query param the auth Proxy attaches when it bounces an unauthenticated
 * visitor — see src/lib/supabase/proxy.ts). Only a same-origin relative path
 * is ever accepted, so a tampered value can never send a user to another
 * host after they authenticate (open-redirect protection): it must start
 * with exactly one `/`, never `//` (protocol-relative) or `/\` (some
 * browsers normalize backslashes to forward slashes, which would otherwise
 * let `/\evil.example` behave like `//evil.example`), and never contain a
 * backslash anywhere. Anything else falls back to `/`.
 */
export function safeRedirectPath(value: unknown, fallback = "/"): string {
  if (typeof value !== "string" || value.length === 0 || value.length > MAX_LENGTH) return fallback;
  if (!value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\") || value.includes("\\")) return fallback;
  return value;
}
