import { HttpException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate, type ValidationError } from 'class-validator';
import type { Invalido } from './resolver-nombres';

export type { Invalido } from './resolver-nombres';

/**
 * Por qué no se puede proponer una acción, en castellano y con estructura
 * (`faltan`, `invalidos`), para que el modelo le pida a la persona TODO lo
 * que falta en un solo mensaje en vez de reintentar a ciegas o rendirse.
 * `error` es el mismo texto de siempre (lo que leía el modelo antes): los
 * campos nuevos son opcionales y se suman al resultado de la tool.
 */
export type ArgsInvalidos = { ok: false; error: string; faltan?: string[]; invalidos?: Invalido[] };
export type ResultadoDeValidacion = { ok: true } | ArgsInvalidos;

/**
 * Valida los argumentos de una tool de escritura con el MISMO DTO que usa su
 * endpoint HTTP (spec de la fase 1, §3.2).
 *
 * Por qué hace falta: las tools llaman a los services directo y se saltean el
 * ValidationPipe global. Sin esto, el modelo podía proponer un cupón con un
 * código que por HTTP se rechaza (espacios, más de 40 caracteres), un nombre
 * de 500 caracteres o `productIds` que no son UUID, y la persona confirmaba
 * algo que el panel nunca le hubiera dejado cargar.
 *
 * - `enableImplicitConversion: false`: igual que el pipe global (que tiene
 *   `transform: true` pero no convierte tipos). Un "20" no pasa como 20.
 * - `whitelist` + `forbidNonWhitelisted`: más estricto que el pipe (que solo
 *   descarta lo que sobra). Acá lo que sobra lo armó la tool, así que es un
 *   error de la tool y conviene que salte en vez de perderse callado.
 *
 * El error es un texto corto con el primer motivo: vuelve al modelo como
 * resultado de la tool, y volcar el objeto entero sería devolverle al contexto
 * (y a los logs) texto que puede ser de terceros.
 */
export async function validarConDto<T extends object>(
  Dto: new () => T,
  args: Record<string, unknown>,
): Promise<{ ok: true; valor: T } | { ok: false; error: string; campo?: string; motivo?: string }> {
  const valor = plainToInstance(Dto, args, { enableImplicitConversion: false });
  const errores = await validate(valor, { whitelist: true, forbidNonWhitelisted: true });
  if (errores.length === 0) return { ok: true, valor };
  const primero = primerMotivo(errores);
  if (!primero) return { ok: false, error: 'Argumentos inválidos' };
  // `campo` es la propiedad del DTO (la raíz, sin las anidadas): la tool la
  // traduce a su parámetro para el `invalidos` que ve el modelo.
  return { ok: false, error: `Argumento inválido (${primero.donde}): ${primero.motivo}`, campo: primero.donde.split('.')[0], motivo: primero.motivo };
}

// El primer error con motivo, bajando por los anidados (las variantes de un
// producto). Los mensajes de class-validator nombran la propiedad y el tope,
// no el valor: no hay riesgo de devolver el texto que se rechazó.
function primerMotivo(errores: ValidationError[], ruta = ''): { donde: string; motivo: string } | null {
  for (const e of errores) {
    const donde = ruta ? `${ruta}.${e.property}` : e.property;
    const motivo = e.constraints ? Object.values(e.constraints)[0] : undefined;
    if (motivo) return { donde, motivo };
    if (e.children?.length) return primerMotivo(e.children, donde);
  }
  return null;
}

/**
 * Corre la validación del service (las reglas cruzadas y lo que depende de la
 * base: que los ids sean del negocio, que el nombre no esté tomado) antes de
 * armar la tarjeta. Sin esto, esas reglas saltaban recién en execute(), es
 * decir DESPUÉS de que la persona confirmara.
 *
 * Solo un rechazo 4xx del service es "argumento inválido" (su mensaje ya es
 * para personas). Cualquier otra cosa (la base no respondió) se propaga: el
 * registry la convierte en "No pude preparar esa acción".
 */
export async function validarConServicio(chequeo: () => Promise<unknown>): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await chequeo();
    return { ok: true };
  } catch (e) {
    if (e instanceof HttpException && e.getStatus() >= 400 && e.getStatus() < 500) return { ok: false, error: e.message };
    throw e;
  }
}

/**
 * Lo que tira describirAccion cuando la acción no se puede proponer por un
 * dato de la base (el pedido no existe, la categoría no es del negocio). El
 * registry lo convierte en `{ error }`: el modelo recibe el motivo y no se
 * arma tarjeta.
 */
export class AccionInvalida extends Error {
  constructor(
    message: string,
    /** Lo que falta o no existe, con estructura: el registry lo suma al `{ error }` que recibe el modelo. */
    readonly detalle?: { faltan?: string[]; invalidos?: Invalido[] },
  ) {
    super(message);
  }
}
