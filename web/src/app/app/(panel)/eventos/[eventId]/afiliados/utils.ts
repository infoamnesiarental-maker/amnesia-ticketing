/** Normaliza un nombre libre a código de afiliado: mayúsculas, sin acentos, solo alfanumérico. */
export function nameToCode(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 16);
}
