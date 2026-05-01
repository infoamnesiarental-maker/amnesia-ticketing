/** Límites de subida (bytes). Deben ser <= límite de Server Actions en `next.config.ts`. */

export const EVENT_COVER_MAX_BYTES = 2 * 1024 * 1024;

export const PUBLIC_PROOF_MAX_BYTES = 5 * 1024 * 1024;

/** Margen pequeño sobre el mayor de los límites (comprobante 5 MB). */
export const SERVER_ACTION_BODY_LIMIT_BYTES = Math.ceil(PUBLIC_PROOF_MAX_BYTES * 1.05);
