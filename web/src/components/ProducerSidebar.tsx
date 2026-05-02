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
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
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
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
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
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
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
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M8 4H6a2 2 0 0 0-2 2v2M16 4h2a2 2 0 0 1 2 2v2M8 20H6a2 2 0 0 1-2-2v-2M16 20h2a2 2 0 0 0 2-2v-2" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      <path d="M9 12h6M12 9v6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

function IconCard() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
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
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
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
      className={`group flex items-start gap-3 rounded-xl border px-3 py-3 text-left transition ${
        active
          ? "border-brand/50 bg-brand/15 text-white shadow-[0_12px_40px_rgba(0,0,0,0.35)]"
          : "border-transparent text-white/75 hover:border-white/10 hover:bg-white/[0.06] hover:text-white"
      }`}
    >
      <span
        className={`mt-0.5 shrink-0 ${active ? "text-brand" : "text-white/40 group-hover:text-white/65"}`}
        aria-hidden
      >
        {icon}
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-semibold leading-tight">{label}</span>
        <span className="mt-0.5 block text-xs font-normal leading-snug text-white/45 group-hover:text-white/55">
          {description}
        </span>
      </span>
    </Link>
  );
}

function NavPill({
  href,
  label,
  icon,
}: {
  href: string;
  label: string;
  icon: ReactNode;
}) {
  const pathname = usePathname();
  const active = isActive(pathname, href);
  return (
    <Link
      href={href}
      className={`flex min-w-[4.25rem] shrink-0 flex-col items-center gap-1 rounded-xl px-2 py-2.5 text-[10px] font-semibold transition ${
        active ? "bg-brand/20 text-white ring-1 ring-brand/35" : "text-white/55 hover:bg-white/5 hover:text-white/90"
      }`}
    >
      <span className={active ? "text-brand" : "text-white/45"} aria-hidden>
        {icon}
      </span>
      <span className="max-w-[4.5rem] truncate text-center leading-none">{label}</span>
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
    <>
      {/* Desktop / tablet: barra lateral */}
      <aside className="hidden w-60 shrink-0 border-r border-white/10 bg-black/30 backdrop-blur-sm md:sticky md:top-0 md:flex md:h-screen md:max-h-screen md:flex-col md:overflow-y-auto lg:w-64">
        <div className="flex flex-col gap-6 p-5">
          <div className="flex items-center gap-3">
            <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-xl bg-black/40 ring-1 ring-white/10">
              <Image src="/logoAmnesia.png" alt="" fill sizes="44px" className="object-contain p-1.5" priority />
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-white">{orgName || "Tu productora"}</p>
              <p className="text-[11px] text-white/45">Panel de organizador</p>
            </div>
          </div>

          <div
            className={`rounded-xl border px-3 py-2 text-xs ${
              approved
                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-100"
                : "border-amber-500/35 bg-amber-500/10 text-amber-100"
            }`}
          >
            {approved ? (
              <span className="font-medium">Cuenta aprobada · podés operar con normalidad</span>
            ) : (
              <span className="font-medium">Cuenta en revisión · esperá la aprobación del equipo</span>
            )}
          </div>

          <nav className="flex flex-col gap-1" aria-label="Panel productora">
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-white/35">Principal</p>
            <NavItem href="/app" label="Inicio" description="Resumen y accesos rápidos" icon={<IconHome />} />
            <NavItem href="/app/eventos" label="Eventos" description="Crear y editar fechas" icon={<IconCalendar />} />
            <NavItem
              href="/app/ventas"
              label="Ventas"
              description="Órdenes y validar pagos"
              icon={<IconPayments />}
            />
            <NavItem
              href="/app/puerta"
              label="Puerta"
              description="Escanear QR y validar ingreso"
              icon={<IconScan />}
            />
            <p className="mb-1 mt-5 text-[11px] font-semibold uppercase tracking-[0.2em] text-white/35">
              Configuración
            </p>
            <NavItem
              href="/app/configuracion/mp"
              label="Mercado Pago"
              description="Token para validar cobros"
              icon={<IconCard />}
            />
            <p className="mb-1 mt-5 text-[11px] font-semibold uppercase tracking-[0.2em] text-white/35">Cuenta</p>
            <NavItem
              href="/app/perfil"
              label="Perfil y sesión"
              description="Datos personales y cerrar sesión"
              icon={<IconUser />}
            />
          </nav>
        </div>
      </aside>
    </>
  );
}
