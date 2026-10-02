import { MANUAL, indiceDelManual, manualEntero, rutaDeDestino, temaDelManual } from './manual';
import { SECCIONES_DEL_PANEL, VISTAS_DE_CONFIGURACION } from '../navegacion/secciones';
import { CODIGOS_DEL_CATALOGO } from '../../common/permisos/catalogo';

// El manual llega de apps/web ya validado contra el panel (contrato.test.ts),
// pero lo que importa acá es que la API no le arme a la persona un botón que no
// lleva a ningún lado ni le repita un nombre interno. Se chequea del lado que
// lo usa, con las listas de la API.

// Mismo criterio que la regla sin-nombres-internos de las evals: valores de
// enum de la base, funciones en camelCase con paréntesis, rutas de archivo.
const INTERNO = /\b[A-Z]{3,}(?:_[A-Z]+)+\b|\b(?:PENDING|CONFIRMED|PREPARING|SHIPPED|DELIVERED|COMPLETED|CANCELLED|PUBLISHED|DRAFT)\b|\b[a-z]+[A-Z][a-zA-Z]*\(|\b[\w/-]+\.(?:tsx?|jsx?|json)\b/;

describe('manual de Orbi (artefacto generado)', () => {
  it('trae los temas del manual, con ids únicos', () => {
    expect(MANUAL.temas.length).toBeGreaterThanOrEqual(60);
    const ids = MANUAL.temas.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(MANUAL.version).toMatch(/^[0-9a-f]{16}$/);
  });

  it('cada destino es una sección real del panel (y la vista de Configuración existe)', () => {
    const destinos = [...MANUAL.temas.flatMap((t) => (t.destino ? [t.destino] : [])), ...MANUAL.primerosPasos.map((p) => p.destino)];
    for (const d of destinos) {
      expect(SECCIONES_DEL_PANEL).toContain(d.seccion);
      if (d.seccion === 'configuracion' && d.vista) expect(VISTAS_DE_CONFIGURACION).toContain(d.vista);
      expect(rutaDeDestino(d)).toMatch(/^\/admin\/ventas\/[a-z]+(\?vista=[a-z]+)?$/);
    }
  });

  it('ningún texto que puede leer la persona tiene identificadores internos', () => {
    const textos = [
      ...MANUAL.temas.flatMap((t) => [t.titulo, t.texto, t.capitulo, t.destino?.label ?? '']),
      ...MANUAL.primerosPasos.flatMap((p) => [p.titulo, p.destino.label, p.grupo ?? '']),
      ...MANUAL.modulosDelMenu.map((m) => m.label),
    ];
    expect(textos.filter((t) => INTERNO.test(t))).toEqual([]);
  });

  it('los permisos de cada módulo del menú existen en el catálogo de la API', () => {
    for (const m of MANUAL.modulosDelMenu) {
      for (const p of m.permisos) expect(CODIGOS_DEL_CATALOGO).toContain(p);
    }
  });

  it('temaDelManual no resuelve claves del prototipo', () => {
    expect(temaDelManual('cfg-envios')?.titulo).toBe('Envíos');
    expect(temaDelManual('__proto__')).toBeUndefined();
    expect(temaDelManual('constructor')).toBeUndefined();
  });

  it('el índice tiene un renglón por tema, agrupado por capítulo', () => {
    const indice = indiceDelManual();
    expect(indice.split('\n').filter((l) => l.startsWith('- '))).toHaveLength(MANUAL.temas.length);
    expect(indice).toContain('Configuración:\n');
    expect(indice).toContain('- cfg-envios · Envíos');
  });

  it('el manual entero (variante de evals) trae el texto de todos los temas', () => {
    const entero = manualEntero();
    for (const t of MANUAL.temas) expect(entero).toContain(`(${t.id})`);
  });
});
