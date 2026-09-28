// StatCard — tarjeta de métrica flexible para el panel admin.
//
// A diferencia de KpiCard (design system), acepta valores de texto
// ("Hoy", "Camperas", "68%") y un delta opcional. Se usa en reportes,
// clientes e inventario, donde no todas las métricas son numéricas animadas.

import type { ComponentType, ReactNode } from 'react'
import { Card } from '@/design-system/components/Card'
import { InfoTip } from './InfoTip'

interface StatCardProps {
    label:    string
    value:    ReactNode
    icon?:    ComponentType<{ size?: number; strokeWidth?: number }>
    accent?:  string
    delta?:   string
    deltaPos?: boolean
    sub?:     ReactNode
    // Explicación que se abre al pasar el mouse por el ícono de exclamación que
    // queda al lado del nombre de la métrica (ver InfoTip).
    info?:    ReactNode
}

export function StatCard({ label, value, icon: Icon, accent = '#3B82F6', delta, deltaPos, sub, info }: StatCardProps) {
    return (
        // position: relative — el cuadro del InfoTip se ancla a la tarjeta.
        <Card padding="sm" style={info ? { position: 'relative' } : undefined}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 600, color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    {label}
                    {info && <InfoTip titulo={label}>{info}</InfoTip>}
                </span>
                {Icon && (
                    <div style={{ width: 30, height: 30, borderRadius: 8, background: `${accent}1A`, color: accent, display: 'grid', placeItems: 'center' }}>
                        <Icon size={15} strokeWidth={1.6} />
                    </div>
                )}
            </div>
            <div className="ds-stat-value" style={{ fontSize: 26, fontWeight: 700, color: 'var(--color-text)', marginTop: 8, fontFamily: '"Geist Mono", monospace', letterSpacing: '-0.01em', lineHeight: 1.15, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {value}
            </div>
            {(delta || sub) && (
                <div style={{ marginTop: 6, fontSize: 12, fontWeight: 500, color: delta ? (deltaPos ? 'var(--color-success)' : 'var(--color-error)') : 'var(--color-muted)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    {delta && <span>{deltaPos ? '▲' : '▼'}</span>}
                    {delta || sub}
                </div>
            )}
        </Card>
    )
}
