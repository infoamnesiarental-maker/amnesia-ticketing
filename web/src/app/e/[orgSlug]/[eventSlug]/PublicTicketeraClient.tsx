"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useTransition } from "react";

import { submitPublicOrder } from "@/app/e/actions";
import type { TicketeraContext, TicketeraTicketType } from "@/lib/ticketera";
import { PUBLIC_PROOF_MAX_BYTES } from "@/lib/upload-limits";

interface AttendeeForm {
  first_name: string;
  last_name: string;
  dni: string;
}

function emptyAttendee(): AttendeeForm {
  return { first_name: "", last_name: "", dni: "" };
}

const money = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 0,
});

function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}

function QtyRow({
  tt,
  qty,
  onChange,
  disabled,
}: {
  tt: TicketeraTicketType;
  qty: number;
  onChange: (q: number) => void;
  disabled: boolean;
}) {
  const isUnavailable = tt.available_qty < 1;

  return (
    <div className="flex items-center justify-between border-b border-white/10 py-4 last:border-b-0">
      <div className="min-w-0 flex-1 pr-4">
        <p className={`font-semibold leading-snug ${isUnavailable ? "text-white/35" : "text-white"}`}>
          {tt.name}
        </p>
        <p className={`mt-0.5 text-sm ${isUnavailable ? "text-white/25" : "text-white/55"}`}>
          {money.format(tt.price_ars)}
        </p>
        {tt.description ? (
          <p className="mt-1 text-xs text-white/40">{tt.description}</p>
        ) : null}
      </div>
      {isUnavailable ? (
        <span className="shrink-0 rounded-full border border-white/15 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-white/35">
          Agotado
        </span>
      ) : (
        <div className="shrink-0 flex items-center gap-3">
          <button
            type="button"
            onClick={() => onChange(Math.max(0, qty - 1))}
            disabled={disabled || qty === 0}
            aria-label="Quitar una entrada"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-white/20 text-white/70 transition-colors hover:border-white/50 hover:text-white disabled:cursor-not-allowed disabled:opacity-25"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M5 12h14" />
            </svg>
          </button>
          <span className="w-5 text-center text-base font-bold tabular-nums text-white">{qty}</span>
          <button
            type="button"
            onClick={() => onChange(Math.min(tt.available_qty, qty + 1))}
            disabled={disabled || qty >= tt.available_qty}
            aria-label="Agregar una entrada"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-white/20 text-white/70 transition-colors hover:border-white/50 hover:text-white disabled:cursor-not-allowed disabled:opacity-25"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 5v14M5 12h14" />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
}

function StepIndicator({ current }: { current: 1 | 2 }) {
  const steps = ["Entradas", "Datos", "Pago"];
  return (
    <div className="flex items-center justify-center gap-0">
      {steps.map((label, i) => {
        const isDone = i < current;
        const isActive = i === current;
        return (
          <div key={label} className="flex items-center">
            <div className="flex flex-col items-center gap-1">
              <div
                className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold transition-colors ${
                  isDone
                    ? "bg-brand/25 text-brand"
                    : isActive
                      ? "bg-brand text-white"
                      : "bg-white/8 text-white/30"
                }`}
              >
                {isDone ? (
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                ) : (
                  i + 1
                )}
              </div>
              <span
                className={`text-[10px] font-medium ${
                  isActive ? "text-white/70" : isDone ? "text-brand/60" : "text-white/25"
                }`}
              >
                {label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div className={`mx-2 mb-4 h-px w-8 ${i < current ? "bg-brand/30" : "bg-white/10"}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1.5 text-sm text-white/50 transition-colors hover:text-white"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M19 12H5M12 19l-7-7 7-7" />
      </svg>
      Volver
    </button>
  );
}

/** Flyer / tapa a la izquierda en la ticketera (desktop + sticky). */
export function PublicTicketeraFlyer({
  context,
  eventStartsAtLabel,
}: {
  context: TicketeraContext;
  eventStartsAtLabel: string;
}) {
  const { organization, event } = context;

  return (
    <aside className="lg:sticky lg:top-28">
      <div className="relative mx-auto aspect-[3/4] w-full max-w-md overflow-hidden rounded-2xl border border-white/10 bg-zinc-900 shadow-[0_24px_80px_-24px_rgba(0,0,0,0.75)] lg:max-w-none">
        {event.cover_image_url ? (
          <img
            src={event.cover_image_url}
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
            loading="eager"
            decoding="async"
            referrerPolicy="no-referrer"
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-brand/35 via-zinc-900 to-zinc-950" aria-hidden />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 space-y-1.5 p-5 sm:p-6">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand">{organization.name}</p>
          <h1 className="text-balance text-2xl font-bold leading-tight text-white sm:text-3xl">{event.name}</h1>
          {event.place ? <p className="text-sm text-white/80">{event.place}</p> : null}
          {eventStartsAtLabel ? <p className="text-xs text-white/60">{eventStartsAtLabel}</p> : null}
        </div>
      </div>
    </aside>
  );
}

export function PublicTicketeraClient({
  context,
  thanks,
  layoutSplit = false,
  eventStartsAtLabel,
}: {
  context: TicketeraContext;
  thanks: boolean;
  layoutSplit?: boolean;
  eventStartsAtLabel: string;
}) {
  const { organization, event, ticket_types } = context;
  const [step, setStep] = useState<0 | 1 | 2>(0);
  const [qtyById, setQtyById] = useState<Record<string, number>>(() =>
    Object.fromEntries(ticket_types.map((t) => [t.id, 0])),
  );
  const [attendees, setAttendees] = useState<AttendeeForm[]>([emptyAttendee()]);
  const [email, setEmail] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const totals = useMemo(() => {
    let qty = 0;
    let ars = 0;
    for (const tt of ticket_types) {
      const q = Math.min(Math.max(0, Math.floor(qtyById[tt.id] ?? 0)), tt.available_qty);
      if (q > 0) {
        qty += q;
        const unit = roundMoney(Number(tt.price_ars));
        ars += roundMoney(unit * q);
      }
    }
    return { qty, ars: roundMoney(ars) };
  }, [ticket_types, qtyById]);

  useEffect(() => {
    const target = Math.max(1, totals.qty);
    setAttendees((prev) => {
      if (prev.length === target) return prev;
      if (prev.length < target) {
        return [...prev, ...Array.from({ length: target - prev.length }, emptyAttendee)];
      }
      return prev.slice(0, target);
    });
  }, [totals.qty]);

  function updateAttendee(idx: number, patch: Partial<AttendeeForm>) {
    setAttendees((prev) => prev.map((a, i) => (i === idx ? { ...a, ...patch } : a)));
  }

  function scrollToTop() {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function goToStep1() {
    if (totals.qty < 1) return;
    setError(null);
    setStep(1);
    scrollToTop();
  }

  function handleStep1Submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    for (let i = 0; i < attendees.length; i++) {
      const a = attendees[i];
      if (!a.first_name.trim() || !a.last_name.trim() || !a.dni.trim()) {
        setError(`Completá nombre, apellido y DNI del ${i === 0 ? "comprador" : `asistente ${i + 1}`}.`);
        return;
      }
    }
    if (!email.trim() || !email.includes("@")) {
      setError("Ingresá un email válido.");
      return;
    }
    const dnis = attendees.map((a) => a.dni.trim().toLowerCase());
    if (new Set(dnis).size !== dnis.length) {
      setError("Hay DNIs repetidos. Cada entrada debe tener un DNI distinto.");
      return;
    }
    setStep(2);
    scrollToTop();
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    const proof = fd.get("proof");
    if (proof && typeof proof !== "string" && proof.size > PUBLIC_PROOF_MAX_BYTES) {
      const mb = (PUBLIC_PROOF_MAX_BYTES / (1024 * 1024)).toFixed(0);
      setError(`El comprobante es demasiado pesado. Máximo ${mb} MB.`);
      return;
    }
    const lines = ticket_types
      .map((tt) => {
        const q = Math.min(Math.max(0, Math.floor(qtyById[tt.id] ?? 0)), tt.available_qty);
        return q > 0 ? { ticket_type_id: tt.id, qty: q } : null;
      })
      .filter(Boolean) as { ticket_type_id: string; qty: number }[];
    fd.set("lines_json", JSON.stringify(lines));
    fd.set("buyer_email", email);
    fd.set(
      "attendees_json",
      JSON.stringify(
        attendees.map((a) => ({
          first_name: a.first_name.trim(),
          last_name: a.last_name.trim(),
          dni: a.dni.trim(),
          phone: "",
        })),
      ),
    );
    startTransition(async () => {
      const res = await submitPublicOrder(fd);
      if ("error" in res) {
        setError(res.error);
        return;
      }
      window.location.assign(res.next);
    });
  }

  if (thanks) {
    return (
      <div className="surface-glass mx-auto max-w-xl p-8 text-center">
        <p className="text-sm font-semibold text-emerald-300">Listo</p>
        <h2 className="mt-2 text-xl font-bold text-white">Recibimos tu comprobante</h2>
        <p className="mt-3 text-sm text-white/75">
          Validamos la transferencia contra Mercado Pago. Si coincide el monto, te mandamos los códigos QR por mail.
          Si hace falta revisión manual, te avisamos.
        </p>
        <Link
          href={`/e/${encodeURIComponent(organization.slug)}/${encodeURIComponent(event.slug)}`}
          className="btn-cta-primary mx-auto mt-8 inline-flex justify-center"
        >
          Nueva compra
        </Link>
      </div>
    );
  }

  if (ticket_types.length === 0) {
    return (
      <div className="surface-glass mx-auto max-w-xl p-8 text-center text-sm text-white/75">
        Por ahora no hay entradas a la venta para este evento (sin stock, pausadas o fuera de fecha).
      </div>
    );
  }

  const wrapClass = layoutSplit ? "w-full min-w-0" : "mx-auto w-full max-w-2xl";

  // ── STEP 0: selección de entradas ─────────────────────────────────────────
  if (step === 0) {
    return (
      <div className={wrapClass}>
        {/* Flyer inline – solo en mobile (desktop lo muestra en la columna izquierda) */}
        <div className="mb-5 lg:hidden">
          <div className="relative mx-auto aspect-[3/4] w-full max-w-sm overflow-hidden rounded-2xl border border-white/10 bg-zinc-900 shadow-[0_24px_80px_-24px_rgba(0,0,0,0.75)]">
            {event.cover_image_url ? (
              <img
                src={event.cover_image_url}
                alt=""
                className="absolute inset-0 h-full w-full object-cover"
                loading="eager"
                decoding="async"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="absolute inset-0 bg-gradient-to-br from-brand/35 via-zinc-900 to-zinc-950" aria-hidden />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />
            <div className="absolute inset-x-0 bottom-0 space-y-1.5 p-5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand">
                {organization.name}
              </p>
              <h1 className="text-balance text-2xl font-bold leading-tight text-white">{event.name}</h1>
              {event.place ? <p className="text-sm text-white/80">{event.place}</p> : null}
              {eventStartsAtLabel ? <p className="text-xs text-white/60">{eventStartsAtLabel}</p> : null}
            </div>
          </div>
        </div>

        {/* Tickets */}
        <div className="surface-glass px-4 py-5 sm:px-6">
          <p className="mb-4 text-[11px] font-bold uppercase tracking-widest text-white/45">Tickets</p>
          {ticket_types.map((tt) => (
            <QtyRow
              key={tt.id}
              tt={tt}
              qty={Math.min(Math.max(0, Math.floor(qtyById[tt.id] ?? 0)), tt.available_qty)}
              disabled={false}
              onChange={(q) => setQtyById((prev) => ({ ...prev, [tt.id]: q }))}
            />
          ))}
        </div>

        {/* Sobre el evento */}
        {(event.place || eventStartsAtLabel) && (
          <div className="surface-glass mt-3 px-4 py-5 sm:px-6">
            <p className="mb-3 text-[11px] font-bold uppercase tracking-widest text-white/45">
              Sobre el evento
            </p>
            <div className="space-y-2.5">
              {eventStartsAtLabel && (
                <div className="flex items-start gap-3">
                  <svg
                    className="mt-0.5 shrink-0 text-brand"
                    xmlns="http://www.w3.org/2000/svg"
                    width="15"
                    height="15"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                    <line x1="16" y1="2" x2="16" y2="6" />
                    <line x1="8" y1="2" x2="8" y2="6" />
                    <line x1="3" y1="10" x2="21" y2="10" />
                  </svg>
                  <p className="text-sm capitalize text-white/70">{eventStartsAtLabel}</p>
                </div>
              )}
              {event.place && (
                <div className="flex items-start gap-3">
                  <svg
                    className="mt-0.5 shrink-0 text-brand"
                    xmlns="http://www.w3.org/2000/svg"
                    width="15"
                    height="15"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                    <circle cx="12" cy="10" r="3" />
                  </svg>
                  <p className="text-sm text-white/70">{event.place}</p>
                </div>
              )}
              <div className="flex items-start gap-3">
                <svg
                  className="mt-0.5 shrink-0 text-brand"
                  xmlns="http://www.w3.org/2000/svg"
                  width="15"
                  height="15"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
                </svg>
                <p className="text-sm text-white/70">{organization.name}</p>
              </div>
            </div>
          </div>
        )}

        {/* Espacio para que la sticky bar no tape el contenido */}
        {totals.qty > 0 && <div className="h-28" />}

        {/* Sticky bottom bar */}
        {totals.qty > 0 && (
          <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-white/10 bg-[#0A0A0A]/96 px-4 py-4 backdrop-blur-xl">
            <div className="mx-auto flex max-w-2xl items-center justify-between gap-4">
              <div>
                <p className="text-xs text-white/50">
                  {totals.qty} entrada{totals.qty !== 1 ? "s" : ""}
                </p>
                <p className="text-xl font-bold tabular-nums text-white">{money.format(totals.ars)}</p>
              </div>
              <button
                type="button"
                onClick={goToStep1}
                className="btn-cta-primary shrink-0 px-6 py-3 text-base"
              >
                Comprar
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── STEP 1: datos del comprador y asistentes ──────────────────────────────
  if (step === 1) {
    return (
      <form onSubmit={handleStep1Submit} className={`${wrapClass} space-y-5`}>
        <div className="flex items-start justify-between gap-4 pb-4 border-b border-white/10">
          <BackButton onClick={() => { setStep(0); setError(null); }} />
          <StepIndicator current={1} />
        </div>

        {/* Datos del comprador */}
        <div className="surface-glass space-y-4 p-4 sm:p-6">
          <div>
            <h2 className="text-base font-semibold text-white">Datos del comprador</h2>
            <p className="mt-0.5 text-xs text-white/45">
              Nombre, DNI y email de quien compra. A este mail llegan los QR.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="grid gap-1.5 text-sm text-white/80">
              Nombre
              <input
                className="input-design"
                value={attendees[0]?.first_name ?? ""}
                onChange={(e) => updateAttendee(0, { first_name: e.target.value })}
                required
                autoComplete="given-name"
                placeholder="Tu nombre"
              />
            </label>
            <label className="grid gap-1.5 text-sm text-white/80">
              Apellido
              <input
                className="input-design"
                value={attendees[0]?.last_name ?? ""}
                onChange={(e) => updateAttendee(0, { last_name: e.target.value })}
                required
                autoComplete="family-name"
                placeholder="Tu apellido"
              />
            </label>
          </div>
          <label className="grid gap-1.5 text-sm text-white/80">
            DNI
            <input
              className="input-design"
              value={attendees[0]?.dni ?? ""}
              onChange={(e) => updateAttendee(0, { dni: e.target.value })}
              required
              inputMode="numeric"
              placeholder="Sin puntos ni espacios"
            />
          </label>
          <label className="grid gap-1.5 text-sm text-white/80">
            Email
            <input
              className="input-design"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              placeholder="Para recibir los QR de entrada"
            />
          </label>
        </div>

        {/* Datos de acompañantes */}
        {attendees.length > 1 && (
          <div className="space-y-3">
            <div>
              <h2 className="text-base font-semibold text-white">Datos de los acompañantes</h2>
              <p className="mt-0.5 text-xs text-white/45">
                Nombre y DNI de cada persona que va a entrar.
              </p>
            </div>
            {attendees.slice(1).map((a, idx) => (
              <div key={idx + 1} className="surface-glass space-y-3 p-4 sm:p-6">
                <p className="text-sm font-semibold text-white/60">Asistente {idx + 2}</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="grid gap-1.5 text-sm text-white/80">
                    Nombre
                    <input
                      className="input-design"
                      value={a.first_name}
                      onChange={(e) => updateAttendee(idx + 1, { first_name: e.target.value })}
                      required
                      autoComplete="off"
                    />
                  </label>
                  <label className="grid gap-1.5 text-sm text-white/80">
                    Apellido
                    <input
                      className="input-design"
                      value={a.last_name}
                      onChange={(e) => updateAttendee(idx + 1, { last_name: e.target.value })}
                      required
                      autoComplete="off"
                    />
                  </label>
                </div>
                <label className="grid gap-1.5 text-sm text-white/80">
                  DNI
                  <input
                    className="input-design"
                    value={a.dni}
                    onChange={(e) => updateAttendee(idx + 1, { dni: e.target.value })}
                    required
                    inputMode="numeric"
                    placeholder="Sin puntos ni espacios"
                  />
                </label>
              </div>
            ))}
          </div>
        )}

        {error && (
          <div className="rounded-xl border border-red-400/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            {error}
          </div>
        )}

        <button type="submit" className="btn-cta-primary w-full justify-center">
          Continuar al pago
        </button>
      </form>
    );
  }

  // ── STEP 2: pago y comprobante ────────────────────────────────────────────
  return (
    <form onSubmit={onSubmit} className={`${wrapClass} space-y-5`}>
      <input type="hidden" name="org_slug" value={organization.slug} />
      <input type="hidden" name="event_slug" value={event.slug} />

      <div className="flex items-start justify-between gap-4 pb-4 border-b border-white/10">
        <BackButton onClick={() => { setStep(1); setError(null); }} />
        <StepIndicator current={2} />
      </div>

      {/* Resumen de la compra */}
      <div className="surface-glass px-4 py-5 sm:px-6">
        <p className="mb-3 text-[11px] font-bold uppercase tracking-widest text-white/45">Resumen</p>
        <div className="space-y-2">
          {ticket_types
            .filter((tt) => (qtyById[tt.id] ?? 0) > 0)
            .map((tt) => {
              const q = qtyById[tt.id] ?? 0;
              return (
                <div key={tt.id} className="flex items-center justify-between text-sm">
                  <span className="text-white/70">
                    {q}× {tt.name}
                  </span>
                  <span className="font-semibold tabular-nums text-white">
                    {money.format(roundMoney(tt.price_ars * q))}
                  </span>
                </div>
              );
            })}
          <div className="flex items-center justify-between border-t border-white/10 pt-2">
            <span className="text-sm font-semibold text-white">Total</span>
            <span className="text-xl font-bold tabular-nums text-white">{money.format(totals.ars)}</span>
          </div>
        </div>
      </div>

      {/* Sección de pago */}
      <div className="surface-glass space-y-4 px-4 py-5 sm:px-6">
        <div>
          <h2 className="text-base font-semibold text-white">3. Pago y comprobante</h2>
          <p className="mt-1 text-sm text-white/60">
            Transferí exactamente{" "}
            <span className="font-bold text-white">{money.format(totals.ars)}</span> al siguiente alias:
          </p>
        </div>

        {/* Alias / CVU – bien grande y visible */}
        <div className="rounded-2xl border border-brand/35 bg-brand/8 p-4">
          <p className="mb-1.5 text-[10px] font-bold uppercase tracking-widest text-brand/60">
            Alias / CVU Mercado Pago
          </p>
          <p className="break-all font-mono text-2xl font-bold tracking-wide text-white">
            {event.mp_alias}
          </p>
        </div>

        {/* Aviso de monto exacto */}
        <div className="flex items-start gap-3 rounded-xl border border-amber-400/25 bg-amber-400/8 px-4 py-3">
          <svg
            className="mt-0.5 shrink-0 text-amber-400"
            xmlns="http://www.w3.org/2000/svg"
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
          <div>
            <p className="text-sm font-medium text-amber-200">
              El monto debe ser exactamente{" "}
              <span className="font-bold tabular-nums">{money.format(totals.ars)}</span>
            </p>
            <p className="mt-0.5 text-xs text-amber-200/60">
              Si el monto no coincide, la validación automática no va a funcionar.
            </p>
          </div>
        </div>

        {/* Upload comprobante */}
        <label className="grid gap-2 text-sm text-white/80">
          <span className="font-medium">Subí el comprobante de la transferencia</span>
          <span className="text-xs text-white/40">
            JPG, PNG o WebP · máx. {(PUBLIC_PROOF_MAX_BYTES / (1024 * 1024)).toFixed(0)} MB
          </span>
          <input
            className="rounded-xl border border-white/12 bg-white/5 p-3 text-sm text-white/75 transition file:mr-3 file:rounded-lg file:border-0 file:bg-brand/20 file:px-4 file:py-1.5 file:text-sm file:font-medium file:text-brand hover:border-white/20 hover:file:bg-brand/30"
            name="proof"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            required
            disabled={pending}
          />
        </label>
      </div>

      {error && (
        <div className="rounded-xl border border-red-400/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {error}
        </div>
      )}

      <button
        type="submit"
        className="btn-cta-primary w-full justify-center"
        disabled={pending}
      >
        {pending ? "Enviando…" : "Confirmar compra"}
      </button>

      <p className="pb-4 text-center text-xs text-white/30">
        Al comprar aceptás que procesemos tus datos para validar el pago y emitir entradas.
      </p>
    </form>
  );
}

export function PublicTicketeraHero({
  context,
  eventStartsAtLabel,
}: {
  context: TicketeraContext;
  eventStartsAtLabel: string;
}) {
  const { organization, event } = context;

  return (
    <header className="space-y-3 border-b border-white/10 pb-10 text-center md:text-left">
      <p className="text-xs font-semibold uppercase tracking-wider text-brand">Ticketera</p>
      <p className="text-sm text-white/60">
        {organization.name} · <span className="font-mono text-white/50">{organization.slug}</span>
      </p>
      <h1 className="text-heading-secondary text-balance">{event.name}</h1>
      {event.place ? <p className="text-white/75">{event.place}</p> : null}
      {eventStartsAtLabel ? <p className="text-sm text-white/55">{eventStartsAtLabel}</p> : null}
    </header>
  );
}
