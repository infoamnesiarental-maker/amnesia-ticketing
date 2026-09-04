"use server";

import { revalidatePath } from "next/cache";

import { isSuperAdminUser } from "@/lib/is-super-admin";
import { isMpCheckoutConfigured } from "@/lib/mercadopago";
import { setMpCheckoutEnabled } from "@/lib/platform-settings";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type MpCheckoutToggleResult = { ok: true } | { error: string };

export async function toggleMpCheckout(formData: FormData): Promise<MpCheckoutToggleResult> {
  const enabledRaw = String(formData.get("enabled") || "").trim();
  const enabled = enabledRaw === "1" || enabledRaw === "true";

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "No hay sesión." };

  const allowed = await isSuperAdminUser({ supabase, email: user.email });
  if (!allowed) return { error: "Sin permiso de super admin." };

  if (enabled && !isMpCheckoutConfigured()) {
    return {
      error:
        "Para activar Checkout Pro necesitás MP_ACCESS_TOKEN y MP_WEBHOOK_SECRET en web/.env.local (y reiniciar el server).",
    };
  }

  const admin = createSupabaseServiceRoleClient();
  if (!admin) return { error: "Falta SUPABASE_SERVICE_ROLE_KEY." };

  const res = await setMpCheckoutEnabled(admin, enabled, user.id);
  if ("error" in res) return res;

  revalidatePath("/admin/pagos");
  revalidatePath("/admin");
  return { ok: true };
}
