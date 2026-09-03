// src/modules/propuestas/Shell.tsx — Cáscara de cada página de propuesta:
// barra de navegación entre las 10, cabecera con la idea, el prototipo
// interactivo, el "cómo funcionaría", riesgos, y el widget de debate del
// equipo (votos + notas, guardados en localStorage de esta máquina).

import { useEffect, useState, type ReactNode } from 'react'
import Head from 'next/head'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { ArrowLeft, ArrowRight, ChevronLeft, Sparkles, MessageSquare, Zap, Gauge } from 'lucide-react'
import { PROPUESTAS, GRUPOS, type Propuesta } from './datos'
import { C, CSS_DEMO, FONT, FONT_DISPLAY, FondoEstelar, Tarjeta, Chip, Etiqueta, Boton } from './ui'
import { useDebate, useClaveLocal, escribirClaveLocal, type Voto } from './debate'

export function ShellPropuesta({ p, children }: { p: Propuesta; children: ReactNode }) {
  const router = useRouter()
  const idx = PROPUESTAS.findIndex(x => x.id === p.id)
  const prev = PROPUESTAS[(idx - 1 + PROPUESTAS.length) % PROPUESTAS.length]
  const next = PROPUESTAS[(idx + 1) % PROPUESTAS.length]
  const grupo = GRUPOS[p.grupo]

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return
      if (e.key === 'ArrowRight') router.push(`/propuestas/${next.id}`)
      if (e.key === 'ArrowLeft') router.push(`/propuestas/${prev.id}`)
      if (e.key === 'Escape') router.push('/propuestas')
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [router, next.id, prev.id])

  return (
    <>
      <Head><title>{`${p.numero}. ${p.nombre} · Propuestas Órbita`}</title></Head>
      <style dangerouslySetInnerHTML={{ __html: CSS_DEMO }} />
      <FondoEstelar acento={p.color} acento2={p.grupo === 'con-orbi' ? C.orbi : C.primary} />

      <div style={{ position: 'relative', zIndex: 1, minHeight: '100vh', color: C.body, fontFamily: FONT }}>
        {/* Barra superior */}
        <nav style={{ position: 'sticky', top: 0, zIndex: 50, backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', background: 'rgba(7,11,22,0.72)', borderBottom: `1px solid ${C.border}` }}>
          <div style={{ maxWidth: 1240, margin: '0 auto', padding: '10px 22px', display: 'flex', alignItems: 'center', gap: 14 }}>
            <Link href="/propuestas" className="pr-link" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600, color: C.muted }}>
              <ChevronLeft size={16} /> Todas las propuestas
            </Link>
            <div style={{ flex: 1, display: 'flex', gap: 5, justifyContent: 'center', flexWrap: 'wrap' }}>
              {PROPUESTAS.map(x => (
                <Link key={x.id} href={`/propuestas/${x.id}`} title={x.nombre} style={{
                  width: 30, height: 30, borderRadius: 9, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800, textDecoration: 'none',
                  color: x.id === p.id ? '#fff' : C.muted,
                  background: x.id === p.id ? x.color : 'rgba(148,163,184,0.08)',
                  border: `1px solid ${x.id === p.id ? x.color : C.border}`,
                  boxShadow: x.id === p.id ? `0 0 18px ${x.color}88` : undefined,
                  transition: 'all .15s',
                }}>{x.numero}</Link>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <Link href={`/propuestas/${prev.id}`} title={`← ${prev.nombre}`} style={navBtn}><ArrowLeft size={16} /></Link>
              <Link href={`/propuestas/${next.id}`} title={`${next.nombre} →`} style={navBtn}><ArrowRight size={16} /></Link>
            </div>
          </div>
        </nav>

        <main style={{ maxWidth: 1240, margin: '0 auto', padding: '36px 22px 80px' }}>
          {/* Cabecera */}
          <header className="pr-fade-up" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.4fr) minmax(280px, 0.9fr)', gap: 28, alignItems: 'end', marginBottom: 28 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                <Chip color={grupo.color}>{p.grupo === 'con-orbi' ? <Sparkles size={12} /> : null}{grupo.titulo}</Chip>
                <Chip color={p.color}>Propuesta {p.numero} de {PROPUESTAS.length}</Chip>
              </div>
              <h1 style={{ fontFamily: FONT_DISPLAY, fontSize: 52, fontWeight: 800, letterSpacing: '-0.03em', color: C.text, margin: 0, lineHeight: 1.02, display: 'flex', alignItems: 'center', gap: 16 }}>
                <span style={{ fontSize: 44, filter: `drop-shadow(0 0 18px ${p.color}AA)` }}>{p.emoji}</span>
                {p.nombre}
              </h1>
              <p style={{ fontSize: 21, lineHeight: 1.4, color: C.body, margin: '16px 0 0', maxWidth: 720, fontWeight: 500 }}>{p.tagline}</p>
            </div>
            <Tarjeta style={{ padding: 18 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <Medidor etiqueta="Impacto" valor={p.impacto} color={C.success} icono={<Zap size={13} />} />
                <Medidor etiqueta="Esfuerzo" valor={p.esfuerzo} color={C.warning} icono={<Gauge size={13} />} />
              </div>
              <div style={{ marginTop: 14, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {p.toca.map(t => <Chip key={t} color={C.muted} style={{ fontWeight: 500 }}>{t}</Chip>)}
              </div>
            </Tarjeta>
          </header>

          {/* Prototipo */}
          <section className="pr-fade-up" style={{ animationDelay: '.08s', marginBottom: 40 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <Etiqueta color={p.color}>Prototipo interactivo · tocá, probá, rompelo</Etiqueta>
              <span style={{ fontSize: 12, color: C.subtle }}>Datos de ejemplo. Nada se guarda.</span>
            </div>
            <div style={{ borderRadius: 24, padding: 2, background: `linear-gradient(135deg, ${p.color}66, transparent 40%, transparent 60%, ${p.color}33)` }}>
              <div style={{ borderRadius: 22, background: 'rgba(7,11,22,0.85)', backdropFilter: 'blur(20px)', overflow: 'hidden' }}>
                {children}
              </div>
            </div>
          </section>

          {/* La idea */}
          <section className="pr-fade-up" style={{ animationDelay: '.14s', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 18, marginBottom: 40 }}>
            <Tarjeta style={{ padding: 24 }}>
              <Etiqueta color={p.color} style={{ marginBottom: 10 }}>Qué es</Etiqueta>
              <p style={par}>{p.resumen}</p>
            </Tarjeta>
            <Tarjeta style={{ padding: 24 }}>
              <Etiqueta color={p.color} style={{ marginBottom: 10 }}>Por qué no existe</Etiqueta>
              <p style={par}>{p.porQueUnico}</p>
            </Tarjeta>
            <Tarjeta style={{ padding: 24 }}>
              <Etiqueta color={p.color} style={{ marginBottom: 10 }}>Por qué Órbita</Etiqueta>
              <p style={par}>{p.porQueOrbita}</p>
            </Tarjeta>
          </section>

          {/* Cómo funcionaría */}
          <section className="pr-fade-up" style={{ animationDelay: '.2s', marginBottom: 40 }}>
            <Etiqueta color={p.color} style={{ marginBottom: 14 }}>Cómo funcionaría</Etiqueta>
            <div style={{ display: 'grid', gridTemplateColumns: `repeat(${p.pasos.length}, minmax(0, 1fr))`, gap: 14 }}>
              {p.pasos.map((s, i) => (
                <Tarjeta key={i} className="pr-hover-lift" style={{ padding: 20, position: 'relative' }}>
                  <div style={{ width: 34, height: 34, borderRadius: 10, background: `${p.color}22`, color: p.color, border: `1px solid ${p.color}55`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 14, marginBottom: 12, fontFamily: FONT_DISPLAY }}>{i + 1}</div>
                  <div style={{ fontWeight: 700, color: C.text, marginBottom: 6, fontSize: 15 }}>{s.titulo}</div>
                  <div style={{ fontSize: 13.5, lineHeight: 1.55, color: C.muted }}>{s.detalle}</div>
                </Tarjeta>
              ))}
            </div>
          </section>

          {/* Riesgos + Debate */}
          <section className="pr-fade-up" style={{ animationDelay: '.26s', display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(320px, 1.2fr)', gap: 18 }}>
            <Tarjeta style={{ padding: 24 }}>
              <Etiqueta color={C.warning} style={{ marginBottom: 12 }}>Para debatir · riesgos</Etiqueta>
              <ul style={{ margin: 0, paddingLeft: 18, display: 'grid', gap: 8 }}>
                {p.riesgos.map((r, i) => <li key={i} style={{ fontSize: 14, lineHeight: 1.5, color: C.body }}>{r}</li>)}
              </ul>
            </Tarjeta>
            <Debate p={p} />
          </section>

          <footer style={{ marginTop: 40, display: 'flex', justifyContent: 'space-between', gap: 12 }}>
            <Link href={`/propuestas/${prev.id}`} style={{ textDecoration: 'none' }}>
              <Boton variante="fantasma"><ArrowLeft size={16} /> {prev.numero}. {prev.nombre}</Boton>
            </Link>
            <Link href={`/propuestas/${next.id}`} style={{ textDecoration: 'none' }}>
              <Boton color={next.color}>{next.numero}. {next.nombre} <ArrowRight size={16} /></Boton>
            </Link>
          </footer>
        </main>
      </div>
      <style dangerouslySetInnerHTML={{ __html: `
        @media (max-width: 900px) {
          main header { grid-template-columns: minmax(0,1fr) !important; }
          main h1 { font-size: 36px !important; }
          main section { grid-template-columns: minmax(0,1fr) !important; }
        }
      ` }} />
    </>
  )
}

const navBtn: React.CSSProperties = { width: 32, height: 32, borderRadius: 9, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: C.body, background: 'rgba(148,163,184,0.08)', border: `1px solid ${C.border}` }
const par: React.CSSProperties = { fontSize: 14.5, lineHeight: 1.65, color: C.body, margin: 0 }

function Medidor({ etiqueta, valor, color, icono }: { etiqueta: string; valor: number; color: string; icono: ReactNode }) {
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: C.muted, marginBottom: 8 }}>{icono}{etiqueta}</div>
      <div style={{ display: 'flex', gap: 4 }}>
        {[1, 2, 3, 4, 5].map(i => <span key={i} style={{ flex: 1, height: 8, borderRadius: 4, background: i <= valor ? color : 'rgba(148,163,184,0.15)', boxShadow: i <= valor ? `0 0 10px ${color}77` : undefined }} />)}
      </div>
    </div>
  )
}

// ─── Debate del equipo ───────────────────────────────────────────────────────

function Debate({ p }: { p: Propuesta }) {
  const { votos, notas, votar, agregarNota, borrarNota } = useDebate(p.id)
  const nombre = useClaveLocal('pr-nombre') ?? ''
  const setNombre = (v: string) => escribirClaveLocal('pr-nombre', v)
  const [texto, setTexto] = useState('')

  const opciones: { v: Voto; label: string; color: string }[] = [
    { v: 'hacer', label: 'Hacerla ya', color: C.success },
    { v: 'tal-vez', label: 'Tiene algo', color: C.warning },
    { v: 'no', label: 'No va', color: C.error },
  ]

  return (
    <Tarjeta style={{ padding: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <MessageSquare size={14} color={C.orbiLight} />
        <Etiqueta color={C.orbiLight}>Debate del equipo · se guarda en esta compu</Etiqueta>
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
        {opciones.map(o => {
          const n = votos.filter(v => v.voto === o.v).length
          const mio = votos.find(v => v.nombre === (nombre || 'Anónimo'))?.voto === o.v
          return (
            <button key={o.v} className="pr-btn" onClick={() => votar(nombre || 'Anónimo', o.v)} style={{
              flex: 1, minWidth: 110, padding: '10px 12px', borderRadius: 12, fontFamily: FONT, fontWeight: 700, fontSize: 13,
              background: mio ? `${o.color}33` : 'rgba(148,163,184,0.06)', color: mio ? o.color : C.body, border: `1px solid ${mio ? o.color : C.border}`,
            }}>
              {o.label} <span style={{ marginLeft: 6, opacity: .7, fontFamily: FONT_DISPLAY }}>{n}</span>
            </button>
          )
        })}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '130px 1fr auto', gap: 8, marginBottom: 12 }}>
        <input className="pr-input" placeholder="Tu nombre" value={nombre} onChange={e => setNombre(e.target.value)} />
        <input className="pr-input" placeholder="Una nota, una duda, una mejora…" value={texto} onChange={e => setTexto(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && texto.trim()) { agregarNota(nombre || 'Anónimo', texto.trim()); setTexto('') } }} />
        <Boton color={C.orbi} onClick={() => { if (texto.trim()) { agregarNota(nombre || 'Anónimo', texto.trim()); setTexto('') } }}>Anotar</Boton>
      </div>
      {notas.length === 0 ? (
        <div style={{ fontSize: 13, color: C.subtle }}>Todavía no hay notas. Lo que anoten acá aparece resumido en el hub.</div>
      ) : (
        <div style={{ display: 'grid', gap: 8, maxHeight: 220, overflowY: 'auto' }} className="pr-scroll">
          {notas.map(n => (
            <div key={n.id} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '10px 12px', borderRadius: 10, background: 'rgba(148,163,184,0.06)', border: `1px solid ${C.border}` }}>
              <span style={{ width: 26, height: 26, borderRadius: 99, background: `linear-gradient(135deg, ${p.color}, ${C.orbi})`, color: '#fff', fontSize: 11, fontWeight: 800, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{n.nombre.slice(0, 2).toUpperCase()}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, color: C.muted, marginBottom: 2 }}>{n.nombre} · {new Date(n.fecha).toLocaleString('es-AR', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' })}</div>
                <div style={{ fontSize: 14, color: C.text, lineHeight: 1.45 }}>{n.texto}</div>
              </div>
              <button className="pr-btn" onClick={() => borrarNota(n.id)} style={{ background: 'none', border: 'none', color: C.subtle, fontSize: 12 }}>✕</button>
            </div>
          ))}
        </div>
      )}
    </Tarjeta>
  )
}
