"use server";

import { createHash } from "node:crypto";

import { createSupabaseServiceRoleClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { parseTicketeraContext, type TicketeraContext } from "@/lib/ticketera";
import { PUBLIC_PROOF_MAX_BYTES } from "@/lib/upload-limits";

export type PublicOrderResult = { ok: true; next: string } | { error: string };

function err(message: string): PublicOrderResult {
  return { error: message };
}

const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_BYTES = PUBLIC_PROOF_MAX_BYTES;

function extFromMime(mime: string): string {
  if (mime === "image/jpeg") return "jpg";
  if (mime === "image/png") return "png";
  if (mime === "image/webp") return "webp";
  return "bin";
}

function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}

interface LineInput {
  ticket_type_id: string;
  qty: number;
}

function parseLines(raw: string): LineInput[] | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
  if (!Array.isArray(parsed) || parsed.length === 0) return null;
  const merged = new Map<string, number>();
  for (const row of parsed) {
    if (!row || typeof row !== "object") return null;
    const r = row as Record<string, unknown>;
    const id = String(r.ticket_type_id ?? "").trim();
    const qty = Number(r.qty);
    if (!id || !Number.isFinite(qty) || qty < 1 || qty !== Math.floor(qty)) return null;
    merged.set(id, (merged.get(id) ?? 0) + qty);
  }
  const out = [...merged.entries()].map(([ticket_type_id, qty]) => ({ ticket_type_id, qty }));
  return out.length ? out : null;
}

function validateBuyer(
  first: string,
  last: string,
  dni: string,
  email: string,
): string | null {
  if (first.length < 1 || first.length > 80) return "Nombre inválido.";
  if (last.length < 1 || last.length > 80) return "Apellido inválido.";
  if (dni.length < 4 || dni.length > 32) return "DNI inválido.";
  if (email.length < 3 || email.length > 120 || !email.includes("@")) return "Email inválido.";
  return null;
}

interface AttendeeInput {
  position: number;
  first_name: string;
  last_name: string;
  dni: string;
  phone: string | null;
  is_buyer: boolean;
}

function parseAttendees(raw: string, expectedQty: number): AttendeeInput[] | { error: string } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    return { error: "Datos de asistentes inválidos." };
  }
  if (!Array.isArray(parsed) || parsed.length !== expectedQty) {
    return { error: `Faltan datos: necesitamos ${expectedQty} asistente(s).` };
  }
  const seenDni = new Set<string>();
  const out: AttendeeInput[] = [];
  for (let i = 0; i < parsed.length; i++) {
    const row = parsed[i];
    if (!row || typeof row !== "object") return { error: "Asistente inválido." };
    const r = row as Record<string, unknown>;
    const first = String(r.first_name ?? "").trim();
    const last = String(r.last_name ?? "").trim();
    const dni = String(r.dni ?? "").trim();
    const phone = String(r.phone ?? "").trim();
    const isBuyer = i === 0;
    if (first.length < 1 || first.length > 80) return { error: `Asistente ${i + 1}: nombre inválido.` };
    if (last.length < 1 || last.length > 80) return { error: `Asistente ${i + 1}: apellido inválido.` };
    if (dni.length < 4 || dni.length > 32) return { error: `Asistente ${i + 1}: DNI inválido.` };
    if (phone && (phone.length < 6 || phone.length > 40)) {
      return { error: `Asistente ${i + 1}: teléfono inválido (dejá vacío si no lo tenés).` };
    }
    const dniKey = dni.toLowerCase();
    if (seenDni.has(dniKey)) return { error: `DNI duplicado: ${dni}. Cada entrada debe tener un DNI distinto.` };
    seenDni.add(dniKey);
    out.push({
      position: i + 1,
      first_name: first,
      last_name: last,
      dni,
      phone: phone || null,
      is_buyer: isBuyer,
    });
  }
  return out;
}

async function loadTicketera(orgSlug: string, eventSlug: string): Promise<TicketeraContext | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("get_ticketera_data", {
    p_org_slug: orgSlug,
    p_event_slug: eventSlug,
  });
  if (error || data == null) return null;
  return parseTicketeraContext(data);
}

function sha256Hex(buf: Buffer): string {
  return createHash("sha256").update(buf).digest("hex");
}

function getAutomationWebhook(): { url: string; secret: string } | null {
  const url = (process.env.MAKE_WEBHOOK_VALIDATE_URL || process.env.N8N_WEBHOOK_VALIDATE_URL || "").trim();
  const secret = (process.env.MAKE_WEBHOOK_SECRET || "").trim();
  if (!url) return null;
  return { url, secret };
}

async function triggerAutomationWebhook(payload: Record<string, unknown>): Promise<void> {
  const hook = getAutomationWebhook();
  if (!hook) return;

  const headers: Record<string, string> = {
    "content-type": "application/json",
  };
  // Mantener header por compatibilidad, pero Make puede filtrar por body (`hook_secret`).
  if (hook.secret) headers["x-webhook-secret"] = hook.secret;

  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), 8000);
  try {
    await fetch(hook.url, {
      method: "POST",
      headers,
      body: JSON.stringify({ ...payload, hook_secret: hook.secret }),
      signal: ac.signal,
    });
  } catch {
    // best-effort: la orden queda pending_validation
  } finally {
    clearTimeout(t);
  }
}

export async function submitPublicOrder(formData: FormData): Promise<PublicOrderResult> {
  const admin = createSupabaseServiceRoleClient();
  if (!admin) {
    return err(
      "El servidor no tiene SUPABASE_SERVICE_ROLE_KEY: no se puede subir el comprobante ni crear la orden de forma segura.",
    );
  }

  const orgSlug = String(formData.get("org_slug") || "").trim();
  const eventSlug = String(formData.get("event_slug") || "").trim();
  if (!orgSlug || !eventSlug) return err("Datos del evento incompletos.");

  const ctx = await loadTicketera(orgSlug, eventSlug);
  if (!ctx) return err("Evento no disponible o la productora no está aprobada.");

  const linesRaw = String(formData.get("lines_json") || "");
  const lines = parseLines(linesRaw);
  if (!lines) return err("Elegí al menos una entrada con cantidad válida.");

  const typeMap = new Map(ctx.ticket_types.map((t) => [t.id, t]));
  let totalQty = 0;
  let totalArs = 0;
  const items: { ticket_type_id: string; qty: number; unit_price_ars: number }[] = [];

  for (const line of lines) {
    const tt = typeMap.get(line.ticket_type_id);
    if (!tt) return err("Tipo de entrada no válido para este evento.");
    if (line.qty > tt.available_qty) return err(`No hay cupo suficiente para "${tt.name}".`);
    const unit = roundMoney(Number(tt.price_ars));
    if (!Number.isFinite(unit) || unit < 0) return err("Precio inválido.");
    totalQty += line.qty;
    totalArs += roundMoney(unit * line.qty);
    items.push({ ticket_type_id: tt.id, qty: line.qty, unit_price_ars: unit });
  }

  if (totalQty < 1) return err("Cantidad total inválida.");
  totalArs = roundMoney(totalArs);
  if (totalArs <= 0) return err("Monto total inválido.");

  const email = String(formData.get("buyer_email") || "").trim().toLowerCase();

  // Parsear los asistentes (1 por entrada). El primero es el comprador.
  const attendeesRaw = String(formData.get("attendees_json") || "");
  const attendeesParsed = parseAttendees(attendeesRaw, totalQty);
  if ("error" in attendeesParsed) return err(attendeesParsed.error);
  const attendees = attendeesParsed;
  const buyer = attendees[0];

  const buyerErr = validateBuyer(
    buyer.first_name,
    buyer.last_name,
    buyer.dni,
    email,
  );
  if (buyerErr) return err(buyerErr);

  const first = buyer.first_name;
  const last = buyer.last_name;
  const dni = buyer.dni;

  const file = formData.get("proof");
  if (!file || typeof file === "string" || file.size < 1) return err("Subí una imagen del comprobante.");
  if (file.size > MAX_BYTES) {
    const mb = (MAX_BYTES / (1024 * 1024)).toFixed(0);
    return err(`El comprobante es demasiado pesado. Máximo ${mb} MB.`);
  }
  const mime = file.type || "application/octet-stream";
  if (!ALLOWED_MIME.has(mime)) return err("Formato no permitido: usá JPG, PNG o WebP.");

  const orderId = crypto.randomUUID();
  const ext = extFromMime(mime);
  const objectPath = `${ctx.event.id}/${orderId}/comprobante.${ext}`;

  const buf = Buffer.from(await file.arrayBuffer());
  const proofSha256 = sha256Hex(buf);
  const { error: upErr } = await admin.storage.from("proofs").upload(objectPath, buf, {
    contentType: mime,
    upsert: false,
  });

  if (upErr) {
    return err(`No se pudo subir el comprobante: ${upErr.message}`);
  }

  const { error: ordErr } = await admin.from("orders").insert({
    id: orderId,
    event_id: ctx.event.id,
    buyer_first_name: first,
    buyer_last_name: last,
    buyer_dni: dni,
    buyer_phone: buyer.phone ?? "",
    buyer_email: email,
    total_qty: totalQty,
    total_ars: totalArs,
    proof_object_path: objectPath,
    proof_sha256: proofSha256,
    status: "pending_validation",
  });

  if (ordErr) {
    await admin.storage.from("proofs").remove([objectPath]);
    if (ordErr.code === "23505" && /proof_sha256|orders_proof_sha256/i.test(ordErr.message ?? "")) {
      return err("Ese comprobante ya fue usado en otro pedido. Subí una captura nueva del pago.");
    }
    return err(ordErr.message);
  }

  const { error: itemsErr } = await admin.from("order_items").insert(
    items.map((i) => ({
      order_id: orderId,
      ticket_type_id: i.ticket_type_id,
      qty: i.qty,
      unit_price_ars: i.unit_price_ars,
    })),
  );

  if (itemsErr) {
    await admin.from("orders").delete().eq("id", orderId);
    await admin.storage.from("proofs").remove([objectPath]);
    return err(itemsErr.message);
  }

  const { error: attErr } = await admin.from("attendees").insert(
    attendees.map((a) => ({
      order_id: orderId,
      position: a.position,
      first_name: a.first_name,
      last_name: a.last_name,
      dni: a.dni,
      phone: a.phone,
      is_buyer: a.is_buyer,
    })),
  );

  if (attErr) {
    await admin.from("order_items").delete().eq("order_id", orderId);
    await admin.from("orders").delete().eq("id", orderId);
    await admin.storage.from("proofs").remove([objectPath]);
    if (/relation .*attendees.* does not exist|undefined_table/i.test(attErr.message)) {
      return err(
        "Falta la tabla attendees en la base. Ejecutá supabase/attendees-per-ticket.sql en el SQL Editor.",
      );
    }
    return err(`No se pudieron guardar los datos de los asistentes: ${attErr.message}`);
  }

  void triggerAutomationWebhook({
    order_id: orderId,
    event_id: ctx.event.id,
    total_ars: totalArs,
    buyer_email: email,
    sent_at: new Date().toISOString(),
  });

  return {
    ok: true,
    next: `/o/${orderId}`,
  };
}

export async function submitBenefitCampaignOrder(formData: FormData): Promise<PublicOrderResult> {
  const admin = createSupabaseServiceRoleClient();
  if (!admin) {
    return err(
      "El servidor no tiene SUPABASE_SERVICE_ROLE_KEY: no se puede subir el comprobante ni crear la orden de forma segura.",
    );
  }

  const orgSlug = String(formData.get("org_slug") || "").trim();
  const eventSlug = String(formData.get("event_slug") || "").trim();
  const campaignToken = String(formData.get("campaign_token") || "").trim();
  const benefitCode = String(formData.get("benefit_code") || "").trim().toUpperCase();
  if (!orgSlug || !eventSlug || !campaignToken || !benefitCode) return err("Datos de beneficio incompletos.");

  const ctx = await loadTicketera(orgSlug, eventSlug);
  if (!ctx) return err("Evento no disponible o la productora no está aprobada.");

  const { data: campaign, error: campaignErr } = await admin
    .from("benefit_campaigns")
    .select("id, event_id, ticket_type_id, discounted_price_ars, status, expires_at")
    .eq("token", campaignToken)
    .maybeSingle();

  if (campaignErr || !campaign) {
    if (campaignErr && /relation .*benefit_campaigns.* does not exist|undefined_table/i.test(campaignErr.message)) {
      return err("Falta la tabla de campañas de beneficio. Ejecutá supabase/benefit-campaigns.sql en SQL Editor.");
    }
    return err("Campaña de beneficio inválida.");
  }

  if (String(campaign.event_id) !== ctx.event.id) return err("Esta campaña no corresponde a este evento.");
  if (String(campaign.status) !== "active") return err("Esta campaña de beneficio no está activa.");
  if (campaign.expires_at && new Date(String(campaign.expires_at)).getTime() < Date.now()) {
    return err("Esta campaña de beneficio venció.");
  }

  const ticketType = ctx.ticket_types.find((tt) => tt.id === String(campaign.ticket_type_id));
  if (!ticketType) return err("El tipo de entrada de esta campaña ya no existe.");
  if (ticketType.available_qty < 1) return err("No hay stock disponible para esta entrada.");

  const { data: codeRow, error: codeErr } = await admin
    .from("benefit_campaign_codes")
    .select("id, status, campaign_id, used_order_id")
    .eq("campaign_id", String(campaign.id))
    .eq("code", benefitCode)
    .maybeSingle();

  if (codeErr || !codeRow) {
    if (codeErr && /relation .*benefit_campaign_codes.* does not exist|undefined_table/i.test(codeErr.message)) {
      return err("Falta la tabla de códigos de beneficio. Ejecutá supabase/benefit-campaigns.sql en SQL Editor.");
    }
    return err("Código de beneficio inválido.");
  }
  if (String(codeRow.status) !== "pending" || codeRow.used_order_id) return err("Este código ya fue usado.");

  const unitPrice = roundMoney(Number(campaign.discounted_price_ars));
  if (!Number.isFinite(unitPrice) || unitPrice <= 0) return err("Precio de beneficio inválido.");

  const email = String(formData.get("buyer_email") || "").trim().toLowerCase();
  const attendeesRaw = String(formData.get("attendees_json") || "");
  const attendeesParsed = parseAttendees(attendeesRaw, 1);
  if ("error" in attendeesParsed) return err(attendeesParsed.error);

  const attendees = attendeesParsed;
  const buyer = attendees[0];
  const buyerErr = validateBuyer(
    buyer.first_name,
    buyer.last_name,
    buyer.dni,
    email,
  );
  if (buyerErr) return err(buyerErr);

  const file = formData.get("proof");
  if (!file || typeof file === "string" || file.size < 1) return err("Subí una imagen del comprobante.");
  if (file.size > MAX_BYTES) {
    const mb = (MAX_BYTES / (1024 * 1024)).toFixed(0);
    return err(`El comprobante es demasiado pesado. Máximo ${mb} MB.`);
  }
  const mime = file.type || "application/octet-stream";
  if (!ALLOWED_MIME.has(mime)) return err("Formato no permitido: usá JPG, PNG o WebP.");

  const orderId = crypto.randomUUID();
  const ext = extFromMime(mime);
  const objectPath = `${ctx.event.id}/${orderId}/comprobante.${ext}`;
  const buf = Buffer.from(await file.arrayBuffer());
  const proofSha256 = sha256Hex(buf);

  const { error: upErr } = await admin.storage.from("proofs").upload(objectPath, buf, {
    contentType: mime,
    upsert: false,
  });
  if (upErr) return err(`No se pudo subir el comprobante: ${upErr.message}`);

  const { error: ordErr } = await admin.from("orders").insert({
    id: orderId,
    event_id: ctx.event.id,
    buyer_first_name: buyer.first_name,
    buyer_last_name: buyer.last_name,
    buyer_dni: buyer.dni,
    buyer_phone: buyer.phone ?? "",
    buyer_email: email,
    total_qty: 1,
    total_ars: unitPrice,
    proof_object_path: objectPath,
    proof_sha256: proofSha256,
    status: "pending_validation",
  });

  if (ordErr) {
    await admin.storage.from("proofs").remove([objectPath]);
    if (ordErr.code === "23505" && /proof_sha256|orders_proof_sha256/i.test(ordErr.message ?? "")) {
      return err("Ese comprobante ya fue usado en otro pedido. Subí una captura nueva del pago.");
    }
    return err(ordErr.message);
  }

  const { error: itemErr } = await admin.from("order_items").insert({
    order_id: orderId,
    ticket_type_id: ticketType.id,
    qty: 1,
    unit_price_ars: unitPrice,
  });
  if (itemErr) {
    await admin.from("orders").delete().eq("id", orderId);
    await admin.storage.from("proofs").remove([objectPath]);
    return err(itemErr.message);
  }

  const { error: attErr } = await admin.from("attendees").insert({
    order_id: orderId,
    position: 1,
    first_name: buyer.first_name,
    last_name: buyer.last_name,
    dni: buyer.dni,
    phone: buyer.phone,
    is_buyer: true,
  });
  if (attErr) {
    await admin.from("order_items").delete().eq("order_id", orderId);
    await admin.from("orders").delete().eq("id", orderId);
    await admin.storage.from("proofs").remove([objectPath]);
    if (/relation .*attendees.* does not exist|undefined_table/i.test(attErr.message)) {
      return err(
        "Falta la tabla attendees en la base. Ejecutá supabase/attendees-per-ticket.sql en el SQL Editor.",
      );
    }
    return err(`No se pudieron guardar los datos del asistente: ${attErr.message}`);
  }

  const { data: usedRows, error: useErr } = await admin
    .from("benefit_campaign_codes")
    .update({
      status: "used",
      used_order_id: orderId,
      used_at: new Date().toISOString(),
    })
    .eq("id", String(codeRow.id))
    .eq("status", "pending")
    .is("used_order_id", null)
    .select("id");

  if (useErr || !usedRows || usedRows.length === 0) {
    await admin.from("attendees").delete().eq("order_id", orderId);
    await admin.from("order_items").delete().eq("order_id", orderId);
    await admin.from("orders").delete().eq("id", orderId);
    await admin.storage.from("proofs").remove([objectPath]);
    return err("Este código de beneficio ya fue utilizado por otra persona.");
  }

  void triggerAutomationWebhook({
    order_id: orderId,
    event_id: ctx.event.id,
    total_ars: unitPrice,
    buyer_email: email,
    benefit_campaign_id: String(campaign.id),
    benefit_code_id: String(codeRow.id),
    sent_at: new Date().toISOString(),
  });

  return {
    ok: true,
    next: `/o/${orderId}`,
  };
}

// Compatibilidad temporal con el flujo anterior (link de 1 uso).
export async function submitBenefitOrder(formData: FormData): Promise<PublicOrderResult> {
  return submitBenefitCampaignOrder(formData);
}
