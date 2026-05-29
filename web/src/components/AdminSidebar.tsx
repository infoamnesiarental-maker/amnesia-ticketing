"use client";

import type { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";

function isActive(pathname: string, href: string): boolean {
  if (href === "/admin") return pathname === "/admin" || pathname === "/admin/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

function IconLayout() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 5a1 1 0 0 1 1-1h5a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5Zm9 0a1 1 0 0 1 1-1h5a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1h-5a1 1 0 0 1-1-1V5ZM4 16a1 1 0 0 1 1-1h5a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-3Zm9-5a1 1 0 0 1 1-1h5a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1h-5a1 1 0 0 1-1-1v-8Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconBuilding() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M6 22V10l6-4 6 4v12M9 22v-6h6v6M10 14h4"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconCalendar() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M8 2v4m8-4v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconUsers() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm8 10v-2a4 4 0 0 0-3-3.87M21 12a4 4 0 0 0-3-3.87"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
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


const NAV: Array<{ href: string; label: string; hint: string; icon: ReactNode }> = [
  { href: "/admin", label: "Resumen", hint: "Métricas y alertas", icon: <IconLayout /> },
  { href: "/admin/productoras", label: "Productoras", hint: "Altas y estados", icon: <IconBuilding /> },
  { href: "/admin/eventos", label: "Eventos", hint: "Todos los eventos", icon: <IconCalendar /> },
  { href: "/admin/usuarios", label: "Usuarios", hint: "Cuentas Supabase", icon: <IconUsers /> },
  { href: "/admin/perfil", label: "Perfil", hint: "Datos personales y sesión", icon: <IconUser /> },
];

function Item({
  href,
  label,
  hint,
  icon,
}: {
  href: string;
  label: string;
  hint: string;
  icon: ReactNode;
}) {
  const pathname = usePathname();
  const active = isActive(pathname, href);

  const cls = active
    ? "border-brand/45 bg-brand/12 text-white shadow-[0_12px_40px_rgba(0,0,0,0.35)]"
    : "border-transparent text-white/78 hover:border-white/10 hover:bg-white/[0.06] hover:text-white";

  return (
    <Link
      href={href}
      className={`flex items-start gap-3 rounded-xl border px-3 py-3 text-left transition ${cls}`}
    >
      <span className={`mt-0.5 shrink-0 ${active ? "text-brand" : "text-white/40"}`} aria-hidden>
        {icon}
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-semibold">{label}</span>
        <span className="mt-0.5 block text-xs text-white/45">{hint}</span>
      </span>
    </Link>
  );
}

function MobilePill({ href, label, icon }: { href: string; label: string; icon: ReactNode }) {
  const pathname = usePathname();
  const active = isActive(pathname, href);
  return (
    <Link
      href={href}
      className={`flex min-w-[4.75rem] shrink-0 flex-col items-center gap-1 rounded-xl px-2 py-2.5 text-[10px] font-semibold transition ${
        active ? "bg-brand/25 text-white ring-1 ring-brand/40" : "bg-white/[0.04] text-white/60 hover:bg-white/10"
      }`}
    >
      <span className={active ? "text-brand" : "text-white/45"} aria-hidden>
        {icon}
      </span>
      {label}
    </Link>
  );
}

export function AdminSidebar() {
  return (
    <>
      <nav
        className="mb-4 flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] md:hidden [&::-webkit-scrollbar]:hidden"
        aria-label="Administración (móvil)"
      >
        {NAV.map((item) => (
          <MobilePill key={item.href} href={item.href} label={item.label} icon={item.icon} />
        ))}
      </nav>

      <div className="surface-glass hidden border border-white/[0.08] p-5 shadow-[0_24px_80px_rgba(0,0,0,0.35)] md:block">
        <div className="flex items-center gap-3 border-b border-white/10 pb-5">
          <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-xl bg-black/40 ring-1 ring-white/10">
            <Image src="/logoAmnesia.png" alt="" fill sizes="48px" className="object-contain p-1.5" priority />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold text-white">Administración</p>
            <p className="text-xs text-white/50">Super admin · uso interno</p>
          </div>
        </div>

        <div className="pt-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/35">Navegación</p>
          <div className="mt-3 grid gap-1.5">
            {NAV.map((item) => (
              <Item key={item.href} href={item.href} label={item.label} hint={item.hint} icon={item.icon} />
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
