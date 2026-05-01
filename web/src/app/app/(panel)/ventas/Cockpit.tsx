"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo } from "react";

import { OrderDetailPanel, type OrderDetail, type OrderStatus } from "./OrderDetailPanel";

const money = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 2 });

export interface OrderListItem {
  id: string;
  status: OrderStatus;
  created_at: string;
  buyer_first_name: string;
  buyer_last_name: string;
  total_qty: number;
  total_ars: number;
  event_name: string | null;
  event_id: string;
}

interface CockpitProps {
  orders: OrderListItem[];
  selectedDetail: OrderDetail | null;
  filter: string;
  filterCounts: Record<string, number>;
  events: Array<{ id: string; name: string }>;
  selectedEvent: string;
  query: string;
}

const FILTER_OPTIONS = [
  { key: "todo", label: "Para revisar" },
  { key: "validated", label: "Validadas" },
  { key: "rejected", label: "Rechazadas" },
  { key: "all", label: "Todas" },
] as const;

const STATUS_DOT: Record<OrderStatus, string> = {
  pending_validation: "bg-amber-400",
  manual_review: "bg-violet-400",
  validated: "bg-emerald-400",
  rejected: "bg-red-400",
  cancelled: "bg-white/30",
};

function relativeTime(iso: string): { label: string; isOld: boolean } {
  const d = new Date(iso).getTime();
  if (!Number.isFinite(d)) return { label: "", isOld: false };
  const diff = Date.now() - d;
  const min = Math.floor(diff / 60000);
  if (min < 1) return { label: "ahora", isOld: false };
  if (min < 60) return { label: `${min}m`, isOld: false };
  const h = Math.floor(min / 60);
  if (h < 24) return { label: `${h}h`, isOld: false };
  const days = Math.floor(h / 24);
  return { label: `${days}d`, isOld: days >= 1 };
}

export function Cockpit({
  orders,
  selectedDetail,
  filter,
  filterCounts,
  events,
  selectedEvent,
  query,
}: CockpitProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const selectedId = selectedDetail?.id ?? "";

  const buildUrl = useMemo(
    () => (overrides: Record<string, string | undefined>) => {
      const params = new URLSearchParams(searchParams?.toString() ?? "");
      for (const [k, v] of Object.entries(overrides)) {
        if (v === undefined || v === "") params.delete(k);
        else params.set(k, v);
      }
      const qs = params.toString();
      return qs ? `/app/ventas?${qs}` : "/app/ventas";
    },
    [searchParams],
  );

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement | null)?.tagName?.toLowerCase();
      if (tag === "input" || tag === "textarea" || tag === "select") return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      if (e.key === "j" || e.key === "ArrowDown") {
        e.preventDefault();
        const idx = orders.findIndex((o) => o.id === selectedId);
        const next = orders[Math.min(idx + 1, orders.length - 1)];
        if (next) router.push(buildUrl({ selected: next.id }));
        else if (orders[0]) router.push(buildUrl({ selected: orders[0].id }));
      } else if (e.key === "k" || e.key === "ArrowUp") {
        e.preventDefault();
        const idx = orders.findIndex((o) => o.id === selectedId);
        const prev = orders[Math.max(idx - 1, 0)];
        if (prev) router.push(buildUrl({ selected: prev.id }));
      } else if (e.key === "Escape") {
        router.push(buildUrl({ selected: undefined }));
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [orders, selectedId, router, buildUrl]);

  function onSubmitSearch(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const q = String(fd.get("q") ?? "").trim();
    router.push(buildUrl({ q: q || undefined, selected: undefined }));
  }

  function clearSearch() {
    router.push(buildUrl({ q: undefined }));
  }

  function changeEvent(e: React.ChangeEvent<HTMLSelectElement>) {
    const v = e.currentTarget.value;
    router.push(buildUrl({ event: v || undefined, selected: undefined }));
  }

  return (
    <div>
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold text-white">Validar pagos</h1>
          <p className="mt-1 text-sm text-white/60">
            Compará el comprobante con tu cuenta de Mercado Pago / banco y confirmá.
          </p>
        </div>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-[auto_1fr_auto] sm:items-center">
        <nav className="flex flex-wrap gap-2">
          {FILTER_OPTIONS.map((f) => {
            const active = f.key === filter;
            const c = filterCounts[f.key] ?? 0;
            return (
              <Link
                key={f.key}
                href={buildUrl({ filter: f.key, selected: undefined })}
                className={
                  active
                    ? "rounded-full border border-brand/60 bg-brand/15 px-3 py-1.5 text-xs font-medium text-white"
                    : "rounded-full border border-white/15 px-3 py-1.5 text-xs text-white/65 hover:bg-white/5"
                }
              >
                {f.label} <span className="opacity-60">({c})</span>
              </Link>
            );
          })}
        </nav>

        <form onSubmit={onSubmitSearch} className="flex w-full items-center gap-2">
          <input
            type="search"
            name="q"
            placeholder="Buscar nombre, DNI, email, monto…"
            defaultValue={query}
            className="input-design h-10 flex-1 text-sm"
          />
          {query ? (
            <button
              type="button"
              onClick={clearSearch}
              className="rounded-lg border border-white/15 px-3 py-1.5 text-xs text-white/70 hover:bg-white/5"
            >
              Limpiar
            </button>
          ) : null}
        </form>

        {events.length > 0 ? (
          <select
            value={selectedEvent}
            onChange={changeEvent}
            className="input-design h-10 max-w-[220px] text-sm"
          >
            <option value="">Todos los eventos</option>
            {events.map((ev) => (
              <option key={ev.id} value={ev.id}>
                {ev.name}
              </option>
            ))}
          </select>
        ) : null}
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,360px)_minmax(0,1fr)]">
        {/* Cola */}
        <aside className="surface-glass max-h-[calc(100vh-220px)] overflow-y-auto p-2">
          {orders.length === 0 ? (
            <p className="p-4 text-sm text-white/60">No hay órdenes con estos filtros.</p>
          ) : (
            <ul className="grid gap-1.5">
              {orders.map((o) => {
                const active = o.id === selectedId;
                const rt = relativeTime(o.created_at);
                const isPending = o.status === "pending_validation" || o.status === "manual_review";
                return (
                  <li key={o.id}>
                    <Link
                      href={buildUrl({ selected: o.id })}
                      scroll={false}
                      className={`block rounded-xl border px-3 py-2.5 transition ${
                        active
                          ? "border-brand/60 bg-brand/10 ring-1 ring-brand/40"
                          : "border-white/10 bg-white/[0.03] hover:bg-white/5"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex min-w-0 items-center gap-2">
                          <span
                            className={`inline-block h-2 w-2 shrink-0 rounded-full ${STATUS_DOT[o.status]}`}
                            aria-hidden
                          />
                          <p className="truncate text-sm font-medium text-white">
                            {o.buyer_first_name} {o.buyer_last_name}
                          </p>
                        </div>
                        <p className="text-sm font-semibold text-white tabular-nums">
                          {money.format(Number(o.total_ars))}
                        </p>
                      </div>
                      <div className="mt-1 flex items-center justify-between text-[11px] text-white/55">
                        <span className="truncate">
                          {o.total_qty} ent · {o.event_name ?? "—"}
                        </span>
                        <span
                          className={
                            isPending && rt.isOld
                              ? "rounded-full bg-red-500/20 px-1.5 py-0.5 text-red-200"
                              : "text-white/55"
                          }
                          title={new Date(o.created_at).toLocaleString("es-AR")}
                        >
                          {rt.label}
                        </span>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </aside>

        {/* Detail */}
        <section className="min-w-0">
          {selectedDetail ? (
            <OrderDetailPanel detail={selectedDetail} />
          ) : (
            <div className="surface-glass grid place-items-center p-12 text-center text-sm text-white/60">
              <div>
                <p className="text-base text-white/80">Elegí una orden de la lista</p>
                <p className="mt-1 text-xs text-white/50">
                  Atajos: <span className="font-mono">J/K</span> navegar ·{" "}
                  <span className="font-mono">V</span> validar · <span className="font-mono">R</span> rechazar
                </p>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
