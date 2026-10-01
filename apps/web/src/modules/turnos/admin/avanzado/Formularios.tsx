// Formularios previos y consentimientos: preguntas que el cliente completa
// antes del turno (alergias, medicación, zona) y un consentimiento con firma.
// Así la sesión arranca con todo resuelto y queda constancia firmada.
// Las preguntas de arranque dependen del rubro (datosAvanzado.preguntasDe).
import { useState, type PointerEvent } from 'react'
import { Plus, Trash2, ArrowUp, ArrowDown, ClipboardCheck, PenLine, Clock, Check } from 'lucide-react'
import { ShellFuncion, Seccion, Campo, Segmentado, FilaSwitch, Dato, VistaCliente, Switch, Aviso, BotonIcono, useAvisoVista, inputStyle, textareaStyle } from './ui'
import { preguntasDe, consentimientoDe, servicioBase, TIPOS_PREGUNTA, type Pregunta, type TipoPregunta } from './datosAvanzado'
import { esSalud } from '@/modules/turnos/datos'
import type { PropsFuncion } from './tipos'

export default function Formularios(p: PropsFuncion) {
  const { rubro } = p
  const [preguntas, setPreguntas] = useState<Pregunta[]>(() => preguntasDe(rubro))
  const [siguiente, setSiguiente] = useState(10)
  const [pedirConsent, setPedirConsent] = useState(true)
  const [consent, setConsent] = useState(() => consentimientoDe(rubro))
  const [firma, setFirma] = useState(true)
  const [cuando, setCuando] = useState<'reserva' | '24h'>('reserva')
  const [servicios, setServicios] = useState<Record<string, boolean>>(() => Object.fromEntries(rubro.servicios.map((s, i) => [s.nombre, i !== 0 || rubro.key !== 'tatuajes'])))

  const editar = (id: string, c: Partial<Pregunta>) => setPreguntas(l => l.map(q => q.id === id ? { ...q, ...c } : q))
  const mover = (i: number, d: -1 | 1) => setPreguntas(l => {
    const j = i + d
    if (j < 0 || j >= l.length) return l
    const c = [...l];[c[i], c[j]] = [c[j], c[i]]
    return c
  })
  const agregar = (tipo: TipoPregunta) => {
    setPreguntas(l => [...l, { id: `n${siguiente}`, texto: '', tipo, obligatoria: false, ...(tipo === 'opciones' ? { opciones: ['Opción 1', 'Opción 2'] } : {}) }])
    setSiguiente(n => n + 1)
  }

  return (
    <ShellFuncion
      {...p}
      bajada="Preguntas que se completan antes del turno y un consentimiento con firma digital. Llegás a la sesión sabiendo lo importante, y la constancia queda guardada en la ficha."
      textoOn={cuando === 'reserva' ? 'Se completa como último paso de la reserva, en los servicios que marcaste.' : 'Le llega por WhatsApp 24 h antes del turno, con un link para completarlo.'}
      kpis={<>
        <Dato label="Completados antes del turno" valor="41 de 44" nota="Últimos 30 días · ejemplo" Icon={ClipboardCheck} acento="var(--color-success)" />
        <Dato label="Consentimientos firmados" valor="318" nota="Guardados en cada ficha · ejemplo" Icon={PenLine} />
        <Dato label="Pendientes para mañana" valor="3" nota="Se les reenvía el link a la mañana" Icon={Clock} acento="var(--color-warning)" />
      </>}
      preview={<PreviewForm {...p} preguntas={preguntas} consent={pedirConsent ? consent : ''} firma={pedirConsent && firma} />}
    >
      <Aviso>
        Las preguntas y el texto del consentimiento son <b>ejemplos para arrancar</b>: revisalos con tu asesor antes de usarlos.
        {esSalud(rubro) ? ' Los datos de salud son datos sensibles (Ley 25.326): solo los ve quien atiende.' : ''}
      </Aviso>

      <Seccion titulo="Preguntas" desc={`${preguntas.length} pregunta${preguntas.length === 1 ? '' : 's'}. Ordenalas con las flechas.`}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {preguntas.map((q, i) => (
            <div key={q.id} style={{ padding: 12, borderRadius: 10, border: '1px solid var(--color-border)', background: 'var(--color-bg)' }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-subtle)', width: 18, flexShrink: 0 }}>{i + 1}.</span>
                <input aria-label={`Texto de la pregunta ${i + 1}`} className="tuc-field" value={q.texto} placeholder="Escribí la pregunta" onChange={e => editar(q.id, { texto: e.target.value })} style={{ ...inputStyle, flex: 1, minWidth: 0 }} />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8, flexWrap: 'wrap', paddingLeft: 26 }}>
                <select aria-label={`Tipo de la pregunta ${i + 1}`} className="tuc-field" value={q.tipo} onChange={e => { const tipo = e.target.value as TipoPregunta; editar(q.id, { tipo, ...(tipo === 'opciones' && !q.opciones ? { opciones: ['Opción 1', 'Opción 2'] } : {}) }) }} style={{ ...inputStyle, width: 'auto', height: 34, fontSize: 13 }}>
                  {TIPOS_PREGUNTA.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
                </select>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: 'var(--color-body)' }}>
                  <Switch on={q.obligatoria} onChange={v => editar(q.id, { obligatoria: v })} label={`Pregunta ${i + 1} obligatoria`} /> Obligatoria
                </span>
                <span style={{ flex: 1 }} />
                <BotonIcono Icon={ArrowUp} label={`Subir pregunta ${i + 1}`} disabled={i === 0} onClick={() => mover(i, -1)} />
                <BotonIcono Icon={ArrowDown} label={`Bajar pregunta ${i + 1}`} disabled={i === preguntas.length - 1} onClick={() => mover(i, 1)} />
                <BotonIcono Icon={Trash2} peligro label={`Borrar pregunta ${i + 1}`} onClick={() => setPreguntas(l => l.filter(x => x.id !== q.id))} />
              </div>
              {q.tipo === 'opciones' && (
                <div style={{ paddingLeft: 26, marginTop: 8 }}>
                  <input aria-label={`Opciones de la pregunta ${i + 1}, separadas por coma`} className="tuc-field" value={(q.opciones ?? []).join(', ')} onChange={e => editar(q.id, { opciones: e.target.value.split(',').map(x => x.trimStart()) })} style={{ ...inputStyle, height: 34, fontSize: 13 }} />
                  <div style={{ fontSize: 11, color: 'var(--color-subtle)', marginTop: 4 }}>Opciones separadas por coma.</div>
                </div>
              )}
            </div>
          ))}
        </div>
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-muted)', margin: '14px 0 8px' }}>Agregar pregunta</div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {TIPOS_PREGUNTA.map(t => (
            <button key={t.id} type="button" className="tua-opc" onClick={() => agregar(t.id)} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, minHeight: 34, padding: '0 11px', borderRadius: 8, border: '1px dashed var(--color-border-strong)', background: 'transparent', color: 'var(--color-body)', fontFamily: 'inherit', fontSize: 12.5, cursor: 'pointer' }}>
              <Plus size={13} /> {t.label}
            </button>
          ))}
        </div>
      </Seccion>

      <Seccion titulo="Consentimiento">
        <FilaSwitch titulo="Pedir consentimiento" desc="El cliente lo lee y lo acepta antes de enviar el formulario." on={pedirConsent} onChange={setPedirConsent} />
        {pedirConsent && (
          <>
            <Campo label="Texto del consentimiento" htmlFor="tua-form-consent" style={{ marginTop: 8 }}>
              <textarea id="tua-form-consent" className="tuc-field" value={consent} onChange={e => setConsent(e.target.value)} style={{ ...textareaStyle, minHeight: 120 }} />
            </Campo>
            <FilaSwitch titulo="Pedir firma con el dedo" desc="Se guarda la firma junto con la fecha y la hora." on={firma} onChange={setFirma} />
          </>
        )}
      </Seccion>

      <Seccion titulo="Cuándo y para qué servicios">
        <Campo label="Cuándo se completa">
          <Segmentado label="Cuándo se completa" valor={cuando} onChange={setCuando} opciones={[{ valor: 'reserva', label: 'Al reservar' }, { valor: '24h', label: '24 h antes, por WhatsApp' }]} />
        </Campo>
        <Campo label="Servicios que lo piden" style={{ marginBottom: 0 }}>
          <div role="group" aria-label="Servicios que piden el formulario" style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {rubro.servicios.map(s => {
              const on = servicios[s.nombre]
              return (
                <button key={s.nombre} type="button" className="tua-opc" aria-pressed={on} onClick={() => setServicios(x => ({ ...x, [s.nombre]: !on }))} style={{ minHeight: 34, padding: '0 11px', borderRadius: 999, fontFamily: 'inherit', fontSize: 12.5, cursor: 'pointer', fontWeight: on ? 600 : 500, border: `1.5px solid ${on ? 'var(--color-primary)' : 'var(--color-border)'}`, background: on ? 'var(--color-primary-bg)' : 'var(--color-bg)', color: on ? 'var(--color-primary)' : 'var(--color-body)' }}>
                  {s.nombre}
                </button>
              )
            })}
          </div>
        </Campo>
      </Seccion>
    </ShellFuncion>
  )
}

const FIRMA_EJEMPLO = 'M12 42 C 24 10, 34 10, 38 34 S 52 52, 60 28 C 66 12, 74 18, 72 34 C 70 46, 84 44, 94 30 C 102 20, 108 22, 110 34 C 112 44, 126 40, 136 26 M 128 44 C 150 36, 170 34, 190 30'

function PreviewForm({ rubro, preguntas, consent, firma }: PropsFuncion & { preguntas: Pregunta[]; consent: string; firma: boolean }) {
  return (
    <VistaCliente rubro={rubro} nota="Con datos de ejemplo. Se puede completar, firmar y enviar para probarlo.">
      <div>
        <div style={{ fontFamily: 'var(--tu-fh)', fontSize: 20, fontWeight: 700, color: 'var(--color-text)', lineHeight: 1.15 }}>Antes de tu turno</div>
        <div style={{ fontSize: 12, color: 'var(--color-muted)', marginTop: 3 }}>{servicioBase(rubro).nombre} · lunes 28/09, 16:30</div>
      </div>
      <FormularioVista preguntas={preguntas} consent={consent} firma={firma} />
    </VistaCliente>
  )
}

/** El formulario del celular, que se completa de verdad. Va aparte para poder usar el aviso de VistaCliente. */
function FormularioVista({ preguntas, consent, firma }: { preguntas: Pregunta[]; consent: string; firma: boolean }) {
  const avisar = useAvisoVista()
  const [resp, setResp] = useState<Record<string, string>>({})
  const [acepta, setAcepta] = useState(true)
  // null = todavía está la firma de ejemplo; al apoyar el dedo se reemplaza por la propia.
  const [trazos, setTrazos] = useState<string[] | null>(null)
  const [dibujando, setDibujando] = useState(false)

  const opcionesDe = (q: Pregunta) => (q.opciones ?? []).filter(Boolean)
  // Sin tocar nada, las de elegir arrancan con una opción marcada, como en el ejemplo.
  const valor = (q: Pregunta) => resp[q.id] ?? (q.tipo === 'si-no' ? 'No' : q.tipo === 'opciones' ? opcionesDe(q)[0] ?? '' : '')
  const responder = (id: string, v: string) => setResp(r => ({ ...r, [id]: v }))

  const punto = (e: PointerEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect()
    return `${(((e.clientX - r.left) / r.width) * 200).toFixed(1)} ${(((e.clientY - r.top) / r.height) * 60).toFixed(1)}`
  }
  const empezar = (e: PointerEvent<SVGSVGElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId)
    const p = punto(e)
    setDibujando(true)
    setTrazos(l => [...(l ?? []), `M ${p} l 0.1 0`])
  }
  const seguir = (e: PointerEvent<SVGSVGElement>) => {
    if (!dibujando) return
    const p = punto(e)
    setTrazos(l => l && l.length ? [...l.slice(0, -1), `${l[l.length - 1]} L ${p}`] : l)
  }

  const enviar = () => {
    const falta = preguntas.find(q => q.obligatoria && !valor(q).trim())
    if (falta) { avisar(`Te falta responder: ${falta.texto || 'una pregunta obligatoria'}`); return }
    if (consent && firma && trazos !== null && trazos.length === 0) { avisar('Falta tu firma.'); return }
    if (consent && !acepta) { avisar('Para enviar tenés que aceptar el consentimiento.'); return }
    avisar('Demo: formulario enviado. Las respuestas quedan en la ficha del cliente.')
  }

  const chip = (sel: boolean) => ({ padding: '6px 11px', borderRadius: 999, fontFamily: 'inherit', fontSize: 12, cursor: 'pointer', border: `1px solid ${sel ? 'var(--color-primary)' : 'var(--color-border)'}`, background: sel ? 'var(--color-primary-bg)' : 'transparent', color: sel ? 'var(--color-primary)' : 'var(--color-body)', fontWeight: 600 } as const)
  const estiloRotulo = { display: 'block', fontSize: 12.5, fontWeight: 600, color: 'var(--color-text)', marginBottom: 6 } as const
  const firmaVacia = trazos !== null && trazos.length === 0

  return (
    <>
      {preguntas.length === 0 && <div style={{ fontSize: 12.5, color: 'var(--color-muted)' }}>Sin preguntas.</div>}
      {preguntas.map(q => {
        const id = `tua-fv-${q.id}`
        const rotulo = <>{q.texto || 'Pregunta sin texto'}{q.obligatoria && <span style={{ color: 'var(--color-primary)' }}> *</span>}</>
        const deElegir = q.tipo === 'si-no' || q.tipo === 'opciones'
        return (
          <div key={q.id}>
            {deElegir ? <div id={id} style={estiloRotulo}>{rotulo}</div> : <label htmlFor={id} style={estiloRotulo}>{rotulo}</label>}
            {q.tipo === 'corta' && <input id={id} className="tua-vcampo" value={valor(q)} placeholder="Tu respuesta" required={q.obligatoria} onChange={e => responder(q.id, e.target.value)} />}
            {q.tipo === 'larga' && <textarea id={id} className="tua-vcampo" value={valor(q)} placeholder="Contanos…" required={q.obligatoria} onChange={e => responder(q.id, e.target.value)} />}
            {q.tipo === 'fecha' && <input id={id} type="date" className="tua-vcampo" value={valor(q)} required={q.obligatoria} onChange={e => responder(q.id, e.target.value)} />}
            {deElegir && (
              <div role="radiogroup" aria-labelledby={id} style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {(q.tipo === 'si-no' ? ['Sí', 'No'] : opcionesDe(q)).map((o, i) => {
                  const sel = valor(q) === o
                  return <button key={`${o}-${i}`} type="button" role="radio" aria-checked={sel} className="tua-opc" onClick={() => responder(q.id, o)} style={chip(sel)}>{o}</button>
                })}
              </div>
            )}
          </div>
        )
      })}
      {consent && (
        <div style={{ borderRadius: 'var(--tu-r2)', background: 'var(--color-surface)', border: '1px solid var(--color-border)', padding: 12 }}>
          <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--color-text)', marginBottom: 6 }}>Consentimiento</div>
          <div style={{ fontSize: 11.5, lineHeight: 1.5, color: 'var(--color-body)', maxHeight: 92, overflowY: 'auto', overflowWrap: 'anywhere' }}>{consent}</div>
          {firma && (
            <>
              <div style={{ marginTop: 10, borderRadius: 'var(--tu-r)', border: '1px dashed var(--color-border-strong)', background: 'var(--color-bg)', height: 70, position: 'relative' }}>
                <svg role="img" aria-label={trazos === null ? 'Firma de ejemplo. Firmá encima con el dedo o el mouse.' : firmaVacia ? 'Espacio para firmar, vacío' : 'Tu firma'} viewBox="0 0 200 60" preserveAspectRatio="none"
                  onPointerDown={empezar} onPointerMove={seguir} onPointerUp={() => setDibujando(false)} onPointerCancel={() => setDibujando(false)}
                  style={{ position: 'absolute', inset: 6, width: 'calc(100% - 12px)', height: 'calc(100% - 12px)', touchAction: 'none', cursor: 'crosshair' }}>
                  <path d={trazos === null ? FIRMA_EJEMPLO : trazos.join(' ')} fill="none" stroke="var(--color-text)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
                </svg>
                <span style={{ position: 'absolute', left: 10, bottom: 4, fontSize: 10, color: 'var(--color-muted)', pointerEvents: 'none' }}>Firmá con el dedo</span>
              </div>
              <button type="button" className="tua-vbtn tua-vbtn--suave tua-vbtn--chico" disabled={firmaVacia} onClick={() => setTrazos([])} style={{ marginTop: 6, opacity: firmaVacia ? 0.5 : 1 }}>Borrar firma</button>
            </>
          )}
          <button type="button" role="checkbox" aria-checked={acepta} className="tua-opc" onClick={() => setAcepta(v => !v)} style={{ display: 'flex', alignItems: 'center', gap: 8, minHeight: 32, marginTop: 10, padding: 0, border: 'none', background: 'transparent', fontFamily: 'inherit', fontSize: 12, color: 'var(--color-text)', cursor: 'pointer', textAlign: 'left' }}>
            <span aria-hidden style={{ width: 16, height: 16, borderRadius: 4, boxSizing: 'border-box', background: acepta ? 'var(--color-primary)' : 'transparent', border: acepta ? 'none' : '1.5px solid var(--color-border-strong)', color: 'var(--color-on-primary)', display: 'grid', placeItems: 'center', flexShrink: 0 }}>{acepta && <Check size={11} strokeWidth={3} />}</span>
            Leí y acepto
          </button>
        </div>
      )}
      <button type="button" className="tua-vbtn" onClick={enviar}>Enviar</button>
    </>
  )
}
