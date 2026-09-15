-- Saneo de la BASE DE PRUEBA: la copia restaurada del backup de producción.
-- Hallazgos `base-prueba` y `backups-sin-verificar` de la auditoría interna.
-- Guía completa: docs/base-de-prueba.md.
--
-- NUNCA se corre contra producción. Lo corre preparar-base-prueba.cjs --sanear,
-- que antes de conectar comprueba que DESTINO_URL no sea la base del .env, y
-- ejecuta todo esto en UNA transacción: sin --si hace ROLLBACK (prueba en seco)
-- y con --si hace COMMIT recién si los chequeos del final dan 0.
--
-- Qué se busca:
--   1. Que en la copia no quede nada que siga sirviendo en PRODUCCIÓN o contra
--      cuentas reales: sesiones, códigos, invitaciones, tokens de Mercado Pago,
--      preapprovals y dominios de Vercel. Esto va en TODOS los negocios,
--      también los del equipo.
--   2. Que no queden datos personales de clientes reales. Esto va solo en los
--      negocios que NO son del equipo (tefaltacalle incluida).
--
-- Negocios del equipo (se conservan tal cual para loguearse y probar):
-- subdominios negocio, zapatoslorena, alex y asd, resueltos siempre con la
-- misma subquery sobre businesses. El script verifica que TODAS las listas de
-- subdominios de este archivo sean idénticas: si agregás un negocio al equipo,
-- cambialo en todas y en SUBDOMINIOS_EQUIPO del .cjs.
--
-- Reglas del archivo (el script lo parte a mano, no es psql):
--   - Solo UPDATE y DELETE. Nada de BEGIN/COMMIT, DDL ni TRUNCATE.
--   - Cada sentencia termina con ";" al final de la línea, y ";" no aparece en
--     ningún otro lado (tampoco dentro de un string).
--   - Comentarios solo en líneas propias que empiezan con "--".
--   - Idempotente: los valores de reemplazo salen del id de cada fila y cada
--     WHERE excluye lo que ya está saneado, así que la segunda corrida da 0
--     filas en todo.
--
-- Criterios de reemplazo:
--   - Emails: '<tipo>-<id de la fila>@prueba.orbita.test'. `.test` es un TLD
--     reservado que nunca entrega, cumple el formato x@y.z de
--     esDestinatarioUnico (mail.service.ts) y, con el id entero, no choca con
--     los unique (business_id, email).
--   - No se borran customers, members, addresses, suppliers, orders ni
--     branches: los referencian FKs sin cascada (orders, reviews,
--     conversations, stock_movements, payments.verified_by,
--     online_order_details.shipping_address_id). Se anonimizan en el lugar.
--   - Las columnas @updatedAt de Prisma no tienen trigger en la base: un UPDATE
--     por SQL no les cambia la fecha, así que el orden de los listados se
--     mantiene.
--   - RLS está activo sin FORCE y postgres tiene BYPASSRLS
--     (migración 20260910110000_rls_tablas_publicas): esto tiene que correr
--     con el usuario postgres del proyecto de prueba.


-- ============================================================================
-- 1. Sesiones, códigos, altas pendientes y credenciales: TODAS las filas
-- ============================================================================

-- Hashes de sesiones reales, con {userAgent, ip} de cada login en device_info.
-- Sin hijos. Efecto: todos (equipo y super admins incluidos) vuelven a
-- iniciar sesión contra la copia.
DELETE FROM public.refresh_tokens;

-- Email en claro + SHA-256 de un código de 6 dígitos: se saca por fuerza bruta
-- offline y, mientras no vence, cambia la contraseña en PRODUCCIÓN. Sin hijos.
DELETE FROM public.password_reset_tokens;

-- Segundo factor del super panel, mismo riesgo. FK a platform_admins con
-- cascada desde el admin hacia acá: borrar el código no toca al admin.
DELETE FROM public.platform_admin_login_codes;

-- Altas esperando el pago: el payload trae email, teléfono, logo y hash de
-- contraseña (las de antes del 10/09, la contraseña EN CLARO), y
-- confirmAndCreate puede crear la cuenta con ese payload. Sin FKs.
DELETE FROM public.pending_signups;

-- Tokens OAuth de cuentas REALES de Mercado Pago (también las del equipo):
-- con MERCADOPAGO_TOKEN_KEY se descifran y cobran, reembolsan o rotan el
-- refresh_token de producción. Nada referencia esta tabla. Las tiendas quedan
-- "Mercado Pago desconectado"; para probar, conectar un usuario de prueba.
DELETE FROM public.mp_credentials;

-- El token de invitación está EN CLARO y dura 7 días: leído de la copia sirve
-- para aceptar la invitación en producción. Una invitación pendiente del
-- equipo se vuelve a mandar desde la copia.
UPDATE public.members
SET invitation_token = NULL,
    invitation_token_expires_at = NULL
WHERE invitation_token IS NOT NULL
   OR invitation_token_expires_at IS NOT NULL;


-- ============================================================================
-- 2. Ids externos con los que el código llama a Mercado Pago o a Vercel:
--    TODAS las filas
-- ============================================================================

-- CancellationsService.approve reembolsa por API el pago APPROVED que tenga
-- mp_payment_id. Sin mp_credentials ya fallaría, pero es la segunda barrera.
-- Con NULL, aprobar una cancelación en la copia deja refund_status = NONE.
-- mp_order_id se conserva: solo sirve para reusar la fila PENDING, nunca se
-- manda a MP.
UPDATE public.payments
SET mp_payment_id = NULL
WHERE mp_payment_id IS NOT NULL;

-- activatePlan hace preapproval.update({ status: 'cancelled' }) con el token
-- de plataforma, y el mantenimiento nocturno hace preapproval.get: con el id
-- real, desde la copia se le da de baja el débito automático a un negocio.
-- subscription_payments.mp_payment_id se conserva: es solo la clave de
-- idempotencia de recordPayment (el id que se consulta llega por el webhook).
UPDATE public.subscriptions
SET mp_preapproval_id = NULL
WHERE mp_preapproval_id IS NOT NULL;

-- `domain` es la clave con la que DomainsService.remove, verifyDns y
-- sslStatus operan en el proyecto de Vercel de PRODUCCIÓN (VERCEL_PROJECT_ID
-- tiene ese valor por default). Es NOT NULL y UNIQUE, así que no puede ir en
-- NULL: se renombra a '<id>.dominio-prueba.invalid' (único por fila, y .invalid
-- nunca resuelve). Se conservan las filas para poder probar la pantalla.
UPDATE public.custom_domains
SET domain = id || '.dominio-prueba.invalid'
WHERE domain <> (id || '.dominio-prueba.invalid');

-- El nombre del dominio también se repite como texto en los pedidos de compra
-- (custom_domain_id es texto sin FK). Primero los que terminaron vinculados,
-- con el mismo nombre que su custom_domain...
UPDATE public.domain_purchase_orders AS dpo
SET domain = cd.domain
FROM public.custom_domains AS cd
WHERE cd.id = dpo.custom_domain_id
  AND dpo.domain <> cd.domain;

-- ...y el resto con un nombre propio.
UPDATE public.domain_purchase_orders
SET domain = id || '.dominio-prueba.invalid'
WHERE domain NOT LIKE '%.dominio-prueba.invalid';

-- handlePaymentConfirmed solo actúa sobre PENDING_PAYMENT: con un aviso de
-- pago válido COMPRA el dominio con la tarjeta de OrbitaCorp y, si falla,
-- reembolsa un pago real. Se cierran como FAILED en vez de borrarlas (no
-- tienen hijos, pero así queda el historial). PAID no se reprocesa en ningún
-- camino. mp_preference_id, mp_payment_id y vercel_order_id se conservan:
-- el reembolso usa el id que llega en el webhook y getOrderStatus no lo llama
-- nadie.
UPDATE public.domain_purchase_orders
SET status = 'FAILED',
    fail_reason = 'Anulado en la base de prueba: en la foto de producción esperaba el pago'
WHERE status = 'PENDING_PAYMENT';


-- ============================================================================
-- 3. Comercios que NO son del equipo: identidad, contacto, datos fiscales y
--    bancarios
-- ============================================================================

-- Nombre comercial (en monotributistas suele ser nombre y apellido),
-- subdominio y descripción identifican a la clienta. El reemplazo del
-- subdominio cumple SUBDOMINIO_RE (39 caracteres, sin "--", no reservado).
-- Para abrir la tienda en local: prueba-<id sin guiones>.
UPDATE public.businesses
SET name = 'Tienda ' || left(id, 8),
    subdomain = 'prueba-' || replace(id, '-', ''),
    description = CASE WHEN description IS NULL THEN NULL ELSE 'Descripción de prueba' END
WHERE id NOT IN (SELECT b.id FROM public.businesses b WHERE b.subdomain IN ('negocio', 'zapatoslorena', 'alex', 'asd'))
  AND (name <> ('Tienda ' || left(id, 8))
    OR subdomain <> ('prueba-' || replace(id, '-', ''))
    OR (description IS NOT NULL AND description <> 'Descripción de prueba'));

-- store_name repite el nombre de la tienda en el storefront; en NULL, el
-- storefront cae al nombre ya anonimizado. El contenido de marketing (hero,
-- banner, plantilla) se conserva: ya es público y no trae datos de compradores.
UPDATE public.storefront_config
SET store_name = NULL
WHERE store_name IS NOT NULL
  AND business_id NOT IN (SELECT b.id FROM public.businesses b WHERE b.subdomain IN ('negocio', 'zapatoslorena', 'alex', 'asd'));

-- WhatsApp y email de contacto reales (el botón flotante le escribe directo, y
-- el email va de Reply-To y recibe los avisos de devoluciones), CUIT (contiene
-- el DNI en una persona humana), razón social, CBU, alias y titular (un pedido
-- de prueba mandaría a transferirle plata real) y redes. El CUIT va en NULL y
-- no con otro valor porque el form de Configuración valida el dígito
-- verificador.
UPDATE public.business_config
SET whatsapp = NULL,
    email = CASE WHEN email IS NULL THEN NULL ELSE 'negocio-' || business_id || '@prueba.orbita.test' END,
    cuit = NULL,
    legal_name = NULL,
    transfer_cbu = NULL,
    transfer_alias = NULL,
    transfer_holder = NULL,
    instagram = NULL,
    tiktok = NULL,
    facebook = NULL
WHERE business_id NOT IN (SELECT b.id FROM public.businesses b WHERE b.subdomain IN ('negocio', 'zapatoslorena', 'alex', 'asd'))
  AND (whatsapp IS NOT NULL
    OR (email IS NOT NULL AND email <> ('negocio-' || business_id || '@prueba.orbita.test'))
    OR cuit IS NOT NULL
    OR legal_name IS NOT NULL
    OR transfer_cbu IS NOT NULL
    OR transfer_alias IS NOT NULL
    OR transfer_holder IS NOT NULL
    OR instagram IS NOT NULL
    OR tiktok IS NOT NULL
    OR facebook IS NOT NULL);

-- Dirección y coordenadas del local: en emprendimientos es la casa de la
-- dueña. Las filas no se borran (las referencian orders, variant_stock y
-- stock_movements).
UPDATE public.branches
SET address = CASE WHEN address IS NULL THEN NULL ELSE 'Dirección de prueba 123' END,
    latitude = NULL,
    longitude = NULL
WHERE business_id NOT IN (SELECT b.id FROM public.businesses b WHERE b.subdomain IN ('negocio', 'zapatoslorena', 'alex', 'asd'))
  AND ((address IS NOT NULL AND address <> 'Dirección de prueba 123')
    OR latitude IS NOT NULL
    OR longitude IS NOT NULL);


-- ============================================================================
-- 4. Personas de negocios que NO son del equipo: miembros, clientes,
--    direcciones y proveedores
-- ============================================================================

-- Dueños y empleados reales. El email es el destino de los crons (resumen
-- diario, reporte semanal, ciclo de suscripción, vencimiento de dominios) y de
-- NotificationsService. password_hash es argon2id crackeable offline y
-- google_id es el `sub` de su cuenta de Google: los dos en NULL. Para entrar a
-- una de estas tiendas en la copia: "olvidé mi contraseña" con el email nuevo,
-- y el código sale en la consola de la API (mail en modo STUB).
UPDATE public.members
SET name = 'Miembro ' || left(id, 8),
    email = 'miembro-' || id || '@prueba.orbita.test',
    password_hash = NULL,
    google_id = NULL
WHERE business_id NOT IN (SELECT b.id FROM public.businesses b WHERE b.subdomain IN ('negocio', 'zapatoslorena', 'alex', 'asd'))
  AND (name <> ('Miembro ' || left(id, 8))
    OR email <> ('miembro-' || id || '@prueba.orbita.test')
    OR password_hash IS NOT NULL
    OR google_id IS NOT NULL);

-- Compradores reales. El nombre queda "Cliente <6 del id>", el mismo que se
-- pone abajo en buyer_name de sus pedidos. El email solo se reemplaza donde
-- había uno: un cliente de POS sin email sigue sin email, así el vínculo
-- POS - storefront no cambia. Foto (servida desde el Storage de producción),
-- teléfono, DNI, nacimiento, hash y google_id en NULL.
UPDATE public.customers
SET first_name = 'Cliente',
    last_name = upper(left(id, 6)),
    email = CASE WHEN email IS NULL THEN NULL ELSE 'cliente-' || id || '@prueba.orbita.test' END,
    phone = NULL,
    dni = NULL,
    birth_date = NULL,
    avatar_url = NULL,
    password_hash = NULL,
    google_id = NULL
WHERE business_id NOT IN (SELECT b.id FROM public.businesses b WHERE b.subdomain IN ('negocio', 'zapatoslorena', 'alex', 'asd'))
  AND (first_name <> 'Cliente'
    OR last_name IS DISTINCT FROM upper(left(id, 6))
    OR (email IS NOT NULL AND email <> ('cliente-' || id || '@prueba.orbita.test'))
    OR phone IS NOT NULL
    OR dni IS NOT NULL
    OR birth_date IS NOT NULL
    OR avatar_url IS NOT NULL
    OR password_hash IS NOT NULL
    OR google_id IS NOT NULL);

-- Domicilios guardados. addresses no tiene business_id: se filtra por el
-- cliente. Calle, piso, depto, referencia y alias identifican la casa; el
-- código postal nuevo (CPA) ubica la cuadra, así que va a '1000'. Ciudad y
-- provincia se conservan: solas no identifican a nadie.
UPDATE public.addresses AS a
SET street = 'Calle de prueba 123',
    floor = NULL,
    depto = NULL,
    referencia = NULL,
    alias = NULL,
    zip = CASE WHEN a.zip IS NULL THEN NULL ELSE '1000' END
FROM public.customers AS c
WHERE c.id = a.customer_id
  AND c.business_id NOT IN (SELECT b.id FROM public.businesses b WHERE b.subdomain IN ('negocio', 'zapatoslorena', 'alex', 'asd'))
  AND (a.street <> 'Calle de prueba 123'
    OR a.floor IS NOT NULL
    OR a.depto IS NOT NULL
    OR a.referencia IS NOT NULL
    OR a.alias IS NOT NULL
    OR (a.zip IS NOT NULL AND a.zip <> '1000'));

-- Proveedores: suelen ser personas o comercios chicos. No se borran
-- (stock_movements.supplier_id).
UPDATE public.suppliers
SET name = 'Proveedor ' || left(id, 8),
    contact = CASE WHEN contact IS NULL THEN NULL ELSE 'Contacto de prueba' END,
    phone = NULL,
    email = CASE WHEN email IS NULL THEN NULL ELSE 'proveedor-' || id || '@prueba.orbita.test' END
WHERE business_id NOT IN (SELECT b.id FROM public.businesses b WHERE b.subdomain IN ('negocio', 'zapatoslorena', 'alex', 'asd'))
  AND (name <> ('Proveedor ' || left(id, 8))
    OR (contact IS NOT NULL AND contact <> 'Contacto de prueba')
    OR phone IS NOT NULL
    OR (email IS NOT NULL AND email <> ('proveedor-' || id || '@prueba.orbita.test')));


-- ============================================================================
-- 5. Pedidos y postventa de negocios que NO son del equipo
-- ============================================================================

-- Nota libre del pedido: el alta manual acepta hasta 2000 caracteres
-- (teléfonos, direcciones) y cancelByCustomer le agrega el motivo que escribió
-- el cliente.
UPDATE public.orders
SET notes = 'Nota de prueba'
WHERE notes IS NOT NULL
  AND notes <> 'Nota de prueba'
  AND business_id NOT IN (SELECT b.id FROM public.businesses b WHERE b.subdomain IN ('negocio', 'zapatoslorena', 'alex', 'asd'));

-- Nota por renglón (por ejemplo un nombre para grabar). Se filtra por el
-- pedido; ninguna lógica la usa.
UPDATE public.order_items AS oi
SET notes = NULL
FROM public.orders AS o
WHERE o.id = oi.order_id
  AND oi.notes IS NOT NULL
  AND o.business_id NOT IN (SELECT b.id FROM public.businesses b WHERE b.subdomain IN ('negocio', 'zapatoslorena', 'alex', 'asd'));

-- Copia del comprador y del domicilio de envío, también de invitados sin fila
-- en customers. buyer_email es el PRIMER destinatario de los mails de estado
-- del pedido, y return-requests y el seguimiento de invitados lo comparan con
-- lo que tipea el comprador: si el pedido tiene cliente, queda igual al
-- customers.email de arriba; si es de un invitado, 'pedido-<order_id>@...'.
-- tracking es un código real de Correo Argentino, OCA o Andreani que muestra
-- nombre y domicilio del destinatario. Ciudad y provincia se conservan.
UPDATE public.online_order_details AS d
SET buyer_name = CASE WHEN o.customer_id IS NOT NULL THEN 'Cliente ' || upper(left(o.customer_id, 6)) ELSE 'Comprador ' || upper(left(d.order_id, 6)) END,
    buyer_email = CASE WHEN d.buyer_email IS NULL THEN NULL WHEN o.customer_id IS NOT NULL THEN 'cliente-' || o.customer_id || '@prueba.orbita.test' ELSE 'pedido-' || d.order_id || '@prueba.orbita.test' END,
    buyer_phone = NULL,
    buyer_dni = NULL,
    shipping_street = CASE WHEN d.shipping_street IS NULL THEN NULL ELSE 'Calle de prueba 123' END,
    shipping_floor = NULL,
    shipping_depto = NULL,
    shipping_referencia = NULL,
    shipping_zip = CASE WHEN d.shipping_zip IS NULL THEN NULL ELSE '1000' END,
    tracking = NULL
FROM public.orders AS o
WHERE o.id = d.order_id
  AND o.business_id NOT IN (SELECT b.id FROM public.businesses b WHERE b.subdomain IN ('negocio', 'zapatoslorena', 'alex', 'asd'))
  AND (d.buyer_name <> (CASE WHEN o.customer_id IS NOT NULL THEN 'Cliente ' || upper(left(o.customer_id, 6)) ELSE 'Comprador ' || upper(left(d.order_id, 6)) END)
    OR (d.buyer_email IS NOT NULL AND d.buyer_email NOT LIKE '%@prueba.orbita.test')
    OR d.buyer_phone IS NOT NULL
    OR d.buyer_dni IS NOT NULL
    OR (d.shipping_street IS NOT NULL AND d.shipping_street <> 'Calle de prueba 123')
    OR d.shipping_floor IS NOT NULL
    OR d.shipping_depto IS NOT NULL
    OR d.shipping_referencia IS NOT NULL
    OR (d.shipping_zip IS NOT NULL AND d.shipping_zip <> '1000')
    OR d.tracking IS NOT NULL);

-- Referencia libre del cobro presencial: número de operación bancaria o
-- nombre de quien transfirió.
UPDATE public.payments
SET reference = NULL
WHERE reference IS NOT NULL
  AND business_id NOT IN (SELECT b.id FROM public.businesses b WHERE b.subdomain IN ('negocio', 'zapatoslorena', 'alex', 'asd'));

-- Motivo de devolución: lo escribe el cliente. NOT NULL, así que va texto.
UPDATE public.returns
SET reason = 'Motivo de prueba'
WHERE reason <> 'Motivo de prueba'
  AND business_id NOT IN (SELECT b.id FROM public.businesses b WHERE b.subdomain IN ('negocio', 'zapatoslorena', 'alex', 'asd'));

-- Motivo del cliente y respuesta del negocio al rechazar. mp_refund_id se
-- conserva: solo se escribe después del reembolso, nunca se vuelve a mandar a
-- MP.
UPDATE public.cancellation_requests
SET reason = 'Motivo de prueba',
    rejection_message = CASE WHEN rejection_message IS NULL THEN NULL ELSE 'Mensaje de prueba' END
WHERE business_id NOT IN (SELECT b.id FROM public.businesses b WHERE b.subdomain IN ('negocio', 'zapatoslorena', 'alex', 'asd'))
  AND (reason <> 'Motivo de prueba'
    OR (rejection_message IS NOT NULL AND rejection_message <> 'Mensaje de prueba'));

-- Chat tienda - cliente: direcciones, teléfonos, datos de pago. Se reemplaza el
-- texto en vez de borrar conversaciones, así la bandeja se sigue pudiendo
-- probar. messages no tiene business_id: se filtra por la conversación.
UPDATE public.messages AS m
SET "text" = CASE WHEN m.sender = 'STORE' THEN 'Respuesta de prueba' ELSE 'Mensaje de prueba' END
FROM public.conversations AS c
WHERE c.id = m.conversation_id
  AND c.business_id NOT IN (SELECT b.id FROM public.businesses b WHERE b.subdomain IN ('negocio', 'zapatoslorena', 'alex', 'asd'))
  AND m."text" <> (CASE WHEN m.sender = 'STORE' THEN 'Respuesta de prueba' ELSE 'Mensaje de prueba' END);

-- Reseñas publicadas y motivo del dueño al ocultarlas (HideReviewDto lo exige,
-- por eso no va en NULL). El nombre del autor ya quedó anonimizado en customers.
UPDATE public.reviews
SET "text" = 'Reseña de prueba',
    hidden_reason = CASE WHEN hidden_reason IS NULL THEN NULL ELSE 'Motivo de prueba' END
WHERE business_id NOT IN (SELECT b.id FROM public.businesses b WHERE b.subdomain IN ('negocio', 'zapatoslorena', 'alex', 'asd'))
  AND ("text" <> 'Reseña de prueba'
    OR (hidden_reason IS NOT NULL AND hidden_reason <> 'Motivo de prueba'));


-- ============================================================================
-- 6. Registros y textos generados de negocios que NO son del equipo
-- ============================================================================

-- Campana del panel. Solo dos eventos llevan el nombre que tipeó el comprador
-- (notifications.service.ts): 'cliente_nuevo' en título y cuerpo...
UPDATE public.notifications
SET title = 'Nuevo cliente: Cliente de prueba',
    body = 'Cliente de prueba se registró en tu negocio.'
WHERE event = 'cliente_nuevo'
  AND business_id NOT IN (SELECT b.id FROM public.businesses b WHERE b.subdomain IN ('negocio', 'zapatoslorena', 'alex', 'asd'))
  AND (title <> 'Nuevo cliente: Cliente de prueba'
    OR body <> 'Cliente de prueba se registró en tu negocio.');

-- ...y 'nuevo_pedido' en el cuerpo, con formato "<nombre>: $<total>". Se
-- conserva el monto si el formato coincide. El resto de los eventos lleva solo
-- números de pedido, montos y nombres de producto.
UPDATE public.notifications
SET body = 'Cliente de prueba' || coalesce(': ' || substring(body from '\$[0-9.]+$'), '')
WHERE event = 'nuevo_pedido'
  AND business_id NOT IN (SELECT b.id FROM public.businesses b WHERE b.subdomain IN ('negocio', 'zapatoslorena', 'alex', 'asd'))
  AND body NOT LIKE 'Cliente de prueba%';

-- Auditoría del negocio. changes guarda antes/después de nombre, email,
-- teléfono y DNI de clientes, búsquedas de exportación, asuntos de mails
-- masivos y nombres de miembros: es muy variado para limpiarlo campo por
-- campo, así que va en NULL. Se conserva la línea de tiempo (quién, qué
-- entidad, qué acción, cuándo). member_name pasa al mismo nombre que quedó en
-- members. La tabla es de solo agregado en el código, no en la base.
UPDATE public.audit_logs
SET changes = NULL,
    member_name = CASE WHEN member_name IS NULL THEN NULL WHEN member_id IS NOT NULL THEN 'Miembro ' || left(member_id, 8) ELSE 'Miembro de prueba' END
WHERE business_id NOT IN (SELECT b.id FROM public.businesses b WHERE b.subdomain IN ('negocio', 'zapatoslorena', 'alex', 'asd'))
  AND (changes IS NOT NULL
    OR (member_name IS NOT NULL AND member_name <> (CASE WHEN member_id IS NOT NULL THEN 'Miembro ' || left(member_id, 8) ELSE 'Miembro de prueba' END)));

-- Mails enviados: destinatario real, asunto con nombres, pedidos o texto
-- tipeado (soporte, mail masivo) y error que suele repetir la dirección. Se
-- conservan las filas (alimentan la pestaña Actividad del cliente) con el
-- destinatario que corresponde a la persona ya anonimizada, así siguen
-- coincidiendo con customers y members.
UPDATE public.email_logs
SET "to" = (CASE WHEN customer_id IS NOT NULL THEN 'cliente-' || customer_id WHEN member_id IS NOT NULL THEN 'miembro-' || member_id ELSE 'envio-' || id END) || '@prueba.orbita.test',
    subject = 'Asunto de prueba (' || coalesce(template, 'personalizado') || ')',
    error = CASE WHEN error IS NULL THEN NULL ELSE 'Error de prueba' END
WHERE business_id NOT IN (SELECT b.id FROM public.businesses b WHERE b.subdomain IN ('negocio', 'zapatoslorena', 'alex', 'asd'))
  AND ("to" <> ((CASE WHEN customer_id IS NOT NULL THEN 'cliente-' || customer_id WHEN member_id IS NOT NULL THEN 'miembro-' || member_id ELSE 'envio-' || id END) || '@prueba.orbita.test')
    OR subject <> ('Asunto de prueba (' || coalesce(template, 'personalizado') || ')')
    OR (error IS NOT NULL AND error <> 'Error de prueba'));

-- Mails sin negocio (avisos de plataforma, ofertas de códigos a prospectos,
-- códigos de 2FA): el filtro por negocio no los alcanza. Se conservan los que
-- van a un super admin o a un miembro de una tienda del equipo; el resto se
-- anonimiza igual que arriba.
UPDATE public.email_logs
SET "to" = (CASE WHEN customer_id IS NOT NULL THEN 'cliente-' || customer_id WHEN member_id IS NOT NULL THEN 'miembro-' || member_id ELSE 'envio-' || id END) || '@prueba.orbita.test',
    subject = 'Asunto de prueba (' || coalesce(template, 'personalizado') || ')',
    error = CASE WHEN error IS NULL THEN NULL ELSE 'Error de prueba' END
WHERE business_id IS NULL
  AND lower("to") NOT IN (SELECT lower(pa.email) FROM public.platform_admins pa UNION SELECT lower(m.email) FROM public.members m WHERE m.business_id IN (SELECT b.id FROM public.businesses b WHERE b.subdomain IN ('negocio', 'zapatoslorena', 'alex', 'asd')))
  AND ("to" <> ((CASE WHEN customer_id IS NOT NULL THEN 'cliente-' || customer_id WHEN member_id IS NOT NULL THEN 'miembro-' || member_id ELSE 'envio-' || id END) || '@prueba.orbita.test')
    OR subject <> ('Asunto de prueba (' || coalesce(template, 'personalizado') || ')')
    OR (error IS NOT NULL AND error <> 'Error de prueba'));

-- Chats de dueños y empleados con Orbi: la respuesta repite lo que Orbi leyó
-- con sus tools (nombres, emails, teléfonos y direcciones de clientes) y, al
-- retomar el chat, el historial se manda al LLM. Una conversación vacía no
-- sirve para nada, así que se borran; no tienen hijos.
DELETE FROM public.orbi_conversations
WHERE business_id NOT IN (SELECT b.id FROM public.businesses b WHERE b.subdomain IN ('negocio', 'zapatoslorena', 'alex', 'asd'));


-- ============================================================================
-- 7. Plataforma (super panel) y analítica del wizard
-- ============================================================================

-- Motivo libre de una cortesía: suele nombrar a la dueña o el trato.
UPDATE public.subscriptions
SET grant_reason = 'Cortesía de prueba'
WHERE grant_reason IS NOT NULL
  AND grant_reason <> 'Cortesía de prueba'
  AND business_id NOT IN (SELECT b.id FROM public.businesses b WHERE b.subdomain IN ('negocio', 'zapatoslorena', 'alex', 'asd'));

-- "Para qué se creó" un código de plataforma: en la práctica nombra al
-- prospecto con el que se cerró el trato. Todas las filas.
UPDATE public.platform_discount_codes
SET note = 'Nota de prueba'
WHERE note IS NOT NULL
  AND note <> 'Nota de prueba';

-- Email del alta que usó un código, capturado aunque el negocio nunca se haya
-- creado (business_id NULL, texto sin FK). Se conservan solo los del equipo.
UPDATE public.platform_discount_redemptions
SET email = 'alta-' || id || '@prueba.orbita.test'
WHERE email <> ('alta-' || id || '@prueba.orbita.test')
  AND (business_id IS NULL OR business_id NOT IN (SELECT b.id FROM public.businesses b WHERE b.subdomain IN ('negocio', 'zapatoslorena', 'alex', 'asd')))
  AND lower(email) NOT IN (SELECT lower(pa.email) FROM public.platform_admins pa UNION SELECT lower(m.email) FROM public.members m WHERE m.business_id IN (SELECT b.id FROM public.businesses b WHERE b.subdomain IN ('negocio', 'zapatoslorena', 'alex', 'asd')));

-- Log del super panel: login_ok, login_failed y mfa_* guardan ip y userAgent
-- (platform-admin-log.service.ts). Se quitan en todas las filas; el resto del
-- detalle es del equipo.
UPDATE public.platform_admin_logs
SET details = details - 'ip'::text - 'userAgent'::text
WHERE jsonb_typeof(details) = 'object'
  AND ((details->>'ip') IS NOT NULL OR (details->>'userAgent') IS NOT NULL);

-- login_failed guarda el email tipeado, que puede no ser de nadie del equipo.
UPDATE public.platform_admin_logs
SET details = jsonb_set(details, '{email}', to_jsonb('admin-log-' || id || '@prueba.orbita.test'))
WHERE jsonb_typeof(details) = 'object'
  AND (details->>'email') IS NOT NULL
  AND (details->>'email') <> ('admin-log-' || id || '@prueba.orbita.test')
  AND lower(details->>'email') NOT IN (SELECT lower(pa.email) FROM public.platform_admins pa);

-- send_mail_test guarda el destinatario de la prueba.
UPDATE public.platform_admin_logs
SET details = jsonb_set(details, '{to}', to_jsonb('admin-log-' || id || '@prueba.orbita.test'))
WHERE jsonb_typeof(details) = 'object'
  AND (details->>'to') IS NOT NULL
  AND (details->>'to') <> ('admin-log-' || id || '@prueba.orbita.test')
  AND lower(details->>'to') NOT IN (SELECT lower(pa.email) FROM public.platform_admins pa);

-- suspend_business guarda el motivo libre (target_type 'business').
UPDATE public.platform_admin_logs
SET details = jsonb_set(details, '{reason}', to_jsonb('Motivo de prueba'::text))
WHERE jsonb_typeof(details) = 'object'
  AND (details->>'reason') IS NOT NULL
  AND (details->>'reason') <> 'Motivo de prueba'
  AND target_id NOT IN (SELECT b.id FROM public.businesses b WHERE b.subdomain IN ('negocio', 'zapatoslorena', 'alex', 'asd'));

-- grant_comp guarda el motivo de la cortesía (target_type 'subscription', con
-- el id de la suscripción).
UPDATE public.platform_admin_logs
SET details = jsonb_set(details, '{grantReason}', to_jsonb('Cortesía de prueba'::text))
WHERE jsonb_typeof(details) = 'object'
  AND (details->>'grantReason') IS NOT NULL
  AND (details->>'grantReason') <> 'Cortesía de prueba'
  AND target_id NOT IN (SELECT s.id FROM public.subscriptions s WHERE s.business_id IN (SELECT b.id FROM public.businesses b WHERE b.subdomain IN ('negocio', 'zapatoslorena', 'alex', 'asd')))
  AND target_id NOT IN (SELECT b.id FROM public.businesses b WHERE b.subdomain IN ('negocio', 'zapatoslorena', 'alex', 'asd'));

-- Titular WHOIS de un dominio comprado: buyDomain lo manda a Vercel. Todas las
-- columnas son NOT NULL, así que se reemplazan. Ciudad, provincia y país se
-- conservan: sin nombre, email, teléfono ni calle no identifican a nadie.
UPDATE public.domain_purchase_orders
SET contact_first_name = 'Titular',
    contact_last_name = 'De Prueba',
    contact_email = 'dominio-' || id || '@prueba.orbita.test',
    contact_phone = '+54.1100000000',
    contact_address1 = 'Calle de prueba 123',
    contact_zip = '1000'
WHERE business_id NOT IN (SELECT b.id FROM public.businesses b WHERE b.subdomain IN ('negocio', 'zapatoslorena', 'alex', 'asd'))
  AND (contact_first_name <> 'Titular'
    OR contact_last_name <> 'De Prueba'
    OR contact_email <> ('dominio-' || id || '@prueba.orbita.test')
    OR contact_phone <> '+54.1100000000'
    OR contact_address1 <> 'Calle de prueba 123'
    OR contact_zip <> '1000');

-- Preguntas a Orbi de gente sin cuenta durante el alta, y sus respuestas.
-- redact.ts tapa emails, URLs, CUIT/DNI y teléfonos, pero no nombres,
-- domicilios ni marcas. Se reemplaza el texto y se conservan topic, rating,
-- latencia y tokens para el tablero. No tiene negocio: van todas las filas.
UPDATE public.wizard_ai_turns
SET question = 'Pregunta de prueba',
    answer = 'Respuesta de prueba'
WHERE question <> 'Pregunta de prueba'
   OR answer <> 'Respuesta de prueba';
