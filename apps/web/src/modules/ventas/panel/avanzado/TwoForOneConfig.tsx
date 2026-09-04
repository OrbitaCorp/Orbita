// src/modules/ventas/panel/avanzado/TwoForOneConfig.tsx — Configuración de
// "2x1 y 3x2" (paquete Avanzado, RBT-675).
//
// A diferencia de PromoModalConfig.tsx (puro anuncio de texto), esto SÍ crea/
// gestiona un Discount real: el formulario reusa ConfigLlevaXPagaY.tsx tal
// cual (mismo componente que el módulo de Descuentos ya tenía armado para el
// tipo BUY_X_PAY_Y, con su propio preview de ahorro y selector de producto/
// categoría) — acá arriba solo se agrega el esqueleto de pantalla "Avanzado"
// (mismo criterio que PromoModalConfig.tsx/JuegosConfig.tsx: toggle activo/
// inactivo, dirty-check contra un snapshot, Guardar deshabilitado sin
// cambios, Toast de éxito/error). Un solo 2x1 por negocio — no una lista de
// promos simultáneas, mismo MVP que el resto de Avanzado.
import { useEffect, useState } from 'react'
import { Tag, Info } from 'lucide-react'
import { Volver } from '../_shared/Volver'
import { Card } from '@/design-system/components/Card'
import { Button } from '@/design-system/components/Button'
import { Toast } from '@/design-system/components/Toast'
import { SkeletonText } from '@/design-system/components/Skeleton'
import { Toggle } from '../configuracion/components/ConfigControls'
import { ConfigLlevaXPagaY } from '../descuentos/components/ConfigLlevaXPagaY'
import type { AlcanceDescuento } from '../descuentos/types/descuentos'
import { ApiError, panelGetTwoForOne, panelUpsertTwoForOne, type ApiTwoForOnePromo } from '@/lib/api'
import { toastEsError } from '@/lib/utils'
import { currentSlug, tenantUrl } from '@/lib/tenant'

// El resto del panel (Descuentos) usa alcance en español ('producto'/
// 'categoria') — el backend de este endpoint puntual usa los mismos valores
// que el resto de discounts.service.ts ('PRODUCT'/'CATEGORY'). Se mapea acá,
// sin tocar ninguno de los dos lados.
const alcanceDesdeApi = (a: ApiTwoForOnePromo['alcance']): AlcanceDescuento => (a === 'CATEGORY' ? 'categoria' : 'producto')
const alcanceAApi = (a: AlcanceDescuento): ApiTwoForOnePromo['alcance'] => (a === 'categoria' ? 'CATEGORY' : 'PRODUCT')

type ConfigLocal = { isActive: boolean; llevaCantidad: number; pagaCantidad: number; alcance: ApiTwoForOnePromo['alcance']; productIds: string[]; categoryIds: string[] }

export default function TwoForOneConfig({ onVolver }: { onVolver: () => void }) {
    const [cargando, setCargando] = useState(true)
    const [guardando, setGuardando] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [toast, setToast] = useState<string | null>(null)

    const [activo, setActivo] = useState(false)
    const [llevaCantidad, setLlevaCantidad] = useState('')
    const [pagaCantidad, setPagaCantidad] = useState('')
    const [alcance, setAlcance] = useState<AlcanceDescuento>('categoria')
    const [productosIds, setProductosIds] = useState<string[]>([])
    const [categoriasIds, setCategoriasIds] = useState<string[]>([])

    // Snapshot de lo último cargado/guardado, en la MISMA forma que manda/
    // devuelve la API — mismo patrón que PromoModalConfig.tsx, comparado
    // contra comoApi() para saber si hay cambios sin guardar.
    const [original, setOriginal] = useState('')

    useEffect(() => {
        let cancelado = false
        panelGetTwoForOne()
            .then((p) => {
                if (cancelado) return
                if (p) {
                    setActivo(p.isActive)
                    setLlevaCantidad(String(p.llevaCantidad || ''))
                    setPagaCantidad(String(p.pagaCantidad || ''))
                    setAlcance(alcanceDesdeApi(p.alcance))
                    setProductosIds(p.productIds)
                    setCategoriasIds(p.categoryIds)
                    setOriginal(JSON.stringify(normalizar(p)))
                } else {
                    setOriginal(JSON.stringify(normalizar({ isActive: false, llevaCantidad: 0, pagaCantidad: 0, alcance: 'CATEGORY', productIds: [], categoryIds: [] })))
                }
            })
            .catch((e) => setError(e instanceof ApiError ? e.message : 'No se pudo cargar la configuración'))
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

    const llevaN = parseInt(llevaCantidad, 10) || 0
    const pagaN = parseInt(pagaCantidad, 10) || 0
    const seleccionOk = alcance === 'categoria' ? categoriasIds.length > 0 : productosIds.length > 0
    const cantidadesOk = llevaN >= 2 && pagaN >= 1 && pagaN < llevaN
    const valoresValidos = cantidadesOk && seleccionOk

    const comoApi = (): ConfigLocal => ({
        isActive: activo,
        llevaCantidad: llevaN,
        pagaCantidad: pagaN,
        alcance: alcanceAApi(alcance),
        productIds: alcance === 'producto' ? productosIds : [],
        categoryIds: alcance === 'categoria' ? categoriasIds : [],
    })
    const hayCambios = original !== '' && JSON.stringify(normalizar(comoApi())) !== original

    // Errores del form — mismo criterio que PromoModalConfig.tsx#vigenciaValida:
    // solo se muestran ante un estado CONFLICTIVO (algo cargado que no
    // cierra), nunca por campos todavía vacíos — un form recién abierto no
    // debería empezar en rojo. El botón Guardar ya queda deshabilitado
    // mientras falte completar algo.
    const errores: Record<string, string> = {}
    if (llevaCantidad !== '' && pagaCantidad !== '' && !cantidadesOk) {
        errores.cantidades = '"Pagá" tiene que ser menor a "Llevá" (y "Llevá" al menos 2) — si no, no hay descuento.'
    }
    if (cantidadesOk && !seleccionOk) {
        errores.seleccion = alcance === 'categoria' ? 'Elegí al menos una categoría.' : 'Elegí al menos un producto.'
    }

    async function guardar() {
        if (!valoresValidos || !hayCambios || guardando) return
        setGuardando(true)
        try {
            const payload = comoApi()
            const res = await panelUpsertTwoForOne(payload)
            setActivo(res.isActive)
            setLlevaCantidad(String(res.llevaCantidad))
            setPagaCantidad(String(res.pagaCantidad))
            setAlcance(alcanceDesdeApi(res.alcance))
            setProductosIds(res.productIds)
            setCategoriasIds(res.categoryIds)
            setOriginal(JSON.stringify(normalizar(res)))
            setToast('Configuración guardada')
        } catch (e) {
            setToast(e instanceof ApiError ? e.message : 'No se pudo guardar')
        } finally {
            setGuardando(false)
        }
    }

    const badgePreview = cantidadesOk ? `${llevaN}x${pagaN}` : null

    return (
        <div style={pageWrap}>
            <Volver a="Avanzado" onClick={onVolver} espacio="suelto" />
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 12, marginBottom: 6 }}>
                <div style={{ width: 40, height: 40, borderRadius: 10, flexShrink: 0, display: 'grid', placeItems: 'center', background: 'var(--color-primary-bg)' }}>
                    <Tag size={19} strokeWidth={1.8} color="var(--color-primary)" />
                </div>
                <h1 style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--color-text)', margin: 0 }}>2x1 y 3x2</h1>
            </div>
            <div style={{ fontSize: 14, color: 'var(--color-muted)', margin: '0 0 22px' }}>
                Una promo "llevá X, pagá Y" que se aplica sola en el carrito — sin que el cliente cargue ningún código — y aparece como cartel en la card del producto.
            </div>

            {error && (
                <div style={{ padding: '12px 16px', background: 'var(--color-error-bg)', border: '1px solid var(--color-border)', borderRadius: 10, marginBottom: 16, fontSize: 13, color: 'var(--color-error)' }}>
                    {error}
                </div>
            )}

            {cargando ? (
                <Card padding="md">
                    <SkeletonText width="30%" height={14} />
                    <SkeletonText width="100%" height={40} style={{ marginTop: 10 }} />
                    <SkeletonText width="100%" height={40} style={{ marginTop: 14 }} />
                </Card>
            ) : (
                <div className="two-for-one-cols" style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 300px', gap: 16, alignItems: 'start' }}>
                    <style>{`@media (max-width: 900px) { .two-for-one-cols { grid-template-columns: minmax(0,1fr) !important; } }`}</style>

                    {/* ── Columna principal: el formulario ── */}
                    <Card padding="md">
                        <ConfigLlevaXPagaY
                            llevaCantidad={llevaCantidad}
                            pagaCantidad={pagaCantidad}
                            alcance={alcance}
                            productosIds={productosIds}
                            categoriasIds={categoriasIds}
                            onChangeLleva={setLlevaCantidad}
                            onChangePaga={setPagaCantidad}
                            onChangeAlcance={setAlcance}
                            onChangeProductos={setProductosIds}
                            onChangeCategorias={setCategoriasIds}
                            errores={errores}
                        />

                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '20px 0 18px' }}>
                            <Toggle on={activo} onChange={setActivo} />
                            <div>
                                <div style={{ fontSize: 13.5, fontWeight: 500, color: 'var(--color-text)' }}>2x1 activo</div>
                                <div style={{ fontSize: 11.5, color: 'var(--color-muted)' }}>Con esto prendido, el descuento se aplica solo en el carrito y el cartel aparece en el catálogo.</div>
                            </div>
                        </div>
                        <DirtyHint show={hayCambios} />
                        <Button variant="primary" loading={guardando} disabled={!valoresValidos || !hayCambios} onClick={guardar}>Guardar</Button>
                    </Card>

                    {/* ── Sidebar: resumen ── */}
                    <Card padding="md">
                        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text)', marginBottom: 12 }}>Resumen</div>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                            <span style={{ fontSize: 12.5, color: 'var(--color-muted)' }}>Estado</span>
                            <span style={{
                                fontSize: 10.5, fontWeight: 700, borderRadius: 999, padding: '2px 9px',
                                color: activo ? 'var(--color-success)' : 'var(--color-muted)',
                                background: activo ? 'var(--color-success-bg)' : 'var(--color-surface-alt)',
                            }}>
                                {activo ? 'Activo' : 'Inactivo'}
                            </span>
                        </div>

                        <div style={{ fontSize: 12.5, color: 'var(--color-muted)', marginBottom: 8 }}>Así se va a ver el cartel en la card:</div>
                        <div style={{ marginBottom: 16 }}>
                            {badgePreview ? (
                                <span style={{
                                    display: 'inline-flex', alignItems: 'center', fontSize: 11, fontWeight: 700,
                                    borderRadius: 6, padding: '4px 10px', color: '#fff', background: 'var(--color-accent, #2563EB)',
                                }}>
                                    {badgePreview}
                                </span>
                            ) : (
                                <span style={{ fontSize: 12, color: 'var(--color-subtle)' }}>Cargá "Llevá" y "Pagá" para ver el cartel.</span>
                            )}
                        </div>

                        <div style={{ display: 'flex', gap: 8, padding: '10px 12px', borderRadius: 8, background: 'var(--color-surface)', border: '1px solid var(--color-border)', marginBottom: 14 }}>
                            <Info size={14} strokeWidth={1.8} color="var(--color-muted)" style={{ flexShrink: 0, marginTop: 1 }} />
                            <div style={{ fontSize: 11.5, color: 'var(--color-muted)', lineHeight: 1.5 }}>
                                Si con el alcance elegido hay productos de precios distintos, la unidad más barata es la que sale gratis.
                            </div>
                        </div>

                        {tiendaUrl && (
                            <a href={tiendaUrl} target="_blank" rel="noreferrer" style={linkVerTienda}>
                                Ver tu catálogo
                            </a>
                        )}
                    </Card>
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

// Normaliza el orden/forma de un ConfigLocal antes de compararlo con
// JSON.stringify — así el snapshot y el estado actual son comparables sin
// depender del orden en que cada uno arma sus keys.
function normalizar(c: { isActive: boolean; llevaCantidad: number; pagaCantidad: number; alcance: string; productIds: string[]; categoryIds: string[] }) {
    return {
        isActive: c.isActive,
        llevaCantidad: c.llevaCantidad,
        pagaCantidad: c.pagaCantidad,
        alcance: c.alcance,
        productIds: [...c.productIds].sort(),
        categoryIds: [...c.categoryIds].sort(),
    }
}

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

const pageWrap: React.CSSProperties = { padding: '24px 32px 64px', maxWidth: 1280, width: '100%', margin: '0 auto', boxSizing: 'border-box' }
const linkVerTienda: React.CSSProperties = {
    display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12.5, fontWeight: 600,
    color: 'var(--color-primary)', textDecoration: 'none',
}
