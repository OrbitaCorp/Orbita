import { OrbiSurface } from '../../dto/orbi-chat.dto';
import type { OrbiTool, ToolExecutionContext, ToolResult } from '../tool.interface';
import type { LlmToolDefinition } from '../../llm/llm-adapter.interface';
import type { BusinessesService } from '../../../businesses/businesses.service';
import type { PrismaService } from '../../../prisma/prisma.service';
import { MANUAL, rutaDeDestino } from '../../manual/manual';
import { rutaDelPanel } from '../../navegacion/ruta';
import { CODIGOS_DEL_CATALOGO, PERMISSIONS } from '../../../common/permisos/catalogo';

// Las dos tools que contestan con el ESTADO REAL del negocio lo que el manual
// solo puede contestar en general (spec 2026-09-30-orbi-base-de-conocimiento,
// §3.4): "¿qué me falta para publicar?" y "¿por qué mi empleado no ve X?".
// Las dos son de solo lectura y van acotadas al negocio del token.

/**
 * Pasos del checklist que la base no puede detectar: mirar una pantalla no
 * deja rastro (ver BusinessesService#getTutorial). Cuentan como hechos solo si
 * la persona los tildó a mano (tutorial.hechas).
 */
export const PASOS_SIN_RASTRO = new Set(['herramientas', 'reportes', 'plan']);

/** Pasos que no hacen falta para vender: no se usan para el botón de "¿qué me falta?". */
const PASOS_OPCIONALES = new Set(['mp', 'verificar-email']);

const RUTA_SUSCRIPCION = rutaDelPanel('configuracion', 'suscripcion');
const RUTA_SOPORTE = rutaDelPanel('configuracion', 'soporte');
const RUTA_ZONA_PELIGROSA = rutaDelPanel('configuracion', 'peligro');

/** Por HTTP, la suscripción y publicar son `@Roles('owner','admin')`. */
const VE_LA_CUENTA = new Set(['owner', 'admin']);

/**
 * `paraAdmin`: lo que se le dice al admin cuando lo resuelve SOLO el
 * propietario. Pausar/reactivar la tienda y dar de baja/recuperar el espacio
 * son `@Roles('owner')`: mandarlo al botón sería mandarlo a un 403.
 */
type Bloqueante = { motivo: string; irA?: { label: string; path: string }; paraAdmin?: string };

export class EstadoPrimerosPasosTool implements OrbiTool {
  name = 'estadoPrimerosPasos';
  description =
    'Ver qué le falta al negocio para salir a vender y qué pasos de los Primeros pasos del Inicio ya cumplió, con el estado real. ' +
    'Usalo para "¿qué me falta para publicar?", "¿qué me queda por configurar?" o "¿por qué no puedo publicar?".';
  surfaces = [OrbiSurface.PANEL];
  // "Ver dashboard": el checklist de Primeros pasos es del Inicio. Por HTTP
  // (GET /businesses/tutorial) lo lee cualquier miembro, pero toda tool que
  // lee datos del negocio pide un permiso (invariante 3 de tool-catalog.spec):
  // se elige el de la pantalla donde vive, en vez de abrirle una excepción.
  // Un Empleado por defecto no lo tiene; configurar y publicar es del dueño.
  requiredPermissions = ['reports.dashboard'];
  parameters = { type: 'object', properties: {} };

  constructor(
    private readonly businesses: BusinessesService,
    private readonly prisma: PrismaService,
  ) {}

  toLlmDefinition(): LlmToolDefinition {
    return { name: this.name, description: this.description, parameters: this.parameters };
  }

  /**
   * Lo único que de verdad impide vender. `isPaused` lo usan tres causas
   * (suspension.ts: "el campo solo no distingue 'la pausé yo' de 'me la
   * bajaron'"), así que se pregunta cuál: decirle "debés un pago" a quien la
   * pausó a propósito sería mentirle.
   */
  private async bloqueante(
    businessId: string,
    negocio: { isActive: boolean; isPaused: boolean; cancelledAt: Date | null } | null,
    conSuscripcion: boolean,
  ): Promise<Bloqueante | undefined> {
    if (negocio?.isPaused) {
      const suspension = await this.businesses.suspensionVigente(businessId);
      if (suspension === 'PLATAFORMA') return { motivo: 'La tienda está suspendida por Órbita. Se reactiva escribiendo a Soporte.', irA: { label: 'Abrir Soporte', path: RUTA_SOPORTE } };
      // La baja del espacio también pausa y deja la suscripción en CANCELLED:
      // sin este caso, suspensionVigente diría MORA ("debés un pago") a quien
      // se dio de baja él mismo (SubscriptionsService, baja del negocio).
      if (negocio.cancelledAt) {
        return {
          motivo: 'El espacio está dado de baja: la tienda no se ve. Dentro de los 60 días se recupera con "Reactivar espacio" en Configuración → Zona peligrosa.',
          irA: { label: 'Abrir Zona peligrosa', path: RUTA_ZONA_PELIGROSA },
          paraAdmin: 'El espacio está dado de baja: la tienda no se ve. Dentro de los 60 días lo puede recuperar el propietario.',
        };
      }
      if (suspension === 'MORA') return { motivo: 'La tienda está suspendida por un pago pendiente de la suscripción.', irA: { label: 'Abrir Suscripción', path: RUTA_SUSCRIPCION } };
      return {
        motivo: 'La tienda está pausada desde el panel. Se reactiva con "Reactivar tienda" en Configuración → Zona peligrosa.',
        irA: { label: 'Abrir Zona peligrosa', path: RUTA_ZONA_PELIGROSA },
        paraAdmin: 'La tienda está pausada desde el panel. La reactiva el propietario.',
      };
    }
    if (!negocio?.isActive && !conSuscripcion) {
      return { motivo: 'Para publicar la tienda falta activar la suscripción.', irA: { label: 'Abrir Suscripción', path: RUTA_SUSCRIPCION } };
    }
    return undefined;
  }

  async execute(_args: Record<string, unknown>, ctx: ToolExecutionContext): Promise<ToolResult> {
    const label = 'Primeros pasos';
    try {
      const [{ tutorial, cumplidas }, suscripcion, negocio, miembro] = await Promise.all([
        this.businesses.getTutorial(ctx.businessId),
        // Mismo gate que BusinessesService#publish: sin fila de suscripción no
        // se puede publicar.
        this.prisma.subscription.findUnique({ where: { businessId: ctx.businessId }, select: { id: true } }),
        this.prisma.business.findUnique({ where: { id: ctx.businessId }, select: { isActive: true, isPaused: true, cancelledAt: true } }),
        this.prisma.member.findFirst({ where: { id: ctx.userId, businessId: ctx.businessId }, select: { emailVerified: true } }),
      ]);

      const publicada = !!negocio?.isActive && !negocio.isPaused;
      const bloqueante = await this.bloqueante(ctx.businessId, negocio, !!suscripcion);
      // La suscripción y su estado son de propietario/admin por HTTP: a otro
      // rol no se le cuenta el detalle, solo que hay algo que resolver. Al
      // admin, lo que es solo del propietario se le dice sin botón.
      const rol = ctx.roleName ?? '';
      let bloqueanteVisible: Bloqueante | undefined;
      if (!bloqueante || rol === 'owner') bloqueanteVisible = bloqueante;
      else if (VE_LA_CUENTA.has(rol)) bloqueanteVisible = bloqueante.paraAdmin ? { motivo: bloqueante.paraAdmin } : bloqueante;
      else bloqueanteVisible = { motivo: 'Hay algo de la cuenta de la tienda que tiene que resolver el propietario.' };

      // Lo que la base detecta, más lo que la persona tildó a mano en la tarjeta.
      const hechos = new Set([...cumplidas, ...(tutorial?.hechas ?? [])]);
      if (miembro?.emailVerified) hechos.add('verificar-email');

      const pendientes = MANUAL.primerosPasos
        .filter((p) => !hechos.has(p.id))
        .map((p) => ({ id: p.id, titulo: p.titulo, etapa: p.etapa, irA: { label: p.destino.label, path: rutaDeDestino(p.destino) } }))
        // Etapa 1 primero: son los pasos para salir a vender.
        .sort((a, b) => a.etapa - b.etapa);
      const sinDatos = MANUAL.primerosPasos.filter((p) => PASOS_SIN_RASTRO.has(p.id) && !hechos.has(p.id)).map((p) => p.titulo);

      // El botón: el bloqueante, o el primer paso que de verdad hace falta.
      const siguiente = pendientes.find((p) => !PASOS_OPCIONALES.has(p.id) && !PASOS_SIN_RASTRO.has(p.id));
      const primero = bloqueanteVisible?.irA ?? siguiente?.irA;
      return {
        success: true,
        label: primero?.label ?? label,
        data: {
          publicada,
          ...(bloqueanteVisible ? { bloqueante: bloqueanteVisible.motivo } : {}),
          pendientes: pendientes.filter((p) => !PASOS_SIN_RASTRO.has(p.id)).map(({ titulo, etapa, irA }) => ({ titulo, etapa, irA })),
          cumplidos: MANUAL.primerosPasos.length - pendientes.length,
          total: MANUAL.primerosPasos.length,
          ...(sinDatos.length ? { noSePuedenVerificar: sinDatos } : {}),
          ...(primero ? { path: primero.path } : {}),
        },
      };
    } catch {
      return { success: false, error: 'No pude leer el estado de los primeros pasos.', label };
    }
  }
}

const ETIQUETA_DEL_PERMISO = new Map(PERMISSIONS.map((p) => [p.code, p.label]));

/** Los roles por defecto con el nombre que muestra la pantalla de Equipo; los personalizados, tal cual. */
// "admin" ya no se crea, pero los negocios viejos lo tienen: la pantalla de
// Equipo lo muestra como Propietario (Equipo.tsx).
const NOMBRE_DEL_ROL: Record<string, string> = { owner: 'Propietario', admin: 'Propietario', empleado: 'Empleado' };

/** Qué módulos del menú ve alguien con esos permisos, y qué le falta para los demás. */
export function accesoPorModulo(permisos: string[], esDueno: boolean) {
  const ve: string[] = [];
  const noVe: { modulo: string; leFalta: string[] }[] = [];
  for (const m of MANUAL.modulosDelMenu) {
    // Mismo criterio que el Sidebar: alcanza con UNO; sin lista lo ve cualquiera.
    if (esDueno || !m.permisos.length || m.permisos.some((p) => permisos.includes(p))) ve.push(m.label);
    else noVe.push({ modulo: m.label, leFalta: m.permisos.map((p) => ETIQUETA_DEL_PERMISO.get(p) ?? p) });
  }
  return { ve, noVe };
}

export class AccesoDelEquipoTool implements OrbiTool {
  name = 'accesoDelEquipo';
  description =
    'Ver qué secciones del menú puede ver una persona del equipo según su rol real, y qué permiso le falta para las demás. ' +
    'Sin "persona", habla de quien pregunta. Usalo para "¿por qué mi empleado no ve Descuentos?" o "¿qué puede ver Carlos?".';
  surfaces = [OrbiSurface.PANEL];
  // El permiso de la pantalla de Equipo. El Empleado por defecto lo tiene, así
  // que "¿por qué no veo Descuentos?" funciona para el caso común. Un rol
  // personalizado sin "Ver equipo" no tiene la tool: Orbi le explica en
  // general desde el tema "permisos" del manual.
  requiredPermissions = ['config.team.view'];
  parameters = {
    type: 'object',
    properties: {
      persona: { type: 'string', description: 'Nombre o email de la persona del equipo (opcional; sin esto, quien pregunta)' },
    },
  };

  constructor(private readonly prisma: PrismaService) {}

  toLlmDefinition(): LlmToolDefinition {
    return { name: this.name, description: this.description, parameters: this.parameters };
  }

  async execute(args: Record<string, unknown>, ctx: ToolExecutionContext): Promise<ToolResult> {
    const label = 'Accesos del equipo';
    const persona = typeof args.persona === 'string' ? args.persona.trim().slice(0, 60) : '';

    if (!persona) {
      // El dueño recibe el catálogo completo en ctx.permissions (permisosDeOrbi).
      const esDueno = CODIGOS_DEL_CATALOGO.every((c) => ctx.permissions.includes(c));
      return { success: true, label, data: { persona: 'vos', ...accesoPorModulo(ctx.permissions, esDueno) } };
    }

    if (persona.length < 2) {
      return { success: false, error: 'Decime el nombre o el email de la persona.', label };
    }

    try {
      const select = {
        name: true,
        status: true,
        role: { select: { name: true, rolePermissions: { select: { permission: { select: { code: true } } } } } },
      } as const;
      // SIEMPRE dentro del negocio del token: un nombre de otro negocio no
      // existe. Primero la coincidencia exacta (nombre o email, sin mayúsculas):
      // con una búsqueda parcial con tope, "Ana" podía quedar afuera detrás de
      // seis "Juliana", "Mariana"…
      const exactas = await this.prisma.member.findMany({
        where: {
          businessId: ctx.businessId,
          OR: [{ name: { equals: persona, mode: 'insensitive' } }, { email: { equals: persona, mode: 'insensitive' } }],
        },
        select,
        orderBy: { name: 'asc' },
        take: 6,
      });
      const miembros = exactas.length
        ? exactas
        : await this.prisma.member.findMany({
            where: {
              businessId: ctx.businessId,
              OR: [
                { name: { contains: persona, mode: 'insensitive' } },
                { email: { contains: persona, mode: 'insensitive' } },
              ],
            },
            select,
            orderBy: { name: 'asc' },
            take: 6,
          });

      if (!miembros.length) {
        return { success: false, error: `No encontré a nadie del equipo que se llame "${persona}".`, label };
      }
      if (miembros.length > 1) {
        // Ambiguo: que la persona elija, sin adivinar. Con el rol, para
        // distinguir a dos que se llaman igual.
        return {
          success: true,
          label,
          data: { ambiguo: true, coincidencias: miembros.slice(0, 5).map((m) => `${m.name} (${NOMBRE_DEL_ROL[m.role.name] ?? m.role.name})`) },
        };
      }

      const m = miembros[0];
      const esDueno = m.role.name === 'owner';
      const permisos = m.role.rolePermissions.map((rp) => rp.permission.code);
      return {
        success: true,
        // Es lo que dice el botón "Ir a…" que dibuja el front con `path`.
        label: 'Abrir Equipo',
        data: {
          persona: m.name,
          rol: NOMBRE_DEL_ROL[m.role.name] ?? m.role.name,
          ...(m.status === 'PENDING' ? { invitacionPendiente: true } : {}),
          ...accesoPorModulo(permisos, esDueno),
          path: rutaDelPanel('configuracion', 'equipo'),
        },
      };
    } catch {
      return { success: false, error: 'No pude leer los roles del equipo.', label };
    }
  }
}
