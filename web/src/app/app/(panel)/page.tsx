import Link from "next/link";
import { redirect } from "next/navigation";

import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function PanelHomePage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth");

  const { data: membership } = await supabase
    .from("org_members")
    .select("organization_id")
    .eq("user_id", user.id)
    .maybeSingle();

  const orgId = membership?.organization_id as string | undefined;
  let orgName = "—";
  let orgSlug = "";
  if (orgId) {
    const { data: org } = await supabase.from("organizations").select("name, slug").eq("id", orgId).maybeSingle();
    if (org) {
      orgName = (org as { name: string }).name;
      orgSlug = (org as { slug: string }).slug;
    }
  }

  const { count: eventCount } = orgId
    ? await supabase.from("events").select("*", { count: "exact", head: true }).eq("organization_id", orgId)
    : { count: 0 };

  return (
    <div>
      <h1 className="text-2xl font-bold text-white">Hola{user.email ? `, ${user.email}` : ""}</h1>
      <p className="mt-2 text-sm text-white/70">
        Productora: <span className="text-white">{orgName}</span>
        {orgSlug ? (
          <span className="text-white/50">
            {" "}
            ({orgSlug}) · {eventCount ?? 0} evento(s)
          </span>
        ) : null}
      </p>
      <div className="mt-10 grid gap-4 sm:grid-cols-2">
        <Link
          href="/app/eventos"
          className="surface-glass block p-6 transition hover:shadow-[var(--shadow-card-hover)]"
        >
          <h2 className="text-lg font-semibold text-white">Eventos</h2>
          <p className="mt-2 text-sm text-white/65">Crear eventos y definir tipos de entrada (precio, stock, venta).</p>
        </Link>
        <Link
          href="/app/ventas"
          className="surface-glass block p-6 transition hover:shadow-[var(--shadow-card-hover)]"
        >
          <h2 className="text-lg font-semibold text-white">Ventas</h2>
          <p className="mt-2 text-sm text-white/65">Ver órdenes, compradores y comprobantes (MVP).</p>
        </Link>
        <Link
          href="/app/configuracion/mp"
          className="surface-glass block p-6 transition hover:shadow-[var(--shadow-card-hover)]"
        >
          <h2 className="text-lg font-semibold text-white">Mercado Pago</h2>
          <p className="mt-2 text-sm text-white/65">
            Cargar el access token de tu productora para validar pagos automáticamente.
          </p>
        </Link>
      </div>
    </div>
  );
}
