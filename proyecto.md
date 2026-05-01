1. Resumen ejecutivo
Ticketera es una plataforma web de venta de entradas para eventos que elimina la comisión de pasarelas de pago tradicionales. En lugar de procesar el pago a través de un intermediario (Mercado Pago como pasarela, por ejemplo), el comprador transfiere directamente al CBU/alias del organizador del evento y adjunta el comprobante. Un sistema automatizado valida la transferencia consultando la API de Mercado Pago y, si coincide el monto exacto, genera y envía los QRs de ingreso por mail.

El diferencial clave: cero comisiones de pasarela. El organizador recibe el 100% del valor de la entrada directamente en su cuenta de Mercado Pago.

Componentes principales
⦁	Ticketera pública — interfaz para que el comprador elija entradas, cargue sus datos y envíe el comprobante
⦁	Panel del organizador — vista protegida con login para gestionar el evento, ver ventas en tiempo real y controlar ingresos
⦁	Control de puerta — escáner QR integrado en el panel para validar entradas en el evento
⦁	Super admin — panel administrativo para gestionar qué productoras pueden usar el sistema
⦁	Automatización n8n/Make — workflow que valida pagos contra la API de MP y distribuye QRs
⦁	Backend Supabase — Auth + Postgres + Storage + Realtime para hacer el sistema sólido y multi-productora

Stack tecnológico
Capa	Tecnología	Motivo
Frontend	Web estática (HTML/CSS/JS o framework liviano)	Deploy simple (CDN), UX mobile-first
Escáner QR	jsQR (CDN) o equivalente	Cámara en móvil, respuesta inmediata
Backend	Supabase (Auth + Postgres + Storage + Realtime)	Fuente de verdad: seguridad, consistencia, multi-productora, realtime
Automatización	n8n o Make	Orquestación: validar MP, emitir QRs, enviar mails, alertas
Pagos	API REST de Mercado Pago (solo lectura)	Validar transferencias recibidas (sin pasarela)
QR generation	Payload JSON + UID + imagen QR (servicio/SDK)	Control de estructura del QR y trazabilidad por entrada
Mail	Proveedor vía n8n/Make (Gmail/SMTP/SendGrid)	Entrega de QRs y notificaciones sin exponer secretos en el cliente

2. Arquitectura general del sistema
El sistema está compuesto por cuatro capas que se comunican entre sí de forma asincrónica:

Capa	Descripción
1. Frontend	Web estática (ticketera + panel + puerta). Se hostea en Netlify, GitHub Pages o CDN. Consume Supabase.
2. Supabase	Backend principal: Auth (usuarios/roles), Postgres (eventos/órdenes/tickets), Storage (comprobantes), Realtime (ventas/ingresos).
3. n8n/Make	Automatización: recibe `order_id`, consulta API MP, decide validación, emite tickets/QRs, envía emails, alerta revisiones manuales.
4. Mercado Pago API	Solo lectura (GET /v1/payments/search) para verificar transferencias por monto y ventana temporal.

Flujo de datos — compra exitosa
1.	El comprador accede a la ticketera, elige entradas y completa sus datos
2.	Ve el alias/CBU del organizador y el monto exacto a transferir
3.	Realiza la transferencia desde su banco o app de Mercado Pago
4.	Sube el screenshot del comprobante (se guarda en Supabase Storage)
5.	Se crea una orden en Supabase (estado: `pending_validation`) con referencia al comprobante
6.	Supabase dispara n8n/Make enviando `order_id` (y contexto mínimo)
7.	n8n/Make consulta la API de MP buscando pagos del monto exacto en la ventana de tiempo
8.	Si encuentra coincidencia: marca orden `validated`, emite N tickets (uno por entrada) con `uid` único, genera QRs y envía mail
9.	Si no encuentra coincidencia: marca `manual_review` (o `rejected`) y alerta al organizador
10.	En la puerta del evento: se escanea el QR, se valida contra Supabase y se registra el ingreso (idempotente)


3. Módulos del sistema
3.1 Super admin — gestión de productoras
El super admin es una vista protegida con credenciales propias (distintas al login de organizador) desde donde se gestiona quién puede usar el sistema.

Funcionalidades
⦁	Ver listado de todas las productoras solicitantes
⦁	Aprobar o rechazar solicitudes de acceso
⦁	Suspender o reactivar productoras existentes
⦁	Ver métricas globales: total de eventos, total de entradas vendidas
⦁	Configurar parámetros globales del sistema

Flujo de alta de una productora
1.	La productora completa un formulario de solicitud con: nombre de la productora, mail de contacto, CUIT, y descripción breve
2.	El sistema notifica al super admin vía mail
3.	El super admin revisa y aprueba/rechaza desde el panel
4.	La productora recibe mail con sus credenciales de acceso si fue aprobada
5.	La productora puede hacer login y crear su primer evento

Modelo de datos — Productora
Campo	Tipo	Descripción
id	string (UUID)	Identificador único
nombre	string	Nombre de la productora
mail	string	Mail de contacto y login
password_hash	string	Contraseña hasheada
cuit	string	CUIT para validación
estado	enum	pendiente | aprobada | suspendida | rechazada
fecha_solicitud	datetime	Cuándo se registró
fecha_aprobacion	datetime	Cuándo fue aprobada (nullable)
alias_mp	string	Alias o CBU de Mercado Pago (configurable por evento)
mp_access_token	string (encrypted)	Token de MP para leer sus pagos

Notas (implementación profesional con Supabase)
⦁	`password_hash` se reemplaza por Supabase Auth (usuarios) + tabla de membresías/roles por productora.
⦁	`mp_access_token` nunca se expone al frontend: queda server-side (n8n/Make y/o Edge Functions) y se usa solo para leer pagos.

3.2 Panel del organizador
Una vez que la productora es aprobada por el super admin, puede acceder a su panel propio para crear y gestionar eventos.

Secciones del panel
A. Gestión de eventos
⦁	Crear nuevo evento con: nombre, fecha, lugar, descripción, imagen de portada
⦁	Configurar tipos de entradas: nombre, descripción, precio, cantidad disponible, fecha límite de venta
⦁	Activar / pausar la venta de un tipo de entrada
⦁	Ver el link de la ticketera pública para compartir

B. Ventas en tiempo real
⦁	Listado de todas las órdenes recibidas con estado: pendiente, validado, rechazado
⦁	Buscador por nombre o DNI del comprador
⦁	Filtro por tipo de entrada y por estado
⦁	Métricas: total recaudado, entradas vendidas por tipo, ingresos del día
⦁	Posibilidad de validar o rechazar manualmente una orden

C. Control de puerta (integrado)
⦁	Escáner QR que usa la cámara del dispositivo (funciona desde el celular)
⦁	Resultado inmediato: verde (válido), amarillo (ya ingresó), rojo (no encontrado)
⦁	Búsqueda por DNI o nombre como alternativa al escáner
⦁	Lista de asistentes con filtro de pendientes/ingresados
⦁	Posibilidad de marcar ingreso o revertirlo manualmente
⦁	Contador de ingresos en tiempo real en el header

D. Configuración del evento
⦁	Alias / CBU de Mercado Pago donde recibirá las transferencias
⦁	Mail del organizador para recibir alertas
⦁	URL del webhook de n8n/Make para la automatización (si se usa disparo directo)
⦁	Roles y accesos por productora (owner/admin/door) con Supabase Auth

3.3 Ticketera pública — experiencia del comprador
La interfaz que ve el comprador está diseñada para ser simple, clara y funcionar perfectamente en móvil. El flujo completo se realiza en una sola página sin redirecciones externas.

Pasos del flujo de compra
Paso	Pantalla	Qué hace el comprador
1	Elegir entrada	Selecciona el tipo de entrada (General, VIP, Early Bird, Estudiante) y la cantidad
2	Datos personales	Ingresa nombre, apellido, DNI, teléfono y mail (donde llegará el QR)
3	Pago + comprobante	Ve el alias de MP, el monto exacto, transfiere desde su banco/app y sube el screenshot del comprobante
4	Confirmación	Mensaje de éxito indicando que el comprobante fue recibido y que el QR llegará por mail

Tipos de entrada soportados
⦁	General — entrada estándar
⦁	VIP — precio mayor, puede incluir beneficios adicionales
⦁	Early Bird — precio reducido por tiempo limitado (fecha de corte configurable)
⦁	Estudiante — precio reducido, requiere presentar credencial en puerta
⦁	(Extensible: el organizador puede crear tipos personalizados)

3.4 Sistema de QR y validación de ingreso
Cada entrada genera un QR único que contiene un payload JSON con los datos del comprador y de la entrada. El QR se genera en el lado del servidor (n8n) usando una API pública gratuita.

Estructura del payload del QR
Campo	Ejemplo	Descripción
evento	Festival Primavera 2025	Nombre del evento
nombre	Juan García	Nombre del comprador
dni	12345678	DNI del comprador
ticket	VIP	Tipo de entrada
ticket_id	vip	ID interno del tipo
numero	2	Número de esta entrada en la orden
total	3	Total de entradas en la orden
pago_id	123456789	ID del pago en Mercado Pago
uid	12345678-vip-2-a3f9	Identificador único e irrepetible de este QR
emitido	2025-11-20T18:30:00Z	Timestamp de emisión del QR

Seguridad del QR: el campo uid es único por entrada. Aunque alguien copie el QR, el sistema marca el primero que ingresa como válido y los siguientes intentos devuelven "ya ingresó".


4. Integración con Mercado Pago
Este es el punto más importante y diferencial del sistema. No se usa Mercado Pago como pasarela de pago (lo que implicaría comisiones del 3.5% a 6%). En cambio, se usa la API de MP solo para leer y verificar las transferencias que llegaron a la cuenta del organizador.

IMPORTANTE: El organizador debe tener una cuenta de Mercado Pago y compartir su Access Token productivo. Este token permite a n8n leer los pagos recibidos en su cuenta. No permite hacer cobros ni mover fondos — solo leer.

4.1 Cómo funciona la validación sin pasarela
El flujo de validación funciona de la siguiente manera:

1.	El comprador hace una transferencia DIRECTA al alias/CBU del organizador desde su homebanking o la app de Mercado Pago (opción "Transferir a contacto" o "Enviar dinero").
2.	Esta transferencia llega como un pago del tipo "account_money" o "bank_transfer" en la cuenta de MP del organizador.
3.	El comprador sube el screenshot del comprobante en la ticketera.
4.	n8n recibe los datos y hace un GET a la API de MP buscando pagos aprobados en la ventana de tiempo (±30 minutos del envío del formulario) con el monto EXACTO al total de la orden.
5.	Si encuentra un pago coincidente, valida la orden y genera los QRs.
6.	Si no encuentra coincidencia, alerta al organizador.

4.2 Endpoint de la API utilizado
Solo se utiliza un endpoint de lectura:

Atributo	Valor
Método	GET
URL	https://api.mercadopago.com/v1/payments/search
Auth	Authorization: Bearer {ACCESS_TOKEN}
Parámetros	sort=date_created, criteria=desc, status=approved, begin_date, end_date
Respuesta	JSON con array results[] de pagos

Parámetros de búsqueda que usa n8n
⦁	status=approved — solo pagos ya acreditados
⦁	begin_date — timestamp del envío del formulario menos 15 minutos
⦁	end_date — timestamp del envío del formulario más 60 minutos
⦁	sort=date_created + criteria=desc — primero los más recientes

Lógica de matching
n8n busca en el array de pagos devuelto por MP el primero que cumpla:
⦁	transaction_amount coincide EXACTAMENTE con el total esperado (diferencia < $1 para evitar problemas de centavos)
⦁	date_created está dentro de la ventana horaria configurada
⦁	status = approved

Limitación conocida: si dos personas compran el mismo tipo y cantidad de entradas casi al mismo tiempo y ambas pagan el mismo monto, puede haber ambigüedad. Recomendación: el organizador puede agregar centavos únicos por orden (ej: $3500.01, $3500.02) para diferenciarlas. Esto es una mejora futura.

4.3 Cómo obtener el Access Token de Mercado Pago
1.	Ir a https://www.mercadopago.com.ar/developers/panel
2.	Crear una aplicación nueva (o usar una existente)
3.	En la sección "Credenciales de producción", copiar el Access Token
4.	Este token empieza con APP_USR-...
5.	Pegarlo en la variable de entorno MP_ACCESS_TOKEN de n8n

El Access Token productivo solo funciona cuando la cuenta de MP está verificada (identidad confirmada). Para pruebas usar el token de sandbox con pagos de prueba.

4.4 Tipos de transferencias compatibles
La API de MP devuelve como "pago aprobado" las siguientes operaciones que hace el comprador:

Tipo de operación	Descripción	Aparece en API
Transferencia desde app MP	El comprador usa "Enviar dinero" dentro de Mercado Pago	Sí — inmediato
Transferencia bancaria (CVU)	El comprador transfiere desde homebanking al CVU de MP	Sí — puede demorar hasta 1 hora
Transferencia CBU a CVU	Desde cuenta bancaria tradicional al CVU del organizador	Sí — puede demorar hasta 24hs
Pago por QR de MP	El comprador escanea QR de cobro de MP	No aplica — este método no se usa
Pago por link de MP	Link de pago generado por MP	No aplica — este método no se usa

Recomendación para el comprador: la forma más rápida es la transferencia dentro de la propia app de Mercado Pago ("Enviar dinero a alias"). Se acredita en segundos y aparece inmediatamente en la API.


5. Automatización con n8n/Make
n8n/Make es la capa de automatización/orquestación. En la versión profesional, **Supabase es el backend principal** y n8n/Make se usa para integrar Mercado Pago (solo lectura), emitir QRs/tickets y enviar mails/alertas sin exponer secretos en el cliente.

5.1 Workflow principal — Validación y envío de QRs
Este workflow se activa cada vez que un comprador envía su comprobante desde la ticketera.

#	Nodo	Tipo	Función
1	Webhook entrada	Webhook (POST)	Recibe `order_id` + contexto mínimo (event_id/org_id). No recibe base64.
2	Leer orden	Supabase (HTTP/SDK)	Obtiene datos de orden, buyer, items, total y `proof_url` (Storage).
3	Extraer datos	Code (JS)	Calcula ventana horaria para buscar en MP (± tiempo configurable).
4	Buscar pagos MP	HTTP Request (GET)	Consulta /v1/payments/search con los parámetros de tiempo y estado.
5	Verificar monto	Code (JS)	Compara total esperado vs `transaction_amount` (tolerancia configurable).
6	¿Monto coincide?	IF node	Bifurca el flujo según si se encontró coincidencia o no.
7a	Emitir tickets	Code (JS)	Genera N `uid` (uno por entrada), arma payload JSON por ticket.
8a	Persistir en Supabase	Supabase (HTTP/SDK)	`orders.status=validated` + inserta `tickets` (uid/payload) + guarda `mp_payment_id`.
9a	Enviar mail con QR	Email node	Envía al comprador sus QRs (y datos de la entrada).
7b	Marcar revisión manual	Supabase (HTTP/SDK)	`orders.status=manual_review` (o `rejected`) + motivo.
8b	Alerta manual	Email node	Notifica al organizador que hay una orden para revisar.

5.2 Configuración requerida en n8n
Variables de entorno
Variable	Descripción	Ejemplo
MP_ACCESS_TOKEN	Access Token productivo de Mercado Pago del organizador	APP_USR-1234...
ORGANIZADOR_MAIL	Mail del organizador para alertas de validación manual	org@evento.com
SUPABASE_URL	URL del proyecto Supabase	https://xxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY	Clave server-side para escribir en Supabase	(Secreto)

Credenciales a configurar
⦁	Gmail OAuth2 / SMTP / SendGrid — para enviar mails al comprador y al organizador
⦁	HTTP Header Auth — Authorization: Bearer {MP_ACCESS_TOKEN} — para consultar la API de MP
⦁	HTTP Requests a Supabase (REST) o SDK server-side para leer/escribir DB

Cómo importar el workflow
1.	Abrir n8n (app.n8n.io o instancia propia)
2.	Ir a Workflows → Import from JSON
3.	Pegar el contenido del archivo n8n-workflow.json provisto
4.	Asignar las credenciales a cada nodo (aparece un aviso amarillo)
5.	Configurar las variables de entorno en Settings → Variables
6.	Activar el workflow con el toggle de la esquina superior derecha
7.	Copiar la Production URL del nodo Webhook y pegarla en la configuración de la ticketera

5.3 Workflow secundario — Sincronización de puerta
Opcional. Permite que múltiples personas con el panel de puerta abierto en sus teléfonos estén sincronizadas en tiempo real sobre quién ingresó.

⦁	En la versión profesional, la sincronización se resuelve con Supabase Realtime sobre `checkins`/`tickets`.
⦁	Alternativa: si se requiere auditoría extra o integraciones, la app de puerta puede notificar a n8n/Make y éste registrar/alertar.


6. Super admin — Especificación técnica
El super admin es la capa superior del sistema que controla el acceso de productoras. Es una vista separada protegida con credenciales fijas (o variables de entorno).

6.1 Funcionalidades detalladas
Panel de solicitudes
⦁	Tabla con todas las productoras en estado "pendiente"
⦁	Datos visibles: nombre, mail, CUIT, fecha de solicitud, descripción
⦁	Botones de acción: Aprobar / Rechazar (con campo de motivo para el rechazo)
⦁	Al aprobar: se generan credenciales de acceso y se envía mail de bienvenida
⦁	Al rechazar: se envía mail con el motivo

Panel de productoras activas
⦁	Tabla con productoras aprobadas: nombre, mail, fecha de aprobación, cantidad de eventos, estado
⦁	Acciones: ver detalle, suspender temporalmente, revocar acceso
⦁	Filtros por estado: todas / activas / suspendidas

Panel de métricas globales
⦁	Total de productoras activas
⦁	Total de eventos publicados (activos y finalizados)
⦁	Total de entradas vendidas en todo el sistema
⦁	Total recaudado (suma de todas las ventas validadas)

6.2 Flujo técnico de aprobación
En la implementación profesional (Supabase + n8n/Make), el flujo funciona así:

1.	La productora completa el formulario de solicitud → se crea registro en Supabase con estado "pendiente"
2.	n8n/Make notifica al super admin (mail)
3.	El super admin aprueba/rechaza desde el panel
4.	Si aprobada: se habilitan miembros/roles en Supabase Auth y la productora recibe mail de bienvenida
5.	Si rechazada/suspendida: se revoca acceso y se notifica por mail

6.3 Seguridad del super admin
⦁	Credenciales separadas de las del organizador (usuario y contraseña propios)
⦁	Recomendado: usar una contraseña larga y única almacenada en variable de entorno
⦁	El panel de super admin no debe ser público — considerar básico HTTP auth o acceso por IP
⦁	Todos los cambios de estado de productoras quedan registrados con timestamp


7. Roadmap de desarrollo
Fase 1 — MVP profesional (objetivo actual)
⦁	Backend Supabase (Auth + Postgres + Storage + Realtime)
⦁	Multi-productora desde el inicio (organizations + roles)
⦁	Ticketera pública: orden en DB + comprobante en Storage
⦁	Workflow n8n/Make: validación MP + emisión tickets (uid) + envío mail
⦁	Puerta: escáner QR validando contra DB + check-in idempotente
⦁	Panel organizador: ventas e ingresos en tiempo real (Realtime)

Fase 2 — Robustez y escala
⦁	Deduplicación de pagos MP (centavos únicos por orden o matching por metadata)
⦁	Reintentos/colas y expiración de órdenes pendientes
⦁	Dashboard de analytics por evento y productora
⦁	Exportación de asistentes a CSV/Excel
⦁	Marca blanca: colores/logo por productora

Fase 3 — Robustez y escala
⦁	Deduplicación de pagos MP (centavos únicos por orden o matching por descripción)
⦁	Sincronización en tiempo real de la puerta (WebSocket o polling)
⦁	App móvil nativa para control de puerta (PWA o React Native)
⦁	Dashboard de analytics por evento y por productora
⦁	Exportación de asistentes a CSV/Excel
⦁	Sistema de reembolsos (workflow n8n separado)

Fase 4 — Producto comercial
⦁	Modelo de suscripción para productoras (fee fijo mensual en lugar de % por entrada)
⦁	Marca blanca: las productoras pueden personalizar colores y logo
⦁	API pública para integrar con otros sistemas
⦁	Soporte para múltiples cuentas de MP por productora (diferentes eventos, diferentes cuentas)


8. Instalación y deployment
8.1 Frontend (ticketera-completa.html)
El archivo HTML no requiere build ni servidor. Para que la cámara funcione en el escáner de puerta, el archivo debe servirse por HTTPS (los navegadores bloquean el acceso a cámara en file://).

Opción A — Netlify (recomendado, gratis)
1.	Crear cuenta en netlify.com
2.	Arrastrar el archivo HTML a la zona de deploy
3.	Netlify genera una URL HTTPS automáticamente (ej: my-ticketera.netlify.app)
4.	Listo — la cámara funciona desde celular

Opción B — GitHub Pages (gratis)
1.	Crear repositorio en GitHub con el archivo index.html
2.	Ir a Settings → Pages → Source: main branch
3.	URL generada: usuario.github.io/repo-name

Opción C — Servidor propio
1.	Cualquier servidor web (nginx, Apache, Caddy)
2.	El archivo HTML va en el directorio público
3.	Requiere certificado SSL (Let's Encrypt es gratuito)

8.2 n8n
Opción A — n8n Cloud (más fácil)
⦁	Registrarse en app.n8n.io
⦁	Plan gratuito: 2 workflows activos, 200 ejecuciones/mes (suficiente para eventos pequeños)
⦁	Plan Starter: ~$20 USD/mes para uso comercial

Opción B — Self-hosted con Railway
1.	Crear cuenta en railway.app
2.	Nuevo proyecto → Deploy from template → buscar "n8n"
3.	Railway genera URL automática con HTTPS
4.	Costo: ~$5-10 USD/mes según uso

Opción C — Self-hosted con Docker
docker run -it --rm -p 5678:5678 -v ~/.n8n:/home/node/.n8n n8nio/n8n

8.3 Supabase (backend)
1.	Crear un nuevo proyecto en Supabase
2.	Crear tablas + RLS (organizations, members/roles, events, ticket_types, orders, tickets, checkins)
3.	Crear bucket Storage para comprobantes (ej: `proofs`)
4.	Configurar Auth (email/password o magic link) para organizadores
5.	Configurar Realtime para ventas/ingresos (subscriptions en panel)
6.	Guardar secretos server-side (Service Role, MP tokens) en n8n/Make o Edge Functions (nunca en el cliente)


9. Preguntas frecuentes

¿Qué pasa si el comprador paga el monto equivocado?
n8n no encontrará coincidencia y alertará al organizador. El organizador puede validar manualmente desde su panel o contactar al comprador.

¿Qué pasa si la transferencia tarda más de 60 minutos en acreditarse?
Si la transferencia es bancaria (CBU a CVU) puede demorar hasta 24 horas. En ese caso la validación automática fallará y alertará al organizador para revisión manual. Se recomienda indicar claramente en la ticketera que el método preferido es transferencia dentro de Mercado Pago.

¿El comprador puede transferir desde cualquier banco?
Sí. El CVU de Mercado Pago es compatible con transferencias desde cualquier banco argentino (CBU a CVU). La acreditación puede tardar más que dentro de MP, pero eventualmente llega.

¿Se puede usar con múltiples eventos simultáneos?
Sí. Cada evento tiene su propia instancia de la ticketera (archivo HTML configurado) y su propio webhook en n8n. El organizador puede tener varios eventos activos al mismo tiempo.

¿Cómo se evita que alguien presente el mismo QR dos veces?
El sistema marca cada UID como "ingresado" en el momento del primer escaneo. Los intentos posteriores devuelven "ya ingresó" con la hora del primer ingreso. El QR en sí no se invalida, pero el sistema lo detecta.

¿Se puede usar offline la app de puerta?
Sí, la app de puerta guarda todos los datos en localStorage del dispositivo. Puede funcionar offline si los QRs fueron sincronizados previamente. Los cambios (ingresos) se sincronizan cuando vuelve la conexión.

¿Cuánto cuesta el sistema completo?
Componente	Costo
Frontend (Netlify gratuito)	$0
n8n Cloud (plan gratuito — hasta 200 ejecuciones/mes)	$0
n8n Cloud (plan Starter — uso comercial)	~$20 USD/mes
Google Sheets	$0 (hasta 15GB)
Mercado Pago (sin pasarela)	$0 de comisión por transacción
TOTAL para evento pequeño	$0
TOTAL para uso comercial regular	~$20 USD/mes


10. Glosario

Término	Definición
Pasarela de pago	Intermediario que procesa pagos con tarjeta o billeteras digitales, cobrando una comisión (ej: Mercado Pago Checkout, Stripe)
CBU	Clave Bancaria Uniforme — identificador único de una cuenta bancaria en Argentina
CVU	Clave Virtual Uniforme — equivalente al CBU pero para billeteras digitales como Mercado Pago
Alias	Nombre corto y fácil de recordar asociado a un CBU o CVU (ej: juan.garcia.mp)
Access Token	Credencial secreta que permite a una aplicación acceder a la API de Mercado Pago en nombre del usuario
QR	Código de respuesta rápida (Quick Response) — imagen 2D que contiene información codificada escaneable por cámara
n8n	Plataforma de automatización open source con interfaz visual. Permite conectar servicios y crear flujos de trabajo sin código
MCP	Model Context Protocol — protocolo que permite a Claude interactuar con herramientas y servicios externos desde la terminal (Claude Code)
Webhook	URL que recibe notificaciones HTTP en tiempo real cuando ocurre un evento en otro sistema
UID	Identificador único — string irrepetible que identifica cada QR de entrada
localStorage	Almacenamiento local del navegador que persiste datos sin necesidad de servidor
Self-hosted	Alojar y gestionar el software en tu propio servidor en lugar de usar un servicio cloud
