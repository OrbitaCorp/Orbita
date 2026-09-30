import { describe, expect, it } from 'vitest'
import { crearParserSse, leerStreamSse, type LectorDeBytes } from './sseParser'

// El parser es puro: se le tira texto de a pedazos (como llegan de la red) y
// devuelve los eventos que ya quedaron completos. Lo que importa probar es que
// no pierda nada cuando la red corta el stream en cualquier lado.
describe('crearParserSse', () => {
  it('saca un evento completo que llega en un solo pedazo', () => {
    const p = crearParserSse()
    expect(p.alimentar('event: text\ndata: {"chunk":"hola"}\n\n')).toEqual([
      { event: 'text', data: { chunk: 'hola' } },
    ])
  })

  it('conserva el tipo de evento cuando event: y data: llegan en pedazos distintos', () => {
    const p = crearParserSse()
    expect(p.alimentar('event: action_start\n')).toEqual([])
    expect(p.alimentar('data: {"id":"a1","tool":"x"}\n\n')).toEqual([
      { event: 'action_start', data: { id: 'a1', tool: 'x' } },
    ])
  })

  it('junta una línea partida a la mitad entre pedazos', () => {
    const p = crearParserSse()
    expect(p.alimentar('event: te')).toEqual([])
    expect(p.alimentar('xt\ndata: {"chunk":"ho')).toEqual([])
    expect(p.alimentar('la"}\n\n')).toEqual([{ event: 'text', data: { chunk: 'hola' } }])
  })

  it('retiene la línea final sin salto hasta que llega el próximo pedazo', () => {
    const p = crearParserSse()
    expect(p.alimentar('event: done\ndata: {"ok":true}')).toEqual([])
    expect(p.alimentar('\n\n')).toEqual([{ event: 'done', data: { ok: true } }])
  })

  it('devuelve varios eventos que llegan juntos en un pedazo, en orden', () => {
    const p = crearParserSse()
    expect(
      p.alimentar(
        'event: conversation\ndata: {"id":"c1"}\n\n' +
          'event: text\ndata: {"chunk":"a"}\n\n' +
          'event: done\ndata: {}\n\n',
      ),
    ).toEqual([
      { event: 'conversation', data: { id: 'c1' } },
      { event: 'text', data: { chunk: 'a' } },
      { event: 'done', data: {} },
    ])
  })

  it('descarta un data: con JSON inválido y sigue con el evento siguiente', () => {
    const p = crearParserSse()
    expect(
      p.alimentar('event: text\ndata: {roto\n\nevent: text\ndata: {"chunk":"ok"}\n\n'),
    ).toEqual([{ event: 'text', data: { chunk: 'ok' } }])
  })

  it('un data: inválido no le deja su tipo de evento al que viene sin event:', () => {
    const p = crearParserSse()
    const out = p.alimentar('event: turn\ndata: {roto\n\ndata: {"x":1}\n\n')
    expect(out).toEqual([{ event: 'message', data: { x: 1 } }])
  })

  it('entiende \r\n como separador', () => {
    const p = crearParserSse()
    expect(p.alimentar('event: text\r\ndata: {"chunk":"hola"}\r\n\r\n')).toEqual([
      { event: 'text', data: { chunk: 'hola' } },
    ])
  })

  it('entiende \r\n aunque el \r y el \n lleguen en pedazos distintos', () => {
    const p = crearParserSse()
    expect(p.alimentar('event: text\r')).toEqual([])
    expect(p.alimentar('\ndata: {"chunk":"x"}\r')).toEqual([])
    expect(p.alimentar('\n\r\n')).toEqual([{ event: 'text', data: { chunk: 'x' } }])
  })

  it('acepta data: sin el espacio de después de los dos puntos', () => {
    const p = crearParserSse()
    expect(p.alimentar('event:text\ndata:{"chunk":"z"}\n\n')).toEqual([
      { event: 'text', data: { chunk: 'z' } },
    ])
  })

  it('ignora comentarios (líneas que empiezan con dos puntos)', () => {
    const p = crearParserSse()
    expect(p.alimentar(': keep-alive\n\nevent: text\ndata: {"chunk":"a"}\n\n')).toEqual([
      { event: 'text', data: { chunk: 'a' } },
    ])
  })
})

describe('orden de eventos después de done', () => {
  it('el parser entrega turn aunque llegue en un pedazo posterior a done', () => {
    const p = crearParserSse()
    expect(p.alimentar('event: done\ndata: {}\n\n')).toEqual([{ event: 'done', data: {} }])
    expect(p.alimentar('event: turn\ndata: {"turnId":"t1"}\n\n')).toEqual([
      { event: 'turn', data: { turnId: 't1' } },
    ])
  })
})

// Lector de mentira: devuelve los pedazos en orden y después cierra.
function lectorDe(pedazos: string[], opciones: { falla?: boolean } = {}) {
  const enc = new TextEncoder()
  let i = 0
  let cancelado = false
  const lector: LectorDeBytes = {
    async read() {
      if (i >= pedazos.length) {
        if (opciones.falla) throw new Error('red caída')
        return { done: true }
      }
      return { done: false, value: enc.encode(pedazos[i++]) }
    },
    async cancel() {
      cancelado = true
    },
  }
  return { lector, fueCancelado: () => cancelado }
}

describe('leerStreamSse', () => {
  it('sigue leyendo después de done y entrega turn (wizard: turn va tras done)', async () => {
    const { lector } = lectorDe([
      'event: text\ndata: {"chunk":"hola"}\n\n',
      'event: done\ndata: {}\n\n',
      'event: turn\ndata: {"turnId":"t1"}\n\n',
    ])
    const vistos: string[] = []
    await leerStreamSse(lector, e => vistos.push(e.event))
    expect(vistos).toEqual(['text', 'done', 'turn'])
  })

  it('cancela el lector al terminar y cuando algo tira a mitad de camino', async () => {
    const ok = lectorDe(['event: done\ndata: {}\n\n'])
    await leerStreamSse(ok.lector, () => undefined)
    expect(ok.fueCancelado()).toBe(true)

    const roto = lectorDe(['event: text\ndata: {"chunk":"a"}\n\n'], { falla: true })
    await expect(leerStreamSse(roto.lector, () => undefined)).rejects.toThrow('red caída')
    expect(roto.fueCancelado()).toBe(true)
  })
})
