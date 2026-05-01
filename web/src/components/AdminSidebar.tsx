"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";

function isActive(pathname: string, href: string): boolean {
  if (href === "/admin") return pathname === "/admin";
  return pathname === href || pathname.startsWith(`${href}/`);
}

function Item({
  href,
  label,
  icon,
  disabled,
  badge,
}: {
  href?: string;
  label: string;
  icon: React.ReactNode;
  disabled?: boolean;
  badge?: string;
}) {
  const pathname = usePathname();
  const active = href ? isActive(pathname, href) : false;

  const base =
    "group flex items-center justify-between gap-3 rounded-xl px-3 py-3 text-sm transition";
  const left = "flex items-center gap-3";

  const cls = disabled
    ? `${base} cursor-not-allowed text-white/35`
    : active
      ? `${base} border border-brand/40 bg-brand/10 text-white shadow-[0_18px_60px_rgba(0,0,0,0.35)]`
      : `${base} border border-white/0 text-white/80 hover:bg-white/5 hover:text-white`;

  const iconCls = disabled ? "text-white/25" : active ? "text-brand" : "text-white/45 group-hover:text-white/70";

  const content = (
    <div className={cls} aria-disabled={disabled ? true : undefined}>
      <div className={left}>
        <span className={iconCls} aria-hidden>
          {icon}
        </span>
        <span className="font-medium">{label}</span>
      </div>
      {badge ? (
        <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] uppercase tracking-wider text-white/45">
          {badge}
        </span>
      ) : null}
    </div>
  );

  if (!href || disabled) return content;
  return (
    <Link href={href} className="block">
      {content}
    </Link>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-6">
      <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/35">{title}</p>
      <div className="mt-3 grid gap-1.5">{children}</div>
    </div>
  );
}

function IconGrid() {
  return (
    <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
      <path
        d="M3.25 3.25h5.5v5.5h-5.5v-5.5Zm8 0h5.5v5.5h-5.5v-5.5Zm-8 8h5.5v5.5h-5.5v-5.5Zm8 0h5.5v5.5h-5.5v-5.5Z"
        stroke="currentColor"
        strokeWidth="1.6"
      />
    </svg>
  );
}

function IconBuilding() {
  return (
    <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
      <path
        d="M4 17V5.5A2.5 2.5 0 0 1 6.5 3H13.5A2.5 2.5 0 0 1 16 5.5V17M4 17h12M7 7h2M11 7h2M7 10h2M11 10h2M7 13h2M11 13h2"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconCalendar() {
  return (
    <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
      <path
        d="M6 3v2M14 3v2M3.5 7.5h13M5 5h10a1.5 1.5 0 0 1 1.5 1.5V15A2 2 0 0 1 14.5 17h-9A2 2 0 0 1 3.5 15V6.5A1.5 1.5 0 0 1 5 5Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconUsers() {
  return (
    <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
      <path
        d="M7.5 9.5a3 3 0 1 1 0-6 3 3 0 0 1 0 6Zm9 7.5v-1a4.5 4.5 0 0 0-9 0v1M12.5 9.25a2.5 2.5 0 1 0 0-5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconGlobe() {
  return (
    <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
      <path
        d="M10 17a7 7 0 1 0 0-14 7 7 0 0 0 0 14Zm0-14c2.2 1.9 3.5 4.5 3.5 7S12.2 15.1 10 17M10 3C7.8 4.9 6.5 7.5 6.5 10s1.3 5.1 3.5 7M3.5 10h13"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function AdminSidebar() {
  return (
    <div className="surface-glass p-5">
      <div className="flex items-center gap-3">
        <div className="relative h-10 w-10 overflow-hidden rounded-xl bg-black/30 ring-1 ring-white/10">
          <Image src="/logoAmnesia.png" alt="" fill sizes="40px" className="object-contain p-1.5" priority />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-white">Amnesia</p>
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/40">Panel interno</p>
        </div>
      </div>

      <Section title="General">
        <Item href="/admin" label="Resumen" icon={<IconGrid />} />
      </Section>

      <Section title="Comercial y operaciones">
        <Item href="/admin/productoras" label="Productoras" icon={<IconBuilding />} />
        <Item href="/admin/eventos" label="Eventos" icon={<IconCalendar />} />
        <Item href="/admin/usuarios" label="Usuarios" icon={<IconUsers />} />
      </Section>

      <Section title="Marketing">
        <Item href="/" label="Sitio público" icon={<IconGlobe />} />
        <Item label="Campañas" icon={<IconGlobe />} disabled badge="Próximamente" />
      </Section>

      <div className="mt-6 border-t border-white/10 pt-4">
        <Link href="/" className="text-xs text-white/55 hover:text-white">
          Ir al sitio →
        </Link>
      </div>
    </div>
  );
}

