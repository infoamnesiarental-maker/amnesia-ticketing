import Link from "next/link";
import { redirect } from "next/navigation";

import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function EventosPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth");

  const { data: memberships } = await supabase
    .from("org_members")
    .select("organization_id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  if (!memberships?.organization_id) redirect("/app/onboarding");

  const orgId = memberships.organization_id as string;

  const [{ data: events, error }, { data: orgRow }] = await Promise.all([
    supabase
      .from("events")
      .select("id, name, slug, place, starts_at, mp_alias, created_at")
      .eq("organization_id", orgId)
      .order("created_at", { ascending: false }),
    supabase.from("organizations").select("slug").eq("id", orgId).maybeSingle(),
  ]);

  const orgSlug = (orgRow?.slug as string | undefined) ?? "";

  if (error) {
    return (
      <div className="mx-auto max-w-2xl rounded-xl border border-red-400/40 bg-red-500/10 p-4 text-center text-sm text-red-200 md:text-left">
        No se pudieron cargar eventos. ¿Ejecutaste <code className="text-white">supabase/policies-mvp.sql</code> y{" "}
        <code className="text-white">schema.sql</code>? {error.message}
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-4xl md:max-w-none">
      <div className="flex flex-col items-center gap-4 text-center sm:flex-row sm:items-center sm:justify-between sm:text-left">
        <h1 className="text-2xl font-bold text-white">Eventos</h1>
        <Link href="/app/eventos/nuevo" className="btn-cta-primary w-full justify-center sm:w-fit">
          Nuevo evento
        </Link>
      </div>
      <ul className="mt-8 grid gap-3">
        {(events ?? []).length === 0 ? (
          <li className="surface-glass p-6 text-sm text-white/70">Todavía no hay eventos. Creá el primero.</li>
        ) : (
          (events ?? []).map((e) => (
            <li
              key={e.id as string}
              className="surface-glass flex flex-col items-center gap-3 p-4 text-center sm:flex-row sm:items-center sm:justify-between sm:text-left"
            >
              <div className="min-w-0 sm:flex-1">
                <p className="font-semibold text-white">{e.name as string}</p>
                <p className="text-xs text-white/55">
                  slug: <span className="font-mono">{e.slug as string}</span>
                  {e.place ? ` · ${e.place as string}` : ""}
                </p>
              </div>
              <div className="flex w-full flex-col items-center gap-2 sm:w-auto sm:items-end">
                <p className="text-xs text-white/50">MP: {(e.mp_alias as string) || "—"}</p>
                <div className="flex flex-wrap justify-center gap-2 sm:justify-end">
                  <Link
                    href={`/app/eventos/${String(e.id)}/editar`}
                    className="rounded-lg border border-white/20 px-3 py-1.5 text-xs text-white/90 hover:bg-white/5"
                  >
                    Datos y flair
                  </Link>
                  <Link
                    href={`/app/eventos/${String(e.id)}/entradas`}
                    className="rounded-lg border border-white/20 px-3 py-1.5 text-xs text-white/90 hover:bg-white/5"
                  >
                    Tipos de entrada
                  </Link>
                  <Link
                    href={`/app/eventos/${String(e.id)}/invitados`}
                    className="rounded-lg border border-emerald-400/30 bg-emerald-500/10 px-3 py-1.5 text-xs text-emerald-100 hover:bg-emerald-500/20"
                  >
                    Invitados
                  </Link>
                  {orgSlug ? (
                    <Link
                      href={`/e/${encodeURIComponent(orgSlug)}/${encodeURIComponent(String(e.slug))}`}
                      className="rounded-lg border border-brand/40 bg-brand/10 px-3 py-1.5 text-xs text-white hover:bg-brand/20"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Ticketera pública
                    </Link>
                  ) : null}
                </div>
              </div>
            </li>
          ))
        )}
      </ul>
    </div>
  );
}
