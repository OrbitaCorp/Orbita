import { describe, expect, it } from 'vitest'
import ExcelJS from 'exceljs'
import { armarExcelPrecios, leerExcelPrecios, cambioRaro, COLUMNA_CODIGO } from '../excelPrecios'

const V1 = '11111111-1111-4111-8111-111111111111'
const V2 = '22222222-2222-4222-8222-222222222222'

async function editar(buffer: ArrayBuffer, cambiar: (ws: ExcelJS.Worksheet) => void): Promise<ArrayBuffer> {
    const wb = new ExcelJS.Workbook()
    await wb.xlsx.load(buffer)
    cambiar(wb.worksheets[0])
    return (await wb.xlsx.writeBuffer()) as ArrayBuffer
}

describe('Excel de "Actualizar precios"', () => {
    const filas = [
        { variantId: V1, nombre: 'Perfume A', variante: '50 ml', sku: 'PA-50', categoria: 'Unisex', precio: 100, stock: 7, estado: 'PUBLISHED' as const },
        { variantId: V2, nombre: 'Perfume A', variante: '100 ml', sku: null, categoria: null, precio: 200.5, stock: 3, estado: 'DRAFT' as const },
    ]

    it('lo que se exporta, sin tocar, vuelve con los mismos códigos y precios', async () => {
        const r = await leerExcelPrecios(await armarExcelPrecios(filas))
        expect(r.errores).toEqual([])
        expect(r.items).toEqual([{ variantId: V1, price: 100 }, { variantId: V2, price: 200.5 }])
    })

    it('lee el precio nuevo escrito como número o "a la argentina", y avisa las filas que no sirven', async () => {
        const editado = await editar(await armarExcelPrecios(filas), ws => {
            ws.getCell('F2').value = '$ 1.250,50'
            ws.getCell('F3').value = 'consultar'
            ws.addRow(['no-es-un-codigo', 'Otro', '', '', '', 50])
        })
        const r = await leerExcelPrecios(editado)
        expect(r.items).toEqual([{ variantId: V1, price: 1250.5 }])
        expect(r.errores.map(e => e.fila)).toEqual([3, 4])
    })

    it('sin las columnas Código y Precio explica qué archivo usar', async () => {
        const wb = new ExcelJS.Workbook()
        wb.addWorksheet('x').addRow(['Nombre', 'Importe'])
        await expect(leerExcelPrecios((await wb.xlsx.writeBuffer()) as ArrayBuffer)).rejects.toThrow(/Exportar Excel/)
    })

    it('el código va en la primera columna con un nombre que avisa que no se cambia', async () => {
        const wb = new ExcelJS.Workbook()
        await wb.xlsx.load(await armarExcelPrecios(filas))
        expect(wb.worksheets[0].getCell('A1').value).toBe(COLUMNA_CODIGO)
    })

    it('marca como raro un precio que se duplicó o cayó a la mitad', () => {
        expect(cambioRaro(100, 120)).toBe(false)
        expect(cambioRaro(100, 1000)).toBe(true)
        expect(cambioRaro(100, 10)).toBe(true)
    })
})
