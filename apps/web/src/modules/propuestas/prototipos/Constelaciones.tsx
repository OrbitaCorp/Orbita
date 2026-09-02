// src/modules/propuestas/prototipos/Constelaciones.tsx — Prototipo
// interactivo de "Constelaciones": el mapa del barrio (lado dueño) y el
// ticket del cliente (lado cliente) reaccionando entre sí. Autocontenido,
// sin fetch ni storage: todo es estado local + CSS.

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { ArrowRight, Check, Footprints, Gift, MapPin, PiggyBank, Radar, RotateCcw, Sparkles, Users, Zap } from 'lucide-react'
import { C, FONT, FONT_DISPLAY, FONT_MONO, Tarjeta, Chip, Boton, Titulo, Etiqueta, Pantalla, formatoARS } from '../ui'

// ─── Datos del barrio ────────────────────────────────────────────────────────

type IdNegocio = 'barberia' | 'cafe' | 'libreria' | 'floreria' | 'dietetica' | 'vinoteca' | 'pizzeria' | 'pancho' | 'vete'
type IdTicket = 'barberia' | 'cafe' | 'libreria' | 'floreria'
type Rol = 'yo' | 'vecino' | 'otro' | 'competidor'

interface Negocio {
  id: IdNegocio
  nombre: string
  rubro: string
  emoji: string
  x: number
  y: number
  rol: Rol
  color: string
  /** Distancia a Barbería Sur, solo para los vecinos de la constelación. */
  dist?: number
  /** Beneficio que ese vecino le da a los clientes de Barbería Sur. */
  da?: string
}

const NEGOCIOS: Record<IdNegocio, Negocio> = {
  barberia:  { id: 'barberia',  nombre: 'Barbería Sur',       rubro: 'Barbería',   emoji: '💈', x: 360, y: 292, rol: 'yo',         color: '#3B82F6' },
  cafe:      { id: 'cafe',      nombre: 'Café Nómade',        rubro: 'Cafetería',  emoji: '☕', x: 528, y: 196, rol: 'vecino',     color: '#F59E0B', dist: 120, da: '2x1 en medialunas' },
  libreria:  { id: 'libreria',  nombre: 'Librería Ulises',    rubro: 'Librería',   emoji: '📚', x: 236, y: 156, rol: 'vecino',     color: '#A78BFA', dist: 180, da: '10% en libros' },
  floreria:  { id: 'floreria',  nombre: 'Florería Lía',       rubro: 'Florería',   emoji: '🌷', x: 484, y: 432, rol: 'vecino',     color: '#F472B6', dist: 90,  da: '20% en ramos' },
  dietetica: { id: 'dietetica', nombre: 'Dietética Semilla',  rubro: 'Dietética',  emoji: '🌾', x: 128, y: 392, rol: 'otro',       color: '#84CC16' },
  vinoteca:  { id: 'vinoteca',  nombre: 'Vinoteca Ochava',    rubro: 'Vinoteca',   emoji: '🍷', x: 640, y: 330, rol: 'otro',       color: '#E11D48' },
  pizzeria:  { id: 'pizzeria',  nombre: 'Pizzería La Guarida', rubro: 'Pizzería',  emoji: '🍕', x: 318, y: 506, rol: 'otro',       color: '#FB923C' },
  pancho:    { id: 'pancho',    nombre: 'Cortes Pancho',      rubro: 'Barbería',   emoji: '✂️', x: 112, y: 238, rol: 'competidor', color: '#64748B' },
  vete:      { id: 'vete',      nombre: 'Veterinaria Patitas', rubro: 'Veterinaria', emoji: '🐾', x: 612, y: 500, rol: 'otro',      color: '#2DD4BF' },
}

const VECINOS: IdTicket[] = ['cafe', 'libreria', 'floreria']
const YO = NEGOCIOS.barberia

/** El recorrido del cliente: barbería → café → librería → florería. */
const CADENA: Record<IdTicket, IdTicket | null> = { barberia: 'cafe', cafe: 'libreria', libreria: 'floreria', floreria: null }

interface LineaTicket { nombre: string; precio: number; precioFinal?: number }
interface Ticket {
  negocio: IdTicket
  numero: string
  hora: string
  lineas: LineaTicket[]
  beneficio?: string
  ahorro: number
}

const TICKETS: Record<IdTicket, Ticket> = {
  barberia: { negocio: 'barberia', numero: '#0421', hora: '16:40', ahorro: 0, lineas: [{ nombre: 'Corte + barba', precio: 9000 }] },
  cafe:     { negocio: 'cafe',     numero: '#2213', hora: '17:05', ahorro: 1200, beneficio: '2x1 en medialunas', lineas: [{ nombre: 'Café con leche', precio: 3200 }, { nombre: 'Medialunas x2', precio: 2400, precioFinal: 1200 }] },
  libreria: { negocio: 'libreria', numero: '#0877', hora: '17:38', ahorro: 2800, beneficio: '10% en libros', lineas: [{ nombre: 'Los detectives salvajes', precio: 28000, precioFinal: 25200 }] },
  floreria: { negocio: 'floreria', numero: '#1190', hora: '18:02', ahorro: 3000, beneficio: '20% en ramos', lineas: [{ nombre: 'Ramo de temporada', precio: 15000, precioFinal: 12000 }] },
}

const ACENTO = '#38BDF8'
const ORO = '#FBBF24'

// Estrellitas decorativas del mapa (posiciones fijas, sin random en render).
const ESTRELLAS = [[40, 60], [690, 40], [700, 560], [60, 540], [420, 40], [150, 120], [600, 120], [250, 560], [560, 250], [90, 460], [660, 420], [300, 380]] as const

// Confeti de estrellas al unirse (ángulo, distancia, retraso).
const CONFETI = Array.from({ length: 14 }, (_, i) => ({ ang: (i / 14) * 360, dist: 70 + (i % 3) * 30, delay: (i % 5) * 60, tam: 8 + (i % 3) * 4 }))

const CSS = `
  @keyframes cs-viajar { from { transform: translate(var(--x1), var(--y1)); } to { transform: translate(var(--x2), var(--y2)); } }
  @keyframes cs-burst { 0% { transform: translate(-50%, -50%) rotate(0deg) translateX(0) scale(.4); opacity: 0; } 20% { opacity: 1; } 100% { transform: translate(-50%, -50%) rotate(var(--ang)) translateX(var(--dist)) scale(1); opacity: 0; } }
  @keyframes cs-validez { from { width: 100%; } to { width: 0%; } }
  @keyframes cs-pop { 0% { transform: scale(.85); opacity: .4; } 60% { transform: scale(1.06); } 100% { transform: scale(1); opacity: 1; } }
  @keyframes cs-caminar { 0% { transform: translateX(-4px); } 50% { transform: translateX(4px); } 100% { transform: translateX(-4px); } }
  @keyframes cs-halo { 0%, 100% { opacity: .18; } 50% { opacity: .38; } }
  .cs-grid { display: grid; grid-template-columns: minmax(0, 3fr) minmax(0, 2fr); gap: 22px; align-items: start; }
  @media (max-width: 960px) { .cs-grid { grid-template-columns: minmax(0, 1fr); } }
  .cs-pop { animation: cs-pop .4s cubic-bezier(.2,.8,.2,1) both; }
  .cs-range { -webkit-appearance: none; appearance: none; width: 100%; height: 6px; border-radius: 99px; background: linear-gradient(90deg, ${ACENTO} var(--p), rgba(148,163,184,.25) var(--p)); outline: none; cursor: pointer; }
  .cs-range::-webkit-slider-thumb { -webkit-appearance: none; width: 20px; height: 20px; border-radius: 50%; background: #fff; border: 3px solid ${ACENTO}; box-shadow: 0 0 0 4px rgba(56,189,248,.25); cursor: pointer; }
  .cs-range::-moz-range-thumb { width: 20px; height: 20px; border-radius: 50%; background: #fff; border: 3px solid ${ACENTO}; box-shadow: 0 0 0 4px rgba(56,189,248,.25); cursor: pointer; }
  .cs-nodo { transition: opacity .6s ease, filter .6s ease; }
`

// ─── Hooks chicos ────────────────────────────────────────────────────────────

/** Muestra un número subiendo de a pasos hasta el valor objetivo. */
function useContador(objetivo: number, ms = 700) {
  const [valor, setValor] = useState(objetivo)
  const actual = useRef(objetivo)
  useEffect(() => {
    const desde = actual.current
    if (desde === objetivo) return
    const inicio = Date.now()
    const id = setInterval(() => {
      const t = Math.min(1, (Date.now() - inicio) / ms)
      const e = 1 - Math.pow(1 - t, 3)
      const v = Math.round(desde + (objetivo - desde) * e)
      actual.current = v
      setValor(v)
      if (t >= 1) clearInterval(id)
    }, 30)
    return () => clearInterval(id)
  }, [objetivo, ms])
  return valor
}

// ─── Componente principal ────────────────────────────────────────────────────

type Fase = 'inicio' | 'escaneando' | 'propuesta' | 'activa'

export default function Constelaciones() {
  const [fase, setFase] = useState<Fase>('inicio')
  const [escaneo, setEscaneo] = useState(0) // 0 nada · 1 competidores marcados · 2 líneas dibujadas
  const [porcentaje, setPorcentaje] = useState(15)
  const [modoRegalo, setModoRegalo] = useState(false)
  const [confeti, setConfeti] = useState(false)
  const [semana, setSemana] = useState(0)

  const [ticket, setTicket] = useState<IdTicket>('barberia')
  const [viaje, setViaje] = useState<{ desde: IdTicket; hasta: IdTicket } | null>(null)
  const [recorrido, setRecorrido] = useState<IdTicket[]>(['barberia'])
  const [eventos, setEventos] = useState<string[]>([])

  // Escaneo del barrio: radar → competidores → líneas → propuesta.
  useEffect(() => {
    if (fase !== 'escaneando') return
    const t1 = setTimeout(() => setEscaneo(1), 1000)
    const t2 = setTimeout(() => setEscaneo(2), 1700)
    const t3 = setTimeout(() => setFase('propuesta'), 3300)
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3) }
  }, [fase])

  // Al unirse: confeti breve + contador de la semana 1.
  useEffect(() => {
    if (fase !== 'activa') return
    const apagar = setTimeout(() => setConfeti(false), 1800)
    let n = 0
    const id = setInterval(() => {
      n += 1
      setSemana(n)
      if (n >= 12) clearInterval(id)
    }, 110)
    return () => { clearTimeout(apagar); clearInterval(id) }
  }, [fase])

  // El cliente camina: cuando llega, cambia el ticket y suben las métricas del dueño.
  useEffect(() => {
    if (!viaje) return
    const { hasta } = viaje
    const t = setTimeout(() => {
      setTicket(hasta)
      setRecorrido(r => [...r, hasta])
      setEventos(e => [`Un cliente tuyo canjeó "${TICKETS[hasta].beneficio}" en ${NEGOCIOS[hasta].nombre}`, ...e].slice(0, 3))
      setViaje(null)
    }, 1900)
    return () => clearTimeout(t)
  }, [viaje])

  const activa = fase === 'activa'
  const enlazados = escaneo >= 2
  const ahorroCliente = recorrido.reduce((s, id) => s + TICKETS[id].ahorro, 0)
  const saltos = recorrido.length - 1
  const estimacion = modoRegalo ? 31 : Math.round(20 + porcentaje * 1.2)
  const loQueDoy = modoRegalo ? 'Perfilado de barba de regalo' : `${porcentaje}% en tu próximo corte`

  const metricas = {
    clientes: (activa ? semana : 0) + saltos,
    beneficios: (activa ? Math.round(semana * 0.75) : 0) + saltos,
    ahorro: (activa ? semana * 2380 : 0) + ahorroCliente,
  }

  function reiniciar() {
    setFase('inicio'); setEscaneo(0); setPorcentaje(15); setModoRegalo(false); setConfeti(false); setSemana(0)
    setTicket('barberia'); setViaje(null); setRecorrido(['barberia']); setEventos([])
  }

  function unirse() {
    setConfeti(true)
    setFase('activa')
  }

  function simularSalto() {
    const hasta = CADENA[ticket]
    if (!hasta || viaje) return
    setViaje({ desde: ticket, hasta })
  }

  const pasoActual = fase === 'inicio' || fase === 'escaneando' ? 0 : fase === 'propuesta' ? 1 : saltos === 0 ? 2 : 3

  return (
    <div style={{ padding: 26, minHeight: 600, color: C.body, fontFamily: FONT, position: 'relative' }}>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />

      {/* Cabecera */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginBottom: 18 }}>
        <div>
          <Etiqueta color={ACENTO}>Prototipo · Constelaciones</Etiqueta>
          <Titulo tam={22} style={{ marginTop: 4 }}>Barbería Sur, Palermo</Titulo>
        </div>
        <Pasos actual={pasoActual} />
        <Boton variante="fantasma" tam="sm" onClick={reiniciar}><RotateCcw size={13} /> Reiniciar</Boton>
      </div>

      <div className="cs-grid">
        {/* ── IZQUIERDA: lado dueño ─────────────────────────────────── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}>
          <Tarjeta style={{ padding: 0, overflow: 'hidden', position: 'relative' }}>
            <div style={{ position: 'absolute', top: 14, left: 16, zIndex: 2, display: 'flex', gap: 8, alignItems: 'center' }}>
              <Chip color={ACENTO}><MapPin size={12} /> Mapa del barrio</Chip>
              {fase === 'escaneando' && <Chip color={C.warning}><Radar size={12} /> Buscando vecinos…</Chip>}
              {enlazados && fase !== 'escaneando' && <Chip color={C.success}><Check size={12} /> 3 vecinos complementarios</Chip>}
            </div>
            <MapaBarrio fase={fase} escaneo={escaneo} recorrido={recorrido} viaje={viaje} />
            {fase === 'inicio' && (
              <div className="pr-fade-in" style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', paddingBottom: 26, background: 'linear-gradient(to top, rgba(7,11,22,.85), transparent 45%)', pointerEvents: 'none' }}>
                <div style={{ pointerEvents: 'auto', textAlign: 'center' }}>
                  <div style={{ fontSize: 13, color: C.muted, marginBottom: 10 }}>Órbita ya sabe dónde está cada negocio. Solo falta mirar alrededor.</div>
                  <Boton tam="lg" color={ACENTO} onClick={() => setFase('escaneando')} style={{ boxShadow: `0 10px 40px ${ACENTO}66` }}>
                    <Radar size={18} /> Descubrir mi constelación
                  </Boton>
                </div>
              </div>
            )}
          </Tarjeta>

          {(fase === 'propuesta' || activa) && (
            <Tarjeta className="pr-fade-up" style={{ padding: 20, position: 'relative', overflow: 'hidden' }}>
              {confeti && (
                <div aria-hidden style={{ position: 'absolute', left: '50%', top: '55%', pointerEvents: 'none' }}>
                  {CONFETI.map((c, i) => (
                    <span key={i} style={{ position: 'absolute', left: 0, top: 0, fontSize: c.tam, color: i % 2 ? ORO : ACENTO, animation: `cs-burst 1.4s cubic-bezier(.2,.8,.2,1) ${c.delay}ms both`, ['--ang' as string]: `${c.ang}deg`, ['--dist' as string]: `${c.dist}px` } as CSSProperties}>✦</span>
                  ))}
                </div>
              )}

              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                <div>
                  <Etiqueta color={activa ? C.success : ACENTO}>{activa ? 'Constelación activa' : 'Tu constelación propuesta'}</Etiqueta>
                  <Titulo tam={18} style={{ marginTop: 4 }}>Barbería Sur + Café Nómade + Librería Ulises + Florería Lía</Titulo>
                </div>
                {activa ? (
                  <div className="cs-pop" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 14px', borderRadius: 12, background: `${C.success}18`, border: `1px solid ${C.success}44` }}>
                    <Sparkles size={16} color={C.success} />
                    <div>
                      <div style={{ fontSize: 11, color: C.muted, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase' }}>Semana 1</div>
                      <div style={{ fontFamily: FONT_DISPLAY, fontSize: 18, fontWeight: 800, color: C.text, lineHeight: 1.1 }}>{semana} clientes cruzaron</div>
                    </div>
                  </div>
                ) : (
                  <div key={estimacion} className="cs-pop" style={{ padding: '8px 14px', borderRadius: 12, background: `${ACENTO}14`, border: `1px solid ${ACENTO}44`, textAlign: 'right' }}>
                    <div style={{ fontSize: 11, color: C.muted, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase' }}>Estimación</div>
                    <div style={{ fontFamily: FONT_DISPLAY, fontSize: 18, fontWeight: 800, color: C.text, lineHeight: 1.1 }}>≈ {estimacion} clientes nuevos/mes</div>
                  </div>
                )}
              </div>

              {/* Lo que das */}
              <div style={{ marginTop: 16, padding: 14, borderRadius: 14, background: 'rgba(2,6,23,.45)', border: `1px solid ${C.border}` }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: C.text }}>Lo que DA Barbería Sur a los clientes de sus vecinos</div>
                  <div style={{ display: 'flex', gap: 6, background: 'rgba(148,163,184,.1)', padding: 3, borderRadius: 10 }}>
                    {(['pct', 'regalo'] as const).map(m => {
                      const on = modoRegalo === (m === 'regalo')
                      return (
                        <button key={m} type="button" className="pr-btn" disabled={activa} onClick={() => setModoRegalo(m === 'regalo')} style={{ padding: '6px 12px', borderRadius: 8, border: 'none', fontFamily: FONT, fontSize: 12, fontWeight: 700, cursor: 'pointer', background: on ? ACENTO : 'transparent', color: on ? '#04101C' : C.muted }}>
                          {m === 'pct' ? 'Un % de descuento' : 'Un regalo'}
                        </button>
                      )
                    })}
                  </div>
                </div>
                {modoRegalo ? (
                  <div className="pr-fade-in" style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 10, fontSize: 14, color: C.body }}>
                    <span style={{ width: 34, height: 34, borderRadius: 10, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: `${ACENTO}22`, fontSize: 18 }}>🎁</span>
                    <div><b style={{ color: C.text }}>Perfilado de barba de regalo</b> con cualquier corte. Cuesta poco, se recuerda mucho.</div>
                  </div>
                ) : (
                  <div className="pr-fade-in" style={{ marginTop: 12, display: 'grid', gridTemplateColumns: '1fr auto', gap: 14, alignItems: 'center' }}>
                    <input type="range" min={5} max={25} step={1} value={porcentaje} disabled={activa} onChange={e => setPorcentaje(Number(e.target.value))} className="cs-range" style={{ ['--p' as string]: `${((porcentaje - 5) / 20) * 100}%` } as CSSProperties} aria-label="Porcentaje de descuento" />
                    <div key={porcentaje} className="cs-pop" style={{ fontFamily: FONT_DISPLAY, fontSize: 24, fontWeight: 800, color: C.text, minWidth: 64, textAlign: 'right' }}>{porcentaje}%</div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: C.subtle, gridColumn: '1 / -1', marginTop: -6 }}>
                      <span>5% · tímido</span><span>15% · recomendado</span><span>25% · generoso</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Los 3 vecinos */}
              <div style={{ marginTop: 14, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 }}>
                {VECINOS.map((id, i) => {
                  const n = NEGOCIOS[id]
                  return (
                    <div key={id} className="pr-fade-up pr-hover-lift" style={{ animationDelay: `${i * 90}ms`, padding: 14, borderRadius: 14, border: `1px solid ${n.color}44`, background: `linear-gradient(160deg, ${n.color}14, rgba(2,6,23,.4))` }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span style={{ width: 36, height: 36, borderRadius: '50%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: `${n.color}33`, fontSize: 18, boxShadow: `0 0 18px ${n.color}55` }}>{n.emoji}</span>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontWeight: 800, color: C.text, fontSize: 14, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{n.nombre}</div>
                          <div style={{ fontSize: 11.5, color: C.muted }}>{n.rubro} · a {n.dist} m</div>
                        </div>
                      </div>
                      <div style={{ marginTop: 12, display: 'grid', gap: 6, fontSize: 12.5 }}>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                          <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: '.08em', color: n.color, marginTop: 2, width: 52, flexShrink: 0 }}>TE DA</span>
                          <span style={{ color: C.text, fontWeight: 600 }}>{n.da}</span>
                        </div>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                          <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: '.08em', color: ACENTO, marginTop: 2, width: 52, flexShrink: 0 }}>VOS DAS</span>
                          <span key={loQueDoy} className="pr-fade-in" style={{ color: C.body }}>{loQueDoy}</span>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>

              {activa ? (
                <div style={{ marginTop: 14, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  <Chip color={C.success}><Check size={12} /> Los beneficios ya aparecen en cada ticket de Barbería Sur</Chip>
                  <span style={{ fontSize: 12.5, color: C.muted }}>Mirá el celular de la derecha: el cliente acaba de pagar.</span>
                </div>
              ) : (
                <div style={{ marginTop: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                  <div style={{ fontSize: 12.5, color: C.muted }}>Sin negociar nada: cada vecino ya definió lo suyo. Vos elegís lo tuyo y listo.</div>
                  <Boton color={ACENTO} onClick={unirse}><Sparkles size={16} /> Unirme a la constelación</Boton>
                </div>
              )}

              {eventos.length > 0 && (
                <div style={{ marginTop: 14, borderTop: `1px solid ${C.border}`, paddingTop: 12, display: 'grid', gap: 6 }}>
                  {eventos.map((e, i) => (
                    <div key={e + i} className="pr-fade-up" style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, color: i === 0 ? C.text : C.muted }}>
                      <span style={{ width: 7, height: 7, borderRadius: 99, background: i === 0 ? ORO : C.subtle, boxShadow: i === 0 ? `0 0 10px ${ORO}` : 'none', flexShrink: 0 }} />
                      {e}
                    </div>
                  ))}
                </div>
              )}
            </Tarjeta>
          )}
        </div>

        {/* ── DERECHA: lado cliente ─────────────────────────────────── */}
        <div style={{ minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 12 }}>
            <Chip color={C.orbiLight}>📱 Lo que ve el cliente</Chip>
            {ahorroCliente > 0 && <Chip color={ORO} style={{ animation: 'cs-pop .4s both' }} key={ahorroCliente}><PiggyBank size={12} /> Ahorró {formatoARS(ahorroCliente)} en el barrio</Chip>}
          </div>
          <Pantalla tipo="celular">
            <div className="pr-scroll" style={{ height: 620, overflowY: 'auto', overflowX: 'hidden', position: 'relative' }}>
              {viaje ? (
                <Caminando desde={viaje.desde} hasta={viaje.hasta} />
              ) : (
                <TicketCliente key={ticket} ticket={TICKETS[ticket]} activa={activa} recorrido={recorrido} ahorro={ahorroCliente} onSaltar={simularSalto} />
              )}
            </div>
          </Pantalla>
          <div style={{ textAlign: 'center', fontSize: 12, color: C.subtle, marginTop: 12 }}>
            {!activa ? 'Antes de unirte, el ticket termina en "gracias".' : saltos === 0 ? 'Ahora el ticket sigue: tu barrio también.' : `${saltos} de 3 beneficios usados en esta ronda.`}
          </div>
        </div>
      </div>

      {/* ── Pie: métricas del dueño ───────────────────────────────────── */}
      <div style={{ marginTop: 22, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
        <Metrica icono={<Users size={18} />} color={ACENTO} valor={metricas.clientes} etiqueta="Clientes que vinieron por la constelación" />
        <Metrica icono={<Gift size={18} />} color={C.orbiLight} valor={metricas.beneficios} etiqueta="Beneficios entregados" />
        <Metrica icono={<PiggyBank size={18} />} color={ORO} valor={metricas.ahorro} etiqueta="Ahorro total de tus clientes" dinero />
      </div>
    </div>
  )
}

// ─── Stepper ─────────────────────────────────────────────────────────────────

function Pasos({ actual }: { actual: number }) {
  const pasos = ['Descubrir', 'Elegir beneficio', 'Unirse', 'El cliente lo vive']
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
      {pasos.map((p, i) => {
        const hecho = i < actual, on = i === actual
        return (
          <div key={p} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 10px', borderRadius: 999, fontSize: 12, fontWeight: 700, transition: 'all .3s', background: on ? `${ACENTO}22` : 'transparent', color: hecho ? C.success : on ? ACENTO : C.subtle, border: `1px solid ${on ? ACENTO + '55' : 'transparent'}` }}>
              <span style={{ width: 16, height: 16, borderRadius: 99, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, background: hecho ? C.success : on ? ACENTO : 'rgba(148,163,184,.2)', color: hecho || on ? '#04101C' : C.muted }}>{hecho ? <Check size={10} strokeWidth={3} /> : i + 1}</span>
              {p}
            </div>
            {i < pasos.length - 1 && <span style={{ width: 10, height: 1, background: C.borderStrong }} />}
          </div>
        )
      })}
    </div>
  )
}

// ─── Mapa SVG ────────────────────────────────────────────────────────────────

function MapaBarrio({ fase, escaneo, recorrido, viaje }: { fase: Fase; escaneo: number; recorrido: IdTicket[]; viaje: { desde: IdTicket; hasta: IdTicket } | null }) {
  const escaneando = fase === 'escaneando'
  const marcados = escaneo >= 1
  const enlazados = escaneo >= 2
  const nodos = Object.values(NEGOCIOS)

  const tramos: [IdTicket, IdTicket][] = []
  for (let i = 1; i < recorrido.length; i++) tramos.push([recorrido[i - 1], recorrido[i]])

  const calles = { h: [{ y: 118, nombre: 'Av. Scalabrini Ortiz' }, { y: 470, nombre: 'Gurruchaga' }], v: [{ x: 196, nombre: 'Honduras' }, { x: 572, nombre: 'Nicaragua' }] }

  return (
    <svg viewBox="0 0 720 580" width="100%" style={{ display: 'block', minHeight: 560, background: 'radial-gradient(ellipse at 50% 45%, #0E1A33 0%, #070B16 70%)' }} role="img" aria-label="Mapa del barrio con los negocios como planetas">
      <defs>
        <pattern id="cs-grilla" width="40" height="40" patternUnits="userSpaceOnUse">
          <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(148,163,184,.09)" strokeWidth="1" />
        </pattern>
        <filter id="cs-glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="3.5" result="b" />
          <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
        <filter id="cs-blur"><feGaussianBlur stdDeviation="22" /></filter>
        <radialGradient id="cs-radar" r="50%">
          <stop offset="60%" stopColor={ACENTO} stopOpacity="0" />
          <stop offset="100%" stopColor={ACENTO} stopOpacity=".55" />
        </radialGradient>
      </defs>

      <rect width="720" height="580" fill="url(#cs-grilla)" />
      {calles.h.map(c => (
        <g key={c.nombre}>
          <line x1="0" y1={c.y} x2="720" y2={c.y} stroke="rgba(148,163,184,.16)" strokeWidth="5" />
          <text x="10" y={c.y - 8} fill="rgba(148,163,184,.45)" fontSize="10" fontFamily={FONT} letterSpacing=".08em">{c.nombre.toUpperCase()}</text>
        </g>
      ))}
      {calles.v.map(c => (
        <g key={c.nombre}>
          <line x1={c.x} y1="0" x2={c.x} y2="580" stroke="rgba(148,163,184,.16)" strokeWidth="5" />
          <text transform={`translate(${c.x - 8} 570) rotate(-90)`} fill="rgba(148,163,184,.45)" fontSize="10" fontFamily={FONT} letterSpacing=".08em">{c.nombre.toUpperCase()}</text>
        </g>
      ))}
      {ESTRELLAS.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r={i % 4 === 0 ? 1.8 : 1.1} fill="#fff" style={{ animation: `pr-twinkle ${3 + (i % 3)}s ease-in-out ${i * 0.4}s infinite` }} />
      ))}

      {/* Halo de la constelación */}
      {enlazados && (
        <polygon className="pr-fade-in" points={VECINOS.map(id => `${NEGOCIOS[id].x},${NEGOCIOS[id].y}`).join(' ')} fill={ACENTO} opacity=".18" filter="url(#cs-blur)" style={{ animation: 'cs-halo 4s ease-in-out infinite' }} />
      )}

      {/* Radar */}
      {escaneando && [0, 1, 2].map(i => (
        <circle key={i} cx={YO.x} cy={YO.y} r={120} fill="url(#cs-radar)" stroke={ACENTO} strokeWidth="1.5" strokeOpacity=".8" style={{ transformBox: 'fill-box', transformOrigin: 'center', animation: `pr-ping 2.2s cubic-bezier(0,0,.2,1) ${i * 0.7}s infinite` }} />
      ))}

      {/* Líneas de órbita hacia los vecinos + triángulo entre ellos */}
      {enlazados && VECINOS.map((id, i) => {
        const n = NEGOCIOS[id]
        const len = Math.hypot(n.x - YO.x, n.y - YO.y)
        return (
          <line key={id} x1={YO.x} y1={YO.y} x2={n.x} y2={n.y} stroke={ACENTO} strokeWidth="2" strokeLinecap="round" strokeDasharray={len} strokeDashoffset={len} filter="url(#cs-glow)" style={{ animation: `pr-dash 1.1s cubic-bezier(.2,.8,.2,1) ${i * 0.25}s forwards` }} />
        )
      })}
      {enlazados && VECINOS.map((id, i) => {
        const a = NEGOCIOS[id], b = NEGOCIOS[VECINOS[(i + 1) % VECINOS.length]]
        const len = Math.hypot(a.x - b.x, a.y - b.y)
        return (
          <line key={id + 'tri'} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={ACENTO} strokeWidth="1" strokeOpacity=".45" strokeDasharray={`${len}`} strokeDashoffset={len} style={{ animation: `pr-dash 1.4s ease ${0.9 + i * 0.2}s forwards` }} />
        )
      })}

      {/* Recorrido del cliente (dorado) */}
      {tramos.map(([a, b]) => {
        const A = NEGOCIOS[a], B = NEGOCIOS[b]
        return <line key={a + b} className="pr-fade-in" x1={A.x} y1={A.y} x2={B.x} y2={B.y} stroke={ORO} strokeWidth="3" strokeLinecap="round" filter="url(#cs-glow)" opacity=".9" />
      })}
      {viaje && (() => {
        const A = NEGOCIOS[viaje.desde], B = NEGOCIOS[viaje.hasta]
        const len = Math.hypot(A.x - B.x, A.y - B.y)
        return (
          <g key={viaje.desde + viaje.hasta}>
            <line x1={A.x} y1={A.y} x2={B.x} y2={B.y} stroke={ORO} strokeWidth="3" strokeLinecap="round" strokeDasharray={len} strokeDashoffset={len} filter="url(#cs-glow)" style={{ animation: 'pr-dash 1.9s cubic-bezier(.4,0,.2,1) forwards' }} />
            <g style={{ animation: 'cs-viajar 1.9s cubic-bezier(.4,0,.2,1) forwards', ['--x1' as string]: `${A.x}px`, ['--y1' as string]: `${A.y}px`, ['--x2' as string]: `${B.x}px`, ['--y2' as string]: `${B.y}px` } as CSSProperties}>
              <circle r="14" fill={ORO} opacity=".25" style={{ animation: 'pr-pulse 1s ease-in-out infinite' }} />
              <circle r="5" fill="#fff" filter="url(#cs-glow)" />
              <text y="-16" textAnchor="middle" fontSize="13">✦</text>
            </g>
          </g>
        )
      })()}

      {/* Planetas */}
      {nodos.map(n => {
        const yo = n.rol === 'yo'
        const vecino = n.rol === 'vecino'
        const comp = n.rol === 'competidor'
        const r = yo ? 34 : 24
        const opacidad = !marcados ? 1 : comp ? 0.32 : vecino || yo ? 1 : 0.55
        const visitado = n.id !== 'barberia' && (recorrido as string[]).includes(n.id)
        const enlazado = enlazados && vecino
        return (
          <g key={n.id} className="cs-nodo" transform={`translate(${n.x} ${n.y})`} style={{ opacity: opacidad, filter: comp && marcados ? 'grayscale(1)' : 'none' }}>
            {(yo || enlazado) && (
              <circle r={r + 14} fill={visitado ? ORO : n.color} opacity=".16" style={{ animation: 'pr-pulse 3s ease-in-out infinite' }} />
            )}
            {yo && (
              <circle r={r + 9} fill="none" stroke={n.color} strokeOpacity=".7" strokeWidth="1.2" strokeDasharray="6 8" style={{ transformBox: 'fill-box', transformOrigin: 'center', animation: 'pr-spin 14s linear infinite' }} />
            )}
            <circle r={r} fill={`${n.color}`} fillOpacity={yo ? 0.95 : 0.85} stroke={visitado ? ORO : 'rgba(255,255,255,.35)'} strokeWidth={visitado ? 2.5 : 1.2} style={{ transition: 'stroke .4s' }} />
            <text textAnchor="middle" dominantBaseline="central" fontSize={yo ? 28 : 20} style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,.4))' }}>{n.emoji}</text>
            <text y={r + 18} textAnchor="middle" fontSize={yo ? 13.5 : 12} fontWeight={700} fill={C.text} fontFamily={FONT} style={{ paintOrder: 'stroke', stroke: 'rgba(7,11,22,.85)', strokeWidth: 4 }}>{n.nombre}</text>
            <text y={r + 32} textAnchor="middle" fontSize="10" fill={C.muted} fontFamily={FONT} style={{ paintOrder: 'stroke', stroke: 'rgba(7,11,22,.85)', strokeWidth: 3 }}>{n.rubro}{yo ? ' · vos' : ''}</text>

            {comp && marcados && (
              <g transform={`translate(0 ${-r - 26})`}>
                {/* El g con animación CSS va adentro: un transform de CSS pisaría el atributo transform. */}
                <g className="pr-fade-up">
                  <rect x={-42} y={-11} width={84} height={22} rx={11} fill="rgba(248,113,113,.18)" stroke="rgba(248,113,113,.5)" />
                  <text textAnchor="middle" dominantBaseline="central" fontSize="10.5" fontWeight={700} fill="#FCA5A5" fontFamily={FONT}>mismo rubro</text>
                </g>
              </g>
            )}
            {enlazado && (
              <g transform={`translate(${r + 6} ${-r - 4})`}>
                <g className="pr-fade-up" style={{ animationDelay: `${VECINOS.indexOf(n.id as IdTicket) * 0.25 + 0.8}s` }}>
                  <rect x={0} y={-11} width={58} height={22} rx={11} fill={`${ACENTO}2A`} stroke={`${ACENTO}88`} />
                  <text x={29} textAnchor="middle" dominantBaseline="central" fontSize="10.5" fontWeight={800} fill={ACENTO} fontFamily={FONT}>a {n.dist} m</text>
                </g>
              </g>
            )}
            {visitado && (
              <g transform={`translate(${r - 4} ${-r + 4})`}>
                <g className="cs-pop" style={{ transformBox: 'fill-box', transformOrigin: 'center' }}>
                  <circle r="9" fill={ORO} />
                  <path d="M -3.5 0 L -1 2.5 L 3.5 -2.5" fill="none" stroke="#1F2937" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </g>
              </g>
            )}
          </g>
        )
      })}
    </svg>
  )
}

// ─── Lado cliente ────────────────────────────────────────────────────────────

function Caminando({ desde, hasta }: { desde: IdTicket; hasta: IdTicket }) {
  const a = NEGOCIOS[desde], b = NEGOCIOS[hasta]
  return (
    <div className="pr-fade-in" style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14, padding: 24, textAlign: 'center', background: `linear-gradient(180deg, ${b.color}14, #fff 60%)` }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <span style={{ fontSize: 30 }}>{a.emoji}</span>
        <span style={{ display: 'inline-flex', color: b.color, animation: 'cs-caminar 1s ease-in-out infinite' }}><Footprints size={22} /></span>
        <span style={{ fontSize: 30 }}>{b.emoji}</span>
      </div>
      <div style={{ fontFamily: FONT_DISPLAY, fontSize: 18, fontWeight: 800, color: '#0F172A' }}>Caminando a {b.nombre}</div>
      <div style={{ fontSize: 13, color: '#64748B' }}>{b.dist} m desde {a.nombre}. Con el código listo para mostrar.</div>
      <div style={{ width: 180, height: 6, borderRadius: 99, background: '#E2E8F0', overflow: 'hidden' }}>
        <div style={{ height: '100%', background: b.color, borderRadius: 99, animation: 'cs-validez 1.9s linear reverse forwards' }} />
      </div>
    </div>
  )
}

function TicketCliente({ ticket, activa, recorrido, ahorro, onSaltar }: { ticket: Ticket; activa: boolean; recorrido: IdTicket[]; ahorro: number; onSaltar: () => void }) {
  const n = NEGOCIOS[ticket.negocio]
  const total = ticket.lineas.reduce((s, l) => s + (l.precioFinal ?? l.precio), 0)
  const totalLista = ticket.lineas.reduce((s, l) => s + l.precio, 0)
  const siguiente = CADENA[ticket.negocio]
  const pendientes = VECINOS.filter(v => !recorrido.includes(v))
  const esBarberia = ticket.negocio === 'barberia'

  return (
    <div className="pr-fade-in" style={{ minHeight: '100%', background: '#F8FAFC' }}>
      {/* Cabecera del ticket */}
      <div style={{ padding: '52px 20px 18px', background: `linear-gradient(160deg, ${n.color}, ${n.color}AA)`, color: '#fff' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ width: 44, height: 44, borderRadius: 14, background: 'rgba(255,255,255,.22)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>{n.emoji}</span>
          <div>
            <div style={{ fontFamily: FONT_DISPLAY, fontSize: 18, fontWeight: 800, lineHeight: 1.1 }}>{n.nombre}</div>
            <div style={{ fontSize: 12, opacity: .85 }}>Palermo · Ticket {ticket.numero} · hoy {ticket.hora}</div>
          </div>
        </div>
        <div style={{ marginTop: 14, display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 10px', borderRadius: 999, background: '#fff', color: '#009EE3', fontSize: 11.5, fontWeight: 800 }}>
          <span style={{ width: 14, height: 14, borderRadius: 4, background: '#009EE3', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 9 }}>MP</span>
          Pagado con Mercado Pago
        </div>
      </div>

      <div style={{ padding: 18 }}>
        {/* Líneas */}
        <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #E2E8F0', padding: 14 }}>
          {ticket.lineas.map(l => (
            <div key={l.nombre} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 10, padding: '6px 0', fontSize: 14 }}>
              <span style={{ color: '#0F172A' }}>{l.nombre}</span>
              {l.precioFinal !== undefined ? (
                <span style={{ display: 'inline-flex', gap: 8, alignItems: 'baseline' }}>
                  <s style={{ color: '#94A3B8', fontSize: 12.5 }}>{formatoARS(l.precio)}</s>
                  <b style={{ color: n.color }}>{formatoARS(l.precioFinal)}</b>
                </span>
              ) : (
                <b style={{ color: '#0F172A' }}>{formatoARS(l.precio)}</b>
              )}
            </div>
          ))}
          {ticket.beneficio && (
            <div className="pr-fade-up" style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: 10, background: `${n.color}14`, border: `1px dashed ${n.color}66`, fontSize: 12.5, color: '#0F172A' }}>
              <Sparkles size={14} color={n.color} />
              <span>Constelación de Barbería Sur: <b>{ticket.beneficio}</b> · ahorraste {formatoARS(ticket.ahorro)}</span>
            </div>
          )}
          <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px dashed #CBD5E1', display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <span style={{ fontSize: 13, color: '#64748B', fontWeight: 600 }}>Total</span>
            <span style={{ display: 'inline-flex', gap: 8, alignItems: 'baseline' }}>
              {totalLista !== total && <s style={{ color: '#94A3B8', fontSize: 13 }}>{formatoARS(totalLista)}</s>}
              <span style={{ fontFamily: FONT_DISPLAY, fontSize: 22, fontWeight: 800, color: '#0F172A' }}>{formatoARS(total)}</span>
            </span>
          </div>
        </div>

        {/* Cierre "clásico" o la constelación */}
        {!activa ? (
          <div style={{ marginTop: 18, textAlign: 'center', color: '#64748B', fontSize: 13, padding: '18px 8px' }}>
            <div style={{ fontSize: 22, marginBottom: 6 }}>🙌</div>
            Gracias por venir. Te esperamos.
            <div style={{ marginTop: 22, fontSize: 11, color: '#94A3B8' }}>— fin del ticket —</div>
          </div>
        ) : (
          <div className="pr-fade-up" style={{ marginTop: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
              <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '.12em', textTransform: 'uppercase', color: '#0284C7' }}>✦ Tu constelación</div>
              {ahorro > 0 && <span style={{ fontSize: 11.5, fontWeight: 700, color: '#B45309', background: '#FEF3C7', padding: '3px 8px', borderRadius: 999 }}>Ahorraste {formatoARS(ahorro)}</span>}
            </div>
            <div style={{ fontSize: 12.5, color: '#475569', marginTop: 4 }}>
              {esBarberia ? 'Por venir a Barbería Sur, hoy tenés esto a menos de 200 m:' : pendientes.length ? 'Todavía te quedan beneficios cerca:' : 'Completaste la vuelta al barrio.'}
            </div>

            {pendientes.length > 0 && (
              <div style={{ marginTop: 10, display: 'grid', gap: 8 }}>
                {pendientes.map((id, i) => {
                  const v = NEGOCIOS[id]
                  const proximo = id === siguiente
                  return (
                    <div key={id} className="pr-fade-up" style={{ animationDelay: `${i * 100 + 150}ms`, display: 'flex', alignItems: 'center', gap: 10, padding: 10, borderRadius: 12, background: '#fff', border: `1px solid ${proximo ? v.color : '#E2E8F0'}`, boxShadow: proximo ? `0 6px 20px ${v.color}33` : 'none', transition: 'all .3s' }}>
                      <span style={{ width: 36, height: 36, borderRadius: 10, background: `${v.color}22`, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>{v.emoji}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 800, color: '#0F172A' }}>{v.da}</div>
                        <div style={{ fontSize: 11.5, color: '#64748B' }}>{v.nombre} · a {v.dist} m</div>
                      </div>
                      {proximo && <ArrowRight size={16} color={v.color} />}
                    </div>
                  )
                })}
              </div>
            )}

            {/* Código */}
            {pendientes.length > 0 && (
              <div style={{ marginTop: 12, padding: 12, borderRadius: 12, background: '#0F172A', color: '#fff' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ fontSize: 10, letterSpacing: '.12em', textTransform: 'uppercase', opacity: .6 }}>Mostrá este código</div>
                    <div style={{ fontFamily: FONT_MONO, fontSize: 22, fontWeight: 800, letterSpacing: '.12em', marginTop: 2 }}>ORB-7F2K</div>
                  </div>
                  <div style={{ textAlign: 'right', fontSize: 11, opacity: .75 }}>Válido 72 hs<br />{pendientes.length} de 3 por usar</div>
                </div>
                <div style={{ marginTop: 10, height: 5, borderRadius: 99, background: 'rgba(255,255,255,.15)', overflow: 'hidden' }}>
                  <div style={{ height: '100%', borderRadius: 99, background: `linear-gradient(90deg, ${ACENTO}, #8B5CF6)`, animation: 'cs-validez 240s linear forwards' }} />
                </div>
              </div>
            )}

            {siguiente ? (
              <button type="button" className="pr-btn" onClick={onSaltar} style={{ marginTop: 12, width: '100%', padding: '12px 14px', borderRadius: 12, border: 'none', fontFamily: FONT, fontSize: 13.5, fontWeight: 800, color: '#fff', background: `linear-gradient(135deg, ${NEGOCIOS[siguiente].color}, ${NEGOCIOS[siguiente].color}BB)`, boxShadow: `0 8px 22px ${NEGOCIOS[siguiente].color}55`, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                <Zap size={15} /> Simular: voy a {NEGOCIOS[siguiente].nombre}
              </button>
            ) : (
              <div className="cs-pop" style={{ marginTop: 12, padding: 14, borderRadius: 12, background: 'linear-gradient(135deg, #FEF3C7, #FDE68A)', textAlign: 'center' }}>
                <div style={{ fontSize: 24 }}>🌟</div>
                <div style={{ fontFamily: FONT_DISPLAY, fontSize: 16, fontWeight: 800, color: '#78350F' }}>Ahorraste {formatoARS(ahorro)} en el barrio</div>
                <div style={{ fontSize: 12, color: '#92400E', marginTop: 2 }}>Cuatro negocios, una sola tarde. Tocá &ldquo;Reiniciar&rdquo; para verlo de nuevo.</div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Métrica del pie ─────────────────────────────────────────────────────────

function Metrica({ icono, color, valor, etiqueta, dinero }: { icono: ReactNode; color: string; valor: number; etiqueta: string; dinero?: boolean }) {
  const v = useContador(valor)
  return (
    <Tarjeta style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 14 }}>
      <span style={{ width: 40, height: 40, borderRadius: 12, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: `${color}1F`, color, flexShrink: 0 }}>{icono}</span>
      <div style={{ minWidth: 0 }}>
        <div key={valor} className="cs-pop" style={{ fontFamily: FONT_DISPLAY, fontSize: 24, fontWeight: 800, color: C.text, lineHeight: 1.1, fontVariantNumeric: 'tabular-nums' }}>{dinero ? formatoARS(v) : v}</div>
        <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>{etiqueta}</div>
      </div>
    </Tarjeta>
  )
}
