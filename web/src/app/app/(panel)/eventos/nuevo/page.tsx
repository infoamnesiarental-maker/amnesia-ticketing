import Link from "next/link";

import { CreateEventForm } from "@/components/CreateEventForm";

export default function NuevoEventoPage() {
  return (
    <div className="flex flex-col items-center px-0 pb-12">
      <div className="w-full max-w-lg text-center">
        <Link href="/app/eventos" className="inline-block text-sm text-white/60 hover:text-white">
          ← Eventos
        </Link>
        <h1 className="mt-4 text-2xl font-bold text-white md:text-3xl">Nuevo evento</h1>
        <p className="mx-auto mt-3 max-w-md text-sm text-white/65">
          Tres pasos: datos del evento, cobro (Mercado Pago) y tu primera entrada a la venta.
        </p>
      </div>
      <CreateEventForm />
    </div>
  );
}
