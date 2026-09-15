// Guardas y saneo de la BASE DE PRUEBA (hallazgos `base-prueba` y
// `backups-sin-verificar` de la auditoría interna; guía en
// docs/base-de-prueba.md).
//
// `preparar-base-prueba.cjs` es lo que separa una copia de producción de una
// filtración de datos reales, y lo peligroso vive en dos lados: las guardas
// que impiden apuntar el saneo a producción, y `sanear.sql`. Los dos se
// pueden probar SIN base de datos: el script se exporta como módulo (no
// conecta a nada al requerirlo) y el SQL es un archivo de texto.
//
// Este test corre el validador real del script contra el sanear.sql real: si
// alguien suma una sentencia que no está acotada a las tiendas de afuera, o
// cambia la lista del equipo en un solo lado, acá se ve.

/* eslint-disable @typescript-eslint/no-var-requires */
const preparar = require('../../scripts/base-prueba/preparar-base-prueba.cjs');

const {
  SUBDOMINIOS_EQUIPO,
  CHEQUEOS,
  INFORMATIVOS,
  TABLAS_QUE_EL_SANEO_VACIA,
  leerSentencias,
  identidad,
  refsDeSupabase,
} = preparar as {
  SUBDOMINIOS_EQUIPO: string[];
  CHEQUEOS: [string, string][];
  INFORMATIVOS: [string, string][];
  TABLAS_QUE_EL_SANEO_VACIA: string[];
  leerSentencias: () => { sql: string; linea: number }[];
  identidad: (nombre: string, valor: string) => { clave: string; host: string; usuario: string; puerto: string };
  refsDeSupabase: (id: { host: string; usuario: string }) => string[];
};

const tabla = (sql: string) => (sql.match(/^(?:UPDATE|DELETE\s+FROM)\s+public\.(\w+)/i) ?? [])[1];

// Sentencias que se aplican a TODAS las tiendas a propósito (incluidas las del
// equipo): sesiones y códigos, credenciales de MP, tokens de invitación, ids
// de MP, dominios, y los rastros del super panel y del wizard. Son las filas
// "todas" de la tabla de docs/base-de-prueba.md. Si aparece una nueva sin
// acotar a las tiendas de afuera, este test la hace visible: agregarla acá
// solo después de confirmar que es intencional.
const GLOBALES_ESPERADAS = [
  'refresh_tokens',
  'password_reset_tokens',
  'platform_admin_login_codes',
  'pending_signups',
  'mp_credentials',
  'members',
  'payments',
  'subscriptions',
  'custom_domains',
  'domain_purchase_orders',
  'domain_purchase_orders',
  'domain_purchase_orders',
  'platform_discount_codes',
  'platform_admin_logs',
  'platform_admin_logs',
  'platform_admin_logs',
  'wizard_ai_turns',
];

describe('base de prueba: sanear.sql', () => {
  // leerSentencias() ES el validador del script: solo UPDATE/DELETE, sin DDL
  // ni control de transacción, sin ";" en el medio, sin comentarios inline, y
  // con la lista de subdominios del equipo igual a SUBDOMINIOS_EQUIPO en
  // TODAS las sentencias que la usan. Si algo de eso falla, tira.
  const sentencias = leerSentencias();

  it('pasa el validador del script y no tiene sentencias de más', () => {
    expect(sentencias.length).toBeGreaterThan(0);
    for (const s of sentencias) {
      expect(s.sql).toMatch(/^(UPDATE|DELETE\s+FROM)\s+public\./i);
      expect(tabla(s.sql)).toBeTruthy();
    }
  });

  it('todo lo que no está acotado a las tiendas de afuera es intencional', () => {
    const globales = sentencias.filter((s) => !/subdomain\s+IN/i.test(s.sql)).map((s) => tabla(s.sql));
    expect(globales).toEqual(GLOBALES_ESPERADAS);
  });

  it('las tablas que el saneo vacía se borran enteras, sin WHERE', () => {
    const borradasEnteras = sentencias
      .filter((s) => /^DELETE\s+FROM/i.test(s.sql) && !/\bWHERE\b/i.test(s.sql))
      .map((s) => tabla(s.sql));
    // orbi_conversations también se vacía, pero solo para las tiendas de
    // afuera (las del equipo conservan sus chats): lleva WHERE.
    expect(borradasEnteras.sort()).toEqual(TABLAS_QUE_EL_SANEO_VACIA.filter((t) => t !== 'orbi_conversations').sort());
  });

  it('cada sentencia acotada nombra a las cuatro tiendas del equipo, siempre igual', () => {
    const lista = SUBDOMINIOS_EQUIPO.map((s) => `'${s}'`).join(',');
    const acotadas = sentencias.filter((s) => /subdomain\s+IN/i.test(s.sql));
    expect(acotadas.length).toBeGreaterThan(0);
    for (const s of acotadas) {
      for (const m of s.sql.matchAll(/subdomain\s+IN\s*\(([^)]*)\)/gi)) {
        expect(m[1].replace(/\s+/g, '')).toBe(lista);
      }
    }
  });

  it('los chequeos posteriores al saneo son todos conteos de solo lectura', () => {
    expect(CHEQUEOS.length).toBeGreaterThan(0);
    expect(INFORMATIVOS.length).toBeGreaterThan(0);
    for (const [texto, sql] of [...CHEQUEOS, ...INFORMATIVOS]) {
      expect(texto.length).toBeGreaterThan(0);
      expect(sql).toMatch(/^SELECT count\(\*\)::bigint AS n FROM /);
      expect(sql).not.toMatch(/\b(UPDATE|DELETE|INSERT|DROP|TRUNCATE|ALTER)\b/i);
    }
  });
});

describe('base de prueba: guardas de conexión', () => {
  const PROD_POOLER = 'postgresql://postgres.refdeprod:clave@aws-1-sa-east-1.pooler.supabase.com:5432/postgres';
  const PROD_POOLED = 'postgresql://postgres.refdeprod:clave@aws-1-sa-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true';
  const PRUEBA = 'postgresql://postgres.refdeprueba:otra@aws-1-sa-east-1.pooler.supabase.com:5432/postgres';

  it('la misma base con otro puerto o parámetros es la misma base', () => {
    // El pooler es un host compartido: lo que distingue un proyecto de otro es
    // el usuario. Cambiar 5432 por 6543 o sumar ?pgbouncer=true no convierte
    // producción en otra cosa.
    expect(identidad('a', PROD_POOLER).clave).toBe(identidad('b', PROD_POOLED).clave);
    expect(identidad('a', PROD_POOLER).clave).not.toBe(identidad('b', PRUEBA).clave);
  });

  it('saca el ref del proyecto del usuario del pooler y del host directo', () => {
    expect(refsDeSupabase(identidad('a', PROD_POOLER))).toContain('refdeprod');
    expect(refsDeSupabase(identidad('a', 'postgresql://postgres:c@db.abcdefghijklmnop.supabase.co:5432/postgres'))).toContain(
      'abcdefghijklmnop',
    );
  });

  it('rechaza lo que no es una URL de PostgreSQL, sin imprimir la contraseña', () => {
    expect(() => identidad('DESTINO_URL', 'no-es-una-url')).toThrow(/DESTINO_URL/);
    expect(() => identidad('DESTINO_URL', 'https://ejemplo.com')).toThrow(/PostgreSQL/);
    // El mensaje nunca puede traer la contraseña.
    try {
      identidad('DESTINO_URL', 'no-es-una-url');
    } catch (e) {
      expect((e as Error).message).not.toContain('clave');
    }
  });
});
