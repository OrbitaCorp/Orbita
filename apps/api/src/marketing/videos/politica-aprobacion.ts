import { ConfigService } from '@nestjs/config';

// Quién puede aprobar un video de la cola y cuándo alcanza. Está aislado acá (sin base de datos ni Nest) para poder
// probarlo entero. Esta lógica es INTERNA: el panel y el conector no muestran quién aprobó ni cómo se llega a la
// aprobación completa; solo ofrecen «Aprobar» a quien puede y muestran «Aprobado» cuando ya alcanza.
//
// La regla depende de QUIÉN SUBIÓ el video (no del tipo: marketing o tutorial):
//
//   · Lo subió uno de los socios (la dirección: CEO, CTO o CPO): lo aprueba él mismo, para verificar lo que hizo su Claude.
//     No hace falta nada más y NINGÚN socio puede aprobar (ni rechazar) el video de otro socio. Todos pueden opinar y
//     proponer mejoras, pero eso son comentarios, no aprobaciones.
//   · Lo subió cualquier otra persona (por ejemplo, Milagros, de marketing): lo tiene que aprobar la dirección.
//       – Alcanza con la aprobación del CEO (tiene la responsabilidad de marketing y de estrategia).
//       – Los otros dos (CTO y CPO) también pueden aprobar, pero entonces tienen que aprobar LOS DOS.
//
// Cada socio tiene un ROL (CEO, CTO, CPO) y un rol puede tener VARIOS correos (por ejemplo, ceo@orbita-corp.com y ceo@orbita.site):
// son la misma persona. Por eso «el mismo» se decide por rol: con una cuenta no se aprueba lo que subió la otra cuenta del mismo
// rol, y las dos cuentas de un rol cuentan como una sola aprobación.
// Quien subió un video siempre puede descartarlo.

export interface Persona {
  id: string;
  email: string;
}

/**
 * La dirección de Órbita: una lista de ROLES en orden, y cada rol con sus correos (en minúscula). El primer rol es el CEO y los
 * demás, «los otros dos» (CTO y CPO).
 */
export interface Reglas {
  direccion: string[][];
}

export const DIRECCION_POR_DEFECTO = [
  'ceo@orbita-corp.com|ceo@orbita.site',
  'cto@orbita-corp.com|cto@orbita.site',
  'cpo@orbita-corp.com|cpo@orbita.site',
].join(',');

/**
 * MARKETING_DIRECCION: los roles separados por coma, y los correos de cada rol separados por «|». Por ejemplo
 * `ceo@a.com|ceo@b.com,cto@a.com|cto@b.com,cpo@a.com|cpo@b.com` (el primero es el CEO).
 */
export function reglasDeConfig(config: Pick<ConfigService, 'get'>): Reglas {
  const direccion = (config.get<string>('MARKETING_DIRECCION') ?? DIRECCION_POR_DEFECTO)
    .split(',')
    .map((rol) => rol.split('|').map((e) => e.trim().toLowerCase()).filter(Boolean))
    .filter((rol) => rol.length > 0);
  return { direccion };
}

const mismo = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();

/** El número de rol de ese correo (0 = CEO), o -1 si no es de la dirección. */
export const rolDe = (email: string, r: Reglas): number => r.direccion.findIndex((correos) => correos.some((c) => mismo(c, email)));
export const esDireccion = (email: string, r: Reglas) => rolDe(email, r) >= 0;
export const esCeo = (email: string, r: Reglas) => rolDe(email, r) === 0;

interface Contexto {
  /** Quién lo subió (null si esa cuenta ya no existe). */
  creador: Persona | null;
  /** Quiénes aprobaron hasta ahora. */
  aprobaron: Persona[];
  reglas: Reglas;
}

/** ¿Es la misma persona? La misma cuenta, o dos cuentas del mismo rol de la dirección. */
function mismaPersona(a: Persona, b: Persona, r: Reglas): boolean {
  if (a.id === b.id) return true;
  const rol = rolDe(a.email, r);
  return rol >= 0 && rol === rolDe(b.email, r);
}

const esElCreador = (c: Contexto, p: Persona) => !!c.creador && mismaPersona(c.creador, p, c.reglas);

/** Lo subió un socio: es un video «de la casa» y se verifica a sí mismo. */
const loSubioUnSocio = (c: Contexto) => !!c.creador && esDireccion(c.creador.email, c.reglas);

/** ¿Puede esta persona aprobar este video ahora? (False si ya aprobó ella o su otra cuenta.) */
export function puedeAprobar(c: Contexto, quien: Persona): boolean {
  if (c.aprobaron.some((p) => mismaPersona(p, quien, c.reglas))) return false;
  if (loSubioUnSocio(c)) return esElCreador(c, quien);
  return esDireccion(quien.email, c.reglas) && !esElCreador(c, quien);
}

/** ¿Ya hay las aprobaciones que hacen falta? */
export function aprobacionCompleta(c: Contexto): boolean {
  if (loSubioUnSocio(c)) return c.aprobaron.some((p) => esElCreador(c, p));
  // Lo subió alguien que no es socio: la aprobación del propio creador nunca cuenta. Se cuentan ROLES, no cuentas.
  const roles = new Set(c.aprobaron.filter((p) => !esElCreador(c, p)).map((p) => rolDe(p.email, c.reglas)).filter((r) => r >= 0));
  const porElCeo = roles.has(0);
  const resto = c.reglas.direccion.map((_, i) => i).filter((i) => i > 0);
  const porLosOtrosDos = resto.length > 0 && resto.every((i) => roles.has(i));
  return porElCeo || porLosOtrosDos;
}

/** ¿Puede rechazar (si está pendiente) o desaprobar (si ya está aprobado) este video? El creador siempre puede descartar el suyo. */
export function puedeRechazar(c: Contexto, quien: Persona): boolean {
  if (esElCreador(c, quien)) return true;
  if (loSubioUnSocio(c)) return false;
  return esDireccion(quien.email, c.reglas);
}
