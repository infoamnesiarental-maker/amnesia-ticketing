import Link from "next/link";

import { SiteHeader } from "@/components/SiteHeader";

export default function DemoTicketeraPage() {
  return (
    <div className="min-h-screen bg-[#0A0A0A]">
      <SiteHeader variant="solid" />
      <main className="section-padding-x max-w-content mx-auto flex flex-col gap-8 pb-24 pt-32">
        <p className="text-sm font-semibold text-brand">Ticketera pública</p>
        <h1 className="text-heading-secondary">URL del evento</h1>
        <p className="max-w-xl text-base font-normal leading-relaxed text-white/80">
          Cada evento tiene una página de compra en{" "}
          <code className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-sm text-white">/e/[orgSlug]/[eventSlug]</code>{" "}
          (slug de la productora + slug del evento). Desde el panel, en Eventos, usá el enlace &quot;Ticketera pública&quot; para
          abrirla en una pestaña nueva y compartirla.
        </p>
        <p className="max-w-xl text-sm text-white/55">
          Ejemplo ficticio: <span className="font-mono text-white/80">/e/mi-productora/festival-2026</span>
        </p>
        <Link href="/" className="btn-outline-light w-fit">
          ← Volver al inicio
        </Link>
      </main>
    </div>
  );
}
