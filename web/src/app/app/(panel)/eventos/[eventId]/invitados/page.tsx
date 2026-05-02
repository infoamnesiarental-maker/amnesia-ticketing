import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { requireSupabaseServiceRoleClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

import { ExportCsvButton } from "./ExportCsvButton";

export const dynamic = "force-dynamic";

const money = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 2,
});

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  validated: { label: "Confirmado", cls: "bg-emerald-500/15 text-emerald-200 border-emerald-500/30" },
  manual_review: { label: "En revisión", cls: "bg-violet-500/15 text-violet-200 border-violet-500/30" },
  pending_validation: { label: "Esperando pago", cls: "bg-amber-500/10 text-amber-200 border-amber-500/30" },
};

interface AttendeeAdminRow {
  order_id: string;
  attendee_position: number;
  first_name: string;
  last_name: string;
  dni: string;
  phone: string | null;
  is_buyer: boolean;
  buyer_email: string;
  buyer_phone: string;
  unit_price_ars: number;
  status: string;
  created_at: string;
  validated_at: string | null;
}

interface PageProps {
  params: Promise<{ eventId: string }>;
  searchParams: Promise<{ q?: string; status?: string }>;
}

const STATUS_FILTERS = [
  { key: "all", label: "Todos" },
  { key: "validated", label: "Confirmados" },
  { key: "pending", label: "Pendientes" },
] as const;

function formatDate(iso: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("es-AR", { dateStyle: "short", timeStyle: "short" });
}

export default async function AdminInvitadosPage({ params, searchParams }: PageProps) {
  const { eventId } = await params;
  const sp = await searchParams;
  const q = (sp?.q ?? "").trim().toLowerCase();
  const statusFilter = sp?.status && STATUS_FILTERS.some((s) => s.key === sp.status) ? sp.status : "all";

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/auth?redirect=/app/eventos/${eventId}/invitados`);

  const { data: mem } = await supabase
    .from("org_members")
    .select("organization_id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!mem?.organization_id) redirect("/app/onboarding");

  const admin = requireSupabaseServiceRoleClient();
  const { data: ev } = await admin
    .from("events")
    .select("id, name, slug, place, starts_at, organization_id, organizations!inner(slug)")
    .eq("id", eventId)
    .maybeSingle();

  const evRow = ev as
    | { id: string; name: string; slug: string; organization_id: string; organizations: { slug: string } | { slug: string }[] | null }
    | null;

  if (!evRow || evRow.organization_id !== mem.organization_id) {
    notFound();
  }

  const orgRel = Array.isArray(evRow.organizations) ? evRow.organizations[0] : evRow.organizations;
  const orgSlug = orgRel?.slug ?? "";

  const { data, error } = await admin.rpc("get_event_attendees_admin", { p_event_id: eventId });

  if (error) {
    return (
      <main>
        <h1 className="text-2xl font-bold text-white">Invitados</h1>
        <div className="mt-4 rounded-xl border border-red-400/40 bg-red-500/10 p-4 text-sm text-red-200">
          No se pudo cargar la lista. {error.message}
          {error.message.includes("get_event_attendees_admin") || error.message.includes("function") ? (
            <p className="mt-2 text-xs text-red-100">
              Ejecutá <code className="text-white">supabase/update-attendees-with-dni.sql</code> en el SQL Editor.
            </p>
          ) : null}
        </div>
      </main>
    );
  }

  const allRows = (data ?? []) as AttendeeAdminRow[];

  const filteredByStatus = allRows.filter((r) => {
    if (statusFilter === "validated") return r.status === "validated";
    if (statusFilter === "pending") return r.status === "manual_review" || r.status === "pending_validation";
    return true;
  });

  const filtered = q
    ? filteredByStatus.filter(
        (r) =>
          r.first_name.toLowerCase().includes(q) ||
          r.last_name.toLowerCase().includes(q) ||
          r.dni.toLowerCase().includes(q) ||
          r.buyer_email.toLowerCase().includes(q) ||
          (r.phone ?? "").toLowerCase().includes(q) ||
          r.buyer_phone.toLowerCase().includes(q),
      )
    : filteredByStatus;

  // KPIs (sobre el total de la lista, no del filtro). Cada fila = 1 asistente.
  const validatedRows = allRows.filter((r) => r.status === "validated");
  const pendingRows = allRows.filter(
    (r) => r.status === "manual_review" || r.status === "pending_validation",
  );

  const validatedGuests = validatedRows.length;
  const validatedRevenue = validatedRows.reduce((sum, r) => sum + Number(r.unit_price_ars), 0);
  const pendingGuests = pendingRows.length;
  const pendingRevenue = pendingRows.reduce((sum, r) => sum + Number(r.unit_price_ars), 0);
  const expectedRevenue = validatedRevenue + pendingRevenue;
  const validatedBuyers = new Set(validatedRows.map((r) => r.order_id)).size;
  const pendingBuyers = new Set(pendingRows.map((r) => r.order_id)).size;
  const totalAttendees = allRows.length;
  const eventName = evRow.name;
  const eventSlug = evRow.slug;

  return (
    <div className="mx-auto w-full max-w-6xl md:mx-0">
      <div className="flex flex-wrap items-center justify-center gap-3 text-xs text-white/55 md:justify-start">
        <Link href="/app/eventos" className="hover:text-white">
          Eventos
        </Link>
        <span>/</span>
        <Link href={`/app/eventos/${eventId}/editar`} className="hover:text-white">
          {eventName}
        </Link>
        <span>/</span>
        <span>Invitados</span>
      </div>

      <div className="mt-3 flex flex-col items-center gap-3 text-center sm:flex-row sm:items-end sm:justify-between sm:text-left">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-white">Invitados · {eventName}</h1>
          <p className="mt-1 text-sm text-white/65">Lista privada de invitados con DNI completo para control de acceso.</p>
        </div>
        <ExportCsvButton rows={allRows} eventName={eventName} />
      </div>

      {/* KPIs */}
      <section className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="surface-glass p-5 text-center sm:text-left">
          <p className="text-xs uppercase tracking-wider text-white/55">Confirmados</p>
          <p className="mt-1 text-3xl font-bold text-emerald-200 tabular-nums">{validatedGuests}</p>
          <p className="mt-1 text-[11px] text-white/50">de {validatedBuyers} compradores</p>
        </div>
        <div className="surface-glass p-5 text-center sm:text-left">
          <p className="text-xs uppercase tracking-wider text-white/55">Recaudado</p>
          <p className="mt-1 text-3xl font-bold text-emerald-200 tabular-nums">
            {money.format(validatedRevenue)}
          </p>
          <p className="mt-1 text-[11px] text-white/50">de las órdenes confirmadas</p>
        </div>
        <div className="surface-glass p-5 text-center sm:text-left">
          <p className="text-xs uppercase tracking-wider text-white/55">Pendientes</p>
          <p className="mt-1 text-3xl font-bold text-amber-200 tabular-nums">{pendingGuests}</p>
          <p className="mt-1 text-[11px] text-white/50">de {pendingBuyers} compradores</p>
        </div>
        <div className="surface-glass p-5 text-center sm:text-left">
          <p className="text-xs uppercase tracking-wider text-white/55">Esperado</p>
          <p className="mt-1 text-3xl font-bold text-white tabular-nums">
            {money.format(expectedRevenue)}
          </p>
          <p className="mt-1 text-[11px] text-white/50">si se confirman todas</p>
        </div>
      </section>

      {/* Filtros */}
      <div className="mt-6 flex flex-col gap-3 sm:grid sm:grid-cols-[auto_1fr]">
        <nav className="flex flex-wrap justify-center gap-2 sm:justify-start">
          {STATUS_FILTERS.map((s) => {
            const active = s.key === statusFilter;
            const count =
              s.key === "all"
                ? allRows.length
                : s.key === "validated"
                  ? validatedRows.length
                  : pendingRows.length;
            return (
              <Link
                key={s.key}
                href={`/app/eventos/${eventId}/invitados?status=${s.key}${q ? `&q=${encodeURIComponent(q)}` : ""}`}
                className={
                  active
                    ? "rounded-full border border-brand/60 bg-brand/15 px-3 py-1.5 text-xs font-medium text-white"
                    : "rounded-full border border-white/15 px-3 py-1.5 text-xs text-white/65 hover:bg-white/5"
                }
              >
                {s.label} <span className="opacity-60">({count})</span>
              </Link>
            );
          })}
        </nav>
        <form>
          <input type="hidden" name="status" value={statusFilter} />
          <input
            name="q"
            type="search"
            placeholder="Buscar nombre, DNI, email o teléfono…"
            defaultValue={q}
            className="input-design h-10"
          />
        </form>
      </div>

      <p className="mt-4 text-center text-xs text-white/55 sm:text-left">
        Mostrando <span className="text-white">{filtered.length}</span> de {totalAttendees} asistentes.
      </p>

      <section className="mt-3 surface-glass overflow-hidden">
        {filtered.length === 0 ? (
          <p className="p-6 text-sm text-white/65">Sin resultados.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-white/5 text-[11px] uppercase tracking-wider text-white/55">
                <tr>
                  <th className="px-4 py-2.5 font-medium">Apellido y nombre</th>
                  <th className="px-4 py-2.5 font-medium">DNI</th>
                  <th className="px-4 py-2.5 font-medium">Contacto del comprador</th>
                  <th className="px-4 py-2.5 text-right font-medium">Precio</th>
                  <th className="px-4 py-2.5 font-medium">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filtered.map((r) => {
                  const badge =
                    STATUS_BADGE[r.status] ?? { label: r.status, cls: "bg-white/10 text-white/70 border-white/15" };
                  return (
                    <tr key={`${r.order_id}-${r.attendee_position}`} className="hover:bg-white/[0.04]">
                      <td className="px-4 py-2.5">
                        <p className="font-medium text-white">
                          {r.last_name}, {r.first_name}
                          {r.is_buyer ? (
                            <span className="ml-2 rounded-full border border-brand/40 bg-brand/10 px-1.5 py-0.5 text-[10px] text-brand">
                              comprador
                            </span>
                          ) : null}
                        </p>
                        <p className="text-[11px] text-white/45">
                          Compra del {formatDate(r.created_at)}
                          {r.phone && !r.is_buyer ? ` · tel ${r.phone}` : ""}
                        </p>
                      </td>
                      <td className="px-4 py-2.5 font-mono text-white/80">{r.dni}</td>
                      <td className="px-4 py-2.5">
                        <a href={`mailto:${r.buyer_email}`} className="block text-white/85 hover:underline">
                          {r.buyer_email}
                        </a>
                        <span className="block text-[11px] text-white/55">{r.buyer_phone}</span>
                      </td>
                      <td className="px-4 py-2.5 text-right text-white tabular-nums">
                        {money.format(Number(r.unit_price_ars))}
                      </td>
                      <td className="px-4 py-2.5">
                        <span className={`rounded-full border px-2 py-0.5 text-xs ${badge.cls}`}>
                          {badge.label}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <div className="mt-4 flex flex-wrap items-center justify-center gap-2 text-xs text-white/55 sm:justify-start">
        <Link href={`/app/ventas?event=${eventId}`} className="rounded-lg border border-white/15 px-3 py-1.5 hover:bg-white/5">
          Ir a validar pagos →
        </Link>
      </div>
    </div>
  );
}
