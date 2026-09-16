// Carga en la pestaña Auditoría los 22 ítems que hoy NO se destraban escribiendo
// código: las decisiones de producto/datos/legales, lo que hay que ejecutar en
// una consola, y lo que está en la cancha de Mateo. Cada uno trae la propuesta
// concreta y los mismos tres checks, para poder hablarlos con Mateo y dejar
// asentado qué se hace y qué no.
//
// Uso (desde apps/api):
//   node --env-file=.env scripts/auditoria/decisiones-16-09.cjs        → muestra qué haría
//   node --env-file=.env scripts/auditoria/decisiones-16-09.cjs --si   → lo aplica
//
// Idempotente: si el ítem ya existe, actualiza título/foco/propuesta pero NUNCA
// pisa los checks ya tildados ni el estado, por si alguien ya lo movió a mano.
const { PrismaClient } = require('@prisma/client');

const CHECKS = [
  'Hablado con Mateo',
  'Decidido: se hace / no se hace',
  'Aplicado, o asentado como decisión en el ítem relacionado',
];

const G_PRODUCTO = 'Decisiones — producto, datos y legales';
const G_CONSOLA = 'Decisiones — ejecución en consola';
const G_MATEO = 'Decisiones — en la cancha de Mateo';

let orden = 200;
const item = (grupo) => (slug, titulo, foco, propuesta, relacionado) => ({
  key: `decision.${slug}`, grupo, orden: orden++, titulo, foco, propuesta, relacionado,
});
const producto = item(G_PRODUCTO);
const consola = item(G_CONSOLA);
const deMateo = item(G_MATEO);

const ITEMS = [
  // ── Producto, datos y legales ────────────────────────────────────────────
  producto('baja-que-se-borra',
    'Baja de negocio: qué se borra, qué se anonimiza y qué se conserva',
    'Sin esta definición la supresión de datos personales a pedido no se puede implementar sin adivinar. El corte del débito de Mercado Pago ya está resuelto y desplegado (revisión 00105); esto es lo que queda del hallazgo.',
    'Conservar 10 años pedidos, pagos y datos de facturación, por obligación fiscal. Anonimizar clientes y members: nombre, email, teléfono y dirección pasan a un placeholder, conservando los ids para que los pedidos no queden huérfanos. Borrar todo lo demás: sesiones, tokens, conversaciones y archivos subidos. Decidido esto, la implementación es directa.',
    'hallazgo.businesses-sin-baja'),

  producto('verificacion-de-email',
    'Verificación de email: alta paga y cambio de email de un member',
    'Dos hallazgos postergados desde el 15/09 que se resuelven juntos o no se resuelven. Hoy el alta paga no verifica que el email sea de quien paga, y cambiar el email de un member no manda ninguna confirmación.',
    'Construirlo ahora, con UN solo flujo de confirmación por link que sirva a los dos casos: campo pendingEmail más token con vencimiento, aviso al correo anterior cuando es un cambio, y emailVerified recién en true cuando el link se usa. Cierra dos ítems de un saque. Si se decide que no, asentar que el riesgo del alta se acepta porque para bloquear un email ajeno hay que pagar.',
    'hallazgo.alta-sin-verificar-email'),

  producto('moderacion-resenas',
    'Moderación de reseñas desde el panel: ¿entra al roadmap o queda en backlog?',
    'El negocio no puede ver ni moderar sus reseñas desde el panel. Los tres checks del hallazgo son una feature de producto, no un arreglo de seguridad.',
    'Dejarlo en backlog. No compite en prioridad con lo que queda abierto, y el hallazgo está bien descripto para retomarlo cuando haya lugar. Si se decide que sí, es un GET de reseñas con estado, poder volver a mostrar una que se ocultó, y la pantalla del panel.',
    'hallazgo.resenas-sin-moderacion-panel'),

  producto('sucursal-principal',
    '"Sucursal principal" tiene dos definiciones: ¿se unifica ahora o con multi-sucursal?',
    'Conviven dos criterios distintos de cuál es la sucursal principal. Hoy no rompe nada porque casi ningún negocio tiene más de una.',
    'Dejarlo como está hasta el alta de multi-sucursal, y unificar las dos definiciones dentro de ese mismo trabajo. Unificarlo antes es trabajo que se tira cuando cambie el modelo.',
    'hallazgo.sucursal-principal-doble'),

  producto('rotar-postgres',
    'El .env que viajó en 14 tarballs de Cloud Build: ¿se rota la contraseña de Postgres?',
    'Confirmado con evidencia el 12/09: 14 tarballs del bucket de Cloud Build contenían apps/api/.env.bak2, con DATABASE_URL, DIRECT_URL, JWT_SECRET y SUPABASE_SERVICE_ROLE_KEY adentro. Los dos últimos ya se rotaron y están muertos; la contraseña de Postgres sigue con el mismo valor desde el 24/07. Atenuantes: el bucket NO es público y el archivo nunca estuvo en git.',
    'Rotar igual la contraseña de Postgres, borrar los 14 tarballs y borrar el .env.bak2 local. El procedimiento está escrito en DEPLOYMENT.md § Rotación de secretos: generar en el proveedor, cargar la versión nueva, forzar revisión, verificar, y recién ahí invalidar la vieja. Cuesta unos 20 minutos y elimina el riesgo residual. Si se decide que no, asentarlo como riesgo aceptado y cerrar los tres checks del hallazgo como tales, en vez de dejarlos como pendientes que nadie va a hacer.',
    'hallazgo.secretos-tarball-cloud-build'),

  producto('tiendas-del-equipo',
    'Qué pasa con las tiendas del equipo publicadas en *.orbita.site',
    'Además de las 24 tiendas de e2e, que las despublica un script, están las del equipo: negocio, zapatoslorena, alex… Nadie decidió si quedan publicadas o no.',
    'Despublicarlas poniendo isActive en false, sin borrar nada, salvo UNA que quede como tienda de demo para mostrar el producto. Es reversible con un click. tefaltacalleok.com es de una clienta real: no se toca nunca, ni se despublica.',
    'hallazgo.tiendas-prueba-publicadas'),

  producto('rpo-rto',
    'RPO y RTO: cuánta pérdida de datos y cuánto tiempo caído se tolera',
    'DEPLOYMENT.md hoy no documenta ni los backups ni el RPO/RTO. Es un check del hallazgo de backups y no es una decisión técnica: define qué se le promete a los clientes.',
    'Arrancar con RPO 24 horas y RTO 4 horas. Es exactamente lo que el backup diario de Supabase ya da, así que no promete algo que hoy no se puede cumplir. Se sube cuando exista la base de prueba y la restauración esté probada de verdad.',
    'hallazgo.backups-sin-verificar'),

  producto('data-api-supabase',
    '¿Se desactiva la Data API de Supabase?',
    'Es uno de los dos checks que faltan del hallazgo de RLS. Del lado del código ya está cerrado: 70 tablas con RLS, 0 permisos para anon y authenticated, y un test que falla si alguna migración lo apaga.',
    'Desactivarla. Órbita no la usa: todo pasa por la API propia con Prisma y la service role key. Es una superficie de ataque menos, y el RLS queda igual como red de contención. Antes de apretar el botón, confirmar con Mateo que ningún script suyo la esté usando.',
    'hallazgo.rls-api-rest-abierta'),

  producto('legales-abogado',
    'Términos y Política de privacidad ante un abogado',
    'La propia plantilla de los legales pide que los revise un abogado. Es el único check que falta del hallazgo del CUIT: el campo, la razón social, la validación y la migración ya están hechos y desplegados desde el 15/09.',
    'Hacerlo, y aprovechar el mismo pase para incorporar lo que salga de la decisión sobre la baja de negocio: hoy ni los términos ni la privacidad cuentan la ventana de 60 días ni qué se borra.',
    'hallazgo.legales-sin-cuit'),

  producto('preapproval-suelta',
    'La preapproval suelta en Mercado Pago',
    'Hay UNA sola suscripción en la base con mpPreapprovalId, y no se puede saber desde acá a qué monto quedó. Es lo único que falta para cerrar el hallazgo del monto de prueba: el resto ya se revisó con altas-monto-prueba.cjs y ningún cliente real pagó de menos.',
    'Mirarla en el panel de Mercado Pago y anotar el monto en el hallazgo. Si quedó a $15, decidir si se le cancela la preapproval y se le pide autorizar de nuevo al precio real, o si se le respeta.',
    'hallazgo.mp-plan-override-prod'),

  // ── Ejecución en consola ─────────────────────────────────────────────────
  consola('crear-base-prueba',
    'Crear el proyecto Supabase orbita-prueba',
    'Es el cuello de botella más grande del tablero: destraba CINCO ítems (hallazgo.base-prueba, trans.base-prueba, trans.backups, hallazgo.backups-sin-verificar y un check de e2e-aislamiento). El CLI de esta máquina está logueado en otra organización, así que se crea desde el panel.',
    'Crearlo en la organización de Órbita, restaurar ahí un backup de producción y correr preparar-base-prueba.cjs con --verificar y después con --sanear --si. La guía completa está en docs/base-de-prueba.md. El script corta ANTES de conectar si la URL de destino es la de producción, y lee producción siempre en transacciones de solo lectura.',
    'hallazgo.base-prueba'),

  consola('bff-ip-secret',
    'Cargar BFF_IP_SECRET en Secret Manager y en Vercel',
    'Es el único check que le falta al hallazgo de rate limit. El código está de los dos lados desde el 15/09 y desplegado; mientras el secreto no exista, todo lo que pasa por el BFF comparte un solo balde de throttling y las sesiones activas muestran la IP de Vercel. Escribir en Secret Manager y en Vercel está bloqueado desde esta sesión.',
    'Paso a paso en DEPLOYMENT.md § BFF_IP_SECRET: openssl rand -hex 32, gcloud secrets create, sumar BFF_IP_SECRET=BFF_IP_SECRET:latest a SECRETS= en deploy/deploy.sh, cargar el MISMO valor en Vercel como env var de servidor (nunca NEXT_PUBLIC_), desplegar los dos y borrar el archivo temporal. OJO con el orden: no sumarlo a SECRETS= antes de que el secret exista, porque referenciar uno inexistente rompe TODOS los deploys.',
    'hallazgo.rate-limit-ip-proxy'),

  consola('alertas-gasto-ia',
    'Alertas de presupuesto en Google AI Studio y Groq',
    'Único check del hallazgo de gasto de IA. Los topes por negocio y por día ya están en el código desde el 10/09 (Orbi 300, wizard 100 por IP, quitar fondo 30 cada 10 minutos, ai-assist 100), pero viven en memoria de cada instancia y no hay ningún tope del lado del proveedor.',
    'Configurar una alerta de presupuesto en la consola de cada proveedor y confirmar a qué proyecto de GCP se factura GEMINI_API_KEY. Esto afecta la factura, no el funcionamiento del sistema.',
    'hallazgo.gasto-ia'),

  consola('uptime-check',
    'Uptime check en Cloud Monitoring',
    'Único check que falta de health-guard. El endpoint ya responde 200 sin sesión en producción desde el deploy del 15/09; lo que no hay es nadie mirándolo. Si la API se cae, hoy no te enterás solo.',
    'Crear un uptime check en la consola de GCP contra https://api.orbita.site/api/v1/health, con alerta por mail a contacto@orbita-corp.com.',
    'hallazgo.health-guard'),

  consola('rotar-clave-anon',
    'Rotar la clave anon de Supabase',
    'Uno de los dos checks que faltan del hallazgo de RLS. No hay un agujero abierto hoy (las 70 tablas tienen RLS y anon no tiene permisos): es higiene, no urgencia.',
    'Rotarla desde el panel de Supabase y actualizar donde esté referenciada. Conviene hacerlo en la misma sentada que la decisión sobre la Data API.',
    'hallazgo.rls-api-rest-abierta'),

  consola('simulacro-rollback',
    'Simulacro de rollback de la API',
    'Cierra DOS ítems: hallazgo.rollback-sin-simulacro y el c2 de trans.deploy-manual. El runbook está completo en DEPLOYMENT.md con las dos variantes, pero nunca se probó de verdad. Un rollback que nunca se corrió no es un rollback.',
    'En un horario de poco tráfico: listar las revisiones, mover el 100% del tráfico a la inmediatamente anterior (confirmando antes con el git log que entre las dos no hubo migración), verificar con curl que api.orbita.site siga dando 200, y volver SIEMPRE con --to-latest, nunca con --to-revisions <actual>=100. Durante uno o dos minutos la API sirve la revisión anterior.',
    'hallazgo.rollback-sin-simulacro'),

  consola('borrar-cuentas-demo',
    'Borrar las 5 cuentas demo de producción',
    'Cinco cuentas demo-tutorial-*@orbita.test con contraseña compartida, vivas en producción. El script está escrito, commiteado y probado en seco; escribir en producción está bloqueado desde esta sesión.',
    'Correr desde apps/api: node --env-file=.env scripts/auditoria/borrar-cuentas-demo.cjs (sin flags muestra qué haría, con --si lo aplica). Borra los members, sus refresh tokens y los email_logs simulados, todo en una transacción, y el rol "Demo Tutorial" de zapatoslorena solo si queda sin miembros.',
    'hallazgo.cuentas-demo-produccion'),

  consola('despublicar-tiendas-e2e',
    'Despublicar las 24 tiendas de e2e',
    'Tiendas de prueba publicadas en *.orbita.site, con subdominio de e2e más un timestamp de 10 dígitos. El script está escrito y commiteado; escribir en producción está bloqueado desde esta sesión.',
    'Correr desde apps/api: node --env-file=.env scripts/auditoria/despublicar-tiendas-prueba.cjs (sin flags muestra la lista, con --si lo aplica). Solo pone isActive en false, no borra nada y se revierte a mano. Nunca incluye a tefaltacalle ni a las tiendas del equipo.',
    'hallazgo.tiendas-prueba-publicadas'),

  consola('confirmar-backups',
    'Confirmar en el dashboard de Supabase qué backups hay y cada cuánto corren',
    'Primer check del hallazgo de backups, y precondición para decidir el RPO/RTO con un número real en vez de una suposición.',
    'Mirarlo en el dashboard de Supabase y anotarlo en DEPLOYMENT.md. Aprovechar para dejar una copia de MERCADOPAGO_TOKEN_KEY y JWT_SECRET fuera de Cloud Run: si se pierde el proyecto, sin esas dos claves los datos cifrados no se recuperan aunque el backup esté entero.',
    'hallazgo.backups-sin-verificar'),

  consola('borrar-mock-inventario',
    'Borrar el prototipo de Inventario con datos de ejemplo',
    'Prototipo con datos inventados que sigue en el repo y no está montado en ninguna ruta. Borrarlo está bloqueado desde esta sesión, incluso con git rm, que es reversible.',
    'Correr: git rm -r apps/web/src/modules/ventas/panel/inventario apps/web/src/modules/ventas/panel/reportes/mock/reportes.mock.ts — es reversible, queda en la historia de git. Antes, confirmar con Mateo que no lo esté usando de base para algo.',
    'hallazgo.inventario-mock-sin-montar'),

  // ── En la cancha de Mateo ────────────────────────────────────────────────
  deMateo('verificar-dominio-tefaltacalle',
    'Verificar tefaltacalleok.com para que las tiendas con dominio propio pasen el CORS',
    'HOY NINGUNA tienda puede funcionar con dominio propio. El origin de la API solo acepta un CustomDomain en estado ACTIVE con dnsVerified, y el único que existe en la base es tefaltacalleok.com, en PENDING con dnsVerified false. La lógica del CORS está bien: el camino negativo se probó contra producción y funciona; el positivo no se puede probar porque no hay ningún dominio activo.',
    'Que Mateo verifique el DNS de tefaltacalleok.com y lo pase a ACTIVE, y recién ahí probar carrito, checkout y juegos desde ese dominio. Es también el último check del hallazgo de CORS. OJO: es una clienta real, así que se coordina con ella antes de tocar nada de su tienda.',
    'hallazgo.cors-dominios-propios'),

  deMateo('webhook-cobros-vacio',
    'El webhook de cobros nunca escribió en subscription_payments',
    'Encontrado el 16/09 revisando otra cosa, y todavía no tiene ítem propio en el tablero. La tabla subscription_payments está VACÍA, 0 filas, con 7 suscripciones en la base y 3 de ellas ACTIVE. Significa que no hay historial de facturación de nadie: ni el panel del negocio ni el super admin pueden mostrar un cobro. O el webhook no está llegando, o falla en silencio, o los cobros nunca se intentaron.',
    'Investigarlo como ítem propio: revisar en el panel de Mercado Pago si hay cobros efectivamente realizados, mirar los logs de Cloud Run del endpoint de webhook, y confirmar que MP_WEBHOOK_SECRET y la URL de notificación estén bien cargados del lado de MP. Es código de suscripciones, así que lo natural es que lo mire Mateo — pero hay que decidir si lo toma él o se audita desde acá.',
    null),
];

(async () => {
  const p = new PrismaClient();
  const aplicar = process.argv.includes('--si');
  let nuevos = 0;
  let actualizados = 0;

  for (const it of ITEMS) {
    const existente = await p.platformAuditItem.findUnique({ where: { key: it.key }, select: { id: true } });
    const informe = [
      '## Propuesta',
      '',
      it.propuesta,
      '',
      '## Por qué está abierto',
      '',
      it.foco,
      '',
      it.relacionado
        ? `**Ítem relacionado:** \`${it.relacionado}\``
        : '**Sin ítem relacionado:** salió de la revisión del 16/09 y todavía no tiene hallazgo propio.',
    ].join('\n');
    // `checks` y `estado` quedan fuera del update a propósito: si alguien ya
    // tildó "Hablado con Mateo", una segunda corrida no lo destilda.
    const campos = {
      area: 'TRANSVERSAL',
      grupo: it.grupo,
      titulo: it.titulo,
      foco: it.foco,
      informe,
      orden: it.orden,
      esPersonalizado: true,
      severidad: null,
    };

    if (existente) {
      actualizados++;
      console.log(`${aplicar ? '↻' : '·'} ${it.key}: ya existe — se actualizan título, foco y propuesta (checks y estado intactos)`);
      if (aplicar) await p.platformAuditItem.update({ where: { id: existente.id }, data: campos });
    } else {
      nuevos++;
      console.log(`${aplicar ? '+' : '·'} ${it.key}: NUEVO — ${it.grupo}`);
      if (aplicar) {
        await p.platformAuditItem.create({
          data: {
            key: it.key,
            ...campos,
            estado: 'PENDIENTE',
            checks: CHECKS.map((texto, i) => ({ id: `c${i + 1}`, texto, hecho: false })),
          },
        });
      }
    }
  }

  console.log(`\n${nuevos} nuevos, ${actualizados} actualizados, ${ITEMS.length} en total.`);
  if (!aplicar) console.log('(prueba en seco: correr con --si para aplicarlo)');
  await p.$disconnect();
})();
