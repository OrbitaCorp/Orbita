// src/modules/propuestas/prototipos/Regateo.tsx — Prototipo interactivo de
// "Orbi Regatea" (propuesta 06): el cliente negocia el precio con Orbi
// desde la ficha del producto; el dueño solo fija hasta dónde ceder. Dos
// pantallas que reaccionan entre sí: el celular del cliente (izquierda) y el
// panel del dueño con la consola de decisión de Orbi (derecha). DEMO INTERNA,
// autocontenida: sin fetch, sin storage, sin LLM. La "inteligencia" de Orbi
// es un conjunto de reglas locales y deterministas.

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import {
  ArrowRight, BadgePercent, Check, CheckCircle2, Clock, Handshake, Lock, MessageSquare,
  Package, RotateCcw, Settings2, Shirt, ShoppingBag, Sparkles, Tag, Ticket, Truck, User, Users, X,
} from 'lucide-react'
import { C, FONT, FONT_DISPLAY, FONT_MONO, Tarjeta, Chip, Boton, Etiqueta, Pantalla, OrbiAvatar, formatoARS } from '../ui'

// ─── Datos de la demo ────────────────────────────────────────────────────────

const ACENTO = '#F472B6'
const ACENTO_OSCURO = '#BE185D'
const MP = '#009EE3'
const NEGOCIO = 'Casa Ramos · indumentaria'

const PRODUCTO = { nombre: 'Campera de jean oversize', lista: 24000, costo: 14000, stock: 3, dias: 47, talle: 'M · L · XL' }
const REMERA = { nombre: 'Remera básica', lista: 9000, costo: 4500 }
const ENVIO = 2500
const MAX_RONDAS = 3
const CUPON_SEGUNDOS = 15 * 60
const CODIGOS = ['ORBI-7K2Q', 'ORBI-M4XT', 'ORBI-9BLR', 'ORBI-C2WP', 'ORBI-H8ZN']
const OFERTA_MIN = 12000

type TipoCliente = 'nuevo' | 'recurrente'
type Fase = 'ficha' | 'chat' | 'cupon' | 'checkout' | 'pagado' | 'vencido'
type Msg = { id: number; de: 'orbi' | 'cliente'; texto: string; monto?: number }
type Linea = { id: number; texto: string; tono: 'ctx' | 'info' | 'ok' | 'warn' | 'acento' | 'regla' }
type EstadoFila = 'pagada' | 'cupon' | 'sin acuerdo' | 'vencida'
type Fila = { id: number; producto: string; inicial: number; cierre: number | null; estado: EstadoFila; nueva?: boolean }
type Propuesta = { precio: number; combo: number | null; envioGratis: boolean }
type Acuerdo = { codigo: string; precio: number; conRemera: boolean; envioGratis: boolean; filaId: number }
type Decision = { tipo: 'acepta' | 'contra' | 'final' | 'guarda'; precio: number; combo: number | null; envioGratis: boolean; texto: string; hud: Linea[] }

const FILAS_INICIALES: Fila[] = [
  { id: 1, producto: 'Remera oversize negra', inicial: 7000, cierre: 8500, estado: 'pagada' },
  { id: 2, producto: 'Pantalón cargo beige', inicial: 15000, cierre: 19000, estado: 'pagada' },
  { id: 3, producto: 'Buzo canguro gris', inicial: 10000, cierre: null, estado: 'sin acuerdo' },
  { id: 4, producto: 'Zapatillas urbanas', inicial: 30000, cierre: 33000, estado: 'vencida' },
]

const CSS = `
  @keyframes rg-shine { 0% { transform: translateX(-130%) skewX(-18deg); } 60%, 100% { transform: translateX(230%) skewX(-18deg); } }
  @keyframes rg-glow { 0%, 100% { box-shadow: 0 8px 24px rgba(244,114,182,.35); } 50% { box-shadow: 0 8px 34px rgba(244,114,182,.7), 0 0 0 6px rgba(244,114,182,.14); } }
  @keyframes rg-pop { 0% { opacity: 0; transform: translateY(10px) scale(.96); } 100% { opacity: 1; transform: none; } }
  @keyframes rg-ticket { 0% { opacity: 0; transform: translateY(30px) rotate(-3deg) scale(.92); } 60% { transform: translateY(-6px) rotate(1deg) scale(1.02); } 100% { opacity: 1; transform: none; } }
  @keyframes rg-bump { 0% { transform: scale(1); } 40% { transform: scale(1.18); } 100% { transform: scale(1); } }
  @keyframes rg-scan { 0% { top: -10%; } 100% { top: 110%; } }
  @keyframes rg-row { 0% { background: rgba(244,114,182,.28); } 100% { background: transparent; } }
  @keyframes rg-check { 0% { transform: scale(.4); opacity: 0; } 60% { transform: scale(1.15); opacity: 1; } 100% { transform: scale(1); } }
  @keyframes rg-slide { from { opacity: 0; transform: translateX(24px); } to { opacity: 1; transform: none; } }
  .rg-grid { display: grid; grid-template-columns: minmax(0, 2fr) minmax(0, 3fr); gap: 22px; align-items: start; }
  @media (max-width: 1000px) { .rg-grid { grid-template-columns: 1fr; } }
  .rg-range { width: 100%; accent-color: ${ACENTO}; cursor: pointer; }
  .rg-range-p { width: 100%; accent-color: ${C.primary}; cursor: pointer; }
  .rg-chip { transition: transform .15s, background .15s, border-color .15s; cursor: pointer; }
  .rg-chip:hover { transform: translateY(-1px); border-color: ${ACENTO} !important; background: #FDF2F8 !important; }
  .rg-chip:active { transform: scale(.96); }
  .rg-chip:disabled { opacity: .45; cursor: not-allowed; transform: none; }
  .rg-seg { transition: background .18s, color .18s; cursor: pointer; }
  .rg-hud-line { animation: pr-fade-up .45s cubic-bezier(.2,.8,.2,1) both; }
  @media (prefers-reduced-motion: reduce) { .rg-anim, .rg-hud-line { animation: none !important; } }
`

// ─── Reglas de Orbi (determinísticas) ───────────────────────────────────────

const r100 = (n: number) => Math.round(n / 100) * 100
const r500 = (n: number) => Math.round(n / 500) * 500
const ARS = formatoARS
const pct = (n: number) => `${n >= 0 ? '+' : ''}${Math.round(n * 100)}%`
const margenSobreCosto = (precio: number, costo: number) => Math.round(((precio - costo) / costo) * 100)

type Reglas = { margenMin: number; cedeViejo: boolean; bonusViejo: number; combos: boolean; envio: boolean; cliente: TipoCliente }

function calcularPiso(r: Reglas) {
  const pisoMargen = r100(PRODUCTO.costo * (1 + r.margenMin / 100))
  const bonus = r.cedeViejo && PRODUCTO.dias >= 30 ? r.bonusViejo : 0
  const pisoBonus = r100(pisoMargen * (1 - bonus / 100))
  const flex = r.cliente === 'recurrente' ? 2 : 0
  const piso = Math.max(PRODUCTO.costo, r100(pisoBonus * (1 - flex / 100)))
  const pisoRemera = r100(REMERA.costo * (1 + r.margenMin / 100))
  return { pisoMargen, bonus, pisoBonus, flex, piso, pisoRemera }
}

let hudSeq = 1000
const L = (texto: string, tono: Linea['tono'] = 'info'): Linea => ({ id: hudSeq++, texto, tono })

function decidir(o: { oferta: number; ronda: number; ultimaContra: number | null; reglas: Reglas }): Decision {
  const { oferta, ronda, reglas } = o
  const { piso, pisoRemera } = calcularPiso(reglas)
  const lista = PRODUCTO.lista
  const ancla = o.ultimaContra ?? lista
  const dist = (oferta - piso) / piso
  const base: Linea[] = [
    L(`ronda ${ronda}/${MAX_RONDAS} · oferta recibida ${ARS(oferta)}`, 'acento'),
    L(`distancia al piso (${ARS(piso)}): ${pct(dist)}`, dist >= 0 ? 'ok' : 'warn'),
  ]

  if (oferta >= lista) {
    return {
      tipo: 'acepta', precio: lista, combo: null, envioGratis: false,
      texto: `Con ${ARS(lista)} te la llevás al precio de lista, no hace falta que pagues más. Te armo el cupón igual, así vas directo a pagar.`,
      hud: [...base, L(`→ ACEPTAR a precio de lista ${ARS(lista)} (oferta ≥ lista)`, 'ok')],
    }
  }
  if (oferta >= piso) {
    return {
      tipo: 'acepta', precio: oferta, combo: null, envioGratis: false,
      texto: ronda === 1
        ? `Hecho, ${ARS(oferta)} y es tuya. Te armo el cupón: tenés 15 minutos para pagarla.`
        : `Dale, cerramos en ${ARS(oferta)}. Te armo el cupón, tenés 15 minutos.`,
      hud: [...base, L(`→ ACEPTAR: ${ARS(oferta)} ≥ piso ${ARS(piso)} · margen ${margenSobreCosto(oferta, PRODUCTO.costo)}%`, 'ok')],
    }
  }
  if (ronda >= MAX_RONDAS) {
    if (dist >= -0.1) {
      return {
        tipo: 'final', precio: piso, combo: null, envioGratis: false,
        texto: `Última: ${ARS(piso)}. Más abajo no puedo, ahí ya pierdo plata. Si te sirve, cerramos ahora.`,
        hud: [...base, L(`→ CIERRE ronda ${MAX_RONDAS}: última oferta = piso ${ARS(piso)}`, 'warn')],
      }
    }
    return {
      tipo: 'guarda', precio: piso, combo: null, envioGratis: false,
      texto: `No puedo bajar más. Pero te la guardo en ${ARS(piso)} hasta mañana, por si te decidís.`,
      hud: [...base, L(`→ CIERRE ronda ${MAX_RONDAS}: sin acuerdo · guardar ${ARS(piso)} 24 h`, 'warn')],
    }
  }
  const cerca = dist >= -0.15
  if (cerca) {
    const contra = Math.max(piso, r500((oferta + ancla) / 2))
    return {
      tipo: 'contra', precio: contra, combo: null, envioGratis: false,
      texto: ronda === 1
        ? `Está hace un tiempo en la tienda, así que me puedo mover: te la dejo en ${ARS(contra)}.`
        : `Nos vamos acercando. ${ARS(contra)} y cerramos, qué decís?`,
      hud: [...base, L(`→ CONTRAOFERTAR ${ARS(contra)}: mitad de camino entre ${ARS(oferta)} y ${ARS(ancla)} · motivo: ${PRODUCTO.dias} días sin rotar`, 'warn')],
    }
  }
  const contra = Math.max(piso, r500(ancla - (ancla - oferta) * 0.3))
  let texto = ronda === 1
    ? `Uf, ahí no llego: ${ARS(oferta)} está por debajo de lo que me cuesta tenerla. Lo que sí puedo es dejártela en ${ARS(contra)}.`
    : `Sigo sin llegar a ${ARS(oferta)}. Te la dejo en ${ARS(contra)}, y no me estoy guardando nada.`
  const hud = [...base, L(`→ CONTRAOFERTAR ${ARS(contra)}: oferta lejos del piso, cedo 30% de la brecha`, 'warn')]
  let combo: number | null = null
  let envioGratis = false
  if (reglas.combos) {
    combo = Math.max(r500((PRODUCTO.lista + REMERA.lista) * 0.85), piso + pisoRemera)
    texto += ` Y si le sumás la remera básica, te hago las dos a ${ARS(combo)}.`
    hud.push(L(`→ COMBO: campera + remera = ${ARS(combo)} (15% off) ≥ piso combo ${ARS(piso + pisoRemera)}`, 'acento'))
  } else if (reglas.envio) {
    envioGratis = true
    texto += ` Y el envío corre por mi cuenta.`
    hud.push(L(`→ ENVÍO GRATIS como concesión (cuesta ${ARS(ENVIO)}, no toca el piso)`, 'acento'))
  } else {
    hud.push(L('combos y envío deshabilitados por el dueño: solo precio', 'ctx'))
  }
  return { tipo: 'contra', precio: contra, combo, envioGratis, texto, hud }
}

// ─── Componente principal ────────────────────────────────────────────────────

export default function Regateo() {
  // Reglas del dueño
  const [margenMin, setMargenMin] = useState(25)
  const [cedeViejo, setCedeViejo] = useState(true)
  const [bonusViejo, setBonusViejo] = useState(4)
  const [combos, setCombos] = useState(true)
  const [envio, setEnvio] = useState(true)
  const [soloMarcados, setSoloMarcados] = useState(true)
  const [cliente, setCliente] = useState<TipoCliente>('recurrente')

  // Lado del cliente
  const [fase, setFase] = useState<Fase>('ficha')
  const [msgs, setMsgs] = useState<Msg[]>([])
  const [escribiendo, setEscribiendo] = useState(false)
  const [oferta, setOferta] = useState(15000)
  const [ronda, setRonda] = useState(0)
  const [pendiente, setPendiente] = useState<Propuesta | null>(null)
  const [ultimaContra, setUltimaContra] = useState<number | null>(null)
  const [terminado, setTerminado] = useState(false)
  const [rechazado, setRechazado] = useState(false)
  const [acuerdo, setAcuerdo] = useState<Acuerdo | null>(null)
  const [segundos, setSegundos] = useState(CUPON_SEGUNDOS)
  const [ofertaInicial, setOfertaInicial] = useState<number | null>(null)

  // Lado del dueño
  const [hud, setHud] = useState<Linea[]>([])
  const [historial, setHistorial] = useState<Fila[]>(FILAS_INICIALES)

  const timers = useRef<number[]>([])
  const ids = useRef(1)
  const cerradas = useRef(0)
  const segRef = useRef(CUPON_SEGUNDOS)

  useEffect(() => {
    const lista = timers.current
    return () => { lista.forEach(t => window.clearTimeout(t)) }
  }, [])

  // Cuenta regresiva real del cupón
  const cuponVigente = fase === 'cupon' || fase === 'checkout'
  const filaActiva = acuerdo?.filaId ?? null
  useEffect(() => {
    if (!cuponVigente || filaActiva == null) return
    const t = window.setInterval(() => {
      segRef.current = Math.max(0, segRef.current - 1)
      setSegundos(segRef.current)
      if (segRef.current === 0) {
        setFase('vencido')
        setHistorial(h => h.map(f => (f.id === filaActiva ? { ...f, estado: 'vencida' } : f)))
      }
    }, 1000)
    return () => window.clearInterval(t)
  }, [cuponVigente, filaActiva])

  const reglas: Reglas = { margenMin, cedeViejo, bonusViejo, combos, envio, cliente }
  const pisoInfo = calcularPiso(reglas)
  const recurrente = cliente === 'recurrente'
  const ocupado = escribiendo

  // Helpers
  const programar = (fn: () => void, ms: number) => { timers.current.push(window.setTimeout(fn, ms)) }
  const nuevoId = () => ids.current++
  const agregarMsg = (de: Msg['de'], texto: string, monto?: number) => setMsgs(m => [...m, { id: nuevoId(), de, texto, monto }])
  const agregarHud = (lineas: Linea[], retraso = 0) => {
    lineas.forEach((l, i) => programar(() => setHud(h => [...h, l]), retraso + i * 160))
  }
  const respondeOrbi = (texto: string, ms: number, luego?: () => void) => {
    setEscribiendo(true)
    programar(() => {
      setEscribiendo(false)
      agregarMsg('orbi', texto)
      luego?.()
    }, ms)
  }

  // Acciones
  const reiniciar = () => {
    timers.current.forEach(t => window.clearTimeout(t))
    timers.current = []
    setFase('ficha'); setMsgs([]); setEscribiendo(false); setOferta(15000); setRonda(0)
    setPendiente(null); setUltimaContra(null); setTerminado(false); setRechazado(false); setAcuerdo(null)
    segRef.current = CUPON_SEGUNDOS; setSegundos(CUPON_SEGUNDOS); setOfertaInicial(null); setHud([])
    setHistorial(FILAS_INICIALES)
  }

  const abrirChat = () => {
    setFase('chat')
    agregarHud([
      L(`sesión abierta · ${recurrente ? 'cliente recurrente (3 compras)' : 'cliente nuevo'} · ${PRODUCTO.nombre}`, 'ctx'),
      L(`piso vigente ${ARS(pisoInfo.piso)} · esperando oferta`, 'ctx'),
    ])
    respondeOrbi(
      recurrente
        ? `Hola Juli, qué bueno verte de vuelta. Esa campera te queda de diez. Decime cuánto podés pagar y vemos si llegamos.`
        : `Hola! Soy Orbi, de ${NEGOCIO.split(' · ')[0]}. Esa campera está buenísima. Decime cuánto podés pagar y vemos si llegamos.`,
      900,
    )
  }

  const cerrarAcuerdo = (precio: number, conRemera: boolean, envioGratis: boolean) => {
    const codigo = CODIGOS[cerradas.current % CODIGOS.length]
    cerradas.current += 1
    const filaId = nuevoId()
    const nombre = conRemera ? `${PRODUCTO.nombre} + remera` : PRODUCTO.nombre
    setTerminado(true)
    setPendiente(null)
    const piso = conRemera ? pisoInfo.piso + pisoInfo.pisoRemera : pisoInfo.piso
    agregarHud([
      L(`✓ validado por regla: precio final ${ARS(precio)} ≥ piso ${ARS(piso)} · margen ${margenSobreCosto(precio, conRemera ? PRODUCTO.costo + REMERA.costo : PRODUCTO.costo)}%`, 'regla'),
      L(`cupón ${codigo} emitido · un solo uso · vence en 15:00`, 'ok'),
    ], 200)
    programar(() => {
      setAcuerdo({ codigo, precio, conRemera, envioGratis, filaId })
      segRef.current = CUPON_SEGUNDOS
      setSegundos(CUPON_SEGUNDOS)
      setFase('cupon')
      setHistorial(h => [{ id: filaId, producto: nombre, inicial: ofertaInicial ?? precio, cierre: precio, estado: 'cupon', nueva: true }, ...h])
    }, 1100)
  }

  const ofrecer = (monto: number) => {
    if (ocupado || terminado || ronda >= MAX_RONDAS) return
    const r = ronda + 1
    setRonda(r)
    if (ofertaInicial == null) setOfertaInicial(monto)
    setPendiente(null)
    agregarMsg('cliente', r === 1 ? `¿Me la dejás en ${ARS(monto)}?` : `Te ofrezco ${ARS(monto)}`, monto)
    const d = decidir({ oferta: monto, ronda: r, ultimaContra, reglas })
    agregarHud(d.hud, 300)
    respondeOrbi(d.texto, 1300, () => {
      if (d.tipo === 'acepta') { cerrarAcuerdo(d.precio, false, false); return }
      setUltimaContra(d.precio)
      setPendiente({ precio: d.precio, combo: d.combo, envioGratis: d.envioGratis })
      if (d.tipo === 'guarda' || d.tipo === 'final') setTerminado(true)
    })
  }

  const preguntarMinimo = () => {
    if (ocupado || terminado) return
    agregarMsg('cliente', '¿Cuánto es lo mínimo?')
    const pista = r500(pisoInfo.piso * 1.15)
    agregarHud([
      L('pregunta "lo mínimo" · no consume ronda · nunca revelar el piso', 'ctx'),
      L(`ancla sugerida ${ARS(pista)} (piso × 1,15)`, 'info'),
    ], 200)
    respondeOrbi(`Jaja, la pregunta de siempre. Hacéme una oferta y te digo si llego. Te adelanto que por debajo de ${ARS(pista)} se me complica, pero probá.`, 1100)
  }

  const aceptarContra = () => {
    if (!pendiente || ocupado) return
    const p = pendiente
    agregarMsg('cliente', `Dale, cerramos en ${ARS(p.precio)}`, p.precio)
    agregarHud([L(`cliente acepta contraoferta ${ARS(p.precio)}${p.envioGratis ? ' + envío gratis' : ''}`, 'acento')], 150)
    respondeOrbi(`Genial. Te armo el cupón y vas directo a pagar.`, 800, () => cerrarAcuerdo(p.precio, false, p.envioGratis))
  }

  const aceptarCombo = () => {
    if (!pendiente?.combo || ocupado) return
    const p = pendiente
    const combo = p.combo as number
    agregarMsg('cliente', `Sumo la remera. Cerramos las dos en ${ARS(combo)}`, combo)
    agregarHud([L(`cliente acepta combo ${ARS(combo)} · agrego remera básica al carrito`, 'acento')], 150)
    respondeOrbi(`Buenísimo, gran combo. Te armo el cupón con las dos.`, 800, () => cerrarAcuerdo(combo, true, false))
  }

  const rechazar = () => {
    if (ocupado) return
    setTerminado(true)
    setRechazado(true)
    setPendiente(null)
    const filaId = nuevoId()
    agregarMsg('cliente', 'No, gracias. Lo pienso.')
    agregarHud([L('cliente se retira · sin acuerdo · precio guardado 24 h', 'warn')], 150)
    setHistorial(h => [{ id: filaId, producto: PRODUCTO.nombre, inicial: ofertaInicial ?? oferta, cierre: null, estado: 'sin acuerdo', nueva: true }, ...h])
    respondeOrbi(`Todo bien. Te guardo el precio hasta mañana, cualquier cosa me escribís.`, 900)
  }

  const pagar = () => {
    if (!acuerdo) return
    setFase('pagado')
    setHistorial(h => h.map(f => (f.id === acuerdo.filaId ? { ...f, estado: 'pagada' } : f)))
    agregarHud([L(`pedido #1042 pagado con cupón ${acuerdo.codigo} · cupón consumido`, 'ok')])
  }

  const cambiarCliente = (t: TipoCliente) => {
    setCliente(t)
    if (fase !== 'ficha') agregarHud([L(`cliente cambiado a ${t === 'recurrente' ? 'recurrente (3 compras) · +2% flexibilidad' : 'nuevo · sin flexibilidad extra'} · piso recalculado`, 'ctx')])
  }

  return (
    <div style={{ padding: 26, minHeight: 600, color: C.text, fontFamily: FONT }}>
      <style>{CSS}</style>

      {/* Cabecera */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginBottom: 18 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ width: 40, height: 40, borderRadius: 12, display: 'grid', placeItems: 'center', background: `linear-gradient(135deg, ${ACENTO}, ${ACENTO_OSCURO})`, boxShadow: `0 8px 24px ${ACENTO}55` }}>
            <Handshake size={20} color="#fff" />
          </span>
          <div>
            <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: 18, letterSpacing: '-0.01em' }}>{NEGOCIO} · Orbi regatea</div>
            <div style={{ fontSize: 12.5, color: C.muted }}>Negociá desde el celular y mirá cómo el panel del dueño decide en vivo. Cambiá las reglas: Orbi cambia.</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <div style={{ display: 'inline-flex', padding: 3, borderRadius: 999, background: 'rgba(15,23,42,.6)', border: `1px solid ${C.border}` }}>
            {([['nuevo', 'Cliente nuevo', <User key="u" size={12} />], ['recurrente', 'Recurrente · 3 compras', <Users key="s" size={12} />]] as const).map(([id, t, icono]) => {
              const on = cliente === id
              return (
                <button key={id} type="button" className="rg-seg" onClick={() => cambiarCliente(id)} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 999, border: 'none', fontFamily: FONT, fontSize: 12, fontWeight: 700, background: on ? ACENTO : 'transparent', color: on ? '#fff' : C.muted }}>
                  {icono} {t}
                </button>
              )
            })}
          </div>
          <Boton variante="fantasma" tam="sm" onClick={reiniciar}><RotateCcw size={13} /> Reiniciar</Boton>
        </div>
      </div>

      <div className="rg-grid">
        {/* ── Celular del cliente ── */}
        <section>
          <Etiqueta color={ACENTO} style={{ marginBottom: 8 }}>Lado del cliente · tienda online</Etiqueta>
          <Celular
            fase={fase} msgs={msgs} escribiendo={escribiendo}
            oferta={oferta} setOferta={setOferta} ronda={ronda} pendiente={pendiente} terminado={terminado} rechazado={rechazado}
            ocupado={ocupado} recurrente={recurrente} soloMarcados={soloMarcados}
            acuerdo={acuerdo} segundos={segundos}
            abrirChat={abrirChat} ofrecer={ofrecer} preguntarMinimo={preguntarMinimo}
            aceptarContra={aceptarContra} aceptarCombo={aceptarCombo} rechazar={rechazar}
            irAPagar={() => setFase('checkout')} pagar={pagar} reiniciar={reiniciar}
          />
          <div style={{ marginTop: 12, padding: '12px 14px', borderRadius: 14, border: `1px dashed ${C.borderStrong}`, background: 'rgba(15,23,42,.4)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700, color: C.body, marginBottom: 4 }}><Lock size={12} color={ACENTO} /> Lo que el cliente nunca ve</div>
            <div style={{ fontSize: 11.5, color: C.subtle, lineHeight: 1.5 }}>
              Costo {ARS(PRODUCTO.costo)} · {PRODUCTO.dias} días sin rotar · piso {ARS(pisoInfo.piso)}. Orbi los usa para decidir, pero jamás los menciona en el chat.
            </div>
          </div>
        </section>

        {/* ── Panel del dueño ── */}
        <section style={{ display: 'grid', gap: 16 }}>
          <div>
            <Etiqueta color={ACENTO} style={{ marginBottom: 8 }}>Lado del dueño · panel de Órbita</Etiqueta>
            <PanelReglas
              margenMin={margenMin} setMargenMin={setMargenMin}
              cedeViejo={cedeViejo} setCedeViejo={setCedeViejo}
              bonusViejo={bonusViejo} setBonusViejo={setBonusViejo}
              combos={combos} setCombos={setCombos}
              envio={envio} setEnvio={setEnvio}
              soloMarcados={soloMarcados} setSoloMarcados={setSoloMarcados}
              piso={pisoInfo.piso}
            />
          </div>
          <ConsolaOrbi info={pisoInfo} reglas={reglas} hud={hud} fase={fase} ronda={ronda} />
        </section>
      </div>

      <NegociacionesHoy filas={historial} />
    </div>
  )
}

// ─── Celular del cliente ─────────────────────────────────────────────────────

function Celular(p: {
  fase: Fase; msgs: Msg[]; escribiendo: boolean
  oferta: number; setOferta: (n: number) => void; ronda: number; pendiente: Propuesta | null; terminado: boolean; rechazado: boolean
  ocupado: boolean; recurrente: boolean; soloMarcados: boolean
  acuerdo: Acuerdo | null; segundos: number
  abrirChat: () => void; ofrecer: (n: number) => void; preguntarMinimo: () => void
  aceptarContra: () => void; aceptarCombo: () => void; rechazar: () => void
  irAPagar: () => void; pagar: () => void; reiniciar: () => void
}) {
  return (
    <Pantalla tipo="celular" ancho={340}>
      <div style={{ padding: '46px 0 0', minHeight: 620, background: '#F8FAFC', display: 'flex', flexDirection: 'column' }}>
        {/* Barra de la tienda */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 14px 10px', borderBottom: '1px solid #E2E8F0', background: '#fff' }}>
          <span style={{ width: 26, height: 26, borderRadius: 8, background: `linear-gradient(135deg, ${ACENTO}, ${ACENTO_OSCURO})`, display: 'grid', placeItems: 'center', color: '#fff', fontWeight: 800, fontSize: 11 }}>CR</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 800, fontSize: 13, fontFamily: FONT_DISPLAY }}>Casa Ramos</div>
            <div style={{ fontSize: 10.5, color: '#64748B' }}>{p.recurrente ? 'Hola, Juli · 3 compras' : 'Visitante nuevo'}</div>
          </div>
          <ShoppingBag size={16} color="#64748B" />
        </div>

        {p.fase === 'ficha' && <Ficha abrirChat={p.abrirChat} soloMarcados={p.soloMarcados} />}
        {p.fase === 'chat' && (
          <Chat
            msgs={p.msgs} escribiendo={p.escribiendo}
            oferta={p.oferta} setOferta={p.setOferta} ronda={p.ronda} pendiente={p.pendiente} terminado={p.terminado} rechazado={p.rechazado} ocupado={p.ocupado}
            ofrecer={p.ofrecer} preguntarMinimo={p.preguntarMinimo} aceptarContra={p.aceptarContra} aceptarCombo={p.aceptarCombo} rechazar={p.rechazar}
          />
        )}
        {(p.fase === 'cupon' || p.fase === 'vencido') && p.acuerdo && (
          <Cupon acuerdo={p.acuerdo} segundos={p.segundos} vencido={p.fase === 'vencido'} irAPagar={p.irAPagar} reiniciar={p.reiniciar} />
        )}
        {(p.fase === 'checkout' || p.fase === 'pagado') && p.acuerdo && (
          <Checkout acuerdo={p.acuerdo} segundos={p.segundos} pagado={p.fase === 'pagado'} pagar={p.pagar} />
        )}
      </div>
    </Pantalla>
  )
}

function Ficha(p: { abrirChat: () => void; soloMarcados: boolean }) {
  return (
    <div className="pr-fade-in" style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 12, flex: 1 }}>
      {/* Foto */}
      <div style={{ position: 'relative', height: 210, borderRadius: 18, overflow: 'hidden', background: 'linear-gradient(160deg, #3B5A8C 0%, #24406B 55%, #182B4A 100%)', display: 'grid', placeItems: 'center', boxShadow: 'inset 0 -60px 80px rgba(0,0,0,.25)' }}>
        <div style={{ position: 'absolute', inset: 0, backgroundImage: 'repeating-linear-gradient(135deg, rgba(255,255,255,.035) 0 2px, transparent 2px 6px)' }} />
        <Shirt size={96} color="rgba(255,255,255,.85)" strokeWidth={1.2} />
        <span style={{ position: 'absolute', top: 10, left: 10, display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 9px', borderRadius: 999, background: 'rgba(255,255,255,.92)', fontSize: 10.5, fontWeight: 800, color: '#0F172A' }}><Package size={11} /> Quedan 3</span>
        {p.soloMarcados && (
          <span style={{ position: 'absolute', top: 10, right: 10, display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 9px', borderRadius: 999, background: ACENTO, fontSize: 10.5, fontWeight: 800, color: '#fff' }}><Handshake size={11} /> Se acepta oferta</span>
        )}
      </div>

      <div>
        <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: 17, letterSpacing: '-0.01em' }}>{PRODUCTO.nombre}</div>
        <div style={{ fontSize: 12, color: '#64748B', marginTop: 2 }}>Talles {PRODUCTO.talle} · denim rígido · celeste lavado</div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 8 }}>
          <span style={{ fontFamily: FONT_MONO, fontWeight: 800, fontSize: 26, letterSpacing: '-0.02em' }}>{ARS(PRODUCTO.lista)}</span>
          <span style={{ fontSize: 11.5, color: '#64748B' }}>3 cuotas sin interés</span>
        </div>
      </div>

      <div style={{ marginTop: 'auto', display: 'grid', gap: 8 }}>
        <button type="button" className="pr-btn" style={{ width: '100%', padding: '13px 14px', borderRadius: 14, border: 'none', background: '#0F172A', color: '#fff', fontFamily: FONT, fontWeight: 800, fontSize: 14, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          <ShoppingBag size={16} /> Comprar
        </button>
        <button type="button" className="pr-btn rg-anim" onClick={p.abrirChat} style={{ position: 'relative', overflow: 'hidden', width: '100%', padding: '13px 14px', borderRadius: 14, border: 'none', background: `linear-gradient(135deg, ${ACENTO}, ${ACENTO_OSCURO})`, color: '#fff', fontFamily: FONT, fontWeight: 800, fontSize: 14, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, animation: 'rg-glow 2.4s ease-in-out infinite' }}>
          <span aria-hidden style={{ position: 'absolute', top: 0, bottom: 0, left: 0, width: '40%', background: 'linear-gradient(90deg, transparent, rgba(255,255,255,.45), transparent)', animation: 'rg-shine 2.8s ease-in-out infinite' }} />
          <Sparkles size={16} /> Hacé una oferta
        </button>
        <div style={{ textAlign: 'center', fontSize: 10.5, color: '#94A3B8' }}>Negociás con Orbi, el asistente de la tienda. Sin formularios.</div>
      </div>
    </div>
  )
}

function Chat(p: {
  msgs: Msg[]; escribiendo: boolean
  oferta: number; setOferta: (n: number) => void; ronda: number; pendiente: Propuesta | null; terminado: boolean; rechazado: boolean; ocupado: boolean
  ofrecer: (n: number) => void; preguntarMinimo: () => void; aceptarContra: () => void; aceptarCombo: () => void; rechazar: () => void
}) {
  const chatRef = useRef<HTMLDivElement>(null)
  const cantMsgs = p.msgs.length
  const escribiendo = p.escribiendo
  useEffect(() => {
    const el = chatRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [cantMsgs, escribiendo])
  const puedeOfrecer = !p.terminado && !p.ocupado && p.ronda < MAX_RONDAS
  const rondasRestantes = MAX_RONDAS - p.ronda
  return (
    <div className="pr-fade-in" style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      {/* Cabecera del chat */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px', background: '#fff', borderBottom: '1px solid #E2E8F0' }}>
        <OrbiAvatar size={26} />
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 800, fontSize: 12.5 }}>Orbi · {PRODUCTO.nombre}</div>
          <div style={{ fontSize: 10.5, color: '#64748B' }}>Lista {ARS(PRODUCTO.lista)} · quedan {PRODUCTO.stock}</div>
        </div>
        <div style={{ display: 'flex', gap: 3 }}>
          {Array.from({ length: MAX_RONDAS }).map((_, i) => (
            <span key={i} title={`Ronda ${i + 1}`} style={{ width: 8, height: 8, borderRadius: 99, background: i < p.ronda ? ACENTO : '#E2E8F0', transition: 'background .3s' }} />
          ))}
        </div>
      </div>

      {/* Burbujas */}
      <div ref={chatRef} className="pr-scroll" style={{ flex: 1, minHeight: 240, maxHeight: 300, overflowY: 'auto', padding: '12px 12px 6px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {p.msgs.map(m => <Burbuja key={m.id} msg={m} />)}
        {p.escribiendo && (
          <div className="rg-anim" style={{ display: 'flex', alignItems: 'flex-end', gap: 6, animation: 'rg-pop .25s ease both' }}>
            <OrbiAvatar size={22} />
            <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: '14px 14px 14px 4px', padding: '9px 12px', display: 'flex', gap: 4 }}>
              {[0, 1, 2].map(i => <span key={i} style={{ width: 6, height: 6, borderRadius: 99, background: C.orbi, animation: `pr-typing 1s ease-in-out ${i * 0.15}s infinite` }} />)}
            </div>
          </div>
        )}
      </div>

      {/* Entrada del cliente */}
      <div style={{ borderTop: '1px solid #E2E8F0', background: '#fff', padding: '10px 12px 12px', display: 'grid', gap: 8 }}>
        {p.pendiente && (
          <div className="rg-anim" style={{ display: 'grid', gap: 6, animation: 'rg-pop .3s ease both' }}>
            <button type="button" className="pr-btn" onClick={p.aceptarContra} disabled={p.ocupado} style={{ width: '100%', padding: '11px 12px', borderRadius: 12, border: 'none', background: '#0F172A', color: '#fff', fontFamily: FONT, fontWeight: 800, fontSize: 13, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              <Check size={15} /> Aceptar {ARS(p.pendiente.precio)}{p.pendiente.envioGratis ? ' + envío gratis' : ''}
            </button>
            {p.pendiente.combo != null && (
              <button type="button" className="pr-btn" onClick={p.aceptarCombo} disabled={p.ocupado} style={{ width: '100%', padding: '10px 12px', borderRadius: 12, border: `1px solid ${ACENTO}`, background: '#FDF2F8', color: ACENTO_OSCURO, fontFamily: FONT, fontWeight: 800, fontSize: 12.5, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                <Tag size={14} /> Sumar la remera: las dos por {ARS(p.pendiente.combo)}
              </button>
            )}
            {p.terminado && (
              <button type="button" className="pr-btn" onClick={p.rechazar} disabled={p.ocupado} style={{ width: '100%', padding: '9px 12px', borderRadius: 12, border: '1px solid #E2E8F0', background: '#fff', color: '#64748B', fontFamily: FONT, fontWeight: 700, fontSize: 12, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                <X size={13} /> No, gracias
              </button>
            )}
          </div>
        )}

        {puedeOfrecer ? (
          <>
            {p.pendiente && <div style={{ fontSize: 10.5, color: '#94A3B8', textAlign: 'center' }}>o seguí regateando · {rondasRestantes === 1 ? 'última ronda' : `te quedan ${rondasRestantes} rondas`}</div>}
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {[18000, 20000].map(v => (
                <button key={v} type="button" className="rg-chip" onClick={() => p.ofrecer(v)} style={{ padding: '6px 11px', borderRadius: 999, border: '1px solid #E2E8F0', background: '#F8FAFC', fontFamily: FONT_MONO, fontWeight: 700, fontSize: 12, color: '#0F172A' }}>{ARS(v)}</button>
              ))}
              <button type="button" className="rg-chip" onClick={p.preguntarMinimo} style={{ padding: '6px 11px', borderRadius: 999, border: '1px solid #E2E8F0', background: '#F8FAFC', fontFamily: FONT, fontWeight: 700, fontSize: 12, color: '#334155' }}>¿Cuánto es lo mínimo?</button>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <input type="range" className="rg-range" min={OFERTA_MIN} max={PRODUCTO.lista} step={500} value={p.oferta} onChange={e => p.setOferta(Number(e.target.value))} aria-label="Tu oferta" style={{ flex: 1 }} />
              <span key={p.oferta} className="rg-anim" style={{ fontFamily: FONT_MONO, fontWeight: 800, fontSize: 15, minWidth: 66, textAlign: 'right', animation: 'rg-bump .2s ease' }}>{ARS(p.oferta)}</span>
            </div>
            <button type="button" className="pr-btn" onClick={() => p.ofrecer(p.oferta)} style={{ width: '100%', padding: '11px 12px', borderRadius: 12, border: 'none', background: `linear-gradient(135deg, ${ACENTO}, ${ACENTO_OSCURO})`, color: '#fff', fontFamily: FONT, fontWeight: 800, fontSize: 13.5, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, boxShadow: `0 8px 20px ${ACENTO}55` }}>
              <MessageSquare size={15} /> Ofrecer {ARS(p.oferta)}
            </button>
          </>
        ) : p.ocupado ? (
          <div style={{ fontSize: 11.5, color: '#94A3B8', textAlign: 'center', padding: '4px 0' }}>Orbi está pensando…</div>
        ) : p.terminado && !p.pendiente ? (
          <div style={{ fontSize: 11.5, color: p.rechazado ? '#94A3B8' : ACENTO_OSCURO, fontWeight: p.rechazado ? 500 : 700, textAlign: 'center', padding: '4px 0', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
            {p.rechazado ? 'Conversación cerrada. Reiniciá la demo para probar otra vez.' : <><Ticket size={13} style={{ animation: 'pr-pulse 1s ease-in-out infinite' }} /> Armando tu cupón…</>}
          </div>
        ) : null}
      </div>
    </div>
  )
}

function Burbuja({ msg }: { msg: Msg }) {
  const orbi = msg.de === 'orbi'
  return (
    <div className="rg-anim" style={{ display: 'flex', alignItems: 'flex-end', gap: 6, justifyContent: orbi ? 'flex-start' : 'flex-end', animation: 'rg-pop .3s cubic-bezier(.2,.8,.2,1) both' }}>
      {orbi && <OrbiAvatar size={22} />}
      <div style={{ maxWidth: '82%', padding: '9px 12px', fontSize: 12.5, lineHeight: 1.45, borderRadius: orbi ? '14px 14px 14px 4px' : '14px 14px 4px 14px', background: orbi ? '#fff' : `linear-gradient(135deg, ${C.primary}, #2563EB)`, color: orbi ? '#0F172A' : '#fff', border: orbi ? '1px solid #E2E8F0' : 'none', boxShadow: orbi ? '0 2px 6px rgba(15,23,42,.05)' : '0 6px 16px rgba(59,130,246,.3)' }}>
        {msg.texto}
        {!orbi && msg.monto != null && (
          <div style={{ marginTop: 5, display: 'inline-flex', alignItems: 'center', gap: 5, background: 'rgba(255,255,255,.18)', borderRadius: 8, padding: '3px 8px', fontFamily: FONT_MONO, fontWeight: 800, fontSize: 12 }}><Tag size={11} /> {ARS(msg.monto)}</div>
        )}
      </div>
    </div>
  )
}

function mmss(s: number) {
  const m = Math.floor(s / 60)
  const r = s % 60
  return `${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`
}

function Cupon(p: { acuerdo: Acuerdo; segundos: number; vencido: boolean; irAPagar: () => void; reiniciar: () => void }) {
  const a = p.acuerdo
  const ahorro = (a.conRemera ? PRODUCTO.lista + REMERA.lista : PRODUCTO.lista) - a.precio
  const urgente = p.segundos < 60
  return (
    <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12, flex: 1 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <OrbiAvatar size={26} />
        <div style={{ fontSize: 12.5, color: '#334155', lineHeight: 1.4 }}>{p.vencido ? 'Uh, se venció el cupón. Si querés lo charlamos de nuevo.' : 'Listo, acá está tu cupón. Es único y dura 15 minutos.'}</div>
      </div>

      <div className="rg-anim" style={{ position: 'relative', borderRadius: 18, overflow: 'hidden', color: '#fff', background: p.vencido ? 'linear-gradient(135deg, #64748B, #475569)' : `linear-gradient(135deg, ${ACENTO} 0%, ${C.orbi} 100%)`, boxShadow: p.vencido ? 'none' : `0 18px 40px ${C.orbi}55`, animation: 'rg-ticket .7s cubic-bezier(.2,.8,.2,1) both', transition: 'background .5s' }}>
        <div style={{ position: 'absolute', left: -12, top: '58%', width: 24, height: 24, borderRadius: 99, background: '#F8FAFC' }} />
        <div style={{ position: 'absolute', right: -12, top: '58%', width: 24, height: 24, borderRadius: 99, background: '#F8FAFC' }} />
        <div style={{ padding: '16px 18px 12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 10.5, fontWeight: 800, letterSpacing: '.1em', textTransform: 'uppercase', opacity: .9 }}><Ticket size={12} /> Cupón negociado</span>
            <span style={{ fontSize: 10.5, fontWeight: 700, background: 'rgba(255,255,255,.2)', borderRadius: 999, padding: '2px 8px' }}>1 uso</span>
          </div>
          <div style={{ fontFamily: FONT_MONO, fontWeight: 800, fontSize: 26, letterSpacing: '.06em', marginTop: 8 }}>{a.codigo}</div>
          <div style={{ fontSize: 12, opacity: .92, marginTop: 2 }}>{a.conRemera ? `${PRODUCTO.nombre} + ${REMERA.nombre}` : PRODUCTO.nombre}{a.envioGratis ? ' · envío gratis' : ''}</div>
        </div>
        <div style={{ borderTop: '2px dashed rgba(255,255,255,.4)', padding: '12px 18px 16px', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 10.5, opacity: .85 }}>Precio acordado</div>
            <div style={{ fontFamily: FONT_MONO, fontWeight: 800, fontSize: 24, letterSpacing: '-0.02em' }}>{ARS(a.precio)}</div>
            <div style={{ fontSize: 10.5, opacity: .85 }}>Ahorrás {ARS(ahorro)}</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 10.5, opacity: .85 }}>{p.vencido ? 'Venció' : 'Vence en'}</div>
            <div key={urgente ? 'u' : 'n'} style={{ fontFamily: FONT_MONO, fontWeight: 800, fontSize: 22, animation: urgente && !p.vencido ? 'pr-blink 1s step-end infinite' : undefined }}><Clock size={14} style={{ verticalAlign: '-2px', marginRight: 4 }} />{mmss(p.segundos)}</div>
          </div>
        </div>
      </div>

      <div style={{ marginTop: 'auto', display: 'grid', gap: 8 }}>
        {p.vencido ? (
          <Boton variante="fantasma" onClick={p.reiniciar} style={{ color: '#475569', borderColor: '#CBD5E1', width: '100%' }}><RotateCcw size={14} /> Volver a negociar</Boton>
        ) : (
          <button type="button" className="pr-btn" onClick={p.irAPagar} style={{ width: '100%', padding: '13px 14px', borderRadius: 14, border: 'none', background: '#0F172A', color: '#fff', fontFamily: FONT, fontWeight: 800, fontSize: 14, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            Ir a pagar <ArrowRight size={16} />
          </button>
        )}
        <div style={{ textAlign: 'center', fontSize: 10.5, color: '#94A3B8' }}>El cupón ya está aplicado en tu carrito.</div>
      </div>
    </div>
  )
}

function Renglon({ l, v, fuerte, color }: { l: ReactNode; v: ReactNode; fuerte?: boolean; color?: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: fuerte ? 14 : 12.5, fontWeight: fuerte ? 800 : 500, color: color ?? (fuerte ? '#0F172A' : '#334155') }}>
      <span>{l}</span><span style={{ fontFamily: FONT_MONO, fontWeight: fuerte ? 800 : 600 }}>{v}</span>
    </div>
  )
}

function Checkout(p: { acuerdo: Acuerdo; segundos: number; pagado: boolean; pagar: () => void }) {
  const a = p.acuerdo
  const subtotal = a.conRemera ? PRODUCTO.lista + REMERA.lista : PRODUCTO.lista
  const descuento = subtotal - a.precio
  const costoEnvio = a.envioGratis ? 0 : ENVIO
  const total = a.precio + costoEnvio
  return (
    <div className="rg-anim" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12, flex: 1, animation: 'rg-slide .4s cubic-bezier(.2,.8,.2,1) both' }}>
      <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: 17 }}>{p.pagado ? 'Pedido confirmado' : 'Finalizar compra'}</div>

      {p.pagado ? (
        <div style={{ display: 'grid', placeItems: 'center', gap: 8, padding: '18px 0' }}>
          <span className="rg-anim" style={{ width: 64, height: 64, borderRadius: 99, background: 'linear-gradient(135deg, #10B981, #059669)', display: 'grid', placeItems: 'center', boxShadow: '0 14px 34px rgba(16,185,129,.35)', animation: 'rg-check .5s cubic-bezier(.2,.8,.2,1) both' }}><Check size={32} color="#fff" strokeWidth={3} /></span>
          <div style={{ fontWeight: 800, fontSize: 15 }}>Pedido #1042</div>
          <div style={{ fontSize: 12, color: '#64748B', textAlign: 'center', lineHeight: 1.5 }}>Pagaste {ARS(total)} con Mercado Pago.<br />Cupón {a.codigo} usado.</div>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 8, background: '#fff', border: '1px solid #E2E8F0', borderRadius: 14, padding: 12 }}>
          <Renglon l={PRODUCTO.nombre} v={ARS(PRODUCTO.lista)} />
          {a.conRemera && <Renglon l={REMERA.nombre} v={ARS(REMERA.lista)} />}
          <Renglon l={<span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: ACENTO_OSCURO, fontWeight: 700 }}><Ticket size={12} /> Cupón {a.codigo}</span>} v={`−${ARS(descuento)}`} color={ACENTO_OSCURO} />
          <Renglon l={<span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><Truck size={12} /> Envío a domicilio</span>} v={a.envioGratis ? 'Gratis' : ARS(ENVIO)} color={a.envioGratis ? '#059669' : undefined} />
          <div style={{ borderTop: '1px dashed #E2E8F0', paddingTop: 8 }}>
            <Renglon l="Total" v={ARS(total)} fuerte />
          </div>
        </div>
      )}

      {!p.pagado && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5, color: '#64748B' }}>
          <Clock size={12} /> El precio negociado vence en <b style={{ fontFamily: FONT_MONO, color: '#0F172A' }}>{mmss(p.segundos)}</b>
        </div>
      )}

      <div style={{ marginTop: 'auto' }}>
        {p.pagado ? (
          <div style={{ textAlign: 'center', fontSize: 12, color: '#059669', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}><CheckCircle2 size={14} /> Te llega el comprobante por WhatsApp</div>
        ) : (
          <button type="button" className="pr-btn" onClick={p.pagar} style={{ width: '100%', padding: '13px 14px', borderRadius: 14, border: 'none', background: MP, color: '#fff', fontFamily: FONT, fontWeight: 800, fontSize: 14, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, boxShadow: '0 10px 24px rgba(0,158,227,.35)' }}>
            Pagar {ARS(total)} con Mercado Pago
          </button>
        )}
      </div>
    </div>
  )
}

// ─── Panel del dueño: reglas ─────────────────────────────────────────────────

function Toggle({ on, onChange, label, detalle, icono, disabled }: { on: boolean; onChange: (v: boolean) => void; label: string; detalle: string; icono: ReactNode; disabled?: boolean }) {
  return (
    <button type="button" onClick={() => onChange(!on)} disabled={disabled} style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', textAlign: 'left', padding: '10px 12px', borderRadius: 12, border: `1px solid ${on ? '#FBCFE8' : '#E2E8F0'}`, background: on ? '#FDF2F8' : '#fff', cursor: disabled ? 'not-allowed' : 'pointer', fontFamily: FONT, transition: 'background .2s, border-color .2s', opacity: disabled ? .55 : 1 }}>
      <span style={{ width: 30, height: 30, borderRadius: 9, display: 'grid', placeItems: 'center', background: on ? ACENTO : '#F1F5F9', color: on ? '#fff' : '#64748B', flexShrink: 0, transition: 'background .2s' }}>{icono}</span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: 'block', fontSize: 12.5, fontWeight: 700, color: '#0F172A' }}>{label}</span>
        <span style={{ display: 'block', fontSize: 11, color: '#64748B', lineHeight: 1.35 }}>{detalle}</span>
      </span>
      <span aria-hidden style={{ width: 36, height: 20, borderRadius: 999, background: on ? ACENTO : '#CBD5E1', position: 'relative', flexShrink: 0, transition: 'background .2s' }}>
        <span style={{ position: 'absolute', top: 2, left: on ? 18 : 2, width: 16, height: 16, borderRadius: 99, background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,.3)', transition: 'left .2s cubic-bezier(.2,.8,.2,1)' }} />
      </span>
    </button>
  )
}

function PanelReglas(p: {
  margenMin: number; setMargenMin: (n: number) => void
  cedeViejo: boolean; setCedeViejo: (v: boolean) => void
  bonusViejo: number; setBonusViejo: (n: number) => void
  combos: boolean; setCombos: (v: boolean) => void
  envio: boolean; setEnvio: (v: boolean) => void
  soloMarcados: boolean; setSoloMarcados: (v: boolean) => void
  piso: number
}) {
  return (
    <Pantalla tipo="panel">
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderBottom: '1px solid #E2E8F0', background: '#fff', fontSize: 12.5 }}>
        <span style={{ width: 22, height: 22, borderRadius: 7, background: `linear-gradient(135deg, ${C.primary}, ${C.orbi})`, marginRight: 6, display: 'grid', placeItems: 'center' }}>
          <span style={{ width: 8, height: 8, borderRadius: 99, background: '#fff' }} />
        </span>
        <span style={{ color: '#64748B', fontWeight: 600 }}>Descuentos</span>
        <span style={{ color: '#CBD5E1' }}>→</span>
        <span style={{ fontWeight: 800, color: '#0F172A', display: 'inline-flex', alignItems: 'center', gap: 5 }}><Handshake size={13} color={ACENTO} /> Regateo con Orbi</span>
        <span style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11.5, color: '#059669', fontWeight: 700 }}>
          <span style={{ width: 7, height: 7, borderRadius: 99, background: '#10B981', boxShadow: '0 0 0 3px rgba(16,185,129,.2)' }} /> Activo en la tienda
        </span>
      </div>

      <div style={{ padding: 14, background: '#F8FAFC', display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: 12 }}>
        {/* Columna 1: márgenes */}
        <div style={{ display: 'grid', gap: 10, alignContent: 'start' }}>
          <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 12, padding: '10px 12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <span style={{ fontSize: 12.5, fontWeight: 700, color: '#0F172A', display: 'inline-flex', alignItems: 'center', gap: 5 }}><BadgePercent size={13} color={ACENTO} /> Margen mínimo</span>
              <span key={p.margenMin} className="rg-anim" style={{ fontFamily: FONT_MONO, fontWeight: 800, fontSize: 18, color: ACENTO_OSCURO, animation: 'rg-bump .25s ease' }}>{p.margenMin}%</span>
            </div>
            <div style={{ fontSize: 11, color: '#64748B', marginBottom: 4 }}>Sobre el costo. Orbi nunca cierra por debajo.</div>
            <input type="range" className="rg-range" min={10} max={50} step={1} value={p.margenMin} onChange={e => p.setMargenMin(Number(e.target.value))} aria-label="Margen mínimo" />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10.5, color: '#94A3B8', fontFamily: FONT_MONO }}><span>10%</span><span>50%</span></div>
          </div>

          <div style={{ display: 'grid', gap: 6 }}>
            <Toggle on={p.cedeViejo} onChange={p.setCedeViejo} label="Cede más si +30 días sin rotar" detalle="Bonus de flexibilidad para lo que no se mueve." icono={<Clock size={15} />} />
            <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 12, padding: '8px 12px', opacity: p.cedeViejo ? 1 : .45, transition: 'opacity .2s' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <span style={{ fontSize: 11.5, fontWeight: 700, color: '#334155' }}>Bonus extra</span>
                <span key={p.bonusViejo} className="rg-anim" style={{ fontFamily: FONT_MONO, fontWeight: 800, fontSize: 14, color: ACENTO_OSCURO, animation: 'rg-bump .25s ease' }}>−{p.bonusViejo}%</span>
              </div>
              <input type="range" className="rg-range" min={0} max={15} step={1} value={p.bonusViejo} disabled={!p.cedeViejo} onChange={e => p.setBonusViejo(Number(e.target.value))} aria-label="Bonus por producto viejo" />
            </div>
          </div>
        </div>

        {/* Columna 2: permisos */}
        <div style={{ display: 'grid', gap: 6, alignContent: 'start' }}>
          <Toggle on={p.combos} onChange={p.setCombos} label="Puede armar combos" detalle="Ofrece un segundo producto con descuento." icono={<Tag size={15} />} />
          <Toggle on={p.envio} onChange={p.setEnvio} label="Puede ofrecer envío gratis" detalle={`Como concesión en vez de bajar precio (${ARS(ENVIO)}).`} icono={<Truck size={15} />} />
          <Toggle on={p.soloMarcados} onChange={p.setSoloMarcados} label="Solo en productos marcados" detalle={p.soloMarcados ? '1 producto marcado: Campera de jean oversize.' : 'Cuidado: todo el catálogo acepta ofertas.'} icono={<Settings2 size={15} />} />
          <div style={{ marginTop: 2, padding: '10px 12px', borderRadius: 12, background: '#0F172A', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
            <div>
              <div style={{ fontSize: 10.5, color: '#94A3B8', fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase' }}>Piso para esta campera</div>
              <div style={{ fontSize: 10.5, color: '#94A3B8' }}>lista {ARS(PRODUCTO.lista)} · costo {ARS(PRODUCTO.costo)}</div>
            </div>
            <span key={p.piso} className="rg-anim" style={{ fontFamily: FONT_MONO, fontWeight: 800, fontSize: 20, color: '#F9A8D4', animation: 'rg-bump .3s ease' }}>{ARS(p.piso)}</span>
          </div>
        </div>
      </div>
    </Pantalla>
  )
}

// ─── Consola "Qué está pensando Orbi" ────────────────────────────────────────

const TONO: Record<Linea['tono'], string> = {
  ctx: C.subtle, info: C.orbiLight, ok: C.success, warn: C.warning, acento: ACENTO, regla: '#C4B5FD',
}

function ConsolaOrbi(p: { info: ReturnType<typeof calcularPiso>; reglas: Reglas; hud: Linea[]; fase: Fase; ronda: number }) {
  const { info, reglas } = p
  const enVivo = p.fase === 'chat'
  const ctx: { t: string; tono: Linea['tono']; clave?: boolean }[] = [
    { t: `producto  ${PRODUCTO.nombre} · stock ${PRODUCTO.stock} · ${PRODUCTO.dias} días sin rotar`, tono: 'ctx' },
    { t: `costo     ${ARS(PRODUCTO.costo)} · lista ${ARS(PRODUCTO.lista)}`, tono: 'ctx' },
    { t: `margen mínimo ${reglas.margenMin}%  →  piso ${ARS(info.pisoMargen)}`, tono: 'info' },
    reglas.cedeViejo
      ? { t: `bonus ${PRODUCTO.dias} días sin rotar −${info.bonus}%  →  piso ${ARS(info.pisoBonus)}`, tono: 'info' }
      : { t: `bonus por días sin rotar: apagado por el dueño`, tono: 'ctx' },
    reglas.cliente === 'recurrente'
      ? { t: `cliente recurrente (3 compras)  →  +${info.flex}% flexibilidad`, tono: 'info' }
      : { t: `cliente nuevo  →  sin flexibilidad extra`, tono: 'ctx' },
    { t: `PISO FINAL ${ARS(info.piso)}  ·  combos ${reglas.combos ? 'sí' : 'no'}  ·  envío gratis ${reglas.envio ? 'sí' : 'no'}`, tono: 'regla', clave: true },
  ]
  return (
    <Tarjeta style={{ position: 'relative', overflow: 'hidden', padding: 16, borderColor: `${C.orbi}44`, background: 'linear-gradient(180deg, rgba(30,27,75,.55), rgba(15,23,42,.8))' }}>
      {enVivo && <div aria-hidden style={{ position: 'absolute', left: 0, right: 0, height: 60, background: `linear-gradient(180deg, transparent, ${C.orbi}14, transparent)`, animation: 'rg-scan 3.2s linear infinite', pointerEvents: 'none' }} />}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <OrbiAvatar size={24} />
          <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: 14 }}>Qué está pensando Orbi</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {p.ronda > 0 && <Chip color={ACENTO}>ronda {Math.min(p.ronda, MAX_RONDAS)}/{MAX_RONDAS}</Chip>}
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11, fontFamily: FONT_MONO, color: enVivo ? C.success : C.subtle }}>
            <span style={{ width: 7, height: 7, borderRadius: 99, background: enVivo ? C.success : C.subtle, animation: enVivo ? 'pr-pulse 1.4s ease-in-out infinite' : undefined }} /> {enVivo ? 'negociando' : p.fase === 'ficha' ? 'en espera' : 'cerrado'}
          </span>
        </div>
      </div>

      <div style={{ fontFamily: FONT_MONO, fontSize: 11.5, lineHeight: 1.7, display: 'grid', gap: 1 }}>
        {ctx.map((l, i) => (
          <div key={i} style={{ color: TONO[l.tono], fontWeight: l.clave ? 800 : 500, whiteSpace: 'pre-wrap', padding: l.clave ? '4px 8px' : 0, borderRadius: 8, background: l.clave ? `${C.orbi}1F` : undefined, border: l.clave ? `1px solid ${C.orbi}44` : undefined, marginTop: l.clave ? 4 : 0, transition: 'color .3s' }}>
            <span style={{ color: C.subtle, marginRight: 8 }}>{l.clave ? '=' : '·'}</span>{l.t}
          </div>
        ))}
        <div style={{ height: 1, background: C.border, margin: '8px 0 6px' }} />
        {p.hud.length === 0 ? (
          <div style={{ color: C.subtle }}><span style={{ marginRight: 8 }}>›</span>esperando que el cliente abra una oferta<span style={{ animation: 'pr-blink 1s step-end infinite' }}>_</span></div>
        ) : (
          <div className="pr-scroll" style={{ maxHeight: 190, overflowY: 'auto', display: 'grid', gap: 1 }}>
            {p.hud.map(l => (
              <div key={l.id} className="rg-hud-line" style={{ color: TONO[l.tono], fontWeight: l.tono === 'regla' || l.tono === 'ok' ? 700 : 500, whiteSpace: 'pre-wrap' }}>
                <span style={{ color: C.subtle, marginRight: 8 }}>›</span>{l.texto}
              </div>
            ))}
            {enVivo && <div style={{ color: C.subtle }}><span style={{ marginRight: 8 }}>›</span><span style={{ animation: 'pr-blink 1s step-end infinite' }}>_</span></div>}
          </div>
        )}
      </div>

      <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: 10, background: 'rgba(2,6,23,.5)', border: `1px solid ${C.border}`, fontSize: 11.5, color: C.muted, lineHeight: 1.4 }}>
        <Lock size={13} color="#C4B5FD" style={{ flexShrink: 0 }} />
        <span>El modelo escribe el mensaje y elige la táctica. <b style={{ color: '#C4B5FD' }}>El precio final lo valida una regla</b> (precio ≥ piso) antes de emitir el cupón: nunca sale un número que el modelo inventó.</span>
      </div>
    </Tarjeta>
  )
}

// ─── Negociaciones de hoy ────────────────────────────────────────────────────

const ESTADO: Record<EstadoFila, { t: string; color: string }> = {
  pagada: { t: 'Pagada', color: C.success },
  cupon: { t: 'Cupón activo', color: ACENTO },
  'sin acuerdo': { t: 'Sin acuerdo', color: C.subtle },
  vencida: { t: 'Cupón vencido', color: C.warning },
}

function NegociacionesHoy({ filas }: { filas: Fila[] }) {
  const cerradas = filas.filter(f => f.cierre != null)
  const cellStyle: CSSProperties = { padding: '9px 12px', fontSize: 12.5, whiteSpace: 'nowrap' }
  const th: CSSProperties = { ...cellStyle, fontSize: 10.5, fontWeight: 800, letterSpacing: '.08em', textTransform: 'uppercase', color: C.subtle, textAlign: 'left' }
  return (
    <Tarjeta style={{ marginTop: 20, padding: '14px 16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', marginBottom: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Handshake size={16} color={ACENTO} />
          <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: 14 }}>Negociaciones de hoy</div>
          <span style={{ fontSize: 12, color: C.muted }}>· {filas.length} conversaciones · {cerradas.length} cerradas</span>
        </div>
        <span style={{ fontSize: 11.5, color: C.muted }}>Margen promedio de lo cerrado: <b style={{ color: C.success, fontFamily: FONT_MONO }}>{cerradas.length ? Math.round(cerradas.reduce((a, f) => a + margenSobreCosto(f.cierre as number, costoDe(f)), 0) / cerradas.length) : 0}%</b></span>
      </div>
      <div style={{ overflowX: 'auto' }} className="pr-scroll">
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: `1px solid ${C.border}` }}>
              <th style={th}>Producto</th><th style={th}>Oferta inicial</th><th style={th}>Cierre</th><th style={th}>Margen</th><th style={th}>Estado</th>
            </tr>
          </thead>
          <tbody>
            {filas.map(f => {
              const e = ESTADO[f.estado]
              const margen = f.cierre != null ? margenSobreCosto(f.cierre, costoDe(f)) : null
              return (
                <tr key={f.id} className={f.nueva ? 'rg-anim' : undefined} style={{ borderBottom: `1px solid ${C.border}`, animation: f.nueva ? 'rg-row 2.4s ease both, pr-fade-up .5s both' : undefined }}>
                  <td style={{ ...cellStyle, fontWeight: 700, color: C.text }}>{f.producto}{f.nueva && <Chip color={ACENTO} style={{ marginLeft: 8, padding: '1px 7px', fontSize: 10 }}>nueva</Chip>}</td>
                  <td style={{ ...cellStyle, fontFamily: FONT_MONO, color: C.body }}>{ARS(f.inicial)}</td>
                  <td style={{ ...cellStyle, fontFamily: FONT_MONO, fontWeight: 700, color: f.cierre != null ? C.text : C.subtle }}>{f.cierre != null ? ARS(f.cierre) : '—'}</td>
                  <td style={{ ...cellStyle, fontFamily: FONT_MONO, color: margen == null ? C.subtle : margen >= 25 ? C.success : C.warning }}>{margen == null ? '—' : `${margen}%`}</td>
                  <td style={cellStyle}><Chip color={e.color}>{f.estado === 'pagada' && <Check size={11} />}{e.t}</Chip></td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </Tarjeta>
  )
}

/** Costo estimado de cada fila del historial (las de ejemplo usan un 55% del cierre). */
function costoDe(f: Fila): number {
  if (f.producto.startsWith(PRODUCTO.nombre)) return f.producto.includes('remera') ? PRODUCTO.costo + REMERA.costo : PRODUCTO.costo
  return Math.round((f.cierre ?? f.inicial) * 0.72)
}
