// Las clases del panel: el día (quién viene a cada clase, check-in, lista de
// espera, anotar a alguien a mano) y la grilla semanal (qué clase hay cada
// día, con profe, sala y cupo). La grilla se repite todas las semanas; lo que
// se cambia acá se ve en el sitio al instante.
//
// Lo abierto viaja en la URL (?ver=grilla, ?dia=, ?clase=): un aviso de la
// campanita o el buscador llegan directo a una clase, y el link se puede
// compartir. Nada de hover por JS: ds-hover en las filas y los chips.
//
// El día y la hora salen del reloj del origen (useReloj): el fijo de la demo o
// el de verdad con la API. Las reglas que cuidan lo reservado valen en los
// dos: el cupo no baja de lo que ya está tomado, y una clase con lugares
// reservados por delante no se mueve de día u hora ni se quita. Acá se avisa
// antes de guardar; con la API, la que decide es la API.
//
// Lo que no es igual en la demo y en la API llega en `puede` (Capacidades):
// si la asistencia se corrige, si liberar un lugar tiene vuelta atrás, si la
// actividad, el profe y la sala se escriben al cargar la clase.
import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { useRouter } from 'next/router'
import { Check, ChevronLeft, ChevronRight, Hourglass, Plus, Trash2, UserPlus, X } from 'lucide-react'
import { DIAS_CORTOS, DIAS_SEMANA, diaSemana, esISO, fechaCorta, fechaLarga, fechaRelativa, hhmm, sumarDias, type ISO } from '@/lib/reservas/fechas'
import { COLORES_ACTIVIDAD, actividadDe, clasesDelDia, colorDe, cupoDe, diaBloqueado, lugaresDe, maximoTomadoDesde, nombreDeInscripcion, profeDe, reservadasEntre, rubroPorKey, socioPorId, topeSemanal, type ClaseSemanal, type Inscripcion, type NegocioGym, type Socio } from '../datos'
import { LIMITE_DIAS, type Capacidades } from '../datos/origen'
import { useReloj } from '../datos/reloj'
import { Chip, Encabezado, Modal, Nota, Selector, Sigla, Vacio, Campo } from '@/design-system/reservas/piezas'
import { BarraCupo, CSS_CUPO } from '../storefront/Sitio'
import { Punto } from './piezas'

/** La actividad, el profe y la sala que se escribieron al cargar una clase y todavía no estaban en el negocio. */
export type CatalogoNuevo = Partial<Pick<NegocioGym, 'actividades' | 'profes' | 'salas'>>

interface P {
  negocio: NegocioGym
  inscripciones: Inscripcion[]
  socios: Socio[]
  /** Lo que cambia entre la demo y la API: qué se ofrece y qué se dice en cada caso. */
  puede: Capacidades
  // Cada acción contesta si salió bien: un formulario no se cierra ni queda vacío hasta saberlo.
  onCambiar: (id: string, cambio: Partial<Inscripcion>, aviso?: string) => Promise<boolean>
  onCancelar: (id: string, aviso?: string) => Promise<boolean>
  /** `nuevo`: la persona, si se cargó recién (Alguien nuevo…). */
  onInscribir: (i: Inscripcion, aviso?: string, nuevo?: Socio) => Promise<boolean>
  /** `catalogo`: lo que se escribió ahí mismo al cargar la clase. */
  onGuardarGrilla: (clases: ClaseSemanal[], aviso?: string, catalogo?: CatalogoNuevo) => Promise<boolean>
}

/** El primer nombre, para los avisos ("Lu anotado"). */
const primerNombre = (nombre: string) => nombre.trim().split(/\s+/)[0] ?? nombre
/** Un celular como lo acepta la API: números, espacios, +, paréntesis y guiones, de 6 a 30. */
const celularValido = (t: string) => /^[\d\s()+-]{6,30}$/.test(t.trim()) && t.replace(/\D/g, '').length >= 6
/** Cuántos lugares se pueden pedir de una vez para alguien (una persona con amigas), como mucho. */
const MAX_LUGARES = 10

const CSS = `
  /* La tira de días ocupa lo que dejan las flechas y scrollea adentro: en celular no empuja la página. Las flechas no se achican (en 390 quedaban de 27 px). */
  .gic-semana > .rv-btn { flex-shrink: 0; }
  .gic-dias { display: flex; flex: 0 1 auto; min-width: 0; gap: 6px; overflow-x: auto; scrollbar-width: none; padding: 4px; margin: -4px 0; }
  .gic-dias::-webkit-scrollbar { display: none; }
  .gic-dia { position: relative; flex: 0 0 auto; min-width: 64px; min-height: 56px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px; border-radius: 10px; border: 1px solid var(--color-border); background: var(--color-bg); font: inherit; color: var(--color-body); cursor: pointer; }
  .gic-dia b { font-family: var(--rv-mono); font-size: 16px; color: var(--color-text); }
  .gic-dia small { font-size: 11px; text-transform: uppercase; letter-spacing: 0.06em; }
  /* El día elegido: fondo del acento claro y tinta de chip, que llega a AA (blanco sobre el primario, en 11 px, no). */
  .gic-dia[aria-pressed='true'] { background: var(--color-primary-bg); border-color: var(--color-primary); color: var(--chip-primary-fg); }
  .gic-dia[aria-pressed='true'] b { color: inherit; }
  .gic-dia:focus-visible { outline: 2px solid var(--color-primary); outline-offset: 2px; }
  /* El punto de abajo: ese día alguien espera lugar. */
  .gic-dia[data-espera='true']::after { content: ''; position: absolute; bottom: 5px; width: 4px; height: 4px; border-radius: 50%; background: var(--color-warning); }

  /* Las clases del día: una fila por clase, todas en una tarjeta (como un listado de Tienda). */
  .gic-lista { display: flex; flex-direction: column; overflow: hidden; }
  .gic-clase { display: grid; grid-template-columns: 76px minmax(0, 1fr) auto 16px; gap: 14px; align-items: center; width: 100%; padding: 14px 16px; border: none; border-top: 1px solid var(--color-border); border-radius: 0; background: transparent; text-align: left; font: inherit; color: inherit; cursor: pointer; }
  .gic-clase:first-child { border-top: none; }
  .gic-clase:focus-visible { outline: 2px solid var(--color-primary); outline-offset: -2px; }
  .gic-hora { font-family: var(--rv-mono); font-size: 17px; font-weight: 600; color: var(--color-text); line-height: 1.2; }
  .gic-hora small { display: block; font-size: 11px; font-weight: 500; color: var(--color-muted); margin-top: 2px; }
  .gic-clase[data-pasada='true'] .gic-hora, .gic-clase[data-pasada='true'] .gic-clase-titulo { color: var(--color-muted); }
  .gic-clase-cuerpo { min-width: 0; }
  .gic-clase-titulo { display: block; font-size: 15px; font-weight: 600; color: var(--color-text); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .gic-clase-sub { display: block; font-size: 12.5px; color: var(--color-muted); margin-top: 1px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .gic-clase-chips { display: flex; gap: 6px; justify-content: flex-end; flex-wrap: wrap; }
  .gic-clase-flecha { color: var(--color-subtle); }
  .gic-sin-profe { color: var(--chip-error-fg); font-weight: 600; }

  /* La grilla: una columna por día que abre; cada clase es un chip con el color de su actividad. */
  .gic-grilla { display: grid; grid-template-columns: repeat(var(--cols, 6), minmax(0, 1fr)); gap: 8px; }
  .gic-col { display: flex; flex-direction: column; gap: 6px; min-width: 0; padding: 10px; border: 1px solid var(--color-border); border-radius: 12px; background: var(--color-bg); }
  .gic-col-cab { display: flex; justify-content: space-between; align-items: baseline; gap: 6px; margin-bottom: 2px; font-size: 13px; font-weight: 700; color: var(--color-text); }
  .gic-col-cab small { font-family: var(--rv-mono); font-size: 11px; font-weight: 500; color: var(--color-muted); }
  .gic-chip { display: block; width: 100%; padding: 7px 8px 7px 10px; border-radius: 8px; border: 1px solid var(--color-border); border-left: 3px solid var(--tono, var(--color-primary)); background: var(--color-bg); color: var(--color-text); font: inherit; font-size: 12.5px; line-height: 1.3; text-align: left; cursor: pointer; }
  .gic-chip b { display: block; font-family: var(--rv-mono); font-weight: 600; }
  .gic-chip > span { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .gic-chip-sub { font-size: 11.5px; color: var(--color-muted); margin-top: 1px; }
  .gic-chip:focus-visible { outline: 2px solid var(--color-primary); outline-offset: 1px; }
  .gic-mas { width: 100%; min-height: 36px; margin-top: auto; border-radius: 8px; border: 1px dashed var(--color-border-strong); background: transparent; color: var(--color-muted); font: inherit; font-size: 12.5px; font-weight: 500; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; gap: 4px; }
  .gic-mas:focus-visible { outline: 2px solid var(--color-primary); outline-offset: 2px; }
  .gic-tabs { display: none; }

  /* Quién viene: una fila por persona, adentro del detalle. */
  .gic-asistencia { display: flex; flex-direction: column; }
  .gic-persona { display: flex; align-items: center; gap: 10px; padding: 10px 0; border-top: 1px solid var(--color-border); }
  .gic-persona:first-child { border-top: none; }
  .gic-persona-nombre { display: block; font-size: 14px; font-weight: 600; color: var(--color-text); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .gic-persona-acciones { display: flex; gap: 6px; flex-shrink: 0; }
  .gic-persona-sacar { flex-shrink: 0; }
  /* El aviso de un día sin clases que todavía tiene reservas, arriba de esas clases. */
  .gic-bloqueado { margin-bottom: 12px; }
  /* Anotar: a quién y cuántos lugares, con el botón al lado. */
  .gic-lugares { width: 104px; flex-shrink: 0; }

  @media (max-width: 1100px) { .gic-grilla { grid-template-columns: repeat(3, minmax(0, 1fr)); } }
  @media (max-width: 768px) {
    .gic-grilla { grid-template-columns: minmax(0, 1fr); }
    .gic-col[data-oculto='true'] { display: none; }
    /* El padding deja lugar al anillo de foco, que la tira (overflow) recortaba. */
    .gic-tabs { display: flex; gap: 6px; overflow-x: auto; scrollbar-width: none; padding: 4px; margin: -4px -4px 6px; }
    .gic-tabs::-webkit-scrollbar { display: none; }
    /* La cruz queda arriba, al lado del nombre y del tamaño de un dedo. Abajo, a lo ancho, van solo los
       botones de asistencia: sola en su renglón era un botón invisible de lado a lado, a un toque de liberar el lugar. */
    .gic-persona { flex-wrap: wrap; }
    .gic-persona-acciones { order: 3; width: 100%; }
    .gic-persona-acciones:empty { display: none; }
    .gic-persona-acciones > .rv-btn { flex: 1; }
    .gic-persona-sacar { min-width: 44px; min-height: 44px; }
    .gic-mas, .gic-chip { min-height: 44px; }
  }
  /* Recién en celular los chips de la clase bajan a su propia fila: en una tablet entran al costado. */
  @media (max-width: 560px) {
    /* En celular, quién, cuántos y el botón van cada uno en su renglón. */
    .gic-anotar > * { flex: 1 1 100%; }
    .gic-lugares { width: auto; }
    .gic-clase { grid-template-columns: 60px minmax(0, 1fr) 16px; gap: 10px; padding: 12px 14px; }
    .gic-clase-chips { grid-column: 1 / -1; justify-content: flex-start; }
    .gic-clase-chips:empty { display: none; }
  }
` + CSS_CUPO

const q1 = (v: unknown) => (typeof v === 'string' ? v : '')

export default function Clases(p: P) {
  const router = useRouter()
  const { hoy } = useReloj()
  const r = rubroPorKey(p.negocio.rubro)
  const ver = router.query.ver === 'grilla' ? 'grilla' : 'dia'
  const diaQ = q1(router.query.dia)
  // El día de la URL vale hasta un año para cada lado de hoy: más lejos no hay nada que mirar, y un link mal escrito no sale a pedir años de reservas.
  const dia: ISO = esISO(diaQ) && diaQ >= sumarDias(hoy, -LIMITE_DIAS) && diaQ <= sumarDias(hoy, LIMITE_DIAS) ? diaQ : hoy
  const abierta = q1(router.query.clase)
  // Lo abierto va en la URL: una clave vacía la saca de la query.
  const setQuery = (cambio: Record<string, string | undefined>) => {
    const q: Record<string, string | string[] | undefined> = { ...router.query, ...cambio }
    for (const k of Object.keys(q)) if (!q[k]) delete q[k]
    void router.replace({ pathname: router.pathname, query: q }, undefined, { shallow: true, scroll: false })
  }
  const [nueva, setNueva] = useState<Partial<ClaseSemanal> | null>(null)

  const delDia = clasesDelDia(p.negocio, dia)
  const resumen = delDia.reduce((s, c) => { const k = cupoDe(c, dia, p.inscripciones); return { anotados: s.anotados + k.anotados, cupo: s.cupo + k.cupo, espera: s.espera + k.espera } }, { anotados: 0, cupo: 0, espera: 0 })
  const lugares = p.negocio.clases.reduce((s, c) => s + c.cupo, 0)
  const bajada = ver === 'grilla'
    ? `${p.negocio.clases.length} clases por semana, ${lugares} lugares. Tocá una clase para cambiarla; lo que guardes se ve en el sitio al instante.`
    : delDia.length === 0 ? 'Sin clases ese día.' : `${delDia.length} ${delDia.length === 1 ? 'clase' : 'clases'} · ${resumen.anotados} de ${resumen.cupo} lugares tomados${resumen.espera ? ` · ${resumen.espera} en lista de espera: si alguien cancela, pasa solo.` : '.'}`

  const guardarNueva = (c: ClaseSemanal, catalogo?: CatalogoNuevo) => p.onGuardarGrilla([...p.negocio.clases, c], 'Clase agregada a la grilla', catalogo)

  return (
    <div className="rv-pagina">
      <style>{CSS}</style>
      <Encabezado rotulo={ver === 'grilla' ? 'Se repite todas las semanas' : dia === hoy ? `Hoy · ${fechaLarga(hoy)}` : fechaLarga(dia)} titulo={ver === 'grilla' ? 'Grilla semanal' : 'Clases'} bajada={bajada}
        acciones={<>
          <div className="rv-seg" role="group" aria-label="Vista">
            <button type="button" aria-pressed={ver === 'dia'} onClick={() => setQuery({ ver: undefined })}>Día</button>
            <button type="button" aria-pressed={ver === 'grilla'} onClick={() => setQuery({ ver: 'grilla', clase: undefined })}>Grilla semanal</button>
          </div>
          <button type="button" className="rv-btn rv-btn--primario" onClick={() => setNueva({ dia: ver === 'grilla' ? 0 : diaSemana(dia), inicio: p.negocio.apertura.desde })}><Plus size={16} aria-hidden /> Nueva clase</button>
        </>} />
      {ver === 'dia'
        ? <Dia {...p} dia={dia} abierta={abierta} socioTxt={r.socio} onDia={f => setQuery({ dia: f === hoy ? undefined : f, clase: undefined })} onAbrir={id => setQuery({ clase: id ?? undefined })} />
        : <Grilla negocio={p.negocio} inscripciones={p.inscripciones} catalogoEnLaClase={p.puede.catalogoEnLaClase} onGuardar={p.onGuardarGrilla} />}
      {nueva && <EditarClase negocio={p.negocio} inscripciones={p.inscripciones} clase={nueva} catalogoEnLaClase={p.puede.catalogoEnLaClase} onCerrar={() => setNueva(null)} onGuardar={guardarNueva} onBorrar={async () => true} />}
    </div>
  )
}

// ─── El día ──────────────────────────────────────────────────────────────────

function Dia({ negocio, inscripciones, socios, puede, onCambiar, onCancelar, onInscribir, socioTxt, dia, abierta, onDia, onAbrir }: P & { socioTxt: string; dia: ISO; abierta: string; onDia: (f: ISO) => void; onAbrir: (id: string | null) => void }) {
  const { hoy, ahora } = useReloj()
  const desde = sumarDias(dia, -3)
  const bloqueo = diaBloqueado(negocio, dia)
  const clases = clasesDelDia(negocio, dia)
  // En un día sin clases quedan a la vista las clases que todavía tienen gente: esas reservas no se
  // cancelan solas, y si no se ven acá el negocio no tiene dónde avisarles ni liberar su lugar.
  const aLaVista = bloqueo ? clases.filter(c => { const k = cupoDe(c, dia, inscripciones); return k.anotados > 0 || k.espera > 0 }) : clases
  const enPie = bloqueo ? reservadasEntre(inscripciones, dia, sumarDias(dia, 1)) : 0
  const clase = abierta ? clases.find(c => c.id === abierta) ?? null : null
  const dura = (c: ClaseSemanal) => actividadDe(negocio, c.actividadId)?.duracion ?? 60
  const pasada = (c: ClaseSemanal) => dia < hoy || (dia === hoy && c.inicio + dura(c) <= ahora)
  const enCurso = (c: ClaseSemanal) => dia === hoy && c.inicio <= ahora && ahora < c.inicio + dura(c)
  // El día elegido queda entero a la vista en la tira: en celular entran tres o cuatro y el
  // elegido es el cuarto (la tira arranca tres días antes), así que quedaba cortado por el borde.
  // Solo se mueve si está cortado (un toque sobre un día visible no corre nada) y se centra,
  // como la tira de días de Reservar en el sitio.
  const tira = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const t = tira.current
    const el = t?.querySelector<HTMLElement>("[aria-pressed='true']")
    if (!t || !el || t.scrollWidth <= t.clientWidth) return
    const rt = t.getBoundingClientRect()
    const re = el.getBoundingClientRect()
    const margen = 8
    if (re.left >= rt.left + margen && re.right <= rt.right - margen) return
    t.scrollTo({ left: t.scrollLeft + (re.left - rt.left) - (rt.width - re.width) / 2, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' })
  }, [dia])
  return (
    <>
      <div className="rv-fila gic-semana" style={{ marginBottom: 14, flexWrap: 'nowrap' }}>
        <button type="button" className="rv-btn rv-btn--icono rv-btn--sm" onClick={() => onDia(sumarDias(dia, -7))} aria-label="Semana anterior"><ChevronLeft size={16} /></button>
        <div ref={tira} className="gic-dias" role="group" aria-label="Día">
          {Array.from({ length: 7 }, (_, i) => sumarDias(desde, i)).map(f => {
            const espera = clasesDelDia(negocio, f).some(c => cupoDe(c, f, inscripciones).espera > 0)
            return (
              <button key={f} type="button" className="gic-dia" aria-pressed={f === dia} data-espera={espera || undefined} onClick={() => onDia(f)} aria-label={`${fechaLarga(f)}${espera ? ', con lista de espera' : ''}`}><small>{f === hoy ? 'Hoy' : DIAS_CORTOS[diaSemana(f)]}</small><b>{Number(f.slice(-2))}</b></button>
            )
          })}
        </div>
        <button type="button" className="rv-btn rv-btn--icono rv-btn--sm" onClick={() => onDia(sumarDias(dia, 7))} aria-label="Semana siguiente"><ChevronRight size={16} /></button>
        {dia !== hoy && <button type="button" className="rv-btn rv-btn--sm" onClick={() => onDia(hoy)}>Hoy</button>}
      </div>
      {aLaVista.length === 0 ? (
        <Vacio titulo="Sin clases" texto={bloqueo ? `${fechaLarga(dia)}: ${bloqueo.motivo}.` : `${fechaLarga(dia)}: no hay clases en la grilla.`} />
      ) : (
        <>
          {bloqueo && (
            <div className="gic-bloqueado" role="status">
              <Nota tono="aviso">
                <b>Día sin clases ({bloqueo.motivo}).</b>{' '}
                {enPie > 0 ? `${enPie} ${enPie === 1 ? 'reserva sigue' : 'reservas siguen'} en pie: no se cancelan solas.` : 'Todavía hay gente en la lista de espera.'}{' '}
                Abrí cada clase para avisarles y liberar su lugar.
              </Nota>
            </div>
          )}
          <div className="rv-card gic-lista">
            {aLaVista.map(c => {
              const k = cupoDe(c, dia, inscripciones)
              // En lugares, igual que "anotados": quien vino con una amiga cuenta dos.
              const vinieron = inscripciones.filter(i => i.claseId === c.id && i.fecha === dia && i.estado === 'asistio').reduce((s, i) => s + lugaresDe(i), 0)
              return (
                <button key={c.id} type="button" className="ds-hover gic-clase" data-pasada={pasada(c)} aria-haspopup="dialog" onClick={() => onAbrir(c.id)}>
                  <span className="gic-hora">{hhmm(c.inicio)}<small>{c.actividad?.duracion} min</small></span>
                  <span className="gic-clase-cuerpo">
                    <span className="gic-clase-titulo">{c.actividad?.nombre}</span>
                    <span className="gic-clase-sub">{c.profe ? <><Punto color={c.profe.color} />{c.profe.nombre}</> : <span className="gic-sin-profe">Sin profe</span>}{c.sala ? ` · ${c.sala}` : ''}</span>
                    <BarraCupo anotados={k.anotados} cupo={k.cupo} />
                  </span>
                  <span className="gic-clase-chips">
                    {enCurso(c) && <Chip tono="primario">En curso</Chip>}
                    {k.espera > 0 && <Chip tono="aviso"><Hourglass size={12} aria-hidden /> {k.espera} en espera</Chip>}
                    {pasada(c) && <Chip tono={vinieron ? 'ok' : 'gris'}>{vinieron} de {k.anotados} vinieron</Chip>}
                  </span>
                  <ChevronRight size={16} className="gic-clase-flecha" aria-hidden />
                </button>
              )
            })}
          </div>
        </>
      )}
      {clase && <DetalleClase negocio={negocio} clase={clase} fecha={dia} inscripciones={inscripciones} socios={socios} pasada={pasada(clase)} sinClases={!!bloqueo} socioTxt={socioTxt} puede={puede} onCerrar={() => onAbrir(null)} onCambiar={onCambiar} onCancelar={onCancelar} onInscribir={onInscribir} />}
    </>
  )
}

/** Lo que se elige en "Anotar" para cargar a alguien que todavía no está entre los socios. */
const NUEVA = '__nueva__'

function DetalleClase({ negocio, clase, fecha, inscripciones, socios, pasada, sinClases, socioTxt, puede, onCerrar, onCambiar, onCancelar, onInscribir }: {
  negocio: NegocioGym; clase: ClaseSemanal; fecha: ISO; inscripciones: Inscripcion[]; socios: Socio[]; pasada: boolean; socioTxt: string; puede: Capacidades
  /** El día está marcado sin clases: se ve quién quedó anotado, pero no se anota a nadie más. */
  sinClases: boolean
  onCerrar: () => void; onCambiar: P['onCambiar']; onCancelar: P['onCancelar']; onInscribir: P['onInscribir']
}) {
  const { hoy, ahora } = useReloj()
  const act = actividadDe(negocio, clase.actividadId)
  const profe = profeDe(negocio, clase.profeId)
  const k = cupoDe(clase, fecha, inscripciones)
  // El check-in se abre el día de la clase, desde checkInMin minutos antes (como en Mis clases); en las pasadas sirve para corregir la asistencia.
  const checkInAbierto = fecha < hoy || (fecha === hoy && clase.inicio - negocio.checkInMin <= ahora)
  const suyas = inscripciones.filter(i => i.claseId === clase.id && i.fecha === fecha && i.estado !== 'cancelada')
  // Cada lugar con el nombre de quien se anotó (dos personas pueden compartir celular y ficha).
  const nombreDe = (i: Inscripcion) => nombreDeInscripcion(i, socioPorId(i.socioId, socios))
  const anotados = suyas.filter(i => i.estado !== 'espera').sort((a, b) => nombreDe(a).localeCompare(nombreDe(b), 'es'))
  const espera = suyas.filter(i => i.estado === 'espera').sort((a, b) => a.creada.localeCompare(b.creada) || a.id.localeCompare(b.id))
  const lugaresCon = (estado: Inscripcion['estado']) => anotados.filter(i => i.estado === estado).reduce((s, i) => s + lugaresDe(i), 0)
  const [anotar, setAnotar] = useState('')
  const [nueva, setNueva] = useState({ nombre: '', telefono: '' })
  const [lugares, setLugares] = useState(1)
  // A quién se está por sacar: liberar un lugar (o sacar de la espera) pide confirmación.
  const [aSacar, setASacar] = useState<Inscripcion | null>(null)
  const libres = socios.filter(s => !suyas.some(i => i.socioId === s.id))
  const esNueva = anotar === NUEVA
  // El dueño puede anotar a quien quiera, pero se le avisa si a esa persona ya no le quedan clases esa semana o en el pack.
  const elegido = anotar && !esNueva ? socioPorId(anotar, socios) : undefined
  const tope = elegido ? topeSemanal(negocio, elegido, fecha, inscripciones) : null
  const sinPack = elegido?.clasesRestantes !== null && elegido?.clasesRestantes !== undefined && elegido.clasesRestantes <= 0
  // Varios lugares para la misma persona (viene con amigas): hasta los que quedan. Con la clase llena, a la espera va de a una.
  const maxLugares = Math.min(MAX_LUGARES, k.libres)
  const nombreMal = esNueva && nueva.nombre.trim().length < 2
  const celularMal = esNueva && !celularValido(nueva.telefono)
  const puedeAnotar = esNueva ? !nombreMal && !celularMal : !!elegido
  const agregar = async () => {
    const s: Socio | undefined = esNueva
      ? { id: `sn-${Date.now().toString(36)}`, nombre: nueva.nombre.trim(), telefono: nueva.telefono.trim(), planId: null, desde: null, vence: null, clasesRestantes: null, probo: false, alta: hoy }
      : elegido
    if (!s || !puedeAnotar) return
    const cuantos = k.lleno ? 1 : Math.max(1, Math.min(lugares, maxLugares))
    const i: Inscripcion = { id: `n${Date.now().toString(36)}`, claseId: clase.id, fecha, socioId: s.id, estado: k.lleno ? 'espera' : 'reservada', creada: hoy, planId: s.planId, ...(cuantos > 1 ? { cantidad: cuantos } : {}) }
    // El formulario se vacía en el acto (un segundo clic no anota dos veces). Si no se pudo anotar,
    // vuelve lo que estaba cargado: no hay que tipear de nuevo el nombre y el celular.
    const cargado = { anotar, nueva, lugares }
    setAnotar('')
    setNueva({ nombre: '', telefono: '' })
    setLugares(1)
    const ok = await onInscribir(i, k.lleno ? `${primerNombre(s.nombre)} quedó en lista de espera` : cuantos > 1 ? `${primerNombre(s.nombre)} anotado con ${cuantos} lugares` : `${primerNombre(s.nombre)} anotado`, esNueva ? s : undefined)
    if (!ok) { setAnotar(cargado.anotar); setNueva(cargado.nueva); setLugares(cargado.lugares) }
  }
  return (
    <Modal titulo={act?.nombre ?? 'Clase'} bajada={`${fechaRelativa(fecha, hoy) === 'Hoy' ? 'Hoy' : fechaLarga(fecha)} · ${hhmm(clase.inicio)} a ${hhmm(clase.inicio + (act?.duracion ?? 60))} · ${profe?.nombre ?? 'Sin profe'}${clase.sala ? ` · ${clase.sala}` : ''}`} onCerrar={onCerrar} ancho={600}
      pie={<button type="button" className="rv-btn" onClick={onCerrar}>Cerrar</button>}>
      <BarraCupo anotados={k.anotados} cupo={k.cupo} />
      <div className="rv-entre" style={{ margin: '16px 0 6px' }}>
        {/* En lugares, como la barra de arriba: quien vino con una amiga cuenta dos. */}
        <h3 className="rv-h3">{pasada ? 'Asistencia' : 'Anotados'} ({k.anotados})</h3>
        {pasada && <span className="rv-ayuda">{lugaresCon('asistio')} vinieron · {lugaresCon('ausente')} faltaron</span>}
        {!checkInAbierto && <span className="rv-ayuda">{negocio.checkInMin ? `El check-in se abre ${negocio.checkInMin} min antes de la clase.` : 'El check-in se abre cuando empieza la clase.'}</span>}
      </div>
      <div className="gic-asistencia">
        {anotados.map(i => {
          const s = socioPorId(i.socioId, socios)
          const nombre = nombreDe(i)
          const n = lugaresDe(i)
          // Con la API, presente y ausente son finales: se marcan una vez, sobre un lugar reservado.
          const puedePresente = checkInAbierto && (puede.corregirAsistencia ? i.estado !== 'asistio' : i.estado === 'reservada')
          const puedeFalto = pasada && (puede.corregirAsistencia ? i.estado !== 'ausente' : i.estado === 'reservada')
          return (
            <div key={i.id} className="gic-persona">
              <Sigla nombre={nombre} color={colorDe(nombre)} size={32} />
              <span style={{ flex: 1, minWidth: 0 }}><span className="gic-persona-nombre">{nombre}</span><span className="rv-ayuda">{[s?.telefono, n > 1 ? `${n} lugares` : ''].filter(Boolean).join(' · ')}</span></span>
              <span className="gic-persona-acciones">
                {i.estado === 'asistio' ? <Chip tono="ok"><Check size={12} aria-hidden /> Vino</Chip> : i.estado === 'ausente' ? <Chip tono="error">Faltó</Chip> : null}
                {puedePresente && <button type="button" className="rv-btn rv-btn--sm" onClick={() => onCambiar(i.id, { estado: 'asistio' }, `Check-in de ${primerNombre(nombre)}`)}><Check size={14} aria-hidden /> Check-in</button>}
                {puedeFalto && <button type="button" className="rv-btn rv-btn--sm rv-btn--fantasma" onClick={() => onCambiar(i.id, { estado: 'ausente' }, `${primerNombre(nombre)} quedó como que faltó`)}>Faltó</button>}
              </span>
              {!pasada && i.estado === 'reservada' && <button type="button" className="rv-btn rv-btn--sm rv-btn--fantasma gic-persona-sacar" onClick={() => setASacar(i)} aria-label={`Liberar el lugar de ${nombre}`} aria-haspopup="dialog"><X size={14} aria-hidden /></button>}
            </div>
          )
        })}
        {anotados.length === 0 && <p className="rv-ayuda" style={{ margin: '6px 0' }}>Nadie anotado todavía.</p>}
      </div>
      {espera.length > 0 && (
        <>
          <h3 className="rv-h3" style={{ margin: '16px 0 6px' }}><Hourglass size={14} aria-hidden style={{ verticalAlign: '-2px', color: 'var(--chip-warning-fg)' }} /> Lista de espera ({espera.length})</h3>
          <div className="gic-asistencia">
            {espera.map((i, n) => {
              const nombre = nombreDe(i)
              return (
                <div key={i.id} className="gic-persona">
                  <span className="rv-num" style={{ width: 24, color: 'var(--color-muted)' }}>{n + 1}.</span>
                  <span style={{ flex: 1, minWidth: 0 }}><span className="gic-persona-nombre">{nombre}</span><span className="rv-ayuda">{puede.esperaPasaAlSubirCupo ? 'Pasa solo cuando alguien cancela' : 'Pasa solo cuando alguien cancela; si le subís el cupo a la clase, dale el lugar acá'}</span></span>
                  <span className="gic-persona-acciones">
                    {!k.lleno && !pasada && !sinClases && <button type="button" className="rv-btn rv-btn--sm rv-btn--primario" onClick={() => onCambiar(i.id, { estado: 'reservada' }, `${primerNombre(nombre)} ya tiene lugar`)}>Darle el lugar</button>}
                  </span>
                  <button type="button" className="rv-btn rv-btn--sm rv-btn--fantasma gic-persona-sacar" onClick={() => setASacar(i)} aria-label={`Sacar a ${nombre} de la lista de espera`} aria-haspopup="dialog"><X size={14} aria-hidden /></button>
                </div>
              )
            })}
          </div>
        </>
      )}
      {!pasada && sinClases && <p className="rv-ayuda" style={{ margin: '14px 0 0' }}>Este día figura sin clases: no se anota a nadie más. Para volver a abrirlo, quitalo de Días sin clases.</p>}
      {!pasada && !sinClases && (
        <>
          <div className="rv-fila gic-anotar" style={{ marginTop: 18, alignItems: 'flex-end' }}>
            <div style={{ flex: 1, minWidth: 200 }}><Selector label={`Anotar ${socioTxt.toLowerCase()}`} valor={anotar} onChange={setAnotar} opciones={[{ id: '', label: 'Elegí a alguien' }, { id: NUEVA, label: 'Alguien nuevo…' }, ...libres.map(s => ({ id: s.id, label: s.nombre }))]} /></div>
            {!k.lleno && maxLugares > 1 && <div className="gic-lugares"><Selector label="Lugares" valor={Math.min(lugares, maxLugares)} onChange={setLugares} opciones={Array.from({ length: maxLugares }, (_, n) => ({ id: n + 1, label: String(n + 1) }))} /></div>}
            <button type="button" className="rv-btn" onClick={() => void agregar()} disabled={!puedeAnotar}><UserPlus size={15} aria-hidden /> {k.lleno ? 'A la lista de espera' : 'Anotar'}</button>
          </div>
          {esNueva && (
            <div className="rv-dos" style={{ marginTop: 10 }}>
              <Campo label="Nombre" value={nueva.nombre} onChange={x => setNueva({ ...nueva, nombre: x })} placeholder="Nombre y apellido" maxLength={120} autoComplete="name" />
              <Campo label="Celular" value={nueva.telefono} onChange={x => setNueva({ ...nueva, telefono: x })} placeholder="3757 55-0000" inputMode="tel" maxLength={30} autoComplete="tel"
                error={nueva.telefono && celularMal ? 'Solo números (podés usar espacios, + y guiones).' : undefined} ayuda="Con el celular se la reconoce la próxima vez." />
            </div>
          )}
          {/* Por qué el botón está apagado: que no haya que adivinarlo. */}
          {esNueva && !puedeAnotar && <p className="rv-ayuda" style={{ margin: '8px 0 0' }}>Cargá el nombre y un celular para {k.lleno ? 'sumarla a la lista de espera' : 'anotarla'}.</p>}
          {k.lleno && <p className="rv-ayuda" style={{ margin: '8px 0 0' }}>La clase está llena: queda en la lista de espera y, si alguien cancela, pasa sola.</p>}
          {elegido && (tope?.lleno || sinPack) && (
            <div style={{ marginTop: 10 }}>
              <Nota tono="aviso">{tope?.lleno ? `${primerNombre(elegido.nombre)} ya usó sus ${tope.porSemana} clases de esa semana. Si lo anotás igual, cobrale la clase aparte.` : `A ${primerNombre(elegido.nombre)} no le quedan clases en el pack. Si lo anotás igual, cobrale la clase aparte o renovale el pack desde su ficha.`}</Nota>
            </div>
          )}
        </>
      )}
      {aSacar && (
        <ConfirmarSacar inscripcion={aSacar} nombre={nombreDe(aSacar)} hayEspera={espera.length > 0} definitivo={puede.liberarEsDefinitivo} onVolver={() => setASacar(null)}
          onConfirmar={() => {
            const nombre = primerNombre(nombreDe(aSacar))
            void onCancelar(aSacar.id, aSacar.estado === 'espera' ? `${nombre} salió de la lista de espera` : `Se liberó el lugar de ${nombre}`)
            setASacar(null)
          }} />
      )}
    </Modal>
  )
}

/**
 * La pregunta antes de liberar un lugar o de sacar a alguien de la lista de
 * espera. Con la API no tiene vuelta atrás (se cancela una reserva de verdad,
 * a la persona le llega el aviso y el primero de la espera toma el lugar), y
 * en un celular la cruz está a un toque de distancia: se pregunta siempre, y
 * el botón que confirma dice lo que va a pasar.
 */
function ConfirmarSacar({ inscripcion, nombre, hayEspera, definitivo, onVolver, onConfirmar }: { inscripcion: Inscripcion; nombre: string; hayEspera: boolean; definitivo: boolean; onVolver: () => void; onConfirmar: () => void }) {
  const deLaEspera = inscripcion.estado === 'espera'
  const n = lugaresDe(inscripcion)
  return (
    <Modal encima ancho={440} titulo={deLaEspera ? `¿Sacar a ${nombre} de la lista de espera?` : `¿Liberar el lugar de ${nombre}?`} onCerrar={onVolver}
      pie={<>
        <button type="button" className="rv-btn" onClick={onVolver}>Volver</button>
        <button type="button" className="rv-btn rv-btn--peligro" onClick={onConfirmar}>{deLaEspera ? 'Sacar de la lista' : 'Liberar el lugar'}</button>
      </>}>
      <p style={{ margin: 0, fontSize: 14, lineHeight: 1.5, color: 'var(--color-body)' }}>
        {deLaEspera
          ? 'Pierde su lugar en la fila. Si después quiere volver, entra al final.'
          : <>{n > 1 ? `Se liberan sus ${n} lugares` : 'Se libera su lugar'}{definitivo ? ': la reserva queda cancelada y, si dejó su email, le llega el aviso.' : '.'}{hayEspera ? ' El primero de la lista de espera pasa solo.' : ''}</>}
        {definitivo && !deLaEspera && <> No se puede deshacer: si fue un error, hay que anotarla de nuevo.</>}
      </p>
    </Modal>
  )
}

// ─── La grilla semanal ───────────────────────────────────────────────────────

function Grilla({ negocio, inscripciones, catalogoEnLaClase, onGuardar }: { negocio: NegocioGym; inscripciones: Inscripcion[]; catalogoEnLaClase: boolean; onGuardar: P['onGuardarGrilla'] }) {
  const { hoy } = useReloj()
  // Una columna por día que abre (y por el que tenga clases aunque ya no abra: hay que poder sacarlas).
  const dias = useMemo(() => [0, 1, 2, 3, 4, 5, 6].filter(d => negocio.apertura.dias.includes(d) || negocio.clases.some(c => c.dia === d)), [negocio.apertura.dias, negocio.clases])
  const [dia, setDia] = useState(dias[0] ?? 0)
  const [editando, setEditando] = useState<Partial<ClaseSemanal> | null>(null)
  const porDia = useMemo(() => Object.fromEntries(dias.map(d => [d, negocio.clases.filter(c => c.dia === d).sort((a, b) => a.inicio - b.inicio)])) as Record<number, ClaseSemanal[]>, [dias, negocio.clases])
  // Cuánto se llena cada clase de la grilla, en promedio, en las últimas 4 semanas: para ver cuáles funcionan.
  const promedio = (c: ClaseSemanal) => {
    const fechas = Array.from({ length: 4 }, (_, k) => sumarDias(hoy, -(diaSemana(hoy) - c.dia) - k * 7)).filter(f => f <= hoy)
    const vals = fechas.map(f => cupoDe(c, f, inscripciones).anotados / Math.max(1, c.cupo))
    return vals.length ? Math.round((vals.reduce((s, v) => s + v, 0) / vals.length) * 100) : 0
  }
  const diaMovil = dias.includes(dia) ? dia : dias[0]
  return (
    <>
      {/* En celular la grilla muestra un día por vez: estos botones eligen cuál (en escritorio se ven todos). */}
      <div className="gic-tabs" role="group" aria-label="Día de la grilla">
        {dias.map(d => <button key={d} type="button" aria-pressed={d === diaMovil} className="rv-chip rv-chip--borde" onClick={() => setDia(d)}>{DIAS_CORTOS[d]}</button>)}
      </div>
      <div className="gic-grilla" style={{ ['--cols' as string]: dias.length } as CSSProperties}>
        {dias.map(d => (
          <div key={d} className="gic-col" data-oculto={d !== diaMovil}>
            <div className="gic-col-cab"><span>{DIAS_SEMANA[d]}</span><small>{porDia[d].length} {porDia[d].length === 1 ? 'clase' : 'clases'}</small></div>
            {porDia[d].map(c => {
              const act = actividadDe(negocio, c.actividadId)
              const profe = profeDe(negocio, c.profeId)
              return (
                <button key={c.id} type="button" className="ds-hover gic-chip" style={{ ['--tono' as string]: act?.color } as CSSProperties} onClick={() => setEditando(c)} aria-label={`${act?.nombre} ${hhmm(c.inicio)}, ${profe?.nombre ?? 'sin profe'}, editar`}>
                  <b>{hhmm(c.inicio)}</b>
                  <span>{act?.nombre}</span>
                  <span className="gic-chip-sub">{profe ? <><Punto color={profe.color} />{profe.nombre}</> : <span className="gic-sin-profe">Sin profe</span>}</span>
                  <span className="gic-chip-sub">cupo {c.cupo} · {promedio(c)}% lleno</span>
                </button>
              )
            })}
            <button type="button" className="ds-hover gic-mas" onClick={() => setEditando({ dia: d, inicio: negocio.apertura.desde })}><Plus size={14} aria-hidden /> Clase</button>
          </div>
        ))}
      </div>
      {editando && (
        <EditarClase negocio={negocio} inscripciones={inscripciones} clase={editando} catalogoEnLaClase={catalogoEnLaClase} onCerrar={() => setEditando(null)}
          onGuardar={(c, catalogo) => { const existe = negocio.clases.some(x => x.id === c.id); return onGuardar(existe ? negocio.clases.map(x => (x.id === c.id ? c : x)) : [...negocio.clases, c], existe ? 'Clase actualizada' : 'Clase agregada a la grilla', catalogo) }}
          onBorrar={id => onGuardar(negocio.clases.filter(x => x.id !== id), 'Clase quitada de la grilla')} />
      )}
    </>
  )
}

/** Lo que se elige para escribir ahí mismo algo que todavía no existe (ver Capacidades.catalogoEnLaClase). */
const ACTIVIDAD_NUEVA = '__actividad__'
const PROFE_NUEVO = '__profe__'
const SALA_NUEVA = '__sala__'
const DURACIONES = [30, 45, 60, 75, 90, 120]
const unaLinea = (t: string) => t.replace(/\s+/g, ' ').trim()
const sinAcentos = (t: string) => unaLinea(t).normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()
const slug = (t: string) => sinAcentos(t).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
/** `base`, o `base-2`, `base-3`… si ya está usado. */
function idLibre(base: string, usados: string[]): string {
  if (!usados.includes(base)) return base
  for (let n = 2; ; n++) if (!usados.includes(`${base}-${n}`)) return `${base}-${n}`
}

/**
 * Cargar o editar una clase de la grilla. El modal queda abierto hasta saber
 * que se guardó: si la API rechaza el cambio (se pisa con otra clase, tiene
 * lugares tomados), lo cargado no se pierde.
 */
function EditarClase({ negocio, inscripciones, clase, catalogoEnLaClase, onCerrar, onGuardar, onBorrar }: {
  negocio: NegocioGym; inscripciones: Inscripcion[]; clase: Partial<ClaseSemanal>; catalogoEnLaClase: boolean; onCerrar: () => void
  onGuardar: (c: ClaseSemanal, catalogo?: CatalogoNuevo) => Promise<boolean>; onBorrar: (id: string) => Promise<boolean>
}) {
  const { hoy, ahora } = useReloj()
  // Una clase nueva todavía no tiene id: se le da al guardar (Date.now() en el render rompe la pureza del componente).
  // Arranca con la primera actividad y, de profe, el primero que la da. Sin actividades todavía, con la de escribir una.
  const primera = clase.actividadId ?? negocio.actividades[0]?.id ?? (catalogoEnLaClase ? ACTIVIDAD_NUEVA : '')
  const [v, setV] = useState<ClaseSemanal>({
    id: clase.id ?? '', actividadId: primera, dia: clase.dia ?? 0, inicio: clase.inicio ?? negocio.apertura.desde,
    profeId: clase.profeId ?? negocio.profes.find(p => p.actividades.includes(primera))?.id ?? negocio.profes[0]?.id ?? '',
    sala: clase.sala ?? negocio.salas[0] ?? '', cupo: clase.cupo ?? actividadDe(negocio, primera)?.cupo ?? 10,
  })
  // Lo que se escribe acá mismo cuando todavía no existe en el negocio.
  const [actividadNueva, setActividadNueva] = useState({ nombre: '', duracion: 60 })
  const [profeNuevo, setProfeNuevo] = useState('')
  const [salaNueva, setSalaNueva] = useState('')
  const [guardando, setGuardando] = useState(false)
  const esNueva = !clase.id
  const creaActividad = v.actividadId === ACTIVIDAD_NUEVA
  const creaProfe = v.profeId === PROFE_NUEVO
  const creaSala = v.sala === SALA_NUEVA
  const act = creaActividad ? undefined : actividadDe(negocio, v.actividadId)
  const profe = creaProfe ? undefined : profeDe(negocio, v.profeId)
  const dura = creaActividad ? actividadNueva.duracion : act?.duracion ?? 60
  const sala = creaSala ? unaLinea(salaNueva) : v.sala
  const nombreActividad = unaLinea(actividadNueva.nombre)
  const nombreProfe = unaLinea(profeNuevo)
  const actividadRepetida = creaActividad && negocio.actividades.some(a => sinAcentos(a.nombre) === sinAcentos(nombreActividad))
  const salaRepetida = creaSala && negocio.salas.some(s => sinAcentos(s) === sinAcentos(sala))
  // Lo que falta para poder guardar, dicho en una línea (el botón apagado no explica nada).
  const falta = creaActividad && nombreActividad.length < 2 ? 'Escribí el nombre de la actividad.'
    : !creaActividad && !act ? (catalogoEnLaClase ? 'Elegí una actividad.' : 'Todavía no hay actividades: cargalas en Actividades y salas.')
    : creaProfe && nombreProfe.length < 2 ? 'Escribí el nombre del profe.'
    : creaSala && sala.length < 2 ? 'Escribí el nombre de la sala.'
    : undefined
  // Las horas del horario del negocio de 15 en 15; si la clase quedó fuera (se cambió el horario), su hora también va, para que el selector la muestre.
  const enHorario = Array.from({ length: Math.floor((negocio.apertura.hasta - negocio.apertura.desde) / 15) }, (_, i) => negocio.apertura.desde + i * 15)
  const horas = enHorario.includes(v.inicio) ? enHorario : [...enHorario, v.inicio].sort((a, b) => a - b)
  const dias = DIAS_SEMANA.map((d, i) => ({ id: i, label: d })).filter(x => negocio.apertura.dias.includes(x.id) || x.id === v.dia)
  // Dos clases en la misma sala no pueden pisarse (sin sala no hay con quién chocar), y la clase tiene que terminar antes del cierre.
  const choca = sala ? negocio.clases.find(c => c.id !== v.id && c.dia === v.dia && sinAcentos(c.sala) === sinAcentos(sala) && c.inicio < v.inicio + dura && v.inicio < c.inicio + (actividadDe(negocio, c.actividadId)?.duracion ?? 60)) : undefined
  const fuera = v.inicio < negocio.apertura.desde || v.inicio + dura > negocio.apertura.hasta || !negocio.apertura.dias.includes(v.dia)
  // Lo reservado se cuida: los lugares que esta clase tiene por delante (desde ahora) no se mueven de día ni de hora
  // ni se quedan sin clase, y el cupo no baja de lo que ya está tomado en ninguna fecha. Acá se avisa antes de
  // guardar; con la API, la que decide es la API (el panel puede estar mirando datos de hace un rato).
  const porDelante = esNueva ? 0 : inscripciones
    .filter(i => i.claseId === clase.id && i.estado === 'reservada' && (i.fecha > hoy || (i.fecha === hoy && (clase.inicio ?? 0) > ahora)))
    .reduce((s, i) => s + lugaresDe(i), 0)
  const duraAntes = actividadDe(negocio, clase.actividadId ?? '')?.duracion ?? dura
  const mueve = !esNueva && (v.dia !== clase.dia || v.inicio !== clase.inicio || dura !== duraAntes)
  const noSeMueve = mueve && porDelante > 0
  const tomado = esNueva || !clase.id ? null : maximoTomadoDesde(clase.id, hoy, inscripciones)
  const cupoCorto = !!tomado && v.cupo < tomado.lugares
  const lugaresTxt = (n: number) => `${n} ${n === 1 ? 'lugar reservado' : 'lugares reservados'}`
  const noSePuede = !!choca || fuera || noSeMueve || cupoCorto || actividadRepetida || salaRepetida || !!falta

  const guardar = async () => {
    if (noSePuede || guardando) return
    const catalogo: CatalogoNuevo = {}
    let actividadId = v.actividadId
    let profeId = v.profeId
    if (creaActividad) {
      actividadId = idLibre(`act-${slug(nombreActividad) || 'clase'}`, negocio.actividades.map(a => a.id))
      catalogo.actividades = [...negocio.actividades, { id: actividadId, nombre: nombreActividad, duracion: actividadNueva.duracion, cupo: v.cupo, color: COLORES_ACTIVIDAD[negocio.actividades.length % COLORES_ACTIVIDAD.length] }]
    }
    if (creaProfe) {
      profeId = idLibre(`p-${slug(nombreProfe) || 'profe'}`, negocio.profes.map(p => p.id))
      catalogo.profes = [...negocio.profes, { id: profeId, nombre: nombreProfe, color: colorDe(nombreProfe), actividades: [actividadId] }]
    }
    if (creaSala) catalogo.salas = [...negocio.salas, sala]
    setGuardando(true)
    const ok = await onGuardar({ ...v, id: esNueva ? `k${Date.now().toString(36)}` : v.id, actividadId, profeId, sala }, Object.keys(catalogo).length ? catalogo : undefined)
    if (ok) onCerrar()
    else setGuardando(false)
  }
  const quitar = async () => {
    if (guardando) return
    setGuardando(true)
    if (await onBorrar(v.id)) onCerrar()
    else setGuardando(false)
  }

  const actividades = [
    ...negocio.actividades.map(a => ({ id: a.id, label: `${a.nombre} · ${a.duracion} min` })),
    ...(catalogoEnLaClase ? [{ id: ACTIVIDAD_NUEVA, label: 'Actividad nueva…' }] : []),
  ]
  const profes = [
    ...negocio.profes.map(p => ({ id: p.id, label: creaActividad || p.actividades.includes(v.actividadId) ? p.nombre : `${p.nombre} · no da ${act?.nombre ?? 'esta actividad'}` })),
    ...(catalogoEnLaClase ? [{ id: PROFE_NUEVO, label: 'Alguien nuevo…' }] : []),
    { id: '', label: 'Sin profe por ahora' },
  ]
  const salas = [
    ...negocio.salas.map(s => ({ id: s, label: s })),
    ...(catalogoEnLaClase ? [{ id: SALA_NUEVA, label: 'Sala nueva…' }] : []),
    ...(catalogoEnLaClase || negocio.salas.length === 0 ? [{ id: '', label: 'Sin sala' }] : []),
  ]
  return (
    <Modal titulo={esNueva ? 'Nueva clase' : 'Editar clase'} bajada="Se repite todas las semanas el mismo día y a la misma hora." onCerrar={onCerrar}
      pie={<>
        {!esNueva && <button type="button" className="rv-btn rv-btn--peligro rv-modal-izq" onClick={() => void quitar()} disabled={porDelante > 0 || guardando} title={porDelante > 0 ? `Tiene ${lugaresTxt(porDelante)} por delante: liberalos antes de quitarla.` : undefined}><Trash2 size={15} aria-hidden /> Quitar</button>}
        <button type="button" className="rv-btn" onClick={onCerrar}>Cancelar</button>
        <button type="button" className="rv-btn rv-btn--primario" disabled={noSePuede || guardando} onClick={() => void guardar()}><Check size={15} aria-hidden /> {guardando ? 'Guardando…' : 'Guardar'}</button>
      </>}>
      <div className="rv-pila">
        <Selector label="Actividad" valor={v.actividadId} onChange={id => { const a = actividadDe(negocio, id); setV({ ...v, actividadId: id, cupo: a?.cupo ?? v.cupo }) }} opciones={actividades.length ? actividades : [{ id: '', label: 'Sin actividades todavía' }]} />
        {creaActividad && (
          <div className="rv-dos">
            <Campo label="Nombre de la actividad" value={actividadNueva.nombre} onChange={x => setActividadNueva({ ...actividadNueva, nombre: x })} placeholder="Funcional, Yoga, Spinning" maxLength={60}
              error={actividadRepetida ? 'Ya hay una actividad con ese nombre: elegila en la lista de arriba.' : undefined} ayuda="Queda en la lista para las próximas clases." />
            <Selector label="Duración" valor={actividadNueva.duracion} onChange={d => setActividadNueva({ ...actividadNueva, duracion: d })} opciones={DURACIONES.map(d => ({ id: d, label: `${d} min` }))} />
          </div>
        )}
        <div className="rv-dos">
          <Selector label="Día" valor={v.dia} onChange={d => setV({ ...v, dia: d })} opciones={dias} />
          <Selector label="Hora" valor={v.inicio} onChange={h => setV({ ...v, inicio: h })} opciones={horas.map(h => ({ id: h, label: hhmm(h) }))} />
        </div>
        {/* Profe y sala, cada uno con el campo para escribir uno nuevo debajo del suyo: en celular (una sola columna) el
            nombre queda pegado a su selector, y no después del otro. */}
        <div className="rv-dos">
          <div className="rv-pila">
            {/* "Sin profe" existe para cuando alguien se fue del equipo: la clase sigue, y se le asigna otro después. */}
            <Selector label="Profe" valor={v.profeId} onChange={id => setV({ ...v, profeId: id })} opciones={profes}
              ayuda={creaProfe ? undefined : !v.profeId ? 'Queda sin profe: se ve así en la grilla y en el sitio hasta que asignes a alguien.' : profe && !creaActividad && !profe.actividades.includes(v.actividadId) ? `${profe.nombre} no tiene ${act?.nombre ?? 'esta actividad'} en Equipo; igual se puede.` : undefined} />
            {creaProfe && <Campo label="Nombre del profe" value={profeNuevo} onChange={setProfeNuevo} placeholder="Nombre y apellido" maxLength={60} autoComplete="off" />}
          </div>
          <div className="rv-pila">
            <Selector label="Sala" valor={v.sala} onChange={s => setV({ ...v, sala: s })} opciones={salas} />
            {creaSala && <Campo label="Nombre de la sala" value={salaNueva} onChange={setSalaNueva} placeholder="Salón principal, Box" maxLength={40} error={salaRepetida ? 'Esa sala ya existe: elegila en la lista de arriba.' : undefined} />}
          </div>
        </div>
        <Campo label="Cupo" value={String(v.cupo)} onChange={x => setV({ ...v, cupo: Math.max(1, Number(x.replace(/\D/g, '')) || 1) })} inputMode="numeric" ayuda="Cuántos lugares tiene esta clase. Si se pasa, el resto queda en lista de espera."
          error={cupoCorto && tomado?.fecha ? `El ${fechaCorta(tomado.fecha)} ya hay ${tomado.lugares} lugares tomados: el cupo no puede ser menor.` : undefined} />
        {choca && <p className="rv-error" role="alert" style={{ margin: 0 }}>Se pisa con {actividadDe(negocio, choca.actividadId)?.nombre} de las {hhmm(choca.inicio)} en {choca.sala}.</p>}
        {!choca && fuera && <p className="rv-error" role="alert" style={{ margin: 0 }}>{negocio.apertura.dias.includes(v.dia) ? `Queda fuera del horario: abrís de ${hhmm(negocio.apertura.desde)} a ${hhmm(negocio.apertura.hasta)} y esta clase va de ${hhmm(v.inicio)} a ${hhmm(v.inicio + dura)}.` : `Ese día no abrís: elegí otro día o cambiá los horarios en Configuración.`}</p>}
        {noSeMueve && <p className="rv-error" role="alert" style={{ margin: 0 }}>Tiene {lugaresTxt(porDelante)} por delante en este día y horario: liberalos (o esperá a que pasen) antes de cambiarle el día, la hora o la duración.</p>}
        {!esNueva && porDelante > 0 && !noSeMueve && <p className="rv-ayuda" style={{ margin: 0 }}>Tiene {lugaresTxt(porDelante)} por delante: para quitarla, primero liberalos desde la clase de cada día.</p>}
        {falta && <p className="rv-ayuda" style={{ margin: 0 }}>{falta}</p>}
      </div>
    </Modal>
  )
}
