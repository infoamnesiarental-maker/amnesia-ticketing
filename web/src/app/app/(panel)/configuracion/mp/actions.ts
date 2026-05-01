"use server";

import { revalidatePath } from "next/cache";

import { createSupabaseServiceRoleClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type SaveMpTokenResult = { ok: true } | { error: string };

const MIN_TOKEN_LENGTH = 30;

async function resolveOrgIdForCurrentUser(): Promise<{ orgId: string } | { error: string }> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser();
  if (userErr || !user) return { error: "No hay sesión." };

  const { data: mem, error: mErr } = await supabase
    .from("org_members")
    .select("organization_id, role")
    .eq("user_id", user.id)
    .in("role", ["owner", "admin"])
    .limit(1)
    .maybeSingle();

  if (mErr) return { error: mErr.message };
  if (!mem?.organization_id) {
    return { error: "Solo el dueño o admin de la productora puede configurar Mercado Pago." };
  }
  return { orgId: mem.organization_id as string };
}

export async function saveMpAccessToken(formData: FormData): Promise<SaveMpTokenResult> {
  const admin = createSupabaseServiceRoleClient();
  if (!admin) {
    return {
      error:
        "Falta SUPABASE_SERVICE_ROLE_KEY en el servidor: no se puede guardar el token de forma segura.",
    };
  }

  const guard = await resolveOrgIdForCurrentUser();
  if ("error" in guard) return { error: guard.error };

  const tokenRaw = String(formData.get("access_token") || "").trim();
  if (tokenRaw.length < MIN_TOKEN_LENGTH) {
    return { error: "Token inválido (muy corto). Pegá el access token completo de Mercado Pago." };
  }

  const { error } = await admin.from("mp_credentials").upsert(
    {
      organization_id: guard.orgId,
      access_token: tokenRaw,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "organization_id" },
  );

  if (error) {
    if (/relation .*mp_credentials.* does not exist|undefined_table/i.test(error.message)) {
      return {
        error:
          "Falta la tabla mp_credentials en Supabase. Ejecutá supabase/mp-credentials.sql en el SQL Editor.",
      };
    }
    return { error: error.message };
  }

  revalidatePath("/app/configuracion/mp");
  return { ok: true };
}

export async function deleteMpAccessToken(): Promise<SaveMpTokenResult> {
  const admin = createSupabaseServiceRoleClient();
  if (!admin) {
    return { error: "Falta SUPABASE_SERVICE_ROLE_KEY en el servidor." };
  }

  const guard = await resolveOrgIdForCurrentUser();
  if ("error" in guard) return { error: guard.error };

  const { error } = await admin
    .from("mp_credentials")
    .delete()
    .eq("organization_id", guard.orgId);

  if (error) return { error: error.message };

  revalidatePath("/app/configuracion/mp");
  return { ok: true };
}
