// DEMO INTERNA — hub de las 10 propuestas innovadoras (2026-09-02).
// http://localhost:3001/propuestas — ver modules/propuestas/datos.ts.
import { useEffect, useMemo, useState } from 'react'
import Head from 'next/head'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { Sparkles, ArrowRight, Copy, Check, Keyboard } from 'lucide-react'
import { PROPUESTAS, GRUPOS, type Propuesta, type Grupo } from '@/modules/propuestas/datos'
import { C, CSS_DEMO, FONT, FONT_DISPLAY, FondoEstelar, Tarjeta, Chip, Etiqueta, Boton } from '@/modules/propuestas/ui'
import { leerDebate } from '@/modules/propuestas/debate'

type Resumen = Record<string, { hacer: number; talVez: number; no: number; notas: number }>

export default function PropuestasHub() {
  const router = useRouter()
  const [hover, setHover] = useState<string | null>(null)
  const [resumen, setResumen] = useState<Resumen>({})
  const [copiado, setCopiado] = useState(false)

  useEffect(() => {
    const leer = () => {
      const r: Resumen = {}
      for (const p of PROPUESTAS) {
        const d = leerDebate(p.id)
        r[p.id] = { hacer: d.votos.filter(v => v.voto === 'hacer').length, talVez: d.votos.filter(v => v.voto === 'tal-vez').length, no: d.votos.filter(v => v.voto === 'no').length, notas: d.notas.length }
      }
      setResumen(r)
    }
    leer()
    window.addEventListener('storage', leer)
    window.addEventListener('focus', leer)
    return () => { window.removeEventListener('storage', leer); window.removeEventListener('focus', leer) }
  }, [])

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) return
      const n = e.key === '0' ? 10 : parseInt(e.key, 10)
      if (n >= 1 && n <= 10) router.push(`/propuestas/${PROPUESTAS[n - 1].id}`)
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [router])

  const ranking = useMemo(() => {
    return [...PROPUESTAS].map(p => ({ p, s: (resumen[p.id]?.hacer ?? 0) * 2 + (resumen[p.id]?.talVez ?? 0) - (resumen[p.id]?.no ?? 0) })).sort((a, b) => b.s - a.s)
  }, [resumen])

  const hayVotos = Object.values(resumen).some(r => r.hacer + r.talVez + r.no + r.notas > 0)

  const copiarResumen = () => {
    const lineas = ranking.map(({ p, s }) => {
      const r = resumen[p.id]
      const d = leerDebate(p.id)
      const notas = d.notas.map(n => `    - ${n.nombre}: ${n.texto}`).join('\n')
      return `${p.numero}. ${p.nombre} (${GRUPOS[p.grupo].titulo}) — puntaje ${s} · hacer ${r?.hacer ?? 0} / tiene algo ${r?.talVez ?? 0} / no ${r?.no ?? 0}${notas ? '\n' + notas : ''}`
    })
    const txt = `Debate propuestas Órbita — ${new Date().toLocaleDateString('es-AR')}\n\n${lineas.join('\n')}`
    navigator.clipboard?.writeText(txt).then(() => { setCopiado(true); setTimeout(() => setCopiado(false), 1600) })
  }

  const activa = hover ? PROPUESTAS.find(p => p.id === hover) : null

  return (
    <>
      <Head><title>Propuestas · Órbita</title></Head>
      <style dangerouslySetInnerHTML={{ __html: CSS_DEMO + CSS_HUB }} />
      <FondoEstelar />

      <div style={{ position: 'relative', zIndex: 1, minHeight: '100vh', color: C.body, fontFamily: FONT }}>
        <div style={{ maxWidth: 1240, margin: '0 auto', padding: '40px 22px 80px' }}>

          {/* Cabecera */}
          <header className="pr-fade-up" style={{ textAlign: 'center', marginBottom: 10 }}>
            <Etiqueta color={C.primaryLight} style={{ marginBottom: 14 }}>Órbita · sesión de ideas · 2 de septiembre de 2026</Etiqueta>
            <h1 style={{ fontFamily: FONT_DISPLAY, fontSize: 58, fontWeight: 800, letterSpacing: '-0.035em', color: C.text, margin: 0, lineHeight: 1.02 }}>
              Dieciséis cosas que <span style={{ background: 'linear-gradient(90deg, #60A5FA, #A78BFA)', WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' }}>nadie hizo todavía</span>
            </h1>
            <p style={{ fontSize: 18, color: C.muted, maxWidth: 680, margin: '16px auto 0', lineHeight: 1.5 }}>
              Cinco sin Orbi, once con Orbi. Cada una tiene un prototipo que se puede tocar. La idea es debatir, votar y elegir una para hacer algo que no se vio nunca.
            </p>
          </header>

          {/* Galaxia */}
          <section className="pr-fade-up" style={{ animationDelay: '.1s', position: 'relative', height: 660, margin: '40px auto 0', maxWidth: 1000 }}>
            <Galaxia hover={hover} setHover={setHover} />
            {/* Ficha flotante */}
            <div style={{ position: 'absolute', left: '50%', bottom: 0, transform: 'translateX(-50%)', width: 520, pointerEvents: 'none', transition: 'opacity .2s', opacity: activa ? 1 : 0 }}>
              {activa && (
                <Tarjeta style={{ padding: '14px 18px', display: 'flex', gap: 14, alignItems: 'center', borderColor: `${activa.color}66`, boxShadow: `0 20px 60px rgba(0,0,0,.5), 0 0 40px ${activa.color}22` }}>
                  <span style={{ fontSize: 30, filter: `drop-shadow(0 0 14px ${activa.color})` }}>{activa.emoji}</span>
                  <div>
                    <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 800, color: C.text, fontSize: 17 }}>{activa.numero}. {activa.nombre} <Chip color={GRUPOS[activa.grupo].color} style={{ marginLeft: 6, fontSize: 10.5 }}>{GRUPOS[activa.grupo].titulo}</Chip></div>
                    <div style={{ fontSize: 13.5, color: C.muted, lineHeight: 1.4, marginTop: 3 }}>{activa.tagline}</div>
                  </div>
                </Tarjeta>
              )}
            </div>
          </section>

          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8, fontSize: 12.5, color: C.subtle, margin: '8px 0 36px' }}>
            <Keyboard size={14} /> Tocá un planeta, o apretá 1…9 y 0 para saltar (la 11 desde la lista). En cada propuesta, ← → pasan a la siguiente.
          </div>

          {/* Listas por grupo */}
          <section style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 22 }} className="pr-grid-2">
            {(['sin-orbi', 'con-orbi'] as Grupo[]).map(g => (
              <div key={g} className="pr-fade-up" style={{ animationDelay: g === 'sin-orbi' ? '.18s' : '.24s' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                  {g === 'con-orbi' && <Sparkles size={16} color={C.orbiLight} />}
                  <h2 style={{ fontFamily: FONT_DISPLAY, fontSize: 24, fontWeight: 800, color: C.text, margin: 0, letterSpacing: '-0.02em' }}>{GRUPOS[g].titulo}</h2>
                </div>
                <p style={{ fontSize: 14, color: C.muted, margin: '0 0 14px' }}>{GRUPOS[g].sub}</p>
                <div style={{ display: 'grid', gap: 10 }}>
                  {PROPUESTAS.filter(p => p.grupo === g).map(p => <TarjetaPropuesta key={p.id} p={p} r={resumen[p.id]} onHover={setHover} />)}
                </div>
              </div>
            ))}
          </section>

          {/* Bonus: nueva home */}
          <section className="pr-fade-up" style={{ animationDelay: '.28s', marginTop: 28 }}>
            <Link href="/nueva-home" style={{ textDecoration: 'none' }}>
              <Tarjeta className="pr-hover-lift" style={{ padding: '22px 26px', display: 'grid', gridTemplateColumns: '64px 1fr auto', gap: 18, alignItems: 'center', borderColor: 'rgba(96,165,250,.45)', background: 'linear-gradient(135deg, rgba(59,130,246,.16), rgba(139,92,246,.12))' }}>
                <div style={{ width: 64, height: 64, borderRadius: 20, background: 'radial-gradient(circle at 30% 30%, #93C5FD, #3B82F6 45%, #1D4ED8)', boxShadow: '0 0 30px rgba(59,130,246,.6)', display: 'grid', placeItems: 'center', fontFamily: FONT_DISPLAY, fontWeight: 800, color: '#fff', fontSize: 11, letterSpacing: '0.08em' }}>HOME</div>
                <div>
                  <Etiqueta color={C.primaryLight} style={{ marginBottom: 6 }}>Bonus · propuesta de sitio</Etiqueta>
                  <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 800, color: C.text, fontSize: 22, letterSpacing: '-0.02em' }}>La nueva home de orbita.site, con este mismo lenguaje</div>
                  <div style={{ fontSize: 14, color: C.muted, marginTop: 4, lineHeight: 1.45 }}>Rediseño completo de la página principal: toda la información del sitio actual (módulos, rubros, testimonios, roadmap, legales) contada como un sistema en órbita.</div>
                </div>
                <Boton>Ver la nueva home <ArrowRight size={16} /></Boton>
              </Tarjeta>
            </Link>
          </section>

          {/* Resumen del debate */}
          <section className="pr-fade-up" style={{ animationDelay: '.3s', marginTop: 40 }}>
            <Tarjeta style={{ padding: 24 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
                <div>
                  <Etiqueta color={C.orbiLight}>Resumen del debate</Etiqueta>
                  <div style={{ fontSize: 13, color: C.muted, marginTop: 4 }}>Votos y notas que el equipo deja en cada propuesta, ordenados. Puntaje = 2×hacer + tiene algo − no.</div>
                </div>
                <Boton variante="suave" color={C.orbi} onClick={copiarResumen}>{copiado ? <Check size={15} /> : <Copy size={15} />} {copiado ? 'Copiado' : 'Copiar resumen para el equipo'}</Boton>
              </div>
              {!hayVotos ? (
                <div style={{ fontSize: 14, color: C.subtle, padding: '10px 0' }}>Todavía nadie votó. Entrá a una propuesta y usá “Hacerla ya / Tiene algo / No va”.</div>
              ) : (
                <div style={{ display: 'grid', gap: 6 }}>
                  {ranking.map(({ p, s }, i) => {
                    const r = resumen[p.id]
                    return (
                      <Link key={p.id} href={`/propuestas/${p.id}`} style={{ textDecoration: 'none' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '28px 1fr auto', alignItems: 'center', gap: 12, padding: '9px 12px', borderRadius: 10, background: i === 0 && s > 0 ? `${p.color}14` : 'rgba(148,163,184,0.05)', border: `1px solid ${i === 0 && s > 0 ? p.color + '55' : C.border}` }}>
                          <span style={{ fontFamily: FONT_DISPLAY, fontWeight: 800, color: p.color }}>{p.numero}</span>
                          <span style={{ color: C.text, fontWeight: 600, fontSize: 14 }}>{p.nombre} <span style={{ color: C.subtle, fontWeight: 400, fontSize: 12.5, marginLeft: 6 }}>{r?.notas ?? 0} nota{r?.notas === 1 ? '' : 's'}</span></span>
                          <span style={{ display: 'flex', gap: 6 }}>
                            <Chip color={C.success}>{r?.hacer ?? 0}</Chip><Chip color={C.warning}>{r?.talVez ?? 0}</Chip><Chip color={C.error}>{r?.no ?? 0}</Chip>
                            <Chip color={C.body} style={{ marginLeft: 6 }}>puntaje {s}</Chip>
                          </span>
                        </div>
                      </Link>
                    )
                  })}
                </div>
              )}
            </Tarjeta>
          </section>
        </div>
      </div>
    </>
  )
}

// ─── Galaxia (planetas en dos órbitas) ───────────────────────────────────────

function Galaxia({ hover, setHover }: { hover: string | null; setHover: (id: string | null) => void }) {
  const sin = PROPUESTAS.filter(p => p.grupo === 'sin-orbi')
  const con = PROPUESTAS.filter(p => p.grupo === 'con-orbi')
  return (
    <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', perspective: 1400 }}>
      <div className="pr-galaxia" style={{ position: 'relative', width: 620, height: 620, transformStyle: 'preserve-3d' }}>
        {/* Anillos */}
        <Anillo r={200} color={C.primary} dur={70} />
        <Anillo r={300} color={C.orbi} dur={110} reverse />
        {/* Sol: Órbita */}
        <div style={{ position: 'absolute', left: '50%', top: '50%', width: 0, height: 0 }}>
          <div style={{ position: 'absolute', left: -46, top: -46, width: 92, height: 92, borderRadius: '50%', background: 'radial-gradient(circle at 35% 35%, #93C5FD, #3B82F6 45%, #1D4ED8 100%)', boxShadow: '0 0 60px rgba(59,130,246,.65), 0 0 120px rgba(59,130,246,.35)', display: 'grid', placeItems: 'center', animation: 'pr-pulse 5s ease-in-out infinite' }}>
            <span style={{ fontFamily: FONT_DISPLAY, fontWeight: 800, color: '#fff', fontSize: 13, letterSpacing: '0.1em' }}>ÓRBITA</span>
          </div>
        </div>
        {/* Planetas */}
        {sin.map((p, i) => <Planeta key={p.id} p={p} r={200} ang={i * (360 / sin.length) - 90} dur={70} hover={hover} setHover={setHover} />)}
        {con.map((p, i) => <Planeta key={p.id} p={p} r={300} ang={i * (360 / con.length) - 60} dur={110} reverse hover={hover} setHover={setHover} />)}
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

function Planeta({ p, r, ang, dur, reverse, hover, setHover }: { p: Propuesta; r: number; ang: number; dur: number; reverse?: boolean; hover: string | null; setHover: (id: string | null) => void }) {
  const activo = hover === p.id
  const apagado = hover !== null && !activo
  return (
    <div style={{ position: 'absolute', left: '50%', top: '50%', width: 0, height: 0, transform: `rotate(${ang}deg)`, animation: `${reverse ? 'pr-spin-rev' : 'pr-spin'} ${dur}s linear infinite`, animationDelay: `-${(ang + 90) / 360 * dur}s`, animationPlayState: hover ? 'paused' : 'running' }}>
      <div style={{ position: 'absolute', left: r, top: 0, transform: `rotate(${-ang}deg)`, animation: `${reverse ? 'pr-spin' : 'pr-spin-rev'} ${dur}s linear infinite`, animationDelay: `-${(ang + 90) / 360 * dur}s`, animationPlayState: hover ? 'paused' : 'running' }}>
        <Link href={`/propuestas/${p.id}`} onMouseEnter={() => setHover(p.id)} onMouseLeave={() => setHover(null)} onFocus={() => setHover(p.id)} onBlur={() => setHover(null)} style={{ textDecoration: 'none' }}>
          <div style={{
            position: 'absolute', left: 0, top: 0, transform: `translate(-50%,-50%) scale(${activo ? 1.25 : 1})`, width: 68, height: 68, borderRadius: '50%',
            background: `radial-gradient(circle at 32% 30%, #fff8, ${p.color} 40%, ${p.color}66 100%)`,
            boxShadow: activo ? `0 0 40px ${p.color}, 0 0 80px ${p.color}66` : `0 0 22px ${p.color}77`,
            display: 'grid', placeItems: 'center', fontSize: 28, transition: 'transform .2s, box-shadow .2s, opacity .2s', opacity: apagado ? .45 : 1, cursor: 'pointer',
          }}>
            <span style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,.4))' }}>{p.emoji}</span>
            <span style={{ position: 'absolute', top: -8, right: -6, width: 22, height: 22, borderRadius: 99, background: '#0B1120', border: `1.5px solid ${p.color}`, color: '#fff', fontSize: 11, fontWeight: 800, display: 'grid', placeItems: 'center', fontFamily: FONT_DISPLAY }}>{p.numero}</span>
          </div>
        </Link>
        <div style={{ position: 'absolute', left: 0, top: 46, transform: 'translateX(-50%)', whiteSpace: 'nowrap', fontSize: 12, fontWeight: 700, color: activo ? C.text : C.muted, letterSpacing: '0.02em', transition: 'color .2s', pointerEvents: 'none' }}>{p.nombre}</div>
      </div>
    </div>
  )
}

// ─── Tarjeta de lista ────────────────────────────────────────────────────────

function TarjetaPropuesta({ p, r, onHover }: { p: Propuesta; r?: Resumen[string]; onHover: (id: string | null) => void }) {
  const total = (r?.hacer ?? 0) + (r?.talVez ?? 0) + (r?.no ?? 0)
  return (
    <Link href={`/propuestas/${p.id}`} style={{ textDecoration: 'none' }} onMouseEnter={() => onHover(p.id)} onMouseLeave={() => onHover(null)}>
      <Tarjeta className="pr-hover-lift" style={{ padding: '14px 16px', display: 'grid', gridTemplateColumns: '52px 1fr auto', gap: 14, alignItems: 'center' }}>
        <div style={{ width: 52, height: 52, borderRadius: 16, background: `radial-gradient(circle at 30% 30%, #fff5, ${p.color} 45%, ${p.color}55)`, boxShadow: `0 0 18px ${p.color}55`, display: 'grid', placeItems: 'center', fontSize: 24 }}>{p.emoji}</div>
        <div style={{ minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontFamily: FONT_DISPLAY, fontWeight: 800, color: p.color, fontSize: 13 }}>{p.numero}</span>
            <span style={{ fontFamily: FONT_DISPLAY, fontWeight: 800, color: C.text, fontSize: 16 }}>{p.nombre}</span>
            {total > 0 && <Chip color={C.muted} style={{ fontSize: 10.5 }}>{total} voto{total === 1 ? '' : 's'}</Chip>}
          </div>
          <div style={{ fontSize: 13, color: C.muted, marginTop: 3, lineHeight: 1.4 }}>{p.tagline}</div>
        </div>
        <ArrowRight size={18} color={C.subtle} />
      </Tarjeta>
    </Link>
  )
}

const CSS_HUB = `
  @media (max-width: 900px) {
    .pr-grid-2 { grid-template-columns: minmax(0,1fr) !important; }
    .pr-galaxia { transform: scale(.6); }
  }
`

