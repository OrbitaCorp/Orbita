// Mensajes automáticos de Turnos: los textos de fábrica (los de la demo,
// admin/configuracion/Mensajes.tsx, más `reprogramacion`), la validación de
// variables y el armado del texto para un turno (CONTRATO.md § 1.6 y P1.1).
//
// El DESPACHO (mail, WhatsApp, appointment_message_logs) es de P2
// (AppointmentMessagingService). Acá solo lo que el panel necesita para
// mostrar la configuración y armar el texto a mano.
import type { AppointmentAgendaMode } from '@prisma/client';
import type { CanalMensaje, MensajeAutomatico, MensajeId, MensajesTurnos } from '../../appointments.types';
import { diaDeSemana, hhmm } from '../../horarios/horarios';

export const MENSAJE_IDS: MensajeId[] = ['confirmacion', 'recordatorio', 'recordatorio2', 'cancelacion', 'reprogramacion', 'espera', 'extranamos'];
export const VARIABLES_MENSAJE = ['nombre', 'servicio', 'fecha', 'hora', 'profesional', 'negocio', 'link'] as const;
export type VariableMensaje = (typeof VARIABLES_MENSAJE)[number];

/** Cómo se le dice al turno en el rubro: "turno", "clase" o "reserva" (vozDe de catalogo/rubros.ts). */
export const palabraTurno = (modo: AppointmentAgendaMode): string => (modo === 'CLASS' ? 'clase' : modo === 'COURT' ? 'reserva' : 'turno');

/** Los textos sugeridos (iguales a la demo). */
export function textosDeFabrica(modo: AppointmentAgendaMode): Record<MensajeId, string> {
  const turno = palabraTurno(modo);
  return {
    confirmacion: `¡Hola {nombre}! Tu ${turno} de {servicio} quedó confirmado para el {fecha} a las {hora} con {profesional}. Si necesitás cambiarlo: {link}`,
    recordatorio: `Hola {nombre}, te recordamos tu ${turno} de mañana {fecha} a las {hora} en {negocio}. ¿Venís? Respondé SÍ para confirmar o cambialo acá: {link}`,
    recordatorio2: '{nombre}, te esperamos hoy a las {hora} para {servicio}. ¡Nos vemos!',
    cancelacion: `Hola {nombre}, tu ${turno} del {fecha} a las {hora} quedó cancelado. Cuando quieras, reservá de nuevo: {link}`,
    reprogramacion: `Hola {nombre}, tu ${turno} de {servicio} pasó al {fecha} a las {hora} con {profesional}. Si necesitás cambiarlo de nuevo: {link}`,
    espera: '¡{nombre}, se liberó un lugar! {servicio}, {fecha} a las {hora}. Tenés 30 min para tomarlo: {link}',
    extranamos: '¡Hola {nombre}! Hace rato que no te vemos por {negocio}. Tenemos horarios libres esta semana: {link}',
  };
}

const CUANDO_DE_FABRICA: Partial<Record<MensajeId, string>> = { recordatorio: '24', recordatorio2: '2', extranamos: '30' };

/** La configuración de mensajes con la que arranca un negocio (`messages` null). */
export function mensajesDeFabrica(modo: AppointmentAgendaMode): MensajesTurnos {
  const textos = textosDeFabrica(modo);
  // Como la demo: "Se liberó un lugar" no aplica a los negocios por sala/cabina.
  const ids = MENSAJE_IDS.filter((id) => id !== 'espera' || modo !== 'RESOURCE');
  return {
    wa: true,
    email: true,
    numero: '',
    firma: true,
    mensajes: ids.map((id): MensajeAutomatico => ({
      id,
      on: id !== 'extranamos',
      canales: id === 'extranamos' ? ['wa'] : ['wa', 'email'],
      cuando: CUANDO_DE_FABRICA[id] ?? '',
      texto: textos[id],
    })),
  };
}

/** Lee `settings.messages`: lo que falta o no se entiende vale lo de fábrica. */
export function leerMensajes(json: unknown, modo: AppointmentAgendaMode): MensajesTurnos {
  const fabrica = mensajesDeFabrica(modo);
  if (!json || typeof json !== 'object' || Array.isArray(json)) return fabrica;
  const m = json as Partial<MensajesTurnos>;
  const guardados = Array.isArray(m.mensajes) ? m.mensajes.filter((x) => x && MENSAJE_IDS.includes(x.id)) : [];
  const ids = [...fabrica.mensajes.map((x) => x.id), ...guardados.map((x) => x.id).filter((id) => !fabrica.mensajes.some((f) => f.id === id))];
  return {
    wa: typeof m.wa === 'boolean' ? m.wa : fabrica.wa,
    email: typeof m.email === 'boolean' ? m.email : fabrica.email,
    numero: typeof m.numero === 'string' ? m.numero : fabrica.numero,
    firma: typeof m.firma === 'boolean' ? m.firma : fabrica.firma,
    mensajes: ids.map((id) => guardados.find((x) => x.id === id) ?? fabrica.mensajes.find((x) => x.id === id) ?? { id, on: false, canales: [], cuando: '', texto: textosDeFabrica(modo)[id] }),
  };
}

/** Qué le falta a un texto para poder guardarse: una variable que no existe. null = está bien. */
export function errorTextoMensaje(texto: string): string | null {
  for (const m of texto.matchAll(/\{([^{}]*)\}/g)) {
    if (!(VARIABLES_MENSAJE as readonly string[]).includes(m[1])) {
      return `La variable {${m[1]}} no existe. Podés usar: ${VARIABLES_MENSAJE.map((v) => `{${v}}`).join(', ')}.`;
    }
  }
  return null;
}

const DIAS = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'];

/** "sábado 27/09" (como el ejemplo de la demo). */
export function fechaParaMensaje(fecha: string): string {
  const [, mes, dia] = fecha.split('-');
  return `${DIAS[diaDeSemana(fecha)]} ${dia}/${mes}`;
}

export const horaParaMensaje = (minutos: number): string => hhmm(minutos);

/** Reemplaza las variables y suma la firma. Una variable sin valor queda vacía. */
export function armarTexto(texto: string, valores: Record<VariableMensaje, string>, firma: string | null): string {
  const cuerpo = texto.replace(/\{([a-z]+)\}/g, (todo, v: string) => ((VARIABLES_MENSAJE as readonly string[]).includes(v) ? valores[v as VariableMensaje] ?? '' : todo));
  return firma ? `${cuerpo}\n\n— ${firma}` : cuerpo;
}

/** Los canales por los que sale una plantilla: los de la plantilla Y los que el negocio tiene prendidos. */
export const canalesActivos = (config: MensajesTurnos, plantilla: MensajeAutomatico): CanalMensaje[] =>
  plantilla.canales.filter((c) => (c === 'wa' ? config.wa : config.email));
