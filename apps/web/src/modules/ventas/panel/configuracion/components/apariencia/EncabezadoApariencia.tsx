// La cabecera de Apariencia: título, aviso de catálogo, estado de guardado y
// los botones de vista previa y guardar.

import { useState } from 'react'
import { useRouter } from 'next/router'
import { Check, ExternalLink, X } from 'lucide-react'
import { Button } from '@/design-system/components/Button'
import type { ApiCategory, ApiProductListItem } from '@/lib/api'
import { adminPath, currentSlug } from '@/lib/tenant'

// Umbral para el aviso "cargá tu catálogo" de más abajo — con menos que esto
// las grillas de productos/categorías de la vista previa se ven demasiado
// vacías o repetidas como para juzgar el diseño en serio, aunque ya no estén
// literalmente en cero.
const CATALOGO_PREVIEW_MIN = { productos: 10, categorias: 5 }

/* Header — en modo soloContenido, PlantillasConfig ya puso su
    propio título arriba; acá solo hace falta el estado de
    guardado + el botón, no duplicar el encabezado grande. */
export function EncabezadoApariencia({ soloContenido, errorCarga, categorias, productos, dirty, guardando, errorGuardado, onGuardar, onVistaPrevia }: {
    soloContenido: boolean
    errorCarga: string | null
    categorias: ApiCategory[]
    productos: ApiProductListItem[]
    dirty: boolean
    guardando: boolean
    errorGuardado: string | null
    onGuardar: () => void
    onVistaPrevia: () => void
}) {
    const router = useRouter()
    // Aviso "cargá tu catálogo antes de diseñar" — se puede cerrar y no
    // vuelve a aparecer en esta visita (se resetea solo al recargar la
    // pantalla, no queda guardado entre sesiones: si sigue sin catálogo la
    // próxima vez que entre, tiene sentido que lo vea de nuevo).
    const [avisoCatalogoCerrado, setAvisoCatalogoCerrado] = useState(false)

    return (
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: soloContenido ? 'flex-end' : 'space-between', gap: 16, flexWrap: 'wrap', marginBottom: soloContenido ? 16 : 24 }}>
            {!soloContenido && (
                <div>
                    <h1 style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--color-text)', margin: 0 }}>Apariencia pública</h1>
                    <div style={{ fontSize: 14, color: 'var(--color-muted)', marginTop: 4 }}>Construí la identidad visual de tu tienda. Los cambios se ven en vivo.</div>
                    {errorCarga && <div style={{ fontSize: 12, color: 'var(--color-error)', marginTop: 4 }}>{errorCarga} — se muestran valores por defecto.</div>}
                    {/* La vista previa de acá abajo es la tienda real embebida
                        (ver StorePreview.tsx) — con poco catálogo las
                        secciones que muestran productos/categorías (grillas,
                        destacados) se ven vacías o repetidas y el dueño no
                        puede juzgar cómo le queda el diseño. El umbral
                        (CATALOGO_PREVIEW_MIN) no es "cero": un par de
                        productos sueltos tampoco alcanza para una vista
                        previa representativa. Se avisa una sola vez, no en
                        cada carga: molesta menos que repetirlo siempre que
                        entra acá antes de completar su catálogo. */}
                    {!avisoCatalogoCerrado && (categorias.length < CATALOGO_PREVIEW_MIN.categorias || productos.length < CATALOGO_PREVIEW_MIN.productos) && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 10, padding: '10px 14px', borderRadius: 10, background: 'var(--color-warning-bg)', border: '1px solid rgba(245,158,11,0.25)', fontSize: 12.5, color: 'var(--color-body)' }}>
                            <span style={{ flex: 1 }}>
                                Para ver cómo queda tu diseño de verdad, cargá al menos {CATALOGO_PREVIEW_MIN.productos} productos y {CATALOGO_PREVIEW_MIN.categorias} categorías antes de personalizarlo — con poco catálogo, la vista previa no refleja cómo se va a ver.
                            </span>
                            <button
                                className="ds-link"
                                onClick={() => {
                                    const negocioId = currentSlug() ?? 'rama-tienda'
                                    void router.push(adminPath(negocioId, 'ventas', 'catalogo'))
                                }}
                                style={{ background: 'none', border: 'none', color: 'var(--color-primary)', fontSize: 12.5, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer', whiteSpace: 'nowrap', padding: 0 }}
                            >
                                Ir a Productos →
                            </button>
                            <button
                                onClick={() => setAvisoCatalogoCerrado(true)}
                                title="Cerrar aviso"
                                style={{ background: 'none', border: 'none', color: 'var(--color-muted)', cursor: 'pointer', padding: 0, display: 'grid', placeItems: 'center' }}
                            >
                                <X size={14} />
                            </button>
                        </div>
                    )}
                </div>
            )}
            {/* flexWrap acá: en mobile la fila (badge + 2 botones) no
                entra en una línea — antes se cortaba contra el borde de
                la pantalla en vez de bajar de línea. */}
            <div className="ap-header-actions" style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, height: 28, padding: '0 12px', borderRadius: 9999, fontSize: 12, fontWeight: 600, background: dirty ? 'var(--color-warning-bg)' : 'var(--color-success-bg)', color: dirty ? 'var(--color-warning)' : 'var(--color-success)', border: '1px solid var(--color-border)' }}>
                    {dirty
                        ? <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#F59E0B' }} />
                        : <Check size={12} strokeWidth={3} />}
                    {dirty ? 'Cambios sin guardar' : 'Publicado'}
                </span>
                {!soloContenido && <Button variant="outline" icon={<ExternalLink size={15} />} onClick={onVistaPrevia}>Ver vista previa de diseño</Button>}
                {/* En mobile se saca — la barra flotante de "Tenés cambios
                    sin guardar" de más abajo ya cubre el guardado sin
                    tener que volver arriba, este quedaba de más y era
                    parte de lo que desbordaba la fila. */}
                <span className="ap-save-header">
                    <Button variant="primary" disabled={!dirty} loading={guardando} onClick={onGuardar}>Guardar cambios</Button>
                </span>
                {errorGuardado && <div style={{ fontSize: 12, color: 'var(--color-error)' }}>{errorGuardado}</div>}
            </div>
        </div>
    )
}
