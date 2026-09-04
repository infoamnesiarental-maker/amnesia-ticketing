/**
 * Aplica un pago de Mercado Pago a una orden (webhook + backup al volver a /o/{id}).
 * Nunca confía en el body del webhook: siempre usa el pago leído por API.
 */

import { sendTicketsEmail } from "@/lib/email";
import {
  amountsMatchArs,
  type MpPayment,
  searchMpPaymentByExternalReference,
} from "@/lib/mercadopago";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/admin";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type ApplyMpPaymentResult =
  | { ok: true; action: "validated" | "cancelled" | "noop"; orderId: string }
  | { error: string };

async function expireStale(admin: NonNullable<ReturnType<typeof createSupabaseServiceRoleClient>>) {
  try {
    await admin.rpc("expire_stale_mp_checkout_orders");
  } catch {
    // best-effort
  }
}

async function cancelAwaitingOrder(
  admin: NonNullable<ReturnType<typeof createSupabaseServiceRoleClient>>,
  orderId: string,
): Promise<void> {
  await admin
    .from("orders")
    .update({
      status: "cancelled",
      rejected_at: new Date().toISOString(),
    })
    .eq("id", orderId)
    .eq("status", "awaiting_payment");

  try {
    await admin.rpc("release_benefit_code_for_order", { p_order_id: orderId });
  } catch {
    // tabla/función puede no existir en entornos viejos
  }
}

export async function applyMercadoPagoPayment(payment: MpPayment): Promise<ApplyMpPaymentResult> {
  const admin = createSupabaseServiceRoleClient();
  if (!admin) return { error: "Falta SUPABASE_SERVICE_ROLE_KEY." };

  await expireStale(admin);

  const orderId = (payment.external_reference || "").trim();
  if (!UUID_RE.test(orderId)) {
    return { error: "external_reference inválido." };
  }

  const { data: order, error: ordErr } = await admin
    .from("orders")
    .select("id, status, total_ars, mp_payment_id, checkout_expires_at")
    .eq("id", orderId)
    .maybeSingle();

  if (ordErr || !order) return { error: ordErr?.message ?? "Orden no encontrada." };

  if (order.status === "validated") {
    return { ok: true, action: "noop", orderId };
  }

  if (order.status !== "awaiting_payment") {
    return { ok: true, action: "noop", orderId };
  }

  const expiresAt = order.checkout_expires_at ? new Date(String(order.checkout_expires_at)).getTime() : null;
  if (expiresAt != null && Number.isFinite(expiresAt) && expiresAt < Date.now() && payment.status !== "approved") {
    await cancelAwaitingOrder(admin, orderId);
    return { ok: true, action: "cancelled", orderId };
  }

  if (payment.status === "approved") {
    if (String(payment.currency_id).toUpperCase() !== "ARS") {
      return { error: "Moneda de pago distinta de ARS." };
    }
    if (!amountsMatchArs(Number(payment.transaction_amount), Number(order.total_ars))) {
      return { error: "El monto del pago no coincide con la orden." };
    }

    const { error: finErr } = await admin.rpc("finalize_order_payment", {
      p_order_id: orderId,
      p_mp_payment_id: String(payment.id),
      p_actor: "mercadopago_checkout",
      p_actor_user_id: null,
    });

    if (finErr) return { error: finErr.message };

    void sendTicketsEmail({ orderId });
    return { ok: true, action: "validated", orderId };
  }

  if (
    payment.status === "rejected" ||
    payment.status === "cancelled" ||
    payment.status === "refunded" ||
    payment.status === "charged_back"
  ) {
    await cancelAwaitingOrder(admin, orderId);
    return { ok: true, action: "cancelled", orderId };
  }

  // pending / in_process: dejar awaiting_payment
  return { ok: true, action: "noop", orderId };
}

/** Backup cuando el comprador vuelve a /o/{id} y el webhook aún no llegó. */
export async function syncOrderFromMercadoPago(orderId: string): Promise<ApplyMpPaymentResult> {
  if (!UUID_RE.test(orderId)) return { error: "order_id inválido." };

  const admin = createSupabaseServiceRoleClient();
  if (!admin) return { error: "Falta SUPABASE_SERVICE_ROLE_KEY." };

  await expireStale(admin);

  const { data: order } = await admin.from("orders").select("id, status").eq("id", orderId).maybeSingle();
  if (!order) return { error: "Orden no encontrada." };
  if (order.status !== "awaiting_payment") {
    return { ok: true, action: "noop", orderId };
  }

  const found = await searchMpPaymentByExternalReference(orderId);
  if (found && "error" in found) return { error: found.error };
  if (!found) return { ok: true, action: "noop", orderId };

  return applyMercadoPagoPayment(found);
}
