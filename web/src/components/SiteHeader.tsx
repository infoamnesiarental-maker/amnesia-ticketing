"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";

interface SiteHeaderProps {
  /** En páginas oscuras sin hero, usar fondo sólido desde el inicio */
  variant?: "hero" | "solid";
  /** Para pantallas de login/registro: sin navegación ni CTA */
  minimal?: boolean;
}

export function SiteHeader({ variant = "hero", minimal = false }: SiteHeaderProps) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    if (variant !== "hero") return;
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [variant]);

  const headerBg =
    variant === "solid" || scrolled
      ? "bg-[var(--header-scroll-bg)] backdrop-blur-[10px] border-b border-white/10"
      : "bg-transparent";

  const showMenu = !minimal && variant !== "hero";
  const showCta = !minimal;

  return (
    <header
      className={`fixed top-0 z-50 flex h-20 w-full items-center transition-[background,backdrop-filter,border-color] duration-300 ${headerBg}`}
      style={{ paddingLeft: "var(--pad-section-x)", paddingRight: "var(--pad-section-x)" }}
    >
      <div className="max-w-content mx-auto flex w-full min-w-0 items-center justify-between gap-3 sm:gap-6">
        <Link
          href="/"
          className="flex min-w-0 items-center gap-2 text-white sm:gap-3"
          aria-label="Inicio AmnesiaTicketing"
        >
          <span className="relative h-9 w-9 shrink-0 overflow-hidden rounded-xl bg-black/20 shadow-lg sm:h-10 sm:w-10">
            <Image src="/logoAmnesia.png" alt="" fill sizes="40px" className="object-contain p-1.5" priority />
          </span>
          <span className="truncate text-base font-semibold leading-tight tracking-tight sm:text-lg md:text-xl">
            AmnesiaTicketing
          </span>
        </Link>

        {showMenu ? (
          <nav className="hidden items-center gap-6 md:flex md:gap-8 lg:gap-10" aria-label="Principal">
            <Link href="/" className="btn-ghost-nav text-sm md:text-base">
              Inicio
            </Link>
            <Link href="/auth" className="btn-ghost-nav text-sm md:text-base">
              Organizadores
            </Link>
            <Link href="/app" className="btn-ghost-nav text-sm md:text-base">
              Panel
            </Link>
          </nav>
        ) : null}

        {showCta ? (
          <div className="flex items-center gap-3">
            <Link href="/auth" className="btn-ghost-nav text-sm md:hidden">
              Login
            </Link>
            <Link
              href="/auth"
              className="group inline-flex items-center justify-center gap-2 rounded-full bg-[var(--brand-orange)] px-5 py-2.5 text-sm font-semibold text-white shadow-[var(--shadow-button-hover)] transition hover:bg-[var(--brand-orange-intense)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--brand-orange)] md:px-8 md:py-3.5"
              aria-label="Crear mi evento"
            >
              Crear mi evento
              <span aria-hidden className="inline-block transition-transform duration-300 group-hover:translate-x-0.5">
                →
              </span>
            </Link>
          </div>
        ) : null}
      </div>
    </header>
  );
}
