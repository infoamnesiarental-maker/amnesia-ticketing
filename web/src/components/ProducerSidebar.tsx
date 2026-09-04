"use client";

import type { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";

function isActive(pathname: string, href: string): boolean {
  if (href === "/app") return pathname === "/app" || pathname === "/app/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

function IconHome() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1v-9.5Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
    </svg>
  );
}

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

function IconScan() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M8 4H6a2 2 0 0 0-2 2v2M16 4h2a2 2 0 0 1 2 2v2M8 20H6a2 2 0 0 1-2-2v-2M16 20h2a2 2 0 0 0 2-2v-2"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
      <path d="M9 12h6M12 9v6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
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

function IconUser() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 12a3.25 3.25 0 1 0-3.25-3.25A3.25 3.25 0 0 0 12 12Zm0 2c-3.2 0-5.75 1.76-5.75 4v.5h11.5V18c0-2.24-2.55-4-5.75-4Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

function IconLink() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M10 13.5 14 9.5M8 7.5l-2 2a3 3 0 0 0 4.24 4.24l1.26-1.26M16 16.5l2-2a3 3 0 0 0-4.24-4.24L12.5 11.5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <p className="px-2.5 pb-1 pt-4 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/30 first:pt-0">
      {children}
    </p>
  );
}

function NavItem({
  href,
  label,
  description,
  icon,
}: {
  href: string;
  label: string;
  description: string;
  icon: ReactNode;
}) {
  const pathname = usePathname();
  const active = isActive(pathname, href);

  return (
    <Link
      href={href}
      title={description}
      aria-current={active ? "page" : undefined}
      className={`group relative flex items-center gap-2.5 rounded-lg px-2.5 py-[7px] text-[13px] font-medium transition-colors ${
        active ? "bg-white/[0.08] text-white" : "text-white/60 hover:bg-white/[0.04] hover:text-white/90"
      }`}
    >
      {active ? (
        <span
          className="absolute left-0 top-1/2 h-4 w-[3px] -translate-y-1/2 rounded-r-full bg-brand"
          aria-hidden
        />
      ) : null}
      <span
        className={`shrink-0 transition-colors ${active ? "text-brand" : "text-white/35 group-hover:text-white/70"}`}
        aria-hidden
      >
        {icon}
      </span>
      <span className="truncate">{label}</span>
    </Link>
  );
}

export function ProducerSidebar({
  orgName,
  accountStatus,
}: {
  orgName: string;
  accountStatus: string;
}) {
  const approved = accountStatus === "approved";

  return (
    <aside className="hidden w-[15rem] shrink-0 border-r border-white/10 bg-black/40 backdrop-blur-sm md:sticky md:top-0 md:flex md:h-screen md:flex-col lg:w-[16rem]">
      {/* Cabecera fija */}
      <div className="shrink-0 px-4 pb-3 pt-4">
        <div className="flex items-center gap-2.5">
          <div className="relative h-9 w-9 shrink-0 overflow-hidden rounded-lg bg-black/40 ring-1 ring-white/10">
            <Image src="/logoAmnesia.png" alt="" fill sizes="36px" className="object-contain p-1" priority />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-semibold leading-tight text-white">
              {orgName || "Tu productora"}
            </p>
            <p className="mt-0.5 flex items-center gap-1.5 text-[11px] leading-none text-white/40">
              <span
                className={`inline-block h-1.5 w-1.5 shrink-0 rounded-full ${
                  approved ? "bg-emerald-400" : "bg-amber-400"
                }`}
                aria-hidden
              />
              {approved ? "Activa" : "En revisión"}
            </p>
          </div>
        </div>

        {!approved ? (
          <p className="mt-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-2.5 py-2 text-[11px] leading-snug text-amber-100">
            Tu cuenta está en revisión. Vas a poder operar cuando el equipo la apruebe.
          </p>
        ) : null}
      </div>

      {/* Navegación scrolleable */}
      <nav
        className="scrollbar-slim min-h-0 flex-1 overflow-y-auto px-2 pb-3"
        aria-label="Panel productora"
      >
        <SectionLabel>Principal</SectionLabel>
        <NavItem href="/app" label="Inicio" description="Resumen y accesos rápidos" icon={<IconHome />} />
        <NavItem href="/app/eventos" label="Eventos" description="Crear y editar fechas" icon={<IconCalendar />} />
        <NavItem href="/app/ventas" label="Ventas" description="Órdenes y validar pagos" icon={<IconPayments />} />
        <NavItem href="/app/puerta" label="Puerta" description="Escanear QR y validar ingreso" icon={<IconScan />} />
        <NavItem
          href="/app/beneficios"
          label="Beneficios"
          description="Campañas y códigos únicos"
          icon={<IconLink />}
        />

        <SectionLabel>Configuración</SectionLabel>
        <NavItem
          href="/app/configuracion/mp"
          label="Mercado Pago"
          description="Token para validar cobros"
          icon={<IconCard />}
        />
      </nav>

      {/* Pie fijo: siempre accesible aunque la nav scrollee */}
      <div className="shrink-0 border-t border-white/10 p-2">
        <NavItem
          href="/app/perfil"
          label="Perfil y sesión"
          description="Datos personales y cerrar sesión"
          icon={<IconUser />}
        />
      </div>
    </aside>
  );
}
