import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { resolveAuthRuntimePolicy } from "@/lib/auth-policy";
import { getPublicSupabaseConfig } from "./config";

export async function updateSession(request: NextRequest) {
  const config = getPublicSupabaseConfig();
  const policy = resolveAuthRuntimePolicy(Boolean(config), process.env.NODE_ENV, request.nextUrl.hostname);

  if (policy === "local-development-bypass") return NextResponse.next({ request });
  if (policy === "configuration-required") {
    if (isPublicPath(request.nextUrl.pathname) || request.nextUrl.pathname.startsWith("/api/")) {
      return NextResponse.next({ request });
    }
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("error", "auth-not-configured");
    return NextResponse.redirect(url);
  }

  let response = NextResponse.next({ request });
  const supabase = createServerClient(config!.url, config!.publishableKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        Object.entries(headers).forEach(([name, value]) => response.headers.set(name, value));
      },
    },
  });

  // getClaims verifies the JWT; getSession must not be trusted for page or
  // API authorization when the token is stored in cookies.
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims && !isPublicPath(request.nextUrl.pathname) && !request.nextUrl.pathname.startsWith("/api/")) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", request.nextUrl.pathname);
    return NextResponse.redirect(url);
  }

  return response;
}

function isPublicPath(pathname: string): boolean {
  return pathname === "/login" || pathname.startsWith("/auth/");
}
