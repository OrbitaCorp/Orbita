// src/modules/ventas/panel/catalogo/ProductoNuevo.tsx — Vista P2
// Alta y edición de producto (RBT-302 / RBT-303).
//
// Los pasos están ordenados así a propósito: las variantes se definen ANTES de
// las imágenes porque cada foto se asocia a un valor de opción (el color), y no
// se puede elegir a qué color pertenece si todavía no existe.
//
// Orden de guardado: primero se crea/actualiza el producto (POST/PUT) y recién
// con la respuesta —que ya trae los ids de cada valor de opción— se suben las
// imágenes pendientes. Antes de eso no existe el optionValueId al que apuntan.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ComponentType } from 'react'
import { useRouter } from 'next/router'
import { Package, Layers, Banknote, Check, ChevronLeft, ChevronRight, ChevronDown, Plus, X, Globe, FileText, Edit2, Sparkles, Trash2, Star, ImageIcon, Search, Eye, EyeOff, FolderPlus, AlertTriangle } from 'lucide-react'
import { Card } from '@/design-system/components/Card'
import { Button } from '@/design-system/components/Button'
import { Skeleton } from '@/design-system/components/Skeleton'
import { fmtMoney } from '@/lib/utils'
import { adminPath, currentSlug } from '@/lib/tenant'
import { ProductoEstadoBadge } from './components/CatalogoTabs'
import { ProductoThumb } from '../pedidos/components/ProductoThumb'
import {
    panelCreateProduct, panelUpdateProduct, panelGetProductFull,
    panelGetCategoriesFlat, panelUploadProductImage, panelDeleteProductImage,
    panelGetTags, panelCreateTag, panelAiAssist,
    ApiError,
    type ApiCategory, type ApiProductFull, type UpsertProductInput, type ProductStatus, type ApiTag,
} from '@/lib/api'
import { startProductUpload, markImageUploaded, finishProductUpload } from '@/lib/productUploadTracker'

// ─── Tipos del formulario ─────────────────────────────────────────────────────

// `esVisual`: si esta opción es la que tiene fotos por valor (ej. Color). Solo
// se pide explícitamente cuando hay 2+ opciones definidas — con una sola no
// hay ambigüedad, se asume visual sola (ver `opcionVisual` más abajo).
interface TipoVariante { id: string; nombre: string; opciones: string[]; esVisual?: boolean }

// Una fila de la tabla de precio/stock. `id` solo existe si la variante ya está
// en la base (edición) — el backend lo usa para reconciliar en vez de recrear.
interface FilaVariante {
    clave: string            // "M / Negro" — identidad dentro del form
    valores: string[]        // ["M","Negro"], en el orden de las opciones
    id?: string
    sku: string
    precio: string
    stock: string
    stockMin: string
    // false = esta combinación no se ofrece (ej. "Azul" no viene en "XL").
    // Se conserva en el form y se manda igual al guardar, no se borra la fila.
    activa: boolean
}

// Imagen todavía sin subir: vive como File hasta que el producto exista.
interface ImagenPendiente {
    key: string
    file: File
    preview: string
    principal: boolean
    // Valor de opción al que se asocia ("Negro"). Vacío = imagen general.
    valorOpcion?: string
}

interface ImagenGuardada {
    id: string
    url: string
    principal: boolean
    optionValueId: string | null
}

interface ProdForm {
    nombre: string; descripcion: string; categoriaId: string; tags: string[]; estado: ProductStatus
    precio: string; costo: string; sku: string
    stock: string; stockMinimo: string
    tieneVariantes: boolean; tiposVariante: TipoVariante[]
}

interface ProductoNuevoProps {
    onVolver: () => void
    onToast: (m: string) => void
    editarId?: string
}

// ─── Skeletons — misma forma exacta del contenido real, armados con las piezas
// del componente compartido design-system/Skeleton.tsx (clase `.skel` de
// globals.css: mismo barrido de luz y corte por prefers-reduced-motion que el
// resto del panel). ─────────────────────────────────────────────────────────

// Reemplaza SOLO el contenido del paso 1 mientras se resuelve si el negocio
// tiene categorías (ver `categoriasCargando`) — stepper, card y preview
// siguen siendo los reales, así no hay salto de layout cuando resuelve.
function PasoInfoSkeleton() {
    return (
        <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
                <Skeleton width={40} height={40} radius={10} />
                <div>
                    <Skeleton width={180} height={16} radius={8} style={{ marginBottom: 6 }} />
                    <Skeleton width={130} height={11} radius={8} />
                </div>
            </div>
            <Skeleton width="100%" height={44} radius={8} style={{ marginBottom: 18 }} />
            <Skeleton width="100%" height={110} radius={8} style={{ marginBottom: 18 }} />
            <Skeleton width="100%" height={40} radius={8} style={{ marginBottom: 18 }} />
            <Skeleton width="100%" height={36} radius={8} style={{ marginBottom: 18 }} />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <Skeleton width="100%" height={44} radius={8} />
                <Skeleton width="100%" height={44} radius={8} />
            </div>
        </div>
    )
}

// Reemplaza el wizard ENTERO mientras se carga un producto existente para
// editar (`editarId`) — misma forma exacta del layout real (título, stepper
// de 4 pasos, card + preview de 2 columnas) para que no haya salto cuando
// llega la respuesta.
function ProductoNuevoSkeleton() {
    return (
        <div className="pn-page" style={pageWrap}>
            <style>{`
                .pn-page   { padding: 24px 32px 64px; }
                .pn-layout { display: grid; grid-template-columns: minmax(0,1fr) 340px; gap: 20px; align-items: start; }
                @media (max-width: 1080px) { .pn-layout { grid-template-columns: 1fr !important; } }
                @media (max-width: 768px)  { .pn-page { padding: 16px 14px 48px !important; } }
            `}</style>
            <Skeleton width={220} height={30} radius={8} style={{ marginBottom: 20 }} />
            <div style={{ display: 'flex', alignItems: 'center', maxWidth: 860, marginBottom: 24, gap: 8 }}>
                {[0, 1, 2, 3].map(i => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', flex: i < 3 ? 1 : 'none' }}>
                        <Skeleton width={30} height={30} radius="50%" style={{ flexShrink: 0 }} />
                        <Skeleton width={70} height={12} radius={8} style={{ marginLeft: 8 }} />
                        {i < 3 && <div style={{ flex: 1, height: 2, background: 'var(--color-border)', margin: '0 12px' }} />}
                    </div>
                ))}
            </div>
            <div className="pn-layout">
                <Card>
                    <PasoInfoSkeleton />
                </Card>
                <div>
                    <Card padding="sm" style={{ padding: 16 }}>
                        <Skeleton width={90} height={11} radius={8} style={{ marginBottom: 12 }} />
                        <Skeleton width="100%" height={160} radius={10} style={{ marginBottom: 12 }} />
                        <Skeleton width="70%" height={14} radius={8} style={{ marginBottom: 8 }} />
                        <Skeleton width="40%" height={12} radius={8} />
                    </Card>
                </div>
            </div>
        </div>
    )
}

const FORM_INICIAL: ProdForm = {
    nombre: '', descripcion: '', categoriaId: '', tags: [], estado: 'PUBLISHED',
    precio: '', costo: '', sku: '',
    stock: '0', stockMinimo: '5',
    tieneVariantes: false,
    tiposVariante: [{ id: 'v1', nombre: 'Talle', opciones: ['S', 'M', 'L'] }],
}

// Palabras que no aportan nada a un código (artículos, preposiciones) — se
// descartan para que el SKU salga de palabras con contenido real en vez de,
// por ejemplo, "DE-LA-REM" para "Remera de la selección".
const SKU_STOPWORDS = new Set(['de', 'del', 'la', 'el', 'los', 'las', 'un', 'una', 'unos', 'unas', 'y', 'con', 'para', 'en'])

function sinAcentos(s: string) {
    return s.normalize('NFD').replace(/\p{Diacritic}/gu, '')
}

// Letras/números en mayúscula, sin acentos ni símbolos — la base para
// cualquier abreviación (nombre de producto o valor de opción).
function normalizarParaSKU(s: string) {
    return sinAcentos(s).toUpperCase().replace(/[^A-Z0-9\s]/g, '').trim()
}

function generarSKU(nombre: string) {
    const palabras = normalizarParaSKU(nombre).split(/\s+/).filter(p => p && !SKU_STOPWORDS.has(p.toLowerCase()))
    if (palabras.length === 0) return 'SKU'
    // Un nombre de una sola palabra ("Zapatilla") con solo 3 letras queda
    // demasiado ambiguo — se usan hasta 6 para que siga siendo reconocible.
    if (palabras.length === 1) return palabras[0].slice(0, 6)
    return palabras.slice(0, 3).map(p => p.slice(0, 3)).join('-')
}

// Abreviación de un valor de opción ("Azul" -> "AZU") para el sufijo de SKU
// de cada variante — misma normalización que el nombre, para no producir
// abreviaciones rotas con acentos (ej. "Café" -> "CAF", no un caracter suelto).
function abreviarValorOpcion(valor: string) {
    return normalizarParaSKU(valor).replace(/\s+/g, '').slice(0, 3)
}

export default function ProductoNuevo({ onVolver, onToast, editarId }: ProductoNuevoProps) {
    const editando = !!editarId
    const router = useRouter()
    const negocioId = currentSlug() ?? (router.query.negocioId as string)

    const [step, setStep] = useState(1)
    const [done, setDone] = useState<number[]>([])
    const [orbiGen, setOrbiGen] = useState(false)
    const [tagInput, setTagInput] = useState('')
    const [prod, setProd] = useState<ProdForm>(FORM_INICIAL)
    const [filas, setFilas] = useState<FilaVariante[]>([])
    // Id de LA variante, para un producto SIN opciones que se está editando —
    // separado de `filas` a propósito (ver bug de abajo). `undefined` = alta
    // nueva (todavía no hay ninguna variante que reconciliar).
    const [varianteUnicaId, setVarianteUnicaId] = useState<string | undefined>(undefined)
    // Valor del input "aplicar a todas las variantes" del paso 3 — nunca se
    // manda al backend, solo sirve para completar `filas[].precio` en lote.
    const [precioMasivo, setPrecioMasivo] = useState('')
    const [imagenes, setImagenes] = useState<ImagenPendiente[]>([])
    const [guardadas, setGuardadas] = useState<ImagenGuardada[]>([])
    // valor de opción (ej. "S") → id real de ese OptionValue — se arma una
    // sola vez al cargar la edición (ver bug de abajo) y sirve para saber
    // cuáles de las `guardadas` le corresponden a cada valor en "Fotos por
    // talle/color".
    const [valorIds, setValorIds] = useState<Map<string, string>>(new Map())
    const [categorias, setCategorias] = useState<ApiCategory[]>([])
    // Distingue "todavía no llegó la respuesta" de "llegó y el negocio no
    // tiene ninguna categoría creada" — sin esto, el aviso de "no hay
    // categorías" parpadeaba un instante en cada carga, antes de que
    // llegara la respuesta real.
    const [categoriasCargando, setCategoriasCargando] = useState(true)
    // Etiquetas que el negocio ya usó antes, para reutilizarlas con un click.
    const [tagsUsadas, setTagsUsadas] = useState<ApiTag[]>([])
    const [guardando, setGuardando] = useState(false)
    const [cargando, setCargando] = useState(!!editarId)
    const [error, setError] = useState('')
    // Muestra el selector de "cuál opción tiene fotos" solo cuando el usuario
    // toca "cambiar" — por default se detecta sola, sin preguntar.
    const [cambiandoVisual, setCambiandoVisual] = useState(false)

    const set = <K extends keyof ProdForm>(k: K, v: ProdForm[K]) => setProd(p => ({ ...p, [k]: v }))

    useEffect(() => {
        panelGetCategoriesFlat()
            .then(setCategorias)
            .catch(() => setCategorias([]))
            .finally(() => setCategoriasCargando(false))
        panelGetTags().then(setTagsUsadas).catch(() => setTagsUsadas([]))
    }, [])

    const agregarTag = (nombre: string) => {
        const limpio = nombre.trim()
        if (!limpio) return
        // Evita duplicados por mayúsculas ("Verano" y "verano" son la misma).
        const yaEsta = prod.tags.some(t => t.trim().toLowerCase() === limpio.toLowerCase())
        if (!yaEsta) set('tags', [...prod.tags, limpio])
    }

    // Sugerencias: las que ya usó el negocio y todavía no están en este producto.
    const sugerencias = tagsUsadas
        .filter(t => !prod.tags.some(x => x.trim().toLowerCase() === t.name.trim().toLowerCase()))
        .slice(0, 12)

    // ── Precarga en modo edición ────────────────────────────────────────────
    useEffect(() => {
        if (!editarId) return
        let vigente = true
        setCargando(true)
        panelGetProductFull(editarId)
            .then((p: ApiProductFull) => {
                if (!vigente) return
                const conVariantes = p.options.length > 0
                setProd({
                    nombre: p.name,
                    descripcion: p.description ?? '',
                    categoriaId: p.categoryId ?? '',
                    tags: p.tags.map(t => t.name),
                    estado: p.status,
                    precio: String(p.basePrice),
                    costo: p.cost != null ? String(p.cost) : '',
                    sku: p.variants.find(v => v.isDefault)?.sku ?? p.variants[0]?.sku ?? '',
                    stock: String(p.variants[0]?.stock.reduce((s, st) => s + st.quantity, 0) ?? 0),
                    stockMinimo: String(p.variants[0]?.stock[0]?.stockMin ?? 5),
                    tieneVariantes: conVariantes,
                    tiposVariante: conVariantes
                        ? p.options.map(o => ({ id: o.id, nombre: o.name, opciones: o.values.map(v => v.value), esVisual: o.isVisual }))
                        : FORM_INICIAL.tiposVariante,
                })
                setFilas(
                    conVariantes
                        ? p.variants.map(v => ({
                            clave: v.optionValues.map(ov => ov.value).join(' / '),
                            valores: v.optionValues.map(ov => ov.value),
                            id: v.id,
                            sku: v.sku ?? '',
                            precio: String(v.price),
                            stock: String(v.stock.reduce((s, st) => s + st.quantity, 0)),
                            stockMin: String(v.stock[0]?.stockMin ?? 0),
                            activa: v.isActive,
                        }))
                        : [],
                )
                // BUG encontrado 2026-08-15: sin esto, un producto SIN opciones
                // perdía el id de su única variante al cargarlo para editar
                // (`filas` queda vacío arriba, a propósito, para el caso "con
                // variantes"). armarPayload() mandaba entonces la variante SIN
                // id → el backend la trataba como una ALTA nueva en vez de una
                // edición, y la variante vieja quedaba huérfana (no se borra
                // si ya tiene ventas/movimientos de stock) — cada guardado
                // podía ir sumando una variante fantasma más. Con `p.variants[0]`
                // pudiendo tener MÁS de un elemento por este mismo bug en un
                // guardado anterior, se prioriza la default/con stock/más
                // vieja — mismo criterio que ya usa el storefront público
                // (ver precioRepresentativo()/variantePrincipal() en
                // storefront.service.ts/utils.ts) — así una edición reconcilia
                // TODAS las huérfanas contra esta, en vez de sumar una más.
                setVarianteUnicaId(
                    conVariantes
                        ? undefined
                        : (p.variants.find(v => v.isDefault)
                            ?? p.variants.find(v => v.stock.some(s => s.quantity > 0))
                            ?? p.variants[0])?.id,
                )
                setGuardadas(p.images.map(img => ({ id: img.id, url: img.url, principal: img.isPrimary, optionValueId: img.optionValueId })))
                // BUG encontrado 2026-08-16: la sección "Fotos por talle/color"
                // filtraba `guardadas` por optionValueId, pero nada armaba esa
                // correspondencia — `valoresParaImagen` solo tiene el STRING
                // del valor (ej. "S"), no su id. Sin este mapa, la sección le
                // pasaba `guardadas={[]}` a mano y las fotos ya subidas por
                // variante desaparecían al editar (seguían ahí en la base,
                // solo no se mostraban).
                setValorIds(new Map(p.options.flatMap(opt => opt.values.map(v => [v.value, v.id] as const))))
                setDone([1, 2, 3])
            })
            .catch(err => { if (vigente) setError(err instanceof ApiError ? err.message : 'No se pudo cargar el producto') })
            .finally(() => { if (vigente) setCargando(false) })
        return () => { vigente = false }
    }, [editarId])

    // ── Combinaciones (producto cartesiano de las opciones) ─────────────────
    const tiposValidos = useMemo(
        () => prod.tiposVariante.filter(tp => tp.nombre.trim() && tp.opciones.length),
        [prod.tiposVariante],
    )

    // Opción "visual" (la única con fotos por valor). No se pregunta de
    // entrada — se detecta sola (la que se llama "Color", o si no hay
    // ninguna así, la primera definida) para no meter una pregunta extra en
    // el medio del paso 2. El usuario puede cambiarla con el link "cambiar"
    // junto a "Fotos por variante", que es donde realmente importa.
    const opcionVisual = useMemo(() => {
        if (!tiposValidos.length) return undefined
        const elegida = tiposValidos.find(tp => tp.esVisual)
        if (elegida) return elegida
        return tiposValidos.find(tp => /color/i.test(tp.nombre)) ?? tiposValidos[0]
    }, [tiposValidos])

    const combos = useMemo(() => {
        if (!prod.tieneVariantes || !tiposValidos.length) return []
        let res: string[][] = [[]]
        for (const tp of tiposValidos) {
            const next: string[][] = []
            for (const combo of res) for (const op of tp.opciones) next.push([...combo, op])
            res = next
        }
        return res.map(valores => ({ clave: valores.join(' / '), valores }))
    }, [prod.tieneVariantes, tiposValidos])

    // Sincroniza la tabla con las combinaciones, conservando lo ya tipeado (y
    // el `id` de las que vienen de la base, para no perder la reconciliación).
    useEffect(() => {
        if (!prod.tieneVariantes) { setFilas([]); return }
        setFilas(prev => {
            // Si las filas que ya existen comparten un mismo precio (lo más
            // común: cargaste el precio con "Aplicar a todas" y después
            // agregaste un talle/color más), la fila nueva lo hereda en vez de
            // arrancar en 0 — menos tipeo repetido para el caso típico.
            const preciosPrevios = prev.filter(f => f.activa).map(f => Number(f.precio) || 0).filter(p => p > 0)
            const precioHeredado = preciosPrevios.length > 0 && preciosPrevios.every(p => p === preciosPrevios[0])
                ? String(preciosPrevios[0])
                : ''
            return combos.map(c => {
                const previa = prev.find(f => f.clave === c.clave)
                if (previa) return previa
                const sufijo = c.valores.map(abreviarValorOpcion).join('-')
                return {
                    clave: c.clave,
                    valores: c.valores,
                    sku: `${prod.sku || generarSKU(prod.nombre)}-${sufijo}`,
                    precio: precioHeredado || '0',
                    stock: '0',
                    stockMin: prod.stockMinimo || '0',
                    activa: true,
                }
            })
        })
        // `prod.sku` solo se usa como valor inicial de filas nuevas.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [combos, prod.tieneVariantes])

    // Valores de opción disponibles para asociar imágenes — SOLO los de la
    // opción visual (ver arriba). Antes se ofrecían los de TODAS las opciones
    // (incluido Talle), lo cual no tenía sentido visual y confundía.
    const valoresParaImagen = useMemo(() => {
        if (!prod.tieneVariantes || !opcionVisual) return []
        return opcionVisual.opciones.map(op => ({ opcion: opcionVisual.nombre, valor: op }))
    }, [prod.tieneVariantes, opcionVisual])

    // Nota: usa setProd funcional (no `set`/`agregarTag` sueltos) para categoría y
    // etiquetas porque las tres actualizaciones (descripción, categoría, tags) pueden
    // quedar en el mismo batch de React — leer `prod` del closure ahí perdería las
    // etiquetas sugeridas menos la última.
    const orbiAsistir = async () => {
        if (!prod.nombre.trim()) { onToast('Poné el nombre del producto antes de generar con Orbi'); return }
        setOrbiGen(true)
        try {
            const { description, suggestedCategoryId, suggestedTags } = await panelAiAssist({
                name: prod.nombre.trim(),
                existingDescription: prod.descripcion.trim() || undefined,
            })
            setProd(p => {
                const yaEstan = new Set(p.tags.map(t => t.trim().toLowerCase()))
                const nuevasTags = suggestedTags.filter(t => !yaEstan.has(t.trim().toLowerCase()))
                return {
                    ...p,
                    descripcion: description,
                    categoriaId: p.categoriaId || suggestedCategoryId || p.categoriaId,
                    tags: nuevasTags.length ? [...p.tags, ...nuevasTags] : p.tags,
                }
            })
            onToast('Generado por Orbi')
        } catch (err) {
            onToast(err instanceof ApiError ? err.message : 'No se pudo generar con Orbi. Probá de nuevo.')
        } finally {
            setOrbiGen(false)
        }
    }

    // ── Imágenes ────────────────────────────────────────────────────────────
    function agregarImagenes(files: FileList | null, valorOpcion?: string) {
        if (!files?.length) return
        const nuevas: ImagenPendiente[] = []
        for (const file of Array.from(files)) {
            if (!file.type.startsWith('image/')) continue
            if (file.size > 5 * 1024 * 1024) { onToast(`"${file.name}" supera los 5MB`); continue }
            nuevas.push({
                key: `${Date.now()}-${file.name}-${Math.random().toString(36).slice(2, 7)}`,
                file,
                preview: URL.createObjectURL(file),
                // La primera imagen general del producto queda como principal.
                principal: !valorOpcion && imagenes.every(i => !i.principal) && guardadas.every(g => !g.principal),
                valorOpcion,
            })
        }
        setImagenes(prev => [...prev, ...nuevas])
    }

    function quitarPendiente(key: string) {
        setImagenes(prev => {
            const img = prev.find(i => i.key === key)
            if (img) URL.revokeObjectURL(img.preview)
            return prev.filter(i => i.key !== key)
        })
    }

    async function quitarGuardada(id: string) {
        if (!editarId) return
        try {
            await panelDeleteProductImage(editarId, id)
            setGuardadas(prev => prev.filter(g => g.id !== id))
            onToast('Imagen eliminada')
        } catch (err) {
            onToast(err instanceof ApiError ? err.message : 'No se pudo eliminar la imagen')
        }
    }

    function marcarPrincipal(key: string) {
        setImagenes(prev => prev.map(i => ({ ...i, principal: i.key === key })))
        setGuardadas(prev => prev.map(g => ({ ...g, principal: false })))
    }

    // Libera los object URLs al desmontar.
    useEffect(() => () => { imagenes.forEach(i => URL.revokeObjectURL(i.preview)) }, [imagenes])

    // ── Guardado ────────────────────────────────────────────────────────────

    // El wizard deja escribir etiquetas como texto libre, pero la API las pide
    // por id. Se resuelve nombre → id contra las que ya existen (comparando sin
    // distinguir mayúsculas) y se crean las que falten.
    const resolverTagIds = useCallback(async (nombres: string[]): Promise<string[]> => {
        if (nombres.length === 0) return []
        const existentes = await panelGetTags()
        const porNombre = new Map(existentes.map(t => [t.name.trim().toLowerCase(), t.id]))
        const ids: string[] = []
        for (const nombre of nombres) {
            const clave = nombre.trim().toLowerCase()
            if (!clave) continue
            const ya = porNombre.get(clave)
            if (ya) { ids.push(ya); continue }
            try {
                const creado = await panelCreateTag(nombre.trim())
                porNombre.set(clave, creado.id)
                ids.push(creado.id)
            } catch {
                // Puede fallar si otro la creó en el medio (hay unique por
                // negocio+nombre): se reintenta buscándola.
                const refrescadas = await panelGetTags()
                const encontrada = refrescadas.find(t => t.name.trim().toLowerCase() === clave)
                if (encontrada) ids.push(encontrada.id)
            }
        }
        return ids
    }, [])

    // Con variantes, no hay UN precio de producto — cada combinación tiene el
    // suyo (tabla del paso 3). `basePrice` sigue existiendo en el backend como
    // el "Desde $X" que se muestra en las cards del catálogo (ver
    // precioRepresentativo() en storefront.service.ts), así que se deriva acá
    // como el más bajo entre las variantes ACTIVAS con precio cargado — nunca
    // se le pide al usuario que lo tipee aparte (eso era justamente lo
    // confuso: un campo "Precio de venta" arriba que no correspondía a
    // ninguna variante en particular y podía desincronizarse de todas).
    const preciosVariantesActivas = useMemo(
        () => filas.filter(f => f.activa).map(f => Number(f.precio) || 0).filter(p => p > 0),
        [filas],
    )
    const precioMinVariantes = preciosVariantesActivas.length ? Math.min(...preciosVariantesActivas) : 0
    const precioUnicoVariantes = preciosVariantesActivas.length > 0
        && preciosVariantesActivas.every(p => p === preciosVariantesActivas[0])

    const armarPayload = useCallback((tagIds: string[]): UpsertProductInput => {
        // Con variantes, `precio` (usado abajo solo como fallback de filas sin
        // completar y como basePrice) es el más bajo entre las activas — nunca
        // un valor tipeado aparte, ver precioMinVariantes más arriba.
        const precio = prod.tieneVariantes ? precioMinVariantes : Number(prod.precio) || 0
        const opciones = prod.tieneVariantes
            ? tiposValidos.map(tp => ({ name: tp.nombre.trim(), values: tp.opciones, isVisual: opcionVisual?.id === tp.id }))
            : undefined

        const variants: UpsertProductInput['variants'] = prod.tieneVariantes
            ? filas.map(f => ({
                ...(f.id ? { id: f.id } : {}),
                sku: f.sku || undefined,
                price: Number(f.precio) || precio,
                optionValues: f.valores,
                initialStock: Number(f.stock) || 0,
                stockMin: Number(f.stockMin) || 0,
                isActive: f.activa,
            }))
            // Sin variantes: una sola fila con el stock general del paso 3.
            // OJO: el id viene de `varianteUnicaId`, NUNCA de `filas[0]?.id`
            // — `filas` se vacía a propósito para este caso (ver el efecto
            // de sincronización con `combos` más abajo), así que leer de ahí
            // mandaba la variante siempre SIN id en modo edición y el
            // backend la creaba de nuevo en vez de actualizar la existente
            // (bug encontrado 2026-08-15, ver el comentario en la carga).
            : [{
                ...(varianteUnicaId ? { id: varianteUnicaId } : {}),
                sku: prod.sku || undefined,
                price: precio,
                optionValues: [],
                initialStock: Number(prod.stock) || 0,
                stockMin: Number(prod.stockMinimo) || 0,
            }]

        return {
            name: prod.nombre.trim(),
            description: prod.descripcion.trim() || undefined,
            categoryId: prod.categoriaId || undefined,
            basePrice: precio,
            cost: prod.costo ? Number(prod.costo) : undefined,
            status: prod.estado,
            ...(tagIds.length > 0 ? { tagIds } : {}),
            ...(opciones ? { options: opciones } : {}),
            variants,
        }
    }, [prod, filas, tiposValidos, opcionVisual, varianteUnicaId, precioMinVariantes])

    async function guardar() {
        setError('')
        // Chequeo rápido antes de ir al backend (que igual lo valida — esto
        // solo evita el viaje de ida y vuelta): no se puede publicar un
        // producto sin stock, hay que cargarlo o guardarlo como borrador.
        if (prod.estado === 'PUBLISHED' && stockTotal <= 0) {
            setError('No podés publicar un producto sin stock. Cargá stock inicial o guardalo como borrador.')
            return
        }
        setGuardando(true)
        try {
            const tagIds = await resolverTagIds(prod.tags)
            const payload = armarPayload(tagIds)
            const guardado = editarId
                ? await panelUpdateProduct(editarId, payload)
                : await panelCreateProduct(payload)

            // Recién ahora existen los ids de cada valor de opción: se resuelve
            // a cuál apunta cada imagen pendiente.
            const idPorValor = new Map<string, string>()
            for (const opt of guardado.options) {
                for (const val of opt.values) idPorValor.set(val.value, val.id)
            }

            // Alta nueva CON fotos: el producto ya quedó creado (rápido) —
            // subir las fotos es lo lento (cada una hace su propio viaje al
            // backend: conversión a WebP + subida a Supabase Storage), así que
            // eso sigue en segundo plano mientras se vuelve a la lista ya
            // mismo, en vez de tener al usuario esperando con la pantalla
            // bloqueada. La lista muestra el progreso vía
            // lib/productUploadTracker.ts. La función de acá abajo NUNCA toca
            // el estado de este componente (setImagenes, etc.) — para cuando
            // termine, ProductoNuevo ya se desmontó (se volvió a la lista) y
            // React tira un warning (o peor) si un componente desmontado
            // intenta actualizar su propio estado.
            //
            // Edición sigue igual que siempre (sincrónica): ahí no tiene
            // sentido volver antes de saber si las fotos nuevas se subieron
            // bien, porque el usuario ya está viendo el resto del producto.
            if (!editarId && imagenes.length > 0) {
                const imgsASubir = imagenes
                startProductUpload(guardado.id, imgsASubir.length)
                onToast(
                    prod.estado === 'PUBLISHED'
                        ? 'Producto creado — subiendo fotos…'
                        : 'Producto guardado como borrador — subiendo fotos…',
                )
                onVolver()

                void (async () => {
                    await Promise.allSettled(
                        imgsASubir.map(async img => {
                            try {
                                await panelUploadProductImage(guardado.id, img.file, img.file.name, {
                                    isPrimary: img.principal,
                                    optionValueId: img.valorOpcion ? idPorValor.get(img.valorOpcion) : undefined,
                                })
                                markImageUploaded(guardado.id, true)
                            } catch {
                                markImageUploaded(guardado.id, false)
                            } finally {
                                URL.revokeObjectURL(img.preview)
                            }
                        }),
                    )
                    finishProductUpload(guardado.id)
                })()
                return
            }

            // El producto YA existe en este punto. Si falla subir una foto no
            // se puede deshacer eso, así que un error acá no puede tirar abajo
            // todo el guardado: si lo hiciera, el usuario ve "no se pudo
            // guardar", reintenta, y termina creando duplicados (pasó en
            // producción). Se avisa qué fotos fallaron y se sigue — las puede
            // volver a subir editando el producto.
            //
            // En paralelo (Promise.allSettled), no una por una — mismo
            // criterio que el camino de arriba.
            const resultados = await Promise.allSettled(
                imagenes.map(img => panelUploadProductImage(guardado.id, img.file, img.file.name, {
                    isPrimary: img.principal,
                    optionValueId: img.valorOpcion ? idPorValor.get(img.valorOpcion) : undefined,
                })),
            )
            const fotosFallidas = resultados.filter(r => r.status === 'rejected').length

            imagenes.forEach(i => URL.revokeObjectURL(i.preview))
            setImagenes([])
            onToast(
                fotosFallidas > 0
                    ? `Producto guardado, pero ${fotosFallidas} foto${fotosFallidas === 1 ? '' : 's'} no se pudo subir. Editá el producto para reintentar.`
                    : editarId ? 'Producto actualizado'
                        : prod.estado === 'PUBLISHED' ? 'Producto creado'
                            : 'Producto guardado como borrador',
            )
            onVolver()
        } catch (err) {
            setError(err instanceof ApiError ? err.message : 'No se pudo guardar el producto')
            setGuardando(false)
        }
    }

    // ── Validación por paso ─────────────────────────────────────────────────
    // La categoría es obligatoria (no se puede publicar un producto "suelto",
    // sin agrupar en ningún lado del catálogo del cliente) — mismo criterio
    // que ya rechaza el backend en create-product.dto.ts.
    const faltaNombre = prod.nombre.trim() === ''
    const faltaCategoria = prod.categoriaId === ''
    const req1 = !faltaNombre && !faltaCategoria
    const req3 = prod.tieneVariantes
        ? filas.some(f => f.activa) && filas.filter(f => f.activa).every(f => Number(f.precio) > 0)
        : prod.precio !== '' && Number(prod.precio) > 0
    const variantesOk = !prod.tieneVariantes || combos.length > 0
    const canNext = step === 1 ? req1 : step === 2 ? variantesOk : step === 3 ? req3 : true

    const next = () => {
        setDone(d => [...new Set([...d, step])])
        if (step < 4) setStep(step + 1)
        else void guardar()
    }

    const STEPS: [string, string, ComponentType<{ size?: number; strokeWidth?: number }>][] = [
        ['1', 'Info', Package],
        ['2', 'Variantes e imágenes', Layers],
        ['3', 'Precio y stock', Banknote],
        ['4', 'Revisión', Check],
    ]
    // Con variantes no se muestra: el costo es un solo número pero cada
    // variante puede tener un precio distinto, así que un "margen" único
    // sería engañoso (¿margen contra cuál precio?). Sin variantes hay un
    // único precio y el cálculo es inequívoco.
    const margen = !prod.tieneVariantes && prod.costo && prod.precio
        ? Math.round((1 - Number(prod.costo) / Number(prod.precio)) * 100)
        : null
    const stockTotal = prod.tieneVariantes
        ? filas.filter(f => f.activa).reduce((s, f) => s + (Number(f.stock) || 0), 0)
        : Number(prod.stock) || 0

    if (cargando) {
        return <ProductoNuevoSkeleton />
    }

    return (
        <div className="pn-page" style={pageWrap}>
            <style>{`
                .pn-page    { padding: 24px 32px 64px; }
                .pn-layout  { display: grid; grid-template-columns: minmax(0,1fr) 340px; gap: 20px; align-items: start; }
                .pn-preview { position: sticky; top: 20px; }
                @media (max-width: 1080px) {
                    .pn-layout  { grid-template-columns: 1fr !important; }
                    .pn-preview { position: static !important; }
                }
                @media (max-width: 768px) {
                    .pn-page { padding: 16px 14px 48px !important; }
                }
            `}</style>

            <h1 style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--color-text)', margin: '0 0 20px' }}>
                {editando ? 'Editar producto' : 'Crear producto'}
            </h1>

            {/* Stepper */}
            <div style={{ display: 'flex', alignItems: 'center', maxWidth: 860, marginBottom: 24, flexWrap: 'wrap', gap: 8 }}>
                {STEPS.map(([n, l], i) => {
                    const a = step === Number(n), dn = done.includes(Number(n)) || step > Number(n)
                    return (
                        <div key={n} style={{ display: 'flex', alignItems: 'center', flex: i < 3 ? 1 : 'none', minWidth: 0 }}>
                            <button
                                onClick={() => { if (dn || a) setStep(Number(n)) }}
                                style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'none', border: 'none', padding: 0, cursor: dn || a ? 'pointer' : 'default', fontFamily: 'inherit' }}
                            >
                                <span style={{ width: 30, height: 30, borderRadius: '50%', background: dn ? 'var(--color-success)' : a ? 'var(--color-primary)' : 'var(--color-surface-alt)', color: dn || a ? 'var(--color-on-primary)' : 'var(--color-muted)', display: 'grid', placeItems: 'center', fontSize: 12, fontWeight: 700, fontFamily: '"Geist Mono", monospace', flexShrink: 0 }}>
                                    {dn ? <Check size={14} strokeWidth={2.6} /> : n}
                                </span>
                                <span style={{ fontSize: 13, fontWeight: a || dn ? 600 : 500, color: a || dn ? 'var(--color-text)' : 'var(--color-muted)', whiteSpace: 'nowrap' }}>{l}</span>
                            </button>
                            {i < 3 && <div style={{ flex: 1, height: 2, background: dn ? 'var(--color-success)' : 'var(--color-border)', margin: '0 12px', minWidth: 12 }} />}
                        </div>
                    )
                })}
            </div>

            {error && (
                <div style={{ padding: '10px 14px', borderRadius: 10, background: 'var(--color-error-bg)', border: '1px solid var(--color-error)', color: 'var(--color-error)', fontSize: 13, marginBottom: 16, maxWidth: 860 }}>
                    {error}
                </div>
            )}

            <div className="pn-layout">
                <Card>
                    {/* PASO 1 — Info */}
                    {step === 1 && (
                        categoriasCargando ? (
                            <PasoInfoSkeleton />
                        ) : categorias.length === 0 ? (
                            <SinCategoriasAviso negocioId={negocioId} />
                        ) : (
                        <div>
                            <StepHd icon={Package} title="¿Qué estás vendiendo?" sub="Lo básico de tu producto." />
                            <div style={{ marginBottom: 18 }}>
                                <PField label="Nombre del producto" value={prod.nombre} onChange={v => set('nombre', v.slice(0, 80))} placeholder="Ej: Remera oversize negra" h={44} />
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
                                    <span style={{ fontSize: 11, color: 'var(--color-muted)' }}>Usá palabras que tus clientes buscarían</span>
                                    <span style={{ fontSize: 11, color: 'var(--color-subtle)', fontFamily: '"Geist Mono", monospace' }}>{prod.nombre.length}/80</span>
                                </div>
                                <button onClick={orbiAsistir} disabled={orbiGen} style={{ background: 'none', border: 'none', color: '#8B5CF6', fontSize: 12, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 8 }}>
                                    {orbiGen ? <>Generando…</> : <><Sparkles size={13} /> Generar con Orbi</>}
                                </button>
                            </div>
                            <div style={{ marginBottom: 18 }}>
                                <label style={lbl}>Descripción</label>
                                <textarea value={prod.descripcion} onChange={e => set('descripcion', e.target.value.slice(0, 2000))} rows={5} style={{ ...inputBase, width: '100%', resize: 'vertical', minHeight: 110, padding: '10px 12px', fontSize: 14, lineHeight: 1.6 }} />
                                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 6 }}>
                                    <span style={{ fontSize: 11, color: 'var(--color-subtle)', fontFamily: '"Geist Mono", monospace' }}>{prod.descripcion.length}/2000</span>
                                </div>
                            </div>
                            <div style={{ marginBottom: 18 }}>
                                <label style={lbl}>Categoría <span style={{ color: 'var(--color-error)' }}>*</span></label>
                                <CategoriaSelect categorias={categorias} value={prod.categoriaId} onChange={v => set('categoriaId', v)} />
                                <div style={{ fontSize: 11, color: 'var(--color-muted)', marginTop: 4 }}>
                                    Obligatoria — así el producto aparece agrupado en el catálogo de tu tienda.
                                </div>
                            </div>
                            <div style={{ marginBottom: 18 }}>
                                <label style={lbl}>Etiquetas</label>
                                <input
                                    value={tagInput}
                                    onChange={e => setTagInput(e.target.value)}
                                    onKeyDown={e => { if (e.key === 'Enter' && tagInput.trim()) { e.preventDefault(); agregarTag(tagInput); setTagInput('') } }}
                                    placeholder="Agregar etiqueta… presioná Enter"
                                    style={{ ...inputBase, width: '100%', height: 36, padding: '0 12px', fontSize: 13 }}
                                />
                                {prod.tags.length > 0 && (
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                                        {prod.tags.map(tg => (
                                            <span key={tg} style={chip}>{tg}
                                                <button onClick={() => set('tags', prod.tags.filter(x => x !== tg))} style={chipX}><X size={11} strokeWidth={2} /></button>
                                            </span>
                                        ))}
                                    </div>
                                )}
                                {sugerencias.length > 0 && (
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10, alignItems: 'center' }}>
                                        <span style={{ fontSize: 11, color: 'var(--color-muted)' }}>Ya usaste:</span>
                                        {sugerencias.map(t => (
                                            <button
                                                key={t.id}
                                                onClick={() => agregarTag(t.name)}
                                                title={t.usageCount > 0 ? `En ${t.usageCount} producto${t.usageCount === 1 ? '' : 's'}` : 'Sin usar todavía'}
                                                style={{ height: 24, padding: '0 9px', borderRadius: 9999, border: '1px dashed var(--color-border)', background: 'transparent', color: 'var(--color-muted)', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit' }}
                                            >
                                                {t.name}{t.usageCount > 0 && <span style={{ opacity: 0.6 }}> · {t.usageCount}</span>}
                                            </button>
                                        ))}
                                    </div>
                                )}
                                <div style={{ fontSize: 11, color: 'var(--color-muted)', marginTop: 8 }}>
                                    Sirven para agrupar productos. Si escribís una nueva, se crea sola y te queda disponible para el próximo.
                                </div>
                            </div>
                            <div>
                                <label style={lbl}>Estado</label>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                                    {([['PUBLISHED', 'Publicado', Globe, 'var(--color-success)'], ['DRAFT', 'Borrador', Edit2, 'var(--color-muted)']] as [ProductStatus, string, ComponentType<{ size?: number; strokeWidth?: number }>, string][]).map(([id, l, Icon, col]) => {
                                        const a = prod.estado === id
                                        return (
                                            <button key={id} onClick={() => set('estado', id)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0 14px', height: 44, borderRadius: 8, border: `${a ? 2 : 1}px solid ${a ? col : 'var(--color-border)'}`, background: a ? `color-mix(in srgb, ${col} 8%, transparent)` : 'var(--color-bg)', color: a ? col : 'var(--color-body)', fontSize: 13, fontWeight: a ? 600 : 500, cursor: 'pointer', fontFamily: 'inherit' }}>
                                                <Icon size={16} strokeWidth={1.6} /> {l}
                                            </button>
                                        )
                                    })}
                                </div>
                            </div>
                        </div>
                        )
                    )}

                    {/* PASO 2 — Variantes e imágenes */}
                    {step === 2 && (
                        <div>
                            <StepHd icon={Layers} title="Variantes e imágenes" sub="Definí las opciones y subí las fotos de cada una." />

                            <TogRow
                                label="Este producto tiene variantes (talles, colores, etc.)"
                                help="Se genera una combinación por cada cruce. El precio y el stock de cada una se cargan en el paso siguiente."
                                on={prod.tieneVariantes}
                                onChange={v => set('tieneVariantes', v)}
                            />

                            {prod.tieneVariantes && (
                                <div style={{ marginTop: 16 }}>
                                    {prod.tiposVariante.map((tp, ti) => (
                                        <div key={tp.id} style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 10, padding: 16, marginBottom: 12 }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                                                <input
                                                    value={tp.nombre}
                                                    onChange={e => set('tiposVariante', prod.tiposVariante.map((x, j) => j === ti ? { ...x, nombre: e.target.value } : x))}
                                                    placeholder="Nombre de la opción (Talle, Color…)"
                                                    style={{ ...inputBase, height: 36, padding: '0 10px', fontSize: 14, fontWeight: 500, flex: 1 }}
                                                />
                                                {prod.tiposVariante.length > 1 && (
                                                    <button onClick={() => set('tiposVariante', prod.tiposVariante.filter((_, j) => j !== ti))} style={iconBtn}><X size={15} strokeWidth={1.8} /></button>
                                                )}
                                            </div>
                                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
                                                {tp.opciones.map(op => (
                                                    <span key={op} style={{ ...chip, border: '1px solid var(--color-primary)' }}>{op}
                                                        <button onClick={() => set('tiposVariante', prod.tiposVariante.map((x, j) => j === ti ? { ...x, opciones: x.opciones.filter(o => o !== op) } : x))} style={chipX}><X size={11} strokeWidth={2} /></button>
                                                    </span>
                                                ))}
                                                <OpInput tipo={tp.nombre} onAdd={v => set('tiposVariante', prod.tiposVariante.map((x, j) => j === ti ? { ...x, opciones: [...new Set([...x.opciones, v])] } : x))} />
                                            </div>
                                        </div>
                                    ))}
                                    {prod.tiposVariante.length < 3 && (
                                        <Button variant="outline" size="sm" icon={<Plus size={15} />} onClick={() => set('tiposVariante', [...prod.tiposVariante, { id: 'v' + Date.now(), nombre: '', opciones: [] }])} style={{ width: '100%', justifyContent: 'center' }}>
                                            Agregar otra opción
                                        </Button>
                                    )}
                                    {combos.length > 0 && (
                                        <div style={{ marginTop: 12, fontSize: 12.5, color: 'var(--color-muted)' }}>
                                            Se van a crear <strong style={{ color: 'var(--color-text)' }}>{combos.length}</strong> combinaciones.
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Imagen principal + galería general */}
                            <div style={{ marginTop: 24 }}>
                                <label style={lbl}>Fotos del producto</label>
                                <GaleriaImagenes
                                    pendientes={imagenes.filter(i => !i.valorOpcion)}
                                    guardadas={guardadas.filter(g => !g.optionValueId)}
                                    onAgregar={files => agregarImagenes(files)}
                                    onQuitarPendiente={quitarPendiente}
                                    onQuitarGuardada={quitarGuardada}
                                    onPrincipal={marcarPrincipal}
                                    permitePrincipal
                                />
                                <div style={{ fontSize: 11, color: 'var(--color-muted)', marginTop: 6 }}>
                                    La foto marcada con la estrella es la que aparece en el catálogo. PNG o JPG, hasta 5MB.
                                </div>
                            </div>

                            {/* Imágenes por valor de opción */}
                            {valoresParaImagen.length > 0 && (
                                <div style={{ marginTop: 24 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                        <label style={lbl}>Fotos por {opcionVisual?.nombre.toLowerCase() || 'variante'}</label>
                                        {tiposValidos.length > 1 && (
                                            <button type="button" onClick={() => setCambiandoVisual(v => !v)} style={{ background: 'none', border: 'none', color: 'var(--color-primary)', fontSize: 11.5, cursor: 'pointer', fontFamily: 'inherit', padding: 0 }}>
                                                cambiar
                                            </button>
                                        )}
                                    </div>
                                    {cambiandoVisual && (
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, margin: '6px 0 10px' }}>
                                            {tiposValidos.map(tp => {
                                                const activo = tp.id === opcionVisual?.id
                                                return (
                                                    <button
                                                        key={tp.id}
                                                        type="button"
                                                        onClick={() => { set('tiposVariante', prod.tiposVariante.map(x => ({ ...x, esVisual: x.id === tp.id }))); setCambiandoVisual(false) }}
                                                        style={{ height: 28, padding: '0 12px', borderRadius: 7, border: `1.5px solid ${activo ? 'var(--color-primary)' : 'var(--color-border)'}`, background: activo ? 'var(--color-primary-bg)' : 'var(--color-bg)', color: activo ? 'var(--color-primary)' : 'var(--color-body)', fontSize: 12, fontWeight: activo ? 600 : 500, cursor: 'pointer', fontFamily: 'inherit' }}
                                                    >
                                                        {tp.nombre}
                                                    </button>
                                                )
                                            })}
                                        </div>
                                    )}
                                    <div style={{ fontSize: 12, color: 'var(--color-muted)', marginBottom: 10 }}>
                                        Opcional. Cuando el cliente elija {opcionVisual?.nombre.toLowerCase() || 'esta opción'} en tu tienda, va a ver estas fotos.
                                    </div>
                                    {valoresParaImagen.map(({ opcion, valor }) => (
                                        <div key={`${opcion}-${valor}`} style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 10, padding: 12, marginBottom: 8 }}>
                                            <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--color-text)', marginBottom: 8 }}>
                                                {opcion}: {valor}
                                            </div>
                                            <GaleriaImagenes
                                                pendientes={imagenes.filter(i => i.valorOpcion === valor)}
                                                guardadas={guardadas.filter(g => g.optionValueId === valorIds.get(valor))}
                                                onAgregar={files => agregarImagenes(files, valor)}
                                                onQuitarPendiente={quitarPendiente}
                                                onQuitarGuardada={quitarGuardada}
                                                onPrincipal={marcarPrincipal}
                                                compacta
                                            />
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* PASO 3 — Precio y stock */}
                    {step === 3 && (
                        <div>
                            <StepHd icon={Banknote} title="¿Cuánto cuesta?" sub="Precio, costo y disponibilidad." />
                            <div style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 10, padding: 20, marginBottom: 14 }}>
                                {prod.tieneVariantes ? (
                                    <div style={{ marginBottom: 14 }}>
                                        <label style={lbl}>Aplicar un precio a todas las variantes</label>
                                        <div style={{ display: 'flex', gap: 8 }}>
                                            <div style={{ flex: 1 }}>
                                                <input
                                                    value={precioMasivo}
                                                    onChange={e => setPrecioMasivo(e.target.value.replace(/\D/g, ''))}
                                                    placeholder="0"
                                                    style={{ width: '100%', height: 40, padding: '0 12px', background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 8, fontSize: 14, color: 'var(--color-text)', fontFamily: '"Geist Mono", monospace', boxSizing: 'border-box' }}
                                                />
                                            </div>
                                            <Button
                                                variant="outline"
                                                disabled={!precioMasivo || Number(precioMasivo) <= 0}
                                                onClick={() => {
                                                    setFilas(prev => prev.map(f => ({ ...f, precio: precioMasivo })))
                                                    setPrecioMasivo('')
                                                }}
                                            >
                                                Aplicar a todas
                                            </Button>
                                        </div>
                                        <div style={{ fontSize: 11, color: 'var(--color-muted)', marginTop: 6 }}>
                                            Cada variante tiene su propio precio — ajustalos abajo si alguna cuesta distinto. En el catálogo se muestra &quot;Desde&quot; el más bajo entre las activas.
                                        </div>
                                    </div>
                                ) : (
                                    <div style={{ marginBottom: 14 }}>
                                        <PField label="Precio de venta" value={prod.precio} onChange={v => set('precio', v.replace(/\D/g, ''))} prefix="$" mono big h={44} placeholder="0" />
                                    </div>
                                )}
                                <PField label="Costo del producto (opcional)" value={prod.costo} onChange={v => set('costo', v.replace(/\D/g, ''))} prefix="$" mono h={40} />
                                <div style={{ fontSize: 11, color: 'var(--color-muted)', marginTop: 4 }}>
                                    Solo vos podés verlo. Si lo cargás, sirve para el margen y para calcular el valor de tu inventario — no hace falta para publicar.
                                </div>
                                {margen != null && (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 12, background: 'var(--color-primary-bg)', border: '1px solid var(--color-primary)', borderRadius: 8, marginTop: 12 }}>
                                        <span style={{ fontSize: 12, color: 'var(--color-body)' }}>Margen estimado</span>
                                        <div style={{ flex: 1 }} />
                                        <span style={{ height: 24, padding: '0 10px', borderRadius: 9999, background: 'var(--color-success-bg)', color: 'var(--color-success)', fontSize: 12, fontWeight: 600, fontFamily: '"Geist Mono", monospace', display: 'inline-flex', alignItems: 'center' }}>{margen}%</span>
                                    </div>
                                )}
                            </div>

                            {!prod.tieneVariantes ? (
                                <div style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 10, padding: 20 }}>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                                        <div>
                                            <PField label="SKU" value={prod.sku} onChange={v => set('sku', v.toUpperCase())} mono placeholder="RM-OVR-NG" />
                                            <button onClick={() => set('sku', generarSKU(prod.nombre))} style={{ background: 'none', border: 'none', color: 'var(--color-primary)', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit', marginTop: 4, padding: 0 }}>Generar automáticamente</button>
                                        </div>
                                        <PField label="Stock disponible" value={prod.stock} onChange={v => set('stock', v.replace(/\D/g, ''))} mono />
                                    </div>
                                    <div style={{ marginTop: 14 }}>
                                        <PField label="Stock mínimo de alerta" value={prod.stockMinimo} onChange={v => set('stockMinimo', v.replace(/\D/g, ''))} mono />
                                        <div style={{ fontSize: 11, color: 'var(--color-muted)', marginTop: 4 }}>Te avisamos cuando el stock baje a este nivel.</div>
                                    </div>
                                </div>
                            ) : (
                                <div style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 10, overflow: 'hidden' }}>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1.4fr 100px 80px 80px 70px', alignItems: 'center', gap: 10, padding: '0 14px', height: 40, background: 'var(--color-surface)', borderBottom: '1px solid var(--color-border)', fontSize: 11, fontWeight: 600, color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                                        <span>Variante</span><span>SKU</span><span>Precio</span><span>Stock</span><span>Mín.</span><span style={{ textAlign: 'center' }}>Activa</span>
                                    </div>
                                    {filas.map((f, i) => (
                                        <div key={f.clave} style={{ display: 'grid', gridTemplateColumns: '1.2fr 1.4fr 100px 80px 80px 70px', alignItems: 'center', gap: 10, padding: '0 14px', height: 44, borderBottom: i < filas.length - 1 ? '1px solid var(--color-border)' : 'none', opacity: f.activa ? 1 : 0.5 }}>
                                            <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--color-text)', fontFamily: '"Geist Mono", monospace' }}>{f.clave}</span>
                                            <input value={f.sku} disabled={!f.activa} onChange={e => setFilas(prev => prev.map((x, j) => j === i ? { ...x, sku: e.target.value.toUpperCase() } : x))} style={celda} />
                                            <input value={f.precio} disabled={!f.activa} onChange={e => setFilas(prev => prev.map((x, j) => j === i ? { ...x, precio: e.target.value.replace(/\D/g, '') } : x))} style={celda} />
                                            <input value={f.stock} disabled={!f.activa} onChange={e => setFilas(prev => prev.map((x, j) => j === i ? { ...x, stock: e.target.value.replace(/\D/g, '') } : x))} style={celda} />
                                            <input value={f.stockMin} disabled={!f.activa} onChange={e => setFilas(prev => prev.map((x, j) => j === i ? { ...x, stockMin: e.target.value.replace(/\D/g, '') } : x))} style={celda} />
                                            <button
                                                type="button"
                                                title={f.activa ? 'Dejar de ofrecer esta combinación' : 'Volver a ofrecer esta combinación'}
                                                onClick={() => setFilas(prev => prev.map((x, j) => j === i ? { ...x, activa: !x.activa } : x))}
                                                style={{ ...iconBtn, color: f.activa ? 'var(--color-success)' : 'var(--color-subtle)', justifySelf: 'center' }}
                                            >
                                                {f.activa ? <Eye size={16} strokeWidth={1.6} /> : <EyeOff size={16} strokeWidth={1.6} />}
                                            </button>
                                        </div>
                                    ))}
                                    {filas.length === 0 && (
                                        <div style={{ padding: 24, textAlign: 'center', fontSize: 13, color: 'var(--color-muted)' }}>
                                            Volvé al paso anterior y cargá al menos una opción con valores.
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                    {/* PASO 4 — Revisión */}
                    {step === 4 && (
                        <div>
                            <StepHd icon={Check} title={editando ? 'Revisá los cambios' : '¡Listo para publicar!'} sub="Verificá que esté todo bien antes de guardar." />
                            <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 12, padding: 20 }}>
                                <Resumen etiqueta="Nombre" valor={prod.nombre || '—'} />
                                <Resumen etiqueta="Categoría" valor={categorias.find(c => c.id === prod.categoriaId)?.name ?? 'Sin categoría'} />
                                <Resumen
                                    etiqueta="Precio"
                                    valor={
                                        prod.tieneVariantes
                                            ? (precioMinVariantes > 0
                                                ? `${precioUnicoVariantes ? '' : 'Desde '}${fmtMoney(precioMinVariantes)}`
                                                : '—')
                                            : (prod.precio ? fmtMoney(Number(prod.precio)) : '—')
                                    }
                                    mono
                                />
                                <Resumen etiqueta="Stock total" valor={String(stockTotal)} mono />
                                <Resumen
                                    etiqueta="Variantes"
                                    valor={
                                        prod.tieneVariantes
                                            ? (() => {
                                                const desactivadas = filas.filter(f => !f.activa).length
                                                return `${filas.length} combinaciones${desactivadas > 0 ? ` (${desactivadas} desactivada${desactivadas === 1 ? '' : 's'})` : ''}`
                                            })()
                                            : 'Sin variantes'
                                    }
                                />
                                <Resumen etiqueta="Fotos" valor={`${imagenes.length + guardadas.length}`} mono />
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 10 }}>
                                    <span style={{ fontSize: 12, color: 'var(--color-muted)' }}>Estado</span>
                                    <ProductoEstadoBadge estado={prod.estado === 'PUBLISHED' ? 'publicado' : 'borrador'} />
                                </div>
                            </div>
                            <button
                                onClick={() => void guardar()}
                                disabled={guardando || !req1 || !req3}
                                style={{ width: '100%', height: 52, borderRadius: 10, border: 'none', background: guardando || !req1 || !req3 ? 'var(--color-surface-alt)' : prod.estado === 'PUBLISHED' ? 'var(--color-primary)' : 'var(--color-success)', color: guardando || !req1 || !req3 ? 'var(--color-muted)' : 'var(--color-on-primary)', fontSize: 15, fontWeight: 700, cursor: guardando || !req1 || !req3 ? 'default' : 'pointer', fontFamily: 'inherit', marginTop: 20, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
                            >
                                {guardando
                                    ? 'Guardando…'
                                    : editando
                                        ? <>Guardar cambios</>
                                        : prod.estado === 'PUBLISHED'
                                            ? <><Globe size={18} strokeWidth={1.8} /> Crear producto</>
                                            : <><FileText size={18} strokeWidth={1.8} /> Guardar como borrador</>}
                            </button>
                            {(!req1 || !req3) && (
                                <div style={{ fontSize: 12, color: 'var(--color-error)', textAlign: 'center', marginTop: 8 }}>
                                    Falta {faltaNombre ? 'el nombre del producto' : faltaCategoria ? 'seleccionar una categoría' : prod.tieneVariantes ? 'el precio de alguna variante activa' : 'el precio de venta'}.
                                </div>
                            )}
                        </div>
                    )}

                    {/* Footer — grid de 3 columnas (no space-between): con "space-between" el
                        texto del medio quedaba corrido hacia la izquierda en el paso 4, donde
                        el lado derecho es un <div/> vacío en vez de un botón del mismo ancho
                        que el de la izquierda. Con columnas fijas queda centrado siempre. */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', marginTop: 24, paddingTop: 20, borderTop: '1px solid var(--color-border)' }}>
                        <div>
                            {step > 1
                                ? <Button variant="outline" icon={<ChevronLeft size={14} />} onClick={() => setStep(step - 1)}>Volver</Button>
                                : <Button variant="outline" onClick={onVolver}>Cancelar</Button>}
                        </div>
                        <span style={{ fontSize: 12, color: 'var(--color-muted)', fontFamily: '"Geist Mono", monospace', textAlign: 'center' }}>Paso {step} de 4</span>
                        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                            {step < 4 &&
                                <Button variant="primary" onClick={next} disabled={!canNext}>Continuar <ChevronRight size={16} strokeWidth={2} /></Button>}
                        </div>
                    </div>
                </Card>

                {/* ── Preview en vivo ── */}
                <div className="pn-preview">
                    <Card padding="sm" style={{ padding: 16 }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>
                            Vista previa
                        </div>
                        <PreviewProducto
                            nombre={prod.nombre}
                            descripcion={prod.descripcion}
                            precio={prod.tieneVariantes ? String(precioMinVariantes || '') : prod.precio}
                            desde={prod.tieneVariantes && !precioUnicoVariantes && precioMinVariantes > 0}
                            estado={prod.estado}
                            categoria={categorias.find(c => c.id === prod.categoriaId)?.name}
                            imagen={
                                // Igual criterio que el backend (pickPrimaryImageUrl): principal
                                // marcada > primera general > primera de variante que exista. Antes
                                // se cortaba en "primera general" y, si el producto es puramente de
                                // variantes (solo fotos por color, ninguna general), el preview
                                // quedaba sin foto aunque sí hubiera fotos cargadas.
                                imagenes.find(i => i.principal)?.preview
                                ?? imagenes.find(i => !i.valorOpcion)?.preview
                                ?? guardadas.find(g => g.principal)?.url
                                ?? guardadas.find(g => !g.optionValueId)?.url
                                ?? imagenes[0]?.preview
                                ?? guardadas[0]?.url
                            }
                            variantes={prod.tieneVariantes ? prod.tiposVariante.filter(t => t.nombre.trim() && t.opciones.length) : []}
                            stockTotal={stockTotal}
                        />
                    </Card>
                </div>
            </div>
        </div>
    )
}

// ─── Preview ──────────────────────────────────────────────────────────────────

function PreviewProducto({ nombre, descripcion, precio, desde, estado, categoria, imagen, variantes, stockTotal }: {
    nombre: string; descripcion: string; precio: string; desde?: boolean
    estado: ProductStatus; categoria?: string; imagen?: string
    variantes: TipoVariante[]; stockTotal: number
}) {
    const p = Number(precio) || 0

    return (
        <div style={{ border: '1px solid var(--color-border)', borderRadius: 12, overflow: 'hidden', background: 'var(--color-bg)' }}>
            <div style={{ position: 'relative', width: '100%', aspectRatio: '1', background: 'var(--color-surface)' }}>
                {/* object-fit: contain, no cover — mismo criterio que la
                    card real de la grilla (ProductoLista.tsx) y el
                    storefront: esta vista previa tiene que mostrar
                    honestamente cómo va a quedar la foto ahí, no una que se
                    ve distinta acá que en la lista. */}
                {imagen
                    ? <img src={imagen} alt={nombre} style={{ position: 'absolute', inset: '6%', width: '88%', height: '88%', objectFit: 'contain', display: 'block' }} />
                    : <div style={{ width: '100%', height: '100%', display: 'grid', placeItems: 'center', color: 'var(--color-subtle)' }}>
                        <div style={{ textAlign: 'center' }}>
                            <ImageIcon size={28} strokeWidth={1.4} />
                            <div style={{ fontSize: 11, marginTop: 6 }}>Sin foto todavía</div>
                        </div>
                    </div>}
                {estado === 'DRAFT' && (
                    <span style={{ position: 'absolute', top: 10, right: 10, height: 22, padding: '0 8px', borderRadius: 9999, background: 'rgba(15,23,42,0.75)', color: '#fff', fontSize: 10, fontWeight: 700, display: 'inline-flex', alignItems: 'center' }}>
                        BORRADOR
                    </span>
                )}
            </div>
            <div style={{ padding: 14 }}>
                {categoria && <div style={{ fontSize: 11, color: 'var(--color-muted)', marginBottom: 4 }}>{categoria}</div>}
                <div style={{ fontSize: 15, fontWeight: 700, color: nombre ? 'var(--color-text)' : 'var(--color-subtle)', lineHeight: 1.3 }}>
                    {nombre || 'Nombre del producto'}
                </div>
                {descripcion && (
                    <div style={{ fontSize: 12, color: 'var(--color-muted)', marginTop: 6, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                        {descripcion}
                    </div>
                )}
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginTop: 10 }}>
                    {desde && p > 0 && <span style={{ fontSize: 12, color: 'var(--color-muted)' }}>Desde</span>}
                    <span style={{ fontSize: 20, fontWeight: 800, color: 'var(--color-text)', fontFamily: '"Geist Mono", monospace' }}>
                        {p > 0 ? fmtMoney(p) : '$—'}
                    </span>
                </div>
                {variantes.map(v => (
                    <div key={v.id} style={{ marginTop: 10 }}>
                        <div style={{ fontSize: 11, color: 'var(--color-muted)', marginBottom: 5 }}>{v.nombre}</div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                            {v.opciones.slice(0, 6).map(op => (
                                <span key={op} style={{ display: 'inline-flex', alignItems: 'center', height: 24, padding: '0 9px', borderRadius: 6, border: '1px solid var(--color-border)', fontSize: 11, color: 'var(--color-body)' }}>{op}</span>
                            ))}
                            {v.opciones.length > 6 && <span style={{ fontSize: 11, color: 'var(--color-muted)', alignSelf: 'center' }}>+{v.opciones.length - 6}</span>}
                        </div>
                    </div>
                ))}
                <div style={{ marginTop: 12, paddingTop: 10, borderTop: '1px solid var(--color-border)', fontSize: 11, color: stockTotal > 0 ? 'var(--color-muted)' : 'var(--color-error)' }}>
                    {stockTotal > 0 ? `${stockTotal} unidades disponibles` : 'Sin stock'}
                </div>
            </div>
        </div>
    )
}

// ─── Galería ──────────────────────────────────────────────────────────────────

function GaleriaImagenes({ pendientes, guardadas, onAgregar, onQuitarPendiente, onQuitarGuardada, onPrincipal, permitePrincipal, compacta }: {
    pendientes: ImagenPendiente[]
    guardadas: ImagenGuardada[]
    onAgregar: (files: FileList | null) => void
    onQuitarPendiente: (key: string) => void
    onQuitarGuardada: (id: string) => void
    onPrincipal: (key: string) => void
    permitePrincipal?: boolean
    compacta?: boolean
}) {
    const alto = compacta ? 72 : 96
    return (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {guardadas.map(g => (
                <div key={g.id} style={{ position: 'relative', width: alto, height: alto, borderRadius: 8, overflow: 'hidden', border: g.principal ? '2px solid var(--color-primary)' : '1px solid var(--color-border)' }}>
                    <img src={g.url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                    {g.principal && <span style={{ position: 'absolute', top: 3, left: 3, background: 'var(--color-primary)', color: 'var(--color-on-primary)', borderRadius: 4, padding: '1px 4px', fontSize: 9, fontWeight: 700 }}>Principal</span>}
                    <button onClick={() => onQuitarGuardada(g.id)} title="Eliminar" style={btnSobreImg}><Trash2 size={12} /></button>
                </div>
            ))}
            {pendientes.map(img => (
                <div key={img.key} style={{ position: 'relative', width: alto, height: alto, borderRadius: 8, overflow: 'hidden', border: img.principal ? '2px solid var(--color-primary)' : '1px solid var(--color-border)' }}>
                    <img src={img.preview} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                    {permitePrincipal && (
                        <button onClick={() => onPrincipal(img.key)} title="Marcar como principal" style={{ ...btnSobreImg, left: 3, right: 'auto', background: img.principal ? 'var(--color-primary)' : 'rgba(15,23,42,0.55)' }}>
                            <Star size={12} fill={img.principal ? '#fff' : 'none'} />
                        </button>
                    )}
                    <button onClick={() => onQuitarPendiente(img.key)} title="Quitar" style={btnSobreImg}><X size={12} /></button>
                </div>
            ))}
            <label style={{ width: alto, height: alto, borderRadius: 8, border: '1.5px dashed var(--color-border)', background: 'var(--color-surface)', display: 'grid', placeItems: 'center', cursor: 'pointer', color: 'var(--color-muted)' }}>
                <input type="file" accept="image/*" multiple onChange={e => { onAgregar(e.target.files); e.target.value = '' }} style={{ display: 'none' }} />
                <Plus size={compacta ? 16 : 20} />
            </label>
        </div>
    )
}

// ─── Sub-componentes ──────────────────────────────────────────────────────────

function StepHd({ icon: Icon, title, sub }: { icon: ComponentType<{ size?: number; strokeWidth?: number }>; title: string; sub: string }) {
    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: 'var(--color-primary-bg)', color: 'var(--color-primary)', display: 'grid', placeItems: 'center', flexShrink: 0 }}><Icon size={20} strokeWidth={1.6} /></div>
            <div><h2 style={{ fontSize: 18, fontWeight: 600, color: 'var(--color-text)', margin: 0 }}>{title}</h2><div style={{ fontSize: 13, color: 'var(--color-muted)' }}>{sub}</div></div>
        </div>
    )
}

// Bloquea TODO el formulario (no solo el campo de categoría) cuando el
// negocio todavía no creó ninguna categoría — sin al menos una, no hay nada
// que elegir y no tiene sentido dejar cargar nombre/precio/fotos para recién
// frenar al final. Redirige al submódulo de categorías con un click.
function SinCategoriasAviso({ negocioId }: { negocioId: string }) {
    const router = useRouter()
    return (
        <div style={{ padding: '48px 24px', textAlign: 'center' }}>
            <div style={{ width: 56, height: 56, borderRadius: 14, background: 'var(--color-warning-bg, #FEF3C7)', color: 'var(--color-warning, #D97706)', display: 'grid', placeItems: 'center', margin: '0 auto 16px' }}>
                <AlertTriangle size={26} strokeWidth={1.6} />
            </div>
            <h2 style={{ fontSize: 17, fontWeight: 600, color: 'var(--color-text)', margin: '0 0 8px' }}>
                Todavía no tenés categorías creadas
            </h2>
            <p style={{ fontSize: 13.5, color: 'var(--color-muted)', maxWidth: 380, margin: '0 auto 22px', lineHeight: 1.6 }}>
                Necesitás al menos una categoría para poder crear un producto — así aparece
                agrupado y es más fácil de encontrar en tu tienda. Creá la primera y volvé acá.
            </p>
            <Button
                variant="primary"
                icon={<FolderPlus size={16} />}
                onClick={() => router.push(adminPath(negocioId, 'ventas', 'categorias'))}
            >
                Crear categoría
            </Button>
        </div>
    )
}

function Resumen({ etiqueta, valor, mono }: { etiqueta: string; valor: string; mono?: boolean }) {
    return (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--color-border)' }}>
            <span style={{ fontSize: 12, color: 'var(--color-muted)' }}>{etiqueta}</span>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text)', fontFamily: mono ? '"Geist Mono", monospace' : 'inherit' }}>{valor}</span>
        </div>
    )
}

function PField({ label, value, onChange, placeholder, prefix, mono, h = 40, big }: {
    label: string; value: string; onChange: (v: string) => void; placeholder?: string
    prefix?: string; mono?: boolean; h?: number; big?: boolean
}) {
    return (
        <div>
            <label style={lbl}>{label}</label>
            <div style={{ display: 'flex', alignItems: 'center', height: h, padding: '0 12px', background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 8, gap: 6 }}>
                {prefix && <span style={{ color: 'var(--color-muted)', fontSize: big ? 18 : 14, fontFamily: '"Geist Mono", monospace' }}>{prefix}</span>}
                <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} style={{ flex: 1, height: '100%', border: 'none', outline: 'none', background: 'transparent', fontSize: big ? 18 : 14, fontWeight: big ? 600 : 400, color: 'var(--color-text)', fontFamily: mono ? '"Geist Mono", monospace' : 'inherit' }} />
            </div>
        </div>
    )
}

function TogRow({ label, help, on, onChange }: { label: string; help?: string; on: boolean; onChange: (v: boolean) => void }) {
    return (
        <label style={{ display: 'flex', alignItems: 'center', gap: 14, padding: 14, background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 10, cursor: 'pointer' }}>
            <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text)' }}>{label}</div>
                {help && <div style={{ fontSize: 12, color: 'var(--color-muted)', marginTop: 2 }}>{help}</div>}
            </div>
            <span onClick={e => { e.preventDefault(); onChange(!on) }} style={{ width: 40, height: 22, borderRadius: 11, background: on ? 'var(--color-success)' : 'var(--color-surface-alt)', border: on ? 'none' : '1px solid var(--color-border)', position: 'relative', flexShrink: 0 }}>
                <span style={{ position: 'absolute', top: on ? 3 : 2, left: on ? 20 : 2, width: 16, height: 16, borderRadius: '50%', background: '#fff', boxShadow: '0 1px 3px rgba(15,23,42,0.15)', transition: 'left 200ms' }} />
            </span>
        </label>
    )
}

// Combobox con búsqueda para elegir categoría — reemplaza al <select> nativo,
// que con muchas categorías/subcategorías se vuelve tedioso de recorrer
// (listado plano larguísimo sin forma de filtrar). Mantiene la jerarquía
// (padre en negrita, hijas indentadas) pero permite escribir para filtrar.
function CategoriaSelect({ categorias, value, onChange }: {
    categorias: ApiCategory[]; value: string; onChange: (id: string) => void
}) {
    const [open, setOpen] = useState(false)
    const [q, setQ] = useState('')
    const ref = useRef<HTMLDivElement>(null)

    useEffect(() => {
        if (!open) return
        function onDocClick(e: MouseEvent) {
            if (ref.current && !ref.current.contains(e.target as Node)) { setOpen(false); setQ('') }
        }
        document.addEventListener('mousedown', onDocClick)
        return () => document.removeEventListener('mousedown', onDocClick)
    }, [open])

    const seleccionada = categorias.find(c => c.id === value)
    const query = q.trim().toLowerCase()

    const grupos = categorias
        .filter(c => !c.parentId)
        .map(padre => {
            const hijas = categorias.filter(h => h.parentId === padre.id)
            if (!query) return { padre, hijas, mostrarPadre: true }
            const padreCoincide = padre.name.toLowerCase().includes(query)
            const hijasCoinciden = hijas.filter(h => h.name.toLowerCase().includes(query))
            if (padreCoincide) return { padre, hijas, mostrarPadre: true }
            if (hijasCoinciden.length) return { padre, hijas: hijasCoinciden, mostrarPadre: false }
            return null
        })
        .filter((g): g is { padre: ApiCategory; hijas: ApiCategory[]; mostrarPadre: boolean } => g !== null)

    function elegir(id: string) {
        onChange(id)
        setOpen(false)
        setQ('')
    }

    return (
        <div ref={ref} style={{ position: 'relative' }}>
            <button
                type="button"
                onClick={() => setOpen(o => !o)}
                style={{ ...inputBase, width: '100%', height: 40, padding: '0 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', textAlign: 'left' }}
            >
                <span style={{ fontSize: 14, color: seleccionada ? 'var(--color-text)' : 'var(--color-subtle)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {seleccionada ? seleccionada.name : 'Elegí una categoría'}
                </span>
                <ChevronDown size={15} style={{ color: 'var(--color-muted)', flexShrink: 0, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 150ms' }} />
            </button>

            {open && (
                <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 4, background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 8, boxShadow: '0 8px 24px rgba(15,23,42,0.14)', zIndex: 20, maxHeight: 280, overflowY: 'auto' }}>
                    <div style={{ position: 'sticky', top: 0, background: 'var(--color-bg)', padding: 8, borderBottom: '1px solid var(--color-border)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '0 8px', height: 34, border: '1px solid var(--color-border)', borderRadius: 6, background: 'var(--color-surface)' }}>
                            <Search size={13} style={{ color: 'var(--color-muted)', flexShrink: 0 }} />
                            <input
                                autoFocus
                                value={q}
                                onChange={e => setQ(e.target.value)}
                                placeholder="Buscar categoría…"
                                style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', fontSize: 13, color: 'var(--color-text)', fontFamily: 'inherit' }}
                            />
                        </div>
                    </div>

                    {grupos.length === 0 && (
                        <div style={{ padding: '18px 12px', textAlign: 'center', fontSize: 12.5, color: 'var(--color-muted)' }}>Sin resultados</div>
                    )}

                    {grupos.map(({ padre, hijas, mostrarPadre }) => (
                        <div key={padre.id}>
                            {mostrarPadre && (
                                <button
                                    type="button"
                                    onClick={() => elegir(padre.id)}
                                    style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 12px', background: value === padre.id ? 'var(--color-primary-bg)' : 'none', border: 'none', cursor: 'pointer', fontSize: 13.5, fontWeight: 600, color: 'var(--color-text)', fontFamily: 'inherit' }}
                                >
                                    {padre.name}
                                </button>
                            )}
                            {hijas.map(h => (
                                <button
                                    key={h.id}
                                    type="button"
                                    onClick={() => elegir(h.id)}
                                    style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 12px 8px 26px', background: value === h.id ? 'var(--color-primary-bg)' : 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: 'var(--color-body)', fontFamily: 'inherit' }}
                                >
                                    {h.name}
                                </button>
                            ))}
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}

function OpInput({ tipo, onAdd }: { tipo: string; onAdd: (v: string) => void }) {
    const [v, setV] = useState('')
    const t = tipo.toLowerCase()
    const ph = t.includes('talle') ? 'Ej: XL' : t.includes('color') ? 'Ej: Negro' : 'Nueva opción'
    const commit = () => { if (v.trim()) { onAdd(v.trim()); setV('') } }
    return (
        <input
            value={v}
            onChange={e => setV(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); commit() } }}
            onBlur={commit}
            placeholder={ph}
            style={{ ...inputBase, height: 30, width: 120, padding: '0 10px', fontSize: 12 }}
        />
    )
}

const pageWrap: React.CSSProperties = { padding: '24px 32px 64px', maxWidth: 1280, width: '100%', margin: '0 auto', boxSizing: 'border-box' }
const lbl: React.CSSProperties = { fontSize: 13, fontWeight: 500, color: 'var(--color-body)', marginBottom: 6, display: 'block' }
const inputBase: React.CSSProperties = { boxSizing: 'border-box', background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 8, color: 'var(--color-text)', fontFamily: 'inherit', outline: 'none' }
const iconBtn: React.CSSProperties = { width: 28, height: 28, borderRadius: 6, border: 'none', background: 'transparent', color: 'var(--color-muted)', cursor: 'pointer', display: 'grid', placeItems: 'center' }
const celda: React.CSSProperties = { ...inputBase, height: 28, padding: '0 8px', fontSize: 11, fontFamily: '"Geist Mono", monospace', width: '100%' }
const chip: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 5, height: 26, padding: '0 10px', borderRadius: 9999, background: 'var(--color-primary-bg)', color: 'var(--color-primary)', fontSize: 12, fontWeight: 500 }
const chipX: React.CSSProperties = { background: 'none', border: 'none', color: 'var(--color-primary)', cursor: 'pointer', display: 'grid', placeItems: 'center', padding: 0 }
const btnSobreImg: React.CSSProperties = { position: 'absolute', top: 3, right: 3, width: 20, height: 20, borderRadius: 5, border: 'none', background: 'rgba(15,23,42,0.55)', color: '#fff', cursor: 'pointer', display: 'grid', placeItems: 'center', padding: 0 }
