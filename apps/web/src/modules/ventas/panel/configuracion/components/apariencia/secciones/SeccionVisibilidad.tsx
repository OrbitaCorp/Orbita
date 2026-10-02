import { Eye } from 'lucide-react'
import { OPCIONES_MAX_NUEVOS, type Apariencia as Ap } from '../../../mock/apariencia.mock'
import { AYUDA_SECCIONES, AYUDA_OPCIONES } from '../ayudas'
import { Divider, FieldLabel, SecCard, ToggleRow } from '../Controles'
import type { PropsSeccion } from '../utils'

const ESTANTES: [keyof Ap, string][] = [
    ['mostrarDestacados', 'Destacados'],
    ['mostrarNuevos', 'Nuevos ingresos'],
    ['mostrarRecomendados', 'Recomendados'],
    ['mostrarTopVentas', 'Top ventas'],
]

// "¿Qué ven tus clientes?": los interruptores de visibilidad (`toggles` los
// arma Apariencia.tsx, según haya o no una plantilla activa) y las filas de
// productos del inicio.
export function SeccionVisibilidad({ ap, set, soloContenido, toggles }: PropsSeccion & {
    soloContenido: boolean
    toggles: [keyof Ap, string][]
}) {
    return (
        <SecCard id="ap-sec-visibilidad" title={soloContenido ? 'Visibilidad' : '¿Qué ven tus clientes?'} icon={Eye} ayuda={AYUDA_SECCIONES[soloContenido ? 'visibilidadPlantilla' : 'visibilidad']}>
            <div className="ap-toggle-grid" style={{ display: 'grid', gridTemplateColumns: soloContenido ? '1fr' : '1fr 1fr', gap: '0 16px' }}>
                {toggles.map(([k, l]) => (
                    <ToggleRow key={k} label={l} on={ap[k] as boolean} onChange={v => set(k, v as Ap[typeof k])} ayuda={AYUDA_OPCIONES[k]} />
                ))}
            </div>
            {/* Los estantes de productos del home clásico (Ale, 19/09): cada
                uno muestra lo que dice su nombre, y cada uno se puede apagar.
                Con plantilla activa no aplican — las filas de productos las
                define la plantilla (pestaña Secciones). */}
            {!soloContenido && (
                <>
                    <Divider />
                    <FieldLabel help="Las filas de productos del inicio. Cada una se arma sola con datos reales; si no hay productos para mostrar, no aparece.">Filas de productos en el inicio</FieldLabel>
                    <div className="ap-toggle-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
                        {ESTANTES.map(([k, l]) => (
                            <ToggleRow key={k} label={l} on={ap[k] as boolean} onChange={v => set(k, v as Ap[typeof k])} ayuda={AYUDA_OPCIONES[k]} />
                        ))}
                    </div>
                    {ap.mostrarNuevos && (
                        <div style={{
                            marginTop: 14,
                            padding: '12px 14px',
                            borderRadius: 8,
                            background: 'var(--color-surface-alt)',
                            border: '1px solid var(--color-border)',
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, flexWrap: 'wrap', gap: 6 }}>
                                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text)' }}>
                                    Cantidad de productos en Nuevos ingresos
                                </span>
                                <span style={{ fontSize: 12, color: 'var(--color-muted)' }}>
                                    {ap.layoutGrid === '3col' ? 'Grilla de 3 columnas' : ap.layoutGrid === 'list' ? 'Diseño de lista' : 'Grilla de 4 columnas'}
                                </span>
                            </div>
                            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                {(OPCIONES_MAX_NUEVOS[ap.layoutGrid] ?? OPCIONES_MAX_NUEVOS['4col']).map(opt => {
                                    const opts = OPCIONES_MAX_NUEVOS[ap.layoutGrid] ?? OPCIONES_MAX_NUEVOS['4col']
                                    const valorActual = (ap.maxNuevosIngresos && opts.some(o => o.valor === ap.maxNuevosIngresos))
                                        ? ap.maxNuevosIngresos
                                        : opts[0].valor
                                    const activo = valorActual === opt.valor
                                    return (
                                        <button
                                            key={opt.valor}
                                            type="button"
                                            onClick={() => set('maxNuevosIngresos', opt.valor)}
                                            className="ds-hover"
                                            style={{
                                                padding: '6px 14px',
                                                borderRadius: 6,
                                                border: `1.5px solid ${activo ? 'var(--color-primary)' : 'var(--color-border)'}`,
                                                background: activo ? 'var(--color-primary-bg)' : 'var(--color-bg)',
                                                color: activo ? 'var(--color-primary)' : 'var(--color-text)',
                                                fontSize: 12,
                                                fontWeight: activo ? 600 : 500,
                                                cursor: 'pointer',
                                                fontFamily: 'inherit',
                                                transition: 'all 0.15s ease',
                                            }}
                                        >
                                            {opt.label}
                                        </button>
                                    )
                                })}
                            </div>
                            <p style={{ margin: '8px 0 0', fontSize: 11, color: 'var(--color-muted)', lineHeight: 1.4 }}>
                                {ap.layoutGrid === '3col'
                                    ? 'Opciones en múltiplos de 3 para asegurar filas completas en tu diseño de 3 columnas.'
                                    : ap.layoutGrid === 'list'
                                    ? 'Cantidad máxima de productos a listar en esta sección del inicio.'
                                    : 'Opciones en múltiplos de 4 para asegurar filas completas en tu diseño de 4 columnas.'}
                            </p>
                        </div>
                    )}
                </>
            )}
        </SecCard>
    )
}
