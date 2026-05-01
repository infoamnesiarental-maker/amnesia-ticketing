import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

import { getPublicEnv } from "@/lib/env";

/**
 * Cliente browser con cookies (compatible con Server Components + middleware).
 * No usar createClient() de @supabase/supabase-js solo: guarda sesión en localStorage
 * y el servidor nunca ve al usuario logueado → redirect infinito /app → /auth.
 */
let browserClient: SupabaseClient | null = null;

export function createSupabaseBrowserClient(): SupabaseClient {
  if (browserClient) return browserClient;
  const env = getPublicEnv();
  browserClient = createBrowserClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  return browserClient;
}
