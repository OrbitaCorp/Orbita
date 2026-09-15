// CUIT / CUIL argentino (hallazgo `legales-sin-cuit`, auditoría interna): 11
// dígitos: los dos primeros indican el tipo, los ocho siguientes el documento y
// el último es el verificador (módulo 11 con pesos 5 4 3 2 7 6 5 4 3 2). Se
// acepta con guiones o espacios ("30-71234567-1") y se guarda solo con los 11
// dígitos. El prefijo no se valida contra una lista a propósito: AFIP asigna
// varios y rechazar uno real es peor que aceptar uno raro con verificador válido.

const PESOS = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];

/** Saca guiones y espacios: "30-71234567-1" → "30712345671". */
export function limpiarCuit(entrada: string): string {
  return entrada.replace(/[\s-]/g, '');
}

/** true si son 11 dígitos y el verificador cierra. */
export function cuitValido(digitos: string): boolean {
  if (!/^\d{11}$/.test(digitos)) return false;
  const suma = PESOS.reduce((acc, peso, i) => acc + peso * Number(digitos[i]), 0);
  const resto = suma % 11;
  const verificador = resto === 0 ? 0 : resto === 1 ? -1 : 11 - resto;
  // resto 1 no tiene verificador posible (daría 10): esos CUIT no existen.
  return verificador === Number(digitos[10]);
}

/** "30712345678" → "30-71234567-8" para mostrar. */
export function formatearCuit(digitos: string): string {
  return `${digitos.slice(0, 2)}-${digitos.slice(2, 10)}-${digitos.slice(10)}`;
}
