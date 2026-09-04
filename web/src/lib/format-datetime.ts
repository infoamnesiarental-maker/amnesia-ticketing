export const EVENT_TZ = "America/Argentina/Buenos_Aires";

/**
 * Argentina no usa DST: el offset civil es UTC−3 todo el año.
 * Lo usamos para interpretar `datetime-local` (sin zona) como horario de Buenos Aires,
 * porque el servidor (Vercel) corre en UTC y `new Date("2026-09-18T23:00")` lo toma como 23:00 UTC.
 */
const EVENT_TZ_OFFSET = "-03:00";

const eventStartsFormatter = new Intl.DateTimeFormat("es-AR", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
  timeZone: EVENT_TZ,
});

function partValue(parts: Intl.DateTimeFormatPart[], type: Intl.DateTimeFormatPartTypes): string {
  return parts.find((p) => p.type === type)?.value ?? "";
}

/** Normaliza espacios raros (p. ej. U+202F) que difieren entre Node y el navegador. */
function normalizeSpaces(s: string): string {
  return s.replace(/\u202f|\u00a0/g, " ").replace(/\s+/g, " ").trim();
}

/**
 * Fecha/hora de evento para UI pública.
 * Usar desde Server Components y pasar el string a Client Components (evita hydration mismatch).
 */
export function formatEventStartsAt(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";

  const parts = eventStartsFormatter.formatToParts(d);
  const weekday = partValue(parts, "weekday");
  const day = partValue(parts, "day");
  const month = partValue(parts, "month");
  const year = partValue(parts, "year");
  const hour = partValue(parts, "hour");
  const minute = partValue(parts, "minute");
  const dayPeriod = normalizeSpaces(partValue(parts, "dayPeriod"));

  return normalizeSpaces(`${weekday}, ${day} de ${month} de ${year}, ${hour}:${minute} ${dayPeriod}`);
}

/** Valor de `<input type="datetime-local">` (sin zona) → ISO UTC, interpretado en Buenos Aires. */
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
  const d = new Date(`${m[1]}:${seconds}${EVENT_TZ_OFFSET}`);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

/** ISO timestamptz → valor para `<input type="datetime-local">` en horario de Buenos Aires. */
export function isoToDatetimeLocal(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: EVENT_TZ,
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
