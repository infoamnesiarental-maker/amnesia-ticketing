import { getMpAccessToken, getPublicSiteUrl, isMpCheckoutConfigured } from "@/lib/mercadopago";
import { getMpCheckoutEnabled } from "@/lib/platform-settings";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/admin";

import { MpCheckoutToggleButtons } from "./MpCheckoutToggleButtons";

export const dynamic = "force-dynamic";

export default async function AdminPagosPage() {
  const admin = createSupabaseServiceRoleClient();

  if (!admin) {
    return (
      <div className="rounded-xl border border-amber-400/30 bg-amber-500/10 p-6 text-sm text-amber-50">
        Para gestionar pagos desde Admin, agregá <code className="text-white">SUPABASE_SERVICE_ROLE_KEY</code> en{" "}
        <code className="text-white">web/.env.local</code> y reiniciá.
      </div>
    );
  }

  let enabled = false;
  let settingsError: string | null = null;
  try {
    enabled = await getMpCheckoutEnabled(admin);
  } catch (e) {
    settingsError = e instanceof Error ? e.message : "No se pudo leer platform_settings.";
  }

  const { data: row, error: rowErr } = await admin
    .from("platform_settings")
    .select("mp_checkout_enabled, updated_at")
    .eq("id", 1)
    .maybeSingle();

  if (rowErr) {
    settingsError =
      /relation .*platform_settings.* does not exist|undefined_table/i.test(rowErr.message)
        ? "Falta ejecutar supabase/mp-checkout-global.sql en el SQL Editor de Supabase."
        : rowErr.message;
  } else if (row) {
    enabled = Boolean((row as { mp_checkout_enabled: boolean }).mp_checkout_enabled);
  }

  const configured = isMpCheckoutConfigured();
  const token = getMpAccessToken();
  const siteUrl = getPublicSiteUrl();
  const webhookUrl = siteUrl ? `${siteUrl.replace(/\/+$/, "")}/api/webhooks/mercadopago` : null;
  const updatedAt = row && (row as { updated_at?: string }).updated_at
    ? new Date(String((row as { updated_at: string }).updated_at)).toLocaleString("es-AR")
    : null;

  return (
    <div className="mx-auto w-full max-w-2xl md:mx-0">
      <div className="text-center md:text-left">
        <h1 className="text-2xl font-bold text-white">Pagos · Mercado Pago</h1>
        <p className="mt-2 text-sm text-white/65">
          Switch global: cuando está ON, todas las compras nuevas van a Checkout Pro (tu cuenta). Cuando está OFF,
          se mantiene el flujo actual de transferencia + comprobante.
        </p>
      </div>

      {settingsError ? (
        <div className="mt-6 rounded-xl border border-amber-400/30 bg-amber-500/10 p-4 text-sm text-amber-50">
          {settingsError}
        </div>
      ) : null}

      <section className="surface-glass mt-6 p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-white/45">Estado</p>
            <p className="mt-1 text-lg font-semibold text-white">
              {enabled ? (
                <span className="text-emerald-300">ON · Checkout Pro activo</span>
              ) : (
                <span className="text-white/70">OFF · Transferencia + comprobante</span>
              )}
            </p>
            {updatedAt ? <p className="mt-1 text-xs text-white/40">Último cambio: {updatedAt}</p> : null}
          </div>
          <span
            className={`inline-flex h-3 w-3 rounded-full ${enabled ? "bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.8)]" : "bg-white/25"}`}
            aria-hidden
          />
        </div>

        <div className="mt-6">
          <MpCheckoutToggleButtons enabled={enabled} canEnable={configured && !settingsError} />
        </div>
      </section>

      <section className="surface-glass mt-4 space-y-3 p-6 text-sm text-white/70">
        <p className="text-xs font-semibold uppercase tracking-wider text-white/45">Checklist</p>
        <ul className="grid gap-2">
          <li className={configured ? "text-emerald-200" : "text-amber-200"}>
            {configured ? "✓" : "○"} <code className="text-white/90">MP_ACCESS_TOKEN</code> +{" "}
            <code className="text-white/90">MP_WEBHOOK_SECRET</code>
            {token ? (
              <span className="ml-2 text-xs text-white/40">
                ({token.startsWith("TEST-") ? "credenciales de prueba" : "producción"})
              </span>
            ) : null}
          </li>
          <li className={siteUrl.startsWith("https://") ? "text-emerald-200" : "text-amber-200"}>
            {siteUrl.startsWith("https://") ? "✓" : "○"}{" "}
            <code className="text-white/90">NEXT_PUBLIC_SITE_URL</code> en HTTPS
            {siteUrl ? (
              <span className="mt-1 block break-all font-mono text-xs text-white/40">{siteUrl}</span>
            ) : (
              <span className="mt-1 block text-xs">Falta configurar la URL pública.</span>
            )}
          </li>
          <li className="text-white/60">
            ○ Webhook en{" "}
            <a
              href="https://www.mercadopago.com.ar/developers/panel/app"
              target="_blank"
              rel="noopener noreferrer"
              className="underline decoration-white/30 underline-offset-2 hover:text-white"
            >
              Tus integraciones
            </a>
            {webhookUrl ? (
              <span className="mt-1 block break-all font-mono text-xs text-white/40">{webhookUrl}</span>
            ) : null}
            <span className="mt-1 block text-xs text-white/45">Tópico: Pagos · secret → MP_WEBHOOK_SECRET</span>
          </li>
        </ul>
        <p className="pt-2 text-xs text-white/45">
          La comisión / acreditación instantánea (~3%) se configura en tu cuenta de Mercado Pago, no en esta app. En
          cada preferencia forzamos 1 cuota.
        </p>
      </section>
    </div>
  );
}
