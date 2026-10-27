// Ganancias del equipo: cuánto facturó cada uno, cuánto le corresponde según
// cómo cobra (comisión, sueldo, las dos cosas o alquiler) y cuánto
// queda para el negocio. Arriba, el período en números y cómo se reparte lo
// facturado; abajo, una fila por persona con lo que está pendiente de pago.
//
// Tocar una fila abre su liquidación: la cuenta paso a paso, los turnos que la
// componen y el botón para registrar el pago. Lo pagado se lleva por fecha
// ("pagado hasta el domingo 20"), así el mismo pago se ve bien en la semana y
// en el mes.
//
// Quien entra con un rol que ve "solo las suyas" llega a esta misma pantalla
// con lo suyo a la vista: su cuenta, lo que tiene pendiente de cobro y los
// turnos que atendió. Lo que queda para el negocio y lo de los demás no se ve.
import { useState } from 'react'
import { Building2, CalendarCheck, Check, ChevronRight, Clock3, HandCoins, MessageCircle, Settings2, Users, Wallet } from 'lucide-react'
import { Encabezado, Sigla, Vacio } from '@/design-system/reservas/piezas'
import { horaTxt, type Cliente, type RubroTurnos } from '@/modules/turnos/datos'
import { Segmentado } from './configuracion/ui'
import { Modal, DatoFila, Indicador } from './piezasPanel'
import { CamposPago } from './PagoPersona'
import { fechaCorta, fechaLarga, type MensajeWA, type TurnoAgenda } from '../datos/agenda'
import {
  CADA_TXT, PERIODO_LABEL, RANGO, aCobrar, aPagar, entreTxt, facturadoEntre, formaCorta, liquidarEntre, lugarAlquiler, pagadoHastaInicial, pagoTxt, periodoTxt, plata,
  type Liquidacion, type Pago, type Periodo, type Persona, type Rol,
} from '../datos/equipo'

// La tabla se acomoda al ancho que le toca (container query): con menos de
// ~1000 px cada persona es una tarjeta con sus números en una grilla.
const CSS = `
  .tu-gan-barra { display: flex; height: 10px; border-radius: 999px; overflow: hidden; background: var(--color-surface-alt); }
  .tu-gan-barra > span { min-width: 3px; }
  .tu-gan-barra > span + span { box-shadow: -2px 0 0 var(--color-bg); }
  .tu-gan-leyenda { display: flex; flex-wrap: wrap; gap: 8px 18px; margin-top: 14px; font-size: 12.5px; color: var(--color-body); }
  .tu-gan-leyenda > span { display: inline-flex; align-items: center; gap: 7px; }
  .tu-gan-leyenda i { width: 9px; height: 9px; border-radius: 3px; flex-shrink: 0; }
  .tu-gan-tabla { container: tu-gan-tabla / inline-size; overflow: hidden; }
  .tu-gan-head, .tu-gan-fila { grid-template-columns: minmax(0, 1.5fr) 132px 62px 112px 126px 126px 150px 18px; gap: 12px; }
  .tu-gan-head { display: grid; }
  .tu-gan-fila { display: grid; align-items: center; font-size: 13.5px; }
  .tu-gan-head > .tu-gan-num, .tu-gan-fila > .tu-gan-num { text-align: right; }
  .tu-gan-quien { display: flex; align-items: center; gap: 12px; min-width: 0; }
  .tu-gan-quien > span { min-width: 0; }
  .tu-gan-quien b { display: block; font-size: 14px; font-weight: 600; color: var(--color-text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .tu-gan-quien small { display: block; font-size: 12.5px; color: var(--color-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .tu-gan-flecha { color: var(--color-subtle); }
  .tu-gan-rotulo { display: none; }
  .tu-gan-nums { display: none; }
  .tu-gan-tiles { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 8px; margin-bottom: 16px; }
  .tu-gan-tile { padding: 11px 12px; border-radius: var(--rv-r-sm); background: var(--color-surface); border: 1px solid var(--color-border); min-width: 0; }
  .tu-gan-tile > small { display: block; font-size: 11px; color: var(--color-muted); margin-bottom: 3px; }
  .tu-gan-tile > b { display: block; font-family: var(--rv-mono); font-size: 15px; font-weight: 600; color: var(--color-text); font-variant-numeric: tabular-nums; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .tu-gan-renglon { display: grid; grid-template-columns: 92px minmax(0, 1fr) 92px 92px; gap: 10px; align-items: center; padding: 9px 0; border-top: 1px solid var(--color-border); font-size: 13px; }
  .tu-gan-renglon:first-child { border-top: none; }
  .tu-gan-renglon > span:nth-child(n+3) { text-align: right; }
  .tu-gan-mio { display: grid; grid-template-columns: minmax(0, 5fr) minmax(0, 6fr); gap: 16px; align-items: start; }
  .tu-gan-mio--solo { grid-template-columns: minmax(0, 640px); }
  @container tu-gan-tabla (max-width: 1000px) {
    .tu-gan-head { display: none; }
    .tu-gan-fila { grid-template-columns: minmax(0, 1fr) auto 18px; row-gap: 10px; }
    .tu-gan-fila > .tu-gan-forma { display: none; }
    .tu-gan-fila > .tu-gan-estado { grid-column: 2; grid-row: 1; justify-self: end; }
    .tu-gan-fila > .tu-gan-flecha { grid-column: 3; grid-row: 1; }
    .tu-gan-fila > .tu-gan-num { display: none; }
    .tu-gan-fila > .tu-gan-nums { display: grid; grid-column: 1 / -1; grid-row: 2; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px; }
    .tu-gan-rotulo { display: block; font-size: 10.5px; color: var(--color-muted); margin-bottom: 2px; }
  }
  @container tu-gan-tabla (max-width: 520px) { .tu-gan-fila > .tu-gan-nums { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
  @media (max-width: 1100px) { .tu-gan-mio { grid-template-columns: minmax(0, 1fr); } }
  @media (max-width: 560px) {
    .tu-gan-tiles { grid-template-columns: minmax(0, 1fr); }
    .tu-gan-renglon { grid-template-columns: 76px minmax(0, 1fr) 78px; }
    .tu-gan-renglon > span:nth-child(3) { display: none; }
  }
`

interface Fila { p: Persona; rol?: Rol; l: Liquidacion; pend: Liquidacion; hastaPago: number }

interface Props {
  rubro: RubroTurnos
  /** A quiénes se ve: todo el equipo, o solo quien mira. */
  personas: Persona[]
  roles: Rol[]
  clientes: Cliente[]
  turnosDelDia: (dia: number) => TurnoAgenda[]
  /** Hasta qué día (contado desde hoy) se le pagó a cada uno. Sin dato, el último cierre según cada cuánto cobra. */
  pagadoHasta: Record<string, number>
  /** 'propio': quien mira ve solo lo suyo y no registra pagos. */
  alcance: 'todo' | 'propio'
  puedeLiquidar: boolean
  onPagar: (personaId: string, monto: number) => void
  onPago: (personaId: string, pago: Pago) => void
  onAvisar: (m: MensajeWA) => void
}

const PERIODOS: Periodo[] = ['hoy', 'semana', 'mes', 'anterior']

export default function Ganancias({ rubro, personas, roles, clientes, turnosDelDia, pagadoHasta, alcance, puedeLiquidar, onPagar, onPago, onAvisar }: Props) {
  const [periodo, setPeriodo] = useState<Periodo>('semana')
  const [abierta, setAbierta] = useState<string | null>(null)
  const [editando, setEditando] = useState<string | null>(null)
  const [desde, hasta] = RANGO[periodo]
  const propio = alcance === 'propio'

  const filas: Fila[] = personas.map(p => {
    const hastaPago = pagadoHasta[p.id] ?? pagadoHastaInicial(p)
    return {
      p, rol: roles.find(r => r.id === p.rolId), hastaPago,
      l: liquidarEntre(p, desde, hasta, turnosDelDia),
      pend: liquidarEntre(p, Math.max(desde, hastaPago + 1), hasta, turnosDelDia),
    }
  })
  const negocioTotal = facturadoEntre(desde, hasta, turnosDelDia)
  const equipo = filas.reduce((s, f) => s + f.l.paraLaPersona, 0)
  const negocio = negocioTotal.total - equipo
  const pendiente = filas.reduce((s, f) => s + aPagar(f.p, f.pend), 0)
  const conPendiente = filas.filter(f => aPagar(f.p, f.pend) > 0).length
  const yo = propio ? filas[0] ?? null : null

  // Cómo se reparte lo facturado: lo que se lleva cada uno y lo que queda en el negocio.
  const partes = [
    ...filas.filter(f => f.l.paraLaPersona > 0).map(f => ({ id: f.p.id, nombre: f.p.nombre.split(' ')[0], valor: f.l.paraLaPersona, color: f.p.color })),
    ...(negocio > 0 ? [{ id: 'negocio', nombre: 'El negocio', valor: negocio, color: 'var(--color-text)' }] : []),
  ]
  const suma = partes.reduce((s, x) => s + x.valor, 0)

  const fila = abierta ? filas.find(f => f.p.id === abierta) ?? null : null
  const aEditar = editando ? personas.find(p => p.id === editando) ?? null : null

  const avisar = (f: Fila) => {
    const pila = f.p.nombre.split(' ')[0]
    const monto = aPagar(f.p, f.pend)
    const cuanto = f.p.recursoId ? `${f.l.turnos} turno${f.l.turnos === 1 ? '' : 's'} atendido${f.l.turnos === 1 ? '' : 's'} (${plata(f.l.facturado)} facturados)` : ''
    onAvisar({
      titulo: `Avisarle a ${pila}`, para: f.p.nombre, telefono: f.p.telefono || undefined,
      texto: `¡Hola ${pila}! Te paso tu liquidación (${periodoTxt(periodo).toLowerCase()})${cuanto ? `: ${cuanto}` : ''}. Te corresponden ${plata(f.l.paraLaPersona)}${monto > 0 && monto !== f.l.paraLaPersona ? `, de los que quedan por pagarte ${plata(monto)}` : ''}. Cualquier duda, lo vemos.`,
    })
  }

  const selectorPeriodo = <Segmentado label="Período" valor={periodo} onChange={setPeriodo} opciones={PERIODOS.map(x => ({ id: x, label: PERIODO_LABEL[x] }))} />

  if (propio && !yo) {
    return (
      <div className="rv-pagina">
        <Encabezado rotulo={periodoTxt(periodo)} titulo="Mis ganancias" bajada="Lo que atendiste y lo que te corresponde cobrar, según lo que acordaste con el negocio." />
        <Vacio titulo="Todavía no hay nadie con este rol" texto="Cuando alguien del equipo lo tenga, acá va a ver sus turnos atendidos y lo que le corresponde cobrar." />
      </div>
    )
  }

  return (
    <div className="rv-pagina">
      <style>{CSS}</style>
      <Encabezado
        rotulo={periodoTxt(periodo)}
        titulo={propio ? 'Mis ganancias' : 'Ganancias'}
        bajada={propio ? 'Lo que atendiste y lo que te corresponde cobrar, según lo que acordaste con el negocio.' : 'Cuánto facturó cada uno, cuánto le corresponde según cómo cobra y cuánto queda para el negocio.'}
        acciones={selectorPeriodo}
      />

      <div className="rv-kpis" style={{ marginBottom: 16 }}>
        {yo ? (
          <>
            <Indicador label="Turnos atendidos" valor={yo.l.turnos} Icon={CalendarCheck} />
            <Indicador label="Facturaste" valor={plata(yo.l.facturado)} Icon={Wallet} />
            <Indicador label="Te corresponde" valor={plata(yo.l.paraLaPersona)} Icon={HandCoins} nota={pagoTxt(yo.p.pago, rubro)} />
            {yo.p.pago?.forma === 'alquiler'
              ? <Indicador label="Alquiler por pagar" valor={plata(aCobrar(yo.p, yo.pend))} Icon={Clock3} nota={aCobrar(yo.p, yo.pend) > 0 ? `lo pagás ${CADA_TXT[yo.p.pago.cada]}` : 'Estás al día'} />
              : <Indicador label="Pendiente de cobro" valor={plata(aPagar(yo.p, yo.pend))} Icon={Clock3} nota={aPagar(yo.p, yo.pend) > 0 ? `se te liquida ${yo.p.pago ? CADA_TXT[yo.p.pago.cada] : ''}` : 'Estás al día'} />}
          </>
        ) : (
          <>
            <Indicador label="Facturado" valor={plata(negocioTotal.total)} Icon={Wallet} nota={`${negocioTotal.turnos} turno${negocioTotal.turnos === 1 ? '' : 's'} atendido${negocioTotal.turnos === 1 ? '' : 's'}`} />
            <Indicador label="Para el equipo" valor={plata(equipo)} Icon={Users} nota="comisiones y sueldos" />
            <Indicador label="Queda para el negocio" valor={plata(negocio)} Icon={Building2} nota={negocioTotal.total > 0 ? `${Math.round((negocio / negocioTotal.total) * 100)}% de lo facturado` : undefined} />
            <Indicador label="Pendiente de pago" valor={plata(pendiente)} Icon={Clock3} nota={conPendiente ? `a ${conPendiente} persona${conPendiente === 1 ? '' : 's'}` : 'Estás al día'} />
          </>
        )}
      </div>

      {!propio && suma > 0 && (
        <section className="rv-card rv-card--pad" style={{ marginBottom: 16 }} aria-label="Cómo se reparte lo facturado">
          <div className="rv-entre" style={{ alignItems: 'baseline', marginBottom: 14 }}>
            <h2 className="rv-h2">Cómo se reparte</h2>
            <span className="rv-ayuda">{negocio < 0 ? 'En este período los sueldos superan lo facturado.' : 'Lo que se lleva cada uno y lo que queda en el negocio.'}</span>
          </div>
          <div className="tu-gan-barra" role="img" aria-label={partes.map(x => `${x.nombre}: ${plata(x.valor)}`).join(', ')}>
            {partes.map(x => <span key={x.id} title={`${x.nombre}: ${plata(x.valor)}`} style={{ width: `${(x.valor / suma) * 100}%`, background: x.color }} />)}
          </div>
          <div className="tu-gan-leyenda">
            {partes.map(x => <span key={x.id}><i aria-hidden style={{ background: x.color }} />{x.nombre} <b className="rv-num" style={{ color: 'var(--color-text)' }}>{plata(x.valor)}</b> <span style={{ color: 'var(--color-muted)' }}>{Math.round((x.valor / suma) * 100)}%</span></span>)}
          </div>
        </section>
      )}
      {yo ? (
        <div className={`tu-gan-mio${yo.p.recursoId ? '' : ' tu-gan-mio--solo'}`}>
          <section className="rv-card rv-card--pad" aria-label="Tu liquidación">
            <h2 className="rv-h2">Tu liquidación</h2>
            <p className="rv-ayuda" style={{ margin: '4px 0 14px' }}>{pagoTxt(yo.p.pago, rubro)}{yo.p.pago ? ` · ${yo.p.pago.forma === 'alquiler' ? 'lo pagás' : 'se te liquida'} ${CADA_TXT[yo.p.pago.cada]}` : ''}</p>
            <Cuenta fila={yo} rubro={rubro} propio />
            <EstadoPago fila={yo} propio />
          </section>
          {yo.p.recursoId && (
            <section className="rv-card rv-card--pad" aria-label="Lo que atendiste">
              <h2 className="rv-h2" style={{ marginBottom: 8 }}>Lo que atendiste</h2>
              {yo.l.renglones.length > 0
                ? <Renglones l={yo.l} pago={yo.p.pago} clientes={clientes} propio />
                : <p className="rv-ayuda" style={{ margin: 0, fontSize: 13.5 }}>En este período todavía no atendiste turnos. Cuando marques uno como atendido aparece acá, con lo que te toca.</p>}
            </section>
          )}
        </div>
      ) : (
        <div className="rv-card tu-gan-tabla">
          <div className="tu-fila-cab tu-gan-head" aria-hidden>
            <span>Persona</span><span>Cómo cobra</span>
            {['Turnos', 'Facturó', 'Le corresponde', 'Para el negocio'].map(k => <span key={k} className="tu-gan-num">{k}</span>)}
            <span>Pago</span><span />
          </div>
          <div className="tu-filas">
            {filas.map(f => {
              const debe = aPagar(f.p, f.pend)
              const cobra = aCobrar(f.p, f.pend)
              const estado = !f.p.pago ? <span className="rv-chip rv-chip--gris">No se liquida</span>
                : f.p.pago.forma === 'alquiler' ? (cobra > 0 ? <span className="rv-chip rv-chip--aviso">Te debe <span className="rv-num">{plata(cobra)}</span></span> : <span className="rv-chip rv-chip--ok"><Check size={12} /> Al día</span>)
                  : debe > 0 ? <span className="rv-chip rv-chip--aviso">Pendiente <span className="rv-num">{plata(debe)}</span></span> : <span className="rv-chip rv-chip--ok"><Check size={12} /> Pagado</span>
              const corresponde = f.p.pago ? plata(f.l.paraLaPersona) : '—'
              // Quien no atiende (recepción) va con una raya en los turnos.
              const numeros: [string, string][] = [
                ['Turnos', f.p.recursoId ? String(f.l.turnos) : '—'],
                ['Facturó', f.p.recursoId ? plata(f.l.facturado) : '—'],
                ['Le corresponde', corresponde],
                ['Para el negocio', plata(f.l.paraElNegocio)],
              ]
              const rojo = (k: string) => (k === 'Para el negocio' && f.l.paraElNegocio < 0 ? 'var(--chip-error-fg)' : undefined)
              return (
                <button key={f.p.id} type="button" onClick={() => setAbierta(f.p.id)} className="ds-hover tu-fila tu-gan-fila" aria-label={`Ver la liquidación de ${f.p.nombre}`}>
                  <span className="tu-gan-quien">
                    <Sigla nombre={f.p.nombre} color={f.p.color} size={36} />
                    <span><b>{f.p.nombre}</b><small>{f.rol?.nombre ?? 'Sin rol'}</small></span>
                  </span>
                  <span className="tu-gan-forma"><span className="rv-chip rv-chip--borde" style={{ height: 24, fontSize: 11.5 }}>{formaCorta(f.p.pago)}</span></span>
                  {numeros.map(([k, v]) => <span key={k} className="tu-gan-num rv-num" style={{ color: rojo(k) }}>{k === 'Le corresponde' ? <b style={{ color: 'var(--color-text)' }}>{v}</b> : v}</span>)}
                  <span className="tu-gan-estado">{estado}</span>
                  <ChevronRight size={16} className="tu-gan-flecha" aria-hidden />
                  {/* En pantallas angostas los números bajan a una grilla, cada uno con su rótulo. */}
                  <span className="tu-gan-nums">
                    {numeros.map(([k, v]) => <span key={k}><span className="tu-gan-rotulo">{k}</span><span className="rv-num" style={{ fontWeight: k === 'Le corresponde' ? 600 : 400, color: k === 'Le corresponde' ? 'var(--color-text)' : rojo(k) }}>{v}</span></span>)}
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {fila && (
        <DetalleLiquidacion
          fila={fila} rubro={rubro} periodo={periodo} clientes={clientes}
          propio={propio} puedeLiquidar={puedeLiquidar && !propio}
          onCerrar={() => setAbierta(null)}
          onPagar={() => onPagar(fila.p.id, aPagar(fila.p, fila.pend) || aCobrar(fila.p, fila.pend))}
          onEditarPago={() => setEditando(fila.p.id)}
          onAvisar={() => avisar(fila)}
        />
      )}
      {aEditar && <EditorPago key={aEditar.id} persona={aEditar} rubro={rubro} onCerrar={() => setEditando(null)} onGuardar={pago => { onPago(aEditar.id, pago); setEditando(null) }} />}
    </div>
  )
}

const A_LA_VISTA = 6

/** La liquidación de una persona: la cuenta, lo que está pendiente y los turnos que la componen. */
function DetalleLiquidacion({ fila, rubro, periodo, clientes, propio, puedeLiquidar, onCerrar, onPagar, onEditarPago, onAvisar }: {
  fila: Fila; rubro: RubroTurnos; periodo: Periodo; clientes: Cliente[]; propio: boolean; puedeLiquidar: boolean
  onCerrar: () => void; onPagar: () => void; onEditarPago: () => void; onAvisar: () => void
}) {
  const { p, rol, l, pend } = fila
  const pago = p.pago
  const debe = aPagar(p, pend)
  const cobra = aCobrar(p, pend)
  const alquila = pago?.forma === 'alquiler'
  const le = propio ? 'Te' : 'Le'

  return (
    <Modal
      ancho={640}
      rotulo={`Liquidación · ${PERIODO_LABEL[periodo]}`}
      titulo={p.nombre}
      bajada={<>{rol?.nombre ?? 'Sin rol'} · {pagoTxt(pago, rubro)}{pago ? ` · ${alquila ? 'paga' : 'se le liquida'} ${CADA_TXT[pago.cada]}` : ''}</>}
      icono={<Sigla nombre={p.nombre} color={p.color} size={40} />}
      onCerrar={onCerrar}
      pie={<>
        {puedeLiquidar && pago && <button type="button" onClick={onEditarPago} className="rv-btn rv-btn--fantasma rv-modal-izq"><Settings2 size={15} /> Cambiar cómo cobra</button>}
        {!propio && pago && <button type="button" onClick={onAvisar} className="rv-btn"><MessageCircle size={15} /> Avisarle</button>}
        {puedeLiquidar && pago
          ? <button type="button" onClick={onPagar} disabled={debe <= 0 && cobra <= 0} className="rv-btn rv-btn--primario"><Check size={16} /> {alquila ? (cobra > 0 ? `Registrar cobro · ${plata(cobra)}` : 'Alquiler al día') : debe > 0 ? `Marcar como pagado · ${plata(debe)}` : 'Ya está pagado'}</button>
          : <button type="button" onClick={onCerrar} className="rv-btn rv-btn--primario">Listo</button>}
      </>}
    >
      <div className="tu-gan-tiles">
        <div className="tu-gan-tile"><small>Turnos atendidos</small><b>{p.recursoId ? l.turnos : '—'}</b></div>
        <div className="tu-gan-tile"><small>Facturó</small><b>{p.recursoId ? plata(l.facturado) : '—'}</b></div>
        <div className="tu-gan-tile"><small>{le} corresponde</small><b>{pago ? plata(l.paraLaPersona) : '—'}</b></div>
      </div>

      <Cuenta fila={fila} rubro={rubro} propio={propio} />
      <EstadoPago fila={fila} propio={propio} />
      {l.renglones.length > 0 && <Renglones l={l} pago={pago} clientes={clientes} propio={propio} conTitulo />}
    </Modal>
  )
}

/** La cuenta de una liquidación, renglón por renglón: de dónde sale lo que le corresponde. */
function Cuenta({ fila: { p, l }, rubro, propio }: { fila: Fila; rubro: RubroTurnos; propio: boolean }) {
  const pago = p.pago
  const alquila = pago?.forma === 'alquiler'
  const dias = l.hasta - l.desde + 1
  const parte = `la parte de ${dias === 1 ? 'este día' : `estos ${dias} días`}`
  const lugar = lugarAlquiler(rubro)
  return (
    <div className="rv-card" style={{ padding: '4px 14px', background: 'var(--color-surface)', marginBottom: 16 }}>
      <DatoFila label="Período"><span>{entreTxt(l.desde, l.hasta)}</span></DatoFila>
      {!pago && <DatoFila label="Es el dueño">Lo que factura queda para el negocio</DatoFila>}
      {pago && (pago.forma === 'comision' || pago.forma === 'mixto') && <DatoFila label={`Comisión del ${pago.comision}% sobre ${plata(l.facturado)}`}><span className="rv-num">{plata(l.comision)}</span></DatoFila>}
      {pago && (pago.forma === 'sueldo' || pago.forma === 'mixto') && <DatoFila label={`Sueldo de ${plata(pago.sueldo)}: ${parte}`}><span className="rv-num">{plata(l.fijo)}</span></DatoFila>}
      {alquila && <DatoFila label={propio ? 'Lo que facturaste (te lo quedás)' : 'Lo que facturó (se lo queda)'}><span className="rv-num">{plata(l.facturado)}</span></DatoFila>}
      {alquila && pago && <DatoFila label={`Alquiler ${lugar.startsWith('el ') ? `del ${lugar.slice(3)}` : `de ${lugar}`} (${plata(pago.alquiler)} por mes): ${parte}`}><span className="rv-num">{plata(-l.alquiler)}</span></DatoFila>}
      {pago && <DatoFila label={`${propio ? 'Te' : 'Le'} corresponde`}><b className="rv-num" style={{ fontSize: 15 }}>{plata(l.paraLaPersona)}</b></DatoFila>}
      {!propio && <DatoFila label="Queda para el negocio"><span className="rv-num" style={{ color: l.paraElNegocio < 0 ? 'var(--chip-error-fg)' : undefined }}>{plata(l.paraElNegocio)}</span></DatoFila>}
    </div>
  )
}

/** Lo que falta pagar del período, o que ya está al día. */
function EstadoPago({ fila: { p, l, pend, hastaPago }, propio }: { fila: Fila; propio: boolean }) {
  const pago = p.pago
  if (!pago) return null
  const debe = aPagar(p, pend)
  const cobra = aCobrar(p, pend)
  const alquila = pago.forma === 'alquiler'
  const pila = p.nombre.split(' ')[0]
  if (debe > 0 || cobra > 0) {
    return (
      <div role="status" className="rv-nota rv-nota--aviso" style={{ marginBottom: 16 }}>
        <Clock3 size={15} aria-hidden />
        <span>
          {alquila ? <><b>{propio ? 'Debés' : `${pila} te debe`} {plata(cobra)}</b> de alquiler</> : <><b>Pendiente de {propio ? 'cobro' : 'pago'}: {plata(debe)}</b></>}
          {pend.desde > l.desde ? `, ${entreTxt(pend.desde, pend.hasta).toLowerCase()}. Lo anterior ya está ${alquila ? (propio ? 'pagado' : 'cobrado') : (propio ? 'cobrado' : 'pagado')}.` : `, ${entreTxt(pend.desde, pend.hasta).toLowerCase()}.`}
        </span>
      </div>
    )
  }
  return (
    <div role="status" className="rv-nota tu-nota--ok" style={{ marginBottom: 16 }}>
      <Check size={15} aria-hidden />
      <span><b>{alquila ? 'Alquiler al día.' : propio ? 'Estás al día.' : 'Está pagado.'}</b> {hastaPago >= l.hasta ? `Hasta el ${fechaLarga(Math.min(hastaPago, 0)).toLowerCase()} no queda nada pendiente.` : 'En este período no hay nada para liquidar.'}</span>
    </div>
  )
}

/** Los turnos atendidos que componen la liquidación, con lo que le toca de cada uno. */
function Renglones({ l, pago, clientes, propio, conTitulo }: { l: Liquidacion; pago: Pago | null; clientes: Cliente[]; propio: boolean; conTitulo?: boolean }) {
  const [todos, setTodos] = useState(false)
  const nombre = (id: string) => clientes.find(c => c.id === id)?.nombre ?? '—'
  const visibles = todos ? l.renglones : l.renglones.slice(0, A_LA_VISTA)
  return (
    <section aria-label="Turnos atendidos">
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10, marginBottom: 4 }}>
        <span className="rv-rotulo">{conTitulo ? 'Turnos atendidos' : `${l.renglones.length} turno${l.renglones.length === 1 ? '' : 's'}`}</span>
        <span className="rv-rotulo">{conTitulo ? l.renglones.length : pago ? (propio ? 'Te toca' : 'Le toca') : ''}</span>
      </div>
      {visibles.map((x, i) => (
        <div key={`${x.dia}-${x.inicio}-${i}`} className="tu-gan-renglon">
          <span className="rv-num" style={{ color: 'var(--color-muted)' }}>{fechaCorta(x.dia)} {horaTxt(x.inicio)}</span>
          <span style={{ minWidth: 0 }}>
            <span style={{ display: 'block', color: 'var(--color-text)', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{nombre(x.clienteId)}</span>
            <span style={{ display: 'block', fontSize: 12, color: 'var(--color-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{x.servicio}</span>
          </span>
          <span className="rv-num" style={{ color: 'var(--color-muted)' }}>{plata(x.precio)}</span>
          <span className="rv-num" style={{ color: 'var(--color-text)', fontWeight: 600 }}>{pago ? plata(x.parte) : '—'}</span>
        </div>
      ))}
      {l.renglones.length > A_LA_VISTA && (
        <button type="button" onClick={() => setTodos(t => !t)} aria-expanded={todos} className="rv-btn rv-btn--sm rv-btn--fantasma" style={{ marginTop: 6, color: 'var(--chip-primary-fg)' }}>
          {todos ? 'Ver menos' : `Ver los ${l.renglones.length} turnos`}
        </button>
      )}
    </section>
  )
}

/** Cambiar cómo cobra alguien, sin salir de Ganancias. Va encima de la liquidación. */
function EditorPago({ persona, rubro, onCerrar, onGuardar }: { persona: Persona; rubro: RubroTurnos; onCerrar: () => void; onGuardar: (p: Pago) => void }) {
  const [pago, setPago] = useState(persona.pago)
  if (!pago) return null
  return (
    <Modal
      encima
      ancho={560}
      rotulo="Ganancias"
      titulo={`Cómo cobra ${persona.nombre.split(' ')[0]}`}
      bajada="El cambio vale de acá en adelante y también recalcula lo que está pendiente."
      onCerrar={onCerrar}
      onEnviar={() => onGuardar(pago)}
      pie={<>
        <button type="button" onClick={onCerrar} className="rv-btn">Cancelar</button>
        <button type="submit" className="rv-btn rv-btn--primario"><Check size={16} /> Guardar</button>
      </>}
    >
      <CamposPago pago={pago} onChange={setPago} rubro={rubro} nombre={persona.nombre} />
    </Modal>
  )
}
