"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { updateOrganizationProfile } from "@/app/app/actions";
import { getAuthErrorMessage } from "@/lib/auth-errors";
import { isSupabaseBrowserConfigured } from "@/lib/env";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export interface ProducerProfilePanelProps {
  userEmail: string;
  initialPhone: string;
  org: {
    name: string;
    slug: string;
    contact_email: string;
    cuit: string | null;
    status: string;
  };
  canEditOrg: boolean;
  backHref: string;
  backLabel: string;
}

function statusLabel(status: string): { text: string; className: string } {
  switch (status) {
    case "approved":
      return { text: "Aprobada", className: "border-emerald-500/35 bg-emerald-500/10 text-emerald-100" };
    case "pending":
      return { text: "En revisión", className: "border-amber-500/35 bg-amber-500/10 text-amber-100" };
    case "suspended":
      return { text: "Suspendida", className: "border-red-400/35 bg-red-500/10 text-red-100" };
    case "rejected":
      return { text: "Rechazada", className: "border-red-400/35 bg-red-500/10 text-red-100" };
    default:
      return { text: status, className: "border-white/15 bg-white/5 text-white/80" };
  }
}

export function ProducerProfilePanel({
  userEmail,
  initialPhone,
  org: initialOrg,
  canEditOrg,
  backHref,
  backLabel,
}: ProducerProfilePanelProps) {
  const router = useRouter();
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);

  const [orgName, setOrgName] = useState(initialOrg.name);
  const [orgContactEmail, setOrgContactEmail] = useState(initialOrg.contact_email);
  const [orgCuit, setOrgCuit] = useState(initialOrg.cuit ?? "");
  const [phone, setPhone] = useState(initialPhone);

  useEffect(() => {
    setOrgName(initialOrg.name);
    setOrgContactEmail(initialOrg.contact_email);
    setOrgCuit(initialOrg.cuit ?? "");
  }, [initialOrg.name, initialOrg.contact_email, initialOrg.cuit]);

  useEffect(() => {
    setPhone(initialPhone);
  }, [initialPhone]);

  const [isSaving, setIsSaving] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");

  async function handleSave() {
    setError("");
    setOk("");
    setIsSaving(true);
    try {
      if (canEditOrg) {
        const fd = new FormData();
        fd.set("name", orgName);
        fd.set("contact_email", orgContactEmail);
        fd.set("cuit", orgCuit);
        const res = await updateOrganizationProfile(fd);
        if ("error" in res) {
          setError(res.error);
          setIsSaving(false);
          return;
        }
      }

      if (!isSupabaseBrowserConfigured()) {
        setError("Supabase no está configurado en el navegador.");
        setIsSaving(false);
        return;
      }
      const { error: upError } = await supabase.auth.updateUser({
        data: { phone: phone.trim() || "" },
      });
      if (upError) {
        setError(getAuthErrorMessage(upError));
        setIsSaving(false);
        return;
      }

      setOk("Cambios guardados.");
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

  const st = statusLabel(initialOrg.status);

  return (
    <div className="mx-auto w-full max-w-lg">
      <Link
        href={backHref}
        className="mb-5 inline-flex min-h-[44px] items-center text-sm font-medium text-white/70 transition hover:text-white"
      >
        ← {backLabel}
      </Link>

      <div className="surface-glass p-5 shadow-[var(--shadow-soft)] sm:p-8">
        <h1 className="text-xl font-bold text-white sm:text-2xl">Tu productora y contacto</h1>
        <p className="mt-2 text-sm leading-relaxed text-white/65">
          Acá ves lo que cargaste al registrar la productora: lo que impacta en la ticketera pública y datos internos.
          El teléfono es solo para que podamos comunicarnos con vos.
        </p>

        <div
          className={`mt-5 rounded-xl border px-3 py-2 text-xs font-medium ${st.className}`}
          role="status"
        >
          Estado de la cuenta: {st.text}
        </div>

        <div className="mt-8 border-t border-white/10 pt-8">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-white/45">Visible para compradores</h2>
          <p className="mt-1 text-xs text-white/45">
            El nombre de la productora y la ruta web se mantienen alineados: la ruta se recalcula sola al guardar (si
            cambiás el nombre, los enlaces viejos pueden dejar de funcionar).
          </p>

          <div className="mt-4 rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-white/40">Ruta pública actual (automática)</p>
            <code className="mt-1 block break-all text-white/85">{initialOrg.slug}</code>
            <p className="mt-2 text-xs text-white/45">
              No se puede editar a mano. Si ya existe otra productora con el mismo nombre-base, el sistema agrega un
              número al final.
            </p>
          </div>

          <div className="mt-4 grid gap-4">
            <label className="grid gap-2 text-sm font-medium text-white/90">
              Nombre de la productora
              <input
                className="input-design min-h-[48px] disabled:cursor-not-allowed disabled:opacity-60"
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
                disabled={!canEditOrg || isSaving}
                autoComplete="organization"
                maxLength={160}
              />
            </label>
          </div>
          {!canEditOrg ? (
            <p className="mt-3 text-xs text-white/50">
              Solo el dueño o un administrador puede editar el nombre. Pediles que lo actualicen si hace falta.
            </p>
          ) : null}
        </div>

        <div className="mt-8 border-t border-white/10 pt-8">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-white/45">Datos internos</h2>
          <p className="mt-1 text-xs text-white/45">Email de contacto de la productora y CUIT si lo cargaste.</p>

          <div className="mt-4 grid gap-4">
            <label className="grid gap-2 text-sm font-medium text-white/90">
              Email de contacto (productora)
              <input
                className="input-design min-h-[48px] disabled:cursor-not-allowed disabled:opacity-60"
                value={orgContactEmail}
                onChange={(e) => setOrgContactEmail(e.target.value)}
                disabled={!canEditOrg || isSaving}
                inputMode="email"
                autoComplete="email"
                maxLength={200}
              />
            </label>
            <label className="grid gap-2 text-sm font-medium text-white/90">
              CUIT <span className="font-normal text-white/45">(opcional)</span>
              <input
                className="input-design min-h-[48px] disabled:cursor-not-allowed disabled:opacity-60"
                value={orgCuit}
                onChange={(e) => setOrgCuit(e.target.value)}
                disabled={!canEditOrg || isSaving}
                placeholder="XX-XXXXXXXX-X"
                maxLength={20}
              />
            </label>
          </div>
        </div>

        <div className="mt-8 border-t border-white/10 pt-8">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-white/45">Tu sesión y teléfono</h2>
          <div className="mt-4 rounded-xl border border-white/10 bg-black/25 px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-white/40">Email de acceso (login)</p>
            <p className="mt-1 break-all text-sm font-medium text-white/90">{userEmail || "—"}</p>
            <p className="mt-2 text-xs text-white/45">
              Para cambiar el email de inicio de sesión, escribinos por soporte.
            </p>
          </div>

          <label className="mt-4 grid gap-2 text-sm font-medium text-white/90">
            Tu teléfono (contacto operativo)
            <input
              className="input-design min-h-[48px]"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              disabled={isSaving}
              inputMode="tel"
              autoComplete="tel"
              placeholder="+54 9 11 …"
              maxLength={40}
            />
            <span className="text-xs font-normal text-white/45">Lo usamos para comunicarnos con vos si hace falta.</span>
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
          <p className="mt-1 text-sm text-white/55">Cerrá sesión en este dispositivo.</p>
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
