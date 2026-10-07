import {
  CATEGORIA,
  MAX_OPCIONES,
  cargarCategorias,
  cargarProductos,
  claveDeNombre,
  invalidoDeResolucion,
  normalizarNombre,
  resolverLista,
  resolverNombre,
} from './resolver-nombres';

const PERFUMERIA = { id: '11111111-1111-4111-8111-111111111111', name: 'Perfumería' };
const CATEGORIAS = [
  { id: 'c-yerbas', name: 'Yerbas' },
  { id: 'c-mates', name: 'Mates' },
  { id: 'c-bombillas', name: 'Bombillas' },
  PERFUMERIA,
  { id: 'c-flores', name: 'Flores' },
];
const PRODUCTOS = [
  { id: 'p-1', name: 'Mate de Calabaza Forrado' },
  { id: 'p-2', name: 'Mate de Algarrobo' },
  { id: 'p-3', name: 'Mate Térmico de Acero' },
  { id: 'p-4', name: 'Yerba Orgánica Suave 1 kg' },
];

const entidad = (r: ReturnType<typeof resolverNombre>) => (r.ok ? r.entidad.id : r);

describe('normalizarNombre y claveDeNombre', () => {
  it('sin tildes, mayúsculas, signos ni espacios de más', () => {
    expect(normalizarNombre('  Perfumería  ')).toBe('perfumeria');
    expect(normalizarNombre('PERFUMERÍA')).toBe('perfumeria');
    expect(normalizarNombre('Mate   Térmico—de acero!')).toBe('mate termico de acero');
  });

  it('singular y plural dan la misma clave', () => {
    expect(claveDeNombre('perfumerías')).toBe(claveDeNombre('Perfumería'));
    expect(claveDeNombre('Mates')).toBe(claveDeNombre('mate'));
    expect(claveDeNombre('flores')).toBe(claveDeNombre('Flor'));
    expect(claveDeNombre('pantalones')).toBe(claveDeNombre('pantalón'));
    expect(claveDeNombre('Accesorios')).toBe(claveDeNombre('accesorio'));
    // Una palabra corta no se toca: "gas" no es el plural de "ga".
    expect(claveDeNombre('gas')).toBe('gas');
  });
});

describe('resolverNombre', () => {
  it.each([
    'Perfumería', 'perfumeria', 'Perfumería ', '  perfumería', 'PERFUMERÍA', 'PERFUMERÍAS', 'perfumerias', 'Perfumerías',
  ])('"%s" → Perfumería', (escrito) => {
    expect(entidad(resolverNombre(escrito, CATEGORIAS))).toBe(PERFUMERIA.id);
  });

  it('un error de tipeo chico, si hay una sola parecida', () => {
    expect(entidad(resolverNombre('perfumria', CATEGORIAS))).toBe(PERFUMERIA.id);
    expect(entidad(resolverNombre('bombilas', CATEGORIAS))).toBe('c-bombillas');
  });

  it('el id exacto también sirve (lo que devuelven listProducts y listCategories)', () => {
    expect(entidad(resolverNombre(PERFUMERIA.id, CATEGORIAS))).toBe(PERFUMERIA.id);
  });

  it('un id que no es del negocio no resuelve a nada', () => {
    const r = resolverNombre('99999999-9999-4999-8999-999999999999', CATEGORIAS);
    expect(r).toEqual({ ok: false, motivo: 'no-existe', opciones: expect.any(Array) });
  });

  it('el nombre exacto gana a los parecidos: "Mates" es la categoría, no un producto', () => {
    expect(entidad(resolverNombre('mates', CATEGORIAS))).toBe('c-mates');
  });

  it('un pedazo del nombre que está en uno solo lo encuentra', () => {
    expect(entidad(resolverNombre('algarrobo', PRODUCTOS))).toBe('p-2');
    expect(entidad(resolverNombre('mate de algarrobo', PRODUCTOS))).toBe('p-2');
    expect(entidad(resolverNombre('yerba organica suave', PRODUCTOS))).toBe('p-4');
  });

  it('ambiguo: si coincide con varios, devuelve las opciones y no elige', () => {
    const r = resolverNombre('mate', PRODUCTOS);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.motivo).toBe('ambiguo');
      expect(r.opciones.sort()).toEqual(['Mate Térmico de Acero', 'Mate de Algarrobo', 'Mate de Calabaza Forrado'].sort());
    }
  });

  it('dos con el mismo nombre (distinta tilde) también es ambiguo', () => {
    const r = resolverNombre('perfumeria', [...CATEGORIAS, { id: 'otra', name: 'PERFUMERIA' }]);
    expect(r).toEqual({ ok: false, motivo: 'ambiguo', opciones: ['Perfumería', 'PERFUMERIA'] });
  });

  it('no existe: lo dice y lista las que hay, las más parecidas primero', () => {
    const r = resolverNombre('Velas aromáticas', CATEGORIAS);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.motivo).toBe('no-existe');
      expect(r.opciones.sort()).toEqual(CATEGORIAS.map((c) => c.name).sort());
    }
    const parecida = resolverNombre('Perfumes', CATEGORIAS);
    expect(parecida.ok ? null : parecida.opciones[0]).toBe('Perfumería');
  });

  it('no existe: como mucho 10 opciones', () => {
    const muchas = Array.from({ length: 30 }, (_, i) => ({ id: `c${i}`, name: `Categoría número ${i}` }));
    const r = resolverNombre('zapatillas', muchas);
    expect(r.ok ? 0 : r.opciones.length).toBe(MAX_OPCIONES);
  });

  it('un texto vacío o muy corto no se parece a nada', () => {
    expect(resolverNombre('', CATEGORIAS).ok).toBe(false);
    expect(resolverNombre('   ', CATEGORIAS).ok).toBe(false);
    expect(resolverNombre('ma', PRODUCTOS).ok).toBe(false);
  });

  it('sin candidatos (un negocio sin categorías): no existe, sin opciones', () => {
    expect(resolverNombre('Perfumería', [])).toEqual({ ok: false, motivo: 'no-existe', opciones: [] });
  });
});

describe('resolverLista e invalidoDeResolucion', () => {
  it('resuelve varios sin repetir y junta los que no se pudieron', () => {
    const r = resolverLista('categorías', ['perfumerias', 'Perfumería', 'Velas', 'mates'], CATEGORIAS, CATEGORIA);
    expect(r.entidades.map((e) => e.id)).toEqual([PERFUMERIA.id, 'c-mates']);
    expect(r.invalidos).toEqual([{ campo: 'categorías', motivo: expect.stringContaining('no existe la categoría "Velas"'), opciones: expect.any(Array) }]);
  });

  it('el motivo de un ambiguo pide preguntar cuál', () => {
    const r = resolverNombre('mate', PRODUCTOS);
    if (r.ok) throw new Error('tenía que ser ambiguo');
    expect(invalidoDeResolucion('productos', 'mate', r, { singular: 'producto', plural: 'productos' }).motivo).toContain('preguntale cuál');
  });

  it('sin candidatos dice que el negocio todavía no tiene', () => {
    const r = resolverNombre('Perfumería', []);
    if (r.ok) throw new Error('no tenía que existir');
    expect(invalidoDeResolucion('categoría', 'Perfumería', r, CATEGORIA)).toEqual({
      campo: 'categoría', motivo: expect.stringContaining('todavía no tiene categorías'),
    });
  });
});

describe('cargar candidatos: siempre acotados al negocio', () => {
  it('categorías y productos (sin los borrados) del negocio de la sesión', async () => {
    const prisma = {
      category: { findMany: jest.fn().mockResolvedValue([]) },
      product: { findMany: jest.fn().mockResolvedValue([]) },
    };
    await cargarCategorias(prisma as never, 'biz-1');
    await cargarProductos(prisma as never, 'biz-1');
    expect(prisma.category.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { businessId: 'biz-1' } }));
    expect(prisma.product.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { businessId: 'biz-1', deletedAt: null } }));
  });
});
