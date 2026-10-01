import { plainToInstance } from 'class-transformer';
import { validate, type ValidationError } from 'class-validator';

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
): Promise<{ ok: true; valor: T } | { ok: false; error: string }> {
  const valor = plainToInstance(Dto, args, { enableImplicitConversion: false });
  const errores = await validate(valor, { whitelist: true, forbidNonWhitelisted: true });
  if (errores.length === 0) return { ok: true, valor };
  return { ok: false, error: primerMotivo(errores) };
}

// El primer error con motivo, bajando por los anidados (las variantes de un
// producto). Los mensajes de class-validator nombran la propiedad y el tope,
// no el valor: no hay riesgo de devolver el texto que se rechazó.
function primerMotivo(errores: ValidationError[], ruta = ''): string {
  for (const e of errores) {
    const donde = ruta ? `${ruta}.${e.property}` : e.property;
    const motivo = e.constraints ? Object.values(e.constraints)[0] : undefined;
    if (motivo) return `Argumento inválido (${donde}): ${motivo}`;
    if (e.children?.length) return primerMotivo(e.children, donde);
  }
  return 'Argumentos inválidos';
}

/**
 * Lo que tira describirAccion cuando la acción no se puede proponer por un
 * dato de la base (el pedido no existe, la categoría no es del negocio). El
 * registry lo convierte en `{ error }`: el modelo recibe el motivo y no se
 * arma tarjeta.
 */
export class AccionInvalida extends Error {}
