import Link from "next/link";
import { notFound } from "next/navigation";

import { SiteHeader } from "@/components/SiteHeader";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { parseTicketeraContext } from "@/lib/ticketera";

import { BenefitTicketClient, type BenefitCheckoutData } from "./BenefitTicketClient";

export default async function PublicBenefitPage(props: {
  params: Promise<{ orgSlug: string; eventSlug: string; token: string }>;
}) {
  const { orgSlug: orgSlugRaw, eventSlug: eventSlugRaw, token: tokenRaw } = await props.params;
  const orgSlug = decodeURIComponent(orgSlugRaw);
  const eventSlug = decodeURIComponent(eventSlugRaw);
  const token = decodeURIComponent(tokenRaw);

  const supabase = await createSupabaseServerClient();
  const { data: ticketeraData, error: ticketeraErr } = await supabase.rpc("get_ticketera_data", {
    p_org_slug: orgSlug,
    p_event_slug: eventSlug,
  });

  if (ticketeraErr) {
    return (
      <div className="min-h-screen bg-[#0A0A0A]">
        <SiteHeader variant="solid" />
        <main className="section-padding-x mx-auto max-w-content py-24">
          <div className="surface-glass p-6 text-sm text-amber-100">
            <p className="font-medium text-white">No se pudo cargar el evento</p>
            <p className="mt-2 text-white/70">{ticketeraErr.message}</p>
          </div>
        </main>
      </div>
    );
  }

  if (ticketeraData == null) notFound();
  const ctx = parseTicketeraContext(ticketeraData);
  if (!ctx) notFound();

  const admin = createSupabaseServiceRoleClient();
  if (!admin) {
    return (
      <div className="min-h-screen bg-[#0A0A0A]">
        <SiteHeader variant="solid" />
        <main className="section-padding-x mx-auto max-w-content py-24">
          <div className="surface-glass p-6 text-sm text-amber-100">
            <p className="font-medium text-white">Configuración incompleta del servidor</p>
            <p className="mt-2 text-white/70">
              Falta <code className="text-white">SUPABASE_SERVICE_ROLE_KEY</code>. Este flujo requiere servidor seguro.
            </p>
          </div>
        </main>
      </div>
    );
  }

  const { data: benefit, error: benefitErr } = await admin
    .from("benefit_campaigns")
    .select("id, token, event_id, ticket_type_id, discounted_price_ars, status, expires_at, note")
    .eq("token", token)
    .maybeSingle();

  if (benefitErr) {
    if (/relation .*benefit_campaigns.* does not exist|undefined_table/i.test(benefitErr.message)) {
      return (
        <div className="min-h-screen bg-[#0A0A0A]">
          <SiteHeader variant="solid" />
          <main className="section-padding-x mx-auto max-w-content py-24">
            <div className="surface-glass p-6 text-sm text-amber-100">
              <p className="font-medium text-white">Falta tabla de beneficios</p>
              <p className="mt-2 text-white/70">
                Ejecutá <code className="text-white">supabase/benefit-campaigns.sql</code> en Supabase.
              </p>
            </div>
          </main>
        </div>
      );
    }
    return (
      <div className="min-h-screen bg-[#0A0A0A]">
        <SiteHeader variant="solid" />
        <main className="section-padding-x mx-auto max-w-content py-24">
          <div className="surface-glass p-6 text-sm text-red-200">
            Error al validar link de beneficio: {benefitErr.message}
          </div>
        </main>
      </div>
    );
  }

  if (!benefit) notFound();
  if (String(benefit.token) !== token) notFound();
  if (String(benefit.event_id) !== ctx.event.id) notFound();

  const ticketType = ctx.ticket_types.find((tt) => tt.id === String(benefit.ticket_type_id));
  if (!ticketType) {
    return (
      <div className="min-h-screen bg-[#0A0A0A]">
        <SiteHeader variant="solid" />
        <main className="section-padding-x mx-auto max-w-content py-24">
          <div className="surface-glass p-6 text-sm text-amber-100">
            El tipo de entrada asociado a este beneficio ya no existe.
          </div>
        </main>
      </div>
    );
  }

  const isExpired =
    benefit.expires_at && !Number.isNaN(new Date(String(benefit.expires_at)).getTime())
      ? new Date(String(benefit.expires_at)).getTime() < Date.now()
      : false;
  const isInactive = String(benefit.status) !== "active";

  let blockedMessage = "";
  if (isInactive) blockedMessage = "Esta campaña de beneficio no está activa.";
  else if (isExpired) blockedMessage = "Este link de beneficio venció.";

  const checkoutData: BenefitCheckoutData = {
    orgSlug: ctx.organization.slug,
    eventSlug: ctx.event.slug,
    token,
    organizationName: ctx.organization.name,
    eventName: ctx.event.name,
    eventPlace: ctx.event.place,
    eventStartsAt: ctx.event.starts_at,
    ticketTypeName: ticketType.name,
    basePriceArs: Number(ticketType.price_ars),
    discountedPriceArs: Number(benefit.discounted_price_ars),
    mpAlias: ctx.event.mp_alias,
    campaignNote: (benefit.note as string | null) ?? null,
  };

  return (
    <div className="min-h-screen bg-[#0A0A0A]">
      <SiteHeader variant="solid" />
      <main className="section-padding-x mx-auto max-w-content pb-24 pt-24 sm:pt-28">
        {blockedMessage ? (
          <div className="surface-glass mx-auto max-w-2xl p-7 text-center">
            <p className="text-lg font-semibold text-white">{blockedMessage}</p>
            <p className="mt-2 text-sm text-white/65">
              Si necesitás uno nuevo, pedilo a la productora por WhatsApp.
            </p>
            <Link
              href={`/e/${encodeURIComponent(ctx.organization.slug)}/${encodeURIComponent(ctx.event.slug)}`}
              className="btn-cta-primary mx-auto mt-6 inline-flex"
            >
              Ir a ticketera normal
            </Link>
          </div>
        ) : (
          <BenefitTicketClient data={checkoutData} />
        )}
      </main>
    </div>
  );
}

