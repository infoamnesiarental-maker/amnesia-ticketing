import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { DeleteTicketTypeButton } from "@/components/DeleteTicketTypeButton";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const money = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 2 });

function formatEndsAt(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("es-AR", { dateStyle: "short", timeStyle: "short" });
}

export default async function EntradasListPage({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth");

  const { data: event, error: evErr } = await supabase
    .from("events")
    .select("id, name, slug")
    .eq("id", eventId)
    .maybeSingle();

  if (evErr || !event) notFound();

  const { data: types, error: ttErr } = await supabase
    .from("ticket_types")
    .select("id, slug, name, price_ars, stock_total, sales_ends_at, is_active, created_at")
    .eq("event_id", eventId)
    .order("created_at", { ascending: true });

  if (ttErr) {
    return (
      <div className="rounded-xl border border-red-400/40 bg-red-500/10 p-4 text-sm text-red-200">
        No se pudieron cargar tipos de entrada. ¿Ejecutaste las políticas RLS para <code className="text-white">ticket_types</code>?{" "}
        {ttErr.message}
      </div>
    );
  }

  const eventName = event.name as string;
  const base = `/app/eventos/${eventId}/entradas`;

  return (
    <div>
      <Link href="/app/eventos" className="text-sm text-white/60 hover:text-white">
        ← Eventos
      </Link>
      <div className="mt-4 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold text-white">Tipos de entrada</h1>
          <p className="mt-1 text-sm text-white/65">
            Evento: <span className="text-white">{eventName}</span>{" "}
            <span className="font-mono text-white/50">({String(event.slug)})</span>
          </p>
        </div>
        <Link href={`${base}/nuevo`} className="btn-cta-primary w-fit justify-center">
          Nuevo tipo
        </Link>
      </div>

      <ul className="mt-8 grid gap-3">
        {(types ?? []).length === 0 ? (
          <li className="surface-glass p-6 text-sm text-white/70">
            Todavía no hay tipos de entrada. Creá el primero para poder vender cuando exista la ticketera pública.
          </li>
        ) : (
          (types ?? []).map((t) => (
            <li
              key={t.id as string}
              className="surface-glass flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-semibold text-white">{t.name as string}</p>
                  {(t.is_active as boolean) ? (
                    <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs text-emerald-200">Activo</span>
                  ) : (
                    <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs text-white/55">Pausado</span>
                  )}
                </div>
                <p className="mt-1 text-xs text-white/55">
                  slug: <span className="font-mono">{t.slug as string}</span> · fin venta:{" "}
                  {formatEndsAt((t.sales_ends_at as string | null) ?? null)}
                </p>
                <p className="mt-2 text-sm text-white/80">
                  {money.format(Number(t.price_ars))} · stock {String(t.stock_total)}
                </p>
              </div>
              <div className="flex shrink-0 flex-wrap gap-2">
                <Link
                  href={`${base}/${String(t.id)}/editar`}
                  className="rounded-lg border border-white/20 px-3 py-1.5 text-xs text-white/90 hover:bg-white/5"
                >
                  Editar
                </Link>
                <DeleteTicketTypeButton eventId={eventId} ticketTypeId={String(t.id)} label={String(t.name)} />
              </div>
            </li>
          ))
        )}
      </ul>
    </div>
  );
}
