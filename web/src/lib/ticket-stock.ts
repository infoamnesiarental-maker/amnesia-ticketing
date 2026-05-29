import type { SupabaseClient } from "@supabase/supabase-js";

const RESERVED_ORDER_STATUSES = ["pending_validation", "validated", "manual_review"] as const;

export interface TicketTypeStockRow {
  id: string;
  name: string;
  price_ars: number;
  stock_total: number;
  available_qty: number;
}

/** Cupo disponible por tipo de entrada (stock menos órdenes reservadas/validadas). */
export async function loadTicketTypesWithAvailability(
  admin: SupabaseClient,
  eventId: string,
): Promise<{ types: TicketTypeStockRow[]; error?: string }> {
  const { data: types, error: typesErr } = await admin
    .from("ticket_types")
    .select("id, name, price_ars, stock_total, is_active, sales_ends_at")
    .eq("event_id", eventId)
    .eq("is_active", true)
    .order("created_at", { ascending: true });

  if (typesErr) return { types: [], error: typesErr.message };
  if (!types?.length) return { types: [] };

  const typeIds = types.map((t) => String(t.id));
  const { data: items, error: itemsErr } = await admin
    .from("order_items")
    .select("ticket_type_id, qty, orders!inner(status, event_id)")
    .eq("orders.event_id", eventId)
    .in("ticket_type_id", typeIds)
    .in("orders.status", [...RESERVED_ORDER_STATUSES]);

  if (itemsErr) return { types: [], error: itemsErr.message };

  const soldByType = new Map<string, number>();
  for (const row of items ?? []) {
    const tid = String((row as { ticket_type_id: string }).ticket_type_id);
    const qty = Number((row as { qty: number }).qty) || 0;
    soldByType.set(tid, (soldByType.get(tid) ?? 0) + qty);
  }

  const now = Date.now();
  const rows: TicketTypeStockRow[] = [];

  for (const t of types) {
    const endsAt = t.sales_ends_at as string | null;
    if (endsAt && new Date(endsAt).getTime() <= now) continue;

    const id = String(t.id);
    const stock = Number(t.stock_total) || 0;
    const sold = soldByType.get(id) ?? 0;
    const available = Math.max(0, stock - sold);
    if (available < 1) continue;

    rows.push({
      id,
      name: String(t.name),
      price_ars: Number(t.price_ars),
      stock_total: stock,
      available_qty: available,
    });
  }

  return { types: rows };
}
