import Image from "next/image";
import Link from "next/link";

import type { PublicEventListItem } from "@/lib/public-events-catalog";

const TZ = "America/Argentina/Buenos_Aires";

function getScheduleParts(iso: string | null) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const weekday = new Intl.DateTimeFormat("es-AR", { weekday: "long", timeZone: TZ }).format(d);
  const day = new Intl.DateTimeFormat("es-AR", { day: "numeric", timeZone: TZ }).format(d);
  const month = new Intl.DateTimeFormat("es-AR", { month: "short", timeZone: TZ }).format(d);
  const year = new Intl.DateTimeFormat("es-AR", { year: "numeric", timeZone: TZ }).format(d);
  const time = new Intl.DateTimeFormat("es-AR", { hour: "2-digit", minute: "2-digit", timeZone: TZ }).format(d);
  return { weekday, day, month, year, time };
}

function ticketeraHref(item: PublicEventListItem): string {
  return `/e/${encodeURIComponent(item.org_slug)}/${encodeURIComponent(item.event_slug)}`;
}

function IconCalendar({ className }: { className?: string }) {
  return (
    <svg className={className} width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M8 2v3M16 2v3M3.5 9h17M5 4h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V6a2 2 0 012-2z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconMap({ className }: { className?: string }) {
  return (
    <svg className={className} width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 21s7-4.35 7-10a7 7 0 10-14 0c0 5.65 7 10 7 10z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="11" r="2.2" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

function IconTicket({ className }: { className?: string }) {
  return (
    <svg className={className} width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M3 9V7a2 2 0 012-2h14a2 2 0 012 2v2M3 15v2a2 2 0 002 2h14a2 2 0 002-2v-2M9 9h.01M15 9h.01M9 15h.01M15 15h.01"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconPerson({ className }: { className?: string }) {
  return (
    <svg className={className} width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 12a3.25 3.25 0 1 0-3.25-3.25A3.25 3.25 0 0 0 12 12Zm0 2c-3.2 0-5.75 1.76-5.75 4v.5h11.5V18c0-2.24-2.55-4-5.75-4Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

interface HomeEventsSectionProps {
  events: PublicEventListItem[];
  catalogError?: string | null;
}

export function HomeEventsSection({ events, catalogError }: HomeEventsSectionProps) {
  const missingRpc =
    catalogError &&
    (catalogError.includes("list_public_events_catalog") || catalogError.includes("function"));

  return (
    <section className="border-t border-white/10 bg-[#0A0A0A] py-16 section-padding-x md:py-24">
      <div className="mx-auto max-w-content">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-brand">Eventos</p>
          <h2 className="mt-4 text-heading-secondary text-balance">Conseguí tus entradas</h2>
          <p className="mt-4 text-base text-white/75 md:text-lg">
            Fecha, lugar, precios y cupos en vivo. Transferencia + comprobante; la productora valida el pago desde su
            panel.
          </p>
        </div>

        {missingRpc ? (
          <p className="mx-auto mt-8 max-w-2xl rounded-xl border border-amber-400/35 bg-amber-500/10 px-4 py-3 text-center text-sm text-amber-100">
            Falta ejecutar{" "}
            <code className="rounded bg-black/30 px-1.5 py-0.5 text-xs text-white">supabase/public-events-catalog.sql</code>{" "}
            en el SQL Editor de Supabase para listar eventos en la home.
          </p>
        ) : null}

        {!missingRpc && catalogError ? (
          <p className="mx-auto mt-8 max-w-xl text-center text-sm text-red-200/90">{catalogError}</p>
        ) : null}

        {events.length === 0 && !missingRpc && !catalogError ? (
          <div className="mx-auto mt-12 max-w-xl text-center text-sm text-white/60">
            <p>
              Todavía no hay eventos con entradas a la venta en el catálogo público. Si ya cargaste eventos y no
              aparecen, revisá en Supabase (mismo proyecto que <code className="text-white/80">NEXT_PUBLIC_SUPABASE_URL</code>
              ):
            </p>
            <ul className="mx-auto mt-4 max-w-md list-disc space-y-2 pl-5 text-left text-xs text-white/55">
              <li>
                La productora tiene que estar <strong className="text-white/80">approved</strong> (no{" "}
                <span className="font-mono">pending</span>).
              </li>
              <li>
                Al menos un tipo de entrada <strong className="text-white/80">activo</strong>, con venta vigente (
                <span className="font-mono">sales_ends_at</span> nulo o futuro).
              </li>
              <li>
                <strong className="text-white/80">Cupo disponible</strong>: el stock menos las órdenes en{" "}
                <span className="font-mono">pending_validation</span>, <span className="font-mono">manual_review</span> o{" "}
                <span className="font-mono">validated</span>. Si todo el stock quedó en pendientes, el evento{" "}
                <em>desaparece</em> del catálogo hasta que liberes cupo o rechaces órdenes.
              </li>
              <li>
                Tenés que haber corrido{" "}
                <code className="rounded bg-black/30 px-1 py-0.5 text-[10px] text-white/70">
                  supabase/public-events-catalog.sql
                </code>{" "}
                (RPC <span className="font-mono">list_public_events_catalog</span>).
              </li>
            </ul>
            <p className="mt-4 text-xs text-white/45">
              Diagnóstico SQL:{" "}
              <code className="rounded bg-black/30 px-1.5 py-0.5 text-[10px] text-white/70">
                supabase/diag-public-events-catalog.sql
              </code>
            </p>
          </div>
        ) : null}

        {events.length > 0 ? (
          <ul className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {events.map((ev) => {
              const schedule = getScheduleParts(ev.starts_at);
              const lowStock = ev.tickets_available > 0 && ev.tickets_available <= 35;

              return (
                <li key={`${ev.org_slug}/${ev.event_slug}`} className="group">
                  <Link
                    href={ticketeraHref(ev)}
                    className="block h-full rounded-2xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--brand-orange)]"
                    aria-label={`Ver entradas de ${ev.event_name}`}
                  >
                    <div className="relative h-full overflow-hidden rounded-2xl p-[1px] transition duration-500 group-hover:bg-gradient-to-br group-hover:from-[var(--brand-orange)]/55 group-hover:via-white/20 group-hover:to-transparent">
                      <article className="flex h-full flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#0c0c0c] shadow-[0_24px_60px_-20px_rgba(0,0,0,0.85)] transition duration-300 group-hover:border-white/15 group-hover:shadow-[0_28px_70px_-18px_rgba(255,87,34,0.18)]">
                      <div className="relative aspect-[16/10] shrink-0 overflow-hidden bg-gradient-to-br from-zinc-800 to-zinc-950">
                        {ev.cover_image_url ? (
                          <Image
                            src={ev.cover_image_url}
                            alt={`${ev.event_name} — ${ev.org_name}`}
                            fill
                            className="object-cover transition duration-700 group-hover:scale-[1.04]"
                            sizes="(max-width: 768px) 100vw, 33vw"
                            unoptimized
                          />
                        ) : (
                          <div
                            className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-brand/35 via-white/5 to-transparent"
                            aria-hidden
                          />
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-black/10" />

                        <div className="absolute left-3 top-3 flex max-w-[calc(100%-1.5rem)] flex-wrap items-center gap-2">
                          <span className="inline-flex max-w-full items-center truncate rounded-full border border-white/15 bg-black/45 px-3 py-1 text-[11px] font-medium uppercase tracking-wide text-white/85 backdrop-blur-md">
                            {ev.org_name}
                          </span>
                          {ev.catalog_flair ? (
                            <span className="inline-flex items-center rounded-full bg-[var(--brand-orange)] px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-white shadow-md shadow-black/30">
                              {ev.catalog_flair}
                            </span>
                          ) : null}
                          {lowStock ? (
                            <span className="inline-flex items-center rounded-full border border-amber-400/50 bg-amber-500/20 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-amber-100 backdrop-blur-sm">
                              Quedan {ev.tickets_available}
                            </span>
                          ) : null}
                        </div>

                        {schedule ? (
                          <div className="absolute bottom-3 left-3 flex items-end gap-3">
                            <div className="flex h-14 min-w-[3.25rem] flex-col items-center justify-center rounded-xl border border-white/15 bg-black/55 px-2 py-1 text-center backdrop-blur-md">
                              <span className="text-[10px] font-semibold uppercase leading-none text-brand">
                                {schedule.month}
                              </span>
                              <span className="text-2xl font-black leading-tight tracking-tight text-white">
                                {schedule.day}
                              </span>
                            </div>
                            <div className="pb-0.5">
                              <p className="text-xs font-medium capitalize leading-snug text-white/90">
                                {schedule.weekday}
                              </p>
                              <p className="text-[11px] text-white/60">
                                {schedule.year} · {schedule.time} hs
                              </p>
                            </div>
                          </div>
                        ) : (
                          <div className="absolute bottom-3 left-3 rounded-xl border border-white/10 bg-black/50 px-3 py-2 backdrop-blur-md">
                            <p className="text-xs font-medium text-white/75">Fecha a confirmar</p>
                          </div>
                        )}
                      </div>

                      <div className="flex flex-1 flex-col gap-4 p-5">
                        <div className="grid gap-2.5 text-sm text-white/75">
                          <div className="flex items-start gap-2.5">
                            <span className="mt-0.5 shrink-0 text-brand">
                              <IconCalendar className="opacity-90" />
                            </span>
                            <div>
                              <p className="text-[11px] font-semibold uppercase tracking-wide text-white/40">Cuándo</p>
                              <p className="text-white/90">
                                {schedule
                                  ? `${schedule.weekday} ${schedule.day} ${schedule.month} · ${schedule.time} hs`
                                  : "Próximamente"}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-start gap-2.5">
                            <span className="mt-0.5 shrink-0 text-brand">
                              <IconMap className="opacity-90" />
                            </span>
                            <div>
                              <p className="text-[11px] font-semibold uppercase tracking-wide text-white/40">Dónde</p>
                              <p className={ev.place ? "text-white/90" : "text-white/45"}>
                                {ev.place ?? "Ubicación a confirmar"}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-start gap-2.5">
                            <span className="mt-0.5 shrink-0 text-brand">
                              <IconPerson className="opacity-90" />
                            </span>
                            <div>
                              <p className="text-[11px] font-semibold uppercase tracking-wide text-white/40">Productora</p>
                              <p className="text-white/90">{ev.org_name}</p>
                            </div>
                          </div>
                        </div>

                        <span className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-[var(--brand-orange)] px-4 py-3.5 text-sm font-bold text-white shadow-[var(--shadow-button-hover)] transition group-hover:bg-[var(--brand-orange-intense)]">
                          Ver entradas
                          <span aria-hidden className="text-base transition group-hover:translate-x-0.5">
                            →
                          </span>
                        </span>
                      </div>
                    </article>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        ) : null}
      </div>
    </section>
  );
}
