// Lo puro del formulario "Crear negocio de Alquileres" de Superadmin: qué
// rubros se ofrecen, cómo se propone el subdominio y qué le falta al
// formulario. La pantalla está en CrearNegocioAlquileres.tsx; la API valida
// todo de nuevo (apps/api/src/platform/negocios-alquileres.service.ts).
import { RUBROS_ALQUILERES } from '@/modules/alquileres/datos'

/** Los rubros que hoy se pueden crear: alojamiento por noche. Los mismos que acepta la API. */
const HABILITADOS = ['casa', 'depto', 'cabana', 'quinta', 'hostel', 'camping']
export const RUBROS_PARA_CREAR = HABILITADOS.map(key => {
  const r = RUBROS_ALQUILERES.find(x => x.key === key)
  return { key, label: r?.label ?? key, descripcion: r?.descripcion ?? '' }
})

export interface FormNegocio {
  nombre: string
  subdominio: string
  rubro: string
  duenoNombre: string
  duenoEmail: string
  contrasena: string
}

/** "Cabañas del Sol" → "cabanas-del-sol": lo que se propone como subdominio. */
export const aSubdominio = (nombre: string) =>
  nombre.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 63)

const RE_SUBDOMINIO = /^[a-z0-9]([a-z0-9-]{1,61}[a-z0-9])$/
const RE_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** Qué le falta al formulario, por campo. Vacío = se puede enviar. */
export function erroresDeNegocio(f: FormNegocio): Partial<Record<keyof FormNegocio, string>> {
  const e: Partial<Record<keyof FormNegocio, string>> = {}
  if (f.nombre.trim().length < 3) e.nombre = 'Escribí el nombre del negocio (3 letras o más).'
  if (!RE_SUBDOMINIO.test(f.subdominio)) e.subdominio = 'De 3 a 63 caracteres: minúsculas, números y guiones, sin espacios.'
  if (!HABILITADOS.includes(f.rubro)) e.rubro = 'Elegí qué alquila.'
  if (f.duenoNombre.trim().length < 2) e.duenoNombre = 'Escribí el nombre de quien va a entrar al panel.'
  if (!RE_EMAIL.test(f.duenoEmail.trim())) e.duenoEmail = 'Ese email no parece válido.'
  if (f.contrasena.length < 10) e.contrasena = 'La contraseña lleva 10 caracteres o más.'
  return e
}
