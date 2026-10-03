// `code` y `accessToken` de una inscripción (CONTRATO § 1.5).
//
// - code: 6 caracteres sin 0/O/1/I. Único por negocio entre `appointments` Y
//   `appointment_class_enrollments`: quien lo genera mira las dos tablas, y
//   además se reintenta ante un P2002 (dos altas simultáneas con el mismo).
// - accessToken: 32 bytes aleatorios en base64url (43 caracteres). Es el
//   secreto del enlace personal: no se loguea, no va a auditoría y no se
//   devuelve en ningún endpoint del panel.
import { randomBytes } from 'crypto';
import { Prisma } from '@prisma/client';

export const ALFABETO_CODIGO = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function nuevoCodigo(largo = 6): string {
  // 32 símbolos: un byte % 32 no tiene sesgo.
  return [...randomBytes(largo)].map((b) => ALFABETO_CODIGO[b % ALFABETO_CODIGO.length]).join('');
}

export const nuevoAccessToken = (): string => randomBytes(32).toString('base64url');

/** Un código que todavía no usa ningún turno ni inscripción del negocio. */
export async function codigoLibre(tx: Prisma.TransactionClient, businessId: string, intentos = 8): Promise<string> {
  for (let i = 0; i < intentos; i++) {
    const code = nuevoCodigo();
    const [turno, inscripcion] = await Promise.all([
      tx.appointment.findFirst({ where: { businessId, code }, select: { id: true } }),
      tx.appointmentClassEnrollment.findFirst({ where: { businessId, code }, select: { id: true } }),
    ]);
    if (!turno && !inscripcion) return code;
  }
  throw new Error('No se pudo generar un código libre');
}

/** ¿El error es una unique violada (P2002)? */
export const esUnicoRepetido = (err: unknown): boolean =>
  err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002';
