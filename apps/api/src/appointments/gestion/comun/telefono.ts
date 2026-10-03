// Teléfono normalizado: solo dígitos, sin el 54 del país, sin el 9 de los
// celulares en formato internacional, sin el 0 del área ni el 15 (CONTRATO § 0).
//
// OJO: el contrato dice que `normalizarTelefono()` la crea P2 en
// src/appointments/. Como los paquetes corren en paralelo, P3 lleva su copia
// acá, con la misma regla; cuando exista la de P2, este archivo tiene que
// reexportarla en vez de duplicarla.

export function normalizarTelefono(valor: string | null | undefined): string {
  let d = (valor ?? '').replace(/\D/g, '');
  if (d.length >= 12 && d.startsWith('54')) {
    d = d.slice(2);
    if (d.length === 11 && d.startsWith('9')) d = d.slice(1);
  }
  if (d.startsWith('0')) d = d.slice(1);
  // "11 15 5555 0101" → 12 dígitos con el 15 después del área (de 2 a 4 dígitos).
  if (d.length === 12) {
    for (const area of [2, 3, 4]) {
      if (d.slice(area, area + 2) === '15') return d.slice(0, area) + d.slice(area + 2);
    }
  }
  return d;
}
