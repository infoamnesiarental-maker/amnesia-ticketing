import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { requireSupabaseServiceRoleClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { loadTicketTypesWithAvailability } from "@/lib/ticket-stock";

import { ManualSaleForm } from "./ManualSaleForm";

export default async function VentaManualPage({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth?redirect=/app/eventos");

  const { data: membership } = await supabase
    .from("org_members")
    .select("organization_id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  if (!membership?.organization_id) redirect("/app/onboarding");
  const orgId = membership.organization_id as string;

  const { data: event, error: evErr } = await supabase
    .from("events")
    .select("id, name, slug, organization_id")
    .eq("id", eventId)
    .maybeSingle();

  if (evErr || !event) notFound();
  if (String(event.organization_id) !== orgId) notFound();

  const admin = requireSupabaseServiceRoleClient();
  const { types, error: stockErr } = await loadTicketTypesWithAvailability(admin, eventId);

  const eventName = String(event.name);

  return (
    <div className="mx-auto w-full max-w-lg md:max-w-none">

      {/* Breadcrumb */}
      <Link
        href="/app/eventos"
        className="inline-flex items-center gap-1.5 text-sm text-white/50 hover:text-white"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path d="M19 12H5M12 19l-7-7 7-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        Eventos
      </Link>

      {/* Título */}
      <div className="mt-3">
        <h1 className="text-xl font-bold text-white sm:text-2xl">Venta manual</h1>
        <p className="mt-1 text-sm text-white/55 truncate">
          {eventName}
        </p>
      </div>

      {/* Contenido */}
      <div className="mt-6">
        {stockErr ? (
          <div className="rounded-xl border border-red-400/40 bg-red-500/10 p-4 text-sm text-red-200">
            No se pudieron cargar las entradas: {stockErr}
          </div>
        ) : (
          <ManualSaleForm eventId={eventId} eventName={eventName} ticketTypes={types} />
        )}
      </div>

      {/* Links rápidos secundarios */}
      <div className="mt-5 flex flex-wrap gap-2">
        <Link
          href={`/app/ventas?event=${eventId}&filter=validated`}
          className="rounded-lg border border-white/15 px-3 py-2 text-xs text-white/65 hover:bg-white/5"
        >
          Ver ventas de este evento
        </Link>
        <Link
          href={`/app/eventos/${eventId}/invitados`}
          className="rounded-lg border border-emerald-400/25 bg-emerald-500/8 px-3 py-2 text-xs text-emerald-200 hover:bg-emerald-500/15"
        >
          Lista de invitados
        </Link>
      </div>
    </div>
  );
}
