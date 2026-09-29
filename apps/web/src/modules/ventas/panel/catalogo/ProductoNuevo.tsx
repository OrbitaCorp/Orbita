// src/modules/ventas/panel/catalogo/ProductoNuevo.tsx — Vista P2
// Alta y edición de producto (RBT-302 / RBT-303).
//
// UNA sola pantalla, en el orden de un marketplace: fotos → nombre, precio,
// stock y categoría → variantes → descripción → "Más detalles" (cerrado).
// Antes eran cuatro pasos (Info, Variantes e imágenes, Precio y stock,
// Revisión) y las fotos venían recién en el segundo. Sirve igual para editar:
// cambiar un precio ya no obliga a recorrer cuatro pasos.
//
// Las fotos se pueden subir ANTES de definir las variantes: viven como `File`
// pendientes y recién se asocian a un valor de opción (el color) al guardar,
// así que el orden en pantalla no condiciona nada.
//
// Orden de guardado: primero se crea/actualiza el producto (POST/PUT) y recién
// con la respuesta —que ya trae los ids de cada valor de opción— se suben las
// imágenes pendientes. Antes de eso no existe el optionValueId al que apuntan.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { useRouter } from 'next/router'
import { Check, ChevronLeft, ChevronRight, ChevronDown, Plus, X, Sparkles, Trash2, ImageIcon, Search, Eye, EyeOff, FolderPlus, AlertTriangle, Info, ImagePlus, Loader2 } from 'lucide-react'
import { Card } from '@/design-system/components/Card'
import { Button } from '@/design-system/components/Button'
import { Skeleton } from '@/design-system/components/Skeleton'
import { fmtMoney, formatMiles } from '@/lib/utils'
import { adminPath, currentSlug } from '@/lib/tenant'
import { esArchivoDeImagen, normalizarImagen, optimizarImagenParaScan, MAX_IMAGEN_MB, MAX_IMAGEN_BYTES } from '@/lib/heic'
import { estandarizarImagenProducto } from '@/lib/imageStandardizer'
import { parseVideoEmbed } from '@/lib/storefront/utils'
import { VideoUploader, esVideoArchivo } from '../configuracion/components/apariencia/VideoUploader'
import { ProductoThumb } from '../pedidos/components/ProductoThumb'
import { EstudioFondoModal, type ImagenParaFondo, type ResultadoFondo } from './EstudioFondoModal'
import {
    panelCreateProduct, panelUpdateProduct, panelGetProductFull,
    panelGetCategoriesFlat, panelUploadProductImage, panelDeleteProductImage, panelSetProductImageBackground, panelReorderProductImages,
    panelPresignProductVideo,
    panelGetTags, panelCreateTag, panelAiAssist, panelAiVariants, panelAiScanProduct, panelGetSuggestedImages, panelProxyImage, panelGetAddons,
    panelGetBusiness, panelGetVariantHistory,
    ApiError,
    panelGenerateProductBackground,
    type ApiCategory, type ApiProductFull, type UpsertProductInput, type ProductStatus, type ApiTag, type SuggestedProductImage, type AiVariantOption, type ApiVariantHistory,
} from '@/lib/api'
import { specsDelNegocio, type PresetVariantes } from './presetsVariantes'
import {
    beginProductCreation, markProductCreated, markImageUploaded,
    markProductCreationFailed, finishProductUpload, clearProductUpload, useProductUploads,
    beginProductEdit, finishProductEdit, markProductEditFailed,
} from '@/lib/productUploadTracker'
import { Volver } from '../_shared/Volver'
import { ContenidoFichaModal } from './components/ContenidoFichaModal'

// "Quitar fondo" / "Fondo con IA" de fotos de producto: activo por defecto.
// Para ponerlo en mantenimiento: NEXT_PUBLIC_FONDO_IA_MANTENIMIENTO=true.
const FONDO_IA_MANTENIMIENTO = process.env.NEXT_PUBLIC_FONDO_IA_MANTENIMIENTO === 'true'
const TITULO_MANTENIMIENTO = 'En mantenimiento — vuelve pronto'

// ─── Tipos del formulario ─────────────────────────────────────────────────────

// `esVisual`: si esta opción es la que tiene fotos por valor (ej. Color).
// Siempre opt-in — el vendedor lo activa a mano con "activar"/"cambiar",
// nunca se asume por default aunque haya una sola opción definida (ver
// `opcionVisual` más abajo).
// `sugeridos`: los valores que ofrece el modelo de rubro del que salió esta
// opción (ver presetsVariantes.ts) — se muestran para agregar con un toque.
// `habituales`: el subconjunto que "suele" usarse (los `pre` del modelo); se
// aplica de una sola vez con "Usar los habituales". Ninguno arranca elegido:
// sugerir es distinto de decidir por el vendedor. Solo viven en el
// formulario, nunca se guardan.
interface TipoVariante { id: string; nombre: string; opciones: string[]; esVisual?: boolean; sugeridos?: string[]; habituales?: string[] }

// Un modelo de rubro convertido a las opciones del formulario. Los ids llevan
// el índice además del timestamp: las opciones de un mismo modelo se crean en
// el mismo milisegundo y el id tiene que ser único (es la `key` de React).
function desdePreset(preset: PresetVariantes): TipoVariante[] {
    const t = Date.now()
    return preset.opciones.map((o, i) => ({
        id: `v${t}-${i}`,
        nombre: o.nombre,
        opciones: [],
        sugeridos: o.valores,
        habituales: o.pre ?? o.valores,
    }))
}

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
    // Paquete "Avanzado" — true si a esta foto YA se le quitó el fondo (recorte
    // local, ver quitarFondoAhora): `file`/`preview` son el PNG transparente y
    // `original` guarda la foto tal cual se cargó, para poder deshacerlo.
    quitarFondo?: boolean
    original?: { file: File; preview: string }
    // true si `file` ya viene compuesto por "Fondo con IA" (ver
    // EstudioFondoModal/aplicarFondoIA) — se manda al subir para que el
    // storefront la muestre con object-fit:cover, ver ProductImage.hasAiBackground.
    fondoIA?: boolean
    // true mientras el normalizador automático está encuadrando/centrando la foto
    encuadrando?: boolean
    // true mientras "Fondo con IA" sigue generando el fondo de esta foto en
    // segundo plano (el vendedor tocó "Aplicar y seguir" sin esperar el preview).
    aplicandoFondo?: boolean
}

interface ImagenGuardada {
    id: string
    url: string
    principal: boolean
    optionValueId: string | null
    hasAiBackground: boolean
    /** El sistema le quitó el fondo; `url` ya es la versión sin fondo. */
    backgroundRemoved: boolean
}

interface ProdForm {
    nombre: string; descripcion: string; categoriaId: string; tags: string[]; estado: ProductStatus
    precio: string; costo: string; sku: string
    stock: string; stockMinimo: string
    // "Fondo con IA" premium: flat (plano) o volume (con volumen) — ver
    // ImageStudioService.generatePremiumBackground(). Se sugiere solo según
    // la categoría al elegirla por primera vez (ver sugerirPhotoType), el
    // vendedor lo puede cambiar si no aplica.
    photoType: 'flat' | 'volume'
    tieneVariantes: boolean; tiposVariante: TipoVariante[]
    // Ficha técnica opcional ("RAM" -> "16GB") — ideal para productos de
    // tecnología. [] = el producto no tiene, el detalle del storefront no
    // muestra la tabla de "Características".
    specs: EspecTecnica[]
    // Link (YouTube/Vimeo/archivo) o el resultado de subir el archivo — mismo
    // criterio que ap.videoUrl en Apariencia (ver parseVideoEmbed). '' = el
    // producto no tiene video.
    videoUrl: string
}

interface EspecTecnica { label: string; value: string }

interface ProductoNuevoProps {
    onVolver: () => void
    onToast: (m: string) => void
    editarId?: string
}

// ─── Skeletons — misma forma exacta del contenido real, armados con las piezas
// del componente compartido design-system/Skeleton.tsx (clase `.skel` de
// globals.css: mismo barrido de luz y corte por prefers-reduced-motion que el
// resto del panel). ─────────────────────────────────────────────────────────

// Reemplaza SOLO el contenido del formulario mientras se resuelve si el negocio
// tiene categorías (ver `categoriasCargando`) — card y preview siguen siendo
// los reales, así no hay salto de layout cuando resuelve.
function PasoInfoSkeleton() {
    return (
        <div>
            <Skeleton width={60} height={14} radius={8} style={{ marginBottom: 12 }} />
            <Skeleton width="100%" height={132} radius={10} style={{ marginBottom: 24 }} />
            <Skeleton width="100%" height={46} radius={8} style={{ marginBottom: 16 }} />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1.4fr', gap: 12, marginBottom: 24 }}>
                <Skeleton width="100%" height={40} radius={8} />
                <Skeleton width="100%" height={40} radius={8} />
                <Skeleton width="100%" height={40} radius={8} />
            </div>
            <Skeleton width="100%" height={64} radius={10} style={{ marginBottom: 24 }} />
            <Skeleton width="100%" height={84} radius={8} />
        </div>
    )
}

// Reemplaza el formulario ENTERO mientras se carga un producto existente para
// editar (`editarId`) — misma forma exacta del layout real (título, card +
// preview de 2 columnas) para que no haya salto cuando llega la respuesta.
function ProductoNuevoSkeleton() {
    return (
        <div className="pn-page" style={pageWrap}>
            <style>{`
                .pn-page   { padding: 24px 32px 64px; }
                .pn-layout { display: grid; grid-template-columns: minmax(0,1fr) 340px; gap: 20px; align-items: start; }
                @media (max-width: 1080px) { .pn-layout { grid-template-columns: minmax(0,1fr) !important; } }
                @media (max-width: 768px)  { .pn-page { padding: 16px 14px 48px !important; } }
            `}</style>
            <Skeleton width={220} height={30} radius={8} style={{ marginBottom: 20 }} />
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

// Heurística de sugerencia (no determina nada por sí sola, el vendedor
// siempre puede cambiarla): categorías de indumentaria/calzado son casi
// siempre planas; el resto se sugiere con volumen por default, que es lo más
// común fuera de moda. Palabras sueltas, no una taxonomía fija — las
// categorías son texto libre del vendedor.
const PALABRAS_PLANO = ['ropa', 'indumentaria', 'remera', 'remeras', 'camisa', 'camisas', 'campera', 'camperas', 'buzo', 'buzos', 'pantalon', 'pantalones', 'jean', 'jeans', 'vestido', 'vestidos', 'short', 'shorts', 'falda', 'faldas', 'calzado', 'zapatilla', 'zapatillas', 'zapato', 'zapatos', 'media', 'medias', 'ropa interior', 'traje de baño', 'bikini', 'conjunto', 'conjuntos', 'moda']
function sugerirPhotoType(nombreCategoria: string): 'flat' | 'volume' {
    const n = nombreCategoria.toLowerCase()
    return PALABRAS_PLANO.some(p => n.includes(p)) ? 'flat' : 'volume'
}

const FORM_INICIAL: ProdForm = {
    nombre: '', descripcion: '', categoriaId: '', tags: [], estado: 'PUBLISHED',
    precio: '', costo: '', sku: '',
    stock: '0', stockMinimo: '5',
    photoType: 'flat',
    tieneVariantes: false,
    tiposVariante: [{ id: 'v1', nombre: 'Talle', opciones: [], sugeridos: ['S', 'M', 'L', 'XL'], habituales: ['S', 'M', 'L', 'XL'] }],
    specs: [],
    videoUrl: '',
}

// El "Stock mínimo de alerta" casi siempre es el mismo número para todos los
// productos de un negocio (ej. "avisame cuando queden menos de 3") — pedirlo
// de nuevo en cada alta es fricción sin sentido. Se guarda el último valor
// que el usuario haya tocado y se usa como default de ahí en más, en vez del
// "5" fijo de FORM_INICIAL.
const STOCK_MINIMO_KEY = 'orbita:catalogo:stockMinimoDefault'
// Mismo criterio con la categoría: quien carga varios productos seguidos casi
// siempre los carga de la misma. Se guarda la del último producto publicado.
const CATEGORIA_KEY = 'orbita:catalogo:categoriaDefault'
// "Cargar otro después": quien sube un catálogo lo deja tildado y queda así.
const CARGAR_OTRO_KEY = 'orbita:catalogo:cargarOtro'

function formInicialConDefaults(): ProdForm {
    if (typeof window === 'undefined') return FORM_INICIAL
    const guardado = window.localStorage.getItem(STOCK_MINIMO_KEY)
    return guardado ? { ...FORM_INICIAL, stockMinimo: guardado } : FORM_INICIAL
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

// Alternativa a pegar un link en "Video del producto" — mismo criterio que
// subirVideoApariencia() en Apariencia.tsx: sube directo a Cloudflare R2
// desde el navegador (ver panelPresignProductVideo en lib/api.ts), sin pasar
// por este backend. Sin productId: puede subirse antes de que el producto
// exista (mismo momento del wizard que las fotos).
async function subirVideoProducto(file: File, onProgress?: (pct: number) => void): Promise<string> {
    return panelPresignProductVideo(file, onProgress)
}

export default function ProductoNuevo({ onVolver, onToast, editarId }: ProductoNuevoProps) {
    const editando = !!editarId
    const [contenidoAbierto, setContenidoAbierto] = useState(false)
    const router = useRouter()
    const negocioId = currentSlug() ?? (router.query.negocioId as string)

    // Estado con el que se intentó guardar (null = todavía no se intentó). Recién
    // ahí se marcan en rojo los campos que faltan: el botón nunca queda
    // deshabilitado sin explicar por qué.
    const [intento, setIntento] = useState<ProductStatus | null>(null)
    const [masAbierto, setMasAbierto] = useState(false)
    // "Solo stock" = grilla talle × color; "Precio y stock" = lista con precio,
    // stock y ojo por fila. La grilla solo existe con exactamente dos opciones.
    const [vista, setVista] = useState<'grilla' | 'lista'>('grilla')
    // Tras publicar, quedarse en el formulario (vacío, con la misma categoría)
    // en vez de volver a la lista. `enviados`: los productos mandados desde
    // esta pantalla, para mostrar cómo van (el guardado sigue en segundo plano).
    const [cargarOtro, setCargarOtro] = useState(() => {
        if (typeof window === 'undefined') return false
        try { return window.localStorage.getItem(CARGAR_OTRO_KEY) === '1' } catch { return false }
    })
    const [enviados, setEnviados] = useState<string[]>([])
    // Cuántas fotos siguen esperando su fondo de "Fondo con IA" en segundo plano.
    // Mientras haya alguna no se puede guardar: se subiría la foto sin el fondo.
    const [fondosEnCurso, setFondosEnCurso] = useState(0)
    const subidas = useProductUploads()
    const [orbiGen, setOrbiGen] = useState(false)
    const [orbiScanGen, setOrbiScanGen] = useState(false)
    // Key de la foto que Orbi ya escaneó. Antes era un booleano suelto: si el
    // vendedor borraba esa foto y subía otra, seguía en true y "Completar con
    // esta foto" no volvía a aparecer para la nueva.
    const [orbiScanKey, setOrbiScanKey] = useState<string | null>(null)
    const fileInputScanRef = useRef<HTMLInputElement>(null)
    const nombreInputRef = useRef<HTMLTextAreaElement>(null)
    // Arranca apagado — la mayoría de los productos no tienen ficha técnica.
    // Se prende solo si el vendedor lo pide, o al editar uno que ya la tenía
    // cargada (ver la precarga más abajo).
    const [mostrarSpecs, setMostrarSpecs] = useState(false)
    const [orbiSpecsGen, setOrbiSpecsGen] = useState(false)
    const [tagInput, setTagInput] = useState('')
    const [prod, setProd] = useState<ProdForm>(formInicialConDefaults)
    // El SKU se autogenera a partir del nombre mientras el usuario no haya
    // tocado el campo a mano — apenas escribe algo propio, se respeta y se
    // deja de pisarlo en cada cambio de nombre (ver efecto más abajo).
    const skuAutoRef = useRef(true)
    // Mismo patrón que skuAutoRef: el default de photoType se sugiere solo
    // según la categoría MIENTRAS el vendedor no haya tocado el control a
    // mano — apenas lo cambia él mismo, se respeta (ver sugerirPhotoType).
    const photoTypeAutoRef = useRef(true)
    const [filas, setFilas] = useState<FilaVariante[]>([])
    // Id de LA variante, para un producto SIN opciones que se está editando —
    // separado de `filas` a propósito (ver bug de abajo). `undefined` = alta
    // nueva (todavía no hay ninguna variante que reconciliar).
    const [varianteUnicaId, setVarianteUnicaId] = useState<string | undefined>(undefined)
    // Valor de la fila "Todas" de la tabla de variantes — nunca se manda al
    // backend, solo sirve para completar `filas[].stock` en lote. Con muchas
    // combinaciones (3 talles x 3 colores = 9 filas) cargar el mismo número fila
    // por fila era lo más tedioso. El precio no tiene fila propia: el "Precio"
    // de arriba ya se copia a todas las filas (ver cambiarPrecio).
    const [stockMasivo, setStockMasivo] = useState('')
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
    const [cargando, setCargando] = useState(!!editarId)
    const [error, setError] = useState('')

    // Ajuste dinámico de altura para el nombre del producto: tanto al crear como
    // al EDITAR un producto existente con nombre largo (60-80 caracteres), permite
    // que el texto haga wrap y se extienda hacia abajo en vez de quedar recortado
    // horizontalmente, facilitando editar y ver todo sin importar la pantalla.
    useEffect(() => {
        if (nombreInputRef.current) {
            nombreInputRef.current.style.height = 'auto'
            nombreInputRef.current.style.height = `${Math.max(26, nombreInputRef.current.scrollHeight)}px`
        }
    }, [prod.nombre, cargando])
    // Paquete "Avanzado" — habilita el toggle de "quitar fondo con IA" en la
    // galería de fotos. false por default: mejor no mostrar el botón un
    // instante de más (parpadeo) que mostrarlo y que falle al tocarlo.
    const [avanzado, setAvanzado] = useState(false)
    // "Fondo con IA" — mismo gate (avanzado) que el toggle de arriba, ver
    // EstudioFondoModal.tsx.
    const [modalFondoIA, setModalFondoIA] = useState(false)
    const [modalFondoIAVariantes, setModalFondoIAVariantes] = useState(false)
    // Especificaciones sugeridas según lo que el negocio eligió que vende en el
    // wizard (ver presetsVariantes.ts). Vacías hasta que resuelve el negocio — y
    // si falla, el formulario queda como siempre. Ya no se ofrecen modelos de
    // variantes por rubro ("Ropa (talle en letras)"…): lo que sugiere el formulario
    // son las opciones y valores que el negocio YA usó (historialVariantes).
    const [specsSugeridas, setSpecsSugeridas] = useState<string[]>([])
    // Opciones (Color, Talle…) y valores (Crudo, XL…) que el negocio ya usó en sus
    // productos, del más al menos usado. Vive en los propios productos (ver
    // ProductsService.variantHistory): crear un producto los "guarda".
    const [historialVariantes, setHistorialVariantes] = useState<ApiVariantHistory[]>([])
    const [presetAplicado, setPresetAplicado] = useState<string | null>(null)
    // true = el producto que se está editando ya tiene opciones guardadas.
    // Ahí no se ofrecen modelos: aplicar uno reemplaza las opciones, y al
    // guardar se borrarían las variantes que hoy tienen stock cargado.
    const [opcionesGuardadas, setOpcionesGuardadas] = useState(false)
    // Las opciones de variante que Orbi sugiere para ESTE producto (según su
    // nombre o su foto), con la misma forma que un modelo de rubro para poder
    // aplicarlas igual. Tiene prioridad sobre los modelos del rubro del negocio:
    // una tienda de ropa que vende un celular necesita Almacenamiento y Color,
    // no Talle. Nunca tilda valores: solo los ofrece.
    const [presetOrbi, setPresetOrbi] = useState<PresetVariantes | null>(null)
    const [orbiVarGen, setOrbiVarGen] = useState(false)

    // Fotos oficiales encontradas en la web en segundo plano al escanear con Orbi
    const [sugeridasWeb, setSugeridasWeb] = useState<SuggestedProductImage[]>([])
    const [buscandoSugeridas, setBuscandoSugeridas] = useState(false)
    const [agregandoSugeridaUrl, setAgregandoSugeridaUrl] = useState<string | null>(null)
    const [sugeridasAgregadas, setSugeridasAgregadas] = useState<Set<string>>(new Set())
    // Fotos de la búsqueda web que el navegador no pudo cargar (la tienda de origen
    // bloquea el uso desde otras webs, el link murió…) o que son miniaturas: no se
    // ofrecen, en vez de mostrar el ícono de imagen rota con el texto alternativo.
    const [sugeridasDescartadas, setSugeridasDescartadas] = useState<Set<string>>(new Set())
    const descartarSugerida = (url: string) => setSugeridasDescartadas(prev => (prev.has(url) ? prev : new Set(prev).add(url)))
    const sugeridasVisibles = sugeridasWeb.filter(s => !sugeridasDescartadas.has(s.url))

    const set = <K extends keyof ProdForm>(k: K, v: ProdForm[K]) => setProd(p => ({ ...p, [k]: v }))
    // Para leer el formulario vigente desde callbacks async (respuestas de Orbi).
    const prodRef = useRef(prod)
    useEffect(() => { prodRef.current = prod })

    // SKU automático: mientras el usuario no haya escrito el suyo, se
    // recalcula solo a partir del nombre — así llega al paso 3 ya completo
    // en vez de depender de que alguien toque "Generar automáticamente".
    useEffect(() => {
        if (editando || !skuAutoRef.current) return
        const auto = prod.nombre.trim() ? generarSKU(prod.nombre) : ''
        set('sku', auto)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [prod.nombre, editando])

    useEffect(() => {
        panelGetCategoriesFlat()
            .then(cats => {
                setCategorias(cats)
                if (editando) return
                // Al crear: la categoría del último producto publicado, o la única
                // que hay. Solo si sigue existiendo y el campo está vacío (Orbi
                // puede haberlo completado antes de que llegue la lista).
                let guardada: string | null = null
                try { guardada = window.localStorage.getItem(CATEGORIA_KEY) } catch { /* sin storage, no hay default */ }
                const elegida = guardada && cats.some(c => c.id === guardada) ? guardada : cats.length === 1 ? cats[0].id : ''
                if (!elegida) return
                const nombreCat = cats.find(c => c.id === elegida)?.name ?? ''
                setProd(p => p.categoriaId ? p : {
                    ...p,
                    categoriaId: elegida,
                    ...(photoTypeAutoRef.current ? { photoType: sugerirPhotoType(nombreCat) } : {}),
                })
            })
            .catch(() => setCategorias([]))
            .finally(() => setCategoriasCargando(false))
        panelGetTags().then(setTagsUsadas).catch(() => setTagsUsadas([]))
        panelGetAddons().then(r => setAvanzado(r.advanced)).catch(() => setAvanzado(false))
        // Solo al montar: `editando` no cambia durante la vida de la pantalla.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    // Qué vende el negocio → qué especificaciones ofrecer; y el historial de
    // variantes que ya usó. Las dos llamadas son independientes: si una falla, el
    // formulario queda como siempre.
    useEffect(() => {
        let vigente = true
        panelGetBusiness()
            .then(b => { if (vigente) setSpecsSugeridas(specsDelNegocio(b.subrubros)) })
            .catch(() => { /* sin negocio, el formulario queda como siempre */ })
        panelGetVariantHistory()
            .then(h => { if (vigente) setHistorialVariantes(h) })
            .catch(() => { /* sin historial, solo no se ofrecen "usados antes" */ })
        return () => { vigente = false }
    }, [editando])

    // Aplicar un modelo reemplaza las opciones: es un punto de partida, no
    // algo que se suma a lo que ya había (un zapato no lleva además talle de
    // remera). Los valores que no vinieron tildados quedan como sugerencias.
    const aplicarPreset = (preset: PresetVariantes) => {
        set('tiposVariante', desdePreset(preset))
        setPresetAplicado(preset.id)
    }

    // Orbi devolvió opciones de variante para este producto. Quedan como un modelo
    // más ("Sugerido por Orbi") y, si el vendedor todavía no eligió ningún valor,
    // pasan a ser las opciones del formulario — así no se pierde nada de lo que
    // ya hizo. En un producto que ya tiene opciones guardadas no se toca nada.
    const recibirVariantesOrbi = (sugeridas?: AiVariantOption[]): boolean => {
        if (opcionesGuardadas || !sugeridas || sugeridas.length === 0) return false
        const preset: PresetVariantes = {
            id: 'orbi',
            nombre: sugeridas.map(o => o.name).join(' y '),
            opciones: sugeridas.map(o => ({ nombre: o.name, valores: o.values, pre: o.usual })),
        }
        setPresetOrbi(preset)
        if (prodRef.current.tiposVariante.every(t => t.opciones.length === 0)) {
            set('tiposVariante', desdePreset(preset))
            setPresetAplicado(preset.id)
        }
        return true
    }

    // "Sugerir opciones con Orbi": lo mismo que arriba pero pedido a mano, para
    // cuando no se escaneó la foto. Usa el pedido corto de variantes (no genera
    // descripción, categoría ni ficha: no toca nada más del formulario).
    const orbiSugerirVariantes = async () => {
        if (!prod.nombre.trim()) { onToast('Poné el nombre del producto antes de pedirle sugerencias a Orbi'); return }
        setOrbiVarGen(true)
        try {
            const { suggestedVariants } = await panelAiVariants({
                name: prod.nombre.trim(),
                description: prod.descripcion.trim() || undefined,
            })
            if (!recibirVariantesOrbi(suggestedVariants)) onToast('Orbi no encontró opciones para sugerir en este producto')
        } catch (err) {
            onToast(err instanceof ApiError ? err.message : 'No se pudo consultar a Orbi. Probá de nuevo.')
        } finally {
            setOrbiVarGen(false)
        }
    }

    // Las especificaciones sugeridas que todavía no están en el producto. Se
    // comparan sin mayúsculas: "garantía" y "Garantía" son la misma.
    const specsPorSugerir = specsSugeridas.filter(
        l => !prod.specs.some(s => s.label.trim().toLowerCase() === l.toLowerCase()),
    )

    // Suma una especificación sugerida con su etiqueta ya puesta. Si había
    // renglones vacíos (el que se agrega solo al prender la sección), se
    // descartan: si no, quedaba uno en blanco arriba de la sugerida.
    const agregarSpecSugerida = (label: string) => {
        setProd(p => ({
            ...p,
            specs: [...p.specs.filter(s => s.label.trim() || s.value.trim()), { label, value: '' }],
        }))
    }

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
                setOpcionesGuardadas(conVariantes)
                setProd({
                    nombre: p.name,
                    descripcion: p.description ?? '',
                    categoriaId: p.categoryId ?? '',
                    tags: p.tags.map(t => t.name),
                    estado: p.status,
                    photoType: p.photoType,
                    // Math.round: basePrice/cost son Decimal(12,2) en la base y pueden
                    // traer centavos (ej. cargados por Orbi o la API directa) — si llega
                    // un "1500.5" acá, formatMiles trata el punto como separador de miles
                    // y lo infla a "15.005" en el input.
                    precio: String(Math.round(Number(p.basePrice))),
                    costo: p.cost != null ? String(Math.round(Number(p.cost))) : '',
                    sku: p.variants.find(v => v.isDefault)?.sku ?? p.variants[0]?.sku ?? '',
                    stock: String(p.variants[0]?.stock.reduce((s, st) => s + st.quantity, 0) ?? 0),
                    stockMinimo: String(p.variants[0]?.stock[0]?.stockMin ?? 5),
                    tieneVariantes: conVariantes,
                    tiposVariante: conVariantes
                        ? p.options.map(o => ({ id: o.id, nombre: o.name, opciones: o.values.map(v => v.value), esVisual: o.isVisual }))
                        : FORM_INICIAL.tiposVariante,
                    specs: p.specs,
                    videoUrl: p.videoUrl ?? '',
                })
                // Ya tiene un photoType guardado — no volver a sugerirlo solo
                // porque el vendedor toque la categoría mientras edita.
                photoTypeAutoRef.current = false
                setMostrarSpecs(p.specs.length > 0)
                setFilas(
                    conVariantes
                        ? p.variants.map(v => ({
                            clave: v.optionValues.map(ov => ov.value).join(' / '),
                            valores: v.optionValues.map(ov => ov.value),
                            id: v.id,
                            sku: v.sku ?? '',
                            precio: String(Math.round(Number(v.price))),
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
                setGuardadas(p.images.map(img => ({ id: img.id, url: img.url, principal: img.isPrimary, optionValueId: img.optionValueId, hasAiBackground: img.hasAiBackground, backgroundRemoved: img.backgroundRemoved })))
                // BUG encontrado 2026-08-16: la sección "Fotos por talle/color"
                // filtraba `guardadas` por optionValueId, pero nada armaba esa
                // correspondencia — `valoresParaImagen` solo tiene el STRING
                // del valor (ej. "S"), no su id. Sin este mapa, la sección le
                // pasaba `guardadas={[]}` a mano y las fotos ya subidas por
                // variante desaparecían al editar (seguían ahí en la base,
                // solo no se mostraban).
                setValorIds(new Map(p.options.flatMap(opt => opt.values.map(v => [v.value, v.id] as const))))
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

    // Opción "visual" (la única con fotos por valor) — 100% opt-in, SIN
    // fallback a "la primera opción". Este flujo lo usan rubros muy
    // distintos (indumentaria, gastronomía, plantas, tecnología…) y en la
    // mayoría de los casos NINGUNA opción tiene una foto distinta por valor
    // (ej. un talle de ropa no se ve diferente en foto) — asumir que la
    // primera opción definida es "la visual" por default terminaba
    // pidiéndole al vendedor fotos por talle sin que tuviera sentido.
    // Se activa a mano con el botón junto a "Fotos por…" (más abajo), que
    // ahora está visible aunque haya una sola opción definida — antes
    // dependía de tener 2+ para poder elegir, así que con una sola opción
    // no había forma de decir "esta sí" ni "ninguna". Sin riesgo para
    // productos ya guardados: cada guardado manda `isVisual` explícito por
    // opción (ver armarPayload), así que uno ya cargado llega acá con la
    // opción correcta ya marcada.
    const opcionVisual = useMemo(() => tiposValidos.find(tp => tp.esVisual), [tiposValidos])

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
            // común: cargaste el precio de arriba y después agregaste un
            // talle/color más), la fila nueva lo hereda; si todavía no hay
            // ninguna, copia el "Precio" del formulario — menos tipeo repetido.
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
                    precio: precioHeredado || prod.precio || '0',
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

    // Escaneo inteligente con foto (Google Lens / Orbi): sube la imagen al backend,
    // Gemini Flash identifica marca, modelo/SKU comercial, título, descripción,
    // categoría y especificaciones técnicas.
    // Se dispara con UN toque sobre la foto que el vendedor ya subió (ver
    // "Completar con Orbi" en la sección de fotos): la foto ya está en la
    // galería, así que no se vuelve a agregar, y solo se llenan los campos que
    // todavía están vacíos — lo que el vendedor ya escribió no se pisa.
    const orbiEscanearFoto = async (file: File, key: string) => {
        if (!file) return
        if (!esArchivoDeImagen(file)) {
            onToast('El archivo seleccionado no es una imagen soportada')
            return
        }
        setOrbiScanGen(true)
        setOrbiScanKey(null)
        try {
            const paraScan = await optimizarImagenParaScan(file)
            const result = await panelAiScanProduct(paraScan, file.name)

            setProd(p => {
                const yaEstanTags = new Set(p.tags.map(t => t.trim().toLowerCase()))
                const nuevasTags = result.suggestedTags.filter(t => !yaEstanTags.has(t.trim().toLowerCase()))
                return {
                    ...p,
                    nombre: p.nombre.trim() ? p.nombre : result.name.slice(0, 80),
                    descripcion: p.descripcion.trim() ? p.descripcion : result.description.slice(0, 2000),
                    categoriaId: p.categoriaId || result.suggestedCategoryId || '',
                    tags: nuevasTags.length ? [...p.tags, ...nuevasTags] : p.tags,
                    specs: p.specs.length === 0 && result.suggestedSpecs && result.suggestedSpecs.length > 0 ? result.suggestedSpecs : p.specs,
                }
            })

            // Especificaciones técnicas: si la IA detectó especificaciones técnicas reales (ej. relojes, tecnología),
            // encendemos la ficha automáticamente; si es indumentaria u objeto sin ficha, queda como estaba.
            if (result.suggestedSpecs && result.suggestedSpecs.length > 0) {
                setMostrarSpecs(true)
                setMasAbierto(true)
            }

            recibirVariantesOrbi(result.suggestedVariants)

            // Búsqueda en segundo plano de imágenes oficiales de la web
            const queryBusqueda = result.imageSearchQuery || result.name
            const modelDetectado = result.detectedModel || result.suggestedSpecs.find(s => /modelo|código|codigo|sku|referencia/i.test(s.label))?.value
            const brandDetectado = result.detectedBrand || result.suggestedSpecs.find(s => /marca|fabricante/i.test(s.label))?.value
            const colorDetectado = result.detectedColor || result.suggestedSpecs.find(s => /color|dial|acabado/i.test(s.label))?.value

            if (modelDetectado || queryBusqueda) {
                setBuscandoSugeridas(true)
                setSugeridasWeb([])
                panelGetSuggestedImages(queryBusqueda, modelDetectado, brandDetectado, colorDetectado)
                    .then(imgs => {
                        if (Array.isArray(imgs) && imgs.length > 0) {
                            setSugeridasWeb(imgs)
                        } else {
                            setSugeridasWeb([])
                        }
                    })
                    .catch(err => {
                        console.warn('Error al buscar fotos sugeridas en segundo plano:', err)
                        setSugeridasWeb([])
                    })
                    .finally(() => {
                        setBuscandoSugeridas(false)
                    })
            }

            setOrbiScanKey(key)
        } catch (err) {
            onToast(err instanceof ApiError ? err.message : 'No se pudo escanear el producto con Orbi. Probá de nuevo.')
        } finally {
            setOrbiScanGen(false)
            if (fileInputScanRef.current) {
                fileInputScanRef.current.value = ''
            }
        }
    }

    const agregarFotoSugerida = async (sug: SuggestedProductImage) => {
        setAgregandoSugeridaUrl(sug.url)
        try {
            const proxied = await panelProxyImage(sug.url)
            const arr = proxied.dataUrl.split(',')
            const mime = arr[0].match(/:(.*?);/)?.[1] || proxied.mimeType || 'image/jpeg'
            const bstr = atob(arr[1])
            let n = bstr.length
            const u8arr = new Uint8Array(n)
            while (n--) {
                u8arr[n] = bstr.charCodeAt(n)
            }
            const ext = mime.includes('png') ? 'png' : mime.includes('webp') ? 'webp' : 'jpg'
            const file = new File([u8arr], `sugerida-${Date.now()}.${ext}`, { type: mime })

            const key = `sug-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
            setImagenes(prev => {
                const tienePrincipal = prev.some(i => i.principal) || guardadas.some(g => g.principal)
                const nuevaImg: ImagenPendiente = {
                    key,
                    file,
                    preview: proxied.dataUrl,
                    principal: !tienePrincipal,
                    encuadrando: true,
                }
                return [...prev, nuevaImg]
            })

            setSugeridasAgregadas(prev => new Set([...prev, sug.url]))
            onToast('Foto agregada a tu catálogo ✓')

            // Estandarización automática en segundo plano:
            void (async () => {
                try {
                    const estandarizada = await estandarizarImagenProducto(file, file.name)
                    const previewEstandar = URL.createObjectURL(estandarizada)
                    setImagenes(prev => prev.map(p => {
                        if (p.key !== key) return p
                        return {
                            ...p,
                            file: estandarizada,
                            preview: previewEstandar,
                            encuadrando: false,
                        }
                    }))
                } catch {
                    setImagenes(prev => prev.map(p => p.key === key ? { ...p, encuadrando: false } : p))
                }
            })()
        } catch (err) {
            onToast(err instanceof ApiError ? err.message : 'No se pudo descargar la foto sugerida')
        } finally {
            setAgregandoSugeridaUrl(null)
        }
    }

    // ── Especificaciones técnicas ────────────────────────────────────────────
    function agregarSpec() {
        set('specs', [...prod.specs, { label: '', value: '' }])
    }
    function quitarSpec(i: number) {
        set('specs', prod.specs.filter((_, j) => j !== i))
    }
    function actualizarSpec(i: number, campo: 'label' | 'value', valor: string) {
        set('specs', prod.specs.map((s, j) => j === i ? { ...s, [campo]: valor } : s))
    }

    // Reusa el mismo endpoint que orbiAsistir() (una sola llamada a Groq trae
    // descripción/categoría/tags Y especificaciones sugeridas) — acá solo se
    // toma la parte de specs, agregándolas a las que ya haya en vez de pisarlas
    // (por si el vendedor ya había cargado alguna a mano).
    const orbiAsistirSpecs = async () => {
        if (!prod.nombre.trim()) { onToast('Poné el nombre del producto antes de generar con Orbi'); return }
        setOrbiSpecsGen(true)
        try {
            const { suggestedSpecs } = await panelAiAssist({
                name: prod.nombre.trim(),
                existingDescription: prod.descripcion.trim() || undefined,
            })
            if (suggestedSpecs.length === 0) {
                onToast('Orbi no encontró especificaciones para sugerir en este producto')
                return
            }
            setProd(p => {
                const yaEstan = new Set(p.specs.map(s => s.label.trim().toLowerCase()).filter(Boolean))
                const nuevas = suggestedSpecs.filter(s => !yaEstan.has(s.label.trim().toLowerCase()))
                // Las filas vacías que el vendedor no llegó a completar se
                // descartan — no tiene sentido dejarlas mezcladas con las
                // que sí trajo Orbi.
                const existentes = p.specs.filter(s => s.label.trim() || s.value.trim())
                return { ...p, specs: [...existentes, ...nuevas] }
            })
            setMostrarSpecs(true)
            onToast('Generado por Orbi')
        } catch (err) {
            onToast(err instanceof ApiError ? err.message : 'No se pudo generar con Orbi. Probá de nuevo.')
        } finally {
            setOrbiSpecsGen(false)
        }
    }

    // ── Imágenes ────────────────────────────────────────────────────────────
    async function agregarImagenes(files: FileList | null, valorOpcion?: string) {
        if (!files?.length) return
        // Si el producto todavía no tiene ninguna principal, la PRIMERA
        // imagen general de esta tanda pasa a serlo — se decide una sola vez
        // ANTES del for, no en cada vuelta: si no, seleccionar 5 fotos de
        // golpe las marcaba a las 5 como principal (el chequeo miraba
        // siempre el mismo `imagenes` de afuera, que todavía no tenía
        // ninguna de las nuevas cargada).
        let faltaPrincipal = !valorOpcion && imagenes.every(i => !i.principal) && guardadas.every(g => !g.principal)
        const nuevas: ImagenPendiente[] = []
        for (const fileOriginal of Array.from(files)) {
            if (!esArchivoDeImagen(fileOriginal)) { onToast(`"${fileOriginal.name}" no se pudo subir: el formato no es una imagen soportada`); continue }
            let file: File
            try {
                file = await normalizarImagen(fileOriginal)
            } catch {
                onToast(`"${fileOriginal.name}" no se pudo procesar`)
                continue
            }
            // El chequeo de tamaño va sobre el archivo YA convertido: es el
            // que termina subiéndose, y un HEIC pasado a JPEG puede pesar
            // distinto que el original.
            if (file.size > MAX_IMAGEN_BYTES) { onToast(`"${file.name}" supera los ${MAX_IMAGEN_MB}MB`); continue }
            const principal = faltaPrincipal
            if (principal) faltaPrincipal = false
            nuevas.push({
                key: `${Date.now()}-${file.name}-${Math.random().toString(36).slice(2, 7)}`,
                file,
                preview: URL.createObjectURL(file),
                principal,
                valorOpcion,
                encuadrando: true,
            })
        }
        setImagenes(prev => [...prev, ...nuevas])

        // Estandarización automática en segundo plano para cada foto:
        for (const it of nuevas) {
            void (async () => {
                try {
                    const estandarizada = await estandarizarImagenProducto(it.file, it.file.name)
                    const nuevaPreview = URL.createObjectURL(estandarizada)
                    setImagenes(prev => prev.map(p => {
                        if (p.key !== it.key) return p
                        URL.revokeObjectURL(p.preview)
                        return {
                            ...p,
                            file: estandarizada,
                            preview: nuevaPreview,
                            encuadrando: false,
                        }
                    }))
                } catch {
                    setImagenes(prev => prev.map(p => p.key === it.key ? { ...p, encuadrando: false } : p))
                }
            })()
        }
    }

    // ── Fotos por variante (Color/Talle…) — carga unificada estilo ML ────────
    // Último valor con el que se etiquetó una foto — se usa como default de
    // la próxima tanda que se suba, así cargar varias fotos seguidas del
    // mismo color no obliga a re-elegir el tag cada vez. Si el vendedor
    // reordenó las opciones y la visual cambió, se valida que el valor
    // guardado siga existiendo antes de usarlo.
    const [ultimoValorEtiqueta, setUltimoValorEtiqueta] = useState<string | undefined>(undefined)

    // A diferencia de "Fotos principales" (una sola caja general), acá hay
    // UNA sola caja para TODAS las fotos de variante — nunca se le pregunta
    // al vendedor para qué valor es antes de subir (eso era justo la
    // fricción que había con una galería por valor): se etiquetan solas con
    // el último valor usado, y se corrigen después con el select de cada
    // card (ver GaleriaImagenesEtiquetada).
    function agregarImagenesVariante(files: FileList | null) {
        if (!opcionVisual || opcionVisual.opciones.length === 0) return
        const valor = (ultimoValorEtiqueta && opcionVisual.opciones.includes(ultimoValorEtiqueta))
            ? ultimoValorEtiqueta
            : opcionVisual.opciones[0]
        agregarImagenes(files, valor)
        setUltimoValorEtiqueta(valor)
    }

    // Desde la miniatura de una foto general: pasa a ser la foto de ese valor
    // (ej. "Negro"). Si era la principal, la principal pasa a la primera general
    // que quede, para que el catálogo siga teniendo foto.
    function asignarAValor(key: string, valor: string) {
        setImagenes(prev => {
            const era = prev.find(i => i.key === key)
            const resto = prev.map(i => i.key === key ? { ...i, valorOpcion: valor, principal: false } : i)
            if (!era?.principal) return resto
            const heredera = resto.find(i => !i.valorOpcion)
            return heredera ? resto.map(i => i.key === heredera.key ? { ...i, principal: true } : i) : resto
        })
        setUltimoValorEtiqueta(valor)
    }

    function etiquetarPendiente(key: string, valor: string) {
        setImagenes(prev => prev.map(i => i.key === key ? { ...i, valorOpcion: valor } : i))
        setUltimoValorEtiqueta(valor)
    }

    // Mismo patrón que reordenarGeneral, pero para el grupo complementario
    // (fotos CON valorOpcion/optionValueId) — cada uno solo toca lo suyo, el
    // otro grupo queda intacto en el array de estado.
    function reordenarVariante(nuevoOrden: { tipo: 'guardada' | 'pendiente'; id: string }[]) {
        setGuardadas(prev => {
            const porId = new Map(prev.map(g => [g.id, g]))
            const variantesNuevas = nuevoOrden
                .filter(o => o.tipo === 'guardada')
                .map(o => porId.get(o.id))
                .filter((g): g is ImagenGuardada => !!g)
            const otras = prev.filter(g => g.optionValueId == null)
            return [...otras, ...variantesNuevas]
        })
        setImagenes(prev => {
            const porKey = new Map(prev.map(i => [i.key, i]))
            const variantesNuevas = nuevoOrden
                .filter(o => o.tipo === 'pendiente')
                .map(o => porKey.get(o.id))
                .filter((i): i is ImagenPendiente => !!i)
            const otras = prev.filter(i => !i.valorOpcion)
            return [...otras, ...variantesNuevas]
        })
        if (editarId) {
            const items = nuevoOrden
                .filter(o => o.tipo === 'guardada')
                .map((o, i) => ({ id: o.id, position: i }))
            if (items.length > 0) {
                void panelReorderProductImages(editarId, items).catch(() => {
                    onToast('No se pudo guardar el nuevo orden de las fotos')
                })
            }
        }
    }

    function quitarPendiente(key: string) {
        setImagenes(prev => {
            const img = prev.find(i => i.key === key)
            if (img) { URL.revokeObjectURL(img.preview); if (img.original) URL.revokeObjectURL(img.original.preview) }
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

    // Paquete "Avanzado" — "Quitar fondo" se aplica AL INSTANTE: corre el recorte
    // local en el backend (mismo que "Sin fondo" del modal de Fondo con IA) y
    // reemplaza el File/preview de la pendiente por el PNG transparente, así la
    // miniatura y la vista previa ya lo muestran. Tocarlo de nuevo lo deshace
    // (vuelve a la foto original, que se guarda en `original`).
    const [fondoEnProceso, setFondoEnProceso] = useState<Set<string>>(new Set())
    async function alternarQuitarFondo(key: string) {
        const img = imagenesRef.current.find(i => i.key === key)
        if (!img || fondoEnProceso.has(key)) return

        if (img.quitarFondo && img.original) {
            const original = img.original
            setImagenes(prev => prev.map(i => {
                if (i.key !== key) return i
                URL.revokeObjectURL(i.preview)
                return { ...i, file: original.file, preview: original.preview, quitarFondo: false, original: undefined }
            }))
            return
        }

        setFondoEnProceso(prev => new Set(prev).add(key))
        try {
            const r = await panelGenerateProductBackground({ file: img.file, filename: img.file.name }, { estilo: 'sin_fondo' })
            const bytes = atob(r.base64)
            const arr = new Uint8Array(bytes.length)
            for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i)
            const nombre = img.file.name.replace(/\.[^.]+$/, '') + '.png'
            const recortada = new File([arr], nombre, { type: r.mimeType })

            // Estandarizar automáticamente la silueta sin fondo (auto-trim de transparencia y centrado)
            let finalFile = recortada
            try {
                finalFile = await estandarizarImagenProducto(recortada, nombre)
            } catch (err) {
                console.warn('Error al estandarizar sin fondo:', err)
            }

            const previewNueva = URL.createObjectURL(finalFile)
            const sigueEstando = imagenesRef.current.some(i => i.key === key)
            if (!sigueEstando) { URL.revokeObjectURL(previewNueva); return }
            setImagenes(prev => prev.map(i => i.key === key
                ? { ...i, file: finalFile, preview: previewNueva, quitarFondo: true, original: { file: i.file, preview: i.preview } }
                : i))
        } catch (e) {
            onToast(e instanceof ApiError ? e.message : 'No se pudo quitar el fondo. Probá de nuevo.')
        } finally {
            setFondoEnProceso(prev => { const n = new Set(prev); n.delete(key); return n })
        }
    }

    // Lo mismo para una foto YA guardada (edición de un producto): el
    // backend guarda la marca y la foto original (ProductImage.backgroundRemoved
    // / originalUrl), así el botón sigue ahí al reabrir el producto y se puede
    // volver atrás. Aplica igual a fotos principales y de variantes.
    async function alternarQuitarFondoGuardada(imagenId: string) {
        const img = guardadas.find(g => g.id === imagenId)
        if (!img || !editarId || fondoEnProceso.has(imagenId)) return
        setFondoEnProceso(prev => new Set(prev).add(imagenId))
        try {
            const r = await panelSetProductImageBackground(editarId, imagenId, !img.backgroundRemoved)
            setGuardadas(prev => prev.map(g => g.id === imagenId ? { ...g, url: r.url, backgroundRemoved: r.backgroundRemoved } : g))
        } catch (e) {
            onToast(e instanceof ApiError ? e.message : 'No se pudo cambiar el fondo. Probá de nuevo.')
        } finally {
            setFondoEnProceso(prev => { const n = new Set(prev); n.delete(imagenId); return n })
        }
    }

    // "Fondo con IA" (ver EstudioFondoModal) — reemplaza el File/preview de
    // una pendiente por el resultado ya compuesto con el fondo elegido. La
    // preview vieja (URL.createObjectURL) se revoca: si no, cada foto que
    // se prueba con varios estilos deja un blob colgado en memoria.
    function reemplazarImagenPendiente(key: string, file: File, preview: string) {
        setImagenes(prev => prev.map(i => {
            if (i.key !== key) return i
            URL.revokeObjectURL(i.preview)
            return { ...i, file, preview, fondoIA: true }
        }))
    }

    // Fotos ya guardadas que un "Fondo con IA" reemplazó. Desaparecen de la
    // galería al toque (el resultado ocupa su lugar), pero recién se borran del
    // servidor al guardar el producto: si el vendedor cancela la edición, la
    // original sigue intacta y no se pierde nada.
    const [guardadasReemplazadas, setGuardadasReemplazadas] = useState<{ id: string; porKey: string }[]>([])
    // Los handlers del modal corren cuando termina el fondo en segundo plano, con
    // el estado de cuando se tocó "Aplicar": estas refs dan el estado de AHORA.
    const guardadasRef = useRef(guardadas)
    guardadasRef.current = guardadas
    // (imagenesRef, más abajo, ya existe y se mantiene al día.)

    // Cambia una foto guardada por su versión con fondo nuevo: la guardada sale de
    // la galería (y queda anotada para borrarse al guardar) y la pendiente entra en
    // el MISMO lugar del orden.
    function reemplazarGuardadaPorPendiente(idGuardada: string, nueva: ImagenPendiente) {
        const general = nueva.valorOpcion == null
        if (general) {
            const base = ordenGeneralRef.current ?? [
                ...guardadasRef.current.filter(g => g.optionValueId == null).map(g => `guardada:${g.id}`),
                ...imagenesRef.current.filter(i => !i.valorOpcion).map(i => `pendiente:${i.key}`),
            ]
            setOrdenGeneral(base.map(e => (e === `guardada:${idGuardada}` ? `pendiente:${nueva.key}` : e)))
        }
        setGuardadasReemplazadas(prev => [...prev, { id: idGuardada, porKey: nueva.key }])
        setGuardadas(prev => prev.filter(g => g.id !== idGuardada))
        setImagenes(prev => [...prev, nueva])
    }

    // Handler que pasa el modal: una pendiente se reemplaza en el lugar (de
    // arriba); una GUARDADA también se reemplaza (ver reemplazarGuardadaPorPendiente):
    // el resultado entra como foto nueva general (sin valorOpcion) en su mismo lugar
    // y la original se borra al guardar el producto.
    async function aplicarFondoIA(origen: ImagenParaFondo, file: File, preview: string) {
        let finalFile = file
        let finalPreview = preview
        try {
            finalFile = await estandarizarImagenProducto(file, file.name)
            finalPreview = URL.createObjectURL(finalFile)
        } catch {}

        if (origen.tipo === 'pendiente') {
            reemplazarImagenPendiente(origen.key, finalFile, finalPreview)
            return
        }
        reemplazarGuardadaPorPendiente(origen.key, {
            key: `${Date.now()}-${finalFile.name}-${Math.random().toString(36).slice(2, 7)}`,
            file: finalFile,
            preview: finalPreview,
            principal: false,
            fondoIA: true,
        })
    }

    // "Fondo con IA" para las fotos POR VARIANTE (Color/Talle): mismo modal que
    // para las principales, pero con las fotos etiquetadas. Una pendiente se
    // reemplaza en el lugar (conserva su etiqueta, valorOpcion); una GUARDADA se
    // reemplaza por una pendiente nueva con la MISMA etiqueta que la original, así
    // queda asociada al mismo valor (y la original se borra al guardar).
    async function aplicarFondoIAVariante(origen: ImagenParaFondo, file: File, preview: string) {
        let finalFile = file
        let finalPreview = preview
        try {
            finalFile = await estandarizarImagenProducto(file, file.name)
            finalPreview = URL.createObjectURL(finalFile)
        } catch {}

        if (origen.tipo === 'pendiente') {
            reemplazarImagenPendiente(origen.key, finalFile, finalPreview)
            return
        }
        const guardada = guardadas.find(g => g.id === origen.key)
        const valor = valoresParaImagen.find(v => valorIds.get(v.valor) === guardada?.optionValueId)?.valor
        if (!valor) {
            URL.revokeObjectURL(finalPreview)
            onToast('No se pudo asociar la foto a su variante. Probá con una foto nueva.')
            return
        }
        reemplazarGuardadaPorPendiente(origen.key, {
            key: `${Date.now()}-${finalFile.name}-${Math.random().toString(36).slice(2, 7)}`,
            file: finalFile,
            preview: finalPreview,
            principal: false,
            valorOpcion: valor,
            fondoIA: true,
        })
    }

    // El vendedor tocó "Aplicar a N fotos" en EstudioFondoModal: el modal se cierra
    // y el fondo de cada foto se genera en segundo plano. La foto queda marcada
    // como "Aplicando fondo…" y se reemplaza sola cuando termina.
    // Una foto ya guardada no tiene marca (su resultado entra como foto nueva);
    // el contador de fondosEnCurso cubre a las dos.
    function aplicarFondoEnSegundoPlano(origen: ImagenParaFondo, resultado: Promise<ResultadoFondo>, deVariante: boolean) {
        const marcar = (valor: boolean) => {
            if (origen.tipo !== 'pendiente') return
            setImagenes(prev => prev.map(i => i.key === origen.key ? { ...i, aplicandoFondo: valor } : i))
            setFondoEnProceso(prev => {
                const n = new Set(prev)
                if (valor) n.add(origen.key)
                else n.delete(origen.key)
                return n
            })
        }
        marcar(true)
        setFondosEnCurso(n => n + 1)
        resultado
            .then(r => (deVariante ? aplicarFondoIAVariante(origen, r.file, r.url) : aplicarFondoIA(origen, r.file, r.url)))
            .catch(e => onToast(e instanceof ApiError ? e.message : 'No se pudo aplicar el fondo a una foto. Probá de nuevo.'))
            .finally(() => {
                marcar(false)
                setFondosEnCurso(n => n - 1)
            })
    }

    // Reordena las fotos GENERALES del producto (las de "Fotos principales",
    // no las de por talle/color) — `nuevoOrden` llega de GaleriaImagenes ya
    // armado con el orden final que el vendedor arrastró, mezclando
    // guardadas y pendientes en una sola secuencia. Acá se reparte de vuelta
    // en los dos arrays de estado (cada uno solo sabe de lo suyo) y, si el
    // producto ya existe (edición), se persiste al toque contra el backend
    // — ya está armado el endpoint (reorder), solo faltaba usarlo.
    // Orden mezclado de las fotos generales ("guardada:ID" / "pendiente:KEY"):
    // guardadas y pendientes viven en arrays de estado separados y la galería
    // las dibuja siempre guardadas primero, así que sin esto arrastrar una
    // pendiente ANTES de una guardada no tenía efecto. Undefined = orden natural.
    const [ordenGeneral, setOrdenGeneral] = useState<string[] | undefined>(undefined)
    const ordenGeneralRef = useRef(ordenGeneral)
    ordenGeneralRef.current = ordenGeneral

    function reordenarGeneral(nuevoOrden: { tipo: 'guardada' | 'pendiente'; id: string }[]) {
        setOrdenGeneral(nuevoOrden.map(o => `${o.tipo}:${o.id}`))
        setGuardadas(prev => {
            const porId = new Map(prev.map(g => [g.id, g]))
            const generalesNuevas = nuevoOrden
                .filter(o => o.tipo === 'guardada')
                .map(o => porId.get(o.id))
                .filter((g): g is ImagenGuardada => !!g)
            const otras = prev.filter(g => g.optionValueId != null)
            return [...generalesNuevas, ...otras]
        })
        setImagenes(prev => {
            const porKey = new Map(prev.map(i => [i.key, i]))
            const pendientesNuevas = nuevoOrden
                .filter(o => o.tipo === 'pendiente')
                .map(o => porKey.get(o.id))
                .filter((i): i is ImagenPendiente => !!i)
            const otras = prev.filter(i => i.valorOpcion)
            return [...pendientesNuevas, ...otras]
        })
        if (editarId) {
            const items = nuevoOrden
                .filter(o => o.tipo === 'guardada')
                .map((o, i) => ({ id: o.id, position: i }))
            if (items.length > 0) {
                void panelReorderProductImages(editarId, items).catch(() => {
                    onToast('No se pudo guardar el nuevo orden de las fotos')
                })
            }
        }
    }

    // Libera los object URLs al desmontar.
    // BUG encontrado 2026-08-24: esto tenía `[imagenes]` como dependencia, así
    // que el cleanup (que React corre ANTES de cada re-ejecución del efecto,
    // no solo al desmontar) se disparaba en CADA cambio de `imagenes` — cada
    // foto agregada, reetiquetada o reordenada revocaba de una las URLs de
    // TODAS las fotos que ya estaban, dejándolas rotas en la vista previa (la
    // miniatura ya pintada seguía viéndose porque el navegador cachea el
    // bitmap ya decodificado, pero cualquier <img> que recién empezaba a usar
    // esa URL — como la foto grande de PreviewProducto al navegar — fallaba).
    // Con un ref + deps `[]`, el cleanup corre UNA sola vez, al desmontar de
    // verdad, y usa el valor más actualizado de `imagenes` en ese momento.
    const imagenesRef = useRef(imagenes)
    useEffect(() => { imagenesRef.current = imagenes })
    useEffect(() => () => { imagenesRef.current.forEach(i => { URL.revokeObjectURL(i.preview); if (i.original) URL.revokeObjectURL(i.original.preview) }) }, [])

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

    const armarPayload = useCallback((tagIds: string[], estado: ProductStatus): UpsertProductInput => {
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

        // Solo las filas completas (label Y value) — una fila que el
        // vendedor dejó a medio cargar no se manda. Si apagó el toggle
        // entero, se manda vacío aunque haya filas cargadas: "no quiero
        // mostrar ficha técnica" tiene que ganarle a lo que haya tipeado.
        const specs = mostrarSpecs ? prod.specs.filter(s => s.label.trim() && s.value.trim()) : []

        return {
            name: prod.nombre.trim(),
            description: prod.descripcion.trim() || undefined,
            categoryId: prod.categoriaId || undefined,
            basePrice: precio,
            cost: prod.costo ? Number(prod.costo) : undefined,
            status: estado,
            photoType: prod.photoType,
            ...(tagIds.length > 0 ? { tagIds } : {}),
            specs,
            videoUrl: prod.videoUrl.trim() || undefined,
            ...(opciones ? { options: opciones } : {}),
            variants,
        }
    }, [prod, filas, tiposValidos, opcionVisual, varianteUnicaId, precioMinVariantes, mostrarSpecs])

    // Deja el formulario listo para el siguiente producto: se conserva lo que casi
    // siempre se repite (categoría, tipo de foto, stock mínimo y la estructura de
    // variantes, sin sus valores) y se vacía el resto. El guardado que ya salió
    // trabaja con lo capturado al tocar el botón, así que no se ve afectado.
    function reiniciarFormulario() {
        const venteOrbi = presetAplicado === 'orbi'
        setPresetOrbi(null)
        if (venteOrbi) setPresetAplicado(null)
        recordarVariantes(prod.tiposVariante)
        setProd(p => ({
            ...FORM_INICIAL,
            tags: [],
            specs: [],
            stockMinimo: p.stockMinimo,
            categoriaId: p.categoriaId,
            photoType: p.photoType,
            tieneVariantes: p.tieneVariantes,
            tiposVariante: p.tiposVariante.map(tp => ({ ...tp, opciones: [], esVisual: false })),
        }))
        setFilas([])
        setStockMasivo('')
        setImagenes([])
        setOrdenGeneral(undefined)
        setValorIds(new Map())
        setUltimoValorEtiqueta(undefined)
        setSugeridasWeb([])
        setSugeridasAgregadas(new Set())
        setBuscandoSugeridas(false)
        setOrbiScanKey(null)
        setIntento(null)
        setMasAbierto(false)
        setMostrarSpecs(false)
        setTagInput('')
        skuAutoRef.current = true
        const contenedor = document.querySelector('.admin-main')
        if (contenedor) contenedor.scrollTo({ top: 0, behavior: 'smooth' })
        else window.scrollTo({ top: 0, behavior: 'smooth' })
    }

    async function guardar(estado: ProductStatus = prod.estado) {
        // Chequeo rápido antes de ir al backend (que igual lo valida — esto
        // solo evita el viaje de ida y vuelta): no se puede publicar un
        // producto sin stock, hay que cargarlo o guardarlo como borrador.
        // Toast, no banner fijo — es una validación disparada por la acción
        // de guardar (mismo criterio que el resto del sistema, ej. el chequeo
        // de envío en PedidoNuevo.tsx), no un error persistente de la pantalla.
        if (estado === 'PUBLISHED' && stockTotal <= 0) {
            onToast('No podés publicar un producto sin stock. Cargá stock inicial o guardalo como borrador.')
            return
        }

        // Alta nueva: TODO el guardado (crear el producto Y subir sus fotos —
        // esto último es lo lento, cada foto hace su propio viaje al backend:
        // conversión a WebP + subida a Supabase Storage) sigue en segundo
        // plano. Se vuelve a la lista apenas se toca "Crear producto", sin
        // esperar ni siquiera la respuesta del POST /products. La lista
        // muestra el progreso vía lib/productUploadTracker.ts. La función de
        // acá abajo NUNCA toca el estado de ESTE componente (setImagenes,
        // etc.) — para cuando termine, ProductoNuevo ya se desmontó (se
        // volvió a la lista) y React tira un warning (o peor) si un
        // componente desmontado intenta actualizar su propio estado.
        //
        // Edición: mismo criterio (ver más abajo) — antes era sincrónica,
        // pero con productos de varias variantes el PUT puede tardar bastante
        // (ver el comentario de más abajo), así que se pidió extenderle el
        // mismo comportamiento de segundo plano que ya tenía la creación.
        if (!editarId) {
            const tempId = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
                ? crypto.randomUUID()
                : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`
            const imgsASubir = imagenes
            beginProductCreation(tempId, {
                name: prod.nombre,
                basePrice: prod.tieneVariantes ? precioMinVariantes : Number(prod.precio) || 0,
                totalStock: stockTotal,
                categoryName: categorias.find(c => c.id === prod.categoriaId)?.name ?? null,
                status: estado as 'PUBLISHED' | 'DRAFT',
            })
            onToast(estado === 'PUBLISHED' ? 'Creando producto…' : 'Guardando borrador…')
            if (cargarOtro) {
                setEnviados(prev => [...prev, tempId])
                reiniciarFormulario()
            } else {
                onVolver()
            }

            void (async () => {
                try {
                    const tagIds = await resolverTagIds(prod.tags)
                    const payload = armarPayload(tagIds, estado)
                    const guardado = await panelCreateProduct(payload)
                    markProductCreated(tempId, guardado.id, imgsASubir.length)

                    if (imgsASubir.length > 0) {
                        // Recién ahora existen los ids de cada valor de
                        // opción: se resuelve a cuál apunta cada imagen.
                        const idPorValor = new Map<string, string>()
                        for (const opt of guardado.options) {
                            for (const val of opt.values) idPorValor.set(val.value, val.id)
                        }
                        // El producto YA existe en este punto. Si falla subir
                        // una foto no se puede deshacer eso, así que un error
                        // acá no tira abajo el resto — se banca sola, en
                        // paralelo (no una por una: era la parte más lenta).
                        const resultados = await Promise.allSettled(
                            imgsASubir.map(async img => {
                                try {
                                    const subida = await panelUploadProductImage(guardado.id, img.file, img.file.name, {
                                        isPrimary: img.principal,
                                        optionValueId: img.valorOpcion ? idPorValor.get(img.valorOpcion) : undefined,
                                        hasAiBackground: img.fondoIA,
                                    })
                                    markImageUploaded(tempId, true)
                                    return { key: img.key, id: subida.id }
                                } catch {
                                    markImageUploaded(tempId, false)
                                    return null
                                } finally {
                                    URL.revokeObjectURL(img.preview)
                                    if (img.original) URL.revokeObjectURL(img.original.preview)
                                }
                            }),
                        )
                        // Las subidas van en paralelo — el orden en que TERMINAN
                        // no tiene por qué coincidir con el orden en que el
                        // vendedor las armó (arrastrando, ver GaleriaImagenes).
                        // Se corrige acá con un único llamado al reorder que
                        // ya existe del lado del backend, en vez de subir una
                        // por una solo para no perder el orden.
                        const idPorKey = new Map(
                            resultados
                                .filter((r): r is PromiseFulfilledResult<{ key: string; id: string }> => r.status === 'fulfilled' && r.value != null)
                                .map(r => [r.value.key, r.value.id]),
                        )
                        const itemsOrden = imgsASubir
                            .map(img => idPorKey.get(img.key))
                            .filter((id): id is string => !!id)
                            .map((id, i) => ({ id, position: i }))
                        if (itemsOrden.length > 1) await panelReorderProductImages(guardado.id, itemsOrden).catch(() => {})
                        finishProductUpload(tempId)
                    }
                    // Sin fotos: markProductCreated() ya cerró el tracking solo.
                } catch (err) {
                    markProductCreationFailed(tempId, err instanceof ApiError ? err.message : 'No se pudo crear el producto')
                }
            })()
            return
        }

        // Edición: mismo criterio que el alta nueva de más arriba — vuelve a
        // la lista apenas se toca "Guardar cambios", el PUT y la subida de
        // fotos siguen en segundo plano (ver lib/productUploadTracker.ts →
        // beginProductEdit/finishProductEdit/markProductEditFailed). Antes
        // esto era sincrónico: con un producto de varias variantes el PUT
        // puede tardar bastante (hasta 30s en el caso límite — ver el
        // timeout explícito y el bug real de producción comentado en
        // products.service.ts → update()) y el vendedor se quedaba mirando
        // la pantalla congelada todo ese rato, sin poder seguir trabajando.
        //
        // Misma regla que en el alta nueva: la función de acá abajo NUNCA
        // toca el estado de ESTE componente — para cuando termine,
        // ProductoNuevo ya se desmontó (se volvió a la lista).
        const idParaTracker = editarId
        const imgsASubir = imagenes
        const reemplazadas = guardadasReemplazadas
        const offsetGenerales = guardadas.filter(g => g.optionValueId == null).length
        beginProductEdit(idParaTracker)
        onToast('Guardando cambios…')
        onVolver()

        void (async () => {
            try {
                const tagIds = await resolverTagIds(prod.tags)
                const payload = armarPayload(tagIds, estado)
                const guardado = await panelUpdateProduct(idParaTracker, payload)

                const idPorValor = new Map<string, string>()
                for (const opt of guardado.options) {
                    for (const val of opt.values) idPorValor.set(val.value, val.id)
                }

                const resultados = await Promise.allSettled(
                    imgsASubir.map(async img => {
                        try {
                            const subida = await panelUploadProductImage(guardado.id, img.file, img.file.name, {
                                isPrimary: img.principal,
                                optionValueId: img.valorOpcion ? idPorValor.get(img.valorOpcion) : undefined,
                                hasAiBackground: img.fondoIA,
                            })
                            return { key: img.key, id: subida.id }
                        } finally {
                            URL.revokeObjectURL(img.preview)
                            if (img.original) URL.revokeObjectURL(img.original.preview)
                        }
                    }),
                )
                const fotosFallidas = resultados.filter(r => r.status === 'rejected').length

                // Mismo corrector de orden que en el alta nueva: las subidas
                // van en paralelo, así que se fija el orden final con un solo
                // llamado. Arrancan DESPUÉS de las fotos generales que ya
                // estaban guardadas (mismo criterio que la galería, que las
                // dibuja primero) — sin este offset, las nuevas se metían con
                // position 0..N y quedaban mezcladas antes que las de siempre.
                const idPorKey = new Map(
                    resultados
                        .filter((r): r is PromiseFulfilledResult<{ key: string; id: string }> => r.status === 'fulfilled')
                        .map(r => [r.value.key, r.value.id]),
                )
                // Si el vendedor arrastró fotos (ordenGeneral), se respeta el orden
                // mezclado completo: guardadas y recién subidas juntas, desde 0.
                // Las fotos guardadas que "Fondo con IA" reemplazó se borran RECIÉN acá, con el
                // producto ya guardado y SOLO si su reemplazo se subió bien (si algo falla, la
                // original queda). Antes del reorden de abajo, para que la principal se
                // recalcule sobre lo que queda.
                const aBorrar = reemplazadas.filter(r => idPorKey.has(r.porKey)).map(r => r.id)
                if (aBorrar.length > 0) {
                    await Promise.allSettled(aBorrar.map(id => panelDeleteProductImage(idParaTracker, id)))
                }
                let itemsOrden: { id: string; position: number }[]
                if (ordenGeneral) {
                    const guardadasVivas = new Set(guardadas.map(g => g.id))
                    const ordenados: string[] = []
                    for (const e of ordenGeneral) {
                        const i = e.indexOf(':')
                        const tipo = e.slice(0, i)
                        const ref = e.slice(i + 1)
                        const id = tipo === 'guardada' ? (guardadasVivas.has(ref) ? ref : undefined) : idPorKey.get(ref)
                        if (id && !ordenados.includes(id)) ordenados.push(id)
                    }
                    for (const img of imgsASubir) {
                        const id = idPorKey.get(img.key)
                        if (id && !ordenados.includes(id)) ordenados.push(id)
                    }
                    itemsOrden = ordenados.map((id, i) => ({ id, position: i }))
                } else {
                    itemsOrden = imgsASubir
                        .map(img => idPorKey.get(img.key))
                        .filter((id): id is string => !!id)
                        .map((id, i) => ({ id, position: offsetGenerales + i }))
                }
                if (itemsOrden.length > 0) await panelReorderProductImages(guardado.id, itemsOrden).catch(() => {})

                finishProductEdit(idParaTracker, fotosFallidas)
            } catch (err) {
                markProductEditFailed(idParaTracker, err instanceof ApiError ? err.message : 'No se pudo guardar el producto')
            }
        })()
    }

    // ── Validación ──────────────────────────────────────────────────────────
    // La categoría es obligatoria (no se puede publicar un producto "suelto",
    // sin agrupar en ningún lado del catálogo del cliente) — mismo criterio
    // que ya rechaza el backend en create-product.dto.ts.
    const faltaNombre = prod.nombre.trim() === ''
    const faltaCategoria = prod.categoriaId === ''
    const req3 = prod.tieneVariantes
        ? filas.some(f => f.activa) && filas.filter(f => f.activa).every(f => Number(f.precio) > 0)
        : prod.precio !== '' && Number(prod.precio) > 0

    // Dos (o más) fotos etiquetadas con el mismo valor (ej. dos "Blanco") —
    // cada valor de la opción visual tiene que quedar con a lo sumo una foto
    // asociada, así que esto bloquea el paso en vez de solo advertir.
    const conteoPorValorVisual = useMemo(() => {
        const conteo = new Map<string, number>()
        for (const img of imagenes) {
            if (!img.valorOpcion) continue
            conteo.set(img.valorOpcion, (conteo.get(img.valorOpcion) ?? 0) + 1)
        }
        for (const g of guardadas) {
            if (g.optionValueId == null) continue
            const valor = valoresParaImagen.find(v => valorIds.get(v.valor) === g.optionValueId)?.valor
            if (valor) conteo.set(valor, (conteo.get(valor) ?? 0) + 1)
        }
        return conteo
    }, [imagenes, guardadas, valoresParaImagen, valorIds])
    const valoresConFotoDuplicada = [...conteoPorValorVisual.entries()].filter(([, n]) => n > 1).map(([v]) => v)

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

    // ── Qué falta para poder guardar ────────────────────────────────────────
    // El botón nunca se deshabilita: al tocarlo, si falta algo, se marca en el
    // campo y se lleva la vista hasta el primero (mismo criterio que el
    // checkout). `id` es el del contenedor del campo en el JSX.
    const faltantes = (estado: ProductStatus): { id: string; texto: string }[] => {
        const f: { id: string; texto: string }[] = []
        if (faltaNombre) f.push({ id: 'pn-nombre', texto: 'el nombre' })
        if (faltaCategoria) f.push({ id: 'pn-categoria', texto: 'la categoría' })
        if (prod.tieneVariantes && combos.length === 0) f.push({ id: 'pn-variantes', texto: 'al menos un valor de variante' })
        else if (!req3) {
            // Con variantes el precio se carga arriba; solo si eso está bien y
            // alguna fila quedó en 0 se lleva a la tabla.
            const enTabla = prod.tieneVariantes && Number(prod.precio) > 0
            f.push({ id: enTabla ? 'pn-variantes-tabla' : 'pn-precio', texto: enTabla ? 'el precio de cada variante' : 'el precio' })
        }
        if (valoresConFotoDuplicada.length > 0) f.push({ id: 'pn-variantes', texto: 'una sola foto por valor' })
        if (fondosEnCurso > 0) f.push({ id: 'pn-fotos', texto: 'que termine de aplicarse el fondo de las fotos' })
        if (estado === 'PUBLISHED' && stockTotal <= 0) f.push({ id: 'pn-stock', texto: 'el stock (o guardalo como borrador)' })
        return f
    }
    const faltasVisibles = intento ? faltantes(intento) : []
    const hayFalta = (id: string) => faltasVisibles.some(f => f.id === id)

    const intentarGuardar = (estado: ProductStatus) => {
        const f = faltantes(estado)
        if (f.length > 0) {
            setIntento(estado)
            // El precio por fila solo se edita en "Precio y stock".
            if (f[0].id === 'pn-variantes-tabla') setVista('lista')
            document.getElementById(f[0].id)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
            return
        }
        if (!editando && prod.categoriaId) {
            try { window.localStorage.setItem(CATEGORIA_KEY, prod.categoriaId) } catch { /* sin storage, no hay default */ }
        }
        void guardar(estado)
    }

    // Foto que se le pasa a Orbi: la principal si hay, si no la primera general.
    // Solo una foto NUEVA (File): al editar, las ya guardadas no se pueden escanear.
    const fotoParaOrbi = imagenes.find(i => i.principal && !i.valorOpcion) ?? imagenes.find(i => !i.valorOpcion)
    const orbiScanSuccess = !!fotoParaOrbi && orbiScanKey === fotoParaOrbi.key
    // Si se borra la foto escaneada, las fotos web que se encontraron para ella
    // ya no corresponden (la nueva puede ser de otro producto).
    const fotoEscaneadaSigue = !orbiScanKey || imagenes.some(i => i.key === orbiScanKey)
    useEffect(() => {
        if (fotoEscaneadaSigue) return
        setOrbiScanKey(null)
        setSugeridasWeb([])
        setBuscandoSugeridas(false)
    }, [fotoEscaneadaSigue])

    // ── Datos para la vista previa: fotos generales (mismo orden que la
    // galería — guardadas primero, pendientes después) + una foto
    // representativa por cada valor de la opción visual, para poder navegar
    // y mostrar swatches en PreviewProducto. ────────────────────────────────
    // Mismo orden mezclado que la galería (ver ordenGeneral): guardadas y
    // pendientes según cómo las arrastró el vendedor; lo que no figure, al final.
    const fotosGeneralesPreview = [
        ...guardadas.filter(g => g.optionValueId == null).map(g => ({ ref: `guardada:${g.id}`, url: g.url })),
        ...imagenes.filter(i => !i.valorOpcion).map(i => ({ ref: `pendiente:${i.key}`, url: i.preview })),
    ]
        .sort((a, b) => {
            if (!ordenGeneral) return 0
            const ia = ordenGeneral.indexOf(a.ref)
            const ib = ordenGeneral.indexOf(b.ref)
            return (ia < 0 ? Infinity : ia) - (ib < 0 ? Infinity : ib)
        })
        .map(f => f.url)
    const fotosPorValorPreview = (opcionVisual?.opciones ?? []).map(valor => ({
        valor,
        url: guardadas.find(g => g.optionValueId === valorIds.get(valor))?.url
            ?? imagenes.find(i => i.valorOpcion === valor)?.preview,
    }))
    // URLs (guardada real o blob de una pendiente) con fondo compuesto por
    // "Fondo con IA" — PreviewProducto las muestra con object-fit:cover en
    // vez de contain, mismo criterio que la ficha real del storefront.
    const urlsConFondoIA = new Set([
        ...guardadas.filter(g => g.hasAiBackground).map(g => g.url),
        ...imagenes.filter(i => i.fondoIA).map(i => i.preview),
    ])

    if (cargando) {
        return <ProductoNuevoSkeleton />
    }

    // ── Helpers de la pantalla ───────────────────────────────────────────────
    const actualizarTipo = (ti: number, cambio: Partial<TipoVariante>) =>
        set('tiposVariante', prod.tiposVariante.map((x, j) => j === ti ? { ...x, ...cambio } : x))

    // Los valores se agregan en el orden del modelo (S, M, L, no S, L, M); los
    // que el vendedor escribe a mano van al final. Sin modelo (producto ya
    // guardado) se respeta el orden que tenían.
    const ordenarValores = (tp: TipoVariante, vals: string[]) => {
        const orden = tp.sugeridos ?? []
        const unicos = [...new Set(vals)]
        return unicos.filter(v => orden.includes(v)).sort((a, b) => orden.indexOf(a) - orden.indexOf(b))
            .concat(unicos.filter(v => !orden.includes(v)))
    }
    // Suma al historial local lo que se acaba de usar en este producto, para que
    // "Cargar otro después" ya lo ofrezca sin esperar a que el guardado en segundo
    // plano termine (el servidor lo va a devolver igual la próxima vez).
    const recordarVariantes = (tipos: TipoVariante[]) => {
        setHistorialVariantes(prev => {
            const sig = (t: string) => t.trim().toLowerCase()
            let lista = prev.map(h => ({ ...h, values: [...h.values] }))
            for (const tp of tipos) {
                const nombre = tp.nombre.trim()
                if (!nombre || tp.opciones.length === 0) continue
                let h = lista.find(x => sig(x.name) === sig(nombre))
                if (!h) { h = { name: nombre, isVisual: !!tp.esVisual, values: [] }; lista = [h, ...lista] }
                for (const v of tp.opciones) if (!h.values.some(x => sig(x) === sig(v))) h.values.push(v)
            }
            return lista
        })
    }

    const agregarValores = (ti: number, vals: string[]) => {
        const tp = prod.tiposVariante[ti]
        actualizarTipo(ti, { opciones: ordenarValores(tp, [...tp.opciones, ...vals]) })
    }

    // Con variantes, el "Precio" de arriba se copia a las filas que todavía
    // tienen el precio anterior (o ninguno): así cargar 9 combinaciones al mismo
    // precio es escribirlo una vez, y las que se ajustaron a mano no se pisan.
    const cambiarPrecio = (v: string) => {
        const anterior = prod.precio
        set('precio', v)
        if (prod.tieneVariantes) {
            setFilas(prev => prev.map(f => (f.precio === '' || f.precio === '0' || f.precio === anterior) ? { ...f, precio: v || '0' } : f))
        }
    }
    const cambiarStockMasivo = (v: string) => {
        const d = v.replace(/\D/g, '')
        setStockMasivo(d)
        // Vaciar el campo no borra lo cargado fila por fila.
        if (d !== '') setFilas(prev => prev.map(f => ({ ...f, stock: d })))
    }
    const recordarStockMinimo = (limpio: string) => {
        // Default para el próximo producto: casi siempre es el mismo número
        // para todo el catálogo.
        if (limpio) { try { window.localStorage.setItem(STOCK_MINIMO_KEY, limpio) } catch { /* sin storage, no hay default */ } }
    }

    // Opciones que casi siempre cambian cómo se ve el producto (color, tono,
    // sabor…): se le SUGIERE al vendedor subir una foto por valor, con un botón a
    // la vista. No se activa sola: un talle de ropa no cambia la foto.
    const opcionSugeridaFoto = !opcionVisual
        ? tiposValidos.find(tp => /color|tono|sabor|aroma|fragancia|estampa|dise[ñn]o/i.test(tp.nombre))
        : undefined
    const puedeGrilla = tiposValidos.length === 2
    const vistaGrilla = puedeGrilla && vista === 'grilla'
    const misEnvios = subidas.filter(u => enviados.includes(u.tempId))
    const sinFotos = imagenes.length + guardadas.length === 0
    const hayGenerales = imagenes.some(i => !i.valorOpcion) || guardadas.some(g => !g.optionValueId)
    const inactivas = filas.filter(f => !f.activa).length
    const errorPrecioFila = (f: FilaVariante) => hayFalta('pn-variantes-tabla') && f.activa && !(Number(f.precio) > 0)

    return (
        <div className="pn-page" style={pageWrap}>
            <style>{`
                .pn-page    { padding: 24px 32px 64px; }
                .pn-layout  { display: grid; grid-template-columns: minmax(0,1fr) 340px; gap: 20px; align-items: start; }
                .pn-preview { position: sticky; top: 20px; }
                .pn-3col    { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; align-items: start; }
                .pn-3col > * { min-width: 0; }
                /* Un <input> trae un ancho mínimo propio (~170px): sin esto, dentro de una columna
                   angosta empuja todo el formulario más allá del borde de la pantalla. */
                .pn-page input, .pn-page select, .pn-page textarea { min-width: 0; max-width: 100%; }
                .pn-fondoia { display: inline-flex; align-items: center; gap: 6px; height: 32px; padding: 0 14px; border: none; border-radius: 9999px; cursor: pointer;
                              background: var(--color-primary); color: var(--color-on-primary); font: inherit; font-size: 13px; font-weight: 600; white-space: nowrap;
                              box-shadow: 0 1px 2px rgba(0,0,0,0.12), 0 4px 14px -4px var(--color-primary); transition: transform .15s ease, box-shadow .15s ease, filter .15s ease; }
                .pn-fondoia:hover:not(:disabled)  { filter: brightness(1.08); transform: translateY(-1px); box-shadow: 0 1px 2px rgba(0,0,0,0.12), 0 8px 20px -4px var(--color-primary); }
                .pn-fondoia:active:not(:disabled) { transform: translateY(0); }
                .pn-fondoia:focus-visible { outline: 2px solid var(--color-primary); outline-offset: 2px; }
                .pn-fondoia:disabled { opacity: .5; cursor: not-allowed; box-shadow: none; }
                .pn-vgrid   { display: grid; grid-template-columns: minmax(0,1.6fr) 108px 84px 30px; align-items: center; gap: 8px; }
                .pn-vgrid-sku { display: grid; grid-template-columns: minmax(0,1.2fr) minmax(0,1.6fr) 80px; align-items: center; gap: 8px; }
                @media (max-width: 1080px) {
                    .pn-layout  { grid-template-columns: minmax(0,1fr) !important; }
                    .pn-preview { position: static !important; }
                }
                @media (max-width: 768px) {
                    .pn-page { padding: 16px 14px 48px !important; }
                    /* Precio y stock lado a lado; la categoría, a lo ancho. */
                    .pn-3col { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; }
                    .pn-3col > :last-child { grid-column: 1 / -1; }
                    .pn-vgrid { grid-template-columns: minmax(0,1fr) 92px 64px 28px !important; gap: 6px !important; }
                    .pn-vgrid-sku { grid-template-columns: minmax(0,1fr) 88px !important; }
                    .pn-vgrid-sku > :nth-child(2) { grid-column: 1 / -1; grid-row: 2; }
                    /* Celular: la vista previa iba al final de todo, después del botón de guardar —
                       una pantalla entera de scroll que no aporta mientras se carga. Se oculta. */
                    .pn-preview { display: none !important; }
                    .pn-titulo { font-size: 22px !important; margin-bottom: 14px !important; }
                    /* iOS hace zoom al enfocar un campo de menos de 16px y deja la pantalla movida. */
                    .pn-page input:not([type='checkbox']):not([type='radio']):not([type='file']), .pn-page textarea, .pn-page select { font-size: 16px !important; }
                    /* Barra de guardado: los botones se reparten el ancho (más fáciles de tocar) y
                       respeta la barra inferior del iPhone. */
                    .pn-barra { padding: 10px 12px calc(10px + env(safe-area-inset-bottom, 0px)) !important; border-radius: 12px 12px 0 0 !important; }
                    .pn-barra > span { flex-basis: 100%; }
                    .pn-barra > label { flex-basis: 100%; }
                    .pn-barra > div { width: 100%; justify-content: stretch; margin-left: 0 !important; }
                    .pn-barra > div > button { flex: 1; }
                    .pn-opcion { padding: 12px !important; }
                }
            `}</style>

            <Volver a="Productos" onClick={onVolver} />

            <h1 className="pn-titulo" style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--color-text)', margin: '0 0 20px' }}>
                {editando ? 'Editar producto' : 'Crear producto'}
            </h1>

            {error && (
                <div style={{ padding: '10px 14px', borderRadius: 10, background: 'var(--color-error-bg)', border: '1px solid var(--color-error)', color: 'var(--color-error)', fontSize: 13, marginBottom: 16, maxWidth: 860 }}>
                    {error}
                </div>
            )}

            {misEnvios.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16, maxWidth: 860 }} aria-live="polite">
                    {misEnvios.slice(-3).map(u => (
                        <div key={u.tempId} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, color: u.phase === 'error' ? 'var(--color-error)' : 'var(--color-muted)' }}>
                            {u.phase === 'done' ? <Check size={14} color="var(--color-success)" strokeWidth={2.5} />
                                : u.phase === 'error' ? <AlertTriangle size={14} />
                                    : <Loader2 size={14} className="animate-spin" />}
                            <span>
                                {u.phase === 'creating' && `Guardando "${u.name}"…`}
                                {u.phase === 'uploading' && `Subiendo las fotos de "${u.name}" (${u.completed + u.failed}/${u.totalImages})…`}
                                {u.phase === 'done' && `"${u.name}" ${u.status === 'PUBLISHED' ? 'quedó publicado' : 'se guardó como borrador'}.`}
                                {u.phase === 'error' && `No se pudo crear "${u.name}": ${u.errorMessage ?? 'error desconocido'}`}
                            </span>
                            {u.phase === 'error' && (
                                <button type="button" className="ds-link" onClick={() => { clearProductUpload(u.tempId); setEnviados(prev => prev.filter(id => id !== u.tempId)) }} style={{ ...enlace, color: 'var(--color-error)', textDecoration: 'underline' }}>
                                    Cerrar
                                </button>
                            )}
                        </div>
                    ))}
                </div>
            )}

            <div className="pn-layout">
                <div className="pn-main" style={{ minWidth: 0 }}>
                    <Card>
                        {categoriasCargando ? (
                            <PasoInfoSkeleton />
                        ) : categorias.length === 0 ? (
                            <SinCategoriasAviso negocioId={negocioId} />
                        ) : (
                            <>
                                {/* ── FOTOS: primero, como en un marketplace ── */}
                                <Seccion
                                    primera
                                    id="pn-fotos"
                                    titulo={<>Fotos {avanzado && <TipQuitarFondo />}</>}
                                    derecha={avanzado && hayGenerales ? (
                                        // EN MANTENIMIENTO (24/09/2026): se está reconstruyendo todo el
                                        // pipeline de "Fondo con IA" (ver background-removal.service.ts).
                                        // Deshabilitado en vez de ocultado para que quede claro que vuelve.
                                        <BotonFondoIA onClick={() => setModalFondoIA(true)} />
                                    ) : undefined}
                                >
                                    {fondosEnCurso > 0 && (
                                        <div role="status" style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, fontSize: 12.5, color: 'var(--color-muted)' }}>
                                            <Loader2 size={14} className="animate-spin" />
                                            Aplicando el fondo a {fondosEnCurso} {fondosEnCurso === 1 ? 'foto' : 'fotos'}… podés seguir cargando el producto.
                                        </div>
                                    )}
                                    {sinFotos ? (
                                        <ZonaSubida onArchivos={files => agregarImagenes(files)} />
                                    ) : (
                                        <>
                                            <GaleriaImagenes
                                                pendientes={imagenes.filter(i => !i.valorOpcion)}
                                                guardadas={guardadas.filter(g => !g.optionValueId)}
                                                onAgregar={files => agregarImagenes(files)}
                                                onQuitarPendiente={quitarPendiente}
                                                onQuitarGuardada={quitarGuardada}
                                                onReorder={reordenarGeneral}
                                                orden={ordenGeneral}
                                                onQuitarFondo={alternarQuitarFondo}
                                                onQuitarFondoGuardada={alternarQuitarFondoGuardada}
                                                fondoEnProceso={fondoEnProceso}
                                                avanzadoDisponible={avanzado}
                                                permitePrincipal
                                                opcionesAsignar={valoresParaImagen.map(v => v.valor)}
                                                nombreAsignar={opcionVisual?.nombre}
                                                onAsignar={asignarAValor}
                                            />
                                            <div style={{ fontSize: 11.5, color: 'var(--color-muted)', marginTop: 8 }}>
                                                La primera foto es la que se ve en el catálogo. Arrastrá las fotos o usá las flechas para cambiar el orden. PNG, JPG o HEIC, hasta {MAX_IMAGEN_MB}MB.{valoresParaImagen.length > 0 && ` Si una foto es de un {opcionVisual?.nombre.toLowerCase()} en particular, elegilo debajo de la miniatura.`}
                                            </div>
                                        </>
                                    )}

                                    {/* Orbi con UN toque: mira la foto y completa lo que falte. */}
                                    {fotoParaOrbi && !orbiScanSuccess && (
                                        <button
                                            type="button"
                                            onClick={() => void orbiEscanearFoto(fotoParaOrbi.original?.file ?? fotoParaOrbi.file, fotoParaOrbi.key)}
                                            disabled={orbiScanGen}
                                            className="ds-link"
                                            style={{ ...enlace, marginTop: 12, fontSize: 13, opacity: orbiScanGen ? 0.7 : 1, cursor: orbiScanGen ? 'default' : 'pointer' }}
                                        >
                                            {orbiScanGen ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                                            {orbiScanGen ? 'Orbi está mirando tu foto…' : 'Completar nombre, categoría y descripción con esta foto'}
                                        </button>
                                    )}
                                    {orbiScanSuccess && (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 12, fontSize: 12.5, color: 'var(--color-muted)' }}>
                                            <Check size={14} color="var(--color-success)" strokeWidth={2.5} />
                                            Orbi completó lo que estaba vacío. Revisalo y ajustá lo que quieras.
                                        </div>
                                    )}

                                    {/* Fotos oficiales que Orbi encontró en la web para este modelo. */}
                                    {(sugeridasVisibles.length > 0 || buscandoSugeridas) && (
                                        <div style={{ marginTop: 14 }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: 'var(--color-muted)', marginBottom: 8 }}>
                                                {buscandoSugeridas
                                                    ? <><Loader2 size={13} className="animate-spin" /> Buscando fotos oficiales de este producto…</>
                                                    : <>Fotos oficiales encontradas para este modelo</>}
                                            </div>
                                            {sugeridasVisibles.length > 0 && (
                                                <div style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 4 }}>
                                                    {sugeridasVisibles.map((sug, idx) => {
                                                        const yaAgregada = sugeridasAgregadas.has(sug.url)
                                                        const descargando = agregandoSugeridaUrl === sug.url
                                                        return (
                                                            <div key={idx} style={{ flex: '0 0 132px', border: '1px solid var(--color-border)', borderRadius: 10, overflow: 'hidden', background: 'var(--color-bg)' }}>
                                                                <div style={{ height: 112, background: '#fff', display: 'grid', placeItems: 'center', padding: 6 }} title={sug.title}>
                                                                    <img
                                                                        src={sug.url}
                                                                        alt=""
                                                                        loading="lazy"
                                                                        referrerPolicy="no-referrer"
                                                                        onError={() => descartarSugerida(sug.url)}
                                                                        onLoad={e => { if (Math.min(e.currentTarget.naturalWidth, e.currentTarget.naturalHeight) < 250) descartarSugerida(sug.url) }}
                                                                        style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
                                                                </div>
                                                                <button
                                                                    type="button"
                                                                    className="ds-hover"
                                                                    disabled={yaAgregada || descargando}
                                                                    onClick={() => void agregarFotoSugerida(sug)}
                                                                    style={{ width: '100%', height: 32, border: 'none', borderTop: '1px solid var(--color-border)', background: 'transparent', color: yaAgregada ? 'var(--color-muted)' : 'var(--color-primary)', fontSize: 12, fontWeight: 600, fontFamily: 'inherit', cursor: yaAgregada || descargando ? 'default' : 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}
                                                                >
                                                                    {descargando ? <><Loader2 size={12} className="animate-spin" /> Descargando…</>
                                                                        : yaAgregada ? <><Check size={13} strokeWidth={2.5} /> Agregada</>
                                                                            : <><Plus size={13} strokeWidth={2.5} /> Agregar</>}
                                                                </button>
                                                            </div>
                                                        )
                                                    })}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </Seccion>

                                {/* ── LO ESENCIAL: nombre, precio, stock, categoría ── */}
                                <Seccion>
                                    <div id="pn-nombre">
                                        <label style={lbl}>Nombre <span style={{ color: 'var(--color-error)' }}>*</span></label>
                                        <div
                                            className="ds-field"
                                            onClick={() => nombreInputRef.current?.focus()}
                                            style={{
                                                display: 'flex', alignItems: 'flex-start', minHeight: 46, padding: '10px 12px',
                                                background: 'var(--color-bg)', borderRadius: 8, cursor: 'text',
                                                border: `1px solid ${hayFalta('pn-nombre') ? 'var(--color-error)' : 'var(--color-border)'}`,
                                                transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
                                            }}
                                        >
                                            <textarea
                                                ref={el => {
                                                    (nombreInputRef as any).current = el
                                                    if (el) {
                                                        el.style.height = 'auto'
                                                        el.style.height = `${Math.max(26, el.scrollHeight)}px`
                                                    }
                                                }}
                                                value={prod.nombre}
                                                onChange={e => set('nombre', e.target.value.replace(/[\r\n]+/g, ' ').slice(0, 80))}
                                                onKeyDown={e => { if (e.key === 'Enter') e.preventDefault() }}
                                                placeholder="Ej: Remera oversize negra"
                                                rows={1}
                                                aria-label="Nombre del producto"
                                                style={{
                                                    flex: 1, width: '100%', minHeight: 24, border: 'none', outline: 'none', background: 'transparent',
                                                    fontSize: 14.5, fontWeight: 500, color: 'var(--color-text)', fontFamily: 'inherit', resize: 'none',
                                                    lineHeight: 1.45, padding: 0, margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word', overflowY: 'hidden',
                                                }}
                                            />
                                        </div>
                                        {(hayFalta('pn-nombre') || prod.nombre.length >= 60) && (
                                            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4, fontSize: 11.5 }}>
                                                <span style={{ color: 'var(--color-error)' }}>{hayFalta('pn-nombre') ? 'Poné el nombre del producto' : ''}</span>
                                                <span style={{ color: prod.nombre.length >= 75 ? 'var(--color-warning, #f59e0b)' : 'var(--color-subtle)', fontFamily: '"Geist Mono", monospace' }}>{prod.nombre.length}/80</span>
                                            </div>
                                        )}
                                    </div>

                                    <div className="pn-3col" style={{ marginTop: 16 }}>
                                        <div id="pn-precio">
                                            <PField
                                                label={<>Precio <span style={{ color: 'var(--color-error)' }}>*</span></>}
                                                value={prod.precio} onChange={cambiarPrecio}
                                                prefix="$" mono placeholder="0" miles error={hayFalta('pn-precio')}
                                            />
                                            {hayFalta('pn-precio') && <div style={{ fontSize: 11.5, color: 'var(--color-error)', marginTop: 4 }}>Poné el precio</div>}
                                        </div>
                                        <div id="pn-costo">
                                            <PField
                                                label={<>Costo <span style={{ color: 'var(--color-muted)', fontWeight: 400 }}>(opcional)</span></>}
                                                value={prod.costo} onChange={v => set('costo', v)}
                                                prefix="$" mono placeholder="0" miles
                                            />
                                            {/* Solo lo ve el vendedor; con un costo cargado se calcula el margen. */}
                                            <div style={{ fontSize: 11.5, color: 'var(--color-muted)', marginTop: 4 }}>
                                                {margen != null
                                                    ? <>Margen estimado <strong style={{ color: 'var(--color-success)', fontFamily: '"Geist Mono", monospace' }}>{margen}%</strong></>
                                                    : 'Solo vos lo ves'}
                                            </div>
                                        </div>
                                        <div id="pn-stock">
                                            {prod.tieneVariantes ? (
                                                <div>
                                                    <label style={lbl}>Stock</label>
                                                    <div style={{ height: 40, display: 'flex', alignItems: 'center', fontSize: 13, color: 'var(--color-muted)' }}>
                                                        <span style={{ fontFamily: '"Geist Mono", monospace', color: 'var(--color-text)', fontWeight: 600, marginRight: 6 }}>{stockTotal}</span> en total, por variante
                                                    </div>
                                                </div>
                                            ) : (
                                                <PField label="Stock" value={prod.stock} onChange={v => set('stock', v.replace(/\D/g, ''))} mono error={hayFalta('pn-stock')} />
                                            )}
                                            {hayFalta('pn-stock') && <div style={{ fontSize: 11.5, color: 'var(--color-error)', marginTop: 4 }}>Para publicar necesitás stock</div>}
                                        </div>
                                        <div id="pn-categoria" style={{ gridColumn: '1 / -1' }}>
                                            <label style={lbl}>Categoría <span style={{ color: 'var(--color-error)' }}>*</span></label>
                                            <CategoriaSelect
                                                categorias={categorias}
                                                value={prod.categoriaId}
                                                error={hayFalta('pn-categoria')}
                                                onChange={v => {
                                                    set('categoriaId', v)
                                                    if (photoTypeAutoRef.current) {
                                                        const nombreCat = categorias.find(c => c.id === v)?.name ?? ''
                                                        set('photoType', sugerirPhotoType(nombreCat))
                                                    }
                                                }}
                                            />
                                            {hayFalta('pn-categoria') && <div style={{ fontSize: 11.5, color: 'var(--color-error)', marginTop: 4 }}>Elegí una categoría</div>}
                                        </div>
                                    </div>
                                </Seccion>

                                {/* ── VARIANTES: el interruptor siempre a la vista; los valores, sugeridos ── */}
                                <Seccion id="pn-variantes">
                                    <InterruptorVariantes on={prod.tieneVariantes} onChange={v => set('tieneVariantes', v)} />
                                    {/* Orbi ya miró el producto: se lo dice al vendedor sin activar nada solo. */}
                                    {!prod.tieneVariantes && presetOrbi && (
                                        <button
                                            type="button"
                                            className="ds-link"
                                            onClick={() => {
                                                set('tieneVariantes', true)
                                                if (presetAplicado !== 'orbi' && prod.tiposVariante.every(t => t.opciones.length === 0)) aplicarPreset(presetOrbi)
                                            }}
                                            style={{ ...enlace, marginTop: 10, fontSize: 12.5 }}
                                        >
                                            <Sparkles size={13} /> Orbi sugiere para este producto: {presetOrbi.nombre}. Usarlas
                                        </button>
                                    )}

                                    {prod.tieneVariantes && (
                                        <div style={{ marginTop: 16 }}>
                                            {/* Modelos según lo que el negocio vende. Con varios rubros
                                                (ropa + calzado) se ofrecen separados: un producto es UNA
                                                de esas cosas, así que se elige desde cuál arrancar. */}
                                            {/* Sin sugerencia de Orbi todavía: se puede pedir con un toque. */}
                                            {!opcionesGuardadas && !presetOrbi && (
                                                <button
                                                    type="button"
                                                    className="ds-link"
                                                    onClick={() => void orbiSugerirVariantes()}
                                                    disabled={orbiVarGen || !prod.nombre.trim()}
                                                    title={!prod.nombre.trim() ? 'Poné el nombre del producto primero' : undefined}
                                                    style={{ ...enlace, marginBottom: 14, fontSize: 12.5, opacity: orbiVarGen || !prod.nombre.trim() ? 0.55 : 1, cursor: orbiVarGen || !prod.nombre.trim() ? 'default' : 'pointer' }}
                                                >
                                                    {orbiVarGen ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
                                                    {orbiVarGen ? 'Orbi está pensando las opciones…' : 'Sugerir opciones con Orbi según el nombre'}
                                                </button>
                                            )}
                                            {/* Sugerencia de Orbi para ESTE producto, mientras no se haya aplicado. */}
                                            {!opcionesGuardadas && presetOrbi && presetAplicado !== 'orbi' && (
                                                <div style={{ marginBottom: 14, display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
                                                    <button
                                                        type="button"
                                                        className="ds-hover"
                                                        onClick={() => aplicarPreset(presetOrbi)}
                                                        title={presetOrbi.opciones.map(o => o.nombre).join(' · ')}
                                                        style={{
                                                            height: 30, padding: '0 12px', borderRadius: 9999, display: 'inline-flex', alignItems: 'center', gap: 6,
                                                            border: '1px solid var(--color-border)', background: 'transparent', color: 'var(--color-body)',
                                                            fontSize: 12.5, fontWeight: 500, fontFamily: 'inherit', cursor: 'pointer',
                                                        }}
                                                    >
                                                        <Sparkles size={12} /> Sugerido por Orbi: {presetOrbi.nombre}
                                                    </button>
                                                </div>
                                            )}

                                            {prod.tiposVariante.map((tp, ti) => {
                                                const restantes = (tp.sugeridos ?? []).filter(v => !tp.opciones.includes(v))
                                                const habituales = (tp.habituales ?? []).filter(v => !tp.opciones.includes(v))
                                                // Lo que el negocio ya usó: nombres de opción (mientras esta no tiene nombre)
                                                // y valores de la opción que se llama igual. Sin repetir lo que ya está.
                                                const sig = (t: string) => t.trim().toLowerCase()
                                                const nombresUsados = new Set(prod.tiposVariante.map(x => sig(x.nombre)))
                                                const nombresHistorial = tp.nombre.trim() === '' ? historialVariantes.filter(h => !nombresUsados.has(sig(h.name))).slice(0, 8) : []
                                                const enHistorial = historialVariantes.find(h => sig(h.name) === sig(tp.nombre))
                                                const valoresHistorial = (enHistorial?.values ?? []).filter(v => !tp.opciones.some(o => sig(o) === sig(v)) && !restantes.some(r => sig(r) === sig(v))).slice(0, 24)
                                                return (
                                                    <div key={tp.id} className="pn-opcion" style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 10, padding: 14, marginBottom: 10 }}>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                                                            <input
                                                                className="ds-field"
                                                                value={tp.nombre}
                                                                onChange={e => actualizarTipo(ti, { nombre: e.target.value })}
                                                                placeholder="Nombre de la opción (Talle, Color…)"
                                                                aria-label="Nombre de la opción"
                                                                style={{ ...inputBase, height: 34, padding: '0 10px', fontSize: 14, fontWeight: 600, flex: 1 }}
                                                            />
                                                            {prod.tiposVariante.length > 1 && (
                                                                <button type="button" className="ds-hover" aria-label="Quitar esta opción" title="Quitar esta opción" onClick={() => set('tiposVariante', prod.tiposVariante.filter((_, j) => j !== ti))} style={iconBtn}><X size={15} strokeWidth={1.8} /></button>
                                                            )}
                                                        </div>
                                                        {nombresHistorial.length > 0 && (
                                                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center', marginBottom: 10 }}>
                                                                <span style={{ fontSize: 11.5, color: 'var(--color-muted)' }}>Usadas antes:</span>
                                                                {nombresHistorial.map(h => (
                                                                    <button key={h.name} type="button" className="ds-hover" onClick={() => actualizarTipo(ti, { nombre: h.name })} style={chipSugerido}>{h.name}</button>
                                                                ))}
                                                            </div>
                                                        )}
                                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
                                                            {tp.opciones.map(op => (
                                                                <span key={op} style={{ ...chip, border: '1px solid var(--color-primary)' }}>{op}
                                                                    <button type="button" className="ds-hover" aria-label={`Quitar ${op}`} onClick={() => actualizarTipo(ti, { opciones: tp.opciones.filter(o => o !== op) })} style={chipX}><X size={11} strokeWidth={2} /></button>
                                                                </span>
                                                            ))}
                                                            {/* Sugeridos: un toque los suma. Ninguno viene elegido de antemano. */}
                                                            {restantes.map(v => (
                                                                <button key={v} type="button" className="ds-hover" onClick={() => agregarValores(ti, [v])} style={chipSugerido}>+ {v}</button>
                                                            ))}
                                                            {valoresHistorial.length > 0 && <span style={{ fontSize: 11.5, color: 'var(--color-muted)' }}>Usados antes:</span>}
                                                            {valoresHistorial.map(v => (
                                                                <button key={v} type="button" className="ds-hover" onClick={() => agregarValores(ti, [v])} style={chipSugerido}>+ {v}</button>
                                                            ))}
                                                            <OpInput tipo={tp.nombre} onAdd={vals => agregarValores(ti, vals)} />
                                                        </div>
                                                        {tp.opciones.length === 0 && habituales.length > 0 ? (
                                                            <button type="button" className="ds-link" onClick={() => agregarValores(ti, habituales)} style={{ ...enlace, marginTop: 10, fontSize: 12 }}>
                                                                Usar los habituales ({habituales.join(', ')})
                                                            </button>
                                                        ) : restantes.length > 1 ? (
                                                            <button type="button" className="ds-link" onClick={() => agregarValores(ti, restantes)} style={{ ...enlace, marginTop: 10, fontSize: 12 }}>
                                                                Agregar todos
                                                            </button>
                                                        ) : null}
                                                    </div>
                                                )
                                            })}

                                            {prod.tiposVariante.length < 3 && (
                                                <button type="button" className="ds-link" onClick={() => set('tiposVariante', [...prod.tiposVariante, { id: 'v' + Date.now(), nombre: '', opciones: [] }])} style={{ ...enlace, marginBottom: 4 }}>
                                                    <Plus size={14} /> Agregar otra opción
                                                </button>
                                            )}

                                            {/* Fotos distintas por valor (ej. Color) — opt-in, nunca asumido:
                                                un talle de ropa no se ve distinto en la foto. */}
                                            {tiposValidos.length > 0 && (
                                                <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px dashed var(--color-border)' }}>
                                                    {opcionSugeridaFoto ? (
                                                        <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
                                                            <Button
                                                                variant="outline"
                                                                size="sm"
                                                                icon={<ImagePlus size={15} />}
                                                                onClick={() => set('tiposVariante', prod.tiposVariante.map(x => ({ ...x, esVisual: x.id === opcionSugeridaFoto.id })))}
                                                            >
                                                                Subir una foto por cada {opcionSugeridaFoto.nombre.toLowerCase()}
                                                            </Button>
                                                            <span style={{ fontSize: 12, color: 'var(--color-muted)' }}>
                                                                Cuando el cliente elige el {opcionSugeridaFoto.nombre.toLowerCase()}, ve su foto.
                                                            </span>
                                                        </div>
                                                    ) : (
                                                    <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                                                        <span style={{ fontSize: 12.5, color: 'var(--color-body)' }}>¿Alguna opción cambia la foto?</span>
                                                        {[{ id: '', nombre: 'No' }, ...tiposValidos].map(tp => {
                                                            const activo = tp.id === (opcionVisual?.id ?? '')
                                                            return (
                                                                <button
                                                                    key={tp.id || 'ninguna'}
                                                                    type="button"
                                                                    className="ds-hover"
                                                                    aria-pressed={activo}
                                                                    onClick={() => set('tiposVariante', prod.tiposVariante.map(x => ({ ...x, esVisual: !!tp.id && x.id === tp.id })))}
                                                                    style={{ height: 28, padding: '0 11px', borderRadius: 9999, border: `1px solid ${activo ? 'var(--color-primary)' : 'var(--color-border)'}`, background: activo ? 'var(--color-primary-bg)' : 'transparent', color: activo ? 'var(--color-primary)' : 'var(--color-body)', fontSize: 12, fontWeight: activo ? 600 : 500, fontFamily: 'inherit', cursor: 'pointer' }}
                                                                >
                                                                    {tp.nombre}
                                                                </button>
                                                            )
                                                        })}
                                                    </div>
                                                    )}
                                                    {valoresParaImagen.length > 0 && (
                                                        <div style={{ marginTop: 12 }}>
                                                            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, marginBottom: 10 }}>
                                                                <div style={{ fontSize: 12, color: 'var(--color-muted)' }}>
                                                                    Subí las fotos juntas y etiquetá cada una con su {opcionVisual?.nombre.toLowerCase() || 'valor'}. Cuando el cliente lo elija en tu tienda, va a ver esas fotos.
                                                                </div>
                                                                {avanzado && (imagenes.some(i => !!i.valorOpcion) || guardadas.some(g => g.optionValueId != null)) && (
                                                                    <BotonFondoIA onClick={() => setModalFondoIAVariantes(true)} />
                                                                )}
                                                            </div>
                                                            <GaleriaImagenesEtiquetada
                                                                pendientes={imagenes.filter(i => !!i.valorOpcion)}
                                                                guardadas={guardadas.filter(g => g.optionValueId != null)}
                                                                opciones={opcionVisual?.opciones ?? []}
                                                                valorDeGuardada={optionValueId => valoresParaImagen.find(v => valorIds.get(v.valor) === optionValueId)?.valor}
                                                                onAgregar={agregarImagenesVariante}
                                                                onQuitarPendiente={quitarPendiente}
                                                                onQuitarGuardada={quitarGuardada}
                                                                onEtiquetar={etiquetarPendiente}
                                                                onReorder={reordenarVariante}
                                                                onQuitarFondo={alternarQuitarFondo}
                                                                onQuitarFondoGuardada={alternarQuitarFondoGuardada}
                                                                fondoEnProceso={fondoEnProceso}
                                                                avanzadoDisponible={avanzado}
                                                            />
                                                            {valoresConFotoDuplicada.length > 0 && (
                                                                <div style={{ fontSize: 12, color: 'var(--color-error)', marginTop: 8 }}>
                                                                    Hay más de una foto etiquetada como {valoresConFotoDuplicada.map(v => `"${v}"`).join(', ')}. Dejá una sola foto por {opcionVisual?.nombre.toLowerCase() || 'valor'}.
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            )}

                                            {/* Combinaciones: precio y stock. El precio arranca en el de arriba. */}
                                            <div id="pn-variantes-tabla" style={{ marginTop: 16 }}>
                                                {combos.length === 0 ? (
                                                    <div style={{ padding: '14px 16px', borderRadius: 10, border: `1px dashed ${hayFalta('pn-variantes') ? 'var(--color-error)' : 'var(--color-border)'}`, fontSize: 12.5, color: hayFalta('pn-variantes') ? 'var(--color-error)' : 'var(--color-muted)' }}>
                                                        Tocá los valores que vendés (por ejemplo S, M, L) y acá aparecen las combinaciones para cargar el stock.
                                                    </div>
                                                ) : (
                                                    <>
                                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
                                                            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text)' }}>{combos.length} {combos.length === 1 ? 'combinación' : 'combinaciones'}</span>
                                                            {puedeGrilla ? (
                                                                <span role="group" aria-label="Qué cargar en las combinaciones" style={{ display: 'inline-flex', gap: 4 }}>
                                                                    {([['grilla', 'Solo stock'], ['lista', 'Precio y stock']] as const).map(([id, l]) => {
                                                                        const a = vista === id
                                                                        return (
                                                                            <button key={id} type="button" className="ds-hover" aria-pressed={a} onClick={() => setVista(id)} style={{ height: 26, padding: '0 11px', borderRadius: 9999, border: `1px solid ${a ? 'var(--color-primary)' : 'var(--color-border)'}`, background: a ? 'var(--color-primary-bg)' : 'transparent', color: a ? 'var(--color-primary)' : 'var(--color-body)', fontSize: 12, fontWeight: a ? 600 : 500, fontFamily: 'inherit', cursor: 'pointer' }}>
                                                                                {l}
                                                                            </button>
                                                                        )
                                                                    })}
                                                                </span>
                                                            ) : (
                                                                <span style={{ fontSize: 11.5, color: 'var(--color-muted)' }}>Todas usan el precio de arriba; cambialo en la que cueste distinto.</span>
                                                            )}
                                                        </div>
                                                        {vistaGrilla ? (
                                                            <>
                                                                <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', columnGap: 20, rowGap: 8, marginBottom: 8 }}>
                                                                    {/* El precio que va a tener cada combinación, a la vista: en
                                                                        esta vista solo se carga stock. */}
                                                                    <span style={{ fontSize: 12.5, color: hayFalta('pn-precio') ? 'var(--color-error)' : 'var(--color-body)' }}>
                                                                        {precioMinVariantes <= 0
                                                                            ? 'Precio: definilo arriba'
                                                                            : precioUnicoVariantes
                                                                                ? <>Precio: <strong style={{ fontFamily: '"Geist Mono", monospace', color: 'var(--color-text)' }}>{fmtMoney(precioMinVariantes)}</strong> en todas</>
                                                                                : <>Precios distintos, desde <strong style={{ fontFamily: '"Geist Mono", monospace', color: 'var(--color-text)' }}>{fmtMoney(precioMinVariantes)}</strong></>}
                                                                    </span>
                                                                    {filas.length > 1 && (
                                                                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                                                                            <label htmlFor="pn-stock-todas" style={{ fontSize: 12.5, color: 'var(--color-body)' }}>Mismo stock en todas</label>
                                                                            <input id="pn-stock-todas" className="ds-field" inputMode="numeric" value={stockMasivo} onChange={e => cambiarStockMasivo(e.target.value)} onFocus={e => e.target.select()} placeholder="0" style={{ ...celdaGrande, width: 84 }} />
                                                                        </span>
                                                                    )}
                                                                </div>
                                                                <GrillaStock
                                                                    tipos={tiposValidos}
                                                                    filas={filas}
                                                                    onStock={(clave, valor) => setFilas(prev => prev.map(f => f.clave === clave ? { ...f, stock: valor.replace(/\D/g, '') } : f))}
                                                                />
                                                                <div style={{ fontSize: 11.5, color: 'var(--color-muted)', marginTop: 6 }}>
                                                                    Escribí cuántas unidades tenés de cada combinación. Para cambiar el precio de una o dejar de ofrecerla, elegí &quot;Precio y stock&quot;.
                                                                </div>
                                                            </>
                                                        ) : (
                                                        <>
                                                        <div style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 10, overflow: 'hidden' }}>
                                                            <div className="pn-vgrid" style={{ padding: '0 12px', height: 34, background: 'var(--color-surface)', borderBottom: '1px solid var(--color-border)', fontSize: 11.5, fontWeight: 600, color: 'var(--color-muted)' }}>
                                                                <span>Variante</span><span>Precio</span><span>Stock</span><span />
                                                            </div>
                                                            {filas.length > 1 && (
                                                                <div className="pn-vgrid" style={{ padding: '6px 12px', borderBottom: '1px solid var(--color-border)', background: 'var(--color-surface)' }}>
                                                                    <span style={{ fontSize: 12, color: 'var(--color-muted)' }}>Todas</span>
                                                                    <span />
                                                                    <input
                                                                        className="ds-field"
                                                                        inputMode="numeric"
                                                                        value={stockMasivo}
                                                                        onChange={e => cambiarStockMasivo(e.target.value)}
                                                                        placeholder="0"
                                                                        aria-label="Stock para todas las variantes"
                                                                        style={celdaGrande}
                                                                    />
                                                                    <span />
                                                                </div>
                                                            )}
                                                            {filas.map((f, i) => (
                                                                <div key={f.clave} className="pn-vgrid" style={{ padding: '6px 12px', borderBottom: i < filas.length - 1 ? '1px solid var(--color-border)' : 'none', opacity: f.activa ? 1 : 0.5 }}>
                                                                    <span style={{ fontSize: 12.5, fontWeight: 500, color: 'var(--color-text)', fontFamily: '"Geist Mono", monospace', overflowWrap: 'anywhere' }}>{f.clave}</span>
                                                                    <InputPrecio
                                                                        className="ds-field"
                                                                        value={f.precio}
                                                                        disabled={!f.activa}
                                                                        onChange={v => setFilas(prev => prev.map((x, j) => j === i ? { ...x, precio: v } : x))}
                                                                        style={{ ...celdaGrande, ...(errorPrecioFila(f) ? { borderColor: 'var(--color-error)' } : {}) }}
                                                                        placeholder="0"
                                                                        mono
                                                                    />
                                                                    <input
                                                                        className="ds-field"
                                                                        inputMode="numeric"
                                                                        value={f.stock}
                                                                        disabled={!f.activa}
                                                                        onChange={e => setFilas(prev => prev.map((x, j) => j === i ? { ...x, stock: e.target.value.replace(/\D/g, '') } : x))}
                                                                        aria-label={`Stock de ${f.clave}`}
                                                                        style={celdaGrande}
                                                                    />
                                                                    <button
                                                                        type="button"
                                                                        className="ds-hover"
                                                                        aria-label={f.activa ? 'Dejar de ofrecer esta combinación' : 'Volver a ofrecer esta combinación'}
                                                                        title={f.activa ? 'Dejar de ofrecer esta combinación' : 'Volver a ofrecer esta combinación'}
                                                                        onClick={() => setFilas(prev => prev.map((x, j) => j === i ? { ...x, activa: !x.activa } : x))}
                                                                        style={{ ...iconBtn, width: 30, color: f.activa ? 'var(--color-muted)' : 'var(--color-subtle)' }}
                                                                    >
                                                                        {f.activa ? <Eye size={16} strokeWidth={1.6} /> : <EyeOff size={16} strokeWidth={1.6} />}
                                                                    </button>
                                                                </div>
                                                            ))}
                                                        </div>
                                                        {inactivas > 0 && (
                                                            <div style={{ fontSize: 11.5, color: 'var(--color-muted)', marginTop: 6 }}>
                                                                {inactivas} {inactivas === 1 ? 'combinación no se ofrece' : 'combinaciones no se ofrecen'}. Tocá el ojo para volver a ofrecerla.
                                                            </div>
                                                        )}
                                                        </>
                                                        )}
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </Seccion>

                                {/* ── DESCRIPCIÓN: opcional, con la foto y el nombre ya puestos es más fácil ── */}
                                <Seccion>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 6 }}>
                                        <label style={{ ...lbl, marginBottom: 0 }}>Descripción <span style={{ color: 'var(--color-muted)', fontWeight: 400 }}>(opcional)</span></label>
                                        <button
                                            type="button"
                                            onClick={orbiAsistir}
                                            disabled={!prod.nombre.trim() || orbiGen}
                                            className="ds-link"
                                            style={{ ...enlace, fontSize: 12.5, opacity: prod.nombre.trim() && !orbiGen ? 1 : 0.55, cursor: prod.nombre.trim() && !orbiGen ? 'pointer' : 'default' }}
                                        >
                                            {orbiGen ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                                            {orbiGen ? 'Redactando…' : 'Redactar con Orbi'}
                                        </button>
                                    </div>
                                    <textarea
                                        className="ds-field"
                                        value={prod.descripcion}
                                        onChange={e => set('descripcion', e.target.value.slice(0, 2000))}
                                        rows={3}
                                        aria-label="Descripción"
                                        style={{ ...inputBase, width: '100%', resize: 'vertical', minHeight: 84, padding: '10px 12px', fontSize: 14, lineHeight: 1.6 }}
                                    />
                                </Seccion>

                                {/* ── MÁS DETALLES: todo lo opcional, cerrado por defecto ── */}
                                <Desplegable
                                    abierto={masAbierto}
                                    onToggle={() => setMasAbierto(o => !o)}
                                    titulo="Más detalles"
                                    resumen="Etiquetas, especificaciones, video y SKU"
                                >
                                    <Bloque titulo="Etiquetas" ayuda="Sirven para agrupar productos.">
                                        <input
                                            className="ds-field"
                                            value={tagInput}
                                            onChange={e => setTagInput(e.target.value)}
                                            onKeyDown={e => { if (e.key === 'Enter' && tagInput.trim()) { e.preventDefault(); agregarTag(tagInput); setTagInput('') } }}
                                            placeholder="Escribí una etiqueta y presioná Enter"
                                            aria-label="Etiquetas"
                                            style={{ ...inputBase, width: '100%', height: 38, padding: '0 12px', fontSize: 13 }}
                                        />
                                        {prod.tags.length > 0 && (
                                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                                                {prod.tags.map(tg => (
                                                    <span key={tg} style={chip}>{tg}
                                                        <button type="button" className="ds-hover" aria-label={`Quitar ${tg}`} onClick={() => set('tags', prod.tags.filter(x => x !== tg))} style={chipX}><X size={11} strokeWidth={2} /></button>
                                                    </span>
                                                ))}
                                            </div>
                                        )}
                                        {sugerencias.length > 0 && (
                                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10, alignItems: 'center' }}>
                                                <span style={{ fontSize: 11.5, color: 'var(--color-muted)' }}>Ya usaste:</span>
                                                {sugerencias.map(t => (
                                                    <button
                                                        key={t.id}
                                                        type="button"
                                                        className="ds-hover"
                                                        onClick={() => agregarTag(t.name)}
                                                        title={t.usageCount > 0 ? `En ${t.usageCount} producto${t.usageCount === 1 ? '' : 's'}` : 'Sin usar todavía'}
                                                        style={chipSugerido}
                                                    >
                                                        {t.name}{t.usageCount > 0 && <span style={{ opacity: 0.6 }}> · {t.usageCount}</span>}
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </Bloque>

                                    <Bloque
                                        titulo="Especificaciones técnicas"
                                        ayuda="Ideal para tecnología, electrodomésticos, herramientas."
                                        derecha={!mostrarSpecs ? (
                                            <button type="button" className="ds-link" onClick={() => { setMostrarSpecs(true); if (prod.specs.length === 0) agregarSpec() }} style={enlace}>
                                                <Plus size={13} /> Agregar
                                            </button>
                                        ) : (
                                            <button type="button" className="ds-link" onClick={() => setMostrarSpecs(false)} style={{ ...enlace, color: 'var(--color-muted)' }}>
                                                Quitar especificaciones
                                            </button>
                                        )}
                                    >
                                        {mostrarSpecs && (
                                            <div>
                                                {prod.specs.map((sp, i) => (
                                                    <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
                                                        <input className="ds-field" value={sp.label} onChange={e => actualizarSpec(i, 'label', e.target.value.slice(0, 60))} placeholder="Ej: RAM" aria-label="Característica" style={{ ...inputBase, flex: 1, height: 36, padding: '0 10px', fontSize: 13 }} />
                                                        <input className="ds-field" value={sp.value} onChange={e => actualizarSpec(i, 'value', e.target.value.slice(0, 300))} placeholder="Ej: 16GB" aria-label="Valor" style={{ ...inputBase, flex: 1.4, height: 36, padding: '0 10px', fontSize: 13 }} />
                                                        <button type="button" className="ds-hover" onClick={() => quitarSpec(i)} aria-label="Quitar" title="Quitar" style={{ width: 32, height: 32, borderRadius: 7, border: 'none', background: 'transparent', color: 'var(--color-muted)', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                                                            <Trash2 size={14} />
                                                        </button>
                                                    </div>
                                                ))}
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 4, flexWrap: 'wrap' }}>
                                                    <button type="button" className="ds-link" onClick={agregarSpec} style={enlace}><Plus size={13} /> Agregar especificación</button>
                                                    <button type="button" className="ds-link" onClick={orbiAsistirSpecs} disabled={orbiSpecsGen} style={enlace}>
                                                        {orbiSpecsGen ? <><Loader2 size={12} className="animate-spin" /> Generando…</> : <><Sparkles size={12} /> Completar con Orbi</>}
                                                    </button>
                                                </div>
                                                {/* Lo que suele llevar la ficha en los rubros del negocio. */}
                                                {specsPorSugerir.length > 0 && (
                                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center', marginTop: 12 }}>
                                                        <span style={{ fontSize: 11.5, color: 'var(--color-muted)' }}>Suelen llevar:</span>
                                                        {specsPorSugerir.map(l => (
                                                            <button key={l} type="button" className="ds-hover" onClick={() => agregarSpecSugerida(l)} style={chipSugerido}>+ {l}</button>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </Bloque>

                                    <Bloque titulo="Video" ayuda="Se ve junto a las fotos en la ficha del producto.">
                                        {/* Un solo video por producto. Pegar un link (YouTube/Vimeo/archivo) o
                                            subir el archivo directo: los dos escriben el mismo campo videoUrl. */}
                                        {!esVideoArchivo(prod.videoUrl) && (
                                            <>
                                                <input
                                                    className="ds-field"
                                                    value={prod.videoUrl}
                                                    onChange={e => set('videoUrl', e.target.value)}
                                                    placeholder="https://www.youtube.com/watch?v=..."
                                                    aria-label="Link del video"
                                                    style={{ ...inputBase, height: 38, padding: '0 12px', fontSize: 13.5, width: '100%', marginBottom: 8 }}
                                                />
                                                {prod.videoUrl.trim() !== '' && !parseVideoEmbed(prod.videoUrl) && (
                                                    <div style={{ fontSize: 11.5, color: 'var(--color-error)', marginBottom: 8 }}>
                                                        No reconocemos este link. Probá con uno de YouTube, de Vimeo, o que termine en .mp4
                                                    </div>
                                                )}
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '2px 0 8px' }}>
                                                    <div style={{ flex: 1, height: 1, background: 'var(--color-border)' }} />
                                                    <span style={{ fontSize: 11, color: 'var(--color-subtle)', fontWeight: 600 }}>O</span>
                                                    <div style={{ flex: 1, height: 1, background: 'var(--color-border)' }} />
                                                </div>
                                            </>
                                        )}
                                        <VideoUploader value={prod.videoUrl} onChange={v => set('videoUrl', v)} onUpload={subirVideoProducto} maxMB={500} />
                                    </Bloque>

                                    {!prod.tieneVariantes ? (
                                        <Bloque titulo="Inventario" ayuda="El código se arma solo a partir del nombre.">
                                            <div className="pn-3col" style={{ gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
                                                <div>
                                                    <PField label="SKU" value={prod.sku} onChange={v => { skuAutoRef.current = false; set('sku', v.toUpperCase()) }} mono placeholder="RM-OVR-NG" />
                                                    <button type="button" className="ds-link" onClick={() => { skuAutoRef.current = true; set('sku', generarSKU(prod.nombre)) }} style={{ ...enlace, fontSize: 11.5, marginTop: 4 }}>Regenerar desde el nombre</button>
                                                </div>
                                                <div>
                                                    <PField label="Stock mínimo de alerta" value={prod.stockMinimo} onChange={v => { const limpio = v.replace(/\D/g, ''); set('stockMinimo', limpio); recordarStockMinimo(limpio) }} mono />
                                                    <div style={{ fontSize: 11.5, color: 'var(--color-muted)', marginTop: 4 }}>Te avisamos cuando el stock baje a este nivel.</div>
                                                </div>
                                            </div>
                                        </Bloque>
                                    ) : filas.length > 0 && (
                                        <Bloque titulo="SKU y stock mínimo por variante" ayuda="Los códigos se arman solos. Te avisamos cuando el stock baje del mínimo.">
                                            <div style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 10, padding: '6px 12px' }}>
                                                {filas.map((f, i) => (
                                                    <div key={f.clave} className="pn-vgrid-sku" style={{ padding: '6px 0', borderBottom: i < filas.length - 1 ? '1px solid var(--color-border)' : 'none', opacity: f.activa ? 1 : 0.5 }}>
                                                        <span style={{ fontSize: 12.5, fontWeight: 500, color: 'var(--color-text)', fontFamily: '"Geist Mono", monospace', overflowWrap: 'anywhere' }}>{f.clave}</span>
                                                        <input className="ds-field" value={f.sku} disabled={!f.activa} aria-label={`SKU de ${f.clave}`} onChange={e => setFilas(prev => prev.map((x, j) => j === i ? { ...x, sku: e.target.value.toUpperCase() } : x))} style={celdaGrande} />
                                                        <input className="ds-field" inputMode="numeric" value={f.stockMin} disabled={!f.activa} aria-label={`Stock mínimo de ${f.clave}`} onChange={e => { const limpio = e.target.value.replace(/\D/g, ''); recordarStockMinimo(limpio); setFilas(prev => prev.map((x, j) => j === i ? { ...x, stockMin: limpio } : x)) }} style={celdaGrande} />
                                                    </div>
                                                ))}
                                            </div>
                                        </Bloque>
                                    )}

                                    {/* Al crear, el estado lo decide el botón (Publicar / Guardar borrador).
                                        Al editar, se elige acá y "Guardar cambios" lo respeta. */}
                                    {editando && (
                                        <Bloque titulo="Estado">
                                            <div style={{ display: 'flex', gap: 8 }}>
                                                {([['PUBLISHED', 'Publicado'], ['DRAFT', 'Borrador']] as [ProductStatus, string][]).map(([id, l]) => {
                                                    const a = prod.estado === id
                                                    return (
                                                        <button key={id} type="button" className="ds-hover" aria-pressed={a} onClick={() => set('estado', id)} style={{ height: 36, padding: '0 16px', borderRadius: 8, border: `1px solid ${a ? 'var(--color-primary)' : 'var(--color-border)'}`, background: a ? 'var(--color-primary-bg)' : 'transparent', color: a ? 'var(--color-primary)' : 'var(--color-body)', fontSize: 13, fontWeight: a ? 600 : 500, fontFamily: 'inherit', cursor: 'pointer' }}>
                                                            {l}
                                                        </button>
                                                    )
                                                })}
                                            </div>
                                            {/* Contenido de la ficha (videos con texto): mismo editor que
                                                Productos → ⋮ → "Contenido de la ficha"; guarda solo. */}
                                            {editarId && (
                                                <button type="button" className="ds-link" onClick={() => setContenidoAbierto(true)} style={{ ...enlace, marginTop: 12 }}>
                                                    Contenido de la ficha <ChevronRight size={13} />
                                                </button>
                                            )}
                                        </Bloque>
                                    )}
                                </Desplegable>
                            </>
                        )}
                    </Card>

                    {/* Barra de guardado fija: siempre a mano, sin pasos. */}
                    {!categoriasCargando && categorias.length > 0 && (
                        <div
                            className="pn-barra"
                            style={{
                                position: 'sticky', bottom: 0, zIndex: 5, marginTop: 12, padding: '12px 16px',
                                background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 12,
                                boxShadow: 'var(--shadow-card)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap',
                            }}
                        >
                            {!editando && (
                                <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 12.5, color: 'var(--color-muted)', cursor: 'pointer' }}>
                                    <input
                                        type="checkbox"
                                        checked={cargarOtro}
                                        onChange={e => {
                                            setCargarOtro(e.target.checked)
                                            try { window.localStorage.setItem(CARGAR_OTRO_KEY, e.target.checked ? '1' : '0') } catch { /* sin storage, no se recuerda */ }
                                        }}
                                        style={{ accentColor: 'var(--color-primary)', width: 16, height: 16, margin: 0 }}
                                    />
                                    Cargar otro después
                                </label>
                            )}
                            {faltasVisibles.length > 0 && (
                                <span style={{ fontSize: 12.5, color: 'var(--color-error)', flex: 1, minWidth: 0 }} role="alert">
                                    Falta {faltasVisibles.map(f => f.texto).join(', ')}.
                                </span>
                            )}
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 'auto' }}>
                                {editando ? (
                                    <Button variant="primary" size="lg" onClick={() => intentarGuardar(prod.estado)}>Guardar cambios</Button>
                                ) : (
                                    <>
                                        <Button variant="ghost" onClick={() => intentarGuardar('DRAFT')}>Guardar borrador</Button>
                                        <Button variant="primary" size="lg" onClick={() => intentarGuardar('PUBLISHED')}>Publicar</Button>
                                    </>
                                )}
                            </div>
                        </div>
                    )}

                    {contenidoAbierto && editarId && (
                        <ContenidoFichaModal productId={editarId} onClose={() => setContenidoAbierto(false)} onGuardado={() => onToast?.('Contenido de la ficha guardado')} />
                    )}
                </div>

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
                            imagenPrincipal={
                                // Igual criterio que el backend (pickPrimaryImageUrl): principal
                                // marcada > primera general > primera de variante que exista. Se
                                // usa solo para decidir CON QUÉ arranca la navegación (índice 0) —
                                // si el producto es puramente de variantes (solo fotos por color,
                                // ninguna general), arranca en la primera foto de variante en vez
                                // de quedar sin foto.
                                imagenes.find(i => i.principal)?.preview
                                ?? imagenes.find(i => !i.valorOpcion)?.preview
                                ?? guardadas.find(g => g.principal)?.url
                                ?? guardadas.find(g => !g.optionValueId)?.url
                            }
                            fotosGenerales={fotosGeneralesPreview}
                            nombreOpcionVisual={opcionVisual?.nombre}
                            fotosPorValor={fotosPorValorPreview}
                            variantes={prod.tieneVariantes ? prod.tiposVariante.filter(t => t.nombre.trim() && t.opciones.length && t.id !== opcionVisual?.id) : []}
                            stockTotal={stockTotal}
                            urlsConFondoIA={urlsConFondoIA}
                        />
                    </Card>
                </div>
            </div>

            <EstudioFondoModal
                isOpen={modalFondoIA}
                onClose={() => setModalFondoIA(false)}
                imagenes={[
                    ...imagenes.filter(i => !i.valorOpcion && !i.aplicandoFondo).map((i): ImagenParaFondo => ({ key: i.key, tipo: 'pendiente', file: i.file, preview: i.preview })),
                    ...guardadas.filter(g => !g.optionValueId).map((g): ImagenParaFondo => ({ key: g.id, tipo: 'guardada', url: g.url, preview: g.url })),
                ]}
                onAplicarEnSegundoPlano={(origen, resultado) => aplicarFondoEnSegundoPlano(origen, resultado, false)}
                onToast={onToast}
                photoType={prod.photoType}
            />

            <EstudioFondoModal
                isOpen={modalFondoIAVariantes}
                onClose={() => setModalFondoIAVariantes(false)}
                imagenes={[
                    ...imagenes.filter(i => !!i.valorOpcion && !i.aplicandoFondo).map((i): ImagenParaFondo => ({ key: i.key, tipo: 'pendiente', file: i.file, preview: i.preview })),
                    ...guardadas.filter(g => g.optionValueId != null).map((g): ImagenParaFondo => ({ key: g.id, tipo: 'guardada', url: g.url, preview: g.url })),
                ]}
                onAplicarEnSegundoPlano={(origen, resultado) => aplicarFondoEnSegundoPlano(origen, resultado, true)}
                onToast={onToast}
                photoType={prod.photoType}
            />
        </div>
    )
}

// ─── Preview ──────────────────────────────────────────────────────────────────

// Hash chico y estable de un texto a un hue (0-359) — mismo criterio que
// hueFromId() del storefront (ProductoDetalle.tsx), reimplementado acá
// porque son módulos sin nada compartido entre panel y cliente. Se usa para
// el swatch de un valor de variante que todavía no tiene ninguna foto
// tagueada (gradiente por hash en vez de dejarlo vacío o romper).
function hueDeTexto(s: string): number {
    let h = 0
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 360
    return h
}

function PreviewProducto({
    nombre, descripcion, precio, desde, estado, categoria, imagenPrincipal,
    fotosGenerales, nombreOpcionVisual, fotosPorValor, variantes, stockTotal, urlsConFondoIA,
}: {
    nombre: string; descripcion: string; precio: string; desde?: boolean
    estado: ProductStatus; categoria?: string
    // Con qué foto arranca la navegación (ver el comentario en el call site) —
    // si no está en `fotosGenerales` (puede no estarlo, ej. si es "principal"
    // de variante) igual se antepone a la secuencia para no perderla.
    imagenPrincipal?: string
    fotosGenerales: string[]
    nombreOpcionVisual?: string
    fotosPorValor: { valor: string; url?: string }[]
    variantes: TipoVariante[]; stockTotal: number
    // URLs con fondo compuesto por "Fondo con IA" — esas se muestran con
    // object-fit:cover (llenan el cuadro), el resto sigue en contain. Ver
    // comentario largo más abajo, sigue aplicando a las fotos comunes.
    urlsConFondoIA: Set<string>
}) {
    const p = Number(precio) || 0

    // Secuencia navegable: la principal primero (si no está ya en generales),
    // el resto de las generales, y una foto por cada valor de la opción
    // visual que SÍ tenga foto (las que no, solo aparecen como swatch, no
    // suman una posición vacía a la navegación).
    const generales = imagenPrincipal && !fotosGenerales.includes(imagenPrincipal)
        ? [imagenPrincipal, ...fotosGenerales]
        : fotosGenerales
    const conFoto = fotosPorValor.filter((f): f is { valor: string; url: string } => !!f.url)
    const secuencia = [...generales, ...conFoto.map(f => f.url)]
    const inicioValores = generales.length // desde qué índice de `secuencia` arranca la zona "por valor"

    const [idx, setIdx] = useState(0)
    const [hoverValor, setHoverValor] = useState<string | null>(null)
    // Si el índice actual quedó fuera de rango (ej. se borró una foto),
    // vuelve a 0 en vez de mostrar un hueco — más simple que sincronizar un
    // clamp en cada callsite que borra algo.
    const idxSeguro = idx < secuencia.length ? idx : 0

    const valorDelIdx = idxSeguro >= inicioValores ? conFoto[idxSeguro - inicioValores]?.valor : null
    const valorActivo = hoverValor ?? valorDelIdx
    const imagenMostrada = hoverValor
        ? (conFoto.find(f => f.valor === hoverValor)?.url ?? secuencia[idxSeguro])
        : secuencia[idxSeguro]

    function irA(valor: string) {
        setHoverValor(null)
        const i = conFoto.findIndex(f => f.valor === valor)
        if (i >= 0) setIdx(inicioValores + i)
    }

    return (
        <div style={{ border: '1px solid var(--color-border)', borderRadius: 12, overflow: 'hidden', background: 'var(--color-bg)' }}>
            <div style={{ position: 'relative', width: '100%', aspectRatio: '1', background: 'var(--color-surface)' }}>
                {/* object-fit: contain, no cover — mismo criterio que la
                    card real de la grilla (ProductoLista.tsx) y el
                    storefront: esta vista previa tiene que mostrar
                    honestamente cómo va a quedar la foto ahí, no una que se
                    ve distinta acá que en la lista. Excepto las de "Fondo con
                    IA" (urlsConFondoIA) — esas sí van con cover, mismo
                    criterio que la ficha real (ver ProdImage/Thumb.tsx). */}
                {imagenMostrada
                    ? (urlsConFondoIA.has(imagenMostrada)
                        ? <img src={imagenMostrada} alt={nombre} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                        : <img src={imagenMostrada} alt={nombre} style={{ position: 'absolute', inset: '6%', width: '88%', height: '88%', objectFit: 'contain', display: 'block' }} />)
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
                {/* Navegación entre la foto principal y las de variante — solo
                    si hay más de una para recorrer. */}
                {secuencia.length > 1 && (
                    <>
                        <button
                            className="ds-hover"
                            onClick={() => { setHoverValor(null); setIdx(i => (i - 1 + secuencia.length) % secuencia.length) }}
                            title="Foto anterior"
                            // Círculo blanco fijo a propósito (tiene que resaltar sobre
                            // CUALQUIER foto de producto, no solo con el tema claro) —
                            // por eso el ícono también es un color fijo, no
                            // var(--color-text): en oscuro esa variable es clara, y un
                            // ícono claro sobre un círculo blanco quedaba invisible
                            // (reportado, con captura). Mismo criterio que el carrusel
                            // real del storefront (ProductoDetalle.tsx).
                            style={{ position: 'absolute', top: '50%', left: 6, transform: 'translateY(-50%)', width: 26, height: 26, borderRadius: '50%', border: 'none', background: 'rgba(255,255,255,0.9)', color: '#0F172A', display: 'grid', placeItems: 'center', boxShadow: '0 1px 4px rgba(0,0,0,0.15)' }}
                        ><ChevronLeft size={14} /></button>
                        <button
                            className="ds-hover"
                            onClick={() => { setHoverValor(null); setIdx(i => (i + 1) % secuencia.length) }}
                            title="Foto siguiente"
                            style={{ position: 'absolute', top: '50%', right: 6, transform: 'translateY(-50%)', width: 26, height: 26, borderRadius: '50%', border: 'none', background: 'rgba(255,255,255,0.9)', color: '#0F172A', display: 'grid', placeItems: 'center', boxShadow: '0 1px 4px rgba(0,0,0,0.15)' }}
                        ><ChevronRight size={14} /></button>
                    </>
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
                        {p > 0 ? fmtMoney(p) : '$-'}
                    </span>
                </div>

                {/* Swatches circulares de la opción visual (Color) — al pasar
                    el mouse (o al hacer click), la foto grande y este texto
                    cambian a esa variante, igual que en Mercado Libre. */}
                {fotosPorValor.length > 0 && (
                    <div style={{ marginTop: 10 }}>
                        <div style={{ fontSize: 11, color: 'var(--color-muted)', marginBottom: 6 }}>
                            {nombreOpcionVisual}{valorActivo ? <>: <strong style={{ color: 'var(--color-text)', fontWeight: 600 }}>{valorActivo}</strong></> : null}
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                            {fotosPorValor.map(f => (
                                <button
                                    key={f.valor}
                                    onClick={() => irA(f.valor)}
                                    onMouseEnter={() => setHoverValor(f.valor)}
                                    onMouseLeave={() => setHoverValor(null)}
                                    title={f.valor}
                                    style={{
                                        width: 30, height: 30, borderRadius: '50%', padding: 0, overflow: 'hidden',
                                        border: `2px solid ${valorActivo === f.valor ? 'var(--color-primary)' : 'var(--color-border)'}`,
                                        cursor: 'pointer', background: 'none', flexShrink: 0,
                                        transition: 'border-color 120ms ease',
                                    }}
                                >
                                    {f.url
                                        ? <img src={f.url} alt={f.valor} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                                        : <ProductoThumb hue={hueDeTexto(f.valor)} size={26} radius={13} />}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

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

// Item combinado (guardada o pendiente) para poder dibujarlas TODAS en una
// sola secuencia numerada y arrastrable — antes eran dos .map() separados
// (guardadas siempre primero) sin ninguna forma de reordenar ni de saber,
// de un vistazo, cuál se ve primero en el catálogo.
type ItemGaleria =
    | { tipo: 'guardada'; id: string; url: string; principal: boolean; quitarFondo: boolean; conFondoIA: boolean; encuadrando?: boolean; textoProceso?: string }
    | { tipo: 'pendiente'; id: string; url: string; principal: boolean; quitarFondo: boolean; conFondoIA?: boolean; encuadrando?: boolean; textoProceso?: string }

// Tip de "quitar fondo con IA" — vive una sola vez junto al título de la
// sección (no repetido por foto, es una recomendación de cómo sacar la
// foto en general, no de una imagen puntual). Ventanita liviana, no un
// Modal: no puede cambiar el alto de la card al abrirse. Se abre con
// hover en desktop y con un tap en mobile (donde no hay hover), y se
// cierra al sacar el mouse o al tocar afuera.
function TipQuitarFondo() {
    const [abierto, setAbierto] = useState(false)
    const ref = useRef<HTMLSpanElement>(null)

    useEffect(() => {
        if (!abierto) return
        function alTocarAfuera(e: MouseEvent) {
            if (ref.current && !ref.current.contains(e.target as Node)) setAbierto(false)
        }
        document.addEventListener('mousedown', alTocarAfuera)
        return () => document.removeEventListener('mousedown', alTocarAfuera)
    }, [abierto])

    return (
        <span
            ref={ref}
            style={{ position: 'relative', display: 'inline-flex', marginLeft: 6 }}
            onMouseEnter={() => setAbierto(true)}
            onMouseLeave={() => setAbierto(false)}
        >
            <button
                type="button"
                onClick={() => setAbierto(a => !a)}
                aria-label="Tip para quitar el fondo con IA"
                title="Tip para quitar el fondo con IA"
                style={{
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    width: 16, height: 16, borderRadius: '50%', border: '1px solid var(--color-border)',
                    background: 'var(--color-surface)', color: 'var(--color-muted)', cursor: 'pointer',
                    padding: 0, flexShrink: 0,
                }}
            >
                <Info size={11} strokeWidth={2.25} />
            </button>
            {abierto && (
                <div
                    role="tooltip"
                    style={{
                        position: 'absolute', bottom: '100%', left: 0, marginBottom: 6, width: 224,
                        background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 8,
                        boxShadow: '0 8px 24px rgba(15,23,42,0.16)', padding: '10px 12px', fontSize: 11.5,
                        color: 'var(--color-body)', lineHeight: 1.45, fontWeight: 400, zIndex: 20,
                    }}
                >
                    Para mejores resultados quitando el fondo, sacá la foto con un <strong>fondo liso</strong> y que <strong>contraste con la prenda</strong> (evitá fondos del mismo color o alfombras con pelo).
                </div>
            )}
        </span>
    )
}

// Hook reutilizable para soportar drag-and-drop táctil en celulares (iOS y Android),
// donde la API nativa HTML5 DnD no funciona. Detecta pulsación prolongada (~180ms)
// para no interferir con el scroll de la página y calcula la card destino sobrevolada.
function useTouchReorder({
    enabled,
    itemsLength,
    onMover,
}: {
    enabled: boolean
    itemsLength: number
    onMover: (origen: number, destino: number) => void
}) {
    const [arrastrando, setArrastrando] = useState<number | null>(null)
    const [sobre, setSobre] = useState<number | null>(null)
    const [isTouchDragging, setIsTouchDragging] = useState(false)

    const touchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
    const touchOriginRef = useRef<number | null>(null)
    const touchTargetRef = useRef<number | null>(null)
    const touchPosRef = useRef<{ x: number; y: number } | null>(null)
    const activeListenersRef = useRef<{ move: (e: TouchEvent) => void; end: () => void } | null>(null)

    useEffect(() => {
        return () => {
            if (touchTimer.current) clearTimeout(touchTimer.current)
            if (activeListenersRef.current) {
                window.removeEventListener('touchmove', activeListenersRef.current.move)
                window.removeEventListener('touchend', activeListenersRef.current.end)
                window.removeEventListener('touchcancel', activeListenersRef.current.end)
            }
        }
    }, [])

    const iniciarTouchDrag = useCallback((e: React.TouchEvent, idx: number) => {
        if (!enabled || itemsLength <= 1) return
        if ((e.target as HTMLElement).closest('button, select, input, label')) return

        const touch = e.touches[0]
        if (!touch) return

        touchPosRef.current = { x: touch.clientX, y: touch.clientY }
        touchOriginRef.current = idx
        touchTargetRef.current = idx

        if (touchTimer.current) clearTimeout(touchTimer.current)
        touchTimer.current = setTimeout(() => {
            setIsTouchDragging(true)
            setArrastrando(idx)
            setSobre(idx)
            try { navigator.vibrate?.(35) } catch {}

            const onWindowTouchMove = (ev: TouchEvent) => {
                if (ev.cancelable) ev.preventDefault()
                const t = ev.touches[0]
                if (!t) return
                const elem = document.elementFromPoint(t.clientX, t.clientY)
                const card = elem?.closest('[data-galeria-index]')
                if (card) {
                    const targetIdx = Number(card.getAttribute('data-galeria-index'))
                    if (!Number.isNaN(targetIdx) && targetIdx !== touchTargetRef.current) {
                        touchTargetRef.current = targetIdx
                        setSobre(targetIdx)
                    }
                }
            }

            const onWindowTouchEnd = () => {
                window.removeEventListener('touchmove', onWindowTouchMove)
                window.removeEventListener('touchend', onWindowTouchEnd)
                window.removeEventListener('touchcancel', onWindowTouchEnd)
                activeListenersRef.current = null

                const origen = touchOriginRef.current
                const destino = touchTargetRef.current
                if (origen !== null && destino !== null && origen !== destino) {
                    onMover(origen, destino)
                }

                setIsTouchDragging(false)
                setArrastrando(null)
                setSobre(null)
                touchOriginRef.current = null
                touchTargetRef.current = null
                touchPosRef.current = null
            }

            activeListenersRef.current = { move: onWindowTouchMove, end: onWindowTouchEnd }
            window.addEventListener('touchmove', onWindowTouchMove, { passive: false })
            window.addEventListener('touchend', onWindowTouchEnd)
            window.addEventListener('touchcancel', onWindowTouchEnd)
        }, 180)
    }, [enabled, itemsLength, onMover])

    const verificarMovimientoTouch = useCallback((e: React.TouchEvent) => {
        if (!touchPosRef.current || isTouchDragging) return
        const touch = e.touches[0]
        if (!touch) return
        const dx = touch.clientX - touchPosRef.current.x
        const dy = touch.clientY - touchPosRef.current.y
        if (Math.hypot(dx, dy) > 8) {
            // Usuario está haciendo scroll vertical u horizontal; cancelar arrastre
            if (touchTimer.current) {
                clearTimeout(touchTimer.current)
                touchTimer.current = null
            }
            touchPosRef.current = null
            touchOriginRef.current = null
            touchTargetRef.current = null
        }
    }, [isTouchDragging])

    const cancelarTouchAntesDeIniciar = useCallback(() => {
        if (touchTimer.current) {
            clearTimeout(touchTimer.current)
            touchTimer.current = null
        }
        touchPosRef.current = null
        touchOriginRef.current = null
        touchTargetRef.current = null
    }, [])

    return {
        arrastrando,
        sobre,
        isTouchDragging,
        setArrastrando,
        setSobre,
        iniciarTouchDrag,
        verificarMovimientoTouch,
        cancelarTouchAntesDeIniciar,
    }
}

// Botonera de orden sobre la imagen: muestra el número de posición y flechas
// izquierda/derecha para reordenar con un toque directo en celulares o desktop.
function ControlOrdenFoto({
    posicion,
    total,
    onMoverAntes,
    onMoverDespues,
}: {
    posicion: number
    total: number
    onMoverAntes: () => void
    onMoverDespues: () => void
}) {
    return (
        <div
            style={{
                position: 'absolute',
                bottom: 3,
                right: 3,
                display: 'flex',
                alignItems: 'center',
                gap: 1,
                background: 'rgba(15, 23, 42, 0.78)',
                backdropFilter: 'blur(4px)',
                borderRadius: 999,
                padding: '1px 3px',
                color: '#fff',
                zIndex: 4,
                boxShadow: '0 1px 3px rgba(0,0,0,0.35)',
            }}
        >
            {total > 1 && posicion > 0 && (
                <button
                    type="button"
                    className="ds-hover"
                    onClick={e => {
                        e.stopPropagation()
                        onMoverAntes()
                    }}
                    title="Mover antes"
                    aria-label="Mover foto a la izquierda"
                    style={{
                        background: 'transparent',
                        border: 'none',
                        color: '#fff',
                        cursor: 'pointer',
                        display: 'grid',
                        placeItems: 'center',
                        padding: 0,
                        width: 17,
                        height: 17,
                        borderRadius: 999,
                    }}
                >
                    <ChevronLeft size={12} strokeWidth={2.5} />
                </button>
            )}
            <span
                style={{
                    minWidth: 14,
                    height: 17,
                    padding: '0 2px',
                    fontSize: 9.5,
                    fontWeight: 700,
                    display: 'grid',
                    placeItems: 'center',
                    fontFamily: '"Geist Mono", monospace',
                    userSelect: 'none',
                    lineHeight: 1,
                }}
            >
                {posicion + 1}
            </span>
            {total > 1 && posicion < total - 1 && (
                <button
                    type="button"
                    className="ds-hover"
                    onClick={e => {
                        e.stopPropagation()
                        onMoverDespues()
                    }}
                    title="Mover después"
                    aria-label="Mover foto a la derecha"
                    style={{
                        background: 'transparent',
                        border: 'none',
                        color: '#fff',
                        cursor: 'pointer',
                        display: 'grid',
                        placeItems: 'center',
                        padding: 0,
                        width: 17,
                        height: 17,
                        borderRadius: 999,
                    }}
                >
                    <ChevronRight size={12} strokeWidth={2.5} />
                </button>
            )}
        </div>
    )
}

function GaleriaImagenes({ pendientes, guardadas, onAgregar, onQuitarPendiente, onQuitarGuardada, onReorder, orden, onQuitarFondo, onQuitarFondoGuardada, fondoEnProceso, avanzadoDisponible, permitePrincipal, compacta, opcionesAsignar, nombreAsignar, onAsignar }: {
    pendientes: ImagenPendiente[]
    guardadas: ImagenGuardada[]
    onAgregar: (files: FileList | null) => void
    onQuitarPendiente: (key: string) => void
    onQuitarGuardada: (id: string) => void
    // Opcional: sin esto la galería se ve igual pero sin números ni drag —
    // hoy solo lo usa "Fotos principales" (permitePrincipal), no las de
    // por talle/color (raro que ahí importe el orden, casi siempre 1 foto).
    onReorder?: (nuevoOrden: { tipo: 'guardada' | 'pendiente'; id: string }[]) => void
    /** Orden mezclado elegido arrastrando ("tipo:id"); lo que no figure va al final, guardadas primero. */
    orden?: string[]
    // Paquete "Avanzado" — quitar fondo con IA. Solo aplica a pendientes (se
    // procesa recién al subir, ver armarPayload/subida más abajo); una foto
    // ya guardada no tiene forma de reprocesarse desde acá.
    onQuitarFondo?: (key: string) => void
    /** Quitar/devolver el fondo de una foto ya guardada (id de ProductImage). */
    onQuitarFondoGuardada?: (id: string) => void
    fondoEnProceso?: Set<string>
    avanzadoDisponible?: boolean
    permitePrincipal?: boolean
    compacta?: boolean
    /** Valores de la opción con fotos por valor (ej. los colores); vacío = no se ofrece asignar. */
    opcionesAsignar?: string[]
    nombreAsignar?: string
    /** Pasa una foto NUEVA de "general" a la de ese valor. */
    onAsignar?: (key: string, valor: string) => void
}) {
    const alto = compacta ? 72 : 96
    const natural: ItemGaleria[] = [
        ...guardadas.map((g): ItemGaleria => ({ tipo: 'guardada', id: g.id, url: g.url, principal: g.principal, quitarFondo: g.backgroundRemoved, conFondoIA: g.hasAiBackground })),
        ...pendientes.map((p): ItemGaleria => ({ tipo: 'pendiente', id: p.key, url: p.preview, principal: p.principal, quitarFondo: !!p.quitarFondo, conFondoIA: !!p.fondoIA, encuadrando: p.encuadrando || p.aplicandoFondo, textoProceso: p.aplicandoFondo ? 'Aplicando fondo…' : undefined })),
    ]
    const items: ItemGaleria[] = orden
        ? [...natural].sort((a, b) => {
            const ia = orden.indexOf(`${a.tipo}:${a.id}`)
            const ib = orden.indexOf(`${b.tipo}:${b.id}`)
            return (ia < 0 ? Infinity : ia) - (ib < 0 ? Infinity : ib)
        })
        : natural

    const mover = useCallback((origen: number, destino: number) => {
        if (!onReorder || destino < 0 || destino >= items.length || origen === destino) return
        const nuevo = [...items]
        const [movido] = nuevo.splice(origen, 1)
        nuevo.splice(destino, 0, movido)
        onReorder(nuevo.map(it => ({ tipo: it.tipo, id: it.id })))
    }, [items, onReorder])

    const {
        arrastrando, sobre, isTouchDragging,
        setArrastrando, setSobre,
        iniciarTouchDrag, verificarMovimientoTouch, cancelarTouchAntesDeIniciar,
    } = useTouchReorder({
        enabled: !!onReorder,
        itemsLength: items.length,
        onMover: mover,
    })

    function soltar(destino: number) {
        if (arrastrando === null || arrastrando === destino || !onReorder) { setArrastrando(null); setSobre(null); return }
        mover(arrastrando, destino)
        setArrastrando(null)
        setSobre(null)
    }

    return (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'flex-start' }}>
            {items.map((it, i) => (
                <div key={`${it.tipo}-${it.id}`} style={{ display: 'flex', flexDirection: 'column', gap: 4, width: alto }}>
                    <div
                        data-galeria-index={i}
                        draggable={!!onReorder}
                        onDragStart={() => setArrastrando(i)}
                        onDragOver={e => { if (arrastrando !== null) { e.preventDefault(); if (sobre !== i) setSobre(i) } }}
                        onDragLeave={() => setSobre(s => (s === i ? null : s))}
                        onDrop={e => { e.preventDefault(); soltar(i) }}
                        onDragEnd={() => { setArrastrando(null); setSobre(null) }}
                        onTouchStart={e => iniciarTouchDrag(e, i)}
                        onTouchMove={verificarMovimientoTouch}
                        onTouchEnd={cancelarTouchAntesDeIniciar}
                        onTouchCancel={cancelarTouchAntesDeIniciar}
                        title={onReorder ? 'Arrastrá o usá las flechas para cambiar el orden' : undefined}
                        style={{
                            position: 'relative', width: alto, height: alto, borderRadius: 8, overflow: 'hidden',
                            // La principal es la PRIMERA del orden (no hay estrella): el borde lo lleva
                            // la que está primera en las fotos generales.
                            border: permitePrincipal && i === 0 ? '2px solid var(--color-primary)' : '1px solid var(--color-border)',
                            cursor: onReorder ? 'grab' : 'default',
                            opacity: arrastrando === i ? (isTouchDragging ? 0.75 : 0.4) : 1,
                            transform: isTouchDragging && arrastrando === i ? 'scale(1.05)' : sobre === i && arrastrando !== null && arrastrando !== i ? 'scale(0.96)' : 'none',
                            outline: sobre === i && arrastrando !== null && arrastrando !== i ? '2px dashed var(--color-primary)' : 'none',
                            outlineOffset: 2,
                            zIndex: isTouchDragging && arrastrando === i ? 10 : 1,
                            boxShadow: isTouchDragging && arrastrando === i ? '0 8px 18px rgba(0,0,0,0.35)' : 'none',
                            transition: 'opacity 120ms ease, transform 120ms ease',
                            userSelect: 'none',
                            WebkitUserSelect: 'none',
                        }}
                    >
                        <img src={it.url} alt="" draggable={false} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', pointerEvents: 'none' }} />
                        {it.encuadrando && (
                            <div style={{
                                position: 'absolute', inset: 0, background: 'rgba(15, 23, 42, 0.72)',
                                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                                gap: 4, zIndex: 5, color: '#fff', backdropFilter: 'blur(2px)',
                            }}>
                                <Loader2 size={18} className="animate-spin" />
                                <span style={{ fontSize: 9.5, fontWeight: 600, letterSpacing: '0.02em' }}>{it.textoProceso ?? 'Encuadrando…'}</span>
                            </div>
                        )}
                        {/* Controles de orden: número de posición y flechas táctiles */}
                        {onReorder && (
                            <ControlOrdenFoto
                                posicion={i}
                                total={items.length}
                                onMoverAntes={() => mover(i, i - 1)}
                                onMoverDespues={() => mover(i, i + 1)}
                            />
                        )}
                        {it.tipo === 'guardada'
                            ? <button className="ds-hover" onClick={() => onQuitarGuardada(it.id)} title="Eliminar" style={btnSobreImg}><Trash2 size={12} /></button>
                            : <button className="ds-hover" onClick={() => onQuitarPendiente(it.id)} title="Quitar" style={btnSobreImg}><X size={12} /></button>}
                    </div>
                    {/* Paquete "Avanzado" — solo en pendientes: el fondo se
                        quita recién al subir la foto (ver comentario del
                        prop). El toggle marca la intención; el procesado
                        real pasa en el backend. Antes era un ícono flotante
                        sobre la miniatura (bajo contraste, difícil de ver con
                        ciertas fotos) — ahora es un botón explícito debajo. */}
                    {/* Deshabilitado (no oculto) mientras FONDO_IA_MANTENIMIENTO. */}
                    {avanzadoDisponible && onQuitarFondo && !it.conFondoIA && (it.tipo === 'pendiente' || onQuitarFondoGuardada) && (
                        <button
                            type="button"
                            className="ds-hover"
                            onClick={() => (it.tipo === 'guardada' ? onQuitarFondoGuardada?.(it.id) : onQuitarFondo(it.id))}
                            disabled={FONDO_IA_MANTENIMIENTO || !!fondoEnProceso?.has(it.id)}
                            title={FONDO_IA_MANTENIMIENTO ? TITULO_MANTENIMIENTO : fondoEnProceso?.has(it.id) ? 'Quitando el fondo…' : it.quitarFondo ? 'Ya sin fondo — tocá para volver a la foto original' : 'Quitar el fondo de esta foto'}
                            style={{
                                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
                                width: '100%', padding: compacta ? '3px 4px' : '4px 6px', borderRadius: 6,
                                border: '1px solid ' + (it.quitarFondo ? 'var(--color-primary)' : 'var(--color-border)'),
                                background: it.quitarFondo ? 'var(--color-primary)' : 'var(--color-surface)',
                                color: it.quitarFondo ? '#fff' : FONDO_IA_MANTENIMIENTO ? 'var(--color-muted)' : 'var(--color-text)',
                                fontSize: compacta ? 9.5 : 10.5, fontWeight: 600, fontFamily: 'inherit',
                                cursor: FONDO_IA_MANTENIMIENTO ? 'not-allowed' : 'pointer',
                                opacity: FONDO_IA_MANTENIMIENTO ? 0.6 : 1,
                            }}
                        >
                            <Sparkles size={compacta ? 10 : 11} fill={it.quitarFondo ? '#fff' : 'none'} />
                            {fondoEnProceso?.has(it.id) ? 'Quitando…' : it.quitarFondo ? 'Sin fondo' : 'Quitar fondo'}
                        </button>
                    )}
                    {onAsignar && opcionesAsignar && opcionesAsignar.length > 0 && it.tipo === 'pendiente' && (
                        <select
                            className="ds-field"
                            value=""
                            aria-label={`Asignar esta foto a un ${(nombreAsignar || 'valor').toLowerCase()}`}
                            onChange={e => { if (e.target.value) onAsignar(it.id, e.target.value) }}
                            onMouseDown={e => e.stopPropagation()}
                            style={{ width: '100%', height: 24, padding: '0 4px', borderRadius: 5, border: '1px solid var(--color-border)', background: 'var(--color-bg)', color: 'var(--color-muted)', fontSize: 10.5, fontFamily: 'inherit' }}
                        >
                            <option value="">{nombreAsignar || 'Valor'}…</option>
                            {opcionesAsignar.map(op => <option key={op} value={op}>{op}</option>)}
                        </select>
                    )}
                </div>
            ))}
            <label className="ds-hover" style={{ width: alto, height: alto, borderRadius: 8, border: '1.5px dashed var(--color-border)', background: 'var(--color-surface)', display: 'grid', placeItems: 'center', color: 'var(--color-muted)' }}>
                <input type="file" accept="image/*,.heic,.heif" multiple onChange={e => { onAgregar(e.target.files); e.target.value = '' }} style={{ display: 'none' }} />
                <Plus size={compacta ? 16 : 20} />
            </label>
        </div>
    )
}

// Galería "por variante" (Color, Talle…) — a diferencia de GaleriaImagenes de
// arriba, acá NO hay una caja de subida por cada valor: es UNA sola, estilo
// Mercado Libre — subís todo junto y etiquetás cada foto con un select. Es un
// componente aparte (no una variante más de GaleriaImagenes) porque el layout
// de cada card es distinto (imagen + tira de etiqueta abajo, sin estrella de
// principal) y mezclar los dos hacía ese componente difícil de leer.
function GaleriaImagenesEtiquetada({ pendientes, guardadas, opciones, valorDeGuardada, onAgregar, onQuitarPendiente, onQuitarGuardada, onEtiquetar, onReorder, onQuitarFondo, onQuitarFondoGuardada, fondoEnProceso, avanzadoDisponible }: {
    pendientes: ImagenPendiente[]
    guardadas: ImagenGuardada[]
    opciones: string[]
    // Resuelve el optionValueId de una guardada al texto del valor ("Negro")
    // — el estado del wizard solo tiene el id real una vez que el producto
    // existe, este resolver lo arma el que llama (tiene el mapeo a mano).
    valorDeGuardada: (optionValueId: string | null) => string | undefined
    onAgregar: (files: FileList | null) => void
    onQuitarPendiente: (key: string) => void
    onQuitarGuardada: (id: string) => void
    onEtiquetar: (key: string, valor: string) => void
    onReorder: (nuevoOrden: { tipo: 'guardada' | 'pendiente'; id: string }[]) => void
    // Paquete "Avanzado" — quitar fondo con IA, mismo criterio y mismo
    // handler (alternarQuitarFondo) que GaleriaImagenes: solo aplica a
    // pendientes, se procesa recién al subir. Pedido explícito (24/09/2026):
    // las fotos por variante también tienen que poder pedirlo, el backend ya
    // lo soporta vía optionValueId sin cambios (ver products.service.ts).
    onQuitarFondo?: (key: string) => void
    /** Quitar/devolver el fondo de una foto ya guardada (id de ProductImage). */
    onQuitarFondoGuardada?: (id: string) => void
    fondoEnProceso?: Set<string>
    avanzadoDisponible?: boolean
}) {
    const alto = 88
    type ItemEtiquetado = { tipo: 'guardada' | 'pendiente'; id: string; url: string; etiqueta?: string; editable: boolean; quitarFondo?: boolean; conFondoIA?: boolean; encuadrando?: boolean; textoProceso?: string }
    const items: ItemEtiquetado[] = [
        ...guardadas.map((g): ItemEtiquetado => ({ tipo: 'guardada', id: g.id, url: g.url, etiqueta: valorDeGuardada(g.optionValueId), editable: false, quitarFondo: g.backgroundRemoved, conFondoIA: g.hasAiBackground })),
        ...pendientes.map((p): ItemEtiquetado => ({ tipo: 'pendiente', id: p.key, url: p.preview, etiqueta: p.valorOpcion, editable: true, quitarFondo: !!p.quitarFondo, conFondoIA: !!p.fondoIA, encuadrando: p.encuadrando || p.aplicandoFondo, textoProceso: p.aplicandoFondo ? 'Aplicando fondo…' : undefined })),
    ]

    const mover = useCallback((origen: number, destino: number) => {
        if (destino < 0 || destino >= items.length || origen === destino) return
        const nuevo = [...items]
        const [movido] = nuevo.splice(origen, 1)
        nuevo.splice(destino, 0, movido)
        onReorder(nuevo.map(it => ({ tipo: it.tipo, id: it.id })))
    }, [items, onReorder])

    const {
        arrastrando, sobre, isTouchDragging,
        setArrastrando, setSobre,
        iniciarTouchDrag, verificarMovimientoTouch, cancelarTouchAntesDeIniciar,
    } = useTouchReorder({
        enabled: true,
        itemsLength: items.length,
        onMover: mover,
    })

    function soltar(destino: number) {
        if (arrastrando === null || arrastrando === destino) { setArrastrando(null); setSobre(null); return }
        mover(arrastrando, destino)
        setArrastrando(null)
        setSobre(null)
    }

    if (opciones.length === 0) {
        return <div style={{ fontSize: 12, color: 'var(--color-muted)' }}>Cargá al menos un valor en la opción de arriba para poder subir fotos por {`{valor}`}.</div>
    }

    return (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
            {items.map((it, i) => (
                <div
                    key={`${it.tipo}-${it.id}`}
                    style={{ width: alto, display: 'flex', flexDirection: 'column', gap: 3 }}
                >
                    <div
                        data-galeria-index={i}
                        draggable
                        onDragStart={() => setArrastrando(i)}
                        onDragOver={e => { if (arrastrando !== null) { e.preventDefault(); if (sobre !== i) setSobre(i) } }}
                        onDragLeave={() => setSobre(s => (s === i ? null : s))}
                        onDrop={e => { e.preventDefault(); soltar(i) }}
                        onDragEnd={() => { setArrastrando(null); setSobre(null) }}
                        onTouchStart={e => iniciarTouchDrag(e, i)}
                        onTouchMove={verificarMovimientoTouch}
                        onTouchEnd={cancelarTouchAntesDeIniciar}
                        onTouchCancel={cancelarTouchAntesDeIniciar}
                        title="Arrastrá o usá las flechas para cambiar el orden"
                        style={{
                            position: 'relative', width: alto, height: alto, borderRadius: 8, overflow: 'hidden',
                            border: '1px solid var(--color-border)', cursor: 'grab',
                            opacity: arrastrando === i ? (isTouchDragging ? 0.75 : 0.4) : 1,
                            transform: isTouchDragging && arrastrando === i ? 'scale(1.05)' : sobre === i && arrastrando !== null && arrastrando !== i ? 'scale(0.96)' : 'none',
                            outline: sobre === i && arrastrando !== null && arrastrando !== i ? '2px dashed var(--color-primary)' : 'none',
                            outlineOffset: 2,
                            zIndex: isTouchDragging && arrastrando === i ? 10 : 1,
                            boxShadow: isTouchDragging && arrastrando === i ? '0 8px 18px rgba(0,0,0,0.35)' : 'none',
                            transition: 'opacity 120ms ease, transform 120ms ease',
                            userSelect: 'none',
                            WebkitUserSelect: 'none',
                        }}
                    >
                        <img src={it.url} alt="" draggable={false} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', pointerEvents: 'none' }} />
                        {it.encuadrando && (
                            <div style={{
                                position: 'absolute', inset: 0, background: 'rgba(15, 23, 42, 0.72)',
                                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                                gap: 4, zIndex: 5, color: '#fff', backdropFilter: 'blur(2px)',
                            }}>
                                <Loader2 size={18} className="animate-spin" />
                                <span style={{ fontSize: 9.5, fontWeight: 600, letterSpacing: '0.02em' }}>{it.textoProceso ?? 'Encuadrando…'}</span>
                            </div>
                        )}
                        <ControlOrdenFoto
                            posicion={i}
                            total={items.length}
                            onMoverAntes={() => mover(i, i - 1)}
                            onMoverDespues={() => mover(i, i + 1)}
                        />
                        <button
                            className="ds-hover"
                            onClick={() => (it.tipo === 'guardada' ? onQuitarGuardada(it.id) : onQuitarPendiente(it.id))}
                            title={it.tipo === 'guardada' ? 'Eliminar' : 'Quitar'}
                            style={btnSobreImg}
                        ><Trash2 size={12} /></button>
                    </div>
                    {/* Etiqueta de variante: select editable en las pendientes,
                        de solo lectura en las ya guardadas (no hay forma hoy
                        de cambiarle el optionValueId a una imagen existente —
                        se borra y se vuelve a subir con el tag correcto). */}
                    {it.editable ? (
                        <select
                            className="ds-field"
                            value={it.etiqueta ?? opciones[0]}
                            onChange={e => onEtiquetar(it.id, e.target.value)}
                            onMouseDown={e => e.stopPropagation()}
                            style={{ width: '100%', height: 24, padding: '0 4px', borderRadius: 5, border: '1px solid var(--color-border)', background: 'var(--color-bg)', color: 'var(--color-text)', fontSize: 10.5, fontFamily: 'inherit' }}
                        >
                            {opciones.map(op => <option key={op} value={op}>{op}</option>)}
                        </select>
                    ) : (
                        <span style={{ width: '100%', height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 5, background: 'var(--color-surface-alt)', color: 'var(--color-muted)', fontSize: 10.5, textAlign: 'center', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {it.etiqueta ?? '-'}
                        </span>
                    )}
                    {avanzadoDisponible && onQuitarFondo && !it.conFondoIA && (it.tipo === 'pendiente' || onQuitarFondoGuardada) && (
                        <button
                            type="button"
                            className="ds-hover"
                            onClick={() => (it.tipo === 'guardada' ? onQuitarFondoGuardada?.(it.id) : onQuitarFondo(it.id))}
                            disabled={FONDO_IA_MANTENIMIENTO || !!fondoEnProceso?.has(it.id)}
                            title={FONDO_IA_MANTENIMIENTO ? TITULO_MANTENIMIENTO : fondoEnProceso?.has(it.id) ? 'Quitando el fondo…' : it.quitarFondo ? 'Ya sin fondo — tocá para volver a la foto original' : 'Quitar el fondo de esta foto'}
                            style={{
                                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 3,
                                width: '100%', padding: '3px 4px', borderRadius: 5,
                                border: '1px solid ' + (it.quitarFondo ? 'var(--color-primary)' : 'var(--color-border)'),
                                background: it.quitarFondo ? 'var(--color-primary)' : 'var(--color-surface)',
                                color: it.quitarFondo ? '#fff' : 'var(--color-text)',
                                fontSize: 9, fontWeight: 600, fontFamily: 'inherit', cursor: FONDO_IA_MANTENIMIENTO ? 'not-allowed' : 'pointer',
                                opacity: FONDO_IA_MANTENIMIENTO ? 0.6 : 1,
                            }}
                        >
                            <Sparkles size={9} fill={it.quitarFondo ? '#fff' : 'none'} />
                            {fondoEnProceso?.has(it.id) ? 'Quitando…' : it.quitarFondo ? 'Sin fondo' : 'Quitar fondo'}
                        </button>
                    )}
                </div>
            ))}
            <label className="ds-hover" style={{ width: alto, height: alto, borderRadius: 8, border: '1.5px dashed var(--color-border)', background: 'var(--color-surface)', display: 'grid', placeItems: 'center', color: 'var(--color-muted)' }}>
                <input type="file" accept="image/*,.heic,.heif" multiple onChange={e => { onAgregar(e.target.files); e.target.value = '' }} style={{ display: 'none' }} />
                <Plus size={18} />
            </label>
        </div>
    )
}

// ─── Sub-componentes ──────────────────────────────────────────────────────────

// Una sección de la pantalla única: separadas por una línea fina, sin tarjetas
// anidadas. El título es opcional (el nombre y el precio no lo necesitan).
// "Fondo con IA": es la función que más diferencia una foto de otra, así que va
// resaltada (relleno del color principal + brillo suave) y no como un botón más.
function BotonFondoIA({ onClick }: { onClick: () => void }) {
    return (
        <button
            type="button"
            className="pn-fondoia"
            onClick={onClick}
            disabled={FONDO_IA_MANTENIMIENTO}
            title={FONDO_IA_MANTENIMIENTO ? TITULO_MANTENIMIENTO : 'Reemplaza el fondo de tus fotos por uno de estudio'}
        >
            <Sparkles size={14} strokeWidth={2.2} /> Fondo con IA
        </button>
    )
}

function Seccion({ titulo, derecha, primera, id, children }: {
    titulo?: ReactNode; derecha?: ReactNode; primera?: boolean; id?: string; children: ReactNode
}) {
    return (
        <section id={id} style={{ padding: primera ? '0 0 22px' : '22px 0', borderTop: primera ? 'none' : '1px solid var(--color-border)' }}>
            {(titulo || derecha) && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, marginBottom: 12, minHeight: 32 }}>
                    <h2 style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-text)', margin: 0, display: 'flex', alignItems: 'center', gap: 4 }}>{titulo}</h2>
                    {derecha}
                </div>
            )}
            {children}
        </section>
    )
}

// Zona grande de subida (arrastrar o tocar) — es lo primero que se ve, así
// arrancar el producto es soltar la foto. El input queda oculto pero
// enfocable, así se puede usar con teclado.
function ZonaSubida({ onArchivos }: { onArchivos: (files: FileList | null) => void }) {
    const [sobre, setSobre] = useState(false)
    return (
        <label
            className="ds-hover"
            onDragOver={e => { e.preventDefault(); setSobre(true) }}
            onDragLeave={() => setSobre(false)}
            onDrop={e => { e.preventDefault(); setSobre(false); onArchivos(e.dataTransfer.files) }}
            style={{
                position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6,
                minHeight: 132, padding: 16, textAlign: 'center', borderRadius: 12, cursor: 'pointer', color: 'var(--color-muted)',
                border: `1.5px dashed ${sobre ? 'var(--color-primary)' : 'var(--color-border-strong, var(--color-border))'}`,
                background: sobre ? 'var(--color-primary-bg)' : 'var(--color-bg)',
            }}
        >
            <input
                type="file" accept="image/*,.heic,.heif" multiple
                onChange={e => { onArchivos(e.target.files); e.target.value = '' }}
                aria-label="Subir fotos del producto"
                style={{ position: 'absolute', width: 1, height: 1, opacity: 0, pointerEvents: 'none' }}
            />
            <ImagePlus size={26} strokeWidth={1.5} />
            <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-text)' }}>Arrastrá tus fotos o tocá para subirlas</span>
            <span style={{ fontSize: 12 }}>La primera es la principal · PNG, JPG o HEIC · hasta {MAX_IMAGEN_MB}MB</span>
        </label>
    )
}

// El interruptor de variantes tiene que verse desde lejos: es la fila entera
// (tarjeta con borde y un switch grande), no una línea de texto chica.
function InterruptorVariantes({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
    return (
        <button
            type="button"
            role="switch"
            aria-checked={on}
            className="ds-hover"
            onClick={() => onChange(!on)}
            style={{
                display: 'flex', alignItems: 'center', gap: 14, width: '100%', padding: '14px 16px', textAlign: 'left',
                borderRadius: 10, cursor: 'pointer', fontFamily: 'inherit',
                background: on ? 'var(--color-primary-bg)' : 'var(--color-bg)',
                border: `1px solid ${on ? 'var(--color-primary)' : 'var(--color-border)'}`,
            }}
        >
            <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: 'block', fontSize: 14, fontWeight: 600, color: 'var(--color-text)' }}>Este producto viene en varias opciones</span>
                <span style={{ display: 'block', fontSize: 12.5, color: 'var(--color-muted)', marginTop: 2 }}>Talle, color, tamaño… cada combinación lleva su propio stock.</span>
            </span>
            <span aria-hidden style={{ width: 44, height: 24, borderRadius: 12, flexShrink: 0, position: 'relative', transition: 'background 150ms', background: on ? 'var(--color-primary)' : 'var(--color-surface-alt)', border: on ? 'none' : '1px solid var(--color-border-strong, var(--color-border))' }}>
                <span style={{ position: 'absolute', top: on ? 3 : 2, left: on ? 23 : 2, width: 18, height: 18, borderRadius: '50%', background: '#fff', boxShadow: '0 1px 3px rgba(15,23,42,0.2)', transition: 'left 150ms' }} />
            </span>
        </button>
    )
}

// Grilla de stock para productos con DOS opciones (talle × color): una celda por
// combinación, como una planilla. La opción con más valores va en filas y la de
// menos en columnas. Enter/flecha abajo pasa a la celda de abajo (y, al final de
// la columna, a la siguiente); Tab recorre la fila. Al enfocar una celda se
// selecciona su contenido, así escribir reemplaza el 0.
function GrillaStock({ tipos, filas, onStock }: {
    tipos: TipoVariante[]; filas: FilaVariante[]; onStock: (clave: string, valor: string) => void
}) {
    const ref = useRef<HTMLDivElement>(null)
    const [ri, ci] = tipos[0].opciones.length >= tipos[1].opciones.length ? [0, 1] : [1, 0]
    const opFilas = tipos[ri]
    const opCols = tipos[ci]
    const porClave = new Map(filas.map(f => [f.clave, f]))
    const claveDe = (r: string, c: string) => {
        const v: string[] = []
        v[ri] = r
        v[ci] = c
        return v.join(' / ')
    }
    const ir = (r: number, c: number) => ref.current?.querySelector<HTMLInputElement>(`[data-celda="${r}-${c}"]`)?.focus()
    const teclas = (e: React.KeyboardEvent<HTMLInputElement>, r: number, c: number) => {
        if (e.key === 'Enter' || e.key === 'ArrowDown') {
            e.preventDefault()
            if (r + 1 < opFilas.opciones.length) ir(r + 1, c)
            else if (c + 1 < opCols.opciones.length) ir(0, c + 1)
        } else if (e.key === 'ArrowUp') {
            e.preventDefault()
            if (r > 0) ir(r - 1, c)
        }
    }
    const celdaHead: React.CSSProperties = { padding: '8px 6px', fontSize: 12, fontWeight: 600, color: 'var(--color-muted)', textAlign: 'center', background: 'var(--color-surface)', borderBottom: '1px solid var(--color-border)', whiteSpace: 'nowrap' }
    return (
        <div ref={ref} style={{ overflowX: 'auto', border: '1px solid var(--color-border)', borderRadius: 10, background: 'var(--color-bg)' }}>
            <table style={{ borderCollapse: 'collapse', width: '100%' }}>
                <thead>
                    {/* Fila 1: a qué opción pertenecen las columnas ("Color"). */}
                    <tr>
                        <th style={{ ...celdaHead, borderBottom: 'none', position: 'sticky', left: 0 }} />
                        <th colSpan={opCols.opciones.length} scope="colgroup" style={{ ...celdaHead, borderBottom: 'none', color: 'var(--color-text)' }}>{opCols.nombre}</th>
                    </tr>
                    {/* Fila 2: la opción de las filas ("Talle") y los valores de las columnas. */}
                    <tr>
                        <th style={{ ...celdaHead, textAlign: 'left', paddingLeft: 12, color: 'var(--color-text)', position: 'sticky', left: 0 }} scope="col">{opFilas.nombre}</th>
                        {opCols.opciones.map(c => <th key={c} scope="col" style={{ ...celdaHead, minWidth: 72, fontWeight: 500 }}>{c}</th>)}
                    </tr>
                </thead>
                <tbody>
                    {opFilas.opciones.map((r, i) => (
                        <tr key={r}>
                            <th scope="row" style={{ padding: '4px 12px', fontSize: 12.5, fontWeight: 500, textAlign: 'left', color: 'var(--color-text)', fontFamily: '"Geist Mono", monospace', background: 'var(--color-bg)', borderBottom: i < opFilas.opciones.length - 1 ? '1px solid var(--color-border)' : 'none', position: 'sticky', left: 0, whiteSpace: 'nowrap' }}>{r}</th>
                            {opCols.opciones.map((c, j) => {
                                const f = porClave.get(claveDe(r, c))
                                return (
                                    <td key={c} style={{ padding: 4, borderBottom: i < opFilas.opciones.length - 1 ? '1px solid var(--color-border)' : 'none' }}>
                                        {f ? (
                                            <input
                                                className="ds-field"
                                                data-celda={`${i}-${j}`}
                                                inputMode="numeric"
                                                value={f.stock}
                                                disabled={!f.activa}
                                                title={f.activa ? undefined : 'No se ofrece — activala en "Precio y stock"'}
                                                aria-label={`Stock de ${f.clave}`}
                                                onChange={e => onStock(f.clave, e.target.value)}
                                                onFocus={e => e.target.select()}
                                                onKeyDown={e => teclas(e, i, j)}
                                                style={{ ...celdaGrande, textAlign: 'center', padding: '0 4px', opacity: f.activa ? 1 : 0.4, color: f.stock === '' || f.stock === '0' ? 'var(--color-subtle)' : 'var(--color-text)', fontWeight: f.stock === '' || f.stock === '0' ? 400 : 600 }}
                                            />
                                        ) : null}
                                    </td>
                                )
                            })}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    )
}

// Lo opcional, cerrado por defecto: la pantalla arranca corta y quien necesita
// etiquetas, ficha técnica, video o costo lo abre con un toque.
function Desplegable({ abierto, onToggle, titulo, resumen, children }: {
    abierto: boolean; onToggle: () => void; titulo: string; resumen?: string; children: ReactNode
}) {
    return (
        <section style={{ borderTop: '1px solid var(--color-border)' }}>
            <button
                type="button"
                className="ds-hover"
                onClick={onToggle}
                aria-expanded={abierto}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, width: '100%', padding: '16px 0', background: 'none', border: 'none', fontFamily: 'inherit', cursor: 'pointer', textAlign: 'left' }}
            >
                <span style={{ minWidth: 0 }}>
                    <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-text)' }}>{titulo}</span>
                    {resumen && <span style={{ fontSize: 12.5, color: 'var(--color-muted)', marginLeft: 8 }}>{resumen}</span>}
                </span>
                <ChevronDown size={16} style={{ color: 'var(--color-muted)', flexShrink: 0, transform: abierto ? 'rotate(180deg)' : 'none', transition: 'transform 150ms' }} />
            </button>
            {abierto && <div style={{ paddingTop: 4 }}>{children}</div>}
        </section>
    )
}

// Un grupo dentro de "Más detalles": título chico + ayuda en la misma línea.
function Bloque({ titulo, ayuda, derecha, children }: { titulo: string; ayuda?: string; derecha?: ReactNode; children?: ReactNode }) {
    return (
        <div style={{ marginBottom: 20 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
                <span>
                    <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text)' }}>{titulo}</span>
                    {ayuda && <span style={{ fontSize: 12, color: 'var(--color-muted)', marginLeft: 8 }}>{ayuda}</span>}
                </span>
                {derecha}
            </div>
            {children}
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

interface InputPrecioProps {
    value: string
    onChange: (value: string) => void
    placeholder?: string
    disabled?: boolean
    className?: string
    style?: React.CSSProperties
    mono?: boolean
    autoFocus?: boolean
    id?: string
}

function posicionarCursor(input: HTMLInputElement, nuevoTexto: string, digitosAntes: number) {
    if (!input) return
    if (digitosAntes <= 0) {
        input.setSelectionRange(0, 0)
        return
    }
    let vistos = 0
    let targetIndex = nuevoTexto.length
    for (let i = 0; i < nuevoTexto.length; i++) {
        if (/\d/.test(nuevoTexto[i])) {
            vistos++
            if (vistos === digitosAntes) {
                targetIndex = i + 1
                break
            }
        }
    }
    input.setSelectionRange(targetIndex, targetIndex)
}

function InputPrecio({
    value,
    onChange,
    placeholder,
    disabled,
    className,
    style,
    mono,
    autoFocus,
    id,
}: InputPrecioProps) {
    const displayValue = formatMiles(value)

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const input = e.target
        const rawVal = input.value
        const selectionStart = input.selectionStart ?? rawVal.length

        // Cantidad de dígitos antes de la posición del cursor en rawVal
        const digitosAntes = rawVal.slice(0, selectionStart).replace(/\D/g, '').length

        // Limpiar a solo dígitos numéricos eliminando ceros no significativos a la izquierda
        const digitos = rawVal.replace(/\D/g, '').replace(/^0+(?=\d)/, '')

        onChange(digitos)

        const nuevoFormateado = formatMiles(digitos)

        requestAnimationFrame(() => {
            if (!input) return
            posicionarCursor(input, nuevoFormateado, digitosAntes)
        })
    }

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        const input = e.currentTarget
        const { selectionStart, selectionEnd, value: val } = input
        if (selectionStart != null && selectionStart === selectionEnd) {
            if (e.key === 'Backspace' && selectionStart > 0 && val[selectionStart - 1] === '.') {
                e.preventDefault()
                // Borrar el dígito que está justo antes del punto
                const nuevoRaw = val.slice(0, selectionStart - 2) + val.slice(selectionStart)
                const digitos = nuevoRaw.replace(/\D/g, '').replace(/^0+(?=\d)/, '')
                const digitosAntes = val.slice(0, selectionStart - 2).replace(/\D/g, '').length
                onChange(digitos)
                requestAnimationFrame(() => {
                    if (!input) return
                    const nuevoFormateado = formatMiles(digitos)
                    posicionarCursor(input, nuevoFormateado, digitosAntes)
                })
            } else if (e.key === 'Delete' && selectionStart < val.length && val[selectionStart] === '.') {
                e.preventDefault()
                // Borrar el dígito que está justo después del punto
                const nuevoRaw = val.slice(0, selectionStart) + val.slice(selectionStart + 2)
                const digitos = nuevoRaw.replace(/\D/g, '').replace(/^0+(?=\d)/, '')
                const digitosAntes = val.slice(0, selectionStart).replace(/\D/g, '').length
                onChange(digitos)
                requestAnimationFrame(() => {
                    if (!input) return
                    const nuevoFormateado = formatMiles(digitos)
                    posicionarCursor(input, nuevoFormateado, digitosAntes)
                })
            }
        }
    }

    return (
        <input
            id={id}
            type="text"
            inputMode="numeric"
            className={className}
            value={displayValue}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            disabled={disabled}
            autoFocus={autoFocus}
            style={{
                fontFamily: mono ? '"Geist Mono", monospace' : 'inherit',
                ...style,
            }}
        />
    )
}

function PField({ label, value, onChange, placeholder, prefix, mono, h = 40, big, miles, error }: {
    label: ReactNode; value: string; onChange: (v: string) => void; placeholder?: string
    prefix?: string; mono?: boolean; h?: number; big?: boolean; miles?: boolean; error?: boolean
}) {
    return (
        <div>
            <label style={lbl}>{label}</label>
            <div className="ds-field" style={{ display: 'flex', alignItems: 'center', height: h, padding: '0 12px', background: 'var(--color-bg)', border: `1px solid ${error ? 'var(--color-error)' : 'var(--color-border)'}`, borderRadius: 8, gap: 6 }}>
                {prefix && <span style={{ color: 'var(--color-muted)', fontSize: big ? 18 : 14, fontFamily: '"Geist Mono", monospace' }}>{prefix}</span>}
                {miles ? (
                    <InputPrecio
                        value={value}
                        onChange={onChange}
                        placeholder={placeholder}
                        mono={mono}
                        style={{ flex: 1, height: '100%', border: 'none', outline: 'none', background: 'transparent', fontSize: big ? 18 : 14, fontWeight: big ? 600 : 400, color: 'var(--color-text)' }}
                    />
                ) : (
                    <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} style={{ flex: 1, height: '100%', border: 'none', outline: 'none', background: 'transparent', fontSize: big ? 18 : 14, fontWeight: big ? 600 : 400, color: 'var(--color-text)', fontFamily: mono ? '"Geist Mono", monospace' : 'inherit' }} />
                )}
            </div>
        </div>
    )
}

// Combobox con búsqueda para elegir categoría — reemplaza al <select> nativo,
// que con muchas categorías/subcategorías se vuelve tedioso de recorrer
// (listado plano larguísimo sin forma de filtrar). Mantiene la jerarquía
// (padre en negrita, hijas indentadas) pero permite escribir para filtrar.
function CategoriaSelect({ categorias, value, onChange, error }: {
    categorias: ApiCategory[]; value: string; onChange: (id: string) => void; error?: boolean
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
                className="ds-field"
                onClick={() => setOpen(o => !o)}
                style={{ ...inputBase, width: '100%', height: 40, padding: '0 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', textAlign: 'left', ...(error ? { borderColor: 'var(--color-error)' } : {}) }}
            >
                <span style={{ fontSize: 14, color: seleccionada ? 'var(--color-text)' : 'var(--color-subtle)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {seleccionada ? seleccionada.name : 'Elegí una categoría'}
                </span>
                <ChevronDown size={15} style={{ color: 'var(--color-muted)', flexShrink: 0, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 150ms' }} />
            </button>

            {open && (
                <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 4, background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 8, boxShadow: '0 8px 24px rgba(15,23,42,0.14)', zIndex: 20, maxHeight: 280, overflowY: 'auto' }}>
                    <div style={{ position: 'sticky', top: 0, background: 'var(--color-bg)', padding: 8, borderBottom: '1px solid var(--color-border)' }}>
                        <div className="ds-field" style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '0 8px', height: 34, border: '1px solid var(--color-border)', borderRadius: 6, background: 'var(--color-surface)' }}>
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
                                    className="ds-hover"
                                    onClick={() => elegir(padre.id)}
                                    style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 12px', background: value === padre.id ? 'var(--color-primary-bg)' : 'none', border: 'none', fontSize: 13.5, fontWeight: 600, color: 'var(--color-text)', fontFamily: 'inherit' }}
                                >
                                    {padre.name}
                                </button>
                            )}
                            {hijas.map(h => (
                                <button
                                    key={h.id}
                                    type="button"
                                    className="ds-hover"
                                    onClick={() => elegir(h.id)}
                                    style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 12px 8px 26px', background: value === h.id ? 'var(--color-primary-bg)' : 'none', border: 'none', fontSize: 13, color: 'var(--color-body)', fontFamily: 'inherit' }}
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

function OpInput({ tipo, onAdd }: { tipo: string; onAdd: (vals: string[]) => void }) {
    const [v, setV] = useState('')
    const t = tipo.toLowerCase()
    const ph = t.includes('talle') ? 'Otro, o pegá S, M, L' : t.includes('color') ? 'Otro color…' : 'Agregar otro…'
    // Acepta varios valores juntos, separados por coma, punto y coma o renglón
    // (una lista pegada de una planilla o de un mensaje).
    const commit = (texto: string) => {
        const vals = texto.split(/[,;\n]+/).map(x => x.trim()).filter(Boolean)
        if (vals.length > 0) { onAdd(vals); setV('') }
    }
    return (
        <input
            className="ds-field"
            value={v}
            onChange={e => { const nuevo = e.target.value; if (/[,;\n]/.test(nuevo)) commit(nuevo); else setV(nuevo) }}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); commit(v) } }}
            onBlur={() => commit(v)}
            placeholder={ph}
            aria-label={`Agregar valor de ${tipo || 'la opción'}`}
            style={{ ...inputBase, height: 28, width: 150, padding: '0 10px', fontSize: 12 }}
        />
    )
}

const pageWrap: React.CSSProperties = { padding: '24px 32px 64px', maxWidth: 1280, width: '100%', margin: '0 auto', boxSizing: 'border-box' }
const lbl: React.CSSProperties = { fontSize: 13, fontWeight: 500, color: 'var(--color-body)', marginBottom: 6, display: 'block' }
const inputBase: React.CSSProperties = { boxSizing: 'border-box', background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 8, color: 'var(--color-text)', fontFamily: 'inherit', outline: 'none' }
const iconBtn: React.CSSProperties = { width: 28, height: 28, borderRadius: 6, border: 'none', background: 'transparent', color: 'var(--color-muted)', cursor: 'pointer', display: 'grid', placeItems: 'center' }
const celda: React.CSSProperties = { ...inputBase, height: 28, padding: '0 8px', fontSize: 11, fontFamily: '"Geist Mono", monospace', width: '100%' }
const chip: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 5, height: 26, padding: '0 10px', borderRadius: 9999, background: 'var(--color-primary-bg)', color: 'var(--color-primary)', fontSize: 12, fontWeight: 500 }
const celdaGrande: React.CSSProperties = { ...celda, height: 34, fontSize: 13 }
// Acción de texto (sin caja): el color solo donde se clickea.
const enlace: React.CSSProperties = { background: 'none', border: 'none', padding: 0, color: 'var(--color-primary)', fontSize: 12.5, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 5 }
const chipX: React.CSSProperties = { background: 'none', border: 'none', borderRadius: 6, color: 'var(--color-primary)', cursor: 'pointer', display: 'grid', placeItems: 'center', padding: 0 }
// Algo sugerido que todavía no está puesto — mismo borde punteado que las
// etiquetas "Ya usaste" del paso 1, así se lee igual en todo el formulario.
const chipSugerido: React.CSSProperties = { height: 24, padding: '0 9px', borderRadius: 9999, border: '1px dashed var(--color-border)', background: 'transparent', color: 'var(--color-muted)', fontSize: 11.5, fontFamily: 'inherit', cursor: 'pointer' }
const btnSobreImg: React.CSSProperties = { position: 'absolute', top: 3, right: 3, width: 20, height: 20, borderRadius: 5, border: 'none', background: 'rgba(15,23,42,0.55)', color: '#fff', cursor: 'pointer', display: 'grid', placeItems: 'center', padding: 0 }
