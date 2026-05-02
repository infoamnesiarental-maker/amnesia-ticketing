"use client";

import { useState } from "react";

import { getAuthErrorMessage } from "@/lib/auth-errors";
import { isSupabaseBrowserConfigured } from "@/lib/env";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export function SignOutButton({ className = "" }: { className?: string }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function handleSignOut() {
    setError("");
    if (!isSupabaseBrowserConfigured()) {
      setError("No se pudo cerrar sesión.");
      return;
    }
    setPending(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const { error: outError } = await supabase.auth.signOut();
      if (outError) {
        setError(getAuthErrorMessage(outError));
        setPending(false);
        return;
      }
      window.location.href = "/auth";
    } catch (e) {
      setError(getAuthErrorMessage(e));
      setPending(false);
    }
  }

  return (
    <div className="w-full sm:w-auto">
      <button
        type="button"
        onClick={handleSignOut}
        disabled={pending}
        className={`flex min-h-[48px] w-full items-center justify-center rounded-xl border border-white/15 bg-white/[0.04] px-5 py-3 text-sm font-semibold text-white/90 transition hover:border-white/25 hover:bg-white/[0.08] disabled:opacity-55 sm:min-w-[10.5rem] ${className}`}
      >
        {pending ? "Cerrando…" : "Cerrar sesión"}
      </button>
      {error ? <p className="mt-2 text-center text-xs text-red-300">{error}</p> : null}
    </div>
  );
}
