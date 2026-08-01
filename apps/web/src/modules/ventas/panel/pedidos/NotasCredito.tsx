// src/modules/ventas/panel/pedidos/NotasCredito.tsx — Vista 07
// Saldos a favor y reembolsos emitidos a clientes + modal de alta.

import { useState } from 'react'
import { FileText, Check, Clock, Search, Eye, Mail } from 'lucide-react'
import { KpiCard } from '@/design-system/components/KpiCard'
import { Modal } from '@/design-system/components/Modal'
import { Button } from '@/design-system/components/Button'
import { Avatar } from '@/design-system/components/Avatar'
import { fmtMoney } from '@/lib/utils'
import type { VistaPedido } from './components/PedidoTabs'
import { ModalComprobante } from './components/ModalComprobante'
import { ModalEmail, type ClienteEmail } from './components/ModalEmail'
import { MOCK_PEDIDOS, MOCK_NOTAS_CREDITO } from './mock/pedidos.mock'
import type { NotaCredito, Pedido, TipoNota } from './types/pedidos.types'

const COLS = '110px 1.3fr 90px 120px 130px 110px 80px'

interface NotasCreditoProps {
    ir:      (vista: VistaPedido, id?: string) => void
    onToast: (msg: string) => void
}

export default function NotasCredito({ ir, onToast }: NotasCreditoProps) {
    const [notas, setNotas] = useState<NotaCredito[]>(MOCK_NOTAS_CREDITO)
    const [open, setOpen] = useState(false)
    const [ped, setPed] = useState<Pedido | null>(null)
    const [q, setQ] = useState('')
    const [monto, setMonto] = useState('')
    const [tipo, setTipo] = useState<'saldo' | 'reembolso'>('saldo')
    const [desc, setDesc] = useState('')
    const [comprobante, setComprobante] = useState<string | null>(null)
    const [email, setEmail] = useState<ClienteEmail | null>(null)

    const resultados = MOCK_PEDIDOS.filter(p => !q || p.id.includes(q) || p.cliente.toLowerCase().includes(q.toLowerCase())).slice(0, 4)
    const reset = () => { setPed(null); setQ(''); setMonto(''); setTipo('saldo'); setDesc('') }

    const crear = () => {
        if (!ped) return
        const nueva: NotaCredito = {
            id:       'NC-00' + (35 + notas.length),
            cliente:  ped.cliente,
            pedidoId: ped.id,
            monto:    parseInt(monto) || ped.monto,
            tipo:     (tipo === 'saldo' ? 'Saldo a favor' : 'Reembolso') as TipoNota,
            estado:   'emitida',
            vence:    tipo === 'saldo' ? 'sep' : '—',
        }
        setNotas(n => [nueva, ...n])
        setOpen(false)
        reset()
        onToast('✓ Nota de crédito creada')
    }

    return (
        <div style={pageWrap}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginBottom: 20 }}>
                <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <h1 style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--color-text)', margin: 0 }}>Notas de crédito</h1>
                        <span style={{ display: 'inline-flex', alignItems: 'center', height: 24, padding: '0 10px', borderRadius: 9999, background: 'var(--color-surface-alt)', color: 'var(--color-muted)', fontSize: 12, fontWeight: 600, fontFamily: '"Geist Mono", monospace' }}>{notas.length} emitidas</span>
                    </div>
                    <div style={{ fontSize: 14, color: 'var(--color-muted)', marginTop: 4 }}>Gestioná los saldos a favor y reembolsos de tus clientes.</div>
                </div>
                <Button variant="primary" icon={<FileText size={16} />} onClick={() => { reset(); setOpen(true) }}>Nueva nota</Button>
            </div>

            {/* KPIs */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 16 }}>
                <KpiCard label="Total emitido" value={142400} delta={0} prefix="$" accent="#3B82F6" icon={FileText} loading={false} footnote={<span style={{ fontSize: 11, color: 'var(--color-muted)' }}>acumulado</span>} />
                <KpiCard label="Notas activas" value={4} delta={0} accent="#10B981" icon={Check} loading={false} footnote={<span style={{ fontSize: 11, color: 'var(--color-muted)' }}>vigentes</span>} />
                <KpiCard label="Vencen en 7 días" value={1} delta={0} accent="#F59E0B" icon={Clock} loading={false} footnote={<span style={{ fontSize: 11, color: 'var(--color-muted)' }}>requieren acción</span>} />
            </div>

            {/* Tabla */}
            <div style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 12, overflow: 'hidden' }}>
                <div style={{ display: 'grid', gridTemplateColumns: COLS, alignItems: 'center', padding: '0 16px', height: 44, background: 'var(--color-surface)', borderBottom: '1px solid var(--color-border)', fontSize: 11, fontWeight: 600, color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    <span># Nota</span><span>Cliente</span><span>Pedido</span><span>Monto</span><span>Tipo</span><span>Estado</span><span />
                </div>
                {notas.map((n, i) => (
                    <div key={n.id} style={{ display: 'grid', gridTemplateColumns: COLS, alignItems: 'center', padding: '0 16px', height: 56, borderBottom: i < notas.length - 1 ? '1px solid var(--color-border)' : 'none' }}>
                        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-primary)', fontFamily: '"Geist Mono", monospace' }}>{n.id}</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                            <Avatar name={n.cliente} size={26} />
                            <span style={{ fontSize: 13, color: 'var(--color-text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{n.cliente}</span>
                        </div>
                        <span style={{ fontSize: 12, color: 'var(--color-primary)', fontFamily: '"Geist Mono", monospace' }}>#{n.pedidoId}</span>
                        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text)', fontFamily: '"Geist Mono", monospace' }}>{fmtMoney(n.monto)}</span>
                        <span style={{ display: 'inline-flex', alignItems: 'center', height: 22, padding: '0 10px', borderRadius: 9999, fontSize: 11, fontWeight: 600, width: 'fit-content', background: n.tipo === 'Reembolso' ? 'var(--color-error-bg)' : 'var(--color-primary-bg)', color: n.tipo === 'Reembolso' ? 'var(--color-error)' : 'var(--color-primary)' }}>{n.tipo}</span>
                        <span style={{ display: 'inline-flex', alignItems: 'center', height: 22, padding: '0 10px', borderRadius: 9999, fontSize: 11, fontWeight: 600, width: 'fit-content', background: n.estado === 'aplicada' ? 'var(--color-surface-alt)' : 'var(--color-success-bg)', color: n.estado === 'aplicada' ? 'var(--color-muted)' : 'var(--color-success)' }}>{n.estado === 'aplicada' ? 'Aplicada' : 'Vigente'}</span>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 2 }}>
                            <button onClick={() => setComprobante(n.id)} style={iconBtn}><Eye size={15} /></button>
                            <button onClick={() => setEmail({ nombre: n.cliente, email: 'cliente@mail.com' })} style={iconBtn}><Mail size={15} /></button>
                        </div>
                    </div>
                ))}
            </div>

            {/* Modal nueva nota */}
            <Modal
                isOpen={open}
                onClose={() => setOpen(false)}
                title="Nueva nota de crédito"
                maxWidth={560}
                footer={
                    <>
                        <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
                        <Button variant="primary" disabled={!ped || !monto} onClick={crear}>Crear nota de crédito</Button>
                    </>
                }
            >
                <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--color-body)', display: 'block', marginBottom: 6 }}>Pedido de origen</label>
                {ped ? (
                    <div style={{ background: 'var(--color-primary-bg)', border: '1px solid var(--color-primary)', borderRadius: 8, padding: 12, display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                        <Avatar name={ped.cliente} size={34} />
                        <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text)' }}>#{ped.id} · {ped.cliente}</div>
                            <div style={{ fontSize: 12, color: 'var(--color-muted)', fontFamily: '"Geist Mono", monospace' }}>Total {fmtMoney(ped.monto)}</div>
                        </div>
                        <button onClick={() => setPed(null)} style={{ background: 'none', border: 'none', color: 'var(--color-primary)', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>Cambiar</button>
                    </div>
                ) : (
                    <div style={{ marginBottom: 16 }}>
                        <div style={{ position: 'relative', marginBottom: 8 }}>
                            <Search size={15} style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-muted)' }} />
                            <input value={q} onChange={e => setQ(e.target.value)} placeholder="# Pedido o cliente…" style={{ ...inputBase, height: 40, paddingLeft: 34, paddingRight: 12, fontSize: 13 }} />
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                            {resultados.map(p => (
                                <button key={p.id} onClick={() => { setPed(p); setMonto(String(p.monto)) }} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 10, border: '1px solid var(--color-border)', borderRadius: 8, background: 'var(--color-surface)', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' }}>
                                    <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-primary)', fontFamily: '"Geist Mono", monospace' }}>#{p.id}</span>
                                    <span style={{ flex: 1, fontSize: 13, color: 'var(--color-text)' }}>{p.cliente}</span>
                                    <span style={{ fontSize: 12, color: 'var(--color-muted)', fontFamily: '"Geist Mono", monospace' }}>{fmtMoney(p.monto)}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {ped && (
                    <>
                        <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--color-body)', display: 'block', marginBottom: 6 }}>Monto</label>
                        <div style={{ display: 'flex', alignItems: 'center', height: 48, padding: '0 14px', background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 8, marginBottom: 4 }}>
                            <span style={{ color: 'var(--color-muted)', fontFamily: '"Geist Mono", monospace', fontSize: 18 }}>$</span>
                            <input value={monto} onChange={e => setMonto(e.target.value.replace(/\D/g, ''))} style={{ flex: 1, height: '100%', border: 'none', outline: 'none', background: 'transparent', fontSize: 18, fontWeight: 700, color: 'var(--color-text)', fontFamily: '"Geist Mono", monospace', paddingLeft: 6 }} />
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--color-muted)', marginBottom: 16 }}>El monto máximo es el total del pedido: {fmtMoney(ped.monto)}</div>

                        <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--color-body)', display: 'block', marginBottom: 8 }}>Tipo de nota</label>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
                            {([['saldo', 'Saldo a favor', 'Lo usa en su próxima compra', true], ['reembolso', 'Reembolso', 'Devolver el dinero', false]] as ['saldo' | 'reembolso', string, string, boolean][]).map(([id, l, d, rec]) => {
                                const a = tipo === id
                                return (
                                    <button key={id} onClick={() => setTipo(id)} style={{ padding: 12, border: `${a ? 2 : 1}px solid ${a ? 'var(--color-primary)' : 'var(--color-border)'}`, borderRadius: 10, background: a ? 'var(--color-primary-bg)' : 'var(--color-surface)', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                                            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text)' }}>{l}</span>
                                            {rec && <span style={{ display: 'inline-flex', alignItems: 'center', height: 16, padding: '0 6px', borderRadius: 9999, background: 'var(--color-success-bg)', color: 'var(--color-success)', fontSize: 9, fontWeight: 600 }}>Recomendado</span>}
                                        </div>
                                        <div style={{ fontSize: 11, color: 'var(--color-muted)' }}>{d}</div>
                                    </button>
                                )
                            })}
                        </div>

                        <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--color-body)', display: 'block', marginBottom: 6 }}>Descripción</label>
                        <textarea value={desc} onChange={e => setDesc(e.target.value)} placeholder="Motivo de la nota de crédito…" rows={2} style={{ ...inputBase, resize: 'vertical', minHeight: 52, padding: '10px 12px', fontSize: 13 }} />
                    </>
                )}
            </Modal>

            <ModalComprobante isOpen={comprobante !== null} onClose={() => setComprobante(null)} tipo="nota" id={comprobante ?? undefined} />
            {email && <ModalEmail isOpen onClose={() => setEmail(null)} cliente={email} />}
        </div>
    )
}

const pageWrap: React.CSSProperties = { padding: '24px 32px 64px', maxWidth: 1280, width: '100%', margin: '0 auto', boxSizing: 'border-box' }
const inputBase: React.CSSProperties = {
    width: '100%', boxSizing: 'border-box', background: 'var(--color-bg)',
    border: '1px solid var(--color-border)', borderRadius: 8, color: 'var(--color-text)',
    fontFamily: 'inherit', outline: 'none',
}
const iconBtn: React.CSSProperties = {
    width: 28, height: 28, borderRadius: 6, border: 'none', background: 'transparent',
    color: 'var(--color-muted)', cursor: 'pointer', display: 'grid', placeItems: 'center',
}
