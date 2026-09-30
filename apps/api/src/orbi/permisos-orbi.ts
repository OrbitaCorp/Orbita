import { CODIGOS_DEL_CATALOGO } from '../common/permisos/catalogo';

/**
 * Los permisos con los que Orbi decide qué tools ofrece, cuáles ejecuta y qué
 * datos del negocio le muestra al modelo.
 *
 * El DUEÑO pasa siempre, igual que PermissionsGuard (`roleName === 'owner'`): no
 * depende de filas de permisos en la base, así que un permiso nuevo en el
 * catálogo no lo deja sin tools de Orbi antes de correr su backfill. Cualquier
 * otro rol recibe exactamente los suyos, del JWT y no del body (el cliente
 * miente, ver el comentario en OrbiController.chat).
 *
 * Se usa en `chat` y en `confirm`. `reject` NO chequea permisos: cancelar una
 * propuesta nunca puede estar prohibido.
 */
export function permisosDeOrbi(user: { roleName?: string; permissions: string[] }): string[] {
  return user.roleName === 'owner' ? CODIGOS_DEL_CATALOGO : user.permissions;
}
