// Las cuentas de los planes de un gimnasio, puras y sin leer el reloj ni la
// base: cuándo arranca y hasta cuándo vale un plan, cuántas clases le quedan a
// un pack, si una membresía ya usó sus clases de la semana y con qué plan se
// paga un lugar en una clase.
//
// Las clases usadas no se guardan en una tabla aparte: salen de las reservas
// (cada reserva dice con qué se pagó en `datos.gimnasio`). Una reserva
// cancelada no cuenta, así que la clase vuelve sola: el cliente solo puede
// cancelar dentro del plazo del negocio (después tiene que llamar), y si el
// negocio libera el lugar es que decidió devolvérsela. Quien falta sin avisar
// queda como ausente, y esa sí cuenta.
import { diaDeSemana, sumarDias } from '../../reservas/dominio/tiempo';

export type TipoPlan = 'PRUEBA' | 'SUELTA' | 'PACK' | 'MEMBRESIA';

/** Los tipos que se le asignan a un alumno. La prueba y la suelta son de una sola clase: se eligen al reservar. */
export const TIPOS_ASIGNABLES: readonly TipoPlan[] = ['PACK', 'MEMBRESIA'];

/** Cómo se pagó un lugar: con el plan del alumno, aparte (una clase suelta, en el gimnasio) o con la clase de prueba. */
export type Pago = 'plan' | 'aparte' | 'prueba';
export const PAGOS: readonly Pago[] = ['plan', 'aparte', 'prueba'];

/** Los estados de una reserva que cuentan como una clase usada. Una cancelada o una vencida no. */
export const CUENTAN = ['PENDIENTE', 'CONFIRMADA', 'COMPLETADA', 'AUSENTE'] as const;

/** El plan de un alumno, con lo que hace falta para las cuentas. */
export interface Suscripcion {
  id: string;
  planId: string;
  tipo: TipoPlan;
  /** Pack: cuántas clases trae. */
  clases: number | null;
  /** Membresía: clases por semana; 0 o null = libre. */
  porSemana: number | null;
  /** AAAA-MM-DD, los dos días incluidos. */
  desde: string;
  hasta: string;
  estado: 'VIGENTE' | 'CANCELADA';
}

/** Un lugar pagado con un plan: de qué suscripción, qué día es la clase y cuántos lugares. */
export interface Uso { suscripcionId: string; fecha: string; cantidad: number }

/** Lo propio de Gimnasio en el campo libre de una reserva. */
export interface DatosDePago { pago: Pago; suscripcionId?: string; planId?: string }

/** Lee `datos.gimnasio` de una reserva. Lo que no tenga la forma esperada es "sin definir" (null). */
export function pagoDe(datos: unknown): DatosDePago | null {
  if (!datos || typeof datos !== 'object') return null;
  const g = (datos as Record<string, unknown>).gimnasio;
  if (!g || typeof g !== 'object') return null;
  const { pago, suscripcionId, planId } = g as Record<string, unknown>;
  if (typeof pago !== 'string' || !(PAGOS as readonly string[]).includes(pago)) return null;
  return {
    pago: pago as Pago,
    ...(typeof suscripcionId === 'string' && suscripcionId ? { suscripcionId } : {}),
    ...(typeof planId === 'string' && planId ? { planId } : {}),
  };
}

/** Hasta qué día vale un plan que arranca en `desde`: ese día más los de vigencia. */
export const venceEl = (desde: string, vigenciaDias: number): string => sumarDias(desde, vigenciaDias);

/**
 * Desde qué día arranca un plan que se asigna hoy. Una membresía que continúa
 * a otra del mismo plan todavía vigente arranca al día siguiente de que esa
 * termine: renovar antes de que venza no hace perder días. Todo lo demás (un
 * pack, un plan distinto, una que ya venció) arranca hoy.
 */
export function arrancaEl(hoy: string, plan: { id: string; tipo: TipoPlan }, suscripciones: Pick<Suscripcion, 'planId' | 'hasta' | 'estado'>[]): string {
  if (plan.tipo !== 'MEMBRESIA') return hoy;
  const mismas = suscripciones.filter((s) => s.estado === 'VIGENTE' && s.planId === plan.id && s.hasta >= hoy);
  if (mismas.length === 0) return hoy;
  const ultima = mismas.reduce((a, b) => (b.hasta > a.hasta ? b : a));
  return sumarDias(ultima.hasta, 1);
}

/** La semana de un día, de lunes a domingo. */
export function semanaDe(fecha: string): { lunes: string; domingo: string } {
  const lunes = sumarDias(fecha, -((diaDeSemana(fecha) + 6) % 7));
  return { lunes, domingo: sumarDias(lunes, 6) };
}

/** Los lugares pagados con una suscripción. */
export const usadasDe = (suscripcionId: string, usos: Uso[]): number =>
  usos.filter((u) => u.suscripcionId === suscripcionId).reduce((s, u) => s + u.cantidad, 0);

/** Las clases que le quedan a un pack (nunca menos de cero); null si no es un pack. */
export function restantesDe(s: Pick<Suscripcion, 'id' | 'tipo' | 'clases'>, usos: Uso[]): number | null {
  if (s.tipo !== 'PACK') return null;
  return Math.max(0, (s.clases ?? 0) - usadasDe(s.id, usos));
}

/** Las clases que alguien tomó con sus membresías en la semana de `fecha` (una renovación a mitad de semana no las pone en cero). */
export function usadasEnLaSemana(suscripciones: Pick<Suscripcion, 'id' | 'tipo'>[], usos: Uso[], fecha: string): number {
  const { lunes, domingo } = semanaDe(fecha);
  const membresias = new Set(suscripciones.filter((s) => s.tipo === 'MEMBRESIA').map((s) => s.id));
  return usos.filter((u) => membresias.has(u.suscripcionId) && u.fecha >= lunes && u.fecha <= domingo).reduce((s, u) => s + u.cantidad, 0);
}

/** Por qué un lugar no se puede pagar con el plan. */
export type SinPlan =
  | { causa: 'sin-plan' }
  /** Tuvo un plan y ya venció: `hasta` es el último día que valió. */
  | { causa: 'vencido'; hasta: string }
  /** Su plan arranca después de esa clase. */
  | { causa: 'no-empezo'; desde: string }
  /** Al pack no le alcanzan las clases. */
  | { causa: 'sin-clases'; restantes: number }
  /** La membresía ya usó sus clases de esa semana. */
  | { causa: 'tope-semanal'; porSemana: number; usadas: number }
  /** La membresía cubre un solo lugar por clase. */
  | { causa: 'un-lugar' };

/**
 * Con qué suscripción se paga `cantidad` lugares en una clase del día `fecha`,
 * o por qué no se puede. Entre las que valen ese día se usa primero la que
 * vence antes: las clases de un pack que está por vencer no se pierden por
 * tener otro más nuevo.
 */
export function suscripcionPara(suscripciones: Suscripcion[], usos: Uso[], fecha: string, cantidad: number): { suscripcion: Suscripcion } | SinPlan {
  const vigentes = suscripciones.filter((s) => s.estado === 'VIGENTE');
  const delDia = vigentes.filter((s) => s.desde <= fecha && fecha <= s.hasta).sort((a, b) => a.hasta.localeCompare(b.hasta) || a.id.localeCompare(b.id));
  if (delDia.length === 0) {
    if (vigentes.length === 0) return { causa: 'sin-plan' };
    const despues = vigentes.filter((s) => s.desde > fecha).sort((a, b) => a.desde.localeCompare(b.desde))[0];
    if (despues) return { causa: 'no-empezo', desde: despues.desde };
    const ultima = vigentes.reduce((a, b) => (b.hasta > a.hasta ? b : a));
    return { causa: 'vencido', hasta: ultima.hasta };
  }
  let primero: SinPlan | null = null;
  for (const s of delDia) {
    let motivo: SinPlan | null = null;
    if (s.tipo === 'PACK') {
      const restantes = restantesDe(s, usos) ?? 0;
      if (restantes < cantidad) motivo = { causa: 'sin-clases', restantes };
    } else if (s.tipo === 'MEMBRESIA') {
      if (cantidad !== 1) motivo = { causa: 'un-lugar' };
      else if (s.porSemana && s.porSemana > 0) {
        // Con todas sus membresías, también una que se reemplazó a mitad de semana: cambiar de plan no regala clases.
        const usadas = usadasEnLaSemana(suscripciones, usos, fecha);
        if (usadas >= s.porSemana) motivo = { causa: 'tope-semanal', porSemana: s.porSemana, usadas };
      }
    } else {
      // La prueba y la suelta no se asignan: una fila así no paga nada.
      motivo = { causa: 'sin-plan' };
    }
    if (!motivo) return { suscripcion: s };
    primero ??= motivo;
  }
  return primero ?? { causa: 'sin-plan' };
}

const ddmm = (fecha: string) => `${fecha.slice(8, 10)}/${fecha.slice(5, 7)}`;

/** El motivo dicho para quien atiende el panel ("No le quedan clases en el pack."). */
export function motivoParaElNegocio(m: SinPlan): string {
  switch (m.causa) {
    case 'sin-plan': return 'No tiene un plan. Asignale uno desde su ficha, o anotalo y cobrale la clase aparte.';
    case 'vencido': return `Su plan venció el ${ddmm(m.hasta)}. Renovalo desde su ficha, o anotalo y cobrale la clase aparte.`;
    case 'no-empezo': return `Su plan arranca el ${ddmm(m.desde)}: esa clase es de antes.`;
    case 'sin-clases': return m.restantes > 0
      ? `Le ${m.restantes === 1 ? 'queda 1 clase' : `quedan ${m.restantes} clases`} en el pack: no alcanzan para esos lugares.`
      : 'No le quedan clases en el pack. Renovalo desde su ficha, o anotalo y cobrale la clase aparte.';
    case 'tope-semanal': return `Ya usó ${m.porSemana === 1 ? 'su clase' : `sus ${m.porSemana} clases`} de esa semana. Si viene igual, cobrale la clase aparte.`;
    case 'un-lugar': return 'La membresía cubre un solo lugar por clase. Anotalo con un solo lugar para que use su plan, o cobrale los lugares aparte.';
  }
}
