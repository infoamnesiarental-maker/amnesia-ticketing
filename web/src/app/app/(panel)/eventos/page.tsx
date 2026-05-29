import Link from "next/link";
import { redirect } from "next/navigation";

import { createSupabaseServerClient } from "@/lib/supabase/server";

function formatEventDate(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("es-AR", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "America/Argentina/Buenos_Aires",
  });
}

export default async function EventosPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth");

  const { data: memberships } = await supabase
    .from("org_members")
    .select("organization_id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  if (!memberships?.organization_id) redirect("/app/onboarding");

  const orgId = memberships.organization_id as string;

  const [{ data: events, error }, { data: orgRow }] = await Promise.all([
    supabase
      .from("events")
      .select("id, name, slug, place, starts_at, mp_alias, created_at")
      .eq("organization_id", orgId)
      .order("created_at", { ascending: false }),
    supabase.from("organizations").select("slug").eq("id", orgId).maybeSingle(),
  ]);

  const orgSlug = (orgRow?.slug as string | undefined) ?? "";

  if (error) {
    return (
      <div className="rounded-xl border border-red-400/40 bg-red-500/10 p-4 text-sm text-red-200">
        No se pudieron cargar eventos. {error.message}
      </div>
    );
  }

  const eventList = events ?? [];

  return (
    <div className="mx-auto w-full max-w-2xl md:max-w-none">

      {/* Encabezado */}
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-white sm:text-2xl">Mis eventos</h1>
        <Link
          href="/app/eventos/nuevo"
          className="btn-cta-primary shrink-0 px-4 py-2 text-sm"
        >
          + Nuevo
        </Link>
      </div>

      {/* Lista */}
      {eventList.length === 0 ? (
        <div className="mt-6 surface-glass p-8 text-center">
          <p className="text-white/60 text-sm">Todavía no hay eventos.</p>
          <Link href="/app/eventos/nuevo" className="btn-cta-primary mt-4 inline-flex justify-center">
            Crear mi primer evento
          </Link>
        </div>
      ) : (
        <ul className="mt-5 grid gap-3">
          {eventList.map((e) => {
            const id = String(e.id);
            const name = String(e.name);
            const slug = String(e.slug);
            const place = e.place ? String(e.place) : null;
            const date = formatEventDate(e.starts_at as string | null);
            const mpAlias = (e.mp_alias as string) || null;

            return (
              <li key={id} className="surface-glass overflow-hidden">
                {/* Cabecera del evento */}
                <div className="px-4 pt-4 pb-3">
                  <p className="text-base font-semibold leading-tight text-white">{name}</p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-white/50">
                    {date ? (
                      <span className="flex items-center gap-1">
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" aria-hidden>
                          <rect x="3" y="4" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="2" />
                          <path d="M8 2v4M16 2v4M3 10h18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                        </svg>
                        {date}
                      </span>
                    ) : null}
                    {place ? (
                      <span className="flex items-center gap-1">
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" aria-hidden>
                          <path d="M12 22s-8-6-8-12a8 8 0 0 1 16 0c0 6-8 12-8 12Z" stroke="currentColor" strokeWidth="2" />
                          <circle cx="12" cy="10" r="2.5" stroke="currentColor" strokeWidth="2" />
                        </svg>
                        {place}
                      </span>
                    ) : null}
                    {mpAlias ? (
                      <span className="font-mono text-white/35">MP: {mpAlias}</span>
                    ) : (
                      <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] text-amber-300">
                        Sin alias MP
                      </span>
                    )}
                  </div>
                </div>

                {/* Acciones principales — botones táctiles grandes */}
                <div className="grid grid-cols-2 border-t border-white/8">
                  <Link
                    href={`/app/eventos/${id}/venta-manual`}
                    className="flex flex-col items-center gap-1 border-r border-white/8 py-3.5 text-center text-xs font-semibold text-amber-200 transition hover:bg-amber-500/10 active:bg-amber-500/15"
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
                      <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
                    </svg>
                    Venta manual
                  </Link>
                  <Link
                    href={`/app/eventos/${id}/invitados`}
                    className="flex flex-col items-center gap-1 py-3.5 text-center text-xs font-semibold text-emerald-200 transition hover:bg-emerald-500/10 active:bg-emerald-500/15"
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
                      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                      <circle cx="9" cy="7" r="4" stroke="currentColor" strokeWidth="1.8" />
                      <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                    </svg>
                    Invitados
                  </Link>
                </div>

                {/* Acciones secundarias — fila compacta */}
                <div className="flex flex-wrap items-center gap-2 border-t border-white/8 bg-white/[0.02] px-4 py-3">
                  <Link
                    href={`/app/ventas?event=${id}&filter=todo`}
                    className="rounded-lg border border-white/15 px-3 py-1.5 text-xs text-white/75 hover:bg-white/5"
                  >
                    Órdenes
                  </Link>
                  <Link
                    href={`/app/eventos/${id}/entradas`}
                    className="rounded-lg border border-white/15 px-3 py-1.5 text-xs text-white/75 hover:bg-white/5"
                  >
                    Entradas
                  </Link>
                  <Link
                    href={`/app/eventos/${id}/editar`}
                    className="rounded-lg border border-white/15 px-3 py-1.5 text-xs text-white/75 hover:bg-white/5"
                  >
                    Editar
                  </Link>
                  {orgSlug ? (
                    <Link
                      href={`/e/${encodeURIComponent(orgSlug)}/${encodeURIComponent(slug)}`}
                      className="ml-auto rounded-lg border border-brand/35 bg-brand/10 px-3 py-1.5 text-xs text-white hover:bg-brand/20"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Ver ticketera ↗
                    </Link>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
