import { randomBytes, randomInt } from 'node:crypto';

// Sin 0/O ni 1/I: el código se dicta por teléfono y se escribe a mano.
const ALFABETO = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/** Referencia visible de una reserva ("4F7K2Q"). Única por negocio; quien la genera reintenta si choca. */
export function generarCodigo(largo = 6): string {
  let out = '';
  for (let i = 0; i < largo; i++) out += ALFABETO[randomInt(ALFABETO.length)];
  return out;
}

/** El secreto del enlace personal (/mi-reserva/<token>): 32 caracteres url-safe, único global. */
export function generarToken(): string {
  return randomBytes(24).toString('base64url');
}

const RE_TOKEN = /^[A-Za-z0-9_-]{20,64}$/;
export const esToken = (x: unknown): x is string => typeof x === 'string' && RE_TOKEN.test(x);
