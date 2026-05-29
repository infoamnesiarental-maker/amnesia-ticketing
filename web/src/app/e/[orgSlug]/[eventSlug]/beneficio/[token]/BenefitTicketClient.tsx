"use client";

import Link from "next/link";
import { useState, useTransition } from "react";

import { submitBenefitCampaignOrder } from "@/app/e/actions";
import { PUBLIC_PROOF_MAX_BYTES } from "@/lib/upload-limits";

const money = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 2 });

export interface BenefitCheckoutData {
  orgSlug: string;
  eventSlug: string;
  token: string;
  organizationName: string;
  eventName: string;
  eventPlace: string | null;
  eventStartsAt: string | null;
  ticketTypeName: string;
  basePriceArs: number;
  discountedPriceArs: number;
  mpAlias: string;
  campaignNote: string | null;
}

function fmtDate(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("es-AR", { dateStyle: "full", timeStyle: "short" });
}

export function BenefitTicketClient({ data }: { data: BenefitCheckoutData }) {
  const [benefitCode, setBenefitCode] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [dni, setDni] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const startsAt = fmtDate(data.eventStartsAt);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    if (!benefitCode.trim() || !firstName.trim() || !lastName.trim() || !dni.trim() || !phone.trim() || !email.trim()) {
      setError("Completá todos los datos obligatorios.");
      return;
    }
    if (phone.trim().length < 6) {
      setError("El teléfono es inválido.");
      return;
    }

    const fd = new FormData(e.currentTarget);
    const proof = fd.get("proof");
    if (proof && typeof proof !== "string" && proof.size > PUBLIC_PROOF_MAX_BYTES) {
      const mb = (PUBLIC_PROOF_MAX_BYTES / (1024 * 1024)).toFixed(0);
      setError(`El comprobante es demasiado pesado. Máximo ${mb} MB.`);
      return;
    }

    fd.set(
      "attendees_json",
      JSON.stringify([
        {
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          dni: dni.trim(),
          phone: phone.trim(),
        },
      ]),
    );
    fd.set("benefit_code", benefitCode.trim().toUpperCase());

    startTransition(async () => {
      const res = await submitBenefitCampaignOrder(fd);
      if ("error" in res) {
        setError(res.error);
        return;
      }
      window.location.assign(res.next);
    });
  }

  return (
    <div className="mx-auto w-full max-w-2xl">
      <div className="surface-glass p-5 sm:p-6">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand">Beneficio por campaña</p>
        <h1 className="mt-2 text-2xl font-bold text-white">Entrada con descuento por código</h1>
        <p className="mt-2 text-sm text-white/70">
          Este link es reutilizable, pero necesitás un código único para comprar.
        </p>
        <div className="mt-4 grid gap-2 rounded-xl border border-white/10 bg-white/[0.03] p-4 text-sm text-white/80">
          <p>
            Evento: <span className="font-semibold text-white">{data.eventName}</span>
          </p>
          <p>
            Productora: <span className="text-white">{data.organizationName}</span>
          </p>
          <p>
            Entrada: <span className="text-white">{data.ticketTypeName}</span>
          </p>
          {data.eventPlace ? <p>Lugar: <span className="text-white">{data.eventPlace}</span></p> : null}
          {startsAt ? <p>Fecha: <span className="text-white">{startsAt}</span></p> : null}
          <p className="pt-1">
            Precio:{" "}
            <span className="mr-2 text-white/45 line-through">{money.format(data.basePriceArs)}</span>
            <span className="text-lg font-bold text-brand">{money.format(data.discountedPriceArs)}</span>
          </p>
          {data.campaignNote ? <p className="text-xs text-white/60">Nota: {data.campaignNote}</p> : null}
        </div>
      </div>

      <form onSubmit={onSubmit} className="mt-5 flex flex-col gap-6">
        <input type="hidden" name="org_slug" value={data.orgSlug} />
        <input type="hidden" name="event_slug" value={data.eventSlug} />
        <input type="hidden" name="campaign_token" value={data.token} />

        <section className="surface-glass space-y-4 p-5 sm:p-6">
          <h2 className="text-lg font-semibold text-white">1. Código de beneficio</h2>
          <label className="grid gap-1.5 text-sm text-white/90">
            Código (PIN)
            <input
              className="input-design uppercase tracking-wider"
              value={benefitCode}
              onChange={(e) => setBenefitCode(e.target.value)}
              disabled={pending}
              required
              placeholder="EJ: K7M3Q2PW"
            />
          </label>
        </section>

        <section className="surface-glass space-y-4 p-5 sm:p-6">
          <h2 className="text-lg font-semibold text-white">2. Datos del comprador</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="grid gap-1.5 text-sm text-white/90">
              Nombre
              <input className="input-design" value={firstName} onChange={(e) => setFirstName(e.target.value)} disabled={pending} required />
            </label>
            <label className="grid gap-1.5 text-sm text-white/90">
              Apellido
              <input className="input-design" value={lastName} onChange={(e) => setLastName(e.target.value)} disabled={pending} required />
            </label>
            <label className="grid gap-1.5 text-sm text-white/90">
              DNI
              <input className="input-design" value={dni} onChange={(e) => setDni(e.target.value)} disabled={pending} required inputMode="numeric" />
            </label>
            <label className="grid gap-1.5 text-sm text-white/90">
              Teléfono
              <input className="input-design" value={phone} onChange={(e) => setPhone(e.target.value)} disabled={pending} required type="tel" />
            </label>
          </div>
          <label className="grid gap-1.5 text-sm text-white/90">
            Email (donde llegan los QR)
            <input className="input-design" type="email" value={email} onChange={(e) => setEmail(e.target.value)} disabled={pending} required />
          </label>
        </section>

        <section className="surface-glass space-y-4 p-5 sm:p-6">
          <h2 className="text-lg font-semibold text-white">3. Pago y comprobante</h2>
          <p className="text-sm text-white/75">
            Transferí exactamente <span className="font-semibold text-brand">{money.format(data.discountedPriceArs)}</span> al alias:
          </p>
          <p className="rounded-xl border border-brand/40 bg-brand/10 px-4 py-3 font-mono text-base text-white">{data.mpAlias}</p>
          <label className="grid gap-2 text-sm text-white/90">
            Captura del comprobante (JPG, PNG o WebP, máx. {(PUBLIC_PROOF_MAX_BYTES / (1024 * 1024)).toFixed(0)} MB)
            <input
              className="text-sm text-white/80 file:mr-3 file:rounded-lg file:border-0 file:bg-white/10 file:px-3 file:py-2 file:text-white"
              name="proof"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              required
              disabled={pending}
            />
          </label>
        </section>

        {error ? (
          <div className="rounded-xl border border-red-400/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">{error}</div>
        ) : null}

        <button type="submit" className="btn-cta-primary w-full justify-center" disabled={pending}>
          {pending ? "Enviando..." : `Comprar 1 entrada por ${money.format(data.discountedPriceArs)}`}
        </button>

        <p className="text-center text-xs text-white/45">Cada código permite una sola compra.</p>
        <p className="text-center text-xs text-white/45">
          <Link href={`/e/${encodeURIComponent(data.orgSlug)}/${encodeURIComponent(data.eventSlug)}`} className="underline decoration-white/20 underline-offset-4">
            Ir a ticketera normal
          </Link>
        </p>
      </form>
    </div>
  );
}

