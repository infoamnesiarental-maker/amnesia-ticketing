# AmnesiaTicketing

Ticketera **multi-productora** sobre **Next.js** (`web/`) y **Supabase** (Auth, Postgres, Row Level Security, Storage).  
El comprador paga por **transferencia** al alias/CBU de la productora, sube **comprobante** y la orden queda registrada para validación.

---

## Estructura del repo

| Ruta | Rol |
|------|-----|
| `web/` | App Next.js (App Router): landing, auth, ticketera pública, panel productora, admin |
| `supabase/` | SQL de esquema, políticas RLS, RPCs públicas, hotfixes |

Variables de entorno: **`web/.env.local`** (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`; en servidor también `SUPABASE_SERVICE_ROLE_KEY` para órdenes/comprobantes y URLs firmadas).

---

## SQL en Supabase (orden recomendado)

1. `supabase/schema.sql` — tablas base (`organizations`, `events`, `ticket_types`, `orders`, etc.)
2. `supabase/policies-mvp.sql` — RLS y flujos de membresía
3. `supabase/ticketera-public.sql` — RPC `get_ticketera_data`, bucket `proofs`, políticas de órdenes
4. `supabase/public-events-catalog.sql` — columna `events.catalog_flair`, RPC `list_public_events_catalog` (catálogo de la home)
5. `supabase/event-covers-storage.sql` — bucket público `event_covers` para tapas subidas desde el panel
6. Hotfixes puntuales (`hotfix-bootstrap-organization-rpc.sql`, etc.) solo si aplica a tu instancia

---

## Rutas útiles

| Ruta | Descripción |
|------|-------------|
| `/` | Landing + **catálogo de eventos** a la venta (ISR ~60s) |
| `/auth` | Login / registro / recuperación de contraseña |
| `/e/{orgSlug}/{eventSlug}` | Ticketera pública (compra + comprobante) |
| `/app` | Panel productora (gating si la org está `pending`) |
| `/app/eventos`, `/app/eventos/nuevo`, `/app/eventos/{id}/editar` | Eventos y **datos + flair** para cards |
| `/app/eventos/{id}/entradas` | Tipos de entrada |
| `/app/ventas` | Listado de órdenes y comprobantes |
| `/admin` | Panel interno (aprobación de productoras, métricas, etc.) |

---

## Hoja de ruta

### Listo (implementado en código + SQL)

- **Multi-tenant**: organizaciones, miembros, roles, eventos, tipos de entrada, ítems de orden.
- **Auth**: Supabase Auth, pantalla `/auth` (iniciar sesión / registrarse, estilos primario/secundario, “¿Olvidaste la contraseña?” con `resetPasswordForEmail`).
- **Onboarding / estado de productora**: orgs en `pending` hasta aprobación; bloqueo del panel con mensaje y contacto; solicitudes de acceso visibles para admin.
- **Super admin**: variable `SUPERADMIN_EMAILS` en `web/.env.local`, bypass y redirección a `/admin` cuando corresponde.
- **Admin**: dashboard, productoras, usuarios, eventos globales; aprobación de organizaciones.
- **Panel productora**: eventos (CRU vía formularios), tipos de entrada, link a ticketera pública `/e/...`.
- **Datos de evento para marketing**: lugar, `starts_at`, descripción, `cover_image_url`, **`catalog_flair`** (chip en la card); creación en **Nuevo evento** y edición en **Datos y flair** (`/app/eventos/{id}/editar`).
- **Ticketera pública**: RPC `get_ticketera_data` (solo org `approved`), selección de cantidades, datos del comprador, subida de comprobante a Storage, creación de orden `pending_validation` vía **service role** (`submitPublicOrder`).
- **Landing**: hero con video, secciones informativas, **listado de eventos** vía `list_public_events_catalog` (precio desde/hasta, cupos, fecha, lugar, descripción resumida, flair, diseño de cards con hover).
- **Ventas** (`/app/ventas`): listado de órdenes de la org, ítems, **enlace firmado** al comprobante (requiere `SUPABASE_SERVICE_ROLE_KEY` en servidor).

### En progreso / siguiente (prioridad típica)

1. **Validación de pagos**  
   - **Manual** en panel: aprobar / rechazar / “revisión” y persistir `orders.status` (+ eventual `manual_review`).  
   - **Automática** (opcional): integración con API de Mercado Pago (solo lectura) o **Edge Function / n8n** que matchee monto y ventana horaria, y marque `validated`.  
   - Hoy el copy en Ventas dice explícitamente que la validación MP es el próximo paso.

2. **Post-validación**  
   - Emitir **tickets** (filas con `ticket_status`, QR único).  
   - Envío por **email** (Resend, SendGrid, o Supabase hooks).  
   - **Check-in en puerta** (escáner QR + idempotencia) en la app web o flujo dedicado.

3. **Producto / operación**  
   - Filtrado y búsqueda de órdenes en Ventas (por evento, estado, fecha).  
   - Notificaciones (mail/WhatsApp) al comprador al cambiar estado de la orden.  
   - Auditoría de RLS y pruebas automatizadas.

4. **Nice-to-have**  
   - Flag explícito **publicado / borrador** en `events` además del criterio actual (entradas en venta).  
   - SEO por evento (metadata dinámica en `/e/...`).  
   - Pagos mixtos o segunda pasarela (fuera del MVP actual).

---

## Desarrollo local

```bash
cd web
npm install
npm run dev
```

Abrí [http://localhost:3000](http://localhost:3000).

---

## Nota histórica

Un MVP anterior describía una SPA en un solo `index.html` + n8n; **el producto actual vive en `web/`** y en los SQL de `supabase/`. Si tenés documentos viejos (`proyecto.md`), contrastalos con este README.
