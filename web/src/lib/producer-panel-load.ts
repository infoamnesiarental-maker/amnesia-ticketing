import type { User } from "@supabase/supabase-js";

import { isSuperAdminUser } from "@/lib/is-super-admin";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export interface ProducerPanelContext {
  user: User;
  orgId: string;
  orgName: string;
  accountStatus: string;
}

export type LoadProducerPanelResult =
  | { ok: true; ctx: ProducerPanelContext }
  | { ok: false; redirect: string };

/**
 * Datos de sesión + organización para el panel productora (sin gate de aprobación).
 * Super admins se redirigen a /admin.
 */
export async function loadProducerPanel(): Promise<LoadProducerPanelResult> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, redirect: "/auth?redirect=/app" };

  const { count } = await supabase
    .from("org_members")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user.id);

  if (!count) return { ok: false, redirect: "/app/onboarding" };

  const { data: membership } = await supabase
    .from("org_members")
    .select("organization_id")
    .eq("user_id", user.id)
    .maybeSingle();

  const orgId = membership?.organization_id as string | undefined;
  if (!orgId) return { ok: false, redirect: "/app/onboarding" };

  const { data: org } = await supabase.from("organizations").select("status, name").eq("id", orgId).maybeSingle();
  const accountStatus = (org?.status as string | undefined) ?? "pending";

  const admin = createSupabaseServiceRoleClient();
  if (admin) {
    await admin.from("org_access_requests").upsert({
      organization_id: orgId,
      user_id: user.id,
      last_seen_at: new Date().toISOString(),
    });
  }

  const showAdmin = await isSuperAdminUser({ supabase, email: user.email });
  if (showAdmin) return { ok: false, redirect: "/admin" };

  const orgName = (org?.name as string | undefined) ?? "Tu productora";

  return {
    ok: true,
    ctx: { user, orgId, orgName, accountStatus },
  };
}
