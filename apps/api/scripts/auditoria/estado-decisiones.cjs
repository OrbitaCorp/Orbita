// Pone al día los 22 ítems `decision.*` con lo que realmente pasó.
//
// Los tres checks de cada uno son: "Hablado con Mateo", "Decidido: se hace /
// no se hace" y "Aplicado, o asentado como decisión en el ítem relacionado".
// Mateo los decidió todos el 16/09, así que los dos primeros están cumplidos
// en los 22. El tercero depende de si el trabajo ya se hizo.
//
// Uso (desde apps/api):
//   node --env-file=.env scripts/auditoria/estado-decisiones.cjs        → muestra qué haría
//   node --env-file=.env scripts/auditoria/estado-decisiones.cjs --si   → lo aplica
const { PrismaClient } = require('@prisma/client');

const CPO = '7af5fdc3-a10f-435d-8d4f-d8c4d0592f23';

// slug → [aplicado, nota]. `aplicado` tilda el tercer check y cierra el ítem.
const ESTADO = {
  // ── Ya aplicados ────────────────────────────────────────────────────────
  'verificacion-de-email': [true, 'Hecho y desplegado el 16/09 (main 97eed, Cloud Run orbita-api-00112-nm4). Cierra DOS hallazgos: alta-sin-verificar-email y member-email-sin-confirmacion.'],
  'moderacion-resenas': [true, 'Hecho y desplegado el 16/09 con el criterio pedido: se entra por el producto, con un ícono en su fila. Se sumó además "volver a mostrar", que no existía.'],
  'borrar-mock-inventario': [true, 'Borrado el 16/09. Lo corrió Ale, porque el clasificador de permisos me niega borrar archivos.'],
  'rpo-rto': [true, 'RPO 24 h y RTO 4 h documentados en DEPLOYMENT.md el 16/09, con las dos condiciones que hacen falta para poder bajarlos.'],
  'data-api-supabase': [true, 'NO SE HACE. Queda asentado como riesgo aceptado en hallazgo.rls-api-rest-abierta, que se cerró por decisión.'],
  'rotar-clave-anon': [true, 'NO SE HACE por ahora: primero hay que armar la interfaz del super admin para resetear APIs sin entrar a Supabase. Asentado en hallazgo.rls-api-rest-abierta.'],
  'legales-abogado': [true, 'NO SE HACE por ahora. Asentado en hallazgo.legales-sin-cuit, que se cerró por decisión.'],
  'preapproval-suelta': [true, 'NO SE HACE: Ale ya se encargó y eliminó esas variables. Asentado en hallazgo.mp-plan-override-prod.'],
  'bff-ip-secret': [true, 'NO SE HACE por ahora. Asentado en hallazgo.rate-limit-ip-proxy, que se cerró por decisión. El código de los dos lados ya está desplegado y sin el secreto no hay regresión: simplemente el límite por IP detrás del BFF sigue compartiendo balde.'],

  // ── Decididos, el trabajo todavía no ────────────────────────────────────
  'baja-que-se-borra': [false, 'En curso el 16/09 a la noche: se está implementando la purga de datos personales en el barrido de los 60 días, con el criterio "se borran, no se anonimizan" y conservando lo que exige la obligación fiscal.'],
  'sucursal-principal': [false, 'En curso el 16/09 a la noche: unificar las dos definiciones.'],
  'tiendas-del-equipo': [false, 'Script listo y commiteado (scripts/auditoria/borrar-negocios-de-prueba.cjs), con prueba en seco corrida: 199 negocios a borrar, quedan tefaltacalle y negocio. Lo tiene que correr Ale: el clasificador me bloquea el borrado masivo.'],
  'rotar-postgres': [false, 'Decidido que se rota, falta hacerlo. Procedimiento en DEPLOYMENT.md § Rotación de secretos. Lo corre Ale.'],
  'crear-base-prueba': [false, 'Sigue sin existir el proyecto orbita-prueba. Es el cuello de botella de cinco ítems del tablero.'],
  'alertas-gasto-ia': [false, 'Decidido que se hace, pero NO es urgente: hoy Groq es el modelo secundario y la clave de Gemini es personal, externa a la cuenta de Órbita. Se configura cuando todo esté bajo la cuenta de Órbita.'],
  'uptime-check': [false, 'Decidido que se hace. Se crea desde la consola de GCP: lo hace Ale.'],
  'simulacro-rollback': [false, 'Decidido que se hace. Lo corre Ale en un horario de poco tráfico; cierra también el c2 de trans.deploy-manual.'],
  'borrar-cuentas-demo': [false, 'Decidido que se hace. El script está listo y probado en seco; lo corre Ale.'],
  'despublicar-tiendas-e2e': [false, 'Decidido que se hace. Queda absorbido por el borrado de los 199 negocios de prueba (decision.tiendas-del-equipo): esas 24 tiendas están adentro.'],
  'confirmar-backups': [false, 'Decidido que se hace. Se mira en el dashboard de Supabase; es precondición para cerrar el RPO/RTO con un número real.'],
  'verificar-dominio-tefaltacalle': [false, 'Decidido que se hace. Lo tiene que hacer Mateo, y coordinando con la clienta antes de tocar su tienda.'],
  'webhook-cobros-vacio': [false, 'Decidido que se investiga. subscription_payments sigue vacía con 3 suscripciones ACTIVE: no hay historial de facturación de nadie.'],
};

(async () => {
  const p = new PrismaClient();
  const aplicar = process.argv.includes('--si');
  const items = await p.platformAuditItem.findMany({
    where: { key: { startsWith: 'decision.' } },
    orderBy: { orden: 'asc' },
    select: { id: true, key: true, estado: true, checks: true, notas: true, decision: true },
  });

  for (const it of items) {
    const slug = it.key.replace('decision.', '');
    const entrada = ESTADO[slug];
    if (!entrada) { console.log(`- ${it.key}: no está en el script, no se toca`); continue; }
    if (!it.decision) { console.log(`- ${it.key}: todavía sin decidir, no se toca`); continue; }
    const [aplicado, nota] = entrada;

    // c1 y c2 los cumplió Mateo al decidir los 22; c3 depende del trabajo.
    const checks = it.checks.map((c, i) => ({ ...c, hecho: i < 2 ? true : aplicado }));
    const estado = aplicado ? 'HECHO' : 'EN_CURSO';
    console.log(`${aplicar ? '✔' : '·'} ${it.key} [${it.decision}]: ${it.estado} → ${estado}`);
    if (!aplicar) continue;

    await p.platformAuditItem.update({
      where: { id: it.id },
      data: {
        estado,
        checks,
        notas: `${it.notas ? `${it.notas}\n\n` : ''}[16/09 noche] ${nota}`,
        actualizadoPorId: CPO,
        ...(aplicado ? { hechoPorId: CPO, hechoAt: new Date() } : {}),
      },
    });
  }
  if (!aplicar) console.log('\n(prueba en seco: correr con --si para aplicarlo)');
  await p.$disconnect();
})();
