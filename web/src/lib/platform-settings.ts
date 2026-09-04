/** Lectura/escritura del switch global de Checkout Pro. Solo servidor. */

import type { SupabaseClient } from "@supabase/supabase-js";

export async function getMpCheckoutEnabled(admin: SupabaseClient): Promise<boolean> {
  const { data, error } = await admin
    .from("platform_settings")
    .select("mp_checkout_enabled")
    .eq("id", 1)
    .maybeSingle();

  if (error || !data) return false;
  return Boolean((data as { mp_checkout_enabled: boolean }).mp_checkout_enabled);
}

export async function setMpCheckoutEnabled(
  admin: SupabaseClient,
  enabled: boolean,
  updatedBy: string | null,
): Promise<{ ok: true } | { error: string }> {
  const { error } = await admin.from("platform_settings").upsert(
    {
      id: 1,
      mp_checkout_enabled: enabled,
      updated_at: new Date().toISOString(),
      updated_by: updatedBy,
    },
    { onConflict: "id" },
  );

  if (error) {
    if (/relation .*platform_settings.* does not exist|undefined_table/i.test(error.message)) {
      return {
        error:
          "Falta la tabla platform_settings. Ejecutá supabase/mp-checkout-global.sql en el SQL Editor de Supabase.",
      };
    }
    return { error: error.message };
  }
  return { ok: true };
}
