import { Card } from '@/design-system/components/Card'
import { Button } from '@/design-system/components/Button'
import { CfgField } from '../ConfigControls'
import { DirtyHint, ErrorInline, SectionTitle } from './comunes'
import { CARRIER_META } from './constantes'
import type { ConfigGeneralState } from './useConfigGeneral'

export function SeccionEnvios({ cfg }: { cfg: ConfigGeneralState }) {
    const { envios, setEnvios, cambiado, guardando, guardarEnvios, errores } = cfg
    return (
        <Card style={{ display: 'flex', flexDirection: 'column' }}>
            <SectionTitle>Envíos</SectionTitle>
            {/* Ningún campo de esta pantalla es obligatorio — vacío, cada uno cae a
                un comportamiento razonable (sin umbral de envío gratis, sin política
                propia, todos los transportistas visibles, ese transportista se sigue
                coordinando por WhatsApp). "(opcional)" en el label lo dice de entrada,
                en vez de que el dueño tenga que llegar al texto de ayuda para
                enterarse de que no hace falta completarlo — mismo criterio que ya usa
                JuegosConfig.tsx con este mismo campo. */}
            {/* Cartelito "Envíos" de la ficha de producto (al lado de
                "Cambios" y "Pago") — vacío = se sigue mostrando "24-72 hs",
                el mismo texto fijo que había antes de que esto existiera. */}
            <CfgField label="Tiempo de envío estimado (opcional)" placeholder="Ej: 24-72 hs" value={envios.shippingEstimateText} onChange={v => setEnvios(p => ({ ...p, shippingEstimateText: v }))} />
            {/* Solo deja escribir números (nada de letras) */}
            <CfgField label="Envío gratis desde ($) (opcional)" placeholder="Ej: 20000" value={envios.freeShippingFrom} onChange={v => setEnvios(p => ({ ...p, freeShippingFrom: v.replace(/[^0-9.,]/g, '') }))} />
            {/* Se muestra debajo del resumen del pedido en el checkout, si hay algo escrito. */}
            <CfgField label="Texto de política de envíos (opcional)" value={envios.shippingPolicy} area onChange={v => setEnvios(p => ({ ...p, shippingPolicy: v }))} />
            <div style={{ marginTop: 14 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text)', marginBottom: 8 }}>
                    Transportistas que ofrecés <span style={{ fontWeight: 400, color: 'var(--color-muted)' }}>(opcional)</span>
                </div>
                <div style={{ fontSize: 12, color: 'var(--color-muted)', marginBottom: 10 }}>
                    Ninguno marcado = se muestran todos en el checkout.
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {CARRIER_META.map(c => {
                        const activo = envios.enabledCarriers.includes(c.key)
                        return (
                            <button
                                key={c.key}
                                type="button"
                                className="ds-hover"
                                onClick={() => setEnvios(p => ({
                                    ...p,
                                    enabledCarriers: activo
                                        ? p.enabledCarriers.filter(x => x !== c.key)
                                        : [...p.enabledCarriers, c.key],
                                }))}
                                style={{
                                    height: 32, padding: '0 14px', borderRadius: 999,
                                    fontSize: 12.5, fontWeight: 600, cursor: 'pointer',
                                    background: activo ? 'var(--color-primary)' : 'var(--color-bg)',
                                    color: activo ? '#fff' : 'var(--color-text)',
                                    border: `1px solid ${activo ? 'var(--color-primary)' : 'var(--color-border)'}`,
                                    transition: 'all 150ms',
                                }}
                            >
                                {c.label}
                            </button>
                        )
                    })}
                </div>
            </div>
            <div style={{ marginTop: 18 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text)', marginBottom: 8 }}>
                    Costo de envío por transportista <span style={{ fontWeight: 400, color: 'var(--color-muted)' }}>(opcional)</span>
                </div>
                <div style={{ fontSize: 12, color: 'var(--color-muted)', marginBottom: 10 }}>
                    Vacío = ese transportista no calcula envío (se sigue coordinando aparte por WhatsApp).
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {CARRIER_META.map(c => (
                        <div key={c.key} className="cfg-costo-row" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                            <div style={{ fontSize: 13, color: 'var(--color-body)', width: 190, flexShrink: 0 }}>{c.label}</div>
                            <input
                                type="text"
                                inputMode="decimal"
                                className="ds-field"
                                placeholder="Ej: 2000"
                                value={envios.carrierShippingCosts[c.key] ?? ''}
                                onChange={e => {
                                    const v = e.target.value.replace(/[^0-9.,]/g, '')
                                    setEnvios(p => ({ ...p, carrierShippingCosts: { ...p.carrierShippingCosts, [c.key]: v } }))
                                }}
                                style={{
                                    flex: 1, minWidth: 0, height: 38, padding: '0 12px', borderRadius: 8,
                                    background: 'var(--color-bg)', border: '1px solid var(--color-border)',
                                    color: 'var(--color-text)', fontSize: 13, outline: 'none', boxSizing: 'border-box',
                                }}
                            />
                        </div>
                    ))}
                </div>
            </div>
            <div style={{ marginTop: 'auto', paddingTop: 14 }}>
                <DirtyHint show={cambiado('envios', envios)} />
                <Button variant="primary" loading={guardando === 'envios'} disabled={!cambiado('envios', envios)} onClick={guardarEnvios}>Guardar cambios</Button>
                <ErrorInline msg={errores.envios} />
            </div>
        </Card>
    )
}
