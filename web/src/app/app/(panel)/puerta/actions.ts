"use server";

import { requireSupabaseServiceRoleClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

interface CheckinInput {
  eventId: string;
  qrText: string;
  deviceId?: string;
}

interface CheckinResult {
  ok: boolean;
  code:
    | "ok_first_checkin"
    | "already_checked_in"
    | "ticket_not_found"
    | "wrong_event"
    | "ticket_void"
    | "forbidden"
    | "invalid_input"
    | "error";
  message: string;
  checkedInAt?: string;
  ticketUid?: string;
  ticketTypeName?: string;
}

export interface DoorSearchItem {
  uid: string;
  status: string;
  ticketTypeName: string;
  attendeeName: string;
  attendeeDni: string;
  attendeePhone: string;
  buyerEmail: string;
  isBuyer: boolean;
  issuedAt: string;
}

interface SearchDoorTicketsResult {
  ok: boolean;
  code: "ok" | "forbidden" | "invalid_input" | "error";
  message: string;
  items: DoorSearchItem[];
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function extractUid(qrText: string): string {
  const raw = qrText.trim();
  if (!raw) return "";

  try {
    const url = new URL(raw);
    const qUid = url.searchParams.get("uid");
    if (qUid) return qUid.trim();
  } catch {
    // no-op: puede ser UID puro
  }

  return raw;
}

function normalizeDni(input: string): string {
  return input.replace(/\s+/g, "").trim().toLowerCase();
}

function attendeeFromPayload(payload: unknown): {
  dni: string;
  name: string;
  phone: string;
  isBuyer: boolean;
  buyerEmail: string;
} {
  if (!payload || typeof payload !== "object") return { dni: "", name: "", phone: "", isBuyer: false, buyerEmail: "" };
  const p = payload as Record<string, unknown>;
  const attendee = p.attendee;
  if (!attendee || typeof attendee !== "object") {
    return { dni: "", name: "", phone: "", isBuyer: false, buyerEmail: String(p.buyer_email ?? "").trim() };
  }
  const a = attendee as Record<string, unknown>;
  const first = String(a.first_name ?? "").trim();
  const last = String(a.last_name ?? "").trim();
  const dni = String(a.dni ?? "").trim();
  const phone = String(a.phone ?? "").trim();
  const isBuyer = Boolean(a.is_buyer);
  const buyerEmail = String(p.buyer_email ?? "").trim();
  return { dni, name: `${first} ${last}`.trim(), phone, isBuyer, buyerEmail };
}

async function authorizeDoorForEvent(eventId: string): Promise<
  | { ok: true; userId: string; organizationId: string }
  | { ok: false; result: CheckinResult | SearchDoorTicketsResult }
> {
  if (!UUID_RE.test(eventId)) {
    return { ok: false, result: { ok: false, code: "invalid_input", message: "Evento inválido.", items: [] } };
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser();
  if (userErr || !user) {
    return { ok: false, result: { ok: false, code: "forbidden", message: "Sesión inválida.", items: [] } };
  }

  const { data: eventRow, error: evErr } = await supabase
    .from("events")
    .select("id, organization_id")
    .eq("id", eventId)
    .maybeSingle();

  if (evErr || !eventRow?.organization_id) {
    return { ok: false, result: { ok: false, code: "invalid_input", message: "Evento no encontrado.", items: [] } };
  }

  const { data: member } = await supabase
    .from("org_members")
    .select("role")
    .eq("organization_id", eventRow.organization_id as string)
    .eq("user_id", user.id)
    .maybeSingle();

  const role = String(member?.role ?? "");
  if (role !== "owner" && role !== "admin" && role !== "door") {
    return { ok: false, result: { ok: false, code: "forbidden", message: "No tenés permisos para validar ingresos.", items: [] } };
  }

  return { ok: true, userId: user.id, organizationId: eventRow.organization_id as string };
}

async function checkInByUid(input: { eventId: string; uid: string; deviceId: string | null }): Promise<CheckinResult> {
  try {
    const auth = await authorizeDoorForEvent(input.eventId);
    if (!auth.ok) {
      const r = auth.result;
      return { ok: false, code: (r as CheckinResult).code ?? "forbidden", message: r.message };
    }

    const admin = requireSupabaseServiceRoleClient();
    const { data: ticket, error: tkErr } = await admin
      .from("tickets")
      .select("id, uid, event_id, status, ticket_type_id")
      .eq("uid", input.uid)
      .maybeSingle();

    if (tkErr || !ticket?.id) {
      return { ok: false, code: "ticket_not_found", message: "Entrada no encontrada para ese código." };
    }

    const { data: tt } = await admin
      .from("ticket_types")
      .select("name")
      .eq("id", ticket.ticket_type_id as string)
      .maybeSingle();
    const ticketTypeName = String(tt?.name ?? "");

    if ((ticket.event_id as string) !== input.eventId) {
      return {
        ok: false,
        code: "wrong_event",
        message: "Esta entrada pertenece a otro evento.",
        ticketUid: ticket.uid as string,
        ticketTypeName,
      };
    }

    if ((ticket.status as string) === "void") {
      return { ok: false, code: "ticket_void", message: "Entrada anulada.", ticketUid: ticket.uid as string, ticketTypeName };
    }

    if ((ticket.status as string) === "checked_in") {
      const { data: checkRow } = await admin
        .from("checkins")
        .select("checked_in_at")
        .eq("uid", input.uid)
        .maybeSingle();
      return {
        ok: false,
        code: "already_checked_in",
        message: "Esta entrada ya fue escaneada.",
        checkedInAt: String(checkRow?.checked_in_at ?? ""),
        ticketUid: ticket.uid as string,
        ticketTypeName,
      };
    }

    const now = new Date().toISOString();
    const { data: inserted, error: insErr } = await admin
      .from("checkins")
      .insert({
        ticket_id: ticket.id as string,
        uid: input.uid,
        checked_in_at: now,
        device_id: input.deviceId,
      })
      .select("checked_in_at")
      .maybeSingle();

    if (insErr) {
      if (insErr.code === "23505") {
        const { data: checkRow } = await admin
          .from("checkins")
          .select("checked_in_at")
            .eq("uid", input.uid)
          .maybeSingle();
        return {
          ok: false,
          code: "already_checked_in",
          message: "Esta entrada ya fue escaneada.",
          checkedInAt: String(checkRow?.checked_in_at ?? ""),
          ticketUid: ticket.uid as string,
          ticketTypeName,
        };
      }
      return { ok: false, code: "error", message: `No se pudo registrar el ingreso: ${insErr.message}` };
    }

    await admin.from("tickets").update({ status: "checked_in" }).eq("id", ticket.id as string);

    return {
      ok: true,
      code: "ok_first_checkin",
      message: "Ingreso registrado correctamente.",
      checkedInAt: String(inserted?.checked_in_at ?? now),
      ticketUid: ticket.uid as string,
      ticketTypeName,
    };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Error inesperado";
    return { ok: false, code: "error", message };
  }
}

export async function checkInTicketAction(input: CheckinInput): Promise<CheckinResult> {
  const eventId = String(input.eventId || "").trim();
  const rawText = String(input.qrText || "");
  const deviceId = String(input.deviceId || "").trim().slice(0, 80) || null;
  const uid = extractUid(rawText);

  if (!UUID_RE.test(eventId) || !uid) {
    return { ok: false, code: "invalid_input", message: "Código o evento inválido." };
  }
  return checkInByUid({ eventId, uid, deviceId });
}

export async function searchDoorTicketsAction(input: { eventId: string; query?: string }): Promise<SearchDoorTicketsResult> {
  const eventId = String(input.eventId || "").trim();
  const query = String(input.query || "").trim().toLowerCase();
  const queryDni = normalizeDni(query);
  if (!UUID_RE.test(eventId)) {
    return { ok: false, code: "invalid_input", message: "Evento inválido.", items: [] };
  }

  try {
    const auth = await authorizeDoorForEvent(eventId);
    if (!auth.ok) {
      return {
        ok: false,
        code: (auth.result as SearchDoorTicketsResult).code ?? "forbidden",
        message: auth.result.message,
        items: [],
      };
    }

    const admin = requireSupabaseServiceRoleClient();
    const { data: rows, error } = await admin
      .from("tickets")
      .select("uid, status, ticket_type_id, payload, issued_at")
      .eq("event_id", eventId)
      .limit(8000);

    if (error) return { ok: false, code: "error", message: error.message, items: [] };

    const ticketRows = (rows ?? []) as Array<{ uid: string; status: string; ticket_type_id: string; payload: unknown }>;
    const byType = new Map<string, string>();
    const typeIds = [...new Set(ticketRows.map((r) => r.ticket_type_id).filter(Boolean))];
    if (typeIds.length > 0) {
      const { data: ttypes } = await admin.from("ticket_types").select("id, name").in("id", typeIds);
      for (const tt of ttypes ?? []) byType.set(String(tt.id), String(tt.name));
    }

    const items = ticketRows
      .map((t) => {
        const attendee = attendeeFromPayload(t.payload);
        return {
          uid: String(t.uid),
          status: String(t.status),
          ticketTypeName: byType.get(String(t.ticket_type_id)) ?? "Entrada",
          attendeeName: attendee.name || "Sin nombre",
          attendeeDni: attendee.dni,
          attendeePhone: attendee.phone,
          buyerEmail: attendee.buyerEmail,
          isBuyer: attendee.isBuyer,
          issuedAt: String((t as { issued_at?: string }).issued_at ?? ""),
        };
      })
      .filter((r) =>
        query
          ? (() => {
              const name = r.attendeeName.toLowerCase();
              const dni = normalizeDni(r.attendeeDni);
              const email = r.buyerEmail.toLowerCase();
              const phone = r.attendeePhone.toLowerCase();
              return (
                name.includes(query) ||
                email.includes(query) ||
                phone.includes(query) ||
                (queryDni.length > 0 && dni.includes(queryDni))
              );
            })()
          : true,
      )
      .sort((a, b) => {
        const byName = a.attendeeName.localeCompare(b.attendeeName, "es");
        if (byName !== 0) return byName;
        return a.uid.localeCompare(b.uid, "es");
      });

    if (items.length === 0) {
      return { ok: true, code: "ok", message: "Sin resultados para ese filtro.", items: [] };
    }

    return { ok: true, code: "ok", message: `Mostrando ${items.length} entrada(s).`, items };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Error inesperado";
    return { ok: false, code: "error", message, items: [] };
  }
}

export async function checkInByUidManualAction(input: {
  eventId: string;
  ticketUid: string;
  deviceId?: string;
}): Promise<CheckinResult> {
  const eventId = String(input.eventId || "").trim();
  const uid = extractUid(String(input.ticketUid || ""));
  const deviceId = String(input.deviceId || "").trim().slice(0, 80) || null;
  if (!UUID_RE.test(eventId) || !uid) {
    return { ok: false, code: "invalid_input", message: "Datos inválidos para ingreso manual." };
  }
  return checkInByUid({ eventId, uid, deviceId });
}
