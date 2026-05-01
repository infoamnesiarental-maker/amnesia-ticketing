import { revalidatePath } from "next/cache";

import { createSupabaseServiceRoleClient } from "@/lib/supabase/admin";

type OrgStatus = "pending" | "approved" | "suspended" | "rejected";

async function setOrgStatus(formData: FormData) {
  "use server";
  const admin = createSupabaseServiceRoleClient();
  if (!admin) return;

  const orgId = String(formData.get("org_id") || "").trim();
  const status = String(formData.get("status") || "").trim() as OrgStatus;
  if (!orgId) return;
  if (!["pending", "approved", "suspended", "rejected"].includes(status)) return;

  const patch =
    status === "approved"
      ? { status, approved_at: new Date().toISOString() }
      : { status, approved_at: null };

  await admin.from("organizations").update(patch).eq("id", orgId);
  revalidatePath("/admin/productoras");
}

function StatusPill({ status }: { status: string }) {
  const s = status as OrgStatus;
  const cls =
    s === "approved"
      ? "bg-emerald-500/15 text-emerald-200 border-emerald-500/25"
      : s === "pending"
        ? "bg-amber-500/15 text-amber-200 border-amber-500/25"
        : s === "suspended"
          ? "bg-white/10 text-white/70 border-white/15"
          : "bg-red-500/10 text-red-200 border-red-400/25";
  return <span className={`rounded-full border px-2 py-0.5 text-xs ${cls}`}>{status}</span>;
}

export default async function AdminProductorasPage() {
  const admin = createSupabaseServiceRoleClient();

  if (!admin) {
    return (
      <div className="rounded-xl border border-amber-400/30 bg-amber-500/10 p-6 text-sm text-amber-50">
        Para listar todas las productoras desde Admin, agregá <code className="text-white">SUPABASE_SERVICE_ROLE_KEY</code>{" "}
        en <code className="text-white">web/.env.local</code> (solo servidor, nunca en el cliente) y reiniciá{" "}
        <code className="text-white">npm run dev</code>.
      </div>
    );
  }

  const [{ data: orgs, error }, { data: requests }] = await Promise.all([
    admin
      .from("organizations")
      .select("id, name, slug, status, contact_email, created_at")
      .order("created_at", { ascending: false }),
    admin
      .from("org_access_requests")
      .select("organization_id, last_seen_at")
      .order("last_seen_at", { ascending: false })
      .limit(200),
  ]);

  if (error) {
    return (
      <div className="rounded-xl border border-red-400/40 bg-red-500/10 p-4 text-sm text-red-100">
        Error al leer organizaciones: {error.message}
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-white">Productoras</h1>
      <p className="mt-2 text-sm text-white/65">
        Podés aprobar, rechazar o suspender. La ticketera pública solo funciona si está <span className="text-white">approved</span>.
      </p>
      <p className="mt-2 text-xs text-white/45">
        Actividad reciente: {String((requests ?? []).length)} login(s)/solicitud(es) registradas (tabla{" "}
        <code className="text-white">org_access_requests</code>).
      </p>
      <ul className="mt-8 space-y-2">
        {(orgs ?? []).length === 0 ? (
          <li className="text-sm text-white/55">No hay organizaciones todavía.</li>
        ) : (
          (orgs ?? []).map((o) => (
            <li key={o.id as string} className="surface-glass flex flex-wrap items-center justify-between gap-2 p-4">
              <div>
                <p className="font-medium text-white">{o.name as string}</p>
                <p className="text-xs text-white/55">
                  <span className="font-mono">{o.slug as string}</span> · {String(o.contact_email)} ·{" "}
                  <StatusPill status={String(o.status)} />
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <form action={setOrgStatus}>
                  <input type="hidden" name="org_id" value={String(o.id)} />
                  <input type="hidden" name="status" value="approved" />
                  <button
                    type="submit"
                    className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-xs text-emerald-100 hover:bg-emerald-500/15"
                  >
                    Aprobar
                  </button>
                </form>
                <form action={setOrgStatus}>
                  <input type="hidden" name="org_id" value={String(o.id)} />
                  <input type="hidden" name="status" value="rejected" />
                  <button
                    type="submit"
                    className="rounded-lg border border-red-400/30 bg-red-500/10 px-3 py-1.5 text-xs text-red-100 hover:bg-red-500/15"
                  >
                    Rechazar
                  </button>
                </form>
                <form action={setOrgStatus}>
                  <input type="hidden" name="org_id" value={String(o.id)} />
                  <input type="hidden" name="status" value="suspended" />
                  <button
                    type="submit"
                    className="rounded-lg border border-white/20 bg-white/5 px-3 py-1.5 text-xs text-white/80 hover:bg-white/10"
                  >
                    Suspender
                  </button>
                </form>
                <form action={setOrgStatus}>
                  <input type="hidden" name="org_id" value={String(o.id)} />
                  <input type="hidden" name="status" value="pending" />
                  <button
                    type="submit"
                    className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-xs text-amber-100 hover:bg-amber-500/15"
                  >
                    Volver a pendiente
                  </button>
                </form>
              </div>
            </li>
          ))
        )}
      </ul>
    </div>
  );
}

