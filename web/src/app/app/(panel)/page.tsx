import Link from "next/link";
import { redirect } from "next/navigation";

import { createSupabaseServerClient } from "@/lib/supabase/server";

function IconCalendar() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M8 2v4m8-4v4M4 9h16M5 5h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconPayments() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9l-6-6Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      <path d="M14 3v6h6M8 13h8M8 17h5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

function IconCard() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7Z"
        stroke="currentColor"
        strokeWidth="1.7"
      />
      <path d="M4 10h16" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

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
    <div className="mx-auto w-full max-w-3xl md:max-w-none">
      <h1 className="text-center text-2xl font-bold text-white md:text-left">
        Hola{user.email ? `, ${user.email}` : ""}
      </h1>
      <p className="mt-2 text-center text-sm text-white/70 md:text-left">
        Productora: <span className="text-white">{orgName}</span>
        {orgSlug ? (
          <span className="text-white/50">
            {" "}
            ({orgSlug}) · {eventCount ?? 0} evento(s)
          </span>
        ) : null}
      </p>
      <div className="mt-10 grid justify-items-stretch gap-4 sm:grid-cols-2">
        <Link
          href="/app/eventos"
          className="surface-glass block p-6 transition hover:shadow-[var(--shadow-card-hover)]"
        >
          <div className="flex items-center gap-3">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-brand/15 text-brand ring-1 ring-brand/25">
              <IconCalendar />
            </span>
            <h2 className="text-lg font-semibold text-white">Eventos</h2>
          </div>
          <p className="mt-2 text-sm text-white/65">Crear eventos y definir tipos de entrada (precio, stock, venta).</p>
        </Link>
        <Link
          href="/app/ventas"
          className="surface-glass block p-6 transition hover:shadow-[var(--shadow-card-hover)]"
        >
          <div className="flex items-center gap-3">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-brand/15 text-brand ring-1 ring-brand/25">
              <IconPayments />
            </span>
            <h2 className="text-lg font-semibold text-white">Ventas</h2>
          </div>
          <p className="mt-2 text-sm text-white/65">Ver órdenes, compradores y comprobantes (MVP).</p>
        </Link>
        <Link
          href="/app/configuracion/mp"
          className="surface-glass block p-6 transition hover:shadow-[var(--shadow-card-hover)]"
        >
          <div className="flex items-center gap-3">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-brand/15 text-brand ring-1 ring-brand/25">
              <IconCard />
            </span>
            <h2 className="text-lg font-semibold text-white">Mercado Pago</h2>
          </div>
          <p className="mt-2 text-sm text-white/65">
            Cargar el access token de tu productora para validar pagos automáticamente.
          </p>
        </Link>
      </div>
    </div>
  );
}
