// Teléfono normalizado (CONTRATO § 0 "Teléfono"): solo dígitos, sin el +54,
// el 9 de celular internacional ni el 0 del área. La versión oficial
// (`normalizarTelefono`, con el 15) la crea P2 en src/appointments/; esta es
// la mínima que necesita Avanzado para buscar fichas sin depender de ese
// archivo. Cuando exista, reemplazar el import.
export function normalizarTelefonoBasico(valor: string | null | undefined): string {
  let d = (valor ?? '').replace(/\D/g, '');
  if (d.startsWith('54') && d.length > 10) d = d.slice(2);
  if (d.startsWith('9') && d.length === 11) d = d.slice(1);
  if (d.startsWith('0')) d = d.slice(1);
  return d;
}

/** Teléfono tapado para quien no tiene appointments.clients.contact (CONTRATO § 0). */
export const taparTelefono = (telefono: string): string => telefono.replace(/\d(?=(?:\D*\d){2})/g, '•');
