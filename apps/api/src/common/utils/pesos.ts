// Los templates de mail imprimen los montos tal cual llegan (no saben
// formatear), así que se mandan ya escritos en pesos: $12.500 y no 12500.
export function fmtPesos(n: number): string {
  return `$${n.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}
