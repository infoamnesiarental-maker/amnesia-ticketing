import { randomBytes } from "node:crypto";

import { revalidatePath } from "next/cache";
import Link from "next/link";
import { redirect } from "next/navigation";

import { loadProducerPanel } from "@/lib/producer-panel-load";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type ProducerRole = "owner" | "admin";

function parseMoneyInput(raw: string): number {
  const normalized = raw.replace(/\./g, "").replace(",", ".").trim();
  return Number(normalized);
}

function randomToken(): string {
  return randomBytes(18).toString("base64url");
}

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
function randomCode(size = 8): string {
  const buf = randomBytes(size);
  let out = "";
  for (let i = 0; i < size; i++) out += CODE_ALPHABET[buf[i] % CODE_ALPHABET.length];
  return out;
}

function buildCodes(qty: number): string[] {
  const set = new Set<string>();
  while (set.size < qty) set.add(randomCode(8));
  return [...set];
}

function relOne<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? value[0] ?? null : value;
}

async function authorizeProducerForOrg(
  orgId: string,
): Promise<{ ok: true; userId: string } | { ok: false; redirectTo: string }> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, redirectTo: "/auth?redirect=/app/beneficios" };

  const { data: membership } = await supabase
    .from("org_members")
    .select("role")
    .eq("organization_id", orgId)
    .eq("user_id", user.id)
    .maybeSingle();

  const role = String(membership?.role ?? "") as ProducerRole | "";
  if (role !== "owner" && role !== "admin") return { ok: false, redirectTo: "/app?error=Sin+permiso" };

  return { ok: true, userId: user.id };
}

async function createCampaignAction(formData: FormData) {
  "use server";
  const ctx = await loadProducerPanel();
  if (!ctx.ok) redirect(ctx.redirect);

  const admin = createSupabaseServiceRoleClient();
  if (!admin) redirect("/app/beneficios?error=Falta+SUPABASE_SERVICE_ROLE_KEY");

  const auth = await authorizeProducerForOrg(ctx.ctx.orgId);
  if (!auth.ok) redirect(auth.redirectTo);

  const ticketTypeId = String(formData.get("ticket_type_id") || "").trim();
  const discountedRaw = String(formData.get("discounted_price_ars") || "").trim();
  const note = String(formData.get("note") || "").trim();
  const expiresHoursRaw = String(formData.get("expires_hours") || "0").trim();
  const initialCodesRaw = String(formData.get("initial_codes_qty") || "50").trim();

  if (!ticketTypeId) redirect("/app/beneficios?error=Seleccioná+un+tipo+de+entrada");
  const discounted = parseMoneyInput(discountedRaw);
  if (!Number.isFinite(discounted) || discounted <= 0) {
    redirect("/app/beneficios?error=Precio+de+beneficio+inválido");
  }
  const initialCodesQty = Number.parseInt(initialCodesRaw, 10);
  if (!Number.isFinite(initialCodesQty) || initialCodesQty < 1 || initialCodesQty > 2000) {
    redirect("/app/beneficios?error=Cantidad+inicial+de+códigos+inválida+(1-2000)");
  }

  const expiresHours = Number.parseInt(expiresHoursRaw, 10);
  if (!Number.isFinite(expiresHours) || expiresHours < 0 || expiresHours > 720) {
    redirect("/app/beneficios?error=Vencimiento+inválido");
  }

  const { data: tt, error: ttErr } = await admin
    .from("ticket_types")
    .select("id, event_id, name, price_ars, is_active, stock_total, events!inner(id, organization_id, slug, organizations!inner(slug))")
    .eq("id", ticketTypeId)
    .eq("events.organization_id", ctx.ctx.orgId)
    .maybeSingle();

  if (ttErr || !tt) redirect("/app/beneficios?error=Entrada+no+válida+para+tu+productora");

  const basePrice = Number(tt.price_ars ?? 0);
  if (!Number.isFinite(basePrice) || basePrice <= 0) {
    redirect("/app/beneficios?error=El+precio+base+de+la+entrada+es+inválido");
  }
  if (discounted > basePrice) redirect("/app/beneficios?error=El+precio+beneficio+no+puede+superar+el+precio+base");
  if (!tt.is_active || Number(tt.stock_total ?? 0) < 1) {
    redirect("/app/beneficios?error=La+entrada+debe+estar+activa+y+tener+stock");
  }

  const token = randomToken();
  const expiresAt =
    expiresHours > 0
      ? new Date(Date.now() + expiresHours * 60 * 60 * 1000).toISOString()
      : null;

  const { data: createdCampaign, error: insCampaignErr } = await admin
    .from("benefit_campaigns")
    .insert({
      token,
      organization_id: ctx.ctx.orgId,
      event_id: String(tt.event_id),
      ticket_type_id: ticketTypeId,
      discounted_price_ars: discounted,
      status: "active",
      expires_at: expiresAt,
      note: note || null,
      created_by_user_id: auth.userId,
    })
    .select("id")
    .maybeSingle();

  if (insCampaignErr || !createdCampaign?.id) {
    if (insCampaignErr && /relation .*benefit_campaigns.* does not exist|undefined_table/i.test(insCampaignErr.message)) {
      redirect("/app/beneficios?error=Falta+tabla+benefit_campaigns.+Ejecutá+supabase/benefit-campaigns.sql");
    }
    redirect(`/app/beneficios?error=${encodeURIComponent(insCampaignErr?.message || "No se pudo crear la campaña")}`);
  }

  const codes = buildCodes(initialCodesQty);
  const { error: codesErr } = await admin.from("benefit_campaign_codes").insert(
    codes.map((code) => ({
      campaign_id: createdCampaign.id as string,
      code,
      status: "pending",
    })),
  );

  if (codesErr) {
    await admin.from("benefit_campaigns").delete().eq("id", createdCampaign.id as string);
    if (/relation .*benefit_campaign_codes.* does not exist|undefined_table/i.test(codesErr.message)) {
      redirect("/app/beneficios?error=Falta+tabla+benefit_campaign_codes.+Ejecutá+supabase/benefit-campaigns.sql");
    }
    redirect(`/app/beneficios?error=${encodeURIComponent(codesErr.message)}`);
  }

  revalidatePath("/app/beneficios");
  redirect(`/app/beneficios?ok=campaign_created&id=${encodeURIComponent(createdCampaign.id as string)}`);
}

async function generateMoreCodesAction(formData: FormData) {
  "use server";
  const ctx = await loadProducerPanel();
  if (!ctx.ok) redirect(ctx.redirect);

  const admin = createSupabaseServiceRoleClient();
  if (!admin) redirect("/app/beneficios?error=Falta+SUPABASE_SERVICE_ROLE_KEY");
  const auth = await authorizeProducerForOrg(ctx.ctx.orgId);
  if (!auth.ok) redirect(auth.redirectTo);

  const campaignId = String(formData.get("campaign_id") || "").trim();
  const qtyRaw = String(formData.get("more_codes_qty") || "50").trim();
  const qty = Number.parseInt(qtyRaw, 10);
  if (!campaignId) redirect("/app/beneficios?error=Campaña+inválida");
  if (!Number.isFinite(qty) || qty < 1 || qty > 2000) {
    redirect("/app/beneficios?error=Cantidad+de+códigos+inválida+(1-2000)");
  }

  const { data: campaign, error: cErr } = await admin
    .from("benefit_campaigns")
    .select("id, status, organization_id")
    .eq("id", campaignId)
    .eq("organization_id", ctx.ctx.orgId)
    .maybeSingle();
  if (cErr || !campaign) redirect("/app/beneficios?error=Campaña+no+encontrada");
  if (campaign.status !== "active") redirect("/app/beneficios?error=Solo+podés+agregar+códigos+a+campañas+activas");

  const codes = buildCodes(qty);
  const { error: codesErr } = await admin.from("benefit_campaign_codes").insert(
    codes.map((code) => ({ campaign_id: campaignId, code, status: "pending" })),
  );
  if (codesErr) redirect(`/app/beneficios?error=${encodeURIComponent(codesErr.message)}`);

  revalidatePath("/app/beneficios");
  redirect(`/app/beneficios?ok=codes_added&id=${encodeURIComponent(campaignId)}`);
}

const money = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 2 });

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("es-AR", { dateStyle: "short", timeStyle: "short" });
}

export default async function ProducerBenefitsPage(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const result = await loadProducerPanel();
  if (!result.ok) redirect(result.redirect);
  const { orgId } = result.ctx;
  const sp = await props.searchParams;
  const error = typeof sp.error === "string" ? decodeURIComponent(sp.error) : "";
  const ok = typeof sp.ok === "string" ? sp.ok : "";
  const selectedCampaignId = typeof sp.id === "string" ? sp.id : "";

  const admin = createSupabaseServiceRoleClient();
  if (!admin) {
    return (
      <div className="surface-glass p-6 text-sm text-amber-100">
        Falta <code className="text-white">SUPABASE_SERVICE_ROLE_KEY</code> para gestionar beneficios.
      </div>
    );
  }

  const [{ data: ticketTypes, error: ttErr }, { data: campaigns, error: campErr }] = await Promise.all([
    admin
      .from("ticket_types")
      .select("id, name, price_ars, is_active, stock_total, events!inner(id, name, slug, organizations!inner(slug, id))")
      .eq("events.organization_id", orgId)
      .order("created_at", { ascending: false })
      .limit(600),
    admin
      .from("benefit_campaigns")
      .select("id, token, discounted_price_ars, status, expires_at, note, created_at, event_id, ticket_type_id, events(name, slug, organizations(slug)), ticket_types(name)")
      .eq("organization_id", orgId)
      .order("created_at", { ascending: false })
      .limit(30),
  ]);

  if (ttErr) {
    return <div className="rounded-xl border border-red-400/40 bg-red-500/10 p-4 text-sm text-red-100">{ttErr.message}</div>;
  }
  if (campErr) {
    return <div className="rounded-xl border border-red-400/40 bg-red-500/10 p-4 text-sm text-red-100">{campErr.message}</div>;
  }

  const campaignIds = (campaigns ?? []).map((c) => String(c.id));
  const pendingCounts = new Map<string, number>();
  const usedCounts = new Map<string, number>();
  let selectedCodes: Array<{ code: string; status: string; created_at: string }> = [];

  if (campaignIds.length > 0) {
    const [{ data: pendRows }, { data: usedRows }, { data: codeRows }] = await Promise.all([
      admin
        .from("benefit_campaign_codes")
        .select("campaign_id, count:id", { count: "exact" })
        .in("campaign_id", campaignIds)
        .eq("status", "pending"),
      admin
        .from("benefit_campaign_codes")
        .select("campaign_id, count:id", { count: "exact" })
        .in("campaign_id", campaignIds)
        .eq("status", "used"),
      selectedCampaignId
        ? admin
            .from("benefit_campaign_codes")
            .select("code, status, created_at")
            .eq("campaign_id", selectedCampaignId)
            .order("created_at", { ascending: false })
            .limit(300)
        : Promise.resolve({ data: [] as Array<{ code: string; status: string; created_at: string }> }),
    ]);

    for (const r of pendRows ?? []) pendingCounts.set(String((r as { campaign_id: string }).campaign_id), Number((r as { count?: number }).count ?? 0));
    for (const r of usedRows ?? []) usedCounts.set(String((r as { campaign_id: string }).campaign_id), Number((r as { count?: number }).count ?? 0));
    selectedCodes = (codeRows ?? []) as Array<{ code: string; status: string; created_at: string }>;
  }

  return (
    <div className="mx-auto w-full max-w-6xl md:mx-0">
      <div className="text-center md:text-left">
        <h1 className="text-2xl font-bold text-white">Beneficios por código</h1>
        <p className="mt-2 text-sm text-white/65">
          Creá una campaña reutilizable por evento, con precio especial y códigos (PIN) de un solo uso.
        </p>
      </div>

      {error ? (
        <div className="mt-5 rounded-xl border border-red-400/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">{error}</div>
      ) : null}
      {ok ? (
        <div className="mt-5 rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
          {ok === "campaign_created" ? "Campaña creada y códigos iniciales generados." : "Códigos agregados a la campaña."}
        </div>
      ) : null}

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <div className="surface-glass p-5">
          <h2 className="text-lg font-semibold text-white">Nueva campaña</h2>
          <form action={createCampaignAction} className="mt-4 grid gap-4">
            <label className="grid gap-2 text-sm text-white/90">
              Entrada del evento
              <select className="input-design h-11" name="ticket_type_id" required>
                <option value="">Seleccionar...</option>
                {(ticketTypes ?? []).map((tt) => {
                  const ev = relOne(tt.events as { name: string; slug: string; organizations: unknown } | { name: string; slug: string; organizations: unknown }[] | null);
                  const org = relOne((ev?.organizations ?? null) as { slug: string } | { slug: string }[] | null);
                  if (!ev || !org) return null;
                  return (
                    <option key={String(tt.id)} value={String(tt.id)}>
                      {org.slug}/{ev.slug} · {ev.name} · {tt.name} · base {money.format(Number(tt.price_ars ?? 0))}
                    </option>
                  );
                })}
              </select>
            </label>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="grid gap-2 text-sm text-white/90">
                Precio con beneficio (ARS)
                <input className="input-design h-11" name="discounted_price_ars" placeholder="10000" required inputMode="decimal" />
              </label>
              <label className="grid gap-2 text-sm text-white/90">
                Códigos iniciales
                <input className="input-design h-11" name="initial_codes_qty" defaultValue="200" required inputMode="numeric" />
              </label>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="grid gap-2 text-sm text-white/90">
                Vence en (horas)
                <select className="input-design h-11" name="expires_hours" defaultValue="48">
                  <option value="0">Sin vencimiento</option>
                  <option value="24">24 h</option>
                  <option value="48">48 h</option>
                  <option value="72">72 h</option>
                </select>
              </label>
              <label className="grid gap-2 text-sm text-white/90">
                Nota interna (opcional)
                <input className="input-design h-11" name="note" placeholder="Ej: Promo grupos WhatsApp mayo" />
              </label>
            </div>

            <button type="submit" className="btn-cta-primary w-full justify-center sm:w-auto">
              Crear campaña + códigos
            </button>
          </form>
        </div>

        <div className="surface-glass p-5">
          <h2 className="text-lg font-semibold text-white">Agregar más códigos</h2>
          <form action={generateMoreCodesAction} className="mt-4 grid gap-4">
            <label className="grid gap-2 text-sm text-white/90">
              Campaña
              <select className="input-design h-11" name="campaign_id" defaultValue={selectedCampaignId} required>
                <option value="">Seleccionar...</option>
                {(campaigns ?? []).map((c) => {
                  const ev = relOne(c.events as { name: string } | { name: string }[] | null);
                  return (
                    <option key={String(c.id)} value={String(c.id)}>
                      {ev?.name ?? "Evento"} · {money.format(Number(c.discounted_price_ars ?? 0))} · {String(c.status)}
                    </option>
                  );
                })}
              </select>
            </label>

            <label className="grid gap-2 text-sm text-white/90">
              Cantidad
              <input className="input-design h-11" name="more_codes_qty" defaultValue="50" required inputMode="numeric" />
            </label>

            <button type="submit" className="rounded-full border border-white/20 bg-white/[0.06] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-white/[0.1]">
              Generar más códigos
            </button>
          </form>
        </div>
      </div>

      <div className="mt-8">
        <h2 className="text-lg font-semibold text-white">Campañas activas y recientes</h2>
        <div className="mt-3 overflow-x-auto rounded-xl border border-white/10 bg-black/20">
          <table className="w-full min-w-[980px] text-left text-sm">
            <thead className="bg-white/5 text-[11px] uppercase tracking-wider text-white/55">
              <tr>
                <th className="px-3 py-2.5 font-medium">Evento / Entrada</th>
                <th className="px-3 py-2.5 font-medium">Precio beneficio</th>
                <th className="px-3 py-2.5 font-medium">Estado</th>
                <th className="px-3 py-2.5 font-medium">Pendientes</th>
                <th className="px-3 py-2.5 font-medium">Usados</th>
                <th className="px-3 py-2.5 font-medium">Vence</th>
                <th className="px-3 py-2.5 font-medium">Link</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {(campaigns ?? []).map((c) => {
                const ev = relOne(c.events as { name: string; slug: string; organizations: unknown } | { name: string; slug: string; organizations: unknown }[] | null);
                const org = relOne((ev?.organizations ?? null) as { slug: string } | { slug: string }[] | null);
                const tt = relOne(c.ticket_types as { name: string } | { name: string }[] | null);
                const benefitPath =
                  org && ev
                    ? `/e/${encodeURIComponent(String(org.slug))}/${encodeURIComponent(String(ev.slug))}/beneficio/${encodeURIComponent(String(c.token))}`
                    : "";
                const pending = pendingCounts.get(String(c.id)) ?? 0;
                const used = usedCounts.get(String(c.id)) ?? 0;

                return (
                  <tr key={String(c.id)} className="hover:bg-white/[0.03]">
                    <td className="px-3 py-2.5">
                      <p className="font-medium text-white">{ev?.name ?? "—"}</p>
                      <p className="text-xs text-white/55">{tt?.name ?? "Entrada"} · {org?.slug ?? "—"}/{ev?.slug ?? "—"}</p>
                    </td>
                    <td className="px-3 py-2.5 font-semibold text-brand">{money.format(Number(c.discounted_price_ars ?? 0))}</td>
                    <td className="px-3 py-2.5 text-white/80">{String(c.status)}</td>
                    <td className="px-3 py-2.5 text-white">{pending}</td>
                    <td className="px-3 py-2.5 text-white">{used}</td>
                    <td className="px-3 py-2.5 text-xs text-white/70">{fmtDate(c.expires_at as string | null)}</td>
                    <td className="px-3 py-2.5">
                      {benefitPath ? (
                        <Link href={`/app/beneficios?id=${encodeURIComponent(String(c.id))}`} className="mr-3 text-xs text-white/70 underline decoration-white/20">
                          ver códigos
                        </Link>
                      ) : null}
                      {benefitPath ? (
                        <Link href={benefitPath} className="font-mono text-xs text-brand underline decoration-white/15 underline-offset-4">
                          abrir
                        </Link>
                      ) : (
                        <span className="text-xs text-white/45">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
              {(campaigns ?? []).length === 0 ? (
                <tr>
                  <td className="px-3 py-6 text-center text-sm text-white/55" colSpan={7}>
                    Todavía no hay campañas de beneficio.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      {selectedCampaignId ? (
        <div className="mt-8">
          <h2 className="text-lg font-semibold text-white">Códigos de la campaña seleccionada</h2>
          <p className="mt-1 text-xs text-white/55">
            Usá el mismo link de campaña y enviá uno de estos códigos a cada persona.
          </p>
          <div className="mt-3 overflow-x-auto rounded-xl border border-white/10 bg-black/20">
            <table className="w-full min-w-[520px] text-left text-sm">
              <thead className="bg-white/5 text-[11px] uppercase tracking-wider text-white/55">
                <tr>
                  <th className="px-3 py-2.5 font-medium">Código</th>
                  <th className="px-3 py-2.5 font-medium">Estado</th>
                  <th className="px-3 py-2.5 font-medium">Creado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {selectedCodes.map((r) => (
                  <tr key={`${r.code}-${r.created_at}`} className="hover:bg-white/[0.03]">
                    <td className="px-3 py-2.5 font-mono font-semibold text-white">{r.code}</td>
                    <td className="px-3 py-2.5 text-white/75">{r.status}</td>
                    <td className="px-3 py-2.5 text-xs text-white/60">{fmtDate(r.created_at)}</td>
                  </tr>
                ))}
                {selectedCodes.length === 0 ? (
                  <tr>
                    <td className="px-3 py-6 text-center text-sm text-white/55" colSpan={3}>
                      No hay códigos para esta campaña.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </div>
  );
}

