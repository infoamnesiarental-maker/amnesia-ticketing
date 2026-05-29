import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { requireSupabaseServiceRoleClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

import { AfiliadosClient, type AffiliateRow } from "./AfiliadosClient";

export const dynamic = "force-dynamic";

const moneyFmt = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 0,
});

function getBaseUrl(): string {
  const url = (process.env.NEXT_PUBLIC_SITE_URL || "").trim().replace(/\/+$/, "");
  return url || "https://tu-sitio.com";
}

export default async function AfiliadosPage({ params }: { params: Promise<{ eventId: string }> }) {
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

  const admin = requireSupabaseServiceRoleClient();

  const [{ data: event, error: evErr }, { data: orgRow }] = await Promise.all([
    admin.from("events").select("id, name, slug, organization_id").eq("id", eventId).maybeSingle(),
    admin.from("organizations").select("slug").eq("id", orgId).maybeSingle(),
  ]);

  if (evErr || !event) notFound();
  if (String(event.organization_id) !== orgId) notFound();

  const eventName = String(event.name);
  const eventSlug = String(event.slug);
  const orgSlug = orgRow?.slug ? String(orgRow.slug) : "";

  const { data: statsRows } = await admin
    .from("affiliate_stats")
    .select("*")
    .eq("event_id", eventId)
    .order("created_at", { ascending: false });

  const affiliates: AffiliateRow[] = (statsRows ?? []).map((r) => ({
    id: String((r as Record<string, unknown>).affiliate_code_id),
    name: String((r as Record<string, unknown>).affiliate_name),
    code: String((r as Record<string, unknown>).affiliate_code),
    is_active: Boolean((r as Record<string, unknown>).is_active),
    created_at: String((r as Record<string, unknown>).created_at),
    total_orders: Number((r as Record<string, unknown>).total_orders) || 0,
    validated_orders: Number((r as Record<string, unknown>).validated_orders) || 0,
    pending_orders: Number((r as Record<string, unknown>).pending_orders) || 0,
    validated_ars: Number((r as Record<string, unknown>).validated_ars) || 0,
    validated_qty: Number((r as Record<string, unknown>).validated_qty) || 0,
  }));

  const totalQty = affiliates.reduce((s, a) => s + a.validated_qty, 0);
  const totalArs = affiliates.reduce((s, a) => s + a.validated_ars, 0);
  const totalPending = affiliates.reduce((s, a) => s + a.pending_orders, 0);
  const baseUrl = getBaseUrl();

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
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-white sm:text-2xl">Afiliados</h1>
            <p className="mt-0.5 text-sm text-white/50 truncate">{eventName}</p>
          </div>
          {/* Link rápido a ventas solo en sm+ */}
          <Link
            href={`/app/ventas?event=${eventId}&filter=validated`}
            className="hidden sm:inline-flex rounded-lg border border-white/15 px-3 py-2 text-xs text-white/60 hover:bg-white/5"
          >
            Ver ventas
          </Link>
        </div>
      </div>

      {/* Resumen global — solo si hay datos */}
      {affiliates.length > 0 && (
        <div className="mt-5 surface-glass overflow-hidden">
          <p className="px-4 pt-3 pb-1 text-[10px] font-bold uppercase tracking-widest text-white/35">
            Total por afiliados
          </p>
          <div className="grid grid-cols-3 divide-x divide-white/8">
            <div className="py-3 text-center">
              <p className="text-2xl font-bold tabular-nums text-white">{totalQty}</p>
              <p className="mt-0.5 text-[11px] text-white/40">Entradas</p>
            </div>
            <div className="py-3 text-center">
              <p className="text-2xl font-bold tabular-nums text-brand">{moneyFmt.format(totalArs)}</p>
              <p className="mt-0.5 text-[11px] text-white/40">Recaudado</p>
            </div>
            <div className="py-3 text-center">
              <p className={`text-2xl font-bold tabular-nums ${totalPending > 0 ? "text-amber-300" : "text-white/40"}`}>
                {totalPending}
              </p>
              <p className="mt-0.5 text-[11px] text-white/40">Pendientes</p>
            </div>
          </div>
        </div>
      )}

      {/* Explicación de uso */}
      <div className="mt-4 flex items-start gap-3 rounded-xl border border-violet-400/15 bg-violet-500/6 px-4 py-3">
        <svg
          className="mt-0.5 shrink-0 text-violet-400/60"
          width="15"
          height="15"
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden
        >
          <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.8" />
          <path d="M12 16v-4M12 8h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
        <p className="text-xs text-violet-200/60 leading-relaxed">
          Cada afiliado tiene un link con su código. Cuando alguien compra por ese link, la venta queda asociada automáticamente.
        </p>
      </div>

      {/* Client: formulario + lista */}
      <div className="mt-5">
        <AfiliadosClient
          eventId={eventId}
          orgSlug={orgSlug}
          eventSlug={eventSlug}
          affiliates={affiliates}
          baseUrl={baseUrl}
        />
      </div>
    </div>
  );
}
