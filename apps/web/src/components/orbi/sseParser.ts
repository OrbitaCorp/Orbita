// Lector del stream SSE de Orbi. Módulo puro (sin fetch ni store) para poder
// probarlo con texto suelto.
//
// Por qué existe: el parseo vivía inline en useOrbiChat y tenía dos agujeros.
// El tipo de evento (`event:`) era una variable local del ciclo de lectura, así
// que si `event:` y `data:` llegaban en pedazos de red distintos el `data:` se
// procesaba sin tipo y se perdía. Y un `data:` que no era JSON válido tiraba
// excepción y cortaba todo el stream. Acá el estado (línea partida + tipo de
// evento pendiente) vive entre llamadas y un dato roto se descarta solo.

export type EventoSse = { event: string; data: unknown }

// Tipo que el estándar SSE le asigna a un `data:` que llegó sin `event:` antes.
const EVENTO_POR_DEFECTO = 'message'

export function crearParserSse(): { alimentar(pedazo: string): EventoSse[] } {
  // Lo que quedó sin terminar de la última lectura: una línea a medio llegar.
  let resto = ''
  // `event:` ya leído cuyo `data:` todavía no llegó.
  let tipoPendiente = ''

  return {
    alimentar(pedazo: string): EventoSse[] {
      const eventos: EventoSse[] = []
      const lineas = (resto + pedazo).split('\n')
      // La última posición es lo que sigue sin su `\n`: se retiene para el
      // próximo pedazo (si estaba completa, queda '' y no retiene nada).
      resto = lineas.pop() ?? ''

      for (const cruda of lineas) {
        // `\r\n` como separador: el `\r` sobrante se descarta.
        const linea = cruda.endsWith('\r') ? cruda.slice(0, -1) : cruda

        if (linea === '') {
          // Línea en blanco = fin del evento: el tipo no se arrastra al siguiente.
          tipoPendiente = ''
          continue
        }
        // Comentario (p. ej. keep-alive): se ignora.
        if (linea.startsWith(':')) continue

        const dosPuntos = linea.indexOf(':')
        const campo = dosPuntos === -1 ? linea : linea.slice(0, dosPuntos)
        let valor = dosPuntos === -1 ? '' : linea.slice(dosPuntos + 1)
        // El estándar pela un único espacio después de los dos puntos.
        if (valor.startsWith(' ')) valor = valor.slice(1)

        if (campo === 'event') {
          tipoPendiente = valor.trim()
        } else if (campo === 'data') {
          const event = tipoPendiente || EVENTO_POR_DEFECTO
          tipoPendiente = ''
          try {
            eventos.push({ event, data: JSON.parse(valor) })
          } catch {
            // JSON roto: se descarta este evento, el stream sigue.
          }
        }
      }
      return eventos
    },
  }
}

// Lo mínimo que se le pide al lector de un ReadableStream: así la lectura se
// puede probar con un lector de mentira, sin red ni DOM.
export interface LectorDeBytes {
  read(): Promise<{ done: boolean; value?: Uint8Array }>
  cancel(): Promise<void>
}

/**
 * Lee el stream hasta que el servidor lo cierra (`done: true` del lector) y
 * le pasa cada evento a `alProcesar`, en orden.
 *
 * Nunca corta la lectura por un evento: el `done` del protocolo (evento SSE)
 * llega ANTES de que el servidor termine de escribir. En el wizard, por
 * ejemplo, el `turn` se manda después del `done`, cuando termina de registrar
 * el turno en la base; si se dejara de leer al ver `done`, ese `turn` se perdía
 * y el feedback con los pulgares dejaba de andar sin avisar.
 */
export async function leerStreamSse(
  lector: LectorDeBytes,
  alProcesar: (evento: EventoSse) => void,
): Promise<void> {
  const decoder = new TextDecoder()
  const parser = crearParserSse()
  try {
    while (true) {
      const { done, value } = await lector.read()
      if (done) break
      for (const evento of parser.alimentar(decoder.decode(value, { stream: true }))) {
        alProcesar(evento)
      }
    }
  } finally {
    // Si algo tiró a mitad de camino (un handler, la red) el lector no debe
    // quedar abierto. Si ya terminó, cancelar no hace nada.
    await lector.cancel().catch(() => undefined)
  }
}
