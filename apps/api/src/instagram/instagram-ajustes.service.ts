import { Injectable } from '@nestjs/common';
import type { InstagramSettings } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

// Ajustes de Instagram de un negocio (Difusión): las respuestas automáticas de los mensajes (bienvenida y
// ausencia) y la moderación de comentarios (ocultar los que tengan ciertas palabras).
//
// Las respuestas automáticas son deliberadamente prudentes, porque un mensaje automático mal calibrado molesta
// y puede entrar en un bucle con la cuenta de otro negocio que también responde sola:
//   - la bienvenida sale UNA vez, cuando alguien escribe por primera vez;
//   - la de ausencia sale como mucho una vez cada 12 horas por conversación, y solo fuera del horario de atención;
//   - nunca se responde a un mensaje viejo (un reintento de Meta) ni a lo que el propio negocio escribió.

/** Argentina no tiene horario de verano: siempre UTC−3. */
const OFFSET_AR_MS = -3 * 60 * 60 * 1000;
export const ENTRE_AUSENCIAS_MS = 12 * 60 * 60 * 1000;
/** Un mensaje más viejo que esto no se contesta solo: el cliente ya no está esperando. */
export const ANTIGUEDAD_MAXIMA_MS = 30 * 60 * 1000;

export interface AjustesDeInstagram {
  bienvenida: { activa: boolean; texto: string };
  ausencia: { activa: boolean; texto: string; desde: string; hasta: string; dias: number[] };
  moderacion: { activa: boolean; palabras: string[] };
}

export const AJUSTES_POR_DEFECTO: AjustesDeInstagram = {
  bienvenida: { activa: false, texto: '' },
  ausencia: { activa: false, texto: '', desde: '09:00', hasta: '18:00', dias: [1, 2, 3, 4, 5] },
  moderacion: { activa: false, palabras: [] },
};

const comoLista = <T>(v: unknown, esT: (x: unknown) => x is T): T[] => (Array.isArray(v) ? v.filter(esT) : []);

export function aAjustes(f: InstagramSettings | null): AjustesDeInstagram {
  if (!f) return AJUSTES_POR_DEFECTO;
  return {
    bienvenida: { activa: f.welcomeEnabled, texto: f.welcomeText },
    ausencia: {
      activa: f.awayEnabled,
      texto: f.awayText,
      desde: f.openFrom,
      hasta: f.openTo,
      dias: comoLista(f.openDays, (x): x is number => typeof x === 'number'),
    },
    moderacion: { activa: f.moderationEnabled, palabras: comoLista(f.moderationWords, (x): x is string => typeof x === 'string') },
  };
}

const aMinutos = (hhmm: string): number => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
};

/** ¿Está el negocio fuera de su horario de atención a esta hora? (hora de Argentina) */
export function fueraDeHorario(a: AjustesDeInstagram['ausencia'], ahora: Date): boolean {
  const local = new Date(ahora.getTime() + OFFSET_AR_MS);
  if (!a.dias.includes(local.getUTCDay())) return true;
  const min = local.getUTCHours() * 60 + local.getUTCMinutes();
  const desde = aMinutos(a.desde);
  const hasta = aMinutos(a.hasta);
  // Un horario que cruza la medianoche (de 20:00 a 04:00) atiende de noche.
  return desde <= hasta ? min < desde || min >= hasta : min >= hasta && min < desde;
}

const normalizar = (t: string): string => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** ¿Tiene el comentario alguna de las palabras (o frases) a ocultar? Sin distinguir mayúsculas ni tildes. */
export function tienePalabraProhibida(texto: string, palabras: string[]): boolean {
  const t = normalizar(texto);
  return palabras.some((p) => {
    const w = normalizar(p).trim();
    return w.length >= 2 && t.includes(w);
  });
}

@Injectable()
export class InstagramAjustesService {
  constructor(private readonly prisma: PrismaService) {}

  async obtener(businessId: string): Promise<AjustesDeInstagram> {
    return aAjustes(await this.prisma.instagramSettings.findUnique({ where: { businessId } }));
  }

  async guardar(businessId: string, a: AjustesDeInstagram): Promise<AjustesDeInstagram> {
    const palabras = [...new Set(a.moderacion.palabras.map((p) => p.trim()).filter((p) => p.length >= 2))];
    const datos = {
      welcomeEnabled: a.bienvenida.activa && a.bienvenida.texto.trim().length > 0,
      welcomeText: a.bienvenida.texto.trim(),
      awayEnabled: a.ausencia.activa && a.ausencia.texto.trim().length > 0,
      awayText: a.ausencia.texto.trim(),
      openFrom: a.ausencia.desde,
      openTo: a.ausencia.hasta,
      openDays: [...new Set(a.ausencia.dias)].sort(),
      moderationEnabled: a.moderacion.activa && palabras.length > 0,
      moderationWords: palabras,
    };
    const fila = await this.prisma.instagramSettings.upsert({
      where: { businessId },
      create: { businessId, ...datos },
      update: datos,
    });
    return aAjustes(fila);
  }

  /**
   * ¿Hay que contestar solo a este mensaje, y con qué? `esNueva`: es la primera vez que esta persona escribe.
   * Devuelve el texto a mandar, o null si no corresponde.
   */
  async respuestaAutomatica(
    businessId: string,
    conversationId: string,
    opciones: { esNueva: boolean; enviadoEn: Date },
    ahora: Date = new Date(),
  ): Promise<string | null> {
    if (ahora.getTime() - opciones.enviadoEn.getTime() > ANTIGUEDAD_MAXIMA_MS) return null;
    const a = await this.obtener(businessId);

    if (opciones.esNueva && a.bienvenida.activa && a.bienvenida.texto) return a.bienvenida.texto;
    if (!a.ausencia.activa || !a.ausencia.texto || !fueraDeHorario(a.ausencia, ahora)) return null;

    // Con una respuesta del negocio en las últimas 12 horas (una persona o la ausencia anterior), no se repite.
    const reciente = await this.prisma.message.findFirst({
      where: { conversationId, channel: 'INSTAGRAM', sender: 'STORE', createdAt: { gte: new Date(ahora.getTime() - ENTRE_AUSENCIAS_MS) } },
      select: { id: true },
    });
    return reciente ? null : a.ausencia.texto;
  }

  /** Negocios con la moderación prendida (para el disparo periódico). */
  async negociosConModeracion(): Promise<{ businessId: string; palabras: string[] }[]> {
    const filas = await this.prisma.instagramSettings.findMany({ where: { moderationEnabled: true } });
    return filas.map((f) => ({ businessId: f.businessId, palabras: aAjustes(f).moderacion.palabras }));
  }
}
