import QRCode from "qrcode";
import { Resend } from "resend";

import { createSupabaseServiceRoleClient } from "@/lib/supabase/admin";

const money = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 2 });

interface TicketRow {
  uid: string;
  ticket_type_name: string;
  attendee_name: string | null;
}

interface SendTicketsEmailInput {
  orderId: string;
}

export type SendTicketsEmailResult =
  | { ok: true; sentTo: string; ticketsCount: number; idempotent: boolean }
  | { error: string };

function getResendClient(): { client: Resend; from: string; replyTo: string | null } | null {
  const key = (process.env.RESEND_API_KEY || "").trim();
  const from = (process.env.EMAIL_FROM || "").trim();
  const replyTo = (process.env.EMAIL_REPLY_TO || "").trim() || null;
  if (!key || !from) return null;
  return { client: new Resend(key), from, replyTo };
}

function getPublicSiteUrl(): string {
  const url = (process.env.NEXT_PUBLIC_SITE_URL || "").trim();
  return url.replace(/\/+$/, "");
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function formatLongDate(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("es-AR", { dateStyle: "full", timeStyle: "short" });
}

interface RenderArgs {
  buyerFirstName: string;
  eventName: string;
  eventPlace: string | null;
  eventStartsAt: string | null;
  orgName: string;
  totalQty: number;
  totalArs: number;
  tickets: TicketRow[];
  orderUrl: string;
}

function renderHtml(args: RenderArgs): string {
  const ticketsHtml = args.tickets
    .map(
      (t, idx) => `
    <tr>
      <td align="center" style="padding:24px 16px;border-top:1px solid #1f1f23;">
        <p style="margin:0 0 4px 0;font-family:Arial,sans-serif;font-size:11px;letter-spacing:1px;color:#9b9bab;text-transform:uppercase;">
          Entrada ${idx + 1} · ${escapeHtml(t.ticket_type_name)}
        </p>
        ${t.attendee_name ? `<p style="margin:2px 0 0 0;font-family:Arial,sans-serif;font-size:16px;font-weight:bold;color:#ffffff;">${escapeHtml(t.attendee_name)}</p>` : ""}
        <table role="presentation" border="0" cellpadding="0" cellspacing="0" style="margin:12px auto;background:#ffffff;border-radius:14px;">
          <tr>
            <td style="padding:14px;">
              <img src="cid:qr-${t.uid}" width="220" height="220" alt="QR ticket ${t.uid}" style="display:block;border:0;" />
            </td>
          </tr>
        </table>
        <p style="margin:8px 0 0 0;font-family:'Courier New',monospace;font-size:10px;color:#6b6b76;">UID: ${escapeHtml(t.uid)}</p>
      </td>
    </tr>`,
    )
    .join("");

  const eventLineParts = [args.eventPlace ?? "", formatLongDate(args.eventStartsAt)].filter((v): v is string => Boolean(v));
  const eventLine = eventLineParts.map(escapeHtml).join(" · ");

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>Tu entrada para ${escapeHtml(args.eventName)}</title>
</head>
<body style="margin:0;padding:0;background:#0a0a0a;color:#ffffff;font-family:Arial,sans-serif;">
  <table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0" style="background:#0a0a0a;">
    <tr>
      <td align="center" style="padding:32px 12px;">
        <table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0" style="max-width:560px;background:#111114;border-radius:16px;overflow:hidden;">
          <tr>
            <td style="padding:32px 28px 16px 28px;">
              <p style="margin:0;font-family:Arial,sans-serif;font-size:11px;letter-spacing:1px;color:#9b9bab;text-transform:uppercase;">${escapeHtml(args.orgName)}</p>
              <h1 style="margin:8px 0 0 0;font-family:Arial,sans-serif;font-size:22px;line-height:1.25;color:#ffffff;">${escapeHtml(args.eventName)}</h1>
              ${eventLine ? `<p style="margin:8px 0 0 0;font-family:Arial,sans-serif;font-size:13px;color:#c8c8d4;">${eventLine}</p>` : ""}
            </td>
          </tr>
          <tr>
            <td style="padding:8px 28px 0 28px;">
              <div style="background:rgba(34,197,94,0.10);border:1px solid rgba(34,197,94,0.30);border-radius:12px;padding:16px;">
                <p style="margin:0;font-family:Arial,sans-serif;font-size:14px;color:#bbf7d0;">
                  ¡Hola ${escapeHtml(args.buyerFirstName)}! Tu pago fue confirmado.
                </p>
                <p style="margin:6px 0 0 0;font-family:Arial,sans-serif;font-size:13px;color:#dcfce7;">
                  Mostrá el código QR en la puerta del evento. Cada QR es individual.
                </p>
              </div>
            </td>
          </tr>
          <tr>
            <td style="padding:24px 28px 0 28px;">
              <p style="margin:0;font-family:Arial,sans-serif;font-size:13px;color:#c8c8d4;">
                <strong style="color:#ffffff;">${args.totalQty} entrada${args.totalQty > 1 ? "s" : ""}</strong> · Total ${money.format(args.totalArs)}
              </p>
            </td>
          </tr>
          <tr>
            <td>
              <table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0" style="margin-top:12px;">
                ${ticketsHtml}
              </table>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding:24px 28px 8px 28px;">
              <a href="${escapeHtml(args.orderUrl)}" style="display:inline-block;background:#ff5722;color:#ffffff;text-decoration:none;font-family:Arial,sans-serif;font-size:14px;font-weight:bold;padding:12px 22px;border-radius:999px;">
                Abrir mi entrada en la web
              </a>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding:8px 28px 28px 28px;">
              <p style="margin:0;font-family:Arial,sans-serif;font-size:11px;color:#7a7a86;">
                Guardá este email. Si perdés el QR, podés volver a abrir la entrada en el link de arriba.
              </p>
            </td>
          </tr>
        </table>
        <p style="margin:18px 0 0 0;font-family:Arial,sans-serif;font-size:11px;color:#5a5a66;">
          Email automático · No respondas a este mensaje.
        </p>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function renderText(args: RenderArgs): string {
  const lines = [
    `Hola ${args.buyerFirstName}!`,
    "",
    `Tu pago para "${args.eventName}" fue confirmado.`,
    args.eventPlace ? `Lugar: ${args.eventPlace}` : "",
    args.eventStartsAt ? `Fecha: ${formatLongDate(args.eventStartsAt)}` : "",
    "",
    `Total: ${money.format(args.totalArs)} (${args.totalQty} entrada${args.totalQty > 1 ? "s" : ""})`,
    "",
    "Tus tickets:",
    ...args.tickets.map(
      (t, i) =>
        `  ${i + 1}. ${t.attendee_name ? `${t.attendee_name} - ` : ""}${t.ticket_type_name} - UID: ${t.uid}`,
    ),
    "",
    `Ver entrada en la web: ${args.orderUrl}`,
    "",
    "Mostrá el QR en la puerta del evento.",
  ];
  return lines.filter((l) => l !== undefined).join("\n");
}

interface OrderRow {
  id: string;
  status: string;
  buyer_first_name: string;
  buyer_email: string;
  total_qty: number;
  total_ars: number;
  tickets_email_sent_at: string | null;
  events:
    | { name: string; place: string | null; starts_at: string | null; organizations: { name: string } | { name: string }[] | null }
    | { name: string; place: string | null; starts_at: string | null; organizations: { name: string } | { name: string }[] | null }[]
    | null;
}

interface TicketDbRow {
  uid: string;
  ticket_types: { name: string } | { name: string }[] | null;
  attendees:
    | { first_name: string; last_name: string; position: number } | { first_name: string; last_name: string; position: number }[]
    | null;
}

export async function sendTicketsEmail({ orderId }: SendTicketsEmailInput): Promise<SendTicketsEmailResult> {
  const resend = getResendClient();
  if (!resend) {
    return {
      error:
        "Email no configurado: faltan RESEND_API_KEY y/o EMAIL_FROM en el servidor (web/.env.local).",
    };
  }

  const admin = createSupabaseServiceRoleClient();
  if (!admin) return { error: "Falta SUPABASE_SERVICE_ROLE_KEY en el servidor." };

  const { data: orderData, error: orderErr } = await admin
    .from("orders")
    .select(
      "id, status, buyer_first_name, buyer_email, total_qty, total_ars, tickets_email_sent_at, events(name, place, starts_at, organizations(name))",
    )
    .eq("id", orderId)
    .maybeSingle();

  if (orderErr || !orderData) return { error: orderErr?.message ?? "Orden no encontrada." };

  const order = orderData as unknown as OrderRow;
  if (order.status !== "validated") {
    return { error: "La orden no está validada todavía." };
  }

  const eventRel = Array.isArray(order.events) ? order.events[0] : order.events;
  const orgRel = eventRel
    ? Array.isArray(eventRel.organizations)
      ? eventRel.organizations[0]
      : eventRel.organizations
    : null;

  const { data: ticketsData, error: ticketsErr } = await admin
    .from("tickets")
    .select("uid, ticket_types(name), attendees(first_name, last_name, position)")
    .eq("order_id", orderId)
    .order("issued_at", { ascending: true });

  if (ticketsErr) return { error: ticketsErr.message };

  const tickets: TicketRow[] = (ticketsData ?? []).map((t) => {
    const r = t as unknown as TicketDbRow;
    const tt = Array.isArray(r.ticket_types) ? r.ticket_types[0] : r.ticket_types;
    const att = Array.isArray(r.attendees) ? r.attendees[0] : r.attendees;
    const attendee_name = att ? `${att.first_name} ${att.last_name}`.trim() : null;
    return { uid: r.uid, ticket_type_name: tt?.name ?? "Entrada", attendee_name };
  });

  if (tickets.length === 0) return { error: "La orden no tiene tickets emitidos." };

  const attachments = await Promise.all(
    tickets.map(async (t) => {
      const dataUrl = await QRCode.toDataURL(t.uid, {
        errorCorrectionLevel: "M",
        margin: 1,
        width: 480,
        color: { dark: "#0a0a0a", light: "#ffffff" },
      });
      const base64 = dataUrl.split(",")[1] ?? "";
      return {
        filename: `ticket-${t.uid}.png`,
        content: base64,
        content_id: `qr-${t.uid}`,
      };
    }),
  );

  const siteUrl = getPublicSiteUrl();
  const orderUrl = siteUrl ? `${siteUrl}/o/${order.id}` : `/o/${order.id}`;

  const renderArgs: RenderArgs = {
    buyerFirstName: order.buyer_first_name,
    eventName: eventRel?.name ?? "el evento",
    eventPlace: eventRel?.place ?? null,
    eventStartsAt: eventRel?.starts_at ?? null,
    orgName: orgRel?.name ?? "Productora",
    totalQty: Number(order.total_qty),
    totalArs: Number(order.total_ars),
    tickets,
    orderUrl,
  };

  const subject = `Tu entrada para ${renderArgs.eventName}`;

  const { data: sent, error: sendErr } = await resend.client.emails.send({
    from: resend.from,
    to: order.buyer_email,
    subject,
    html: renderHtml(renderArgs),
    text: renderText(renderArgs),
    attachments,
    ...(resend.replyTo ? { replyTo: resend.replyTo } : {}),
  });

  if (sendErr) {
    return { error: sendErr.message };
  }

  void sent;

  await admin
    .from("orders")
    .update({ tickets_email_sent_at: new Date().toISOString() })
    .eq("id", orderId);

  return {
    ok: true,
    sentTo: order.buyer_email,
    ticketsCount: tickets.length,
    idempotent: Boolean(order.tickets_email_sent_at),
  };
}
