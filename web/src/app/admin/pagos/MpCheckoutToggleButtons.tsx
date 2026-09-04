"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { toggleMpCheckout } from "./actions";

export function MpCheckoutToggleButtons({
  enabled,
  canEnable,
}: {
  enabled: boolean;
  canEnable: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function submit(nextEnabled: boolean) {
    setError(null);
    const fd = new FormData();
    fd.set("enabled", nextEnabled ? "1" : "0");
    startTransition(async () => {
      const res = await toggleMpCheckout(fd);
      if ("error" in res) {
        setError(res.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-3">
        {enabled ? (
          <button
            type="button"
            disabled={pending}
            onClick={() => submit(false)}
            className="rounded-xl border border-white/20 bg-white/5 px-5 py-3 text-sm font-semibold text-white hover:bg-white/10 disabled:opacity-50"
          >
            {pending ? "Guardando…" : "Desactivar pasarela"}
          </button>
        ) : (
          <button
            type="button"
            disabled={pending || !canEnable}
            onClick={() => submit(true)}
            className="rounded-xl border border-emerald-400/40 bg-emerald-500/15 px-5 py-3 text-sm font-semibold text-emerald-50 hover:bg-emerald-500/25 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {pending ? "Guardando…" : "Activar Checkout Pro"}
          </button>
        )}
      </div>
      {error ? (
        <div className="rounded-xl border border-red-400/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">{error}</div>
      ) : null}
    </div>
  );
}
