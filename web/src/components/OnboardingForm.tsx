"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { bootstrapOrganization } from "@/app/app/actions";

export function OnboardingForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    setError(null);
    startTransition(async () => {
      const res = await bootstrapOrganization(formData);
      if ("error" in res) {
        setError(res.error);
        return;
      }
      router.push("/app");
      router.refresh();
    });
  }

  return (
    <form onSubmit={onSubmit} className="surface-glass mt-8 grid gap-4 p-6">
      {error ? (
        <div className="rounded-xl border border-red-400/40 bg-red-500/10 px-3 py-2 text-sm text-red-200">{error}</div>
      ) : null}
      <label className="grid gap-2 text-sm text-white/90">
        Nombre de la productora
        <input className="input-design" name="name" required placeholder="Ej: Amnesia Producciones" disabled={pending} />
      </label>
      <label className="grid gap-2 text-sm text-white/90">
        Slug (opcional)
        <input className="input-design" name="slug" placeholder="ej: amnesia" disabled={pending} />
      </label>
      <button className="btn-cta-primary mt-2 w-full justify-center" type="submit" disabled={pending}>
        {pending ? "Creando…" : "Crear y continuar"}
      </button>
    </form>
  );
}
