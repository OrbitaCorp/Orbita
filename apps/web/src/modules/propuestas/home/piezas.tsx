// src/modules/propuestas/home/piezas.tsx — Piezas interactivas de la nueva
// home: revelado por scroll, contadores, tarjetas con foco de luz, barra de
// progreso, CTA flotante, acordeón, y la historia "Un día con Órbita".

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { ArrowRight, ChevronDown, CalendarDays, ShoppingBag, Sparkles, CreditCard, MessageCircle, BarChart3, Check } from 'lucide-react'
import Link from 'next/link'
import { C, FONT, FONT_DISPLAY, FONT_MONO, Tarjeta, Chip, Boton, OrbiAvatar } from '../ui'

// ─── Revelado por scroll ─────────────────────────────────────────────────────

export function useEnVista<T extends HTMLElement>(umbral = 0.25, unaVez = true) {
  const ref = useRef<T | null>(null)
  const [visto, setVisto] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) { setVisto(true); if (unaVez) io.disconnect() }
      else if (!unaVez) setVisto(false)
    }, { threshold: umbral })
    io.observe(el)
    return () => io.disconnect()
  }, [umbral, unaVez])
  return { ref, visto }
}

export function Revelar({ children, delay = 0, style, className, desde = 'abajo' }: { children: ReactNode; delay?: number; style?: CSSProperties; className?: string; desde?: 'abajo' | 'izquierda' | 'derecha' | 'zoom' }) {
  const { ref, visto } = useEnVista<HTMLDivElement>(0.18)
  const oculto = desde === 'izquierda' ? 'translateX(-40px)' : desde === 'derecha' ? 'translateX(40px)' : desde === 'zoom' ? 'scale(.92)' : 'translateY(28px)'
  return (
    <div ref={ref} className={className} style={{ opacity: visto ? 1 : 0, transform: visto ? 'none' : oculto, transition: `opacity .8s cubic-bezier(.2,.8,.2,1) ${delay}ms, transform .8s cubic-bezier(.2,.8,.2,1) ${delay}ms`, willChange: 'opacity, transform', ...style }}>
      {children}
    </div>
  )
}

// ─── Contador animado ────────────────────────────────────────────────────────

export function Contador({ hasta, prefijo = '', sufijo = '', decimales = 0, duracion = 1600, style }: { hasta: number; prefijo?: string; sufijo?: string; decimales?: number; duracion?: number; style?: CSSProperties }) {
  const { ref, visto } = useEnVista<HTMLSpanElement>(0.5)
  const [v, setV] = useState(0)
  useEffect(() => {
    if (!visto) return
    let raf = 0
    const t0 = performance.now()
    const tick = (t: number) => {
      const p = Math.min(1, (t - t0) / duracion)
      const e = 1 - Math.pow(1 - p, 3)
      setV(hasta * e)
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [visto, hasta, duracion])
  return <span ref={ref} style={{ fontVariantNumeric: 'tabular-nums', ...style }}>{prefijo}{v.toLocaleString('es-AR', { minimumFractionDigits: decimales, maximumFractionDigits: decimales })}{sufijo}</span>
}

// ─── Tarjeta con foco de luz que sigue al mouse ──────────────────────────────

export function TarjetaLuz({ children, color = C.primary, style, className, id }: { children: ReactNode; color?: string; style?: CSSProperties; className?: string; id?: string }) {
  const ref = useRef<HTMLDivElement | null>(null)
  const mover = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = ref.current
    if (!el) return
    const r = el.getBoundingClientRect()
    el.style.setProperty('--mx', `${e.clientX - r.left}px`)
    el.style.setProperty('--my', `${e.clientY - r.top}px`)
  }
  return (
    <div ref={ref} id={id} onMouseMove={mover} className={`nh-luz ${className ?? ''}`} style={{ ['--luz' as string]: color, position: 'relative', overflow: 'hidden', background: C.surface, borderWidth: 1, borderStyle: 'solid', borderColor: C.border, borderRadius: 18, backdropFilter: 'blur(14px)', ...style }}>
      <div className="nh-luz-halo" aria-hidden />
      <div style={{ position: 'relative', zIndex: 1 }}>{children}</div>
    </div>
  )
}

// ─── Barra de progreso de lectura + CTA flotante ─────────────────────────────

export function ProgresoYCta() {
  const [p, setP] = useState(0)
  const [pasoHero, setPasoHero] = useState(false)
  useEffect(() => {
    const h = () => {
      const total = document.documentElement.scrollHeight - window.innerHeight
      setP(total > 0 ? window.scrollY / total : 0)
      setPasoHero(window.scrollY > window.innerHeight * 0.9)
    }
    h()
    window.addEventListener('scroll', h, { passive: true })
    return () => window.removeEventListener('scroll', h)
  }, [])
  return (
    <>
      <div aria-hidden style={{ position: 'fixed', left: 0, top: 0, height: 3, width: `${p * 100}%`, zIndex: 80, background: 'linear-gradient(90deg, #3B82F6, #8B5CF6)', boxShadow: '0 0 12px rgba(96,165,250,.8)', transition: 'width .1s linear' }} />
      <div style={{ position: 'fixed', left: '50%', bottom: 18, transform: `translateX(-50%) translateY(${pasoHero ? 0 : 80}px)`, opacity: pasoHero ? 1 : 0, transition: 'transform .4s cubic-bezier(.2,.8,.2,1), opacity .3s', zIndex: 75 }}>
        <Link href="/onboarding/rubro" style={{ textDecoration: 'none' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '8px 8px 8px 18px', borderRadius: 999, background: 'rgba(7,11,22,.85)', border: `1px solid ${C.borderStrong}`, backdropFilter: 'blur(14px)', boxShadow: '0 20px 60px rgba(0,0,0,.6), 0 0 40px rgba(59,130,246,.25)' }}>
            <span style={{ fontSize: 13.5, color: C.body, fontWeight: 600 }}>Gratis para empezar · sin comisiones</span>
            <Boton tam="sm">Crear tu espacio <ArrowRight size={14} /></Boton>
          </div>
        </Link>
      </div>
    </>
  )
}

// ─── Acordeón ────────────────────────────────────────────────────────────────

export function Acordeon({ items }: { items: { q: string; a: string }[] }) {
  const [abierto, setAbierto] = useState<number | null>(0)
  return (
    <div style={{ display: 'grid', gap: 8 }}>
      {items.map((it, i) => {
        const on = abierto === i
        return (
          <Tarjeta key={it.q} style={{ overflow: 'hidden', borderColor: on ? `${C.primary}66` : C.border }}>
            <button onClick={() => setAbierto(on ? null : i)} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14, padding: '18px 20px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', color: C.text, fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 16 }}>
              {it.q}
              <ChevronDown size={18} color={C.muted} style={{ transform: on ? 'rotate(180deg)' : 'none', transition: 'transform .25s', flexShrink: 0 }} />
            </button>
            <div style={{ display: 'grid', gridTemplateRows: on ? '1fr' : '0fr', transition: 'grid-template-rows .3s cubic-bezier(.2,.8,.2,1)' }}>
              <div style={{ overflow: 'hidden' }}><p style={{ margin: 0, padding: '0 20px 18px', fontSize: 14.5, lineHeight: 1.6, color: C.body }}>{it.a}</p></div>
            </div>
          </Tarjeta>
        )
      })}
    </div>
  )
}

// ─── Un día con Órbita ───────────────────────────────────────────────────────

interface Momento { hora: string; titulo: string; detalle: string; icono: ReactNode; color: string; panel: { k: string; v: string }[]; toast: string }

const DIA: Momento[] = [
  { hora: '08:50', titulo: 'Lucía reserva un turno desde tu link', detalle: 'Sin WhatsApp: eligió jueves 10:00 desde el celular. Le llegó la confirmación y mañana le llega el recordatorio.', icono: <CalendarDays size={18} />, color: '#60A5FA', panel: [['Turnos hoy', '9 · 3 libres'], ['Ventas', '$0'], ['Pedidos', '0'], ['Stock bajo', '3']].map(([k, v]) => ({ k, v })), toast: 'Nuevo turno · Lucía Ferreyra · jue 10:00' },
  { hora: '10:30', titulo: 'Entra un pedido por la tienda online', detalle: 'Campera de jean, pagada con Mercado Pago. El stock bajó solo, en la tienda y en el mostrador.', icono: <ShoppingBag size={18} />, color: '#34D399', panel: [['Turnos hoy', '9 · 3 libres'], ['Ventas', '$24.000'], ['Pedidos', '1 pendiente'], ['Stock bajo', '3']].map(([k, v]) => ({ k, v })), toast: 'Pedido #1043 · $24.000 · pagado con Mercado Pago' },
  { hora: '13:15', titulo: 'Orbi sugiere una movida', detalle: '"Las remeras básicas llevan 40 días sin rotar. ¿Armo un 20% para el fin de semana?" Tocás aprobar y listo.', icono: <Sparkles size={18} />, color: '#A78BFA', panel: [['Turnos hoy', '9 · 3 libres'], ['Ventas', '$41.500'], ['Pedidos', '2'], ['Stock bajo', '3']].map(([k, v]) => ({ k, v })), toast: 'Orbi · cupón REMERAS20 listo para aprobar' },
  { hora: '16:40', titulo: 'Cobrás en el mostrador', detalle: 'Corte + barba en el punto de venta. Misma caja, mismo stock, mismo cliente que ya reservaba online.', icono: <CreditCard size={18} />, color: '#FBBF24', panel: [['Turnos hoy', '9 · 1 libre'], ['Ventas', '$63.500'], ['Pedidos', '2'], ['Stock bajo', '2']].map(([k, v]) => ({ k, v })), toast: 'POS · $9.000 · Juan Pérez · efectivo' },
  { hora: '19:05', titulo: 'Un cliente pregunta por WhatsApp', detalle: 'La consulta cae en Mensajes, con el historial de compras al lado. Respondés desde el panel, no desde tu celular personal.', icono: <MessageCircle size={18} />, color: '#38BDF8', panel: [['Turnos hoy', '9 · 0 libres'], ['Ventas', '$88.200'], ['Pedidos', '3'], ['Stock bajo', '2']].map(([k, v]) => ({ k, v })), toast: 'Mensaje · Tomás: "¿tienen el buzo en talle L?"' },
  { hora: '21:30', titulo: 'Cierre del día, sin planilla', detalle: 'Reportes ya sabe cuánto vendiste, qué rotó y quién volvió. Mañana Orbi te lo cuenta en dos líneas.', icono: <BarChart3 size={18} />, color: '#FB923C', panel: [['Turnos hoy', '9 · 0 libres'], ['Ventas', '$112.400'], ['Pedidos', '3 · 2 entregados'], ['Stock bajo', '1']].map(([k, v]) => ({ k, v })), toast: 'Día cerrado · $112.400 · +18% vs. ayer' },
]

export function UnDiaConOrbita() {
  const { ref, visto } = useEnVista<HTMLDivElement>(0.35)
  const [i, setI] = useState(0)
  const [auto, setAuto] = useState(true)
  useEffect(() => {
    if (!visto || !auto) return
    const t = window.setInterval(() => setI(x => (x + 1) % DIA.length), 2600)
    return () => window.clearInterval(t)
  }, [visto, auto])
  const m = DIA[i]
  return (
    <div ref={ref} style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: 30, alignItems: 'center' }} className="nh-2col">
      {/* Línea de tiempo */}
      <div>
        <div style={{ display: 'grid', gap: 6 }}>
          {DIA.map((x, j) => {
            const on = j === i
            return (
              <button key={x.hora} onClick={() => { setI(j); setAuto(false) }} style={{ display: 'grid', gridTemplateColumns: '58px 34px 1fr', gap: 12, alignItems: 'center', textAlign: 'left', padding: '10px 12px', borderRadius: 14, border: `1px solid ${on ? x.color + '66' : 'transparent'}`, background: on ? `${x.color}14` : 'transparent', cursor: 'pointer', transition: 'all .3s', fontFamily: FONT }}>
                <span style={{ fontFamily: FONT_MONO, fontSize: 13, color: on ? C.text : C.subtle }}>{x.hora}</span>
                <span style={{ width: 34, height: 34, borderRadius: 11, display: 'grid', placeItems: 'center', background: on ? x.color : 'rgba(148,163,184,.1)', color: on ? '#fff' : C.muted, boxShadow: on ? `0 0 18px ${x.color}88` : undefined, transition: 'all .3s' }}>{x.icono}</span>
                <span>
                  <span style={{ display: 'block', fontWeight: 700, color: on ? C.text : C.body, fontSize: 14.5 }}>{x.titulo}</span>
                  <span style={{ display: 'grid', gridTemplateRows: on ? '1fr' : '0fr', transition: 'grid-template-rows .35s' }}><span style={{ overflow: 'hidden', display: 'block', fontSize: 13, color: C.muted, lineHeight: 1.5, paddingTop: on ? 4 : 0 }}>{x.detalle}</span></span>
                </span>
              </button>
            )
          })}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 12, fontSize: 12.5, color: C.subtle }}>
          <span style={{ display: 'inline-flex', gap: 4 }}>{DIA.map((_, j) => <span key={j} style={{ width: j === i ? 18 : 6, height: 6, borderRadius: 99, background: j === i ? m.color : 'rgba(148,163,184,.25)', transition: 'all .3s' }} />)}</span>
          {auto ? 'Se reproduce solo · tocá un momento para frenar' : <button onClick={() => setAuto(true)} style={{ background: 'none', border: 'none', color: C.primaryLight, cursor: 'pointer', font: 'inherit', padding: 0 }}>Reanudar</button>}
        </div>
      </div>

      {/* Panel que reacciona */}
      <div style={{ position: 'relative' }}>
        <div style={{ borderRadius: 20, background: '#fff', color: '#0F172A', padding: 18, boxShadow: `0 30px 80px rgba(0,0,0,.5), 0 0 60px ${m.color}33`, transition: 'box-shadow .5s', fontFamily: FONT }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <b style={{ fontSize: 13 }}>Panel · Barbería Sur</b>
            <span style={{ fontFamily: FONT_MONO, fontSize: 12, color: '#64748B' }}>{m.hora}</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {m.panel.map(c => (
              <div key={c.k} style={{ padding: '10px 12px', borderRadius: 12, background: '#F8FAFC', border: '1px solid #E2E8F0' }}>
                <div style={{ fontSize: 10.5, color: '#64748B', textTransform: 'uppercase', letterSpacing: '.08em', fontWeight: 700 }}>{c.k}</div>
                <div key={c.v} className="pr-fade-up" style={{ fontSize: 17, fontWeight: 800, marginTop: 2 }}>{c.v}</div>
              </div>
            ))}
          </div>
          <div key={i} className="pr-fade-up" style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 12, background: `${m.color}1A`, border: `1px solid ${m.color}55`, fontSize: 12.5, color: '#0F172A' }}>
            <span style={{ width: 26, height: 26, borderRadius: 8, background: m.color, color: '#fff', display: 'grid', placeItems: 'center', flexShrink: 0 }}>{m.icono}</span>
            <span style={{ fontWeight: 600 }}>{m.toast}</span>
          </div>
          <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#64748B' }}><Check size={13} color="#10B981" /> Todo sincronizado: tienda, mostrador, turnos y stock.</div>
        </div>
        <div style={{ position: 'absolute', top: -14, right: -14, display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', borderRadius: 999, background: 'rgba(7,11,22,.9)', border: `1px solid ${C.border}`, fontSize: 12, color: C.body }}><OrbiAvatar size={20} /> Orbi mira todo esto</div>
      </div>
    </div>
  )
}

// ─── Orbi que responde ───────────────────────────────────────────────────────

const RESPUESTAS: { q: string; a: string[] }[] = [
  { q: '¿Cómo vino la semana?', a: ['Vendiste $412.000, un 18% más que la anterior. El sábado fue tu mejor día.', 'Las remeras básicas llevan 40 días sin rotar: te puedo armar un 20% para el finde.'] },
  { q: 'Creá un producto', a: ['Dale. ¿Cómo se llama y cuánto sale? Con eso lo cargo y te propongo la descripción.', 'Si me mandás una foto, la uso de portada y la recorto.'] },
  { q: '¿Qué día vendo más?', a: ['Los sábados: 31% de tus ventas de la semana. Los martes son los más flojos.', 'Si querés, programo las promos para los martes y te aviso cómo rinden.'] },
  { q: '¿Cuántos clientes volvieron?', a: ['Este mes volvieron 64 clientes, 12 más que el mes pasado. Los que reservan turno online vuelven el doble.'] },
  { q: 'Marcá enviado el pedido #1042', a: ['Listo, el pedido #1042 pasó a enviado y le avisé al cliente por mail.'] },
]

export function OrbiResponde() {
  const [hist, setHist] = useState<{ de: 'vos' | 'orbi'; t: string }[]>([{ de: 'orbi', t: 'Hola. Probá preguntarme algo sobre el negocio: leo tus ventas, tu stock y tus clientes de verdad.' }])
  const [pensando, setPensando] = useState(false)
  const timers = useRef<number[]>([])
  useEffect(() => () => { timers.current.forEach(clearTimeout) }, [])
  const preguntar = (r: typeof RESPUESTAS[number]) => {
    if (pensando) return
    setHist(h => [...h, { de: 'vos', t: r.q }])
    setPensando(true)
    r.a.forEach((t, i) => {
      timers.current.push(window.setTimeout(() => {
        setHist(h => [...h, { de: 'orbi', t }])
        if (i === r.a.length - 1) setPensando(false)
      }, 700 + i * 900))
    })
  }
  return (
    <div style={{ borderRadius: 20, background: '#fff', color: '#0F172A', padding: 18, minHeight: 360, boxShadow: '0 30px 80px rgba(0,0,0,.5), 0 0 60px rgba(139,92,246,.3)', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingBottom: 12, borderBottom: '1px solid #E2E8F0', marginBottom: 12 }}><OrbiAvatar size={26} /><b style={{ fontSize: 13 }}>Orbi</b><span style={{ fontSize: 11, color: '#64748B' }}>· Casa Ramos · Dashboard</span><Chip color="#10B981" style={{ marginLeft: 'auto', fontSize: 10.5 }}>en vivo</Chip></div>
      <div className="pr-scroll" style={{ display: 'grid', gap: 8, flex: 1, maxHeight: 260, overflowY: 'auto', alignContent: 'start' }}>
        {hist.map((m, i) => (
          <div key={i} className="pr-fade-up" style={{ justifySelf: m.de === 'vos' ? 'end' : 'start', maxWidth: '86%', padding: '9px 12px', borderRadius: 14, fontSize: 13.5, lineHeight: 1.45, background: m.de === 'vos' ? '#3B82F6' : '#F1F5F9', color: m.de === 'vos' ? '#fff' : '#0F172A' }}>{m.t}</div>
        ))}
        {pensando && <div style={{ display: 'flex', gap: 4, padding: '8px 12px' }}>{[0, 1, 2].map(i => <span key={i} style={{ width: 6, height: 6, borderRadius: 99, background: '#94A3B8', animation: `pr-typing 1s ${i * .15}s infinite` }} />)}</div>}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 12, paddingTop: 12, borderTop: '1px solid #E2E8F0' }}>
        {RESPUESTAS.map(r => <button key={r.q} onClick={() => preguntar(r)} disabled={pensando} className="pr-btn" style={{ padding: '7px 11px', borderRadius: 999, border: '1px solid #BFDBFE', background: '#EFF6FF', color: '#1E40AF', fontSize: 12.5, fontWeight: 600, fontFamily: FONT }}>{r.q}</button>)}
      </div>
    </div>
  )
}
