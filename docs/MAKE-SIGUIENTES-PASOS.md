# Make + ticketera — qué falta y cómo seguir

Documento operativo para retomar la integración con Make.com sin perderse.
Cubre 2 dudas que quedaron abiertas:

- **slugs**: qué son, dónde se ven, cuál usar.
- **webhook de Make**: qué es, por qué lo usamos, cómo capturarlo y mapear datos.

> Estado base asumido: SQL ya aplicado en el proyecto correcto (Amnesia Rental); `web/.env.local` con `MAKE_WEBHOOK_VALIDATE_URL` + `MAKE_WEBHOOK_SECRET`; scenario en Make creado con `Custom webhook` + `Tools` (vacío).

---

## 1) Slugs: qué son y cómo encontrarlos

### Qué son
Cadenas cortas, sin espacios ni acentos, que identifican una **organización (productora)** y un **evento** en URLs públicas.

- Ejemplo de URL pública del comprador:

```
https://tu-dominio.com/e/<orgSlug>/<eventSlug>
```

- Ejemplo concreto (inventado):

```
https://tu-dominio.com/e/amnesia-rental/fiesta-pilar-27-abril
```

### De dónde salen
- `orgSlug` se define cuando el organizador hace **onboarding** (alta de la productora).
- `eventSlug` se define cuando se crea cada **evento**.
- Ambos viven en Postgres:
  - `public.organizations.slug`
  - `public.events.slug`

### Dónde verlos en la app
- Entrar al panel:
  - `/app/eventos`
- Cada evento muestra:
  - su **slug** (`slug: ...`)
  - el **link público** ya armado (`/e/<orgSlug>/<eventSlug>`)
- Si la pantalla muestra solo el `eventSlug` y necesitás el `orgSlug`, también lo ves en la URL final del botón “Ticketera pública”.

### Cómo verlos por SQL
```sql
select o.slug as org_slug, e.slug as event_slug, e.name
from public.events e
join public.organizations o on o.id = e.organization_id
order by e.created_at desc;
```

### Reglas mentales
- **No** se escriben con `<` y `>` literales: eso es notación para “poné acá el valor real”.
- Son únicos por su contexto:
  - `org.slug` único global.
  - `event.slug` único por organización.

---

## 2) Webhook de Make: qué es y para qué sirve

### Concepto
Un **webhook** es una URL que **alguien** llama (en este caso, tu Next.js) **para avisarle a otro sistema** (Make) que ocurrió algo (en este caso, *“se creó una orden”*).

### Cómo encaja en nuestro flujo
1. Comprador completa el formulario en `/e/...`.
2. Next crea `orders` + `order_items` + sube comprobante a Storage.
3. Apenas se crea la orden, **Next dispara un POST** a la URL del webhook de Make con un JSON mínimo:

```json
{
  "order_id": "uuid",
  "event_id": "uuid",
  "total_ars": 12345.00,
  "buyer_email": "alguien@gmail.com",
  "sent_at": "2026-04-27T22:00:00.000Z"
}
```

4. Make recibe el JSON y arranca el escenario.

### Variables involucradas (ya configuradas)
En `web/.env.local`:

- `MAKE_WEBHOOK_VALIDATE_URL`: la URL que te dio Make al crear el `Custom webhook`.
- `MAKE_WEBHOOK_SECRET`: cadena random definida por vos. Next la manda como header `x-webhook-secret`. Make la valida para evitar que cualquiera dispare el escenario.

### Tres errores típicos
- Pegar la URL en el `.env` equivocado (Next solo lee `web/.env.local`).
- Olvidarse de **reiniciar** `npm run dev` después de cambiar `.env.local`.
- Tener el scenario en Make en **OFF** (no procesa).

---

## 3) Plan de continuación (paso a paso, con objetivo de cada paso)

### Fase A — Confirmar que la “entrada” a Make funciona

#### Paso A1 — Capturar el bundle real del Webhook
**Objetivo:** que Make “aprenda” el formato del JSON que mandamos. Sin esto, no podemos mapear `order_id`, `event_id`, etc., en los pasos siguientes.

1. En Make, abrí el scenario (lienzo).
2. Click en el módulo **Custom webhook**.
3. Click en **Run once** (Make queda escuchando un único request).
4. En tu sitio, hacé **una compra de prueba** en el `/e/<orgSlug>/<eventSlug>` real (no `<orgSlug>` literal).
5. Volvé a Make: el webhook debería capturar el bundle. Vas a ver una bolita verde sobre el módulo y/o un mensaje de “successfully determined”.

#### Paso A2 — Configurar `Tools → Set multiple variables`
**Objetivo:** dejar las variables clave (`order_id`, etc.) disponibles para los próximos módulos sin tener que mapear cada vez.

1. Abrí el módulo **Tools** que está después del webhook.
2. Si pregunta acción: elegí **Set multiple variables**.
3. Add variable (5 veces) — Name → Value (mapeado del Webhook):

| Name | Value (del bundle del Webhook) |
|---|---|
| `order_id` | `order_id` |
| `event_id` | `event_id` |
| `total_ars` | `total_ars` |
| `buyer_email` | `buyer_email` |
| `sent_at` | `sent_at` |

4. Save.

#### Paso A3 — Filtro de seguridad en la flecha Webhook → Set
**Objetivo:** que solo Next.js (con el secreto correcto) pueda accionar el escenario.

1. Click en la **línea** entre Webhook y Set multiple variables.
2. **Set up a filter**:
   - Label: `Secret OK`.
   - Condition: del bundle elegí header `x-webhook-secret` → operator **Equal to** → Value: el mismo string que guardaste en `MAKE_WEBHOOK_SECRET`.
3. Save.

#### Paso A4 — Probar Fase A
1. **Save** del scenario.
2. **Run once** otra vez.
3. Compra de prueba en `/e/...`.
4. En Make, deberías ver: Webhook ✅ → Set ✅. Click en **Output** del Set para confirmar valores reales.

### Fase B — Lectura de la orden desde Supabase

**Objetivo:** que Make traiga `orders` + `order_items` para validar contra Mercado Pago en Fase C.

- Módulo **HTTP → Make a request**.
- URL: `https://<TU_REF>.supabase.co/rest/v1/orders?select=*&id=eq.{{order_id}}`
- Method: **GET**.
- Headers:
  - `apikey: <SERVICE_ROLE>`
  - `Authorization: Bearer <SERVICE_ROLE>`
  - `Content-Type: application/json`

(Mismo módulo otro request para `order_items` si querés validar items.)

### Fase C — Búsqueda en Mercado Pago

**Objetivo:** chequear si existe un pago `approved` que matchee `total_ars` en una ventana temporal alrededor de `sent_at`.

- Módulo **HTTP** a:
  - `GET https://api.mercadopago.com/v1/payments/search?...`
- Header:
  - `Authorization: Bearer <ACCESS_TOKEN_MP_LECTURA>`
- Lógica:
  - 1 match exacto → rama validar.
  - 0 matches o ambigüedad → rama `manual_review`.

### Fase D — Cierre del flujo

**Objetivo:** dejar la orden con `validated` + emitir tickets, o pasar a `manual_review`.

- Rama **validar**: `POST /rest/v1/rpc/finalize_order_payment` con body:

```json
{
  "p_order_id": "{{order_id}}",
  "p_mp_payment_id": "<id_mp_o_vacio>",
  "p_actor": "make",
  "p_actor_user_id": null
}
```

- Rama **manual_review**: `PATCH /rest/v1/orders?id=eq.{{order_id}}` con body `{"status":"manual_review"}` (mismos headers service role).

### Fase E (opcional) — Mail al comprador

**Objetivo:** notificar al comprador con QR/links después de validado.

- Módulo Email/SendGrid/Gmail o lo que prefieras.
- Idealmente, dispararlo solo si la rama de validación fue OK.

---

## 4) Definition of Done de esta etapa

- [ ] Bundle del webhook capturado y `Set multiple variables` con valores reales.
- [ ] Filtro `x-webhook-secret` activo (rechaza requests sin header).
- [ ] HTTP a Supabase trayendo `orders` + `order_items` correctamente.
- [ ] HTTP a MP devolviendo resultados.
- [ ] Llamada a `finalize_order_payment` deja `orders.status = validated` y crea `tickets` sin duplicar.
- [ ] Sin match → `orders.status = manual_review`.

---

## 5) Notas operativas

- **Reiniciar dev server** después de tocar `.env.local`.
- **Scenario ON** en Make para producción real (Run once es solo para probar).
- **No exponer** el `service_role` en el browser; solo va en headers de Make/Next (server-side).
- Si tu URL de Supabase cambió por error, todo pasa a tirar 401: revisar `.env.local`.

---

*Próximo paso inmediato:* completar Fase A (A1–A4) y avisar para encarar Fase B.
