"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { getAuthErrorMessage } from "@/lib/auth-errors";
import { isSupabaseBrowserConfigured } from "@/lib/env";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export interface AccountProfilePanelProps {
  email: string;
  initialFullName: string;
  initialPhone: string;
  initialHeadline: string;
  backHref: string;
  backLabel: string;
  title: string;
  subtitle: string;
}

export function AccountProfilePanel({
  email,
  initialFullName,
  initialPhone,
  initialHeadline,
  backHref,
  backLabel,
  title,
  subtitle,
}: AccountProfilePanelProps) {
  const router = useRouter();
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [fullName, setFullName] = useState(initialFullName);
  const [phone, setPhone] = useState(initialPhone);
  const [headline, setHeadline] = useState(initialHeadline);
  const [isSaving, setIsSaving] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");

  async function handleSave() {
    setError("");
    setOk("");
    if (!isSupabaseBrowserConfigured()) {
      setError(
        "Supabase no está configurado. Revisá NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_ANON_KEY en web/.env.local.",
      );
      return;
    }
    setIsSaving(true);
    try {
      const { error: upError } = await supabase.auth.updateUser({
        data: {
          full_name: fullName.trim() || "",
          phone: phone.trim() || "",
          headline: headline.trim() || "",
        },
      });
      if (upError) {
        setError(getAuthErrorMessage(upError));
        return;
      }
      setOk("Listo, guardamos tus datos.");
      router.refresh();
    } catch (e) {
      setError(getAuthErrorMessage(e));
    } finally {
      setIsSaving(false);
    }
  }

  async function handleSignOut() {
    setError("");
    setOk("");
    if (!isSupabaseBrowserConfigured()) {
      setError("No se puede cerrar sesión: Supabase no está configurado.");
      return;
    }
    setIsSigningOut(true);
    try {
      const { error: outError } = await supabase.auth.signOut();
      if (outError) {
        setError(getAuthErrorMessage(outError));
        setIsSigningOut(false);
        return;
      }
      window.location.href = "/auth";
    } catch (e) {
      setError(getAuthErrorMessage(e));
      setIsSigningOut(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-lg">
      <Link
        href={backHref}
        className="mb-5 inline-flex min-h-[44px] items-center text-sm font-medium text-white/70 transition hover:text-white"
      >
        ← {backLabel}
      </Link>

      <div className="surface-glass p-5 shadow-[var(--shadow-soft)] sm:p-8">
        <h1 className="text-xl font-bold text-white sm:text-2xl">{title}</h1>
        <p className="mt-2 text-sm leading-relaxed text-white/65">{subtitle}</p>

        <div className="mt-6 grid gap-5">
          <div className="rounded-xl border border-white/10 bg-black/25 px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-white/40">Email de acceso</p>
            <p className="mt-1 break-all text-sm font-medium text-white/90">{email || "—"}</p>
            <p className="mt-2 text-xs text-white/45">
              No podés cambiar el email desde acá. Si necesitás actualizarlo, escribinos por el canal de soporte.
            </p>
          </div>

          <label className="grid gap-2 text-sm font-medium text-white/90">
            Nombre para mostrar
            <input
              className="input-design min-h-[48px]"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              autoComplete="name"
              placeholder="Ej. María Pérez"
              maxLength={120}
            />
            <span className="text-xs font-normal text-white/45">Así te verán en comunicaciones internas.</span>
          </label>

          <label className="grid gap-2 text-sm font-medium text-white/90">
            Teléfono de contacto
            <input
              className="input-design min-h-[48px]"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              inputMode="tel"
              autoComplete="tel"
              placeholder="+54 9 11 …"
              maxLength={40}
            />
          </label>

          <label className="grid gap-2 text-sm font-medium text-white/90">
            Cargo o nota breve <span className="font-normal text-white/45">(opcional)</span>
            <input
              className="input-design min-h-[48px]"
              value={headline}
              onChange={(e) => setHeadline(e.target.value)}
              placeholder="Ej. Producción · Referente de ventas"
              maxLength={80}
            />
          </label>
        </div>

        {error ? (
          <div
            className="mt-5 rounded-xl border border-red-400/40 px-3 py-3 text-sm text-red-200"
            style={{ background: "rgba(248, 113, 113, 0.12)" }}
            role="alert"
          >
            {error}
          </div>
        ) : null}
        {ok ? (
          <div className="mt-5 rounded-xl border border-emerald-400/35 bg-emerald-500/10 px-3 py-3 text-sm text-emerald-100">
            {ok}
          </div>
        ) : null}

        <button
          type="button"
          className="btn-cta-primary mt-6 min-h-[48px] w-full"
          onClick={handleSave}
          disabled={isSaving || isSigningOut}
        >
          {isSaving ? "Guardando…" : "Guardar cambios"}
        </button>

        <div className="mt-10 border-t border-white/10 pt-8">
          <p className="text-sm font-semibold text-white">Sesión</p>
          <p className="mt-1 text-sm text-white/55">Cerrá sesión en este dispositivo. Vas a tener que volver a iniciar sesión.</p>
          <button
            type="button"
            className="mt-4 flex min-h-[48px] w-full items-center justify-center rounded-full border-2 border-red-400/45 bg-red-500/10 px-4 py-3 text-sm font-semibold text-red-100 transition hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-55"
            onClick={handleSignOut}
            disabled={isSigningOut || isSaving}
          >
            {isSigningOut ? "Cerrando sesión…" : "Cerrar sesión"}
          </button>
        </div>
      </div>
    </div>
  );
}
