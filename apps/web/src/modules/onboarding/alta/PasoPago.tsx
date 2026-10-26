// Último paso: el resumen de lo cargado, el plan y el código de descuento. El
// botón de pagar vive en la botonera fija de abajo (Alta.tsx).
//
// Los planes son los de Tienda (planesDatos.ts, los montos reales). El precio
// de Turnos, Alquileres y Gimnasio todavía no está definido: se dice de frente
// en vez de inventar uno. En la demo no se cobra nada.
import { useEffect, useState } from 'react'
import { Check, Info, LoaderCircle, Package, Sparkles, Tag, X } from 'lucide-react'
import { TARJETAS, fmt } from '@/modules/landing/components/v2/planesDatos'
import { MODO_LABEL, type RubroTurnos } from '@/modules/turnos/datos'
import { MODALIDAD_TXT, beneficiosTxt } from '@/modules/turnos/datos/negocio'
import { Aviso, MensajeError, Opcion, type PropsPaso } from './campos'
import { CODIGO_DEMO, descuentoDe, diasTxt, horarioTxt, modalidadesAlta, slugDe, type DatosAlta, type ServicioAlta } from './modelo'
import { subrubroPorKey } from './subrubrosTienda'
import { TEXTOS } from './textos'

/** Filas propias de un módulo en el resumen (Alquileres y Gimnasio: ver reservas.ts). */
export interface FilaResumen { dt: string; dd: string }

/** Lo que se paga hoy por el plan elegido, con el código aplicado. */
export function importeDe(d: DatosAlta) {
  const plan = TARJETAS.find(t => t.key === d.plan) ?? TARJETAS[0]
  const pct = descuentoDe(d.codigo)
  return { plan, pct, hoy: Math.round(plan.precioLista * (1 - pct / 100)) }
}

function Resumen({ d, rubro, servicios, sena, filas }: { d: DatosAlta; rubro: RubroTurnos | null; servicios: ServicioAlta[]; sena: number; filas: FilaResumen[] }) {
  const marcadas = modalidadesAlta(d, rubro)
  const local = marcadas.includes('local')
  const direccion = [d.direccion.trim(), d.ciudad.trim()].filter(Boolean).join(', ')
  const link = <dd className="tuo-num" style={{ color: 'var(--color-primary-h)' }}>{slugDe(d)}.orbita.site</dd>

  // Alquileres y Gimnasio: lo propio del módulo llega armado; dónde queda y el link son de todos.
  if (d.modulo === 'alquileres' || d.modulo === 'gimnasio') {
    return (
      <dl className="tuob-resumen">
        <div><dt>Negocio</dt><dd>{d.negocio.trim() || 'Sin nombre'}</dd></div>
        {filas.map(f => <div key={f.dt}><dt>{f.dt}</dt><dd>{f.dd}</dd></div>)}
        <div><dt>Dónde queda</dt><dd>{direccion || 'Sin dirección'}</dd></div>
        <div><dt>Link de reservas</dt>{link}</div>
      </dl>
    )
  }

  if (d.modulo === 'tienda') {
    const rubros = d.tipos.map(k => subrubroPorKey(k)?.label).filter(Boolean) as string[]
    return (
      <dl className="tuob-resumen">
        <div><dt>Negocio</dt><dd>{d.negocio.trim() || 'Sin nombre'}</dd></div>
        <div><dt>Módulo</dt><dd>Tienda online · {d.modoVenta === 'ecommerce' ? 'con carrito y cobro' : 'vidriera digital'}</dd></div>
        <div><dt>Qué vendés</dt><dd>{rubros.slice(0, 3).join(', ')}{rubros.length > 3 ? ` y ${rubros.length - 3} más` : ''}</dd></div>
        <div><dt>Dónde operás</dt><dd>{local ? direccion || 'Local físico' : 'Online, sin dirección fija'}{local && marcadas.includes('domicilio') ? ' · también online' : ''}</dd></div>
        <div><dt>Tu tienda</dt>{link}</div>
      </dl>
    )
  }
  if (!rubro) return null
  const beneficios = beneficiosTxt(d.cuentas, rubro)
  return (
    <dl className="tuob-resumen">
      <div><dt>Negocio</dt><dd>{d.negocio.trim() || 'Sin nombre'}</dd></div>
      <div><dt>Módulo</dt><dd>Turnos · {rubro.label.toLowerCase()} · {MODO_LABEL[rubro.modo].toLowerCase()}</dd></div>
      <div><dt>Servicios</dt><dd>{servicios.length} cargado{servicios.length === 1 ? '' : 's'} · {sena ? `seña del ${sena}%` : 'sin seña'}</dd></div>
      <div><dt>Dónde atendés</dt><dd>{marcadas.map(m => MODALIDAD_TXT[m]).join(' · ')}{local && direccion ? ` (${direccion})` : ''}</dd></div>
      <div><dt>Atención</dt><dd>{diasTxt(d.dias)} · <span className="tuo-num">{horarioTxt(d)}</span></dd></div>
      <div><dt>Tu página</dt><dd>{d.forma === 'web' ? 'Sitio web completo' : 'Página simple'} · {beneficios.length ? `cuenta opcional con ${beneficios.length} beneficio${beneficios.length === 1 ? '' : 's'}` : 'reservas sin cuenta'}</dd></div>
      <div><dt>Link de reservas</dt>{link}</div>
    </dl>
  )
}

/** Código de descuento: se "valida" contra el único que existe en la demo, con la espera de un chequeo real. */
function Codigo({ d, poner }: Pick<PropsPaso, 'd' | 'poner'>) {
  const [texto, setTexto] = useState('')
  const [estado, setEstado] = useState<'quieto' | 'validando' | 'no-existe'>('quieto')
  const pct = descuentoDe(d.codigo)

  useEffect(() => {
    if (estado !== 'validando') return
    const x = window.setTimeout(() => {
      if (descuentoDe(texto)) { poner('codigo', texto.trim().toUpperCase()); setTexto(''); setEstado('quieto') }
      else setEstado('no-existe')
    }, 700)
    return () => window.clearTimeout(x)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- se dispara al pasar a "validando"; el texto no cambia mientras tanto (el campo queda trabado)
  }, [estado])

  if (pct) {
    return (
      <div className="tuob-codigo-ok" role="status">
        <span className="tuob-codigo-ico" aria-hidden><Check size={15} strokeWidth={3} /></span>
        <span style={{ flex: 1, minWidth: 0 }}><b className="tuo-num">{d.codigo}</b> aplicado: {pct}% de descuento en tu primer pago.</span>
        <button type="button" className="tuo-btn tuo-btn--sm tuo-btn--fantasma" onClick={() => poner('codigo', '')}><X size={14} aria-hidden /> Quitar</button>
      </div>
    )
  }
  const validar = () => { if (texto.trim()) setEstado('validando') }
  return (
    <div className="tuob-campo">
      <label htmlFor="tuob-codigo">Código de descuento <small>opcional</small></label>
      <div className="tuob-codigo">
        <span className="tuob-control">
          <span className="tuob-prefijo" aria-hidden><Tag size={15} /></span>
          <input id="tuob-codigo" className="tuob-input tuob-input--prefijo tuob-input--mono" value={texto} placeholder="Tu código" maxLength={24} autoComplete="off" autoCapitalize="characters" spellCheck={false}
            disabled={estado === 'validando'} aria-invalid={estado === 'no-existe' ? true : undefined} aria-describedby={estado === 'no-existe' ? 'tuob-codigo-error' : 'tuob-codigo-ayuda'}
            onChange={e => { setTexto(e.target.value.toUpperCase()); setEstado('quieto') }}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); validar() } }} />
        </span>
        <button type="button" className="tuo-btn" onClick={validar} disabled={!texto.trim() || estado === 'validando'} aria-busy={estado === 'validando'}>
          {estado === 'validando' ? <><LoaderCircle size={15} className="tuob-girando" aria-hidden /> Validando…</> : 'Aplicar'}
        </button>
      </div>
      {estado === 'no-existe'
        ? <MensajeError id="tuob-codigo-error">Ese código no existe o ya venció.</MensajeError>
        : <p id="tuob-codigo-ayuda" className="tuob-ayuda">Vista previa: probá con <button type="button" className="tuob-enlace tuo-num" onClick={() => { setTexto(CODIGO_DEMO); setEstado('quieto') }}>{CODIGO_DEMO}</button>.</p>}
    </div>
  )
}

export function PasoPago({ d, poner, rubro, servicios, sena, filas = [] }: Pick<PropsPaso, 'd' | 'poner'> & {
  rubro: RubroTurnos | null
  servicios: ServicioAlta[]
  sena: number
  /** Lo propio de Alquileres o de Gimnasio en el resumen. */
  filas?: FilaResumen[]
}) {
  const { plan, pct, hoy } = importeDe(d)
  return (
    <div className="tuob-ancho tuob-ancho--form">
      <div style={{ display: 'grid', gap: 14 }}>
        <div className="tuob-form" style={{ gap: 14 }}>
          <span className="tuo-rotulo">Tu negocio</span>
          <Resumen d={d} rubro={rubro} servicios={servicios} sena={sena} filas={filas} />
        </div>

        <div className="tuob-form">
          <fieldset className="tuob-campo">
            <legend className="tuob-leyenda" style={{ marginBottom: 7 }}>Elegí tu plan</legend>
            <div className="tuob-opciones tuob-opciones--pila">
              {TARJETAS.map(t => (
                <Opcion key={t.key} grupo="tuob-plan" valor={t.key} elegido={d.plan === t.key} onElegir={() => poner('plan', t.key)} Icon={t.key === 'avanzado' ? Sparkles : Package}
                  titulo={<>{t.nombre}{t.destacada && <span className="tuo-chip tuo-chip--primario tuob-plan-chip">El más elegido</span>}</>}
                  texto={<><span className="tuo-num tuob-plan-precio">{fmt(t.precioLista)}</span> por mes. Hoy pagás el primero.</>} />
              ))}
            </div>
          </fieldset>

          <Codigo d={d} poner={poner} />

          <div className="tuob-total">
            <div>
              <span className="tuo-rotulo">Hoy pagás</span>
              <p>{plan.nombre} · primer mes{pct ? ` · ${pct}% de descuento` : ''}</p>
            </div>
            <div className="tuob-total-monto">
              {pct > 0 && <s className="tuo-num">{fmt(plan.precioLista)}</s>}
              <b className="tuo-num">{fmt(hoy)}</b>
            </div>
          </div>

          <Aviso tono="aviso" Icon={Info}>
            {TEXTOS[d.modulo ?? 'tienda'].precios}
            En esta vista previa no se cobra nada ni se abre Mercado Pago.
          </Aviso>
        </div>
      </div>
    </div>
  )
}
