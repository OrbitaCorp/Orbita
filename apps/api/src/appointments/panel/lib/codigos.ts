import { randomBytes, randomInt } from 'crypto';

// `code` y `accessToken` de un turno (CONTRATO.md § 1.5).

/** Sin 0/O ni 1/I, para que se pueda dictar por teléfono. */
export const ALFABETO_CODIGO = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/** Referencia visible ("4F7K2Q"). No autentica nada. */
export function generarCodigo(largo = 6): string {
  let codigo = '';
  for (let i = 0; i < largo; i++) codigo += ALFABETO_CODIGO[randomInt(ALFABETO_CODIGO.length)];
  return codigo;
}

/** Secreto del enlace personal: 32 bytes en base64url (43 caracteres). No se loguea ni se devuelve en el panel. */
export const generarAccessToken = (): string => randomBytes(32).toString('base64url');
