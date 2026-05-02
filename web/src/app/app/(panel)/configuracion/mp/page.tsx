import Link from "next/link";
import { redirect } from "next/navigation";

import { createSupabaseServiceRoleClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

import { MpTokenForm } from "./MpTokenForm";

export const dynamic = "force-dynamic";

export default async function MpConfiguracionPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth");

  const { data: membership } = await supabase
    .from("org_members")
    .select("organization_id, role")
    .eq("user_id", user.id)
    .in("role", ["owner", "admin"])
    .limit(1)
    .maybeSingle();

  if (!membership?.organization_id) redirect("/app");

  const orgId = membership.organization_id as string;

  let configured = false;
  let updatedAt: string | null = null;
  let error: string | null = null;

  const admin = createSupabaseServiceRoleClient();
  if (admin) {
    const { data, error: credErr } = await admin
      .from("mp_credentials")
      .select("organization_id, updated_at")
      .eq("organization_id", orgId)
      .maybeSingle();

    if (credErr) {
      if (/relation .*mp_credentials.* does not exist|undefined_table/i.test(credErr.message)) {
        error =
          "Falta la tabla mp_credentials. Ejecutá supabase/mp-credentials.sql en el SQL Editor de Supabase.";
      } else {
        error = credErr.message;
      }
    } else if (data?.organization_id) {
      configured = true;
      updatedAt = (data as { updated_at: string | null }).updated_at;
    }
  } else {
    error = "Falta SUPABASE_SERVICE_ROLE_KEY en el servidor.";
  }

  return (
    <div className="mx-auto w-full max-w-2xl text-center md:mx-0 md:text-left">
      <div className="flex flex-wrap items-center justify-center gap-3 text-xs text-white/55 md:justify-start">
        <Link href="/app" className="hover:text-white">
          Panel
        </Link>
        <span>/</span>
        <span>Configuración Mercado Pago</span>
      </div>

      <h1 className="mt-3 text-2xl font-bold text-white">Mercado Pago</h1>
      <p className="mt-2 text-sm text-white/65">
        Cargá el <strong>access token</strong> de Mercado Pago de tu productora. Se usa server-side
        para validar pagos automáticamente. <strong>Nunca</strong> se expone al cliente.
      </p>

      {error ? (
        <div className="mt-6 rounded-xl border border-red-400/40 bg-red-500/10 p-4 text-sm text-red-200">
          {error}
        </div>
      ) : null}

      <section className="mt-8">
        <div className="surface-glass p-5">
          <p className="text-sm font-medium text-white">
            Estado: {configured ? "Configurado" : "No configurado"}
          </p>
          {configured && updatedAt ? (
            <p className="mt-1 text-xs text-white/55">
              Actualizado: {new Date(updatedAt).toLocaleString("es-AR")}
            </p>
          ) : null}
        </div>
      </section>

      <section className="mt-6">
        <MpTokenForm configured={configured} />
      </section>

      <section className="mt-10 surface-glass p-5 text-xs text-white/55">
        <p className="font-medium text-white/80">¿Dónde consigo el access token?</p>
        <ol className="mt-2 list-decimal space-y-1 pl-4">
          <li>Entrá a tu cuenta de Mercado Pago.</li>
          <li>
            Sección <em>Tu negocio → Configuraciones → Credenciales</em> (varía según país/cuenta).
          </li>
          <li>Copiá el <strong>Access Token</strong> de producción.</li>
        </ol>
        <p className="mt-3">El token se guarda solo en tu base de Supabase (server-side, RLS estricto).</p>
      </section>
    </div>
  );
}
