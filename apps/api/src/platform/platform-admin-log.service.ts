import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

// Registro en platform_admin_logs de lo que hasta ahora no dejaba rastro
// (auditoría interna, hallazgo «acciones sin registro», parte 3): el login del
// super panel, el segundo factor por mail (RBT-647) y los mails de prueba de
// la pestaña Testeo (RBT-607). Las acciones de negocio (suspender, ceder
// cortesía, admins, códigos de descuento) las sigue escribiendo
// PlatformService en línea, dentro de su propia transacción; acá van las que
// no tienen transacción y que, sobre todo, NO pueden romper el flujo que
// registran: nadie se queda afuera del super panel porque falló un insert.
//
// Reglas (las mismas que AuditService para audit_logs):
// - Registrar nunca rompe la acción: si falla la escritura queda en el log del
//   servidor y el login / el mail siguen su curso.
// - Sin secretos: ni contraseñas ni el VALOR del código de segundo factor — el
//   código se referencia por el id de su fila en platform_admin_login_codes.
//   Cualquier clave del detalle que huela a secreto se descarta aunque
//   alguien la pase por error.
// - `action` es un String libre en PlatformAdminLog (no un enum de Prisma),
//   así que sumar acciones no pide migración. Las etiquetas para el panel
//   viven en apps/web/src/modules/superadmin/ui.tsx (ACTION_LABELS).
//
// Vive en platform (es la tabla del super panel) pero lo consume AuthService,
// que es quien sabe si la contraseña o el código fueron válidos. Por eso no
// importa NADA de src/auth: la dependencia va en un solo sentido.

// user-agent + IP del request. Misma forma que el DeviceInfo que arma
// AuthController para las sesiones activas (RBT-631), redeclarada acá para no
// depender de auth.
export interface OrigenRequest {
  ip?: string;
  userAgent?: string;
}

export type ViaLogin = 'password' | 'google';
export type MotivoLoginFallido = 'password' | 'bloqueado';
export type ResultadoSegundoFactor = 'enviado' | 'verificado' | 'fallido' | 'bloqueado';
// Por qué se rechazó un código (solo cuando el resultado es 'fallido').
export type MotivoSegundoFactor = 'incorrecto' | 'vencido' | 'sin_codigo' | 'admin_inactivo';

// Nombres de las acciones tal como quedan en platform_admin_logs. Exportados
// para que el spec y el hook desde AuthService no repitan strings sueltos.
export const ACCION_LOG_ADMIN = {
  loginOk: 'login_ok',
  loginFallido: 'login_failed',
  segundoFactor: {
    enviado: 'mfa_code_sent',
    verificado: 'mfa_code_verified',
    fallido: 'mfa_code_failed',
    bloqueado: 'mfa_code_blocked',
  },
  mailPrueba: 'send_mail_test',
} as const;

// `codeId` es un id, no un secreto: la regex mira la clave entera para no
// tirarlo junto con `code` / `codigo`, que sí serían el valor del código.
const CLAVES_SENSIBLES = /pass|hash|token|secret|cvv|^code$|^codigo$/i;
const MAX_USER_AGENT = 256;

interface EntradaLogAdmin {
  adminId: string;
  action: string;
  targetType: string;
  targetId: string;
  details?: Record<string, unknown>;
}

@Injectable()
export class PlatformAdminLogService {
  private readonly logger = new Logger(PlatformAdminLogService.name);

  constructor(private readonly prisma: PrismaService) {}

  // Login del super panel con el primer factor válido (contraseña o Google).
  // No hay sesión todavía: la emite el segundo factor (ver segundoFactor).
  async loginOk(e: { adminId: string; via: ViaLogin } & OrigenRequest): Promise<void> {
    await this.registrar({
      adminId: e.adminId,
      action: ACCION_LOG_ADMIN.loginOk,
      targetType: 'platform_admin',
      targetId: e.adminId,
      details: { via: e.via, ...this.origen(e) },
    });
  }

  // Contraseña incorrecta o cuenta bloqueada por intentos. El mail va en
  // minúsculas (es lo que se tipeó, no lo que hay en la base) y la
  // contraseña NUNCA.
  //
  // PlatformAdminLog.adminId es NOT NULL con FK a platform_admins: un intento
  // contra un mail que no es de ningún admin no se puede guardar acá sin una
  // migración (adminId nullable). Queda en el log del servidor con el mail y
  // la IP, que es lo que hace falta para rastrear fuerza bruta.
  async loginFallido(e: { adminId?: string | null; email: string; motivo: MotivoLoginFallido } & OrigenRequest): Promise<void> {
    const email = e.email.trim().toLowerCase();
    if (!e.adminId) {
      this.logger.warn(`Login de super panel rechazado (${e.motivo}) para ${email} sin admin asociado — ip ${e.ip ?? '?'}`);
      return;
    }
    await this.registrar({
      adminId: e.adminId,
      action: ACCION_LOG_ADMIN.loginFallido,
      targetType: 'platform_admin',
      targetId: e.adminId,
      details: { email, motivo: e.motivo, ...this.origen(e) },
    });
  }

  // Segundo factor (RBT-647): enviado al crear el código, verificado al emitir
  // la sesión, fallido si el código no sirve (con el motivo), bloqueado cuando
  // se agotaron los intentos. `codeId` es el id de la fila del código, nunca
  // el código en sí.
  async segundoFactor(
    e: { adminId?: string | null; email?: string; resultado: ResultadoSegundoFactor; codeId?: string | null; motivo?: MotivoSegundoFactor } & OrigenRequest,
  ): Promise<void> {
    if (!e.adminId) {
      // Mismo límite del schema que en loginFallido: sin admin no hay fila.
      this.logger.warn(
        `Segundo factor ${e.resultado}${e.motivo ? ` (${e.motivo})` : ''} para ${e.email?.trim().toLowerCase() ?? '?'} sin admin asociado — ip ${e.ip ?? '?'}`,
      );
      return;
    }
    await this.registrar({
      adminId: e.adminId,
      action: ACCION_LOG_ADMIN.segundoFactor[e.resultado],
      targetType: 'platform_admin',
      targetId: e.adminId,
      details: { codeId: e.codeId ?? undefined, motivo: e.motivo, ...this.origen(e) },
    });
  }

  // Mail de prueba desde la pestaña Testeo (RBT-607): qué plantilla, a quién
  // y si salió. Antes solo quedaba en email_logs, sin quién lo mandó.
  async mailPrueba(e: { adminId: string; template: string; to: string; sent: boolean; error?: string }): Promise<void> {
    await this.registrar({
      adminId: e.adminId,
      action: ACCION_LOG_ADMIN.mailPrueba,
      targetType: 'mail_template',
      targetId: e.template,
      details: { to: e.to.trim().toLowerCase(), sent: e.sent, error: e.error },
    });
  }

  private origen(e: OrigenRequest): { ip?: string; userAgent?: string } {
    return {
      ip: e.ip || undefined,
      userAgent: e.userAgent ? e.userAgent.slice(0, MAX_USER_AGENT) : undefined,
    };
  }

  // Única escritura: filtra claves sensibles y valores vacíos, y se traga el
  // error (queda en el log del servidor) para no romper lo que registra.
  private async registrar(entrada: EntradaLogAdmin): Promise<void> {
    try {
      const details = Object.fromEntries(
        Object.entries(entrada.details ?? {}).filter(([k, v]) => !CLAVES_SENSIBLES.test(k) && v !== undefined && v !== null && v !== ''),
      ) as Prisma.InputJsonObject;
      await this.prisma.platformAdminLog.create({
        data: {
          adminId: entrada.adminId,
          action: entrada.action,
          targetType: entrada.targetType,
          targetId: entrada.targetId,
          details: Object.keys(details).length > 0 ? details : undefined,
        },
      });
    } catch (err) {
      this.logger.error(
        `No se pudo registrar ${entrada.action} ${entrada.targetType} ${entrada.targetId} (admin ${entrada.adminId}): ${err instanceof Error ? err.message : err}`,
      );
    }
  }
}
