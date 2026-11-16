// Importación masiva de productos desde Excel (Productos → "Importar Excel").
// Una fila por producto, con los mismos campos que pide "Crear producto"; las
// variantes se escriben como valores separados por coma (ver excelProductos.ts).
//
// Cuatro momentos, en una sola ventana:
//   1. Archivo   bajar la plantilla y subirla completa.
//   2. Revisión  qué se va a crear y, si hay errores, en qué fila están. Con
//                errores no se importa nada: se corrige el Excel y se vuelve
//                a subir (así no queda medio catálogo cargado).
//   3. Importar  crea las categorías que falten y después los productos, con
//                la misma API del alta manual. Muestra el avance y lo que falló.
//   4. Fotos     las fotos no viajan en el Excel: acá se recorren los productos
//                importados uno por uno para cargarles las suyas, generales o
//                por color cuando el producto tiene esa variante. Cada producto
//                trae una foto sugerida de la web (búsqueda por nombre en la
//                API, ver ProductImageSearchService.searchCatalogImages): se
//                usa, se cambia por otra opción o se descarta. Se busca al
//                mostrarse el producto (y los siguientes, por adelantado), no
//                todo de una: cada búsqueda es paga y tiene tope diario.
//
// La lista de lo importado queda guardada en la pestaña (sessionStorage): si se
// cierra la ventana, al volver a abrirla se puede seguir cargando fotos.
import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type DragEvent } from 'react'
import {
    AlertCircle, ArrowLeft, ArrowRight, Check, CheckCircle2, ChevronLeft, ChevronRight, Download, FileSpreadsheet,
    ImagePlus, Images, Loader2, Search, Upload, X,
} from 'lucide-react'
import { Modal } from '@/design-system/components/Modal'
import { Button } from '@/design-system/components/Button'
import { fmtMoney } from '@/lib/utils'
import {
    ApiError, panelAddProductImageFromWeb, panelCreateCategory, panelCreateProduct, panelGetBusiness, panelGetCategoriesFlat,
    panelGetWebImageSuggestions, panelUploadProductImage,
    type ApiCategory, type SuggestedProductImage,
} from '@/lib/api'
import {
    ArchivoInvalido, armarPlantilla, armarProductos, leerExcel, plano,
    type Lectura, type ProductoImportable,
} from './excelProductos'

// ─── Lo importado ────────────────────────────────────────────────────────────

interface Foto { url: string; destino: string | null }
interface Importado {
    id: string
    nombre: string
    cantVariantes: number
    /** La variante con fotos propias (Color…), con los ids que devolvió la API. */
    visual: { nombre: string; valores: { id: string; valor: string }[] } | null
    fotos: Foto[]
}
interface Fallo { nombre: string; fila: number; mensaje: string }

const CLAVE_SESION = 'orbita_importacion_productos'
const EN_PARALELO = 3
const POR_PAGINA = 40
const MAX_MB_FOTO = 10

function leerSesion(): Importado[] {
    try { return JSON.parse(window.sessionStorage.getItem(CLAVE_SESION) ?? '[]') as Importado[] } catch { return [] }
}
function guardarSesion(lista: Importado[]) {
    try {
        if (lista.length) window.sessionStorage.setItem(CLAVE_SESION, JSON.stringify(lista))
        else window.sessionStorage.removeItem(CLAVE_SESION)
    } catch { /* sin acceso al almacenamiento: queda solo en memoria */ }
}

// ─── Fotos sugeridas de la web ──────────────────────────────────────────────

interface Sugerencia {
    estado: 'buscando' | 'lista' | 'error'
    fotos: SuggestedProductImage[]
    /** URL de la opción elegida en "Ver otras"; sin elegir, la primera que cargue. */
    elegida?: string
    descartada?: boolean
    mensaje?: string
}
/** Una búsqueda por producto y destino (Generales o cada color). */
const claveSug = (productoId: string, destino: string | null) => `${productoId}:${destino ?? ''}`
const CLAVE_SUGERIDAS = 'orbita_importacion_sugeridas'
/** Productos de más adelante en la lista que se buscan antes de que la persona llegue. */
const POR_ADELANTADO = 3

function leerSugeridas(): Record<string, Sugerencia> {
    try { return JSON.parse(window.sessionStorage.getItem(CLAVE_SUGERIDAS) ?? '{}') as Record<string, Sugerencia> } catch { return {} }
}
function guardarSugeridas(todas: Record<string, Sugerencia>) {
    try {
        // Solo lo terminado: una búsqueda a medias o fallida se repite al volver.
        const listas = Object.fromEntries(Object.entries(todas).filter(([, s]) => s.estado === 'lista'))
        if (Object.keys(listas).length) window.sessionStorage.setItem(CLAVE_SUGERIDAS, JSON.stringify(listas))
        else window.sessionStorage.removeItem(CLAVE_SUGERIDAS)
    } catch { /* sin acceso al almacenamiento */ }
}
const dominioDe = (f: SuggestedProductImage) => f.domain || (() => { try { return new URL(f.sourceUrl || f.url).hostname.replace(/^www\./, '') } catch { return '' } })()

const mensajeDe = (e: unknown) =>(e instanceof ApiError || e instanceof Error ? e.message : 'No se pudo completar. Probá de nuevo.')

// ─── Estilos ─────────────────────────────────────────────────────────────────

const CSS = `
  .imp-pasos { display: flex; align-items: center; gap: 8px; margin: 0 0 20px; padding: 0; list-style: none; flex-wrap: wrap; }
  .imp-pasos li { display: inline-flex; align-items: center; gap: 8px; font-size: 13px; font-weight: 600; color: var(--color-subtle); }
  .imp-pasos li[data-estado='actual'] { color: var(--color-text); }
  .imp-pasos li[data-estado='hecho'] { color: var(--color-success); }
  .imp-pasos i { display: grid; place-items: center; width: 22px; height: 22px; border-radius: 50%; font-style: normal; font-size: 11px; font-weight: 700; background: var(--color-surface-alt); color: var(--color-muted); }
  .imp-pasos li[data-estado='actual'] i { background: var(--color-primary); color: #fff; }
  .imp-pasos li[data-estado='hecho'] i { background: var(--color-success); color: #fff; }
  .imp-pasos li + li::before { content: ''; width: 18px; height: 1px; background: var(--color-border); }

  .imp-dos { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; }
  .imp-caja { border: 1px solid var(--color-border); border-radius: 14px; padding: 18px; background: var(--color-surface); display: flex; flex-direction: column; gap: 10px; }
  .imp-caja h3 { margin: 0; font-size: 15px; font-weight: 700; color: var(--color-text); display: flex; align-items: center; gap: 8px; }
  .imp-caja p { margin: 0; font-size: 13px; line-height: 1.55; color: var(--color-muted); }
  .imp-num { display: grid; place-items: center; width: 24px; height: 24px; border-radius: 50%; background: var(--color-primary-bg, rgba(59,130,246,0.12)); color: var(--color-primary); font-size: 12px; font-weight: 700; flex-shrink: 0; }
  .imp-zona { border: 1.5px dashed var(--color-border-strong, var(--color-border)); border-radius: 12px; padding: 22px 14px; text-align: center; cursor: pointer; background: var(--color-bg); color: var(--color-muted); font-size: 13px; transition: border-color 160ms ease, background 160ms ease; display: flex; flex-direction: column; align-items: center; gap: 8px; }
  .imp-zona:hover, .imp-zona[data-encima='true'] { border-color: var(--color-primary); background: var(--color-primary-bg, rgba(59,130,246,0.08)); }
  .imp-zona:focus-visible { outline: 2px solid var(--color-primary); outline-offset: 2px; }
  .imp-zona b { color: var(--color-text); font-size: 14px; }
  .imp-lista { margin: 0; padding: 0 0 0 18px; font-size: 13px; line-height: 1.55; color: var(--color-muted); list-style: disc; display: grid; gap: 4px; }

  .imp-aviso { display: flex; gap: 10px; align-items: flex-start; padding: 12px 14px; border-radius: 12px; font-size: 13px; line-height: 1.5; }
  .imp-aviso[data-tono='error'] { background: var(--color-error-bg, rgba(239,68,68,0.08)); color: var(--color-error); border: 1px solid rgba(239,68,68,0.25); }
  .imp-aviso[data-tono='ok'] { background: var(--color-success-bg, rgba(16,185,129,0.1)); color: var(--color-success); border: 1px solid rgba(16,185,129,0.28); }
  .imp-aviso[data-tono='info'] { background: var(--color-surface); color: var(--color-body); border: 1px solid var(--color-border); }
  .imp-aviso svg { flex-shrink: 0; margin-top: 2px; }

  .imp-kpis { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px; margin-bottom: 14px; }
  .imp-kpi { border: 1px solid var(--color-border); border-radius: 12px; padding: 12px 14px; background: var(--color-surface); }
  .imp-kpi b { display: block; font-size: 22px; font-weight: 700; color: var(--color-text); font-variant-numeric: tabular-nums; letter-spacing: -0.02em; }
  .imp-kpi span { font-size: 12px; color: var(--color-muted); }

  .imp-tabla { border: 1px solid var(--color-border); border-radius: 12px; overflow: hidden; }
  .imp-tabla-scroll { max-height: 320px; overflow: auto; }
  .imp-tabla table { width: 100%; border-collapse: collapse; font-size: 13px; }
  .imp-tabla th { position: sticky; top: 0; z-index: 1; text-align: left; padding: 9px 12px; font-size: 11px; font-weight: 600; letter-spacing: 0.04em; text-transform: uppercase; color: var(--color-muted); background: var(--color-surface-alt); white-space: nowrap; }
  .imp-tabla td { padding: 9px 12px; border-top: 1px solid var(--color-border); color: var(--color-body); vertical-align: top; }
  .imp-tabla td.num { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
  .imp-tabla td b { color: var(--color-text); font-weight: 600; }
  .imp-chip { display: inline-flex; align-items: center; gap: 5px; height: 22px; padding: 0 9px; border-radius: 999px; font-size: 11.5px; font-weight: 600; white-space: nowrap; background: var(--color-surface-alt); color: var(--color-muted); }
  .imp-chip[data-tono='ok'] { background: var(--color-success-bg, rgba(16,185,129,0.12)); color: var(--color-success); }
  .imp-chip[data-tono='aviso'] { background: var(--color-warning-bg, rgba(245,158,11,0.14)); color: var(--color-warning, #B45309); }

  .imp-barra { height: 10px; border-radius: 999px; background: var(--color-surface-alt); overflow: hidden; }
  .imp-barra > i { display: block; height: 100%; border-radius: 999px; background: var(--color-primary); transition: width 240ms ease; }

  .imp-fotos { display: grid; grid-template-columns: 300px minmax(0, 1fr); gap: 14px; min-height: 420px; }
  .imp-col { border: 1px solid var(--color-border); border-radius: 14px; background: var(--color-surface); display: flex; flex-direction: column; min-height: 0; overflow: hidden; }
  .imp-buscar { display: flex; align-items: center; gap: 8px; padding: 10px 12px; border-bottom: 1px solid var(--color-border); }
  .imp-buscar input { flex: 1; min-width: 0; border: none; outline: none; background: transparent; color: var(--color-text); font-size: 13.5px; font-family: inherit; }
  .imp-filtro { display: flex; gap: 6px; padding: 8px 10px; border-bottom: 1px solid var(--color-border); }
  .imp-filtro button { flex: 1; height: 30px; border-radius: 8px; border: 1px solid var(--color-border); background: var(--color-bg); color: var(--color-muted); font-size: 12.5px; font-weight: 600; font-family: inherit; cursor: pointer; }
  .imp-filtro button[aria-pressed='true'] { border-color: var(--color-primary); color: var(--color-primary); background: var(--color-primary-bg, rgba(59,130,246,0.1)); }
  .imp-items { flex: 1; overflow: auto; max-height: 380px; }
  .imp-item { display: flex; align-items: center; gap: 10px; width: 100%; padding: 9px 12px; border: none; border-bottom: 1px solid var(--color-border); background: transparent; text-align: left; font-family: inherit; cursor: pointer; color: var(--color-body); }
  .imp-item:hover { background: var(--color-surface-alt); }
  .imp-item[aria-current='true'] { background: var(--color-primary-bg, rgba(59,130,246,0.1)); }
  .imp-item:focus-visible { outline: 2px solid var(--color-primary); outline-offset: -2px; }
  .imp-mini { width: 38px; height: 38px; border-radius: 9px; flex-shrink: 0; display: grid; place-items: center; background: var(--color-surface-alt); color: var(--color-subtle); overflow: hidden; }
  .imp-mini img { width: 100%; height: 100%; object-fit: cover; }
  .imp-item b { display: block; font-size: 13px; font-weight: 600; color: var(--color-text); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .imp-item small { font-size: 11.5px; color: var(--color-muted); }
  .imp-pag { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 8px 10px; border-top: 1px solid var(--color-border); font-size: 12px; color: var(--color-muted); }

  .imp-editor { padding: 16px; gap: 14px; }
  .imp-editor h3 { margin: 0; font-size: 17px; font-weight: 700; color: var(--color-text); letter-spacing: -0.01em; }
  .imp-destinos { display: flex; flex-wrap: wrap; gap: 6px; }
  .imp-destinos button { height: 32px; padding: 0 12px; border-radius: 999px; border: 1px solid var(--color-border); background: var(--color-bg); color: var(--color-body); font-size: 12.5px; font-weight: 600; font-family: inherit; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; }
  .imp-destinos button[aria-pressed='true'] { border-color: var(--color-primary); background: var(--color-primary); color: #fff; }
  .imp-destinos button span { font-variant-numeric: tabular-nums; opacity: 0.75; }
  .imp-grilla { display: grid; grid-template-columns: repeat(auto-fill, minmax(96px, 1fr)); gap: 8px; }
  .imp-foto { position: relative; aspect-ratio: 1; border-radius: 10px; overflow: hidden; border: 1px solid var(--color-border); background: var(--color-surface-alt); }
  .imp-foto img { width: 100%; height: 100%; object-fit: cover; display: block; }
  .imp-foto em { position: absolute; left: 6px; bottom: 6px; padding: 2px 7px; border-radius: 999px; font-style: normal; font-size: 10.5px; font-weight: 700; background: rgba(15,23,42,0.78); color: #fff; }
  .imp-foto[data-subiendo='true'] { display: grid; place-items: center; color: var(--color-muted); }
  .imp-mini img[data-sugerida='true'] { opacity: 0.55; }

  .imp-sug { display: grid; grid-template-columns: 168px minmax(0, 1fr); gap: 14px; padding: 12px; border: 1px solid var(--color-border); border-radius: 12px; background: var(--color-bg); }
  .imp-sug-foto { width: 168px; aspect-ratio: 1; border-radius: 10px; overflow: hidden; background: var(--color-surface-alt); display: grid; place-items: center; color: var(--color-subtle); }
  .imp-sug-foto img { width: 100%; height: 100%; object-fit: contain; background: #fff; display: block; }
  .imp-sug-info { display: flex; flex-direction: column; gap: 6px; min-width: 0; }
  .imp-sug-info b { font-size: 14px; font-weight: 600; color: var(--color-text); }
  .imp-sug-info p { margin: 0; font-size: 12.5px; line-height: 1.5; color: var(--color-muted); }
  .imp-sug-info p span { color: var(--color-body); overflow-wrap: anywhere; }
  .imp-sug-acciones { display: flex; flex-wrap: wrap; gap: 8px; margin-top: auto; padding-top: 6px; }
  .imp-sug-otras { display: grid; grid-template-columns: repeat(auto-fill, minmax(72px, 1fr)); gap: 8px; }
  .imp-sug-otras button { position: relative; aspect-ratio: 1; padding: 0; border-radius: 9px; overflow: hidden; border: 1px solid var(--color-border); background: #fff; cursor: pointer; transition: border-color 160ms ease; }
  .imp-sug-otras button:hover { border-color: var(--color-border-strong, var(--color-subtle)); }
  .imp-sug-otras button[aria-pressed='true'] { border: 2px solid var(--color-primary); }
  .imp-sug-otras button:focus-visible { outline: 2px solid var(--color-primary); outline-offset: 2px; }
  .imp-sug-otras img { width: 100%; height: 100%; object-fit: contain; display: block; }
  .imp-sug-linea { margin: 0; font-size: 12.5px; color: var(--color-muted); display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
  .imp-link { border: none; background: none; padding: 0; font: inherit; font-weight: 600; color: var(--color-primary); cursor: pointer; text-decoration: underline; text-underline-offset: 2px; }
  .imp-link:focus-visible { outline: 2px solid var(--color-primary); outline-offset: 2px; border-radius: 3px; }

  .imp-nav { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-top: auto; padding-top: 6px; }
  .imp-gira { animation: impGira 900ms linear infinite; }
  @keyframes impGira { to { transform: rotate(360deg); } }

  @media (max-width: 760px) {
    .imp-dos { grid-template-columns: minmax(0, 1fr); }
    .imp-kpis { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .imp-fotos { grid-template-columns: minmax(0, 1fr); }
    .imp-items { max-height: 200px; }
    .imp-sug { grid-template-columns: minmax(0, 1fr); }
    .imp-sug-foto { width: 100%; max-width: 240px; }
    .imp-pasos li span { display: none; }
    .imp-pasos li[data-estado='actual'] span { display: inline; }
  }
  @media (prefers-reduced-motion: reduce) { .imp-gira { animation: none; } .imp-barra > i { transition: none; } }
`

type Paso = 'archivo' | 'revision' | 'importando' | 'fotos'
const PASOS: { id: Paso; label: string }[] = [
    { id: 'archivo', label: 'Archivo' },
    { id: 'revision', label: 'Revisión' },
    { id: 'importando', label: 'Importar' },
    { id: 'fotos', label: 'Fotos' },
]

// ─── Componente ──────────────────────────────────────────────────────────────

export function ImportarProductos({ abierto, onCerrar, onImportado }: {
    abierto: boolean
    onCerrar: () => void
    /** Se creó o cambió algo: la lista de productos de atrás se tiene que refrescar. */
    onImportado: () => void
}) {
    const [paso, setPaso] = useState<Paso>('archivo')
    // Vidriera digital: el stock es opcional (celda vacía = la tienda no lo muestra).
    const [vidriera, setVidriera] = useState(false)
    const [categorias, setCategorias] = useState<ApiCategory[]>([])
    const [bajando, setBajando] = useState(false)
    const [leyendo, setLeyendo] = useState(false)
    const [encima, setEncima] = useState(false)
    const [errorArchivo, setErrorArchivo] = useState('')
    const [nombreArchivo, setNombreArchivo] = useState('')
    const [lectura, setLectura] = useState<Lectura | null>(null)
    const [avance, setAvance] = useState({ hechos: 0, total: 0, etapa: '' })
    const [fallos, setFallos] = useState<Fallo[]>([])
    const [importados, setImportados] = useState<Importado[]>([])
    const [pendientes, setPendientes] = useState<Importado[]>([])
    const cancelado = useRef(false)
    const archivoRef = useRef<HTMLInputElement>(null)

    useEffect(() => {
        if (!abierto) return
        // eslint-disable-next-line react-hooks/set-state-in-effect -- se lee al abrir: sessionStorage no existe en el servidor
        setPendientes(leerSesion())
        panelGetCategoriesFlat().then(setCategorias).catch(() => setCategorias([]))
        panelGetBusiness().then(b => setVidriera(b.mode === 'SHOWCASE')).catch(() => setVidriera(false))
    }, [abierto])

    const guardar = (lista: Importado[]) => { setImportados(lista); guardarSesion(lista) }

    const reiniciar = () => {
        setPaso('archivo'); setLectura(null); setNombreArchivo(''); setErrorArchivo(''); setFallos([])
        setAvance({ hechos: 0, total: 0, etapa: '' })
    }

    const cerrar = () => {
        if (paso === 'importando') return // no se corta a la mitad: quedaría medio catálogo
        onCerrar()
        if (paso !== 'fotos') reiniciar()
    }

    // ── 1. Archivo ──
    const bajarPlantilla = async () => {
        setBajando(true)
        try {
            const blob = await armarPlantilla(categorias.filter(c => c.isActive).map(c => c.name))
            const url = URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = 'plantilla-productos-orbita.xlsx'
            a.click()
            URL.revokeObjectURL(url)
        } catch { setErrorArchivo('No pudimos armar la plantilla. Probá de nuevo.') }
        finally { setBajando(false) }
    }

    const leer = async (archivo: File | undefined) => {
        if (!archivo) return
        setErrorArchivo('')
        if (!/\.xlsx$/i.test(archivo.name)) { setErrorArchivo('El archivo tiene que ser un Excel (.xlsx). Si lo tenés en otro formato, abrilo y usá "Guardar como → Libro de Excel".'); return }
        setLeyendo(true)
        try {
            const r = armarProductos(await leerExcel(archivo), { vidriera })
            setNombreArchivo(archivo.name)
            setLectura(r)
            setPaso('revision')
        } catch (e) {
            setErrorArchivo(e instanceof ArchivoInvalido ? e.message : 'No pudimos leer el archivo. Fijate que sea la plantilla y probá de nuevo.')
        } finally { setLeyendo(false) }
    }
    const alElegir = (e: ChangeEvent<HTMLInputElement>) => { void leer(e.target.files?.[0]); e.target.value = '' }
    const alSoltar = (e: DragEvent) => { e.preventDefault(); setEncima(false); void leer(e.dataTransfer.files?.[0]) }

    // ── 2. Revisión ──
    const existentes = useMemo(() => new Map(categorias.map(c => [plano(c.name), c])), [categorias])
    const categoriasNuevas = useMemo(() => (lectura?.categorias ?? []).filter(c => !existentes.has(plano(c))), [lectura, existentes])
    const totalVariantes = useMemo(() => (lectura?.productos ?? []).reduce((a, p) => a + p.cantVariantes, 0), [lectura])

    // ── 3. Importar ──
    const importar = async () => {
        if (!lectura || lectura.errores.length || !lectura.productos.length) return
        cancelado.current = false
        setPaso('importando')
        const total = categoriasNuevas.length + lectura.productos.length
        let hechos = 0
        setAvance({ hechos, total, etapa: categoriasNuevas.length ? 'Creando las categorías nuevas…' : 'Creando los productos…' })

        const ids = new Map([...existentes].map(([k, c]) => [k, c.id]))
        const nuevosFallos: Fallo[] = []
        const sinCategoria = new Map<string, string>()
        for (const nombre of categoriasNuevas) {
            try { ids.set(plano(nombre), (await panelCreateCategory({ name: nombre })).id) }
            catch (e) { sinCategoria.set(plano(nombre), mensajeDe(e)) }
            setAvance({ hechos: ++hechos, total, etapa: 'Creando las categorías nuevas…' })
        }

        const creados: Importado[] = []
        const cola = [...lectura.productos]
        const uno = async (p: ProductoImportable) => {
            const categoryId = ids.get(plano(p.categoria))
            if (!categoryId) {
                nuevosFallos.push({ nombre: p.nombre, fila: p.fila, mensaje: `No se pudo crear la categoría "${p.categoria}": ${sinCategoria.get(plano(p.categoria)) ?? 'error'}` })
                return
            }
            try {
                const creado = await panelCreateProduct({ ...p.input, categoryId })
                const visual = creado.options.find(o => o.isVisual)
                creados.push({
                    id: creado.id, nombre: creado.name, cantVariantes: p.cantVariantes, fotos: [],
                    visual: visual ? { nombre: visual.name, valores: visual.values.map(v => ({ id: v.id, valor: v.value })) } : null,
                })
            } catch (e) { nuevosFallos.push({ nombre: p.nombre, fila: p.fila, mensaje: mensajeDe(e) }) }
        }
        // Varios a la vez, pero pocos: la API crea cada producto en una transacción.
        const trabajador = async () => {
            for (;;) {
                const p = cola.shift()
                if (!p || cancelado.current) return
                await uno(p)
                setAvance({ hechos: ++hechos, total, etapa: 'Creando los productos…' })
            }
        }
        await Promise.all(Array.from({ length: EN_PARALELO }, trabajador))

        // En el orden del Excel, que es el que el dueño tiene en la cabeza.
        const orden = new Map(lectura.productos.map((p, i) => [p.nombre, i]))
        creados.sort((a, b) => (orden.get(a.nombre) ?? 0) - (orden.get(b.nombre) ?? 0))
        setFallos(nuevosFallos.sort((a, b) => a.fila - b.fila))
        guardar(creados)
        if (creados.length) onImportado()
        setPaso('fotos')
    }

    // ── 4. Fotos ──
    const [busca, setBusca] = useState('')
    const [soloSinFoto, setSoloSinFoto] = useState(false)
    const [pagina, setPagina] = useState(0)
    const [elegido, setElegido] = useState<string | null>(null)
    const [destino, setDestino] = useState<string | null>(null)
    const [subiendo, setSubiendo] = useState(0)
    const [errorFoto, setErrorFoto] = useState('')
    const fotosRef = useRef<HTMLInputElement>(null)

    const filtrados = useMemo(() => {
        const q = plano(busca)
        return importados.filter(p => (!q || plano(p.nombre).includes(q)) && (!soloSinFoto || p.fotos.length === 0))
    }, [importados, busca, soloSinFoto])
    const paginas = Math.max(1, Math.ceil(filtrados.length / POR_PAGINA))
    const pag = Math.min(pagina, paginas - 1)
    const visibles = filtrados.slice(pag * POR_PAGINA, (pag + 1) * POR_PAGINA)
    const actual = importados.find(p => p.id === elegido) ?? filtrados[0] ?? null
    const conFotos = importados.filter(p => p.fotos.length > 0).length

    const elegir = (id: string) => { setElegido(id); setDestino(null); setErrorFoto(''); setVerOtras(false) }
    const mover = (delta: number) => {
        if (!actual) return
        const i = filtrados.findIndex(p => p.id === actual.id)
        const sig = filtrados[i + delta]
        if (!sig) return
        elegir(sig.id)
        setPagina(Math.floor((i + delta) / POR_PAGINA))
    }
    const iActual = actual ? filtrados.findIndex(p => p.id === actual.id) : -1

    const subirFotos = async (archivos: File[]) => {
        if (!actual || !archivos.length) return
        setErrorFoto('')
        const imagenes = archivos.filter(a => a.type.startsWith('image/'))
        const pesadas = imagenes.filter(a => a.size > MAX_MB_FOTO * 1024 * 1024)
        const validas = imagenes.filter(a => !pesadas.includes(a))
        if (imagenes.length < archivos.length) setErrorFoto('Algunos archivos no eran imágenes y no se subieron.')
        else if (pesadas.length) setErrorFoto(`${pesadas.length === 1 ? 'Una foto pesa' : `${pesadas.length} fotos pesan`} más de ${MAX_MB_FOTO} MB y no se subi${pesadas.length === 1 ? 'ó' : 'eron'}.`)
        if (!validas.length) return

        const id = actual.id
        const dest = destino
        let yaTiene = actual.fotos.length > 0
        setSubiendo(validas.length)
        // De a una y en orden: la primera que entra queda como foto principal.
        for (const archivo of validas) {
            try {
                const img = await panelUploadProductImage(id, archivo, archivo.name, { isPrimary: !yaTiene && !dest, ...(dest ? { optionValueId: dest } : {}) })
                yaTiene = true
                setImportados(lista => {
                    const nueva = lista.map(p => (p.id === id ? { ...p, fotos: [...p.fotos, { url: img.url, destino: dest }] } : p))
                    guardarSesion(nueva)
                    return nueva
                })
            } catch (e) { setErrorFoto(`No se pudo subir "${archivo.name}": ${mensajeDe(e)}`) }
            setSubiendo(n => n - 1)
        }
        setSubiendo(0)
        onImportado()
    }
    const alElegirFotos = (e: ChangeEvent<HTMLInputElement>) => { void subirFotos([...(e.target.files ?? [])]); e.target.value = '' }
    const alSoltarFotos = (e: DragEvent) => { e.preventDefault(); setEncima(false); void subirFotos([...e.dataTransfer.files]) }

    // ── 4b. Fotos sugeridas de la web ──
    const [sugeridas, setSugeridas] = useState<Record<string, Sugerencia>>({})
    const sugRef = useRef<Record<string, Sugerencia>>({})
    const enCurso = useRef(new Map<string, Promise<Sugerencia>>())
    // El 429 del tope diario corta todas las búsquedas que siguen, no solo una.
    const topeRef = useRef('')
    const [rotas, setRotas] = useState<Set<string>>(new Set())
    const [verOtras, setVerOtras] = useState(false)
    const [guardandoSug, setGuardandoSug] = useState(false)
    const [enBloque, setEnBloque] = useState<{ hechos: number; total: number } | null>(null)
    const [confirmarBloque, setConfirmarBloque] = useState(false)
    const [avisoBloque, setAvisoBloque] = useState('')

    const ponerSug = useCallback((k: string, cambio: (previa?: Sugerencia) => Sugerencia) => {
        const todas = { ...sugRef.current, [k]: cambio(sugRef.current[k]) }
        sugRef.current = todas
        setSugeridas(todas)
        guardarSugeridas(todas)
    }, [])

    const buscarSugerida = useCallback((productoId: string, dest: string | null): Promise<Sugerencia> => {
        const k = claveSug(productoId, dest)
        const previa = sugRef.current[k]
        if (previa && previa.estado === 'lista') return Promise.resolve(previa)
        const pendiente = enCurso.current.get(k)
        if (pendiente) return pendiente
        if (topeRef.current) {
            const sinCupo: Sugerencia = { estado: 'error', fotos: [], mensaje: topeRef.current }
            ponerSug(k, () => sinCupo)
            return Promise.resolve(sinCupo)
        }
        ponerSug(k, () => ({ estado: 'buscando', fotos: [] }))
        const p = panelGetWebImageSuggestions(productoId, dest ?? undefined)
            .then((fotos): Sugerencia => ({ estado: 'lista', fotos: Array.isArray(fotos) ? fotos : [] }))
            .catch((e: unknown): Sugerencia => {
                if (e instanceof ApiError && e.status === 429) topeRef.current = e.message
                return { estado: 'error', fotos: [], mensaje: mensajeDe(e) }
            })
            .then(s => { ponerSug(k, () => s); enCurso.current.delete(k); return s })
        enCurso.current.set(k, p)
        return p
    }, [ponerSug])

    // La que se muestra: la elegida en "Ver otras" o la primera cuya foto cargue.
    const opcionesDe = (s?: Sugerencia) => (s?.fotos ?? []).filter(f => !rotas.has(f.url))
    const mostradaDe = (s?: Sugerencia) => {
        const opciones = opcionesDe(s)
        return opciones.find(f => f.url === s?.elegida) ?? opciones[0] ?? null
    }
    const marcarRota = (url: string) => setRotas(prev => new Set(prev).add(url))

    // Al mostrarse un producto (o cambiar a las fotos de un color) se busca la
    // suya, y por adelantado las de los siguientes, para que al tocar
    // "Siguiente" ya esté. Solo para lo que todavía no tiene fotos.
    useEffect(() => {
        if (paso !== 'fotos' || !actual) return
        const i = filtrados.findIndex(p => p.id === actual.id)
        const cola: { p: Importado; dest: string | null }[] = [
            { p: actual, dest: destino },
            ...filtrados.slice(i + 1, i + 1 + POR_ADELANTADO).map(p => ({ p, dest: null })),
        ]
        for (const { p, dest } of cola) {
            if (p.fotos.some(f => f.destino === dest)) continue
            if (sugRef.current[claveSug(p.id, dest)]) continue // ya buscada (o falló: se reintenta a mano)
            void buscarSugerida(p.id, dest)
        }
    }, [paso, actual, destino, filtrados, buscarSugerida])

    const agregarFotoLocal = (id: string, url: string, dest: string | null) => {
        setImportados(lista => {
            const nueva = lista.map(p => (p.id === id ? { ...p, fotos: [...p.fotos, { url, destino: dest }] } : p))
            guardarSesion(nueva)
            return nueva
        })
    }

    // El servidor baja la foto y la guarda en nuestro storage, como una subida más.
    const guardarSugerida = async (p: Importado, dest: string | null, foto: SuggestedProductImage) => {
        const img = await panelAddProductImageFromWeb(p.id, {
            url: foto.url,
            isPrimary: p.fotos.length === 0 && !dest,
            ...(dest ? { optionValueId: dest } : {}),
        })
        agregarFotoLocal(p.id, img.url, dest)
    }

    const usarSugerida = async () => {
        if (!actual) return
        const foto = mostradaDe(sugeridas[claveSug(actual.id, destino)])
        if (!foto) return
        setErrorFoto('')
        setGuardandoSug(true)
        try {
            await guardarSugerida(actual, destino, foto)
            setVerOtras(false)
            onImportado()
        } catch (e) {
            setErrorFoto(`No pudimos guardar esa foto (${mensajeDe(e)}). Probá con otra opción o subí la tuya.`)
        } finally { setGuardandoSug(false) }
    }

    const descartarSugerida = () => {
        if (!actual) return
        ponerSug(claveSug(actual.id, destino), s => ({ ...(s ?? { estado: 'lista', fotos: [] }), descartada: true }))
        setVerOtras(false)
    }

    const reintentarSugerida = () => {
        if (!actual) return
        topeRef.current = ''
        void buscarSugerida(actual.id, destino)
    }

    // "Usar las sugeridas de esta página": los productos de la página sin
    // ninguna foto y con la sugerencia sin descartar. Busca lo que falte y
    // guarda la que se mostraría (la elegida o la primera).
    const candidatosBloque = visibles.filter(p => p.fotos.length === 0 && !sugeridas[claveSug(p.id, null)]?.descartada)
    const usarSugeridasDeLaPagina = async () => {
        const lista = [...candidatosBloque]
        setConfirmarBloque(false)
        setAvisoBloque('')
        setErrorFoto('')
        if (!lista.length) return
        let hechos = 0, guardadas = 0, sinFoto = 0, fallidas = 0
        setEnBloque({ hechos, total: lista.length })
        const cola = [...lista]
        const trabajador = async () => {
            for (;;) {
                const p = cola.shift()
                if (!p) return
                const s = await buscarSugerida(p.id, null)
                const foto = mostradaDe(s)
                if (!foto) sinFoto++
                else {
                    try { await guardarSugerida(p, null, foto); guardadas++ } catch { fallidas++ }
                }
                setEnBloque({ hechos: ++hechos, total: lista.length })
            }
        }
        await Promise.all(Array.from({ length: EN_PARALELO }, trabajador))
        setEnBloque(null)
        if (guardadas) onImportado()
        const partes = [`Se guardaron ${guardadas} foto${guardadas === 1 ? '' : 's'}.`]
        if (sinFoto) partes.push(`${sinFoto} producto${sinFoto === 1 ? '' : 's'} no tenía${sinFoto === 1 ? '' : 'n'} sugerencia.`)
        if (fallidas) partes.push(`${fallidas} no se pudo bajar del sitio de origen.`)
        if (topeRef.current) partes.push(topeRef.current)
        partes.push('Revisalas en la lista: la búsqueda es por nombre y alguna puede no ser la del producto.')
        setAvisoBloque(partes.join(' '))
    }

    const retomar = () => {
        const previas = leerSugeridas()
        sugRef.current = previas
        setSugeridas(previas)
        setImportados(pendientes); setFallos([]); setPaso('fotos')
    }
    const terminar = () => {
        guardarSesion([]); setImportados([]); setPendientes([])
        guardarSugeridas({}); sugRef.current = {}; setSugeridas({}); topeRef.current = ''; setAvisoBloque('')
        reiniciar(); onCerrar()
    }

    const iPaso = PASOS.findIndex(p => p.id === paso)
    const fotosDelDestino = actual ? actual.fotos.filter(f => f.destino === destino) : []
    const nombreDestino = actual?.visual?.valores.find(v => v.id === destino)?.valor
    const sugActual = actual ? sugeridas[claveSug(actual.id, destino)] : undefined
    const opcionesActual = opcionesDe(sugActual)
    const mostrada = mostradaDe(sugActual)
    const ocupado = subiendo > 0 || guardandoSug || enBloque !== null

    return (
        <Modal isOpen={abierto} onClose={cerrar} title="Importar productos desde Excel" maxWidth={paso === 'fotos' ? 980 : 760} dismissable={paso !== 'importando'}>
            <style>{CSS}</style>
            <ol className="imp-pasos" aria-label="Pasos de la importación">
                {PASOS.map((p, i) => (
                    <li key={p.id} data-estado={i < iPaso ? 'hecho' : i === iPaso ? 'actual' : 'falta'} aria-current={i === iPaso ? 'step' : undefined}>
                        <i aria-hidden>{i < iPaso ? <Check size={12} strokeWidth={3} /> : i + 1}</i><span>{p.label}</span>
                    </li>
                ))}
            </ol>

            {/* ── 1. Archivo ── */}
            {paso === 'archivo' && (
                <div style={{ display: 'grid', gap: 14 }}>
                    {pendientes.length > 0 && (
                        <div className="imp-aviso" data-tono="info">
                            <Images size={16} aria-hidden />
                            <div style={{ flex: 1 }}>
                                Tenés <b>{pendientes.length} producto{pendientes.length === 1 ? '' : 's'}</b> de tu última importación
                                {pendientes.some(p => p.fotos.length === 0) ? `, ${pendientes.filter(p => p.fotos.length === 0).length} todavía sin fotos.` : '.'}
                            </div>
                            <Button variant="outline" size="sm" onClick={retomar}>Seguir con las fotos</Button>
                        </div>
                    )}
                    <div className="imp-dos">
                        <div className="imp-caja">
                            <h3><span className="imp-num">1</span> Descargá la plantilla</h3>
                            <p>Es un Excel con las columnas ya armadas, tus categorías como lista desplegable y un producto de ejemplo de cada rubro (ropa, electrodomésticos, juguetes, electrónica) para que veas cómo se completa.</p>
                            <ul className="imp-lista">
                                <li>Una fila por producto, con los mismos datos que pide «Crear producto».</li>
                                <li>Las variantes no se repiten: escribís Color y sus valores separados por coma (Rojo, Azul, Negro) y se arman solas todas las combinaciones.</li>
                                <li>El SKU se genera solo y las fotos se cargan después, acá mismo.</li>
                                <li>Las filas de ejemplo no se importan: escribí debajo o borralas.</li>
                            </ul>
                            <div style={{ marginTop: 'auto' }}>
                                <Button variant="outline" icon={<Download size={15} />} onClick={() => void bajarPlantilla()} disabled={bajando}>
                                    {bajando ? 'Armando la plantilla…' : 'Descargar plantilla'}
                                </Button>
                            </div>
                        </div>
                        <div className="imp-caja">
                            <h3><span className="imp-num">2</span> Subila completa</h3>
                            <p>Antes de crear nada te mostramos qué se va a importar y, si algo está mal, en qué fila.</p>
                            <input ref={archivoRef} type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" hidden onChange={alElegir} />
                            <div
                                className="imp-zona" role="button" tabIndex={0} data-encima={encima} aria-busy={leyendo}
                                onClick={() => archivoRef.current?.click()}
                                onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); archivoRef.current?.click() } }}
                                onDragOver={e => { e.preventDefault(); setEncima(true) }} onDragLeave={() => setEncima(false)} onDrop={alSoltar}
                            >
                                {leyendo ? <Loader2 size={22} className="imp-gira" aria-hidden /> : <FileSpreadsheet size={22} aria-hidden />}
                                <b>{leyendo ? 'Leyendo el archivo…' : 'Elegí el Excel o arrastralo acá'}</b>
                                <span>Archivo .xlsx, hasta 5.000 productos</span>
                            </div>
                        </div>
                    </div>
                    {errorArchivo && <div className="imp-aviso" data-tono="error" role="alert"><AlertCircle size={16} aria-hidden /> <span>{errorArchivo}</span></div>}
                </div>
            )}

            {/* ── 2. Revisión ── */}
            {paso === 'revision' && lectura && (
                <div style={{ display: 'grid', gap: 14 }}>
                    <div className="imp-kpis">
                        <div className="imp-kpi"><b>{lectura.productos.length}</b><span>{lectura.productos.length === 1 ? 'producto listo' : 'productos listos'}</span></div>
                        <div className="imp-kpi"><b>{totalVariantes}</b><span>variantes</span></div>
                        <div className="imp-kpi"><b>{categoriasNuevas.length}</b><span>categorías nuevas</span></div>
                        <div className="imp-kpi"><b style={lectura.errores.length ? { color: 'var(--color-error)' } : undefined}>{lectura.errores.length}</b><span>errores</span></div>
                    </div>

                    {lectura.errores.length > 0 ? (
                        <>
                            <div className="imp-aviso" data-tono="error" role="alert">
                                <AlertCircle size={16} aria-hidden />
                                <span>Hay {lectura.errores.length} error{lectura.errores.length === 1 ? '' : 'es'} en <b>{nombreArchivo}</b>. Corregilos en el Excel y volvé a subirlo: no se importa nada hasta que esté todo bien, así no te queda el catálogo a medias.</span>
                            </div>
                            <div className="imp-tabla">
                                <div className="imp-tabla-scroll">
                                    <table>
                                        <thead><tr><th>Fila</th><th>Columna</th><th>Qué hay que corregir</th></tr></thead>
                                        <tbody>
                                            {lectura.errores.slice(0, 300).map((e, i) => (
                                                <tr key={i}><td className="num"><b>{e.fila}</b></td><td style={{ whiteSpace: 'nowrap' }}>{e.columna}</td><td>{e.mensaje}</td></tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                            {lectura.errores.length > 300 && <p style={{ margin: 0, fontSize: 12.5, color: 'var(--color-muted)' }}>Se muestran los primeros 300. Al corregirlos y volver a subir aparece el resto.</p>}
                        </>
                    ) : (
                        <>
                            <div className="imp-aviso" data-tono="ok">
                                <CheckCircle2 size={16} aria-hidden />
                                <span><b>{nombreArchivo}</b> está bien. {categoriasNuevas.length > 0 && <>Se {categoriasNuevas.length === 1 ? 'va a crear la categoría' : 'van a crear las categorías'} {categoriasNuevas.join(', ')}. </>}Lo que no diga Publicado entra como borrador, para que lo publiques cuando tenga fotos.</span>
                            </div>
                            <div className="imp-tabla">
                                <div className="imp-tabla-scroll">
                                    <table>
                                        <thead><tr><th>Producto</th><th>Categoría</th><th>Variantes</th><th style={{ textAlign: 'right' }}>Precio</th><th style={{ textAlign: 'right' }}>Stock</th><th>Estado</th></tr></thead>
                                        <tbody>
                                            {lectura.productos.slice(0, 200).map(p => (
                                                <tr key={p.clave}>
                                                    <td><b>{p.nombre}</b></td>
                                                    <td>{p.categoria}{!existentes.has(plano(p.categoria)) && <> <span className="imp-chip" data-tono="aviso">nueva</span></>}</td>
                                                    <td>
                                                        {p.cantVariantes > 0
                                                            ? <><b>{p.cantVariantes}</b> <span style={{ color: 'var(--color-muted)' }}>· {p.resumenVariantes}</span></>
                                                            : <span style={{ color: 'var(--color-subtle)' }}>sin variantes</span>}
                                                    </td>
                                                    <td className="num">{fmtMoney(p.precio)}</td>
                                                    <td className="num">{p.sinStock ? '—' : p.stockTotal}</td>
                                                    <td><span className="imp-chip" data-tono={p.publicado ? 'ok' : undefined}>{p.publicado ? 'Publicado' : 'Borrador'}</span></td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                            {lectura.productos.length > 200 && <p style={{ margin: 0, fontSize: 12.5, color: 'var(--color-muted)' }}>Se muestran los primeros 200 de {lectura.productos.length}. Se importan todos.</p>}
                        </>
                    )}

                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
                        <Button variant="outline" icon={<ArrowLeft size={15} />} onClick={reiniciar}>Subir otro archivo</Button>
                        {lectura.errores.length === 0 && (
                            <Button variant="primary" icon={<Upload size={15} />} onClick={() => void importar()}>
                                Importar {lectura.productos.length} producto{lectura.productos.length === 1 ? '' : 's'}
                            </Button>
                        )}
                    </div>
                </div>
            )}

            {/* ── 3. Importando ── */}
            {paso === 'importando' && (
                <div style={{ display: 'grid', gap: 14, padding: '18px 0 8px' }} role="status" aria-live="polite">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 15, fontWeight: 600, color: 'var(--color-text)' }}>
                        <Loader2 size={18} className="imp-gira" aria-hidden /> {avance.etapa}
                    </div>
                    <div className="imp-barra" role="progressbar" aria-valuemin={0} aria-valuemax={avance.total} aria-valuenow={avance.hechos}>
                        <i style={{ width: `${avance.total ? (avance.hechos / avance.total) * 100 : 0}%` }} />
                    </div>
                    <p style={{ margin: 0, fontSize: 13, color: 'var(--color-muted)' }}>
                        {avance.hechos} de {avance.total}. No cierres esta ventana ni la pestaña hasta que termine.
                    </p>
                </div>
            )}

            {/* ── 4. Fotos ── */}
            {paso === 'fotos' && (
                <div style={{ display: 'grid', gap: 14 }}>
                    {(fallos.length > 0 || importados.length > 0) && (
                        <div className="imp-aviso" data-tono={fallos.length ? 'error' : 'ok'}>
                            {fallos.length ? <AlertCircle size={16} aria-hidden /> : <CheckCircle2 size={16} aria-hidden />}
                            <div style={{ flex: 1 }}>
                                <b>{importados.length} producto{importados.length === 1 ? '' : 's'} importado{importados.length === 1 ? '' : 's'}</b>
                                {fallos.length > 0 ? `, ${fallos.length} no se pudieron crear.` : `. ${conFotos} de ${importados.length} ya tienen fotos.`}
                                {fallos.length > 0 && (
                                    <ul className="imp-lista" style={{ color: 'inherit', marginTop: 6 }}>
                                        {fallos.slice(0, 8).map(f => <li key={f.fila}>Fila {f.fila}, {f.nombre}: {f.mensaje}</li>)}
                                        {fallos.length > 8 && <li>y {fallos.length - 8} más.</li>}
                                    </ul>
                                )}
                            </div>
                        </div>
                    )}

                    {importados.length > 0 && (
                        <div className="imp-fotos">
                            <div className="imp-col">
                                <label className="imp-buscar">
                                    <Search size={15} aria-hidden style={{ color: 'var(--color-subtle)' }} />
                                    <input value={busca} onChange={e => { setBusca(e.target.value); setPagina(0) }} placeholder="Buscar producto" aria-label="Buscar producto importado" />
                                </label>
                                <div className="imp-filtro">
                                    <button type="button" aria-pressed={!soloSinFoto} onClick={() => { setSoloSinFoto(false); setPagina(0) }}>Todos ({importados.length})</button>
                                    <button type="button" aria-pressed={soloSinFoto} onClick={() => { setSoloSinFoto(true); setPagina(0) }}>Sin fotos ({importados.length - conFotos})</button>
                                </div>
                                <div className="imp-items">
                                    {visibles.map(p => {
                                        const sug = sugeridas[claveSug(p.id, null)]
                                        const sugerida = p.fotos.length === 0 && !sug?.descartada ? mostradaDe(sug) : null
                                        return (
                                            <button key={p.id} type="button" className="imp-item" aria-current={actual?.id === p.id} onClick={() => elegir(p.id)}>
                                                <span className="imp-mini">
                                                    {/* eslint-disable-next-line @next/next/no-img-element -- miniatura de una foto recién subida o sugerida */}
                                                    {p.fotos[0] ? <img src={p.fotos[0].url} alt="" />
                                                        // eslint-disable-next-line @next/next/no-img-element -- miniatura de Google de la sugerida
                                                        : sugerida ? <img src={sugerida.thumbnailUrl || sugerida.url} alt="" data-sugerida="true" referrerPolicy="no-referrer" loading="lazy" />
                                                        : <ImagePlus size={16} aria-hidden />}
                                                </span>
                                                <span style={{ minWidth: 0, flex: 1 }}>
                                                    <b>{p.nombre}</b>
                                                    <small>
                                                        {p.cantVariantes > 0 ? `${p.cantVariantes} variantes · ` : ''}
                                                        {p.fotos.length ? `${p.fotos.length} foto${p.fotos.length === 1 ? '' : 's'}` : sugerida ? 'foto sugerida' : 'sin fotos'}
                                                    </small>
                                                </span>
                                                {p.fotos.length > 0 && <Check size={15} strokeWidth={3} aria-hidden style={{ color: 'var(--color-success)', flexShrink: 0 }} />}
                                            </button>
                                        )
                                    })}
                                    {visibles.length === 0 && <p style={{ margin: 0, padding: 18, fontSize: 13, color: 'var(--color-muted)', textAlign: 'center' }}>{soloSinFoto ? 'Todos los productos tienen fotos.' : 'Ningún producto coincide con la búsqueda.'}</p>}
                                </div>
                                {paginas > 1 && (
                                    <div className="imp-pag">
                                        <Button variant="outline" size="sm" onClick={() => setPagina(pag - 1)} disabled={pag === 0} aria-label="Página anterior"><ChevronLeft size={14} /></Button>
                                        <span>Página {pag + 1} de {paginas}</span>
                                        <Button variant="outline" size="sm" onClick={() => setPagina(pag + 1)} disabled={pag >= paginas - 1} aria-label="Página siguiente"><ChevronRight size={14} /></Button>
                                    </div>
                                )}
                            </div>

                            <div className="imp-col imp-editor">
                                {actual ? (
                                    <>
                                        <div>
                                            <h3>{actual.nombre}</h3>
                                            <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--color-muted)' }}>
                                                {actual.visual
                                                    ? `Tiene variantes de ${actual.visual.nombre.toLowerCase()}: podés cargar fotos generales y fotos de cada ${actual.visual.nombre.toLowerCase()}.`
                                                    : actual.cantVariantes > 0 ? 'Las fotos valen para todas sus variantes.' : 'La primera foto que subas queda como principal.'}
                                            </p>
                                        </div>
                                        {actual.visual && (
                                            <div className="imp-destinos" role="group" aria-label="A qué corresponden las fotos">
                                                <button type="button" aria-pressed={destino === null} onClick={() => { setDestino(null); setVerOtras(false) }}>
                                                    Generales <span>{actual.fotos.filter(f => f.destino === null).length}</span>
                                                </button>
                                                {actual.visual.valores.map(v => (
                                                    <button key={v.id} type="button" aria-pressed={destino === v.id} onClick={() => { setDestino(v.id); setVerOtras(false) }}>
                                                        {v.valor} <span>{actual.fotos.filter(f => f.destino === v.id).length}</span>
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                        {fotosDelDestino.length === 0 && sugActual && !sugActual.descartada && (
                                            sugActual.estado === 'buscando' ? (
                                                <div className="imp-sug" role="status" aria-live="polite">
                                                    <div className="imp-sug-foto"><Loader2 size={20} className="imp-gira" aria-hidden /></div>
                                                    <div className="imp-sug-info">
                                                        <b>Buscando una foto en la web…</b>
                                                        <p>Mientras tanto podés subir las tuyas.</p>
                                                    </div>
                                                </div>
                                            ) : sugActual.estado === 'error' ? (
                                                <p className="imp-sug-linea" role="alert">
                                                    {sugActual.mensaje || 'No pudimos buscar una foto en la web.'}
                                                    <button type="button" className="imp-link" onClick={reintentarSugerida}>Probar de nuevo</button>
                                                </p>
                                            ) : mostrada ? (
                                                <>
                                                    <div className="imp-sug">
                                                        <div className="imp-sug-foto">
                                                            {/* eslint-disable-next-line @next/next/no-img-element -- foto externa, todavía no guardada */}
                                                            <img
                                                                key={mostrada.url}
                                                                src={mostrada.url}
                                                                alt={`Foto sugerida para ${actual.nombre}`}
                                                                referrerPolicy="no-referrer"
                                                                onError={e => {
                                                                    // El sitio de origen no deja mostrarla: la miniatura de Google, y si tampoco, la siguiente opción.
                                                                    const img = e.currentTarget
                                                                    if (mostrada.thumbnailUrl && img.src !== mostrada.thumbnailUrl) img.src = mostrada.thumbnailUrl
                                                                    else marcarRota(mostrada.url)
                                                                }}
                                                            />
                                                        </div>
                                                        <div className="imp-sug-info">
                                                            <b>Foto sugerida de la web</b>
                                                            {dominioDe(mostrada) && <p>De <span>{dominioDe(mostrada)}</span></p>}
                                                            <p>Fijate que sea este producto antes de usarla. Se guarda en tu tienda como una foto más.</p>
                                                            <div className="imp-sug-acciones">
                                                                <Button variant="primary" size="sm" icon={guardandoSug ? <Loader2 size={14} className="imp-gira" /> : <Check size={14} />} onClick={() => void usarSugerida()} disabled={guardandoSug || ocupado}>
                                                                    {guardandoSug ? 'Guardando…' : 'Usar esta foto'}
                                                                </Button>
                                                                {opcionesActual.length > 1 && (
                                                                    <Button variant="outline" size="sm" onClick={() => setVerOtras(v => !v)} aria-expanded={verOtras} disabled={guardandoSug}>
                                                                        {/* "Ver otras" como texto propio: el manual nombra el botón así (ver manual/contrato.test.ts). */}
                                                                        {verOtras ? 'Ocultar opciones' : <>Ver otras <span>({opcionesActual.length - 1})</span></>}
                                                                    </Button>
                                                                )}
                                                                <Button variant="ghost" size="sm" onClick={descartarSugerida} disabled={guardandoSug}>Descartar</Button>
                                                            </div>
                                                        </div>
                                                    </div>
                                                    {verOtras && (
                                                        <div className="imp-sug-otras" role="group" aria-label="Otras fotos sugeridas">
                                                            {opcionesActual.map((f, i) => (
                                                                <button
                                                                    key={f.url} type="button" aria-pressed={f.url === mostrada.url}
                                                                    aria-label={`Opción ${i + 1}${dominioDe(f) ? `, de ${dominioDe(f)}` : ''}`}
                                                                    onClick={() => ponerSug(claveSug(actual.id, destino), s => ({ ...(s ?? { estado: 'lista', fotos: [] }), elegida: f.url }))}
                                                                >
                                                                    {/* eslint-disable-next-line @next/next/no-img-element -- miniatura de una opción externa */}
                                                                    <img src={f.thumbnailUrl || f.url} alt="" referrerPolicy="no-referrer" loading="lazy" onError={() => marcarRota(f.url)} />
                                                                </button>
                                                            ))}
                                                        </div>
                                                    )}
                                                </>
                                            ) : (
                                                <p className="imp-sug-linea">No encontramos una foto de este producto en la web. Subí la tuya.</p>
                                            )
                                        )}
                                        <input ref={fotosRef} type="file" accept="image/*" multiple hidden onChange={alElegirFotos} />
                                        <div
                                            className="imp-zona" role="button" tabIndex={0} data-encima={encima} aria-busy={subiendo > 0}
                                            onClick={() => fotosRef.current?.click()}
                                            onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fotosRef.current?.click() } }}
                                            onDragOver={e => { e.preventDefault(); setEncima(true) }} onDragLeave={() => setEncima(false)} onDrop={alSoltarFotos}
                                        >
                                            {subiendo > 0 ? <Loader2 size={22} className="imp-gira" aria-hidden /> : <ImagePlus size={22} aria-hidden />}
                                            <b>
                                                {subiendo > 0 ? `Subiendo ${subiendo} foto${subiendo === 1 ? '' : 's'}…`
                                                    : mostrada && fotosDelDestino.length === 0 && !sugActual?.descartada ? 'O subí las tuyas: elegilas o arrastralas acá'
                                                    : nombreDestino ? `Fotos de ${nombreDestino}: elegilas o arrastralas acá` : 'Elegí las fotos o arrastralas acá'}
                                            </b>
                                            <span>Podés subir varias juntas. JPG, PNG o WebP, hasta {MAX_MB_FOTO} MB cada una.</span>
                                        </div>
                                        {errorFoto && <div className="imp-aviso" data-tono="error" role="alert"><AlertCircle size={16} aria-hidden /> <span>{errorFoto}</span></div>}
                                        {fotosDelDestino.length > 0 && (
                                            <div className="imp-grilla">
                                                {fotosDelDestino.map((f, i) => (
                                                    <div key={f.url} className="imp-foto">
                                                        {/* eslint-disable-next-line @next/next/no-img-element -- foto recién subida */}
                                                        <img src={f.url} alt={`Foto ${i + 1} de ${actual.nombre}`} />
                                                        {destino === null && i === 0 && <em>Principal</em>}
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                        <div className="imp-nav">
                                            <Button variant="outline" icon={<ChevronLeft size={15} />} onClick={() => mover(-1)} disabled={iActual <= 0 || ocupado}>Anterior</Button>
                                            <span style={{ fontSize: 12.5, color: 'var(--color-muted)', fontVariantNumeric: 'tabular-nums' }}>{iActual + 1} de {filtrados.length}</span>
                                            <Button variant="primary" onClick={() => mover(1)} disabled={iActual < 0 || iActual >= filtrados.length - 1 || ocupado}>
                                                Siguiente <ArrowRight size={15} style={{ marginLeft: 6 }} />
                                            </Button>
                                        </div>
                                    </>
                                ) : (
                                    <p style={{ margin: 'auto', fontSize: 13, color: 'var(--color-muted)', textAlign: 'center' }}>Elegí un producto de la lista para cargarle fotos.</p>
                                )}
                            </div>
                        </div>
                    )}

                    {enBloque ? (
                        <div style={{ display: 'grid', gap: 8 }} role="status" aria-live="polite">
                            <div className="imp-barra" role="progressbar" aria-valuemin={0} aria-valuemax={enBloque.total} aria-valuenow={enBloque.hechos}>
                                <i style={{ width: `${(enBloque.hechos / enBloque.total) * 100}%` }} />
                            </div>
                            <p className="imp-sug-linea">Guardando las fotos sugeridas: {enBloque.hechos} de {enBloque.total}.</p>
                        </div>
                    ) : confirmarBloque ? (
                        <div className="imp-aviso" data-tono="info">
                            <Images size={16} aria-hidden />
                            <div style={{ flex: 1 }}>
                                Se va a guardar la foto sugerida de <b>{candidatosBloque.length} producto{candidatosBloque.length === 1 ? '' : 's'}</b> de esta página que todavía no tiene{candidatosBloque.length === 1 ? '' : 'n'} fotos.
                                La búsqueda es por nombre: alguna puede no ser la del producto, así que revisalas después en la lista.
                            </div>
                            <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                                <Button variant="ghost" size="sm" onClick={() => setConfirmarBloque(false)}>Cancelar</Button>
                                <Button variant="primary" size="sm" onClick={() => void usarSugeridasDeLaPagina()}>Usar {candidatosBloque.length} foto{candidatosBloque.length === 1 ? '' : 's'}</Button>
                            </div>
                        </div>
                    ) : avisoBloque ? (
                        <div className="imp-aviso" data-tono="info" role="status">
                            <CheckCircle2 size={16} aria-hidden />
                            <span style={{ flex: 1 }}>{avisoBloque}</span>
                            <button type="button" className="imp-link" onClick={() => setAvisoBloque('')}>Cerrar</button>
                        </div>
                    ) : null}

                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
                        <Button variant="outline" onClick={() => { onCerrar() }} disabled={ocupado}>Seguir después</Button>
                        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                            {candidatosBloque.length > 0 && !enBloque && !confirmarBloque && (
                                <Button variant="outline" icon={<Images size={15} />} onClick={() => { setAvisoBloque(''); setConfirmarBloque(true) }} disabled={ocupado}>
                                    Usar las sugeridas de esta página
                                </Button>
                            )}
                            <Button variant="primary" icon={<X size={15} />} onClick={terminar} disabled={ocupado}>Terminar</Button>
                        </div>
                    </div>
                </div>
            )}
        </Modal>
    )
}
