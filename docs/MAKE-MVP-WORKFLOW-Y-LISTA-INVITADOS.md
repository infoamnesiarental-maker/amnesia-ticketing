# MVP con Make.com — plan por fases (validación MP + tickets + operación)

Guía única para implementar el flujo **orden creada → Make valida en Mercado Pago → tickets + estado**, con **manual review** por la productora, **anti‑reuso de comprobante** (hash), y opción de **lista de invitados** en una fase posterior.

**Stack acordado:** Next.js (`web/`) + Supabase (Postgres + Storage) + **Make.com** (webhook + HTTP). Secretos (`service_role`, token MP) **solo servidor** (Make y/o Next).

---

## Convenciones rápidas

| Término | Significado |
|--------|-------------|
| Orden | Fila `orders` + `order_items` + comprobante en Storage |
| Ticket | Unidad de ingreso; en DB suele ser 1 fila `tickets` con `uid` único |
| Invitado | Persona que entra; **no siempre** es el `buyer_*` de la orden |

**Make no usa “tokens”** salvo que agregues IA. Lo que limita el plan suele ser **operaciones** (módulos ejecutados; los bucles multiplican). Por eso la emisión de tickets debe hacerse preferentemente con **1 RPC en Postgres por orden**.

---

## Fase 0 — Reglas de producto (definir antes de tocar Make)

1. **Matching MP (automático)**  
   - Monto: **igual** a `orders.total_ars` (definir si comparás `number` o `decimal` redondeado igual que en la app).  
   - Ventana temporal: p.ej. últimos **45–90 min** desde `orders.created_at` (ajustable).  
   - Si hay **0 matches** → `manual_review` (recomendado) en lugar de `rejected` directo.  
   - Si hay **>1 match** → `manual_review` (ambigüedad).

2. **“Misma cuenta / mismo pagador”**  
   - **No bloquear** solo por cuenta repetida (pagos legítimos). Usá señales + `manual_review` si hace falta.

3. **Idempotencia**  
   - Misma orden no debe generar tickets duplicados si Make reintenta o el webhook se dispara dos veces.

4. **Invitados nominales**  
   - Decidir si va en **MVP** o en **post‑MVP** (implica tabla nueva + UI). Recomendación: **post‑MVP** si querés cerrar Make rápido.

---

## Fase 1 — Supabase: RPC de cierre + anti‑reuso de comprobante

Script listo en repo: `supabase/mvp-make-finalize-order.sql` (ejecutalo en el SQL Editor de Supabase).

### 1.1 RPC `finalize_order_payment` (recomendado, `security definer`)

**Objetivo:** que Make (o el panel) haga **una sola llamada** por orden: validar estado, insertar `tickets` idempotente, actualizar `orders`.

**Contrato sugerido (ejemplo):**

- Entrada: `p_order_id uuid`, `p_mp_payment_id text` (nullable hasta match), `p_actor text` (`'make'` | `'panel'`), `p_actor_user_id uuid` (nullable si es Make).
- Reglas:
  - Solo proceder si `orders.status in ('pending_validation','manual_review')`.
  - Si ya `validated` y ya hay tickets para esa orden → **no‑op** exitoso (idempotente).
  - Insertar `tickets` según `order_items` (qty expandible en SQL con `generate_series` o loop en PL/pgSQL).
  - `uid` único por ticket (p.ej. `encode(gen_random_bytes(16), 'hex')` o similar).
  - `payload` jsonb mínimo (evento, tipo, buyer, order_id).
  - `update orders set status='validated', mp_payment_id=..., validated_at=now()` (y campos extra si los agregás).

**Permisos:** `grant execute` solo a `service_role` **o** exponer vía REST con un rol dedicado; en MVP lo más simple es que Make use **service_role** con URL+headers (entendé el riesgo: rotación y mínimos privilegios).

### 1.2 Columna `proof_sha256` + unicidad

1. Agregar `orders.proof_sha256 text not null` (o nullable hasta migrar órdenes viejas).  
2. Índice único:
   - **Global** (`unique (proof_sha256)`): más estricto (un mismo archivo no sirve para dos órdenes nunca).  
   - **Por evento** (`unique (event_id, proof_sha256)`): más flexible.

**En Next (`submitPublicOrder`):** calcular SHA‑256 del buffer del archivo **antes** de insertar; si viola unique → error claro o `manual_review` con motivo (elegí una sola política).

---

## Fase 2 — Make.com: scenario (webhook → Supabase → MP → RPC/PATCH)

### 2.1 Crear el scenario

1. **Webhooks → Custom webhook** (POST).  
2. Guardar **URL de producción** del webhook.

### 2.2 Seguridad mínima

- Header compartido: `X-Webhook-Secret: <secreto largo>`.  
- Primer módulo después del webhook: **Filter** que aborte si el header no coincide.

### 2.3 Módulos (camino feliz, pocos pasos)

1. **Webhook** (recibe JSON mínimo).  
2. **HTTP → Supabase REST**: `GET` orden + items por `order_id`.  
3. **HTTP → Mercado Pago**: `GET /v1/payments/search` con ventana y filtros acordados en Fase 0.  
4. **Router**:
   - **Match único** → `HTTP POST /rpc/finalize_order_payment` con `p_order_id`, `p_mp_payment_id`, `p_actor='make'`.  
   - **Sin match / múltiples matches** → `PATCH orders` a `manual_review` (y opcional `review_reason` si agregás columna).

5. **Email** (opcional en esta fase): si lo dejás para después, el MVP igual “funciona” si el usuario ve estado en panel o recibís mail manual.

**Operaciones:** objetivo **~6–10 por orden** sin iterator por ticket (gracias a la RPC).

### 2.4 Payload mínimo del webhook (recomendado)

Enviar desde Next solo lo necesario:

```json
{
  "order_id": "uuid",
  "event_id": "uuid",
  "total_ars": 12345.67,
  "buyer_email": "a@b.com",
  "sent_at": "2026-04-27T18:00:00.000Z"
}
```

Make puede leer el resto desde Supabase.

---

## Fase 3 — Next.js: disparar Make al crear la orden

1. Variables server-only en `web/.env.local`:
   - `MAKE_WEBHOOK_URL`
   - `MAKE_WEBHOOK_SECRET`

2. En `submitPublicOrder` (después de `orders` + `order_items` + upload OK):
   - `fetch(MAKE_WEBHOOK_URL, { method:'POST', headers:{'Content-Type':'application/json','X-Webhook-Secret':...}, body: JSON.stringify({...}) })`
   - **Best effort:** si falla, la orden queda `pending_validation` (correcto) y conviene persistir `automation_last_error` / `automation_last_attempt_at` en `orders` (columnas nuevas, recomendadas).

---

## Fase 4 — Panel productora: manual review (sin depender de Make)

**Objetivo:** si MP no matchea o Make falló, la productora puede cerrar el caso.

1. UI en ventas / detalle de orden:
   - Ver estado, total, comprador, items.
   - Ver comprobante (signed URL con `service_role` en server component o action).
2. Acciones:
   - **Validar pago** → llamar la **misma RPC** `finalize_order_payment` con `p_actor='panel'` y `p_actor_user_id=auth.uid()` (si aplica).
   - **Rechazar** → `update orders set status='rejected'`.
   - **Marcar revisión** → `manual_review`.

**Idempotencia:** la RPC debe soportar re‑clicks sin duplicar tickets.

---

## Fase 5 (opcional / post‑MVP) — Lista de invitados nominal

**Cuándo hacerla:** después de que Fase 2–4 estén estables.

1. Tabla `attendees` (o `order_guests`) ligada a `order_id` + `event_id`.  
2. UI en ticketera: carga de N filas (nombre/apellido/DNI).  
3. Reglas:
   - ¿Se emiten tickets por invitado o por cantidad total? (definir 1 regla).  
   - Sincronizar estados con `orders.status`.

---

## Checklist de “MVP listo” (Definition of Done)

- [ ] Orden creada con comprobante y `pending_validation`.  
- [ ] Make recibe webhook con secreto válido.  
- [ ] Match MP → `validated` + `tickets` creados + `mp_payment_id` guardado (sin duplicar en reintentos).  
- [ ] Sin match / ambigüedad → `manual_review`.  
- [ ] Misma imagen (mismo hash) no crea segunda orden o cae en política acordada.  
- [ ] Panel puede validar/rechazar sin Make.  
- [ ] (Opcional) Mail al comprador con QRs o link de descarga.

---

## Próximo paso inmediato (orden de implementación en código)

1. SQL: RPC `finalize_order_payment` + (opcional) columnas de auditoría en `orders`.  
2. SQL: `proof_sha256` + índice único + migración.  
3. Next: hash + webhook Make best-effort + columnas de error.  
4. Make: scenario mínimo Fase 2.  
5. Panel: acciones manuales Fase 4.  
6. Post‑MVP: `attendees` Fase 5.
