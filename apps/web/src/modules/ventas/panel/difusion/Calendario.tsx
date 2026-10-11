import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/router'
import { CalendarClock, ChevronLeft, ChevronRight, ExternalLink, Play, Plus } from 'lucide-react'
import { Button } from '@/design-system/components/Button'
import { Modal } from '@/design-system/components/Modal'
import {
  ApiError, getInstagramCalendario, getInstagramRendimiento,
  type InstagramEstado, type InstagramPublicacion, type InstagramRendimiento,
} from '@/lib/api'
import { Compuerta } from './Compuerta'
import { claveDeMes, cuando as formatoCuando, mismoDia, nombreCortoDelDia, nombreDelDia, nombreDelMes, semanasDelMes } from './fechaLocal'
import { CLAVE_RETOMAR } from './claves'

// Difusión → Calendario: lo publicado y lo programado de cada mes, de un vistazo. Tocar una publicación muestra su
// detalle (y deja editarla si todavía no salió); tocar un día libre abre el compositor con ese día ya elegido. Los
// días que mejor le funcionan a la cuenta (según sus números) se marcan en los encabezados.

interface Props {
  estado: InstagramEstado | null
  onAbrirConexion: () => void
}

export function Calendario({ estado, onAbrirConexion }: Props) {
  return (
    <Compuerta estado={estado} permiso="publicar" onAbrirConexion={onAbrirConexion}>
      {() => <Mes />}
    </Compuerta>
  )
}

const ORDEN_SEMANA = [1, 2, 3, 4, 5, 6, 0] // lunes primero
const HORA_POR_DEFECTO = 19
const MAX_POR_DIA = 3

const fechaDe = (p: InstagramPublicacion): Date => new Date(p.estado === 'SCHEDULED' && p.programadaPara ? p.programadaPara : p.createdAt)
const claveDeDia = (f: Date): string => `${f.getFullYear()}-${f.getMonth()}-${f.getDate()}`
const hora = (f: Date): string => `${String(f.getHours()).padStart(2, '0')}:${String(f.getMinutes()).padStart(2, '0')}`
const nombreDelTipo = (p: InstagramPublicacion): string => (p.elementos.length > 1 ? `Carrusel de ${p.elementos.length}` : p.elementos[0] === 'video' ? 'Reel' : 'Foto')

function Mes() {
  const router = useRouter()
  const hoy = useMemo(() => new Date(), [])
  const [visible, setVisible] = useState(() => new Date(hoy.getFullYear(), hoy.getMonth(), 1))
  const [publicaciones, setPublicaciones] = useState<InstagramPublicacion[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [cargando, setCargando] = useState(true)
  const [rendimiento, setRendimiento] = useState<InstagramRendimiento | null>(null)
  const [abierta, setAbierta] = useState<InstagramPublicacion | null>(null)
  const montado = useRef(true)
  useEffect(() => () => { montado.current = false }, [])

  const mes = claveDeMes(visible)
  const cargar = useCallback(async (clave: string) => {
    setCargando(true); setError(null)
    try {
      const r = await getInstagramCalendario(clave)
      if (montado.current) setPublicaciones(r)
    } catch (e) {
      if (montado.current) { setError(e instanceof ApiError ? e.message : 'No se pudo cargar el calendario. Probá de nuevo.'); setPublicaciones((p) => p ?? []) }
    } finally {
      if (montado.current) setCargando(false)
    }
  }, [])
  useEffect(() => { void cargar(mes) }, [cargar, mes])
  useEffect(() => { getInstagramRendimiento().then((r) => { if (montado.current) setRendimiento(r) }).catch(() => undefined) }, [])

  const porDia = useMemo(() => {
    const m = new Map<string, InstagramPublicacion[]>()
    for (const p of publicaciones ?? []) {
      const k = claveDeDia(fechaDe(p))
      m.set(k, [...(m.get(k) ?? []), p].sort((a, b) => fechaDe(a).getTime() - fechaDe(b).getTime()))
    }
    return m
  }, [publicaciones])

  const semanas = semanasDelMes(visible.getFullYear(), visible.getMonth())
  const mejoresDias = new Set(rendimiento?.suficiente ? rendimiento.mejoresDias.slice(0, 2).map((d) => d.clave) : [])
  const horaSugerida = rendimiento?.suficiente && rendimiento.mejoresHoras[0] ? rendimiento.mejoresHoras[0].clave + 1 : HORA_POR_DEFECTO

  const mover = (delta: number) => setVisible((v) => new Date(v.getFullYear(), v.getMonth() + delta, 1))
  const esMesActual = visible.getFullYear() === hoy.getFullYear() && visible.getMonth() === hoy.getMonth()

  // Un día libre se programa a la hora que mejor funciona; el de hoy, a partir de una hora más tarde.
  const programarEn = (dia: Date) => {
    let f = new Date(dia.getFullYear(), dia.getMonth(), dia.getDate(), horaSugerida, 0)
    const minimo = Date.now() + 60 * 60_000
    if (f.getTime() < minimo) f = new Date(minimo)
    void router.push({ query: { ...router.query, vista: 'publicaciones', cuando: f.toISOString() } })
  }
  const esFuturo = (dia: Date) => new Date(dia.getFullYear(), dia.getMonth(), dia.getDate(), 23, 59).getTime() > Date.now() + 60 * 60_000

  const editar = (p: InstagramPublicacion) => {
    try {
      window.sessionStorage.setItem(CLAVE_RETOMAR, JSON.stringify(p))
    } catch {
      /* sin almacenamiento: se abre Publicaciones y se retoma desde la lista */
    }
    void router.push({ query: { ...router.query, vista: 'publicaciones', retomar: '1' } })
  }

  const diasConPublicaciones = [...porDia.entries()]
    .map(([k, ps]) => ({ k, fecha: fechaDe(ps[0]), ps }))
    .sort((a, b) => a.fecha.getTime() - b.fecha.getTime())

  return (
    <div className="cal-raiz">
      <style>{CSS}</style>

      <div className="cal-cabecera">
        <div className="cal-navegacion">
          <button type="button" className="cal-flecha" onClick={() => mover(-1)} aria-label="Mes anterior"><ChevronLeft size={18} /></button>
          <h2 className="cal-mes" aria-live="polite">{nombreDelMes(visible.getMonth())} {visible.getFullYear()}</h2>
          <button type="button" className="cal-flecha" onClick={() => mover(1)} aria-label="Mes siguiente"><ChevronRight size={18} /></button>
          {!esMesActual && <button type="button" className="cal-hoy" onClick={() => setVisible(new Date(hoy.getFullYear(), hoy.getMonth(), 1))}>Hoy</button>}
        </div>
        <div className="cal-leyenda" aria-hidden>
          <span><i className="cal-punto cal-punto-publicada" /> Publicada</span>
          <span><i className="cal-punto cal-punto-programada" /> Programada</span>
        </div>
      </div>

      {rendimiento?.suficiente && mejoresDias.size > 0 && (
        <p className="cal-pista">
          Según tus números, tus seguidores reaccionan más los <strong>{[...mejoresDias].map(nombreDelDia).join(' y ')}</strong>. Esos días están marcados.
        </p>
      )}
      {error && <p className="cal-error" role="alert">{error}</p>}

      <div className={`cal-tabla${cargando ? ' cal-cargando' : ''}`} role="grid" aria-label={`Calendario de ${nombreDelMes(visible.getMonth())}`}>
        <div className="cal-encabezados" role="row">
          {ORDEN_SEMANA.map((d) => (
            <span key={d} role="columnheader" className={mejoresDias.has(d) ? 'cal-dia-mejor' : undefined}>
              {nombreCortoDelDia(d)}{mejoresDias.has(d) && <i aria-label="mejor día" className="cal-estrella">★</i>}
            </span>
          ))}
        </div>
        {semanas.map((semana, i) => (
          <div key={i} className="cal-semana" role="row">
            {semana.map((dia, j) => {
              if (!dia) return <div key={j} className="cal-celda cal-celda-vacia" role="gridcell" aria-hidden />
              const ps = porDia.get(claveDeDia(dia)) ?? []
              const esHoy = mismoDia(dia, hoy)
              return (
                <div key={j} className={`cal-celda${esHoy ? ' cal-celda-hoy' : ''}${mejoresDias.has(dia.getDay()) ? ' cal-celda-mejor' : ''}`} role="gridcell">
                  <div className="cal-celda-cabecera">
                    <span className="cal-numero">{dia.getDate()}</span>
                    {esFuturo(dia) && (
                      <button type="button" className="cal-agregar" onClick={() => programarEn(dia)} aria-label={`Programar una publicación el ${dia.getDate()} de ${nombreDelMes(dia.getMonth())}`}>
                        <Plus size={13} strokeWidth={2.5} />
                      </button>
                    )}
                  </div>
                  <ul className="cal-chips">
                    {ps.slice(0, MAX_POR_DIA).map((p) => (
                      <li key={p.id}>
                        <button type="button" className={`cal-chip cal-chip-${p.estado === 'SCHEDULED' ? 'programada' : p.estado === 'FAILED' ? 'fallo' : 'publicada'}`} onClick={() => setAbierta(p)}>
                          <span className="cal-chip-foto">{p.miniatura ? <img src={p.miniatura} alt="" /> : <Play size={9} aria-hidden />}</span>
                          <span className="cal-chip-hora">{hora(fechaDe(p))}</span>
                        </button>
                      </li>
                    ))}
                    {ps.length > MAX_POR_DIA && <li><button type="button" className="cal-mas" onClick={() => setAbierta(ps[MAX_POR_DIA])}>+{ps.length - MAX_POR_DIA} más</button></li>}
                  </ul>
                </div>
              )
            })}
          </div>
        ))}
      </div>

      {/* En el celular, una lista por día (una grilla de 7 columnas no entra) */}
      <div className="cal-agenda" aria-label="Agenda del mes">
        {publicaciones !== null && diasConPublicaciones.length === 0 && (
          <p className="cal-vacio">No hay publicaciones este mes. Tocá <strong>Nueva publicación</strong> para armar una.</p>
        )}
        {diasConPublicaciones.map(({ k, fecha, ps }) => (
          <section key={k} className="cal-agenda-dia">
            <h3>{nombreDelDia(fecha.getDay())} {fecha.getDate()}</h3>
            <ul>
              {ps.map((p) => (
                <li key={p.id}>
                  <button type="button" className="cal-agenda-fila" onClick={() => setAbierta(p)}>
                    <span className="cal-chip-foto cal-chip-foto-grande">{p.miniatura ? <img src={p.miniatura} alt="" /> : <Play size={12} aria-hidden />}</span>
                    <span className="cal-agenda-texto">
                      <span className="cal-agenda-titulo">{p.productName ?? (p.caption.split('\n')[0].slice(0, 50) || 'Publicación')}</span>
                      <span className="cal-agenda-sub">{hora(fechaDe(p))} · {nombreDelTipo(p)} · {p.estado === 'SCHEDULED' ? 'Programada' : p.estado === 'FAILED' ? 'No salió' : 'Publicada'}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      <div className="cal-pie">
        <Button onClick={() => void router.push({ query: { ...router.query, vista: 'publicaciones' } })} icon={<Plus size={15} aria-hidden />}>Nueva publicación</Button>
      </div>

      {abierta && <Detalle p={abierta} onCerrar={() => setAbierta(null)} onEditar={() => editar(abierta)} />}
    </div>
  )
}

function Detalle({ p, onCerrar, onEditar }: { p: InstagramPublicacion; onCerrar: () => void; onEditar: () => void }) {
  const f = fechaDe(p)
  const programada = p.estado === 'SCHEDULED'
  const borrador = p.estado === 'DRAFT'
  return (
    <Modal
      isOpen
      onClose={onCerrar}
      title={programada ? 'Publicación programada' : p.estado === 'FAILED' ? 'No salió' : 'Publicación'}
      maxWidth={460}
      footer={(
        <>
          <Button variant="secondary" onClick={onCerrar}>Cerrar</Button>
          {programada && <Button onClick={onEditar}>Editar</Button>}
          {p.estado === 'PUBLISHED' && p.permalink && (
            <a className="cal-boton-enlace" href={p.permalink} target="_blank" rel="noopener noreferrer">Ver en Instagram <ExternalLink size={13} aria-hidden /></a>
          )}
        </>
      )}
    >
      <div className="cal-detalle">
        <span className="cal-detalle-foto">{p.miniatura ? <img src={p.miniatura} alt="" /> : <Play size={20} aria-hidden />}</span>
        <div className="cal-detalle-datos">
          <p className="cal-detalle-titulo">{p.productName ?? 'Sin producto'}</p>
          <p className="cal-detalle-sub">{nombreDelTipo(p)}</p>
          <p className="cal-detalle-cuando">
            {programada && <CalendarClock size={13} aria-hidden />}
            {borrador ? 'Borrador' : programada ? `Sale el ${formatoCuando(f)}` : `Publicada el ${formatoCuando(f)}`}
          </p>
        </div>
      </div>
      {p.caption && <p className="cal-detalle-texto">{p.caption}</p>}
      {p.estado === 'FAILED' && p.error && <p className="cal-error" role="alert">{p.error}</p>}
    </Modal>
  )
}

const CSS = `
.cal-raiz { display: flex; flex-direction: column; gap: 14px; margin-top: 16px; }
.cal-cabecera { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
.cal-navegacion { display: flex; align-items: center; gap: 6px; }
.cal-mes { margin: 0 6px; min-width: 150px; text-align: center; font-size: 18px; font-weight: 700; letter-spacing: -0.01em; text-transform: capitalize; color: var(--color-text); }
.cal-flecha { width: 34px; height: 34px; padding: 0; border: 1px solid var(--color-border); border-radius: 50%; background: var(--color-surface); cursor: pointer; display: inline-flex; align-items: center; justify-content: center; color: var(--color-text); transition: background-color 150ms; }
.cal-flecha:hover { background: var(--color-surface-alt); }
.cal-hoy { margin-left: 8px; min-height: 30px; padding: 0 12px; border: 1px solid var(--color-border); border-radius: 15px; background: var(--color-surface); cursor: pointer; font: inherit; font-size: 12.5px; font-weight: 500; color: var(--color-text); }
.cal-hoy:hover { background: var(--color-surface-alt); }
.cal-flecha:focus-visible, .cal-hoy:focus-visible, .cal-chip:focus-visible, .cal-agregar:focus-visible, .cal-mas:focus-visible, .cal-agenda-fila:focus-visible { outline: 2px solid var(--color-primary); outline-offset: 2px; }
.cal-leyenda { display: flex; gap: 14px; font-size: 12.5px; color: var(--color-muted); }
.cal-leyenda span { display: inline-flex; align-items: center; gap: 6px; }
.cal-punto { width: 10px; height: 10px; border-radius: 3px; display: inline-block; }
.cal-punto-publicada { background: var(--color-text); }
.cal-punto-programada { border: 1.5px dashed var(--color-primary); }
.cal-pista { margin: 0; font-size: 13px; line-height: 1.5; color: var(--color-muted); }
.cal-pista strong { color: var(--color-text); }
.cal-error { margin: 0; font-size: 12.5px; color: var(--color-error); }

.cal-tabla { overflow: hidden; background: var(--color-surface); border: 1px solid var(--color-border); border-radius: 16px; box-shadow: var(--shadow-card); transition: opacity 150ms; }
.cal-cargando { opacity: 0.55; }
.cal-encabezados, .cal-semana { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); }
.cal-encabezados span { padding: 10px 8px; text-align: center; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em; color: var(--color-muted); background: var(--color-surface-alt); border-bottom: 1px solid var(--color-border); }
.cal-encabezados .cal-dia-mejor { color: var(--color-text); }
.cal-estrella { margin-left: 4px; font-style: normal; font-size: 11px; color: #d99a1a; }
.cal-celda { position: relative; min-height: 104px; padding: 6px; border-right: 1px solid var(--color-border); border-bottom: 1px solid var(--color-border); display: flex; flex-direction: column; gap: 4px; min-width: 0; }
.cal-semana .cal-celda:last-child { border-right: none; }
.cal-semana:last-child .cal-celda { border-bottom: none; }
.cal-celda-vacia { background: var(--color-surface-alt); opacity: 0.5; }
.cal-celda-mejor { background: color-mix(in srgb, #f5b73b 7%, var(--color-surface)); }
.cal-celda-cabecera { display: flex; align-items: center; justify-content: space-between; }
.cal-numero { width: 24px; height: 24px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; font-size: 12.5px; font-weight: 500; font-variant-numeric: tabular-nums; color: var(--color-text); }
.cal-celda-hoy .cal-numero { font-weight: 700; color: var(--color-on-primary); background: var(--color-primary); }
.cal-agregar { width: 22px; height: 22px; padding: 0; border: none; border-radius: 50%; background: transparent; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; color: var(--color-muted); opacity: 0; transition: opacity 150ms, background-color 150ms; }
.cal-celda:hover .cal-agregar, .cal-agregar:focus-visible { opacity: 1; }
.cal-agregar:hover { background: var(--color-surface-alt); color: var(--color-text); }
.cal-chips { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 3px; min-width: 0; }
.cal-chip { width: 100%; display: flex; align-items: center; gap: 5px; padding: 2px 5px 2px 2px; border-radius: 7px; border: 1px solid var(--color-border); background: var(--color-surface-alt); cursor: pointer; font: inherit; font-size: 11.5px; color: var(--color-text); text-align: left; min-width: 0; }
.cal-chip:hover { border-color: var(--color-muted); }
.cal-chip-programada { border-style: dashed; border-color: var(--color-primary); background: var(--color-surface); }
.cal-chip-fallo { border-color: var(--color-error); }
.cal-chip-foto { width: 20px; height: 20px; flex-shrink: 0; overflow: hidden; border-radius: 5px; background: #fff; display: inline-flex; align-items: center; justify-content: center; color: var(--color-muted); border: 1px solid var(--color-border); }
.cal-chip-foto img { width: 100%; height: 100%; object-fit: cover; }
.cal-chip-foto-grande { width: 44px; height: 44px; border-radius: 10px; }
.cal-chip-hora { font-variant-numeric: tabular-nums; font-weight: 500; }
.cal-mas { border: none; background: transparent; padding: 0 4px; cursor: pointer; font: inherit; font-size: 11.5px; color: var(--color-muted); }
.cal-mas:hover { color: var(--color-text); text-decoration: underline; }

.cal-agenda { display: none; flex-direction: column; gap: 14px; }
.cal-agenda-dia h3 { margin: 0 0 6px; font-size: 13px; font-weight: 600; text-transform: capitalize; color: var(--color-text); }
.cal-agenda-dia ul { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 6px; }
.cal-agenda-fila { width: 100%; display: flex; align-items: center; gap: 12px; padding: 8px 10px; border: 1px solid var(--color-border); border-radius: 12px; background: var(--color-surface); cursor: pointer; font: inherit; text-align: left; }
.cal-agenda-texto { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.cal-agenda-titulo { font-size: 14px; font-weight: 600; color: var(--color-text); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.cal-agenda-sub { font-size: 12.5px; color: var(--color-muted); }
.cal-vacio { margin: 0; padding: 22px; text-align: center; font-size: 13px; color: var(--color-muted); border: 1px dashed var(--color-border); border-radius: 16px; }
.cal-pie { display: flex; justify-content: flex-end; }

.cal-detalle { display: flex; gap: 14px; align-items: center; }
.cal-detalle-foto { width: 72px; height: 72px; flex-shrink: 0; overflow: hidden; border-radius: 12px; border: 1px solid var(--color-border); background: #fff; display: inline-flex; align-items: center; justify-content: center; color: var(--color-muted); }
.cal-detalle-foto img { width: 100%; height: 100%; object-fit: contain; }
.cal-detalle-titulo { margin: 0; font-size: 15px; font-weight: 600; color: var(--color-text); }
.cal-detalle-sub { margin: 2px 0 0; font-size: 13px; color: var(--color-muted); }
.cal-detalle-cuando { display: flex; align-items: center; gap: 5px; margin: 6px 0 0; font-size: 13px; font-weight: 500; color: var(--color-text); }
.cal-detalle-texto { margin: 14px 0 0; padding: 10px 12px; max-height: 180px; overflow-y: auto; border-radius: 12px; font-size: 13px; line-height: 1.5; color: var(--color-text); background: var(--color-surface-alt); border: 1px solid var(--color-border); white-space: pre-wrap; overflow-wrap: anywhere; }
.cal-boton-enlace { display: inline-flex; align-items: center; gap: 6px; min-height: 40px; padding: 0 16px; border-radius: 10px; font-size: 14px; font-weight: 600; text-decoration: none; color: var(--color-on-primary); background: var(--color-primary); }

@media (max-width: 720px) {
  .cal-tabla { display: none; }
  .cal-agenda { display: flex; }
  .cal-mes { min-width: 0; font-size: 16px; }
}
@media (prefers-reduced-motion: reduce) { .cal-tabla, .cal-agregar, .cal-flecha { transition: none; } }
`
