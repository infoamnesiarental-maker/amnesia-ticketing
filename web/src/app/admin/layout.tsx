import Image from "next/image";
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
      <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-white/10 bg-[#0a0a0a]/90 px-4 py-3 backdrop-blur-md md:hidden">
        <div className="flex min-w-0 items-center gap-2">
          <div className="relative h-9 w-9 shrink-0 overflow-hidden rounded-lg bg-black/40 ring-1 ring-white/10">
            <Image src="/logoAmnesia.png" alt="" fill sizes="36px" className="object-contain p-1" />
          </div>
          <p className="truncate text-sm font-semibold text-white">Administración</p>
        </div>
        <Link
          href="/admin/perfil"
          className="flex h-11 min-w-[44px] shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.06] px-3 text-sm font-semibold text-white/90 transition hover:border-brand/40 hover:bg-brand/10 hover:text-brand"
        >
          Perfil
        </Link>
      </header>

      <div className="section-padding-x mx-auto flex max-w-content flex-col gap-6 py-6 md:flex-row md:items-start md:py-8">
        <aside className="w-full shrink-0 md:w-64">
          <AdminSidebar />
        </aside>

        <main className="min-w-0 w-full flex-1 pb-4 md:pb-0">{children}</main>
      </div>
    </div>
  );
}
