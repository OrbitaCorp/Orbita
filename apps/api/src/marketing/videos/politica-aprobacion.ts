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
// Nadie aprueba lo que subió otra persona fuera de esos caminos. Quien subió un video siempre puede descartarlo.

export interface Persona {
  id: string;
  email: string;
}

/** La dirección de Órbita, en orden: la primera es el CEO y las demás, los otros dos (CTO y CPO). Correos en minúscula. */
export interface Reglas {
  direccion: string[];
}

export const DIRECCION_POR_DEFECTO = 'ceo@orbita-corp.com,cto@orbita-corp.com,cpo@orbita-corp.com';

export function reglasDeConfig(config: Pick<ConfigService, 'get'>): Reglas {
  const direccion = (config.get<string>('MARKETING_DIRECCION') ?? DIRECCION_POR_DEFECTO)
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return { direccion };
}

const mismo = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();

export const esDireccion = (email: string, r: Reglas) => r.direccion.some((d) => mismo(d, email));
export const esCeo = (email: string, r: Reglas) => r.direccion.length > 0 && mismo(r.direccion[0], email);

/** Los correos de «los otros dos» (todo lo que no es el CEO). */
const otros = (r: Reglas) => r.direccion.slice(1);

interface Contexto {
  /** Quién lo subió (null si esa cuenta ya no existe). */
  creador: Persona | null;
  /** Quiénes aprobaron hasta ahora. */
  aprobaron: Persona[];
  reglas: Reglas;
}

const esElCreador = (c: Contexto, p: Persona) => !!c.creador && c.creador.id === p.id;

/** Lo subió un socio: es un video «de la casa» y se verifica a sí mismo. */
const loSubioUnSocio = (c: Contexto) => !!c.creador && esDireccion(c.creador.email, c.reglas);

/** ¿Puede esta persona aprobar este video ahora? (False si ya aprobó.) */
export function puedeAprobar(c: Contexto, quien: Persona): boolean {
  if (c.aprobaron.some((p) => p.id === quien.id)) return false;
  if (loSubioUnSocio(c)) return esElCreador(c, quien);
  return esDireccion(quien.email, c.reglas) && !esElCreador(c, quien);
}

/** ¿Ya hay las aprobaciones que hacen falta? */
export function aprobacionCompleta(c: Contexto): boolean {
  if (loSubioUnSocio(c)) return c.aprobaron.some((p) => esElCreador(c, p));
  // Lo subió alguien que no es socio: la aprobación del propio creador nunca cuenta.
  const v = c.aprobaron.filter((p) => !esElCreador(c, p));
  const porElCeo = v.some((p) => esCeo(p.email, c.reglas));
  const resto = otros(c.reglas);
  const porLosOtrosDos = resto.length > 0 && resto.every((e) => v.some((p) => mismo(p.email, e)));
  return porElCeo || porLosOtrosDos;
}

/** ¿Puede rechazar (y por lo tanto borrar) este video? El creador siempre puede descartar el suyo. */
export function puedeRechazar(c: Contexto, quien: Persona): boolean {
  if (esElCreador(c, quien)) return true;
  if (loSubioUnSocio(c)) return false;
  return esDireccion(quien.email, c.reglas);
}
