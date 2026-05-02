import { redirect } from "next/navigation";

import { AccountProfilePanel } from "@/components/account/AccountProfilePanel";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function metaString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

export default async function AdminPerfilPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth?redirect=/admin/perfil");

  const m = user.user_metadata ?? {};

  return (
    <AccountProfilePanel
      email={user.email ?? ""}
      initialFullName={metaString(m.full_name)}
      initialPhone={metaString(m.phone)}
      initialHeadline={metaString(m.headline)}
      backHref="/admin"
      backLabel="Volver al resumen"
      title="Perfil de administrador"
      subtitle="Datos personales opcionales y cierre de sesión. Los permisos de super admin no se modifican desde esta pantalla."
    />
  );
}
