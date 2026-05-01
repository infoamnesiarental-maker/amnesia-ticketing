"use server";

import { revalidatePath } from "next/cache";

import { sendTicketsEmail } from "@/lib/email";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type OrderActionResult = { ok: true; message?: string; warning?: string } | { error: string };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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

async function ensureOrderBelongsToOrg(
  admin: ReturnType<typeof createSupabaseServiceRoleClient>,
  orderId: string,
  orgId: string,
): Promise<{ ok: true } | { error: string }> {
  if (!admin) return { error: "Falta SUPABASE_SERVICE_ROLE_KEY en el servidor." };
  const { data, error } = await admin
    .from("orders")
    .select("id, event_id, events:events!inner(organization_id)")
    .eq("id", orderId)
    .maybeSingle();
  if (error) return { error: error.message };
  if (!data) return { error: "Orden no encontrada." };
  const ev = (data as unknown as { events: { organization_id: string } | { organization_id: string }[] | null }).events;
  const evOrg = Array.isArray(ev) ? ev[0]?.organization_id : ev?.organization_id;
  if (!evOrg || evOrg !== orgId) return { error: "Esta orden no pertenece a tu productora." };
  return { ok: true };
}

export async function validateOrder(orderId: string): Promise<OrderActionResult> {
  if (!UUID_RE.test(orderId)) return { error: "ID de orden inválido." };
  const admin = createSupabaseServiceRoleClient();
  if (!admin) return { error: "Falta SUPABASE_SERVICE_ROLE_KEY en el servidor." };

  const guard = await getCallerOrgId();
  if ("error" in guard) return { error: guard.error };

  const owns = await ensureOrderBelongsToOrg(admin, orderId, guard.orgId);
  if ("error" in owns) return { error: owns.error };

  const { data, error } = await admin.rpc("finalize_order_payment", {
    p_order_id: orderId,
    p_mp_payment_id: "",
    p_actor: "manual",
    p_actor_user_id: guard.userId,
  });

  if (error) return { error: error.message };

  const out = data as { idempotent?: boolean; tickets_inserted?: number; tickets_total?: number } | null;
  const inserted = out?.tickets_inserted ?? 0;
  const total = out?.tickets_total ?? 0;

  // Best-effort: enviar email con QRs. No bloqueamos la respuesta si falla.
  let warning: string | undefined;
  const emailRes = await sendTicketsEmail({ orderId });
  if ("error" in emailRes) {
    warning = `Validada, pero no se pudo enviar el email: ${emailRes.error}`;
  }

  revalidatePath("/app/ventas");

  const baseMessage = out?.idempotent
    ? "La orden ya estaba validada."
    : `Validada. Se emitieron ${inserted} ticket(s). Total: ${total}.`;

  const message = warning
    ? baseMessage
    : `${baseMessage} Email enviado a ${"sentTo" in emailRes ? emailRes.sentTo : "comprador"}.`;

  return { ok: true, message, warning };
}

export async function resendTicketsEmailAction(orderId: string): Promise<OrderActionResult> {
  if (!UUID_RE.test(orderId)) return { error: "ID de orden inválido." };
  const admin = createSupabaseServiceRoleClient();
  if (!admin) return { error: "Falta SUPABASE_SERVICE_ROLE_KEY en el servidor." };

  const guard = await getCallerOrgId();
  if ("error" in guard) return { error: guard.error };

  const owns = await ensureOrderBelongsToOrg(admin, orderId, guard.orgId);
  if ("error" in owns) return { error: owns.error };

  const res = await sendTicketsEmail({ orderId });
  if ("error" in res) return { error: res.error };

  revalidatePath("/app/ventas");
  return { ok: true, message: `Email reenviado a ${res.sentTo}.` };
}

export async function rejectOrder(orderId: string): Promise<OrderActionResult> {
  if (!UUID_RE.test(orderId)) return { error: "ID de orden inválido." };
  const admin = createSupabaseServiceRoleClient();
  if (!admin) return { error: "Falta SUPABASE_SERVICE_ROLE_KEY en el servidor." };

  const guard = await getCallerOrgId();
  if ("error" in guard) return { error: guard.error };

  const owns = await ensureOrderBelongsToOrg(admin, orderId, guard.orgId);
  if ("error" in owns) return { error: owns.error };

  const { error } = await admin.rpc("reject_order", {
    p_order_id: orderId,
    p_actor: "manual",
    p_actor_user_id: guard.userId,
  });

  if (error) return { error: error.message };
  revalidatePath("/app/ventas");
  return { ok: true, message: "Orden rechazada." };
}

export async function markOrderManualReview(orderId: string): Promise<OrderActionResult> {
  if (!UUID_RE.test(orderId)) return { error: "ID de orden inválido." };
  const admin = createSupabaseServiceRoleClient();
  if (!admin) return { error: "Falta SUPABASE_SERVICE_ROLE_KEY en el servidor." };

  const guard = await getCallerOrgId();
  if ("error" in guard) return { error: guard.error };

  const owns = await ensureOrderBelongsToOrg(admin, orderId, guard.orgId);
  if ("error" in owns) return { error: owns.error };

  const { error } = await admin
    .from("orders")
    .update({ status: "manual_review" })
    .eq("id", orderId)
    .in("status", ["pending_validation", "manual_review"]);

  if (error) return { error: error.message };
  revalidatePath("/app/ventas");
  return { ok: true, message: "Marcada para revisión." };
}
