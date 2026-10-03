// Alcance de quien mira (P3): los pares de permisos `*.view` / `*.view_all`
// se resuelven acá, no en el guard. El guard (@RequirePermission) solo pide el
// código base; el `_all` decide si ve todo el negocio o solo lo propio. El
// dueño (`roleName === 'owner'`) pasa por todo, igual que en PermissionsGuard.
//
// Funciones PURAS: no tocan Prisma (las agendas propias las trae
// GestionContextoService.misAgendas).
import type { MemberContext } from '../../../common/types/auth-context.type';

export const esDueno = (m: Pick<MemberContext, 'roleName'>): boolean => m.roleName === 'owner';

/** ¿Tiene el permiso? El dueño tiene todos. */
export const tiene = (m: Pick<MemberContext, 'roleName' | 'permissions'>, codigo: string): boolean =>
  esDueno(m) || m.permissions.includes(codigo);

/**
 * Teléfono tapado: quedan los dos últimos dígitos (CONTRATO § 0). Es la misma
 * expresión que la demo (equipoDemo.ts → taparTelefono).
 */
export const taparTelefono = (telefono: string): string => telefono.replace(/\d(?=(?:\D*\d){2})/g, '•');

/**
 * Contacto de un cliente según quien mira: sin `appointments.clients.contact`
 * el teléfono va tapado y el email en null.
 */
export function contactoSegun(m: Pick<MemberContext, 'roleName' | 'permissions'>, phone: string | null, email: string | null): { phone: string; email: string | null } {
  if (tiene(m, 'appointments.clients.contact')) return { phone: phone ?? '', email };
  return { phone: taparTelefono(phone ?? ''), email: null };
}

/** Los montos marcados `number | null` en los tipos: null sin `appointments.reports.view`. */
export const montoSegun = (m: Pick<MemberContext, 'roleName' | 'permissions'>, monto: number): number | null =>
  tiene(m, 'appointments.reports.view') ? monto : null;

/** Plata de Prisma (Decimal) a pesos con dos decimales. */
export const pesos = (v: unknown): number => Math.round(Number(v ?? 0) * 100) / 100;
