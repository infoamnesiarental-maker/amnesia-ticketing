# AmnesiaTicketing — qué falta implementar (priorizado)

**Requisitos completos + checklist con estados (🟢🟡🔴):** [`REQUISITOS-Y-HOJA-DE-RUTA.md`](./REQUISITOS-Y-HOJA-DE-RUTA.md).

Documento vivo: de **mayor** a **menor** prioridad respecto al producto descrito en `proyecto.md` y al stack actual (Next + Supabase + n8n/Make).

---

## P0 — Bloqueantes para “usar el producto” (hacer ahora)

1. **Sesión en servidor + rutas protegidas**  
   Middleware / `createServerClient` (`@supabase/ssr`) para que `/app` y `/admin` exijan login y la sesión se refresque con cookies.

2. **Onboarding de productora**  
   Tras el primer login: crear `organizations` + `org_members` (rol `owner`) si el usuario no pertenece a ninguna org.

3. **RLS mínimo en Supabase**  
   Políticas para que cada usuario solo vea/edite datos de sus organizaciones (sin esto, o no hay datos o hay riesgo de fuga).

4. **CRUD eventos (organizador)**  
   Listar, crear, editar eventos del `organization_id` del usuario; campos mínimos: nombre, slug, lugar, fechas, `mp_alias`, etc.

5. **Tipos de entrada (`ticket_types`)**  
   CRUD por evento en `/app/eventos/[id]/entradas`: nombre, precio, stock, activo, venta hasta.

6. **Ticketera pública por evento** (MVP en código)  
   Ruta `/e/[orgSlug]/[eventSlug]`: cantidades, datos comprador, comprobante en bucket **proofs**, `orders` + `order_items`. Requiere ejecutar `supabase/ticketera-public.sql` y `SUPABASE_SERVICE_ROLE_KEY` en `web/.env.local`.

7. **Webhook n8n/Make**  
   Tras crear orden: disparar validación MP; callback o polling para actualizar `orders.status` y crear `tickets` + envío de mail (fuera de Next o vía Edge Function con `service_role` controlado).

---

## P1 — Panel organizador completo

- Ventas: listado de órdenes, filtros, métricas, validación manual.  
- **Realtime** (Supabase) para órdenes e ingresos.  
- **Puerta**: escaneo QR + `checkins` idempotentes + lista de asistentes.  
- Configuración por evento: mail alertas, URL webhook n8n (si aplica desde UI).

---

## P2 — Super admin (productoras)

- Listado solicitudes `pending`, aprobar / rechazar / suspender.  
- Métricas globales.  
- Criterio de acceso: rol en DB o lista de emails admin en env (MVP) → evolución a rol `super_admin` en Postgres.

---

## P3 — Robustez y producto

- Deduplicación de pagos MP (centavos únicos, metadata).  
- Reintentos / colas / estados expirados de órdenes.  
- Export CSV asistentes, analytics, marca blanca (`design.json` extendido).  
- Tests E2E (Playwright), CI, observabilidad.

---

## Ya hecho (referencia)

- Next.js + UI base (`design.json`).  
- Auth email/password contra Supabase (`/auth`) + redirect `?redirect=`.  
- Esquema SQL inicial: `supabase/schema.sql`.  
- **RLS MVP**: `supabase/policies-mvp.sql` (ejecutar en Supabase después del schema).  
- **Panel productora** `/app`: onboarding productora, listado y alta de **eventos**, CRUD de **tipos de entrada** por evento en `/app/eventos/[eventId]/entradas`, enlace a **ticketera pública** por evento.  
- **Ticketera pública** `/e/[orgSlug]/[eventSlug]`: RPC `get_ticketera_data`, formulario de compra y `submitPublicOrder` (Storage + órdenes con service role).  
- **Super admin** `/admin`: lista de productoras con `SUPABASE_SERVICE_ROLE_KEY` + acceso por `SUPERADMIN_EMAILS`.  
- Middleware refresco de sesión: `@supabase/ssr` (`src/middleware.ts`).  
- Variables: `web/.env.local` con `NEXT_PUBLIC_*`; opcional `SUPABASE_SERVICE_ROLE_KEY`, `SUPERADMIN_EMAILS`.

---

## Orden sugerido de trabajo en código

`middleware + server client` → `RLS` → `onboarding org` → `eventos` → `ticket_types` → `ticketera pública + Storage` → `n8n` → `ventas + puerta` → `super admin`.
