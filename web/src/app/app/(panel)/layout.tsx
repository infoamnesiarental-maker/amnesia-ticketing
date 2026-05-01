import { redirect } from "next/navigation";

import { AppPanelShell } from "@/components/AppPanelShell";
import { isSuperAdminUser } from "@/lib/is-super-admin";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth?redirect=/app");

  const { count } = await supabase
    .from("org_members")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user.id);

  if (!count) {
    redirect("/app/onboarding");
  }

  const { data: membership } = await supabase
    .from("org_members")
    .select("organization_id")
    .eq("user_id", user.id)
    .maybeSingle();

  const orgId = membership?.organization_id as string | undefined;
  if (!orgId) redirect("/app/onboarding");

  const { data: org } = await supabase.from("organizations").select("status, name").eq("id", orgId).maybeSingle();
  const status = (org?.status as string | undefined) ?? "pending";

  // Registrar “se logueó / pidió alta” para que lo vea admin
  const admin = createSupabaseServiceRoleClient();
  if (admin) {
    await admin.from("org_access_requests").upsert({
      organization_id: orgId,
      user_id: user.id,
      last_seen_at: new Date().toISOString(),
    });
  }

  const showAdmin = await isSuperAdminUser({ supabase, email: user.email });
  if (showAdmin) {
    redirect("/admin");
  }

  const roleLabel = status === "approved" ? "Organizador" : "Organizador · Pendiente";
  return (
    <AppPanelShell showAdminLink={showAdmin} roleLabel={roleLabel}>
      {status === "approved" || showAdmin ? (
        children
      ) : (
        <div className="surface-glass mx-auto max-w-xl p-8 text-center">
          <p className="text-sm font-semibold text-brand">¡Bienvenido!</p>
          <h1 className="mt-2 text-xl font-bold text-white">Tu productora está en revisión</h1>
          <p className="mt-3 text-sm text-white/75">
            Ya recibimos tu registro. Un administrador tiene que aprobar tu cuenta para habilitar la creación de eventos y tipos de entrada.
          </p>
          <a
            className="btn-cta-primary mx-auto mt-6 inline-flex w-fit justify-center"
            href={`https://wa.me/5491139531218?text=${encodeURIComponent(
              `Hola! Ya me registré en AmnesiaTicketing. Mi email es ${user.email ?? "—"}. ¿Me aprobás la productora? Gracias!`,
            )}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            Avisar por WhatsApp (+54 911 3953 1218)
          </a>
          <p className="mt-5 text-xs text-white/50">
            Estado actual: <span className="font-mono text-white/70">{status}</span>
          </p>
        </div>
      )}
    </AppPanelShell>
  );
}
