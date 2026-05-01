"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { createEvent } from "@/app/app/actions";

import { EventCoverUploadField } from "./EventCoverUploadField";
import { TicketTypeForm } from "./TicketTypeForm";

function StepIndicator({ step }: { step: 1 | 2 | 3 }) {
  const dot = (n: 1 | 2 | 3) => {
    const active = step === n;
    const done = step > n;
    return `flex size-10 items-center justify-center rounded-full text-sm font-bold transition ${
      active
        ? "bg-[var(--brand-orange)] text-white shadow-[var(--shadow-button-hover)]"
        : done
          ? "bg-white/15 text-white/90"
          : "bg-white/10 text-white/40"
    }`;
  };
  const bar = (afterStep: 1 | 2) => `h-0.5 w-8 rounded-full sm:w-12 ${step > afterStep ? "bg-[var(--brand-orange)]" : "bg-white/15"}`;

  const subtitle =
    step === 1 ? "Datos del evento y catálogo público" : step === 2 ? "Cobros" : "Primera entrada a la venta";

  return (
    <div className="mb-8 flex flex-col items-center gap-2">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/45">Paso {step} de 3</p>
      <div className="flex items-center gap-1.5 sm:gap-2">
        <span className={dot(1)}>1</span>
        <span className={bar(1)} aria-hidden />
        <span className={dot(2)}>2</span>
        <span className={bar(2)} aria-hidden />
        <span className={dot(3)}>3</span>
      </div>
      <p className="max-w-sm text-center text-xs text-white/50">{subtitle}</p>
    </div>
  );
}

export function CreateEventForm() {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const [name, setName] = useState("");
  const [place, setPlace] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [description, setDescription] = useState("");
  const [coverImageUrl, setCoverImageUrl] = useState("");
  const [mpAlias, setMpAlias] = useState("");
  const [createdEventId, setCreatedEventId] = useState<string | null>(null);

  function goStep2() {
    setError(null);
    if (!name.trim()) {
      setError("El nombre del evento es obligatorio.");
      return;
    }
    setStep(2);
  }

  function goStep1() {
    setError(null);
    setStep(1);
  }

  async function handleCreateEvent(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!mpAlias.trim()) {
      setError("El alias o CVU de Mercado Pago es obligatorio.");
      return;
    }
    const fd = new FormData();
    fd.set("name", name.trim());
    fd.set("place", place.trim());
    fd.set("starts_at", startsAt);
    fd.set("description", description.trim());
    fd.set("cover_image_url", coverImageUrl.trim());
    fd.set("mp_alias", mpAlias.trim());

    startTransition(async () => {
      const res = await createEvent(fd);
      if ("error" in res) {
        setError(res.error);
        return;
      }
      setCreatedEventId(res.eventId);
      setStep(3);
    });
  }

  const entradasHref = createdEventId ? `/app/eventos/${createdEventId}/entradas` : "/app/eventos";

  return (
    <div className="mt-8 w-full">
      <StepIndicator step={step} />

      {step <= 2 ? (
        <form onSubmit={handleCreateEvent} className="surface-glass mx-auto w-full max-w-lg space-y-5 p-6 sm:p-8">
          {error ? (
            <div className="rounded-xl border border-red-400/40 bg-red-500/10 px-3 py-2 text-sm text-red-200">{error}</div>
          ) : null}

          {step === 1 ? (
            <>
              <label className="grid gap-2 text-sm text-white/90">
                Nombre del evento
                <input
                  className="input-design"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  disabled={pending}
                  autoComplete="off"
                />
              </label>
              <label className="grid gap-2 text-sm text-white/90">
                Lugar (opcional)
                <input
                  className="input-design"
                  value={place}
                  onChange={(e) => setPlace(e.target.value)}
                  placeholder="Ciudad / venue"
                  disabled={pending}
                />
              </label>
              <label className="grid gap-2 text-sm text-white/90">
                Fecha y hora del evento (opcional)
                <input
                  className="input-design"
                  type="datetime-local"
                  value={startsAt}
                  onChange={(e) => setStartsAt(e.target.value)}
                  disabled={pending}
                />
              </label>
              <label className="grid gap-2 text-sm text-white/90">
                Descripción (opcional, se muestra en la home)
                <textarea
                  className="input-design min-h-[88px] resize-y"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Resumen para la tarjeta del catálogo público"
                  rows={3}
                  maxLength={2000}
                  disabled={pending}
                />
              </label>
              <EventCoverUploadField imageUrl={coverImageUrl} onImageUrlChange={setCoverImageUrl} disabled={pending} />
              <button type="button" className="btn-cta-primary mt-2 w-full justify-center" onClick={goStep2} disabled={pending}>
                Continuar al paso 2
              </button>
              <Link href="/app/eventos" className="block text-center text-sm text-white/55 hover:text-white">
                Cancelar
              </Link>
            </>
          ) : (
            <>
              <div className="rounded-xl border border-white/10 bg-white/[0.04] p-4 text-sm text-white/80">
                <p className="text-xs font-semibold uppercase tracking-wide text-white/45">Resumen</p>
                <p className="mt-2 font-semibold text-white">{name.trim() || "—"}</p>
                {place.trim() ? <p className="mt-1 text-white/65">{place.trim()}</p> : null}
                {startsAt ? <p className="mt-1 text-xs text-white/50">Fecha cargada</p> : null}
                {coverImageUrl ? (
                  <p className="mt-1 text-xs text-emerald-200/80">Tapa lista</p>
                ) : (
                  <p className="mt-1 text-xs text-white/45">Sin tapa (opcional)</p>
                )}
              </div>
              <label className="grid gap-2 text-sm text-white/90">
                Alias o CVU Mercado Pago
                <input
                  className="input-design"
                  value={mpAlias}
                  onChange={(e) => setMpAlias(e.target.value)}
                  required
                  placeholder="donde recibís transferencias"
                  disabled={pending}
                />
              </label>
              <p className="text-xs text-white/50">
                Este dato lo ven los compradores en la ticketera para transferir. Verificá que sea correcto antes de
                continuar.
              </p>
              <div className="flex flex-col gap-3 pt-2 sm:flex-row-reverse sm:justify-start">
                <button className="btn-cta-primary w-full justify-center sm:w-auto sm:min-w-[10rem]" type="submit" disabled={pending}>
                  {pending ? "Creando…" : "Crear evento y continuar"}
                </button>
                <button type="button" className="btn-outline-light w-full justify-center sm:w-auto sm:min-w-[10rem]" onClick={goStep1} disabled={pending}>
                  Volver al paso 1
                </button>
              </div>
            </>
          )}
        </form>
      ) : null}

      {step === 3 && createdEventId ? (
        <div className="mx-auto w-full max-w-lg space-y-4">
          <div className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-center text-sm text-white/75">
            <p className="font-medium text-white">{name.trim()}</p>
            <p className="mt-1 text-xs text-white/50">
              Usá el mismo formulario que en “Tipos de entrada”: precio, stock y venta activa. Después podés agregar más
              desde la lista del evento.
            </p>
          </div>
          <TicketTypeForm
            key={createdEventId}
            mode="create"
            eventId={createdEventId}
            backHref={entradasHref}
            title={`Primera entrada · ${name.trim()}`}
            hideChrome
            createSubmitLabel="Crear entrada y finalizar"
          />
          <div className="flex flex-col items-center gap-2 pt-2">
            <button
              type="button"
              className="text-sm text-white/55 underline decoration-white/25 underline-offset-4 hover:text-white hover:decoration-white/40"
              onClick={() => router.push("/app/eventos")}
            >
              Omitir por ahora y volver a eventos
            </button>
            <p className="max-w-md text-center text-xs text-white/40">
              Sin al menos un tipo con stock, el evento no aparece en el catálogo público de la home.
            </p>
          </div>
        </div>
      ) : null}
    </div>
  );
}
