// src/modules/propuestas/prototipos/Libreta.tsx — Prototipo interactivo de
// "La Libreta" (propuesta 02): el fiado del almacén, digital. Tres columnas
// que reaccionan entre sí: el panel del dueño (Clientes / POS), la libreta
// de papel y el celular de la clienta. DEMO INTERNA, autocontenida: sin
// fetch, sin storage, todo el estado vive en este componente.

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import {
  AlertTriangle, Banknote, BookOpen, Check, CheckCircle2, Clock, CreditCard, Loader2,
  MessageCircle, Minus, Plus, RotateCcw, ShieldCheck, ShoppingCart, Sparkles, Store, Users,
} from 'lucide-react'
import { C, FONT, FONT_DISPLAY, FONT_MONO, Tarjeta, Chip, Boton, Etiqueta, Pantalla, formatoARS } from '../ui'

// ─── Datos de la demo ────────────────────────────────────────────────────────

const ACENTO = '#F59E0B'
const ACENTO_OSCURO = '#B45309'
const MP = '#009EE3'
const WSP = '#25D366'
const TINTA = '#1E3A8A'
const FONT_HAND = '"Segoe Script", "Bradley Hand", "Brush Script MT", "Comic Sans MS", cursive'
const NEGOCIO = 'Almacén Don Pepe'
const NUMERO = '0038'
const HOY = 4 // 4 de septiembre: "hoy" en la demo

const PRODUCTOS = [
  { id: 'yerba', nombre: 'Yerba Playadito 1kg', corto: 'Yerba', precio: 4200, emoji: '🧉' },
  { id: 'leche', nombre: 'Leche La Serenísima', corto: 'Leche', precio: 1650, emoji: '🥛' },
  { id: 'pan', nombre: 'Pan lactal', corto: 'Pan lactal', precio: 2900, emoji: '🍞' },
  { id: 'aceite', nombre: 'Aceite', corto: 'Aceite', precio: 3800, emoji: '🫒' },
  { id: 'fideos', nombre: 'Fideos', corto: 'Fideos', precio: 1400, emoji: '🍝' },
  { id: 'azucar', nombre: 'Azúcar', corto: 'Azúcar', precio: 1900, emoji: '🍚' },
]

const CLIENTES = [
  { id: 'marta', nombre: 'Marta Giménez', desde: 'compra hace 3 años', compras: 142, confianza: true },
  { id: 'lucas', nombre: 'Lucas Ferreyra', desde: 'compra hace 8 meses', compras: 23, confianza: false },
  { id: 'noelia', nombre: 'Noelia Battistelli', desde: 'compra hace 1 año', compras: 51, confianza: false },
]

const DIAS_CIERRE = [1, 10, 15, 30]
const PUNTAJE_INICIAL = 72
const PUNTAJE_FINAL = 81

type Tab = 'clientes' | 'pos'
type Medio = 'efectivo' | 'mp' | 'libreta'
type Movimiento = { id: number; dia: number; detalle: string; monto: number; tipo: 'compra' | 'nota' }
type Toast = { id: number; texto: string; color: string }
type EstadoWsp = 'nada' | 'escribiendo' | 'llego' | 'leida'
type EstadoPago = 'nada' | 'procesando' | 'pagada'

const CSS = `
  @keyframes lb-write { from { clip-path: inset(0 100% 0 0); } to { clip-path: inset(0 -2% 0 0); } }
  @keyframes lb-ink { from { opacity: 0; transform: translateY(3px) rotate(-2deg); } to { opacity: 1; transform: none; } }
  @keyframes lb-stamp { 0% { transform: translate(-50%,-50%) rotate(-14deg) scale(2.8); opacity: 0; } 55% { transform: translate(-50%,-50%) rotate(-14deg) scale(.9); opacity: 1; } 100% { transform: translate(-50%,-50%) rotate(-14deg) scale(1); opacity: 1; } }
  @keyframes lb-drop { from { opacity: 0; transform: translateY(-18px); } to { opacity: 1; transform: none; } }
  @keyframes lb-sheet { from { opacity: 0; transform: translateY(40px); } to { opacity: 1; transform: none; } }
  @keyframes lb-pop { 0% { opacity: 0; transform: translateY(8px) scale(.96); } 100% { opacity: 1; transform: none; } }
  @keyframes lb-shake { 0%,100% { transform: translateX(0); } 20% { transform: translateX(-5px); } 60% { transform: translateX(5px); } }
  @keyframes lb-open { from { opacity: 0; transform: rotate(-7deg) translateY(24px) scale(.94); } to { opacity: 1; transform: rotate(-1.2deg) translateY(0) scale(1); } }
  @keyframes lb-bump { 0% { transform: scale(1); } 40% { transform: scale(1.25); } 100% { transform: scale(1); } }
  @keyframes lb-glow { 0%,100% { box-shadow: 0 0 0 0 rgba(245,158,11,0); } 50% { box-shadow: 0 0 0 7px rgba(245,158,11,.22); } }
  @keyframes lb-pen { 0%,100% { transform: rotate(0deg); } 50% { transform: rotate(-8deg) translateY(1px); } }
  .lb-grid { display: grid; grid-template-columns: minmax(0, 1fr) 300px 320px; gap: 20px; align-items: start; }
  @media (max-width: 1100px) { .lb-grid { grid-template-columns: 1fr; } }
  .lb-prod { transition: transform .15s, box-shadow .15s, border-color .15s; cursor: pointer; }
  .lb-prod:hover { transform: translateY(-2px); box-shadow: 0 8px 20px rgba(15,23,42,.10); border-color: #CBD5E1 !important; }
  .lb-prod:active { transform: scale(.97); }
  .lb-tab { transition: background .15s, color .15s; cursor: pointer; }
  .lb-tab:hover { background: #EEF2F7; }
  .lb-range { width: 100%; accent-color: ${ACENTO}; cursor: pointer; }
  @media (prefers-reduced-motion: reduce) { .lb-anim { animation: none !important; } }
`

// ─── Helpers ─────────────────────────────────────────────────────────────────

function mensajeApertura(tope: number, diaCierre: number) {
  return `Hola Marta! En ${NEGOCIO} te abrimos una libreta con tope de ${formatoARS(tope)}. Comprás cuando quieras, en el local o en la tienda, y pagás todo junto el día ${diaCierre}. Vela acá: orbita.ar/l/${NUMERO}`
}

function mensajeCierre(saldo: number) {
  return `Hola Marta, hoy cierra tu libreta: ${formatoARS(saldo)}. Pagás cuando puedas desde acá: orbita.ar/l/${NUMERO}. Gracias por la confianza!`
}

function topeSugerido(tope: number) {
  return Math.round((tope * 1.375) / 5000) * 5000
}

function Ink({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return <span style={{ fontFamily: FONT_HAND, color: TINTA, ...style }}>{children}</span>
}

// ─── Componente principal ────────────────────────────────────────────────────

export default function Libreta() {
  const [tab, setTab] = useState<Tab>('clientes')
  const [modal, setModal] = useState(false)
  const [tope, setTope] = useState(40000)
  const [diaCierre, setDiaCierre] = useState(10)
  const [abierta, setAbierta] = useState(false)
  const [ticket, setTicket] = useState<Record<string, number>>({})
  const [medio, setMedio] = useState<Medio>('efectivo')
  const [movs, setMovs] = useState<Movimiento[]>([])
  const [dia, setDia] = useState(HOY)
  const [avisoTope, setAvisoTope] = useState<number | null>(null)
  const [cerrada, setCerrada] = useState(false)
  const [wsp, setWsp] = useState<EstadoWsp>('nada')
  const [pago, setPago] = useState<EstadoPago>('nada')
  const [toasts, setToasts] = useState<Toast[]>([])
  const [notifCel, setNotifCel] = useState<string | null>(null)
  const [pantallaCel, setPantallaCel] = useState<'perfil' | 'libreta'>('perfil')

  const timers = useRef<number[]>([])
  const ids = useRef(1)

  useEffect(() => {
    const lista = timers.current
    return () => { lista.forEach(t => window.clearTimeout(t)) }
  }, [])

  const programar = (fn: () => void, ms: number) => {
    timers.current.push(window.setTimeout(fn, ms))
  }

  const avisar = (texto: string, color = C.success) => {
    const id = ids.current++
    setToasts(ts => [...ts, { id, texto, color }])
    programar(() => setToasts(ts => ts.filter(t => t.id !== id)), 3400)
  }

  // Derivados
  const total = PRODUCTOS.reduce((a, p) => a + (ticket[p.id] ?? 0) * p.precio, 0)
  const saldoBruto = movs.reduce((a, m) => a + (m.tipo === 'compra' ? m.monto : 0), 0)
  const pagada = pago === 'pagada'
  const saldo = pagada ? 0 : saldoBruto
  const diasParaCierre = cerrada ? 0 : ((diaCierre - dia + 30) % 30 || 30)
  const paso = !abierta ? 1 : pagada ? 4 : cerrada ? 3 : 2
  const libretaDisponible = abierta && !cerrada && !pagada
  const puntaje = pagada ? PUNTAJE_FINAL : PUNTAJE_INICIAL

  // Acciones
  const reiniciar = () => {
    timers.current.forEach(t => window.clearTimeout(t))
    timers.current = []
    setTab('clientes'); setModal(false); setTope(40000); setDiaCierre(10); setAbierta(false)
    setTicket({}); setMedio('efectivo'); setMovs([]); setDia(HOY); setAvisoTope(null)
    setCerrada(false); setWsp('nada'); setPago('nada'); setToasts([]); setNotifCel(null); setPantallaCel('perfil')
  }

  const confirmarLibreta = () => {
    setAbierta(true)
    setModal(false)
    avisar(`Libreta N.º ${NUMERO} abierta para Marta`, ACENTO)
    setNotifCel(mensajeApertura(tope, diaCierre))
    programar(() => setPantallaCel('libreta'), 1500)
    programar(() => { setTab('pos'); setMedio('libreta') }, 1900)
    programar(() => setNotifCel(null), 5200)
  }

  const agregar = (id: string) => setTicket(t => ({ ...t, [id]: (t[id] ?? 0) + 1 }))
  const quitar = (id: string) => setTicket(t => {
    const q = (t[id] ?? 0) - 1
    const copia = { ...t }
    if (q <= 0) delete copia[id]; else copia[id] = q
    return copia
  })

  const anotar = (monto: number, topeVigente: number) => {
    const detalle = PRODUCTOS.filter(p => ticket[p.id]).map(p => `${ticket[p.id]}× ${p.corto}`).join(', ')
    const id = ids.current++
    setMovs(ms => [...ms, { id, dia, detalle, monto, tipo: 'compra' }])
    setTicket({})
    const ultimo = diaCierre > HOY ? diaCierre - 1 : 30
    setDia(d => Math.min(d + 1, ultimo))
    const nuevoSaldo = saldoBruto + monto
    avisar(`Anotado en la libreta de Marta: ${formatoARS(monto)} · va ${formatoARS(nuevoSaldo)} de ${formatoARS(topeVigente)}`, ACENTO)
  }

  const cobrar = () => {
    if (total === 0) return
    if (medio === 'libreta') {
      if (saldoBruto + total > tope) { setAvisoTope(total); return }
      anotar(total, tope)
      return
    }
    setTicket({})
    avisar(`Cobrado ${formatoARS(total)} en ${medio === 'efectivo' ? 'efectivo' : 'Mercado Pago'}`)
  }

  const subirTopeYAnotar = () => {
    if (avisoTope == null) return
    const nuevo = Math.max(tope + 10000, Math.ceil((saldoBruto + avisoTope) / 10000) * 10000)
    setTope(nuevo)
    const id = ids.current++
    setMovs(ms => [...ms, { id, dia, detalle: `Tope subido a ${formatoARS(nuevo)}`, monto: 0, tipo: 'nota' }])
    setAvisoTope(null)
    anotar(avisoTope, nuevo)
  }

  const avanzarCierre = () => {
    setCerrada(true)
    setWsp('escribiendo')
    programar(() => setWsp('llego'), 1500)
    avisar(`Día ${diaCierre}: se le mandó el resumen de cierre a Marta por WhatsApp`, C.primaryLight)
  }

  const pagar = () => {
    setPago('procesando')
    setWsp(w => (w === 'llego' ? 'leida' : w))
    programar(() => {
      setPago('pagada')
      avisar(`Marta saldó su libreta: ${formatoARS(saldoBruto)} · ya está en tu cuenta de MP`)
    }, 1700)
  }

  const PASOS = [
    { n: 1, t: 'Abrir la libreta' },
    { n: 2, t: 'Comprar a la libreta' },
    { n: 3, t: 'Cierre y pago' },
  ]

  return (
    <div style={{ padding: 26, minHeight: 600, color: C.text, fontFamily: FONT }}>
      <style>{CSS}</style>

      {/* Cabecera */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginBottom: 18 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ width: 40, height: 40, borderRadius: 12, display: 'grid', placeItems: 'center', background: `linear-gradient(135deg, ${ACENTO}, ${ACENTO_OSCURO})`, boxShadow: `0 8px 24px ${ACENTO}55` }}>
            <BookOpen size={20} color="#fff" />
          </span>
          <div>
            <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: 18, letterSpacing: '-0.01em' }}>{NEGOCIO} · la libreta de Marta</div>
            <div style={{ fontSize: 12.5, color: C.muted }}>Tocá los botones: el dueño, la libreta y la clienta reaccionan entre sí.</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          {PASOS.map(p => {
            const hecho = paso > p.n
            const actual = paso === p.n
            const col = hecho ? C.success : actual ? ACENTO : C.subtle
            return (
              <span key={p.n} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '6px 12px 6px 7px', borderRadius: 999, fontSize: 12.5, fontWeight: 700, color: actual || hecho ? C.text : C.muted, background: `${col}1A`, border: `1px solid ${col}55`, transition: 'all .3s', animation: actual ? 'lb-glow 2.2s ease-in-out infinite' : undefined }}>
                <span style={{ width: 20, height: 20, borderRadius: 99, display: 'grid', placeItems: 'center', background: col, color: '#0B1120', fontSize: 11, fontWeight: 800 }}>
                  {hecho ? <Check size={12} strokeWidth={3} /> : p.n}
                </span>
                {p.t}
              </span>
            )
          })}
          <Boton variante="fantasma" tam="sm" onClick={reiniciar} style={{ marginLeft: 6 }}><RotateCcw size={13} /> Reiniciar</Boton>
        </div>
      </div>

      {/* Tres columnas */}
      <div className="lb-grid">
        <section>
          <Etiqueta color={ACENTO} style={{ marginBottom: 8 }}>Lado del dueño · panel de Órbita</Etiqueta>
          <PanelDueno
            tab={tab} setTab={setTab}
            abierta={abierta} pagada={pagada} cerrada={cerrada}
            saldo={saldo} tope={tope} puntaje={puntaje}
            onAbrir={() => setModal(true)}
            modal={modal} cerrarModal={() => setModal(false)}
            topeTmp={tope} setTope={setTope} diaCierre={diaCierre} setDiaCierre={setDiaCierre}
            confirmar={confirmarLibreta}
            ticket={ticket} agregar={agregar} quitar={quitar} total={total}
            medio={medio} setMedio={setMedio} libretaDisponible={libretaDisponible}
            cobrar={cobrar}
            avisoTope={avisoTope} saldoBruto={saldoBruto}
            subirTope={subirTopeYAnotar} cobrarDeOtraForma={() => { setAvisoTope(null); setMedio('mp') }}
            toasts={toasts}
          />
        </section>

        <section>
          <Etiqueta color={ACENTO} style={{ marginBottom: 8 }}>La libreta · objeto físico</Etiqueta>
          <LibretaPapel abierta={abierta} tope={tope} diaCierre={diaCierre} movs={movs} saldoBruto={saldoBruto} pagada={pagada} diaPago={diaCierre} />
        </section>

        <section>
          <Etiqueta color={ACENTO} style={{ marginBottom: 8 }}>Lado de la clienta · su perfil</Etiqueta>
          <CelularCliente
            pantalla={pantallaCel} notif={notifCel}
            saldo={saldo} saldoBruto={saldoBruto} tope={tope} movs={movs}
            diasParaCierre={diasParaCierre} cerrada={cerrada} diaCierre={diaCierre}
            wsp={wsp} leerWsp={() => setWsp('leida')}
            pago={pago} pagar={pagar}
          />
          <div style={{ marginTop: 12, padding: '12px 14px', borderRadius: 14, border: `1px dashed ${C.borderStrong}`, background: 'rgba(15,23,42,.4)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: C.body }}>Simular el tiempo</div>
              <div style={{ fontSize: 11.5, color: C.subtle }}>
                {!abierta ? 'Primero abrile la libreta.' : saldoBruto === 0 ? 'Anotá al menos una compra.' : pagada ? 'Libreta saldada: ciclo terminado.' : cerrada ? `Hoy es ${diaCierre}/9: día de cierre.` : `Hoy es ${dia}/9 · cierra el ${diaCierre}/9.`}
              </div>
            </div>
            <Boton variante="suave" tam="sm" color={ACENTO} disabled={!abierta || saldoBruto === 0 || cerrada || pagada} onClick={avanzarCierre}>
              <Clock size={13} /> Avanzar al día de cierre
            </Boton>
          </div>
        </section>
      </div>

      <PieConfianza puntaje={puntaje} pagada={pagada} />
    </div>
  )
}

// ─── Panel del dueño ─────────────────────────────────────────────────────────

function PanelDueno(p: {
  tab: Tab; setTab: (t: Tab) => void
  abierta: boolean; pagada: boolean; cerrada: boolean
  saldo: number; tope: number; puntaje: number
  onAbrir: () => void
  modal: boolean; cerrarModal: () => void
  topeTmp: number; setTope: (n: number) => void; diaCierre: number; setDiaCierre: (n: number) => void
  confirmar: () => void
  ticket: Record<string, number>; agregar: (id: string) => void; quitar: (id: string) => void; total: number
  medio: Medio; setMedio: (m: Medio) => void; libretaDisponible: boolean
  cobrar: () => void
  avisoTope: number | null; saldoBruto: number
  subirTope: () => void; cobrarDeOtraForma: () => void
  toasts: Toast[]
}) {
  const tabs: { id: Tab; t: string; icono: ReactNode }[] = [
    { id: 'clientes', t: 'Clientes', icono: <Users size={14} /> },
    { id: 'pos', t: 'POS', icono: <ShoppingCart size={14} /> },
  ]
  return (
    <Pantalla tipo="panel">
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '8px 12px', borderBottom: '1px solid #E2E8F0', background: '#fff' }}>
        <span style={{ width: 22, height: 22, borderRadius: 7, background: `linear-gradient(135deg, ${C.primary}, ${C.orbi})`, marginRight: 8, display: 'grid', placeItems: 'center' }}>
          <span style={{ width: 8, height: 8, borderRadius: 99, background: '#fff' }} />
        </span>
        {tabs.map(t => (
          <button key={t.id} type="button" className="lb-tab" onClick={() => p.setTab(t.id)} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 9, border: 'none', fontFamily: FONT, fontSize: 13, fontWeight: 700, background: p.tab === t.id ? '#EFF6FF' : 'transparent', color: p.tab === t.id ? C.primary : '#475569' }}>
            {t.icono} {t.t}
          </button>
        ))}
        <span style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#64748B', fontWeight: 600 }}>
          <Store size={13} /> {NEGOCIO}
        </span>
      </div>

      <div style={{ position: 'relative', minHeight: 586, background: '#F8FAFC', overflow: 'hidden' }}>
        {p.tab === 'clientes' ? (
          <VistaClientes abierta={p.abierta} pagada={p.pagada} saldo={p.saldo} tope={p.tope} puntaje={p.puntaje} onAbrir={p.onAbrir} />
        ) : (
          <VistaPOS ticket={p.ticket} agregar={p.agregar} quitar={p.quitar} total={p.total} medio={p.medio} setMedio={p.setMedio} libretaDisponible={p.libretaDisponible} abierta={p.abierta} cerrada={p.cerrada} pagada={p.pagada} cobrar={p.cobrar} saldo={p.saldo} tope={p.tope} />
        )}

        {p.modal && (
          <ModalLibreta tope={p.topeTmp} setTope={p.setTope} diaCierre={p.diaCierre} setDiaCierre={p.setDiaCierre} cancelar={p.cerrarModal} confirmar={p.confirmar} />
        )}

        {p.avisoTope != null && (
          <Overlay>
            <div className="lb-anim" style={{ animation: 'lb-shake .45s ease both, pr-fade-up .4s both', background: '#fff', borderRadius: 16, padding: 20, width: '100%', maxWidth: 400, boxShadow: '0 30px 60px rgba(15,23,42,.35)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                <span style={{ width: 36, height: 36, borderRadius: 10, background: '#FEF3C7', display: 'grid', placeItems: 'center' }}><AlertTriangle size={18} color={ACENTO_OSCURO} /></span>
                <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: 16 }}>Marta llegó al tope</div>
              </div>
              <div style={{ fontSize: 13, color: '#475569', lineHeight: 1.5 }}>
                Tiene <b>{formatoARS(p.saldoBruto)}</b> anotados y este ticket son <b>{formatoARS(p.avisoTope)}</b>: pasaría el tope de <b>{formatoARS(p.tope)}</b>. Vos decidís.
              </div>
              <div style={{ display: 'grid', gap: 8, marginTop: 14 }}>
                <Boton color={ACENTO} onClick={p.subirTope}>
                  <Sparkles size={14} /> Subir tope a {formatoARS(Math.max(p.tope + 10000, Math.ceil((p.saldoBruto + p.avisoTope) / 10000) * 10000))} y anotar
                </Boton>
                <Boton variante="fantasma" onClick={p.cobrarDeOtraForma} style={{ color: '#475569', borderColor: '#CBD5E1' }}>Cobrar de otra forma</Boton>
              </div>
            </div>
          </Overlay>
        )}

        <div style={{ position: 'absolute', left: 12, right: 12, bottom: 12, display: 'grid', gap: 6, pointerEvents: 'none', zIndex: 20 }}>
          {p.toasts.map(t => (
            <div key={t.id} className="lb-anim" style={{ animation: 'lb-pop .35s cubic-bezier(.2,.8,.2,1) both', display: 'flex', alignItems: 'center', gap: 8, padding: '9px 12px', borderRadius: 12, background: '#0F172A', color: '#F8FAFC', fontSize: 12.5, fontWeight: 600, boxShadow: '0 12px 30px rgba(15,23,42,.35)', borderLeft: `3px solid ${t.color}` }}>
              <Check size={13} color={t.color} /> {t.texto}
            </div>
          ))}
        </div>
      </div>
    </Pantalla>
  )
}

function Overlay({ children }: { children: ReactNode }) {
  return (
    <div className="pr-fade-in" style={{ position: 'absolute', inset: 0, background: 'rgba(15,23,42,.45)', backdropFilter: 'blur(2px)', display: 'grid', placeItems: 'center', padding: 16, zIndex: 10 }}>
      {children}
    </div>
  )
}

function VistaClientes(p: { abierta: boolean; pagada: boolean; saldo: number; tope: number; puntaje: number; onAbrir: () => void }) {
  return (
    <div style={{ padding: 16 }} className="pr-fade-in">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 12 }}>
        <div>
          <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: 17 }}>Clientes</div>
          <div style={{ fontSize: 12, color: '#64748B' }}>Ordenados por confianza · los de arriba son los de siempre</div>
        </div>
        <span style={{ fontSize: 12, color: '#94A3B8', border: '1px solid #E2E8F0', borderRadius: 9, padding: '6px 10px', background: '#fff' }}>Buscar cliente…</span>
      </div>
      <div style={{ display: 'grid', gap: 8 }}>
        {CLIENTES.map((c, i) => {
          const esMarta = c.id === 'marta'
          return (
            <div key={c.id} className="pr-fade-up" style={{ animationDelay: `${i * 70}ms`, display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderRadius: 14, background: '#fff', border: `1px solid ${esMarta ? '#FDE68A' : '#E2E8F0'}`, boxShadow: esMarta ? '0 8px 24px rgba(245,158,11,.10)' : undefined }}>
              <span style={{ width: 40, height: 40, borderRadius: 99, display: 'grid', placeItems: 'center', fontWeight: 800, fontSize: 13, color: '#fff', background: esMarta ? `linear-gradient(135deg, ${ACENTO}, ${ACENTO_OSCURO})` : 'linear-gradient(135deg, #94A3B8, #64748B)', flexShrink: 0 }}>
                {c.nombre.split(' ').map(s => s[0]).join('')}
              </span>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{ fontWeight: 700, fontSize: 14 }}>{c.nombre}</span>
                  {c.confianza && <Chip color={ACENTO_OSCURO} style={{ background: '#FEF3C7', borderColor: '#FDE68A' }}><ShieldCheck size={11} /> Cliente de confianza</Chip>}
                </div>
                <div style={{ fontSize: 12, color: '#64748B', marginTop: 2 }}>
                  {c.desde} · {c.compras} compras{esMarta && <> · puntaje <b style={{ color: p.pagada ? '#059669' : '#334155' }}>{p.puntaje}</b></>}
                </div>
              </div>
              {esMarta ? (
                !p.abierta ? (
                  <Boton color={ACENTO} tam="sm" onClick={p.onAbrir} style={{ animation: 'lb-glow 2.2s ease-in-out infinite' }}><BookOpen size={14} /> Abrirle una libreta</Boton>
                ) : p.pagada ? (
                  <div style={{ textAlign: 'right' }}>
                    <Chip color="#059669" style={{ background: '#D1FAE5', borderColor: '#A7F3D0' }}><CheckCircle2 size={11} /> Libreta saldada</Chip>
                    <div style={{ fontSize: 11, color: '#64748B', marginTop: 4 }}>Tope sugerido {formatoARS(topeSugerido(p.tope))}</div>
                  </div>
                ) : (
                  <div style={{ textAlign: 'right', minWidth: 120 }}>
                    <div style={{ fontSize: 11, color: '#64748B', fontWeight: 600 }}>Libreta N.º {NUMERO}</div>
                    <div style={{ fontSize: 13, fontWeight: 800, fontFamily: FONT_MONO }}>{formatoARS(p.saldo)} <span style={{ color: '#94A3B8', fontWeight: 500 }}>/ {formatoARS(p.tope)}</span></div>
                    <div style={{ height: 5, borderRadius: 99, background: '#F1F5F9', marginTop: 4, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${Math.min(100, (p.saldo / p.tope) * 100)}%`, background: ACENTO, transition: 'width .6s cubic-bezier(.2,.8,.2,1)' }} />
                    </div>
                  </div>
                )
              ) : (
                <span style={{ fontSize: 12, color: '#CBD5E1' }}>—</span>
              )}
            </div>
          )
        })}
      </div>
      <div style={{ marginTop: 14, padding: '10px 12px', borderRadius: 12, background: '#FFFBEB', border: '1px solid #FDE68A', fontSize: 12, color: '#78350F', lineHeight: 1.5 }}>
        <b>No es un crédito.</b> La libreta formaliza la confianza que ya le tenés a un cliente: vos ponés el tope, vos asumís el riesgo, Órbita se encarga de anotar, recordar y cobrar.
      </div>
    </div>
  )
}

function ModalLibreta(p: { tope: number; setTope: (n: number) => void; diaCierre: number; setDiaCierre: (n: number) => void; cancelar: () => void; confirmar: () => void }) {
  return (
    <Overlay>
      <div className="pr-fade-up" style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 440, padding: 18, boxShadow: '0 30px 60px rgba(15,23,42,.35)' }}>
        <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: 17 }}>Abrirle una libreta a Marta</div>
        <div style={{ fontSize: 12.5, color: '#64748B', marginTop: 2 }}>Elegí hasta cuánto y qué día cierra. Marta lo recibe por WhatsApp.</div>

        <div style={{ marginTop: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: '#475569' }}>Tope de la libreta</span>
          <span key={p.tope} className="lb-anim" style={{ fontFamily: FONT_MONO, fontWeight: 800, fontSize: 22, color: ACENTO_OSCURO, animation: 'lb-bump .25s ease' }}>{formatoARS(p.tope)}</span>
        </div>
        <input type="range" className="lb-range" min={10000} max={100000} step={5000} value={p.tope} onChange={e => p.setTope(Number(e.target.value))} aria-label="Tope" />
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#94A3B8', fontFamily: FONT_MONO }}><span>$10.000</span><span>$100.000</span></div>

        <div style={{ marginTop: 12, fontSize: 12, fontWeight: 700, color: '#475569', marginBottom: 6 }}>Día de cierre</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
          {DIAS_CIERRE.map(d => (
            <button key={d} type="button" className="pr-btn" onClick={() => p.setDiaCierre(d)} style={{ padding: '8px 0', borderRadius: 10, border: `1px solid ${p.diaCierre === d ? ACENTO : '#E2E8F0'}`, background: p.diaCierre === d ? '#FEF3C7' : '#fff', color: p.diaCierre === d ? ACENTO_OSCURO : '#334155', fontFamily: FONT, fontWeight: 700, fontSize: 13 }}>
              {d}
            </button>
          ))}
        </div>

        <div style={{ marginTop: 14, fontSize: 12, fontWeight: 700, color: '#475569', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}><MessageCircle size={13} color={WSP} /> Así le llega a Marta</div>
        <div style={{ background: '#EFEAE2', borderRadius: 12, padding: 10 }}>
          <div style={{ background: '#fff', borderRadius: '2px 12px 12px 12px', padding: '8px 10px', fontSize: 12, color: '#111B21', lineHeight: 1.45, boxShadow: '0 1px 1px rgba(0,0,0,.08)', maxWidth: '92%' }}>
            {mensajeApertura(p.tope, p.diaCierre)}
            <div style={{ textAlign: 'right', fontSize: 10, color: '#8696A0', marginTop: 2 }}>10:32</div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, marginTop: 14, justifyContent: 'flex-end' }}>
          <Boton variante="fantasma" onClick={p.cancelar} style={{ color: '#475569', borderColor: '#CBD5E1' }}>Cancelar</Boton>
          <Boton color={ACENTO} onClick={p.confirmar}><Check size={15} /> Confirmar</Boton>
        </div>
      </div>
    </Overlay>
  )
}

function VistaPOS(p: {
  ticket: Record<string, number>; agregar: (id: string) => void; quitar: (id: string) => void; total: number
  medio: Medio; setMedio: (m: Medio) => void; libretaDisponible: boolean; abierta: boolean; cerrada: boolean; pagada: boolean
  cobrar: () => void; saldo: number; tope: number
}) {
  const items = PRODUCTOS.filter(x => p.ticket[x.id])
  const medios: { id: Medio; t: string; icono: ReactNode; off?: boolean }[] = [
    { id: 'efectivo', t: 'Efectivo', icono: <Banknote size={14} /> },
    { id: 'mp', t: 'Mercado Pago', icono: <CreditCard size={14} /> },
    { id: 'libreta', t: 'A la libreta (Marta)', icono: <BookOpen size={14} />, off: !p.libretaDisponible },
  ]
  const motivo = !p.abierta ? 'Marta todavía no tiene libreta: abrila desde Clientes.' : p.pagada ? 'Libreta saldada. Reiniciá la demo para un ciclo nuevo.' : p.cerrada ? 'La libreta está cerrada hasta que Marta pague.' : null
  const esLibreta = p.medio === 'libreta'
  return (
    <div style={{ padding: 14, display: 'grid', gap: 12 }} className="pr-fade-in">
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
        {PRODUCTOS.map(x => {
          const q = p.ticket[x.id] ?? 0
          return (
            <button key={x.id} type="button" className="lb-prod" onClick={() => p.agregar(x.id)} style={{ position: 'relative', textAlign: 'left', padding: '10px 12px', borderRadius: 12, background: '#fff', border: `1px solid ${q ? '#FDE68A' : '#E2E8F0'}`, fontFamily: FONT }}>
              <div style={{ fontSize: 22, lineHeight: 1 }}>{x.emoji}</div>
              <div style={{ fontSize: 12.5, fontWeight: 700, marginTop: 6, color: '#0F172A' }}>{x.nombre}</div>
              <div style={{ fontSize: 12, color: '#64748B', fontFamily: FONT_MONO }}>{formatoARS(x.precio)}</div>
              {q > 0 && (
                <span key={q} className="lb-anim" style={{ position: 'absolute', top: 8, right: 8, minWidth: 22, height: 22, padding: '0 6px', borderRadius: 99, background: ACENTO, color: '#fff', fontSize: 12, fontWeight: 800, display: 'grid', placeItems: 'center', animation: 'lb-bump .3s ease' }}>{q}</span>
              )}
            </button>
          )
        })}
      </div>

      <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 14, padding: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <span style={{ fontSize: 12, fontWeight: 800, color: '#475569', letterSpacing: '.06em', textTransform: 'uppercase' }}>Ticket</span>
          {items.length > 0 && <button type="button" onClick={() => items.forEach(x => { for (let i = 0; i < (p.ticket[x.id] ?? 0); i++) p.quitar(x.id) })} style={{ background: 'none', border: 'none', color: '#94A3B8', fontSize: 11.5, cursor: 'pointer', fontFamily: FONT }}>Vaciar</button>}
        </div>
        {items.length === 0 ? (
          <div style={{ fontSize: 12.5, color: '#94A3B8', padding: '10px 0 12px', textAlign: 'center' }}>Tocá un producto para armar el ticket.</div>
        ) : (
          <div style={{ display: 'grid', gap: 4, marginBottom: 8 }}>
            {items.map(x => (
              <div key={x.id} className="pr-fade-in" style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2 }}>
                  <button type="button" className="pr-btn" onClick={() => p.quitar(x.id)} style={{ width: 20, height: 20, borderRadius: 6, border: '1px solid #E2E8F0', background: '#F8FAFC', display: 'grid', placeItems: 'center' }}><Minus size={11} /></button>
                  <span style={{ width: 20, textAlign: 'center', fontFamily: FONT_MONO, fontWeight: 700, fontSize: 12 }}>{p.ticket[x.id]}</span>
                  <button type="button" className="pr-btn" onClick={() => p.agregar(x.id)} style={{ width: 20, height: 20, borderRadius: 6, border: '1px solid #E2E8F0', background: '#F8FAFC', display: 'grid', placeItems: 'center' }}><Plus size={11} /></button>
                </span>
                <span style={{ flex: 1, color: '#334155' }}>{x.nombre}</span>
                <span style={{ fontFamily: FONT_MONO, fontWeight: 600 }}>{formatoARS(x.precio * (p.ticket[x.id] ?? 0))}</span>
              </div>
            ))}
          </div>
        )}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', borderTop: '1px dashed #E2E8F0', paddingTop: 8 }}>
          <span style={{ fontSize: 12, color: '#64748B', fontWeight: 600 }}>Total</span>
          <span style={{ fontFamily: FONT_MONO, fontSize: 20, fontWeight: 800 }}>{formatoARS(p.total)}</span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1.4fr', gap: 6, marginTop: 10 }}>
          {medios.map(m => {
            const on = p.medio === m.id
            return (
              <button key={m.id} type="button" className="pr-btn" disabled={m.off} onClick={() => p.setMedio(m.id)} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '8px 6px', borderRadius: 10, fontFamily: FONT, fontSize: 12, fontWeight: 700, border: `1px solid ${on ? (m.id === 'libreta' ? ACENTO : C.primary) : '#E2E8F0'}`, background: on ? (m.id === 'libreta' ? '#FEF3C7' : '#EFF6FF') : '#fff', color: on ? (m.id === 'libreta' ? ACENTO_OSCURO : C.primary) : '#334155' }}>
                {m.icono} {m.t}
              </button>
            )
          })}
        </div>
        {motivo && <div style={{ fontSize: 11.5, color: '#94A3B8', marginTop: 6 }}>{motivo}</div>}
        {esLibreta && !motivo && (
          <div style={{ fontSize: 11.5, color: ACENTO_OSCURO, marginTop: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
            <BookOpen size={12} /> Marta lleva {formatoARS(p.saldo)} de {formatoARS(p.tope)}. Este ticket la deja en {formatoARS(p.saldo + p.total)}.
          </div>
        )}
        <Boton onClick={p.cobrar} disabled={p.total === 0} color={esLibreta ? ACENTO : '#0F172A'} style={{ width: '100%', marginTop: 10 }} tam="lg">
          {esLibreta ? <BookOpen size={16} /> : <Check size={16} />} {esLibreta ? `Anotar ${formatoARS(p.total)} en la libreta` : `Cobrar ${formatoARS(p.total)}`}
        </Boton>
      </div>
    </div>
  )
}

// ─── La libreta de papel ─────────────────────────────────────────────────────

function LibretaPapel(p: { abierta: boolean; tope: number; diaCierre: number; movs: Movimiento[]; saldoBruto: number; pagada: boolean; diaPago: number }) {
  const usado = Math.min(100, (p.saldoBruto / p.tope) * 100)
  const filasVacias = Math.max(0, 8 - p.movs.length)

  if (!p.abierta) {
    return (
      <div className="pr-fade-in" style={{ position: 'relative', minHeight: 600, borderRadius: 10, background: 'linear-gradient(160deg, #8B5E3C, #6B4423)', boxShadow: '0 30px 60px rgba(0,0,0,.5), inset 0 0 0 1px rgba(255,255,255,.08)', transform: 'rotate(-1.2deg)', display: 'grid', placeItems: 'center', padding: 24 }}>
        <div style={{ position: 'absolute', top: 0, bottom: 0, right: 34, width: 10, background: 'rgba(0,0,0,.35)', borderRadius: 2 }} />
        <div style={{ position: 'absolute', top: 60, left: 24, right: 60, padding: '10px 12px', background: '#FDFBF3', borderRadius: 4, boxShadow: '0 4px 12px rgba(0,0,0,.25)', transform: 'rotate(1deg)' }}>
          <Ink style={{ fontSize: 16, display: 'block', color: '#1F2937' }}>Libretas</Ink>
          <Ink style={{ fontSize: 12, display: 'block', color: '#6B7280' }}>{NEGOCIO}</Ink>
        </div>
        <div style={{ textAlign: 'center', color: 'rgba(255,255,255,.75)', fontSize: 13, lineHeight: 1.55, maxWidth: 200, marginTop: 80 }}>
          <BookOpen size={28} style={{ opacity: .6, marginBottom: 8 }} />
          <div>La libreta aparece acá cuando se la abrís a Marta desde <b style={{ color: '#fff' }}>Clientes</b>.</div>
        </div>
      </div>
    )
  }

  return (
    <div className="lb-anim" style={{ position: 'relative', animation: 'lb-open .7s cubic-bezier(.2,.8,.2,1) both', transform: 'rotate(-1.2deg)', paddingTop: 10 }}>
      {/* Espiral */}
      <div style={{ position: 'absolute', top: 0, left: 14, right: 14, display: 'flex', justifyContent: 'space-between', zIndex: 3 }}>
        {Array.from({ length: 11 }).map((_, i) => (
          <span key={i} style={{ width: 14, height: 20, borderRadius: 7, background: 'linear-gradient(180deg, #CBD5E1, #64748B)', boxShadow: 'inset 0 0 0 3px #0B1120, 0 2px 4px rgba(0,0,0,.4)' }} />
        ))}
      </div>

      <div style={{
        position: 'relative', minHeight: 590, borderRadius: 6, overflow: 'hidden',
        backgroundColor: '#FDFBF3',
        backgroundImage: 'linear-gradient(90deg, transparent 43px, #F1A7A0 43px, #F1A7A0 45px, transparent 45px), repeating-linear-gradient(180deg, transparent 0, transparent 25px, #C9DCEE 25px, #C9DCEE 26px)',
        backgroundPosition: '0 0, 0 8px',
        boxShadow: '0 30px 60px rgba(0,0,0,.5), inset 0 0 40px rgba(120,80,20,.06)',
        padding: '20px 14px 18px 52px', color: '#1F2937',
      }}>
        {/* Cabecera manuscrita */}
        <Ink style={{ display: 'block', fontSize: 19, lineHeight: '26px', color: '#111827', fontWeight: 700 }}>Marta Giménez</Ink>
        <Ink style={{ display: 'block', fontSize: 13, lineHeight: '26px', color: '#374151' }}>Libreta N.º {NUMERO} · {NEGOCIO}</Ink>
        <Ink style={{ display: 'block', fontSize: 13, lineHeight: '26px', color: '#374151' }}>Tope {formatoARS(p.tope)} · cierra el {p.diaCierre}</Ink>
        <div style={{ height: 26 }} />

        {/* Movimientos */}
        {p.movs.map(m => <LineaManuscrita key={m.id} mov={m} />)}
        {Array.from({ length: filasVacias }).map((_, i) => <div key={`v${i}`} style={{ height: 26 }} />)}

        {/* Total + barra de tope */}
        <div style={{ borderTop: `2px solid ${TINTA}`, marginTop: 4, paddingTop: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', lineHeight: '26px' }}>
          <Ink style={{ fontSize: 14 }}>Total a la fecha</Ink>
          <Ink key={p.saldoBruto} style={{ fontSize: 18, fontWeight: 700, animation: 'lb-bump .3s ease' }}>{formatoARS(p.saldoBruto)}</Ink>
        </div>
        <div style={{ lineHeight: '26px', display: 'flex', alignItems: 'center', gap: 8 }}>
          <Ink style={{ fontSize: 12, whiteSpace: 'nowrap' }}>usado del tope</Ink>
          <div style={{ flex: 1, height: 9, borderRadius: 3, border: `1.5px solid ${TINTA}`, padding: 1, background: 'transparent' }}>
            <div style={{ height: '100%', width: `${usado}%`, background: `repeating-linear-gradient(-45deg, ${TINTA} 0, ${TINTA} 2px, transparent 2px, transparent 4px)`, borderRadius: 2, transition: 'width .7s cubic-bezier(.2,.8,.2,1)' }} />
          </div>
          <Ink style={{ fontSize: 12, fontWeight: 700, minWidth: 34, textAlign: 'right' }}>{Math.round(usado)}%</Ink>
        </div>

        {/* Sello */}
        {p.pagada && (
          <div className="lb-anim" style={{ position: 'absolute', top: '52%', left: '52%', transform: 'translate(-50%,-50%) rotate(-14deg)', animation: 'lb-stamp .6s cubic-bezier(.2,.8,.2,1) both', border: '4px double #DC2626', borderRadius: 8, padding: '8px 18px', color: '#DC2626', fontFamily: FONT_DISPLAY, fontWeight: 900, fontSize: 34, letterSpacing: '.18em', textAlign: 'center', opacity: .9, mixBlendMode: 'multiply', pointerEvents: 'none' }}>
            SALDADA
            <div style={{ fontSize: 11, letterSpacing: '.12em', fontWeight: 700, marginTop: -2 }}>{p.diaPago}/09 · MERCADO PAGO</div>
          </div>
        )}
      </div>
    </div>
  )
}

function LineaManuscrita({ mov }: { mov: Movimiento }) {
  const nota = mov.tipo === 'nota'
  const color = nota ? '#B91C1C' : TINTA
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, height: 26, lineHeight: '26px', position: 'relative' }}>
      <Ink style={{ fontSize: 12, width: 34, flexShrink: 0, color }}>{mov.dia}/9</Ink>
      <Ink style={{ flex: 1, minWidth: 0, fontSize: 13, color, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', animation: `lb-write ${nota ? .7 : 1}s steps(${Math.max(12, mov.detalle.length)}) both` }}>{mov.detalle}</Ink>
      {!nota && (
        <Ink style={{ fontSize: 13.5, fontWeight: 700, color, animation: 'lb-ink .35s ease both', animationDelay: '1s' }}>{formatoARS(mov.monto)}</Ink>
      )}
      <span aria-hidden style={{ position: 'absolute', right: -18, top: 2, fontSize: 13, animation: 'lb-pen .25s ease-in-out 4, pr-fade-in 1.1s steps(1) reverse both', transformOrigin: 'bottom left' }}>✒️</span>
    </div>
  )
}

// ─── Celular de la clienta ───────────────────────────────────────────────────

function CelularCliente(p: {
  pantalla: 'perfil' | 'libreta'; notif: string | null
  saldo: number; saldoBruto: number; tope: number; movs: Movimiento[]
  diasParaCierre: number; cerrada: boolean; diaCierre: number
  wsp: EstadoWsp; leerWsp: () => void
  pago: EstadoPago; pagar: () => void
}) {
  const pagada = p.pago === 'pagada'
  const compras = p.movs.filter(m => m.tipo === 'compra')
  return (
    <Pantalla tipo="celular" ancho={320}>
      <div style={{ padding: '50px 14px 16px', minHeight: 620, background: '#F8FAFC', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ width: 34, height: 34, borderRadius: 99, background: `linear-gradient(135deg, ${ACENTO}, ${ACENTO_OSCURO})`, color: '#fff', display: 'grid', placeItems: 'center', fontWeight: 800, fontSize: 12 }}>MG</span>
          <div>
            <div style={{ fontWeight: 800, fontSize: 15, fontFamily: FONT_DISPLAY }}>Hola, Marta</div>
            <div style={{ fontSize: 11, color: '#64748B' }}>{NEGOCIO} · Mi perfil</div>
          </div>
        </div>

        {p.pantalla === 'perfil' ? (
          <div className="pr-fade-in" style={{ borderRadius: 16, border: '1px dashed #CBD5E1', padding: 22, textAlign: 'center', color: '#94A3B8', fontSize: 12.5, lineHeight: 1.5, marginTop: 8 }}>
            <BookOpen size={26} style={{ marginBottom: 8, opacity: .5 }} />
            <div>Todavía no tenés libretas.</div>
            <div style={{ fontSize: 11.5 }}>Cuando un negocio te abra una, aparece acá.</div>
          </div>
        ) : (
          <>
            <div className="pr-fade-up" style={{ borderRadius: 18, padding: 16, color: '#fff', background: pagada ? 'linear-gradient(135deg, #10B981, #059669)' : `linear-gradient(135deg, ${ACENTO}, ${ACENTO_OSCURO})`, boxShadow: pagada ? '0 14px 34px rgba(16,185,129,.35)' : '0 14px 34px rgba(245,158,11,.35)', transition: 'background .6s, box-shadow .6s', position: 'relative', overflow: 'hidden' }}>
              <div style={{ position: 'absolute', right: -20, top: -20, width: 110, height: 110, borderRadius: 99, background: 'rgba(255,255,255,.12)' }} />
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', opacity: .85 }}>Mi libreta en {NEGOCIO}</div>
              {pagada ? (
                <div className="pr-fade-up" style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 10 }}>
                  <AnilloPuntaje valor={PUNTAJE_FINAL} desde={PUNTAJE_INICIAL} />
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 800, fontSize: 16 }}><CheckCircle2 size={16} /> Libreta saldada</div>
                    <div style={{ fontSize: 11.5, opacity: .9, marginTop: 2 }}>Pagaste {formatoARS(p.saldoBruto)} el {p.diaCierre}/9. Tu confianza subió.</div>
                    <div style={{ marginTop: 6, display: 'inline-flex', alignItems: 'center', gap: 5, background: 'rgba(255,255,255,.2)', borderRadius: 999, padding: '3px 9px', fontSize: 11, fontWeight: 700 }}><Sparkles size={11} /> Tope sugerido: {formatoARS(topeSugerido(p.tope))}</div>
                  </div>
                </div>
              ) : (
                <>
                  <div key={p.saldo} className="lb-anim" style={{ fontFamily: FONT_MONO, fontSize: 32, fontWeight: 800, marginTop: 4, letterSpacing: '-0.02em', animation: 'lb-bump .3s ease' }}>{formatoARS(p.saldo)}</div>
                  <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: 'rgba(255,255,255,.2)', borderRadius: 999, padding: '3px 9px', fontSize: 11, fontWeight: 700 }}>
                      <Clock size={11} /> {p.cerrada ? 'Cierra hoy' : `Cierra en ${p.diasParaCierre} día${p.diasParaCierre === 1 ? '' : 's'}`}
                    </span>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: 'rgba(255,255,255,.2)', borderRadius: 999, padding: '3px 9px', fontSize: 11, fontWeight: 700 }}>Tope {formatoARS(p.tope)}</span>
                  </div>
                  <div style={{ height: 6, borderRadius: 99, background: 'rgba(255,255,255,.25)', marginTop: 10, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${Math.min(100, (p.saldo / p.tope) * 100)}%`, background: '#fff', borderRadius: 99, transition: 'width .7s cubic-bezier(.2,.8,.2,1)' }} />
                  </div>
                </>
              )}
            </div>

            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: '#64748B', letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: 6 }}>Movimientos</div>
              {compras.length === 0 ? (
                <div style={{ fontSize: 12, color: '#94A3B8', padding: '8px 0' }}>Todavía no compraste a la libreta. Pedí en el local o en la tienda y elegí “a la libreta”.</div>
              ) : (
                <div style={{ display: 'grid', gap: 4 }}>
                  {compras.map(m => (
                    <div key={m.id} className="pr-fade-up" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', borderRadius: 10, background: '#fff', border: '1px solid #E2E8F0', fontSize: 12, opacity: pagada ? .6 : 1 }}>
                      <span style={{ fontFamily: FONT_MONO, fontSize: 10.5, color: '#64748B', background: '#F1F5F9', borderRadius: 6, padding: '2px 5px' }}>{m.dia}/9</span>
                      <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: '#334155' }}>{m.detalle}</span>
                      <span style={{ fontFamily: FONT_MONO, fontWeight: 700, textDecoration: pagada ? 'line-through' : undefined }}>{formatoARS(m.monto)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {pagada ? (
              <div style={{ textAlign: 'center', fontSize: 12, color: '#059669', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}><CheckCircle2 size={14} /> Comprobante enviado por WhatsApp</div>
            ) : (
              <button type="button" className="pr-btn" onClick={p.pagar} disabled={p.saldo === 0 || p.pago === 'procesando'} style={{ width: '100%', padding: '13px 14px', borderRadius: 14, border: 'none', background: MP, color: '#fff', fontFamily: FONT, fontWeight: 800, fontSize: 14, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, boxShadow: '0 10px 24px rgba(0,158,227,.35)' }}>
                {p.pago === 'procesando' ? (
                  <><Loader2 size={16} style={{ animation: 'pr-spin 1s linear infinite' }} /> Procesando con Mercado Pago…</>
                ) : (
                  <><MpLogo /> Pagar {formatoARS(p.saldo)} con Mercado Pago</>
                )}
              </button>
            )}
          </>
        )}
      </div>

      {/* Notificación de WhatsApp (apertura) */}
      {p.notif && (
        <div className="lb-anim" style={{ position: 'absolute', top: 44, left: 10, right: 10, background: '#fff', borderRadius: 14, padding: '10px 12px', boxShadow: '0 12px 30px rgba(15,23,42,.25)', display: 'flex', gap: 10, animation: 'lb-drop .5s cubic-bezier(.2,.8,.2,1) both', zIndex: 8 }}>
          <span style={{ width: 30, height: 30, borderRadius: 8, background: WSP, display: 'grid', placeItems: 'center', flexShrink: 0 }}><MessageCircle size={16} color="#fff" /></span>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: '#0F172A' }}>WhatsApp · {NEGOCIO} <span style={{ color: '#94A3B8', fontWeight: 500 }}>ahora</span></div>
            <div style={{ fontSize: 11.5, color: '#334155', lineHeight: 1.4, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{p.notif}</div>
          </div>
        </div>
      )}

      {/* Chat de WhatsApp (cierre) */}
      {(p.wsp === 'escribiendo' || p.wsp === 'llego') && (
        <div className="lb-anim" style={{ position: 'absolute', left: 0, right: 0, bottom: 0, background: '#EFEAE2', borderRadius: '22px 22px 32px 32px', boxShadow: '0 -12px 40px rgba(15,23,42,.35)', animation: 'lb-sheet .45s cubic-bezier(.2,.8,.2,1) both', zIndex: 9, overflow: 'hidden' }}>
          <div style={{ background: '#075E54', color: '#fff', padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ width: 30, height: 30, borderRadius: 99, background: '#fff', display: 'grid', placeItems: 'center', fontSize: 15 }}>🧉</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 800, fontSize: 13 }}>{NEGOCIO}</div>
              <div style={{ fontSize: 10.5, opacity: .8 }}>{p.wsp === 'escribiendo' ? 'escribiendo…' : 'en línea'}</div>
            </div>
            <MessageCircle size={16} />
          </div>
          <div style={{ padding: 12, minHeight: 120 }}>
            {p.wsp === 'escribiendo' ? (
              <div style={{ display: 'inline-flex', gap: 4, background: '#fff', borderRadius: '2px 12px 12px 12px', padding: '10px 12px' }}>
                {[0, 1, 2].map(i => <span key={i} style={{ width: 7, height: 7, borderRadius: 99, background: '#8696A0', animation: `pr-typing 1.1s ${i * 0.15}s infinite` }} />)}
              </div>
            ) : (
              <div className="pr-fade-up" style={{ background: '#fff', borderRadius: '2px 12px 12px 12px', padding: '8px 10px', fontSize: 12, color: '#111B21', lineHeight: 1.45, boxShadow: '0 1px 1px rgba(0,0,0,.08)', maxWidth: '94%' }}>
                {mensajeCierre(p.saldoBruto)}
                <div style={{ marginTop: 8, borderTop: '1px solid #E5E7EB', paddingTop: 8 }}>
                  <button type="button" className="pr-btn" onClick={p.leerWsp} style={{ width: '100%', padding: '8px 10px', borderRadius: 10, border: 'none', background: '#E7FBEF', color: '#0B7A4B', fontFamily: FONT, fontWeight: 800, fontSize: 12, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                    <BookOpen size={13} /> Abrir mi libreta
                  </button>
                </div>
                <div style={{ textAlign: 'right', fontSize: 10, color: '#8696A0', marginTop: 4 }}>09:00</div>
              </div>
            )}
          </div>
        </div>
      )}
    </Pantalla>
  )
}

function MpLogo() {
  return (
    <span style={{ width: 18, height: 18, borderRadius: 99, background: '#fff', display: 'inline-grid', placeItems: 'center', flexShrink: 0 }}>
      <span style={{ width: 10, height: 6, borderRadius: 99, border: `2px solid ${MP}`, borderTop: 'none', display: 'block', marginTop: -2 }} />
    </span>
  )
}

function AnilloPuntaje({ valor, desde }: { valor: number; desde: number }) {
  const [mostrado, setMostrado] = useState(desde)
  useEffect(() => {
    const t0 = performance.now()
    let raf = 0
    const paso = (t: number) => {
      const k = Math.min(1, (t - t0) / 1400)
      const e = 1 - Math.pow(1 - k, 3)
      setMostrado(desde + (valor - desde) * e)
      if (k < 1) raf = requestAnimationFrame(paso)
    }
    raf = requestAnimationFrame(paso)
    return () => cancelAnimationFrame(raf)
  }, [valor, desde])
  const r = 30
  const c = 2 * Math.PI * r
  return (
    <div style={{ position: 'relative', width: 76, height: 76, flexShrink: 0 }}>
      <svg viewBox="0 0 76 76" width={76} height={76} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={38} cy={38} r={r} fill="none" stroke="rgba(255,255,255,.25)" strokeWidth={6} />
        <circle cx={38} cy={38} r={r} fill="none" stroke="#fff" strokeWidth={6} strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - mostrado / 100)} />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', textAlign: 'center' }}>
        <div>
          <div style={{ fontFamily: FONT_MONO, fontWeight: 800, fontSize: 20, lineHeight: 1 }}>{Math.round(mostrado)}</div>
          <div style={{ fontSize: 8.5, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', opacity: .85 }}>confianza</div>
        </div>
      </div>
      <span style={{ position: 'absolute', top: -4, right: -6, background: '#fff', color: '#059669', borderRadius: 999, fontSize: 10, fontWeight: 800, padding: '2px 6px', boxShadow: '0 4px 10px rgba(0,0,0,.2)' }}>+{valor - desde}</span>
    </div>
  )
}

// ─── Pie: cómo viaja la confianza ────────────────────────────────────────────

const NEGOCIOS_MARTA = [
  { nombre: 'Verdulería La Huerta', emoji: '🥬', puntaje: 88, saldadas: 6, r: 58, dur: 16, delay: 0 },
  { nombre: 'Farmacia Central', emoji: '💊', puntaje: 79, saldadas: 3, r: 82, dur: 22, delay: -7 },
  { nombre: NEGOCIO, emoji: '🧉', puntaje: PUNTAJE_INICIAL, saldadas: 0, r: 82, dur: 22, delay: -18 },
]

function PieConfianza({ puntaje, pagada }: { puntaje: number; pagada: boolean }) {
  return (
    <Tarjeta style={{ marginTop: 22, padding: '18px 22px', display: 'grid', gridTemplateColumns: 'auto 1fr', gap: 24, alignItems: 'center' }}>
      <div style={{ position: 'relative', width: 190, height: 190 }}>
        {[58, 82].map(r => (
          <span key={r} style={{ position: 'absolute', top: '50%', left: '50%', width: r * 2, height: r * 2, marginLeft: -r, marginTop: -r, borderRadius: '50%', border: '1px dashed rgba(148,163,184,.3)' }} />
        ))}
        <span style={{ position: 'absolute', top: '50%', left: '50%', width: 48, height: 48, marginLeft: -24, marginTop: -24, borderRadius: 99, background: `linear-gradient(135deg, ${ACENTO}, ${ACENTO_OSCURO})`, display: 'grid', placeItems: 'center', fontWeight: 800, fontSize: 14, color: '#fff', boxShadow: `0 0 30px ${ACENTO}66` }}>MG</span>
        {NEGOCIOS_MARTA.map(n => (
          <span key={n.nombre} title={n.nombre} style={{ position: 'absolute', top: '50%', left: '50%', width: 30, height: 30, marginLeft: -15, marginTop: -15, borderRadius: 99, background: C.surface2, border: `1px solid ${C.borderStrong}`, display: 'grid', placeItems: 'center', fontSize: 15, ['--r' as string]: `${n.r}px`, animation: `pr-orbit ${n.dur}s linear ${n.delay}s infinite` }}>{n.emoji}</span>
        ))}
      </div>
      <div>
        <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: 17, marginBottom: 4 }}>Cómo viaja la confianza</div>
        <div style={{ fontSize: 13, color: C.body, lineHeight: 1.55, maxWidth: 720 }}>
          El puntaje es <b style={{ color: C.text }}>de Marta, no del negocio</b>: cada libreta saldada en cualquier tienda de Órbita suma. Un negocio nuevo puede abrirle libreta con más tranquilidad, y Marta llega con reputación en vez de arrancar de cero.
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
          {NEGOCIOS_MARTA.map(n => {
            const esEste = n.nombre === NEGOCIO
            const v = esEste ? puntaje : n.puntaje
            const s = esEste && pagada ? 1 : n.saldadas
            return (
              <span key={n.nombre} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '7px 12px 7px 8px', borderRadius: 999, background: esEste ? `${ACENTO}1F` : C.surface2, border: `1px solid ${esEste ? `${ACENTO}55` : C.border}`, fontSize: 12.5, transition: 'all .4s' }}>
                <span style={{ fontSize: 15 }}>{n.emoji}</span>
                <span style={{ fontWeight: 700, color: C.text }}>{n.nombre}</span>
                <span style={{ fontFamily: FONT_MONO, fontWeight: 800, color: esEste && pagada ? C.success : C.body }}>{v}</span>
                <span style={{ color: C.subtle }}>· {s} saldada{s === 1 ? '' : 's'}</span>
                {esEste && pagada && <span className="pr-fade-in" style={{ color: C.success, fontWeight: 800, fontSize: 11 }}>+{PUNTAJE_FINAL - PUNTAJE_INICIAL}</span>}
              </span>
            )
          })}
          <Chip color={C.muted}><ShieldCheck size={11} /> Órbita no presta plata: el riesgo lo asume cada negocio</Chip>
        </div>
      </div>
    </Tarjeta>
  )
}
