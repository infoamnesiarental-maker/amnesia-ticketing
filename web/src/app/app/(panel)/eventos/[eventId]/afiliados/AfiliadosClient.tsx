"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { createAffiliateCode, deleteAffiliateCode, toggleAffiliateCode } from "./actions";
import { nameToCode } from "./utils";

const money = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 0,
});

export interface AffiliateRow {
  id: string;
  name: string;
  code: string;
  is_active: boolean;
  created_at: string;
  total_orders: number;
  validated_orders: number;
  pending_orders: number;
  validated_ars: number;
  validated_qty: number;
}

// ── Copy link button ──────────────────────────────────────────────────────────

function CopyLinkButton({ link }: { link: string }) {
  const [state, setState] = useState<"idle" | "copied" | "shared">("idle");

  async function handleShare() {
    // En mobile preferimos el Share API nativo si está disponible
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ title: "Link de entrada", url: link });
        setState("shared");
        setTimeout(() => setState("idle"), 2000);
        return;
      } catch {
        // cancelado o no soportado → fall through a clipboard
      }
    }
    navigator.clipboard.writeText(link).then(() => {
      setState("copied");
      setTimeout(() => setState("idle"), 2000);
    });
  }

  return (
    <button
      type="button"
      onClick={handleShare}
      className={`flex w-full items-center justify-center gap-2 rounded-xl border py-3 text-sm font-semibold transition ${
        state !== "idle"
          ? "border-emerald-400/40 bg-emerald-500/12 text-emerald-200"
          : "border-violet-400/30 bg-violet-500/10 text-violet-200 hover:bg-violet-500/18 active:bg-violet-500/25"
      }`}
    >
      {state === "copied" ? (
        <>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
            <polyline points="20 6 9 17 4 12" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          ¡Link copiado!
        </>
      ) : state === "shared" ? (
        <>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
            <polyline points="20 6 9 17 4 12" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          ¡Compartido!
        </>
      ) : (
        <>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
            <circle cx="18" cy="5" r="3" stroke="currentColor" strokeWidth="1.8" />
            <circle cx="6" cy="12" r="3" stroke="currentColor" strokeWidth="1.8" />
            <circle cx="18" cy="19" r="3" stroke="currentColor" strokeWidth="1.8" />
            <path d="m8.59 13.51 6.83 3.98M15.41 6.51 8.59 10.49" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
          Compartir / Copiar link
        </>
      )}
    </button>
  );
}

// ── Affiliate card ────────────────────────────────────────────────────────────

function AffiliateCard({
  aff,
  eventId,
  baseUrl,
  orgSlug,
  eventSlug,
}: {
  aff: AffiliateRow;
  eventId: string;
  baseUrl: string;
  orgSlug: string;
  eventSlug: string;
}) {
  const [pending, startTransition] = useTransition();
  const [expanded, setExpanded] = useState(false);
  const router = useRouter();
  const link = `${baseUrl}/e/${encodeURIComponent(orgSlug)}/${encodeURIComponent(eventSlug)}?ref=${aff.code}`;

  function handleToggle() {
    startTransition(async () => {
      await toggleAffiliateCode({ eventId, affiliateId: aff.id, isActive: !aff.is_active });
      router.refresh();
    });
  }

  function handleDelete() {
    if (!confirm(`¿Eliminar "${aff.name}"? Las órdenes existentes conservan el código.`)) return;
    startTransition(async () => {
      await deleteAffiliateCode({ eventId, affiliateId: aff.id });
      router.refresh();
    });
  }

  const hasStats = aff.validated_qty > 0 || aff.validated_orders > 0 || aff.pending_orders > 0;

  return (
    <div className={`surface-glass overflow-hidden transition-opacity ${!aff.is_active ? "opacity-60" : ""}`}>

      {/* ── Cabecera ── */}
      <div className="flex items-center gap-3 px-4 pt-4 pb-3">
        {/* Avatar inicial */}
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-violet-500/20 text-sm font-bold text-violet-300">
          {aff.name.charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-semibold text-white truncate">{aff.name}</p>
            {!aff.is_active && (
              <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white/40">
                Pausado
              </span>
            )}
            {aff.pending_orders > 0 && (
              <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-semibold text-amber-300">
                {aff.pending_orders} pendiente{aff.pending_orders !== 1 ? "s" : ""}
              </span>
            )}
          </div>
          {/* Código en un pill visual */}
          <div className="mt-1 inline-flex items-center gap-1 rounded-lg bg-violet-500/12 px-2 py-0.5">
            <span className="text-[10px] text-violet-400/70">?ref=</span>
            <span className="font-mono text-xs font-bold text-violet-300">{aff.code}</span>
          </div>
        </div>
      </div>

      {/* ── Stats ── */}
      {hasStats ? (
        <div className="grid grid-cols-3 border-t border-white/8">
          <div className="border-r border-white/8 py-3 text-center">
            <p className="text-xl font-bold tabular-nums text-white">{aff.validated_qty}</p>
            <p className="mt-0.5 text-[10px] text-white/40">Entradas</p>
          </div>
          <div className="border-r border-white/8 py-3 text-center">
            <p className="text-xl font-bold tabular-nums text-emerald-300">{aff.validated_orders}</p>
            <p className="mt-0.5 text-[10px] text-white/40">Validadas</p>
          </div>
          <div className="py-3 text-center">
            <p className="text-lg font-bold tabular-nums text-brand leading-tight">
              {money.format(aff.validated_ars)}
            </p>
            <p className="mt-0.5 text-[10px] text-white/40">Recaudado</p>
          </div>
        </div>
      ) : (
        <div className="border-t border-white/8 px-4 py-3 text-xs text-white/35 italic">
          Sin ventas registradas aún
        </div>
      )}

      {/* ── Acción principal: compartir link ── */}
      <div className="border-t border-white/8 px-4 py-3">
        <CopyLinkButton link={link} />
      </div>

      {/* ── Acciones secundarias (expandibles) ── */}
      <div className="border-t border-white/8">
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="flex w-full items-center justify-between px-4 py-2.5 text-xs text-white/40 hover:text-white/60"
        >
          <span>Opciones</span>
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden
            className={`transition-transform ${expanded ? "rotate-180" : ""}`}
          >
            <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>

        {expanded && (
          <div className="flex items-center gap-2 border-t border-white/8 bg-white/[0.02] px-4 py-3">
            {/* Link completo legible */}
            <p className="min-w-0 flex-1 break-all font-mono text-[10px] text-white/30 leading-relaxed">{link}</p>
            <div className="flex shrink-0 flex-col gap-1.5">
              <button
                type="button"
                onClick={handleToggle}
                disabled={pending}
                className="rounded-lg border border-white/20 px-3 py-2 text-xs font-medium text-white/70 hover:bg-white/5 disabled:opacity-40 whitespace-nowrap"
              >
                {aff.is_active ? "Pausar" : "Activar"}
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={pending}
                className="rounded-lg border border-red-400/25 px-3 py-2 text-xs font-medium text-red-300/80 hover:bg-red-500/10 disabled:opacity-40 whitespace-nowrap"
              >
                Eliminar
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Create form ───────────────────────────────────────────────────────────────

function CreateForm({
  eventId,
  onCreated,
}: {
  eventId: string;
  onCreated: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [customCode, setCustomCode] = useState("");
  const [useCustomCode, setUseCustomCode] = useState(false);
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const previewCode = useCustomCode
    ? customCode.toUpperCase().replace(/[^A-Z0-9_-]/g, "").slice(0, 16)
    : nameToCode(name);

  function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setFeedback(null);
    if (!name.trim()) { setFeedback({ ok: false, text: "Ingresá el nombre del afiliado." }); return; }
    if (!previewCode) { setFeedback({ ok: false, text: "El nombre no genera un código válido. Usá letras y números." }); return; }

    startTransition(async () => {
      const res = await createAffiliateCode({
        eventId,
        name: name.trim(),
        customCode: useCustomCode ? previewCode : undefined,
      });
      if ("error" in res) { setFeedback({ ok: false, text: res.error }); return; }
      setFeedback({ ok: true, text: res.message });
      setName(""); setCustomCode(""); setUseCustomCode(false);
      router.refresh();
      onCreated();
      setTimeout(() => { setFeedback(null); setOpen(false); }, 2000);
    });
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="btn-cta-primary flex w-full items-center justify-center gap-2 py-3.5 text-base"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
        </svg>
        Nuevo afiliado
      </button>
    );
  }

  return (
    <form onSubmit={handleCreate} className="surface-glass overflow-hidden">

      {/* Header del form */}
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
        <p className="font-semibold text-white">Nuevo afiliado</p>
        <button
          type="button"
          onClick={() => { setOpen(false); setFeedback(null); setName(""); setCustomCode(""); setUseCustomCode(false); }}
          className="rounded-lg p-1.5 text-white/40 hover:bg-white/5 hover:text-white/70"
          aria-label="Cancelar"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      <div className="space-y-4 p-4">
        {/* Nombre */}
        <label className="grid gap-1.5 text-sm text-white/80">
          Nombre del afiliado
          <input
            className="input-design text-base"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ej: Martina García"
            required
            disabled={pending}
            autoFocus
          />
        </label>

        {/* Preview del código — aparece apenas escribe */}
        {name.trim() && (
          <div className={`rounded-xl border px-4 py-3 transition-all ${
            previewCode ? "border-violet-400/30 bg-violet-500/8" : "border-white/10 bg-white/[0.02]"
          }`}>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-white/40">Código generado</p>
            <p className="mt-1 font-mono text-2xl font-bold text-violet-300">{previewCode || "—"}</p>
            <p className="mt-1 text-xs text-white/35">El link quedará: …?ref={previewCode || "…"}</p>
          </div>
        )}

        {/* Toggle código personalizado */}
        <button
          type="button"
          onClick={() => setUseCustomCode((v) => !v)}
          disabled={pending}
          className="flex w-full items-center justify-between rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-white/60 hover:bg-white/[0.06]"
        >
          <span>Personalizar el código</span>
          <span className={`flex h-5 w-9 items-center rounded-full border transition-colors ${
            useCustomCode ? "border-violet-400/50 bg-violet-500/30" : "border-white/20 bg-white/10"
          }`}>
            <span className={`ml-0.5 h-4 w-4 rounded-full transition-transform ${
              useCustomCode ? "translate-x-4 bg-violet-300" : "bg-white/40"
            }`} />
          </span>
        </button>

        {useCustomCode && (
          <label className="grid gap-1.5 text-sm text-white/80">
            Código personalizado
            <input
              className="input-design font-mono text-base uppercase tracking-widest"
              value={customCode}
              onChange={(e) => setCustomCode(e.target.value)}
              placeholder="Ej: PROMO2026"
              disabled={pending}
              maxLength={16}
            />
            <span className="text-xs text-white/35">Solo letras, números, guiones. Máx 16 caracteres.</span>
          </label>
        )}

        {feedback && (
          <div
            className={`rounded-xl border px-4 py-3 text-sm ${
              feedback.ok
                ? "border-emerald-400/35 bg-emerald-500/10 text-emerald-100"
                : "border-red-400/40 bg-red-500/10 text-red-200"
            }`}
            role="status"
          >
            {feedback.text}
          </div>
        )}

        <button
          type="submit"
          className="btn-cta-primary w-full justify-center py-3.5 text-base"
          disabled={pending || !name.trim() || !previewCode}
        >
          {pending ? "Creando…" : "Crear afiliado"}
        </button>
      </div>
    </form>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────

export function AfiliadosClient({
  eventId,
  orgSlug,
  eventSlug,
  affiliates,
  baseUrl,
}: {
  eventId: string;
  orgSlug: string;
  eventSlug: string;
  affiliates: AffiliateRow[];
  baseUrl: string;
}) {
  const [_refresh, setRefresh] = useState(0);

  return (
    <div className="space-y-4">

      {/* Botón / formulario de creación */}
      <CreateForm eventId={eventId} onCreated={() => setRefresh((v) => v + 1)} />

      {/* Lista */}
      {affiliates.length === 0 ? (
        <div className="rounded-xl border border-white/8 bg-white/[0.02] p-6 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-violet-500/15">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden className="text-violet-300">
              <circle cx="18" cy="5" r="3" stroke="currentColor" strokeWidth="1.8" />
              <circle cx="6" cy="12" r="3" stroke="currentColor" strokeWidth="1.8" />
              <circle cx="18" cy="19" r="3" stroke="currentColor" strokeWidth="1.8" />
              <path d="m8.59 13.51 6.83 3.98M15.41 6.51 8.59 10.49" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </div>
          <p className="text-sm font-medium text-white/60">Sin afiliados todavía</p>
          <p className="mt-1 text-xs text-white/35">
            Creá tu primer afiliado y compartí el link para trackear sus ventas.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {affiliates.map((aff) => (
            <AffiliateCard
              key={aff.id}
              aff={aff}
              eventId={eventId}
              baseUrl={baseUrl}
              orgSlug={orgSlug}
              eventSlug={eventSlug}
            />
          ))}
        </div>
      )}
    </div>
  );
}
