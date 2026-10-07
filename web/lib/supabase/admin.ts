import { createClient } from "@supabase/supabase-js";

/**
 * Bare serveren bruker denne. Nøkkelen har ikke NEXT_PUBLIC-prefiks,
 * så den sendes ikke til nettleseren.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key || url.includes("supabase.co")) {
    return null;
  }

  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
