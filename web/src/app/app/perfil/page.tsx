import { redirect } from "next/navigation";

import { ProducerProfilePanel } from "@/components/account/ProducerProfilePanel";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function ProducerPerfilPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth?redirect=/app/perfil");

  const { data: membership, error: memErr } = await supabase
    .from("org_members")
    .select("organization_id, role")
    .eq("user_id", user.id)
    .maybeSingle();

  if (memErr || !membership?.organization_id) redirect("/app/onboarding");

  const orgId = membership.organization_id as string;
  const role = String(membership.role ?? "");
  const canEditOrg = role === "owner" || role === "admin";

  const { data: org, error: orgErr } = await supabase
    .from("organizations")
    .select("name, slug, contact_email, cuit, status")
    .eq("id", orgId)
    .maybeSingle();

  if (orgErr || !org) {
    redirect("/app/onboarding");
  }

  const m = user.user_metadata ?? {};
  const phone = typeof m.phone === "string" ? m.phone : "";

  return (
    <ProducerProfilePanel
      userEmail={user.email ?? ""}
      initialPhone={phone}
      org={{
        name: String(org.name),
        slug: String(org.slug),
        contact_email: String(org.contact_email),
        cuit: org.cuit != null ? String(org.cuit) : null,
        status: String(org.status),
      }}
      canEditOrg={canEditOrg}
      backHref="/app"
      backLabel="Volver al inicio"
    />
  );
}
