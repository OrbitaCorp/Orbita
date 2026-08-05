// Sidebar del panel admin — diseño del prototipo "Panel Admin 34":
// logo orbital, botón "Publicar tienda", buscador con resultados en vivo y
// módulos expandibles con badges, dots de alerta y sub-secciones.

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/router'
import { LayoutDashboard, ShoppingBag, Users, Package, MessageSquare, Tag, Settings, Search, Globe, ChevronDown, Check, Scissors, UtensilsCrossed, Briefcase, Store } from 'lucide-react'
import type { ComponentType } from 'react'

import { MOCK_PEDIDOS } from '@/modules/ventas/panel/pedidos/mock/pedidos.mock'
import { MOCK_CLIENTES } from '@/modules/ventas/panel/clientes/mock/clientes.mock'
import { panelListProducts, type ApiProductRow } from '@/lib/api'
import { fmtMoney } from '@/lib/utils'

type IconType = ComponentType<{ size?: number; strokeWidth?: number; style?: React.CSSProperties }>
interface Sub { label: string; seccion: string; vista?: string }
interface Modulo { id: string; label: string; Icon: IconType; seccion: string; badge?: number; alert?: boolean; subs?: Sub[] }

const RUBROS = [
    { id: 'tienda',     label: 'Tienda',      desc: 'E-commerce y retail',     Icon: Store,           color: '#2563EB', bg: 'rgba(37,99,235,0.10)'  },
    { id: 'peluqueria', label: 'Peluquería',  desc: 'Turnos y servicios',      Icon: Scissors,        color: '#7C3AED', bg: 'rgba(124,58,237,0.10)' },
    { id: 'gastro',     label: 'Gastronomía', desc: 'Mesas y delivery',        Icon: UtensilsCrossed, color: '#DC2626', bg: 'rgba(220,38,38,0.10)'  },
    { id: 'servicios',  label: 'Servicios',   desc: 'Agendas y presupuestos',  Icon: Briefcase,       color: '#059669', bg: 'rgba(5,150,105,0.10)'  },
]

const MODULOS: Modulo[] = [
    { id: 'dashboard', label: 'Dashboard', Icon: LayoutDashboard, seccion: 'dashboard' },
    {
        id: 'pedidos', label: 'Pedidos', Icon: ShoppingBag, seccion: 'pedidos', badge: 4, alert: true,
        subs: [
            { label: 'Lista', seccion: 'pedidos' },
            { label: 'Historial', seccion: 'pedidos', vista: 'historial' },
            { label: 'Postventa', seccion: 'pedidos', vista: 'devoluciones' },
            { label: 'Nuevo +', seccion: 'pedidos', vista: 'nuevo' },
        ],
    },
    {
        id: 'clientes', label: 'Clientes', Icon: Users, seccion: 'clientes',
        subs: [
            { label: 'Lista', seccion: 'clientes' },
            { label: 'Reporte de clientes', seccion: 'reportes', vista: 'clientes' },
        ],
    },
    {
        id: 'productos', label: 'Productos', Icon: Package, seccion: 'catalogo',
        subs: [
            { label: 'Lista de productos', seccion: 'catalogo' },
            { label: 'Crear producto', seccion: 'catalogo', vista: 'nuevo' },
            { label: 'Categorías', seccion: 'categorias' },
            { label: 'Reporte de productos', seccion: 'reportes', vista: 'productos' },
        ],
    },
    {
        id: 'mensajes', label: 'Mensajes', Icon: MessageSquare, seccion: 'mensajes', badge: 3, alert: true,
        subs: [
            { label: 'Bandeja', seccion: 'mensajes' },
            { label: 'Plantillas', seccion: 'mensajes', vista: 'plantillas' },
        ],
    },
    {
        id: 'descuentos', label: 'Descuentos', Icon: Tag, seccion: 'descuentos',
        subs: [
            { label: 'Descuentos',  seccion: 'descuentos' },
            { label: 'Cupones',     seccion: 'cupones' },
            { label: 'Rendimiento', seccion: 'descuentos', vista: 'metricas' },
        ],
    },
    {
        id: 'config', label: 'Configuración', Icon: Settings, seccion: 'configuracion',
        subs: [
            { label: 'General', seccion: 'configuracion' },
            { label: 'Apariencia', seccion: 'configuracion', vista: 'apariencia' },
            { label: 'Equipo', seccion: 'configuracion', vista: 'equipo' },
            { label: 'Notificaciones', seccion: 'configuracion', vista: 'notificaciones' },
        ],
    },
]

const SECCION_MODULO: Record<string, string> = {
    dashboard: 'dashboard', pedidos: 'pedidos', clientes: 'clientes',
    catalogo: 'productos', categorias: 'productos', inventario: 'productos', reportes: 'productos',
    mensajes: 'mensajes', descuentos: 'descuentos', cupones: 'descuentos', configuracion: 'config',
}

interface Props { isOpen: boolean; onClose: () => void }

export default function Sidebar({ isOpen, onClose }: Props) {
    const router     = useRouter()
    const negocioId  = (router.query.negocioId  as string) ?? 'rama-tienda'
    const seccion    = (router.query.seccion     as string) ?? 'dashboard'
    const vista      = (router.query.vista       as string) ?? ''

    const moduloActivo = seccion === 'reportes'
        ? (vista === 'clientes' ? 'clientes' : 'productos')
        : SECCION_MODULO[seccion] ?? 'dashboard'

    const [abierto,   setAbierto]   = useState(moduloActivo)
    const [busqueda,  setBusqueda]  = useState('')
    const [publicada, setPublicada] = useState(false)
    const [rubroId,   setRubroId]   = useState('tienda')
    const [rubroOpen, setRubroOpen] = useState(false)

    // Sincronizar módulo abierto al navegar
    useEffect(() => { setAbierto(moduloActivo) }, [moduloActivo])

    const rubroActual = RUBROS.find(r => r.id === rubroId)!

    const ir = (sec: string, v?: string) => {
        const query: Record<string, string> = { negocioId, moduloPadre: 'ventas', seccion: sec }
        if (v) query.vista = v
        router.push({ pathname: '/admin/[negocioId]/[moduloPadre]/[seccion]', query })
        onClose()
    }

    // Los productos salen del catálogo real (el backend busca por nombre y SKU);
    // pedidos y clientes todavía usan datos de ejemplo.
    const [productosBusq, setProductosBusq] = useState<ApiProductRow[]>([])
    useEffect(() => {
        const q = busqueda.trim()
        if (!q) { setProductosBusq([]); return }
        let vigente = true
        const t = setTimeout(() => {
            panelListProducts({ search: q, limit: 3 })
                .then(r => { if (vigente) setProductosBusq(r.data) })
                .catch(() => { if (vigente) setProductosBusq([]) })
        }, 350)
        return () => { vigente = false; clearTimeout(t) }
    }, [busqueda])

    const resultados = useMemo(() => {
        const q = busqueda.trim().toLowerCase()
        if (!q) return null
        return {
            pedidos:   MOCK_PEDIDOS.filter(p => p.cliente.toLowerCase().includes(q) || p.id.includes(q)).slice(0, 3),
            clientes:  MOCK_CLIENTES.filter(c => c.nombre.toLowerCase().includes(q) || c.email.toLowerCase().includes(q)).slice(0, 2),
            productos: productosBusq,
        }
    }, [busqueda, productosBusq])

    const subActiva = (m: Modulo, s: Sub) => {
        if (seccion !== s.seccion) return false
        // "Postventa" agrupa dos vistas (devoluciones y notas de crédito):
        // a efectos del resaltado, notas cuenta como devoluciones.
        const v = seccion === 'pedidos' && vista === 'notas' ? 'devoluciones' : (vista || '')
        if (s.vista) return v === s.vista
        const siblingsWithVista = (m.subs ?? []).filter(sub => sub.seccion === s.seccion && sub.vista)
        return !siblingsWithVista.some(sub => v === sub.vista)
    }

    return (
        <>
            <style>{`
                .admin-sidebar {
                    position: relative;
                    transform: none;
                    transition: transform 280ms cubic-bezier(0.4, 0, 0.2, 1),
                                box-shadow 280ms ease;
                }
                @media (max-width: 768px) {
                    .admin-sidebar {
                        position: fixed !important;
                        left: 0; top: 0;
                        height: 100vh !important;
                        z-index: 50;
                        transform: translateX(-100%);
                        box-shadow: none;
                    }
                    .admin-sidebar.sidebar-open {
                        transform: translateX(0);
                        box-shadow: 8px 0 32px rgba(0,0,0,0.25);
                    }
                }
            `}</style>

            <aside
                className={`admin-sidebar flex flex-col w-60 shrink-0 h-full${isOpen ? ' sidebar-open' : ''}`}
                style={{ background: 'var(--color-bg)', borderRight: '1px solid var(--color-border)' }}
            >
                {/* Logo */}
                <div className="flex items-center gap-2.5 h-14 px-4 shrink-0" style={{ borderBottom: '1px solid var(--color-border)' }}>
                    <OrbitLogo />
                    <span className="text-[15px] font-bold" style={{ color: 'var(--color-text)' }}>Orbita</span>
                </div>

                {/* Publicar tienda */}
                <button
                    onClick={() => { setPublicada(true); window.open(`/tienda/${negocioId}`, '_blank', 'noopener') }}
                    className="flex items-center justify-center gap-2 mx-3 mt-3 h-9 rounded-lg text-[13px] font-semibold cursor-pointer"
                    style={{ border: 'none', color: '#fff', background: publicada ? 'linear-gradient(135deg,#059669,#10B981)' : 'linear-gradient(135deg,#10B981,#059669)' }}
                >
                    <Globe size={14} strokeWidth={1.6} /> {publicada ? '✓ Tienda online' : 'Publicar tienda'}
                </button>
                <a
                    href={`/tienda/${negocioId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mx-3 mt-1.5 text-center text-[10px] no-underline"
                    style={{ color: 'var(--color-subtle)', fontFamily: '"Geist Mono", monospace' }}
                    onMouseEnter={e => (e.currentTarget.style.color = 'var(--color-primary)')}
                    onMouseLeave={e => (e.currentTarget.style.color = 'var(--color-subtle)')}
                >
                    /tienda/{negocioId} ↗
                </a>

                {/* Selector de rubro */}
                <div style={{ margin: '10px 12px 4px', position: 'relative' }}>
                    <button
                        onClick={() => setRubroOpen(o => !o)}
                        style={{
                            width: '100%', height: 36, padding: '0 10px',
                            borderRadius: 8, cursor: 'pointer',
                            border: `1px solid ${rubroOpen ? rubroActual.color + '55' : 'var(--color-border)'}`,
                            background: rubroOpen ? rubroActual.bg : 'var(--color-surface)',
                            display: 'flex', alignItems: 'center', gap: 8,
                            transition: 'all 180ms',
                        }}
                    >
                        <div style={{ width: 22, height: 22, borderRadius: 6, flexShrink: 0, background: rubroActual.bg, border: `1px solid ${rubroActual.color}33`, display: 'grid', placeItems: 'center' }}>
                            <rubroActual.Icon size={12} strokeWidth={2} color={rubroActual.color} />
                        </div>
                        <div style={{ flex: 1, textAlign: 'left' }}>
                            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-text)', lineHeight: 1.2 }}>{rubroActual.label}</div>
                            <div style={{ fontSize: 9, color: 'var(--color-subtle)', lineHeight: 1.2 }}>{rubroActual.desc}</div>
                        </div>
                        <ChevronDown size={12} strokeWidth={2} color="var(--color-muted)" style={{ transition: 'transform 200ms', transform: rubroOpen ? 'rotate(180deg)' : 'rotate(0deg)', flexShrink: 0 }} />
                    </button>

                    {rubroOpen && (
                        <div style={{ position: 'absolute', left: 0, right: 0, top: 'calc(100% + 4px)', zIndex: 60, borderRadius: 10, overflow: 'hidden', background: 'var(--color-bg)', border: '1px solid var(--color-border)', boxShadow: '0 8px 28px rgba(0,0,0,0.15)' }}>
                            {RUBROS.map((r, idx) => {
                                const sel = r.id === rubroId
                                return (
                                    <button
                                        key={r.id}
                                        onClick={() => { setRubroId(r.id); setRubroOpen(false) }}
                                        style={{ width: '100%', padding: '9px 10px', display: 'flex', alignItems: 'center', gap: 9, border: 'none', borderBottom: idx < RUBROS.length - 1 ? '1px solid var(--color-border)' : 'none', cursor: 'pointer', background: sel ? r.bg : 'transparent', transition: 'background 120ms' }}
                                        onMouseEnter={e => { if (!sel) e.currentTarget.style.background = 'var(--color-surface)' }}
                                        onMouseLeave={e => { if (!sel) e.currentTarget.style.background = 'transparent' }}
                                    >
                                        <div style={{ width: 28, height: 28, borderRadius: 7, flexShrink: 0, background: r.bg, border: `1px solid ${r.color}33`, display: 'grid', placeItems: 'center' }}>
                                            <r.Icon size={14} strokeWidth={1.8} color={r.color} />
                                        </div>
                                        <div style={{ flex: 1, textAlign: 'left' }}>
                                            <div style={{ fontSize: 12, fontWeight: sel ? 700 : 500, color: sel ? r.color : 'var(--color-text)', lineHeight: 1.2 }}>{r.label}</div>
                                            <div style={{ fontSize: 10, color: 'var(--color-subtle)', lineHeight: 1.3 }}>{r.desc}</div>
                                        </div>
                                        {sel && <Check size={13} strokeWidth={2.5} color={r.color} />}
                                    </button>
                                )
                            })}
                        </div>
                    )}
                </div>

                {/* Buscador */}
                <div className="relative mx-3 mt-2 mb-1">
                    <Search size={13} strokeWidth={1.6} className="absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--color-muted)' }} />
                    <input
                        value={busqueda}
                        onChange={e => setBusqueda(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Escape') setBusqueda('') }}
                        placeholder="Buscar pedidos, clientes..."
                        className="w-full h-8 pl-7 pr-2.5 text-xs rounded-md outline-none"
                        style={{ background: 'var(--color-surface-alt)', border: '1px solid var(--color-border)', color: 'var(--color-text)' }}
                    />
                    {resultados && (
                        <div className="absolute left-0 right-0 z-50 mt-1 p-1.5 rounded-lg overflow-y-auto" style={{ top: '100%', maxHeight: 340, background: 'var(--color-bg)', border: '1px solid var(--color-border)', boxShadow: '0 12px 32px rgba(15,23,42,0.16)' }}>
                            {resultados.pedidos.length   > 0 && <><div style={resLabel}>PEDIDOS</div>  {resultados.pedidos.map(p   => <button key={p.id} onClick={() => { ir('pedidos', 'detalle'); setBusqueda('') }} style={resItem}>#{p.id} · {p.cliente} · {fmtMoney(p.monto)}</button>)}</>}
                            {resultados.clientes.length  > 0 && <><div style={resLabel}>CLIENTES</div> {resultados.clientes.map(c  => <button key={c.id} onClick={() => { ir('clientes', 'detalle'); setBusqueda('') }} style={resItem}>{c.nombre} · {c.pedidos} pedidos</button>)}</>}
                            {resultados.productos.length > 0 && <><div style={resLabel}>PRODUCTOS</div>{resultados.productos.map(p => <button key={p.id} onClick={() => { ir('catalogo'); setBusqueda('') }} style={resItem}>{p.name} · Stock {p.totalStock}</button>)}</>}
                            {resultados.pedidos.length + resultados.clientes.length + resultados.productos.length === 0 && <div className="p-3 text-xs text-center" style={{ color: 'var(--color-muted)' }}>Sin resultados</div>}
                        </div>
                    )}
                </div>

                {/* Nav */}
                <nav className="flex-1 overflow-y-auto px-2 pb-3 flex flex-col gap-0.5">
                    {MODULOS.map(m => {
                        const activo = moduloActivo === m.id
                        const open   = abierto === m.id
                        const subs   = m.subs ?? []
                        return (
                            <div key={m.id}>
                                <button
                                    onClick={() => { ir(m.seccion); setAbierto(m.id) }}
                                    className="flex items-center gap-2.5 w-full h-9 px-2.5 rounded-md cursor-pointer text-[13px]"
                                    style={{ border: 'none', background: activo ? 'var(--color-primary-bg)' : 'transparent', color: activo ? 'var(--color-primary)' : 'var(--color-body)', fontWeight: activo ? 600 : 500 }}
                                    onMouseEnter={e => { if (!activo) e.currentTarget.style.background = 'var(--color-surface-alt)' }}
                                    onMouseLeave={e => { if (!activo) e.currentTarget.style.background = 'transparent' }}
                                >
                                    <m.Icon size={16} strokeWidth={1.6} />
                                    <span className="flex-1 text-left">{m.label}</span>
                                    {m.alert && <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--color-error)' }} />}
                                    {m.badge && <span className="grid place-items-center text-[10px] font-bold" style={{ minWidth: 18, height: 18, padding: '0 5px', borderRadius: 9999, fontFamily: '"Geist Mono", monospace', background: activo ? 'var(--color-primary)' : 'var(--color-surface-alt)', color: activo ? '#fff' : 'var(--color-muted)' }}>{m.badge}</span>}
                                </button>

                                {open && subs.length > 0 && (
                                    <div className="flex flex-col gap-px mt-0.5" style={{ paddingLeft: 20 }}>
                                        {subs.map(s => {
                                            const sa = subActiva(m, s)
                                            return (
                                                <button
                                                    key={s.label}
                                                    onClick={() => ir(s.seccion, s.vista)}
                                                    className="h-[30px] px-2 rounded-md text-left cursor-pointer text-xs"
                                                    style={{ border: 'none', fontWeight: sa ? 600 : 500, color: sa ? 'var(--color-primary)' : 'var(--color-muted)', background: sa ? 'var(--color-primary-bg)' : 'transparent' }}
                                                    onMouseEnter={e => { if (!sa) e.currentTarget.style.color = 'var(--color-body)' }}
                                                    onMouseLeave={e => { if (!sa) e.currentTarget.style.color = 'var(--color-muted)' }}
                                                >
                                                    {s.label}
                                                </button>
                                            )
                                        })}
                                    </div>
                                )}
                            </div>
                        )
                    })}
                </nav>
            </aside>
        </>
    )
}

function OrbitLogo() {
    return (
        <div style={{ width: 26, height: 26, borderRadius: 7, background: 'linear-gradient(135deg,#2563EB,#3B82F6)', display: 'grid', placeItems: 'center', position: 'relative', flexShrink: 0 }}>
            <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#fff' }} />
            <div style={{ position: 'absolute', inset: 3, border: '1px solid rgba(255,255,255,0.5)', borderRadius: '50%' }} />
        </div>
    )
}

const resLabel: React.CSSProperties = { fontSize: 10, fontWeight: 700, color: 'var(--color-subtle)', textTransform: 'uppercase', letterSpacing: '0.05em', padding: '8px 8px 4px' }
const resItem:  React.CSSProperties = { width: '100%', textAlign: 'left', padding: '8px', border: 'none', background: 'transparent', borderRadius: 6, cursor: 'pointer', fontFamily: 'inherit', fontSize: 12, color: 'var(--color-body)' }
