import { describe, expect, it } from 'vitest'
import { esRutaInterna, inline, parsear, sinMarcaAbierta } from './markdown'

describe('inline', () => {
  it('negrita, cursiva y código', () => {
    expect(inline('Vendiste **$ 1.284.500** en *47* pedidos y `ABC`')).toEqual([
      { tipo: 'texto', texto: 'Vendiste ' },
      { tipo: 'negrita', partes: [{ tipo: 'texto', texto: '$ 1.284.500' }] },
      { tipo: 'texto', texto: ' en ' },
      { tipo: 'cursiva', partes: [{ tipo: 'texto', texto: '47' }] },
      { tipo: 'texto', texto: ' pedidos y ' },
      { tipo: 'codigo', texto: 'ABC' },
    ])
  })

  it('solo las rutas del panel son links; un link de afuera queda como texto', () => {
    expect(inline('Andá a [Pedidos](/admin/ventas/pedidos)')).toContainEqual({ tipo: 'link', texto: 'Pedidos', ruta: '/admin/ventas/pedidos' })
    expect(inline('[ganá plata](https://malo.com)')).toEqual([{ tipo: 'texto', texto: 'ganá plata' }])
    expect(inline('[x](//malo.com)')).toEqual([{ tipo: 'texto', texto: 'x' }])
    expect(inline('[x](javascript:alert(1))').some(l => l.tipo === 'link')).toBe(false)
  })

  it('un asterisco suelto no es cursiva', () => {
    expect(inline('5 * 3 = 15')).toEqual([{ tipo: 'texto', texto: '5 * 3 = 15' }])
  })
})

describe('esRutaInterna', () => {
  it('acepta /admin/... y rechaza esquemas y protocolos relativos', () => {
    expect(esRutaInterna('/admin/ventas/configuracion?vista=envios')).toBe(true)
    expect(esRutaInterna('https://x.com')).toBe(false)
    expect(esRutaInterna('//x.com')).toBe(false)
    expect(esRutaInterna('javascript:alert(1)')).toBe(false)
  })
})

describe('parsear', () => {
  it('párrafos con saltos, encabezados y listas', () => {
    const b = parsear('Tenés **5 productos** con poco stock.\nLos que más se venden:\n\n### Para reponer primero\n- Remera: quedan 2\n- Buzo: queda 1\n\n1. Primero\n2. Segundo')
    expect(b.map(x => x.tipo)).toEqual(['parrafo', 'titulo', 'lista', 'lista'])
    expect(b[0]).toMatchObject({ tipo: 'parrafo', partes: expect.arrayContaining([{ tipo: 'salto' }]) })
    expect(b[2]).toMatchObject({ tipo: 'lista', ordenada: false })
    expect((b[2] as { items: unknown[] }).items).toHaveLength(2)
    expect(b[3]).toMatchObject({ tipo: 'lista', ordenada: true })
  })

  it('tablas: encabezado, filas completas y columnas numéricas a la derecha', () => {
    const b = parsear('| Día | Pedidos | Total |\n|---|---:|---:|\n| Sáb 26/9 | 11 | $ 342.100 |\n| Dom 27/9 | 9 |\n\nListo.')
    expect(b[0]).toMatchObject({ tipo: 'tabla', numericas: [false, true, true] })
    const tabla = b[0] as { filas: unknown[][] }
    expect(tabla.filas).toHaveLength(2)
    expect(tabla.filas[1]).toHaveLength(3)
    expect(b[1]).toMatchObject({ tipo: 'parrafo' })
  })

  it('una línea con | sin separador no es tabla', () => {
    expect(parsear('Opción A | Opción B')[0].tipo).toBe('parrafo')
  })

  it('vacío, nada', () => {
    expect(parsear('\n\n')).toEqual([])
  })
})

describe('sinMarcaAbierta', () => {
  it('saca la negrita que todavía no se cerró y deja las cerradas', () => {
    expect(sinMarcaAbierta('Vendiste **$ 1.2')).toBe('Vendiste $ 1.2')
    expect(sinMarcaAbierta('Vendiste **$ 1.2** en')).toBe('Vendiste **$ 1.2** en')
  })
})
