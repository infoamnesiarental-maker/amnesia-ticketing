import { notFound, redirect } from "next/navigation";

import { createSupabaseServiceRoleClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ orgSlug: string; eventSlug: string }>;
  searchParams: Promise<{ q?: string }>;
}

export default async function InvitadosPage({ params, searchParams }: PageProps) {
  const { orgSlug, eventSlug } = await params;
  await searchParams;
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/auth?redirect=/e/${encodeURIComponent(orgSlug)}/${encodeURIComponent(eventSlug)}/invitados`);

  const admin = createSupabaseServiceRoleClient();

  if (!admin) {
    notFound();
  }

  const { data: eventRow } = await admin
    .from("events")
    .select("id, name, slug, place, starts_at, organization_id, organizations!inner(name, slug, status)")
    .eq("slug", eventSlug)
    .maybeSingle();

  const ev = eventRow as unknown as
    | {
        id: string;
        name: string;
        slug: string;
        place: string | null;
        starts_at: string | null;
        organization_id: string;
        organizations: { name: string; slug: string; status: string } | { name: string; slug: string; status: string }[] | null;
      }
    | null;

  const org = ev ? (Array.isArray(ev.organizations) ? ev.organizations[0] : ev.organizations) : null;
  if (!ev || !org || org.slug !== orgSlug || org.status !== "approved") notFound();

  const { data: mem } = await supabase
    .from("org_members")
    .select("organization_id")
    .eq("user_id", user.id)
    .eq("organization_id", ev.organization_id)
    .maybeSingle();

  if (!mem?.organization_id) notFound();

  redirect(`/app/eventos/${ev.id}/invitados`);
}
