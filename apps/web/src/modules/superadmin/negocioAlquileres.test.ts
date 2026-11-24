import { describe, expect, it } from 'vitest'
import { RUBROS_ALQUILERES } from '@/modules/alquileres/datos'
import { RUBROS_PARA_CREAR, aSubdominio, erroresDeNegocio, type FormNegocio } from './negocioAlquileres'

const OK: FormNegocio = { nombre: 'Cabañas del Sol', subdominio: 'cabanas-del-sol', rubro: 'cabana', duenoNombre: 'Ana Ríos', duenoEmail: 'ana@ejemplo.com', contrasena: 'una-clave-larga' }

describe('crear un negocio de Alquileres desde Superadmin', () => {
  it('los rubros que se ofrecen son de alojamiento y existen en el catálogo de Alquileres', () => {
    // Los mismos que acepta la API (RUBROS_ALQUILERES_HABILITADOS en negocios-alquileres.service.ts).
    expect(RUBROS_PARA_CREAR.map(r => r.key)).toEqual(['casa', 'depto', 'cabana', 'quinta', 'hostel', 'camping'])
    for (const r of RUBROS_PARA_CREAR) {
      const enCatalogo = RUBROS_ALQUILERES.find(x => x.key === r.key)
      expect(enCatalogo?.tipo, r.key).toBe('estadia')
      expect(r.label).toBe(enCatalogo?.label)
    }
  })

  it('propone el subdominio a partir del nombre: sin tildes, espacios ni símbolos', () => {
    expect(aSubdominio('Cabañas del Sol')).toBe('cabanas-del-sol')
    expect(aSubdominio('  Depto Ñandú & Cía.  ')).toBe('depto-nandu-cia')
    expect(aSubdominio('---')).toBe('')
  })

  it('un formulario completo no tiene errores', () => {
    expect(erroresDeNegocio(OK)).toEqual({})
  })

  it('marca cada campo que falta o está mal, con el motivo', () => {
    const e = erroresDeNegocio({ nombre: 'ab', subdominio: 'Con Espacios', rubro: '', duenoNombre: '', duenoEmail: 'no-es-mail', contrasena: 'corta' })
    expect(Object.keys(e).sort()).toEqual(['contrasena', 'duenoEmail', 'duenoNombre', 'nombre', 'rubro', 'subdominio'])
    expect(e.subdominio).toMatch(/minúsculas/)
    expect(e.contrasena).toMatch(/10/)
  })
})
