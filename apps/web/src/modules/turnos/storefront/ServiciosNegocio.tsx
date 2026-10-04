// Servicios y precios del negocio: el catálogo completo, con buscador, filtros
// por duración y un detalle desplegable por servicio (quién lo hace, seña,
// dónde) con el atajo a reservar ESE servicio.
//
// La cabecera repite el "próximo turno libre" de la portada: quien llega acá
// desde un link directo también tiene la reserva a un toque. Los estilos
// (prefijo tus-) están en estilos.ts.
import { useId, useMemo, useState } from 'react'
import Link from 'next/link'
import { Search, Clock, ChevronDown, ArrowRight, Coins, X, MapPin, Users, MessageCircle, SearchX } from 'lucide-react'
import { pesos, duracionTxt, recursosDe, type RubroTurnos } from '@/modules/turnos/datos'
import SitioNegocio from './SitioNegocio'
import { CSS_SERVICIOS } from './estilos'
import { AnillosTema, Foto, Precio, ProximoLibre, Reveal, ruta } from './piezas'
import { useContacto } from './ContactoDemo'
import { RETRATOS, type TemaNegocio } from './tema'

export default function ServiciosNegocio({ rubro }: { rubro: RubroTurnos }) {
  return (
    <SitioNegocio rubro={rubro} pagina="servicios">
      {t => <Catalogo rubro={rubro} t={t} />}
    </SitioNegocio>
  )
}

const FILTROS = [
  { id: 'todos', label: 'Todos', ok: () => true },
  { id: 'cortos', label: 'Hasta 30 min', ok: (d: number) => d <= 30 },
  { id: 'medios', label: '30 min a 1 h', ok: (d: number) => d > 30 && d <= 60 },
  { id: 'largos', label: 'Más de 1 h', ok: (d: number) => d > 60 },
] as const
type FiltroId = (typeof FILTROS)[number]['id']

// Sin acentos ni mayúsculas: "ceramica" tiene que encontrar "Taller de cerámica".
const plano = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')

function Catalogo({ rubro, t }: { rubro: RubroTurnos; t: TemaNegocio }) {
  const [q, setQ] = useState('')
  const [f, setF] = useState<FiltroId>('todos')
  const [abierto, setAbierto] = useState<number | null>(0)
  const base = useId()
  const contactar = useContacto()
  const equipo = useMemo(() => recursosDe(rubro), [rubro])

  const todos = rubro.servicios.map((s, i) => ({ s, i }))
  const porTexto = todos.filter(({ s }) => plano(s.nombre).includes(plano(q.trim())))
  const filtro = FILTROS.find(x => x.id === f)!
  const lista = porTexto.filter(({ s }) => filtro.ok(s.duracion))
  // Los filtros sin resultados no se ofrecen (salvo el que está activo).
  const filtros = FILTROS.map(x => ({ ...x, n: porTexto.filter(({ s }) => x.ok(s.duracion)).length })).filter(x => x.id === 'todos' || x.n > 0 || x.id === f)

  const pagos = rubro.servicios.filter(s => s.precio > 0)
  const desde = pagos.length ? Math.min(...pagos.map(s => s.precio)) : 0
  const durMin = Math.min(...rubro.servicios.map(s => s.duracion))
  const cosa = rubro.modo === 'cupo' ? 'actividades' : 'servicios'
  const limpiar = () => { setQ(''); setF('todos') }

  return (
    <>
      <style>{CSS_SERVICIOS}</style>

      <section className="tus-cab">
        <div aria-hidden className="tus-cab-luz" />
        <AnillosTema size={520} className="tus-cab-anillos" />
        <div className="tu-cont tus-cab-grid">
          <div>
            <div className="tu-eyebrow tu-eyebrow--raya tu-entra">{t.nombre} · {rubro.label}</div>
            <h1 className="tu-h tu-h1">
              <span className="tu-linea"><span>{rubro.modo === 'cupo' ? 'Actividades' : 'Servicios'}</span></span>{' '}
              <span className="tu-linea"><span style={{ animationDelay: '140ms' }}><em>y precios</em></span></span>
            </h1>
            <p className="tu-entra" style={{ ['--i' as string]: 3 }}>
              Precios finales{rubro.sena ? <>. Para reservar se pide una seña del <span className="tu-num">{rubro.sena}%</span>, que se descuenta del total</> : ''}. Tocá {rubro.modo === 'cupo' ? 'una actividad' : 'un servicio'} para ver el detalle y reservarlo.
            </p>
            <dl className="tus-resumen tu-entra" style={{ ['--i' as string]: 4 }}>
              <div><dd className="tu-num">{rubro.servicios.length}</dd><dt className="tu-rotulo">{cosa}</dt></div>
              {desde > 0 && <div><dd className="tu-num">{pesos(desde)}</dd><dt className="tu-rotulo">desde</dt></div>}
              <div><dd className="tu-num">{duracionTxt(durMin)}</dd><dt className="tu-rotulo">el más corto</dt></div>
            </dl>
          </div>
          <div className="tu-entra" style={{ ['--i' as string]: 5 }}><ProximoLibre rubro={rubro} /></div>
        </div>
      </section>

      <div className="tus-barra">
        <div className="tu-cont tus-barra-in">
          <label className="tus-buscar">
            <Search size={18} aria-hidden />
            <input type="search" value={q} onChange={e => setQ(e.target.value)} placeholder={`Buscar entre ${rubro.servicios.length} ${cosa}`} aria-label={`Buscar ${cosa}`} enterKeyHint="search" />
            {q && <button type="button" className="tus-limpiar" onClick={() => setQ('')} aria-label="Borrar la búsqueda"><X size={17} aria-hidden /></button>}
          </label>
          <div className="tus-filtros" role="group" aria-label="Filtrar por duración">
            {filtros.map(x => (
              <button key={x.id} type="button" className="tus-filtro" onClick={() => setF(x.id)} aria-pressed={f === x.id}>
                {x.label} <span className="tu-num" aria-hidden>{x.n}</span>
              </button>
            ))}
          </div>
          <span className="tus-cuenta" role="status"><span className="tu-num">{lista.length}</span> de <span className="tu-num">{rubro.servicios.length}</span></span>
        </div>
      </div>

      <div className="tu-cont" style={{ paddingBottom: 24 }}>
        {lista.length === 0 ? (
          <div className="tu-card tus-vacio">
            <SearchX size={34} aria-hidden style={{ color: t.c.primary }} />
            <div className="tu-h">No encontramos nada con esa búsqueda</div>
            <p style={{ margin: 0, maxWidth: '44ch' }}>Probá con otra palabra o sacá el filtro de duración.</p>
            <button type="button" className="tu-btn-sec" onClick={limpiar}>Ver todo</button>
          </div>
        ) : (
          <ul className="tus-lista">
            {lista.map(({ s, i }, k) => {
              const open = abierto === i
              const foto = t.galeria[i % t.galeria.length]
              const quienes = equipo.filter((_, j) => (j + i) % 3 !== 2)
              const sena = rubro.sena > 0 && s.precio > 0 ? Math.round(s.precio * rubro.sena / 100) : 0
              return (
                <li key={s.nombre}>
                  <Reveal delay={Math.min(k, 6) * 50}>
                    <div className="tu-card tu-spot tus-item" data-abierto={open}>
                      <button type="button" className="tus-cabecera" onClick={() => setAbierto(open ? null : i)} aria-expanded={open} aria-controls={`${base}-${i}`}>
                        <Foto src={foto} alt="" className="tus-foto" />
                        <span style={{ minWidth: 0 }}>
                          <span className="tu-h tus-nombre">{s.nombre}</span>
                          <span className="tus-meta">
                            <span><Clock size={14} aria-hidden /> <span className="tu-num">{duracionTxt(s.duracion)}</span></span>
                            {sena > 0 && <span><Coins size={14} aria-hidden /> Seña <span className="tu-num">{pesos(sena)}</span></span>}
                          </span>
                        </span>
                        <span className="tus-precio">
                          <Precio valor={s.precio} size={21} />
                          {s.precio > 0 && <span className="tu-rotulo">final</span>}
                        </span>
                        <span className="tus-flecha" aria-hidden><ChevronDown size={20} /></span>
                      </button>
                      <div id={`${base}-${i}`} className="tus-panel" aria-hidden={!open}>
                        <div>
                          <div className="tus-det">
                            <div>
                              <p>
                                {s.precio > 0
                                  ? sena > 0 ? <>Reservás con <span className="tu-num">{pesos(sena)}</span> de seña y el resto lo pagás en el lugar.</> : 'No hace falta pagar nada para reservar: se paga en el lugar.'
                                  : 'No tiene costo: solo hay que reservar el lugar.'}
                              </p>
                              <div className="tus-datos">
                                {rubro.modo === 'profesional' && (
                                  <span>
                                    <span className="tus-caras" aria-hidden>
                                      {/* eslint-disable-next-line @next/next/no-img-element -- demo local */}
                                      {quienes.map(r => <img key={r.id} src={RETRATOS[equipo.indexOf(r) % RETRATOS.length]} alt="" />)}
                                    </span>
                                    Con {quienes.map(r => r.nombre.split(' ')[0]).join(' o ')}
                                  </span>
                                )}
                                {rubro.modo === 'cupo' && <span><Users size={16} aria-hidden /> Clase grupal con cupo</span>}
                                {(rubro.modo === 'recurso' || rubro.modo === 'cancha') && <span><Users size={16} aria-hidden /> {equipo.map(r => r.nombre).join(', ')}</span>}
                                <span><MapPin size={16} aria-hidden /> {t.direccion}</span>
                              </div>
                            </div>
                            <Link href={ruta('reserva', rubro.key, { servicio: i })} className="tu-btn" tabIndex={open ? 0 : -1}>Reservar <ArrowRight size={16} aria-hidden /></Link>
                          </div>
                        </div>
                      </div>
                    </div>
                  </Reveal>
                </li>
              )
            })}
          </ul>
        )}

        <Reveal>
          <div className="tu-card tus-final">
            <div>
              <div className="tu-h">¿No sabés cuál elegir?</div>
              <p>Escribinos y te orientamos antes de reservar.</p>
            </div>
            <button type="button" className="tu-btn-sec" onClick={() => contactar({ canal: 'whatsapp', texto: `Hola ${t.nombre}, quiero reservar y no sé qué ${rubro.modo === 'cupo' ? 'actividad' : 'servicio'} elegir.` })}><MessageCircle size={17} aria-hidden /> WhatsApp</button>
            <Link href={ruta('reserva', rubro.key)} className="tu-btn">Ir a reservar <ArrowRight size={16} aria-hidden /></Link>
          </div>
        </Reveal>
      </div>
    </>
  )
}
