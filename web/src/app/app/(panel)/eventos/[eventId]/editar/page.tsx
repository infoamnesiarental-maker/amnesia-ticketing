import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { EventEditForm } from "@/components/EventEditForm";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function EditarEventoPage(props: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await props.params;
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth");

  const { data: memberships } = await supabase
    .from("org_members")
    .select("organization_id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  if (!memberships?.organization_id) redirect("/app/onboarding");

  const orgId = memberships.organization_id as string;

  const { data: event, error } = await supabase
    .from("events")
    .select("id, organization_id, name, slug, place, description, cover_image_url, catalog_flair, starts_at, promo_whatsapp")
    .eq("id", eventId)
    .maybeSingle();

  if (error || !event) notFound();
  if ((event.organization_id as string) !== orgId) notFound();

  return (
    <div className="flex flex-col items-center px-0 pb-12">
      <div className="w-full max-w-lg text-center">
        <Link href="/app/eventos" className="inline-block text-sm text-white/60 hover:text-white">
          ← Eventos
        </Link>
        <h1 className="mt-4 text-2xl font-bold text-white md:text-3xl">Editar evento</h1>
        <p className="mx-auto mt-3 max-w-md text-sm text-white/65">
          Paso 1: datos y tapa. Paso 2: revisá la vista previa y guardá.
        </p>
      </div>
      <EventEditForm
        eventId={eventId}
        initial={{
          name: String(event.name ?? ""),
          slug: String(event.slug ?? ""),
          place: event.place == null ? null : String(event.place),
          description: event.description == null ? null : String(event.description),
          cover_image_url: event.cover_image_url == null ? null : String(event.cover_image_url),
          catalog_flair:
            event.catalog_flair == null || String(event.catalog_flair).trim() === ""
              ? null
              : String(event.catalog_flair),
          starts_at: event.starts_at == null ? null : String(event.starts_at),
          promo_whatsapp:
            event.promo_whatsapp == null || String(event.promo_whatsapp).trim() === ""
              ? null
              : String(event.promo_whatsapp),
        }}
      />
    </div>
  );
}
