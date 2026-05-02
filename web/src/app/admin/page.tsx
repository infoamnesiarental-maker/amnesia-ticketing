import { createSupabaseServiceRoleClient } from "@/lib/supabase/admin";

type OrderStatus = "pending_validation" | "validated" | "manual_review" | "rejected" | "cancelled";

const money = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 2 });

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("es-AR", { dateStyle: "short", timeStyle: "short" });
}

function statusPill(status: string) {
  const s = status as OrderStatus;
  const cls =
    s === "validated"
      ? "bg-emerald-500/15 text-emerald-200 border-emerald-500/25"
      : s === "pending_validation"
        ? "bg-amber-500/15 text-amber-200 border-amber-500/25"
        : s === "manual_review"
          ? "bg-white/10 text-white/70 border-white/15"
          : "bg-red-500/10 text-red-200 border-red-400/25";
  return <span className={`rounded-full border px-2 py-0.5 text-xs ${cls}`}>{status}</span>;
}

export default async function AdminHomePage() {
  const admin = createSupabaseServiceRoleClient();

  if (!admin) {
    return (
      <div className="rounded-xl border border-amber-400/30 bg-amber-500/10 p-6 text-sm text-amber-50">
        Para ver métricas globales desde Admin, agregá <code className="text-white">SUPABASE_SERVICE_ROLE_KEY</code> en{" "}
        <code className="text-white">web/.env.local</code> y reiniciá.
      </div>
    );
  }

  const [
    { count: orgTotal = 0 },
    { count: orgPending = 0 },
    { count: orgApproved = 0 },
    { count: eventTotal = 0 },
    { count: orderTotal = 0 },
    { count: orderPending = 0 },
    { count: orderManual = 0 },
    { count: orderValidated = 0 },
  ] = await Promise.all([
    admin.from("organizations").select("*", { count: "exact", head: true }),
    admin.from("organizations").select("*", { count: "exact", head: true }).eq("status", "pending"),
    admin.from("organizations").select("*", { count: "exact", head: true }).eq("status", "approved"),
    admin.from("events").select("*", { count: "exact", head: true }),
    admin.from("orders").select("*", { count: "exact", head: true }),
    admin.from("orders").select("*", { count: "exact", head: true }).eq("status", "pending_validation"),
    admin.from("orders").select("*", { count: "exact", head: true }).eq("status", "manual_review"),
    admin.from("orders").select("*", { count: "exact", head: true }).eq("status", "validated"),
  ]);

  const [{ data: recentRequests }, { data: recentOrders }, { data: recentEvents }] = await Promise.all([
    admin
      .from("org_access_requests")
      .select("organization_id, last_seen_at, organizations(name, slug, status)")
      .order("last_seen_at", { ascending: false })
      .limit(8),
    admin
      .from("orders")
      .select("id, status, total_ars, buyer_first_name, buyer_last_name, buyer_email, created_at, events(name, slug)")
      .order("created_at", { ascending: false })
      .limit(8),
    admin
      .from("events")
      .select("id, name, slug, created_at, organizations(name, slug, status)")
      .order("created_at", { ascending: false })
      .limit(6),
  ]);

  // Estimación rápida: suma de últimos N pedidos validados
  const validatedSum = (recentOrders ?? [])
    .filter((o) => String((o as { status: string }).status) === "validated")
    .reduce((acc, o) => acc + Number((o as { total_ars: number }).total_ars ?? 0), 0);

  return (
    <div className="mx-auto w-full max-w-6xl md:mx-0">
      <div className="text-center md:text-left">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-amber-200/90">Vista general</p>
        <h1 className="mt-2 text-2xl font-bold text-white sm:text-3xl">Resumen operativo</h1>
        <p className="mx-auto mt-2 max-w-2xl text-sm text-white/65 md:mx-0">
          Un pantallazo del sistema: aprobación de productoras, actividad reciente, ventas/órdenes y últimas altas.
        </p>
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="surface-glass p-6">
          <p className="text-xs font-semibold uppercase tracking-wider text-white/50">Productoras</p>
          <p className="mt-3 text-3xl font-bold text-white">{orgTotal}</p>
          <p className="mt-2 text-sm text-white/65">
            Pendientes: <span className="text-amber-200">{orgPending}</span>
          </p>
        </div>

        <div className="surface-glass p-6">
          <p className="text-xs font-semibold uppercase tracking-wider text-white/50">Aprobadas</p>
          <p className="mt-3 text-3xl font-bold text-white">{orgApproved}</p>
          <p className="mt-2 text-sm text-white/65">Productoras habilitadas para operar.</p>
        </div>

        <div className="surface-glass p-6">
          <p className="text-xs font-semibold uppercase tracking-wider text-white/50">Eventos</p>
          <p className="mt-3 text-3xl font-bold text-white">{eventTotal}</p>
          <p className="mt-2 text-sm text-white/65">Total global.</p>
        </div>

        <div className="surface-glass p-6">
          <p className="text-xs font-semibold uppercase tracking-wider text-white/50">Órdenes</p>
          <p className="mt-3 text-3xl font-bold text-white">{orderTotal}</p>
          <p className="mt-2 text-sm text-white/65">
            Pendientes: <span className="text-amber-200">{orderPending}</span> · Manual:{" "}
            <span className="text-white/70">{orderManual}</span>
          </p>
        </div>
      </div>

      <div className="mt-10 grid gap-4 lg:grid-cols-3">
        <div className="surface-glass p-6 lg:col-span-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-white/50">Alertas operativas</p>
          <ul className="mt-4 space-y-2 text-sm text-white/80">
            <li>
              <span className="text-amber-200">{orgPending}</span> productora(s) pendiente(s) de aprobación.
            </li>
            <li>
              <span className="text-amber-200">{orderPending}</span> orden(es) pendiente(s) de validación.
            </li>
            <li>
              <span className="text-white/70">{orderManual}</span> orden(es) en revisión manual.
            </li>
            <li>
              Ingresos validados (últimas {String((recentOrders ?? []).length)} órdenes):{" "}
              <span className="text-emerald-200">{money.format(validatedSum)}</span>
            </li>
          </ul>
        </div>

        <div className="surface-glass p-6">
          <p className="text-xs font-semibold uppercase tracking-wider text-white/50">Actividad reciente</p>
          <ul className="mt-4 space-y-3 text-sm">
            {(recentRequests ?? []).length === 0 ? (
              <li className="text-white/55">Sin actividad registrada.</li>
            ) : (
              (recentRequests ?? []).map((r) => {
                const row = r as unknown as {
                  last_seen_at: string;
                  organizations: { name: string; slug: string; status: string } | { name: string; slug: string; status: string }[] | null;
                };
                const org = Array.isArray(row.organizations) ? row.organizations[0] ?? null : row.organizations;
                return (
                  <li key={`${String((r as { organization_id: string }).organization_id)}-${row.last_seen_at}`} className="text-white/80">
                    <p className="text-xs text-white/50">{formatDate(row.last_seen_at)}</p>
                    <p className="mt-1">
                      {org ? (
                        <>
                          <span className="text-white">{org.name}</span>{" "}
                          <span className="font-mono text-white/45">({org.slug})</span>
                        </>
                      ) : (
                        <span className="text-white">Org</span>
                      )}
                    </p>
                    <p className="mt-1 text-xs text-white/55">Login / solicitud</p>
                  </li>
                );
              })
            )}
          </ul>
        </div>
      </div>

      <div className="mt-10 grid gap-4 lg:grid-cols-2">
        <div className="surface-glass p-6">
          <p className="text-xs font-semibold uppercase tracking-wider text-white/50">Últimas órdenes</p>
          <ul className="mt-4 space-y-3">
            {(recentOrders ?? []).length === 0 ? (
              <li className="text-sm text-white/55">No hay órdenes.</li>
            ) : (
              (recentOrders ?? []).map((o) => {
                const row = o as unknown as {
                  id: string;
                  status: string;
                  total_ars: number;
                  buyer_first_name: string;
                  buyer_last_name: string;
                  buyer_email: string;
                  created_at: string;
                  events: { name: string; slug: string } | { name: string; slug: string }[] | null;
                };
                const ev = Array.isArray(row.events) ? row.events[0] ?? null : row.events;
                return (
                  <li key={row.id} className="flex flex-wrap items-start justify-between gap-3 border-b border-white/10 pb-3 last:border-b-0 last:pb-0">
                    <div className="min-w-0">
                      <p className="text-sm text-white">
                        {row.buyer_first_name} {row.buyer_last_name}{" "}
                        <span className="text-xs text-white/45">({row.buyer_email})</span>
                      </p>
                      <p className="mt-1 text-xs text-white/50">
                        {formatDate(row.created_at)} · {ev ? `${ev.name} (${ev.slug})` : "Evento"}
                      </p>
                      <div className="mt-2">{statusPill(row.status)}</div>
                    </div>
                    <p className="text-sm font-semibold text-white">{money.format(Number(row.total_ars))}</p>
                  </li>
                );
              })
            )}
          </ul>
        </div>

        <div className="surface-glass p-6">
          <p className="text-xs font-semibold uppercase tracking-wider text-white/50">Últimos eventos</p>
          <ul className="mt-4 space-y-3">
            {(recentEvents ?? []).length === 0 ? (
              <li className="text-sm text-white/55">No hay eventos.</li>
            ) : (
              (recentEvents ?? []).map((e) => {
                const row = e as unknown as {
                  id: string;
                  name: string;
                  slug: string;
                  created_at: string;
                  organizations: { name: string; slug: string; status: string } | { name: string; slug: string; status: string }[] | null;
                };
                const org = Array.isArray(row.organizations) ? row.organizations[0] ?? null : row.organizations;
                return (
                  <li key={row.id} className="flex flex-col gap-1 border-b border-white/10 pb-3 last:border-b-0 last:pb-0">
                    <p className="text-sm font-semibold text-white">{row.name}</p>
                    <p className="text-xs text-white/55">
                      <span className="font-mono">{row.slug}</span> · {formatDate(row.created_at)}
                    </p>
                    {org ? (
                      <p className="text-xs text-white/55">
                        Productora: <span className="text-white/75">{org.name}</span>{" "}
                        <span className="font-mono text-white/45">({org.slug})</span>
                      </p>
                    ) : null}
                  </li>
                );
              })
            )}
          </ul>
        </div>
      </div>
    </div>
  );
}
