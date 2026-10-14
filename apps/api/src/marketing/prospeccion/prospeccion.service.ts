import { BadRequestException, Injectable, Logger, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { Evaluacion, GUIA_DE_MENSAJES, SUBRUBROS, VERSION_CRITERIO, criterioResumen } from './prospeccion.criterio';
import { DatosProspecto, MAX_CUENTAS_POR_LOTE, PAUSA_ENTRE_CONSULTAS_MS, consultarCuenta, normalizarUsuario, normalizarUsuarios, recortarTexto, resumirCuenta } from './prospeccion.meta';

// Prospección de Órbita: a qué negocios de Instagram vale la pena escribirles. Lee datos PÚBLICOS de cuentas
// profesionales por la API oficial de Meta, les aplica el criterio de cliente ideal (prospeccion.criterio.ts)
// y guarda el resultado. El análisis fino (subrubro real, señales, mensaje sugerido) lo hace Claude, el de cada
// superadmin, a través del conector MCP, y vuelve acá con guardarAnalisis().
//
// NADA se envía ni se toca en ninguna cuenta: una persona revisa y escribe.

export const ESTADOS = ['NUEVO', 'CONTACTADO', 'RESPONDIO', 'DEMO', 'CLIENTE', 'DESCARTADO', 'NO_CONTACTAR'] as const;
export type EstadoProspecto = (typeof ESTADOS)[number];

const NIVELES_OK = ['A', 'B', 'C', 'D'];
const CONFIANZA_OK = ['alta', 'media', 'baja'];
export const ID_LOTE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface AnalisisProspecto {
  usuario: string;
  subrubro: string;
  confianza: 'alta' | 'media' | 'baja';
  vende_productos: boolean | null;
  canal_venta: string;
  senales_dolor: string[];
  nivel_final: 'A' | 'B' | 'C' | 'D';
  motivo: string;
  angulo: string;
  mensaje_sugerido: string;
}

interface Opciones {
  fetchFn?: typeof fetch;
  pausaMs?: number;
}

@Injectable()
export class ProspeccionService {
  private readonly logger = new Logger(ProspeccionService.name);

  // Solo para los tests: un fetch falso y sin pausa entre consultas. En la app real queda vacío.
  opciones: Opciones = {};

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  /** El token de Meta se lee al usarlo, no al arrancar: la API sigue levantando si todavía no está cargado. */
  private metaConfig() {
    const token = this.config.get<string>('META_PROSPECCION_TOKEN');
    if (!token) throw new ServiceUnavailableException('La prospección no está configurada en este entorno (falta el token de Meta)');
    return { token, igId: this.config.get<string>('META_PROSPECCION_IG_ID'), version: this.config.get<string>('META_PROSPECCION_GRAPH_VERSION') };
  }

  criterio() {
    return criterioResumen();
  }

  /** Consulta cuentas, las puntúa y las guarda como un lote nuevo. Mantiene el estado, responsable y notas de las que ya estaban. */
  async consultar(adminId: string, crudos: unknown[]) {
    const usuarios = normalizarUsuarios(crudos ?? []);
    if (!usuarios.length) throw new BadRequestException('No hay cuentas de Instagram válidas en la lista');
    if (usuarios.length > MAX_CUENTAS_POR_LOTE) throw new BadRequestException(`Máximo ${MAX_CUENTAS_POR_LOTE} cuentas por lote: llegaron ${usuarios.length}`);
    const meta = this.metaConfig();
    const pausa = this.opciones.pausaMs ?? PAUSA_ENTRE_CONSULTAS_MS;

    const resultados: { usuario: string; datos: DatosProspecto; evaluacion: Evaluacion }[] = [];
    const sinDatos: { usuario: string; motivo: string }[] = [];
    let interrumpido: string | null = null;
    for (const [i, usuario] of usuarios.entries()) {
      const r = await consultarCuenta(usuario, meta, this.opciones.fetchFn);
      if (r.error?.code === 190) {
        interrumpido = 'El token de Meta venció o no es válido: hay que generar uno nuevo';
        break;
      }
      if (r.business_discovery) {
        resultados.push({ usuario, ...resumirCuenta(usuario, r.business_discovery) });
      } else {
        const motivo = r.error?.message === 'Invalid user id' ? 'cuenta personal, privada o inexistente' : (r.error?.message ?? 'sin respuesta');
        sinDatos.push({ usuario, motivo });
      }
      if (i < usuarios.length - 1 && pausa > 0) await new Promise((res) => setTimeout(res, pausa));
    }
    if (interrumpido && !resultados.length) throw new ServiceUnavailableException(interrumpido);

    for (const r of resultados) {
      await this.prisma.marketingProspecto.upsert({
        where: { usuario: r.usuario },
        create: { usuario: r.usuario, datos: r.datos as unknown as Prisma.InputJsonValue, evaluacion: r.evaluacion as unknown as Prisma.InputJsonValue },
        update: { datos: r.datos as unknown as Prisma.InputJsonValue, evaluacion: r.evaluacion as unknown as Prisma.InputJsonValue, ultimaConsultaAt: new Date() },
      });
    }
    const lote = await this.prisma.marketingProspeccionLote.create({
      data: { creadoPor: adminId, usuarios: resultados.map((r) => r.usuario), sinDatos: sinDatos as unknown as Prisma.InputJsonValue, versionCriterio: VERSION_CRITERIO },
    });
    await this.registrar(adminId, 'prospeccion_consultar', lote.id, { pedidas: usuarios.length, conDatos: resultados.length, sinDatos: sinDatos.length });

    const guardados = await this.prisma.marketingProspecto.findMany({ where: { usuario: { in: resultados.map((r) => r.usuario) } }, select: { usuario: true, estado: true } });
    const estadoDe = new Map(guardados.map((g) => [g.usuario, g.estado]));
    return {
      lote: { id: lote.id, createdAt: lote.createdAt },
      conDatos: resultados.length,
      sinDatos,
      resumen: resultados
        .map((r) => ({ usuario: r.usuario, puntaje: r.evaluacion.puntaje, nivel: r.evaluacion.nivel, subrubro: r.evaluacion.subrubro, estado: estadoDe.get(r.usuario) ?? 'NUEVO' }))
        .sort((a, b) => (b.puntaje ?? -1) - (a.puntaje ?? -1)),
      aviso: interrumpido ? `${interrumpido}. Se guardaron las ${resultados.length} cuentas consultadas hasta ahí.` : null,
    };
  }

  async listarLotes() {
    const lotes = await this.prisma.marketingProspeccionLote.findMany({ orderBy: { createdAt: 'desc' }, take: 30 });
    const todos = [...new Set(lotes.flatMap((l) => l.usuarios))];
    const prospectos = todos.length
      ? await this.prisma.marketingProspecto.findMany({ where: { usuario: { in: todos } }, select: { usuario: true, evaluacion: true, analizadoAt: true } })
      : [];
    const porUsuario = new Map(prospectos.map((p) => [p.usuario, p]));
    return lotes.map((l) => {
      const niveles: Record<string, number> = {};
      let analizadas = 0;
      for (const u of l.usuarios) {
        const p = porUsuario.get(u);
        if (!p) continue;
        const nivel = (p.evaluacion as unknown as Evaluacion).nivel;
        niveles[nivel] = (niveles[nivel] ?? 0) + 1;
        if (p.analizadoAt) analizadas++;
      }
      return { id: l.id, createdAt: l.createdAt, creadoPor: l.creadoPor, cuentas: l.usuarios.length, sinDatos: (l.sinDatos as unknown[]).length, niveles, analizadas };
    });
  }

  private async lote(id: string) {
    if (!ID_LOTE.test(id)) throw new BadRequestException('Identificador de lote inválido');
    const lote = await this.prisma.marketingProspeccionLote.findUnique({ where: { id } });
    if (!lote) throw new NotFoundException('No existe ese lote');
    return lote;
  }

  async obtenerLote(id: string) {
    const lote = await this.lote(id);
    const prospectos = await this.prisma.marketingProspecto.findMany({ where: { usuario: { in: lote.usuarios } } });
    prospectos.sort((a, b) => ((b.evaluacion as unknown as Evaluacion).puntaje ?? -1) - ((a.evaluacion as unknown as Evaluacion).puntaje ?? -1));
    return { id: lote.id, createdAt: lote.createdAt, versionCriterio: lote.versionCriterio, sinDatos: lote.sinDatos, prospectos };
  }

  /**
   * Lo que lee Claude por el conector: el lote acotado (nivel, cuentas, tope) y con las publicaciones recortadas,
   * para no llenarle la ventana de contexto. Incluye la guía de mensajes.
   */
  async obtenerLoteParaClaude(id: string, filtros: { niveles?: string[]; usuarios?: string[]; limite?: number } = {}) {
    const lote = await this.obtenerLote(id);
    let lista = lote.prospectos;
    if (filtros.niveles?.length) lista = lista.filter((p) => filtros.niveles!.includes((p.evaluacion as unknown as Evaluacion).nivel));
    if (filtros.usuarios?.length) {
      const quiero = new Set(normalizarUsuarios(filtros.usuarios));
      lista = lista.filter((p) => quiero.has(p.usuario));
    }
    const total = lista.length;
    const tope = Math.min(Math.max(Math.trunc(filtros.limite ?? 10), 1), 30);
    return {
      lote: lote.id,
      versionCriterio: lote.versionCriterio,
      devueltas: Math.min(total, tope),
      totalQueCumple: total,
      sinDatos: lote.sinDatos,
      prospectos: lista.slice(0, tope).map((p) => {
        const datos = p.datos as unknown as DatosProspecto;
        return {
          usuario: p.usuario,
          estado: p.estado,
          datos: { ...datos, ultimasPublicaciones: datos.ultimasPublicaciones.slice(0, 8).map((x) => ({ ...x, texto: recortarTexto(x.texto, 200) })) },
          evaluacion: p.evaluacion,
          analisisPrevio: p.analisis ?? null,
        };
      }),
      guiaDeMensajes: GUIA_DE_MENSAJES,
    };
  }

  async listarProspectos(filtros: { estado?: string; nivel?: string; q?: string; limite?: number } = {}) {
    const where: Prisma.MarketingProspectoWhereInput = {};
    if (filtros.estado && (ESTADOS as readonly string[]).includes(filtros.estado)) where.estado = filtros.estado;
    if (filtros.nivel && NIVELES_OK.includes(filtros.nivel)) where.evaluacion = { path: ['nivel'], equals: filtros.nivel };
    const q = filtros.q ? normalizarUsuario(filtros.q) : null;
    if (q) where.usuario = { contains: q };
    return this.prisma.marketingProspecto.findMany({ where, orderBy: { ultimaConsultaAt: 'desc' }, take: Math.min(Math.max(Math.trunc(filtros.limite ?? 50), 1), 200) });
  }

  async actualizarProspecto(adminId: string, id: string, cambios: { estado?: string; notas?: string | null; responsableId?: string | null }) {
    const actual = await this.prisma.marketingProspecto.findUnique({ where: { id }, select: { id: true, usuario: true, estado: true } });
    if (!actual) throw new NotFoundException('No existe ese prospecto');
    if (cambios.estado !== undefined && !(ESTADOS as readonly string[]).includes(cambios.estado)) throw new BadRequestException('Estado inválido');
    const data: Prisma.MarketingProspectoUpdateInput = {};
    if (cambios.estado !== undefined) data.estado = cambios.estado;
    if (cambios.notas !== undefined) data.notas = cambios.notas;
    if (cambios.responsableId !== undefined) data.responsableId = cambios.responsableId;
    const actualizado = await this.prisma.marketingProspecto.update({ where: { id }, data });
    await this.registrar(adminId, 'prospeccion_actualizar', id, { usuario: actual.usuario, antes: actual.estado, ...cambios });
    return actualizado;
  }

  /** Valida y guarda el análisis que hizo Claude de las cuentas de un lote. */
  async guardarAnalisis(adminId: string, loteId: string, items: unknown[]) {
    const lote = await this.lote(loteId);
    if (!Array.isArray(items) || !items.length) throw new BadRequestException('El análisis tiene que ser una lista con al menos un elemento');
    if (items.length > 30) throw new BadRequestException('Máximo 30 cuentas por vez');
    const conocidos = new Set(lote.usuarios);
    const etiquetas = new Set(SUBRUBROS.map((s) => s.etiqueta));
    const limpios: AnalisisProspecto[] = items.map((crudo, i) => {
      const a = (crudo ?? {}) as Record<string, unknown>;
      const u = normalizarUsuario(a.usuario);
      if (!u || !conocidos.has(u)) throw new BadRequestException(`Elemento ${i + 1}: la cuenta «${String(a.usuario)}» no está en el lote`);
      if (!NIVELES_OK.includes(String(a.nivel_final))) throw new BadRequestException(`Elemento ${i + 1} (@${u}): nivel_final tiene que ser A, B, C o D`);
      if (a.confianza !== undefined && !CONFIANZA_OK.includes(String(a.confianza))) throw new BadRequestException(`Elemento ${i + 1} (@${u}): confianza tiene que ser alta, media o baja`);
      const mensaje = String(a.mensaje_sugerido ?? '');
      if (mensaje.length > 700) throw new BadRequestException(`Elemento ${i + 1} (@${u}): el mensaje es demasiado largo (máximo 700 caracteres)`);
      return {
        usuario: u,
        subrubro: etiquetas.has(String(a.subrubro)) ? String(a.subrubro) : String(a.subrubro ?? 'No detectado').slice(0, 80),
        confianza: (a.confianza as AnalisisProspecto['confianza']) ?? 'media',
        vende_productos: typeof a.vende_productos === 'boolean' ? a.vende_productos : null,
        canal_venta: String(a.canal_venta ?? '').slice(0, 120),
        senales_dolor: (Array.isArray(a.senales_dolor) ? a.senales_dolor : []).slice(0, 8).map((s) => String(s).slice(0, 160)),
        nivel_final: a.nivel_final as AnalisisProspecto['nivel_final'],
        motivo: String(a.motivo ?? '').slice(0, 300),
        angulo: String(a.angulo ?? '').slice(0, 200),
        mensaje_sugerido: mensaje,
      };
    });
    const ahora = new Date();
    await this.prisma.$transaction(
      limpios.map((a) =>
        this.prisma.marketingProspecto.update({ where: { usuario: a.usuario }, data: { analisis: a as unknown as Prisma.InputJsonValue, analizadoPor: adminId, analizadoAt: ahora } }),
      ),
    );
    await this.registrar(adminId, 'prospeccion_analisis', loteId, { cuentas: limpios.length });
    return { guardadas: limpios.length };
  }

  private async registrar(adminId: string, action: string, targetId: string, details: Record<string, unknown>) {
    try {
      await this.prisma.platformAdminLog.create({ data: { adminId, action, targetType: 'prospeccion', targetId, details: details as Prisma.InputJsonValue } });
    } catch (e) {
      // El registro no puede tirar abajo la acción: ya se hizo.
      this.logger.warn(`No se pudo registrar ${action}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
}
