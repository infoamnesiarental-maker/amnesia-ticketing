import { createSupabaseServiceRoleClient } from "@/lib/supabase/admin";

export default async function AdminEventosPage() {
  const admin = createSupabaseServiceRoleClient();
  if (!admin) {
    return (
      <div className="rounded-xl border border-amber-400/30 bg-amber-500/10 p-6 text-sm text-amber-50">
        Para ver eventos globales, agregá <code className="text-white">SUPABASE_SERVICE_ROLE_KEY</code> en{" "}
        <code className="text-white">web/.env.local</code> y reiniciá.
      </div>
    );
  }

  const { data: events, error } = await admin
    .from("events")
    .select("id, name, slug, created_at, organizations(name, slug, status)")
    .order("created_at", { ascending: false })
    .limit(80);

  if (error) {
    return (
      <div className="rounded-xl border border-red-400/40 bg-red-500/10 p-4 text-sm text-red-100">
        Error al leer eventos: {error.message}
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-4xl md:mx-0">
      <div className="text-center md:text-left">
        <h1 className="text-2xl font-bold text-white">Eventos</h1>
        <p className="mt-2 text-sm text-white/65">Vista global (service role), agrupado por productora.</p>
      </div>

      <ul className="mt-8 space-y-2">
        {(events ?? []).length === 0 ? (
          <li className="text-sm text-white/55">No hay eventos todavía.</li>
        ) : (
          (events ?? []).map((e) => {
            const org = (e as unknown as { organizations: { name: string; slug: string; status: string } | { name: string; slug: string; status: string }[] | null })
              .organizations;
            const o = Array.isArray(org) ? org[0] ?? null : org;
            return (
              <li
                key={String((e as { id: string }).id)}
                className="surface-glass flex flex-col items-center gap-1 p-4 text-center sm:flex-row sm:items-center sm:justify-between sm:text-left"
              >
                <div className="min-w-0">
                  <p className="font-medium text-white">{String((e as { name: string }).name)}</p>
                  <p className="text-xs text-white/55">
                    <span className="font-mono">{String((e as { slug: string }).slug)}</span>
                    {o ? (
                      <span>
                        {" "}
                        · <span className="text-white/70">{o.name}</span> (<span className="font-mono">{o.slug}</span>) ·{" "}
                        <span className="text-brand">{o.status}</span>
                      </span>
                    ) : null}
                  </p>
                </div>
                <p className="text-xs text-white/45">{String((e as { created_at: string }).created_at)}</p>
              </li>
            );
          })
        )}
      </ul>
    </div>
  );
}

