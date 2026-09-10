import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

// Auditoría interna 2026-09-10, ítem `api.supabase`.
//
// En producción las 68 tablas de public tenían RLS apagado y los roles anon y
// authenticated con todos los permisos: con la clave anon (pensada para ir en
// el navegador) se leía y modificaba la base entera por la API REST de
// Supabase. La migración 20260910090000_rls_tablas_publicas lo cierra. Este
// test la fija y falla si una migración posterior vuelve a abrir el acceso.

const MIGRACIONES = join(__dirname, '..', '..', 'prisma', 'migrations');
const CIERRE = '20260910090000_rls_tablas_publicas';

const carpetas = readdirSync(MIGRACIONES, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name).sort();
const sql = (carpeta: string) => readFileSync(join(MIGRACIONES, carpeta, 'migration.sql'), 'utf8');

describe('RLS y roles públicos de Supabase', () => {
  it('existe la migración que cierra public y hace lo que dice', () => {
    expect(carpetas).toContain(CIERRE);
    const s = sql(CIERRE);
    expect(s).toMatch(/FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'public'/);
    expect(s).toMatch(/ENABLE ROW LEVEL SECURITY/);
    expect(s).toMatch(/REVOKE ALL ON ALL TABLES IN SCHEMA public FROM %I/);
    expect(s).toMatch(/ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON TABLES FROM %I/);
    expect(s).toMatch(/ARRAY\['anon', 'authenticated'\]/);
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

  it('las tablas que se crean después también quedan con RLS (o no hay tablas nuevas)', () => {
    const posteriores = carpetas.filter((c) => c > CIERRE);
    const sinRls = posteriores.flatMap((c) => {
      const s = sql(c);
      const creadas = [...s.matchAll(/CREATE TABLE "([a-z_]+)"/g)].map((m) => m[1]);
      return creadas.filter((t) => !new RegExp(`ALTER TABLE "?${t}"? ENABLE ROW LEVEL SECURITY`, 'i').test(s)).map((t) => `${c}: ${t}`);
    });
    expect(sinRls).toEqual([]);
  });
});
