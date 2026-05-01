import Link from "next/link";
import { redirect } from "next/navigation";

import { OnboardingForm } from "@/components/OnboardingForm";
import { SiteHeader } from "@/components/SiteHeader";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function OnboardingPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth");

  const { count } = await supabase
    .from("org_members")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user.id);

  if (count && count > 0) redirect("/app");

  return (
    <div className="min-h-screen bg-[#0A0A0A]">
      <SiteHeader variant="solid" />
      <main className="section-padding-x mx-auto max-w-lg pb-20 pt-28">
        <p className="text-sm font-semibold text-brand">Primer paso</p>
        <h1 className="mt-2 text-2xl font-bold text-white">Creá tu productora</h1>
        <p className="mt-2 text-sm text-white/70">
          Así podés crear eventos y usar el panel. El slug se usa en URLs (solo letras, números y guiones).
        </p>

        <OnboardingForm />

        <p className="mt-6 text-center text-xs text-white/50">
          <Link href="/" className="underline hover:text-white">
            Volver al inicio
          </Link>
        </p>
      </main>
    </div>
  );
}
