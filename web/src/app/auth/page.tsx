"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";

import { SiteHeader } from "@/components/SiteHeader";
import { getAuthErrorMessage } from "@/lib/auth-errors";
import { isSupabaseBrowserConfigured } from "@/lib/env";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export default function AuthPage() {
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirect") || "/app";
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string>("");
  const [ok, setOk] = useState<string>("");

  async function handleForgotPassword() {
    setError("");
    setOk("");
    if (!email.trim()) {
      setError("Escribí tu email arriba y tocá de nuevo “¿Olvidaste la contraseña?”.");
      return;
    }
    if (!isSupabaseBrowserConfigured()) {
      setError(
        "Supabase no está configurado en esta app. Creá el archivo web/.env.local con NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_ANON_KEY, guardá y reiniciá npm run dev.",
      );
      return;
    }
    setIsLoading(true);
    try {
      const redirectTo = `${window.location.origin}/auth`;
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo });
      if (error) {
        setError(getAuthErrorMessage(error));
        return;
      }
      setOk("Te enviamos un mail para restablecer la contraseña (si el email existe en el sistema).");
    } catch (e) {
      setError(getAuthErrorMessage(e));
    } finally {
      setIsLoading(false);
    }
  }

  async function handleSubmit() {
    setError("");
    setOk("");
    setIsLoading(true);
    try {
      if (!email.trim() || !password) {
        setError("Completá email y contraseña.");
        return;
      }

      if (!isSupabaseBrowserConfigured()) {
        setError(
          "Supabase no está configurado en esta app. Creá el archivo web/.env.local con NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_ANON_KEY (no uses solo la raíz del repo), guardá y reiniciá npm run dev.",
        );
        return;
      }

      if (mode === "register") {
        const { data, error } = await supabase.auth.signUp({ email: email.trim(), password });
        if (error) {
          setError(getAuthErrorMessage(error));
          return;
        }
        if (data.session) {
          window.location.href = redirectTo;
          return;
        }
        setOk("Cuenta creada. Si Supabase pide confirmar email, revisá tu bandeja; después podés iniciar sesión.");
        return;
      }

      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (error) {
        setError(getAuthErrorMessage(error));
        return;
      }
      window.location.href = redirectTo;
    } catch (e) {
      setError(getAuthErrorMessage(e));
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="relative min-h-screen bg-[#0A0A0A]">
      <div
        className="pointer-events-none absolute inset-0 opacity-40"
        style={{ background: "var(--gradient-hero-alt)" }}
        aria-hidden
      />
      <SiteHeader variant="solid" minimal />

      <div className="section-padding-x relative z-10 mx-auto flex min-h-screen max-w-md flex-col justify-center px-0 py-24">
        <Link
          className="mb-8 inline-flex text-sm text-white/70 transition-opacity duration-200 hover:opacity-100"
          href="/"
        >
          ← Volver
        </Link>

        <div className="surface-glass p-8 shadow-[var(--shadow-soft)]">
          <div className="text-center">
            <h1 className="text-xl font-semibold text-white">{mode === "login" ? "Iniciar sesión" : "Crear cuenta"}</h1>
          </div>

          <div className="mt-6 grid gap-4">
            <label className="grid gap-2 text-sm font-medium text-white/90">
              Email
              <input
                className="input-design"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                inputMode="email"
                autoComplete="email"
                placeholder="org@productora.com"
              />
            </label>
            <label className="grid gap-2 text-sm font-medium text-white/90">
              Contraseña
              <input
                className="input-design"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                type="password"
                autoComplete={mode === "login" ? "current-password" : "new-password"}
                placeholder="••••••••"
              />
            </label>

            {error ? (
              <div
                className="rounded-xl border border-red-400/40 px-3 py-2 text-sm text-red-200"
                style={{ background: "rgba(248, 113, 113, 0.12)" }}
              >
                {error}
              </div>
            ) : null}
            {ok ? (
              <div className="rounded-xl border border-emerald-400/35 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-100">
                {ok}
              </div>
            ) : null}

            <button
              className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-full bg-[var(--brand-orange)] px-4 py-3 text-sm font-semibold text-white shadow-[var(--shadow-button-hover)] transition hover:bg-[var(--brand-orange-intense)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--brand-orange)] disabled:cursor-not-allowed disabled:opacity-60"
              onClick={handleSubmit}
              disabled={isLoading}
              type="button"
            >
              {isLoading ? "Cargando..." : mode === "login" ? "Iniciar sesión" : "Crear cuenta"}
            </button>

            <button
              className="mt-2 w-full rounded-full border-2 border-[var(--brand-orange)] bg-zinc-800/85 px-4 py-3 text-sm font-semibold text-white/95 transition-colors duration-300 hover:bg-zinc-700/90 disabled:opacity-60"
              onClick={() => setMode((m) => (m === "login" ? "register" : "login"))}
              type="button"
              disabled={isLoading}
            >
              {mode === "login" ? "Registrarse" : "Iniciar sesión"}
            </button>
          </div>

          {mode === "login" ? (
            <button
              type="button"
              className="mt-5 w-full text-center text-sm font-semibold text-white/80 underline decoration-white/20 underline-offset-4 hover:text-white hover:decoration-white/40 disabled:opacity-60"
              onClick={handleForgotPassword}
              disabled={isLoading}
            >
              ¿Olvidaste la contraseña?
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
