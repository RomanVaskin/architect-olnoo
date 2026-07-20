export type AuthRuntimePolicy = "required" | "local-development-bypass" | "configuration-required";

/**
 * Missing auth configuration may never expose production AI endpoints.
 * Local development remains usable while Supabase is being connected.
 */
export function resolveAuthRuntimePolicy(configured: boolean, nodeEnv: string | undefined, hostname?: string): AuthRuntimePolicy {
  if (configured) return "required";
  return nodeEnv === "development" && isLoopbackHostname(hostname)
    ? "local-development-bypass"
    : "configuration-required";
}

function isLoopbackHostname(hostname?: string): boolean {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1" || hostname === "[::1]";
}
