"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

function IsActiveToggle({ defaultActive, disabled }: { defaultActive: boolean; disabled: boolean }) {
  const [active, setActive] = useState(defaultActive);
  return (
    <div
      className={`flex items-center justify-between gap-3 rounded-xl border px-4 py-3.5 transition-colors ${
        active ? "border-emerald-400/30 bg-emerald-500/8" : "border-white/10 bg-white/[0.03]"
      }`}
    >
      <input type="hidden" name="is_active" value={active ? "on" : ""} />
      <div>
        <p className={`text-sm font-semibold ${active ? "text-emerald-200" : "text-white/55"}`}>
          {active ? "Disponible para la venta" : "No disponible"}
        </p>
        <p className="mt-0.5 text-xs text-white/35">
          {active ? "Aparece en la ticketera pública." : "Oculto para los compradores."}
        </p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={active}
        disabled={disabled}
        onClick={() => setActive((v) => !v)}
        className={`relative flex h-7 w-12 shrink-0 items-center rounded-full border transition-colors ${
          active ? "border-emerald-400/50 bg-emerald-500/35" : "border-white/20 bg-white/10"
        } disabled:opacity-40`}
      >
        <span
          className={`absolute h-5 w-5 rounded-full shadow transition-transform ${
            active ? "translate-x-6 bg-emerald-300" : "translate-x-1 bg-white/50"
          }`}
        />
      </button>
    </div>
  );
}

import { createTicketType, updateTicketType } from "@/app/app/actions";

export interface TicketTypeFormInitial {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  price_ars: number;
  stock_total: number;
  sales_ends_at_input: string;
  is_active: boolean;
}

export function TicketTypeForm({
  mode,
  eventId,
  backHref,
  title,
  initial,
  hideChrome = false,
  createSubmitLabel,
}: {
  mode: "create" | "edit";
  eventId: string;
  backHref: string;
  title: string;
  initial?: TicketTypeFormInitial;
  /** Oculta volver + título (p. ej. embebido en el asistente de nuevo evento). */
  hideChrome?: boolean;
  /** Texto del botón en modo create (solo si hideChrome). */
  createSubmitLabel?: string;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    setError(null);
    startTransition(async () => {
      const res =
        mode === "create"
          ? await createTicketType(formData)
          : await updateTicketType(formData);
      if ("error" in res) {
        setError(res.error);
        return;
      }
      router.push(backHref);
      router.refresh();
    });
  }

  return (
    <div className={hideChrome ? undefined : "mx-auto w-full max-w-lg"}>
      {hideChrome ? null : (
        <>
          <Link href={backHref} className="inline-flex text-sm text-white/60 hover:text-white">
            ← Tipos de entrada
          </Link>
          <h1 className="mt-4 text-2xl font-bold text-white">{title}</h1>
        </>
      )}
      <form onSubmit={onSubmit} className={`surface-glass grid w-full gap-4 p-6 ${hideChrome ? "mt-0" : "mt-8"}`}>
        <input type="hidden" name="event_id" value={eventId} />
        {mode === "edit" && initial ? <input type="hidden" name="ticket_type_id" value={initial.id} /> : null}
        {error ? (
          <div className="rounded-xl border border-red-400/40 bg-red-500/10 px-3 py-2 text-sm text-red-200">{error}</div>
        ) : null}
        <label className="grid gap-2 text-sm text-white/90">
          Nombre visible
          <input
            className="input-design"
            name="name"
            required
            disabled={pending}
            defaultValue={initial?.name ?? ""}
          />
        </label>
        <label className="grid gap-2 text-sm text-white/90">
          Slug interno (opcional)
          <input
            className="input-design"
            name="slug"
            placeholder="ej: general, vip"
            disabled={pending}
            defaultValue={initial?.slug ?? ""}
          />
        </label>
        <label className="grid gap-2 text-sm text-white/90">
          Descripción (opcional)
          <textarea
            className="input-design min-h-[88px] resize-y"
            name="description"
            disabled={pending}
            defaultValue={initial?.description ?? ""}
          />
        </label>
        <label className="grid gap-2 text-sm text-white/90">
          Precio (ARS)
          <input
            className="input-design"
            name="price_ars"
            type="text"
            inputMode="decimal"
            required
            disabled={pending}
            defaultValue={initial != null ? String(initial.price_ars) : ""}
            placeholder="1500 o 1500.50"
          />
        </label>
        <label className="grid gap-2 text-sm text-white/90">
          Stock total
          <input
            className="input-design"
            name="stock_total"
            type="number"
            min={0}
            step={1}
            required
            disabled={pending}
            defaultValue={initial != null ? initial.stock_total : 0}
          />
        </label>
        <label className="grid gap-2 text-sm text-white/90">
          Venta hasta (opcional)
          <input
            className="input-design"
            name="sales_ends_at"
            type="datetime-local"
            disabled={pending}
            defaultValue={initial?.sales_ends_at_input ?? ""}
          />
        </label>
        <IsActiveToggle defaultActive={initial?.is_active ?? true} disabled={pending} />
        <button className="btn-cta-primary mt-2 w-full justify-center" type="submit" disabled={pending}>
          {pending
            ? "Guardando…"
            : mode === "create"
              ? createSubmitLabel ?? "Crear tipo"
              : "Guardar cambios"}
        </button>
      </form>
    </div>
  );
}
