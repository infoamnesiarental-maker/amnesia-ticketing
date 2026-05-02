import Link from "next/link";

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

export function AppPanelShell({
  children,
  orgName,
  accountStatus,
}: {
  children: React.ReactNode;
  orgName: string;
  accountStatus: string;
}) {
  return (
    <div className="min-h-screen bg-[#0A0A0A]">
      <div className="mx-auto flex min-h-screen max-w-content">
        <ProducerSidebar orgName={orgName} accountStatus={accountStatus} />
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="flex items-center justify-between gap-3 border-b border-white/10 bg-black/25 px-4 py-3 md:hidden">
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
          <div className="section-padding-x flex min-h-0 flex-1 flex-col pb-28 pt-6 md:pb-10 md:pt-8">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
