export const EVENT_TZ = "America/Argentina/Buenos_Aires";

/** Zona para mostrar/guardar `starts_at` del evento: misma hora civil que ves en Supabase (UTC). */
export const EVENT_CLOCK_TZ = "UTC";

function partValue(parts: Intl.DateTimeFormatPart[], type: Intl.DateTimeFormatPartTypes): string {
  return parts.find((p) => p.type === type)?.value ?? "";
}

/** Normaliza espacios raros (p. ej. U+202F) que difieren entre Node y el navegador. */
function normalizeSpaces(s: string): string {
  return s.replace(/\u202f|\u00a0/g, " ").replace(/\s+/g, " ").trim();
}

const eventStartsFormatter = new Intl.DateTimeFormat("es-AR", {
  weekday: "short",
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
  timeZone: EVENT_CLOCK_TZ,
});

/**
 * Fecha/hora de evento para UI pública.
 * Misma hora que en Supabase (`timestamptz` en UTC), formato corto: `Vie 18 sep · 23:00`.
 * Usar desde Server Components y pasar el string a Client Components (evita hydration mismatch).
 */
export function formatEventStartsAt(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";

  const parts = eventStartsFormatter.formatToParts(d);
  const weekday = partValue(parts, "weekday").replace(/\.$/, "");
  const day = partValue(parts, "day");
  const month = partValue(parts, "month").replace(/\.$/, "");
  const hour = partValue(parts, "hour");
  const minute = partValue(parts, "minute");

  return normalizeSpaces(`${weekday} ${day} ${month} · ${hour}:${minute}`);
}

/** Partes de agenda del evento en el reloj UTC de Supabase (home / cards). */
export function getEventScheduleParts(iso: string | null): {
  weekday: string;
  day: string;
  month: string;
  year: string;
  time: string;
} | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const weekday = new Intl.DateTimeFormat("es-AR", { weekday: "long", timeZone: EVENT_CLOCK_TZ }).format(d);
  const day = new Intl.DateTimeFormat("es-AR", { day: "numeric", timeZone: EVENT_CLOCK_TZ }).format(d);
  const month = new Intl.DateTimeFormat("es-AR", { month: "short", timeZone: EVENT_CLOCK_TZ }).format(d);
  const year = new Intl.DateTimeFormat("es-AR", { year: "numeric", timeZone: EVENT_CLOCK_TZ }).format(d);
  const time = new Intl.DateTimeFormat("es-AR", {
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone: EVENT_CLOCK_TZ,
  }).format(d);
  return { weekday, day, month, year, time: normalizeSpaces(time) };
}

/**
 * Valor de `<input type="datetime-local">` (sin zona) → ISO UTC.
 * La hora tipada se guarda tal cual en UTC (misma que ves en Supabase).
 */
export function datetimeLocalToIso(value: string): string | null {
  const v = value.trim();
  if (!v) return null;
  const m = v.match(/^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2})(?::(\d{2}))?$/);
  if (!m) {
    const d = new Date(v);
    if (Number.isNaN(d.getTime())) return null;
    return d.toISOString();
  }
  const seconds = m[2] ?? "00";
  const d = new Date(`${m[1]}:${seconds}.000Z`);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

/** ISO timestamptz → valor para `<input type="datetime-local">` con el reloj UTC de Supabase. */
export function isoToDatetimeLocal(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: EVENT_CLOCK_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(d);
  const year = partValue(parts, "year");
  const month = partValue(parts, "month");
  const day = partValue(parts, "day");
  const hour = partValue(parts, "hour");
  const minute = partValue(parts, "minute");
  if (!year || !month || !day || !hour || !minute) return "";
  return `${year}-${month}-${day}T${hour}:${minute}`;
}
