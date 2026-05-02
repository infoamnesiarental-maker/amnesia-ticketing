import Link from "next/link";

import { SignOutButton } from "@/components/account/SignOutButton";

function statusBadge(status: string): { label: string; dotClass: string; ringClass: string; bgClass: string } {
  switch (status) {
    case "pending":
      return {
        label: "Pendiente de aprobación",
        dotClass: "bg-amber-400",
        ringClass: "border-amber-500/35",
        bgClass: "bg-amber-500/[0.12]",
      };
    case "suspended":
      return {
        label: "Cuenta suspendida",
        dotClass: "bg-red-400",
        ringClass: "border-red-400/35",
        bgClass: "bg-red-500/10",
      };
    case "rejected":
      return {
        label: "Alta no aprobada",
        dotClass: "bg-red-400",
        ringClass: "border-red-400/35",
        bgClass: "bg-red-500/10",
      };
    default:
      return {
        label: "Estado: " + status,
        dotClass: "bg-white/50",
        ringClass: "border-white/15",
        bgClass: "bg-white/[0.06]",
      };
  }
}

function headlineFor(status: string): { title: string; body: string } {
  switch (status) {
    case "pending":
      return {
        title: "Tu productora está en revisión",
        body: "Ya recibimos tu registro. Cuando un administrador apruebe la cuenta vas a poder crear eventos y tipos de entrada.",
      };
    case "suspended":
      return {
        title: "Tu cuenta está suspendida",
        body: "Por ahora no podés operar en el panel. Si creés que es un error, escribinos por WhatsApp.",
      };
    case "rejected":
      return {
        title: "El alta no fue aprobada",
        body: "Si querés más información o volver a intentar, contactanos por WhatsApp.",
      };
    default:
      return {
        title: "Tu productora no está activa",
        body: "Necesitás una cuenta aprobada para usar el panel. Consultá el estado abajo o escribinos.",
      };
  }
}

function IconClock() {
  return (
    <svg className="h-7 w-7 text-amber-200" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.5" />
      <path d="M12 7v5l3 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function PendingProducerGate({ userEmail, status }: { userEmail: string; status: string }) {
  const badge = statusBadge(status);
  const { title, body } = headlineFor(status);
  const waHref = `https://wa.me/5491139531218?text=${encodeURIComponent(
    `Hola! Ya me registré en Amnesia Ticketing. Mi email es ${userEmail || "—"}. ¿Me aprobás la productora? Gracias!`,
  )}`;

  return (
    <div className="flex w-full flex-1 flex-col items-center justify-center px-2 py-6 sm:px-4 md:py-10">
      <div className="w-full max-w-md rounded-2xl border border-white/[0.12] bg-[#141414]/90 p-8 shadow-[0_24px_80px_rgba(0,0,0,0.45)] backdrop-blur-sm sm:p-10">
        <div className="flex flex-col items-center text-center">
          <div
            className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-500/20 to-orange-600/10 ring-1 ring-amber-400/25"
            aria-hidden
          >
            <IconClock />
          </div>

          <p className="mt-6 text-xs font-bold uppercase tracking-[0.2em] text-brand">Bienvenido</p>
          <h1 className="mt-3 text-[1.35rem] font-bold leading-snug text-white sm:text-2xl">{title}</h1>
          <p className="mx-auto mt-4 max-w-[26rem] text-sm leading-relaxed text-white/70">{body}</p>

          <div
            className={`mt-6 inline-flex max-w-full items-center gap-2.5 rounded-full border px-4 py-2.5 text-sm font-medium ${badge.ringClass} ${badge.bgClass} text-white/95`}
            role="status"
          >
            <span className="relative flex h-2.5 w-2.5 shrink-0">
              {status === "pending" ? (
                <>
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400/70 opacity-40" />
                  <span className={`relative inline-flex h-2.5 w-2.5 rounded-full ${badge.dotClass}`} />
                </>
              ) : (
                <span className={`inline-flex h-2.5 w-2.5 rounded-full ${badge.dotClass}`} />
              )}
            </span>
            <span>{badge.label}</span>
          </div>
        </div>

        <div className="mt-8 text-center">
          <a
            href={waHref}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-[52px] w-full items-center justify-center rounded-full bg-[var(--brand-orange)] px-8 text-base font-semibold text-white shadow-[var(--shadow-soft)] transition hover:bg-[var(--brand-orange-intense)] hover:shadow-[var(--shadow-button-hover)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand-orange)] sm:w-auto sm:min-w-[14rem]"
          >
            Avisar por WhatsApp
          </a>
          <p className="mt-3 text-sm text-white/55">
            <span className="text-white/40">Número · </span>
            <span className="font-medium tabular-nums text-white/80">+54 9 11 3953-1218</span>
          </p>
          <p className="mt-1 text-xs text-white/40">Te abre WhatsApp con un mensaje listo para enviar.</p>
        </div>

        <div className="mt-10 border-t border-white/10 pt-8">
          <p className="text-center text-xs font-semibold uppercase tracking-wider text-white/35">Tu cuenta</p>
          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:justify-center sm:gap-3">
            <Link
              href="/app/perfil"
              className="flex min-h-[48px] w-full items-center justify-center rounded-xl border border-brand/40 bg-brand/10 px-5 py-3 text-sm font-semibold text-brand transition hover:border-brand/55 hover:bg-brand/15 sm:w-auto sm:min-w-[10.5rem]"
            >
              Ver perfil y datos
            </Link>
            <SignOutButton />
          </div>
          <p className="mt-4 text-center text-xs leading-relaxed text-white/40">
            En perfil podés revisar los datos de la productora y actualizar tu teléfono.
          </p>
        </div>
      </div>
    </div>
  );
}
