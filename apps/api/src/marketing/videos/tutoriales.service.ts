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
// Lo cargado se puede corregir (actualizar cambia también el título, el grupo y el módulo), pero no borrar: un tutorial
// cargado por error se renombra o se reusa. Los títulos no se repiten y el lugar (grupoOrden, orden) se cuenta dentro de
// cada módulo, así que todo lo que toca un título o un lugar corre de a uno, con un candado de la base (conCandado).
//
// Los videos viven en YouTube (subidos como «No listado»): el Claude de cada persona carga el link con
// tutoriales_actualizar y el tutorial pasa a HECHO, sin cola, sin aprobación y sin correo. `pantallas` dice en qué
// pantallas del panel se ofrece (el botón «Ver tutorial» → Video lee videosDelPanel). Hoy ese botón existe solo en el panel
// de Tienda: el link y las pantallas de los otros módulos quedan guardados para cuando su panel lo tenga.
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
/** La de un módulo que no es Tienda lleva el módulo adelante, así que le toca un tramo más: 'gimnasio/configuracion/equipo/invitar'. */
const PANTALLA_DE_MODULO = /^[a-z]+(\/[a-z-]+){0,3}$/;
const MAX_PANTALLAS = 6;
const TITULO_MIN = 3;
const TITULO_MAX = 120;
const GRUPO_MAX = 80;

/** Para emparejar grupos: sin mayúsculas ni acentos («Catalogo» es «Catálogo»). Solo se compara así: el nombre queda como ya está guardado. */
const sinAcentos = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();

/** El título de un tutorial: una línea, de 3 a 120 caracteres. */
function tituloValido(valor: unknown): string {
  const titulo = unaLinea(valor);
  if (titulo.length < TITULO_MIN || titulo.length > TITULO_MAX) throw new BadRequestException(`El título tiene que tener entre ${TITULO_MIN} y ${TITULO_MAX} caracteres`);
  return titulo;
}

/** El grupo de un tutorial: una línea, hasta 80 caracteres. */
function grupoValido(valor: unknown): string {
  const grupo = unaLinea(valor);
  if (!grupo) throw new BadRequestException('Falta el grupo (por ejemplo «Arrancar»): la lista se ordena por grupos');
  if (grupo.length > GRUPO_MAX) throw new BadRequestException(`El grupo puede tener hasta ${GRUPO_MAX} caracteres`);
  return grupo;
}

/** Un módulo de la lista ('Gimnasio' vale). Uno que no existe es un error, no un filtro que no encuentra nada. */
function moduloValido(valor: unknown): ModuloTutorial {
  const modulo = typeof valor === 'string' ? valor.trim().toLowerCase() : '';
  if (!(MODULOS_TUTORIAL as readonly string[]).includes(modulo)) throw new BadRequestException(`modulo tiene que ser uno de: ${MODULOS_TUTORIAL.join(', ')}`);
  return modulo as ModuloTutorial;
}

/**
 * Las pantallas de un módulo no se mezclan con las de otro: fuera de Tienda cada una empieza con «<modulo>/», y en Tienda
 * ninguna empieza con el prefijo de otro módulo. Así una clave de un módulo nunca choca con una del panel de Tienda.
 */
function exigirPrefijo(pantallas: string[], modulo: ModuloTutorial, ayuda = '') {
  const cierre = ayuda ? ` ${ayuda}` : '';
  if (modulo === 'tienda') {
    const otros = MODULOS_TUTORIAL.filter((m) => m !== 'tienda');
    const ajena = pantallas.find((p) => otros.some((m) => p.startsWith(`${m}/`)));
    if (ajena) throw new BadRequestException(`En Tienda una pantalla no puede empezar con el prefijo de otro módulo (${otros.map((m) => `«${m}/»`).join(', ')}): «${ajena}» es de ${ajena.split('/')[0]}.${cierre}`);
    return;
  }
  const ajena = pantallas.find((p) => !p.startsWith(`${modulo}/`));
  if (ajena) throw new BadRequestException(`Las pantallas de ${modulo} empiezan con «${modulo}/» (por ejemplo «${modulo}/configuracion»), así no chocan con las de Tienda: «${ajena}» no.${cierre}`);
}

/** La lista de pantallas que llega, sin repetidas y validada para el módulo donde va a quedar el tutorial. */
function pantallasValidas(valor: unknown, modulo: ModuloTutorial): string[] {
  if (!Array.isArray(valor)) throw new BadRequestException('pantallas tiene que ser una lista (por ejemplo ["pedidos", "pedidos/nuevo"])');
  const pantallas = [...new Set(valor.map((p) => String(p).trim().toLowerCase()).filter(Boolean))];
  const deTienda = modulo === 'tienda';
  const mala = pantallas.find((p) => !(deTienda ? PANTALLA : PANTALLA_DE_MODULO).test(p));
  if (mala) throw new BadRequestException(`«${mala}» no es una pantalla del panel (son como ${deTienda ? "'pedidos', 'catalogo/nuevo' o 'configuracion/apariencia'" : `'${modulo}/inicio' o '${modulo}/configuracion/equipo'`})`);
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

/** La red de la base: si igual se cuela un título repetido, el índice único frena la escritura y sale el mismo error claro. */
const siSeRepite = (titulo: string) => (e: unknown): never => {
  if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') throw new BadRequestException(yaExiste(titulo));
  throw e;
};

/**
 * El id del tutorial con ese título exacto, sin distinguir mayúsculas (null si no hay). No se usa `equals` con
 * `mode: 'insensitive'` de Prisma porque arma un ILIKE, donde «%» y «_» son comodines: «a_c» encontraba «abc» y «%»,
 * cualquiera. El título viaja como parámetro de la consulta, nunca pegado en el SQL. Es el único lugar que ubica un tutorial
 * por su título; lo usa también la cola de videos (VideosService).
 */
export async function idDeTutorialPorTitulo(db: Pick<Prisma.TransactionClient, '$queryRaw'>, titulo: string): Promise<string | null> {
  const filas = await db.$queryRaw<{ id: string }[]>`SELECT "id" FROM "marketing_tutoriales" WHERE lower("titulo") = lower(${titulo}) LIMIT 1`;
  return filas[0]?.id ?? null;
}

/** Lo que puede cambiar actualizar. Llega del conector o del panel, así que cada campo se valida antes de usarlo. */
interface CambiosDeTutorial {
  estado?: unknown;
  asignadoA?: unknown;
  notas?: unknown;
  youtube?: unknown;
  pantallas?: unknown;
  modulo?: unknown;
  titulo?: unknown;
  grupo?: unknown;
}

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
   * Cambia el estado, el responsable, las notas, el link de YouTube, las pantallas, el título, el grupo y/o el módulo de un
   * tutorial. Se acepta su id o su título exacto. Cargar el link lo deja HECHO (salvo que se mande otro estado); un link vacío
   * lo quita. Si cambia de grupo o de módulo va al final del grupo donde queda, y la respuesta trae grupoNuevo: si hubo que
   * abrir ese grupo porque no existía en el módulo.
   */
  async actualizar(adminId: string, input: { tutorial: unknown } & CambiosDeTutorial) {
    const ref = String(input.tutorial ?? '').trim();
    if (!ref) throw new BadRequestException('Falta el tutorial (su id o su título)');
    // El título, el grupo y el módulo tocan lo que comparte toda la lista (los títulos no se repiten y el lugar se cuenta
    // dentro del módulo): eso corre con el candado, también la lectura del tutorial. Lo demás es de su fila sola.
    const tocaLaLista = [input.titulo, input.grupo, input.modulo].some((x) => x !== undefined);
    const { antes, r, grupoNuevo } = tocaLaLista ? await this.conCandado((tx) => this.aplicar(tx, adminId, ref, input)) : await this.aplicar(this.prisma, adminId, ref, input);

    await this.registrar(adminId, 'tutorial_actualizar', r.id, {
      titulo: r.titulo,
      ...(r.titulo !== antes.titulo ? { tituloAntes: antes.titulo } : {}),
      antes: antes.estado,
      estado: r.estado,
      ...(r.modulo !== antes.modulo ? { moduloAntes: antes.modulo, modulo: r.modulo } : {}),
      ...(r.grupo !== antes.grupo ? { grupoAntes: antes.grupo, grupo: r.grupo } : {}),
    });
    return {
      id: r.id,
      modulo: r.modulo as ModuloTutorial,
      grupo: r.grupo,
      // Solo cuando se movió (cambió de grupo o de módulo): true si para eso hubo que abrir un grupo.
      ...(grupoNuevo === undefined ? {} : { grupoNuevo }),
      titulo: r.titulo,
      estado: r.estado as EstadoTutorial,
      asignadoA: r.asignadoA as ResponsableTutorial | null,
      notas: r.notas,
      youtubeId: r.youtubeId,
      pantallas: r.pantallas,
    };
  }

  /** Los cambios de actualizar sobre `db`: el servicio, o la transacción que tiene el candado si tocan un título o un lugar. */
  private async aplicar(db: Prisma.TransactionClient, adminId: string, ref: string, input: CambiosDeTutorial) {
    const item = UUID.test(ref) ? await db.marketingTutorial.findUnique({ where: { id: ref } }) : await this.porTitulo(db, ref);
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
    const titulo = input.titulo !== undefined ? tituloValido(input.titulo) : item.titulo;
    const grupo = input.grupo !== undefined ? grupoValido(input.grupo) : item.grupo;
    // El módulo y las pantallas se validan con lo que va a quedar: si cambia el módulo, las pantallas que ya tenía también
    // tienen que ser de ese módulo (con su prefijo, o sin el de otro si pasa a Tienda).
    const modulo = input.modulo !== undefined ? moduloValido(input.modulo) : (item.modulo as ModuloTutorial);
    const cambiaDeModulo = modulo !== item.modulo;
    if (input.pantallas !== undefined) data.pantallas = pantallasValidas(input.pantallas, modulo);
    else if (cambiaDeModulo) exigirPrefijo(item.pantallas, modulo, 'Si cambiás el módulo, mandá también sus pantallas.');
    if ([input.estado, input.notas, input.asignadoA, input.youtube, input.pantallas, input.modulo, input.titulo, input.grupo].every((x) => x === undefined)) {
      throw new BadRequestException('No hay nada para cambiar: mandá estado, asignadoA, notas, youtube, pantallas, modulo, titulo o grupo');
    }

    // Los títulos no se repiten, ni entre módulos ni cambiando mayúsculas; el suyo, escrito de otra forma, sí vale.
    if (titulo !== item.titulo) {
      const repetido = await this.porTitulo(db, titulo);
      if (repetido && repetido.id !== item.id) throw new BadRequestException(yaExiste(repetido.titulo, repetido.modulo));
      data.titulo = titulo;
    }
    // grupoOrden y orden cuentan dentro de cada módulo: si cambia de grupo o de módulo va al final del grupo donde queda,
    // como si se creara ahí. El mismo grupo escrito de otra forma (mayúsculas, acentos) no lo mueve.
    let grupoNuevo: boolean | undefined;
    if (cambiaDeModulo || sinAcentos(grupo) !== sinAcentos(item.grupo)) {
      const lugar = await this.lugarEn(db, modulo, grupo);
      grupoNuevo = lugar.grupoNuevo;
      data.modulo = modulo;
      data.grupo = lugar.grupo;
      data.grupoOrden = lugar.grupoOrden;
      data.orden = lugar.orden;
    }

    const r = await db.marketingTutorial.update({ where: { id: item.id }, data }).catch(siSeRepite(titulo));
    return { antes: item, r, grupoNuevo };
  }

  /**
   * Suma un tutorial a la lista de un módulo: así el responsable de cada módulo nuevo carga la suya con su Claude. Queda en
   * FALTA y al final de su grupo; si el grupo todavía no existe en ese módulo, se abre al final (grupoNuevo lo avisa, por si
   * fue un nombre mal escrito). No sube ni produce videos: el link se carga después con actualizar (campo youtube).
   */
  async crear(adminId: string, input: { titulo?: unknown; grupo?: unknown; modulo?: unknown; pantallas?: unknown; opcional?: unknown; prioridadAlta?: unknown; notas?: unknown }) {
    const titulo = tituloValido(input.titulo);
    const grupo = grupoValido(input.grupo);
    if (input.modulo === undefined || input.modulo === null || input.modulo === '') throw new BadRequestException(`Falta el módulo: ${MODULOS_TUTORIAL.join(', ')}`);
    const modulo = moduloValido(input.modulo);
    // Sin pantallas (o con null, como opcional y notas) arranca sin ninguna: se cargan después con actualizar.
    const pantallas = input.pantallas === undefined || input.pantallas === null ? [] : pantallasValidas(input.pantallas, modulo);
    const opcional = siONo(input.opcional, 'opcional');
    const prioridadAlta = siONo(input.prioridadAlta, 'prioridadAlta');
    const notas = input.notas === undefined ? null : limpio(input.notas, 1000).trim() || null;

    const { r, grupoNuevo } = await this.conCandado(async (tx) => {
      // Los títulos no se repiten, ni entre módulos: el conector y la cola de videos ubican un tutorial por su título.
      const repetido = await this.porTitulo(tx, titulo);
      if (repetido) throw new BadRequestException(yaExiste(repetido.titulo, repetido.modulo));
      const lugar = await this.lugarEn(tx, modulo, grupo);
      const creado = await tx.marketingTutorial
        .create({ data: { modulo, grupo: lugar.grupo, grupoOrden: lugar.grupoOrden, orden: lugar.orden, titulo, estado: 'FALTA', opcional, prioridadAlta, notas, pantallas, actualizadoPor: adminId } })
        .catch(siSeRepite(titulo));
      return { r: creado, grupoNuevo: lugar.grupoNuevo };
    });
    await this.registrar(adminId, 'tutorial_crear', r.id, { titulo: r.titulo, modulo: r.modulo, grupo: r.grupo });
    return { id: r.id, modulo: r.modulo as ModuloTutorial, grupo: r.grupo, grupoNuevo, titulo: r.titulo, estado: r.estado as EstadoTutorial, opcional: r.opcional, prioridadAlta: r.prioridadAlta, notas: r.notas, pantallas: r.pantallas };
  }

  /**
   * Corre de a uno lo que cambia un título o un lugar de la lista. Sin esto, dos altas a la vez leen el mismo «último lugar»
   * y quedan con el mismo orden, y las dos ven libre el mismo título. El candado es de la base y se suelta solo al terminar
   * la transacción: ordena también a dos instancias de la API. Todo lo que corre adentro usa `tx`, nunca `this.prisma`.
   */
  private conCandado<T>(accion: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('marketing_tutoriales'))`;
      return accion(tx);
    });
  }

  /** El tutorial con ese título exacto, sin distinguir mayúsculas y sin comodines (ver idDeTutorialPorTitulo). */
  private async porTitulo(db: Prisma.TransactionClient, titulo: string) {
    const id = await idDeTutorialPorTitulo(db, titulo);
    return id ? db.marketingTutorial.findUnique({ where: { id } }) : null;
  }

  /**
   * Dónde va un tutorial dentro de un módulo: al final de su grupo si el grupo ya existe ahí (con el nombre como ya está
   * guardado; se empareja sin mirar mayúsculas ni acentos), o en un grupo nuevo después del último (grupoNuevo).
   */
  private async lugarEn(db: Prisma.TransactionClient, modulo: ModuloTutorial, grupo: string) {
    const filas = await db.marketingTutorial.findMany({ where: { modulo }, select: { grupo: true, grupoOrden: true, orden: true }, orderBy: [{ grupoOrden: 'asc' }, { orden: 'asc' }] });
    const delGrupo = filas.filter((f) => sinAcentos(f.grupo) === sinAcentos(grupo));
    if (delGrupo.length) return { grupo: delGrupo[0].grupo, grupoOrden: delGrupo[0].grupoOrden, orden: Math.max(...delGrupo.map((f) => f.orden)) + 1, grupoNuevo: false };
    return { grupo, grupoOrden: Math.max(0, ...filas.map((f) => f.grupoOrden)) + 1, orden: 1, grupoNuevo: true };
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
