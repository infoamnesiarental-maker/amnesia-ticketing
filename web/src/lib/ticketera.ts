export interface TicketeraOrganization {
  slug: string;
  name: string;
}

export interface TicketeraEvent {
  id: string;
  slug: string;
  name: string;
  place: string | null;
  starts_at: string | null;
  mp_alias: string;
  cover_image_url: string | null;
}

export interface TicketeraTicketType {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  price_ars: number;
  available_qty: number;
}

export interface TicketeraContext {
  organization: TicketeraOrganization;
  event: TicketeraEvent;
  ticket_types: TicketeraTicketType[];
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

export function parseTicketeraContext(data: unknown): TicketeraContext | null {
  if (!isRecord(data)) return null;
  const org = data.organization;
  const ev = data.event;
  const types = data.ticket_types;
  if (!isRecord(org) || !isRecord(ev)) return null;
  if (!Array.isArray(types)) return null;

  const organization: TicketeraOrganization = {
    slug: String(org.slug ?? ""),
    name: String(org.name ?? ""),
  };
  const event: TicketeraEvent = {
    id: String(ev.id ?? ""),
    slug: String(ev.slug ?? ""),
    name: String(ev.name ?? ""),
    place: ev.place == null ? null : String(ev.place),
    starts_at: ev.starts_at == null ? null : String(ev.starts_at),
    mp_alias: String(ev.mp_alias ?? ""),
    cover_image_url:
      ev.cover_image_url == null || String(ev.cover_image_url).trim() === ""
        ? null
        : String(ev.cover_image_url),
  };
  if (!organization.slug || !event.id || !event.mp_alias) return null;

  const ticket_types: TicketeraTicketType[] = types.map((t) => {
    const r = t as Record<string, unknown>;
    return {
      id: String(r.id ?? ""),
      slug: String(r.slug ?? ""),
      name: String(r.name ?? ""),
      description: r.description == null ? null : String(r.description),
      price_ars: Number(r.price_ars),
      available_qty: Number(r.available_qty ?? 0),
    };
  });

  return { organization, event, ticket_types };
}
