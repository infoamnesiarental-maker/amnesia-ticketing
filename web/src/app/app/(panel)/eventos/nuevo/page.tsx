import Link from "next/link";

import { CreateEventForm } from "@/components/CreateEventForm";

export default function NuevoEventoPage() {
  return (
    <div className="w-full max-w-xl pb-8">
      <Link href="/app/eventos" className="text-[13px] text-white/45 hover:text-white">
        ← Eventos
      </Link>
      <h1 className="mt-2 text-xl font-bold text-white">Nuevo evento</h1>
      <p className="mt-1 text-[13px] text-white/50">
        Tres pasos: datos del evento, cobro (Mercado Pago) y tu primera entrada a la venta.
      </p>
      <CreateEventForm />
    </div>
  );
}
