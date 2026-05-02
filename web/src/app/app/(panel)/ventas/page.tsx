import { redirect } from "next/navigation";

import { requireSupabaseServiceRoleClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

import { Cockpit, type OrderListItem } from "./Cockpit";
import type { OrderDetail, OrderStatus } from "./OrderDetailPanel";

export const dynamic = "force-dynamic";

const FILTERS: Record<string, OrderStatus[]> = {
  todo: ["pending_validation", "manual_review"],
  validated: ["validated"],
  rejected: ["rejected", "cancelled"],
  all: ["pending_validation", "manual_review", "validated", "rejected", "cancelled"],
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

interface VentasPageProps {
  searchParams: Promise<{ filter?: string; selected?: string; event?: string; q?: string }>;
}

function normalizeAmount(s: string): string | null {
  const n = Number(s.replace(/[^0-9.,-]/g, "").replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) ? String(n) : null;
}

export default async function VentasPage({ searchParams }: VentasPageProps) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth?redirect=/app/ventas");

  const { data: membership, error: memErr } = await supabase
    .from("org_members")
    .select("organization_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (memErr || !membership?.organization_id) redirect("/app/onboarding");
  const orgId = membership.organization_id as string;

  const sp = await searchParams;
  const filterKey = sp?.filter && FILTERS[sp.filter] ? sp.filter : "todo";
  const selectedEventId = sp?.event && UUID_RE.test(sp.event) ? sp.event : "";
  const query = (sp?.q ?? "").trim();
  const selectedFromUrl = sp?.selected && UUID_RE.test(sp.selected) ? sp.selected : "";

  const admin = requireSupabaseServiceRoleClient();

  const { data: eventsRows } = await admin
    .from("events")
    .select("id, name")
    .eq("organization_id", orgId)
    .order("created_at", { ascending: false });

  const events = (eventsRows ?? []).map((e) => ({
    id: String((e as { id: string }).id),
    name: String((e as { name: string }).name),
  }));
  const eventIds = events.map((e) => e.id);

  if (eventIds.length === 0) {
    return (
      <div className="mx-auto max-w-lg text-center md:mx-0 md:max-w-none md:text-left">
        <h1 className="text-2xl font-bold text-white">Ventas</h1>
        <p className="mt-2 text-sm text-white/65">
          Todavía no tenés eventos. Creá uno para empezar a recibir órdenes.
        </p>
      </div>
    );
  }

  const eventIdsScope = selectedEventId && eventIds.includes(selectedEventId) ? [selectedEventId] : eventIds;

  let qb = admin
    .from("orders")
    .select(
      "id, event_id, status, buyer_first_name, buyer_last_name, total_qty, total_ars, created_at, events(name)",
    )
    .in("event_id", eventIdsScope)
    .in("status", FILTERS[filterKey])
    .order("created_at", { ascending: false })
    .limit(150);

  if (query.length > 0) {
    const amount = normalizeAmount(query);
    const orParts: string[] = [
      `buyer_first_name.ilike.%${query}%`,
      `buyer_last_name.ilike.%${query}%`,
      `buyer_email.ilike.%${query}%`,
      `buyer_dni.ilike.%${query}%`,
      `buyer_phone.ilike.%${query}%`,
    ];
    if (amount !== null) orParts.push(`total_ars.eq.${amount}`);
    qb = qb.or(orParts.join(","));
  }

  const { data: ordersRaw, error: ordErr } = await qb;

  if (ordErr) {
    return (
      <div className="mx-auto max-w-2xl rounded-xl border border-red-400/40 bg-red-500/10 p-4 text-center text-sm text-red-200 md:text-left">
        No se pudieron cargar ventas. {ordErr.message}
      </div>
    );
  }

  const orders: OrderListItem[] = (ordersRaw ?? []).map((o) => {
    const r = o as unknown as {
      id: string;
      event_id: string;
      status: OrderStatus;
      buyer_first_name: string;
      buyer_last_name: string;
      total_qty: number;
      total_ars: number;
      created_at: string;
      events: { name: string } | { name: string }[] | null;
    };
    const ev = Array.isArray(r.events) ? r.events[0] : r.events;
    return {
      id: r.id,
      event_id: r.event_id,
      status: r.status,
      buyer_first_name: r.buyer_first_name,
      buyer_last_name: r.buyer_last_name,
      total_qty: Number(r.total_qty),
      total_ars: Number(r.total_ars),
      created_at: r.created_at,
      event_name: ev?.name ?? null,
    };
  });

  const { data: countsRaw } = await admin
    .from("orders")
    .select("status")
    .in("event_id", eventIdsScope);

  const statusCounts: Record<string, number> = {};
  for (const r of countsRaw ?? []) {
    const s = String((r as { status: string }).status);
    statusCounts[s] = (statusCounts[s] ?? 0) + 1;
  }
  const filterCounts: Record<string, number> = {};
  for (const k of Object.keys(FILTERS)) {
    filterCounts[k] = FILTERS[k].reduce((sum, s) => sum + (statusCounts[s] ?? 0), 0);
  }

  // Auto-select primera orden si no hay seleccionada
  let selectedId = selectedFromUrl && orders.find((o) => o.id === selectedFromUrl) ? selectedFromUrl : "";
  if (!selectedId && orders.length > 0) selectedId = orders[0].id;

  let selectedDetail: OrderDetail | null = null;

  if (selectedId) {
    const { data: dRow } = await admin
      .from("orders")
      .select(
        "id, event_id, status, created_at, validated_at, rejected_at, tickets_email_sent_at, buyer_first_name, buyer_last_name, buyer_dni, buyer_phone, buyer_email, total_qty, total_ars, proof_object_path, events(id, name, slug, organization_id)",
      )
      .eq("id", selectedId)
      .maybeSingle();

    const det = dRow as unknown as
      | {
          id: string;
          event_id: string;
          status: OrderStatus;
          created_at: string;
          validated_at: string | null;
          rejected_at: string | null;
          tickets_email_sent_at: string | null;
          buyer_first_name: string;
          buyer_last_name: string;
          buyer_dni: string;
          buyer_phone: string;
          buyer_email: string;
          total_qty: number;
          total_ars: number;
          proof_object_path: string;
          events: { id: string; name: string; slug: string; organization_id: string } | { id: string; name: string; slug: string; organization_id: string }[] | null;
        }
      | null;

    if (det) {
      const evRel = Array.isArray(det.events) ? det.events[0] : det.events;
      // Hardening: solo dejamos pasar si el evento pertenece a la org del usuario
      if (evRel && evRel.organization_id === orgId) {
        const { data: itemsRaw } = await admin
          .from("order_items")
          .select("qty, unit_price_ars, ticket_types(name)")
          .eq("order_id", det.id);

        const items = (itemsRaw ?? []).map((it) => {
          const r = it as unknown as {
            qty: number;
            unit_price_ars: number;
            ticket_types: { name: string } | { name: string }[] | null;
          };
          const tt = Array.isArray(r.ticket_types) ? r.ticket_types[0] : r.ticket_types;
          return { qty: Number(r.qty), unit: Number(r.unit_price_ars), name: tt?.name ?? "Entrada" };
        });

        let proofUrl: string | null = null;
        try {
          const { data: signed } = await admin.storage
            .from("proofs")
            .createSignedUrl(det.proof_object_path, 60 * 30);
          proofUrl = signed?.signedUrl ?? null;
        } catch {
          proofUrl = null;
        }

        selectedDetail = {
          id: det.id,
          status: det.status,
          created_at: det.created_at,
          validated_at: det.validated_at,
          rejected_at: det.rejected_at,
          tickets_email_sent_at: det.tickets_email_sent_at,
          buyer_first_name: det.buyer_first_name,
          buyer_last_name: det.buyer_last_name,
          buyer_dni: det.buyer_dni,
          buyer_phone: det.buyer_phone,
          buyer_email: det.buyer_email,
          total_qty: Number(det.total_qty),
          total_ars: Number(det.total_ars),
          proof_signed_url: proofUrl,
          event_name: evRel.name,
          event_slug: evRel.slug,
          items,
        };
      }
    }
  }

  return (
    <Cockpit
      orders={orders}
      selectedDetail={selectedDetail}
      filter={filterKey}
      filterCounts={filterCounts}
      events={events}
      selectedEvent={selectedEventId}
      query={query}
    />
  );
}
