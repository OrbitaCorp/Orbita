// Teléfonos de Turnos (CONTRATO.md § 0, "Teléfono").
//
// OJO: el contrato ubica `normalizarTelefono()` en src/appointments/ y dice que
// la crea P2. Mientras P2 no esté, el panel (P1) usa esta copia local; cuando
// exista la de P2, unificar en una sola.

/**
 * Solo dígitos, sin el +54, sin el 9 de los celulares internacionales, sin el
 * 0 del área ni el 15: 10 dígitos para un celular argentino. Lo que no se
 * reconoce como argentino queda en dígitos tal cual.
 */
export function normalizarTelefono(valor: string): string {
  let d = valor.replace(/\D/g, '');
  if (d.startsWith('54') && d.length >= 12) d = d.slice(2);
  if (d.startsWith('9') && d.length === 11) d = d.slice(1);
  if (d.startsWith('0')) d = d.slice(1);
  // "11 15 5555 0101": el 15 va después del código de área (2 a 4 dígitos).
  if (d.length === 12) {
    for (const area of [2, 3, 4]) {
      if (d.slice(area, area + 2) === '15') return d.slice(0, area) + d.slice(area + 2);
    }
  }
  return d;
}

/** Quedan los dos últimos dígitos (misma regla que la demo: taparTelefono). */
export const taparTelefono = (telefono: string): string => telefono.replace(/\d(?=(?:\D*\d){2})/g, '•');
