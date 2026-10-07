import { isUUID } from 'class-validator';
import type { PrismaService } from '../../../prisma/prisma.service';

/**
 * De un nombre que dijo la persona a la entidad del negocio (categoría,
 * producto, etiqueta), del lado del servidor.
 *
 * Por qué: las tools de escritura pedían ids (UUID) y el modelo no tenía de
 * dónde sacarlos (listProducts devuelve el NOMBRE de la categoría). Con una
 * categoría "Perfumería" adivinaba un id o mandaba el nombre, y la propuesta
 * fallaba con "Categoría no encontrada": en producción, 4 de 5 altas de
 * producto. Ahora el modelo manda el nombre tal como lo dijo la persona y
 * esto lo resuelve.
 *
 * El orden, del más seguro al más laxo:
 * 1. el id exacto (compatibilidad: lo que devuelven listProducts y
 *    listCategories, y las propuestas guardadas antes de este cambio);
 * 2. el nombre igual sin mayúsculas, tildes ni espacios de más;
 * 3. el mismo nombre en singular o plural ("perfumerías" = "Perfumería");
 * 4. un parecido ÚNICO: el nombre está contenido en uno solo ("algarrobo" →
 *    "Mate de Algarrobo") o le erra por una o dos letras.
 * Si en algún paso hay más de uno, es ambiguo y se devuelven las opciones
 * para que Orbi le pregunte cuál. Nunca se elige uno al azar.
 *
 * Los candidatos los carga quien llama, SIEMPRE acotados a ctx.businessId
 * (ver cargarCategorias y compañía): una entidad de otro negocio no existe.
 */

export type Candidato = { id: string; name: string };

export type Resolucion<T extends Candidato> =
  | { ok: true; entidad: T }
  | { ok: false; motivo: 'ambiguo' | 'no-existe'; opciones: string[] };

/** Cuántas opciones se le devuelven al modelo, como mucho. */
export const MAX_OPCIONES = 10;

/** Minúsculas, sin tildes ni signos, espacios simples. "  Perfumería " → "perfumeria". */
export function normalizarNombre(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

// Consonantes después de las que el plural castellano es -es: flor/flores,
// pantalón/pantalones, reloj/relojes, red/redes, luz/luces (la z cambia: no se cubre).
const PLURAL_ES = /[lnrdj]e$/;

/**
 * Una palabra sin la marca de número, para que singular y plural den lo
 * mismo: "perfumerias" y "perfumeria" → "perfumeria"; "flores" y "flor" →
 * "flor"; "mates" y "mate" → "mate". Se aplica igual al nombre de la base y a
 * lo que dijo la persona, así que no hace falta que la raíz sea una palabra.
 */
function raiz(palabra: string): string {
  let r = palabra.length > 3 && palabra.endsWith('s') ? palabra.slice(0, -1) : palabra;
  if (r.length > 3 && PLURAL_ES.test(r)) r = r.slice(0, -1);
  return r;
}

/** El nombre normalizado, sin singular ni plural. */
export function claveDeNombre(texto: string): string {
  return normalizarNombre(texto).split(' ').filter(Boolean).map(raiz).join(' ');
}

/** Distancia de edición (Levenshtein), con corte temprano si ya pasó el tope. */
function distancia(a: string, b: string, tope: number): number {
  if (Math.abs(a.length - b.length) > tope) return tope + 1;
  let previa = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const fila = [i];
    let minimo = i;
    for (let j = 1; j <= b.length; j++) {
      fila[j] = Math.min(previa[j] + 1, fila[j - 1] + 1, previa[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      minimo = Math.min(minimo, fila[j]);
    }
    if (minimo > tope) return tope + 1;
    previa = fila;
  }
  return previa[b.length];
}

/** Errores de tipeo tolerados: ninguno en nombres muy cortos, uno hasta 8 letras, dos desde ahí. */
function toleranciaDe(clave: string): number {
  if (clave.length < 4) return 0;
  return clave.length < 9 ? 1 : 2;
}

/** ¿`buscada` aparece en `nombre` como palabras enteras? ("algarrobo" en "mate de algarrobo" sí; "ate" no). */
function contienePalabras(nombre: string, buscada: string): boolean {
  return ` ${nombre} `.includes(` ${buscada} `);
}

/** Las opciones para preguntar: primero las que más se parecen a lo buscado. */
function opcionesPara<T extends Candidato>(buscada: string, candidatos: T[]): string[] {
  const clave = claveDeNombre(buscada);
  return [...new Set(candidatos.map((c) => c.name))]
    .map((name) => ({ name, d: distancia(clave, claveDeNombre(name), 1000) }))
    .sort((x, y) => x.d - y.d || x.name.localeCompare(y.name))
    .slice(0, MAX_OPCIONES)
    .map((x) => x.name);
}

function unico<T extends Candidato>(encontrados: T[]): Resolucion<T> | null {
  const porId = new Map(encontrados.map((c) => [c.id, c]));
  if (porId.size === 1) return { ok: true, entidad: [...porId.values()][0] };
  if (porId.size > 1) return { ok: false, motivo: 'ambiguo', opciones: [...new Set(encontrados.map((c) => c.name))].slice(0, MAX_OPCIONES) };
  return null;
}

/** Resuelve un nombre (o un id) contra los candidatos del negocio. Pura: no lee la base. */
export function resolverNombre<T extends Candidato>(buscado: string, candidatos: T[]): Resolucion<T> {
  const texto = String(buscado ?? '').trim();
  if (isUUID(texto)) {
    const porId = candidatos.find((c) => c.id === texto);
    if (porId) return { ok: true, entidad: porId };
  }

  const normal = normalizarNombre(texto);
  const clave = claveDeNombre(texto);
  if (!normal) return { ok: false, motivo: 'no-existe', opciones: opcionesPara(texto, candidatos) };

  const exactos = unico(candidatos.filter((c) => normalizarNombre(c.name) === normal));
  if (exactos) return exactos;

  const mismaClave = unico(candidatos.filter((c) => claveDeNombre(c.name) === clave));
  if (mismaClave) return mismaClave;

  // Parecidos: contenido como palabras enteras (con 3 letras o más) o a una
  // o dos letras de distancia. Si hay uno solo, es ese; si hay varios, se pregunta.
  const tope = toleranciaDe(clave);
  const parecidos = candidatos.filter((c) => {
    const otra = claveDeNombre(c.name);
    return (clave.length >= 3 && contienePalabras(otra, clave)) || (tope > 0 && distancia(clave, otra, tope) <= tope);
  });
  const porParecido = unico(parecidos);
  if (porParecido) return porParecido;

  return { ok: false, motivo: 'no-existe', opciones: opcionesPara(texto, candidatos) };
}

// ─── Lo que se le dice al modelo ────────────────────────────────────────────

export type Invalido = { campo: string; motivo: string; opciones?: string[] };

/**
 * El motivo en castellano de un nombre que no se pudo resolver, con las
 * opciones para que Orbi pregunte. `que` es cómo se llama la entidad
 * ("categoría", "producto").
 */
export function invalidoDeResolucion(
  campo: string,
  buscado: string,
  r: Extract<Resolucion<Candidato>, { ok: false }>,
  que: { singular: string; plural: string; femenino?: boolean },
): Invalido {
  const nombre = `"${String(buscado).trim().slice(0, 60)}"`;
  if (r.motivo === 'ambiguo') {
    return { campo, motivo: `${nombre} coincide con más de ${que.femenino ? 'una' : 'un'} ${que.singular}: preguntale cuál`, opciones: r.opciones };
  }
  const motivo = r.opciones.length
    ? `no existe ${que.femenino ? 'la' : 'el'} ${que.singular} ${nombre} en este negocio`
    : `no existe ${que.femenino ? 'la' : 'el'} ${que.singular} ${nombre}: el negocio todavía no tiene ${que.plural}`;
  return { campo, motivo, ...(r.opciones.length ? { opciones: r.opciones } : {}) };
}

/** Resuelve una lista de nombres: los ids sin repetir y los nombres reales, o los inválidos. */
export function resolverLista<T extends Candidato>(
  campo: string,
  buscados: unknown,
  candidatos: T[],
  que: { singular: string; plural: string; femenino?: boolean },
): { entidades: T[]; invalidos: Invalido[] } {
  const entidades = new Map<string, T>();
  const invalidos: Invalido[] = [];
  for (const b of Array.isArray(buscados) ? buscados : []) {
    const r = resolverNombre(String(b), candidatos);
    if (r.ok) entidades.set(r.entidad.id, r.entidad);
    else invalidos.push(invalidoDeResolucion(campo, String(b), r, que));
  }
  return { entidades: [...entidades.values()], invalidos };
}

// ─── Los candidatos, siempre del negocio de la sesión ───────────────────────

type PrismaDeNombres = Pick<PrismaService, 'category' | 'product' | 'tag'>;

// Tope de filas que se traen para resolver: alcanza para cualquier catálogo
// real (el más grande de producción tiene unos cientos) sin dejar que una
// consulta sin límite crezca con el negocio.
const TOPE_DE_CANDIDATOS = 5000;

export function cargarCategorias(prisma: PrismaDeNombres, businessId: string): Promise<Candidato[]> {
  return prisma.category.findMany({ where: { businessId }, select: { id: true, name: true }, take: TOPE_DE_CANDIDATOS });
}

export function cargarProductos(prisma: PrismaDeNombres, businessId: string): Promise<Candidato[]> {
  return prisma.product.findMany({ where: { businessId, deletedAt: null }, select: { id: true, name: true }, take: TOPE_DE_CANDIDATOS });
}

export function cargarEtiquetas(prisma: PrismaDeNombres, businessId: string): Promise<Candidato[]> {
  return prisma.tag.findMany({ where: { businessId }, select: { id: true, name: true }, take: TOPE_DE_CANDIDATOS });
}

export const CATEGORIA = { singular: 'categoría', plural: 'categorías', femenino: true };
export const PRODUCTO = { singular: 'producto', plural: 'productos' };
export const ETIQUETA = { singular: 'etiqueta', plural: 'etiquetas', femenino: true };
