import type { AuthUser } from './AuthContext'

// Clave de quién está logueado: tipo + negocio + id. El mismo email puede ser
// member en un negocio y customer en otro (credenciales aisladas por negocio),
// así que el id solo no alcanza para decir "es la misma persona".
function claveDeIdentidad(user: AuthUser): string {
  if (user.type === 'member') return `member:${user.business.id}:${user.member.id}`
  if (user.type === 'customer') return `customer:${user.business.id}:${user.customer.id}`
  return `platform_admin:${user.admin.id}`
}

/**
 * ¿El login nuevo es de otra persona (u otro negocio) que la que estaba en
 * memoria? Se usa para vaciar lo que quedó de la sesión anterior (el chat de
 * Orbi) en una terminal compartida.
 *
 * Sin nadie en memoria devuelve false a propósito: el wizard de onboarding se
 * loguea desde anónimo al final y no hay que borrarle la charla con Orbi.
 */
export function cambiaDeIdentidad(anterior: AuthUser | null, nuevo: AuthUser): boolean {
  if (!anterior) return false
  return claveDeIdentidad(anterior) !== claveDeIdentidad(nuevo)
}
