import { NextResponse } from "next/server";

import {
  fetchMpPayment,
  verifyMpWebhookSignature,
} from "@/lib/mercadopago";
import { applyMercadoPagoPayment } from "@/lib/mp-checkout-fulfill";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Webhook Checkout Pro / pagos.
 * Docs: https://www.mercadopago.com.ar/developers/es/docs/checkout-pro/additional-content/notifications/webhooks
 *
 * Siempre validamos firma y leemos el pago por API antes de emitir tickets.
 */
export async function POST(req: Request) {
  const url = new URL(req.url);
  const queryDataId = url.searchParams.get("data.id") || url.searchParams.get("id");
  const queryType = url.searchParams.get("type") || url.searchParams.get("topic");

  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    body = {};
  }

  const bodyData = body.data && typeof body.data === "object" ? (body.data as Record<string, unknown>) : null;
  const dataId = String(queryDataId || bodyData?.id || "").trim();
  const type = String(queryType || body.type || "").trim().toLowerCase();

  const xSignature = req.headers.get("x-signature");
  const xRequestId = req.headers.get("x-request-id");

  const valid = verifyMpWebhookSignature({
    xSignature,
    xRequestId,
    dataId: dataId || null,
  });

  if (!valid) {
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }

  // Solo nos interesan notificaciones de payment.
  if (type && type !== "payment" && !type.includes("payment")) {
    return NextResponse.json({ ok: true, ignored: true });
  }

  if (!dataId) {
    return NextResponse.json({ ok: true, ignored: "no payment id" });
  }

  const payment = await fetchMpPayment(dataId);
  if ("error" in payment) {
    // 500 para que MP reintente
    return NextResponse.json({ error: payment.error }, { status: 500 });
  }

  const result = await applyMercadoPagoPayment(payment);
  if ("error" in result) {
    // Monto inválido u otros: 200 para no reintentar en loop; logueamos en body
    return NextResponse.json({ ok: false, error: result.error });
  }

  return NextResponse.json({ ok: true, action: result.action, order_id: result.orderId });
}

/** Algunos paneles de MP prueban GET. */
export async function GET() {
  return NextResponse.json({ ok: true, service: "mercadopago-webhook" });
}
