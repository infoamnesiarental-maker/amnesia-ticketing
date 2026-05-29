"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import type { TicketTypeStockRow } from "@/lib/ticket-stock";

import { createManualSale } from "./actions";

const money = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 0,
});

export function ManualSaleForm({
  eventId,
  eventName,
  ticketTypes,
}: {
  eventId: string;
  eventName: string;
  ticketTypes: TicketTypeStockRow[];
}) {
  const [ticketTypeId, setTicketTypeId] = useState(ticketTypes[0]?.id ?? "");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [dni, setDni] = useState("");
  const [email, setEmail] = useState("");
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const selected = ticketTypes.find((t) => t.id === ticketTypeId);

  function resetForm() {
    setFirstName("");
    setLastName("");
    setDni("");
    setEmail("");
    setFeedback(null);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFeedback(null);

    if (!ticketTypeId) {
      setFeedback({ ok: false, text: "Elegí un tipo de entrada." });
      return;
    }

    startTransition(async () => {
      const res = await createManualSale({
        eventId,
        ticketTypeId,
        firstName,
        lastName,
        dni,
        email,
      });

      if ("error" in res) {
        setFeedback({ ok: false, text: res.error });
        return;
      }

      setFeedback({ ok: true, text: res.message });
      resetForm();
      router.refresh();
    });
  }

  if (ticketTypes.length === 0) {
    return (
      <div className="surface-glass p-6 text-center text-sm text-white/65">
        <p className="font-medium text-white">Sin stock disponible</p>
        <p className="mt-1">No hay tipos de entrada activos con cupo. Revisá los tipos de entrada del evento.</p>
        <a
          href={`/app/eventos/${eventId}/entradas`}
          className="mt-4 inline-flex items-center gap-1.5 rounded-xl border border-white/20 px-4 py-2 text-sm text-white/80 hover:bg-white/5"
        >
          Ver tipos de entrada
        </a>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">

      {/* Selector de tipo de entrada — cards táctiles en lugar de select nativo */}
      <div className="surface-glass p-4 space-y-3">
        <p className="text-xs font-semibold uppercase tracking-widest text-white/45">Tipo de entrada</p>
        <div className="grid gap-2">
          {ticketTypes.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTicketTypeId(t.id)}
              disabled={pending}
              className={`flex w-full items-center justify-between rounded-xl border px-4 py-3.5 text-left transition ${
                ticketTypeId === t.id
                  ? "border-amber-400/50 bg-amber-500/12 ring-1 ring-amber-400/30"
                  : "border-white/10 bg-white/[0.03] hover:bg-white/[0.06]"
              }`}
            >
              <div>
                <p className={`font-semibold text-sm ${ticketTypeId === t.id ? "text-white" : "text-white/80"}`}>
                  {t.name}
                </p>
                <p className="mt-0.5 text-xs text-white/45">
                  {t.available_qty} disponible{t.available_qty !== 1 ? "s" : ""}
                </p>
              </div>
              <div className="text-right">
                <p className={`font-bold tabular-nums ${ticketTypeId === t.id ? "text-amber-300" : "text-white/70"}`}>
                  {money.format(t.price_ars)}
                </p>
                {ticketTypeId === t.id && (
                  <svg
                    className="ml-auto mt-1 text-amber-400"
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    aria-hidden
                  >
                    <polyline
                      points="20 6 9 17 4 12"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                )}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Datos del asistente */}
      <div className="surface-glass p-4 space-y-3">
        <p className="text-xs font-semibold uppercase tracking-widest text-white/45">Datos del asistente</p>

        <label className="grid gap-1.5 text-sm text-white/80">
          Nombre
          <input
            className="input-design"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            required
            disabled={pending}
            autoComplete="given-name"
            placeholder="Nombre"
          />
        </label>

        <label className="grid gap-1.5 text-sm text-white/80">
          Apellido
          <input
            className="input-design"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            required
            disabled={pending}
            autoComplete="family-name"
            placeholder="Apellido"
          />
        </label>

        <label className="grid gap-1.5 text-sm text-white/80">
          DNI
          <input
            className="input-design"
            value={dni}
            onChange={(e) => setDni(e.target.value)}
            required
            disabled={pending}
            inputMode="numeric"
            placeholder="Sin puntos ni espacios"
          />
        </label>
      </div>

      {/* Email */}
      <div className="surface-glass p-4 space-y-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-white/45">
            Email{" "}
            <span className="normal-case tracking-normal font-normal text-white/35">— opcional</span>
          </p>
          <p className="mt-1 text-xs text-white/40">Si lo completás, enviamos el QR automáticamente al registrar.</p>
        </div>
        <input
          className="input-design w-full"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={pending}
          autoComplete="email"
          placeholder="correo@ejemplo.com"
        />
      </div>

      {/* Resumen */}
      {selected ? (
        <div className="rounded-xl border border-white/8 bg-white/[0.02] px-4 py-3 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-white/60">1× {selected.name}</span>
            <span className="font-bold tabular-nums text-white">{money.format(selected.price_ars)}</span>
          </div>
          <p className="mt-1 text-xs text-white/35">
            Se descuenta del cupo y el ticket se emite al instante.
          </p>
        </div>
      ) : null}

      {/* Feedback */}
      {feedback ? (
        <div
          className={`rounded-xl border px-4 py-3 text-sm ${
            feedback.ok
              ? "border-emerald-400/35 bg-emerald-500/10 text-emerald-100"
              : "border-red-400/40 bg-red-500/10 text-red-200"
          }`}
          role="status"
        >
          {feedback.text}
          {feedback.ok && (
            <button
              type="button"
              onClick={() => setFeedback(null)}
              className="ml-3 text-xs text-emerald-300 underline"
            >
              Registrar otra
            </button>
          )}
        </div>
      ) : null}

      {/* CTA */}
      <button
        type="submit"
        className="btn-cta-primary w-full justify-center py-3.5 text-base"
        disabled={pending}
      >
        {pending
          ? "Registrando…"
          : email.trim()
            ? "Registrar y enviar QR"
            : "Registrar venta"}
      </button>
    </form>
  );
}
