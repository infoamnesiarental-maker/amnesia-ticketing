# AmnesiaTicketing — Requisitos y hoja de ruta

Documento vivo: conviene **ir moviendo los emojis** a medida que cerrás tareas. Referencias: `proyecto.md` (producto), `design.json` (UI), `docs/PENDIENTE.md` (backlog corto), SQL en `supabase/`.

---

## Leyenda de estado

| Emoji | Significado |
| :---: | ----------- |
| **🟢** | **Completo** — implementado y usable en el flujo acordado (código en repo y, si aplica, SQL ya aplicado en tu proyecto Supabase). |
| **🟡** | **En progreso / parcial** — hay código o scripts, falta pulir, probar en producción, o depende de que ejecutes SQL o variables en el entorno remoto. |
| **🔴** | **Pendiente** — no iniciado o sin integrar al producto usable. |

---

## 1. Visión y restricciones (acuerdo de producto)

- **Modelo de pago**: el comprador transfiere al **CBU/alias del organizador** (Mercado Pago como cuenta, **no** como pasarela con comisión). Cero comisión de pasarela sobre el valor del ticket.
- **Validación**: automatización (**n8n o Make**) consulta la **API de Mercado Pago en solo lectura** para cruzar monto y ventana temporal; emisión de tickets y mails fuera del cliente.
- **Backend único**: **Supabase** (Auth, Postgres, Storage, Realtime opcional) como fuente de verdad; **multi-productora** (`organizations` + `org_members` + roles).
- **Frontend actual**: **Next.js** en `web/` (panel organizador, auth, admin MVP), alineado a tokens y patrones de `design.json`.
- **Secretos**: tokens de MP y `service_role` **solo servidor** (env, Edge Functions o n8n); nunca en el bundle del cliente.

---

## 2. Requisitos funcionales por módulo

Cada ítem lleva un **estado inicial** (abril 2026) según el repo; corregilo si tu rama o Supabase van más adelante.

### 2.1 Infraestructura y seguridad base

| ID | Requisito | Estado |
|----|-----------|--------|
| I1 | Monorepo con app Next en `web/`, variables en `web/.env.local` (`NEXT_PUBLIC_SUPABASE_*`, opcional `SUPABASE_SERVICE_ROLE_KEY`, `SUPERADMIN_EMAILS`). | 🟢 |
| I2 | Esquema Postgres inicial (`supabase/schema.sql`): orgs, miembros, eventos, `ticket_types`, órdenes, tickets, checkins, enums. | 🟢 |
| I3 | Auth Supabase email/password; rutas `/auth` con redirect `?redirect=`. | 🟢 |
| I4 | Sesión **cookies** con `@supabase/ssr`: cliente browser, servidor y `middleware` que refresca sesión. | 🟢 |
| I5 | Rutas panel `/app` y super admin `/admin` protegidas por sesión; admin acotado por `SUPERADMIN_EMAILS`. | 🟢 |
| I6 | **RLS** MVP en SQL (`supabase/policies-mvp.sql`): acceso por membresía a org/eventos/tipos. | 🟢 en repo y DB remota |
| I7 | **Ejecución** de `schema.sql` + políticas + hotfixes en **tu** proyecto Supabase (SQL Editor). | 🟢 |
| I8 | Hotfix recursión `org_members` (`supabase/policies-hotfix-org-members-recursion.sql`). | 🟢 en repo |
| I9 | Alta de productora **sin** `INSERT`+`SELECT` que rompa RLS: RPC `bootstrap_organization` (`policies-mvp.sql` final + `hotfix-bootstrap-organization-rpc.sql`). | 🟢 |
| I10 | Bucket **proofs** + límites MIME (script `ticketera-public.sql`); subida solo servidor con `service_role`. Signed URLs para organizador: pendiente. | 🟡 |

### 2.2 Organizador (panel productora)

| ID | Requisito | Estado |
|----|-----------|--------|
| O1 | Onboarding: si el usuario no tiene `org_members`, formulario que crea org + rol `owner` (vía RPC). | 🟢 |
| O2 | Listado de eventos de la org del usuario. | 🟢 |
| O3 | Alta de evento (nombre, slug, lugar, `mp_alias`, email organizador según formulario actual). | 🟢 |
| O4 | Edición y baja lógica de eventos; portada (`cover_image_url`), fechas (`starts_at`), descripción. | 🟡 |
| O5 | CRUD **tipos de entrada** (`ticket_types`) por evento: nombre, precio, stock, activo, fin de venta. | 🟢 |
| O6 | Link público a la ticketera del evento (copiar/compartir). | 🟢 |
| O7 | Panel **ventas**: listado de `orders` + `order_items` + comprobante (signed URL) + estado. | 🟡 |
| O8 | Validación manual de orden (aprobar / rechazar / revisión). | 🔴 |
| O9 | **Realtime** (Supabase) para órdenes y contadores en panel y puerta. | 🔴 |
| O10 | **Puerta**: escaneo QR, validación contra `tickets`, `checkins` idempotentes, búsqueda por DNI/nombre, lista asistentes. | 🔴 |
| O11 | Config por evento: mail alertas, URL webhook n8n (si se expone desde UI). | 🔴 |
| O12 | Roles `owner` / `admin` / `door` reflejados en UI y políticas (puerta solo lo necesario). | 🟡 |

### 2.3 Ticketera pública (comprador)

| ID | Requisito | Estado |
|----|-----------|--------|
| P1 | Ruta pública por evento (`/e/[orgSlug]/[eventSlug]`). | 🟢 |
| P2 | Elegir cantidades + total a transferir (anti‑confusión básico). Deduplicación MP / centavos únicos: pendiente. | 🟡 |
| P3 | Datos del comprador (nombre, DNI, teléfono, email). | 🟢 |
| P4 | Alias/CBU + monto; comprobante en **Storage**; `orders` + `order_items` en `pending_validation` (server action + `service_role`). | 🟢 |
| P5 | Confirmación post‑envío (“recibido; validación en curso; QR por mail”). | 🟢 |
| P6 | UX mobile-first según `design.json`. | 🟢 |

### 2.4 Automatización (n8n / Make)

| ID | Requisito | Estado |
|----|-----------|--------|
| A1 | Contrato de payload: disparo con `order_id` y contexto mínimo (org/event, monto, ventana temporal). | 🔴 |
| A2 | Workflow: búsqueda en API MP, decisión `validated` / `manual_review` / `rejected`. | 🔴 |
| A3 | Si valida: crear filas `tickets`, generar QR, enviar email; si no: alertas al organizador. | 🔴 |
| A4 | Actualización de `orders.status` solo con credenciales server-side (`service_role` acotado o Edge Function). | 🔴 |

### 2.5 Super admin

| ID | Requisito | Estado |
|----|-----------|--------|
| S1 | Lista global de productoras con `service_role` (pantalla actual). | 🟢 |
| S2 | Aprobar / rechazar / suspender desde UI y reflejo en `organizations.status`. | 🟡 |
| S3 | Métricas globales (eventos, tickets vendidos, etc.). | 🔴 |
| S4 | Notificación a super admin por nueva solicitud (mail o integración futura). | 🔴 |
| S5 | (Opcional evolutivo) rol `super_admin` en Postgres en lugar de solo lista de emails. | 🔴 |

### 2.6 Calidad, operación y producto (fase posterior)

| ID | Requisito | Estado |
|----|-----------|--------|
| Q1 | Deduplicación de pagos MP (metadata, centavos únicos, idempotencia en órdenes). | 🔴 |
| Q2 | Reintentos, colas, expiración de órdenes pendientes. | 🔴 |
| Q3 | Export CSV asistentes, analytics, marca blanca extendida desde `design.json`. | 🔴 |
| Q4 | Tests E2E (p. ej. Playwright), CI, observabilidad. | 🔴 |

---

## 3. Hoja de ruta priorizada (orden de trabajo)

**Regla**: seguí la lista **de arriba hacia abajo**; no hace falta terminar al 100% un bloque para empezar el siguiente, pero los **P0** desbloquean el flujo “producto mínimo vendible”.

### P0 — Producto mínimo usable (bloqueantes)

| # | Entrega | Estado |
|---|---------|--------|
| 1 | Sesión estable (middleware + `@supabase/ssr` + rutas protegidas). | 🟢 |
| 2 | SQL en Supabase: `schema.sql` + `policies-mvp.sql` (incluye RPC `bootstrap_organization`) + hotfix recursión si ya había políticas viejas. | 🟢 |
| 3 | Onboarding productora funcionando end-to-end (form + RPC, sin error RLS). | 🟢 |
| 4 | RLS verificado: usuario solo ve datos de sus orgs (smoke manual). | 🟢 |
| 5 | Eventos: listar + crear (campos mínimos acordados). | 🟢 |
| 6 | `ticket_types`: CRUD por evento en UI + políticas coherentes. | 🟢 |
| 7 | Ticketera pública por evento: elegir cantidades, datos comprador, monto, subida a Storage, crear orden. | 🟢 |
| 8 | Primer workflow n8n/Make: webhook + validación MP + actualización orden + tickets + mail. | 🔴 |

### P1 — Panel organizador “completo” para operar un evento real

| # | Entrega | Estado |
|---|---------|--------|
| 9 | Panel ventas: órdenes + items + comprobante (MVP). Filtros/métricas avanzadas: pendiente. | 🟡 |
| 10 | Realtime en ventas (y opcionalmente header con ingresos del día). | 🔴 |
| 11 | Puerta: QR + estados verde/amarillo/rojo + checkins idempotentes + lista asistentes. | 🔴 |
| 12 | Edición de evento + link público visible para compartir. | 🟢 |
| 13 | Config evento: alertas mail / URL webhook desde UI (si entra en el alcance P1). | 🔴 |

### P2 — Super admin y gobierno de productoras

| # | Entrega | Estado |
|---|---------|--------|
| 14 | Acciones de aprobación / rechazo / suspensión desde `/admin`. | 🟡 |
| 15 | Métricas globales para super admin. | 🔴 |
| 16 | Afinar criterios de acceso (emails env → rol en DB si se define). | 🔴 |

### P3 — Robustez y crecimiento

| # | Entrega | Estado |
|---|---------|--------|
| 17 | Anti-duplicación MP y estados de orden expirados / reintentos. | 🔴 |
| 18 | Export CSV, analytics, marca blanca. | 🔴 |
| 19 | Tests E2E + CI + observabilidad. | 🔴 |

---

## 4. Cómo mantener este archivo

1. Al terminar una fila de la hoja de ruta (P0–P3), cambiá **🔴 → 🟡** mientras probás, y **🟡 → 🟢** cuando esté estable en el entorno objetivo.
2. Si un requisito se **descarta** o se **posterga**, anotá la fecha y el motivo en una línea bajo la tabla correspondiente.
3. Mantener **una sola fuente de verdad** para prioridades: este doc para requisitos + estados; `PENDIENTE.md` puede resumir solo “próximo sprint” si querés evitar duplicación.

---

*Última revisión de estados: abril 2026 — Supabase remoto alineado (schema + RLS + RPC + bucket `proofs` + smoke E2E panel → ticketera hasta `pending_validation`); UX subida tapa/comprobante con límites claros en UI; pendiente automatización n8n/Make (P0 #8) y refinamientos (O4 baja lógica, I10 signed URLs organizador).* 
