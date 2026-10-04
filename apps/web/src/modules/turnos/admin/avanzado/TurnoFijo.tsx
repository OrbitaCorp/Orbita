// Turno fijo: el cliente reserva una vez y se queda con el mismo horario cada
// semana o cada quince días (psicología, kinesio, clases). En la vista previa
// se ve el paso de la reserva donde elige repetirlo.
import { useState } from 'react'
import { CalendarSync, Clock, Wallet, Check } from 'lucide-react'
import { ShellFuncion, Seccion, Campo, Segmentado, FilaSwitch, Dato, VistaCliente, BotonVista } from './ui'
import { ars, servicioBase } from './datosAvanzado'
import { duracionTxt } from '@/modules/turnos/datos'
import type { PropsFuncion } from './tipos'

type Frecuencia = 'semanal' | 'quincenal' | 'mensual'
const FRECUENCIAS: { id: Frecuencia; label: string; cada: string; dias: number }[] = [
  { id: 'semanal', label: 'Cada semana', cada: 'todas las semanas', dias: 7 },
  { id: 'quincenal', label: 'Cada 15 días', cada: 'cada 15 días', dias: 14 },
  { id: 'mensual', label: 'Una vez por mes', cada: 'una vez por mes', dias: 28 },
]

// Fechas de ejemplo a partir del martes 29/09/2026 (sin Date para que el render sea puro y estable).
function fechas(desde: number, cada: number, n: number) {
  const mesesDias = [[9, 30], [10, 31], [11, 30], [12, 31]]
  const out: string[] = []
  let dia = desde, mesI = 0
  for (let i = 0; i < n; i++) {
    out.push(`${String(dia).padStart(2, '0')}/${String(mesesDias[mesI][0]).padStart(2, '0')}`)
    dia += cada
    while (dia > mesesDias[mesI][1]) { dia -= mesesDias[mesI][1]; mesI++ }
  }
  return out
}

const FIJOS = [
  { cliente: 'Sofía Ramírez', cuando: 'Martes 18:00', frec: 'semanal' as Frecuencia, van: 6, de: 12 },
  { cliente: 'Mateo Díaz', cuando: 'Jueves 09:30', frec: 'quincenal' as Frecuencia, van: 3, de: 0 },
  { cliente: 'Camila López', cuando: 'Lunes 19:00', frec: 'semanal' as Frecuencia, van: 10, de: 12 },
]

export default function TurnoFijo(p: PropsFuncion) {
  const { rubro } = p
  const base = servicioBase(rubro)
  const [frecs, setFrecs] = useState<Record<Frecuencia, boolean>>({ semanal: true, quincenal: true, mensual: false })
  const [maximo, setMaximo] = useState(12)
  const [servicios, setServicios] = useState<Record<string, boolean>>(() => Object.fromEntries(rubro.servicios.map((s, i) => [s.nombre, i < 2])))
  const [cobro, setCobro] = useState<'cada' | 'mes'>('cada')
  const [liberar, setLiberar] = useState(2)
  const [feriados, setFeriados] = useState(true)

  const habilitadas = FRECUENCIAS.filter(f => frecs[f.id])
  const [frecPreview, setFrecPreview] = useState<Frecuencia>('semanal')
  const fp = FRECUENCIAS.find(f => f.id === frecPreview && frecs[f.id]) ?? habilitadas[0] ?? FRECUENCIAS[0]
  const nombreFrec = (id: Frecuencia) => FRECUENCIAS.find(f => f.id === id)!.label.toLowerCase()

  return (
    <ShellFuncion
      {...p}
      bajada="Tu cliente reserva una vez y se queda con el mismo día y horario cada semana o cada quince días. Ideal para tratamientos y procesos que necesitan continuidad."
      textoOn="Al reservar un servicio habilitado, aparece “Repetir este turno” en el último paso."
      kpis={<>
        <Dato label="Turnos fijos activos" valor="18" nota="Datos de ejemplo" Icon={CalendarSync} />
        <Dato label="Horas aseguradas por semana" valor="13,5 h" nota="Datos de ejemplo" Icon={Clock} acento="#8B5CF6" />
        <Dato label="Ingreso asegurado al mes" valor={ars(18 * 3.4 * base.precio)} nota="Si nadie cancela · ejemplo" Icon={Wallet} acento="var(--color-success)" />
      </>}
      preview={<PreviewFijo {...p} fp={fp} habilitadas={habilitadas} onFrec={setFrecPreview} maximo={maximo} cobro={cobro} />}
    >
      <Seccion titulo="Frecuencias permitidas" desc="Tu cliente elige entre las que dejes prendidas.">
        <div role="group" aria-label="Frecuencias permitidas" style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {FRECUENCIAS.map(f => {
            const on = frecs[f.id]
            return (
              <button key={f.id} type="button" className="tua-opc" aria-pressed={on} onClick={() => setFrecs(x => ({ ...x, [f.id]: !on }))} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, minHeight: 36, padding: '0 13px', borderRadius: 999, cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: on ? 600 : 500, border: `1.5px solid ${on ? 'var(--color-primary)' : 'var(--color-border)'}`, background: on ? 'var(--color-primary-bg)' : 'var(--color-bg)', color: on ? 'var(--color-primary)' : 'var(--color-body)' }}>
                {on && <Check size={13} />}{f.label}
              </button>
            )
          })}
        </div>
        {habilitadas.length === 0 && <div role="alert" style={{ fontSize: 12, color: 'var(--color-error)', marginTop: 8 }}>Prendé al menos una frecuencia.</div>}
        <Campo label="Máximo de repeticiones" style={{ marginTop: 16, marginBottom: 0 }} ayuda="Al llegar al máximo, le avisamos para que lo renueve con un toque.">
          <Segmentado label="Máximo de repeticiones" valor={maximo} onChange={setMaximo} opciones={[{ valor: 4, label: '4 turnos' }, { valor: 8, label: '8' }, { valor: 12, label: '12' }, { valor: 0, label: 'Hasta que lo cancele' }]} />
        </Campo>
      </Seccion>

      <Seccion titulo="Servicios que se pueden fijar">
        <div role="group" aria-label="Servicios que se pueden fijar" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {rubro.servicios.map(s => {
            const on = servicios[s.nombre]
            return (
              <button key={s.nombre} type="button" role="checkbox" aria-checked={on} className="tua-opc" onClick={() => setServicios(x => ({ ...x, [s.nombre]: !on }))} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left', border: `1px solid ${on ? 'var(--color-primary)' : 'var(--color-border)'}`, background: on ? 'var(--color-primary-bg)' : 'var(--color-bg)', color: 'var(--color-body)' }}>
                <span aria-hidden style={{ width: 18, height: 18, borderRadius: 5, display: 'grid', placeItems: 'center', flexShrink: 0, background: on ? 'var(--color-primary)' : 'transparent', border: on ? 'none' : '1.5px solid var(--color-border-strong)', color: 'var(--color-on-primary)' }}>{on && <Check size={12} strokeWidth={3} />}</span>
                <span style={{ flex: 1, minWidth: 0, fontSize: 13.5, color: 'var(--color-text)', fontWeight: 500 }}>{s.nombre}</span>
                <span style={{ fontSize: 12, color: 'var(--color-muted)', whiteSpace: 'nowrap' }}>{duracionTxt(s.duracion)}</span>
              </button>
            )
          })}
        </div>
      </Seccion>

      <Seccion titulo="Reglas">
        <Campo label="Cómo se cobra">
          <Segmentado label="Cómo se cobra" valor={cobro} onChange={setCobro} opciones={[{ valor: 'cada', label: 'Cada turno, como siempre' }, { valor: 'mes', label: 'El mes por adelantado' }]} />
        </Campo>
        <Campo label="Se libera el horario si falta sin avisar">
          <Segmentado label="Ausencias antes de liberar" valor={liberar} onChange={setLiberar} opciones={[{ valor: 1, label: '1 vez' }, { valor: 2, label: '2 veces' }, { valor: 0, label: 'Nunca' }]} />
        </Campo>
        <FilaSwitch titulo="Saltear feriados" desc="Ese día no se reserva y le avisamos con anticipación para reprogramar." on={feriados} onChange={setFeriados} />
      </Seccion>

      <Seccion titulo="Turnos fijos activos" desc="Datos de ejemplo.">
        {FIJOS.map((f, i) => (
          <div key={f.cliente} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderTop: i ? '1px solid var(--color-border)' : 'none', flexWrap: 'wrap' }}>
            <div style={{ flex: '1 1 180px', minWidth: 0 }}>
              <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--color-text)' }}>{f.cliente}</div>
              <div style={{ fontSize: 12, color: 'var(--color-muted)' }}>{f.cuando} · {nombreFrec(f.frec)}</div>
            </div>
            <span style={{ fontSize: 12.5, fontFamily: '"Geist Mono", monospace', color: 'var(--color-body)' }}>{f.de ? `${f.van} de ${f.de}` : `${f.van} · sin límite`}</span>
          </div>
        ))}
      </Seccion>
    </ShellFuncion>
  )
}

function PreviewFijo({ rubro, fp, habilitadas, onFrec, maximo, cobro }: PropsFuncion & { fp: typeof FRECUENCIAS[number]; habilitadas: typeof FRECUENCIAS; onFrec: (f: Frecuencia) => void; maximo: number; cobro: 'cada' | 'mes' }) {
  const base = servicioBase(rubro)
  const proximas = fechas(29, fp.dias, 4)
  const [repetir, setRepetir] = useState(true)
  return (
    <VistaCliente rubro={rubro} nota="Último paso de la reserva, con datos de ejemplo. Probá cambiar la frecuencia.">
      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--color-primary)' }}>Confirmá tu turno</div>
      <div style={{ borderRadius: 'var(--tu-r2)', border: '1px solid var(--color-border)', background: 'var(--color-surface)', padding: 14 }}>
        <div style={{ fontFamily: 'var(--tu-fh)', fontSize: 18, fontWeight: 700, color: 'var(--color-text)' }}>{base.nombre}</div>
        <div style={{ fontSize: 12.5, color: 'var(--color-muted)', marginTop: 3 }}>Martes 29/09 · 18:00 · {duracionTxt(base.duracion)}</div>
      </div>
      <div style={{ borderRadius: 'var(--tu-r2)', border: `1.5px solid ${repetir ? 'var(--color-primary)' : 'var(--color-border)'}`, background: repetir ? 'var(--color-primary-bg)' : 'var(--color-surface)', padding: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <CalendarSync size={18} color="var(--color-primary)" aria-hidden />
          <span style={{ flex: 1, fontSize: 14, fontWeight: 700, color: 'var(--color-text)' }}>Repetir este turno</span>
          {/* La llave del sitio, con los colores del negocio: el área de toque es más grande que el dibujo. */}
          <button type="button" role="switch" aria-checked={repetir} aria-label="Repetir este turno" className="tua-opc" onClick={() => setRepetir(v => !v)} style={{ width: 48, height: 44, margin: '-12px -6px', padding: 0, border: 'none', background: 'transparent', cursor: 'pointer', display: 'grid', placeItems: 'center', borderRadius: 999 }}>
            <span aria-hidden style={{ width: 36, height: 20, borderRadius: 999, background: repetir ? 'var(--color-primary)' : 'var(--color-border-strong)', position: 'relative', display: 'block' }}>
              <span style={{ position: 'absolute', top: 2, left: repetir ? 18 : 2, width: 16, height: 16, borderRadius: '50%', background: 'var(--color-on-primary)', transition: 'left 180ms ease' }} />
            </span>
          </button>
        </div>
        {repetir ? (
          <>
            <div role="group" aria-label="Frecuencia (vista previa)" style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 12 }}>
              {habilitadas.map(f => {
                const sel = f.id === fp.id
                return (
                  <button key={f.id} type="button" className="tua-opc" aria-pressed={sel} onClick={() => onFrec(f.id)} style={{ height: 30, padding: '0 11px', borderRadius: 999, fontFamily: 'inherit', fontSize: 12, fontWeight: 600, cursor: 'pointer', border: `1px solid ${sel ? 'var(--color-primary)' : 'var(--color-border)'}`, background: sel ? 'var(--color-primary)' : 'var(--color-bg)', color: sel ? 'var(--color-on-primary)' : 'var(--color-body)' }}>{f.label}</button>
                )
              })}
            </div>
            <div style={{ fontSize: 12, color: 'var(--color-body)', marginTop: 12 }}>Tus próximos turnos, {fp.cada} a las 18:00:</div>
            <ul style={{ listStyle: 'none', margin: '8px 0 0', padding: 0, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
              {proximas.map(d => (
                <li key={d} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: 'var(--color-text)', fontWeight: 600 }}><Check size={13} color="var(--color-primary)" aria-hidden />{d}</li>
              ))}
            </ul>
            <div style={{ fontSize: 11.5, color: 'var(--color-muted)', marginTop: 10 }}>
              {maximo ? `Se reservan hasta ${maximo} turnos. Te avisamos para renovar.` : 'Sigue hasta que lo canceles.'} {cobro === 'mes' ? 'Se paga el mes por adelantado.' : 'Pagás cada turno como siempre.'}
            </div>
          </>
        ) : (
          <div style={{ fontSize: 12, color: 'var(--color-muted)', marginTop: 8, lineHeight: 1.45 }}>Reservás solo el martes 29/09. Prendelo para quedarte con el horario.</div>
        )}
      </div>
      <BotonVista aviso={repetir
        ? `Demo: turno fijo confirmado, ${fp.cada} a las 18:00. El primero es el martes 29/09.`
        : 'Demo: turno confirmado para el martes 29/09 a las 18:00.'}>
        {repetir ? 'Confirmar turno fijo' : 'Confirmar turno'}
      </BotonVista>
    </VistaCliente>
  )
}
