// El origen de la demo (/gimnasio-demo): el almacén del navegador de siempre
// (datos/negocio.ts) detrás de la misma forma que el de la API. Las acciones
// guardan en el acto y nunca fallan; devuelven promesas para que el panel las
// trate igual que las de la API. Nada viaja a la red.
import { useMemo } from 'react'
import { fechaCorta, sumarDias } from '@/lib/reservas/fechas'
import { HOY, avisoDeAfectadas, planDe, planDelPago, reservadasEntre, type Inscripcion, type NegocioGym, type RubroGym } from '../index'
import { accionesGym, enEspera, inscripcionesDelDemo, leerDemo, negocioDelDemo, sociosDelDemo, useDemoGym, useHidratado } from '../negocio'
import { RELOJ_DEMO } from '../reloj'
import type { AccionesGimnasio, Capacidades, OrigenGimnasio, Resultado, VistaGimnasio } from './index'

const hecho: Resultado = {}

/**
 * Lo que no es igual que con la API (ver Capacidades). La demo tiene sus secciones de Actividades y salas y de Equipo,
 * la lista de espera avanza sola al subir el cupo (datos/negocio.ts) y nada de lo que se hace le llega a nadie: se
 * puede deshacer anotando de nuevo. Quien pasa de la lista de espera usa el plan con el que se anotó, y un plan nuevo
 * arranca hoy y reemplaza al que había.
 */
const PUEDE: Capacidades = {
  corregirAsistencia: true, catalogoEnLaClase: false, esperaPasaAlSubirCupo: true, liberarEsDefinitivo: false,
  eligePago: true, pagoSinDefinir: false, avisoDeVencimiento: true, renovarContinua: false,
}

/** Los días sin clases que se sumaron con este cambio, y cuántas reservas quedaron adentro (como avisa la API). */
function avisoDeBloqueos(antes: NegocioGym, cambio: Partial<NegocioGym>, inscripciones: Inscripcion[]): Resultado {
  if (!cambio.bloqueos) return hecho
  const nuevos = cambio.bloqueos.filter(b => !antes.bloqueos.some(x => x.id === b.id))
  const detalle = avisoDeAfectadas(nuevos.reduce((s, b) => s + reservadasEntre(inscripciones, b.desde, b.hasta), 0))
  return detalle ? { detalle } : hecho
}

/**
 * Las acciones del panel sobre el almacén de la demo. No dependen de React: leen lo que hay guardado en el momento (no
 * lo del último render: dos guardados seguidos no se pisan) y se prueban solas.
 */
export function accionesDemo(rubro: string): AccionesGimnasio {
  const negocio = () => negocioDelDemo(leerDemo(), rubro)
  const socios = () => sociosDelDemo(leerDemo(), rubro)
  const inscripciones = () => inscripcionesDelDemo(leerDemo(), rubro)
  return {
    configurar: async cambio => {
      const aviso = avisoDeBloqueos(negocio(), cambio, inscripciones())
      accionesGym.configurar(rubro, cambio)
      return aviso
    },
    inscribir: async (i, socio) => {
      // Cómo se paga decide con qué plan queda la inscripción (así cuenta la demo: el pack se descuenta si se pagó con el pack).
      const quien = socio ?? socios().find(s => s.id === i.socioId)
      const guardada: Inscripcion = i.pago ? { ...i, planId: planDelPago(negocio(), quien, i.pago) } : i
      accionesGym.inscribir(rubro, guardada, socio)
      if (i.estado !== 'espera') return hecho
      // Como con la API: en qué lugar de la lista quedó.
      const lugar = enEspera(inscripciones(), i.claseId, i.fecha).findIndex(x => x.id === i.id) + 1
      return lugar ? { detalle: `Está en el lugar ${lugar} de la lista.` } : hecho
    },
    cambiarInscripcion: async (id, cambio) => { accionesGym.cambiarInscripcionEn(rubro, id, cambio); return hecho },
    cancelar: async id => {
      const todas = inscripciones()
      const la = todas.find(i => i.id === id)
      // Si se libera un lugar de una clase con lista de espera, el primero pasa solo: el aviso dice quién (como con la API).
      const primero = la?.estado === 'reservada' ? enEspera(todas, la.claseId, la.fecha)[0] : undefined
      const anotados = socios()
      accionesGym.cancelar(rubro, id)
      if (!primero) return hecho
      const nombre = anotados.find(s => s.id === primero.socioId)?.nombre.trim().split(/\s+/)[0] ?? 'El primero de la lista'
      return { detalle: `${nombre} pasó de la lista de espera y ya tiene su lugar.` }
    },
    definirPago: async (id, pago) => {
      const la = inscripciones().find(i => i.id === id)
      const quien = socios().find(s => s.id === la?.socioId)
      accionesGym.definirPago(rubro, id, pago, planDelPago(negocio(), quien, pago))
      return hecho
    },
    agregarSocio: async s => { accionesGym.agregarSocio(rubro, s); return hecho },
    // En la demo el plan nuevo arranca hoy y reemplaza al que había.
    asignarPlan: async (socioId, planId) => {
      const p = planDe(negocio(), planId)
      if (!p) throw new Error('Ese plan ya no existe.')
      const vence = sumarDias(HOY, p.vigenciaDias)
      accionesGym.cambiarSocio(socioId, { planId: p.id, desde: HOY, vence, clasesRestantes: p.tipo === 'pack' ? p.clases ?? null : null, probo: true })
      return { detalle: `Hasta el ${fechaCorta(vence)}. El cobro se registra a mano.` }
    },
    quitarPlan: async socioId => { accionesGym.cambiarSocio(socioId, { planId: null, desde: null, vence: null, clasesRestantes: null }); return hecho },
  }
}

function useVistaDemo(rubro: RubroGym): VistaGimnasio {
  const almacen = useDemoGym()
  const hidratado = useHidratado()
  const negocio = useMemo(() => negocioDelDemo(almacen.demo, rubro.key), [almacen.demo, rubro.key])
  const socios = useMemo(() => sociosDelDemo(almacen.demo, rubro.key), [almacen.demo, rubro.key])
  const inscripciones = useMemo(() => inscripcionesDelDemo(almacen.demo, rubro.key), [almacen.demo, rubro.key])
  const acciones = useMemo(() => accionesDemo(rubro.key), [rubro.key])
  return {
    tipo: 'demo', negocio, socios, inscripciones, reloj: RELOJ_DEMO,
    usuario: { nombre: negocio.dueno.nombre, rol: negocio.dueno.rol },
    listo: hidratado, ocupado: false, error: null, reintentar: () => {},
    // Todo vive en este navegador: nunca hay una lectura que pueda fallar.
    desactualizado: false, actualizar: () => {},
    guarda: () => true,
    puede: PUEDE,
    verFecha: () => {},
    leidoHasta: null,
    acciones,
  }
}

export const origenDemo: OrigenGimnasio = { tipo: 'demo', useVista: useVistaDemo }
