-- Idempotencia del envío de email de tickets.
-- Permite saber si ya enviamos los QR al comprador y reenviar bajo demanda.

alter table public.orders
  add column if not exists tickets_email_sent_at timestamptz;

create index if not exists idx_orders_tickets_email_sent
  on public.orders (tickets_email_sent_at)
  where tickets_email_sent_at is not null;

comment on column public.orders.tickets_email_sent_at is 'Timestamp del último envío exitoso del email con QRs al comprador.';
