import { revalidatePath } from "next/cache";

import { createSupabaseServiceRoleClient } from "@/lib/supabase/admin";

async function deleteUser(formData: FormData) {
  "use server";
  const admin = createSupabaseServiceRoleClient();
  if (!admin) return;
  const userId = String(formData.get("user_id") || "").trim();
  if (!userId) return;
  await admin.auth.admin.deleteUser(userId);
  revalidatePath("/admin/usuarios");
}

export default async function AdminUsuariosPage() {
  const admin = createSupabaseServiceRoleClient();
  if (!admin) {
    return (
      <div className="rounded-xl border border-amber-400/30 bg-amber-500/10 p-6 text-sm text-amber-50">
        Para gestionar usuarios, agregá <code className="text-white">SUPABASE_SERVICE_ROLE_KEY</code> en{" "}
        <code className="text-white">web/.env.local</code> y reiniciá.
      </div>
    );
  }

  const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 50 });

  if (error) {
    return (
      <div className="rounded-xl border border-red-400/40 bg-red-500/10 p-4 text-sm text-red-100">
        Error al listar usuarios: {error.message}
      </div>
    );
  }

  const users = data?.users ?? [];

  return (
    <div>
      <h1 className="text-2xl font-bold text-white">Usuarios</h1>
      <p className="mt-2 text-sm text-white/65">Alta/edición avanzada: siguiente. Por ahora: listar y eliminar.</p>

      <ul className="mt-8 space-y-2">
        {users.length === 0 ? (
          <li className="text-sm text-white/55">No hay usuarios.</li>
        ) : (
          users.map((u) => (
            <li
              key={u.id}
              className="surface-glass flex flex-wrap items-center justify-between gap-3 p-4"
            >
              <div className="min-w-0">
                <p className="font-medium text-white">{u.email ?? "—"}</p>
                <p className="mt-1 text-xs text-white/55">
                  <span className="font-mono">{u.id}</span>
                </p>
              </div>
              <form action={deleteUser}>
                <input type="hidden" name="user_id" value={u.id} />
                <button
                  type="submit"
                  className="rounded-lg border border-red-400/30 bg-red-500/10 px-3 py-1.5 text-xs text-red-100 hover:bg-red-500/15"
                >
                  Eliminar usuario
                </button>
              </form>
            </li>
          ))
        )}
      </ul>
    </div>
  );
}

