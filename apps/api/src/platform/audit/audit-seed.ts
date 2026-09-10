// Lista base de la auditoría interna de Órbita (super admin → Auditoría).
//
// Cada ítem es algo que hay que revisar: un módulo de la API, una pantalla del
// panel o de la tienda, una revisión transversal, o un hallazgo concreto que
// dejó una auditoría anterior. Trae `foco` (qué mirar) y `checks` (las
// verificaciones concretas que hay que hacer para darlo por auditado).
//
// Se upsertea por `key` al listar (PlatformAuditService.asegurarSeed): lo que
// el equipo ya cargó nunca se pisa. Para sumar un ítem nuevo alcanza con
// agregarlo acá; para retirar uno, sacarlo de acá NO lo borra de la base
// (queda con lo que el equipo cargó) — se borra a mano si hace falta.
//
// Origen del inventario: el artifact "Auditoría de módulos — Órbita" de Mateo
// (84 módulos, 2026-09-09) contrastado contra el repo real, más el
// "Expediente de seguridad — Storefront y wizard de pagos" (08-09/09) y la
// auditoría técnica del 04/09 (Auditoria-Orbita-2026-09-04.html).

export type SeedArea = 'BACKEND' | 'FRONTEND' | 'TRANSVERSAL' | 'HALLAZGO';
export type SeedSeveridad = 'CRITICA' | 'ALTA' | 'MEDIA' | 'BAJA' | 'INFO';
export type SeedEstado = 'PENDIENTE' | 'EN_CURSO' | 'HECHO';

export interface SeedItem {
  key: string;
  area: SeedArea;
  grupo: string;
  titulo: string;
  ruta?: string;
  foco: string;
  severidad?: SeedSeveridad;
  // Solo para lo que YA se hizo y quedó documentado (hallazgos resueltos,
  // controles verificados). El resto arranca PENDIENTE.
  estado?: SeedEstado;
  checks: string[];
  // true = las verificaciones ya se hicieron (ítems HECHO del seed).
  checksHechos?: boolean;
  informeUrl?: string;
  notas?: string;
}

// Verificaciones que aplican a CUALQUIER módulo de la API con endpoints. Se
// suman al final de los checks propios de cada módulo del backend.
const BASE_API: string[] = [
  'Todos los endpoints filtran por businessId del token (nunca del body ni de la URL)',
  'Cada DTO valida tipos y rangos; nada llega al servicio sin pasar por class-validator',
  'Los errores devuelven mensajes genéricos, sin stack traces ni datos internos',
];

const BASE_WEB: string[] = [
  'Ningún control de permisos vive solo en el front: el backend rechaza igual',
  'Nada se renderiza con dangerouslySetInnerHTML ni innerHTML sin sanitizar',
  'Los datos sensibles no quedan en la URL, en localStorage ni en el bundle',
];

function api(key: string, grupo: string, titulo: string, foco: string, checks: string[]): SeedItem {
  return { key: `api.${key}`, area: 'BACKEND', grupo, titulo, ruta: `apps/api/src/${key}`, foco, checks: [...checks, ...BASE_API] };
}

function web(key: string, grupo: string, titulo: string, ruta: string, foco: string, checks: string[]): SeedItem {
  return { key: `web.${key}`, area: 'FRONTEND', grupo, titulo, ruta, foco, checks: [...checks, ...BASE_WEB] };
}

// ─── Backend · Núcleo · plataforma · multi-tenant ────────────────────────────
const G_NUCLEO = 'Núcleo · plataforma · multi-tenant';
const NUCLEO: SeedItem[] = [
  api('auth', G_NUCLEO, 'auth', 'JWT (firma HS256, expiración), rotación de refresh_tokens, reset single-use, rate-limit de login, enumeración de usuarios.', [
    'JWT_SECRET tiene 32+ caracteres y el token expira en un plazo corto (revisar auth.service.ts)',
    'El refresh token rota en cada uso y el anterior queda invalidado (tabla refresh_tokens)',
    'El token de reset de contraseña es de un solo uso y vence (password_reset_tokens)',
    'Login con throttling por IP y por email (AuthThrottlerGuard) y bloqueo tras N intentos',
    'Login y "olvidé mi contraseña" responden igual exista o no el email (sin enumeración)',
    'El mismo email en dos negocios tiene credenciales aisladas (member vs customer)',
    'El segundo factor del platform admin (código por mail) vence y bloquea tras intentos fallidos',
  ]),
  api('common', G_NUCLEO, 'common', 'auth.guard y guard de roles, extracción de businessId, filtro global de errores (fuga de stack traces).', [
    'AuthGuard global: un endpoint sin @Public() nunca queda accesible sin token',
    'RolesGuard y PermissionsGuard cubren todas las rutas de escritura del panel',
    'El businessId sale del token o del slug verificado, nunca de un header sin validar',
    'HttpExceptionFilter no expone stack traces ni mensajes de Prisma en producción',
    'AddonGuard se aplica en TODOS los endpoints de funciones pagas (ver hallazgo del 04/09)',
  ]),
  api('prisma', G_NUCLEO, 'prisma', 'Consultas sin filtro businessId, uso de $queryRaw / SQL crudo, campos sensibles en selects.', [
    'Ningún $queryRaw/$executeRaw interpola strings del usuario (solo template tag con parámetros)',
    'findMany/findFirst sobre tablas con business_id siempre llevan el where del negocio',
    'passwordHash y tokens nunca salen en un select/include hacia el cliente',
    'Los borrados lógicos (deletedAt) se respetan en todas las lecturas',
  ]),
  api('platform', G_NUCLEO, 'platform', 'Configuración, servicios base, endpoints internos y su exposición.', [
    'PlatformAdminGuard cubre el controller entero (incluida esta auditoría)',
    'Las acciones sensibles (suspender, cortesía, admins, descuentos) quedan en platform_admin_logs',
    'OPERATOR vs SUPERADMIN: qué puede hacer cada rol está definido y aplicado',
    'Los códigos de descuento de plataforma al 100% (alta gratis) tienen tope de usos',
  ]),
  api('internal-cron', G_NUCLEO, 'internal-cron', 'Endpoints de cron sin secreto/auth, idempotencia de jobs, ejecución concurrente.', [
    'Todos los endpoints de cron exigen CRON_SECRET (InternalCronSecretGuard) y no son @Public()',
    'La comparación del secreto es en tiempo constante (crypto.timingSafeEqual) — hallazgo BAJO del 09/09',
    'Cada job es idempotente: correrlo dos veces seguidas no duplica efectos',
    'Dos ejecuciones simultáneas del mismo job no se pisan (lock o transacción)',
  ]),
  api('businesses', G_NUCLEO, 'businesses', 'Aislamiento entre negocios, alta/baja, escalada de tenant.', [
    'Un member no puede leer ni editar datos de otro negocio cambiando el slug o el id',
    'publish() exige suscripción real pagada (fix del 09/09, commit 42649a5)',
    'La baja/suspensión de un negocio deja su tienda inaccesible de verdad',
    'El cambio de subdominio valida formato y no permite pisar el de otro negocio',
  ]),
  api('branches', G_NUCLEO, 'branches', 'Permisos por sucursal, IDOR entre sucursales de un mismo negocio.', [
    'Una sucursal solo se lee/edita si pertenece al negocio del token',
    'Los empleados con sucursal asignada no ven datos de otras sucursales',
    'Borrar una sucursal con pedidos o stock asociado se rechaza o migra',
  ]),
  api('domains', G_NUCLEO, 'domains', 'Verificación de propiedad del dominio, SSRF en los checks, domain takeover.', [
    'La verificación de propiedad (DNS/TXT) no se puede saltear ni forzar desde el body',
    'Los checks de dominio no hacen requests a URLs arbitrarias (SSRF)',
    'Un dominio ya vinculado a un negocio no se puede vincular a otro',
    'El webhook de Vercel/registrar valida origen antes de cambiar estado',
  ]),
  api('members', G_NUCLEO, 'members', 'Invitaciones, permisos del panel, IDOR sobre otros miembros.', [
    'La invitación es de un solo uso, vence y solo la acepta el email invitado',
    'Un empleado no puede subirse a sí mismo el rol ni editar a un owner',
    'Un member no puede ver/editar members de otro negocio (members-escalation.e2e cubre esto)',
    'No se puede borrar ni degradar al último owner del negocio',
  ]),
  api('member-profile', G_NUCLEO, 'member-profile', 'Datos del miembro, cambio de email/contraseña, verificación del actor.', [
    'Cambiar contraseña exige la contraseña actual',
    'Cambiar email revalida el nuevo email y no colisiona con otro member del negocio',
    'El perfil solo edita al actor del token, nunca a un id del body',
  ]),
  api('roles', G_NUCLEO, 'roles', 'Escalada de privilegios, IDOR en asignación, borrado del último admin.', [
    'Solo un owner/admin puede asignar roles y nunca por encima del propio',
    'Los permisos custom no pueden otorgar capacidades que el rol base no tiene',
    'No se puede quedar un negocio sin ningún rol con permiso de administración',
  ]),
  api('customers', G_NUCLEO, 'customers', 'Credenciales aisladas por negocio, mismo email member/customer, flujo de reset.', [
    'Un customer de un negocio no puede loguearse en otro con las mismas credenciales',
    'El reset de contraseña de customer va scopeado al negocio (X-Business-Slug)',
    'El panel no puede ver la contraseña ni el hash de un cliente',
    'Exportar clientes queda restringido a roles con permiso y se registra',
  ]),
  api('me', G_NUCLEO, 'me', 'Qué devuelve el endpoint de sesión, sobre-exposición de campos.', [
    '/me devuelve solo lo que el front necesita (sin hash, sin tokens, sin flags internos)',
    'Las direcciones y pedidos de /me son solo del customer del token (me-*.e2e)',
    'Cerrar sesión invalida el refresh token del lado del servidor',
  ]),
  api('supabase', G_NUCLEO, 'supabase', 'Claves de servicio en código, permisos de buckets, URLs firmadas y su TTL.', [
    'SUPABASE_SERVICE_ROLE_KEY solo vive en secretos de Cloud Run, nunca en el bundle',
    'Los buckets públicos solo contienen assets que deben ser públicos',
    'Las subidas validan tipo, tamaño y se recodifican (webp) — hallazgo BAJO: sin límite explícito',
    'Las políticas RLS de Supabase están revisadas (nunca se auditaron)',
  ]),
  api('audit', G_NUCLEO, 'audit', 'Qué acciones se registran realmente, inmutabilidad del log, PII en el registro.', [
    'Las acciones sensibles del panel (cambios de precio, borrados, roles) quedan registradas',
    'El log no se puede editar ni borrar desde ningún endpoint',
    'El log no guarda PII innecesaria (contraseñas, tokens, datos de tarjeta)',
  ]),
];

// ─── Backend · Comercio · ventas ─────────────────────────────────────────────
const G_COMERCIO = 'Comercio · ventas';
const COMERCIO: SeedItem[] = [
  api('products', G_COMERCIO, 'products', 'Precio/estado editables sin control, borrado lógico, IDOR entre negocios.', [
    'Editar precio/estado exige permiso de catálogo y queda en el log de auditoría',
    'Un producto de otro negocio no se lee ni edita por id (404 uniforme)',
    'Los productos borrados no aparecen en la tienda ni en búsquedas',
    'removeBackground revalida el add-on Avanzado en el backend',
  ]),
  api('categories', G_COMERCIO, 'categories', 'Jerarquía, alcance por negocio, referencias cruzadas.', [
    'No se puede asignar un producto a una categoría de otro negocio',
    'La jerarquía no admite ciclos ni padres de otro negocio',
    'Borrar una categoría con productos deja los productos consistentes',
  ]),
  api('tags', G_COMERCIO, 'tags', 'Alcance por negocio, XSS almacenado en el nombre del tag.', [
    'El nombre del tag se guarda con longitud acotada y se escapa al renderizar',
    'Los tags son por negocio: no se listan ni asignan los de otro',
  ]),
  api('inventory', G_COMERCIO, 'inventory', 'Condiciones de carrera en stock, stock negativo, reserva de stock en checkout.', [
    'El descuento de stock ocurre en transacción y no permite quedar negativo',
    'Dos compras simultáneas del último ítem no lo venden dos veces',
    'La venta presencial (POS) descuenta stock igual que la online (descontarStockEnTx)',
    'Los ajustes manuales de stock quedan registrados con quién y por qué',
  ]),
  api('search', G_COMERCIO, 'search', 'Inyección en filtros/orden, fuga de productos de otro negocio.', [
    'Los parámetros de orden/filtro se validan contra una lista blanca',
    'La búsqueda pública solo devuelve productos activos del negocio del slug',
    'No hay $queryRaw con texto del usuario en la búsqueda (search.e2e)',
  ]),
  api('orders', G_COMERCIO, 'orders', 'IDOR en detalle de pedido, recálculo de totales server-side, precios enviados desde el cliente.', [
    'El total del pedido se recalcula en el servidor a partir de precios de la base (verificado 04/09 y 09/09)',
    'El detalle de un pedido solo lo ve su comprador o el panel del negocio (UUID + 404 uniforme)',
    'El seguimiento de invitado no expone datos de otro pedido adivinando ids',
    'channel POS solo se acepta desde el panel autenticado, nunca desde publicCheckout',
    'Cambiar estado sigue la máquina de estados (no se puede saltar a COMPLETED desde cualquiera)',
  ]),
  api('cancellations', G_COMERCIO, 'cancellations', 'Cancelación fuera de estado válido, reembolso asociado, IDOR.', [
    'Solo se cancela desde estados que lo permiten y por quien corresponde',
    'Cancelar repone stock y dispara el reembolso una sola vez',
    'Un cliente no puede cancelar pedidos ajenos',
  ]),
  api('returns', G_COMERCIO, 'returns', 'Reembolsos indebidos, doble devolución, emisión de notas de crédito.', [
    'No se puede devolver más cantidad ni más monto que lo comprado',
    'Una devolución ya procesada no se puede procesar dos veces',
    'La nota de crédito la emite solo el panel con permiso y queda auditada',
  ]),
  api('return-requests', G_COMERCIO, 'return-requests', 'Aprobación sin control, IDOR sobre solicitudes ajenas.', [
    'Solo el negocio dueño del pedido aprueba/rechaza la solicitud',
    'El cliente solo ve y crea solicitudes de sus propios pedidos',
    'El formulario público de devolución valida el pedido y el email del comprador',
  ]),
  api('payments', G_COMERCIO, 'payments', 'Verificación de monto/estado contra el proveedor, idempotencia, estados de pago manipulables.', [
    'Antes de aprobar, el monto y el estado se reconsultan a MercadoPago (verificado 09/09)',
    'Reintentos del webhook y del navegador no duplican altas ni cobros (verificado 09/09)',
    'El estado de un pago no se puede cambiar desde un endpoint público',
    'Los pagos POS (efectivo/transferencia) solo los registra el panel y quedan con verifiedBy',
  ]),
  api('mercadopago', G_COMERCIO, 'mercadopago', 'Validación de firma del webhook, replay, doble acreditación, secretos en env.', [
    'Con MP_WEBHOOK_SECRET faltante el webhook RECHAZA en vez de aceptar sin firma (hallazgo MEDIO 09/09)',
    'La firma x-signature se valida con timestamp y ventana contra replay',
    'Un mismo id de pago procesado dos veces no acredita dos veces',
    'Access token y secretos solo en secretos de Cloud Run',
  ]),
  api('subscriptions', G_COMERCIO, 'subscriptions', 'Activación de plan sin pago confirmado, límites de plan aplicados server-side, up/downgrade.', [
    'La suscripción solo pasa a ACTIVE después de confirmar el pago con MercadoPago',
    'Los límites del plan (productos, add-ons) se aplican en el backend, no solo en la UI',
    'El cron de mora suspende negocios vencidos y la cortesía (COMP) tiene fecha de fin',
    'Cambiar de plan (up/downgrade) cobra o acredita lo correcto y queda registrado',
  ]),
  api('discounts', G_COMERCIO, 'discounts', 'Descuentos acumulables, total por debajo de 0, validez temporal.', [
    'El total nunca queda negativo ni por debajo del costo de envío',
    'Las reglas de acumulación entre descuentos, cupones y 2x1 están definidas y probadas',
    'startDate/endDate se evalúan en el servidor con el instante correcto (relámpago = instante exacto)',
    'La oferta relámpago revalida el add-on y el interruptor (flashSaleEnabled) en el endpoint público',
  ]),
  api('coupons', G_COMERCIO, 'coupons', 'Reuso de cupón single-use, fuerza bruta de códigos, alcance por negocio.', [
    'Un cupón de un solo uso no se puede canjear dos veces ni en dos pedidos simultáneos',
    'La validación de cupón tiene rate limit (fuerza bruta de códigos)',
    'Un cupón de un negocio no aplica en otro',
    'El canje queda ligado al pedido (orders-coupon-redemption.e2e)',
  ]),
  api('two-for-one', G_COMERCIO, 'two-for-one', 'Combinación con otras promos, abuso de cantidades, ítems gratis no previstos.', [
    'El 2x1/3x2 se calcula en el servidor sobre cantidades reales del carrito',
    'No se combina con otro descuento sobre el mismo ítem salvo que esté previsto',
    'Revalida el add-on Avanzado en el endpoint público (hallazgo ALTO 04/09)',
  ]),
  api('reviews', G_COMERCIO, 'reviews', 'Reseña sin compra previa, XSS almacenado en el texto, spam.', [
    'Solo puede reseñar quien tiene un pedido completado con ese producto',
    'El texto se acota en longitud y se escapa al renderizar',
    'Hay rate limit por cliente y el negocio puede moderar/ocultar',
  ]),
  api('reports', G_COMERCIO, 'reports', 'Fuga de datos agregados de otro negocio, exportables sin control.', [
    'Todos los agregados filtran por businessId (reports-analytics.e2e)',
    'Las exportaciones exigen permiso y no incluyen PII innecesaria',
    'El dashboard no expone datos de otros negocios por parámetros de fecha/sucursal',
  ]),
  api('wizard-analytics', G_COMERCIO, 'wizard-analytics', 'PII en eventos, alcance por negocio, retención.', [
    'Los eventos públicos del wizard no guardan PII más allá de lo necesario',
    'La escritura pública tiene rate limit y validación de esquema',
    'La lectura de analítica solo desde el super admin (PlatformAdminGuard)',
    'Hay política de retención/limpieza de eventos viejos',
  ]),
];

// ─── Backend · Storefront · marketing · conversión ───────────────────────────
const G_STORE = 'Storefront · marketing · conversión';
const STORE: SeedItem[] = [
  api('storefront', G_STORE, 'storefront', 'Qué campos se exponen sin auth, resolución de tenant por dominio/slug, rate-limit.', [
    'La respuesta pública del storefront no incluye datos internos del negocio (mails, credenciales MP, flags)',
    'El tenant se resuelve por dominio/slug verificado y un slug inexistente da 404',
    'Los endpoints públicos tienen rate limit razonable',
    'Las páginas legales muestran los datos del comercio correcto',
  ]),
  api('promo-modal', G_STORE, 'promo-modal', 'XSS en contenido configurable, HTML sin sanitizar que llega al storefront público.', [
    'Título/mensaje se renderizan como texto, nunca como HTML',
    'ctaLink solo acepta rutas relativas de la propia tienda (hallazgo BAJO 04/09: hoy acepta dominios externos)',
    'Revalida el add-on Avanzado en el endpoint público (hallazgo ALTO 04/09)',
  ]),
  api('countdown', G_STORE, 'countdown (oferta relámpago)', 'Lógica de fechas, manipulación client-side de la oferta.', [
    'La oferta programada no se expone hasta que empieza (getActiveCountdown mira startDate)',
    'El descuento aplicado lo calcula el servidor, no el reloj del navegador',
    'Con el interruptor apagado o sin add-on la tienda no recibe nada (unit + e2e de countdown)',
  ]),
  api('social-proof', G_STORE, 'social-proof', 'PII de compras reales de clientes expuesta públicamente.', [
    'El feed público muestra nombre acortado y nunca email, dirección ni monto identificable',
    'Solo usa pedidos reales y respeta la ventana de tiempo configurada',
    'Revalida el add-on Avanzado en el endpoint público (hallazgo ALTO 04/09)',
  ]),
  api('games', G_STORE, 'games', 'Premios/cupones resueltos client-side, repetición de jugadas, alcance del premio.', [
    'El resultado del juego lo decide el servidor, no el cliente',
    'Un visitante no puede jugar más veces que las permitidas (ni borrando localStorage)',
    'Revalida el add-on Avanzado en el endpoint público: EMITE DESCUENTOS REALES (hallazgo ALTO 04/09)',
    'El tope de premios configurado se respeta bajo concurrencia',
  ]),
  api('background-removal', G_STORE, 'background-removal', 'Límites de tamaño/tipo de archivo, SSRF si toma URL, coste de abuso.', [
    'Solo acepta archivos subidos (no URLs arbitrarias) con tipo y tamaño acotados',
    'Está gateado por el add-on Avanzado en el backend',
    'Hay rate limit por negocio para acotar el costo',
  ]),
];

// ─── Backend · Comunicación · IA · onboarding ────────────────────────────────
const G_COM = 'Comunicación · IA · onboarding';
const COM: SeedItem[] = [
  api('orbi', G_COM, 'orbi', 'Prompt injection → ejecución de tools, alcance de las tools por negocio, fuga entre conversaciones, límites de coste/tokens.', [
    'Las tools de Orbi operan solo sobre el negocio del token; ninguna recibe businessId del modelo',
    'Un mensaje con instrucciones inyectadas no puede disparar acciones destructivas sin confirmación',
    'Las conversaciones no se mezclan entre negocios ni entre usuarios',
    'Hay tope de tokens por conversación y por día, y tope de gasto en Groq/Gemini (hallazgo MEDIO 04/09)',
    'Las claves GEMINI_API_KEY/GROQ_API_KEY solo en secretos de Cloud Run',
  ]),
  api('conversations', G_COM, 'conversations', 'IDOR en hilos, aislamiento por negocio, borrado.', [
    'Un hilo solo lo lee el negocio y el cliente participante (conversations.e2e)',
    'Borrar un hilo lo saca de todas las vistas y no deja adjuntos accesibles',
    'Los adjuntos de mensajes validan tipo y tamaño',
  ]),
  api('mail', G_COM, 'mail', 'Inyección de encabezados, open relay, datos de otro tenant en plantillas.', [
    'Los destinatarios y asuntos se sanitizan (sin saltos de línea ni encabezados inyectados)',
    'Ningún endpoint permite enviar mail a un destinatario arbitrario sin auth',
    'Las plantillas reciben solo datos del negocio/pedido correcto',
    'RESEND_API_KEY solo en secretos; en local el mail queda en modo STUB',
  ]),
  api('notifications', G_COM, 'notifications', 'Destinatarios, IDOR, canal de entrega, contenido sensible.', [
    'Un usuario solo lee/marca sus propias notificaciones (notifications.e2e)',
    'El contenido no incluye datos sensibles (tokens, contraseñas, datos de pago)',
  ]),
  api('message-templates', G_COM, 'message-templates', 'SSTI / inyección en variables de plantilla.', [
    'Las variables se reemplazan por sustitución simple, no por evaluación de plantillas',
    'El contenido configurado se renderiza como texto en el storefront',
  ]),
  api('support', G_COM, 'support', 'Adjuntos, IDOR en tickets, escalada vía soporte.', [
    'Un negocio solo ve sus tickets; el super admin ve todos',
    'Los adjuntos validan tipo/tamaño y no son ejecutables',
    'Soporte no puede cambiar roles ni credenciales de un negocio desde un ticket',
  ]),
  api('onboarding', G_COM, 'onboarding', 'Creación de negocio sin verificación, spam de tenants, estado inconsistente a medio setup.', [
    'register-business tiene rate limit y verificación de email antes de publicar',
    'Un negocio a medio setup no queda publicado ni visible en *.orbita.site',
    'confirm-payment revalida el pago con MercadoPago antes de activar (fix 09/09)',
    'El comprobante de pago del wizard muestra datos reales y exige sesión (hallazgo MEDIO 09/09)',
  ]),
];

// ─── Frontend · Panel ────────────────────────────────────────────────────────
const G_PANEL = 'Panel · modules/ventas/panel';
const P = 'apps/web/src/modules/ventas/panel/';
const PANEL: SeedItem[] = [
  web('panel.catalogo', G_PANEL, 'catalogo', P + 'catalogo', 'Acciones ocultas por la UI pero no bloqueadas en el backend.', [
    'Cada acción que la UI oculta por permiso también la rechaza el backend',
    'La subida de fotos pasa por el backend (tipo, tamaño, recodificado)',
  ]),
  web('panel.inventario', G_PANEL, 'inventario', P + 'inventario', 'Edición masiva, validación client-side vs server.', [
    'La edición masiva de stock no permite negativos y el servidor revalida',
    'Los ajustes se hacen de a uno o en transacción, sin dejar estados a medias',
  ]),
  web('panel.pedidos', G_PANEL, 'pedidos', P + 'pedidos', 'Detalle por ID, exportables, devoluciones / cancelaciones / notas de crédito.', [
    'El detalle por id de otro negocio muestra error, no datos parciales',
    'Nuevo pedido (presencial/online) solo con permiso y el total viene del servidor (/discounts/evaluate)',
    'Exportar pedidos exige permiso y se registra',
  ]),
  web('panel.clientes', G_PANEL, 'clientes', P + 'clientes', 'PII en listado y detalle, exportación.', [
    'El listado no expone más PII de la necesaria para operar',
    'La exportación está limitada a roles con permiso',
  ]),
  web('panel.descuentos', G_PANEL, 'descuentos', P + 'descuentos', 'Configuración de descuentos y cupones que llega al storefront.', [
    'Los porcentajes/montos se validan en el form y en el servidor (tope 99%, sin negativos)',
    'La oferta relámpago manda fecha y hora como instante local → ISO',
  ]),
  web('panel.mensajes', G_PANEL, 'mensajes', P + 'mensajes', 'XSS en render de mensajes de clientes.', [
    'Los mensajes de clientes se renderizan como texto plano',
    'Los links dentro de mensajes se abren con rel="noopener noreferrer"',
  ]),
  web('panel.reportes', G_PANEL, 'reportes', P + 'reportes', 'Dashboard: datos sensibles en el bundle, endpoints de agregados.', [
    'Ningún dato de otros negocios ni credenciales viaja en el bundle',
    'Los KPI se piden al servidor, no se calculan sobre datos completos descargados',
  ]),
  web('panel.configuracion', G_PANEL, 'configuracion', P + 'configuracion', 'Equipo, dominios, apariencia: controles solo-front sin refuerzo en backend.', [
    'Invitar/editar equipo y cambiar roles lo rechaza el backend si no hay permiso',
    'Las credenciales de MercadoPago nunca se muestran completas después de guardarlas',
    'Colores/fuentes/CSS de apariencia no permiten inyectar HTML ni JS (verificado 04/09)',
  ]),
  web('panel.avanzado', G_PANEL, 'avanzado', P + 'avanzado', 'Plantillas de home, juegos, promo modal: HTML/config inyectable al storefront público.', [
    'Los textos configurables (modal, juegos, plantillas) se renderizan como texto',
    'Los links configurables solo apuntan a la propia tienda',
    'Sin el add-on, las pantallas no muestran formularios operables (y el backend rechaza igual)',
  ]),
  web('panel.perfil', G_PANEL, 'perfil', P + 'perfil', 'Cambio de credenciales del miembro.', [
    'Cambiar contraseña pide la actual y no muestra la nueva en la URL ni en logs',
  ]),
  web('panel.tutoriales', G_PANEL, 'tutoriales', P + 'tutoriales', 'Contenido embebido, links externos, iframes.', [
    'No hay iframes a orígenes no controlados',
    'El estado del tutorial (businesses.tutorial) solo lo escribe el propio negocio',
  ]),
  web('panel.shared', G_PANEL, '_shared', P + '_shared', 'Componentes y tablas compartidas del panel (render de datos, escape).', [
    'Las tablas compartidas escapan el contenido de cada celda',
    'Los componentes de formulario muestran errores del servidor sin exponer detalles internos',
  ]),
];

// ─── Frontend · Cliente · storefront ─────────────────────────────────────────
const G_CLIENTE = 'Cliente · storefront · modules/ventas/cliente';
const C = 'apps/web/src/modules/ventas/cliente/';
const CLIENTE: SeedItem[] = [
  web('cliente.inicio', G_CLIENTE, 'inicio', C + 'inicio', 'Datos expuestos en la portada, plantillas de home.', [
    'La portada no recibe datos internos del negocio desde la API pública',
    'Las 16 plantillas renderizan textos como texto (sin HTML del dueño)',
  ]),
  web('cliente.catalogo', G_CLIENTE, 'catalogo / producto', C + 'producto', 'Render de la descripción (XSS), consistencia de precios.', [
    'La descripción del producto se renderiza sin HTML crudo',
    'El precio mostrado es el que devuelve el servidor (con descuentos evaluados ahí)',
  ]),
  web('cliente.checkout', G_CLIENTE, 'checkout', C + 'checkout', 'Totales/precios confiando en el cliente, estado de pago en la URL, PII en query strings.', [
    'El total lo calcula el servidor; el cliente solo manda ids y cantidades (verificado 09/09)',
    'El estado del pago se lee de la API, no del parámetro de retorno de MercadoPago',
    'El email del comprador invitado no viaja en la URL (hallazgo BAJO 09/09)',
  ]),
  web('cliente.cupones', G_CLIENTE, 'cupones', C + 'cupones', 'Aplicación de cupón client-side, validación real en backend.', [
    'Aplicar cupón llama al backend y muestra solo lo que el backend devuelve',
    'No se guarda ni muestra la lista de cupones válidos en el cliente',
  ]),
  web('cliente.juegos', G_CLIENTE, 'juegos', C + 'juegos', 'Premios resueltos client-side, repetición de jugadas.', [
    'El premio lo informa el servidor; el cliente solo anima el resultado',
    'El bloqueo de repetición no depende solo de localStorage',
  ]),
  web('cliente.pedido', G_CLIENTE, 'pedido · seguimiento', C + 'pedido', 'Seguimiento de pedido por ID adivinable / sin autenticación.', [
    'El seguimiento usa UUID y exige email/sesión coincidente (verificado 09/09)',
    'Un id inválido muestra un 404 uniforme, sin distinguir existente/inexistente',
  ]),
  web('cliente.perfil', G_CLIENTE, 'perfil', C + 'perfil', 'PII del cliente, cambio de datos y verificación del actor.', [
    'Solo el cliente logueado edita sus datos y direcciones',
    'Cambiar email/contraseña reverifica la contraseña actual',
  ]),
  web('cliente.auth', G_CLIENTE, 'auth', C + 'auth', 'Almacenamiento del token (localStorage vs cookie), CSRF, aislamiento por negocio.', [
    'Access token en memoria y refresh en cookie HttpOnly + SameSite (verificado 09/09)',
    'Los endpoints con cookie están protegidos contra CSRF (SameSite/Origin)',
    'La sesión de un negocio no sirve en otro (X-Business-Slug + JWT con businessId)',
  ]),
  web('cliente.legales', G_CLIENTE, 'legales', C + 'legales', 'Contenido estático, links, consistencia con datos del negocio.', [
    'Términos y privacidad muestran el nombre, CUIT y contacto del negocio correcto',
    'Los textos base están alineados con docs/legales/*.docx',
  ]),
];

// ─── Frontend · Otros módulos · transversal ──────────────────────────────────
const G_OTROS = 'Otros módulos · transversal frontend';
const OTROS: SeedItem[] = [
  web('turnos', G_OTROS, 'turnos', 'apps/web/src/modules/turnos', 'Reserva de turnos ajenos (IDOR), doble reserva del mismo slot, aislamiento por negocio.', [
    'Un cliente no puede ver ni cancelar turnos de otro',
    'Dos reservas simultáneas del mismo horario no se aceptan las dos',
    'Los turnos son por negocio (y por sucursal si aplica)',
  ]),
  web('onboarding', G_OTROS, 'onboarding', 'apps/web/src/modules/onboarding', 'SetupUnificado, ElegirRubro: validación de pasos, estado a medias.', [
    'No se puede saltar el paso de pago manipulando la URL o el estado local',
    'Un setup abandonado no deja un negocio publicado',
    'El comprobante de pago muestra datos reales y solo con sesión (hallazgo MEDIO 09/09)',
  ]),
  web('superadmin', G_OTROS, 'superadmin', 'apps/web/src/modules/superadmin', 'Acceso gateado solo en el front; verificación del rol server-side en cada endpoint que consume.', [
    'RequireAuth type="platform_admin" en TODAS las páginas de /superadmin',
    'Cada endpoint /platform/* está detrás de PlatformAdminGuard (el gate real es el backend)',
    'El login de platform admin exige el segundo factor por mail',
  ]),
  web('propuestas', G_OTROS, 'propuestas', 'apps/web/src/modules/propuestas', '¿Entra al bundle de producción? ¿rutas accesibles? prototipos de debate.', [
    '/propuestas y /nueva-home no son accesibles en producción (o no aportan superficie de ataque)',
    'Los prototipos no incluyen credenciales ni datos reales',
  ]),
  web('landing', G_OTROS, 'landing / orbita.site', 'apps/web/src/modules/landing', 'Formularios, tracking, links salientes, contenido embebido.', [
    'Los formularios de contacto/registro tienen rate limit y validación',
    'No hay scripts de terceros sin control ni iframes a orígenes desconocidos',
    'Lo que promete la landing coincide con lo que existe en el panel (Avanzado = 6 funciones)',
  ]),
  web('lib', G_OTROS, 'lib/', 'apps/web/src/lib', 'api.ts, auth/, tenant.ts, storefront/api.ts: manejo del token, base URLs, headers.', [
    'authedFetch no reintenta infinito ante 401 ni expone el refresh token al JS',
    'currentSlug() y tenant.ts resuelven el negocio sin confiar en parámetros manipulables',
    'NEXT_PUBLIC_* no contiene ningún secreto',
  ]),
  web('pages-api', G_OTROS, 'pages/api (BFF de auth)', 'apps/web/src/pages/api', 'Proxies de login, refresh, Google, invitación y reset que setean cookies desde Next.', [
    'Las cookies se setean HttpOnly, Secure y SameSite',
    'El proxy no reenvía headers arbitrarios del cliente al backend',
    'Los endpoints de invitación/reset no filtran si un email existe',
  ]),
  web('middleware', G_OTROS, 'pages/ · middleware', 'apps/web/src/middleware.ts', 'Protección de rutas, getServerSideProps con datos sensibles, headers de seguridad.', [
    'El middleware resuelve tenant/apex correctamente y no permite acceder al panel de otro negocio',
    'Las páginas con getServerSideProps no filtran datos sensibles al HTML',
    'Headers de seguridad (CSP, HSTS, X-Frame-Options) configurados en next.config',
  ]),
  web('design-system', G_OTROS, 'design-system · layouts · hooks', 'apps/web/src/design-system', 'Componentes que renderizan HTML sin sanitizar (dangerouslySetInnerHTML).', [
    'Grep de dangerouslySetInnerHTML/innerHTML en design-system, layouts y hooks: cada uso justificado y con contenido controlado',
    'Los componentes con links externos usan rel="noopener noreferrer"',
  ]),
  web('components-orbi', G_OTROS, 'components/orbi (widget)', 'apps/web/src/components/orbi', 'Chat de Orbi en panel y wizard: render de respuestas del modelo, acciones que dispara, estado en localStorage.', [
    'Las respuestas del modelo se renderizan como texto/markdown seguro, nunca HTML crudo',
    'Las acciones que Orbi sugiere/ejecuta pasan por endpoints con auth normal',
    'Lo que se guarda en localStorage no incluye datos sensibles',
  ]),
  web('components-storefront', G_OTROS, 'components/storefront', 'apps/web/src/components/storefront', 'Componentes compartidos de la tienda: header, footer, modales, checkout, prueba social, oferta relámpago.', [
    'Ningún componente inyecta HTML del dueño del negocio',
    'Los modales (devolución, promo) validan del lado del servidor lo que envían',
  ]),
];

// ─── Transversal · todo el repo ──────────────────────────────────────────────
const G_TRANS = 'Revisiones que cruzan todos los módulos';
function trans(key: string, titulo: string, foco: string, checks: string[]): SeedItem {
  return { key: `trans.${key}`, area: 'TRANSVERSAL', grupo: G_TRANS, titulo, foco, checks };
}
const TRANSVERSAL: SeedItem[] = [
  trans('secretos', 'Gestión de secretos', '.env, claves en código, historial de git, rotación.', [
    'Ningún secreto en el repo ni en el historial (git log -p | grep de claves conocidas)',
    'Todos los secretos de producción viven en Secret Manager de GCP (ver deploy.sh)',
    'Hay un procedimiento de rotación y se rotó cualquier clave que alguna vez se filtró',
    'apps/api/.env local apunta a producción: está claro quién lo tiene y por qué',
  ]),
  trans('dependencias', 'Dependencias', 'npm audit, paquetes sin mantenimiento, integridad del lockfile.', [
    'pnpm audit sin vulnerabilidades altas/críticas en api y web (04/09: 4 vulnerables, 2 altas)',
    'Los lockfiles se instalan con --frozen-lockfile en CI y en el Dockerfile',
    'No hay paquetes abandonados en dependencias de producción',
  ]),
  trans('cors-headers', 'CORS · headers · CSP', 'main.ts de la API + configuración de Next.js.', [
    'CORS de la API limitado a orbita.site, *.orbita.site y dominios custom verificados',
    'helmet activo en la API con CSP/HSTS razonables',
    'Next.js manda CSP, X-Frame-Options y Referrer-Policy en panel y tienda',
  ]),
  trans('rate-limit', 'Rate limiting · abuso', 'Login, cupones, IA (orbi), procesamiento de imágenes.', [
    'Login, reset y segundo factor con throttling',
    'Validación de cupones y juegos con límite por IP/cliente',
    'Orbi y quitar fondo con límite por negocio y tope de gasto',
  ]),
  trans('multi-tenant-e2e', 'Aislamiento multi-tenant e2e', 'Prueba cruzada negocio A vs negocio B en cada endpoint.', [
    'auth-isolation.e2e cubre login cruzado entre negocios',
    'Existe una prueba A-vs-B por cada módulo con datos de negocio (productos, pedidos, clientes, descuentos, turnos, conversaciones)',
    'La prueba corre en CI contra una base que NO es producción (ver hallazgo ALTO 04/09)',
  ]),
  trans('logging', 'Logging · auditoría', 'Cobertura de acciones sensibles, PII en logs, retención.', [
    'Los logs de Cloud Run no contienen tokens, contraseñas ni datos de tarjeta',
    'Las acciones sensibles del panel y del super admin quedan auditadas',
    'Hay retención definida para logs y para platform_admin_logs',
  ]),
  trans('deploy-manual', 'Deploy backend manual', 'Cloud Run sin CI/CD: riesgo de desplegar sin gate de seguridad/tests.', [
    'deploy.sh solo se corre después de que CI (typecheck + unit) pasó en main',
    'Hay rollback documentado y probado (DEPLOYMENT.md § Rollback)',
    'Está decidido si se automatiza el deploy con Cloud Build en un push a main',
  ]),
  trans('migraciones', 'Migraciones Prisma a mano', 'Drift de esquema entre entornos, migraciones no aplicadas.', [
    'prisma migrate status en producción sin migraciones pendientes',
    'El drift de wizard_ai_turns está resuelto (hallazgo ALTO 04/09)',
    'Procedimiento: migración ANTES del deploy de la API (CLAUDE.md § Commit y push)',
  ]),
  trans('backups', 'Backups y recuperación de la base', 'Nunca se verificó que existan backups de Supabase ni que se puedan restaurar.', [
    'Los backups automáticos de Supabase están activos y se sabe cada cuánto corren',
    'Se hizo al menos una prueba de restauración a una base aparte',
    'Está definido el RPO/RTO aceptable para Órbita',
  ]),
  trans('rls-supabase', 'Políticas RLS de Supabase', 'La API accede con service role; si algo pega directo a Supabase, RLS es la única barrera.', [
    'Inventario de qué accede a Supabase sin pasar por la API (storage público, etc.)',
    'RLS activo en todas las tablas o acceso directo bloqueado por completo',
  ]),
  trans('base-prueba', 'Base de prueba separada de producción', 'Los 22+ e2e escriben en la base de producción (hallazgo ALTO 04/09).', [
    'Existe una base/rama de Supabase para tests y CI',
    'apps/api/.env de cada dev apunta a la base de prueba por defecto',
    'Los e2e corren en CI contra esa base',
  ]),
  trans('gasto-ia', 'Tope de gasto en IA y servicios pagos', 'El freno de USD 25 es de GCP y no cubre Groq/Gemini/Resend/remove.bg.', [
    'Alertas de presupuesto configuradas en cada proveedor pago',
    'Límites por negocio y por día en Orbi y en quitar fondo',
  ]),
];

// ─── Hallazgos de auditorías anteriores ──────────────────────────────────────
const G_EXP = 'Expediente 08-09/09 · Storefront y wizard de pagos';
const G_AUD = 'Auditoría técnica 04/09';
const G_INT = 'Auditoría interna 09/09 · módulo por módulo';
function hallazgo(key: string, grupo: string, severidad: SeedSeveridad, titulo: string, foco: string, checks: string[], extra: Partial<SeedItem> = {}): SeedItem {
  return { key: `hallazgo.${key}`, area: 'HALLAZGO', grupo, titulo, foco, severidad, checks, ...extra };
}
const HALLAZGOS: SeedItem[] = [
  hallazgo('bypass-suscripcion', G_EXP, 'CRITICA', 'Bypass de la suscripción paga',
    'register-business (público) encadenado con business/publish (sin chequeo de pago) permitía crear y publicar una tienda operativa en *.orbita.site sin pagar nunca la suscripción.',
    ['publish() exige suscripción real creada después de reverificar el pago contra MercadoPago', 'Desplegado en Cloud Run (revisión orbita-api-00062-mqr, commit 42649a5)', 'Probado que un negocio sin pago no puede publicar'],
    { estado: 'HECHO', checksHechos: true, ruta: 'onboarding.controller.ts:34 · businesses.service.ts:144 · subscriptions.service.ts' }),
  hallazgo('webhooks-sin-firma', G_EXP, 'MEDIA', 'Webhooks de MercadoPago sin firma si falta el secret',
    'Si MP_WEBHOOK_SECRET no está seteada, los tres webhooks aceptan el POST sin validar origen. Impacto acotado: igual re-preguntan el estado real a MercadoPago antes de actuar.',
    ['Sin MP_WEBHOOK_SECRET el webhook responde 500/503 y no procesa', 'Test unitario que lo cubra', 'Desplegado'],
    { ruta: 'mercadopago.service.ts · subscriptions.service.ts · domain-purchase.service.ts' }),
  hallazgo('comprobante-fijo', G_EXP, 'MEDIA', 'Comprobante de pago con datos fijos, sin sesión',
    'La pantalla de comprobante del wizard muestra un N° de operación y un monto hardcodeados, accesible sin sesión ni pago verificado. Se puede imprimir como prueba de pago falsa.',
    ['El comprobante toma número de operación y monto del pago real', 'Exige sesión y que el pago esté verificado', 'Desplegado en Vercel'],
    { ruta: 'pages/onboarding/pago-comprobante.tsx' }),
  hallazgo('cron-timing', G_EXP, 'BAJA', 'Comparación no constante-en-tiempo del secret de cron',
    'Comparación de string estándar en vez de crypto.timingSafeEqual. Explotabilidad muy baja: el endpoint lo llama Cloud Scheduler.',
    ['Reemplazar por crypto.timingSafeEqual con longitudes iguales', 'Desplegado'],
    { ruta: 'internal-cron-secret.guard.ts:27' }),
  hallazgo('email-en-url', G_EXP, 'BAJA', 'Email del comprador invitado en la URL',
    'El email de un comprador sin cuenta queda en la URL de confirmación y tracking del pedido. Sin fuga real hacia terceros: el backend igual exige que coincida con el dueño del pedido.',
    ['El email viaja en el body/sesión y no en query string', 'Los links de los mails de pedido siguen funcionando', 'Desplegado'],
    { ruta: 'CheckoutPago.tsx · Confirmacion.tsx · lib/storefront/api.ts' }),
  hallazgo('controles-storefront', G_EXP, 'INFO', 'Controles centrales verificados en código (8/8)',
    'Lo que el expediente del 09/09 revisó y encontró bien. No volver a auditar sin motivo.',
    [
      'Precios siempre recalculados server-side; el cliente nunca decide un total',
      'Pedidos con UUID + scoping estricto por negocio y cliente, 404 uniforme',
      'Webhooks vuelven a preguntarle a MercadoPago antes de aprobar cualquier pago',
      'Idempotencia: reintentos y carreras webhook-vs-browser no duplican altas ni cobros',
      'Sesión: JWT en memoria, refresh en cookie HttpOnly + SameSite',
      'XSS: sin dangerouslySetInnerHTML/innerHTML/eval en todo lo auditado',
      'Secretos: ninguna credencial hardcodeada ni expuesta en variables públicas',
      'Errores devueltos al cliente sin stack traces ni datos internos',
    ],
    { estado: 'HECHO', checksHechos: true }),

  hallazgo('drift-schema', G_AUD, 'ALTA', 'Drift del schema: wizard_ai_turns',
    'En producción existen model, prompt_tokens y completion_tokens con datos, no declaradas en schema.prisma. prisma migrate diff/dev genera un DROP de las tres.',
    ['Declarar las tres columnas en schema.prisma (o migrarlas a donde corresponda)', 'prisma migrate diff contra producción sin diferencias', 'Migraciones nuevas se pueden generar con prisma otra vez, no a mano']),
  hallazgo('base-prueba', G_AUD, 'ALTA', 'No hay base de prueba: los e2e escriben en producción',
    'La única base es producción y los 22 e2e escriben ahí. Ver también el ítem transversal "Base de prueba".',
    ['Base de prueba creada', 'e2e apuntando a ella', 'Corriendo en CI']),
  hallazgo('addon-sin-revalidar', G_AUD, 'ALTA', 'Funciones pagas sin revalidar el add-on en el endpoint público',
    'Juegos, prueba social, modal de anuncios y 2x1 no revalidan el add-on Avanzado en el storefront. Juegos EMITE DESCUENTOS REALES. Countdown sí revalida (hasActiveAddon): copiar de ahí.',
    ['games revalida hasActiveAddon', 'social-proof revalida', 'promo-modal revalida', 'two-for-one revalida', 'Tests unitarios como los de countdown', 'Desplegado']),
  hallazgo('gasto-ia', G_AUD, 'MEDIA', 'Sin tope de gasto de IA (Groq/Gemini)',
    'El freno de USD 25 es de GCP y no cubre la IA.',
    ['Alertas de presupuesto en Google AI Studio y Groq', 'Tope por negocio/día en Orbi']),
  hallazgo('dependencias', G_AUD, 'MEDIA', '4 dependencias vulnerables (2 altas)',
    'pnpm audit del 04/09.',
    ['Actualizadas o mitigadas las 2 altas', 'pnpm audit limpio en api y web']),
  hallazgo('deploy-manual', G_AUD, 'MEDIA', 'Deploy manual del backend sin gate',
    'Cloud Run se despliega a mano con deploy.sh, sin que nada obligue a que CI haya pasado.',
    ['Regla escrita y seguida: deploy solo con CI verde (CLAUDE.md)', 'Decidido si se automatiza con Cloud Build']),
  hallazgo('health-guard', G_AUD, 'BAJA', '/health detrás del guard',
    'Devuelve 401, inútil para monitoreo de Cloud Run/uptime.',
    ['/health es @Public() y devuelve solo estado, sin datos', 'Uptime check configurado contra api.orbita.site/health']),
  hallazgo('subidas-sin-limite', G_AUD, 'BAJA', 'Subidas sin límite explícito de tamaño',
    'Las subidas se recodifican a webp pero no hay tope explícito de tamaño de entrada.',
    ['Límite de tamaño en multer/body y en el bucket', 'Mensaje claro al usuario cuando se pasa']),
  hallazgo('ctalink-externo', G_AUD, 'BAJA', 'ctaLink de PromoModal acepta dominios externos',
    'Un dueño puede mandar visitantes a cualquier URL desde el modal de anuncios.',
    ['ctaLink solo acepta rutas relativas de la tienda', 'Los modales guardados con URL externa se corrigen o se ignoran']),
  hallazgo('cerrados-agosto', G_AUD, 'INFO', 'Los 7 hallazgos del informe de agosto están cerrados',
    'security-audit-report.md de agosto: los 7 están resueltos y verificados el 04/09. No repetirlos.',
    ['Los 7 verificados como cerrados en la auditoría del 04/09', 'security-audit-report.md marcado como histórico, no se vuelve a usar como backlog'],
    { estado: 'HECHO', checksHechos: true }),
  hallazgo('verificado-limpio-0409', G_AUD, 'INFO', 'Verificado limpio el 04/09',
    'Lo que la auditoría técnica revisó y encontró bien. No volver a auditar sin motivo.',
    ['Aislamiento entre negocios', 'Precio del checkout calculado en el servidor', 'XSS de colores/fuentes de apariencia', 'Secretos fuera del repo', 'Subidas recodificadas a webp'],
    { estado: 'HECHO', checksHechos: true }),

  // Auditoría interna módulo por módulo (esta pestaña). El detalle de cada
  // uno está en el informe del ítem del módulo (p. ej. api.auth).
  hallazgo('auth-enumeracion', G_INT, 'MEDIA', 'Login: se puede saber si un email tiene cuenta (timing y mensajes)',
    'Cuando el email no existe, login responde antes de correr argon2 (no hay verify contra un hash dummy), así que se distingue por tiempo de respuesta. Además, en la tienda un email sin cuenta da 403 NO_ACCOUNT_IN_BUSINESS y una contraseña mala da 401; register dice "Ya tenés cuenta"; el lockout dice "Cuenta bloqueada". forgot-password sí está bien.',
    ['argon2.verify contra un hash fijo cuando el usuario no existe (mismo costo en ambos caminos)', 'Decidido y documentado si NO_ACCOUNT_IN_BUSINESS se mantiene como decisión de producto (hoy lo asume auth-isolation.e2e test 1)', 'Lockout responde 401 genérico y el detalle va al log', 'Desplegado'],
    { ruta: 'auth.service.ts:156 · :188-194 · :266 · :978' }),
  hallazgo('auth-dto-sin-tope', G_INT, 'BAJA', 'DTOs de auth sin tope de largo y sin normalizar email',
    'LoginDto.password y AcceptInvitationDto.newPassword no tienen @MaxLength (argon2 sobre un body de hasta 10 MB); RegisterDto.firstName/lastName/phone sin tope; ningún DTO pasa el email a minúsculas y la unique de Postgres es case-sensitive, así que Ana@x.com y ana@x.com pueden ser dos cuentas en el mismo negocio.',
    ['@MaxLength(128) en todas las contraseñas de entrada', '@MaxLength en firstName, lastName y phone de RegisterDto', 'Email normalizado (trim + lowercase) en login, register, forgot, reset e invitaciones', 'Datos existentes revisados: emails duplicados por mayúsculas', 'Desplegado'],
    { ruta: 'auth/dto/login.dto.ts · register.dto.ts · accept-invitation.dto.ts' }),
  hallazgo('auth-refresh-reuso', G_INT, 'BAJA', 'Refresh token: sin detección de reuso',
    'La rotación funciona (SHA-256, revokedAt + replacedAt, gracia de 30 s), pero un token ya rotado que se presenta pasada la gracia solo recibe 401: no se revoca la familia de tokens de ese usuario, que es lo que delata un robo.',
    ['Reuso de un token rotado fuera de la gracia revoca todos los refresh_tokens del usuario', 'Test unitario del caso', 'Desplegado'],
    { ruta: 'auth.service.ts:340-352' }),
  hallazgo('common-query-sin-dto', G_INT, 'BAJA', 'Los query params no pasan por class-validator',
    'Veinte endpoints leen el query crudo con @Query() suelto en vez de un DTO, así que ValidationPipe no los mira: GET /subscription/payments?page=abc termina en skip: NaN (500 de Prisma) y ?limit=1000000 en un take de un millón de filas. El resto (reports from/to, search q, categories flat) se valida a mano en el service, o no se valida.',
    ['DTO de query (con @IsInt/@Min/@Max o @IsISO8601 según el caso) en los endpoints que hoy leen @Query crudo', 'page y limit acotados, con default y tope máximo', 'Test unitario del DTO de paginación', 'Desplegado'],
    { ruta: 'subscriptions.controller.ts:28 · reports.controller.ts:21 · search.controller.ts:16 · onboarding.controller.ts:24' }),
  hallazgo('common-enumeracion-alta', G_INT, 'MEDIA', 'El alta pública dice si un email ya tiene negocio',
    'GET /onboarding/check-email?email=... es público, no valida con class-validator y responde { available: false } cuando ese email ya es dueño de un negocio en Órbita: la misma enumeración que se cerró en login el 09/09, por otra puerta. Solo lo frena el throttle global (60/min por IP). El wizard necesita avisar "ya tenés cuenta", así que es una decisión de producto, no un bug a secas.',
    ['Decidido y documentado si se mantiene como decisión de producto (igual que NO_ACCOUNT_IN_BUSINESS)', 'Throttle propio del endpoint, más bajo que el global', 'El email pasa por un DTO con @NormalizedEmail()', 'Desplegado'],
    { ruta: 'onboarding.controller.ts:28 · onboarding.service.ts:200' }),
  hallazgo('auth-estado-en-memoria', G_INT, 'BAJA', 'Throttler y store de Google OAuth en memoria',
    'ThrottlerModule no tiene storage compartido y el canje de Google OAuth vive en un Map: con más de una instancia de Cloud Run los límites se cuentan por instancia y un canje puede caer en otra instancia y fallar. Hoy corre con una instancia, así que no duele.',
    ['Decidido: min-instances=1 / max=1 documentado, o storage compartido (Redis/Postgres)', 'El canje de Google OAuth sobrevive a un cambio de instancia'],
    { ruta: 'app.module.ts:65 · google-oauth-exchange.store.ts' }),
];

export const AUDIT_SEED: SeedItem[] = [
  ...NUCLEO, ...COMERCIO, ...STORE, ...COM,
  ...PANEL, ...CLIENTE, ...OTROS,
  ...TRANSVERSAL,
  ...HALLAZGOS,
];
