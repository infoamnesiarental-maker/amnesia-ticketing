/** Lista en env: SUPERADMIN_EMAILS=uno@x.com,dos@y.com (solo servidor / build). */
export function isSuperAdminEmail(email: string | undefined | null): boolean {
  const raw = process.env.SUPERADMIN_EMAILS ?? "";
  if (!email?.trim() || !raw.trim()) return false;
  const e = email.trim().toLowerCase();
  return raw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
    .includes(e);
}

export async function isSuperAdminUser(opts: {
  supabase: { rpc: (fn: string, args?: Record<string, unknown>) => unknown };
  email: string | undefined | null;
}): Promise<boolean> {
  if (isSuperAdminEmail(opts.email)) return true;
  const res = await opts.supabase.rpc("is_super_admin");
  const { data, error } =
    (res as { data: unknown; error: { message: string } | null }) ?? ({ data: null, error: null } as const);
  if (error) return false;
  return Boolean(data);
}
