"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

import { deleteTicketType } from "@/app/app/actions";

export function DeleteTicketTypeButton({
  eventId,
  ticketTypeId,
  label,
}: {
  eventId: string;
  ticketTypeId: string;
  label: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function handleClick() {
    const ok = window.confirm(
      `¿Eliminar el tipo "${label}"? Si ya hay órdenes asociadas, vas a tener que desactivar la venta en lugar de borrar.`,
    );
    if (!ok) return;
    startTransition(async () => {
      const fd = new FormData();
      fd.set("event_id", eventId);
      fd.set("ticket_type_id", ticketTypeId);
      const res = await deleteTicketType(fd);
      if ("error" in res) {
        window.alert(res.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={pending}
      className="rounded-lg border border-red-400/40 px-3 py-1.5 text-xs text-red-200 hover:bg-red-500/10 disabled:opacity-50"
    >
      {pending ? "…" : "Eliminar"}
    </button>
  );
}
