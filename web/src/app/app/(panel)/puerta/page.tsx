import { redirect } from "next/navigation";

import { createSupabaseServerClient } from "@/lib/supabase/server";

import { DoorScannerClient } from "./DoorScannerClient";

export default async function PuertaPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth?redirect=/app/puerta");

  const { data: membership } = await supabase
    .from("org_members")
    .select("organization_id, role")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!membership?.organization_id) redirect("/app/onboarding");

  const role = String(membership.role ?? "");
  if (role !== "owner" && role !== "admin" && role !== "door") {
    redirect("/app");
  }

  const { data: rows } = await supabase
    .from("events")
    .select("id, name, starts_at, place")
    .eq("organization_id", membership.organization_id as string)
    .order("starts_at", { ascending: false, nullsFirst: false })
    .limit(50);

  const events = (rows ?? []).map((r) => ({
    id: String(r.id),
    name: String(r.name),
    starts_at: (r.starts_at as string | null) ?? null,
    place: (r.place as string | null) ?? null,
  }));

  return <DoorScannerClient events={events} />;
}
