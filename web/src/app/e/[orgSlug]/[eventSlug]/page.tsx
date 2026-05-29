import Link from "next/link";
import { notFound } from "next/navigation";

import { SiteHeader } from "@/components/SiteHeader";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { formatEventStartsAt } from "@/lib/format-datetime";
import { parseTicketeraContext, type TicketeraContext } from "@/lib/ticketera";

import { PublicTicketeraClient, PublicTicketeraFlyer, PublicTicketeraHero } from "./PublicTicketeraClient";

export default async function PublicTicketeraPage(props: {
  params: Promise<{ orgSlug: string; eventSlug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ orgSlug: orgSlugRaw, eventSlug: eventSlugRaw }, sp] = await Promise.all([props.params, props.searchParams]);
  const orgSlug = decodeURIComponent(orgSlugRaw);
  const eventSlug = decodeURIComponent(eventSlugRaw);
  const thanks = sp.gracias === "1" || sp.gracias === "true";

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("get_ticketera_data", {
    p_org_slug: orgSlug,
    p_event_slug: eventSlug,
  });

  if (error) {
    return (
      <div className="min-h-screen bg-[#0A0A0A]">
        <SiteHeader variant="solid" />
        <main className="section-padding-x mx-auto max-w-content py-24">
          <div className="surface-glass p-6 text-sm text-amber-100">
            <p className="font-medium text-white">No se pudo cargar la ticketera</p>
            <p className="mt-2 text-white/70">
              {error.message.includes("get_ticketera_data") || error.message.includes("function")
                ? "Falta ejecutar supabase/ticketera-public.sql en el SQL Editor de Supabase (función get_ticketera_data + bucket proofs)."
                : error.message}
            </p>
            <Link href="/" className="btn-outline-light mt-6 inline-flex">
              Volver al inicio
            </Link>
          </div>
        </main>
      </div>
    );
  }

  if (data == null) notFound();

  let ctx = parseTicketeraContext(data);
  if (!ctx) notFound();

  /** Si la RPC es vieja (sin `cover_image_url`), completamos la tapa con lectura server-side. */
  if (!ctx.event.cover_image_url) {
    const admin = createSupabaseServiceRoleClient();
    if (admin) {
      const { data: row } = await admin
        .from("events")
        .select("cover_image_url")
        .eq("id", ctx.event.id)
        .maybeSingle();
      const u = row?.cover_image_url;
      if (typeof u === "string" && u.trim()) {
        const nextEvent = { ...ctx.event, cover_image_url: u.trim() };
        ctx = { ...ctx, event: nextEvent } satisfies TicketeraContext;
      }
    }
  }

  const hasPurchaseFlow = !thanks && ctx.ticket_types.length > 0;
  const eventStartsAtLabel = formatEventStartsAt(ctx.event.starts_at);

  // Código de afiliado: viene de ?ref= en la URL — lo pasamos al cliente
  const refRaw = sp.ref;
  const affiliateRef = typeof refRaw === "string" && refRaw.trim() ? refRaw.trim().toUpperCase().slice(0, 32) : null;

  return (
    <div className="min-h-screen bg-[#0A0A0A]">
      <SiteHeader variant="solid" />
      <main className="section-padding-x mx-auto max-w-content pb-24 pt-24 sm:pt-28">
        {hasPurchaseFlow ? (
          <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,320px)_minmax(0,1fr)] lg:gap-10 xl:grid-cols-[minmax(0,380px)_minmax(0,1fr)]">
            {/* Flyer: solo visible en desktop. En mobile lo muestra el cliente en el paso 0. */}
            <div className="hidden lg:block">
              <PublicTicketeraFlyer context={ctx} eventStartsAtLabel={eventStartsAtLabel} />
            </div>
            <div className="min-w-0">
              <header className="hidden border-b border-white/10 pb-5 lg:block">
                <p className="text-xs font-semibold uppercase tracking-wider text-brand">Ticketera</p>
                <p className="mt-1 text-sm text-white/60">
                  {ctx.organization.name} · <span className="font-mono text-white/45">{ctx.organization.slug}</span>
                </p>
              </header>
              <PublicTicketeraClient
                context={ctx}
                thanks={thanks}
                layoutSplit
                eventStartsAtLabel={eventStartsAtLabel}
                affiliateRef={affiliateRef}
              />
            </div>
          </div>
        ) : (
          <>
            <PublicTicketeraHero context={ctx} eventStartsAtLabel={eventStartsAtLabel} />
            <div className="mt-10">
              <PublicTicketeraClient context={ctx} thanks={thanks} eventStartsAtLabel={eventStartsAtLabel} affiliateRef={affiliateRef} />
            </div>
          </>
        )}
      </main>
    </div>
  );
}
