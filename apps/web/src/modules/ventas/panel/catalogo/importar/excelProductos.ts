// Importación masiva de productos desde Excel: la parte que no es pantalla.
//
//   - qué columnas lleva la plantilla y cómo se arma el archivo,
//   - cómo se lee lo que el dueño completó,
//   - qué se valida antes de crear nada, y
//   - cómo sale de cada fila un producto con todas sus variantes.
//
// Regla de la plantilla: UNA FILA POR PRODUCTO. Las columnas son los mismos
// campos que pide "Crear producto" (ProductoNuevo.tsx), con los mismos nombres:
// nombre, categoría, precio, costo, stock, descripción, variantes y estado. Lo
// que esa pantalla arma sola (el SKU) acá también se arma solo, y lo que carga
// aparte (las fotos) acá también va aparte.
//
// Las variantes no se repiten fila por fila: se escribe la variante ("Color") y
// sus valores separados por coma ("Rojo, Azul, Negro") y se generan todas las
// combinaciones, igual que en el alta manual. Todas nacen con el precio y el
// stock de la fila; lo que cambie entre una y otra se ajusta después en el panel.
//
// No habla con la API: devuelve el mismo `UpsertProductInput` que usa el alta
// manual, así que el backend valida exactamente lo mismo.
import type { UpsertProductInput } from '@/lib/api'

// ─── Columnas ────────────────────────────────────────────────────────────────

export const COLUMNAS = [
    { clave: 'nombre', titulo: 'Nombre', ancho: 34, obligatoria: true, ayuda: 'El nombre del producto. Una fila por producto.' },
    { clave: 'categoria', titulo: 'Categoría', ancho: 22, obligatoria: true, ayuda: 'Elegila de la lista o escribí una nueva: si no existe, se crea sola.' },
    { clave: 'precio', titulo: 'Precio', ancho: 14, obligatoria: true, ayuda: 'Precio de venta, sin signo $. Ej: 15000. Si tiene variantes, todas arrancan con este precio.' },
    { clave: 'costo', titulo: 'Costo', ancho: 12, obligatoria: false, ayuda: 'Opcional. Lo que te cuesta a vos; solo vos lo ves.' },
    { clave: 'stock', titulo: 'Stock', ancho: 10, obligatoria: false, ayuda: 'Unidades disponibles. Si tiene variantes, es el stock de CADA variante. Vacío = 0.' },
    { clave: 'descripcion', titulo: 'Descripción', ancho: 44, obligatoria: false, ayuda: 'Opcional. Lo que se lee en la ficha del producto.' },
    { clave: 'variante1', titulo: 'Variante 1', ancho: 16, obligatoria: false, ayuda: 'Opcional. Qué se puede elegir del producto. Ej: Color' },
    { clave: 'valores1', titulo: 'Valores 1', ancho: 26, obligatoria: false, ayuda: 'Los valores de esa variante, separados por coma. Ej: Rojo, Azul, Negro' },
    { clave: 'variante2', titulo: 'Variante 2', ancho: 16, obligatoria: false, ayuda: 'Opcional. Una segunda variante. Ej: Talle' },
    { clave: 'valores2', titulo: 'Valores 2', ancho: 26, obligatoria: false, ayuda: 'Los valores, separados por coma. Ej: S, M, L. Se arman solas todas las combinaciones con la variante 1.' },
    { clave: 'estado', titulo: 'Estado', ancho: 13, obligatoria: false, ayuda: 'Publicado o Borrador. Vacío = Borrador (lo publicás cuando tenga fotos). Para publicar tiene que tener stock.' },
] as const

export type ClaveColumna = typeof COLUMNAS[number]['clave']
export type FilaCruda = Partial<Record<ClaveColumna, unknown>> & { fila: number }

// Topes: los mismos del alta manual (create-product.dto.ts) y uno propio para
// el archivo entero.
export const MAX_FILAS = 5000
const MAX_NOMBRE = 150
const MAX_DESCRIPCION = 5000
const MAX_VARIANTES = 200
const MAX_VALORES = 50
const MAX_TEXTO_VALOR = 60
const MAX_TEXTO_OPCION = 40
const MAX_SKU = 64
const MAX_PRECIO = 1_000_000_000
const MAX_STOCK = 1_000_000
// El "Stock mínimo de alerta" con el que arranca el alta manual.
const STOCK_MINIMO = 5

/** Sin acentos, sin mayúsculas y sin espacios de más: para comparar nombres. */
export const plano = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim()

const texto = (v: unknown) => (v == null ? '' : String(v).replace(/\s+/g, ' ').trim())

/**
 * Un número escrito "a la argentina" o como lo deja Excel: 15000, "15.000",
 * "$ 15.000,50", "15000.5". Devuelve null si no hay nada y NaN si no se entiende.
 */
export function numero(v: unknown): number | null {
    if (v == null || v === '') return null
    if (typeof v === 'number') return v
    let s = String(v).replace(/[$\s]/g, '')
    if (!s) return null
    if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.')
    else if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '')
    return /^-?\d+(\.\d+)?$/.test(s) ? Number(s) : NaN
}

/**
 * "Rojo, Azul; negro" → ["Rojo", "Azul", "negro"]. Se separa por coma, punto y
 * coma o salto de línea, y el mismo valor escrito distinto ("rojo" / "Rojo")
 * cuenta una sola vez, como se escribió primero.
 */
export function valores(v: unknown): string[] {
    const lista: string[] = []
    for (const parte of (v == null ? '' : String(v)).split(/[,;\n]/)) {
        const t = texto(parte)
        if (t && !lista.some(x => plano(x) === plano(t))) lista.push(t)
    }
    return lista
}

// ─── SKU automático ──────────────────────────────────────────────────────────
// Nadie completa el SKU a mano en un Excel, así que no se pide: se arma solo
// con la misma regla del alta manual (ProductoNuevo.tsx, generarSKU): las
// primeras letras de las palabras del nombre y, en cada variante, las de sus
// valores. "Remera lisa" en Rojo / M queda REM-LIS-ROJ-M. Si dos productos
// del archivo darían el mismo código, se numera (-2, -3…).
const SKU_VACIAS = new Set(['de', 'del', 'la', 'el', 'los', 'las', 'un', 'una', 'unos', 'unas', 'y', 'con', 'para', 'en'])
const paraSku = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/[^A-Z0-9\s]/g, '').trim()

export function skuDeNombre(nombre: string): string {
    const palabras = paraSku(nombre).split(/\s+/).filter(x => x && !SKU_VACIAS.has(x.toLowerCase()))
    if (palabras.length === 0) return 'SKU'
    if (palabras.length === 1) return palabras[0].slice(0, 6)
    return palabras.slice(0, 3).map(x => x.slice(0, 3)).join('-')
}
const skuDeValor = (valor: string) => paraSku(valor).replace(/\s+/g, '').slice(0, 3)

/** Devuelve `base` o, si ya se usó, `base-2`, `base-3`… y lo deja anotado como usado. */
function skuLibre(base: string, usados: Set<string>): string {
    let sku = base.slice(0, MAX_SKU)
    for (let n = 2; usados.has(sku); n++) sku = `${base.slice(0, MAX_SKU - 5)}-${n}`
    usados.add(sku)
    return sku
}

// ─── Resultado de leer el archivo ────────────────────────────────────────────

export interface ErrorFila { fila: number; columna: string; mensaje: string }

export interface ProductoImportable {
    /** Clave estable del producto dentro de la importación (su nombre, normalizado). */
    clave: string
    nombre: string
    categoria: string
    /** Fila del Excel, para ubicarlo si falla al crearse. */
    fila: number
    /** 0 = producto sin variantes. */
    cantVariantes: number
    /** "Color: Rojo, Azul · Talle: S, M" — para mostrar en la revisión. */
    resumenVariantes: string
    stockTotal: number
    precio: number
    publicado: boolean
    /** Todo menos categoryId, que se resuelve recién al importar (puede haber que crearla). */
    input: Omit<UpsertProductInput, 'categoryId'>
}

export interface Lectura {
    productos: ProductoImportable[]
    errores: ErrorFila[]
    /** Filas con datos que se leyeron (sin contar el encabezado, las vacías ni los ejemplos). */
    filas: number
    /** Categorías escritas en el archivo, tal como las escribió el dueño (una por nombre). */
    categorias: string[]
}

// Qué variante lleva fotos propias por valor: solo las que cambian cómo se ve
// el producto. Un talle no cambia la foto; un color sí.
const ES_VISUAL = /^(color|colores|diseno|disenos|modelo|estampa|estampado|motivo|tono|acabado|terminacion)$/

const ESTADOS: Record<string, boolean> = { publicado: true, publicada: true, activo: true, si: true, borrador: false, oculto: false, no: false, '': false }

/** Valida las filas ya leídas del Excel y arma un producto por fila. Pura: no toca el archivo ni la API. */
export function armarProductos(filas: FilaCruda[]): Lectura {
    const errores: ErrorFila[] = []
    const productos: ProductoImportable[] = []
    const categorias = new Map<string, string>()
    const skusUsados = new Set<string>()
    const vistos = new Map<string, number>()

    for (const f of filas) {
        const antes = errores.length
        const error = (columna: string, mensaje: string) => errores.push({ fila: f.fila, columna, mensaje })

        const nombre = texto(f.nombre)
        if (!nombre) { error('Nombre', 'Falta el nombre del producto.'); continue }
        if (nombre.length > MAX_NOMBRE) error('Nombre', `El nombre no puede tener más de ${MAX_NOMBRE} caracteres.`)
        const clave = plano(nombre)
        if (vistos.has(clave)) error('Nombre', `"${nombre}" ya está en la fila ${vistos.get(clave)}. Va una fila por producto: si son variantes, escribilas en "Valores 1" separadas por coma; si son productos distintos, cambiales el nombre.`)
        else vistos.set(clave, f.fila)

        const categoria = texto(f.categoria)
        if (!categoria) error('Categoría', 'Falta la categoría.')
        else if (categoria.length > 60) error('Categoría', 'El nombre de la categoría es demasiado largo (máximo 60 caracteres).')

        const precio = numero(f.precio)
        if (precio == null) error('Precio', 'Falta el precio.')
        else if (Number.isNaN(precio)) error('Precio', 'El precio tiene que ser un número (sin letras ni símbolos).')
        else if (precio <= 0) error('Precio', 'El precio tiene que ser mayor a $0.')
        else if (precio > MAX_PRECIO) error('Precio', 'El precio es demasiado alto.')

        const costo = numero(f.costo)
        if (costo != null && (Number.isNaN(costo) || costo < 0)) error('Costo', 'El costo tiene que ser un número, o quedar vacío.')

        const stock = numero(f.stock)
        if (stock != null && (Number.isNaN(stock) || stock < 0 || !Number.isInteger(stock))) error('Stock', 'El stock tiene que ser un número entero, sin decimales ni negativos.')
        else if (stock != null && stock > MAX_STOCK) error('Stock', 'El stock es demasiado alto.')
        const stockOk = stock != null && !Number.isNaN(stock) ? stock : 0

        const descripcion = texto(f.descripcion)
        if (descripcion.length > MAX_DESCRIPCION) error('Descripción', `La descripción no puede tener más de ${MAX_DESCRIPCION} caracteres.`)

        const estadoTxt = plano(texto(f.estado))
        if (!(estadoTxt in ESTADOS)) error('Estado', 'El estado tiene que ser "Publicado" o "Borrador".')
        const publicado = ESTADOS[estadoTxt] ?? false

        // ── Variantes ──
        const op1 = texto(f.variante1)
        const op2 = texto(f.variante2)
        const v1 = valores(f.valores1)
        const v2 = valores(f.valores2)
        if (op1 && v1.length === 0) error('Valores 1', `Faltan los valores de "${op1}", separados por coma (por ejemplo: Rojo, Azul).`)
        if (!op1 && v1.length > 0) error('Variante 1', 'Hay valores pero falta decir de qué variante son (por ejemplo: Color).')
        if (op2 && v2.length === 0) error('Valores 2', `Faltan los valores de "${op2}", separados por coma (por ejemplo: S, M, L).`)
        if (!op2 && v2.length > 0) error('Variante 2', 'Hay valores pero falta decir de qué variante son (por ejemplo: Talle).')
        if ((op2 || v2.length > 0) && !op1 && v1.length === 0) error('Variante 2', 'Completá primero "Variante 1": no puede haber una segunda variante sin la primera.')
        if (op1 && op2 && plano(op1) === plano(op2)) error('Variante 2', 'Las dos variantes no pueden llamarse igual.')
        for (const [col, op] of [['Variante 1', op1], ['Variante 2', op2]] as const) {
            if (op.length > MAX_TEXTO_OPCION) error(col, `El nombre de la variante no puede tener más de ${MAX_TEXTO_OPCION} caracteres.`)
        }
        for (const [col, lista] of [['Valores 1', v1], ['Valores 2', v2]] as const) {
            if (lista.length > MAX_VALORES) error(col, `Hay ${lista.length} valores: el máximo por variante es ${MAX_VALORES}.`)
            const largo = lista.find(x => x.length > MAX_TEXTO_VALOR)
            if (largo) error(col, `"${largo.slice(0, 30)}…" es demasiado largo: cada valor puede tener hasta ${MAX_TEXTO_VALOR} caracteres. ¿Faltó una coma entre dos valores?`)
        }

        const opciones = [op1 && v1.length ? { name: op1, values: v1 } : null, op2 && v2.length ? { name: op2, values: v2 } : null]
            .filter((x): x is { name: string; values: string[] } => x !== null)
        // Todas las combinaciones, en el orden en que se escribieron (como el alta manual).
        const combinaciones: string[][] = opciones.reduce<string[][]>((acc, o) => acc.flatMap(c => o.values.map(v => [...c, v])), [[]])
        if (combinaciones.length > MAX_VARIANTES) error('Valores 1', `Con esos valores salen ${combinaciones.length} variantes: el máximo por producto es ${MAX_VARIANTES}.`)

        const stockTotal = stockOk * combinaciones.length
        // Misma regla del alta manual: "Para publicar necesitás stock".
        if (publicado && stockTotal <= 0) error('Estado', 'Para publicarlo tiene que tener stock. Cargale stock o dejalo como Borrador.')

        if (errores.length > antes) continue // con errores no se arma: se corrige el archivo y se vuelve a subir

        if (!categorias.has(plano(categoria))) categorias.set(plano(categoria), categoria)
        // Recién acá, con el producto ya validado: un producto con errores no gasta códigos.
        const skuBase = skuLibre(skuDeNombre(nombre), skusUsados)
        const variants: UpsertProductInput['variants'] = combinaciones.map(optionValues => {
            const sufijo = optionValues.map(skuDeValor).filter(Boolean).join('-')
            return { sku: sufijo ? skuLibre(`${skuBase}-${sufijo}`, skusUsados) : skuBase, price: precio!, optionValues, initialStock: stockOk, stockMin: STOCK_MINIMO }
        })
        // A lo sumo una variante lleva fotos por valor: la primera que sea "de aspecto".
        const visual = opciones.findIndex(o => ES_VISUAL.test(plano(o.name)))

        productos.push({
            clave, nombre, categoria: categorias.get(plano(categoria))!, fila: f.fila,
            cantVariantes: opciones.length ? variants.length : 0,
            resumenVariantes: opciones.map(o => `${o.name}: ${o.values.join(', ')}`).join(' · '),
            stockTotal, precio: precio!, publicado,
            input: {
                name: nombre,
                ...(descripcion ? { description: descripcion } : {}),
                basePrice: precio!,
                ...(costo != null ? { cost: costo } : {}),
                status: publicado ? 'PUBLISHED' : 'DRAFT',
                ...(opciones.length ? { options: opciones.map((o, i) => ({ ...o, ...(i === visual ? { isVisual: true } : {}) })) } : {}),
                variants,
            },
        })
    }

    return { productos, errores: errores.sort((a, b) => a.fila - b.fila), filas: filas.length, categorias: [...categorias.values()] }
}

// ─── Leer el .xlsx ───────────────────────────────────────────────────────────

/** Lo que devuelve una celda de ExcelJS puede ser texto enriquecido, una fórmula o un link. */
function valorCelda(v: unknown): unknown {
    if (v == null) return null
    if (typeof v !== 'object' || v instanceof Date) return v
    const o = v as { richText?: { text: string }[]; result?: unknown; text?: unknown; error?: unknown }
    if (Array.isArray(o.richText)) return o.richText.map(t => t.text).join('')
    if ('result' in o) return valorCelda(o.result)
    if ('text' in o) return valorCelda(o.text)
    return null
}

export class ArchivoInvalido extends Error {}

// Los ejemplos van en la misma hoja que se completa, arriba de todo, para que
// se entienda de un vistazo cómo se carga cada tipo de producto. Llevan la
// marca "(Ejemplo)" en el nombre: al importar se saltean solos, así que se
// pueden borrar o dejar.
export const MARCA_EJEMPLO = '(Ejemplo)'

/** Lee la hoja "Productos" (o la primera) y devuelve las filas con datos. */
export async function leerExcel(archivo: Blob): Promise<FilaCruda[]> {
    const ExcelJS = (await import('exceljs')).default
    const wb = new ExcelJS.Workbook()
    try { await wb.xlsx.load(await archivo.arrayBuffer()) }
    catch { throw new ArchivoInvalido('No pudimos abrir el archivo. Tiene que ser un Excel (.xlsx): si lo tenés en otro formato, abrilo y usá "Guardar como → Libro de Excel".') }

    const hoja = wb.worksheets.find(w => plano(w.name) === 'productos') ?? wb.worksheets[0]
    if (!hoja) throw new ArchivoInvalido('El archivo no tiene ninguna hoja.')

    // Las columnas se ubican por su título, no por su posición: si el dueño las reordenó o agregó otras, igual se leen.
    const titulos = new Map(COLUMNAS.map(c => [plano(c.titulo), c.clave]))
    const columnas = new Map<number, ClaveColumna>()
    hoja.getRow(1).eachCell((celda, n) => {
        const clave = titulos.get(plano(texto(valorCelda(celda.value)).replace(/\*/g, '')))
        if (clave) columnas.set(n, clave)
    })
    const faltan = COLUMNAS.filter(c => c.obligatoria && ![...columnas.values()].includes(c.clave)).map(c => c.titulo)
    if (faltan.length) throw new ArchivoInvalido(`Al archivo le falta${faltan.length === 1 ? ' la columna' : 'n las columnas'} ${faltan.join(', ')}. Descargá la plantilla y completala sin cambiar los títulos de la primera fila.`)

    const filas: FilaCruda[] = []
    hoja.eachRow((fila, n) => {
        if (n === 1) return
        const f: FilaCruda = { fila: n }
        let conDatos = false
        for (const [col, clave] of columnas) {
            const v = valorCelda(fila.getCell(col).value)
            if (v != null && texto(v) !== '') { f[clave] = v; conDatos = true }
        }
        // Las filas de ejemplo de la plantilla no son productos del dueño.
        if (conDatos && !plano(texto(f.nombre)).startsWith(plano(MARCA_EJEMPLO))) filas.push(f)
    })
    if (filas.length === 0) throw new ArchivoInvalido('El archivo no tiene productos tuyos todavía: completá al menos uno en la hoja "Productos", debajo de las filas de ejemplo (esas no se importan).')
    if (filas.length > MAX_FILAS) throw new ArchivoInvalido(`El archivo tiene ${filas.length} productos: el máximo por importación es ${MAX_FILAS}. Partilo en dos archivos.`)
    return filas
}

// ─── La plantilla ────────────────────────────────────────────────────────────

// Uno de cada rubro, para que cualquiera encuentre uno parecido al suyo. Una
// fila cada uno, también el que tiene variantes: los valores van separados por
// coma y las combinaciones se arman solas.
const EJEMPLO: (string | number)[][] = [
    [`${MARCA_EJEMPLO} Remera lisa`, 'Ropa', 15000, 7000, 5, 'Remera de algodón peinado, corte clásico.', 'Color', 'Rojo, Azul, Negro', 'Talle', 'S, M, L, XL', 'Borrador'],
    [`${MARCA_EJEMPLO} Licuadora 600 W`, 'Electrodomésticos', 89000, 52000, 6, 'Vaso de vidrio de 1,5 litros y 3 velocidades.', '', '', '', '', 'Publicado'],
    [`${MARCA_EJEMPLO} Bloques para armar`, 'Juguetes', 12500, 6000, 15, 'Bloques de encastre de colores, a partir de 4 años.', '', '', '', '', 'Borrador'],
    [`${MARCA_EJEMPLO} Auriculares bluetooth`, 'Electrónica', 38000, 21000, 10, 'Inalámbricos, con estuche de carga y 20 horas de batería.', 'Color', 'Negro, Blanco', '', '', 'Borrador'],
]

const AZUL = 'FF2563EB'
const AZUL_SUAVE = 'FFEFF6FF'

/** Arma el .xlsx de la plantilla, con las categorías del negocio como lista desplegable. */
export async function armarPlantilla(categorias: string[]): Promise<Blob> {
    const ExcelJS = (await import('exceljs')).default
    const wb = new ExcelJS.Workbook()
    wb.creator = 'Órbita'

    const hoja = wb.addWorksheet('Productos', { views: [{ state: 'frozen', ySplit: 1 }] })
    hoja.columns = COLUMNAS.map(c => ({ header: c.obligatoria ? `${c.titulo} *` : c.titulo, key: c.clave, width: c.ancho }))
    const cab = hoja.getRow(1)
    cab.height = 26
    cab.eachCell((celda, n) => {
        const col = COLUMNAS[n - 1]
        celda.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 }
        celda.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: col.obligatoria ? AZUL : 'FF475569' } }
        celda.alignment = { vertical: 'middle', horizontal: 'left' }
        celda.note = col.ayuda
    })

    // Listas desplegables, en una hoja aparte para no ensuciar la principal.
    const listas = wb.addWorksheet('Listas', { state: 'hidden' })
    listas.getColumn(1).values = ['Categorías', ...categorias]
    listas.getColumn(2).values = ['Estado', 'Borrador', 'Publicado']
    const iCat = COLUMNAS.findIndex(c => c.clave === 'categoria') + 1
    const iEstado = COLUMNAS.findIndex(c => c.clave === 'estado') + 1
    // Se aplican por rango y no celda por celda: con miles de filas, validar
    // una por una hacía tardar varios segundos la descarga (y la lectura después).
    const validaciones = (hoja as unknown as { dataValidations: { add: (rango: string, v: object) => void } }).dataValidations
    const rango = (col: number) => { const letra = hoja.getColumn(col).letter; return `${letra}2:${letra}${MAX_FILAS + 1}` }
    if (categorias.length) {
        // Aviso y no bloqueo: se puede escribir una categoría nueva, que se crea al importar.
        validaciones.add(rango(iCat), {
            type: 'list', allowBlank: true, formulae: [`Listas!$A$2:$A$${categorias.length + 1}`],
            showErrorMessage: true, errorStyle: 'warning', errorTitle: 'Categoría nueva',
            error: 'Esa categoría todavía no existe en tu tienda. Si seguís, se va a crear al importar.',
        })
    }
    validaciones.add(rango(iEstado), {
        type: 'list', allowBlank: true, formulae: ['Listas!$B$2:$B$3'],
        showErrorMessage: true, errorStyle: 'stop', errorTitle: 'Estado', error: 'Elegí Publicado o Borrador.',
    })
    for (const clave of ['precio', 'costo'] as const) hoja.getColumn(clave).numFmt = '#,##0.00'

    // Filas de ejemplo, en gris y cursiva para que no se confundan con las propias.
    EJEMPLO.forEach(f => {
        const fila = hoja.addRow(f)
        fila.eachCell({ includeEmpty: true }, celda => {
            celda.font = { italic: true, color: { argb: 'FF64748B' } }
            celda.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: AZUL_SUAVE } }
        })
    })
    hoja.getCell(2, 1).note = 'Estas filas son de ejemplo, una de cada rubro. La remera tiene dos variantes (3 colores y 4 talles): con una sola fila se crean sus 12 combinaciones. La licuadora y los bloques no tienen variantes. Los auriculares vienen en dos colores. No se importan: escribí tus productos debajo, o borralas y arrancá desde acá.'

    const ayuda = wb.addWorksheet('Cómo completar')
    ayuda.getColumn(1).width = 22
    ayuda.getColumn(2).width = 100
    const linea = (a: string, b = '', negrita = false) => {
        const r = ayuda.addRow([a, b])
        r.getCell(1).font = { bold: true }
        if (negrita) r.getCell(2).font = { bold: true }
        r.getCell(2).alignment = { wrapText: true, vertical: 'top' }
        return r
    }
    linea('Cómo completar la plantilla').font = { bold: true, size: 14 }
    linea('')
    linea('1.', 'Una fila por producto, en la hoja "Productos", debajo de las filas grises de ejemplo. Esas filas no se importan: podés dejarlas o borrarlas. No cambies los títulos de la primera fila.')
    linea('2.', 'Son los mismos datos que pide "Crear producto" en el panel: nombre, categoría, precio, costo, stock, descripción, variantes y estado.')
    linea('3.', 'Si el producto tiene variantes, no hace falta repetirlo: escribí la variante (Color) y sus valores separados por coma (Rojo, Azul, Negro). Con una segunda variante (Talle: S, M, L) se arman solas todas las combinaciones.')
    linea('4.', 'Todas las variantes arrancan con el precio y el stock de la fila. Si alguna tiene otro precio o no la vendés, lo ajustás después desde el producto.')
    linea('5.', 'El SKU no se completa: se genera solo, igual que al crear un producto a mano.')
    linea('6.', 'Las fotos no van en el Excel: después de importar, la página te muestra cada producto para cargarle las suyas (y las de cada color, si tiene).')
    linea('7.', 'Guardá el archivo como Excel (.xlsx) y subilo en Productos → Importar Excel.')
    linea('')
    linea('Columnas', '', true)
    COLUMNAS.forEach(c => linea(c.obligatoria ? `${c.titulo} *` : c.titulo, c.ayuda))
    linea('')
    linea('', 'Las columnas con * son obligatorias.')

    const buffer = await wb.xlsx.writeBuffer()
    return new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
}
