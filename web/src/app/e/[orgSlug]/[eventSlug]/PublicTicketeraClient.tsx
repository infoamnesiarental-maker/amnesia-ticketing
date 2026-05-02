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
  phone: string;
}

function emptyAttendee(): AttendeeForm {
  return { first_name: "", last_name: "", dni: "", phone: "" };
}

const money = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 2 });

function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}

function startsAtLabel(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("es-AR", { dateStyle: "full", timeStyle: "short" });
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
  return (
    <div className="surface-glass flex flex-col items-center gap-3 p-4 text-center sm:flex-row sm:items-center sm:justify-between sm:text-left">
      <div className="min-w-0 w-full sm:w-auto">
        <p className="font-medium text-white">{tt.name}</p>
        <p className="text-xs text-white/55">
          {money.format(tt.price_ars)} · disponibles: {tt.available_qty}
        </p>
        {tt.description ? <p className="mt-2 text-sm text-white/70">{tt.description}</p> : null}
      </div>
      <label className="flex items-center justify-center gap-2 text-sm text-white/90 sm:justify-start">
        Cantidad
        <input
          type="number"
          min={0}
          max={tt.available_qty}
          step={1}
          value={qty}
          disabled={disabled || tt.available_qty < 1}
          onChange={(e) => onChange(Number.parseInt(e.target.value, 10) || 0)}
          className="input-design w-24 text-center"
        />
      </label>
    </div>
  );
}

/** Flyer / tapa a la izquierda en la ticketera (desktop + sticky). */
export function PublicTicketeraFlyer({ context }: { context: TicketeraContext }) {
  const { organization, event } = context;
  const when = startsAtLabel(event.starts_at);

  return (
    <aside className="lg:sticky lg:top-28">
      <div className="relative mx-auto aspect-[3/4] w-full max-w-md overflow-hidden rounded-2xl border border-white/10 bg-zinc-900 shadow-[0_24px_80px_-24px_rgba(0,0,0,0.75)] lg:max-w-none">
        {event.cover_image_url ? (
          // <img> nativo: URLs de Storage/CDN sin depender de `images.remotePatterns` de Next.
          <img
            src={event.cover_image_url}
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
            loading="eager"
            decoding="async"
            referrerPolicy="no-referrer"
          />
        ) : (
          <div
            className="absolute inset-0 bg-gradient-to-br from-brand/35 via-zinc-900 to-zinc-950"
            aria-hidden
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 space-y-1.5 p-5 sm:p-6">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand">{organization.name}</p>
          <h1 className="text-balance text-2xl font-bold leading-tight text-white sm:text-3xl">{event.name}</h1>
          {event.place ? <p className="text-sm text-white/80">{event.place}</p> : null}
          {when ? <p className="text-xs text-white/60">{when}</p> : null}
        </div>
      </div>
    </aside>
  );
}

export function PublicTicketeraClient({
  context,
  thanks,
  layoutSplit = false,
}: {
  context: TicketeraContext;
  thanks: boolean;
  /** Dos columnas: flyer a la izquierda, este bloque a la derecha. */
  layoutSplit?: boolean;
}) {
  const { organization, event, ticket_types } = context;
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

  // Mantener el array de attendees alineado con totals.qty (mínimo 1).
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
    if (totals.qty < 1) {
      setError("Elegí al menos 1 entrada.");
      return;
    }
    const lines = ticket_types
      .map((tt) => {
        const q = Math.min(Math.max(0, Math.floor(qtyById[tt.id] ?? 0)), tt.available_qty);
        return q > 0 ? { ticket_type_id: tt.id, qty: q } : null;
      })
      .filter(Boolean) as { ticket_type_id: string; qty: number }[];
    fd.set("lines_json", JSON.stringify(lines));

    // Validación cliente: completos
    for (let i = 0; i < attendees.length; i++) {
      const a = attendees[i];
      if (!a.first_name.trim() || !a.last_name.trim() || !a.dni.trim()) {
        setError(`Completá nombre, apellido y DNI del asistente ${i + 1}.`);
        return;
      }
      if (i === 0 && a.phone.trim().length < 6) {
        setError("El comprador (asistente 1) necesita un teléfono válido.");
        return;
      }
    }
    const dnis = attendees.map((a) => a.dni.trim().toLowerCase());
    if (new Set(dnis).size !== dnis.length) {
      setError("Hay DNIs repetidos. Cada entrada debe tener un DNI distinto.");
      return;
    }

    fd.set("attendees_json", JSON.stringify(attendees.map((a) => ({
      first_name: a.first_name.trim(),
      last_name: a.last_name.trim(),
      dni: a.dni.trim(),
      phone: a.phone.trim(),
    }))));

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

  return (
    <form
      onSubmit={onSubmit}
      className={`flex flex-col gap-10 text-center sm:text-left ${layoutSplit ? "w-full min-w-0" : "mx-auto w-full max-w-2xl"}`}
    >
      <input type="hidden" name="org_slug" value={organization.slug} />
      <input type="hidden" name="event_slug" value={event.slug} />

      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-white sm:text-left">1. Elegí cantidades</h2>
        <div className="grid gap-3">
          {ticket_types.map((tt) => (
            <QtyRow
              key={tt.id}
              tt={tt}
              qty={Math.min(Math.max(0, Math.floor(qtyById[tt.id] ?? 0)), tt.available_qty)}
              disabled={pending}
              onChange={(q) => setQtyById((prev) => ({ ...prev, [tt.id]: q }))}
            />
          ))}
        </div>
        <p className="text-sm text-white/80 sm:text-left">
          Subtotal: <span className="font-semibold text-white">{money.format(totals.ars)}</span> ({totals.qty}{" "}
          entrada(s))
        </p>
      </section>

      <section className="surface-glass space-y-5 p-4 sm:p-6">
        <div className="text-center sm:text-left">
          <h2 className="text-lg font-semibold text-white">2. Datos de los asistentes</h2>
          <p className="mt-1 text-xs text-white/55">
            Necesitamos los datos de cada persona que va a entrar (uno por entrada). El primero es el comprador.
          </p>
        </div>

        {attendees.map((a, idx) => {
          const isBuyer = idx === 0;
          return (
            <div
              key={idx}
              className={`rounded-xl border p-4 text-left ${
                isBuyer
                  ? "border-brand/40 bg-brand/5"
                  : "border-white/10 bg-white/[0.03]"
              }`}
            >
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-semibold text-white">
                  {isBuyer ? "Asistente 1 · Comprador" : `Asistente ${idx + 1}`}
                </p>
                {isBuyer ? (
                  <span className="rounded-full border border-brand/40 bg-brand/15 px-2 py-0.5 text-[10px] text-brand">
                    recibe el email
                  </span>
                ) : null}
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="grid gap-1.5 text-sm text-white/90">
                  Nombre
                  <input
                    className="input-design"
                    value={a.first_name}
                    onChange={(e) => updateAttendee(idx, { first_name: e.target.value })}
                    required
                    disabled={pending}
                    autoComplete={isBuyer ? "given-name" : "off"}
                  />
                </label>
                <label className="grid gap-1.5 text-sm text-white/90">
                  Apellido
                  <input
                    className="input-design"
                    value={a.last_name}
                    onChange={(e) => updateAttendee(idx, { last_name: e.target.value })}
                    required
                    disabled={pending}
                    autoComplete={isBuyer ? "family-name" : "off"}
                  />
                </label>
                <label className="grid gap-1.5 text-sm text-white/90">
                  DNI
                  <input
                    className="input-design"
                    value={a.dni}
                    onChange={(e) => updateAttendee(idx, { dni: e.target.value })}
                    required
                    disabled={pending}
                    inputMode="numeric"
                  />
                </label>
                <label className="grid gap-1.5 text-sm text-white/90">
                  Teléfono {isBuyer ? "" : <span className="text-white/45">(opcional)</span>}
                  <input
                    className="input-design"
                    value={a.phone}
                    onChange={(e) => updateAttendee(idx, { phone: e.target.value })}
                    required={isBuyer}
                    disabled={pending}
                    type="tel"
                    autoComplete={isBuyer ? "tel" : "off"}
                  />
                </label>
              </div>
            </div>
          );
        })}

        <label className="grid gap-2 text-left text-sm text-white/90">
          Email del comprador (donde te llegan los QR)
          <input
            className="input-design"
            name="buyer_email"
            required
            disabled={pending}
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>
      </section>

      <section className="surface-glass space-y-4 p-4 sm:p-6">
        <h2 className="text-lg font-semibold text-white sm:text-left">3. Pago y comprobante</h2>
        <p className="text-sm text-white/75 sm:text-left">
          Transferí exactamente <span className="font-semibold text-brand">{money.format(totals.ars)}</span> al alias o CVU
          de Mercado Pago del organizador:
        </p>
        <p className="rounded-xl border border-brand/40 bg-brand/10 px-4 py-3 text-center font-mono text-base text-white sm:text-left sm:text-lg">
          {event.mp_alias}
        </p>
        <p className="text-xs text-white/50 sm:text-left">El monto debe coincidir con el total de arriba para validar automáticamente.</p>
        <label className="grid gap-2 text-left text-sm text-white/90">
          Captura del comprobante (JPG, PNG o WebP, máx. {(PUBLIC_PROOF_MAX_BYTES / (1024 * 1024)).toFixed(0)} MB)
          <input className="text-sm text-white/80 file:mr-3 file:rounded-lg file:border-0 file:bg-white/10 file:px-3 file:py-2 file:text-white" name="proof" type="file" accept="image/jpeg,image/png,image/webp" required disabled={pending} />
        </label>
      </section>

      {error ? (
        <div className="rounded-xl border border-red-400/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">{error}</div>
      ) : null}

      <button
        type="submit"
        className="btn-cta-primary w-full justify-center"
        disabled={pending || totals.qty < 1}
      >
        {pending ? "Enviando…" : "Enviar pedido"}
      </button>
    </form>
  );
}

export function PublicTicketeraHero({ context }: { context: TicketeraContext }) {
  const { organization, event } = context;
  const when = startsAtLabel(event.starts_at);

  return (
    <header className="space-y-3 border-b border-white/10 pb-10 text-center md:text-left">
      <p className="text-xs font-semibold uppercase tracking-wider text-brand">Ticketera</p>
      <p className="text-sm text-white/60">
        {organization.name} · <span className="font-mono text-white/50">{organization.slug}</span>
      </p>
      <h1 className="text-heading-secondary text-balance">{event.name}</h1>
      {event.place ? <p className="text-white/75">{event.place}</p> : null}
      {when ? <p className="text-sm text-white/55">{when}</p> : null}
    </header>
  );
}
