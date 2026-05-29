const EVENT_TZ = "America/Argentina/Buenos_Aires";

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
