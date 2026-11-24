// "Actualizar precios con Excel": la parte que no es pantalla.
//
//   - armarExcelPrecios: el archivo que se descarga desde Catálogo → "Exportar
//     Excel". Una fila por variante, con su código en la primera columna.
//   - leerExcelPrecios: lo que vuelve. Solo mira dos columnas, "Código" y
//     "Precio"; el resto (nombre, variante, stock…) está para que el dueño se
//     ubique y se ignora. El stock NO se actualiza a propósito: es el del
//     momento de exportar, y pisarlo deshacería las ventas de entre medio.
//
// No habla con la API: ActualizarPrecios.tsx manda lo leído a
// /products/precios-lote (primero simulando, después aplicando).
import type { FilaPrecioExcel } from '@/lib/api'
import { numero } from '../importar/excelProductos'

export const COLUMNA_CODIGO = 'Código (no lo cambies)'
const ESTADO: Record<FilaPrecioExcel['estado'], string> = { PUBLISHED: 'Publicado', DRAFT: 'Borrador', OUT_OF_STOCK: 'Sin stock' }
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function armarExcelPrecios(filas: FilaPrecioExcel[]): Promise<ArrayBuffer> {
    const ExcelJS = (await import('exceljs')).default
    const wb = new ExcelJS.Workbook()
    wb.creator = 'Órbita'
    wb.created = new Date()
    const ws = wb.addWorksheet('Productos', { views: [{ state: 'frozen', ySplit: 1 }] })
    ws.columns = [
        { header: COLUMNA_CODIGO, key: 'codigo', width: 38 },
        { header: 'Nombre', key: 'nombre', width: 40 },
        { header: 'Variante', key: 'variante', width: 16 },
        { header: 'Categoría', key: 'categoria', width: 20 },
        { header: 'SKU', key: 'sku', width: 16 },
        { header: 'Precio', key: 'precio', width: 15, style: { numFmt: '"$"#,##0.00' } },
        { header: 'Stock', key: 'stock', width: 9 },
        { header: 'Estado', key: 'estado', width: 12 },
    ]
    for (const f of filas) {
        ws.addRow({
            codigo: f.variantId, nombre: f.nombre, variante: f.variante, categoria: f.categoria ?? 'Sin categoría',
            sku: f.sku ?? '', precio: f.precio, stock: f.stock, estado: ESTADO[f.estado] ?? f.estado,
        })
    }
    const header = ws.getRow(1)
    header.font = { bold: true, color: { argb: 'FFFFFFFF' } }
    header.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2563EB' } }
    header.alignment = { vertical: 'middle' }
    header.height = 22
    // La columna del código, en gris: se ve que no es para tocar.
    ws.getColumn(1).eachCell((cell, i) => { if (i > 1) cell.font = { color: { argb: 'FF94A3B8' } } })
    ws.eachRow((row, i) => {
        row.eachCell(cell => {
            cell.border = {
                top: { style: 'thin', color: { argb: 'FFE2E8F0' } }, bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
                left: { style: 'thin', color: { argb: 'FFE2E8F0' } }, right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            }
        })
        if (i > 1 && i % 2 === 0) row.eachCell(cell => { cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } } })
    })
    return (await wb.xlsx.writeBuffer()) as ArrayBuffer
}

export interface LecturaPrecios {
    items: { variantId: string; price: number }[]
    /** Filas que no se pueden usar, con su número de fila en el Excel. */
    errores: { fila: number; mensaje: string }[]
}

/** Lo que trae una celda de ExcelJS: número, texto, fórmula o texto con formato. */
function valorDeCelda(v: unknown): unknown {
    if (v && typeof v === 'object') {
        const o = v as { result?: unknown; richText?: { text: string }[]; text?: string }
        if ('result' in o) return o.result
        if (Array.isArray(o.richText)) return o.richText.map(r => r.text).join('')
        if (typeof o.text === 'string') return o.text
    }
    return v
}

const plano = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()

export async function leerExcelPrecios(archivo: ArrayBuffer): Promise<LecturaPrecios> {
    const ExcelJS = (await import('exceljs')).default
    const wb = new ExcelJS.Workbook()
    await wb.xlsx.load(archivo)
    const ws = wb.worksheets[0]
    if (!ws) throw new Error('El archivo no tiene ninguna hoja.')

    let colCodigo = 0
    let colPrecio = 0
    ws.getRow(1).eachCell((cell, col) => {
        const t = plano(String(valorDeCelda(cell.value) ?? ''))
        if (!colCodigo && t.startsWith('codigo')) colCodigo = col
        if (!colPrecio && t === 'precio') colPrecio = col
    })
    if (!colCodigo || !colPrecio) {
        throw new Error('No encontramos las columnas "Código" y "Precio". Usá el Excel que se descarga con "Exportar Excel", sin borrar ni renombrar columnas.')
    }

    const items: LecturaPrecios['items'] = []
    const errores: LecturaPrecios['errores'] = []
    ws.eachRow((row, i) => {
        if (i === 1) return
        const codigo = String(valorDeCelda(row.getCell(colCodigo).value) ?? '').trim()
        const crudo = valorDeCelda(row.getCell(colPrecio).value)
        if (!codigo && (crudo === null || crudo === undefined || crudo === '')) return // fila vacía
        if (!UUID.test(codigo)) { errores.push({ fila: i, mensaje: 'El código está vacío o se modificó.' }); return }
        const precio = numero(crudo)
        if (precio === null || Number.isNaN(precio)) { errores.push({ fila: i, mensaje: 'El precio está vacío o no es un número.' }); return }
        if (precio <= 0) { errores.push({ fila: i, mensaje: 'El precio tiene que ser mayor a $0.' }); return }
        items.push({ variantId: codigo.toLowerCase(), price: Math.round(precio * 100) / 100 })
    })
    return { items, errores }
}

/** Cuánto cambió un precio, en % (positivo = subió). */
export const variacion = (antes: number, despues: number) => (antes > 0 ? ((despues - antes) / antes) * 100 : 0)

/** Un cambio que conviene mirar dos veces: más del doble o menos de la mitad (un cero de más o de menos). */
export const cambioRaro = (antes: number, despues: number) => despues >= antes * 2 || despues <= antes / 2
