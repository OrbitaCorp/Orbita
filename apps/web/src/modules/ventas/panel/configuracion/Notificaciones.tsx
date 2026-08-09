// src/modules/ventas/panel/configuracion/Notificaciones.tsx — Vista 18

import { Card } from '@/design-system/components/Card'
import type { VistaConfig } from './components/ConfigTabs'
import { Toggle } from './components/ConfigControls'

const PANEL: [string, boolean][] = [
    ['Nuevo pedido', true], ['Pedido cancelado', true], ['Stock crítico', true], ['Devolución', true],
    ['Pago confirmado', true], ['Resumen diario', false], ['Cliente nuevo', true], ['Reporte semanal', false],
]

const CANALES: [string, boolean][] = [
    ['Panel', true], ['Email a alexander@rama.com', true], ['WhatsApp', false],
]

export default function Notificaciones({ ir }: { ir: (v: VistaConfig) => void }) {
    return (
        <div style={pageWrap}>
            <h1 style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--color-text)', margin: '0 0 20px' }}>Notificaciones</h1>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 720 }}>
                <Card>
                    <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--color-text)', marginBottom: 14 }}>Notificaciones del panel</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
                        {PANEL.map(([l, on]) => (
                            <div key={l} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 4px' }}>
                                <span style={{ fontSize: 13, color: 'var(--color-body)' }}>{l}</span>
                                <Toggle defaultOn={on} />
                            </div>
                        ))}
                    </div>
                </Card>

                <Card>
                    <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--color-text)', marginBottom: 14 }}>Canales</div>
                    {CANALES.map(([l, on]) => (
                        <div key={l} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid var(--color-border)' }}>
                            <span style={{ fontSize: 14, color: 'var(--color-body)' }}>{l}</span>
                            <Toggle defaultOn={on} />
                        </div>
                    ))}
                </Card>
            </div>
        </div>
    )
}

const pageWrap: React.CSSProperties = { padding: '24px 32px 64px', maxWidth: 1280, width: '100%', margin: '0 auto', boxSizing: 'border-box' }
