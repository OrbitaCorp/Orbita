// Prepara la BASE DE PRUEBA: una copia del backup de producción restaurada en
// OTRO proyecto de Supabase, para desarrollar sin tocar producción (hallazgos
// `base-prueba` y `backups-sin-verificar` de la auditoría interna). De paso
// prueba que el backup restaura. Guía completa: docs/base-de-prueba.md.
//
// Dos bases, dos conexiones, y nunca se escribe en la primera:
//   ORIGEN  = DIRECT_URL del .env → PRODUCCIÓN. Solo SELECT, y siempre dentro
//             de una transacción READ ONLY (la base rechaza cualquier escritura).
//   DESTINO = DESTINO_URL → la base de prueba, conexión directa (session pooler,
//             puerto 5432, usuario postgres.<ref del proyecto DE PRUEBA>).
//
// Se corre desde apps/api, SIEMPRE con el .env de producción (es el ORIGEN):
//   node --env-file=.env scripts/base-prueba/preparar-base-prueba.cjs                    → solo revisa las guardas, no conecta
//   node --env-file=.env scripts/base-prueba/preparar-base-prueba.cjs --verificar        → compara la copia con producción (solo lee)
//   node --env-file=.env scripts/base-prueba/preparar-base-prueba.cjs --sanear           → prueba en seco del saneo (ROLLBACK en la copia)
//   node --env-file=.env scripts/base-prueba/preparar-base-prueba.cjs --sanear --si      → aplica el saneo en la copia (COMMIT)
// Con --verificar y --sanear juntos verifica primero, y si la copia no está
// completa no sanea.
//
// Guardas ANTES de conectar nada: DESTINO_URL tiene que existir, no puede ser
// DIRECT_URL ni DATABASE_URL (ni escrita de otra forma: se compara host +
// usuario + base, sin puerto ni parámetros, porque el pooler es compartido y el
// proyecto va en el usuario), y el ref del proyecto de producción no puede
// aparecer en ningún lado de DESTINO_URL. Después de conectar, además, si las
// dos conexiones llegan al mismo servidor (misma IP, puerto y hora de arranque
// de Postgres) corta.
const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');

// Tiendas del equipo: se conservan tal cual. Tiene que coincidir con TODAS las
// listas de sanear.sql (el script lo verifica antes de correrlo).
const SUBDOMINIOS_EQUIPO = ['negocio', 'zapatoslorena', 'alex', 'asd'];
const EQUIPO_SQL = `(SELECT b.id FROM public.businesses b WHERE b.subdomain IN (${SUBDOMINIOS_EQUIPO.map((s) => `'${s}'`).join(', ')}))`;
const EMAILS_EQUIPO_SQL = `(SELECT lower(pa.email) FROM public.platform_admins pa UNION SELECT lower(m.email) FROM public.members m WHERE m.business_id IN ${EQUIPO_SQL})`;
const DOMINIO_PRUEBA = '@prueba.orbita.test';
const ARCHIVO_SQL = path.join(__dirname, 'sanear.sql');

// Si la copia tiene menos de este porcentaje de las filas de producción en una
// tabla, se marca "revisar". No es error: el backup es una foto y producción
// sigue escribiendo.
const UMBRAL_REVISAR = 0.9;

// Las que el saneo borra a propósito: después de --sanear --si dan distinto.
const TABLAS_QUE_EL_SANEO_VACIA = ['refresh_tokens', 'password_reset_tokens', 'platform_admin_login_codes', 'pending_signups', 'mp_credentials', 'orbi_conversations'];

const FLAGS_VALIDOS = ['--verificar', '--sanear', '--si'];
const args = process.argv.slice(2);
const VERIFICAR = args.includes('--verificar');
const SANEAR = args.includes('--sanear');
const APLICAR = args.includes('--si');

// Un corte por guarda: mensaje claro y exit 1, sin stack.
class Corte extends Error {}
function cortar(mensaje) {
  throw new Corte(mensaje);
}

// ─── Guardas (sin conectar) ──────────────────────────────────────────────────

function decodificar(texto) {
  try {
    return decodeURIComponent(texto);
  } catch {
    return texto;
  }
}

// Identidad de una base: host + usuario + base. El puerto (6543 transaction /
// 5432 session) y los parámetros (?pgbouncer=true, sslmode) NO cuentan: son la
// misma base. Nunca se imprime la URL: tiene la contraseña.
function identidad(nombre, valor) {
  let u;
  try {
    u = new URL(String(valor).trim());
  } catch {
    cortar(`${nombre} no es una URL válida (no la muestro para no imprimir la contraseña).`);
  }
  if (!/^postgres(ql)?:$/i.test(u.protocol)) cortar(`${nombre} no es una URL de PostgreSQL (postgresql://...).`);
  const host = u.hostname.toLowerCase().replace(/\.$/, '');
  const usuario = decodificar(u.username).toLowerCase();
  const base = decodificar(u.pathname.replace(/^\/+/, '')).toLowerCase() || 'postgres';
  return { host, usuario, base, puerto: u.port || '5432', clave: `${host}|${usuario}|${base}` };
}

function describir(id) {
  return `host ${id.host}, puerto ${id.puerto}, usuario ${id.usuario}, base ${id.base}`;
}

// Ref del proyecto de Supabase: en el pooler va en el usuario ("postgres.<ref>")
// y en la conexión directa en el host ("db.<ref>.supabase.co").
function refsDeSupabase(id) {
  const refs = [];
  const porUsuario = id.usuario.match(/^[^.]+\.([a-z0-9]+)$/);
  if (porUsuario) refs.push(porUsuario[1]);
  const porHost = id.host.match(/^(?:db\.)?([a-z0-9]{15,})\.supabase\.(?:co|com|net|in)$/);
  if (porHost) refs.push(porHost[1]);
  return refs;
}

function archivosEnv() {
  const archivos = [];
  const argv = process.execArgv;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--env-file' || a === '--env-file-if-exists') archivos.push(argv[i + 1] || '');
    else if (a.startsWith('--env-file=')) archivos.push(a.slice('--env-file='.length));
    else if (a.startsWith('--env-file-if-exists=')) archivos.push(a.slice('--env-file-if-exists='.length));
  }
  return archivos;
}

function revisarGuardas() {
  const env = process.env;

  // Si se cargó el .env de la base de prueba, DIRECT_URL ya no es producción y
  // "ORIGEN" / "DESTINO" pierden sentido: DESTINO podría terminar siendo
  // producción. BASE_DE_PRUEBA es la marca que lleva .env.prueba (ver la guía).
  if (env.BASE_DE_PRUEBA) {
    cortar('BASE_DE_PRUEBA está definida: se cargó el .env.prueba. Este script se corre con el .env de PRODUCCIÓN, que es el ORIGEN (node --env-file=.env ...).');
  }
  const conPrueba = archivosEnv().filter((f) => /prueba/i.test(path.basename(f)));
  if (conPrueba.length) {
    cortar(`Se cargó ${conPrueba.join(', ')} con --env-file. Este script se corre solo con el .env de producción (node --env-file=.env ...).`);
  }

  if (!env.DIRECT_URL || !env.DIRECT_URL.trim()) {
    cortar('Falta DIRECT_URL (producción, el ORIGEN). Correlo desde apps/api con node --env-file=.env ...');
  }
  if (!env.DESTINO_URL || !env.DESTINO_URL.trim()) {
    cortar('Falta DESTINO_URL: la conexión directa a la base de PRUEBA (session pooler, puerto 5432, usuario postgres.<ref del proyecto de prueba>). Ver docs/base-de-prueba.md.');
  }

  const destinoCrudo = env.DESTINO_URL.trim();
  const origen = identidad('DIRECT_URL', env.DIRECT_URL);
  const destino = identidad('DESTINO_URL', destinoCrudo);
  const pooled = env.DATABASE_URL && env.DATABASE_URL.trim() ? identidad('DATABASE_URL', env.DATABASE_URL) : null;

  for (const [nombre, valor] of [['DIRECT_URL', env.DIRECT_URL], ['DATABASE_URL', env.DATABASE_URL]]) {
    if (valor && valor.trim() === destinoCrudo) cortar(`DESTINO_URL es igual a ${nombre}: es la base de PRODUCCIÓN.`);
  }
  for (const [nombre, id] of [['DIRECT_URL', origen], ['DATABASE_URL', pooled]]) {
    if (id && id.clave === destino.clave) {
      cortar(`DESTINO_URL apunta a la misma base que ${nombre} (${describir(id)}), aunque cambien el puerto o los parámetros: es PRODUCCIÓN.`);
    }
  }

  const refsProduccion = [...new Set([...refsDeSupabase(origen), ...(pooled ? refsDeSupabase(pooled) : [])])];
  if (!refsProduccion.length) {
    cortar('No pude sacar el ref del proyecto de producción de DIRECT_URL ni de DATABASE_URL (se espera usuario "postgres.<ref>" o host "db.<ref>.supabase.co"). Sin ese dato no hay forma de asegurar que DESTINO_URL no sea producción.');
  }
  const textosDestino = [destinoCrudo.toLowerCase(), decodificar(destinoCrudo).toLowerCase()];
  for (const ref of refsProduccion) {
    if (textosDestino.some((t) => t.includes(ref))) {
      cortar(`El ref del proyecto de PRODUCCIÓN (${ref}) aparece en DESTINO_URL. DESTINO_URL tiene que ser del proyecto de prueba.`);
    }
  }

  const avisos = [];
  const refsDestino = refsDeSupabase(destino);
  if (!refsDestino.length) {
    avisos.push('No encontré el ref del proyecto en DESTINO_URL: si es el session pooler de Supabase, el usuario tiene que ser "postgres.<ref del proyecto de prueba>".');
  }
  if (destino.puerto === '6543' || /pgbouncer=true/i.test(destinoCrudo)) {
    avisos.push('DESTINO_URL usa el puerto 6543 (transaction pooler). Para el saneo usá la conexión de sesión: puerto 5432, sin ?pgbouncer=true.');
  }
  return { origen, destino, refsProduccion, refsDestino, avisos };
}

// ─── Lecturas ────────────────────────────────────────────────────────────────

// Toda lectura va en una transacción READ ONLY: aunque alguien agregue por
// error un UPDATE acá, Postgres lo rechaza. Es la ÚNICA forma en que este
// script usa la conexión a producción.
async function leer(cliente, fn) {
  return cliente.$transaction(
    async (tx) => {
      await tx.$executeRawUnsafe('SET TRANSACTION READ ONLY');
      return fn(tx);
    },
    { maxWait: 30_000, timeout: 10 * 60_000 },
  );
}

const ident = (nombre) => `"${String(nombre).replace(/"/g, '""')}"`;
const num = (v) => (v === null || v === undefined ? 0 : Number(v));
const fmt = (n) => Number(n).toLocaleString('es-AR');

async function huellaServidor(tx) {
  const [f] = await tx.$queryRawUnsafe(
    'SELECT inet_server_addr()::text AS addr, inet_server_port() AS puerto, pg_postmaster_start_time()::text AS inicio, current_database()::text AS base',
  );
  return f;
}

// Consulta opcional (esquemas de Supabase, roles): puede no existir o no tener
// permiso. Va en su propia transacción para que un error no aborte las demás.
async function leerOpcional(cliente, sql) {
  try {
    const [f] = await leer(cliente, (tx) => tx.$queryRawUnsafe(sql));
    return f;
  } catch {
    return null;
  }
}

async function fotoDeLaBase(cliente) {
  const foto = await leer(cliente, async (tx) => {
    const [{ ahora }] = await tx.$queryRawUnsafe('SELECT now()::text AS ahora');
    const tablas = (
      await tx.$queryRawUnsafe(
        "SELECT table_name::text AS t FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE' ORDER BY 1",
      )
    ).map((r) => r.t);

    let migraciones = null;
    if (tablas.includes('_prisma_migrations')) {
      const filas = await tx.$queryRawUnsafe(
        'SELECT migration_name::text AS m FROM public._prisma_migrations WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL ORDER BY 1',
      );
      migraciones = [...new Set(filas.map((r) => r.m))];
    }

    const conteos = {};
    for (const t of tablas) {
      const [r] = await tx.$queryRawUnsafe(`SELECT count(*)::bigint AS n FROM public.${ident(t)}`);
      conteos[t] = num(r.n);
    }

    // Último registro de tablas que escriben todo el tiempo: aproxima el
    // momento en que se sacó el backup.
    const ultimos = {};
    for (const t of ['orders', 'email_logs', 'audit_logs', 'wizard_events']) {
      if (!tablas.includes(t)) continue;
      const [r] = await tx.$queryRawUnsafe(`SELECT max(created_at)::text AS f FROM public.${ident(t)}`);
      ultimos[t] = r.f;
    }
    return { ahora, tablas, migraciones, conteos, ultimos };
  });

  // Seguridad de la copia: RLS y permisos de anon/authenticated, que la
  // migración 20260910110000_rls_tablas_publicas dejó en 0 en producción.
  foto.seguridad = await leerOpcional(
    cliente,
    `SELECT count(*) FILTER (WHERE NOT c.relrowsecurity)::int AS sin_rls,
            count(*) FILTER (WHERE has_table_privilege('anon', c.oid, 'SELECT, INSERT, UPDATE, DELETE, TRUNCATE')
                               OR has_table_privilege('authenticated', c.oid, 'SELECT, INSERT, UPDATE, DELETE, TRUNCATE'))::int AS con_permisos_publicos
       FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relkind = 'r'`,
  );
  // Esquemas de Supabase fuera de Prisma: auth.users puede tener usuarios de
  // cuando se usaba Supabase Auth (hasta el 20/07), y storage.objects los
  // metadatos de las fotos (los archivos no viajan con el backup).
  foto.authUsers = await leerOpcional(cliente, 'SELECT count(*)::bigint AS n FROM auth.users');
  foto.storageObjects = await leerOpcional(cliente, 'SELECT count(*)::bigint AS n FROM storage.objects');
  return foto;
}

// ─── --verificar ─────────────────────────────────────────────────────────────

async function verificar(origen, destino) {
  console.log('\n══ Verificación: la copia contra producción (las dos bases, solo lectura) ══');
  const [o, d] = await Promise.all([fotoDeLaBase(origen), fotoDeLaBase(destino)]);
  let ok = true;

  // Tablas
  const faltan = o.tablas.filter((t) => !d.tablas.includes(t));
  const sobran = d.tablas.filter((t) => !o.tablas.includes(t));
  console.log(`\nTablas en public: producción ${o.tablas.length}, copia ${d.tablas.length}.`);
  if (faltan.length) {
    ok = false;
    console.log(`✘ Faltan en la copia (${faltan.length}): ${faltan.join(', ')}`);
  }
  if (sobran.length) console.log(`! Sobran en la copia (${sobran.length}), revisar de dónde salen: ${sobran.join(', ')}`);
  if (!faltan.length && !sobran.length) console.log('✔ Mismas tablas.');

  // Migraciones
  if (!o.migraciones || !d.migraciones) {
    ok = false;
    console.log(`✘ Falta _prisma_migrations en ${!o.migraciones ? 'producción' : 'la copia'}.`);
  } else {
    const soloOrigen = o.migraciones.filter((m) => !d.migraciones.includes(m));
    const soloDestino = d.migraciones.filter((m) => !o.migraciones.includes(m));
    console.log(`\nMigraciones aplicadas: producción ${o.migraciones.length}, copia ${d.migraciones.length}.`);
    if (soloOrigen.length) {
      ok = false;
      console.log(`✘ Aplicadas en producción y no en la copia: ${soloOrigen.join(', ')}`);
    }
    if (soloDestino.length) {
      ok = false;
      console.log(`✘ Aplicadas en la copia y no en producción: ${soloDestino.join(', ')}`);
    }
    if (!soloOrigen.length && !soloDestino.length) console.log(`✔ Mismas migraciones (última: ${o.migraciones[o.migraciones.length - 1] || '-'}).`);
  }

  // Conteos
  const comunes = o.tablas.filter((t) => d.tablas.includes(t));
  const ancho = Math.max(5, ...comunes.map((t) => t.length));
  const paraRevisar = [];
  let totalOrigen = 0;
  let totalDestino = 0;
  console.log(`\n${'tabla'.padEnd(ancho)}  ${'producción'.padStart(12)}  ${'copia'.padStart(12)}  ${'diferencia'.padStart(11)}`);
  console.log(`${'─'.repeat(ancho)}  ${'─'.repeat(12)}  ${'─'.repeat(12)}  ${'─'.repeat(11)}`);
  for (const t of comunes) {
    const no = o.conteos[t];
    const nd = d.conteos[t];
    totalOrigen += no;
    totalDestino += nd;
    const dif = nd - no;
    const revisar = no > 0 && nd < no * UMBRAL_REVISAR;
    if (revisar) paraRevisar.push(t);
    const nota = revisar ? `  revisar${TABLAS_QUE_EL_SANEO_VACIA.includes(t) ? ' (el saneo la vacía: normal si ya se saneó)' : ''}` : '';
    console.log(`${t.padEnd(ancho)}  ${fmt(no).padStart(12)}  ${fmt(nd).padStart(12)}  ${(dif > 0 ? `+${fmt(dif)}` : fmt(dif)).padStart(11)}${nota}`);
  }
  console.log(`${'TOTAL'.padEnd(ancho)}  ${fmt(totalOrigen).padStart(12)}  ${fmt(totalDestino).padStart(12)}  ${fmt(totalDestino - totalOrigen).padStart(11)}`);
  console.log('\nLas diferencias de filas no son error: el backup es una foto y producción sigue escribiendo.');
  if (paraRevisar.length) console.log(`! Con menos del ${UMBRAL_REVISAR * 100}% de las filas de producción: ${paraRevisar.join(', ')}`);

  // Seguridad de la copia
  if (o.seguridad && d.seguridad) {
    console.log(`\nTablas sin RLS: producción ${o.seguridad.sin_rls}, copia ${d.seguridad.sin_rls}. Con permisos para anon/authenticated: producción ${o.seguridad.con_permisos_publicos}, copia ${d.seguridad.con_permisos_publicos}.`);
    if (d.seguridad.sin_rls > o.seguridad.sin_rls || d.seguridad.con_permisos_publicos > o.seguridad.con_permisos_publicos) {
      console.log('! revisar: la copia quedó más abierta que producción. En el SQL Editor del proyecto DE PRUEBA, correr el bloque de prisma/migrations/20260910110000_rls_tablas_publicas/migration.sql (ver la guía).');
    }
  } else {
    console.log('\n· No pude leer RLS/permisos en alguna de las dos bases (¿no existen los roles anon/authenticated?).');
  }

  // Esquemas de Supabase
  const n = (f) => (f ? fmt(num(f.n)) : 'no se pudo leer');
  console.log(`\nauth.users: producción ${n(o.authUsers)}, copia ${n(d.authUsers)}. storage.objects: producción ${n(o.storageObjects)}, copia ${n(d.storageObjects)}.`);
  if (d.authUsers && num(d.authUsers.n) > 0) {
    console.log('! La copia tiene usuarios en auth.users (Supabase Auth, ya no se usa): borrarlos desde el panel del proyecto DE PRUEBA (ver la guía).');
  }

  // Constancia
  const ultimos = Object.entries(d.ultimos).map(([t, f]) => `${t} ${f || '-'}`).join(' · ');
  console.log('\n── Para dejar en el tablero de auditoría (hallazgo.backups-sin-verificar y hallazgo.base-prueba) ──');
  console.log(`Verificado: ${o.ahora} (hora de producción)`);
  console.log(`Último registro en la copia (≈ momento del backup): ${ultimos || '-'}`);
  console.log(`Migraciones: producción ${o.migraciones ? o.migraciones.length : '-'}, copia ${d.migraciones ? d.migraciones.length : '-'}`);
  console.log(`Tablas: producción ${o.tablas.length}, copia ${d.tablas.length}, faltan ${faltan.length}`);
  console.log(`Filas: producción ${fmt(totalOrigen)}, copia ${fmt(totalDestino)}${paraRevisar.length ? `; para revisar: ${paraRevisar.join(', ')}` : ''}`);
  console.log(`Resultado: ${ok ? 'la copia está completa' : 'LA COPIA NO ESTÁ COMPLETA'}`);
  return ok;
}

// ─── --sanear ────────────────────────────────────────────────────────────────

// Parte sanear.sql en sentencias: ignora líneas vacías y de comentario, y corta
// en cada línea que termina con ";".
function leerSentencias() {
  const texto = fs.readFileSync(ARCHIVO_SQL, 'utf8').replace(/^\uFEFF/, '');
  const sentencias = [];
  let actual = [];
  let desde = 0;
  texto.split(/\r?\n/).forEach((linea, i) => {
    const t = linea.trim();
    if (!t || t.startsWith('--')) return;
    if (!actual.length) desde = i + 1;
    actual.push(linea);
    if (t.endsWith(';')) {
      sentencias.push({ sql: actual.join('\n').trim().replace(/;\s*$/, ''), linea: desde });
      actual = [];
    }
  });
  if (actual.length) cortar(`sanear.sql: la sentencia que empieza en la línea ${desde} no termina con ";".`);
  if (!sentencias.length) cortar('sanear.sql no tiene sentencias.');

  const listaEquipo = SUBDOMINIOS_EQUIPO.map((s) => `'${s}'`).join(',');
  let listasVistas = 0;
  for (const s of sentencias) {
    const donde = `sanear.sql, sentencia de la línea ${s.linea}`;
    if (!/^(UPDATE|DELETE\s+FROM)\s/i.test(s.sql)) cortar(`${donde}: solo se permiten UPDATE y DELETE.`);
    if (s.sql.includes(';')) cortar(`${donde}: tiene un ";" en el medio (¿dos sentencias en una?).`);
    if (s.sql.includes('--')) cortar(`${donde}: tiene "--" dentro de la sentencia; los comentarios van en líneas propias.`);
    if (/\b(DROP|TRUNCATE|ALTER|CREATE|GRANT|REVOKE|BEGIN|COMMIT|ROLLBACK)\b/i.test(s.sql)) cortar(`${donde}: tiene DDL o control de transacción.`);
    for (const m of s.sql.matchAll(/subdomain\s+IN\s*\(([^)]*)\)/gi)) {
      listasVistas++;
      if (m[1].replace(/\s+/g, '') !== listaEquipo) {
        cortar(`${donde}: la lista de subdominios del equipo (${m[1].trim()}) no coincide con SUBDOMINIOS_EQUIPO (${SUBDOMINIOS_EQUIPO.join(', ')}).`);
      }
    }
  }
  if (!listasVistas) cortar('sanear.sql no filtra por las tiendas del equipo en ninguna sentencia.');
  return sentencias;
}

function etiqueta(sql) {
  const m = sql.match(/^(UPDATE|DELETE\s+FROM)\s+([\w."]+)/i);
  return m ? `${m[1].toUpperCase().replace(/\s+/g, ' ')} ${m[2]}` : sql.slice(0, 40);
}

const contar = (desde) => `SELECT count(*)::bigint AS n FROM ${desde}`;
const NO_PRUEBA = (col) => `lower(${col}) NOT LIKE '%${DOMINIO_PRUEBA}'`;

// Tienen que dar 0 después del saneo, o no se hace COMMIT.
const CHEQUEOS = [
  ['Sesiones (refresh_tokens)', contar('public.refresh_tokens')],
  ['Códigos de recuperación (password_reset_tokens)', contar('public.password_reset_tokens')],
  ['Códigos de 2FA del super panel', contar('public.platform_admin_login_codes')],
  ['Altas pendientes (pending_signups)', contar('public.pending_signups')],
  ['Credenciales de Mercado Pago (mp_credentials)', contar('public.mp_credentials')],
  ['Invitaciones con token', contar('public.members WHERE invitation_token IS NOT NULL')],
  ['Pagos con mp_payment_id', contar('public.payments WHERE mp_payment_id IS NOT NULL')],
  ['Suscripciones con mp_preapproval_id', contar('public.subscriptions WHERE mp_preapproval_id IS NOT NULL')],
  ['Dominios con nombre real (custom_domains)', contar("public.custom_domains WHERE domain NOT LIKE '%.dominio-prueba.invalid'")],
  ['Compras de dominio esperando pago', contar("public.domain_purchase_orders WHERE status = 'PENDING_PAYMENT'")],
  ['Tiendas fuera del equipo con subdominio real', contar(`public.businesses WHERE id NOT IN ${EQUIPO_SQL} AND subdomain NOT LIKE 'prueba-%'`)],
  ['Clientes fuera del equipo con email real', contar(`public.customers WHERE business_id NOT IN ${EQUIPO_SQL} AND email IS NOT NULL AND ${NO_PRUEBA('email')}`)],
  ['Clientes fuera del equipo con teléfono, DNI, contraseña o Google', contar(`public.customers WHERE business_id NOT IN ${EQUIPO_SQL} AND (phone IS NOT NULL OR dni IS NOT NULL OR password_hash IS NOT NULL OR google_id IS NOT NULL)`)],
  ['Direcciones de clientes fuera del equipo con calle real', contar(`public.addresses a JOIN public.customers c ON c.id = a.customer_id WHERE c.business_id NOT IN ${EQUIPO_SQL} AND a.street <> 'Calle de prueba 123'`)],
  ['Compradores (online_order_details) fuera del equipo con email real', contar(`public.online_order_details d JOIN public.orders o ON o.id = d.order_id WHERE o.business_id NOT IN ${EQUIPO_SQL} AND d.buyer_email IS NOT NULL AND ${NO_PRUEBA('d.buyer_email')}`)],
  ['Compradores fuera del equipo con teléfono, DNI, calle o tracking real', contar(`public.online_order_details d JOIN public.orders o ON o.id = d.order_id WHERE o.business_id NOT IN ${EQUIPO_SQL} AND (d.buyer_phone IS NOT NULL OR d.buyer_dni IS NOT NULL OR d.tracking IS NOT NULL OR (d.shipping_street IS NOT NULL AND d.shipping_street <> 'Calle de prueba 123'))`)],
  ['Miembros fuera del equipo con email real', contar(`public.members WHERE business_id NOT IN ${EQUIPO_SQL} AND ${NO_PRUEBA('email')}`)],
  ['Miembros fuera del equipo con contraseña o Google', contar(`public.members WHERE business_id NOT IN ${EQUIPO_SQL} AND (password_hash IS NOT NULL OR google_id IS NOT NULL)`)],
  ['Proveedores fuera del equipo con email o teléfono real', contar(`public.suppliers WHERE business_id NOT IN ${EQUIPO_SQL} AND (phone IS NOT NULL OR (email IS NOT NULL AND ${NO_PRUEBA('email')}))`)],
  ['Contacto de comercios fuera del equipo (email, WhatsApp, CBU, CUIT)', contar(`public.business_config WHERE business_id NOT IN ${EQUIPO_SQL} AND (whatsapp IS NOT NULL OR cuit IS NOT NULL OR transfer_cbu IS NOT NULL OR transfer_alias IS NOT NULL OR (email IS NOT NULL AND ${NO_PRUEBA('email')}))`)],
  ['email_logs de comercios fuera del equipo con destinatario real', contar(`public.email_logs WHERE business_id NOT IN ${EQUIPO_SQL} AND ${NO_PRUEBA('"to"')}`)],
  ['email_logs sin negocio a destinatarios fuera del equipo', contar(`public.email_logs WHERE business_id IS NULL AND ${NO_PRUEBA('"to"')} AND lower("to") NOT IN ${EMAILS_EQUIPO_SQL}`)],
  ['Titulares WHOIS fuera del equipo con email real', contar(`public.domain_purchase_orders WHERE business_id NOT IN ${EQUIPO_SQL} AND ${NO_PRUEBA('contact_email')}`)],
  ['Altas con código de plataforma con email real fuera del equipo', contar(`public.platform_discount_redemptions WHERE (business_id IS NULL OR business_id NOT IN ${EQUIPO_SQL}) AND ${NO_PRUEBA('email')} AND lower(email) NOT IN ${EMAILS_EQUIPO_SQL}`)],
  ['Chats de Orbi de comercios fuera del equipo', contar(`public.orbi_conversations WHERE business_id NOT IN ${EQUIPO_SQL}`)],
];

// Solo se informan: las tiendas del equipo se conservan tal cual, pero pueden
// tener compradores reales (conocidos que probaron comprar).
const INFORMATIVOS = [
  ['Clientes con email en tiendas del equipo (pueden ser personas reales: revisar a ojo)', contar(`public.customers WHERE business_id IN ${EQUIPO_SQL} AND email IS NOT NULL`)],
  ['Pedidos online de tiendas del equipo con email de comprador', contar(`public.online_order_details d JOIN public.orders o ON o.id = d.order_id WHERE o.business_id IN ${EQUIPO_SQL} AND d.buyer_email IS NOT NULL`)],
];

class PruebaEnSeco extends Error {
  constructor() {
    super('Prueba en seco: ROLLBACK');
    this.marca = 'PRUEBA_EN_SECO';
  }
}
class ChequeoFallido extends Error {
  constructor(fallidos) {
    super(`${fallidos.length} chequeo(s) del saneo no dieron 0`);
    this.marca = 'CHEQUEO_FALLIDO';
    this.fallidos = fallidos;
  }
}

async function sanear(destino) {
  console.log(`\n══ Saneo de la base de PRUEBA ${APLICAR ? '(con --si: COMMIT si todo da bien)' : '(prueba en seco: ROLLBACK al final)'} ══`);
  const sentencias = leerSentencias();

  const equipo = await leer(destino, (tx) =>
    tx.$queryRawUnsafe(`SELECT subdomain::text AS subdomain, name::text AS name FROM public.businesses WHERE subdomain IN (${SUBDOMINIOS_EQUIPO.map((s) => `'${s}'`).join(', ')}) ORDER BY subdomain`),
  );
  if (!equipo.length) {
    cortar(`En la base de prueba no está ninguna tienda del equipo (${SUBDOMINIOS_EQUIPO.join(', ')}). ¿Se restauró el backup en DESTINO_URL? Sin ellas el saneo anonimizaría TODO, así que no se corre.`);
  }
  const faltantes = SUBDOMINIOS_EQUIPO.filter((s) => !equipo.some((b) => b.subdomain === s));
  console.log(`Tiendas del equipo encontradas (se conservan): ${equipo.map((b) => `${b.subdomain} (${b.name})`).join(', ')}`);
  if (faltantes.length) console.log(`! No están en la copia: ${faltantes.join(', ')}`);
  console.log(`${sentencias.length} sentencias de ${path.relative(process.cwd(), ARCHIVO_SQL)}, en una sola transacción:\n`);

  try {
    await destino.$transaction(
      async (tx) => {
        await tx.$executeRawUnsafe("SET LOCAL statement_timeout = '10min'");
        await tx.$executeRawUnsafe("SET LOCAL lock_timeout = '30s'");

        for (const [i, s] of sentencias.entries()) {
          let filas;
          try {
            filas = await tx.$executeRawUnsafe(s.sql);
          } catch (e) {
            throw new Error(`sentencia ${i + 1} (${etiqueta(s.sql)}, línea ${s.linea} de sanear.sql) falló: ${e.message}`);
          }
          console.log(`  ${String(i + 1).padStart(2)}. ${etiqueta(s.sql).padEnd(52)} ${fmt(num(filas)).padStart(9)} filas   (línea ${s.linea})`);
        }

        console.log('\nChequeos (tienen que dar 0):');
        const fallidos = [];
        for (const [texto, sql] of CHEQUEOS) {
          const [r] = await tx.$queryRawUnsafe(sql);
          const n = num(r.n);
          if (n !== 0) fallidos.push(`${texto}: ${fmt(n)}`);
          console.log(`  ${n === 0 ? '✔' : '✘'} ${texto}: ${fmt(n)}`);
        }
        console.log('\nPara revisar a mano:');
        for (const [texto, sql] of INFORMATIVOS) {
          const [r] = await tx.$queryRawUnsafe(sql);
          console.log(`  · ${texto}: ${fmt(num(r.n))}`);
        }

        if (fallidos.length) throw new ChequeoFallido(fallidos);
        if (!APLICAR) throw new PruebaEnSeco();
      },
      { maxWait: 30_000, timeout: 20 * 60_000 },
    );
  } catch (e) {
    if (e && e.marca === 'PRUEBA_EN_SECO') {
      console.log('\n(prueba en seco: se hizo ROLLBACK, la base de prueba quedó como estaba. Correr con --sanear --si para aplicarlo)');
      await avisoAuthUsers(destino);
      return true;
    }
    if (e && e.marca === 'CHEQUEO_FALLIDO') {
      console.log(`\n✘ ${e.message}: se hizo ROLLBACK, no se aplicó nada. Corregir sanear.sql y volver a correr.`);
      return false;
    }
    throw e;
  }
  console.log('\n✔ Saneo aplicado (COMMIT). Una segunda corrida tiene que dar 0 filas en todas las sentencias.');
  await avisoAuthUsers(destino);
  return true;
}

async function avisoAuthUsers(destino) {
  const f = await leerOpcional(destino, 'SELECT count(*)::bigint AS n FROM auth.users');
  if (f && num(f.n) > 0) {
    console.log(`! auth.users de la copia tiene ${fmt(num(f.n))} usuarios (de Supabase Auth, que ya no se usa): sanear.sql no los toca. Borrarlos desde el panel del proyecto DE PRUEBA (ver la guía).`);
  }
}

// ─── Principal ───────────────────────────────────────────────────────────────

// Solo al correrlo como script. Como módulo (require) no conecta ni ejecuta
// nada: así los tests pueden validar sanear.sql sin ninguna base de datos.
if (require.main === module) main();

function main() {
  return (async () => {
  const desconocidos = args.filter((a) => !FLAGS_VALIDOS.includes(a));
  if (desconocidos.length) cortar(`Opciones desconocidas: ${desconocidos.join(' ')}. Válidas: ${FLAGS_VALIDOS.join(' ')}.`);

  const g = revisarGuardas();
  console.log(`ORIGEN  (producción, solo lectura): ${describir(g.origen)}`);
  console.log(`DESTINO (base de prueba):           ${describir(g.destino)}`);
  for (const a of g.avisos) console.log(`! ${a}`);
  console.log('✔ Guardas: DESTINO_URL no es la base de producción del .env.');

  if (!VERIFICAR && !SANEAR) {
    console.log('\nNo se conectó a ninguna base. Opciones:');
    console.log('  --verificar      compara la copia con producción (tablas, migraciones, filas). Solo lee.');
    console.log('  --sanear         prueba en seco del saneo sobre la copia (ROLLBACK).');
    console.log('  --sanear --si    aplica el saneo sobre la copia (COMMIT).');
    return;
  }
  if (APLICAR && !SANEAR) console.log('! --si solo tiene efecto junto con --sanear.');

  const origen = new PrismaClient({ datasources: { db: { url: process.env.DIRECT_URL } } });
  const destino = new PrismaClient({ datasources: { db: { url: process.env.DESTINO_URL } } });
  let codigo = 0;
  try {
    const [ho, hd] = await Promise.all([leer(origen, huellaServidor), leer(destino, huellaServidor)]);
    if (ho.addr && ho.addr === hd.addr && ho.puerto === hd.puerto && ho.inicio === hd.inicio) {
      cortar(`ORIGEN y DESTINO son el mismo servidor de Postgres (${ho.addr}:${ho.puerto}, arrancado ${ho.inicio}): DESTINO_URL es producción.`);
    }
    console.log('✔ Conectado: ORIGEN y DESTINO son servidores distintos.');

    if (VERIFICAR) {
      const completa = await verificar(origen, destino);
      if (!completa) {
        codigo = 1;
        if (SANEAR) console.log('\nLa copia no está completa: no se sanea.');
      }
    }
    if (SANEAR && codigo === 0) {
      const saneada = await sanear(destino);
      if (!saneada) codigo = 1;
    }
  } finally {
    await Promise.allSettled([origen.$disconnect(), destino.$disconnect()]);
  }
  process.exitCode = codigo;
  })().catch((e) => {
    if (e instanceof Corte) console.error(`\nCORTADO: ${e.message}`);
    else console.error('\nERROR', e && e.message ? e.message : e);
    process.exit(1);
  });
}

// Lo que necesita el test de test/unit/base-prueba.unit-spec.ts. Nada de esto
// toca la red: son el parser/validador de sanear.sql y las guardas de URLs.
module.exports = {
  SUBDOMINIOS_EQUIPO,
  ARCHIVO_SQL,
  CHEQUEOS,
  INFORMATIVOS,
  TABLAS_QUE_EL_SANEO_VACIA,
  leerSentencias,
  identidad,
  refsDeSupabase,
  Corte,
};
