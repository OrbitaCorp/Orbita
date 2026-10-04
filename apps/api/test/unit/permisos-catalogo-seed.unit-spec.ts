// El catálogo de permisos vive dos veces a propósito: src/common/permisos/catalogo.ts
// (lo siembra Onboarding en cada negocio nuevo y lo usa Orbi) y prisma/seed.ts
// (prisma/ está fuera del grafo de Nest y no puede importar de src/). Los dos
// comentarios dicen "si cambia, actualizar los dos lugares": este test es lo
// que lo hace cumplir (spec 2026-09-30-orbi-base-de-conocimiento, §3.6 capa 2).
//
// Importa porque accesoDelEquipo explica qué permiso le falta a alguien con la
// etiqueta del catálogo: si el seed y la API difieren, la base de prueba y
// producción dirían cosas distintas.

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { PERMISSIONS } from '../../src/common/permisos/catalogo';

describe('catálogo de permisos: seed.ts y la API son el mismo', () => {
  const seed = readFileSync(resolve(__dirname, '../../prisma/seed.ts'), 'utf8');
  const onboarding = readFileSync(resolve(__dirname, '../../src/onboarding/onboarding.service.ts'), 'utf8');
  const porCodigo = (a: { code: string }, b: { code: string }) => a.code.localeCompare(b.code);

  it('mismos códigos, grupos y etiquetas (el orden no importa)', () => {
    const bloque = /const PERMISSIONS:[^=]*=\s*\[([\s\S]*?)\n\];/.exec(seed)?.[1];
    expect(bloque).toBeDefined();
    const enSeed = [...bloque!.matchAll(/\{\s*group:\s*'([^']+)',\s*code:\s*'([^']+)',\s*label:\s*'([^']+)'\s*\}/g)]
      .map((m) => ({ group: m[1], code: m[2], label: m[3] }));
    expect(enSeed.sort(porCodigo)).toEqual([...PERMISSIONS].sort(porCodigo));
  });

  it('el rol Empleado por defecto tiene los mismos permisos en el seed y en el alta de negocios', () => {
    const empleado = (fuente: string) =>
      [...(/empleado:\s*\[([^\]]*)\]/.exec(fuente)?.[1] ?? '').matchAll(/'([a-z.]+)'/g)].map((m) => m[1]).sort();
    expect(empleado(seed).length).toBeGreaterThan(0);
    expect(empleado(seed)).toEqual(empleado(onboarding));
  });
});
