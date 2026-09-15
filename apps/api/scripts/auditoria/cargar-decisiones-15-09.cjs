// Carga en el tablero de Auditoría las decisiones del 15/09 sobre los hallazgos
// que quedaban abiertos (ticket RBT-698). Hace falta un script porque el seed
// (src/platform/audit/audit-seed.ts) solo CREA los ítems que faltan: los textos
// nuevos del seed nunca llegan a filas que ya existen, y la pestaña no permite
// editar el foco. Por eso van como notas.
//
// No cambia estados ni checks (eso lo decide el equipo desde la pestaña): solo
// agrega al final de las notas un párrafo que empieza con "[15/09]". Si ya lo
// tiene, no lo repite: correrlo dos veces da lo mismo.
//
// La base del .env es PRODUCCIÓN. Por eso, desde apps/api:
//   node --env-file=.env scripts/auditoria/cargar-decisiones-15-09.cjs        → muestra qué haría
//   node --env-file=.env scripts/auditoria/cargar-decisiones-15-09.cjs --si   → lo aplica
const { PrismaClient } = require('@prisma/client');

// Mismo firmante que cerrar-items-desplegados.cjs.
const CPO = '7af5fdc3-a10f-435d-8d4f-d8c4d0592f23';
const MARCA = '[15/09]';

const DECISIONES = {
  'hallazgo.dominios-comprados-sin-renovacion':
    'Aviso hecho en código (fcc14 + 9273f, falta el deploy de la API): el mantenimiento nocturno manda un mail a cada owner a los 30 y a los 7 días, reintenta los envíos que fallan y no cambia el estado del dominio. Decidido: la renovación es manual, a pedido del dueño, y se cobra aparte al precio del registrador. Después de renovar en Vercel, soporte corre scripts/dominios/registrar-renovacion.cjs. La transferencia, a pedido, por soporte.',
  'hallazgo.legales-sin-cuit':
    'Hecho en código (9e990 + 9273f, falta el deploy de la API; la migración ya está aplicada en producción): CUIT con dígito verificador y razón social en Configuración → Contacto, y en los Términos y la Privacidad de la tienda. Falta que un abogado revise el texto.',
  'hallazgo.businesses-sin-baja':
    'La baja existe (cancelBusiness con ventana de 60 días, aviso a los 7, deletedAt y borrado de refresh tokens), PERO no pausa ni cancela la preapproval de Mercado Pago: al negocio se lo sigue debitando, y un cobro aprobado vuelve la suscripción a ACTIVE y le manda el mail de reactivación. Urgente: ticket RBT-699. Después, la supresión de datos personales a pedido.',
  'hallazgo.auth-estado-en-memoria':
    'Se evaluó la afinidad de sesión de Cloud Run y no sirve acá (el canje lo consume el BFF de Vercel server a server, Firebase Hosting descarta las cookies y el navegador llama sin credentials): no se activó. Sigue abierto: canje de Google en Postgres y, si escala, throttler con storage compartido o max-instances=1.',
  'hallazgo.cambio-plan-activo-no-se-aplica':
    'Queda con Mateo, que está rehaciendo los planes.',
  'hallazgo.alta-sin-verificar-email':
    'Postergado: se resuelve junto con member-email-sin-confirmacion, con un solo flujo de confirmación por link.',
  'hallazgo.member-email-sin-confirmacion':
    'Postergado, va junto con alta-sin-verificar-email. Mientras tanto Equipo no permite editar el email de un member: si no es owner, se lo quita y se lo vuelve a invitar; si es owner, se corrige desde Mi perfil mientras la sesión siga viva o por soporte con un update manual.',
  'hallazgo.resenas-sin-moderacion-panel':
    'Backlog de producto (pantalla de Reseñas en el panel). Hoy soporte no tiene una forma soportada de ocultar una reseña: sería un update manual en la base.',
  'hallazgo.auditoria-sin-pantalla':
    'Enganchar descuentos, cupones, credenciales de Mercado Pago y dominios ya está hecho en código (auditoria-acciones-sin-registro, en tres partes). La pantalla del panel va al backlog de producto.',
  'hallazgo.mp-plan-override-prod':
    'Ale decidió dejarlo en true mientras Mateo lo usa para pruebas.',
  'hallazgo.drift-schema':
    'Verificado con prisma migrate diff contra producción: sin diferencias.',
  'hallazgo.sucursal-principal-doble':
    'Postergado hasta el alta de multi-sucursal (decisión de Ale).',
  'hallazgo.dependencias':
    'Overrides en pnpm-workspace.yaml de api y web (09861): pnpm audit de la API limpio; la web queda con una moderada (uuid@8 de exceljs) que no aplica al uso real. La web ya está en producción; la API toma las versiones nuevas con su próximo deploy.',
};

(async () => {
  const p = new PrismaClient();
  const aplicar = process.argv.includes('--si');
  try {
    const claves = Object.keys(DECISIONES);
    const filas = await p.platformAuditItem.findMany({
      where: { key: { in: claves } },
      select: { id: true, key: true, estado: true, notas: true },
    });
    for (const f of filas) {
      const actuales = (f.notas ?? '').trim();
      if (actuales.includes(MARCA)) {
        console.log(`- ${f.key}: ya tiene las notas del 15/09, no se toca`);
        continue;
      }
      const parrafo = `${MARCA} ${DECISIONES[f.key]}`;
      console.log(`${aplicar ? '✔' : '·'} ${f.key} (${f.estado}): + ${parrafo.slice(0, 90)}…`);
      if (aplicar) {
        await p.platformAuditItem.update({
          where: { id: f.id },
          data: { notas: actuales ? `${actuales}\n\n${parrafo}` : parrafo, actualizadoPorId: CPO },
        });
      }
    }
    const faltan = claves.filter((k) => !filas.some((f) => f.key === k));
    if (faltan.length) console.log('No existen en el tablero (se crean al abrir la pestaña Auditoría):', faltan.join(', '));
    if (!aplicar) console.log('\n(prueba en seco: correr con --si para aplicarlo)');
  } finally {
    await p.$disconnect();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
