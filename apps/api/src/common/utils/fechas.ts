// Suma años calendario a una fecha, en UTC y conservando la hora. Si la fecha es
// un 29/02 y el año de destino no es bisiesto, queda el 28/02, que es lo que
// hacen los registradores de dominios. Date.setUTCFullYear solo la desborda al
// 01/03 y deja el vencimiento un día más tarde que el real.
export function sumarAniosCalendario(fecha: Date, anios: number): Date {
  const resultado = new Date(fecha.getTime());
  const mes = resultado.getUTCMonth();
  resultado.setUTCFullYear(resultado.getUTCFullYear() + anios);
  if (resultado.getUTCMonth() !== mes) resultado.setUTCDate(0);
  return resultado;
}
