import Link from "next/link";

import { createSupabaseServiceRoleClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ orgSlug: string; eventSlug: string }>;
  searchParams: Promise<{ q?: string }>;
}

interface AttendeeRow {
  first_name: string;
  last_name: string;
  dni: string;
  status: string;
  is_buyer: boolean;
  attendee_position: number;
  order_id: string;
  created_at: string;
}

const STATUS_BADGE: Record<string, string> = {
  validated: "Confirmado",
  manual_review: "En revisión",
  pending_validation: "Esperando pago",
};

function statusBadgeClass(status: string) {
  if (status === "validated") return "bg-emerald-500/15 text-emerald-200 border-emerald-500/30";
  if (status === "manual_review") return "bg-violet-500/15 text-violet-200 border-violet-500/30";
  return "bg-amber-500/10 text-amber-200 border-amber-500/30";
}

/** "12345678" → "1234***78" (deja primeros 4 y últimos 2) */
function maskDni(dni: string): string {
  const clean = dni.trim();
  if (clean.length <= 4) return "****";
  if (clean.length <= 6) return clean.slice(0, 2) + "***";
  return clean.slice(0, 4) + "***" + clean.slice(-2);
}

export default async function InvitadosPage({ params, searchParams }: PageProps) {
  const { orgSlug, eventSlug } = await params;
  const sp = await searchParams;
  const q = (sp?.q ?? "").trim().toLowerCase();
  const admin = createSupabaseServiceRoleClient();

  if (!admin) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-16 text-center">
        <h1 className="text-2xl font-bold text-white">Servicio no disponible</h1>
      </main>
    );
  }

  const { data: eventRow } = await admin
    .from("events")
    .select("id, name, slug, place, starts_at, organization_id, organizations!inner(name, slug, status)")
    .eq("slug", eventSlug)
    .maybeSingle();

  const ev = eventRow as unknown as
    | {
        id: string;
        name: string;
        slug: string;
        place: string | null;
        starts_at: string | null;
        organization_id: string;
        organizations: { name: string; slug: string; status: string } | { name: string; slug: string; status: string }[] | null;
      }
    | null;

  const org = ev ? (Array.isArray(ev.organizations) ? ev.organizations[0] : ev.organizations) : null;
  if (!ev || !org || org.slug !== orgSlug || org.status !== "approved") {
    return (
      <main className="mx-auto max-w-2xl px-4 py-16 text-center">
        <h1 className="text-2xl font-bold text-white">Evento no encontrado</h1>
        <Link href="/" className="mt-4 inline-block text-sm text-white/65 hover:text-white">
          Volver
        </Link>
      </main>
    );
  }

  const { data, error } = await admin.rpc("get_event_attendees", {
    p_org_slug: orgSlug,
    p_event_slug: eventSlug,
  });

  if (error) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-16">
        <p className="text-sm text-red-300">No se pudo cargar la lista. {error.message}</p>
      </main>
    );
  }

  const allRows = (data ?? []) as AttendeeRow[];

  const filtered = q
    ? allRows.filter(
        (r) =>
          r.first_name.toLowerCase().includes(q) ||
          r.last_name.toLowerCase().includes(q) ||
          r.dni.toLowerCase().includes(q),
      )
    : allRows;

  // Totales globales (no afectados por el buscador)
  const confirmedGuests = allRows.filter((r) => r.status === "validated").length;
  const reservedGuests = allRows.length;
  const validatedBuyers = new Set(
    allRows.filter((r) => r.status === "validated").map((r) => r.order_id),
  ).size;

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <div className="text-xs text-white/55">
        <Link href={`/e/${orgSlug}/${eventSlug}`} className="hover:text-white">
          ← Volver al evento
        </Link>
      </div>

      <header className="mt-4">
        <p className="text-xs text-white/55">{org.name}</p>
        <h1 className="mt-1 text-2xl font-bold text-white">{ev.name}</h1>
        <p className="mt-1 text-sm text-white/65">Lista de invitados</p>
      </header>

      <section className="mt-6 grid gap-3 sm:grid-cols-3">
        <div className="surface-glass p-5 text-center">
          <p className="text-xs uppercase tracking-wider text-white/55">Confirmados</p>
          <p className="mt-1 text-3xl font-bold text-emerald-200 tabular-nums">{confirmedGuests}</p>
          <p className="mt-1 text-[11px] text-white/50">de {validatedBuyers} compradores</p>
        </div>
        <div className="surface-glass p-5 text-center">
          <p className="text-xs uppercase tracking-wider text-white/55">Reservados</p>
          <p className="mt-1 text-3xl font-bold text-white tabular-nums">{reservedGuests}</p>
          <p className="mt-1 text-[11px] text-white/50">incluye no validados</p>
        </div>
        <div className="surface-glass p-5 text-center">
          <p className="text-xs uppercase tracking-wider text-white/55">En la lista</p>
          <p className="mt-1 text-3xl font-bold text-white tabular-nums">{filtered.length}</p>
          <p className="mt-1 text-[11px] text-white/50">{q ? "filtrado" : "total invitados"}</p>
        </div>
      </section>

      <form className="mt-6">
        <input
          name="q"
          type="search"
          defaultValue={q}
          placeholder="Buscar por nombre, apellido o DNI…"
          className="input-design"
        />
      </form>

      <section className="mt-4">
        {filtered.length === 0 ? (
          <div className="surface-glass p-6 text-center text-sm text-white/65">
            {q ? "Sin resultados con ese filtro." : "Todavía no hay invitados. Sé el primero."}
          </div>
        ) : (
          <ul className="surface-glass divide-y divide-white/5 overflow-hidden">
            {filtered.map((r, idx) => (
              <li key={idx} className="flex items-center justify-between gap-3 px-5 py-3">
                <div className="min-w-0">
                  <p className="font-medium text-white">
                    {r.last_name}, {r.first_name}
                    {r.is_buyer ? (
                      <span className="ml-2 rounded-full border border-brand/40 bg-brand/10 px-1.5 py-0.5 text-[10px] text-brand">
                        comprador
                      </span>
                    ) : null}
                  </p>
                  <p className="mt-0.5 text-xs text-white/55">
                    DNI <span className="font-mono">{maskDni(r.dni)}</span>
                  </p>
                </div>
                <span
                  className={`shrink-0 rounded-full border px-2 py-0.5 text-xs ${statusBadgeClass(r.status)}`}
                >
                  {STATUS_BADGE[r.status] ?? r.status}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <p className="mt-8 text-center text-xs text-white/40">
        El DNI se muestra enmascarado para proteger tus datos. Solo la productora ve los datos completos.
      </p>
    </main>
  );
}
