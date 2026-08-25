// src/modules/ventas/panel/inventario/StockGeneral.tsx — Vista 23 + hub del módulo
//
// Punto de entrada del módulo `inventario` (registrado en el componentMap admin).
// Hub con tabs: stock (V23), entrada (V24), ajuste (V25), movimientos (V26),
// proveedores (V27).
//
//   /admin/[negocioId]/ventas/inventario              → stock general (V23)
//   …/inventario?vista=entrada                        → EntradaStock (V24)
//   …/inventario?vista=ajuste                         → AjusteStock (V25)
//   …/inventario?vista=movimientos                    → Movimientos (V26)
//   …/inventario?vista=proveedores                    → Proveedores (V27)

import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { Plus, Archive, Package, AlertTriangle, AlertCircle } from 'lucide-react'
import { Card } from '@/design-system/components/Card'
import { Button } from '@/design-system/components/Button'
import { Toast } from '@/design-system/components/Toast'
import { DonutChart } from '@/design-system/components/Chart'
import { fmtMoney, toastEsError } from '@/lib/utils'

import { StatCard } from '../_shared/StatCard'
import { InvTabs, type VistaInventario } from './components/InvTabs'
import { InvTable } from './components/InvTable'
import EntradaStock from './EntradaStock'
import AjusteStock from './AjusteStock'
import Movimientos from './Movimientos'
import Proveedores from './Proveedores'

// ─── Stock general (V23) ──────────────────────────────────────────────────────

function StockView({ ir }: { ir: (v: VistaInventario) => void }) {
    const [dist, setDist] = useState(false)

    return (
        <div style={pageWrap}>
            <InvTabs activo="stock" ir={ir} />
            <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginBottom: 20 }}>
                <h1 style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--color-text)', margin: 0 }}>Stock general</h1>
                <Button variant="primary" icon={<Plus size={16} />} onClick={() => ir('entrada')}>Entrada de stock</Button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 16 }}>
                <StatCard label="Valor total" value={fmtMoney(4280000)} icon={Archive} accent="#3B82F6" />
                <StatCard label="Activos" value="54" icon={Package} accent="#10B981" />
                <StatCard label="Stock crítico" value="3" icon={AlertTriangle} accent="#F59E0B" />
                <StatCard label="Sin stock" value="1" icon={AlertCircle} accent="#EF4444" />
            </div>

            <Card padding="md" style={{ padding: 0, marginBottom: 16 }}>
                <button onClick={() => setDist(d => !d)} style={{ width: '100%', padding: '14px 20px', border: 'none', background: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', fontFamily: 'inherit' }}>
                    <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-text)' }}>Distribución por categoría</span>
                    <span style={{ fontSize: 12, color: 'var(--color-primary)' }}>{dist ? 'Ocultar ↑' : 'Ver distribución ↓'}</span>
                </button>
                {dist && (
                    <div style={{ padding: '0 20px 20px' }}>
                        <DonutChart
                            size={140}
                            data={[
                                { label: 'Camperas', value: 32, color: '#3B82F6' },
                                { label: 'Remeras', value: 28, color: '#10B981' },
                                { label: 'Pantalones', value: 22, color: '#8B5CF6' },
                                { label: 'Buzos', value: 12, color: '#F59E0B' },
                                { label: 'Accesorios', value: 6, color: '#EC4899' },
                            ]}
                        />
                    </div>
                )}
            </Card>

            <InvTable />
        </div>
    )
}

// ─── Hub ──────────────────────────────────────────────────────────────────────

export default function StockGeneral() {
    const router = useRouter()
    const { vista } = router.query
    const [toast, setToast] = useState<string | null>(null)

    useEffect(() => {
        if (!toast) return
        const t = setTimeout(() => setToast(null), 3000)
        return () => clearTimeout(t)
    }, [toast])

    const ir = (v: VistaInventario) => {
        const { vista: _v, ...rest } = router.query
        const q: Record<string, string | string[] | undefined> = { ...rest }
        if (v !== 'stock') q.vista = v
        router.push({ query: q })
    }

    const sub = vista as VistaInventario | undefined
    let content
    if (sub === 'entrada')          content = <EntradaStock ir={ir} onToast={setToast} />
    else if (sub === 'ajuste')      content = <AjusteStock ir={ir} onToast={setToast} />
    else if (sub === 'movimientos') content = <Movimientos ir={ir} />
    else if (sub === 'proveedores') content = <Proveedores ir={ir} />
    else                            content = <StockView ir={ir} />

    return (
        <>
            {content}
            {toast && (
                <div style={{ position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', zIndex: 9000 }}>
                    <Toast variant={toastEsError(toast) ? 'error' : 'success'} title={toast} onClose={() => setToast(null)} />
                </div>
            )}
        </>
    )
}

const pageWrap: React.CSSProperties = { padding: '24px 32px 64px', maxWidth: 1280, width: '100%', margin: '0 auto', boxSizing: 'border-box' }
