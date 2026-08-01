// src/modules/ventas/panel/pedidos/Devoluciones.tsx — Vista 06
// Gestión de devoluciones + drawer de alta en 3 pasos (pedido, productos, reembolso).

import { useState } from 'react'
import { Truck, Search, X, Check } from 'lucide-react'
import { Card } from '@/design-system/components/Card'
import { Badge, type BadgeStatus } from '@/design-system/components/Badge'
import { Button } from '@/design-system/components/Button'
import { Avatar } from '@/design-system/components/Avatar'
import { fmtMoney } from '@/lib/utils'
import type { VistaPedido } from './components/PedidoTabs'
import { ProductoThumb } from './components/ProductoThumb'
import { ModalComprobante } from './components/ModalComprobante'
import { ModalEmail, type ClienteEmail } from './components/ModalEmail'
import { MOCK_PEDIDOS, MOCK_DEVOLUCIONES } from './mock/pedidos.mock'
import type { Devolucion, MetodoReembolso, Pedido } from './types/pedidos.types'

const MOTIVOS = ['Talle incorrecto', 'No era lo esperado', 'Producto defectuoso', 'Me arrepentí', 'Llegó dañado', 'Otro']
const PRECIO_LINEA = 16300

const estadoBadge: Record<Devolucion['estado'], BadgeStatus> = {
    pendiente: 'pendiente',
    proceso:   'preparacion',
    aprobada:  'confirmado',
    rechazada: 'cancelado',
}

interface DevolucionesProps {
    ir:      (vista: VistaPedido, id?: string) => void
    onToast: (msg: string) => void
}

export default function Devoluciones({ ir, onToast }: DevolucionesProps) {
    const [lista, setLista] = useState<Devolucion[]>(MOCK_DEVOLUCIONES)
    const [drawer, setDrawer] = useState(false)
    const [step, setStep] = useState(1)
    const [ped, setPed] = useState<Pedido | null>(null)
    const [sel, setSel] = useState<number[]>([])
    const [motivo, setMotivo] = useState('')
    const [metodo, setMetodo] = useState<MetodoReembolso>('nota_credito')
    const [q, setQ] = useState('')
    const [comprobante, setComprobante] = useState<string | null>(null)
    const [email, setEmail] = useState<ClienteEmail | null>(null)

    const reset = () => { setStep(1); setPed(null); setSel([]); setMotivo(''); setMetodo('nota_credito'); setQ('') }
    const abrir = () => { reset(); setDrawer(true) }

    const resultados = MOCK_PEDIDOS.filter(p => !q || p.id.includes(q) || p.cliente.toLowerCase().includes(q.toLowerCase())).slice(0, 4)
    const totalDev = ped ? ped.productos.filter((_, i) => sel.includes(i)).reduce((s) => s + PRECIO_LINEA, 0) : 0

    const registrar = () => {
        if (!ped) return
        const nueva: Devolucion = {
            id:       'DEV-00' + (13 + lista.length),
            cliente:  ped.cliente,
            producto: ped.productos[sel[0]]?.nombre ?? 'Producto',
            cantidad: 1,
            monto:    totalDev || ped.monto,
            hue:      ped.productos[sel[0]]?.hue ?? 220,
            motivo:   motivo || 'Otro',
            estado:   'pendiente',
        }
        setLista(l => [nueva, ...l])
        setDrawer(false)
        reset()
        onToast('✓ Devolución registrada correctamente')
    }

    return (
        <div style={pageWrap}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginBottom: 20 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <h1 style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--color-text)', margin: 0 }}>Devoluciones</h1>
                    <span style={{ display: 'inline-flex', alignItems: 'center', height: 24, padding: '0 10px', borderRadius: 9999, background: 'var(--color-warning-bg)', color: 'var(--color-warning)', fontSize: 12, fontWeight: 600 }}>{lista.length} activas</span>
                </div>
                <Button variant="primary" icon={<Truck size={16} />} onClick={abrir}>Nueva devolución</Button>
            </div>

            {/* Lista de devoluciones */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {lista.map(d => (
                    <Card key={d.id}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
                            <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--color-text)', fontFamily: '"Geist Mono", monospace' }}>{d.id}</span>
                            <Badge status={estadoBadge[d.estado]} size="sm" />
                            <span style={{ fontSize: 12, color: 'var(--color-muted)', fontFamily: '"Geist Mono", monospace' }}>17 may</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                            <Avatar name={d.cliente} size={32} />
                            <span style={{ fontSize: 13, color: 'var(--color-text)' }}>{d.cliente}</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 12, background: 'var(--color-surface)', borderRadius: 8, marginBottom: 12 }}>
                            <ProductoThumb hue={d.hue} size={40} />
                            <div style={{ flex: 1 }}>
                                <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-text)' }}>{d.producto}</div>
                                <div style={{ fontSize: 12, color: 'var(--color-muted)', fontFamily: '"Geist Mono", monospace' }}>{d.cantidad} unidad · {fmtMoney(d.monto)}</div>
                            </div>
                            <span style={{ display: 'inline-flex', alignItems: 'center', height: 24, padding: '0 10px', borderRadius: 9999, background: 'var(--color-warning-bg)', color: 'var(--color-warning)', fontSize: 12, fontWeight: 600 }}>{d.motivo}</span>
                        </div>
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                            <Button variant="outline" size="sm" onClick={() => setComprobante(d.id)}>Ver detalle</Button>
                            <Button variant="outline" size="sm" onClick={() => onToast(`${d.id} aprobada`)}>Aprobar</Button>
                            <Button variant="danger" size="sm" onClick={() => onToast(`${d.id} rechazada`)}>Rechazar</Button>
                            <Button variant="outline" size="sm" onClick={() => setEmail({ nombre: d.cliente, email: 'cliente@mail.com' })}>Email</Button>
                        </div>
                    </Card>
                ))}
            </div>

            {/* Drawer de alta */}
            {drawer && (
                <>
                    <div onClick={() => setDrawer(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.45)', backdropFilter: 'blur(2px)', zIndex: 299 }} />
                    <div style={{ position: 'fixed', right: 0, top: 0, bottom: 0, width: 480, maxWidth: '100vw', background: 'var(--color-bg)', borderLeft: '1px solid var(--color-border)', boxShadow: '-8px 0 24px rgba(15,23,42,0.12)', zIndex: 300, display: 'flex', flexDirection: 'column', animation: 'slideInRight 280ms cubic-bezier(0.2,0.8,0.2,1)' }}>

                        {/* Drawer header */}
                        <div style={{ height: 60, padding: '0 24px', borderBottom: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <span style={{ fontSize: 16, fontWeight: 600, color: 'var(--color-text)' }}>Nueva devolución</span>
                            <button onClick={() => setDrawer(false)} style={{ width: 28, height: 28, borderRadius: 6, border: 'none', background: 'transparent', color: 'var(--color-muted)', cursor: 'pointer', display: 'grid', placeItems: 'center' }}><X size={18} strokeWidth={1.8} /></button>
                        </div>

                        {/* Stepper */}
                        <div style={{ padding: '20px 24px 0', display: 'flex' }}>
                            {[['1', 'Pedido'], ['2', 'Productos'], ['3', 'Reembolso']].map(([n, l], i) => {
                                const a = step === i + 1, dn = step > i + 1
                                return (
                                    <div key={n} style={{ display: 'flex', alignItems: 'center', flex: i < 2 ? 1 : 'none' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                            <span style={{ width: 26, height: 26, borderRadius: '50%', background: dn ? 'var(--color-success)' : a ? 'var(--color-primary)' : 'var(--color-surface-alt)', color: dn || a ? '#fff' : 'var(--color-muted)', display: 'grid', placeItems: 'center', fontSize: 11, fontWeight: 700, fontFamily: '"Geist Mono", monospace' }}>{dn ? <Check size={12} strokeWidth={2.6} /> : n}</span>
                                            <span style={{ fontSize: 12, fontWeight: a || dn ? 600 : 500, color: a || dn ? 'var(--color-text)' : 'var(--color-muted)' }}>{l}</span>
                                        </div>
                                        {i < 2 && <div style={{ flex: 1, height: 2, background: dn ? 'var(--color-success)' : 'var(--color-border)', margin: '0 10px' }} />}
                                    </div>
                                )
                            })}
                        </div>

                        {/* Drawer body */}
                        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
                            {step === 1 && (
                                <div>
                                    <div style={{ position: 'relative', marginBottom: 14 }}>
                                        <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-muted)' }} />
                                        <input value={q} onChange={e => setQ(e.target.value)} placeholder="# Pedido o nombre del cliente…" style={{ ...inputBase, height: 40, paddingLeft: 38, paddingRight: 12, fontSize: 13 }} />
                                    </div>
                                    {ped ? (
                                        <div style={{ background: 'var(--color-primary-bg)', border: '1px solid var(--color-primary)', borderRadius: 8, padding: 12, display: 'flex', alignItems: 'center', gap: 10 }}>
                                            <Avatar name={ped.cliente} size={36} />
                                            <div style={{ flex: 1 }}>
                                                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text)' }}>#{ped.id} · {ped.cliente}</div>
                                                <div style={{ fontSize: 12, color: 'var(--color-muted)', fontFamily: '"Geist Mono", monospace' }}>{fmtMoney(ped.monto)}</div>
                                            </div>
                                            <button onClick={() => { setPed(null); setSel([]) }} style={{ background: 'none', border: 'none', color: 'var(--color-primary)', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>Cambiar</button>
                                        </div>
                                    ) : (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                            {resultados.map(p => (
                                                <button key={p.id} onClick={() => { setPed(p); setStep(2) }} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 12, border: '1px solid var(--color-border)', borderRadius: 8, background: 'var(--color-surface)', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' }}>
                                                    <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-primary)', fontFamily: '"Geist Mono", monospace' }}>#{p.id}</span>
                                                    <div style={{ flex: 1, minWidth: 0 }}>
                                                        <div style={{ fontSize: 13, color: 'var(--color-text)' }}>{p.cliente}</div>
                                                        <div style={{ fontSize: 11, color: 'var(--color-muted)', fontFamily: '"Geist Mono", monospace' }}>{fmtMoney(p.monto)}</div>
                                                    </div>
                                                    <Badge status={p.estado} size="sm" />
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}

                            {step === 2 && ped && (
                                <div>
                                    <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-text)', marginBottom: 12 }}>Seleccioná los productos a devolver</div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
                                        {ped.productos.map((pr, i) => {
                                            const on = sel.includes(i)
                                            return (
                                                <button key={i} onClick={() => setSel(s => on ? s.filter(x => x !== i) : [...s, i])} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 12, border: `1px solid ${on ? 'var(--color-primary)' : 'var(--color-border)'}`, borderRadius: 8, background: on ? 'var(--color-primary-bg)' : 'var(--color-surface)', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' }}>
                                                    <span style={{ width: 18, height: 18, borderRadius: 5, border: `1.5px solid ${on ? 'var(--color-primary)' : 'var(--color-border)'}`, background: on ? 'var(--color-primary)' : 'transparent', display: 'grid', placeItems: 'center', flexShrink: 0 }}>{on && <Check size={11} strokeWidth={3} color="#fff" />}</span>
                                                    <ProductoThumb hue={pr.hue} size={38} />
                                                    <div style={{ flex: 1, minWidth: 0 }}>
                                                        <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-text)' }}>{pr.nombre}</div>
                                                        <div style={{ fontSize: 11, color: 'var(--color-muted)', fontFamily: '"Geist Mono", monospace' }}>{pr.cantidad} u · {fmtMoney(pr.precio)}</div>
                                                    </div>
                                                </button>
                                            )
                                        })}
                                    </div>
                                    <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--color-body)', display: 'block', marginBottom: 6 }}>Motivo de la devolución</label>
                                    <select value={motivo} onChange={e => setMotivo(e.target.value)} style={{ ...inputBase, height: 40, padding: '0 12px', fontSize: 13, marginBottom: 14, cursor: 'pointer' }}>
                                        <option value="">Elegí un motivo…</option>
                                        {MOTIVOS.map(m => <option key={m} value={m}>{m}</option>)}
                                    </select>
                                    <textarea placeholder="Descripción adicional (opcional)" rows={3} style={{ ...inputBase, resize: 'vertical', minHeight: 64, padding: '10px 12px', fontSize: 13 }} />
                                </div>
                            )}

                            {step === 3 && ped && (
                                <div>
                                    <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-text)', marginBottom: 12 }}>Método de reembolso</div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
                                        {([['nota_credito', 'Nota de crédito', 'Saldo para su próxima compra', true], ['reembolso', 'Reembolso', 'Devolver el dinero a la cuenta original', false]] as [MetodoReembolso, string, string, boolean][]).map(([id, l, d, rec]) => {
                                            const a = metodo === id
                                            return (
                                                <button key={id} onClick={() => setMetodo(id)} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: 14, border: `${a ? 2 : 1}px solid ${a ? 'var(--color-primary)' : 'var(--color-border)'}`, borderRadius: 10, background: a ? 'var(--color-primary-bg)' : 'var(--color-surface)', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' }}>
                                                    <span style={{ width: 18, height: 18, borderRadius: '50%', border: `1.5px solid ${a ? 'var(--color-primary)' : 'var(--color-border)'}`, display: 'grid', placeItems: 'center', flexShrink: 0, marginTop: 2 }}>{a && <span style={{ width: 9, height: 9, borderRadius: '50%', background: 'var(--color-primary)' }} />}</span>
                                                    <div style={{ flex: 1 }}>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text)' }}>{l}</span>
                                                            {rec && <span style={{ display: 'inline-flex', alignItems: 'center', height: 18, padding: '0 8px', borderRadius: 9999, background: 'var(--color-success-bg)', color: 'var(--color-success)', fontSize: 10, fontWeight: 600 }}>Más rápido</span>}
                                                        </div>
                                                        <div style={{ fontSize: 12, color: 'var(--color-muted)', marginTop: 2 }}>{d}</div>
                                                    </div>
                                                </button>
                                            )
                                        })}
                                    </div>
                                    <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 8, padding: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <span style={{ fontSize: 13, color: 'var(--color-muted)' }}>{sel.length || 1} producto(s) · monto a devolver</span>
                                        <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--color-text)', fontFamily: '"Geist Mono", monospace' }}>{fmtMoney(totalDev || ped.monto)}</span>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Drawer footer */}
                        <div style={{ height: 72, padding: '0 24px', borderTop: '1px solid var(--color-border)', display: 'flex', gap: 10, alignItems: 'center' }}>
                            <Button variant="outline" style={{ flex: 1, justifyContent: 'center' }} onClick={() => step > 1 ? setStep(step - 1) : setDrawer(false)}>{step > 1 ? '← Volver' : 'Cancelar'}</Button>
                            {step < 3
                                ? <Button variant="primary" style={{ flex: 1, justifyContent: 'center' }} disabled={step === 1 ? !ped : sel.length === 0 || !motivo} onClick={() => setStep(step + 1)}>Continuar →</Button>
                                : <Button variant="primary" style={{ flex: 1, justifyContent: 'center' }} onClick={registrar}>Registrar devolución</Button>}
                        </div>
                    </div>
                </>
            )}

            <ModalComprobante isOpen={comprobante !== null} onClose={() => setComprobante(null)} tipo="devolución" id={comprobante ?? undefined} />
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
