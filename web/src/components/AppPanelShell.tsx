import Link from "next/link";

const links = [
  { href: "/app", label: "Inicio" },
  { href: "/app/eventos", label: "Eventos" },
  { href: "/app/ventas", label: "Ventas" },
  { href: "/e/demo", label: "Ticketera (URL)" },
];

export function AppPanelShell({
  children,
  showAdminLink,
  roleLabel,
}: {
  children: React.ReactNode;
  showAdminLink: boolean;
  roleLabel: string;
}) {
  return (
    <div className="min-h-screen bg-[#0A0A0A]">
      <div className="border-b border-white/10 bg-black/40">
        <div className="section-padding-x mx-auto flex max-w-content flex-col gap-4 py-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-brand">Panel productora</p>
            <p className="text-sm text-white/60">{roleLabel}</p>
          </div>
          <nav className="flex flex-wrap gap-3 text-sm">
            {links.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className="rounded-full border border-white/15 px-4 py-2 text-white/90 hover:border-brand hover:bg-white/5"
              >
                {l.label}
              </Link>
            ))}
            {showAdminLink ? (
              <Link
                href="/admin"
                className="rounded-full border border-amber-500/40 bg-amber-500/10 px-4 py-2 text-amber-100 hover:bg-amber-500/20"
              >
                Admin
              </Link>
            ) : null}
            <Link href="/" className="rounded-full px-4 py-2 text-white/60 hover:text-white">
              Sitio
            </Link>
          </nav>
        </div>
      </div>
      <div className="section-padding-x mx-auto max-w-content py-10">{children}</div>
    </div>
  );
}
