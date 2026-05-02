import Link from "next/link";

import { generateTicketQrSvg } from "@/lib/qr";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const money = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 2 });

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

interface BuyerView {
  order: {
    id: string;
    status: string;
    buyer_first_name: string;
    buyer_last_name: string;
    buyer_dni: string;
    buyer_email: string;
    buyer_phone: string;
    total_qty: number;
    total_ars: number;
    created_at: string;
    validated_at: string | null;
    rejected_at: string | null;
  };
  event: {
    id: string;
    name: string;
    slug: string;
    place: string | null;
    starts_at: string | null;
    cover_image_url: string | null;
    org_slug: string;
    org_name: string;
  };
  items: Array<{ qty: number; unit_price_ars: number; ticket_type_name: string }>;
  tickets: Array<{
    uid: string;
    status: string;
    ticket_type_name: string;
    issued_at: string;
    attendee_first_name: string | null;
    attendee_last_name: string | null;
    attendee_position: number | null;
  }>;
}

interface PageProps {
  params: Promise<{ orderId: string }>;
}

function statusInfo(status: string) {
  if (status === "validated") {
    return {
      title: "Tu compra está confirmada",
      desc: "Mostrá el código QR en la entrada del evento.",
      cls: "border-emerald-400/40 bg-emerald-500/10 text-emerald-200",
    };
  }
  if (status === "rejected" || status === "cancelled") {
    return {
      title: "Compra rechazada",
      desc: "El pago no fue confirmado por la productora. Si pensás que es un error, contactalos.",
      cls: "border-red-400/40 bg-red-500/10 text-red-200",
    };
  }
  if (status === "manual_review") {
    return {
      title: "Tu compra está en revisión",
      desc: "La productora está revisando tu comprobante. Te avisaremos en cuanto se confirme.",
      cls: "border-violet-400/40 bg-violet-500/10 text-violet-200",
    };
  }
  return {
    title: "Recibimos tu comprobante",
    desc: "La productora va a confirmar tu pago. Volvé a este link más tarde para ver tus QR.",
    cls: "border-amber-400/40 bg-amber-500/10 text-amber-200",
  };
}

function formatDate(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("es-AR", { dateStyle: "medium", timeStyle: "short" });
}

export default async function BuyerOrderPage({ params }: PageProps) {
  const { orderId } = await params;

  if (!UUID_RE.test(orderId)) {
    return (
      <main className="mx-auto max-w-xl px-4 py-16 text-center">
        <h1 className="text-2xl font-bold text-white">Orden no válida</h1>
        <p className="mt-2 text-sm text-white/65">El link que estás abriendo no tiene un identificador correcto.</p>
      </main>
    );
  }

  const admin = createSupabaseServiceRoleClient();
  if (!admin) {
    return (
      <main className="mx-auto max-w-xl px-4 py-16 text-center">
        <h1 className="text-2xl font-bold text-white">Servicio no disponible</h1>
        <p className="mt-2 text-sm text-white/65">Falta configuración del servidor. Probá más tarde.</p>
      </main>
    );
  }

  const { data, error } = await admin.rpc("get_buyer_order_view", { p_order_id: orderId });

  if (error || !data) {
    return (
      <main className="mx-auto max-w-xl px-4 py-16 text-center">
        <h1 className="text-2xl font-bold text-white">No encontramos tu orden</h1>
        <p className="mt-2 text-sm text-white/65">
          El link puede estar mal copiado. Si acabás de comprar, esperá unos segundos y recargá.
        </p>
      </main>
    );
  }

  const view = data as unknown as BuyerView;
  const sInfo = statusInfo(view.order.status);

  const tickets = view.order.status === "validated" ? view.tickets : [];

  const qrSvgs: Array<{
    uid: string;
    ticket_type_name: string;
    svg: string;
    status: string;
    attendee_name: string | null;
  }> = await Promise.all(
    tickets.map(async (t) => ({
      uid: t.uid,
      ticket_type_name: t.ticket_type_name,
      status: t.status,
      svg: await generateTicketQrSvg(t.uid, 240),
      attendee_name: t.attendee_first_name
        ? `${t.attendee_first_name} ${t.attendee_last_name ?? ""}`.trim()
        : null,
    })),
  );

  return (
    <main className="mx-auto max-w-4xl px-4 py-8 text-center sm:py-10 sm:text-left">
      <div className="text-xs text-white/55">
        <Link href={`/e/${view.event.org_slug}/${view.event.slug}`} className="inline-block hover:text-white">
          ← Volver al evento
        </Link>
      </div>

      <header className="mt-4 sm:text-left">
        <p className="text-xs text-white/55">{view.event.org_name}</p>
        <h1 className="mt-1 text-2xl font-bold text-white">{view.event.name}</h1>
        {view.event.place ? <p className="mt-1 text-sm text-white/65">{view.event.place}</p> : null}
        {view.event.starts_at ? (
          <p className="text-sm text-white/65">{formatDate(view.event.starts_at)}</p>
        ) : null}
      </header>

      <section className={`mt-6 rounded-xl border p-4 text-left ${sInfo.cls}`}>
        <p className="text-base font-semibold">{sInfo.title}</p>
        <p className="mt-1 text-sm opacity-90">{sInfo.desc}</p>
      </section>

      <section className="surface-glass mt-6 p-5 text-left">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-white/55">Detalle de la compra</h2>
        <p className="mt-2 text-sm text-white/85">
          {view.order.buyer_first_name} {view.order.buyer_last_name} · DNI {view.order.buyer_dni}
        </p>
        <p className="text-xs text-white/55">{view.order.buyer_email} · {view.order.buyer_phone}</p>

        <ul className="mt-4 grid gap-2">
          {view.items.map((it, idx) => (
            <li key={idx} className="flex items-center justify-between text-sm">
              <span className="text-white/85">
                {it.qty}× {it.ticket_type_name}
              </span>
              <span className="text-white/60">{money.format(Number(it.unit_price_ars))}</span>
            </li>
          ))}
        </ul>

        <div className="mt-4 flex items-center justify-between border-t border-white/10 pt-3 text-sm">
          <span className="text-white/65">Total</span>
          <span className="font-semibold text-white">{money.format(Number(view.order.total_ars))}</span>
        </div>
      </section>

      {view.order.status === "validated" && qrSvgs.length > 0 ? (
        <section className="mt-8 text-center sm:text-left">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-white/55">
            Tus entradas ({qrSvgs.length})
          </h2>
          <p className="mt-1 text-xs text-white/55">
            Cada QR es individual. Mostralos en la puerta del evento. Hacé screenshot por las dudas.
          </p>

          <div className="mt-4 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {qrSvgs.map((t, idx) => (
              <div
                key={t.uid}
                className="surface-glass flex min-w-0 w-full flex-col items-center gap-3 overflow-hidden p-5 text-center"
              >
                <p className="text-xs font-semibold uppercase tracking-wider text-white/55">
                  Entrada {idx + 1} · {t.ticket_type_name}
                </p>
                {t.attendee_name ? (
                  <p className="text-balance text-base font-bold text-white">{t.attendee_name}</p>
                ) : null}
                <div className="w-full max-w-[min(100%,260px)] rounded-xl bg-white p-3 shadow-inner [&_svg]:mx-auto [&_svg]:block [&_svg]:h-auto [&_svg]:max-h-none [&_svg]:max-w-full [&_svg]:w-full">
                  <div dangerouslySetInnerHTML={{ __html: t.svg }} />
                </div>
                <p className="max-w-full break-all font-mono text-[10px] text-white/45">UID: {t.uid}</p>
                {t.status === "checked_in" ? (
                  <span className="rounded-full border border-emerald-400/40 bg-emerald-500/10 px-2 py-0.5 text-[10px] text-emerald-200">
                    Ya ingresada
                  </span>
                ) : null}
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <p className="mt-10 text-center text-xs text-white/40">
        Guardá este link. Es tu comprobante de compra:
        <br />
        <span className="font-mono text-white/55">/o/{view.order.id}</span>
      </p>
    </main>
  );
}
