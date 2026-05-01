export interface PublicEventListItem {
  org_slug: string;
  org_name: string;
  event_slug: string;
  event_name: string;
  place: string | null;
  starts_at: string | null;
  cover_image_url: string | null;
  catalog_flair: string | null;
  description_preview: string | null;
  from_price_ars: number;
  to_price_ars: number | null;
  tickets_available: number;
}

export function parsePublicEventsCatalog(raw: unknown): PublicEventListItem[] {
  if (!Array.isArray(raw)) return [];
  const out: PublicEventListItem[] = [];
  for (const row of raw) {
    if (typeof row !== "object" || row === null) continue;
    const r = row as Record<string, unknown>;
    const org_slug = String(r.org_slug ?? "");
    const event_slug = String(r.event_slug ?? "");
    const event_name = String(r.event_name ?? "");
    const org_name = String(r.org_name ?? "");
    if (!org_slug || !event_slug) continue;
    const from_price_ars = Number(r.from_price_ars);
    if (!Number.isFinite(from_price_ars)) continue;
    const toRaw = r.to_price_ars;
    const to_price_ars =
      toRaw == null || toRaw === "" ? null : Number(toRaw);
    const tickets_available = Math.max(0, Math.floor(Number(r.tickets_available ?? 0)));
    out.push({
      org_slug,
      org_name,
      event_slug,
      event_name,
      place: r.place == null ? null : String(r.place),
      starts_at: r.starts_at == null ? null : String(r.starts_at),
      cover_image_url:
        r.cover_image_url == null || r.cover_image_url === "" ? null : String(r.cover_image_url),
      catalog_flair:
        r.catalog_flair == null || String(r.catalog_flair).trim() === ""
          ? null
          : String(r.catalog_flair).trim(),
      description_preview:
        r.description_preview == null || String(r.description_preview).trim() === ""
          ? null
          : String(r.description_preview).trim(),
      from_price_ars,
      to_price_ars:
        to_price_ars != null && Number.isFinite(to_price_ars) ? to_price_ars : null,
      tickets_available: Number.isFinite(tickets_available) ? tickets_available : 0,
    });
  }
  return out;
}
