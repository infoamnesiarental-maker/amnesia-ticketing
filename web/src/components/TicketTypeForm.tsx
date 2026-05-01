"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

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
    <div>
      {hideChrome ? null : (
        <>
          <Link href={backHref} className="text-sm text-white/60 hover:text-white">
            ← Tipos de entrada
          </Link>
          <h1 className="mt-4 text-2xl font-bold text-white">{title}</h1>
        </>
      )}
      <form onSubmit={onSubmit} className={`surface-glass grid max-w-lg gap-4 p-6 ${hideChrome ? "mt-0" : "mt-8"}`}>
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
        <label className="flex items-center gap-3 text-sm text-white/90">
          <input
            type="checkbox"
            name="is_active"
            defaultChecked={initial?.is_active ?? true}
            disabled={pending}
            className="size-4 accent-[var(--brand-orange)]"
          />
          Venta activa
        </label>
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
