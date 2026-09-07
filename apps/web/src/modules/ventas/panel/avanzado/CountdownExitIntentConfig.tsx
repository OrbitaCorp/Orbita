// src/modules/ventas/panel/avanzado/CountdownExitIntentConfig.tsx —
// Configuración de "Countdown y exit-intent" (paquete Avanzado).
//
// Son DOS funcionalidades independientes que comparten pantalla porque
// comparten intención (apurar una decisión), igual que comparten una sola
// tarjeta en Avanzado.tsx. Cada pestaña guarda por su cuenta contra su propio
// endpoint: tocar Guardar en una nunca escribe la otra.
//
// El countdown tiene su propia fecha y su propio texto —no se deriva de
// Descuentos, como sí hacía una versión anterior que tomaba el descuento con
// "link compartible" más urgente: se descartó porque obligaba a inventar un
// descuento para poder anunciar "la promo termina el viernes"—, pero además
// PUEDE gestionar un `Discount` real, igual que el 2x1 y Juegos con premio.
// Con el descuento prendido, esa misma fecha es su vencimiento y aparece en el
// listado de Descuentos (ver CountdownAvanzadoCard.tsx, la tarjeta que lo
// anuncia desde allá). El aviso de salida, en cambio, sigue siendo texto libre
// como PromoModal. Ver el comentario de CountdownConfig en schema.prisma.
//
// Los dos previews son una maqueta aparte, no los componentes reales del
// storefront (CountdownBanner.tsx / ExitIntentModal.tsx): esos dependen de las
// variables de tema de la tienda, que en el panel no están montadas — mismo
// criterio que StorePreview.tsx en Apariencia.

import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { ArrowUpRight, Info, RotateCcw, Timer } from 'lucide-react'
import { Volver } from '../_shared/Volver'
import { Card } from '@/design-system/components/Card'
import { Button } from '@/design-system/components/Button'
import { Toast } from '@/design-system/components/Toast'
import { SkeletonText } from '@/design-system/components/Skeleton'
import { Toggle, CfgField } from '../configuracion/components/ConfigControls'
import { SelectorProductoOCategoria } from '../descuentos/components/SelectorProductoOCategoria'
import type { AlcanceDescuento } from '../descuentos/types'
import {
    ApiError, panelGetCountdown, panelUpsertCountdown, panelGetExitIntent, panelUpsertExitIntent, panelRelanzarExitIntent,
    type ApiCountdownConfig, type ApiExitIntentConfig,
} from '@/lib/api'
import { toastEsError } from '@/lib/utils'
import { adminPath, currentSlug, tenantUrl } from '@/lib/tenant'
import { useAhora } from '@/hooks/useAhora'

type Pestana = 'countdown' | 'salida'
type Placement = 'HOME' | 'ALL_PAGES'
type Frecuencia = 'ONCE_EVER' | 'ONCE_PER_DAY' | 'ALWAYS'
type TipoDescuento = 'PERCENT' | 'AMOUNT'

// El módulo de Descuentos habla en español ('producto'/'categoria') y la API en
// inglés — mismo par de traductores que TwoForOneConfig.tsx, para poder reusar
// SelectorProductoOCategoria tal cual.
const alcanceDesdeApi = (a: 'PRODUCT' | 'CATEGORY' | null): AlcanceDescuento => (a === 'PRODUCT' ? 'producto' : 'categoria')
const alcanceAApi = (a: AlcanceDescuento): 'PRODUCT' | 'CATEGORY' => (a === 'producto' ? 'PRODUCT' : 'CATEGORY')

// El <input type="datetime-local"> habla 'YYYY-MM-DDTHH:mm' en hora LOCAL,
// mientras que el backend guarda y devuelve ISO en UTC. Convertir con
// .toISOString().slice(0,16) sería el bug clásico: en Argentina (UTC-3) le
// mostraría al dueño la promo terminando tres horas antes de lo que cargó.
function isoALocal(iso: string): string {
    const d = new Date(iso)
    return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
}
function localAIso(local: string): string {
    return new Date(local).toISOString()
}

// Fecha por defecto la primera vez: dentro de una semana a las 23:59. Una
// cuenta regresiva que arranca vacía no se puede ni previsualizar.
function fechaSugerida(): string {
    const d = new Date()
    d.setDate(d.getDate() + 7)
    d.setHours(23, 59, 0, 0)
    return isoALocal(d.toISOString())
}

const SALIDA_VACIA = {
    title: '', message: '', badge: '', code: '', ctaText: '', ctaLink: '',
    frequency: 'ONCE_PER_DAY' as Frecuencia, minSeconds: 15, onMobile: true, isActive: false,
}

// Se abre desde dos lugares: Avanzado (su tarjeta de la grilla) y Descuentos
// (la tarjeta "Cuenta regresiva con descuento" arriba del listado, que es
// donde el dueño la va a buscar porque para él ES un descuento). `volverA`
// dice de cuál de los dos se vino, para que el "Volver" no mienta.
export default function CountdownExitIntentConfig({ onVolver, volverA = 'Avanzado' }: { onVolver: () => void; volverA?: string }) {
    const router = useRouter()
    const [pestana, setPestana] = useState<Pestana>('countdown')
    const [cargando, setCargando] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [toast, setToast] = useState<string | null>(null)

    // ── Countdown ────────────────────────────────────────────────────────────
    const [cTitulo, setCTitulo] = useState('')
    const [cBajada, setCBajada] = useState('')
    const [cFin, setCFin] = useState('')
    const [cFinalizado, setCFinalizado] = useState('')
    const [cCtaTexto, setCCtaTexto] = useState('')
    const [cCtaLink, setCCtaLink] = useState('')
    const [cLugar, setCLugar] = useState<Placement>('HOME')
    const [cActivo, setCActivo] = useState(false)
    // Descuento gestionado
    const [cConDescuento, setCConDescuento] = useState(false)
    const [cDescTipo, setCDescTipo] = useState<TipoDescuento>('PERCENT')
    const [cDescValor, setCDescValor] = useState('')
    const [cAlcance, setCAlcance] = useState<AlcanceDescuento>('categoria')
    const [cProductos, setCProductos] = useState<string[]>([])
    const [cCategorias, setCCategorias] = useState<string[]>([])
    // Sección de la portada con los productos en oferta y el reloj grande.
    const [cSeccionHome, setCSeccionHome] = useState(true)
    // Solo para linkear a la ficha del descuento en Descuentos — no es parte
    // del formulario, así que queda afuera del snapshot de cambios.
    const [cDiscountId, setCDiscountId] = useState<string | null>(null)
    const [cOriginal, setCOriginal] = useState('')
    const [cGuardando, setCGuardando] = useState(false)

    // ── Aviso de salida ──────────────────────────────────────────────────────
    const [sGuardado, setSGuardado] = useState<ApiExitIntentConfig | null>(null)
    const [sTitulo, setSTitulo] = useState('')
    const [sMensaje, setSMensaje] = useState('')
    const [sBadge, setSBadge] = useState('')
    const [sCodigo, setSCodigo] = useState('')
    const [sCtaTexto, setSCtaTexto] = useState('')
    const [sCtaLink, setSCtaLink] = useState('')
    const [sFrecuencia, setSFrecuencia] = useState<Frecuencia>('ONCE_PER_DAY')
    const [sSegundos, setSSegundos] = useState(15)
    const [sCelular, setSCelular] = useState(true)
    const [sActivo, setSActivo] = useState(false)
    const [sOriginal, setSOriginal] = useState('')
    const [sGuardandoEstado, setSGuardandoEstado] = useState(false)
    const [sRelanzando, setSRelanzando] = useState(false)

    function cargarCountdown(c: ApiCountdownConfig | null) {
        const v = c
            ? {
                title: c.title, subtitle: c.subtitle ?? '', endDate: isoALocal(c.endDate), finishedMessage: c.finishedMessage ?? '',
                ctaText: c.ctaText ?? '', ctaLink: c.ctaLink ?? '', placement: c.placement, isActive: c.isActive,
                conDescuento: c.conDescuento,
                descTipo: (c.descuentoTipo ?? 'PERCENT') as TipoDescuento,
                descValor: c.descuentoValor != null ? String(c.descuentoValor) : '',
                alcance: alcanceDesdeApi(c.descuentoAlcance),
                productIds: c.productIds, categoryIds: c.categoryIds,
                seccionHome: c.showProductsOnHome,
            }
            : {
                title: '', subtitle: '', endDate: fechaSugerida(), finishedMessage: '',
                ctaText: '', ctaLink: '', placement: 'HOME' as Placement, isActive: false,
                conDescuento: false, descTipo: 'PERCENT' as TipoDescuento, descValor: '',
                alcance: 'categoria' as AlcanceDescuento, productIds: [], categoryIds: [],
                // Prendida por default: quien se toma el trabajo de elegir a
                // qué productos aplica espera verlos en su tienda.
                seccionHome: true,
            }
        setCTitulo(v.title); setCBajada(v.subtitle); setCFin(v.endDate); setCFinalizado(v.finishedMessage)
        setCCtaTexto(v.ctaText); setCCtaLink(v.ctaLink); setCLugar(v.placement); setCActivo(v.isActive)
        setCConDescuento(v.conDescuento); setCDescTipo(v.descTipo); setCDescValor(v.descValor)
        setCAlcance(v.alcance); setCProductos(v.productIds); setCCategorias(v.categoryIds)
        setCSeccionHome(v.seccionHome); setCDiscountId(c?.discountId ?? null)
        setCOriginal(JSON.stringify(v))
    }

    function cargarSalida(s: ApiExitIntentConfig | null) {
        setSGuardado(s)
        const v = s
            ? {
                title: s.title, message: s.message ?? '', badge: s.badge ?? '', code: s.code ?? '',
                ctaText: s.ctaText ?? '', ctaLink: s.ctaLink ?? '', frequency: s.frequency,
                minSeconds: s.minSeconds, onMobile: s.onMobile, isActive: s.isActive,
            }
            : SALIDA_VACIA
        setSTitulo(v.title); setSMensaje(v.message); setSBadge(v.badge); setSCodigo(v.code)
        setSCtaTexto(v.ctaText); setSCtaLink(v.ctaLink); setSFrecuencia(v.frequency)
        setSSegundos(v.minSeconds); setSCelular(v.onMobile); setSActivo(v.isActive)
        setSOriginal(JSON.stringify(v))
    }

    useEffect(() => {
        let cancelado = false
        // Las dos configs se piden juntas: así cambiar de pestaña no dispara
        // una carga (y su skeleton) cada vez.
        Promise.all([panelGetCountdown(), panelGetExitIntent()])
            .then(([c, s]) => {
                if (cancelado) return
                cargarCountdown(c)
                cargarSalida(s)
            })
            .catch(e => { if (!cancelado) setError(e instanceof ApiError ? e.message : 'No se pudo cargar la configuración') })
            .finally(() => { if (!cancelado) setCargando(false) })
        return () => { cancelado = true }
    }, [])

    useEffect(() => {
        if (!toast) return
        const t = setTimeout(() => setToast(null), 3000)
        return () => clearTimeout(t)
    }, [toast])

    const slug = currentSlug()
    const tiendaUrl = slug ? tenantUrl(slug, '/') : null

    // El descuento que gestiona este módulo es un Discount de verdad y aparece
    // en el listado de Descuentos como cualquier otro — el link lo hace
    // explícito, para que el dueño no crea que vive en un lugar aparte.
    // Editarlo se sigue haciendo acá: allá es su ficha de solo lectura.
    function verEnDescuentos() {
        if (!cDiscountId) return
        const negocioId = slug ?? (router.query.negocioId as string) ?? 'rama-tienda'
        const moduloPadre = (router.query.moduloPadre as string) ?? 'ventas'
        router.push({ pathname: adminPath(negocioId, moduloPadre, 'descuentos'), query: { vista: 'detalle', id: cDiscountId } })
    }

    // ── Validación y cambios sin guardar ─────────────────────────────────────
    const cSnapshot = {
        title: cTitulo, subtitle: cBajada, endDate: cFin, finishedMessage: cFinalizado,
        ctaText: cCtaTexto, ctaLink: cCtaLink, placement: cLugar, isActive: cActivo,
        conDescuento: cConDescuento, descTipo: cDescTipo, descValor: cDescValor,
        alcance: cAlcance, productIds: cProductos, categoryIds: cCategorias,
        seccionHome: cSeccionHome,
    }
    const cHayCambios = cOriginal !== '' && JSON.stringify(cSnapshot) !== cOriginal
    // Cada 30s alcanza para "esta fecha ya pasó" mientras el dueño edita: es
    // un aviso del formulario, no un reloj. Date.now() no se puede llamar en el
    // render (regla de pureza de React) — ver useAhora.
    const ahora = useAhora(true, 30000)
    const cFinPasado = cFin !== '' && ahora !== null && new Date(cFin).getTime() <= ahora
    // Las dos mitades del campo "Termina el". Sin fecha no hay valor; sin hora
    // se asume el final del día, que es lo que casi siempre se quiere decir
    // con "termina el viernes".
    const cFinFecha = cFin.slice(0, 10)
    const cFinHora = cFin.slice(11, 16)
    const setFin = (fecha: string, hora: string) => setCFin(fecha ? `${fecha}T${hora || '23:59'}` : '')
    // El selector no ofrece fechas pasadas: `min` es hoy, y si la fecha elegida
    // es hoy, la hora tampoco baja de la actual. Si igual se tipea a mano una
    // fecha vieja, queda el aviso rojo de arriba y Guardar no se habilita.
    const hoyLocal = ahora !== null ? isoALocal(new Date(ahora).toISOString()) : ''
    const cFinMinFecha = hoyLocal.slice(0, 10)
    const cFinMinHora = cFinFecha !== '' && cFinFecha === cFinMinFecha ? hoyLocal.slice(11, 16) : undefined
    // La fecha vencida solo bloquea si además está prendido — mismo criterio
    // que el backend, así se puede dejar un borrador apagado, o volver a
    // entrar a editar una campaña que ya terminó.
    const cErrorFecha = cFin === ''
        ? 'Poné la fecha y la hora en la que termina'
        : (cActivo && cFinPasado ? 'Esa fecha ya pasó: para activarlo, poné una futura' : null)
    const cErrorLink = linkInvalido(cCtaLink)
        ? 'Tiene que ser una ruta de tu tienda, empezando con "/"'
        : (cCtaLink.trim() && !cCtaTexto.trim() ? 'Escribí el texto del botón' : null)
    // Las mismas reglas que valida el backend, para no mandar un PUT que ya
    // sabemos que va a volver con 400.
    const cValorNum = Number(cDescValor)
    const cErrorValor = !cConDescuento ? null
        : cDescValor.trim() === '' || Number.isNaN(cValorNum) ? 'Poné cuánto descuenta'
        : cDescTipo === 'PERCENT' && (cValorNum <= 0 || cValorNum > 100) ? 'El porcentaje va entre 1 y 100'
        : cValorNum <= 0 ? 'El monto tiene que ser mayor a 0'
        : null
    const cErrorSeleccion = !cConDescuento ? undefined
        : cAlcance === 'categoria'
            ? (cCategorias.length ? undefined : 'Elegí al menos una categoría.')
            : (cProductos.length ? undefined : 'Elegí al menos un producto.')
    const cValido = cTitulo.trim() !== '' && !cErrorFecha && !cErrorLink && !cErrorValor && !cErrorSeleccion

    const sSnapshot = { title: sTitulo, message: sMensaje, badge: sBadge, code: sCodigo, ctaText: sCtaTexto, ctaLink: sCtaLink, frequency: sFrecuencia, minSeconds: sSegundos, onMobile: sCelular, isActive: sActivo }
    const sHayCambios = sOriginal !== '' && JSON.stringify(sSnapshot) !== sOriginal
    const sErrorLink = linkInvalido(sCtaLink)
        ? 'Tiene que ser una ruta de tu tienda, empezando con "/"'
        : (sCtaLink.trim() && !sCtaTexto.trim() ? 'Escribí el texto del botón' : null)
    const sValido = sTitulo.trim() !== '' && !sErrorLink

    async function guardarCountdown() {
        if (!cValido || !cHayCambios || cGuardando) return
        setCGuardando(true)
        try {
            const r = await panelUpsertCountdown({
                title: cTitulo.trim(),
                subtitle: cBajada.trim() || undefined,
                endDate: localAIso(cFin),
                finishedMessage: cFinalizado.trim() || undefined,
                ctaText: cCtaTexto.trim() || undefined,
                ctaLink: cCtaLink.trim() || undefined,
                placement: cLugar,
                isActive: cActivo,
                conDescuento: cConDescuento,
                ...(cConDescuento
                    ? {
                        descuentoTipo: cDescTipo,
                        descuentoValor: cValorNum,
                        descuentoAlcance: alcanceAApi(cAlcance),
                        productIds: cAlcance === 'producto' ? cProductos : [],
                        categoryIds: cAlcance === 'categoria' ? cCategorias : [],
                        showProductsOnHome: cSeccionHome,
                    }
                    : {}),
            })
            cargarCountdown(r)
            setToast('Cuenta regresiva guardada')
        } catch (e) {
            setToast(e instanceof ApiError ? e.message : 'No se pudo guardar')
        } finally {
            setCGuardando(false)
        }
    }

    async function guardarSalida() {
        if (!sValido || !sHayCambios || sGuardandoEstado) return
        setSGuardandoEstado(true)
        try {
            const r = await panelUpsertExitIntent({
                title: sTitulo.trim(),
                message: sMensaje.trim() || undefined,
                badge: sBadge.trim() || undefined,
                code: sCodigo.trim() || undefined,
                ctaText: sCtaTexto.trim() || undefined,
                ctaLink: sCtaLink.trim() || undefined,
                frequency: sFrecuencia,
                minSeconds: sSegundos,
                onMobile: sCelular,
                isActive: sActivo,
            })
            cargarSalida(r)
            setToast('Aviso de salida guardado')
        } catch (e) {
            setToast(e instanceof ApiError ? e.message : 'No se pudo guardar')
        } finally {
            setSGuardandoEstado(false)
        }
    }

    async function relanzarSalida() {
        if (!sGuardado || sRelanzando) return
        setSRelanzando(true)
        try {
            const r = await panelRelanzarExitIntent()
            setSGuardado(r)
            setToast('Listo: el aviso vuelve a aparecerle a todo el mundo')
        } catch (e) {
            setToast(e instanceof ApiError ? e.message : 'No se pudo relanzar')
        } finally {
            setSRelanzando(false)
        }
    }

    return (
        <div className="panel-page">
            <style>{ESTILOS}</style>
            <Volver a={volverA} onClick={onVolver} espacio="suelto" />

            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 12, marginBottom: 6 }}>
                <div style={{ width: 40, height: 40, borderRadius: 10, flexShrink: 0, display: 'grid', placeItems: 'center', background: 'var(--color-primary-bg)' }}>
                    <Timer size={19} strokeWidth={1.8} color="var(--color-primary)" />
                </div>
                <h1 style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--color-text)', margin: 0 }}>Countdown y exit-intent</h1>
            </div>
            <div style={{ fontSize: 14, color: 'var(--color-muted)', margin: '0 0 18px', maxWidth: 720 }}>
                Dos formas de apurar una decisión: una cuenta regresiva con fecha límite, y un aviso para quien está por irse sin comprar. Se configuran y se prenden por separado.
            </div>

            <div role="tablist" aria-label="Qué configurar" className="ds-tira cei-tira">
                {([['countdown', 'Cuenta regresiva', cActivo], ['salida', 'Aviso de salida', sActivo]] as const).map(([id, label, prendido]) => {
                    const a = pestana === id
                    return (
                        <button
                            key={id} role="tab" aria-selected={a} onClick={() => setPestana(id)}
                            className="ds-tira-chip ds-hover" data-activa={a || undefined}
                            style={{
                                display: 'flex', alignItems: 'center', gap: 8, padding: '11px 16px', minHeight: 44, borderRadius: 8, border: 'none',
                                background: a ? 'var(--color-primary-bg)' : 'transparent', color: a ? 'var(--color-primary)' : 'var(--color-body)',
                                fontSize: 13, fontWeight: a ? 600 : 500, cursor: 'pointer', whiteSpace: 'nowrap', fontFamily: 'inherit',
                            }}
                        >
                            {label}
                            {/* Punto de "está prendido". El color solo no alcanza
                                para distinguirlo, por eso además lleva title. */}
                            <span
                                title={!cargando && prendido ? 'Activo en tu tienda' : 'Apagado'}
                                style={{ width: 7, height: 7, borderRadius: '50%', flexShrink: 0, background: !cargando && prendido ? 'var(--color-success)' : 'var(--color-border)' }}
                            />
                        </button>
                    )
                })}
            </div>

            {error && (
                <div style={{ padding: '12px 16px', background: 'var(--color-error-bg)', border: '1px solid var(--color-border)', borderRadius: 10, margin: '16px 0', fontSize: 13, color: 'var(--color-error)' }}>
                    {error}
                </div>
            )}

            {cargando ? (
                <Card padding="md" style={{ marginTop: 16 }}>
                    <SkeletonText width="30%" height={14} />
                    <SkeletonText width="100%" height={40} style={{ marginTop: 10 }} />
                    <SkeletonText width="100%" height={40} style={{ marginTop: 14 }} />
                </Card>
            ) : pestana === 'countdown' ? (
                <div className="cei-cols">
                    <Card padding="md">
                        <CfgField label="Título" value={cTitulo} onChange={setCTitulo} placeholder="Cyber Week" />
                        <CfgField label="Bajada (opcional)" value={cBajada} onChange={setCBajada} placeholder="Hasta 40% en toda la tienda" />

                        {/* Fecha y hora en dos campos, no un datetime-local:
                            el control combinado del navegador es chico, cambia
                            de forma según el sistema y obliga a tabular por
                            cada parte. Por dentro sigue siendo un solo valor
                            'YYYY-MM-DDTHH:mm' (cFin). */}
                        <CampoBase id="cei-fin" label="Termina el" error={cErrorFecha} hint={!cErrorFecha && cFin && ahora !== null ? faltaTexto(cFin, ahora) : undefined}>
                            <div className="cei-fin">
                                <label className="cei-fin-parte">
                                    <span className="cei-fin-etiqueta">Fecha</span>
                                    <input
                                        id="cei-fin" type="date" className="cei-input" min={cFinMinFecha || undefined}
                                        value={cFinFecha} onChange={e => setFin(e.target.value, cFinHora)} aria-invalid={!!cErrorFecha}
                                    />
                                </label>
                                <label className="cei-fin-parte cei-fin-parte--hora">
                                    <span className="cei-fin-etiqueta">Hora</span>
                                    <input
                                        id="cei-fin-hora" type="time" className="cei-input" min={cFinMinHora}
                                        value={cFinHora} onChange={e => setFin(cFinFecha, e.target.value)} aria-invalid={!!cErrorFecha}
                                    />
                                </label>
                            </div>
                        </CampoBase>

                        <CfgField label="Mensaje cuando termina (opcional)" value={cFinalizado} onChange={setCFinalizado} placeholder="¡Se terminó! Gracias a todos" />
                        <p className="cei-ayuda">Si lo dejás vacío, la cuenta regresiva desaparece sola al llegar a cero y no tenés que entrar a apagarla.</p>

                        <div className="cei-2col">
                            <CfgField label="Texto del botón (opcional)" value={cCtaTexto} onChange={setCCtaTexto} placeholder="Ver ofertas" />
                            <CampoLink id="cei-link-countdown" value={cCtaLink} onChange={setCCtaLink} error={cErrorLink} />
                        </div>

                        {/* ── Descuento real ──────────────────────────────
                            Lo que separa este módulo de un cartel: acá el
                            countdown puede crear y mantener un Discount de
                            verdad (mismo patrón que el 2x1). La fecha de fin de
                            arriba pasa a ser la del descuento, y es la que las
                            cards de producto muestran como "termina en 2d 4h".
                            Apagado, el módulo es solo el anuncio — sirve para
                            avisar de algo que ya existe por otro lado. */}
                        <fieldset className="cei-fieldset">
                            <legend className="cei-legend">El descuento</legend>
                            <label className="cei-opcion" data-elegida={cConDescuento || undefined} style={{ marginBottom: cConDescuento ? 12 : 0 }}>
                                <input
                                    type="checkbox" className="cei-radio" checked={cConDescuento}
                                    onChange={e => setCConDescuento(e.target.checked)}
                                />
                                <span>
                                    <span className="cei-opcion-titulo">Aplicar un descuento de verdad</span>
                                    <span className="cei-opcion-desc">
                                        Se crea solo en Descuentos y se aplica en el carrito, con esta misma fecha de fin. Sin esto, el cartel anuncia pero no descuenta nada.
                                    </span>
                                </span>
                            </label>

                            {cConDescuento && (
                                <div className="cei-descuento">
                                    <div className="cei-2col">
                                        <div style={{ marginBottom: 14 }}>
                                            <label className="cei-label" htmlFor="cei-desc-tipo">Tipo</label>
                                            <select
                                                id="cei-desc-tipo" className="cei-input"
                                                value={cDescTipo} onChange={e => setCDescTipo(e.target.value as TipoDescuento)}
                                            >
                                                <option value="PERCENT">Porcentaje (%)</option>
                                                <option value="AMOUNT">Monto fijo ($)</option>
                                            </select>
                                        </div>
                                        <CampoBase
                                            id="cei-desc-valor"
                                            label={cDescTipo === 'PERCENT' ? 'Cuánto descuenta (%)' : 'Cuánto descuenta ($)'}
                                            error={cErrorValor}
                                        >
                                            <input
                                                id="cei-desc-valor" type="number" inputMode="decimal" className="cei-input"
                                                min={cDescTipo === 'PERCENT' ? 1 : 0} max={cDescTipo === 'PERCENT' ? 100 : undefined}
                                                placeholder={cDescTipo === 'PERCENT' ? '40' : '5000'}
                                                value={cDescValor} onChange={e => setCDescValor(e.target.value)}
                                                aria-invalid={!!cErrorValor}
                                            />
                                        </CampoBase>
                                    </div>

                                    <SelectorProductoOCategoria
                                        alcance={cAlcance}
                                        productosIds={cProductos}
                                        categoriasIds={cCategorias}
                                        onChangeAlcance={setCAlcance}
                                        onChangeProductos={setCProductos}
                                        onChangeCategorias={setCCategorias}
                                        label="¿A qué productos se les aplica?"
                                        error={cErrorSeleccion}
                                    />

                                    {/* La sección de la portada. Va acá adentro
                                        y no como una opción más de "dónde se
                                        muestra" porque no compite con el banner:
                                        se pueden tener los dos, y sin descuento
                                        no existe (no habría productos que
                                        listar). */}
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 16 }}>
                                        <Toggle on={cSeccionHome} onChange={setCSeccionHome} />
                                        <div>
                                            <div style={{ fontSize: 13.5, fontWeight: 500, color: 'var(--color-text)' }}>Mostrar una sección en la portada</div>
                                            <div style={{ fontSize: 11.5, color: 'var(--color-muted)' }}>
                                                Arriba de &ldquo;Destacados&rdquo;, con el reloj grande —días, horas, minutos y segundos corriendo— y las tarjetas de los productos en oferta, ya con el precio descontado.
                                            </div>
                                        </div>
                                    </div>

                                    <div className="cei-aviso" style={{ marginTop: 16, marginBottom: 0 }}>
                                        <Info size={14} strokeWidth={1.8} color="var(--color-muted)" style={{ flexShrink: 0, marginTop: 1 }} />
                                        <div>
                                            Estos productos van a mostrar <strong>&ldquo;Termina en 2d 4h&rdquo;</strong> en su tarjeta del catálogo, con esta misma fecha. Al vencer, el descuento deja de aplicarse solo — no hay que apagarlo a mano.
                                            {cDiscountId && (
                                                <>
                                                    {' '}
                                                    <button type="button" className="cei-link-descuentos ds-link" onClick={verEnDescuentos}>
                                                        Ver su ficha en Descuentos <ArrowUpRight size={12} strokeWidth={2.2} />
                                                    </button>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </fieldset>

                        <fieldset className="cei-fieldset">
                            <legend className="cei-legend">Dónde se muestra</legend>
                            <div className="cei-opciones">
                                <OpcionRadio
                                    nombre="cei-lugar" valor="HOME" elegido={cLugar} onElegir={v => setCLugar(v as Placement)}
                                    titulo="Solo en la portada"
                                    desc="Un banner ancho debajo del hero. Es el más vistoso y no molesta mientras la persona recorre el catálogo."
                                />
                                <OpcionRadio
                                    nombre="cei-lugar" valor="ALL_PAGES" elegido={cLugar} onElegir={v => setCLugar(v as Placement)}
                                    titulo="En todas las páginas"
                                    desc="Una tira finita debajo del encabezado, en toda la tienda. Acompaña hasta el checkout, pero ocupa lugar siempre."
                                />
                            </div>
                        </fieldset>

                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '18px 0' }}>
                            <Toggle on={cActivo} onChange={setCActivo} />
                            <div>
                                <div style={{ fontSize: 13.5, fontWeight: 500, color: 'var(--color-text)' }}>Cuenta regresiva activa</div>
                                <div style={{ fontSize: 11.5, color: 'var(--color-muted)' }}>Con esto prendido, la ve cualquiera que entre a tu tienda.</div>
                            </div>
                        </div>

                        <DirtyHint show={cHayCambios} />
                        <Button variant="primary" loading={cGuardando} disabled={!cValido || !cHayCambios} onClick={guardarCountdown}>Guardar</Button>
                    </Card>

                    <div className="cei-lateral">
                        <Card padding="md">
                            <div className="cei-lateral-titulo">Así se ve</div>
                            <PreviewCountdown titulo={cTitulo} bajada={cBajada} fin={cFin} finalizado={cFinalizado} cta={cCtaTexto} compacto={cLugar === 'ALL_PAGES'} />
                            <div className="cei-nota">Es una maqueta: en tu tienda toma los colores que tengas configurados en Apariencia.</div>
                            {tiendaUrl && (
                                <a href={tiendaUrl} target="_blank" rel="noreferrer" className="cei-link-tienda">
                                    Ver en tu tienda <ArrowUpRight size={13} strokeWidth={2.2} />
                                </a>
                            )}
                        </Card>
                    </div>
                </div>
            ) : (
                <div className="cei-cols">
                    <Card padding="md">
                        <CfgField label="Título" value={sTitulo} onChange={setSTitulo} placeholder="¿Te vas sin llevarlo?" />
                        <CfgField label="Mensaje (opcional)" value={sMensaje} onChange={setSMensaje} area placeholder="Llevate un 10% con este código, solo por hoy." />
                        <div className="cei-2col">
                            <CfgField label="Etiqueta (opcional)" value={sBadge} onChange={setSBadge} placeholder="ESPERÁ" />
                            <CfgField label="Código a mostrar (opcional)" value={sCodigo} onChange={setSCodigo} placeholder="VOLVE10" />
                        </div>
                        <div className="cei-2col">
                            <CfgField label="Texto del botón (opcional)" value={sCtaTexto} onChange={setSCtaTexto} placeholder="Seguir comprando" />
                            <CampoLink id="cei-link-salida" value={sCtaLink} onChange={setSCtaLink} error={sErrorLink} />
                        </div>

                        <div className="cei-aviso">
                            <Info size={14} strokeWidth={1.8} color="var(--color-muted)" style={{ flexShrink: 0, marginTop: 1 }} />
                            <div>Es un anuncio: el mensaje y el código son texto libre, no se validan contra nada. Si prometés un código, crealo de verdad en Descuentos.</div>
                        </div>

                        <fieldset className="cei-fieldset">
                            <legend className="cei-legend">Cada cuánto puede aparecerle a la misma persona</legend>
                            <div className="cei-opciones">
                                <OpcionRadio nombre="cei-frec" valor="ONCE_EVER" elegido={sFrecuencia} onElegir={v => setSFrecuencia(v as Frecuencia)}
                                    titulo="Una sola vez" desc="Lo más prudente: si ya lo vio y lo cerró, no vuelve a verlo nunca." />
                                <OpcionRadio nombre="cei-frec" valor="ONCE_PER_DAY" elegido={sFrecuencia} onElegir={v => setSFrecuencia(v as Frecuencia)}
                                    titulo="Una vez por día" desc="Vuelve a aparecer al día siguiente. Equilibrio razonable para una promo que dura varios días." />
                                <OpcionRadio nombre="cei-frec" valor="ALWAYS" elegido={sFrecuencia} onElegir={v => setSFrecuencia(v as Frecuencia)}
                                    titulo="Siempre" desc="Cada vez que amaga con irse. Es el que más molesta: usalo solo en una promo muy corta." />
                            </div>
                        </fieldset>

                        <div style={{ marginBottom: 16 }}>
                            <label htmlFor="cei-seg" style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-body)', marginBottom: 8, display: 'block' }}>
                                Esperar al menos <strong style={{ color: 'var(--color-text)' }}>{sSegundos} segundos</strong> antes de poder mostrarlo
                            </label>
                            <input
                                id="cei-seg" type="range" min={0} max={120} step={5} value={sSegundos}
                                onChange={e => setSSegundos(Number(e.target.value))} className="cei-slider"
                            />
                            <div style={{ fontSize: 11.5, color: 'var(--color-muted)', marginTop: 5, lineHeight: 1.5 }}>
                                Sin esta espera, a alguien que entra y lleva el mouse a la barra del navegador le salta el cartel a los dos segundos, sin haber visto nada de la tienda.
                            </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '4px 0 18px' }}>
                            <Toggle on={sCelular} onChange={setSCelular} />
                            <div>
                                <div style={{ fontSize: 13.5, fontWeight: 500, color: 'var(--color-text)' }}>Mostrarlo también en celular</div>
                                <div style={{ fontSize: 11.5, color: 'var(--color-muted)' }}>En el celular no existe &ldquo;el mouse se fue de la pantalla&rdquo;: ahí se dispara cuando la persona hace un scroll rápido hacia arriba, de vuelta hacia la barra del navegador.</div>
                            </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '4px 0 18px' }}>
                            <Toggle on={sActivo} onChange={setSActivo} />
                            <div>
                                <div style={{ fontSize: 13.5, fontWeight: 500, color: 'var(--color-text)' }}>Aviso activo</div>
                                <div style={{ fontSize: 11.5, color: 'var(--color-muted)' }}>Con esto prendido, puede aparecer en cualquier página de tu tienda.</div>
                            </div>
                        </div>

                        <DirtyHint show={sHayCambios} />
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                            <Button variant="primary" loading={sGuardandoEstado} disabled={!sValido || !sHayCambios} onClick={guardarSalida}>Guardar</Button>
                            <Button variant="secondary" loading={sRelanzando} disabled={!sGuardado} onClick={relanzarSalida}>
                                <RotateCcw size={13} strokeWidth={2} style={{ marginRight: 6 }} />
                                Mostrar de nuevo
                            </Button>
                            <InfoTooltip texto="Empieza una campaña nueva: el aviso le vuelve a aparecer a todo el mundo, incluso a quien ya lo había cerrado. No cambia nada más de la configuración." />
                        </div>
                    </Card>

                    <div className="cei-lateral">
                        <Card padding="md">
                            <div className="cei-lateral-titulo">Así se ve</div>
                            <PreviewSalida titulo={sTitulo} mensaje={sMensaje} badge={sBadge} codigo={sCodigo} cta={sCtaTexto} />
                            <div className="cei-nota">Es una maqueta: en tu tienda toma los colores que tengas configurados en Apariencia.</div>
                            {tiendaUrl && (
                                <a href={tiendaUrl} target="_blank" rel="noreferrer" className="cei-link-tienda">
                                    Ver en tu tienda <ArrowUpRight size={13} strokeWidth={2.2} />
                                </a>
                            )}
                        </Card>
                    </div>
                </div>
            )}

            {toast && (
                <div style={{ position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', zIndex: 9000 }}>
                    <Toast variant={toastEsError(toast) ? 'error' : 'success'} title={toast} onClose={() => setToast(null)} />
                </div>
            )}
        </div>
    )
}

// ─── Validación espejo de la del backend ──────────────────────────────────────
// Mismo criterio que normalizarLinkDeTienda() en la API: solo rutas de la
// propia tienda. "//otro.com" empieza con "/" pero el navegador lo resuelve
// como dominio externo, así que se rechaza aparte.
function linkInvalido(link: string): boolean {
    const l = link.trim()
    if (!l) return false
    return !l.startsWith('/') || l.startsWith('//')
}

function faltaTexto(local: string, ahora: number): string {
    const ms = new Date(local).getTime() - ahora
    if (ms <= 0) return 'Ya pasó'
    const min = Math.floor(ms / 60000)
    if (min < 60) return `Faltan ${min} minutos`
    const hs = Math.floor(min / 60)
    if (hs < 48) return `Faltan ${hs} horas`
    return `Faltan ${Math.floor(hs / 24)} días`
}

// ─── Campos ───────────────────────────────────────────────────────────────────
// Mismo aspecto que CfgField (ConfigControls.tsx), pero con un <label for>
// atado al input y con lugar para un error debajo. CfgField no soporta ni
// `type` ni mensajes de error, y no vale la pena tocarlo desde acá porque lo
// usan un montón de pantallas de Configuración.
function CampoBase({ id, label, error, hint, children }: { id: string; label: string; error?: string | null; hint?: string; children: React.ReactNode }) {
    return (
        <div style={{ marginBottom: 14 }}>
            <label htmlFor={id} style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-body)', marginBottom: 6, display: 'block' }}>{label}</label>
            {children}
            {error
                ? <div role="alert" style={{ fontSize: 11.5, color: 'var(--color-error)', marginTop: 5 }}>{error}</div>
                : hint ? <div style={{ fontSize: 11.5, color: 'var(--color-muted)', marginTop: 5 }}>{hint}</div> : null}
        </div>
    )
}

function CampoLink({ id, value, onChange, error }: { id: string; value: string; onChange: (v: string) => void; error?: string | null }) {
    return (
        <CampoBase id={id} label="Link del botón (opcional)" error={error} hint="Una ruta de tu tienda: /catalogo">
            <input
                id={id} className="cei-input" placeholder="/catalogo"
                value={value} onChange={e => onChange(e.target.value)} aria-invalid={!!error}
            />
        </CampoBase>
    )
}

function OpcionRadio({ nombre, valor, elegido, onElegir, titulo, desc }: { nombre: string; valor: string; elegido: string; onElegir: (v: string) => void; titulo: string; desc: string }) {
    const a = elegido === valor
    return (
        <label className="cei-opcion" data-elegida={a || undefined}>
            <input type="radio" name={nombre} value={valor} checked={a} onChange={() => onElegir(valor)} className="cei-radio" />
            <span>
                <span className="cei-opcion-titulo">{titulo}</span>
                <span className="cei-opcion-desc">{desc}</span>
            </span>
        </label>
    )
}

// ─── Previews ─────────────────────────────────────────────────────────────────
// Maqueta, no el componente real del storefront — ver el comentario del
// archivo. El reloj tictaquea de verdad: es lo que hace entender de un vistazo
// qué se va a mostrar.
function PreviewCountdown({ titulo, bajada, fin, finalizado, cta, compacto }: { titulo: string; bajada: string; fin: string; finalizado: string; cta: string; compacto: boolean }) {
    const finMs = fin ? new Date(fin).getTime() : undefined
    const ahora = useAhora(true, 1000, finMs)

    // Sin el primer "ahora" todavía no se sabe si terminó: dibujar algo acá
    // haría parpadear el estado "ya terminó" por un frame.
    if (ahora === null) return null

    const ms = fin ? new Date(fin).getTime() - ahora : 0
    if (!fin || ms <= 0) {
        return (
            <div className="cei-preview">
                <div className="cei-banner" data-compacto={compacto || undefined}>
                    <span className="cei-banner-txt">{finalizado.trim() || 'Al llegar a cero, sin mensaje de cierre, no se muestra nada.'}</span>
                </div>
            </div>
        )
    }

    const t = partesRestantes(ms)
    return (
        <div className="cei-preview">
            <div className="cei-banner" data-compacto={compacto || undefined}>
                <span className="cei-banner-txt">
                    <strong>{titulo.trim() || 'Tu título acá'}</strong>
                    {!compacto && bajada.trim() && <span className="cei-banner-sub">{bajada}</span>}
                </span>
                <span className="cei-reloj">
                    {t.dias > 0 && <><b>{dosDigitos(t.dias)}</b>d</>}
                    <b>{dosDigitos(t.horas)}</b>h<b>{dosDigitos(t.min)}</b>m<b>{dosDigitos(t.seg)}</b>s
                </span>
                {cta.trim() && <span className="cei-banner-cta">{cta}</span>}
            </div>
        </div>
    )
}

function PreviewSalida({ titulo, mensaje, badge, codigo, cta }: { titulo: string; mensaje: string; badge: string; codigo: string; cta: string }) {
    return (
        <div className="cei-preview cei-preview--modal">
            <div className="cei-modal">
                {badge.trim() && <span className="cei-modal-badge">{badge}</span>}
                <div className="cei-modal-titulo">{titulo.trim() || 'Tu título acá'}</div>
                {mensaje.trim() && <div className="cei-modal-msg">{mensaje}</div>}
                {codigo.trim() && <div className="cei-modal-codigo">{codigo}</div>}
                {cta.trim() && <div className="cei-modal-cta">{cta}</div>}
            </div>
        </div>
    )
}

function partesRestantes(ms: number) {
    const seg = Math.floor(ms / 1000)
    return { dias: Math.floor(seg / 86400), horas: Math.floor((seg % 86400) / 3600), min: Math.floor((seg % 3600) / 60), seg: seg % 60 }
}
const dosDigitos = (n: number) => String(n).padStart(2, '0')

// ─── Piezas menores ───────────────────────────────────────────────────────────
// Mismo aviso que PromoModalConfig.tsx/JuegosConfig.tsx#DirtyHint.
function DirtyHint({ show }: { show: boolean }) {
    if (!show) return null
    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, fontWeight: 500, color: 'var(--color-warning)', marginBottom: 10 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#F59E0B', flexShrink: 0 }} />
            Tenés cambios sin guardar
        </div>
    )
}

// Mismo patrón que PromoModalConfig.tsx#InfoTooltip.
function InfoTooltip({ texto }: { texto: string }) {
    const [abierto, setAbierto] = useState(false)
    return (
        <span style={{ position: 'relative', display: 'inline-flex' }}>
            <button
                type="button"
                onClick={() => setAbierto(a => !a)}
                onMouseEnter={() => setAbierto(true)}
                onMouseLeave={() => setAbierto(false)}
                onBlur={() => setAbierto(false)}
                aria-label="Qué hace el botón Mostrar de nuevo"
                style={{
                    width: 18, height: 18, borderRadius: '50%', border: '1px solid var(--color-border)',
                    background: 'var(--color-surface-alt)', color: 'var(--color-muted)', display: 'grid', placeItems: 'center',
                    cursor: 'pointer', padding: 0, fontFamily: 'inherit', flexShrink: 0,
                }}
            >
                <Info size={11} strokeWidth={2.2} />
            </button>
            {abierto && (
                <div role="tooltip" style={{
                    position: 'absolute', bottom: 'calc(100% + 8px)', left: '50%', transform: 'translateX(-50%)',
                    width: 230, padding: '9px 11px', borderRadius: 8, background: 'var(--color-text)', color: 'var(--color-bg)',
                    fontSize: 11.5, lineHeight: 1.55, boxShadow: '0 10px 24px rgba(0,0,0,0.2)', zIndex: 20,
                }}>
                    {texto}
                </div>
            )}
        </span>
    )
}

// Acá vive todo lo que necesita media queries, :hover o selectores de estado;
// el resto sigue inline como en el resto del panel.
const ESTILOS = `
.cei-link-descuentos {
    display: inline-flex; align-items: center; gap: 3px; vertical-align: baseline;
    background: none; border: none; padding: 0; cursor: pointer;
    font-family: inherit; font-size: inherit; font-weight: 600; color: var(--color-primary);
}

.cei-tira { display: flex; gap: 2px; padding: 6px 8px; background: var(--color-bg); border: 1px solid var(--color-border); border-radius: 12px; overflow-x: auto; }
.cei-cols { display: grid; grid-template-columns: minmax(0,1fr) 340px; gap: 16px; align-items: start; margin-top: 16px; }
.cei-2col { display: grid; grid-template-columns: minmax(0,1fr) minmax(0,1fr); gap: 14px; }
.cei-ayuda { font-size: 11.5px; color: var(--color-muted); line-height: 1.5; margin: -8px 0 16px; }
.cei-input { width: 100%; box-sizing: border-box; height: 40px; padding: 0 12px; background: var(--color-bg); border: 1px solid var(--color-border); border-radius: 8px; font-size: 14px; color: var(--color-text); font-family: inherit; outline: none; }
.cei-input:focus-visible { border-color: var(--color-primary); }
.cei-fin { display: flex; gap: 10px; }
.cei-fin-parte { display: flex; flex-direction: column; gap: 4px; flex: 1; min-width: 0; }
.cei-fin-parte--hora { flex: 0 0 150px; }
.cei-fin-etiqueta { font-size: 11.5px; font-weight: 500; color: var(--color-muted); }
.cei-input[aria-invalid="true"] { border-color: var(--color-error); }

.cei-fieldset { border: none; padding: 0; margin: 6px 0 18px; min-width: 0; }
.cei-legend { font-size: 13px; font-weight: 600; color: var(--color-text); padding: 0; margin-bottom: 8px; }
.cei-opciones { display: flex; flex-direction: column; gap: 8px; }
.cei-opcion { display: flex; align-items: flex-start; gap: 10px; padding: 11px 13px; border: 1px solid var(--color-border); border-radius: 10px; cursor: pointer; background: var(--color-bg); transition: border-color 180ms ease, background-color 180ms ease; }
.cei-opcion:hover { border-color: var(--color-primary); }
.cei-opcion[data-elegida] { border-color: var(--color-primary); background: var(--color-primary-bg); }
.cei-opcion:focus-within { outline: 2px solid var(--color-primary); outline-offset: 2px; }
.cei-radio { margin: 2px 0 0; width: 16px; height: 16px; flex-shrink: 0; accent-color: var(--color-primary); cursor: pointer; }
.cei-opcion-titulo { display: block; font-size: 13.5px; font-weight: 600; color: var(--color-text); }
.cei-opcion-desc { display: block; font-size: 11.5px; color: var(--color-muted); line-height: 1.5; margin-top: 2px; }

.cei-slider { width: 100%; accent-color: var(--color-primary); height: 24px; cursor: pointer; }

.cei-label { font-size: 13px; font-weight: 500; color: var(--color-body); margin-bottom: 6px; display: block; }
/* Sangrado + borde a la izquierda: deja claro de un vistazo que todo esto
   cuelga del checkbox de arriba y desaparece si lo apagás. */
.cei-descuento { margin-top: 12px; padding-left: 14px; border-left: 2px solid var(--color-primary-bg); }

.cei-lateral-titulo { font-size: 13px; font-weight: 600; color: var(--color-text); margin-bottom: 12px; }
.cei-link-tienda { display: inline-flex; align-items: center; gap: 5px; font-size: 12.5px; font-weight: 600; color: var(--color-primary); text-decoration: none; }
.cei-nota { font-size: 11.5px; color: var(--color-subtle); line-height: 1.5; margin: 10px 0 12px; }
.cei-aviso { display: flex; gap: 8px; padding: 10px 12px; border-radius: 8px; background: var(--color-surface); border: 1px solid var(--color-border); margin-bottom: 16px; font-size: 11.5px; color: var(--color-muted); line-height: 1.5; }

/* El preview imita el fondo de la tienda, no el del panel, para que se lea
   como "esto pasa allá" y no como un componente más de esta pantalla. */
.cei-preview { background: var(--color-surface-alt); border: 1px solid var(--color-border); border-radius: 10px; padding: 14px 12px; overflow: hidden; }
.cei-preview--modal { display: grid; place-items: center; padding: 20px 12px; }
/* color-on-primary y no #fff: en el tema oscuro del panel el primario es un
   celeste claro, y el texto blanco encima quedaba ilegible (1.7:1). Es el
   mismo token que usa Button.tsx para su variante primaria. */
.cei-banner { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; padding: 12px 14px; border-radius: 12px; background: linear-gradient(90deg, var(--color-primary-h), var(--color-primary)); color: var(--color-on-primary); }
.cei-banner[data-compacto] { padding: 8px 12px; border-radius: 8px; }
.cei-banner-txt { flex: 1; min-width: 110px; font-size: 12.5px; line-height: 1.35; }
.cei-banner-sub { display: block; font-size: 11px; opacity: 0.85; margin-top: 2px; font-weight: 400; }
.cei-reloj { display: inline-flex; align-items: baseline; gap: 1px; font-family: "Geist Mono", monospace; font-size: 10.5px; opacity: 0.92; }
.cei-reloj b { font-size: 14px; margin-left: 3px; }
.cei-banner-cta { font-size: 11.5px; font-weight: 700; padding: 5px 10px; border-radius: 999px; background: color-mix(in srgb, var(--color-on-primary) 16%, transparent); white-space: nowrap; }

.cei-modal { width: 100%; max-width: 250px; background: var(--color-bg); border: 1px solid var(--color-border); border-radius: 14px; padding: 18px 16px; text-align: center; box-shadow: 0 12px 28px rgba(0,0,0,0.12); }
.cei-modal-badge { display: inline-block; font-size: 10px; font-weight: 800; letter-spacing: 0.06em; padding: 3px 9px; border-radius: 999px; background: var(--color-primary-bg); color: var(--color-primary); margin-bottom: 8px; }
.cei-modal-titulo { font-size: 15px; font-weight: 700; color: var(--color-text); line-height: 1.3; }
.cei-modal-msg { font-size: 12px; color: var(--color-muted); line-height: 1.5; margin-top: 6px; }
.cei-modal-codigo { display: inline-block; margin-top: 10px; padding: 6px 12px; border-radius: 8px; border: 1px dashed var(--color-primary); color: var(--color-primary); font-family: "Geist Mono", monospace; font-size: 12.5px; font-weight: 700; }
.cei-modal-cta { margin-top: 12px; padding: 9px 14px; border-radius: 9px; background: var(--color-primary); color: var(--color-on-primary); font-size: 12.5px; font-weight: 600; }

/* Con el preview al lado, el formulario queda en ~380px y los dos campos por
   fila salen más angostos que su propio placeholder. Primero se baja el
   preview, después se apilan los campos. */
@media (max-width: 1080px) {
  .cei-cols { grid-template-columns: minmax(0,1fr); }
  .cei-lateral { order: -1; }
}
@media (max-width: 768px) {
  .cei-2col { grid-template-columns: minmax(0,1fr); gap: 12px; }
  /* A 390px las dos mitades no entran a lo ancho con letra legible. */
  .cei-fin { flex-direction: column; }
  .cei-fin-parte--hora { flex: 1; }
  /* 16px para que Safari no haga zoom al enfocar — mismo criterio que el
     reset global del panel. */
  .cei-input { font-size: 16px; }
}
`
