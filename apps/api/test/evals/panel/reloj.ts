/**
 * Corre el reloj del proceso para que "ahora" sea el del dataset.
 *
 * El código real que lee la base (ModuleDataService, por ejemplo) calcula el
 * mes en curso con `new Date()`. Si el dataset se arma contra otro "ahora"
 * (--ahora, o el de la corrida guardada que se compara), los dos tienen que
 * ver la misma fecha. Se desplaza Date por un desfase constante: el tiempo
 * sigue corriendo (las latencias se miden bien) y los timers no se tocan.
 *
 * Solo para la CLI de las evals: el proceso es corto y no hace nada más.
 */
export function correrRelojA(ahora: Date): () => void {
  const DateReal = Date;
  const desfase = ahora.getTime() - DateReal.now();
  class DateCorrido extends DateReal {
    constructor(...args: unknown[]) {
      if (args.length === 0) super(DateReal.now() + desfase);
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore: los mismos argumentos que acepta Date.
      else super(...args);
    }

    static now(): number {
      return DateReal.now() + desfase;
    }
  }
  globalThis.Date = DateCorrido as DateConstructor;
  return () => {
    globalThis.Date = DateReal;
  };
}
