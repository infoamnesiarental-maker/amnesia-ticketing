/**
 * Cliente server-only para Checkout Pro (API oficial de preferencias y pagos).
 * Docs: https://www.mercadopago.com.ar/developers/es/docs/checkout-pro/overview
 */

import { createHash, createHmac, timingSafeEqual } from "node:crypto";

export const MP_CHECKOUT_TTL_MS = 20 * 60 * 1000;

export function getMpAccessToken(): string | null {
  const t = (process.env.MP_ACCESS_TOKEN || "").trim();
  return t || null;
}

export function getMpWebhookSecret(): string | null {
  const t = (process.env.MP_WEBHOOK_SECRET || "").trim();
  return t || null;
}

/** Token + secret requeridos para prender el switch y procesar webhooks. */
export function isMpCheckoutConfigured(): boolean {
  return Boolean(getMpAccessToken() && getMpWebhookSecret());
}

export function getPublicSiteUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL || "").trim().replace(/\/+$/, "");
}

export interface MpPreferenceItem {
  id: string;
  title: string;
  quantity: number;
  unit_price: number;
  description?: string;
}

export interface CreateMpPreferenceInput {
  orderId: string;
  items: MpPreferenceItem[];
  payer: {
    firstName: string;
    lastName: string;
    email: string;
    dni: string;
  };
  expiresAt: Date;
}

export interface CreateMpPreferenceResult {
  preferenceId: string;
  initPoint: string;
}

function isTestToken(token: string): boolean {
  return token.startsWith("TEST-");
}

export async function createCheckoutPreference(
  input: CreateMpPreferenceInput,
): Promise<CreateMpPreferenceResult | { error: string }> {
  const token = getMpAccessToken();
  if (!token) return { error: "Falta MP_ACCESS_TOKEN en el servidor." };

  const siteUrl = getPublicSiteUrl();
  if (!siteUrl) {
    return { error: "Falta NEXT_PUBLIC_SITE_URL para las URLs de retorno de Mercado Pago." };
  }

  const orderUrl = `${siteUrl}/o/${input.orderId}`;
  const nowIso = new Date().toISOString();
  const expiresIso = input.expiresAt.toISOString();

  const body: Record<string, unknown> = {
    items: input.items.map((it) => ({
      id: it.id,
      title: it.title.slice(0, 256),
      description: (it.description || it.title).slice(0, 256),
      quantity: it.quantity,
      currency_id: "ARS",
      unit_price: Math.round(it.unit_price * 100) / 100,
      category_id: "tickets",
    })),
    payer: {
      name: input.payer.firstName.slice(0, 80),
      surname: input.payer.lastName.slice(0, 80),
      email: input.payer.email.slice(0, 120),
      identification: {
        type: "DNI",
        number: input.payer.dni.replace(/\D/g, "").slice(0, 20) || input.payer.dni.slice(0, 20),
      },
    },
    external_reference: input.orderId,
    metadata: { order_id: input.orderId },
    back_urls: {
      success: orderUrl,
      pending: orderUrl,
      failure: orderUrl,
    },
    auto_return: "approved",
    expires: true,
    expiration_date_from: nowIso,
    expiration_date_to: expiresIso,
    payment_methods: {
      installments: 1,
    },
    statement_descriptor: "TICKETERA",
  };

  // notification_url debe ser HTTPS (docs oficiales).
  if (siteUrl.startsWith("https://")) {
    body.notification_url = `${siteUrl}/api/webhooks/mercadopago?source_news=webhooks`;
  }

  const res = await fetch("https://api.mercadopago.com/checkout/preferences", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "X-Idempotency-Key": `pref-${input.orderId}`,
    },
    body: JSON.stringify(body),
  });

  const json = (await res.json().catch(() => null)) as Record<string, unknown> | null;
  if (!res.ok) {
    const msg =
      (json && typeof json.message === "string" && json.message) ||
      (json && typeof json.error === "string" && json.error) ||
      `Mercado Pago respondió ${res.status}`;
    return { error: `No se pudo crear el checkout: ${msg}` };
  }

  const preferenceId = String(json?.id ?? "");
  const initPoint = isTestToken(token)
    ? String(json?.sandbox_init_point || json?.init_point || "")
    : String(json?.init_point || "");

  if (!preferenceId || !initPoint) {
    return { error: "Mercado Pago no devolvió init_point para la preferencia." };
  }

  return { preferenceId, initPoint };
}

export interface MpPayment {
  id: string;
  status: string;
  status_detail: string | null;
  transaction_amount: number;
  currency_id: string;
  external_reference: string | null;
}

export async function fetchMpPayment(paymentId: string): Promise<MpPayment | { error: string }> {
  const token = getMpAccessToken();
  if (!token) return { error: "Falta MP_ACCESS_TOKEN." };

  const res = await fetch(`https://api.mercadopago.com/v1/payments/${encodeURIComponent(paymentId)}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });

  const json = (await res.json().catch(() => null)) as Record<string, unknown> | null;
  if (!res.ok || !json) {
    return { error: `No se pudo leer el pago ${paymentId} (${res.status}).` };
  }

  return {
    id: String(json.id ?? paymentId),
    status: String(json.status ?? ""),
    status_detail: json.status_detail == null ? null : String(json.status_detail),
    transaction_amount: Number(json.transaction_amount ?? 0),
    currency_id: String(json.currency_id ?? ""),
    external_reference: json.external_reference == null ? null : String(json.external_reference),
  };
}

/** Busca el pago más reciente asociado a la orden (backup del redirect). */
export async function searchMpPaymentByExternalReference(
  orderId: string,
): Promise<MpPayment | null | { error: string }> {
  const token = getMpAccessToken();
  if (!token) return { error: "Falta MP_ACCESS_TOKEN." };

  const url = new URL("https://api.mercadopago.com/v1/payments/search");
  url.searchParams.set("external_reference", orderId);
  url.searchParams.set("sort", "date_created");
  url.searchParams.set("criteria", "desc");
  url.searchParams.set("range", "date_created");
  url.searchParams.set("begin_date", "NOW-7DAYS");
  url.searchParams.set("end_date", "NOW");

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });

  const json = (await res.json().catch(() => null)) as {
    results?: Array<Record<string, unknown>>;
  } | null;

  if (!res.ok || !json) return { error: `Search payments falló (${res.status}).` };

  const first = (json.results ?? [])[0];
  if (!first) return null;

  return {
    id: String(first.id ?? ""),
    status: String(first.status ?? ""),
    status_detail: first.status_detail == null ? null : String(first.status_detail),
    transaction_amount: Number(first.transaction_amount ?? 0),
    currency_id: String(first.currency_id ?? ""),
    external_reference: first.external_reference == null ? null : String(first.external_reference),
  };
}

/**
 * Valida firma de webhook según docs oficiales:
 * manifest = id:[data.id];request-id:[x-request-id];ts:[ts];
 * HMAC-SHA256 hex vs header x-signature v1.
 */
export function verifyMpWebhookSignature(opts: {
  xSignature: string | null;
  xRequestId: string | null;
  dataId: string | null;
}): boolean {
  const secret = getMpWebhookSecret();
  if (!secret) return false;

  const xSignature = (opts.xSignature || "").trim();
  if (!xSignature) return false;

  const parts = Object.fromEntries(
    xSignature.split(",").map((p) => {
      const [k, ...rest] = p.trim().split("=");
      return [k.trim(), rest.join("=").trim()];
    }),
  ) as Record<string, string>;

  const ts = parts.ts || "";
  const v1 = parts.v1 || "";
  if (!ts || !v1) return false;

  let dataId = (opts.dataId || "").trim();
  // Docs: si data.id es alfanumérico, usar lowercase.
  if (/[A-Za-z]/.test(dataId)) dataId = dataId.toLowerCase();

  const requestId = (opts.xRequestId || "").trim();
  const manifestParts: string[] = [];
  if (dataId) manifestParts.push(`id:${dataId}`);
  if (requestId) manifestParts.push(`request-id:${requestId}`);
  manifestParts.push(`ts:${ts}`);
  const manifest = `${manifestParts.join(";")};`;

  const computed = createHmac("sha256", secret).update(manifest).digest("hex");
  try {
    const a = Buffer.from(computed, "utf8");
    const b = Buffer.from(v1, "utf8");
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export function amountsMatchArs(a: number, b: number): boolean {
  return Math.round(a * 100) === Math.round(b * 100);
}

export function sha256Text(s: string): string {
  return createHash("sha256").update(s, "utf8").digest("hex");
}
