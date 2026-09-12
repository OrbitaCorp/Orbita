import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

// Auditoría interna 2026-09-10, ítem `api.supabase`.
//
// En producción las 68 tablas de public tenían RLS apagado y los roles anon y
// authenticated con todos los permisos: con la clave anon (pensada para ir en
// el navegador) se leía y modificaba la base entera por la API REST de
// Supabase. La migración 20260910110000_rls_tablas_publicas lo cierra. Este
// test la fija y falla si una migración posterior vuelve a abrir el acceso.

const MIGRACIONES = join(__dirname, '..', '..', 'prisma', 'migrations');
const CIERRE = '20260910110000_rls_tablas_publicas';

const carpetas = readdirSync(MIGRACIONES, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name).sort();
// Sin los comentarios `--`: una migración puede nombrar en su explicación lo
// que justamente no hace (la de RLS aclara que no usa FORCE).
const sql = (carpeta: string) => readFileSync(join(MIGRACIONES, carpeta, 'migration.sql'), 'utf8').replace(/--.*$/gm, '');

describe('RLS y roles públicos de Supabase', () => {
  it('existe la migración que cierra public y hace lo que dice', () => {
    expect(carpetas).toContain(CIERRE);
    const s = sql(CIERRE);
    expect(s).toMatch(/WHERE n\.nspname = 'public' AND c\.relkind = 'r'/);
    expect(s).toMatch(/ENABLE ROW LEVEL SECURITY/);
    expect(s).toMatch(/REVOKE ALL ON TABLE public\.%I FROM anon, authenticated/);
    expect(s).toMatch(/REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated/);
    expect(s).toMatch(/REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM anon, authenticated/);
    expect(s).toMatch(/ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon, authenticated/);
    // No FORCE: el dueño de las tablas (el backend) tiene que seguir sin RLS.
    expect(s).not.toMatch(/FORCE ROW LEVEL SECURITY/);
  });

  it('ninguna migración posterior apaga RLS ni les devuelve permisos a anon/authenticated', () => {
    const posteriores = carpetas.filter((c) => c > CIERRE);
    const culpables = posteriores.filter((c) => {
      const s = sql(c);
      return /DISABLE ROW LEVEL SECURITY/i.test(s) || /GRANT[\s\S]*?\bTO\s+(anon|authenticated)\b/i.test(s);
    });
    expect(culpables).toEqual([]);
  });

  // Excepciones conocidas: tablas creadas sin RLS que YA están aplicadas en
  // producción y se decidió no tocar todavía. Cada una tiene que tener su
  // hallazgo abierto en el tablero de auditoría — esto no las perdona, solo
  // evita que el test tape el resto de los casos nuevos.
  //
  // - subscription_lifecycle_notices: la creó la migración
  //   20260910182701_subscription_lifecycle_fase0 (ciclo de vida de
  //   suscripciones), aplicada en prod el 10/09. Hallazgo
  //   `rls-tabla-ciclo-vida`. Atenuante: no tiene grants para anon ni
  //   authenticated, así que la clave pública no la alcanza igual; la escribe
  //   solo el cron, con la service key.
  const EXCEPCIONES = ['subscription_lifecycle_notices'];

  it('las tablas que se crean después también quedan con RLS (o no hay tablas nuevas)', () => {
    const posteriores = carpetas.filter((c) => c > CIERRE);
    const sinRls = posteriores.flatMap((c) => {
      const s = sql(c);
      const creadas = [...s.matchAll(/CREATE TABLE "([a-z_]+)"/g)].map((m) => m[1]);
      return creadas
        .filter((t) => !EXCEPCIONES.includes(t))
        .filter((t) => !new RegExp(`ALTER TABLE "?${t}"? ENABLE ROW LEVEL SECURITY`, 'i').test(s))
        .map((t) => `${c}: ${t}`);
    });
    expect(sinRls).toEqual([]);
  });
});
