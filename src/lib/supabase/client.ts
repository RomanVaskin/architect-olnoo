import { createBrowserClient } from "@supabase/ssr";
import { getPublicSupabaseConfig } from "./config";

export function createClient() {
  const config = getPublicSupabaseConfig();
  if (!config) throw new Error("Supabase is not configured.");
  return createBrowserClient(config.url, config.publishableKey);
}
