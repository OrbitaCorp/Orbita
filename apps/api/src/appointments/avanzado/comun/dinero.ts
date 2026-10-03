import { Prisma } from '@prisma/client';

// Plata: Decimal(12,2) en la base, `number` en pesos en la API (CONTRATO § 0).

export const aNumero = (v: Prisma.Decimal | number | string | null | undefined): number =>
  v === null || v === undefined ? 0 : Number(v);

export const aNumeroONull = (v: Prisma.Decimal | number | string | null | undefined): number | null =>
  v === null || v === undefined ? null : Number(v);

/** Redondeo al peso (CONTRATO § 1.3: `round`). */
export const redondear = (n: number): number => Math.round(n);

/** Redondeo a centavos, para no arrastrar errores de coma flotante. */
export const centavos = (n: number): number => Math.round(n * 100) / 100;
