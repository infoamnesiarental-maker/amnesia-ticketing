"use client";

import { useState, useTransition } from "react";

import { deleteMpAccessToken, saveMpAccessToken } from "./actions";

interface MpTokenFormProps {
  configured: boolean;
}

export function MpTokenForm({ configured }: MpTokenFormProps) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [okMessage, setOkMessage] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setOkMessage(null);
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const res = await saveMpAccessToken(fd);
      if ("error" in res) {
        setError(res.error);
        return;
      }
      setOkMessage("Token guardado.");
      (e.target as HTMLFormElement).reset();
    });
  }

  function handleDelete() {
    setError(null);
    setOkMessage(null);
    if (!window.confirm("¿Eliminar el token de Mercado Pago de la productora?")) return;
    startTransition(async () => {
      const res = await deleteMpAccessToken();
      if ("error" in res) {
        setError(res.error);
        return;
      }
      setOkMessage("Token eliminado.");
    });
  }

  return (
    <form onSubmit={handleSubmit} className="surface-glass space-y-4 p-5">
      <label className="grid gap-2 text-sm text-white/90">
        Access token (Mercado Pago)
        <input
          name="access_token"
          type="password"
          autoComplete="off"
          required
          minLength={30}
          placeholder="APP_USR-XXXXXXXX..."
          className="input-design font-mono"
          disabled={pending}
        />
        <span className="text-xs text-white/45">
          El token nunca se muestra después de guardarlo. Para cambiarlo, pegá uno nuevo.
        </span>
      </label>

      {error ? (
        <div className="rounded-xl border border-red-400/40 bg-red-500/10 px-3 py-2 text-sm text-red-200">{error}</div>
      ) : null}
      {okMessage ? (
        <div className="rounded-xl border border-emerald-400/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200">
          {okMessage}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <button type="submit" className="btn-cta-primary" disabled={pending}>
          {pending ? "Guardando…" : configured ? "Reemplazar token" : "Guardar token"}
        </button>
        {configured ? (
          <button
            type="button"
            onClick={handleDelete}
            className="rounded-full border border-red-400/40 px-4 py-2 text-sm text-red-200 transition hover:bg-red-500/10 disabled:opacity-50"
            disabled={pending}
          >
            Eliminar token
          </button>
        ) : null}
      </div>
    </form>
  );
}
