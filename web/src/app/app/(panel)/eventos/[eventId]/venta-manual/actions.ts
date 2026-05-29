"use server";

import { createHash } from "node:crypto";

import { revalidatePath } from "next/cache";

import { sendTicketsEmail } from "@/lib/email";
import { loadTicketTypesWithAvailability } from "@/lib/ticket-stock";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type ManualSaleResult =
  | { ok: true; orderId: string; message: string; emailWarning?: string }
  | { error: string };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}

function sha256Hex(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
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
): Promise<{ ok: true; eventName: string } | { error: string }> {
  const { data, error } = await admin
    .from("events")
    .select("id, name, organization_id")
    .eq("id", eventId)
    .maybeSingle();

  if (error) return { error: error.message };
  if (!data) return { error: "Evento no encontrado." };
  if (String(data.organization_id) !== orgId) return { error: "Este evento no pertenece a tu productora." };
  return { ok: true, eventName: String(data.name) };
}

export async function createManualSale(input: {
  eventId: string;
  ticketTypeId: string;
  firstName: string;
  lastName: string;
  dni: string;
  email: string;
}): Promise<ManualSaleResult> {
  const eventId = input.eventId.trim();
  const ticketTypeId = input.ticketTypeId.trim();
  if (!UUID_RE.test(eventId) || !UUID_RE.test(ticketTypeId)) {
    return { error: "Datos inválidos." };
  }

  const first = input.firstName.trim();
  const last = input.lastName.trim();
  const dni = input.dni.trim();
  const email = input.email.trim().toLowerCase();

  if (first.length < 1 || first.length > 80) return { error: "Nombre inválido." };
  if (last.length < 1 || last.length > 80) return { error: "Apellido inválido." };
  if (dni.length < 4 || dni.length > 32) return { error: "DNI inválido." };
  if (email && (email.length < 3 || email.length > 120 || !email.includes("@"))) {
    return { error: "Email inválido." };
  }

  const admin = createSupabaseServiceRoleClient();
  if (!admin) return { error: "Falta SUPABASE_SERVICE_ROLE_KEY en el servidor." };

  const guard = await getCallerOrgId();
  if ("error" in guard) return { error: guard.error };

  const ev = await ensureEventBelongsToOrg(admin, eventId, guard.orgId);
  if ("error" in ev) return { error: ev.error };

  const { types, error: stockErr } = await loadTicketTypesWithAvailability(admin, eventId);
  if (stockErr) return { error: stockErr };
  const tt = types.find((t) => t.id === ticketTypeId);
  if (!tt) return { error: "Tipo de entrada no disponible o sin stock." };

  const unitPrice = roundMoney(Number(tt.price_ars));
  const totalArs = unitPrice > 0 ? unitPrice : 0.01;

  const orderId = crypto.randomUUID();
  const proofObjectPath = `${eventId}/${orderId}/manual`;
  const proofSha256 = sha256Hex(`manual-sale:${orderId}`);

  const { error: ordErr } = await admin.from("orders").insert({
    id: orderId,
    event_id: eventId,
    buyer_first_name: first,
    buyer_last_name: last,
    buyer_dni: dni,
    buyer_phone: "",
    buyer_email: email || `sin-email+${orderId.slice(0, 8)}@manual.local`,
    total_qty: 1,
    total_ars: totalArs,
    proof_object_path: proofObjectPath,
    proof_sha256: proofSha256,
    status: "pending_validation",
  });

  if (ordErr) {
    if (ordErr.code === "23505" && /proof_sha256/i.test(ordErr.message ?? "")) {
      return { error: "Conflicto al registrar la venta. Intentá de nuevo." };
    }
    return { error: ordErr.message };
  }

  const { error: itemErr } = await admin.from("order_items").insert({
    order_id: orderId,
    ticket_type_id: ticketTypeId,
    qty: 1,
    unit_price_ars: unitPrice > 0 ? unitPrice : totalArs,
  });

  if (itemErr) {
    await admin.from("orders").delete().eq("id", orderId);
    return { error: itemErr.message };
  }

  const { error: attErr } = await admin.from("attendees").insert({
    order_id: orderId,
    position: 1,
    first_name: first,
    last_name: last,
    dni,
    phone: null,
    is_buyer: true,
  });

  if (attErr) {
    await admin.from("order_items").delete().eq("order_id", orderId);
    await admin.from("orders").delete().eq("id", orderId);
    if (/relation .*attendees.* does not exist|undefined_table/i.test(attErr.message ?? "")) {
      return {
        error: "Falta la tabla attendees. Ejecutá supabase/attendees-per-ticket.sql en el SQL Editor.",
      };
    }
    return { error: `No se guardó el asistente: ${attErr.message}` };
  }

  const { error: finErr } = await admin.rpc("finalize_order_payment", {
    p_order_id: orderId,
    p_mp_payment_id: "",
    p_actor: "panel_manual",
    p_actor_user_id: guard.userId,
  });

  if (finErr) {
    await admin.from("attendees").delete().eq("order_id", orderId);
    await admin.from("order_items").delete().eq("order_id", orderId);
    await admin.from("orders").delete().eq("id", orderId);
    return { error: `No se pudo emitir la entrada: ${finErr.message}` };
  }

  let message = `Venta registrada: 1× ${tt.name} para ${first} ${last}. Quedan ${tt.available_qty - 1} disponible(s).`;
  let emailWarning: string | undefined;

  if (email) {
    const emailRes = await sendTicketsEmail({ orderId });
    if ("error" in emailRes) {
      emailWarning = `La entrada se emitió pero no se pudo enviar el email: ${emailRes.error}`;
      message = `${message} ${emailWarning}`;
    } else {
      message = `${message} QR enviado a ${emailRes.sentTo}.`;
    }
  } else {
    message = `${message} Sin email: no se envió QR por correo.`;
  }

  revalidatePath("/app/ventas");
  revalidatePath(`/app/eventos/${eventId}/venta-manual`);
  revalidatePath(`/app/eventos/${eventId}/entradas`);
  revalidatePath(`/app/eventos/${eventId}/invitados`);

  return { ok: true, orderId, message, emailWarning };
}
