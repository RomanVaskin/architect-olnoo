export interface PublicSupabaseConfig {
  url: string;
  publishableKey: string;
}

/** Public browser-safe Supabase values. Never put a service-role key here. */
export function getPublicSupabaseConfig(): PublicSupabaseConfig | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? "";
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() ?? "";
  return url && publishableKey ? { url, publishableKey } : null;
}

export function isSupabaseConfigured(): boolean {
  return getPublicSupabaseConfig() !== null;
}
