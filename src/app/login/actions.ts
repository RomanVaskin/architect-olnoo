"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

function credentials(formData: FormData) {
  return {
    email: String(formData.get("email") ?? "").trim().toLowerCase(),
    password: String(formData.get("password") ?? ""),
  };
}

function loginUrl(key: "error" | "message", value: string): string {
  return `/login?${new URLSearchParams({ [key]: value }).toString()}`;
}

export async function signIn(formData: FormData) {
  if (!isSupabaseConfigured()) redirect(loginUrl("error", "auth-not-configured"));
  const { email, password } = credentials(formData);
  if (!email || !password) redirect(loginUrl("error", "missing-credentials"));

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) redirect(loginUrl("error", "invalid-credentials"));
  redirect("/");
}

export async function signUp(formData: FormData) {
  if (!isSupabaseConfigured()) redirect(loginUrl("error", "auth-not-configured"));
  const { email, password } = credentials(formData);
  if (!email || password.length < 8) redirect(loginUrl("error", "weak-credentials"));

  const requestHeaders = await headers();
  const origin = (process.env.NEXT_PUBLIC_SITE_URL ?? requestHeaders.get("origin") ?? "http://localhost:3000").replace(/\/$/, "");
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: `${origin}/auth/callback` },
  });
  if (error) redirect(loginUrl("error", "signup-failed"));
  if (data.session) redirect("/");
  redirect(loginUrl("message", "check-email"));
}
