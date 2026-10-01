import { OrbiSurface } from '../../dto/orbi-chat.dto';
import type { OrbiTool, ToolExecutionContext, ToolResult } from '../tool.interface';
import type { LlmToolDefinition } from '../../llm/llm-adapter.interface';
import type { BusinessesService } from '../../../businesses/businesses.service';
import type { PrismaService } from '../../../prisma/prisma.service';
import { MANUAL, rutaDeDestino } from '../../manual/manual';
import { CODIGOS_DEL_CATALOGO, PERMISSIONS } from '../../../common/permisos/catalogo';

// Las dos tools que contestan con el ESTADO REAL del negocio lo que el manual
// solo puede contestar en general (spec 2026-09-30-orbi-base-de-conocimiento,
// §3.4): "¿qué me falta para publicar?" y "¿por qué mi empleado no ve X?".
// Las dos son de solo lectura y van acotadas al negocio del token.

/**
 * Pasos del checklist que la base no puede detectar: mirar una pantalla no
 * deja rastro (ver BusinessesService#getTutorial). `verificar-email` sí se
 * detecta, pero de quien pregunta, no del negocio: se resuelve aparte.
 */
const PASOS_SIN_RASTRO = new Set(['herramientas', 'reportes', 'plan']);

const RUTA_SUSCRIPCION = '/admin/ventas/configuracion?vista=suscripcion';

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

  async execute(_args: Record<string, unknown>, ctx: ToolExecutionContext): Promise<ToolResult> {
    const label = 'Primeros pasos';
    try {
      const [{ cumplidas }, suscripcion, negocio, miembro] = await Promise.all([
        this.businesses.getTutorial(ctx.businessId),
        // Mismo gate que BusinessesService#publish: sin fila de suscripción no
        // se puede publicar. Es el ÚNICO bloqueante real; lo demás recomienda.
        this.prisma.subscription.findUnique({ where: { businessId: ctx.businessId }, select: { id: true } }),
        this.prisma.business.findUnique({ where: { id: ctx.businessId }, select: { isActive: true, isPaused: true } }),
        this.prisma.member.findFirst({ where: { id: ctx.userId, businessId: ctx.businessId }, select: { emailVerified: true } }),
      ]);

      const publicada = !!negocio?.isActive && !negocio.isPaused;
      let bloqueante: { motivo: string; irA: { label: string; path: string } } | undefined;
      if (!publicada && !suscripcion) {
        bloqueante = {
          motivo: 'Para publicar la tienda falta activar la suscripción.',
          irA: { label: 'Abrir Suscripción', path: RUTA_SUSCRIPCION },
        };
      } else if (negocio?.isPaused) {
        bloqueante = {
          motivo: 'La tienda está pausada por un pago pendiente de la suscripción.',
          irA: { label: 'Abrir Suscripción', path: RUTA_SUSCRIPCION },
        };
      }

      const hechos = new Set(cumplidas);
      if (miembro?.emailVerified) hechos.add('verificar-email');

      const detectables = MANUAL.primerosPasos.filter((p) => !PASOS_SIN_RASTRO.has(p.id));
      const pendientes = detectables
        .filter((p) => !hechos.has(p.id))
        .map((p) => ({ titulo: p.titulo, etapa: p.etapa, irA: { label: p.destino.label, path: rutaDeDestino(p.destino) } }));
      const sinDatos = MANUAL.primerosPasos.filter((p) => PASOS_SIN_RASTRO.has(p.id)).map((p) => p.titulo);

      const primero = bloqueante?.irA ?? pendientes[0]?.irA;
      return {
        success: true,
        label: primero?.label ?? label,
        data: {
          publicada,
          ...(bloqueante ? { bloqueante: bloqueante.motivo } : {}),
          // Etapa 1 primero: son los pasos para salir a vender.
          pendientes: [...pendientes].sort((a, b) => a.etapa - b.etapa),
          cumplidos: detectables.length - pendientes.length,
          total: detectables.length,
          noSePuedenVerificar: sinDatos,
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
const NOMBRE_DEL_ROL: Record<string, string> = { owner: 'Propietario', empleado: 'Empleado', admin: 'Administrador' };

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
      // SIEMPRE dentro del negocio del token: un nombre de otro negocio no existe.
      const miembros = await this.prisma.member.findMany({
        where: {
          businessId: ctx.businessId,
          OR: [
            { name: { contains: persona, mode: 'insensitive' } },
            { email: { contains: persona, mode: 'insensitive' } },
          ],
        },
        select: {
          name: true,
          status: true,
          role: { select: { name: true, rolePermissions: { select: { permission: { select: { code: true } } } } } },
        },
        take: 6,
      });

      if (!miembros.length) {
        return { success: false, error: `No encontré a nadie del equipo que se llame "${persona}".`, label };
      }
      if (miembros.length > 1) {
        // Ambiguo: que la persona elija, sin adivinar.
        return {
          success: true,
          label,
          data: { ambiguo: true, coincidencias: miembros.slice(0, 5).map((m) => m.name) },
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
          path: '/admin/ventas/configuracion?vista=equipo',
        },
      };
    } catch {
      return { success: false, error: 'No pude leer los roles del equipo.', label };
    }
  }
}
