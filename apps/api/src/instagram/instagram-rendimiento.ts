// Qué tipo de publicación y en qué momento le funciona mejor a la cuenta, calculado con las últimas publicaciones.
// Todo es cuenta pura sobre los datos que da Instagram (me gusta y comentarios): no se inventa nada, y con pocas
// publicaciones se dice que la muestra es chica en vez de sacar conclusiones.

export type TipoDePublicacion = 'foto' | 'carrusel' | 'reel' | 'video';

export interface MedioDeInstagram {
  id: string;
  caption?: string;
  media_type?: string; // IMAGE | VIDEO | CAROUSEL_ALBUM
  media_product_type?: string; // FEED | REELS | STORY
  media_url?: string;
  thumbnail_url?: string;
  permalink?: string;
  timestamp?: string;
  like_count?: number;
  comments_count?: number;
}

export interface PublicacionAnalizada {
  id: string;
  texto: string;
  imagen: string | null;
  enlace: string | null;
  fecha: string | null;
  tipo: TipoDePublicacion;
  likes: number;
  comentarios: number;
  interacciones: number;
}

export interface Franja {
  /** Día de la semana (0 = domingo … 6 = sábado) o hora de inicio de la ventana de 3 horas (0, 3, … 21). */
  clave: number;
  publicaciones: number;
  /** Promedio de me gusta + comentarios de las publicaciones de esa franja. */
  promedio: number;
}

export interface RendimientoDeLaCuenta {
  /** Cuántas publicaciones se analizaron. */
  muestra: number;
  /** Con 8 o más publicaciones se pueden sacar conclusiones; con menos, son solo una pista. */
  suficiente: boolean;
  publicaciones: PublicacionAnalizada[];
  tipos: { tipo: TipoDePublicacion; publicaciones: number; promedio: number }[];
  mejoresDias: Franja[];
  mejoresHoras: Franja[];
  /** El próximo momento sugerido para publicar (ISO, UTC): el del mejor día de la cuenta. */
  proximoMomento: string;
  /** Hasta 3 momentos distintos para publicar, de más cercano a más lejano (uno por cada uno de los mejores días). */
  momentos: string[];
  /** Si el momento sugerido sale de las publicaciones de la cuenta (true) o es un horario general (false). */
  momentoDeLaCuenta: boolean;
}

/** Argentina no tiene horario de verano: siempre UTC−3. */
const OFFSET_AR_MS = -3 * 60 * 60 * 1000;
const MUESTRA_MINIMA = 8;
const POR_FRANJA_MINIMO = 2;
/** Hora local (de 0 a 23) que se sugiere cuando la cuenta no tiene datos suficientes: el pico de la tarde-noche. */
const HORA_GENERAL = 19;

const aHoraArgentina = (iso: string): Date => new Date(Date.parse(iso) + OFFSET_AR_MS);

export function tipoDe(m: MedioDeInstagram): TipoDePublicacion {
  if (m.media_type === 'CAROUSEL_ALBUM') return 'carrusel';
  if (m.media_type === 'VIDEO') return m.media_product_type === 'REELS' ? 'reel' : 'video';
  return 'foto';
}

const promedio = (xs: number[]): number => (xs.length === 0 ? 0 : Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 10) / 10);

function mejores(items: PublicacionAnalizada[], clave: (p: PublicacionAnalizada) => number): Franja[] {
  const grupos = new Map<number, number[]>();
  for (const p of items) {
    if (!p.fecha) continue;
    const k = clave(p);
    grupos.set(k, [...(grupos.get(k) ?? []), p.interacciones]);
  }
  return [...grupos.entries()]
    // Una franja con una sola publicación no dice nada: puede ser un golpe de suerte.
    .filter(([, xs]) => xs.length >= POR_FRANJA_MINIMO)
    .map(([k, xs]) => ({ clave: k, publicaciones: xs.length, promedio: promedio(xs) }))
    .sort((a, b) => b.promedio - a.promedio)
    .slice(0, 3);
}

/** El próximo `dia` (0–6) a partir de `desde`, a las `hora` locales de Argentina, con al menos una hora de margen. */
function proximo(desde: Date, dias: number[], hora: number): Date {
  const localAhora = new Date(desde.getTime() + OFFSET_AR_MS);
  for (let i = 0; i < 15; i++) {
    const d = new Date(Date.UTC(localAhora.getUTCFullYear(), localAhora.getUTCMonth(), localAhora.getUTCDate() + i, hora, 0, 0));
    if (dias.length > 0 && !dias.includes(d.getUTCDay())) continue;
    const utc = new Date(d.getTime() - OFFSET_AR_MS);
    if (utc.getTime() >= desde.getTime() + 60 * 60 * 1000) return utc;
  }
  return new Date(desde.getTime() + 24 * 60 * 60 * 1000);
}

export function analizarRendimiento(medios: MedioDeInstagram[], ahora: Date = new Date()): RendimientoDeLaCuenta {
  const publicaciones = medios.map<PublicacionAnalizada>((m) => ({
    id: m.id,
    texto: m.caption ?? '',
    imagen: m.thumbnail_url ?? m.media_url ?? null,
    enlace: m.permalink ?? null,
    fecha: m.timestamp ?? null,
    tipo: tipoDe(m),
    likes: m.like_count ?? 0,
    comentarios: m.comments_count ?? 0,
    interacciones: (m.like_count ?? 0) + (m.comments_count ?? 0),
  }));

  const porTipo = new Map<TipoDePublicacion, number[]>();
  for (const p of publicaciones) porTipo.set(p.tipo, [...(porTipo.get(p.tipo) ?? []), p.interacciones]);
  const tipos = [...porTipo.entries()]
    .map(([tipo, xs]) => ({ tipo, publicaciones: xs.length, promedio: promedio(xs) }))
    .sort((a, b) => b.promedio - a.promedio);

  const suficiente = publicaciones.length >= MUESTRA_MINIMA;
  const mejoresDias = suficiente ? mejores(publicaciones, (p) => aHoraArgentina(p.fecha as string).getUTCDay()) : [];
  const mejoresHoras = suficiente ? mejores(publicaciones, (p) => Math.floor(aHoraArgentina(p.fecha as string).getUTCHours() / 3) * 3) : [];

  const momentoDeLaCuenta = mejoresHoras.length > 0 || mejoresDias.length > 0;
  // La hora sugerida es el centro de la mejor ventana de 3 horas (la ventana empieza en `clave`).
  const hora = mejoresHoras[0] ? mejoresHoras[0].clave + 1 : HORA_GENERAL;
  const proximoMomento = proximo(ahora, mejoresDias.slice(0, 1).map((d) => d.clave), hora);
  // Un momento por cada uno de los mejores días; sin datos, tres días seguidos a la hora general.
  const momentos = mejoresDias.length > 0
    ? mejoresDias.map((d) => proximo(ahora, [d.clave], hora))
    : [0, 1, 2].map((i) => new Date(proximo(ahora, [], hora).getTime() + i * 24 * 60 * 60 * 1000));
  momentos.sort((a, b) => a.getTime() - b.getTime());

  return {
    muestra: publicaciones.length, suficiente, publicaciones, tipos, mejoresDias, mejoresHoras,
    proximoMomento: proximoMomento.toISOString(), momentos: momentos.map((m) => m.toISOString()), momentoDeLaCuenta,
  };
}
