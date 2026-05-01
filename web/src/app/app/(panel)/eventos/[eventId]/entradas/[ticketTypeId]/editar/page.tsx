import { notFound, redirect } from "next/navigation";

import { TicketTypeForm, type TicketTypeFormInitial } from "@/components/TicketTypeForm";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function toDatetimeLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const h = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  return `${y}-${m}-${day}T${h}:${min}`;
}

export default async function EditarEntradaPage({
  params,
}: {
  params: Promise<{ eventId: string; ticketTypeId: string }>;
}) {
  const { eventId, ticketTypeId } = await params;

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth");

  const { data: event, error: evErr } = await supabase.from("events").select("id, name").eq("id", eventId).maybeSingle();
  if (evErr || !event) notFound();

  const { data: row, error: ttErr } = await supabase
    .from("ticket_types")
    .select("id, event_id, slug, name, description, price_ars, stock_total, sales_ends_at, is_active")
    .eq("id", ticketTypeId)
    .maybeSingle();

  if (ttErr || !row || (row as { event_id: string }).event_id !== eventId) notFound();

  const r = row as {
    id: string;
    slug: string;
    name: string;
    description: string | null;
    price_ars: number;
    stock_total: number;
    sales_ends_at: string | null;
    is_active: boolean;
  };

  const initial: TicketTypeFormInitial = {
    id: r.id,
    slug: r.slug,
    name: r.name,
    description: r.description,
    price_ars: Number(r.price_ars),
    stock_total: Number(r.stock_total),
    sales_ends_at_input: toDatetimeLocalInput(r.sales_ends_at),
    is_active: r.is_active,
  };

  const backHref = `/app/eventos/${eventId}/entradas`;

  return (
    <TicketTypeForm
      mode="edit"
      eventId={eventId}
      backHref={backHref}
      title={`Editar tipo · ${String(event.name)}`}
      initial={initial}
    />
  );
}
