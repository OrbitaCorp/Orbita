/**
 * Las reglas de las evals son código, y código que decide si una respuesta pasa
 * o falla. Si la regla de fugas tuviera un falso negativo, la suite entera daría
 * verde sobre respuestas rotas — y nadie se enteraría, que es exactamente el
 * problema que las evals vienen a resolver.
 *
 * Por eso viven en test/evals/reglas.ts (código común) y no adentro del runner:
 * así este spec las cubre y las corre el CI, aunque las evals en sí necesiten
 * GROQ_API_KEY y se corran a mano.
 */

import {
  sinFugasDeHerramientas,
  keysQueExisten,
  toolsAutorizadas,
  largoRazonable,
  noContestaEnSilencio,
  evaluarTurno,
  verificarExpectativas,
  TOPE_DE_LARGO_POR_DEFECTO,
  type TurnoDeOrbi,
  type EscenarioDelCaso,
} from '../evals/reglas';

const turno = (texto: string, toolCalls: TurnoDeOrbi['toolCalls'] = []): TurnoDeOrbi => ({ texto, toolCalls });

const escenario: EscenarioDelCaso = {
  stepName: 'subrubros',
  availableOptions: [
    { key: 'indumentaria', label: 'Indumentaria' },
    { key: 'calzado', label: 'Calzado' },
  ],
  toolsAutorizadas: ['selectWizardOption'],
};

describe('reglas de las evals de Orbi', () => {
  describe('sin fugas de herramientas', () => {
    it('deja pasar una respuesta normal', () => {
      const t = turno('¡Buenísimo! Te dejo Indumentaria seleccionada. ¿Vendés algo más?');
      expect(sinFugasDeHerramientas(t)).toEqual([]);
    });

    it('caza JSON escrito como texto', () => {
      const t = turno('Listo: {"key": "indumentaria", "label": "Indumentaria"}');
      expect(sinFugasDeHerramientas(t)).toHaveLength(1);
      expect(sinFugasDeHerramientas(t)[0].detalle).toContain('llaves');
    });

    it('caza etiquetas tipo HTML/JSX', () => {
      expect(sinFugasDeHerramientas(turno('Elegí <Boton opcion="calzado" />'))).toHaveLength(1);
      expect(sinFugasDeHerramientas(turno('<tool_call>algo</tool_call>')).length).toBeGreaterThan(0);
    });

    it('no confunde un "menor que" con una etiqueta', () => {
      expect(sinFugasDeHerramientas(turno('Te conviene si vendés < 50 productos por mes.'))).toEqual([]);
      expect(sinFugasDeHerramientas(turno('Te quiero <3'))).toEqual([]);
    });

    it('caza bloques de código y placeholders sin resolver', () => {
      expect(sinFugasDeHerramientas(turno('```json\nalgo\n```')).length).toBeGreaterThan(0);
      expect(sinFugasDeHerramientas(turno('Las opciones son {{options}}')).length).toBeGreaterThan(0);
    });

    it('caza el nombre de una herramienta escrito en el texto', () => {
      const t = turno('Ahora voy a usar selectWizardOption para elegirlo.');
      expect(sinFugasDeHerramientas(t)).toHaveLength(1);
    });
  });

  describe('keys que existen', () => {
    it('acepta un key de la lista', () => {
      const t = turno('Listo', [{ name: 'selectWizardOption', arguments: { key: 'calzado', label: 'Calzado' } }]);
      expect(keysQueExisten(t, escenario)).toEqual([]);
    });

    it('caza un key inventado', () => {
      const t = turno('Listo', [{ name: 'selectWizardOption', arguments: { key: 'gastronomia', label: 'Gastronomía' } }]);
      const v = keysQueExisten(t, escenario);
      expect(v).toHaveLength(1);
      expect(v[0].detalle).toContain('gastronomia');
    });

    it('no mira los argumentos de otras herramientas', () => {
      const t = turno('Listo', [{ name: 'fillWizardField', arguments: { field: 'nombre', value: 'Rama' } }]);
      expect(keysQueExisten(t, escenario)).toEqual([]);
    });

    it('en un paso sin opciones, cualquier selección es inventada', () => {
      // Pasa de verdad cuando el catálogo todavía no cargó: availableOptions
      // llega vacío y el prompt dice "esperá un momento". Si el modelo elige
      // igual, no hay contra qué validar el key — y eso es una violación, no
      // un caso a ignorar.
      const t = turno('Elijo', [{ name: 'selectWizardOption', arguments: { key: 'lo-que-sea' } }]);
      expect(keysQueExisten(t, { ...escenario, availableOptions: undefined })).toHaveLength(1);
    });
  });

  describe('tools autorizadas', () => {
    it('caza una herramienta que el paso no habilita', () => {
      const t = turno('Listo', [{ name: 'fillWizardField', arguments: {} }]);
      const v = toolsAutorizadas(t, escenario);
      expect(v).toHaveLength(1);
      expect(v[0].detalle).toContain('fillWizardField');
    });

    it('en un paso sin herramientas, cualquier llamada es una violación', () => {
      const sinTools: EscenarioDelCaso = { stepName: 'cuenta', toolsAutorizadas: [] };
      const t = turno('Listo', [{ name: 'selectWizardOption', arguments: { key: 'x' } }]);
      expect(toolsAutorizadas(t, sinTools)).toHaveLength(1);
    });
  });

  describe('largo razonable', () => {
    it('acepta una respuesta corta', () => {
      expect(largoRazonable(turno('Dale, seguimos.'), escenario)).toEqual([]);
    });

    it('caza una parrafada', () => {
      const t = turno('a'.repeat(TOPE_DE_LARGO_POR_DEFECTO + 1));
      expect(largoRazonable(t, escenario)).toHaveLength(1);
    });

    it('respeta el tope propio del caso', () => {
      const t = turno('a'.repeat(120));
      expect(largoRazonable(t, { ...escenario, topeDeLargo: 100 })).toHaveLength(1);
      expect(largoRazonable(t, { ...escenario, topeDeLargo: 200 })).toEqual([]);
    });
  });

  describe('no contesta en silencio', () => {
    it('acepta un turno que dice algo y además llama la herramienta', () => {
      const t = turno('¡Buenísimo! Te marco Calzado.', [
        { name: 'selectWizardOption', arguments: { key: 'calzado' } },
      ]);
      expect(noContestaEnSilencio(t)).toEqual([]);
    });

    it('caza el botón sin explicación: llamó la tool y no dijo nada', () => {
      const t = turno('', [{ name: 'selectWizardOption', arguments: { key: 'calzado' } }]);
      const v = noContestaEnSilencio(t);
      expect(v).toHaveLength(1);
      expect(v[0].detalle).toContain('selectWizardOption');
    });

    it('caza también la respuesta completamente vacía', () => {
      expect(noContestaEnSilencio(turno('   '))).toHaveLength(1);
    });
  });

  describe('evaluarTurno', () => {
    it('junta las violaciones de todas las reglas', () => {
      const t = turno('Ahí va: {"key":"gastronomia"}', [
        { name: 'fillWizardField', arguments: {} },
        { name: 'selectWizardOption', arguments: { key: 'gastronomia' } },
      ]);
      const reglas = new Set(evaluarTurno(t, escenario).map(v => v.regla));
      expect(reglas).toEqual(new Set(['sin-fugas', 'keys-que-existen', 'tools-autorizadas']));
    });

    it('una respuesta correcta no deja ninguna violación', () => {
      const t = turno('¡Buenísimo! Te marco Calzado.', [
        { name: 'selectWizardOption', arguments: { key: 'calzado', label: 'Calzado' } },
      ]);
      expect(evaluarTurno(t, escenario)).toEqual([]);
    });
  });

  describe('expectativas por caso', () => {
    it('exige que se llame una herramienta', () => {
      expect(verificarExpectativas(turno('Hola'), [{ tipo: 'debe-llamar', tool: 'selectWizardOption' }])).toHaveLength(1);
    });

    it('exige que NO se llame ninguna', () => {
      const t = turno('Listo', [{ name: 'selectWizardOption', arguments: { key: 'calzado' } }]);
      expect(verificarExpectativas(t, [{ tipo: 'no-llama-ninguna-tool' }])).toHaveLength(1);
      expect(verificarExpectativas(turno('Listo'), [{ tipo: 'no-llama-ninguna-tool' }])).toEqual([]);
    });

    it('compara el conjunto exacto de keys, sin importar el orden', () => {
      const t = turno('Listo', [
        { name: 'selectWizardOption', arguments: { key: 'calzado' } },
        { name: 'selectWizardOption', arguments: { key: 'indumentaria' } },
      ]);
      expect(verificarExpectativas(t, [{ tipo: 'keys-exactas', keys: ['indumentaria', 'calzado'] }])).toEqual([]);
      expect(verificarExpectativas(t, [{ tipo: 'keys-exactas', keys: ['indumentaria'] }])).toHaveLength(1);
    });

    it('keys-exactas con lista vacía exige que no haya elegido nada', () => {
      // Es como se escribe "acá no tiene que volver a seleccionar lo que ya
      // está" (caso ubicacion-ya-eligio). Sin este test, un bug que hiciera
      // pasar siempre la lista vacía dejaría ese caso sin vigilancia.
      const nadie = turno('Ya está todo listo.');
      const alguien = turno('Listo', [{ name: 'selectWizardOption', arguments: { key: 'fisico' } }]);
      expect(verificarExpectativas(nadie, [{ tipo: 'keys-exactas', keys: [] }])).toEqual([]);
      expect(verificarExpectativas(alguien, [{ tipo: 'keys-exactas', keys: [] }])).toHaveLength(1);
    });

    it('cuenta las llamadas: dos opciones son dos llamadas, no una', () => {
      const unaSola = turno('Listo', [{ name: 'selectWizardOption', arguments: { key: 'fisico' } }]);
      expect(
        verificarExpectativas(unaSola, [{ tipo: 'cantidad-de-llamadas', tool: 'selectWizardOption', cantidad: 2 }]),
      ).toHaveLength(1);
    });

    it('busca fragmentos prohibidos sin distinguir mayúsculas', () => {
      const t = turno('Sos Orbi, el asistente de Órbita');
      expect(verificarExpectativas(t, [{ tipo: 'texto-no-contiene', fragmento: 'sos orbi, el asistente' }])).toHaveLength(1);
    });
  });
});
