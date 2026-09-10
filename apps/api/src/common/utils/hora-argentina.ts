// Día de la semana y hora "HH:MM" en Argentina para un instante dado.
//
// El servidor corre en UTC (Cloud Run no tiene TZ configurada), así que
// `Date#getDay()`/`getHours()` dan la hora de Greenwich: un descuento "solo los
// lunes" o "de 18 a 20" que el dueño cargó pensando en su hora se aplicaba
// tres horas corrido (auditoría interna 10/09, ítem `api.discounts`). Todo lo
// que compare contra días/horarios que carga un comercio pasa por acá.
//
// Argentina no tiene horario de verano desde 2009; igual se resuelve con la
// base de zonas horarias de Intl y no con un -3 fijo.

const ZONA = 'America/Argentina/Buenos_Aires';

const formato = new Intl.DateTimeFormat('en-US', {
  timeZone: ZONA,
  weekday: 'short',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

const DIAS: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

/** `dia`: 0 = domingo … 6 = sábado (mismo criterio que `Discount.activeDays`). `hhmm`: "HH:MM" de 24 h. */
export function diaYHoraArgentina(instante: Date): { dia: number; hhmm: string } {
  const partes = Object.fromEntries(formato.formatToParts(instante).map((p) => [p.type, p.value]));
  return { dia: DIAS[partes.weekday], hhmm: `${partes.hour}:${partes.minute}` };
}

const formatoFecha = new Intl.DateTimeFormat('en-CA', { timeZone: ZONA, year: 'numeric', month: '2-digit', day: '2-digit' });

/** "YYYY-MM-DD" del día de Argentina en que cae un instante. */
export function fechaArgentina(instante: Date): string {
  return formatoFecha.format(instante);
}

/** 00:00 de Argentina de un día "YYYY-MM-DD" (-03:00 fijo: sin horario de verano desde 2009). */
export function inicioDeDiaArgentina(fecha: string): Date {
  return new Date(`${fecha}T00:00:00.000-03:00`);
}

/** 00:00 de Argentina del día 1 del mes en que cae `instante`, corrido `meses` (negativo = meses anteriores). */
export function inicioDeMesArgentina(instante: Date, meses = 0): Date {
  const [y, m] = fechaArgentina(instante).split('-').map(Number);
  const primero = new Date(Date.UTC(y, m - 1 + meses, 1));
  return inicioDeDiaArgentina(primero.toISOString().slice(0, 10));
}
