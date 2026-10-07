import { FICHAS, descripcionDe, fallaDeDatos, faltantes, invalidoDelDto, parametrosDe, type FichaDeAccion } from './requisitos';

describe('fichas de requisitos', () => {
  it('cada acción tiene etiqueta y descripción en cada campo, y sus opciones sin repetir', () => {
    for (const [tool, ficha] of Object.entries(FICHAS) as [string, FichaDeAccion][]) {
      expect({ tool, descripcion: ficha.descripcion.length > 10 }).toEqual({ tool, descripcion: true });
      for (const [campo, c] of Object.entries(ficha.campos)) {
        expect({ tool, campo, ok: c.etiqueta.length > 0 && c.descripcion.length > 0 }).toEqual({ tool, campo, ok: true });
        const opciones = (c.opciones ?? c.items?.opciones ?? []).map((o) => o.valor);
        expect(new Set(opciones).size).toBe(opciones.length);
      }
      for (const n of ficha.alMenosUno?.campos ?? []) expect(Object.keys(ficha.campos)).toContain(n);
    }
  });

  it('el schema que ve el modelo sale de la ficha: tipos, enums, obligatorios y opciones en palabras', () => {
    const p = parametrosDe(FICHAS.createProduct);
    expect(p.required).toEqual(['name', 'basePrice', 'categoria']);
    expect(p.properties.status).toEqual({ type: 'string', enum: ['PUBLISHED', 'DRAFT'], description: expect.stringContaining('PUBLISHED: publicado en la tienda') });
    expect(p.properties.etiquetas).toEqual({ type: 'array', items: { type: 'string' }, description: expect.any(String) });
    const d = parametrosDe(FICHAS.createDiscount);
    expect(d.properties.activeDays).toEqual(expect.objectContaining({ items: { type: 'string', enum: ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'] } }));
    // Los booleanos de pagos, sin descripción (como antes): el nombre alcanza.
    expect(parametrosDe(FICHAS.updatePaymentMethods).properties.acceptsCash).toEqual({ type: 'boolean' });
    expect(parametrosDe(FICHAS.updateShipping).required).toBeUndefined();
  });

  it('la descripción de la tool lleva las reglas entre campos', () => {
    expect(descripcionDe(FICHAS.createDiscount)).toContain('productos O categorias');
  });

  it('faltantes: todos los obligatorios que no vinieron (null, vacío o lista vacía), con su etiqueta', () => {
    expect(faltantes(FICHAS.createProduct, { name: '  ', basePrice: null, categoria: 'Mates' })).toEqual(['nombre', 'precio']);
    expect(faltantes(FICHAS.createProduct, { name: 'x', basePrice: 0, categoria: 'Mates' })).toEqual([]);
    expect(faltantes(FICHAS.updateShipping, {})).toEqual(['qué cambiar de los envíos']);
    expect(faltantes(FICHAS.updateShipping, { enabledCarriers: [] })).toEqual([]);
  });

  it('fallaDeDatos: un mensaje en castellano que pide preguntar todo junto, con faltan e invalidos', () => {
    const f = fallaDeDatos(['precio'], [{ campo: 'categoría', motivo: 'no existe "Velas"', opciones: ['Mates', 'Yerbas'] }]);
    expect(f).toEqual({
      ok: false,
      error: expect.stringMatching(/^Faltan datos: precio\. categoría: no existe "Velas" \(opciones: Mates, Yerbas\)\. No inventes/),
      faltan: ['precio'],
      invalidos: [{ campo: 'categoría', motivo: 'no existe "Velas"', opciones: ['Mates', 'Yerbas'] }],
    });
  });

  it('invalidoDelDto traduce la propiedad del DTO al parámetro y su etiqueta, con las opciones del enum', () => {
    const f = invalidoDelDto(FICHAS.createProduct, { error: 'Argumento inválido (status): status must be one of', campo: 'status', motivo: 'status must be one of' });
    expect(f.invalidos).toEqual([{ campo: 'estado', motivo: 'status must be one of', opciones: ['PUBLISHED', 'DRAFT'] }]);
    expect(f.error).toContain('Argumento inválido (status)');
    const g = invalidoDelDto(FICHAS.createProduct, { error: 'x', campo: 'categoryId', motivo: 'm' }, { categoryId: 'categoria' });
    expect(g.invalidos?.[0].campo).toBe('categoría');
  });
});
