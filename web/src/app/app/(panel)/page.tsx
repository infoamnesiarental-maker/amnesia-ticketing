import Link from "next/link";
import { redirect } from "next/navigation";

import { createSupabaseServerClient } from "@/lib/supabase/server";

function IconCalendar() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
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
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
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
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7Z"
        stroke="currentColor"
        strokeWidth="1.7"
      />
      <path d="M4 10h16" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

function IconChevron() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="m9 5 7 7-7 7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
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
    <div className="w-full">
      <header>
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-brand">Panel de organizador</p>
        <h1 className="mt-1.5 truncate text-2xl font-bold text-white md:text-[1.75rem]">Hola, {orgName}</h1>
        <p className="mt-1.5 truncate text-sm text-white/50">{user.email}</p>
      </header>

      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        <Stat label="Eventos creados" value={String(eventCount ?? 0)} />
        <Stat label="Productora" value={orgSlug ? `/${orgSlug}` : "—"} />
        <Stat label="Estado" value="Activa" accent />
      </div>

      <h2 className="mt-9 text-[11px] font-semibold uppercase tracking-[0.2em] text-white/35">Accesos rápidos</h2>
      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <QuickCard
          href="/app/eventos"
          title="Eventos"
          description="Crear eventos y definir tipos de entrada: precio, stock y fecha de venta."
          icon={<IconCalendar />}
        />
        <QuickCard
          href="/app/ventas"
          title="Ventas"
          description="Revisar órdenes, compradores y comprobantes de pago."
          icon={<IconPayments />}
        />
        <QuickCard
          href="/app/configuracion/mp"
          title="Mercado Pago"
          description="Cargar el access token de tu productora para validar cobros automáticamente."
          icon={<IconCard />}
        />
      </div>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
      <p className="text-[11px] font-medium uppercase tracking-wider text-white/40">{label}</p>
      <p className={`mt-1 truncate text-lg font-semibold ${accent ? "text-emerald-300" : "text-white"}`}>{value}</p>
    </div>
  );
}

function QuickCard({
  href,
  title,
  description,
  icon,
}: {
  href: string;
  title: string;
  description: string;
  icon: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="group flex flex-col rounded-xl border border-white/10 bg-white/[0.03] p-5 transition hover:border-brand/40 hover:bg-white/[0.06]"
    >
      <div className="flex items-center gap-3">
        <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand/15 text-brand ring-1 ring-brand/25">
          {icon}
        </span>
        <h3 className="flex-1 text-base font-semibold text-white">{title}</h3>
        <span
          className="text-white/25 transition group-hover:translate-x-0.5 group-hover:text-brand"
          aria-hidden
        >
          <IconChevron />
        </span>
      </div>
      <p className="mt-2.5 text-[13px] leading-relaxed text-white/55">{description}</p>
    </Link>
  );
}
