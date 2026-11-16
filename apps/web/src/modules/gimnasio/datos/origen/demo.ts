// El origen de la demo (/gimnasio-demo): el almacén del navegador de siempre
// (datos/negocio.ts) detrás de la misma forma que el de la API. Las acciones
// guardan en el acto y nunca fallan; devuelven promesas para que el panel las
// trate igual que las de la API. Nada viaja a la red.
import { useMemo } from 'react'
import { avisoDeAfectadas, reservadasEntre, type Inscripcion, type NegocioGym, type RubroGym } from '../index'
import { enEspera, inscripcionesDelDemo, leerDemo, negocioDelDemo, sociosDelDemo, useDemoGym, useHidratado } from '../negocio'
import { RELOJ_DEMO } from '../reloj'
import type { OrigenGimnasio, Resultado, VistaGimnasio } from './index'

const hecho: Resultado = {}

/** Los días sin clases que se sumaron con este cambio, y cuántas reservas quedaron adentro (como avisa la API). */
function avisoDeBloqueos(antes: NegocioGym, cambio: Partial<NegocioGym>, inscripciones: Inscripcion[]): Resultado {
  if (!cambio.bloqueos) return hecho
  const nuevos = cambio.bloqueos.filter(b => !antes.bloqueos.some(x => x.id === b.id))
  const detalle = avisoDeAfectadas(nuevos.reduce((s, b) => s + reservadasEntre(inscripciones, b.desde, b.hasta), 0))
  return detalle ? { detalle } : hecho
}

function useVistaDemo(rubro: RubroGym): VistaGimnasio {
  const almacen = useDemoGym()
  const hidratado = useHidratado()
  const negocio = useMemo(() => negocioDelDemo(almacen.demo, rubro.key), [almacen.demo, rubro.key])
  const socios = useMemo(() => sociosDelDemo(almacen.demo, rubro.key), [almacen.demo, rubro.key])
  const inscripciones = useMemo(() => inscripcionesDelDemo(almacen.demo, rubro.key), [almacen.demo, rubro.key])
  return {
    tipo: 'demo', negocio, socios, inscripciones, reloj: RELOJ_DEMO,
    usuario: { nombre: negocio.dueno.nombre, rol: negocio.dueno.rol },
    listo: hidratado, ocupado: false, error: null, reintentar: () => {},
    guarda: () => true,
    puede: { corregirAsistencia: true },
    verFecha: () => {},
    acciones: {
      configurar: async cambio => {
        // Con lo que está en el almacén ahora (no con lo del último render): dos guardados seguidos no se pisan.
        const antes = negocioDelDemo(leerDemo(), rubro.key)
        const aviso = avisoDeBloqueos(antes, cambio, inscripcionesDelDemo(leerDemo(), rubro.key))
        almacen.configurar(rubro.key, cambio)
        return aviso
      },
      inscribir: async (i, socio) => {
        almacen.inscribir(rubro.key, i, socio)
        if (i.estado !== 'espera') return hecho
        // Como con la API: en qué lugar de la lista quedó.
        const lugar = enEspera(inscripcionesDelDemo(leerDemo(), rubro.key), i.claseId, i.fecha).findIndex(x => x.id === i.id) + 1
        return lugar ? { detalle: `Está en el lugar ${lugar} de la lista.` } : hecho
      },
      cambiarInscripcion: async (id, cambio) => { almacen.cambiarInscripcionEn(rubro.key, id, cambio); return hecho },
      cancelar: async id => {
        const d = leerDemo()
        const todas = inscripcionesDelDemo(d, rubro.key)
        const la = todas.find(i => i.id === id)
        // Si se libera un lugar de una clase con lista de espera, el primero pasa solo: el aviso dice quién (como con la API).
        const primero = la?.estado === 'reservada' ? enEspera(todas, la.claseId, la.fecha)[0] : undefined
        almacen.cancelar(rubro.key, id)
        if (!primero) return hecho
        const nombre = sociosDelDemo(d, rubro.key).find(s => s.id === primero.socioId)?.nombre.trim().split(/\s+/)[0] ?? 'El primero de la lista'
        return { detalle: `${nombre} pasó de la lista de espera y ya tiene su lugar.` }
      },
      agregarSocio: async s => { almacen.agregarSocio(rubro.key, s); return hecho },
      cambiarSocio: async (id, cambio) => { almacen.cambiarSocio(id, cambio); return hecho },
    },
  }
}

export const origenDemo: OrigenGimnasio = { tipo: 'demo', useVista: useVistaDemo }
