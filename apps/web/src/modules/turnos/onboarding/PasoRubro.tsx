// Paso 1 del alta: elegir el rubro. A la izquierda los 32 rubros con buscador y
// filtro por familia; al costado (abajo en celular) el panel "así va a quedar
// tu agenda", que muestra qué cambia según lo que se elige: cómo se agenda, la
// seña sugerida y los servicios con los que arranca.
import { useMemo, useState } from 'react'
import { CalendarClock, Check, Coins, Search, SearchX, Users } from 'lucide-react'
import { FAMILIAS, RUBROS_TURNOS, MODO_LABEL, pesos, duracionTxt, recursosDe, turnosDe, clientesDe, type FamiliaId, type RubroTurnos } from '@/modules/turnos/datos'
import { OrbitaDia } from '@/modules/turnos/_shared/orbita/OrbitaDia'
import { AHORA_DEMO } from '@/modules/turnos/_shared/components/ChipEstado'
import { DESCRIPCION_MODO, plano } from './modelo'

const FAMILIA_CORTA: Record<FamiliaId, string> = { belleza: 'Belleza', salud: 'Salud', deporte: 'Deporte', clases: 'Clases' }

export function PasoRubro({ elegido, onElegir }: { elegido: RubroTurnos | null; onElegir: (r: RubroTurnos) => void }) {
  const [busqueda, setBusqueda] = useState('')
  const [familia, setFamilia] = useState<'todas' | FamiliaId>('todas')

  const visibles = useMemo(() => {
    const q = plano(busqueda.trim())
    return RUBROS_TURNOS.filter(r =>
      (familia === 'todas' || r.familia === familia) &&
      (!q || plano(`${r.label} ${r.descripcion} ${r.servicios.map(s => s.nombre).join(' ')}`).includes(q)))
  }, [busqueda, familia])

  return (
    <div className="tuob-ancho">
      <div className="tuob-rubro-grid">
        <div style={{ minWidth: 0 }}>
          <div className="tuob-filtros">
            <label className="tuo-buscar">
              <Search size={16} aria-hidden />
              <input type="search" value={busqueda} onChange={e => setBusqueda(e.target.value)} placeholder="Buscá tu rubro: barbería, pádel, yoga…" aria-label="Buscar rubro" />
            </label>
            <div className="tuob-seg-scroll">
              <div className="tuo-seg" role="group" aria-label="Filtrar por familia">
                <button type="button" aria-pressed={familia === 'todas'} onClick={() => setFamilia('todas')}>Todos</button>
                {FAMILIAS.map(f => (
                  <button key={f.id} type="button" aria-pressed={familia === f.id} onClick={() => setFamilia(f.id)}>
                    <f.Icon size={14} strokeWidth={1.8} aria-hidden /> {FAMILIA_CORTA[f.id]}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <p role="status" aria-live="polite" style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>
            {visibles.length} rubros a la vista.
          </p>

          {visibles.length === 0 ? (
            <div className="tuob-vacio">
              <SearchX size={26} strokeWidth={1.6} aria-hidden />
              <div className="tuo-h2">No encontramos “{busqueda.trim()}”</div>
              <p style={{ margin: 0, fontSize: 13 }}>Probá con otra palabra o elegí el rubro más parecido: después podés cambiar todo.</p>
              <button type="button" className="tuo-btn tuo-btn--sm" onClick={() => { setBusqueda(''); setFamilia('todas') }}>Ver todos los rubros</button>
            </div>
          ) : FAMILIAS.map(f => {
            const lista = visibles.filter(r => r.familia === f.id)
            if (!lista.length) return null
            return (
              <section key={f.id} className="tuob-grupo" aria-label={f.label}>
                <h2 className="tuob-familia tuo-rotulo">{f.label}</h2>
                <div className="tuob-rubros">
                  {lista.map(r => {
                    const sel = elegido?.key === r.key
                    return (
                      <button key={r.key} type="button" className="tuob-rubro" aria-pressed={sel} onClick={() => onElegir(r)}>
                        {sel && <span className="tuob-tilde" aria-hidden><Check size={13} strokeWidth={3.2} /></span>}
                        <span className="tuob-rubro-icono"><r.Icon size={20} strokeWidth={1.75} aria-hidden /></span>
                        <b>{r.label}</b>
                        <small>{r.descripcion}</small>
                      </button>
                    )
                  })}
                </div>
              </section>
            )
          })}
        </div>

        <aside id="tuob-previa" className="tuob-previa" aria-label="Así va a quedar tu agenda">
          <div className="tuo-eyebrow">Así va a quedar tu agenda</div>
          {elegido ? <Previa key={elegido.key} rubro={elegido} /> : (
            <div className="tuob-previa-hueco">
              <svg width="132" height="132" viewBox="0 0 132 132" aria-hidden>
                <circle cx="66" cy="66" r="60" fill="none" stroke="rgba(147,197,253,0.22)" strokeDasharray="2 7" />
                <circle cx="66" cy="66" r="42" fill="none" stroke="rgba(147,197,253,0.16)" strokeWidth="8" />
                <circle cx="66" cy="66" r="24" fill="none" stroke="rgba(147,197,253,0.12)" strokeWidth="8" />
                <circle cx="66" cy="6" r="4" fill="#BFDBFE" />
              </svg>
              <div className="tuo-h2">Elegí un rubro</div>
              <p style={{ margin: 0, fontSize: 13, lineHeight: 1.55, color: 'var(--color-muted)', maxWidth: 260 }}>
                Acá vas a ver cómo se agenda, la seña sugerida y los servicios con los que arranca.
              </p>
            </div>
          )}
        </aside>
      </div>
    </div>
  )
}

function Previa({ rubro }: { rubro: RubroTurnos }) {
  const recursos = recursosDe(rubro)
  const clientes = clientesDe(rubro)
  return (
    <div className="tuob-previa-cuerpo">
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 14 }}>
        <span className="tuob-rubro-icono" style={{ margin: 0, background: 'var(--tuo-grad)', color: '#fff', borderColor: 'transparent' }}><rubro.Icon size={20} strokeWidth={1.75} aria-hidden /></span>
        <div style={{ minWidth: 0 }}>
          <div className="tuo-h2" style={{ fontSize: 17 }}>{rubro.label}</div>
          <div style={{ fontSize: 12.5, color: 'var(--color-muted)', marginTop: 2 }}>{rubro.descripcion}</div>
        </div>
      </div>

      {/* El dial acá es una ilustración: inert lo saca del orden de tabulación
          (son 13 tramos enfocables) y del lector de pantalla, que ya tiene los
          mismos datos en texto justo abajo. */}
      <div className="tuob-previa-dial" inert aria-hidden>
        <OrbitaDia recursos={recursos} turnos={turnosDe(rubro)} ahora={AHORA_DEMO} nombreCliente={id => clientes.find(c => c.id === id)?.nombre ?? ''} pie="día de ejemplo" size={204} />
      </div>

      <div className="tuob-dato">
        <CalendarClock size={18} strokeWidth={1.8} aria-hidden />
        <div>
          <span className="tuo-rotulo">Cómo se agenda</span>
          <strong>{MODO_LABEL[rubro.modo]}</strong>
          <p>{DESCRIPCION_MODO[rubro.modo]}</p>
        </div>
      </div>
      <div className="tuob-dato">
        <Users size={18} strokeWidth={1.8} aria-hidden />
        <div>
          <span className="tuo-rotulo">Quién atiende y quién reserva</span>
          <strong>{rubro.profesional} · {rubro.cliente}</strong>
          <p>El panel y la página de reservas usan esas palabras.</p>
        </div>
      </div>
      <div className="tuob-dato">
        <Coins size={18} strokeWidth={1.8} aria-hidden />
        <div>
          <span className="tuo-rotulo">Seña sugerida</span>
          <strong>{rubro.sena ? `${rubro.sena}% al reservar` : 'Sin seña'}</strong>
          <p>{rubro.sena ? 'Se cobra con Mercado Pago al confirmar el turno. La podés sacar o cambiar.' : 'En este rubro no se suele pedir. La podés activar en el paso siguiente.'}</p>
        </div>
      </div>
      <ul className="tuob-mini-serv" aria-label="Servicios típicos">
        {rubro.servicios.slice(0, 4).map(s => (
          <li key={s.nombre}>
            <span>{s.nombre}</span>
            <span className="tuo-num" style={{ color: 'var(--color-muted)', whiteSpace: 'nowrap', fontSize: 12 }}>{duracionTxt(s.duracion)} · {pesos(s.precio)}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
