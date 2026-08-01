// src/modules/ventas/panel/pedidos/PedidoHistorial.tsx — Vista 05
// Historial completo de pedidos con KPIs del mes y exportación.

import { useState } from 'react'
import { Download, Banknote, ShoppingBag, BarChart3, AlertCircle } from 'lucide-react'
import { KpiCard } from '@/design-system/components/KpiCard'
import { Button } from '@/design-system/components/Button'
import type { VistaPedido } from './components/PedidoTabs'
import { PedidoTable } from './components/PedidoTable'
import { ModalComprobante } from './components/ModalComprobante'
import { ModalEmail, type ClienteEmail } from './components/ModalEmail'
import { MOCK_PEDIDOS } from './mock/pedidos.mock'
import type { Pedido } from './types/pedidos.types'

interface PedidoHistorialProps {
    ir: (vista: VistaPedido, id?: string) => void
}

export default function PedidoHistorial({ ir }: PedidoHistorialProps) {
    const [comprobante, setComprobante] = useState<string | null>(null)
    const [email, setEmail] = useState<ClienteEmail | null>(null)

    return (
        <div className="hist-page" style={pageWrap}>
            <style>{`
                @media (max-width: 768px) {
                    .hist-page   { padding: 16px 14px 48px !important; }
                    .hist-header { flex-direction: column; align-items: flex-start !important; }
                    .hist-kpis   { grid-template-columns: repeat(2,1fr) !important; }
                }
                @media (max-width: 460px) {
                    .hist-kpis   { grid-template-columns: 1fr !important; }
                }
            `}</style>

            {/* Header */}
            <div className="hist-header" style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginBottom: 20 }}>
                <h1 style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--color-text)', margin: 0 }}>Historial de pedidos</h1>
                <div style={{ display: 'flex', gap: 8 }}>
                    <Button variant="outline" icon={<Download size={15} />}>CSV</Button>
                    <Button variant="outline" icon={<Download size={15} />}>PDF</Button>
                </div>
            </div>

            {/* KPIs */}
            <div className="hist-kpis" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 16 }}>
                <KpiCard label="Ventas mes" value={3480400} delta={14.8} prefix="$" accent="#3B82F6" icon={Banknote} loading={false} />
                <KpiCard label="Pedidos mes" value={142} delta={11.2} accent="#10B981" icon={ShoppingBag} loading={false} />
                <KpiCard label="Ticket prom" value={24510} delta={6.0} prefix="$" accent="#8B5CF6" icon={BarChart3} loading={false} />
                <KpiCard label="Tasa cancelación" value={3.2} delta={-1.4} accent="#EF4444" icon={AlertCircle} loading={false} footnote={<span style={{ fontSize: 11, color: 'var(--color-muted)' }}>% sobre total</span>} />
            </div>

            <PedidoTable
                rows={MOCK_PEDIDOS}
                onRowClick={(p: Pedido) => ir('detalle', p.id)}
                onComprobante={(p) => setComprobante(p.id)}
                onEmail={(p) => setEmail({ nombre: p.cliente, email: p.email })}
            />

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 4px', flexWrap: 'wrap', gap: 12 }}>
                <span style={{ fontSize: 13, color: 'var(--color-muted)' }}>
                    Mostrando <strong style={{ color: 'var(--color-text)', fontFamily: '"Geist Mono", monospace' }}>1–8</strong> de <strong style={{ color: 'var(--color-text)', fontFamily: '"Geist Mono", monospace' }}>142</strong>
                </span>
            </div>

            <ModalComprobante isOpen={comprobante !== null} onClose={() => setComprobante(null)} id={comprobante ?? undefined} />
            {email && <ModalEmail isOpen onClose={() => setEmail(null)} cliente={email} />}
        </div>
    )
}

const pageWrap: React.CSSProperties = { padding: '24px 32px 64px', maxWidth: 1280, width: '100%', margin: '0 auto', boxSizing: 'border-box', minWidth: 0 }
