/** Mensaje legible desde errores de Supabase Auth u otros `unknown`. */
export function getAuthErrorMessage(err: unknown): string {
  if (err && typeof err === "object") {
    const o = err as Record<string, unknown>;
    if (typeof o.message === "string" && o.message.trim()) return o.message.trim();
    if (typeof o.msg === "string" && o.msg.trim()) return o.msg.trim();
    if (typeof o.error_description === "string") return o.error_description;
  }
  if (err instanceof Error) return err.message;
  return "Error desconocido. Revisá la consola del navegador (F12).";
}
