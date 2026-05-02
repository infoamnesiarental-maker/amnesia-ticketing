import Link from "next/link";

import { HomeEventsSection } from "@/components/HomeEventsSection";
import { SiteHeader } from "@/components/SiteHeader";
import { parsePublicEventsCatalog } from "@/lib/public-events-catalog";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const revalidate = 60;

const services = [
  { num: "#01", title: "Sin comisión de pasarela" },
  { num: "#02", title: "Transferencia + comprobante" },
  { num: "#03", title: "Validación automática" },
  { num: "#04", title: "QRs + puerta" },
];

export default async function Home() {
  let catalogError: string | null = null;
  let events = parsePublicEventsCatalog(null);
  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.rpc("list_public_events_catalog");
    if (error) catalogError = error.message;
    else events = parsePublicEventsCatalog(data);
  } catch (e) {
    catalogError = e instanceof Error ? e.message : "No se pudo conectar con Supabase.";
  }

  return (
    <div className="flex min-h-screen flex-col overflow-x-hidden">
      <SiteHeader variant="hero" />

      <section className="relative flex min-h-[calc(100dvh-5rem)] flex-col pt-20">
        <video
          className="pointer-events-none absolute inset-0 h-full w-full object-cover"
          autoPlay
          muted
          loop
          playsInline
          preload="auto"
          aria-hidden
        >
          <source src="/hero.mp4" type="video/mp4" />
        </video>
        <div className="pointer-events-none absolute inset-0 bg-black/55" aria-hidden />
        <div className="pointer-events-none absolute inset-0 bg-[var(--gradient-overlay)] opacity-70" aria-hidden />

        <div className="section-padding-x relative z-10 flex flex-1 flex-col py-12 pb-16 md:py-16 md:pb-20">
          <div className="mx-auto flex w-full max-w-content flex-1 flex-col justify-center">
            <div className="animate-fade-up mx-auto flex max-w-3xl flex-col items-center text-center">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-brand">Ticketera moderna</p>
              <h1 className="text-hero-title mt-5 text-balance text-white drop-shadow-[0_18px_60px_rgba(0,0,0,0.55)]">
                Vendé entradas sin comisión.
              </h1>
              <p className="mt-6 max-w-2xl text-pretty text-base text-white/80 sm:text-lg md:text-xl">
                100% de los ingresos para la productora. Transferencia + comprobante, validación automática y acceso por
                QR o lista de invitados.
              </p>

              <div className="mt-7 flex flex-wrap justify-center gap-3">
                <Link
                  href="/auth"
                  className="inline-flex items-center justify-center gap-2 rounded-full bg-[var(--brand-orange)] px-6 py-3 text-sm font-semibold text-white shadow-[var(--shadow-button-hover)] transition hover:bg-[var(--brand-orange-intense)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--brand-orange)]"
                >
                  Crear mi evento <span aria-hidden>→</span>
                </Link>
              </div>

              <div className="mt-10 flex flex-wrap justify-center gap-2.5">
                {services.map((s) => (
                  <span
                    key={s.num}
                    className="rounded-full border border-brand/25 bg-black/25 px-4 py-2 text-sm text-white/90 backdrop-blur"
                  >
                    <span className="font-mono text-brand">{s.num}</span> <span className="ml-2">{s.title}</span>
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <HomeEventsSection events={events} catalogError={catalogError} />

      <section className="border-t border-white/10 bg-[#0A0A0A] py-16 section-padding-x md:py-24">
        <div className="max-w-content mx-auto">
          <div className="mx-auto max-w-3xl text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-brand">Cómo funciona</p>
            <h2 className="mt-4 text-heading-secondary text-balance">Una ticketera simple para el comprador. Potente para la productora.</h2>
            <p className="mt-4 text-base text-white/75 md:text-lg">
              La venta es por transferencia directa, sin comisión de pasarela. El sistema valida el pago y automatiza la entrega de accesos.
            </p>
          </div>

          <div className="mt-12 grid gap-4 md:mt-14 md:grid-cols-2 lg:grid-cols-4">
            {[
              {
                n: "01",
                t: "Compran en la ticketera",
                d: "Eligen entradas, completan sus datos y ven el monto exacto a transferir.",
              },
              {
                n: "02",
                t: "Suben el comprobante",
                d: "Adjuntan captura del pago. La orden queda registrada y trazable.",
              },
              {
                n: "03",
                t: "Validación del pago",
                d: "Se valida automáticamente y, si hace falta, pasa a revisión manual.",
              },
              {
                n: "04",
                t: "Acceso en puerta",
                d: "Se habilita ingreso por QR o lista. Check-in rápido, claro e idempotente.",
              },
            ].map((s) => (
              <div key={s.n} className="surface-glass p-6">
                <p className="font-mono text-sm text-brand">{s.n}</p>
                <p className="mt-3 text-base font-semibold text-white">{s.t}</p>
                <p className="mt-2 text-sm leading-relaxed text-white/70">{s.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-[#0A0A0A] py-16 section-padding-x md:py-20">
        <div className="max-w-content mx-auto">
          <div className="surface-glass mx-auto max-w-3xl p-8 text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-white/70">Contacto</p>
            <h2 className="mt-4 text-xl font-bold text-white md:text-2xl">¿Querés activar tu productora?</h2>
            <p className="mt-3 text-sm text-white/70 md:text-base">
              Escribinos por WhatsApp y te damos el alta. Si ya te registraste, avisá con tu email.
            </p>
            <p className="mt-6 text-base font-semibold text-white">
              WhatsApp:{" "}
              <a
                className="text-brand underline decoration-white/20 underline-offset-4 hover:decoration-white/40"
                href="https://wa.me/5491139531218"
                target="_blank"
                rel="noopener noreferrer"
              >
                +54 911 3953 1218
              </a>
            </p>
          </div>
        </div>
      </section>

      <footer className="border-t border-white/10 bg-[#0A0A0A] py-10 section-padding-x">
        <div className="max-w-content mx-auto flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div className="text-caption-design">
            <p className="text-sm font-semibold text-white">Amnesia Ticketing</p>
            <p className="mt-1 text-xs text-white/55">Ticketera sin comisión para productoras y eventos.</p>
          </div>
          <div className="text-xs text-white/55">
            <p>Contacto: WhatsApp +54 911 3953 1218</p>
            <p className="mt-1">© {new Date().getFullYear()} Amnesia Ticketing. Todos los derechos reservados.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
