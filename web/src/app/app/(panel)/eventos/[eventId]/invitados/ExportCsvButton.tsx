"use client";

interface AttendeeRow {
  order_id: string;
  attendee_position: number;
  first_name: string;
  last_name: string;
  dni: string;
  phone: string | null;
  is_buyer: boolean;
  buyer_email: string;
  buyer_phone: string;
  unit_price_ars: number;
  status: string;
  created_at: string;
  validated_at: string | null;
}

interface ExportCsvButtonProps {
  rows: AttendeeRow[];
  eventName: string;
}

const STATUS_LABEL: Record<string, string> = {
  validated: "Confirmado",
  manual_review: "En revisión",
  pending_validation: "Esperando pago",
  rejected: "Rechazada",
  cancelled: "Cancelada",
};

function csvEscape(v: string | number | null | undefined): string {
  if (v === null || v === undefined) return "";
  const s = String(v);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function buildCsv(rows: AttendeeRow[]): string {
  const headers = [
    "Apellido",
    "Nombre",
    "DNI",
    "Es comprador",
    "Teléfono asistente",
    "Email comprador",
    "Teléfono comprador",
    "Precio ARS",
    "Estado",
    "Comprado",
    "Validado",
    "Order ID",
    "Posición",
  ];
  const lines = [headers.join(",")];
  for (const r of rows) {
    lines.push(
      [
        csvEscape(r.last_name),
        csvEscape(r.first_name),
        csvEscape(r.dni),
        csvEscape(r.is_buyer ? "Sí" : "No"),
        csvEscape(r.phone ?? ""),
        csvEscape(r.buyer_email),
        csvEscape(r.buyer_phone),
        csvEscape(Number(r.unit_price_ars).toFixed(2)),
        csvEscape(STATUS_LABEL[r.status] ?? r.status),
        csvEscape(r.created_at),
        csvEscape(r.validated_at ?? ""),
        csvEscape(r.order_id),
        csvEscape(r.attendee_position),
      ].join(","),
    );
  }
  return lines.join("\n");
}

function slugifyForFilename(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 64);
}

export function ExportCsvButton({ rows, eventName }: ExportCsvButtonProps) {
  function handleDownload() {
    const csv = buildCsv(rows);
    const bom = "\uFEFF";
    const blob = new Blob([bom + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `invitados-${slugifyForFilename(eventName)}-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return (
    <button
      type="button"
      onClick={handleDownload}
      disabled={rows.length === 0}
      className="rounded-lg border border-white/15 bg-white/5 px-4 py-2 text-xs font-medium text-white/85 transition hover:bg-white/10 disabled:opacity-50"
    >
      Descargar CSV
    </button>
  );
}
