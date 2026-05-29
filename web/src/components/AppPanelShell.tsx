"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

import { ProducerSidebar } from "@/components/ProducerSidebar";

function IconUserCircle() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4Zm0 2c-3.33 0-6 2-6 4v1h12v-1c0-2-2.67-4-6-4Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="12" r="9.25" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

function IconHamburger() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 7h16M4 12h16M4 17h16"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

// ── Bottom tab bar icons ───────────────────────────────────────────────────────

function TabIconCalendar() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M8 2v4m8-4v4M4 9h16M5 5h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function TabIconSale() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 5v14M5 12h14"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function TabIconVentas() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9l-6-6Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path d="M14 3v6h6M8 13h8M8 17h5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function TabIconPuerta() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M8 4H6a2 2 0 0 0-2 2v2M16 4h2a2 2 0 0 1 2 2v2M8 20H6a2 2 0 0 1-2-2v-2M16 20h2a2 2 0 0 0 2-2v-2"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path d="M9 12h6M12 9v6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function TabIconMore() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="5" cy="12" r="1.5" fill="currentColor" />
      <circle cx="12" cy="12" r="1.5" fill="currentColor" />
      <circle cx="19" cy="12" r="1.5" fill="currentColor" />
    </svg>
  );
}

// ── Mobile menu helpers ────────────────────────────────────────────────────────

function MobileNavItem({
  href,
  label,
  description,
  onNavigate,
}: {
  href: string;
  label: string;
  description: string;
  onNavigate: () => void;
}) {
  const pathname = usePathname();
  const active =
    href === "/app"
      ? pathname === "/app" || pathname === "/app/"
      : pathname === href || pathname.startsWith(`${href}/`);
  return (
    <Link
      href={href}
      onClick={onNavigate}
      className={`block rounded-xl border px-3 py-3 transition ${
        active
          ? "border-brand/40 bg-brand/15 text-white"
          : "border-white/10 bg-white/[0.03] text-white/85 hover:bg-white/[0.06]"
      }`}
    >
      <p className="text-sm font-semibold">{label}</p>
      <p className="mt-0.5 text-xs text-white/55">{description}</p>
    </Link>
  );
}

// ── Bottom tab item ────────────────────────────────────────────────────────────

function BottomTabItem({
  href,
  label,
  icon,
  onClick,
  isActive: forcedActive,
}: {
  href?: string;
  label: string;
  icon: React.ReactNode;
  onClick?: () => void;
  isActive?: boolean;
}) {
  const pathname = usePathname();
  const active =
    forcedActive !== undefined
      ? forcedActive
      : href
        ? href === "/app"
          ? pathname === "/app" || pathname === "/app/"
          : pathname === href || pathname.startsWith(`${href}/`)
        : false;

  const base =
    "flex min-w-0 flex-1 flex-col items-center gap-0.5 px-1 pt-2 pb-1 text-[10px] font-semibold transition-colors";
  const colorCls = active ? "text-brand" : "text-white/45";
  const content = (
    <>
      <span className={active ? "text-brand" : "text-white/40"}>{icon}</span>
      <span className="truncate">{label}</span>
    </>
  );

  if (href && !onClick) {
    return (
      <Link href={href} className={`${base} ${colorCls}`}>
        {content}
      </Link>
    );
  }

  return (
    <button type="button" onClick={onClick} className={`${base} ${colorCls}`}>
      {content}
    </button>
  );
}

// ── Main shell ─────────────────────────────────────────────────────────────────

export function AppPanelShell({
  children,
  orgName,
  accountStatus,
}: {
  children: React.ReactNode;
  orgName: string;
  accountStatus: string;
}) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  // Determinar si la tab de "venta manual" está activa
  const ventaManualActive =
    pathname.includes("/venta-manual");

  // Tab "Ventas" activa sólo si estamos en /app/ventas pero NO en venta-manual
  const ventasActive =
    !ventaManualActive &&
    (pathname === "/app/ventas" || pathname.startsWith("/app/ventas/"));

  return (
    <div className="min-h-screen bg-[#0A0A0A]">
      <div className="mx-auto flex min-h-screen max-w-content">
        <ProducerSidebar orgName={orgName} accountStatus={accountStatus} />

        <div className="flex min-w-0 flex-1 flex-col">
          {/* Mobile top header */}
          <header className="flex items-center justify-between gap-3 border-b border-white/10 bg-black/25 px-4 py-3 md:hidden">
            <button
              type="button"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.06] text-white/85 transition hover:border-brand/40 hover:bg-brand/10 hover:text-brand"
              aria-label={menuOpen ? "Cerrar menú" : "Abrir menú"}
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((v) => !v)}
            >
              <IconHamburger />
            </button>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-brand">Amnesia Ticketing</p>
              <p className="truncate text-sm font-medium text-white">{orgName || "Tu productora"}</p>
            </div>
            <Link
              href="/app/perfil"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.06] text-white/85 transition hover:border-brand/40 hover:bg-brand/10 hover:text-brand"
              aria-label="Perfil y sesión"
            >
              <IconUserCircle />
            </Link>
          </header>

          {/* Mobile drawer menu */}
          {menuOpen ? (
            <div className="fixed inset-0 z-50 md:hidden" role="dialog" aria-label="Menú panel productora">
              <button
                type="button"
                className="absolute inset-0 bg-black/60"
                aria-label="Cerrar"
                onClick={() => setMenuOpen(false)}
              />
              <div className="absolute left-0 top-0 h-full w-[min(92vw,22rem)] border-r border-white/10 bg-[#0A0A0A]/95 p-4 pb-24 overflow-y-auto backdrop-blur">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold uppercase tracking-[0.22em] text-brand">Panel</p>
                    <p className="mt-1 truncate text-base font-semibold text-white">{orgName || "Tu productora"}</p>
                    <p className="mt-1 text-xs text-white/55">
                      Estado:{" "}
                      <span className={accountStatus === "approved" ? "text-emerald-200" : "text-amber-200"}>
                        {accountStatus === "approved" ? "Aprobada" : "En revisión"}
                      </span>
                    </p>
                  </div>
                  <button
                    type="button"
                    className="rounded-xl border border-white/10 bg-white/[0.06] px-3 py-2 text-sm font-semibold text-white/85 hover:bg-white/[0.09]"
                    onClick={() => setMenuOpen(false)}
                  >
                    Cerrar
                  </button>
                </div>

                <div className="mt-5 grid gap-2">
                  <p className="mt-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-white/35">Principal</p>
                  <MobileNavItem
                    href="/app"
                    label="Inicio"
                    description="Resumen y accesos rápidos"
                    onNavigate={() => setMenuOpen(false)}
                  />
                  <MobileNavItem
                    href="/app/eventos"
                    label="Eventos"
                    description="Crear y editar fechas"
                    onNavigate={() => setMenuOpen(false)}
                  />
                  <MobileNavItem
                    href="/app/ventas"
                    label="Ventas"
                    description="Órdenes y validar pagos"
                    onNavigate={() => setMenuOpen(false)}
                  />
                  <MobileNavItem
                    href="/app/puerta"
                    label="Puerta"
                    description="Escanear QR y validar ingreso"
                    onNavigate={() => setMenuOpen(false)}
                  />
                  <MobileNavItem
                    href="/app/beneficios"
                    label="Beneficios"
                    description="Campañas y códigos únicos"
                    onNavigate={() => setMenuOpen(false)}
                  />

                  <p className="mt-4 text-[11px] font-semibold uppercase tracking-[0.2em] text-white/35">Configuración</p>
                  <MobileNavItem
                    href="/app/configuracion/mp"
                    label="Mercado Pago"
                    description="Token para validar cobros"
                    onNavigate={() => setMenuOpen(false)}
                  />

                  <p className="mt-4 text-[11px] font-semibold uppercase tracking-[0.2em] text-white/35">Cuenta</p>
                  <MobileNavItem
                    href="/app/perfil"
                    label="Perfil y sesión"
                    description="Datos personales y cerrar sesión"
                    onNavigate={() => setMenuOpen(false)}
                  />
                </div>
              </div>
            </div>
          ) : null}

          {/* Page content — extra padding-bottom en mobile para la bottom bar */}
          <div className="section-padding-x flex min-h-0 flex-1 flex-col pb-24 pt-6 md:pb-10 md:pt-8">
            {children}
          </div>

          {/* ── Bottom tab bar (mobile only) ── */}
          <nav
            className="fixed bottom-0 left-0 right-0 z-40 flex items-stretch border-t border-white/10 bg-[#0A0A0A]/96 backdrop-blur-xl md:hidden"
            aria-label="Navegación principal"
          >
            <BottomTabItem href="/app/eventos" label="Eventos" icon={<TabIconCalendar />} />
            <BottomTabItem
              href="/app/ventas"
              label="Ventas"
              icon={<TabIconVentas />}
              isActive={ventasActive}
            />
            {/* Botón central: venta rápida — destaca con fondo */}
            <div className="relative flex flex-1 items-center justify-center py-1">
              <Link
                href="/app/eventos"
                aria-label="Venta manual — ir a eventos"
                className={`flex flex-col items-center gap-0.5 rounded-2xl px-4 py-2 text-[10px] font-bold transition-colors ${
                  ventaManualActive
                    ? "bg-amber-500 text-white"
                    : "bg-amber-500/15 text-amber-300 hover:bg-amber-500/25"
                }`}
              >
                <TabIconSale />
                <span>Venta</span>
              </Link>
            </div>
            <BottomTabItem href="/app/puerta" label="Puerta" icon={<TabIconPuerta />} />
            <BottomTabItem
              label="Más"
              icon={<TabIconMore />}
              onClick={() => setMenuOpen((v) => !v)}
              isActive={menuOpen}
            />
          </nav>
        </div>
      </div>
    </div>
  );
}
