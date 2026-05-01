import { createClient } from "@supabase/supabase-js";

/** Solo servidor. No importar desde Client Components. */
export function createSupabaseServiceRoleClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    return null;
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export function requireSupabaseServiceRoleClient() {
  const admin = createSupabaseServiceRoleClient();
  if (!admin) {
    throw new Error(
      "Falta SUPABASE_SERVICE_ROLE_KEY en web/.env.local (solo servidor). Requerido para admin, ticketera pública y signed URLs.",
    );
  }
  return admin;
}
