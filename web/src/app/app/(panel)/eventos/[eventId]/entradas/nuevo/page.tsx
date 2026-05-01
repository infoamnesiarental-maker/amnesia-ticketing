import { notFound, redirect } from "next/navigation";

import { TicketTypeForm } from "@/components/TicketTypeForm";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function NuevaEntradaPage({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth");

  const { data: event, error } = await supabase.from("events").select("id, name").eq("id", eventId).maybeSingle();

  if (error || !event) notFound();

  const backHref = `/app/eventos/${eventId}/entradas`;

  return (
    <TicketTypeForm
      mode="create"
      eventId={eventId}
      backHref={backHref}
      title={`Nuevo tipo · ${String(event.name)}`}
    />
  );
}
