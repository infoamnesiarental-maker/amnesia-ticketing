"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { updateEventDetails } from "@/app/app/actions";

import { EventCoverUploadField } from "./EventCoverUploadField";

export interface EventEditInitial {
  name: string;
  slug: string;
  place: string | null;
  description: string | null;
  cover_image_url: string | null;
  catalog_flair: string | null;
  starts_at: string | null;
  promo_whatsapp: string | null;
}

function isoToDatetimeLocal(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function StepIndicator({ step }: { step: 1 | 2 }) {
  return (
    <div className="mb-8 flex flex-col items-center gap-2">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/45">Paso {step} de 2</p>
      <div className="flex items-center gap-2">
        <span
          className={`flex size-10 items-center justify-center rounded-full text-sm font-bold transition ${
            step === 1 ? "bg-[var(--brand-orange)] text-white shadow-[var(--shadow-button-hover)]" : "bg-white/15 text-white/90"
          }`}
        >
          1
        </span>
        <span className={`h-0.5 w-12 rounded-full transition sm:w-16 ${step === 2 ? "bg-[var(--brand-orange)]" : "bg-white/15"}`} aria-hidden />
        <span
          className={`flex size-10 items-center justify-center rounded-full text-sm font-bold transition ${
            step === 2 ? "bg-[var(--brand-orange)] text-white shadow-[var(--shadow-button-hover)]" : "bg-white/10 text-white/40"
          }`}
        >
          2
        </span>
      </div>
      <p className="text-center text-xs text-white/50">
        {step === 1 ? "Datos visibles en la home" : "Revisá y guardá"}
      </p>
    </div>
  );
}

interface EventEditFormProps {
  eventId: string;
  initial: EventEditInitial;
}

export function EventEditForm({ eventId, initial }: EventEditFormProps) {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2>(1);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const [place, setPlace] = useState(initial.place ?? "");
  const [startsAt, setStartsAt] = useState(isoToDatetimeLocal(initial.starts_at));
  const [description, setDescription] = useState(initial.description ?? "");
  const [coverImageUrl, setCoverImageUrl] = useState(initial.cover_image_url ?? "");
  const [promoWhatsapp, setPromoWhatsapp] = useState(initial.promo_whatsapp ?? "");

  function goStep2() {
    setError(null);
    setStep(2);
  }

  function goStep1() {
    setError(null);
    setStep(1);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const fd = new FormData();
    fd.set("event_id", eventId);
    fd.set("place", place.trim());
    fd.set("starts_at", startsAt);
    fd.set("description", description.trim());
    fd.set("cover_image_url", coverImageUrl.trim());
    fd.set("catalog_flair", (initial.catalog_flair ?? "").trim());
    fd.set("promo_whatsapp", promoWhatsapp.replace(/\D/g, ""));

    startTransition(async () => {
      const res = await updateEventDetails(fd);
      if ("error" in res) {
        setError(res.error);
        return;
      }
      router.push("/app/eventos");
      router.refresh();
    });
  }

  return (
    <div className="mt-8 w-full">
      <StepIndicator step={step} />
      <form onSubmit={handleSubmit} className="surface-glass mx-auto w-full max-w-lg space-y-5 p-6 sm:p-8">
        {error ? (
          <div className="rounded-xl border border-red-400/40 bg-red-500/10 px-3 py-2 text-sm text-red-200">{error}</div>
        ) : null}

        <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-3 text-center sm:text-left">
          <p className="font-medium text-white">{initial.name}</p>
          <p className="mt-1 text-xs text-white/50">
            Slug: <span className="font-mono">{initial.slug}</span>
          </p>
        </div>

        {step === 1 ? (
          <>
            <label className="grid gap-2 text-sm text-white/90">
              Lugar
              <input className="input-design" value={place} onChange={(e) => setPlace(e.target.value)} placeholder="Ciudad / venue" disabled={pending} />
            </label>
            <label className="grid gap-2 text-sm text-white/90">
              Fecha y hora del evento
              <input
                className="input-design"
                type="datetime-local"
                value={startsAt}
                onChange={(e) => setStartsAt(e.target.value)}
                disabled={pending}
              />
              <span className="text-xs text-white/45">Vacío = se borra la fecha guardada.</span>
            </label>
            <label className="grid gap-2 text-sm text-white/90">
              Descripción (catálogo público)
              <textarea
                className="input-design min-h-[88px] resize-y"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                maxLength={2000}
                disabled={pending}
              />
            </label>
            <EventCoverUploadField imageUrl={coverImageUrl} onImageUrlChange={setCoverImageUrl} disabled={pending} />

            <label className="grid gap-2 text-sm text-white/90">
              <span className="flex items-center gap-2">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden className="text-emerald-400">
                  <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.92 12a19.79 19.79 0 0 1-3-8.57A2 2 0 0 1 3.92 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                WhatsApp de promo
                <span className="text-white/40 font-normal">(opcional)</span>
              </span>
              <input
                className="input-design"
                type="tel"
                inputMode="tel"
                value={promoWhatsapp}
                onChange={(e) => setPromoWhatsapp(e.target.value)}
                placeholder="Ej: 5491122334455 (con código de país)"
                disabled={pending}
              />
              <span className="text-xs text-white/40">
                Si lo cargás, aparece un botón animado en la ticketera pública para que la gente te escriba y consulte por la promo.
              </span>
            </label>

            <button type="button" className="btn-cta-primary mt-2 w-full justify-center" onClick={goStep2} disabled={pending}>
              Continuar al paso 2
            </button>
            <Link href="/app/eventos" className="block text-center text-sm text-white/55 hover:text-white">
              Cancelar
            </Link>
          </>
        ) : (
          <>
            <div className="grid gap-4 rounded-xl border border-white/10 bg-white/[0.04] p-4 text-sm text-white/80">
              <p className="text-xs font-semibold uppercase tracking-wide text-white/45">Vista previa</p>
              <div className="relative aspect-[16/10] w-full overflow-hidden rounded-lg border border-white/10 bg-zinc-900">
                {coverImageUrl ? (
                  <Image src={coverImageUrl} alt="" fill className="object-cover" sizes="400px" unoptimized />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center text-xs text-white/40">Sin imagen de tapa</div>
                )}
              </div>
              <div>
                <p className="text-xs text-white/45">Lugar</p>
                <p className="text-white/90">{place.trim() || "—"}</p>
              </div>
              {description.trim() ? (
                <div>
                  <p className="text-xs text-white/45">Descripción</p>
                  <p className="line-clamp-4 text-white/75">{description.trim()}</p>
                </div>
              ) : null}
            </div>
            <div className="flex flex-col gap-3 pt-2 sm:flex-row-reverse sm:justify-start">
              <button className="btn-cta-primary w-full justify-center sm:w-auto sm:min-w-[10rem]" type="submit" disabled={pending}>
                {pending ? "Guardando…" : "Guardar cambios"}
              </button>
              <button type="button" className="btn-outline-light w-full justify-center sm:w-auto sm:min-w-[10rem]" onClick={goStep1} disabled={pending}>
                Volver al paso 1
              </button>
            </div>
            <Link href="/app/eventos" className="block text-center text-sm text-white/55 hover:text-white">
              Cancelar
            </Link>
          </>
        )}
      </form>
    </div>
  );
}
