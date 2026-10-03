import { randomInt } from 'crypto';

// Códigos que ve la gente (gift cards, cupones de "Recuperar clientes").
// Alfabeto de CONTRATO § 1.5: sin 0/O/1/I para que no se confundan al
// dictarlos. `randomInt` es criptográfico: el código de una gift card ES la
// plata, no puede ser adivinable ni secuencial. 10 caracteres de 32 símbolos
// son 2^50 combinaciones; el endpoint público que la consulta además tiene
// throttle (10/min).
export const ALFABETO_CODIGOS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function codigoAleatorio(largo: number): string {
  let s = '';
  for (let i = 0; i < largo; i++) s += ALFABETO_CODIGOS[randomInt(ALFABETO_CODIGOS.length)];
  return s;
}

/** Lo que tipea la gente, normalizado: mayúsculas, sin espacios ni guiones. */
export const normalizarCodigo = (v: string): string => v.toUpperCase().replace(/[\s-]/g, '');

export const LARGO_GIFT_CARD = 10;
export const LARGO_CUPON = 8;

/** ¿Es un P2002 (unique) de Prisma? Lo usan los reintentos de código repetido. */
export function esUnicoRepetido(err: unknown): boolean {
  return !!err && typeof err === 'object' && (err as { code?: string }).code === 'P2002';
}
