import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { idDeYoutube } from './youtube';

// La lista de tutoriales: qué hay y qué falta (tabla marketing_tutoriales, cargada con la lista que armó el equipo).
// La actualiza el Claude de cada persona por el conector (tutoriales_listar / tutoriales_actualizar) y también se puede
// corregir desde el panel (Marketing → Videos → Tutoriales), que además muestra cada video para seguir el progreso.
//
// Cada tutorial es de un módulo (MODULOS_TUTORIAL). La lista de Tienda la armó el equipo; la de cada módulo nuevo la carga
// su responsable con su Claude al terminar su ciclo (tutoriales_crear). Fuera de Tienda, cada pantalla empieza con
// «<modulo>/» ('gimnasio/clases'): así las claves de un módulo nunca chocan con las del panel de Tienda.
//
// Los videos viven en YouTube (subidos como «No listado»): el Claude de cada persona carga el link con
// tutoriales_actualizar y el tutorial pasa a HECHO, sin cola, sin aprobación y sin correo. `pantallas` dice en qué
// pantallas del panel se ofrece (el botón «Ver tutorial» → Video lee videosDelPanel).
//
//   FALTA       → todavía no se hizo.
//   EN_PROCESO  → alguien lo está haciendo (lo marca su Claude al empezar).
//   EN_REVISION → de antes, cuando los tutoriales esperaban aprobación en la cola (ya no se usa).
//   HECHO       → está listo (al cargar su link de YouTube, al registrar su video en la cola, o a mano).

export const ESTADOS_TUTORIAL = ['FALTA', 'EN_PROCESO', 'EN_REVISION', 'HECHO'] as const;
export type EstadoTutorial = (typeof ESTADOS_TUTORIAL)[number];
export const RESPONSABLES_TUTORIAL = ['ALAN', 'MATEO', 'ALE'] as const;
export type ResponsableTutorial = (typeof RESPONSABLES_TUTORIAL)[number];
/** De qué módulo es cada tutorial. Los que ya existían son todos de Tienda. */
export const MODULOS_TUTORIAL = ['tienda', 'turnos', 'alquileres', 'gimnasio'] as const;
export type ModuloTutorial = (typeof MODULOS_TUTORIAL)[number];
/** Los que se pueden poner a mano: EN_REVISION lo decide el sistema según haya o no un video esperando. */
const ESTADOS_A_MANO = ['FALTA', 'EN_PROCESO', 'HECHO'];

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const limpio = (s: unknown, max: number) => (typeof s === 'string' ? s.replace(/\u0000/g, '').slice(0, max) : '');
/** Un texto de una línea, sin espacios de más. No se recorta al largo máximo: un título largo se rechaza, no se corta. */
const unaLinea = (s: unknown) => (typeof s === 'string' ? s.replace(/\u0000/g, '').replace(/\s+/g, ' ').trim() : '');
/** Una clave de pantalla del panel: 'pedidos', 'catalogo/nuevo', 'configuracion/apariencia', 'configuracion/equipo/invitar'. */
const PANTALLA = /^[a-z]+(\/[a-z-]+){0,2}$/;
const MAX_PANTALLAS = 6;
const TITULO_MIN = 3;
const TITULO_MAX = 120;
const GRUPO_MAX = 80;

/** Un módulo de la lista ('Gimnasio' vale). Uno que no existe es un error, no un filtro que no encuentra nada. */
function moduloValido(valor: unknown): ModuloTutorial {
  const modulo = typeof valor === 'string' ? valor.trim().toLowerCase() : '';
  if (!(MODULOS_TUTORIAL as readonly string[]).includes(modulo)) throw new BadRequestException(`modulo tiene que ser uno de: ${MODULOS_TUTORIAL.join(', ')}`);
  return modulo as ModuloTutorial;
}

/** Fuera de Tienda, cada pantalla empieza con «<modulo>/»: así nunca choca con una clave del panel de Tienda. */
function exigirPrefijo(pantallas: string[], modulo: ModuloTutorial, ayuda = '') {
  if (modulo === 'tienda') return;
  const ajena = pantallas.find((p) => !p.startsWith(`${modulo}/`));
  if (ajena) throw new BadRequestException(`Las pantallas de ${modulo} empiezan con «${modulo}/» (por ejemplo «${modulo}/configuracion»), así no chocan con las de Tienda: «${ajena}» no.${ayuda ? ` ${ayuda}` : ''}`);
}

/** La lista de pantallas que llega, sin repetidas y validada para el módulo donde va a quedar el tutorial. */
function pantallasValidas(valor: unknown, modulo: ModuloTutorial): string[] {
  if (!Array.isArray(valor)) throw new BadRequestException('pantallas tiene que ser una lista (por ejemplo ["pedidos", "pedidos/nuevo"])');
  const pantallas = [...new Set(valor.map((p) => String(p).trim().toLowerCase()).filter(Boolean))];
  const mala = pantallas.find((p) => !PANTALLA.test(p));
  if (mala) throw new BadRequestException(`«${mala}» no es una pantalla del panel (son como 'pedidos', 'catalogo/nuevo' o 'configuracion/apariencia')`);
  if (pantallas.length > MAX_PANTALLAS) throw new BadRequestException(`Como mucho ${MAX_PANTALLAS} pantallas por tutorial`);
  exigirPrefijo(pantallas, modulo);
  return pantallas;
}

/** Un sí o no opcional: sin mandar (o null) es no. */
function siONo(valor: unknown, campo: string): boolean {
  if (valor === undefined || valor === null) return false;
  if (typeof valor !== 'boolean') throw new BadRequestException(`${campo} tiene que ser true o false`);
  return valor;
}

const yaExiste = (titulo: string, modulo?: string) =>
  `Ya hay un tutorial «${titulo}»${modulo ? ` (de ${modulo})` : ''}: los títulos no se repiten, ni entre módulos. Usá uno más específico, por ejemplo con el nombre del módulo.`;

@Injectable()
export class TutorialesService {
  private readonly logger = new Logger(TutorialesService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** Sin módulo, la lista entera (como antes de que distinguiera módulos); con módulo, solo lo suyo, también en el resumen. */
  async listar(estado?: string, modulo?: string) {
    const delModulo: Prisma.MarketingTutorialWhereInput = modulo ? { modulo: moduloValido(modulo) } : {};
    const where: Prisma.MarketingTutorialWhereInput = estado && (ESTADOS_TUTORIAL as readonly string[]).includes(estado) ? { ...delModulo, estado } : delModulo;
    // grupoOrden y orden cuentan dentro de cada módulo: con todos, primero Tienda y después cada módulo, en el orden de MODULOS_TUTORIAL.
    const posicionDe = (m: string) => { const i = (MODULOS_TUTORIAL as readonly string[]).indexOf(m); return i < 0 ? MODULOS_TUTORIAL.length : i; };
    const filas = (await this.prisma.marketingTutorial.findMany({ where, orderBy: [{ grupoOrden: 'asc' }, { orden: 'asc' }] })).sort((a, b) => posicionDe(a.modulo) - posicionDe(b.modulo));
    const todos = await this.prisma.marketingTutorial.groupBy({ by: ['estado'], where: delModulo, _count: { _all: true } });
    const cuenta = (e: string) => todos.find((t) => t.estado === e)?._count._all ?? 0;
    const videos = filas.length
      ? await this.prisma.marketingVideo.findMany({ where: { tutorialId: { in: filas.map((f) => f.id) } }, orderBy: { createdAt: 'desc' }, select: { id: true, tutorialId: true, estado: true } })
      : [];
    return {
      resumen: { total: todos.reduce((s, t) => s + t._count._all, 0), hechos: cuenta('HECHO'), enRevision: cuenta('EN_REVISION'), enProceso: cuenta('EN_PROCESO'), faltan: cuenta('FALTA') },
      tutoriales: filas.map((f) => ({
        id: f.id,
        modulo: f.modulo as ModuloTutorial,
        grupo: f.grupo,
        titulo: f.titulo,
        estado: f.estado as EstadoTutorial,
        opcional: f.opcional,
        prioridadAlta: f.prioridadAlta,
        notas: f.notas,
        asignadoA: f.asignadoA as ResponsableTutorial | null,
        youtubeId: f.youtubeId,
        pantallas: f.pantallas,
        videoId: videos.find((v) => v.tutorialId === f.id)?.id ?? null,
        updatedAt: f.updatedAt,
      })),
    };
  }

  /**
   * Lo que ofrece el panel en «Ver tutorial» → Video: los tutoriales con link, por pantalla y en el orden de la lista. Solo
   * los del módulo de ese panel: el de Tienda no pide módulo y recibe lo mismo que antes de que la lista los distinguiera.
   */
  async videosDelPanel(modulo = 'tienda') {
    const filas = await this.prisma.marketingTutorial.findMany({
      where: { modulo: moduloValido(modulo), youtubeId: { not: null }, NOT: { pantallas: { isEmpty: true } } },
      orderBy: [{ grupoOrden: 'asc' }, { orden: 'asc' }],
      select: { titulo: true, youtubeId: true, pantallas: true },
    });
    return { videos: filas.map((f) => ({ titulo: f.titulo, youtubeId: f.youtubeId as string, pantallas: f.pantallas })) };
  }

  /**
   * Cambia el estado, el responsable, las notas, el link de YouTube, las pantallas y/o el módulo de un tutorial. Se acepta su
   * id o su título exacto. Cargar el link lo deja HECHO (salvo que se mande otro estado); un link vacío lo quita.
   */
  async actualizar(adminId: string, input: { tutorial: unknown; estado?: unknown; asignadoA?: unknown; notas?: unknown; youtube?: unknown; pantallas?: unknown; modulo?: unknown }) {
    const ref = String(input.tutorial ?? '').trim();
    if (!ref) throw new BadRequestException('Falta el tutorial (su id o su título)');
    const item = UUID.test(ref)
      ? await this.prisma.marketingTutorial.findUnique({ where: { id: ref } })
      : await this.prisma.marketingTutorial.findFirst({ where: { titulo: { equals: ref, mode: 'insensitive' } } });
    if (!item) throw new NotFoundException('No existe ese tutorial en la lista (usá tutoriales_listar para ver los ids)');

    const data: Prisma.MarketingTutorialUpdateInput = { actualizadoPor: adminId };
    if (input.estado !== undefined) {
      const estado = String(input.estado);
      if (estado === 'EN_REVISION') throw new BadRequestException('EN_REVISION lo pone solo el sistema cuando registrás el video del tutorial');
      if (!ESTADOS_A_MANO.includes(estado)) throw new BadRequestException(`estado tiene que ser uno de: ${ESTADOS_A_MANO.join(', ')}`);
      data.estado = estado;
    }
    if (input.notas !== undefined) data.notas = limpio(input.notas, 1000).trim() || null;
    if (input.asignadoA !== undefined) {
      const asignado = input.asignadoA ? String(input.asignadoA).trim().toUpperCase() : null;
      if (asignado && !RESPONSABLES_TUTORIAL.includes(asignado as ResponsableTutorial)) {
        throw new BadRequestException(`asignadoA tiene que ser uno de: ${RESPONSABLES_TUTORIAL.join(', ')} o vacío`);
      }
      data.asignadoA = asignado;
    }
    if (input.youtube !== undefined) {
      const crudo = typeof input.youtube === 'string' ? input.youtube.trim() : '';
      if (!crudo) data.youtubeId = null;
      else {
        const id = idDeYoutube(crudo);
        if (!id) throw new BadRequestException('youtube tiene que ser un link de un video de YouTube (youtu.be/…, youtube.com/watch?v=…) o su id');
        data.youtubeId = id;
        if (input.estado === undefined) data.estado = 'HECHO';
      }
    }
    // El módulo y las pantallas se validan con lo que va a quedar: si cambia el módulo, las pantallas que ya tenía también
    // tienen que llevar su prefijo.
    const modulo = input.modulo !== undefined ? moduloValido(input.modulo) : (item.modulo as ModuloTutorial);
    const cambiaDeModulo = modulo !== item.modulo;
    if (input.pantallas !== undefined) data.pantallas = pantallasValidas(input.pantallas, modulo);
    else if (cambiaDeModulo) exigirPrefijo(item.pantallas, modulo, 'Si cambiás el módulo, mandá también sus pantallas.');
    if ([input.estado, input.notas, input.asignadoA, input.youtube, input.pantallas, input.modulo].every((x) => x === undefined)) {
      throw new BadRequestException('No hay nada para cambiar: mandá estado, asignadoA, notas, youtube, pantallas o modulo');
    }
    // grupoOrden y orden cuentan dentro de cada módulo: en el nuevo va al final de su grupo, como si se creara ahí.
    if (cambiaDeModulo) Object.assign(data, { modulo }, await this.lugarEn(modulo, item.grupo));

    const r = await this.prisma.marketingTutorial.update({ where: { id: item.id }, data });
    await this.registrar(adminId, 'tutorial_actualizar', item.id, { titulo: item.titulo, antes: item.estado, estado: r.estado, ...(cambiaDeModulo ? { moduloAntes: item.modulo, modulo } : {}) });
    return { id: r.id, modulo: r.modulo as ModuloTutorial, titulo: r.titulo, estado: r.estado as EstadoTutorial, asignadoA: r.asignadoA as ResponsableTutorial | null, notas: r.notas, youtubeId: r.youtubeId, pantallas: r.pantallas };
  }

  /**
   * Suma un tutorial a la lista de un módulo: así el responsable de cada módulo nuevo carga la suya con su Claude. Queda en
   * FALTA y al final de su grupo; si el grupo todavía no existe en ese módulo, se abre al final. No sube ni produce videos:
   * el link se carga después con actualizar (campo youtube).
   */
  async crear(adminId: string, input: { titulo?: unknown; grupo?: unknown; modulo?: unknown; pantallas?: unknown; opcional?: unknown; prioridadAlta?: unknown; notas?: unknown }) {
    const titulo = unaLinea(input.titulo);
    if (titulo.length < TITULO_MIN || titulo.length > TITULO_MAX) throw new BadRequestException(`El título tiene que tener entre ${TITULO_MIN} y ${TITULO_MAX} caracteres`);
    const grupo = unaLinea(input.grupo);
    if (!grupo) throw new BadRequestException('Falta el grupo (por ejemplo «Arrancar»): la lista se ordena por grupos');
    if (grupo.length > GRUPO_MAX) throw new BadRequestException(`El grupo puede tener hasta ${GRUPO_MAX} caracteres`);
    if (input.modulo === undefined || input.modulo === null || input.modulo === '') throw new BadRequestException(`Falta el módulo: ${MODULOS_TUTORIAL.join(', ')}`);
    const modulo = moduloValido(input.modulo);
    const pantallas = input.pantallas === undefined ? [] : pantallasValidas(input.pantallas, modulo);
    const opcional = siONo(input.opcional, 'opcional');
    const prioridadAlta = siONo(input.prioridadAlta, 'prioridadAlta');
    const notas = input.notas === undefined ? null : limpio(input.notas, 1000).trim() || null;

    // Los títulos no se repiten, ni entre módulos: el conector y la cola de videos ubican un tutorial por su título.
    const repetido = await this.prisma.marketingTutorial.findFirst({ where: { titulo: { equals: titulo, mode: 'insensitive' } }, select: { titulo: true, modulo: true } });
    if (repetido) throw new BadRequestException(yaExiste(repetido.titulo, repetido.modulo));

    const lugar = await this.lugarEn(modulo, grupo);
    const r = await this.prisma.marketingTutorial
      .create({ data: { modulo, ...lugar, titulo, estado: 'FALTA', opcional, prioridadAlta, notas, pantallas, actualizadoPor: adminId } })
      .catch((e: unknown) => {
        // Dos altas con el mismo título a la vez: la base frena la segunda.
        if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') throw new BadRequestException(yaExiste(titulo));
        throw e;
      });
    await this.registrar(adminId, 'tutorial_crear', r.id, { titulo: r.titulo, modulo: r.modulo, grupo: r.grupo });
    return { id: r.id, modulo: r.modulo as ModuloTutorial, grupo: r.grupo, titulo: r.titulo, estado: r.estado as EstadoTutorial, opcional: r.opcional, prioridadAlta: r.prioridadAlta, notas: r.notas, pantallas: r.pantallas };
  }

  /**
   * Dónde va un tutorial dentro de un módulo: al final de su grupo si el grupo ya existe ahí (con el nombre como ya está
   * escrito, sin importar mayúsculas), o en un grupo nuevo después del último.
   */
  private async lugarEn(modulo: ModuloTutorial, grupo: string) {
    const filas = await this.prisma.marketingTutorial.findMany({ where: { modulo }, select: { grupo: true, grupoOrden: true, orden: true }, orderBy: [{ grupoOrden: 'asc' }, { orden: 'asc' }] });
    const delGrupo = filas.filter((f) => f.grupo.toLowerCase() === grupo.toLowerCase());
    if (delGrupo.length) return { grupo: delGrupo[0].grupo, grupoOrden: delGrupo[0].grupoOrden, orden: Math.max(...delGrupo.map((f) => f.orden)) + 1 };
    return { grupo, grupoOrden: Math.max(0, ...filas.map((f) => f.grupoOrden)) + 1, orden: 1 };
  }

  private async registrar(adminId: string, accion: 'tutorial_crear' | 'tutorial_actualizar', targetId: string, details: Record<string, unknown>) {
    try {
      await this.prisma.platformAdminLog.create({ data: { adminId, action: accion, targetType: 'marketing_tutorial', targetId, details: details as Prisma.InputJsonValue } });
    } catch (e) {
      // El registro no puede tirar abajo la acción: ya se hizo.
      this.logger.warn(`No se pudo registrar ${accion}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
}
