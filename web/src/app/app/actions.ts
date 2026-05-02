"use server";

import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";

import { createSupabaseServiceRoleClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { EVENT_COVER_MAX_BYTES } from "@/lib/upload-limits";

export type ActionResult = { ok: true } | { error: string };

export type CreateEventResult = { ok: true; eventId: string } | { error: string };

function err(message: string): ActionResult {
  return { error: message };
}

function errCreate(message: string): CreateEventResult {
  return { error: message };
}

function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
}

/**
 * Genera un slug único a partir del nombre. Si `excludingOrganizationId` coincide con la fila que ya usa ese slug, se mantiene.
 */
async function allocateOrganizationSlug(
  supabase: SupabaseClient,
  nameForSlug: string,
  excludingOrganizationId?: string,
): Promise<{ ok: true; slug: string } | { ok: false; message: string }> {
  const base = slugify(nameForSlug);
  if (!base) {
    return {
      ok: false,
      message: "El nombre no permite generar una ruta válida. Usá letras o números en el nombre de la productora.",
    };
  }

  for (let n = 0; n < 100; n++) {
    const candidate = n === 0 ? base : `${base}-${n + 1}`;
    const { data: row, error } = await supabase.from("organizations").select("id").eq("slug", candidate).maybeSingle();
    if (error) return { ok: false, message: error.message };
    if (!row) return { ok: true, slug: candidate };
    if (excludingOrganizationId && row.id === excludingOrganizationId) return { ok: true, slug: candidate };
  }

  return { ok: true, slug: `${base}-${crypto.randomUUID().replace(/-/g, "").slice(0, 8)}` };
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const COVER_MIME = new Set(["image/jpeg", "image/png", "image/webp"]);

function isUuid(value: string): boolean {
  return UUID_RE.test(value);
}

function extFromCoverMime(mime: string): string {
  if (mime === "image/jpeg") return "jpg";
  if (mime === "image/png") return "png";
  if (mime === "image/webp") return "webp";
  return "jpg";
}

export type UploadEventCoverResult = { ok: true; publicUrl: string } | { error: string };

/** Subida de tapa al bucket `event_covers` (requiere service role + SQL del bucket). */
export async function uploadEventCoverImage(formData: FormData): Promise<UploadEventCoverResult> {
  const admin = createSupabaseServiceRoleClient();
  if (!admin) {
    return {
      error:
        "Falta SUPABASE_SERVICE_ROLE_KEY en web/.env.local para subir imágenes desde el panel.",
    };
  }

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

  if (mErr || !mem?.organization_id) return { error: "No tenés una productora asignada." };

  const orgId = mem.organization_id as string;
  const file = formData.get("file");
  if (!file || typeof file === "string" || file.size < 1) return { error: "Elegí un archivo de imagen." };
  if (file.size > EVENT_COVER_MAX_BYTES) {
    const mb = (EVENT_COVER_MAX_BYTES / (1024 * 1024)).toFixed(0);
    return { error: `La imagen es demasiado pesada. Máximo ${mb} MB.` };
  }
  const mime = file.type || "application/octet-stream";
  if (!COVER_MIME.has(mime)) return { error: "Usá JPG, PNG o WebP." };

  const buf = Buffer.from(await file.arrayBuffer());
  const id = crypto.randomUUID();
  const ext = extFromCoverMime(mime);
  const path = `${orgId}/${id}.${ext}`;

  const { error: upErr } = await admin.storage.from("event_covers").upload(path, buf, {
    contentType: mime,
    upsert: false,
  });

  if (upErr) {
    if (/bucket|not found|Bucket not found/i.test(upErr.message)) {
      return {
        error:
          "Falta el bucket event_covers en Supabase. Ejecutá supabase/event-covers-storage.sql en el SQL Editor.",
      };
    }
    return { error: upErr.message };
  }

  const { data } = admin.storage.from("event_covers").getPublicUrl(path);
  const publicUrl = data?.publicUrl;
  if (!publicUrl) return { error: "No se pudo obtener la URL pública de la imagen." };

  return { ok: true, publicUrl };
}

function parseOptionalDate(value: string): string | null {
  const v = value.trim();
  if (!v) return null;
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

export async function bootstrapOrganization(formData: FormData): Promise<ActionResult> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser();
  if (userErr || !user) return err("No hay sesión. Iniciá sesión de nuevo.");

  const { count, error: cntErr } = await supabase
    .from("org_members")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user.id);
  if (!cntErr && count && count > 0) {
    return { ok: true };
  }

  const name = String(formData.get("name") || "").trim();
  if (!name) return err("El nombre es obligatorio.");

  const slugAlloc = await allocateOrganizationSlug(supabase, name);
  if (!slugAlloc.ok) return err(slugAlloc.message);
  const slug = slugAlloc.slug;

  const contact = user.email ?? "";

  const { data: orgId, error: rpcErr } = await supabase.rpc("bootstrap_organization", {
    p_name: name,
    p_slug: slug,
    p_contact_email: contact,
  });

  if (rpcErr) {
    if (rpcErr.code === "23505" || /duplicate key|unique constraint/i.test(rpcErr.message ?? "")) {
      return err("No se pudo crear la productora: la ruta ya está ocupada. Probá de nuevo o variá un poco el nombre.");
    }
    if (/function public\.bootstrap_organization|does not exist|schema cache/i.test(rpcErr.message ?? "")) {
      return err(
        "Falta la función SQL bootstrap_organization en Supabase. Ejecutá supabase/hotfix-bootstrap-organization-rpc.sql (o policies-mvp.sql actualizado) en el SQL Editor.",
      );
    }
    return err(rpcErr.message);
  }

  if (!orgId) return err("No se pudo crear la productora.");

  const admin = createSupabaseServiceRoleClient();
  if (admin) {
    await admin.from("org_access_requests").upsert({
      organization_id: String(orgId),
      user_id: user.id,
      last_seen_at: new Date().toISOString(),
    });
  }

  revalidatePath("/app", "layout");
  return { ok: true };
}

function isEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

/** Datos de la productora editables por owner/admin (nombre, contacto, CUIT). El slug se asigna siempre desde el nombre. */
export async function updateOrganizationProfile(formData: FormData): Promise<ActionResult> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser();
  if (userErr || !user) return err("No hay sesión.");

  const { data: mem, error: mErr } = await supabase
    .from("org_members")
    .select("organization_id, role")
    .eq("user_id", user.id)
    .maybeSingle();

  if (mErr || !mem?.organization_id) return err("No tenés una productora asignada.");

  const role = String(mem.role ?? "");
  if (role !== "owner" && role !== "admin") {
    return err("Solo el dueño o un administrador de la productora puede editar estos datos.");
  }

  const orgId = mem.organization_id as string;
  const name = String(formData.get("name") || "").trim();
  if (!name) return err("El nombre de la productora es obligatorio.");

  const slugAlloc = await allocateOrganizationSlug(supabase, name, orgId);
  if (!slugAlloc.ok) return err(slugAlloc.message);
  const slug = slugAlloc.slug;

  const contact_email = String(formData.get("contact_email") || "").trim();
  if (!contact_email) return err("El email de contacto es obligatorio.");
  if (!isEmail(contact_email)) return err("Email de contacto inválido.");

  const cuitRaw = String(formData.get("cuit") || "").trim();
  const cuit = cuitRaw ? cuitRaw.slice(0, 20) : null;

  const { error: upErr } = await supabase
    .from("organizations")
    .update({
      name,
      slug,
      contact_email,
      cuit,
    })
    .eq("id", orgId);

  if (upErr) {
    if (upErr.code === "23505" || /duplicate key|unique constraint/i.test(upErr.message ?? "")) {
      return err("No se pudo actualizar: conflicto de ruta. Probá de nuevo o variá el nombre.");
    }
    return err(upErr.message);
  }

  revalidatePath("/app/perfil");
  revalidatePath("/app", "layout");
  revalidatePath("/app/eventos", "layout");
  return { ok: true };
}

export async function createEvent(formData: FormData): Promise<CreateEventResult> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser();
  if (userErr || !user) return errCreate("No hay sesión.");

  const { data: memberships, error: mErr } = await supabase
    .from("org_members")
    .select("organization_id")
    .eq("user_id", user.id)
    .limit(1);

  if (mErr || !memberships?.length) return errCreate("No tenés una productora asignada.");

  const organizationId = memberships[0].organization_id as string;

  const eventName = String(formData.get("name") || "").trim();
  const eventSlug = slugify(eventName);
  const mpAlias = String(formData.get("mp_alias") || "").trim();
  const place = String(formData.get("place") || "").trim();
  const description = String(formData.get("description") || "").trim() || null;
  const cover_image_url = String(formData.get("cover_image_url") || "").trim() || null;
  const startsAtRaw = String(formData.get("starts_at") || "").trim();
  let starts_at: string | null = null;
  if (startsAtRaw) {
    const d = new Date(startsAtRaw);
    if (Number.isNaN(d.getTime())) return errCreate("Fecha y hora del evento inválida.");
    starts_at = d.toISOString();
  }

  if (!eventName) return errCreate("Nombre del evento obligatorio.");
  if (!mpAlias) return errCreate("Alias/CBU de Mercado Pago obligatorio.");
  if (!eventSlug) return errCreate("Slug del evento inválido (revisá el nombre).");

  const { data: inserted, error: evErr } = await supabase
    .from("events")
    .insert({
      organization_id: organizationId,
      slug: eventSlug,
      name: eventName,
      place: place || null,
      description,
      cover_image_url,
      catalog_flair: null,
      starts_at,
      mp_alias: mpAlias,
      organizer_email: user.email ?? null,
    })
    .select("id")
    .single();

  if (evErr) {
    if (evErr.code === "23505") return errCreate("Ya existe un evento con ese slug en tu productora.");
    return errCreate(evErr.message);
  }

  const eventId = inserted?.id as string | undefined;
  if (!eventId) return errCreate("No se pudo obtener el id del evento creado.");

  revalidatePath("/app/eventos");
  revalidatePath(`/app/eventos/${eventId}/entradas`);
  revalidatePath("/");
  return { ok: true, eventId };
}

export async function updateEventDetails(formData: FormData): Promise<ActionResult> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser();
  if (userErr || !user) return err("No hay sesión.");

  const eventId = String(formData.get("event_id") || "").trim();
  if (!UUID_RE.test(eventId)) return err("Evento inválido.");

  const { data: ev, error: evErr } = await supabase
    .from("events")
    .select("id, organization_id")
    .eq("id", eventId)
    .maybeSingle();

  if (evErr || !ev) return err("Evento no encontrado.");

  const { data: mem, error: memErr } = await supabase
    .from("org_members")
    .select("organization_id")
    .eq("user_id", user.id)
    .eq("organization_id", ev.organization_id as string)
    .maybeSingle();

  if (memErr || !mem) return err("No tenés permiso para editar este evento.");

  const place = String(formData.get("place") || "").trim() || null;
  const description = String(formData.get("description") || "").trim() || null;
  const cover_image_url = String(formData.get("cover_image_url") || "").trim() || null;
  const catalog_flair = String(formData.get("catalog_flair") || "").trim().slice(0, 48) || null;
  const startsAtRaw = String(formData.get("starts_at") || "").trim();
  let starts_at: string | null = null;
  if (startsAtRaw) {
    const d = new Date(startsAtRaw);
    if (Number.isNaN(d.getTime())) return err("Fecha y hora del evento inválida.");
    starts_at = d.toISOString();
  }

  const { error: upErr } = await supabase
    .from("events")
    .update({
      place,
      description,
      cover_image_url,
      catalog_flair,
      starts_at,
      updated_at: new Date().toISOString(),
    })
    .eq("id", eventId);

  if (upErr) return err(upErr.message);

  revalidatePath("/app/eventos");
  revalidatePath(`/app/eventos/${eventId}/editar`);
  revalidatePath("/");
  return { ok: true };
}

function revalidateEntradas(eventId: string) {
  revalidatePath(`/app/eventos/${eventId}/entradas`);
  revalidatePath("/app/eventos");
  revalidatePath("/");
}

export async function createTicketType(formData: FormData): Promise<ActionResult> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser();
  if (userErr || !user) return err("No hay sesión.");

  const eventId = String(formData.get("event_id") || "").trim();
  if (!isUuid(eventId)) return err("Evento inválido.");

  const { data: eventRow, error: evErr } = await supabase.from("events").select("id").eq("id", eventId).maybeSingle();
  if (evErr || !eventRow) return err("Evento no encontrado o sin acceso.");

  const name = String(formData.get("name") || "").trim();
  let slug = String(formData.get("slug") || "").trim();
  const description = String(formData.get("description") || "").trim();
  const priceRaw = String(formData.get("price_ars") || "").trim();
  const stockRaw = String(formData.get("stock_total") || "").trim();
  const salesEndsRaw = String(formData.get("sales_ends_at") || "");
  const isActive = formData.get("is_active") === "on";

  if (!name) return err("El nombre es obligatorio.");
  if (!slug) slug = slugify(name);
  else slug = slugify(slug);
  if (!slug) return err("Slug inválido.");

  const price = Number(priceRaw.replace(",", "."));
  if (!Number.isFinite(price) || price < 0) return err("Precio inválido.");

  const stock = Number.parseInt(stockRaw, 10);
  if (!Number.isFinite(stock) || stock < 0 || String(stock) !== String(Math.trunc(stock))) {
    return err("Stock debe ser un entero mayor o igual a 0.");
  }

  const salesEndsAt = parseOptionalDate(salesEndsRaw);

  const { error: insErr } = await supabase.from("ticket_types").insert({
    event_id: eventId,
    slug,
    name,
    description: description || null,
    price_ars: price,
    stock_total: stock,
    sales_ends_at: salesEndsAt,
    is_active: isActive,
  });

  if (insErr) {
    if (insErr.code === "23505") return err("Ya existe un tipo de entrada con ese slug en este evento.");
    return err(insErr.message);
  }

  revalidateEntradas(eventId);
  return { ok: true };
}

export async function updateTicketType(formData: FormData): Promise<ActionResult> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser();
  if (userErr || !user) return err("No hay sesión.");

  const ticketTypeId = String(formData.get("ticket_type_id") || "").trim();
  const eventId = String(formData.get("event_id") || "").trim();
  if (!isUuid(ticketTypeId) || !isUuid(eventId)) return err("Datos inválidos.");

  const { data: existing, error: exErr } = await supabase
    .from("ticket_types")
    .select("id, event_id")
    .eq("id", ticketTypeId)
    .maybeSingle();

  if (exErr || !existing || (existing as { event_id: string }).event_id !== eventId) {
    return err("Tipo de entrada no encontrado o no pertenece a este evento.");
  }

  const name = String(formData.get("name") || "").trim();
  let slug = String(formData.get("slug") || "").trim();
  const description = String(formData.get("description") || "").trim();
  const priceRaw = String(formData.get("price_ars") || "").trim();
  const stockRaw = String(formData.get("stock_total") || "").trim();
  const salesEndsRaw = String(formData.get("sales_ends_at") || "");
  const isActive = formData.get("is_active") === "on";

  if (!name) return err("El nombre es obligatorio.");
  if (!slug) slug = slugify(name);
  else slug = slugify(slug);
  if (!slug) return err("Slug inválido.");

  const price = Number(priceRaw.replace(",", "."));
  if (!Number.isFinite(price) || price < 0) return err("Precio inválido.");

  const stock = Number.parseInt(stockRaw, 10);
  if (!Number.isFinite(stock) || stock < 0 || String(stock) !== String(Math.trunc(stock))) {
    return err("Stock debe ser un entero mayor o igual a 0.");
  }

  const salesEndsAt = parseOptionalDate(salesEndsRaw);

  const { error: upErr } = await supabase
    .from("ticket_types")
    .update({
      slug,
      name,
      description: description || null,
      price_ars: price,
      stock_total: stock,
      sales_ends_at: salesEndsAt,
      is_active: isActive,
      updated_at: new Date().toISOString(),
    })
    .eq("id", ticketTypeId);

  if (upErr) {
    if (upErr.code === "23505") return err("Ya existe un tipo de entrada con ese slug en este evento.");
    return err(upErr.message);
  }

  revalidateEntradas(eventId);
  return { ok: true };
}

export async function deleteTicketType(formData: FormData): Promise<ActionResult> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser();
  if (userErr || !user) return err("No hay sesión.");

  const ticketTypeId = String(formData.get("ticket_type_id") || "").trim();
  const eventId = String(formData.get("event_id") || "").trim();
  if (!isUuid(ticketTypeId) || !isUuid(eventId)) return err("Datos inválidos.");

  const { data: existing, error: exErr } = await supabase
    .from("ticket_types")
    .select("id, event_id")
    .eq("id", ticketTypeId)
    .maybeSingle();

  if (exErr || !existing || (existing as { event_id: string }).event_id !== eventId) {
    return err("Tipo de entrada no encontrado o no pertenece a este evento.");
  }

  const { error: delErr } = await supabase.from("ticket_types").delete().eq("id", ticketTypeId);

  if (delErr) {
    if (delErr.code === "23503") {
      return err("No se puede eliminar: hay órdenes o ventas asociadas. Desactivá la venta en lugar de borrar.");
    }
    return err(delErr.message);
  }

  revalidateEntradas(eventId);
  return { ok: true };
}
