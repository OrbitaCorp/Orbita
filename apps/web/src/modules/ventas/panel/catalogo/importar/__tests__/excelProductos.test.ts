import { describe, expect, it } from 'vitest'
import { armarPlantilla, armarProductos, leerExcel, numero, valores, type FilaCruda } from '../excelProductos'

const fila = (n: number, datos: Omit<FilaCruda, 'fila'>): FilaCruda => ({ fila: n, ...datos })

describe('numero', () => {
    it('entiende los formatos que deja Excel y los que escribe la gente', () => {
        expect(numero(15000)).toBe(15000)
        expect(numero('15000')).toBe(15000)
        expect(numero('15.000')).toBe(15000)
        expect(numero('$ 15.000,50')).toBe(15000.5)
        expect(numero('15000.5')).toBe(15000.5)
        expect(numero('')).toBeNull()
        expect(numero(null)).toBeNull()
        expect(numero('quince mil')).toBeNaN()
    })
})

describe('valores', () => {
    it('separa por coma o punto y coma, y no repite el mismo valor escrito distinto', () => {
        expect(valores('Rojo, Azul,  negro')).toEqual(['Rojo', 'Azul', 'negro'])
        expect(valores('S;M;L')).toEqual(['S', 'M', 'L'])
        expect(valores('Rojo, rojo, ROJO, Azul')).toEqual(['Rojo', 'Azul'])
        expect(valores(39)).toEqual(['39'])
        expect(valores('')).toEqual([])
        expect(valores(null)).toEqual([])
    })
})

describe('armarProductos', () => {
    it('un producto sin variantes es una fila, con los mismos datos que el alta manual', () => {
        const r = armarProductos([fila(2, { nombre: 'Gorra', categoria: 'Accesorios', precio: 9500, costo: 4000, stock: 20, descripcion: 'Con visera', estado: 'Publicado' })])
        expect(r.errores).toEqual([])
        expect(r.productos).toHaveLength(1)
        const p = r.productos[0]
        expect(p.cantVariantes).toBe(0)
        expect(p.input).toEqual({
            name: 'Gorra', description: 'Con visera', basePrice: 9500, cost: 4000, status: 'PUBLISHED',
            variants: [{ sku: 'GORRA', price: 9500, optionValues: [], initialStock: 20, stockMin: 5 }],
        })
        expect(r.categorias).toEqual(['Accesorios'])
    })

    it('con una fila se arman todas las combinaciones de las variantes', () => {
        const r = armarProductos([
            fila(2, { nombre: 'Remera lisa', categoria: 'Ropa', precio: 15000, stock: 5, variante1: 'Color', valores1: 'Rojo, Azul, Negro', variante2: 'Talle', valores2: 'S, M, L, XL' }),
        ])
        expect(r.errores).toEqual([])
        const p = r.productos[0]
        expect(p.cantVariantes).toBe(12)
        expect(p.stockTotal).toBe(60)
        expect(p.publicado).toBe(false)
        expect(p.resumenVariantes).toBe('Color: Rojo, Azul, Negro · Talle: S, M, L, XL')
        // Color es la variante con fotos propias; el talle no.
        expect(p.input.options).toEqual([
            { name: 'Color', values: ['Rojo', 'Azul', 'Negro'], isVisual: true },
            { name: 'Talle', values: ['S', 'M', 'L', 'XL'] },
        ])
        expect(p.input.variants).toHaveLength(12)
        expect(p.input.variants.slice(0, 5).map(v => v.optionValues)).toEqual([['Rojo', 'S'], ['Rojo', 'M'], ['Rojo', 'L'], ['Rojo', 'XL'], ['Azul', 'S']])
        expect(p.input.variants.every(v => v.price === 15000 && v.initialStock === 5)).toBe(true)
    })

    it('un talle no es una variante con fotos propias', () => {
        const r = armarProductos([fila(2, { nombre: 'Zapatilla', categoria: 'Calzado', precio: 62000, variante1: 'Talle', valores1: '39, 40' })])
        expect(r.productos[0].input.options).toEqual([{ name: 'Talle', values: ['39', '40'] }])
    })

    it('avisa fila por fila lo que hay que corregir y no arma ese producto', () => {
        const r = armarProductos([
            fila(2, { categoria: 'Ropa', precio: 100 }),
            fila(3, { nombre: 'Sin precio', categoria: 'Ropa' }),
            fila(4, { nombre: 'Sin categoría', precio: 100 }),
            fila(5, { nombre: 'Precio raro', categoria: 'Ropa', precio: 'mil' }),
            fila(6, { nombre: 'Stock raro', categoria: 'Ropa', precio: 100, stock: 2.5 }),
            fila(7, { nombre: 'Variante sin valores', categoria: 'Ropa', precio: 100, variante1: 'Color' }),
            fila(8, { nombre: 'Valores sin variante', categoria: 'Ropa', precio: 100, valores1: 'Rojo, Azul' }),
            fila(9, { nombre: 'Bien', categoria: 'Ropa', precio: 100 }),
        ])
        expect(r.productos.map(p => p.nombre)).toEqual(['Bien'])
        expect(r.errores.map(e => `${e.fila}:${e.columna}`)).toEqual(['2:Nombre', '3:Precio', '4:Categoría', '5:Precio', '6:Stock', '7:Valores 1', '8:Variante 1'])
    })

    it('el mismo nombre en dos filas es un error: va una fila por producto', () => {
        const r = armarProductos([
            fila(2, { nombre: 'Gorra', categoria: 'Accesorios', precio: 100 }),
            fila(3, { nombre: 'gorra', categoria: 'Accesorios', precio: 200 }),
        ])
        expect(r.productos.map(p => p.nombre)).toEqual(['Gorra'])
        expect(r.errores).toHaveLength(1)
        expect(r.errores[0]).toMatchObject({ fila: 3, columna: 'Nombre' })
    })

    it('para publicar hace falta stock, como en el alta manual', () => {
        const r = armarProductos([fila(2, { nombre: 'Gorra', categoria: 'Accesorios', precio: 100, estado: 'Publicado' })])
        expect(r.errores[0]).toMatchObject({ fila: 2, columna: 'Estado' })
    })

    it('no deja pasar más variantes de las que acepta un producto', () => {
        const muchos = Array.from({ length: 20 }, (_, i) => `v${i}`).join(', ')
        const r = armarProductos([fila(2, { nombre: 'Enorme', categoria: 'Ropa', precio: 100, variante1: 'A', valores1: muchos, variante2: 'B', valores2: muchos })])
        expect(r.productos).toEqual([])
        expect(r.errores[0].mensaje).toMatch(/400 variantes/)
    })
})

describe('SKU automático', () => {
    it('sale del nombre y de los valores de cada variante, como en el alta manual', () => {
        const r = armarProductos([
            fila(2, { nombre: 'Remera lisa', categoria: 'Ropa', precio: 100, variante1: 'Color', valores1: 'Rojo, Azul', variante2: 'Talle', valores2: 'M' }),
            fila(3, { nombre: 'Licuadora', categoria: 'Electro', precio: 100 }),
        ])
        expect(r.productos[0].input.variants.map(v => v.sku)).toEqual(['REM-LIS-ROJ-M', 'REM-LIS-AZU-M'])
        expect(r.productos[1].input.variants.map(v => v.sku)).toEqual(['LICUAD'])
    })

    it('dos productos que darían el mismo código no chocan', () => {
        const r = armarProductos([
            fila(2, { nombre: 'Remera lisa', categoria: 'Ropa', precio: 100 }),
            fila(3, { nombre: 'Remera lisboa', categoria: 'Ropa', precio: 100 }),
            fila(4, { nombre: 'Remera lista', categoria: 'Ropa', precio: 100 }),
        ])
        expect(r.productos.map(x => x.input.variants[0].sku)).toEqual(['REM-LIS', 'REM-LIS-2', 'REM-LIS-3'])
    })
})

describe('plantilla', () => {
    it('trae un ejemplo de cada rubro en la hoja de productos, y esos no se importan', async () => {
        const plantilla = await armarPlantilla(['Ropa', 'Calzado'])
        const ExcelJS = (await import('exceljs')).default
        const wb = new ExcelJS.Workbook()
        await wb.xlsx.load(await plantilla.arrayBuffer())
        const hoja = wb.getWorksheet('Productos')!
        // Una fila por producto: 4 ejemplos y el encabezado.
        expect(hoja.rowCount).toBe(5)
        expect(String(hoja.getCell(2, 1).value)).toBe('(Ejemplo) Remera lisa')
        expect((hoja.getColumn(2).values as unknown[]).filter(Boolean)).toEqual(expect.arrayContaining(['Ropa', 'Electrodomésticos', 'Juguetes', 'Electrónica']))
        // Las columnas son los campos del alta manual, sin SKU ni precio anterior.
        expect((hoja.getRow(1).values as unknown[]).filter(Boolean)).toEqual(['Nombre *', 'Categoría *', 'Precio *', 'Costo', 'Stock', 'Descripción', 'Variante 1', 'Valores 1', 'Variante 2', 'Valores 2', 'Estado'])
        // Subirla tal cual se descargó no crea los ejemplos: avisa que falta completar.
        await expect(leerExcel(plantilla)).rejects.toThrow(/no tiene productos tuyos/)
    }, 30_000) // la primera carga de exceljs es lenta con la máquina ocupada

    it('lee un archivo completado sobre la plantilla', async () => {
        const ExcelJS = (await import('exceljs')).default
        const wb = new ExcelJS.Workbook()
        await wb.xlsx.load(await (await armarPlantilla(['Ropa'])).arrayBuffer())
        const hoja = wb.getWorksheet('Productos')!
        hoja.addRow(['Remera lisa', 'Ropa', '15.000', '', 8, 'De algodón', 'Color', 'Rojo, Azul', '', '', 'Publicado'])
        const archivo = new Blob([await wb.xlsx.writeBuffer()])

        const r = armarProductos(await leerExcel(archivo))
        expect(r.errores).toEqual([])
        expect(r.productos).toHaveLength(1)
        expect(r.productos[0]).toMatchObject({ nombre: 'Remera lisa', cantVariantes: 2, stockTotal: 16, precio: 15000, publicado: true })
    }, 30_000)
})
