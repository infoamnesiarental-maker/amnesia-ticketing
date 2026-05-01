"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

import { rejectOrder, resendTicketsEmailAction, validateOrder } from "./actions";
import { CopyButton } from "./CopyButton";

const money = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 2 });

export type OrderStatus = "pending_validation" | "validated" | "manual_review" | "rejected" | "cancelled";

export interface OrderDetail {
  id: string;
  status: OrderStatus;
  created_at: string;
  validated_at: string | null;
  rejected_at: string | null;
  tickets_email_sent_at: string | null;
  buyer_first_name: string;
  buyer_last_name: string;
  buyer_dni: string;
  buyer_phone: string;
  buyer_email: string;
  total_qty: number;
  total_ars: number;
  proof_signed_url: string | null;
  event_name: string | null;
  event_slug: string | null;
  items: Array<{ name: string; qty: number; unit: number }>;
}

interface OrderDetailPanelProps {
  detail: OrderDetail;
  onAfterAction?: (action: "validate" | "reject") => void;
}

const STATUS_BADGES: Record<OrderStatus, { label: string; cls: string }> = {
  validated: { label: "Validada", cls: "bg-emerald-500/15 text-emerald-200 border-emerald-500/30" },
  pending_validation: { label: "Pendiente", cls: "bg-amber-500/15 text-amber-200 border-amber-500/30" },
  manual_review: { label: "En revisión", cls: "bg-violet-500/15 text-violet-200 border-violet-500/30" },
  rejected: { label: "Rechazada", cls: "bg-red-500/10 text-red-200 border-red-400/30" },
  cancelled: { label: "Cancelada", cls: "bg-red-500/10 text-red-200 border-red-400/30" },
};

function formatDate(iso: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("es-AR", { dateStyle: "short", timeStyle: "short" });
}

function relativeTime(iso: string): string {
  const d = new Date(iso).getTime();
  if (!Number.isFinite(d)) return "";
  const diff = Date.now() - d;
  const min = Math.floor(diff / 60000);
  if (min < 1) return "ahora";
  if (min < 60) return `hace ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `hace ${h} h`;
  const days = Math.floor(h / 24);
  return `hace ${days} día${days > 1 ? "s" : ""}`;
}

function cleanPhoneForWhatsapp(phone: string): string {
  return phone.replace(/[^0-9]/g, "");
}

export function OrderDetailPanel({ detail, onAfterAction }: OrderDetailPanelProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<{ type: "ok" | "error"; text: string } | null>(null);
  const [showFullProof, setShowFullProof] = useState(false);

  useEffect(() => {
    setFeedback(null);
    setShowFullProof(false);
  }, [detail.id]);

  const isFinal = detail.status === "validated" || detail.status === "rejected" || detail.status === "cancelled";

  function handleValidate() {
    if (isFinal) return;
    setFeedback(null);
    startTransition(async () => {
      const res = await validateOrder(detail.id);
      if ("error" in res) {
        setFeedback({ type: "error", text: res.error });
        return;
      }
      if (res.warning) {
        setFeedback({ type: "error", text: res.warning });
      } else {
        setFeedback({ type: "ok", text: res.message ?? "Validada." });
      }
      onAfterAction?.("validate");
      router.refresh();
    });
  }

  function handleResendEmail() {
    setFeedback(null);
    startTransition(async () => {
      const res = await resendTicketsEmailAction(detail.id);
      if ("error" in res) {
        setFeedback({ type: "error", text: res.error });
        return;
      }
      setFeedback({ type: "ok", text: res.message ?? "Email reenviado." });
      router.refresh();
    });
  }

  function handleReject() {
    if (isFinal) return;
    if (!window.confirm("¿Rechazar este pago? Esta acción es definitiva.")) return;
    setFeedback(null);
    startTransition(async () => {
      const res = await rejectOrder(detail.id);
      if ("error" in res) {
        setFeedback({ type: "error", text: res.error });
        return;
      }
      setFeedback({ type: "ok", text: res.message ?? "Rechazada." });
      onAfterAction?.("reject");
      router.refresh();
    });
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement | null)?.tagName?.toLowerCase();
      if (tag === "input" || tag === "textarea" || tag === "select") return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      if (e.key === "v" || e.key === "V") {
        e.preventDefault();
        handleValidate();
      } else if (e.key === "r" || e.key === "R") {
        e.preventDefault();
        handleReject();
      } else if (e.key === "o" || e.key === "O") {
        if (detail.proof_signed_url) {
          e.preventDefault();
          window.open(detail.proof_signed_url, "_blank");
        }
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detail.id, detail.proof_signed_url, isFinal]);

  const badge = STATUS_BADGES[detail.status];
  const phoneClean = cleanPhoneForWhatsapp(detail.buyer_phone);
  const wa = phoneClean
    ? `https://wa.me/${phoneClean}?text=${encodeURIComponent(`Hola ${detail.buyer_first_name}, soy de ${detail.event_name ?? "el evento"}. `)}`
    : "";

  return (
    <div className="grid gap-4">
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`rounded-full border px-2 py-0.5 text-xs ${badge.cls}`}>{badge.label}</span>
            <span className="font-mono text-[10px] text-white/40">#{detail.id.slice(0, 8)}</span>
            <span className="text-xs text-white/55">{relativeTime(detail.created_at)}</span>
          </div>
          <h2 className="mt-2 text-2xl font-bold text-white">
            {detail.buyer_first_name} {detail.buyer_last_name}
          </h2>
          {detail.event_name ? (
            <p className="text-xs text-white/55">
              Evento: <span className="text-white/80">{detail.event_name}</span>
            </p>
          ) : null}
        </div>
        <Link
          href={`/o/${detail.id}`}
          target="_blank"
          className="rounded-lg border border-white/15 px-3 py-1.5 text-xs text-white/70 hover:bg-white/5"
        >
          Vista comprador ↗
        </Link>
      </header>

      <section className="surface-glass grid gap-4 p-5 sm:grid-cols-[1fr_auto] sm:items-center">
        <div>
          <p className="text-xs uppercase tracking-wider text-white/55">Monto a verificar</p>
          <p className="mt-1 text-4xl font-bold text-white tabular-nums">
            {money.format(Number(detail.total_ars))}
          </p>
          <p className="mt-1 text-xs text-white/55">
            {detail.total_qty} entrada{detail.total_qty > 1 ? "s" : ""} · creada {formatDate(detail.created_at)}
          </p>
        </div>
        <div className="flex flex-wrap gap-2 sm:flex-col sm:items-end">
          <CopyButton value={String(Number(detail.total_ars))} label="Copiar monto" size="md" />
          <CopyButton
            value={`${detail.buyer_first_name} ${detail.buyer_last_name}`}
            label="Copiar nombre"
            size="md"
          />
        </div>
      </section>

      <section className="surface-glass p-5">
        <p className="text-xs uppercase tracking-wider text-white/55">Comprobante</p>
        {detail.proof_signed_url ? (
          <>
            <button
              type="button"
              onClick={() => setShowFullProof((v) => !v)}
              className="mt-3 block w-full overflow-hidden rounded-xl border border-white/10 bg-white/5"
              title="Click para ampliar"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={detail.proof_signed_url}
                alt="Comprobante de pago"
                className={
                  showFullProof
                    ? "max-h-[80vh] w-full object-contain"
                    : "max-h-[420px] w-full object-contain"
                }
              />
            </button>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <a
                href={detail.proof_signed_url}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-lg border border-brand/40 bg-brand/10 px-3 py-1.5 text-xs text-white hover:bg-brand/20"
              >
                Abrir en grande (O)
              </a>
              <span className="text-xs text-white/45">click en la imagen para zoom</span>
            </div>
          </>
        ) : (
          <p className="mt-2 text-sm text-white/60">No hay comprobante asociado.</p>
        )}
      </section>

      <section className="surface-glass grid gap-4 p-5 sm:grid-cols-2">
        <div>
          <p className="text-xs uppercase tracking-wider text-white/55">Comprador</p>
          <p className="mt-2 text-sm text-white/85">
            {detail.buyer_first_name} {detail.buyer_last_name}
          </p>
          <div className="mt-2 grid gap-2">
            <div className="flex items-center justify-between gap-2 text-sm">
              <span className="text-white/55">DNI</span>
              <div className="flex items-center gap-2">
                <span className="font-mono text-white">{detail.buyer_dni}</span>
                <CopyButton value={detail.buyer_dni} />
              </div>
            </div>
            <div className="flex items-center justify-between gap-2 text-sm">
              <span className="text-white/55">Email</span>
              <div className="flex min-w-0 items-center gap-2">
                <a
                  href={`mailto:${detail.buyer_email}`}
                  className="truncate text-white hover:underline"
                  title={detail.buyer_email}
                >
                  {detail.buyer_email}
                </a>
                <CopyButton value={detail.buyer_email} />
              </div>
            </div>
            <div className="flex items-center justify-between gap-2 text-sm">
              <span className="text-white/55">Teléfono</span>
              <div className="flex items-center gap-2">
                <span className="font-mono text-white">{detail.buyer_phone}</span>
                <CopyButton value={detail.buyer_phone} />
              </div>
            </div>
          </div>
          {wa ? (
            <a
              href={wa}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-flex items-center gap-2 rounded-lg border border-emerald-400/40 bg-emerald-500/10 px-3 py-2 text-xs font-medium text-emerald-100 hover:bg-emerald-500/20"
            >
              Escribir por WhatsApp →
            </a>
          ) : null}
        </div>

        <div>
          <p className="text-xs uppercase tracking-wider text-white/55">Items</p>
          <ul className="mt-2 grid gap-2">
            {detail.items.length === 0 ? (
              <li className="text-sm text-white/60">—</li>
            ) : (
              detail.items.map((it, idx) => (
                <li key={idx} className="flex items-center justify-between text-sm">
                  <span className="text-white/85">
                    {it.qty}× {it.name}
                  </span>
                  <span className="text-white/60">{money.format(it.unit)}</span>
                </li>
              ))
            )}
          </ul>
          <div className="mt-3 flex items-center justify-between border-t border-white/10 pt-3 text-sm">
            <span className="text-white/55">Total</span>
            <span className="font-semibold text-white">{money.format(Number(detail.total_ars))}</span>
          </div>
        </div>
      </section>

      {!isFinal ? (
        <section className="surface-glass sticky bottom-2 z-10 grid gap-3 p-4 ring-1 ring-white/10">
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={handleValidate}
              disabled={pending}
              className="flex-1 rounded-xl border border-emerald-400/40 bg-emerald-500/15 px-4 py-3 text-sm font-semibold text-emerald-50 transition hover:bg-emerald-500/25 disabled:opacity-50"
            >
              {pending ? "Procesando…" : "✓ Validar pago"}
              <span className="ml-2 rounded bg-black/30 px-1.5 py-0.5 text-[10px] font-mono text-white/70">V</span>
            </button>
            <button
              type="button"
              onClick={handleReject}
              disabled={pending}
              className="flex-1 rounded-xl border border-red-400/40 bg-red-500/10 px-4 py-3 text-sm font-semibold text-red-100 transition hover:bg-red-500/20 disabled:opacity-50"
            >
              ✗ Rechazar
              <span className="ml-2 rounded bg-black/30 px-1.5 py-0.5 text-[10px] font-mono text-white/70">R</span>
            </button>
          </div>
          <p className="text-center text-[11px] text-white/40">
            Atajos: <span className="font-mono">V</span> validar · <span className="font-mono">R</span> rechazar ·{" "}
            <span className="font-mono">O</span> abrir comprobante · <span className="font-mono">J/K</span> navegar
          </p>
        </section>
      ) : (
        <section className="surface-glass grid gap-3 p-4 text-sm text-white/75">
          {detail.status === "validated" ? (
            <>
              <p>
                ✅ Validada{detail.validated_at ? ` el ${formatDate(detail.validated_at)}` : ""}. Tickets emitidos.
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleResendEmail}
                  disabled={pending}
                  className="rounded-lg border border-brand/40 bg-brand/10 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-brand/20 disabled:opacity-50"
                >
                  {pending ? "Enviando…" : detail.tickets_email_sent_at ? "Reenviar email con QRs" : "Enviar email con QRs"}
                </button>
                {detail.tickets_email_sent_at ? (
                  <span className="text-[11px] text-white/50">
                    Último envío: {formatDate(detail.tickets_email_sent_at)}
                  </span>
                ) : (
                  <span className="text-[11px] text-amber-200/80">Aún no se envió email automático.</span>
                )}
              </div>
            </>
          ) : (
            <p>
              ✗ Esta orden está {STATUS_BADGES[detail.status].label.toLowerCase()}
              {detail.rejected_at ? ` desde ${formatDate(detail.rejected_at)}` : ""}.
            </p>
          )}
        </section>
      )}

      {feedback ? (
        <div
          className={
            feedback.type === "ok"
              ? "rounded-lg border border-emerald-400/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200"
              : "rounded-lg border border-red-400/40 bg-red-500/10 px-3 py-2 text-sm text-red-200"
          }
        >
          {feedback.text}
        </div>
      ) : null}
    </div>
  );
}
