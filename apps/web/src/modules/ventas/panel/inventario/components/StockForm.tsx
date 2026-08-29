// Formulario de entrada / ajuste de stock (compartido por V24 y V25).

import { useState } from 'react'
import { Card } from '@/design-system/components/Card'
import { Button } from '@/design-system/components/Button'
import { CfgField } from '../../configuracion/components/ConfigControls'
import { PRODUCTOS_STOCK } from '../mock/inventario.mock'

interface StockFormProps {
    ajuste?: boolean
    onToast: (m: string) => void
    onDone:  () => void
}

export function StockForm({ ajuste, onToast, onDone }: StockFormProps) {
    const prod = PRODUCTOS_STOCK[0]
    const [qty, setQty] = useState(10)
    const [tipo, setTipo] = useState<'aumento' | 'reduccion'>('aumento')

    const nuevo = ajuste ? (tipo === 'aumento' ? prod.stock + qty : Math.max(0, prod.stock - qty)) : prod.stock + qty

    return (
        <Card style={{ maxWidth: 600 }}>
            <CfgField label="Producto" value={prod.nombre} select />

            {ajuste && (
                <div style={{ marginBottom: 14 }}>
                    <label style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-body)', marginBottom: 6, display: 'block' }}>Tipo de ajuste</label>
                    <div style={{ display: 'flex', gap: 8 }}>
                        {([['aumento', 'Aumento', 'var(--color-success)'], ['reduccion', 'Reducción', 'var(--color-error)']] as ['aumento' | 'reduccion', string, string][]).map(([id, l, col]) => {
                            const a = tipo === id
                            return <button key={id} className="ds-hover" onClick={() => setTipo(id)} style={{ flex: 1, height: 40, borderRadius: 8, border: `1px solid ${a ? col : 'var(--color-border)'}`, background: a ? `color-mix(in srgb, ${col} 8%, transparent)` : 'var(--color-bg)', color: a ? col : 'var(--color-body)', fontSize: 13, fontWeight: a ? 600 : 500, fontFamily: 'inherit' }}>{l}</button>
                        })}
                    </div>
                </div>
            )}

            <div style={{ marginBottom: 14 }}>
                <label style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-body)', marginBottom: 6, display: 'block' }}>Cantidad</label>
                <input className="ds-field" value={qty} onChange={e => setQty(Math.max(0, Number(e.target.value.replace(/\D/g, '')) || 0))} style={{ width: '100%', boxSizing: 'border-box', height: 44, padding: '0 12px', background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 8, fontSize: 15, color: 'var(--color-text)', fontFamily: '"Geist Mono", monospace', outline: 'none' }} />
            </div>

            {!ajuste && (
                <>
                    <CfgField label="Precio de costo" value="$ 12.000" />
                    <CfgField label="Proveedor" value="Textiles Buenos Aires" select />
                </>
            )}
            <CfgField label="Motivo" value={ajuste ? 'Inventario físico' : 'Compra'} select />
            {ajuste && <CfgField label="Notas" value="" area />}

            <div style={{ padding: 12, background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 8, marginBottom: 16, fontSize: 13, color: 'var(--color-body)' }}>
                Stock actual: <strong style={{ fontFamily: '"Geist Mono", monospace' }}>{prod.stock}</strong> → Stock nuevo: <strong style={{ color: 'var(--color-primary)', fontFamily: '"Geist Mono", monospace' }}>{nuevo}</strong>
            </div>

            <Button variant="primary" size="lg" onClick={() => { onToast(ajuste ? 'Ajuste registrado en el historial' : 'Entrada de stock registrada'); onDone() }}>
                {ajuste ? 'Registrar ajuste' : 'Registrar entrada'}
            </Button>
        </Card>
    )
}
