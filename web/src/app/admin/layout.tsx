import Link from "next/link";
import { redirect } from "next/navigation";

import { AdminSidebar } from "@/components/AdminSidebar";
import { isSuperAdminUser } from "@/lib/is-super-admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth?redirect=/admin");

  const allowed = await isSuperAdminUser({ supabase, email: user.email });
  if (!allowed) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#0A0A0A] px-6 text-center">
        <h1 className="text-xl font-semibold text-white">Sin acceso a Admin</h1>
        <p className="mt-3 max-w-md text-sm text-white/65">
          No tenés rol de super admin. Agregá tu email a <code className="text-white">SUPERADMIN_EMAILS</code> (en{" "}
          <code className="text-white">web/.env.local</code>) o insertá tu usuario en la tabla{" "}
          <code className="text-white">public.super_admins</code>.
        </p>
        <Link href="/app" className="btn-cta-primary mt-8">
          Ir al panel productora
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0A0A0A]">
      <div className="section-padding-x mx-auto flex max-w-content gap-6 py-8">
        <aside className="hidden w-64 shrink-0 md:block">
          <AdminSidebar />
        </aside>

        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}
