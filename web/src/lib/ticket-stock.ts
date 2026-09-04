import type { SupabaseClient } from "@supabase/supabase-js";

const ALWAYS_RESERVED = new Set(["pending_validation", "validated", "manual_review"]);

function orderReservesStock(status: string, checkoutExpiresAt: string | null): boolean {
  if (ALWAYS_RESERVED.has(status)) return true;
  if (status !== "awaiting_payment") return false;
  if (!checkoutExpiresAt) return true;
  const t = new Date(checkoutExpiresAt).getTime();
  return Number.isFinite(t) && t > Date.now();
}

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
    .select("ticket_type_id, qty, orders!inner(status, event_id, checkout_expires_at)")
    .eq("orders.event_id", eventId)
    .in("ticket_type_id", typeIds)
    .in("orders.status", ["pending_validation", "validated", "manual_review", "awaiting_payment"]);

  if (itemsErr) return { types: [], error: itemsErr.message };

  const soldByType = new Map<string, number>();
  for (const row of items ?? []) {
    const r = row as unknown as {
      ticket_type_id: string;
      qty: number;
      orders:
        | { status: string; checkout_expires_at: string | null }
        | { status: string; checkout_expires_at: string | null }[]
        | null;
    };
    const ord = Array.isArray(r.orders) ? r.orders[0] : r.orders;
    if (!ord || !orderReservesStock(String(ord.status), ord.checkout_expires_at ?? null)) continue;
    const tid = String(r.ticket_type_id);
    const qty = Number(r.qty) || 0;
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
