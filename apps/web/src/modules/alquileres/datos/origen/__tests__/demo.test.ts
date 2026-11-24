import { describe, expect, it } from 'vitest'
import { NEGOCIOS_DEMO, TIPOS_ORDEN } from '../../index'
import { clientesDelDemo, negocioDe, reservasDelDemo, type DemoAlquiler } from '../../negocio'
import { datosDemo, origenDemo } from '../demo'

const VACIO: DemoAlquiler = { negocios: {}, reservas: {}, cambios: {}, clientes: [], alta: null }

describe('origen de la demo', () => {
  it('es el origen de tipo demo', () => {
    expect(origenDemo.tipo).toBe('demo')
  })

  it.each(TIPOS_ORDEN)('en %s da lo mismo que el almacén de la demo', tipo => {
    const d = datosDemo(VACIO, tipo)
    expect(d.negocio).toEqual(negocioDe(VACIO, tipo))
    expect(d.negocio.nombre).toBe(NEGOCIOS_DEMO[tipo].nombre)
    expect(d.reservas.map(r => r.id)).toEqual(reservasDelDemo(VACIO, tipo).map(r => r.id))
    expect(d.clientes).toEqual(clientesDelDemo(VACIO))
  })

  it('lo que el dueño cambió en el navegador se ve', () => {
    const d = datosDemo({ ...VACIO, negocios: { estadia: { nombre: 'Mis Cabañas' } } }, 'estadia')
    expect(d.negocio.nombre).toBe('Mis Cabañas')
  })
})
