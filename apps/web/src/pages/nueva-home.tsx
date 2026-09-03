// DEMO INTERNA — propuesta de nueva home para orbita.site, con el mismo
// lenguaje visual del hub de propuestas (/propuestas). Toda la información
// del sitio actual vive en modules/propuestas/home/datos.ts. No reemplaza
// pages/index.tsx: es para debatirla con el equipo en localhost.
import { useEffect, useRef, useState } from 'react'
import Head from 'next/head'
import Link from 'next/link'
import {
  ArrowRight, Check, X, Star, CalendarDays, Store, ShoppingBag, Users, Percent, Boxes, MessageCircle, BarChart3, Sparkles, CreditCard, Globe, LayoutTemplate, Zap, Menu, ChevronRight,
} from 'lucide-react'
import { OrbitaLogo } from '@/design-system/components/OrbitaLogo'
import { LEGAL_CONTENT, type LegalKey } from '@/modules/landing/components/ui/LegalModal'
import { C, CSS_DEMO, FONT, FONT_DISPLAY, FONT_MONO, FondoEstelar, Tarjeta, Chip, Etiqueta, Boton, OrbiAvatar } from '@/modules/propuestas/ui'
import { MODULOS, PILLS, PASOS, RUBROS, TESTIMONIOS, PROXIMAMENTE, NAV, FOOTER_COLS, type Modulo } from '@/modules/propuestas/home/datos'

const ICONOS = { CalendarDays, Store, ShoppingBag, Users, Percent, Boxes, MessageCircle, BarChart3, Sparkles, CreditCard, Globe, LayoutTemplate }

function Icono({ m, size = 20 }: { m: Modulo; size?: number }) {
  const I = ICONOS[m.icono]
  return <I size={size} />
}

// ─── Página ──────────────────────────────────────────────────────────────────

export default function NuevaHome() {
  const [legal, setLegal] = useState<LegalKey | null>(null)
  const [menu, setMenu] = useState(false)

  return (
    <>
      <Head><title>Órbita · Tu negocio, en órbita</title></Head>
      <style dangerouslySetInnerHTML={{ __html: CSS_DEMO + CSS_HOME }} />
      <FondoEstelar />

      <div style={{ position: 'relative', zIndex: 1, color: C.body, fontFamily: FONT, overflowX: 'clip' }}>
        <Navbar onMenu={() => setMenu(m => !m)} menu={menu} />

        <main>
          <Hero />
          <Cinta />
          <AntesDespues />
          <Modulos />
          <Orbi />
          <Rubros />
          <Testimonios />
          <Proximamente />
          <CtaFinal />
        </main>

        <Footer onLegal={setLegal} />
        <Aviso />
      </div>

      {legal && <Legal k={legal} onClose={() => setLegal(null)} />}
    </>
  )
}

// ─── Navbar ──────────────────────────────────────────────────────────────────

function Navbar({ onMenu, menu }: { onMenu: () => void; menu: boolean }) {
  const ir = (e: React.MouseEvent, href: string) => {
    e.preventDefault()
    const el = document.getElementById(href.slice(1))
    if (el) window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 76, behavior: 'smooth' })
  }
  return (
    <nav style={{ position: 'sticky', top: 0, zIndex: 60, backdropFilter: 'blur(18px)', WebkitBackdropFilter: 'blur(18px)', background: 'rgba(7,11,22,0.7)', borderBottom: `1px solid ${C.border}` }}>
      <div style={{ maxWidth: 1240, margin: '0 auto', padding: '12px 22px', display: 'flex', alignItems: 'center', gap: 20 }}>
        <a href="#" onClick={e => { e.preventDefault(); window.scrollTo({ top: 0, behavior: 'smooth' }) }} style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
          <OrbitaLogo size={30} />
          <span style={{ fontFamily: FONT_DISPLAY, fontWeight: 800, color: C.text, fontSize: 19, letterSpacing: '-0.02em' }}>Órbita</span>
        </a>
        <div className="nh-nav-links" style={{ flex: 1, display: 'flex', justifyContent: 'center', gap: 4 }}>
          {NAV.map(l => (
            <a key={l.href} href={l.href} onClick={e => ir(e, l.href)} className="nh-navlink">{l.label}</a>
          ))}
        </div>
        <div className="nh-nav-cta" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Link href="/login" className="nh-navlink">Iniciar sesión</Link>
          <Link href="/onboarding/rubro" style={{ textDecoration: 'none' }}><Boton>Crear tu espacio <ArrowRight size={15} /></Boton></Link>
        </div>
        <button className="nh-burger pr-btn" onClick={onMenu} aria-label="Abrir menú" style={{ background: 'rgba(148,163,184,.08)', border: `1px solid ${C.border}`, borderRadius: 10, width: 38, height: 38, color: C.text, display: 'none', placeItems: 'center' }}><Menu size={18} /></button>
      </div>
      {menu && (
        <div className="nh-menu" style={{ padding: '8px 22px 18px', display: 'grid', gap: 6, borderTop: `1px solid ${C.border}` }}>
          {NAV.map(l => <a key={l.href} href={l.href} onClick={e => { ir(e, l.href); onMenu() }} className="nh-navlink">{l.label}</a>)}
          <Link href="/login" className="nh-navlink">Iniciar sesión</Link>
          <Link href="/onboarding/rubro" style={{ textDecoration: 'none' }}><Boton style={{ width: '100%' }}>Crear tu espacio <ArrowRight size={15} /></Boton></Link>
        </div>
      )}
    </nav>
  )
}

// ─── Hero ────────────────────────────────────────────────────────────────────

function Hero() {
  const [hover, setHover] = useState<string | null>(null)
  const activo = hover ? MODULOS.find(m => m.id === hover) : null
  return (
    <section style={{ maxWidth: 1240, margin: '0 auto', padding: '56px 22px 30px', display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: 30, alignItems: 'center', minHeight: 'calc(100vh - 66px)' }} className="nh-hero">
      <div className="pr-fade-up">
        <Etiqueta color={C.primaryLight} style={{ marginBottom: 18 }}>La plataforma integral para negocios en Argentina</Etiqueta>
        <h1 style={{ fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: 'clamp(48px, 7vw, 92px)', lineHeight: 0.95, letterSpacing: '-0.045em', margin: 0, color: C.text }}>
          Tu negocio,<br />
          <span style={{ background: 'linear-gradient(90deg, #60A5FA, #A78BFA)', WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' }}>en órbita.</span>
        </h1>
        <p style={{ fontSize: 'clamp(17px, 2vw, 21px)', lineHeight: 1.5, color: C.body, margin: '24px 0 22px', maxWidth: 520 }}>
          Gestioná turnos, vendé online y entendé tu negocio con una sola plataforma integral. Sin comisiones, sin complicaciones.
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 28 }}>
          {PILLS.map(p => <Chip key={p} color={C.primaryLight} style={{ fontSize: 12.5, padding: '6px 12px' }}><Zap size={12} /> {p}</Chip>)}
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center', marginBottom: 28 }}>
          <Link href="/onboarding/rubro" style={{ textDecoration: 'none' }}><Boton tam="lg">Crear tu espacio <ArrowRight size={17} /></Boton></Link>
          <a href="#modulos" onClick={e => { e.preventDefault(); document.getElementById('modulos')?.scrollIntoView({ behavior: 'smooth' }) }} style={{ textDecoration: 'none' }}><Boton tam="lg" variante="fantasma">Ver cómo funciona</Boton></a>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 18, alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ display: 'flex' }}>
              {['MC', 'LR', 'SP', 'DR', 'VM'].map((a, i) => (
                <span key={a} style={{ width: 32, height: 32, borderRadius: 99, marginLeft: i ? -9 : 0, background: 'linear-gradient(135deg,#3b82f6,#6366f1)', border: '2px solid #070B16', color: '#fff', fontSize: 9, fontWeight: 800, display: 'grid', placeItems: 'center', zIndex: 5 - i, position: 'relative' }}>{a}</span>
              ))}
            </div>
            <div>
              <div style={{ color: C.text, fontWeight: 800, fontSize: 14 }}>+2.847 negocios</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>{[1, 2, 3, 4, 5].map(s => <Star key={s} size={11} fill="#FBBF24" color="#FBBF24" />)}<span style={{ fontSize: 12, color: C.muted, marginLeft: 4 }}>4.9</span></div>
            </div>
          </div>
          <span style={{ width: 1, height: 28, background: C.border }} />
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 14, fontWeight: 600 }}><Check size={15} color={C.success} /> Sin comisiones</span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 14, fontWeight: 600 }}><Check size={15} color={C.success} /> Gratis para empezar</span>
        </div>
      </div>

      <div className="pr-fade-up nh-galaxia-wrap" style={{ animationDelay: '.12s', position: 'relative', height: 620 }}>
        <GalaxiaModulos hover={hover} setHover={setHover} />
        <div style={{ position: 'absolute', left: '50%', bottom: 0, transform: 'translateX(-50%)', width: 380, pointerEvents: 'none', opacity: activo ? 1 : 0, transition: 'opacity .2s' }}>
          {activo && (
            <Tarjeta style={{ padding: '12px 16px', display: 'flex', gap: 12, alignItems: 'center', borderColor: `${activo.color}66` }}>
              <span style={{ width: 38, height: 38, borderRadius: 12, background: `${activo.color}22`, color: activo.color, display: 'grid', placeItems: 'center' }}><Icono m={activo} /></span>
              <div>
                <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 800, color: C.text }}>{activo.nombre}</div>
                <div style={{ fontSize: 13, color: C.muted, lineHeight: 1.4 }}>{activo.corto}</div>
              </div>
            </Tarjeta>
          )}
        </div>
      </div>
    </section>
  )
}

function GalaxiaModulos({ hover, setHover }: { hover: string | null; setHover: (id: string | null) => void }) {
  const a1 = MODULOS.filter(m => m.anillo === 1)
  const a2 = MODULOS.filter(m => m.anillo === 2)
  return (
    <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center' }}>
      <div className="nh-galaxia" style={{ position: 'relative', width: 580, height: 580 }}>
        <Anillo r={170} color={C.primary} dur={60} />
        <Anillo r={275} color={C.orbi} dur={95} reverse />
        <div style={{ position: 'absolute', left: '50%', top: '50%', width: 0, height: 0 }}>
          <div style={{ position: 'absolute', left: -50, top: -50, width: 100, height: 100, borderRadius: '50%', background: 'radial-gradient(circle at 35% 35%, #93C5FD, #3B82F6 45%, #1D4ED8 100%)', boxShadow: '0 0 60px rgba(59,130,246,.65), 0 0 120px rgba(59,130,246,.35)', display: 'grid', placeItems: 'center', animation: 'pr-pulse 5s ease-in-out infinite' }}>
            <span style={{ fontFamily: FONT_DISPLAY, fontWeight: 800, color: '#fff', fontSize: 12, letterSpacing: '0.1em' }}>TU NEGOCIO</span>
          </div>
        </div>
        {a1.map((m, i) => <Planeta key={m.id} m={m} r={170} ang={i * (360 / a1.length) - 90} dur={60} hover={hover} setHover={setHover} />)}
        {a2.map((m, i) => <Planeta key={m.id} m={m} r={275} ang={i * (360 / a2.length) - 64} dur={95} reverse hover={hover} setHover={setHover} />)}
      </div>
    </div>
  )
}

function Anillo({ r, color, dur, reverse }: { r: number; color: string; dur: number; reverse?: boolean }) {
  return (
    <div style={{ position: 'absolute', left: '50%', top: '50%', width: r * 2, height: r * 2, marginLeft: -r, marginTop: -r, borderRadius: '50%', border: `1px solid ${color}55`, boxShadow: `inset 0 0 40px ${color}11, 0 0 30px ${color}11`, animation: `${reverse ? 'pr-spin-rev' : 'pr-spin'} ${dur}s linear infinite` }}>
      <span style={{ position: 'absolute', top: -3, left: '50%', width: 6, height: 6, borderRadius: 99, background: color, boxShadow: `0 0 12px ${color}` }} />
    </div>
  )
}

function Planeta({ m, r, ang, dur, reverse, hover, setHover }: { m: Modulo; r: number; ang: number; dur: number; reverse?: boolean; hover: string | null; setHover: (id: string | null) => void }) {
  const activo = hover === m.id
  const apagado = hover !== null && !activo
  const delay = `-${(ang + 90) / 360 * dur}s`
  const ps = hover ? 'paused' : 'running'
  const ir = () => {
    const el = document.getElementById(`mod-${m.id}`) ?? document.getElementById('modulos')
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }
  return (
    <div style={{ position: 'absolute', left: '50%', top: '50%', width: 0, height: 0, transform: `rotate(${ang}deg)`, animation: `${reverse ? 'pr-spin-rev' : 'pr-spin'} ${dur}s linear infinite`, animationDelay: delay, animationPlayState: ps }}>
      <div style={{ position: 'absolute', left: r, top: 0, transform: `rotate(${-ang}deg)`, animation: `${reverse ? 'pr-spin' : 'pr-spin-rev'} ${dur}s linear infinite`, animationDelay: delay, animationPlayState: ps }}>
        <button onClick={ir} onMouseEnter={() => setHover(m.id)} onMouseLeave={() => setHover(null)} onFocus={() => setHover(m.id)} onBlur={() => setHover(null)} aria-label={m.nombre} style={{
          position: 'absolute', left: 0, top: 0, transform: `translate(-50%,-50%) scale(${activo ? 1.22 : 1})`, width: 58, height: 58, borderRadius: '50%', border: 'none', cursor: 'pointer',
          background: `radial-gradient(circle at 32% 30%, #fff8, ${m.color} 40%, ${m.color}66 100%)`,
          boxShadow: activo ? `0 0 40px ${m.color}, 0 0 80px ${m.color}66` : `0 0 20px ${m.color}77`,
          display: 'grid', placeItems: 'center', color: '#fff', transition: 'transform .2s, box-shadow .2s, opacity .2s', opacity: apagado ? .4 : 1,
        }}><Icono m={m} size={22} /></button>
        <div style={{ position: 'absolute', left: 0, top: 40, transform: 'translateX(-50%)', whiteSpace: 'nowrap', fontSize: 11.5, fontWeight: 700, color: activo ? C.text : C.muted, transition: 'color .2s', pointerEvents: 'none' }}>{m.nombre}</div>
      </div>
    </div>
  )
}

// ─── Cinta de confianza ──────────────────────────────────────────────────────

function Cinta() {
  const items = ['Sin comisiones por venta', 'Mercado Pago integrado', 'Recordatorios por WhatsApp', 'Dominio propio .com.ar', 'Veinte plantillas de tienda', 'Orbi, asistente con IA', 'Punto de venta en el mostrador', 'Gratis para empezar']
  return (
    <div style={{ borderTop: `1px solid ${C.border}`, borderBottom: `1px solid ${C.border}`, background: 'rgba(15,23,42,.35)', overflow: 'hidden', padding: '14px 0' }}>
      <div className="nh-marquee" style={{ display: 'flex', gap: 40, width: 'max-content', animationDuration: '38s' }}>
        {[...items, ...items].map((t, i) => (
          <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 13.5, fontWeight: 600, color: C.muted, whiteSpace: 'nowrap' }}><span style={{ width: 6, height: 6, borderRadius: 99, background: C.primary, boxShadow: `0 0 8px ${C.primary}` }} />{t}</span>
        ))}
      </div>
    </div>
  )
}

// ─── Antes / Después (interactivo) ───────────────────────────────────────────

const SUELTAS = [
  { n: 'WhatsApp', s: '48 sin responder', c: '#25D366', caos: { x: 8, y: 12, r: -8 } },
  { n: 'Instagram', s: 'catálogo en historias', c: '#E1306C', caos: { x: 70, y: 6, r: 6 } },
  { n: 'Excel', s: 'stock desactualizado', c: '#1D6F42', caos: { x: 62, y: 62, r: -5 } },
  { n: 'Cuaderno', s: 'turnos a mano', c: '#F59E0B', caos: { x: 6, y: 66, r: 9 } },
  { n: 'Calculadora', s: 'cierre de caja', c: '#94A3B8', caos: { x: 38, y: 34, r: -12 } },
  { n: 'Notas', s: 'pedidos anotados', c: '#FBBF24', caos: { x: 78, y: 36, r: 4 } },
]

function AntesDespues() {
  const [orbita, setOrbita] = useState(false)
  const antes = PASOS[0], despues = PASOS[1]
  const p = orbita ? despues : antes
  return (
    <section style={{ maxWidth: 1240, margin: '0 auto', padding: '90px 22px 40px' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, .9fr) minmax(0, 1.1fr)', gap: 40, alignItems: 'center' }} className="nh-2col">
        <div>
          <Chip color={orbita ? C.success : C.error} style={{ marginBottom: 18 }}>{p.etiqueta}</Chip>
          <h2 style={h2}>{p.titulo}<br /><span style={{ color: orbita ? C.primaryLight : '#F87171' }}>{p.resaltado}</span></h2>
          <p style={parrafo}>{p.desc}</p>
          <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 26px', display: 'grid', gap: 10 }}>
            {p.items.map(it => (
              <li key={it.texto} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 14.5, fontWeight: 600, color: C.text }}>
                {it.ok ? <Check size={18} color={C.success} /> : <X size={18} color={C.error} />}{it.texto}
              </li>
            ))}
          </ul>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 12, padding: 6, borderRadius: 999, background: 'rgba(148,163,184,.08)', border: `1px solid ${C.border}` }}>
            <button className="pr-btn" onClick={() => setOrbita(false)} style={{ ...toggleBtn, background: !orbita ? 'rgba(248,113,113,.2)' : 'transparent', color: !orbita ? '#FCA5A5' : C.muted }}>Antes</button>
            <button className="pr-btn" onClick={() => setOrbita(true)} style={{ ...toggleBtn, background: orbita ? 'rgba(59,130,246,.25)' : 'transparent', color: orbita ? '#93C5FD' : C.muted }}>Con Órbita</button>
          </div>
          <div style={{ fontSize: 12.5, color: C.subtle, marginTop: 10 }}>Tocá el interruptor y mirá qué pasa con las apps sueltas.</div>
        </div>

        <div style={{ position: 'relative', height: 440, borderRadius: 24, border: `1px solid ${C.border}`, background: 'rgba(15,23,42,.4)', overflow: 'hidden' }}>
          {/* Panel central */}
          <div style={{ position: 'absolute', left: '50%', top: '50%', transform: `translate(-50%,-50%) scale(${orbita ? 1 : .6})`, opacity: orbita ? 1 : .15, transition: 'all .7s cubic-bezier(.2,.8,.2,1)', width: 210, borderRadius: 18, background: '#fff', color: '#0F172A', boxShadow: '0 30px 80px rgba(0,0,0,.5), 0 0 60px rgba(59,130,246,.35)', padding: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}><OrbitaLogo size={18} animated={false} /><span style={{ fontWeight: 800, fontSize: 12 }}>Panel de Órbita</span></div>
            {[['Ventas hoy', '$184.300'], ['Turnos', '12 · 2 libres'], ['Pedidos', '7 pendientes'], ['Stock bajo', '3 productos']].map(([k, v]) => (
              <div key={k} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, padding: '6px 0', borderTop: '1px solid #E2E8F0' }}><span style={{ color: '#64748B' }}>{k}</span><b>{v}</b></div>
            ))}
          </div>
          {orbita && <div style={{ position: 'absolute', left: '50%', top: '50%', width: 340, height: 340, marginLeft: -170, marginTop: -170, borderRadius: '50%', border: `1px dashed ${C.primary}66`, animation: 'pr-spin 40s linear infinite' }} />}
          {SUELTAS.map((s, i) => {
            const ang = (i / SUELTAS.length) * Math.PI * 2 - Math.PI / 2
            const ox = 50 + Math.cos(ang) * 38, oy = 50 + Math.sin(ang) * 38
            const x = orbita ? ox : s.caos.x + 8, y = orbita ? oy : s.caos.y + 10
            return (
              <div key={s.n} style={{ position: 'absolute', left: `${x}%`, top: `${y}%`, transform: `translate(-50%,-50%) rotate(${orbita ? 0 : s.caos.r}deg) scale(${orbita ? .78 : 1})`, transition: `all .8s cubic-bezier(.2,.8,.2,1) ${i * 60}ms`, padding: '10px 14px', borderRadius: 14, background: orbita ? 'rgba(15,23,42,.9)' : 'rgba(30,41,59,.95)', border: `1px solid ${orbita ? s.c + '77' : 'rgba(248,113,113,.4)'}`, boxShadow: orbita ? `0 0 18px ${s.c}55` : '0 10px 30px rgba(0,0,0,.5)', animation: orbita ? undefined : `pr-float ${3 + i * .4}s ease-in-out infinite` }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ width: 10, height: 10, borderRadius: 99, background: s.c, boxShadow: `0 0 10px ${s.c}` }} />
                  <span style={{ fontWeight: 800, fontSize: 13, color: C.text }}>{s.n}</span>
                </div>
                <div style={{ fontSize: 11, color: orbita ? C.success : '#FCA5A5', marginTop: 2, display: 'flex', alignItems: 'center', gap: 4 }}>{orbita ? <><Check size={11} /> sincronizado</> : s.s}</div>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}

// ─── Módulos ─────────────────────────────────────────────────────────────────

function Modulos() {
  const destacados = PASOS.slice(2)
  return (
    <section id="modulos" style={{ maxWidth: 1240, margin: '0 auto', padding: '60px 22px 40px' }}>
      <div style={{ textAlign: 'center', marginBottom: 46 }}>
        <Etiqueta color={C.primaryLight} style={{ marginBottom: 12 }}>Módulos</Etiqueta>
        <h2 style={{ ...h2, fontSize: 'clamp(34px, 5vw, 54px)' }}>Todo lo que tu negocio necesita,<br /><span style={{ color: C.primaryLight }}>girando alrededor de vos.</span></h2>
      </div>

      <div style={{ display: 'grid', gap: 26 }}>
        {destacados.map((p, i) => {
          const mod = MODULOS.find(m => (p.mock === 'calendario' && m.id === 'turnos') || (p.mock === 'tienda' && m.id === 'tienda') || (p.mock === 'dashboard' && m.id === 'reportes'))!
          return (
            <Tarjeta key={p.id} id={`mod-${mod.id}`} style={{ padding: 34, display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: 34, alignItems: 'center', borderColor: `${mod.color}33` }} className="nh-2col">
              <div style={{ order: i % 2 ? 2 : 1 }}>
                <Chip color={p.variante === 'verde' ? C.success : mod.color} style={{ marginBottom: 16 }}>{p.etiqueta}</Chip>
                <h3 style={{ ...h2, fontSize: 'clamp(30px, 3.6vw, 44px)' }}>{p.titulo}<br /><span style={{ color: p.variante === 'verde' ? C.success : mod.color }}>{p.resaltado}</span></h3>
                <p style={parrafo}>{p.desc}</p>
                <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 10 }}>
                  {p.items.map(it => <li key={it.texto} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 14.5, fontWeight: 600, color: C.text }}><Check size={18} color={mod.color} />{it.texto}</li>)}
                </ul>
              </div>
              <div style={{ order: i % 2 ? 1 : 2 }}><Mock tipo={p.mock} color={mod.color} /></div>
            </Tarjeta>
          )
        })}
      </div>

      <div style={{ marginTop: 40 }}>
        <Etiqueta color={C.muted} style={{ marginBottom: 14, textAlign: 'center' }}>Y todo lo demás, en el mismo panel</Etiqueta>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
          {MODULOS.filter(m => !['turnos', 'tienda', 'reportes'].includes(m.id)).map(m => (
            <Tarjeta key={m.id} id={`mod-${m.id}`} className="pr-hover-lift" style={{ padding: 18, display: 'flex', gap: 14, alignItems: 'flex-start' }}>
              <span style={{ width: 42, height: 42, borderRadius: 13, flexShrink: 0, background: `${m.color}22`, color: m.color, border: `1px solid ${m.color}44`, display: 'grid', placeItems: 'center' }}><Icono m={m} /></span>
              <div>
                <div style={{ fontWeight: 800, color: C.text, fontSize: 15, marginBottom: 3 }}>{m.nombre}</div>
                <div style={{ fontSize: 13, color: C.muted, lineHeight: 1.45 }}>{m.corto}</div>
              </div>
            </Tarjeta>
          ))}
        </div>
      </div>
    </section>
  )
}

function Mock({ tipo, color }: { tipo: string; color: string }) {
  const marco: React.CSSProperties = { borderRadius: 18, background: '#fff', color: '#0F172A', padding: 18, boxShadow: `0 30px 80px rgba(0,0,0,.5), 0 0 50px ${color}22`, fontFamily: FONT, minHeight: 280 }
  if (tipo === 'calendario') {
    const horas = ['9:00', '10:00', '11:00', '12:00', '15:00', '16:00', '17:00', '18:00']
    const ocupadas: Record<string, string> = { '10:00': 'Lucía · Corte', '11:00': 'Tomás · Barba', '16:00': 'Juan · Corte + barba', '17:00': 'Mica · Color' }
    return (
      <div style={marco}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}><b style={{ fontSize: 14 }}>Jueves 4 de septiembre</b><Chip color={color}>8 turnos · 4 libres</Chip></div>
        <div style={{ display: 'grid', gap: 6 }}>
          {horas.map((h, i) => (
            <div key={h} className="pr-fade-up" style={{ animationDelay: `${i * 60}ms`, display: 'grid', gridTemplateColumns: '48px 1fr', gap: 10, alignItems: 'center' }}>
              <span style={{ fontSize: 12, color: '#64748B', fontFamily: FONT_MONO }}>{h}</span>
              <div style={{ height: 26, borderRadius: 8, background: ocupadas[h] ? `${color}22` : '#F1F5F9', border: `1px ${ocupadas[h] ? 'solid' : 'dashed'} ${ocupadas[h] ? color + '77' : '#CBD5E1'}`, display: 'flex', alignItems: 'center', padding: '0 10px', fontSize: 12, fontWeight: 600, color: ocupadas[h] ? '#1E3A8A' : '#94A3B8' }}>{ocupadas[h] ?? 'Libre · reservá desde el link'}</div>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 12, padding: 10, borderRadius: 10, background: '#ECFDF5', border: '1px solid #A7F3D0', fontSize: 12, color: '#065F46', display: 'flex', gap: 8, alignItems: 'center' }}><MessageCircle size={14} /> Recordatorio enviado a Lucía por WhatsApp: mañana 10:00.</div>
      </div>
    )
  }
  if (tipo === 'tienda') {
    const prods = [['Campera de jean', '$24.000', '#93C5FD'], ['Remera básica', '$8.500', '#FDE68A'], ['Jean recto', '$19.000', '#A5B4FC'], ['Buzo canguro', '$16.000', '#FCA5A5']]
    return (
      <div style={marco}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}><b style={{ fontSize: 14 }}>casaramos.orbita.site</b><Chip color={color}>Abierta 24/7</Chip></div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {prods.map(([n, p, c], i) => (
            <div key={n} className="pr-fade-up" style={{ animationDelay: `${i * 80}ms`, borderRadius: 12, border: '1px solid #E2E8F0', overflow: 'hidden' }}>
              <div style={{ height: 74, background: `linear-gradient(135deg, ${c}, #fff)` }} />
              <div style={{ padding: 8 }}><div style={{ fontSize: 12, fontWeight: 700 }}>{n}</div><div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><span style={{ fontSize: 13, fontWeight: 800 }}>{p}</span><span style={{ fontSize: 10, fontWeight: 800, color: '#fff', background: color, borderRadius: 6, padding: '3px 7px' }}>Agregar</span></div></div>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12, color: '#64748B' }}><span>Pago con Mercado Pago · 3 cuotas</span><b style={{ color: '#0F172A' }}>Sin comisiones</b></div>
      </div>
    )
  }
  if (tipo === 'dashboard') {
    const barras = [42, 55, 38, 70, 64, 88, 96]
    return (
      <div style={marco}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}><b style={{ fontSize: 14 }}>Esta semana</b><Chip color={C.success}>+18% vs. la anterior</Chip></div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 14 }}>
          {[['Ventas', '$412.000'], ['Ticket promedio', '$9.800'], ['Clientes nuevos', '31']].map(([k, v]) => <div key={k} style={{ padding: 10, borderRadius: 10, background: '#F8FAFC', border: '1px solid #E2E8F0' }}><div style={{ fontSize: 10.5, color: '#64748B' }}>{k}</div><div style={{ fontSize: 16, fontWeight: 800 }}>{v}</div></div>)}
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 120 }}>
          {barras.map((b, i) => <div key={i} style={{ flex: 1, height: `${b}%`, borderRadius: '6px 6px 2px 2px', background: i === 6 ? color : `${color}66`, transformOrigin: 'bottom', animation: `nh-grow .8s ${i * 80}ms cubic-bezier(.2,.8,.2,1) both` }} />)}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10.5, color: '#94A3B8', marginTop: 6 }}>{['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((d, i) => <span key={i}>{d}</span>)}</div>
        <div style={{ marginTop: 10, fontSize: 12, color: '#334155' }}>El sábado es tu mejor día: <b>ideal para promociones.</b></div>
      </div>
    )
  }
  return <div style={marco} />
}

// ─── Orbi ────────────────────────────────────────────────────────────────────

const CHAT_ORBI = [
  { de: 'vos', t: 'Orbi, ¿cómo vino la semana?' },
  { de: 'orbi', t: 'Vendiste $412.000, un 18% más que la anterior. Las remeras básicas llevan 40 días sin rotar.' },
  { de: 'orbi', t: '¿Querés que les arme un 20% de descuento para el fin de semana? Lo dejo listo y vos lo aprobás.' },
  { de: 'vos', t: 'Dale, armalo.' },
  { de: 'orbi', t: 'Listo: cupón REMERAS20, sábado y domingo. Te muestro cómo queda en la tienda.' },
]

function Orbi() {
  const [n, setN] = useState(0)
  const ref = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    let timers: number[] = []
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return
      io.disconnect()
      CHAT_ORBI.forEach((_, i) => { timers.push(window.setTimeout(() => setN(i + 1), 500 + i * 1100)) })
    }, { threshold: .4 })
    io.observe(el)
    return () => { io.disconnect(); timers.forEach(clearTimeout); timers = [] }
  }, [])
  return (
    <section style={{ maxWidth: 1240, margin: '0 auto', padding: '60px 22px' }}>
      <div style={{ borderRadius: 28, padding: 2, background: 'linear-gradient(135deg, #3B82F6, #8B5CF6, transparent 70%)' }}>
        <div style={{ borderRadius: 26, background: 'rgba(7,11,22,.9)', padding: 40, display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: 40, alignItems: 'center' }} className="nh-2col">
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}><OrbiAvatar size={36} /><Chip color={C.orbiLight}><Sparkles size={12} /> Asistente con IA · incluido</Chip></div>
            <h2 style={h2}>Orbi trabaja<br /><span style={{ background: 'linear-gradient(90deg, #60A5FA, #A78BFA)', WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' }}>adentro de tu negocio.</span></h2>
            <p style={parrafo}>No es un chat genérico: Orbi ve tu catálogo, tus pedidos y tus clientes. Crea productos, redacta descripciones, lee reportes y te lleva a la pantalla justa. En rioplatense y sin vueltas.</p>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 10 }}>
              {['Crea productos y descripciones con vos', 'Explica tus métricas en criollo', 'Cambia estados de pedidos y arma descuentos', 'Te guía cuando recién empezás'].map(t => <li key={t} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 14.5, fontWeight: 600, color: C.text }}><Check size={18} color={C.orbiLight} />{t}</li>)}
            </ul>
          </div>
          <div ref={ref} style={{ borderRadius: 20, background: '#fff', color: '#0F172A', padding: 18, minHeight: 330, boxShadow: '0 30px 80px rgba(0,0,0,.5), 0 0 60px rgba(139,92,246,.3)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingBottom: 12, borderBottom: '1px solid #E2E8F0', marginBottom: 12 }}><OrbiAvatar size={26} /><b style={{ fontSize: 13 }}>Orbi</b><span style={{ fontSize: 11, color: '#64748B' }}>· Casa Ramos · Dashboard</span></div>
            <div style={{ display: 'grid', gap: 8 }}>
              {CHAT_ORBI.slice(0, n).map((m, i) => (
                <div key={i} className="pr-fade-up" style={{ justifySelf: m.de === 'vos' ? 'end' : 'start', maxWidth: '85%', padding: '9px 12px', borderRadius: 14, fontSize: 13.5, lineHeight: 1.45, background: m.de === 'vos' ? '#3B82F6' : '#F1F5F9', color: m.de === 'vos' ? '#fff' : '#0F172A' }}>{m.t}</div>
              ))}
              {n < CHAT_ORBI.length && n > 0 && (
                <div style={{ display: 'flex', gap: 4, padding: '8px 12px' }}>{[0, 1, 2].map(i => <span key={i} style={{ width: 6, height: 6, borderRadius: 99, background: '#94A3B8', animation: `pr-typing 1s ${i * .15}s infinite` }} />)}</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

// ─── Rubros ──────────────────────────────────────────────────────────────────

function Rubros() {
  return (
    <section id="rubros" style={{ padding: '60px 0 40px', overflow: 'hidden' }}>
      <div style={{ maxWidth: 1240, margin: '0 auto', padding: '0 22px', textAlign: 'center', marginBottom: 34 }}>
        <Etiqueta color={C.primaryLight} style={{ marginBottom: 12 }}>Para cualquier rubro</Etiqueta>
        <h2 style={{ ...h2, fontSize: 'clamp(34px, 5vw, 54px)' }}>Adaptable a<br /><span style={{ color: C.primaryLight }}>cualquier negocio.</span></h2>
        <p style={{ ...parrafo, maxWidth: 640, margin: '0 auto 22px' }}>Ya sea una peluquería, un restaurante, una tienda o un spa: Órbita se adapta a tu forma de trabajar.</p>
        <Link href="/onboarding/rubro" style={{ textDecoration: 'none' }}><Boton>Crear tu espacio <ArrowRight size={15} /></Boton></Link>
      </div>
      <div className="nh-marquee" style={{ display: 'flex', gap: 16, width: 'max-content', animationDuration: '55s', padding: '10px 0' }}>
        {[...RUBROS, ...RUBROS].map((r, i) => (
          <div key={i} className="pr-hover-lift" style={{ width: 170, height: 230, borderRadius: 20, overflow: 'hidden', position: 'relative', border: `1px solid ${C.border}`, boxShadow: '0 20px 50px rgba(0,0,0,.5)', flexShrink: 0 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={r.img} alt={r.nombre} loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
            <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(2,6,23,.92) 0%, rgba(2,6,23,.15) 45%, transparent 68%)' }} />
            <div style={{ position: 'absolute', left: 0, right: 0, bottom: 14, textAlign: 'center', fontWeight: 800, color: '#fff', fontSize: 14, letterSpacing: '0.02em' }}>{r.nombre}</div>
          </div>
        ))}
      </div>
    </section>
  )
}

// ─── Testimonios ─────────────────────────────────────────────────────────────

function Testimonios() {
  return (
    <section id="testimonios" style={{ maxWidth: 1240, margin: '0 auto', padding: '60px 22px 40px' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'end', justifyContent: 'space-between', gap: 20, marginBottom: 30 }}>
        <div>
          <Etiqueta color={C.warning} style={{ marginBottom: 12 }}>Testimonios</Etiqueta>
          <h2 style={h2}>Lo que dicen nuestros<br /><span style={{ color: C.primaryLight }}>usuarios.</span></h2>
        </div>
        <Tarjeta style={{ padding: '14px 20px', display: 'flex', alignItems: 'center', gap: 16 }}>
          <div>
            <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: 30, color: C.text, lineHeight: 1 }}>4.9 <span style={{ fontSize: 14, color: C.muted, fontWeight: 600 }}>/ 5</span></div>
            <div style={{ display: 'flex', gap: 2, marginTop: 6 }}>{[1, 2, 3, 4, 5].map(s => <Star key={s} size={13} fill="#FBBF24" color="#FBBF24" />)}</div>
          </div>
          <div style={{ fontSize: 13, color: C.muted, lineHeight: 1.4 }}>promedio<br /><b style={{ color: C.text }}>+2.847 reseñas verificadas</b></div>
        </Tarjeta>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 14 }}>
        {TESTIMONIOS.map((t, i) => (
          <Tarjeta key={t.nombre} className="pr-hover-lift" style={{ padding: 22, display: 'flex', flexDirection: 'column', gap: 14, gridColumn: i === 0 || i === 4 ? 'span 2' : undefined }}>
            <div style={{ display: 'flex', gap: 2 }}>{[1, 2, 3, 4, 5].map(s => <Star key={s} size={12} fill="#FBBF24" color="#FBBF24" />)}</div>
            <p style={{ margin: 0, fontSize: i === 0 || i === 4 ? 17 : 14.5, lineHeight: 1.55, color: C.text, flex: 1 }}>“{t.texto}”</p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ width: 38, height: 38, borderRadius: 99, background: `linear-gradient(135deg, ${t.color}, ${C.orbi})`, color: '#fff', fontWeight: 800, fontSize: 12, display: 'grid', placeItems: 'center' }}>{t.ini}</span>
              <div><div style={{ fontWeight: 800, color: C.text, fontSize: 14 }}>{t.nombre}</div><div style={{ fontSize: 12.5, color: C.muted }}>{t.rol}</div></div>
            </div>
          </Tarjeta>
        ))}
      </div>
    </section>
  )
}

// ─── Próximamente ────────────────────────────────────────────────────────────

function Proximamente() {
  return (
    <section id="proximamente" style={{ maxWidth: 1240, margin: '0 auto', padding: '60px 22px 40px' }}>
      <div style={{ textAlign: 'center', marginBottom: 40 }}>
        <Chip color={C.warning} style={{ marginBottom: 14 }}><Zap size={12} /> Próximamente</Chip>
        <h2 style={{ ...h2, fontSize: 'clamp(34px, 5vw, 54px)' }}>Lo que viene para<br /><span style={{ color: C.primaryLight }}>Órbita.</span></h2>
        <p style={{ ...parrafo, maxWidth: 620, margin: '0 auto' }}>Estamos construyendo el futuro del management para pequeñas empresas. Acá está el roadmap.</p>
      </div>
      <div style={{ position: 'relative' }}>
        <div className="nh-traza" style={{ position: 'absolute', left: '8%', right: '8%', top: 34, height: 2, background: `linear-gradient(90deg, ${C.primary}, ${C.orbi}, ${C.success})`, opacity: .5 }} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 18 }} className="nh-3col">
          {PROXIMAMENTE.map((p, i) => (
            <div key={p.titulo} className="pr-fade-up" style={{ animationDelay: `${i * 120}ms`, textAlign: 'center' }}>
              <div style={{ width: 70, height: 70, margin: '0 auto 16px', borderRadius: '50%', background: `radial-gradient(circle at 32% 30%, #fff8, ${p.color} 40%, ${p.color}66)`, boxShadow: `0 0 30px ${p.color}77`, display: 'grid', placeItems: 'center', position: 'relative', zIndex: 1, fontFamily: FONT_DISPLAY, fontWeight: 800, color: '#fff', fontSize: 12 }}>{p.eta}</div>
              <Tarjeta style={{ padding: 22 }}>
                <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 800, color: C.text, fontSize: 18, marginBottom: 6 }}>{p.titulo}</div>
                <div style={{ fontSize: 14, color: C.muted, lineHeight: 1.5 }}>{p.desc}</div>
              </Tarjeta>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ─── CTA final ───────────────────────────────────────────────────────────────

function CtaFinal() {
  return (
    <section style={{ maxWidth: 1000, margin: '0 auto', padding: '50px 22px 80px' }}>
      <div style={{ position: 'relative', overflow: 'hidden', borderRadius: 30, padding: '60px 30px', textAlign: 'center', background: 'linear-gradient(135deg, #2563EB, #4F46E5 60%, #7C3AED)', boxShadow: '0 40px 100px rgba(59,130,246,.35)' }}>
        <div style={{ position: 'absolute', inset: 0, opacity: .18, background: 'radial-gradient(circle at 50% 0%, #fff 0%, transparent 60%)' }} />
        <div style={{ position: 'absolute', left: '50%', top: '50%', width: 700, height: 700, marginLeft: -350, marginTop: -350, borderRadius: '50%', border: '1px solid rgba(255,255,255,.15)', animation: 'pr-spin 50s linear infinite' }}><span style={{ position: 'absolute', top: -4, left: '50%', width: 8, height: 8, borderRadius: 99, background: '#fff', boxShadow: '0 0 14px #fff' }} /></div>
        <div style={{ position: 'relative', zIndex: 1 }}>
          <h3 style={{ fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: 'clamp(28px, 4vw, 44px)', color: '#fff', margin: '0 0 12px', letterSpacing: '-0.03em' }}>Tu negocio merece estar en órbita.</h3>
          <p style={{ color: '#DBEAFE', fontSize: 16, maxWidth: 440, margin: '0 auto 28px', lineHeight: 1.5 }}>Configurá tu espacio en minutos y empezá a gestionar turnos, ventas y clientes desde un solo lugar.</p>
          <Link href="/onboarding/rubro" style={{ textDecoration: 'none' }}><Boton tam="lg" style={{ background: '#fff', color: '#2563EB', boxShadow: '0 10px 30px rgba(0,0,0,.2)' }}>Crear tu espacio <ArrowRight size={17} /></Boton></Link>
        </div>
      </div>
    </section>
  )
}

// ─── Footer ──────────────────────────────────────────────────────────────────

function Footer({ onLegal }: { onLegal: (k: LegalKey) => void }) {
  const ir = (e: React.MouseEvent, href: string) => {
    e.preventDefault()
    const el = document.getElementById(href.slice(1))
    if (el) window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 76, behavior: 'smooth' })
  }
  return (
    <footer style={{ borderTop: `1px solid ${C.border}`, background: 'rgba(7,11,22,.6)', padding: '56px 22px 28px' }}>
      <div style={{ maxWidth: 1240, margin: '0 auto' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr 1fr 1fr', gap: 34, marginBottom: 40 }} className="nh-footer-cols">
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}><OrbitaLogo size={28} animated={false} /><span style={{ fontFamily: FONT_DISPLAY, fontWeight: 800, color: C.text, fontSize: 18 }}>Órbita</span></div>
            <p style={{ fontSize: 14, color: C.muted, lineHeight: 1.55, maxWidth: 260, margin: 0 }}>La plataforma integral que pone tu negocio en órbita. Turnos, ventas, clientes y analytics en un solo lugar.</p>
          </div>
          {FOOTER_COLS.map(c => (
            <div key={c.titulo}>
              <Etiqueta color={C.subtle} style={{ marginBottom: 14 }}>{c.titulo}</Etiqueta>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 10 }}>
                {c.links.map(l => <li key={l.label}><a href={l.href} onClick={e => ir(e, l.href)} className="nh-footlink">{l.label}</a></li>)}
              </ul>
            </div>
          ))}
          <div>
            <Etiqueta color={C.subtle} style={{ marginBottom: 14 }}>Legal &amp; Contacto</Etiqueta>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 10 }}>
              {([['Términos de uso', 'terminos'], ['Privacidad', 'privacidad'], ['Cookies', 'cookies']] as [string, LegalKey][]).map(([l, k]) => <li key={k}><button onClick={() => onLegal(k)} className="nh-footlink" style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', font: 'inherit' }}>{l}</button></li>)}
              <li><a href="mailto:legal@orbita.app" className="nh-footlink">legal@orbita.app</a></li>
            </ul>
          </div>
        </div>
        <div style={{ paddingTop: 22, borderTop: `1px solid ${C.border}`, display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: 10, fontSize: 13, color: C.subtle }}>
          <span>© 2026 Órbita. Todos los derechos reservados.</span>
          <span>Hecho por emprendedores, para emprendedores</span>
        </div>
      </div>
    </footer>
  )
}

function Legal({ k, onClose }: { k: LegalKey; onClose: () => void }) {
  const c = LEGAL_CONTENT[k]
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [onClose])
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'grid', placeItems: 'center', padding: 20 }}>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(2,6,23,.7)', backdropFilter: 'blur(6px)' }} />
      <Tarjeta className="pr-fade-up" style={{ position: 'relative', width: '100%', maxWidth: 680, maxHeight: '85vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'rgba(15,23,42,.96)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '18px 22px', borderBottom: `1px solid ${C.border}` }}>
          <div><div style={{ fontFamily: FONT_DISPLAY, fontWeight: 800, color: C.text, fontSize: 18 }}>{c.title}</div><div style={{ fontSize: 12, color: C.subtle, marginTop: 2 }}>{c.date}</div></div>
          <button onClick={onClose} aria-label="Cerrar" className="pr-btn" style={{ background: 'rgba(148,163,184,.1)', border: 'none', color: C.text, width: 34, height: 34, borderRadius: 9, display: 'grid', placeItems: 'center' }}><X size={16} /></button>
        </div>
        <div className="pr-scroll" style={{ overflowY: 'auto', padding: 22, display: 'grid', gap: 18 }}>
          {c.sections.map(s => <div key={s.subtitle}><div style={{ fontWeight: 800, color: C.primaryLight, fontSize: 13.5, marginBottom: 4 }}>{s.subtitle}</div><p style={{ margin: 0, fontSize: 14, lineHeight: 1.6, color: C.body }}>{s.text}</p></div>)}
          <div style={{ padding: 12, borderRadius: 10, background: 'rgba(59,130,246,.12)', border: `1px solid ${C.primary}44`, fontSize: 12.5, color: '#BFDBFE', textAlign: 'center' }}>Para consultas legales contactá a <b>legal@orbita.app</b></div>
        </div>
        <div style={{ padding: '14px 22px', borderTop: `1px solid ${C.border}`, display: 'flex', justifyContent: 'flex-end' }}><Boton onClick={onClose}>Entendido</Boton></div>
      </Tarjeta>
    </div>
  )
}

function Aviso() {
  return (
    <div style={{ position: 'fixed', right: 14, bottom: 14, zIndex: 70 }}>
      <Link href="/propuestas" style={{ textDecoration: 'none' }}>
        <Tarjeta style={{ padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: C.muted, background: 'rgba(7,11,22,.85)' }}>
          <span style={{ width: 8, height: 8, borderRadius: 99, background: C.warning, boxShadow: `0 0 8px ${C.warning}` }} /> Propuesta de nueva home · demo interna <ChevronRight size={13} />
        </Tarjeta>
      </Link>
    </div>
  )
}

// ─── Estilos ─────────────────────────────────────────────────────────────────

const h2: React.CSSProperties = { fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: 'clamp(32px, 4.2vw, 50px)', lineHeight: 1.04, letterSpacing: '-0.035em', color: C.text, margin: '0 0 16px' }
const parrafo: React.CSSProperties = { fontSize: 16.5, lineHeight: 1.6, color: C.body, margin: '0 0 22px', maxWidth: 560 }
const toggleBtn: React.CSSProperties = { padding: '9px 18px', borderRadius: 999, border: 'none', fontFamily: FONT, fontWeight: 800, fontSize: 13.5 }

const CSS_HOME = `
  .nh-navlink { color: ${C.muted}; text-decoration: none; font-size: 14px; font-weight: 600; padding: 8px 12px; border-radius: 10px; transition: color .15s, background .15s; }
  .nh-navlink:hover { color: ${C.text}; background: rgba(148,163,184,.08); }
  .nh-footlink { color: ${C.muted}; text-decoration: none; font-size: 14px; transition: color .15s; }
  .nh-footlink:hover { color: ${C.primaryLight}; }
  @keyframes nh-marquee { from { transform: translateX(0); } to { transform: translateX(-50%); } }
  .nh-marquee { animation: nh-marquee linear infinite; }
  .nh-marquee:hover { animation-play-state: paused; }
  @keyframes nh-grow { from { transform: scaleY(0); } to { transform: scaleY(1); } }
  html { scroll-behavior: smooth; }
  @media (max-width: 960px) {
    .nh-hero { grid-template-columns: minmax(0,1fr) !important; min-height: 0 !important; }
    .nh-galaxia-wrap { height: 460px !important; }
    .nh-galaxia { transform: scale(.7); }
    .nh-2col { grid-template-columns: minmax(0,1fr) !important; }
    .nh-3col { grid-template-columns: minmax(0,1fr) !important; }
    .nh-traza { display: none; }
    .nh-footer-cols { grid-template-columns: 1fr 1fr !important; }
    .nh-nav-links, .nh-nav-cta { display: none !important; }
    .nh-burger { display: grid !important; margin-left: auto; }
  }
  @media (min-width: 961px) { .nh-menu { display: none !important; } }
`
