// Paso 2 del alta: los servicios con los que abre la agenda. Llegan cargados
// con los típicos del rubro y se editan en el lugar (nombre, duración, precio);
// se pueden quitar y agregar. Abajo, cómo se agenda y la seña.
import { useRef, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { MODO_LABEL, duracionTxt, type RubroTurnos } from '@/modules/turnos/datos'
import { Llave } from '@/modules/turnos/_shared/orbita/piezas'
import { MensajeError } from './campos'
import { DESCRIPCION_MODO, DURACIONES, type Errores, type ServicioAlta } from './modelo'

// Lo que tarda la animación de salida (tuobServSale): recién ahí se saca la fila.
const MS_SALIDA = 240
// Los porcentajes de seña a un toque; "Otro" deja escribir cualquiera.
const SENAS = [20, 30, 50]

interface Props {
  rubro: RubroTurnos
  servicios: ServicioAlta[]
  /** Recibe una función sobre la lista vigente (como setState): quitar una fila
   *  termina 240 ms después del clic y no tiene que pisar lo editado entretanto. */
  onCambio: (cambio: (s: ServicioAlta[]) => ServicioAlta[]) => void
  /** 0 = sin seña. */
  sena: number
  onSena: (pct: number) => void
  errores: Errores
  /** Ya se apretó "Continuar" en este paso: se muestran todos los errores. */
  intentado: boolean
}

export function PasoServicios({ rubro, servicios, onCambio, sena, onSena, errores, intentado }: Props) {
  const [saliendo, setSaliendo] = useState<string[]>([])
  const [tocados, setTocados] = useState<string[]>([])
  const contador = useRef(0)
  const lista = useRef<HTMLUListElement>(null)

  const editar = (id: string, cambio: Partial<ServicioAlta>) => onCambio(l => l.map(s => (s.id === id ? { ...s, ...cambio } : s)))

  const quitar = (id: string) => {
    setSaliendo(x => [...x, id])
    window.setTimeout(() => {
      onCambio(l => l.filter(s => s.id !== id))
      setSaliendo(x => x.filter(y => y !== id))
    }, MS_SALIDA)
  }

  const agregar = () => {
    contador.current += 1
    const id = `nuevo-${contador.current}`
    onCambio(l => [...l, { id, nombre: '', duracion: 30, precio: 0 }])
    // El foco va al nombre del servicio nuevo, que recién existe en el próximo pintado.
    requestAnimationFrame(() => lista.current?.querySelector<HTMLInputElement>(`#tuob-serv-${id}-nombre`)?.focus())
  }

  const senaBase = rubro.sena || 20
  // "Otro" abre un campo para escribir el porcentaje. Si la seña guardada no es una de las tres, ya arranca abierto.
  const [otra, setOtra] = useState(sena > 0 && !SENAS.includes(sena))

  return (
    <div className="tuob-ancho tuob-ancho--form" style={{ maxWidth: 860 }}>
      <ul className="tuob-serv-lista" ref={lista}>
        {servicios.map(s => {
          const error = (intentado || tocados.includes(s.id)) ? errores[`servicio-${s.id}`] : undefined
          const duraciones = DURACIONES.includes(s.duracion) ? DURACIONES : [...DURACIONES, s.duracion].sort((a, b) => a - b)
          const base = `tuob-serv-${s.id}`
          return (
            <li key={s.id} className="tuob-serv" data-saliendo={saliendo.includes(s.id)}>
              <div className="tuob-campo">
                <label htmlFor={`${base}-nombre`}>Servicio</label>
                <input id={`${base}-nombre`} className="tuob-input" value={s.nombre} placeholder="Ej: Corte clásico" maxLength={60}
                  onChange={e => editar(s.id, { nombre: e.target.value })}
                  onBlur={() => setTocados(t => (t.includes(s.id) ? t : [...t, s.id]))}
                  aria-invalid={error ? true : undefined} aria-describedby={error ? `${base}-error` : undefined} />
                {error && <MensajeError id={`${base}-error`}>{error}</MensajeError>}
              </div>
              <div className="tuob-campo">
                <label htmlFor={`${base}-duracion`}>Duración</label>
                <select id={`${base}-duracion`} className="tuob-input tuob-input--mono" value={s.duracion} onChange={e => editar(s.id, { duracion: Number(e.target.value) })}>
                  {duraciones.map(d => <option key={d} value={d}>{duracionTxt(d)}</option>)}
                </select>
              </div>
              <div className="tuob-campo">
                <label htmlFor={`${base}-precio`}>Precio</label>
                <span className="tuob-control">
                  <span className="tuob-prefijo" aria-hidden>$</span>
                  <input id={`${base}-precio`} className="tuob-input tuob-input--prefijo tuob-input--mono" inputMode="numeric" autoComplete="off"
                    value={s.precio === 0 ? '' : s.precio.toLocaleString('es-AR')} placeholder="Sin cargo"
                    onChange={e => editar(s.id, { precio: Math.min(99_999_999, Number(e.target.value.replace(/\D/g, '')) || 0) })} />
                </span>
              </div>
              <button type="button" className="tuob-quitar" onClick={() => quitar(s.id)} aria-label={`Quitar ${s.nombre || 'servicio sin nombre'}`} title="Quitar">
                <Trash2 size={17} strokeWidth={1.8} aria-hidden />
              </button>
            </li>
          )
        })}
      </ul>

      {intentado && errores.servicios && <div style={{ marginTop: 10 }}><MensajeError id="tuob-servicios-error">{errores.servicios}</MensajeError></div>}

      <button type="button" className="tuob-agregar" onClick={agregar}>
        <Plus size={17} aria-hidden /> Agregar otro servicio
      </button>

      <div className="tuob-dupla">
        <div className="tuob-caja">
          <span className="tuo-rotulo">Cómo se agenda</span>
          <strong>{MODO_LABEL[rubro.modo]}</strong>
          <p>{DESCRIPCION_MODO[rubro.modo]}</p>
        </div>
        <div className="tuob-caja">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <span className="tuo-rotulo">Seña al reservar</span>
            <Llave on={sena > 0} onChange={v => onSena(v ? senaBase : 0)} label="Pedir seña al reservar" />
          </div>
          <strong>{sena > 0 ? `Pedir ${sena}% por adelantado` : 'Sin seña'}</strong>
          <p>Baja las ausencias. Se cobra con Mercado Pago al confirmar el turno.</p>
          {sena > 0 && (
            <div className="tuo-entra" style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginTop: 12 }}>
              <div className="tuo-seg" role="group" aria-label="Porcentaje de la seña">
                {SENAS.map(p => <button key={p} type="button" aria-pressed={!otra && sena === p} onClick={() => { setOtra(false); onSena(p) }} className="tuo-num">{p}%</button>)}
                <button type="button" aria-pressed={otra} onClick={() => { setOtra(true); requestAnimationFrame(() => document.getElementById('tuob-sena-otra')?.focus()) }}>Otro</button>
              </div>
              {otra && (
                <label htmlFor="tuob-sena-otra" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 14, color: 'var(--color-muted)' }}>
                  <span className="tuc-sr" style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>Otro porcentaje de seña</span>
                  <input id="tuob-sena-otra" className="tuob-input tuob-input--mono" inputMode="numeric" autoComplete="off" maxLength={3} style={{ width: 76, textAlign: 'right' }}
                    value={String(sena)} onChange={e => onSena(Math.min(100, Math.max(1, Number(e.target.value.replace(/\D/g, '')) || 1)))} />
                  %
                </label>
              )}
            </div>
          )}
          {sena > 0 && otra && <p style={{ marginTop: 8 }}>Entre 1% y 100% del precio de cada servicio.</p>}
        </div>
      </div>
    </div>
  )
}
