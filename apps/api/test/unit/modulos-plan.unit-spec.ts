// Los decoradores del DTO (class-validator / class-transformer) necesitan
// Reflect.getMetadata; sin esto importar KEY_PERMITIDA rompe la suite.
import 'reflect-metadata';
import { AUDIT_SEED } from '../../src/platform/audit/audit-seed';
import { CICLO, MODULOS_SEED, semanaDelCiclo } from '../../src/platform/audit/modulos-seed';
import { AVISO_SESION, CHECKS_ENTRADA, ENTRADAS_MODULOS, entrada } from '../../src/platform/audit/modulos-entradas';
import { KEY_PERMITIDA } from '../../src/platform/audit/dto/audit-item.dto';
import {
  checksDesdeSeed, completarLinks, elegirResponsable, esDeModulos, normalizarChecks, resumir, sinModulos, PlatformAuditService,
} from '../../src/platform/audit/platform-audit.service';

// El plan de Módulos y sus entradas son contenido escrito a mano (una tarea
// por día, por persona; un informe por cosa hecha): estos tests atajan lo que
// el typecheck no ve — una fecha fuera del ciclo, un fin de semana, una semana
// que no coincide con la fecha, una tarea que apunta a una entrada que no
// existe — y cubren las reglas del servicio (entrada obligatoria para marcar
// hecha, keys elegidas a mano, resumen sin los ítems de Módulos, responsables
// por nombre de pila).

const RE_ISO = /^\d{4}-\d{2}-\d{2}$/;
const QUIENES = ['Ale', 'Mateo', 'Alan'];
const diaSemana = (iso: string) => new Date(`${iso}T00:00:00Z`).getUTCDay(); // 0 = domingo
const NOMBRE_MODULO: Record<string, string> = { turnos: 'Turnos', alquileres: 'Alquileres', gimnasio: 'Gimnasio' };

describe('Módulos — seed del plan', () => {
  it('un ítem por módulo con plan, con key modulo.<slug>.plan, único y dentro de AUDIT_SEED', () => {
    const keys = MODULOS_SEED.map((i) => i.key);
    expect(keys).toEqual(['modulo.turnos.plan', 'modulo.alquileres.plan', 'modulo.gimnasio.plan']);
    expect(new Set(keys).size).toBe(keys.length);
    expect(keys.includes('modulo.tienda.plan')).toBe(false);
    const todas = new Set(AUDIT_SEED.map((i) => i.key));
    for (const k of keys) expect(todas.has(k)).toBe(true);
  });

  it('cada plan es FRONTEND, con grupo "Módulo · X", responsable válido y notas con el ciclo y los títulos de semana', () => {
    for (const i of MODULOS_SEED) {
      expect(i.area).toBe('FRONTEND');
      expect(i.grupo).toMatch(/^Módulo · (Turnos|Alquileres|Gimnasio)$/);
      expect(i.titulo).toMatch(/^Plan de /);
      expect(i.foco.trim().length).toBeGreaterThan(10);
      expect(QUIENES).toContain(i.responsable);
      expect(i.estado).toBeUndefined();
      const notas = JSON.parse(i.notas ?? '{}');
      expect(notas).toMatchObject({ horizonte: '2m', inicio: CICLO.inicio, fin2m: CICLO.fin2m, fin1m: CICLO.fin1m });
      expect(notas.semanas).toHaveLength(8);
      for (const s of notas.semanas) expect(typeof s === 'string' && s.trim().length > 3).toBe(true);
      // El front la vuelve a mandar entera al cambiar el horizonte: tiene que
      // entrar en el tope de `notas` del PUT.
      expect((i.notas ?? '').length).toBeLessThan(4000);
    }
    expect(MODULOS_SEED.find((i) => i.key === 'modulo.turnos.plan')?.responsable).toBe('Mateo');
    expect(MODULOS_SEED.find((i) => i.key === 'modulo.alquileres.plan')?.responsable).toBe('Alan');
    expect(MODULOS_SEED.find((i) => i.key === 'modulo.gimnasio.plan')?.responsable).toBe('Ale');
  });

  it('toda tarea tiene fecha hábil dentro del ciclo, dueño, criterio y semanas coherentes', () => {
    for (const i of MODULOS_SEED) {
      expect(i.tareas?.length).toBeGreaterThan(0);
      for (const t of i.tareas!) {
        expect(t.dia).toMatch(RE_ISO);
        expect(new Date(`${t.dia}T00:00:00Z`).toISOString().slice(0, 10)).toBe(t.dia);
        expect(t.dia >= CICLO.inicio && t.dia <= CICLO.fin2m).toBe(true);
        expect(diaSemana(t.dia)).toBeGreaterThanOrEqual(1);
        expect(diaSemana(t.dia)).toBeLessThanOrEqual(5);
        expect(QUIENES).toContain(t.quien);
        expect(t.texto.trim().length).toBeGreaterThan(5);
        expect(t.criterio.trim().length).toBeGreaterThan(5);
        expect(t.semana).toBeGreaterThanOrEqual(1);
        expect(t.semana).toBeLessThanOrEqual(8);
        // La semana sale de la fecha: si alguien edita una sin la otra, esto lo ve.
        expect(t.semana).toBe(semanaDelCiclo(t.dia));
        if (t.semana1m !== null) {
          expect(t.semana1m).toBeGreaterThanOrEqual(1);
          expect(t.semana1m).toBeLessThanOrEqual(4);
        }
        // Semanas 1 a 4: el ciclo de 1 mes es igual (o la tarea queda afuera).
        if (t.semana <= 4) expect(t.semana1m === t.semana || t.semana1m === null).toBe(true);
        // Semanas 5 a 8: se comprimen a la 3 o la 4, o quedan afuera.
        else expect(t.semana1m === null || t.semana1m === 3 || t.semana1m === 4).toBe(true);
      }
    }
  });

  it('el ciclo de 1 mes deja afuera la estadía de Alquileres y nada más', () => {
    for (const i of MODULOS_SEED) {
      const afuera = i.tareas!.filter((t) => t.semana1m === null);
      if (i.key === 'modulo.alquileres.plan') {
        expect(afuera.length).toBeGreaterThan(0);
        for (const t of afuera) expect(t.texto).toMatch(/^Estadía/);
        expect(i.tareas!.filter((t) => /^Estadía/.test(t.texto)).every((t) => t.semana1m === null)).toBe(true);
      } else {
        expect(afuera).toEqual([]);
      }
    }
  });

  it('las tareas transversales de Ale viven en Gimnasio con el prefijo "Transversal: "', () => {
    for (const i of MODULOS_SEED) {
      const transversales = i.tareas!.filter((t) => t.texto.startsWith('Transversal: '));
      if (i.key === 'modulo.gimnasio.plan') {
        expect(transversales.length).toBeGreaterThan(0);
        for (const t of transversales) expect(t.quien).toBe('Ale');
      } else {
        expect(transversales).toEqual([]);
      }
    }
  });

  it('los textos no se repiten dentro de un plan y `checks` es su espejo', () => {
    for (const i of MODULOS_SEED) {
      const textos = i.tareas!.map((t) => t.texto);
      expect(new Set(textos).size).toBe(textos.length);
      expect(i.checks).toEqual(textos);
    }
  });

  it('cada semana del ciclo tiene al menos una tarea y ningún día más de tres por módulo', () => {
    for (const i of MODULOS_SEED) {
      const porDia = new Map<string, number>();
      for (const t of i.tareas!) porDia.set(t.dia, (porDia.get(t.dia) ?? 0) + 1);
      for (const n of porDia.values()) expect(n).toBeLessThanOrEqual(3);
      const semanas = new Set(i.tareas!.map((t) => t.semana));
      for (let s = 1; s <= 8; s++) expect(semanas.has(s)).toBe(true);
    }
  });

  it('toda tarea documentada apunta a una entrada del seed de su mismo módulo', () => {
    const entradas = new Map(ENTRADAS_MODULOS.map((e) => [e.key, e]));
    let documentadas = 0;
    for (const i of MODULOS_SEED) {
      const modulo = i.key.split('.')[1];
      for (const t of i.tareas!.filter((x) => x.auditoria)) {
        documentadas += 1;
        expect(entradas.has(t.auditoria!)).toBe(true);
        expect(t.auditoria!.startsWith(`auditoria.${modulo}.`)).toBe(true);
      }
    }
    // Al menos la de la sección Módulos (Gimnasio, transversal de Ale).
    expect(documentadas).toBeGreaterThan(0);
    const gim = MODULOS_SEED.find((i) => i.key === 'modulo.gimnasio.plan')!;
    expect(gim.tareas!.find((t) => t.auditoria === 'auditoria.gimnasio.2026-10-26-seccion-modulos')?.texto).toMatch(/sección Módulos/);
  });
});

describe('Módulos — entradas de auditoría generadas en sesión', () => {
  it('keys auditoria.<modulo>.<fecha>-<slug>, únicas, permitidas por el DTO y dentro de AUDIT_SEED', () => {
    expect(ENTRADAS_MODULOS.length).toBeGreaterThan(0);
    const keys = ENTRADAS_MODULOS.map((e) => e.key);
    expect(new Set(keys).size).toBe(keys.length);
    const todas = new Set(AUDIT_SEED.map((i) => i.key));
    for (const k of keys) {
      expect(k).toMatch(/^auditoria\.(turnos|alquileres|gimnasio)\.\d{4}-\d{2}-\d{2}-[a-z0-9]+(-[a-z0-9]+)*$/);
      expect(KEY_PERMITIDA.test(k)).toBe(true);
      expect(todas.has(k)).toBe(true);
      const fecha = k.split('.')[2].slice(0, 10);
      expect(new Date(`${fecha}T00:00:00Z`).toISOString().slice(0, 10)).toBe(fecha);
    }
  });

  it('cada entrada tiene grupo con módulo y tipo, área coherente, estado PENDIENTE y los dos checks sin tildar', () => {
    for (const e of ENTRADAS_MODULOS) {
      const modulo = e.key.split('.')[1];
      const m = /^Módulo · (Turnos|Alquileres|Gimnasio) · (tarea|diseño|decisión)$/.exec(e.grupo);
      expect(m).not.toBeNull();
      expect(m![1]).toBe(NOMBRE_MODULO[modulo]);
      expect(['FRONTEND', 'TRANSVERSAL']).toContain(e.area);
      // Lo transversal vive en Gimnasio y se titula "Transversal: …", como en el plan.
      expect(e.area === 'TRANSVERSAL').toBe(e.titulo.startsWith('Transversal: '));
      if (e.area === 'TRANSVERSAL') expect(modulo).toBe('gimnasio');
      expect(e.titulo.trim().length).toBeGreaterThan(5);
      expect(e.foco.trim().length).toBeGreaterThan(10);
      expect(e.foco).not.toMatch(/\n/);
      expect(e.estado).toBe('PENDIENTE');
      expect(e.checks).toEqual(CHECKS_ENTRADA);
      expect(e.checksHechos).toBeUndefined();
      expect(e.severidad).toBeUndefined();
      expect(checksDesdeSeed(e).every((c) => !c.hecho)).toBe(true);
    }
  });

  it('el informe avisa que es de sesión y trae sus secciones según el tipo', () => {
    for (const e of ENTRADAS_MODULOS) {
      const tipo = e.grupo.split(' · ')[2];
      const informe = e.informe ?? '';
      expect(informe.startsWith(AVISO_SESION)).toBe(true);
      expect(informe.length).toBeLessThanOrEqual(80_000);
      for (const s of ['## Qué se hizo', '## Quién', '## Cuándo', '## Archivos']) expect(informe).toContain(s);
      // Al menos un archivo con su línea.
      const archivos = informe.split('## Archivos')[1] ?? '';
      expect(archivos).toMatch(/- `[^`\s]+:\d+(-\d+)?`/);
      expect(informe).not.toMatch(/PENDIENTE_|undefined/);
      if (tipo === 'diseño') {
        const modulo = e.key.split('.')[1];
        for (const alt of ['Antes · 1280', 'Después · 1280', 'Antes · 390', 'Después · 390']) {
          expect(informe).toMatch(new RegExp(`!\\[${alt}\\]\\(/auditoria/modulos/${modulo}/[a-z0-9._-]+\\)`));
        }
      } else {
        expect(informe).not.toContain('## Antes / Después');
      }
      if (tipo === 'decisión') expect(informe).toContain('## Decisión y porqué');
      else expect(informe).not.toContain('## Decisión y porqué');
    }
  });

  it('notas lleva quién, tipo y sesión, y el responsable es quien la hizo', () => {
    for (const e of ENTRADAS_MODULOS) {
      const notas = JSON.parse(e.notas ?? '{}');
      expect(QUIENES).toContain(notas.quien);
      expect(notas.tipo).toBe(e.grupo.split(' · ')[2]);
      expect(notas.sesion).toMatch(RE_ISO);
      expect(e.responsable).toBe(notas.quien);
      expect(e.informe).toContain(`## Quién\n\n${notas.quien}`);
    }
  });

  it('entrada() arma diseño y decisión con sus secciones', () => {
    const base = { modulo: 'turnos' as const, fecha: '2026-11-04', slug: 'agenda', quien: 'Mateo' as const, titulo: 'Agenda nueva', foco: 'La agenda del día como pantalla principal.', que: 'Se rehízo la agenda.', archivos: ['apps/web/src/x.tsx:12'] };
    const diseno = entrada({ ...base, tipo: 'diseño', antes: { 1280: 'a-1280.jpg', 390: 'a-390.jpg' }, despues: { 1280: 'd-1280.jpg', 390: 'd-390.jpg' } });
    expect(diseno.key).toBe('auditoria.turnos.2026-11-04-agenda');
    expect(diseno.grupo).toBe('Módulo · Turnos · diseño');
    expect(diseno.area).toBe('FRONTEND');
    expect(diseno.informe).toContain('## Cuándo\n\nmiércoles 04/11/2026');
    expect(diseno.informe).toContain('![Antes · 1280](/auditoria/modulos/turnos/a-1280.jpg)\n![Después · 1280](/auditoria/modulos/turnos/d-1280.jpg)');
    expect(diseno.informe).toContain('![Antes · 390](/auditoria/modulos/turnos/a-390.jpg)\n![Después · 390](/auditoria/modulos/turnos/d-390.jpg)');
    const decision = entrada({ ...base, tipo: 'decisión', decision: 'La estadía queda para el próximo ciclo', porque: 'No entra en un mes.' });
    expect(decision.grupo).toBe('Módulo · Turnos · decisión');
    expect(decision.informe).toContain('## Decisión y porqué\n\n**Decisión:** La estadía queda para el próximo ciclo\n\n**Porqué:** No entra en un mes.');
    expect(JSON.parse(decision.notas!)).toEqual({ quien: 'Mateo', tipo: 'decisión', sesion: '2026-11-04' });
  });
});

describe('Módulos — helpers del servicio', () => {
  it('checksDesdeSeed vuelve cada tarea un check t1, t2… con sus campos', () => {
    const plan = MODULOS_SEED[0];
    const checks = checksDesdeSeed(plan);
    expect(checks).toHaveLength(plan.tareas!.length);
    checks.forEach((c, i) => {
      const t = plan.tareas![i];
      expect(c).toEqual({
        id: `t${i + 1}`, texto: t.texto, hecho: false, dia: t.dia, quien: t.quien, criterio: t.criterio, semana: t.semana, semana1m: t.semana1m,
        ...(t.auditoria ? { auditoria: t.auditoria } : {}),
      });
    });
    // Un ítem común sigue como siempre.
    expect(checksDesdeSeed({ checks: ['a', 'b'] })).toEqual([{ id: 'c1', texto: 'a', hecho: false }, { id: 'c2', texto: 'b', hecho: false }]);
  });

  it('una tarea documentada en sesión nace con su entrada pero sin tildar', () => {
    const gim = MODULOS_SEED.find((i) => i.key === 'modulo.gimnasio.plan')!;
    const checks = checksDesdeSeed(gim);
    const idx = gim.tareas!.findIndex((t) => t.auditoria);
    expect(idx).toBeGreaterThanOrEqual(0);
    expect(checks[idx]).toMatchObject({ id: `t${idx + 1}`, hecho: false, auditoria: gim.tareas![idx].auditoria });
    expect(checks.filter((c) => !gim.tareas![Number(c.id.slice(1)) - 1].auditoria).every((c) => c.auditoria === undefined)).toBe(true);
  });

  it('normalizarChecks conserva los campos de tarea válidos y descarta los inválidos', () => {
    const [ok, roto] = normalizarChecks([
      { id: 't1', texto: 'ok', hecho: true, dia: '2026-10-26', quien: 'Ale', criterio: 'listo', semana: 1, semana1m: null, auditoria: 'auditoria.gimnasio.x' },
      { id: 't2', texto: 'roto', hecho: false, dia: 'ayer', quien: '', criterio: 7, semana: '3', semana1m: 'cuatro', auditoria: 42 },
    ]);
    expect(ok).toEqual({ id: 't1', texto: 'ok', hecho: true, dia: '2026-10-26', quien: 'Ale', criterio: 'listo', semana: 1, semana1m: null, auditoria: 'auditoria.gimnasio.x' });
    expect(roto).toEqual({ id: 't2', texto: 'roto', hecho: false });
    expect(Object.keys(roto)).toEqual(['id', 'texto', 'hecho']);
    // Un check de siempre no gana campos de la nada.
    expect(Object.keys(normalizarChecks([{ id: 'c1', texto: 'a', hecho: false }])[0])).toEqual(['id', 'texto', 'hecho']);
  });

  it('el resumen del tablero no cuenta los planes ni las entradas de Módulos', () => {
    expect(esDeModulos('modulo.turnos.plan')).toBe(true);
    expect(esDeModulos('auditoria.turnos.2026-10-27-borrar')).toBe(true);
    expect(esDeModulos('api.auth')).toBe(false);
    expect(esDeModulos('decision.baja-que-se-borra')).toBe(false);
    expect(esDeModulos('custom.123')).toBe(false);

    const base = { id: '', grupo: '', titulo: '', ruta: null, foco: '', checks: [], checksHechos: 0, orden: 0, esPersonalizado: false, informeUrl: null, notas: null, informe: null, hechoPor: null, hechoAt: null, actualizadoPor: null, decision: null, decisionNota: null, decisionPor: null, decisionAt: null, updatedAt: new Date(), severidad: null, responsable: null };
    const items = [
      { ...base, key: 'api.auth', area: 'BACKEND', estado: 'HECHO' },
      { ...base, key: 'web.panel', area: 'FRONTEND', estado: 'PENDIENTE' },
      { ...base, key: 'modulo.turnos.plan', area: 'FRONTEND', estado: 'PENDIENTE' },
      { ...base, key: 'auditoria.turnos.2026-10-27-x', area: 'FRONTEND', estado: 'HECHO' },
    ] as Parameters<typeof resumir>[0];
    expect(sinModulos(items).map((i) => i.key)).toEqual(['api.auth', 'web.panel']);
    expect(resumir(sinModulos(items))).toMatchObject({ total: 2, hechos: 1, pendientes: 1, sinResponsable: 1 });
    expect(resumir(sinModulos(items)).porArea.FRONTEND).toEqual({ total: 1, hechos: 0, enCurso: 0 });
  });

  it('solo se pueden elegir keys de los espacios auditoria. y modulo.', () => {
    expect(KEY_PERMITIDA.test('auditoria.turnos.2026-10-27-borrar-appointments')).toBe(true);
    expect(KEY_PERMITIDA.test('auditoria.gimnasio.decision-estadia')).toBe(true);
    expect(KEY_PERMITIDA.test('modulo.turnos.plan')).toBe(true);
    expect(KEY_PERMITIDA.test('custom.abc')).toBe(false);
    expect(KEY_PERMITIDA.test('decision.algo')).toBe(false);
    expect(KEY_PERMITIDA.test('api.auth')).toBe(false);
    expect(KEY_PERMITIDA.test('auditoria.')).toBe(false);
    expect(KEY_PERMITIDA.test('auditoria.Turnos.X')).toBe(false);
    expect(KEY_PERMITIDA.test('auditoria.turnos.con espacio')).toBe(false);
  });

  it('completarLinks suma solo el link que falta, si el texto coincide, sin tocar lo tildado', () => {
    const tareas = [{ texto: 'Uno' }, { texto: 'Dos', auditoria: 'auditoria.turnos.2026-10-26-dos' }, { texto: 'Tres', auditoria: 'auditoria.turnos.2026-10-26-tres' }];
    const checks = [
      { id: 't1', texto: 'Uno', hecho: false },
      { id: 't2', texto: 'Dos', hecho: true },
      { id: 't3', texto: 'Otro texto', hecho: false },
    ];
    expect(completarLinks(checks, tareas)).toEqual([
      { id: 't1', texto: 'Uno', hecho: false },
      { id: 't2', texto: 'Dos', hecho: true, auditoria: 'auditoria.turnos.2026-10-26-dos' },
      // El texto cambió: el id t3 ya no es esa tarea, mejor no adivinar.
      { id: 't3', texto: 'Otro texto', hecho: false },
    ]);
    // Un link puesto desde Módulos no se pisa; sin nada que completar, null.
    expect(completarLinks([{ id: 't2', texto: 'Dos', hecho: false, auditoria: 'auditoria.turnos.otra' }], tareas)).toBeNull();
    expect(completarLinks([{ id: 'c1', texto: 'Dos', hecho: false }], tareas)).toBeNull();
  });
});

// Las cuentas reales de dev (2026-10-26) con emails de mentira donde eran
// personales: Alan tiene cuenta con su nombre; Ale y Mateo, solo la de su cargo.
const ADMINS_DEV = [
  { id: 'alan', name: 'Alan Vega', email: 'alan@ejemplo.com' },
  { id: 'cto', name: 'CTO', email: 'cto@orbita-corp.com' },
  { id: 'ceo', name: 'CEO', email: 'ceo@orbita-corp.com' },
  { id: 'cpo', name: 'CPO', email: 'CPO@orbita-corp.com' },
  { id: 'rm', name: 'RM', email: 'cm@orbita-corp.com' },
  { id: 'mila', name: 'milagros', email: 'milagros@ejemplo.com' },
];

describe('elegirResponsable — de nombre de pila a admin', () => {
  it('con las cuentas de dev: Alan por su nombre, Ale y Mateo por la cuenta de su cargo', () => {
    expect(elegirResponsable('Alan', ADMINS_DEV)).toBe('alan');
    expect(elegirResponsable('Ale', ADMINS_DEV)).toBe('cpo');
    expect(elegirResponsable('Mateo', ADMINS_DEV)).toBe('ceo');
  });

  it('una palabra del nombre tiene que EMPEZAR con el buscado: "Ale" no cae en "Valeria"', () => {
    const admins = [{ id: 'v', name: 'Valeria Ruiz', email: 'v@ejemplo.com' }, ...ADMINS_DEV];
    expect(elegirResponsable('Ale', admins)).toBe('cpo');
    // Con una cuenta personal, esa gana a la del cargo; sin distinguir mayúsculas ni acentos.
    expect(elegirResponsable('Ale', [...admins, { id: 'alex', name: 'ÁLEXANDER Ibarra', email: 'a@ejemplo.com' }])).toBe('alex');
    expect(elegirResponsable('mateo', [{ id: 'm', name: 'Juan Mateo Rojas', email: 'm@ejemplo.com' }])).toBe('m');
  });

  it('sin cuenta con su nombre ni de su cargo, null', () => {
    expect(elegirResponsable('Mateo', [{ id: 'v', name: 'Valeria Ruiz', email: 'v@ejemplo.com' }])).toBeNull();
    expect(elegirResponsable('Alguien', ADMINS_DEV)).toBeNull();
    expect(elegirResponsable('  ', ADMINS_DEV)).toBeNull();
  });
});

// Prisma mockeado: lo que importa es qué se valida y qué se guarda.
function servicio(
  fila: Record<string, unknown> | null,
  entradas: string[] = [],
  admins: { id: string; name: string; email: string }[] = [],
  existentes: { id: string; key: string; checks?: unknown }[] = [],
) {
  const prisma: any = {
    platformAuditItem: {
      findUnique: jest.fn().mockImplementation(({ where }: any) =>
        Promise.resolve(where.id ? fila : entradas.includes(where.key) ? { id: `id-${where.key}` } : null)),
      findMany: jest.fn().mockImplementation((args: any) => {
        const keys: string[] | undefined = args?.where?.key?.in;
        if (keys && args?.select?.checks) return Promise.resolve(existentes.filter((e) => keys.includes(e.key)));
        if (keys) return Promise.resolve(keys.filter((k) => entradas.includes(k)).map((key) => ({ key })));
        return Promise.resolve(existentes.map((e) => ({ key: e.key })));
      }),
      update: jest.fn().mockImplementation(({ data }: any) =>
        Promise.resolve({ ...fila, ...data, checks: data.checks, responsable: null, hechoPor: data.hechoPor ? { id: 'adm', name: 'Ale' } : null, actualizadoPor: { id: 'adm', name: 'Ale' }, decisionPor: null })),
      aggregate: jest.fn().mockResolvedValue({ _max: { orden: 10 } }),
      create: jest.fn().mockImplementation(({ data }: any) =>
        Promise.resolve({ id: 'nuevo', ...data, responsable: data.responsable ? { id: data.responsable.connect.id, name: 'Resp' } : null, hechoPor: data.hechoPor ? { id: 'adm', name: 'Ale' } : null, actualizadoPor: { id: 'adm', name: 'Ale' }, decisionPor: null, updatedAt: new Date() })),
      createMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    platformAdmin: {
      findUnique: jest.fn().mockResolvedValue({ isActive: true }),
      findMany: jest.fn().mockResolvedValue(admins),
    },
    platformAdminLog: { create: jest.fn().mockResolvedValue({}) },
    $transaction: jest.fn().mockImplementation((arg: any) => (typeof arg === 'function' ? arg(prisma) : Promise.all(arg))),
  };
  return { prisma, svc: new PlatformAuditService(prisma) };
}

const plan = {
  id: 'plan-1', key: 'modulo.turnos.plan', area: 'FRONTEND', grupo: 'Módulo · Turnos', titulo: 'Plan de Turnos', ruta: null, foco: 'f', severidad: null,
  estado: 'PENDIENTE', orden: 0, esPersonalizado: false, informeUrl: null, notas: null, informe: null, hechoAt: null, updatedAt: new Date(),
  checks: [
    { id: 't1', texto: 'Inventariar', hecho: false, dia: '2026-10-26', quien: 'Mateo', criterio: 'lista', semana: 1, semana1m: 1 },
    { id: 't2', texto: 'Borrar', hecho: true, dia: '2026-10-27', quien: 'Mateo', criterio: 'verde', semana: 1, semana1m: 1, auditoria: 'auditoria.turnos.2026-10-27-borrar' },
    { id: 't3', texto: 'Consolidar', hecho: false, dia: '2026-10-29', quien: 'Mateo', criterio: 'una carpeta', semana: 1, semana1m: 1, auditoria: 'auditoria.turnos.2026-10-26-consolidar' },
  ],
};

describe('PlatformAuditService.actualizar — tareas de un plan', () => {
  it('marcar una tarea hecha sin entrada de auditoría se rechaza', async () => {
    const { svc, prisma } = servicio(plan);
    await expect(svc.actualizar('adm', 'plan-1', { checks: [{ id: 't1', hecho: true }] }))
      .rejects.toThrow('Para marcar una tarea como hecha hace falta su entrada de auditoría');
    expect(prisma.platformAuditItem.update).not.toHaveBeenCalled();
  });

  it('con una entrada que no existe (o que no es auditoria.*) también se rechaza', async () => {
    const { svc } = servicio(plan, ['auditoria.turnos.2026-10-26-inventario']);
    await expect(svc.actualizar('adm', 'plan-1', { checks: [{ id: 't1', hecho: true, auditoria: 'auditoria.turnos.otra' }] })).rejects.toThrow('entrada de auditoría');
    await expect(svc.actualizar('adm', 'plan-1', { checks: [{ id: 't1', hecho: true, auditoria: 'api.auth' }] })).rejects.toThrow('entrada de auditoría');
  });

  it('con su entrada existente la tilda y guarda la key en el check', async () => {
    const { svc } = servicio(plan, ['auditoria.turnos.2026-10-26-inventario']);
    const r = await svc.actualizar('adm', 'plan-1', { checks: [{ id: 't1', hecho: true, auditoria: 'auditoria.turnos.2026-10-26-inventario' }] });
    expect(r.checks[0]).toEqual({ id: 't1', texto: 'Inventariar', hecho: true, dia: '2026-10-26', quien: 'Mateo', criterio: 'lista', semana: 1, semana1m: 1, auditoria: 'auditoria.turnos.2026-10-26-inventario' });
    expect(r.checks[1].hecho).toBe(true);
    expect(r.checksHechos).toBe(2);
  });

  it('una tarea documentada en sesión se tilda con la entrada que ya tenía, si existe', async () => {
    const { svc } = servicio(plan, ['auditoria.turnos.2026-10-26-consolidar']);
    const r = await svc.actualizar('adm', 'plan-1', { checks: [{ id: 't3', hecho: true }] });
    expect(r.checks[2]).toMatchObject({ id: 't3', hecho: true, auditoria: 'auditoria.turnos.2026-10-26-consolidar' });
    // Si su entrada no está cargada en esta base, no se puede tildar.
    const { svc: svc2 } = servicio(plan);
    await expect(svc2.actualizar('adm', 'plan-1', { checks: [{ id: 't3', hecho: true }] })).rejects.toThrow('entrada de auditoría');
  });

  it('con hecho: false y una entrada, la vincula sin tildarla (la confirma después su responsable)', async () => {
    const { svc } = servicio(plan, ['auditoria.turnos.2026-10-26-inventario']);
    const r = await svc.actualizar('adm', 'plan-1', { checks: [{ id: 't1', hecho: false, auditoria: 'auditoria.turnos.2026-10-26-inventario' }] });
    expect(r.checks[0]).toMatchObject({ id: 't1', hecho: false, auditoria: 'auditoria.turnos.2026-10-26-inventario' });
    // Vincular a algo que no existe también se rechaza.
    const { svc: svc2 } = servicio(plan);
    await expect(svc2.actualizar('adm', 'plan-1', { checks: [{ id: 't1', hecho: false, auditoria: 'auditoria.turnos.no-existe' }] })).rejects.toThrow('entrada de auditoría');
  });

  it('destildar no pide entrada y conserva la que tenía; los ids desconocidos se ignoran', async () => {
    const { svc, prisma } = servicio(plan);
    const r = await svc.actualizar('adm', 'plan-1', { checks: [{ id: 't2', hecho: false }, { id: 'zzz', hecho: true }] });
    expect(r.checks[1]).toMatchObject({ id: 't2', hecho: false, auditoria: 'auditoria.turnos.2026-10-27-borrar' });
    expect(r.checksHechos).toBe(0);
    expect(prisma.platformAuditItem.findMany).not.toHaveBeenCalled();
  });

  it('en un ítem del inventario la key de auditoría del toggle se ignora', async () => {
    const comun = { ...plan, id: 'it-1', key: 'api.auth', checks: [{ id: 'c1', texto: 'a', hecho: false }] };
    const { svc, prisma } = servicio(comun);
    const r = await svc.actualizar('adm', 'it-1', { checks: [{ id: 'c1', hecho: true, auditoria: 'auditoria.turnos.x' }] });
    expect(r.checks).toEqual([{ id: 'c1', texto: 'a', hecho: true }]);
    expect(prisma.platformAuditItem.findMany).not.toHaveBeenCalled();
  });

  it('confirmar una entrada: pasa a HECHO con quién y cuándo y tilda "Confirmada por el responsable"', async () => {
    const fila = {
      ...plan, id: 'e-1', key: 'auditoria.gimnasio.2026-10-26-seccion-modulos', grupo: 'Módulo · Gimnasio · tarea',
      checks: [{ id: 'c1', texto: CHECKS_ENTRADA[0], hecho: false }, { id: 'c2', texto: CHECKS_ENTRADA[1], hecho: false }],
    };
    const { svc, prisma } = servicio(fila);
    const r = await svc.actualizar('adm', 'e-1', { estado: 'HECHO', checks: [{ id: 'c1', hecho: true }] });
    const data = prisma.platformAuditItem.update.mock.calls[0][0].data;
    expect(data.estado).toBe('HECHO');
    expect(data.hechoPor).toEqual({ connect: { id: 'adm' } });
    expect(data.hechoAt).toBeInstanceOf(Date);
    expect(r.checks).toEqual([{ id: 'c1', texto: CHECKS_ENTRADA[0], hecho: true }, { id: 'c2', texto: CHECKS_ENTRADA[1], hecho: false }]);
    // Una entrada no es un plan: no pide otra entrada para tildar.
    expect(prisma.platformAuditItem.findMany).not.toHaveBeenCalled();
  });
});

describe('PlatformAuditService.crear — entradas de Módulos', () => {
  const datos = {
    area: 'FRONTEND' as const, grupo: 'Módulo · Turnos · tarea', titulo: 'Backend de Turnos borrado', foco: 'Se borró appointments',
    checks: CHECKS_ENTRADA, informe: '## Qué se hizo\nSe borró.',
  };

  it('usa la key pedida, guarda informe, notas y responsable, y nace PENDIENTE', async () => {
    const { svc, prisma } = servicio(null);
    const notas = JSON.stringify({ quien: 'Mateo', tipo: 'tarea', plan: 'modulo.turnos.plan', tarea: 't2' });
    const r = await svc.crear('adm', { ...datos, key: 'auditoria.turnos.2026-10-27-backend-borrado', responsableId: 'ceo', notas });
    const data = prisma.platformAuditItem.create.mock.calls[0][0].data;
    expect(data.key).toBe('auditoria.turnos.2026-10-27-backend-borrado');
    expect(data.estado).toBe('PENDIENTE');
    expect(data.hechoPor).toBeUndefined();
    expect(data.informe).toBe('## Qué se hizo\nSe borró.');
    expect(data.notas).toBe(notas);
    expect(data.responsable).toEqual({ connect: { id: 'ceo' } });
    expect(data.esPersonalizado).toBe(true);
    expect(prisma.platformAdmin.findUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'ceo' } }));
    expect(r.key).toBe('auditoria.turnos.2026-10-27-backend-borrado');
    expect(r.responsable).toEqual({ id: 'ceo', name: 'Resp' });
  });

  it('si nace HECHA lleva quién y cuándo', async () => {
    const { svc, prisma } = servicio(null);
    const r = await svc.crear('adm', { ...datos, key: 'auditoria.turnos.2026-10-27-otra', estado: 'HECHO' });
    const data = prisma.platformAuditItem.create.mock.calls[0][0].data;
    expect(data.estado).toBe('HECHO');
    expect(data.hechoPor).toEqual({ connect: { id: 'adm' } });
    expect(data.hechoAt).toBeInstanceOf(Date);
    expect(r.hechoPor).toEqual({ id: 'adm', name: 'Ale' });
  });

  it('un responsable inactivo se rechaza sin crear nada', async () => {
    const { svc, prisma } = servicio(null);
    prisma.platformAdmin.findUnique.mockResolvedValue({ isActive: false });
    await expect(svc.crear('adm', { ...datos, key: 'auditoria.turnos.2026-10-27-x', responsableId: 'viejo' })).rejects.toThrow('inactivo');
    expect(prisma.platformAuditItem.create).not.toHaveBeenCalled();
  });

  it('si la key ya existe, se rechaza sin crear nada', async () => {
    const { svc, prisma } = servicio(null, ['auditoria.turnos.2026-10-27-backend-borrado']);
    await expect(svc.crear('adm', { ...datos, key: 'auditoria.turnos.2026-10-27-backend-borrado' })).rejects.toThrow('Ya existe');
    expect(prisma.platformAuditItem.create).not.toHaveBeenCalled();
  });

  it('sin key sigue naciendo como custom.<uuid>, PENDIENTE, sin hechoAt ni responsable', async () => {
    const { svc, prisma } = servicio(null);
    await svc.crear('adm', { area: 'BACKEND', grupo: 'g', titulo: 't', foco: 'foco', checks: ['uno', 'dos'] });
    const data = prisma.platformAuditItem.create.mock.calls[0][0].data;
    expect(data.key).toMatch(/^custom\.[0-9a-f-]{36}$/);
    expect(data.estado).toBe('PENDIENTE');
    expect(data.hechoPor).toBeUndefined();
    expect(data.responsable).toBeUndefined();
    expect(data.informe).toBeNull();
    expect(data.notas).toBeNull();
    expect(prisma.platformAuditItem.findUnique).not.toHaveBeenCalled();
    expect(prisma.platformAdmin.findUnique).not.toHaveBeenCalled();
  });
});

describe('PlatformAuditService.asegurarSeed — Módulos', () => {
  type Fila = { key: string; responsableId: string | null; estado: string; informe: string | null; notas: string | null; checks: { id: string; hecho: boolean; auditoria?: string; dia?: string; quien?: string }[] };

  it('resuelve los responsables por nombre de pila y crea la entrada de ejemplo con informe, estado y notas', async () => {
    const { svc, prisma } = servicio(null, [], [{ id: 'v1', name: 'Valeria Ruiz', email: 'v@ejemplo.com' }, ...ADMINS_DEV]);
    await svc.asegurarSeed();
    const filas: Fila[] = prisma.platformAuditItem.createMany.mock.calls[0][0].data;
    const porKey = new Map(filas.map((f) => [f.key, f]));
    // Ale no cae en Valeria: va a la cuenta del CPO. Mateo al CEO, Alan a la suya.
    expect(porKey.get('modulo.gimnasio.plan')?.responsableId).toBe('cpo');
    expect(porKey.get('modulo.turnos.plan')?.responsableId).toBe('ceo');
    expect(porKey.get('modulo.alquileres.plan')?.responsableId).toBe('alan');
    expect(porKey.get('api.auth')?.responsableId).toBeNull();
    // Una sola consulta de admins para todos los nombres.
    expect(prisma.platformAdmin.findMany).toHaveBeenCalledTimes(1);

    const ent = porKey.get('auditoria.gimnasio.2026-10-26-seccion-modulos')!;
    expect(ent.estado).toBe('PENDIENTE');
    expect(ent.responsableId).toBe('cpo');
    expect(ent.informe?.startsWith(AVISO_SESION)).toBe(true);
    expect(JSON.parse(ent.notas!)).toEqual({ quien: 'Ale', tipo: 'tarea', sesion: '2026-10-26' });
    expect(ent.checks).toEqual([{ id: 'c1', texto: CHECKS_ENTRADA[0], hecho: false }, { id: 'c2', texto: CHECKS_ENTRADA[1], hecho: false }]);

    // Las tareas viajan como checks con sus campos, y la documentada con su entrada sin tildar.
    const gim = porKey.get('modulo.gimnasio.plan')!;
    expect(gim.checks[0]).toMatchObject({ id: 't1', dia: '2026-10-26', quien: 'Ale', hecho: false });
    expect(gim.checks.find((c) => c.auditoria === 'auditoria.gimnasio.2026-10-26-seccion-modulos')).toMatchObject({ hecho: false });
    // Sin planes previos no hay nada que completar.
    expect(prisma.platformAuditItem.update).not.toHaveBeenCalled();
  });

  it('a un plan que ya existía le completa el link de la tarea documentada, sin tocar lo demás', async () => {
    const gimSeed = MODULOS_SEED.find((i) => i.key === 'modulo.gimnasio.plan')!;
    const checksViejos = checksDesdeSeed(gimSeed).map(({ auditoria: _a, ...c }, i) => (i === 0 ? { ...c, hecho: true } : c));
    const { svc, prisma } = servicio(null, [], ADMINS_DEV, [{ id: 'gim-1', key: 'modulo.gimnasio.plan', checks: checksViejos }]);
    await svc.asegurarSeed();
    // La entrada se crea (faltaba) y el plan existente gana el link.
    const creadas: Fila[] = prisma.platformAuditItem.createMany.mock.calls[0][0].data;
    expect(creadas.some((f) => f.key === 'auditoria.gimnasio.2026-10-26-seccion-modulos')).toBe(true);
    expect(creadas.some((f) => f.key === 'modulo.gimnasio.plan')).toBe(false);
    expect(prisma.platformAuditItem.update).toHaveBeenCalledTimes(1);
    const { where, data } = prisma.platformAuditItem.update.mock.calls[0][0];
    expect(where).toEqual({ id: 'gim-1' });
    const idx = gimSeed.tareas!.findIndex((t) => t.auditoria);
    expect(data.checks[idx]).toMatchObject({ hecho: false, auditoria: gimSeed.tareas![idx].auditoria });
    // Lo tildado sigue tildado y nada más cambió.
    expect(data.checks[0].hecho).toBe(true);
    expect(data.checks.filter((c: { auditoria?: string }) => c.auditoria)).toHaveLength(gimSeed.tareas!.filter((t) => t.auditoria).length);
  });
});
