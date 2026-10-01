// "Ubicación": dónde atiende el negocio. Igual que el alta real de Tienda, se
// puede marcar más de una opción y, si hay un local, se ubica en el mapa
// (búsqueda con Nominatim y marcador que se arrastra). Turnos suma lo suyo:
// a domicilio pide las zonas, y abajo van los días y los horarios de atención,
// partidos en mañana y tarde (cada turno se prende, se apaga y se ajusta).
import { useRef, useState } from 'react'
import { Check, CircleAlert, Globe, Home, LoaderCircle, LocateFixed, MapPin, Search, Sun, Sunset, type LucideIcon } from 'lucide-react'
import { MapPicker } from '@/components/MapPicker'
import { DIAS, DIAS_CORTOS, type RubroTurnos } from '@/modules/turnos/datos'
import type { Modalidad } from '@/modules/turnos/demo/negocioDemo'
import { MEDIAS_HORAS, corteDe, hhmm, tramosDeJornada, type Bloque } from '@/modules/turnos/horario'
import { Llave } from '@/modules/turnos/_shared/orbita/piezas'
import { Aviso, Casilla, Entrada, MensajeError, type PropsPaso } from './campos'
import { modalidadesAlta, modalidadesOfrecidas, type Modulo } from './modelo'

const OPCIONES: Record<Modulo, Record<Modalidad, { Icon: LucideIcon; titulo: string; texto: string }>> = {
  turnos: {
    local: { Icon: MapPin, titulo: 'En mi local', texto: 'Tengo un lugar donde recibo a mis clientes.' },
    domicilio: { Icon: Home, titulo: 'A domicilio', texto: 'Voy yo a la casa o al lugar del cliente.' },
  },
  tienda: {
    local: { Icon: MapPin, titulo: 'Local físico', texto: 'Tengo un local, showroom o depósito propio.' },
    domicilio: { Icon: Globe, titulo: 'Online / A domicilio', texto: 'Vendo por internet y envío o entrego los pedidos.' },
  },
}

type Busqueda = 'quieto' | 'buscando' | 'ubicando' | 'ok' | 'sin-resultado' | 'sin-conexion' | 'sin-permiso'
const MENSAJE: Record<Busqueda, string> = {
  quieto: 'Buscá la dirección o arrastrá el marcador hasta tu puerta.',
  buscando: 'Buscando la dirección…',
  ubicando: 'Obteniendo tu ubicación…',
  ok: 'Listo. Si no quedó exacto, arrastrá el marcador.',
  'sin-resultado': 'No encontramos esa dirección. Revisala o arrastrá el marcador a mano.',
  'sin-conexion': 'No pudimos buscar la dirección. Podés arrastrar el marcador a mano.',
  'sin-permiso': 'No pudimos acceder a tu ubicación. Escribí la dirección o arrastrá el marcador.',
}

/** Dirección del local + mapa. La dirección se guarda corta (calle y número) y el barrio aparte: así sale en la página. */
function Direccion({ d, poner, error, tocar }: PropsPaso) {
  const [estado, setEstado] = useState<Busqueda>('quieto')
  // Última consulta resuelta: salir del campo sin cambiar nada no vuelve a buscar.
  const ultima = useRef('')
  const ocupado = estado === 'buscando' || estado === 'ubicando'

  const buscar = async () => {
    const q = [d.direccion.trim(), d.ciudad.trim()].filter(Boolean).join(', ')
    if (d.direccion.trim().length < 4 || q === ultima.current) return
    ultima.current = q
    setEstado('buscando')
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&countrycodes=ar&limit=1`)
      const [hit] = (await res.json()) as { lat: string; lon: string }[]
      if (hit) { poner('latLng', [+hit.lat, +hit.lon]); setEstado('ok') } else setEstado('sin-resultado')
    } catch { setEstado('sin-conexion') }
  }

  const ubicarme = () => {
    if (!navigator.geolocation) { setEstado('sin-permiso'); return }
    setEstado('ubicando')
    navigator.geolocation.getCurrentPosition(async pos => {
      const latLng: [number, number] = [pos.coords.latitude, pos.coords.longitude]
      poner('latLng', latLng)
      try {
        const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&addressdetails=1&lat=${latLng[0]}&lon=${latLng[1]}`)
        const a = ((await res.json()) as { address?: Record<string, string> }).address ?? {}
        const calle = [a.road, a.house_number].filter(Boolean).join(' ')
        const zona = [a.suburb ?? a.neighbourhood ?? a.city_district, a.city ?? a.town ?? a.village].filter(Boolean).join(', ')
        if (calle) poner('direccion', calle)
        if (zona) poner('ciudad', zona)
        ultima.current = [calle, zona].filter(Boolean).join(', ')
      } catch { /* sin nombre de calle, pero el marcador ya quedó en su lugar */ }
      setEstado('ok')
    }, () => setEstado('sin-permiso'), { timeout: 8000 })
  }

  return (
    <div className="tuob-bloque tuo-entra">
      <div className="tuob-fila2">
        <Entrada id="tuob-direccion" label="Dirección" valor={d.direccion} onCambio={v => poner('direccion', v)} onTocar={() => { tocar('direccion'); buscar() }}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); buscar() } }}
          error={error('direccion')} placeholder="Av. Corrientes 1234" autoComplete="street-address" required />
        <Entrada id="tuob-ciudad" label="Barrio o ciudad" opcional valor={d.ciudad} onCambio={v => poner('ciudad', v)} onTocar={buscar}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); buscar() } }}
          placeholder="Palermo, CABA" autoComplete="address-level2" />
      </div>
      <div className="tuob-mapa">
        <div className="tuob-mapa-barra">
          <button type="button" className="tuo-btn tuo-btn--sm" onClick={buscar} disabled={ocupado || d.direccion.trim().length < 4}><Search size={14} aria-hidden /> Buscar en el mapa</button>
          <button type="button" className="tuo-btn tuo-btn--sm" onClick={ubicarme} disabled={ocupado}><LocateFixed size={14} aria-hidden /> Usar mi ubicación</button>
          <span className="tuob-mapa-estado" role="status" data-tono={estado === 'ok' ? 'ok' : estado.startsWith('sin') ? 'aviso' : undefined}>
            {ocupado ? <LoaderCircle size={14} className="tuob-girando" aria-hidden /> : estado === 'ok' ? <Check size={14} strokeWidth={3} aria-hidden /> : estado === 'quieto' ? null : <CircleAlert size={14} aria-hidden />}
            {MENSAJE[estado]}
          </span>
        </div>
        <MapPicker center={d.latLng} onDragEnd={latLng => poner('latLng', latLng)} />
      </div>
    </div>
  )
}

const TURNOS = [
  { id: 'manana', Icon: Sun, titulo: 'Mañana' },
  { id: 'tarde', Icon: Sunset, titulo: 'Tarde' },
] as const

/** Un turno de atención (la mañana o la tarde): se prende o se apaga y lleva su "de… a…". */
function Turno({ id, Icon, titulo, bloque, onCambio }: { id: string; Icon: LucideIcon; titulo: string; bloque: Bloque; onCambio: (b: Bloque) => void }) {
  return (
    <div className="tuob-turno" data-on={bloque.on}>
      <span className="tuob-turno-ico" aria-hidden><Icon size={18} strokeWidth={1.8} /></span>
      <strong id={`tuob-${id}-tit`}>{titulo}</strong>
      {bloque.on ? (
        <div className="tuob-turno-horas">
          <label className="tuob-sr" htmlFor={`tuob-${id}-desde`}>{titulo}: abrís a las</label>
          <select id={`tuob-${id}-desde`} className="tuob-input tuob-input--mono" value={bloque.desde} onChange={e => onCambio({ ...bloque, desde: Number(e.target.value) })}>
            {MEDIAS_HORAS.map(m => <option key={m} value={m}>{hhmm(m)}</option>)}
          </select>
          <span aria-hidden>a</span>
          <label className="tuob-sr" htmlFor={`tuob-${id}-hasta`}>{titulo}: cerrás a las</label>
          <select id={`tuob-${id}-hasta`} className="tuob-input tuob-input--mono" value={bloque.hasta} onChange={e => onCambio({ ...bloque, hasta: Number(e.target.value) })}>
            {MEDIAS_HORAS.map(m => <option key={m} value={m}>{hhmm(m)}</option>)}
          </select>
        </div>
      ) : <span className="tuob-turno-off">No atendés a la {titulo.toLowerCase()}</span>}
      <Llave on={bloque.on} onChange={v => onCambio({ ...bloque, on: v })} label={`Atender a la ${titulo.toLowerCase()}`} />
    </div>
  )
}

export function PasoUbicacion({ d, poner, error, tocar, rubro }: PropsPaso & { rubro: RubroTurnos | null }) {
  const modulo: Modulo = d.modulo ?? 'tienda'
  const turnos = modulo === 'turnos'
  const ofrecidas = modalidadesOfrecidas(d, rubro)
  const marcadas = modalidadesAlta(d, rubro)
  const unica = ofrecidas.length === 1
  const alternar = (m: Modalidad) => { poner('modalidades', marcadas.includes(m) ? marcadas.filter(x => x !== m) : [...marcadas, m]); tocar('modalidades') }
  const alternarDia = (dia: number) => poner('dias', d.dias.includes(dia) ? d.dias.filter(x => x !== dia) : [...d.dias, dia].sort((a, b) => a - b))
  const errorModalidades = error('modalidades')
  const errorDias = error('dias')
  const errorHorario = error('horario')
  const local = marcadas.includes('local')
  const remoto = marcadas.includes('domicilio')
  const corte = corteDe(tramosDeJornada(d.jornada))

  return (
    <div className="tuob-ancho tuob-ancho--form">
      <div style={{ display: 'grid', gap: 14 }}>
        <div className="tuob-form">
          <fieldset className="tuob-campo" aria-describedby={errorModalidades ? 'tuob-modalidades-error' : undefined}>
            <legend className="tuob-leyenda">{turnos ? '¿Dónde atendés?' : '¿Dónde operás?'}</legend>
            <p className="tuob-ayuda" style={{ margin: '2px 0 5px' }}>
              {unica ? 'En tu rubro se atiende siempre en el lugar.' : turnos ? 'Marcá todas las que correspondan: tus clientes eligen al reservar.' : 'Podés elegir una opción o las dos.'}
            </p>
            <div className="tuob-opciones" data-n={ofrecidas.length}>
              {ofrecidas.map(m => {
                const o = OPCIONES[modulo][m]
                return <Casilla key={m} elegido={marcadas.includes(m)} onElegir={() => alternar(m)} Icon={o.Icon} titulo={o.titulo} texto={o.texto} deshabilitado={unica} />
              })}
            </div>
            {errorModalidades && <MensajeError id="tuob-modalidades-error">{errorModalidades}</MensajeError>}
          </fieldset>

          {local && <Direccion d={d} poner={poner} error={error} tocar={tocar} />}

          {turnos && marcadas.includes('domicilio') && (
            <div className="tuo-entra">
              <Entrada id="tuob-zonas" label="Zonas donde atendés a domicilio" valor={d.zonas} onCambio={v => poner('zonas', v)} onTocar={() => tocar('zonas')}
                error={error('zonas')} ayuda="Barrios o localidades, separados por coma. Es lo que ve tu cliente antes de reservar." placeholder="Palermo, Belgrano, Colegiales" maxLength={120} required />
            </div>
          )}

          {turnos && !local && remoto && (
            <Aviso Icon={MapPin}>Sin local, tu página no muestra una dirección: muestra las zonas donde atendés.</Aviso>
          )}
          {!turnos && remoto && (
            <Aviso tono="ok" Icon={Check}>
              <strong>{local ? 'Perfecto, también vendés de forma remota.' : 'Perfecto, tu negocio opera sin dirección fija.'}</strong>{' '}
              {local ? 'Vas a poder configurar zonas de envío o de entrega a domicilio desde tu panel.' : 'Podés agregar una dirección después, desde tu panel, si en algún momento abrís un local.'}
            </Aviso>
          )}
        </div>

        {turnos && (
          <div className="tuob-form">
            <fieldset className="tuob-campo" aria-describedby={errorDias ? 'tuob-dias-error' : undefined}>
              <legend className="tuob-leyenda" style={{ marginBottom: 7 }}>Días de atención</legend>
              <div className="tuob-dias">
                {DIAS.map((dia, i) => (
                  <button key={dia} type="button" className="tuob-dia" aria-pressed={d.dias.includes(i)} aria-label={dia} onClick={() => { alternarDia(i); tocar('dias') }}>{DIAS_CORTOS[i]}</button>
                ))}
              </div>
              {errorDias && <MensajeError id="tuob-dias-error">{errorDias}</MensajeError>}
            </fieldset>
            <fieldset className="tuob-campo" aria-describedby={errorHorario ? 'tuob-horario-error' : 'tuob-horario-ayuda'}>
              <legend className="tuob-leyenda" style={{ marginBottom: 7 }}>Horarios de atención</legend>
              <div className="tuob-turnos">
                {TURNOS.map(t => (
                  <Turno key={t.id} id={t.id} Icon={t.Icon} titulo={t.titulo} bloque={d.jornada[t.id]}
                    onCambio={b => { poner('jornada', { ...d.jornada, [t.id]: b }); tocar('horario') }} />
                ))}
              </div>
              {errorHorario
                ? <MensajeError id="tuob-horario-error">{errorHorario}</MensajeError>
                : (
                  <p id="tuob-horario-ayuda" className="tuob-ayuda">
                    {corte ? <>Cortás de <span className="tuo-num">{hhmm(corte[0])}</span> a <span className="tuo-num">{hhmm(corte[1])}</span>: en ese rato no se ofrecen turnos. </> : null}
                    Tus clientes solo reservan dentro de estos horarios. Después, en el panel, ponés uno distinto por día y por {rubro?.modo === 'profesional' ? 'profesional' : 'espacio'}.
                  </p>
                )}
            </fieldset>
          </div>
        )}
      </div>
    </div>
  )
}
