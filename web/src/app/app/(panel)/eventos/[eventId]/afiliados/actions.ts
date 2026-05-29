"use server";

import { revalidatePath } from "next/cache";

import { createSupabaseServiceRoleClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type AffiliateActionResult = { ok: true; message: string } | { error: string };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const CODE_RE = /^[A-Z0-9_-]{1,32}$/;

/** Normaliza un nombre libre a código: mayúsculas, sin acentos, solo alfanumérico. */
export function nameToCode(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 16);
}

async function getCallerOrgId(): Promise<{ orgId: string; userId: string } | { error: string }> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser();
  if (userErr || !user) return { error: "No hay sesión." };

  const { data: mem, error: mErr } = await supabase
    .from("org_members")
    .select("organization_id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  if (mErr) return { error: mErr.message };
  if (!mem?.organization_id) return { error: "No tenés productora asignada." };
  return { orgId: mem.organization_id as string, userId: user.id };
}

async function ensureEventBelongsToOrg(
  admin: NonNullable<ReturnType<typeof createSupabaseServiceRoleClient>>,
  eventId: string,
  orgId: string,
): Promise<{ ok: true } | { error: string }> {
  const { data, error } = await admin
    .from("events")
    .select("id, organization_id")
    .eq("id", eventId)
    .maybeSingle();
  if (error || !data) return { error: "Evento no encontrado." };
  if (String(data.organization_id) !== orgId) return { error: "Este evento no pertenece a tu productora." };
  return { ok: true };
}

export async function createAffiliateCode(input: {
  eventId: string;
  name: string;
  customCode?: string;
}): Promise<AffiliateActionResult & { code?: string }> {
  const eventId = input.eventId.trim();
  if (!UUID_RE.test(eventId)) return { error: "Evento inválido." };

  const name = input.name.trim();
  if (!name || name.length > 80) return { error: "El nombre del afiliado es requerido (máx. 80 caracteres)." };

  const code = (input.customCode?.trim().toUpperCase() || nameToCode(name));
  if (!code) return { error: "No se pudo generar un código del nombre. Usá caracteres alfanuméricos." };
  if (!CODE_RE.test(code)) return { error: "El código solo puede tener letras, números, guiones y guiones bajos." };

  const admin = createSupabaseServiceRoleClient();
  if (!admin) return { error: "Falta SUPABASE_SERVICE_ROLE_KEY." };

  const guard = await getCallerOrgId();
  if ("error" in guard) return { error: guard.error };

  const owns = await ensureEventBelongsToOrg(admin, eventId, guard.orgId);
  if ("error" in owns) return { error: owns.error };

  const { error: insertErr } = await admin.from("affiliate_codes").insert({
    event_id: eventId,
    name,
    code,
  });

  if (insertErr) {
    if (insertErr.code === "23505") {
      return { error: `El código "${code}" ya está en uso para este evento. Usá un nombre o código diferente.` };
    }
    return { error: insertErr.message };
  }

  revalidatePath(`/app/eventos/${eventId}/afiliados`);
  return { ok: true, message: `Afiliado "${name}" creado con código ${code}.`, code };
}

export async function toggleAffiliateCode(input: {
  eventId: string;
  affiliateId: string;
  isActive: boolean;
}): Promise<AffiliateActionResult> {
  const { eventId, affiliateId, isActive } = input;
  if (!UUID_RE.test(eventId) || !UUID_RE.test(affiliateId)) return { error: "Datos inválidos." };

  const admin = createSupabaseServiceRoleClient();
  if (!admin) return { error: "Falta SUPABASE_SERVICE_ROLE_KEY." };

  const guard = await getCallerOrgId();
  if ("error" in guard) return { error: guard.error };

  const owns = await ensureEventBelongsToOrg(admin, eventId, guard.orgId);
  if ("error" in owns) return { error: owns.error };

  const { error } = await admin
    .from("affiliate_codes")
    .update({ is_active: isActive })
    .eq("id", affiliateId)
    .eq("event_id", eventId);

  if (error) return { error: error.message };

  revalidatePath(`/app/eventos/${eventId}/afiliados`);
  return { ok: true, message: isActive ? "Afiliado activado." : "Afiliado pausado." };
}

export async function deleteAffiliateCode(input: {
  eventId: string;
  affiliateId: string;
}): Promise<AffiliateActionResult> {
  const { eventId, affiliateId } = input;
  if (!UUID_RE.test(eventId) || !UUID_RE.test(affiliateId)) return { error: "Datos inválidos." };

  const admin = createSupabaseServiceRoleClient();
  if (!admin) return { error: "Falta SUPABASE_SERVICE_ROLE_KEY." };

  const guard = await getCallerOrgId();
  if ("error" in guard) return { error: guard.error };

  const owns = await ensureEventBelongsToOrg(admin, eventId, guard.orgId);
  if ("error" in owns) return { error: owns.error };

  const { error } = await admin
    .from("affiliate_codes")
    .delete()
    .eq("id", affiliateId)
    .eq("event_id", eventId);

  if (error) return { error: error.message };

  revalidatePath(`/app/eventos/${eventId}/afiliados`);
  return { ok: true, message: "Afiliado eliminado." };
}
