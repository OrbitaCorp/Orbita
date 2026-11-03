// Alumnos (o socios, según el rubro): quién tiene qué plan, cuándo vence,
// cuántas clases le quedan y cuánto viene. Los que vencen en los próximos 7
// días van primero: son la llamada que hay que hacer esta semana. Desde la
// ficha se asigna o renueva el plan, se manda el aviso de vencimiento y se ve
// el historial. La ficha abierta viaja en la URL (?socio=): la campanita y el
// buscador llegan directo a ella.
import { useMemo, useState } from 'react'
import { useRouter } from 'next/router'
import { ArrowRight, BellRing, Check, MessageCircle, Plus, Search, UserCheck, UserMinus, UserX } from 'lucide-react'
import { diasEntre, fechaCorta, fechaLarga, hhmm, mesTxt, sumarDias } from '@/lib/reservas/fechas'
import { pesos } from '@/lib/reservas/precio'
import { ESTADO_INSCRIPCION, ESTADO_PLAN, HOY, actividadDe, colorDe, estadoPlanDe, planDe, rubroPorKey, type EstadoPlan, type Inscripcion, type NegocioGym, type Socio } from '../datos'
import { Campo, Chip, Encabezado, Kpi, Modal, Nota, Selector, Sigla, Vacio } from '@/design-system/reservas/piezas'

interface P {
  negocio: NegocioGym; inscripciones: Inscripcion[]; socios: Socio[]
  onAgregar: (s: Socio) => void
  onCambiar: (id: string, cambio: Partial<Socio>, aviso?: string, detalle?: string) => void
  onAvisar: (titulo: string, detalle?: string) => void
}

type Filtro = 'todos' | 'vigente' | 'por-vencer' | 'vencido' | 'sin-plan'
// Sin tildes ni mayúsculas, para buscar "ramirez" y encontrar "Ramírez".
const plano = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()
const q1 = (v: unknown) => (typeof v === 'string' ? v : '')

// Los filtros: la tira de chips de Pedidos en Tienda (un chip por estado con su
// cuenta, el activo en el tono del acento). En celular se vuelven píldoras que
// scrollean, de 44 px, y el buscador pasa arriba a todo el ancho. No usa
// .ds-tira-chip de globals.css: ahí las píldoras miden 38 px.
// La fecha de vencimiento va en los tonos de chip: el --color-warning y el
// --color-error del panel (#F59E0B, #EF4444) sobre blanco no llegan a AA.
const CSS = `
  .gso-filtros { display: flex; align-items: center; justify-content: space-between; gap: 10px; flex-wrap: wrap; margin-bottom: 14px; }
  .gso-tira { display: flex; gap: 2px; padding: 4px; max-width: 100%; border-radius: 10px; border: 1px solid var(--color-border); background: var(--color-bg); overflow-x: auto; scrollbar-width: none; }
  .gso-tira::-webkit-scrollbar { display: none; }
  .gso-chip { display: inline-flex; align-items: center; gap: 7px; min-height: 34px; padding: 0 12px; border-radius: 8px; border: none; background: transparent; color: var(--color-body); font: inherit; font-size: 13px; font-weight: 500; white-space: nowrap; cursor: pointer; }
  /* El activo va en tinta de chip (--chip-primary-fg), no en --color-primary: ese azul sobre fondo claro no llega a AA en 13 px. */
  .gso-chip[data-activa='true'] { background: var(--color-primary-bg); color: var(--chip-primary-fg); font-weight: 600; }
  .gso-chip:focus-visible { outline: 2px solid var(--color-primary); outline-offset: -2px; }
  .gso-chip-n { font-family: var(--rv-mono); font-size: 11px; font-weight: 600; padding: 1px 6px; border-radius: 999px; background: var(--color-surface-alt); color: var(--color-body); }
  .gso-chip[data-activa='true'] .gso-chip-n { background: var(--color-bg); color: var(--chip-primary-fg); }
  .gso-buscar { width: 280px; max-width: 100%; }
  .gso-nombre { display: block; font-weight: 600; color: var(--color-text); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .gso-vence[data-estado='por-vencer'] { color: var(--chip-warning-fg); font-weight: 600; }
  .gso-vence[data-estado='vencido'] { color: var(--chip-error-fg); }
  .gso-mas { display: flex; flex-direction: column; align-items: center; gap: 6px; margin-top: 14px; }
  /* "Ves N de M" va suelto sobre el fondo del panel: en claro, sobre el cielo, el apagado no llega a AA. */
  .gso-mas .rv-ayuda { color: var(--rv-tinta-fondo, var(--color-muted)); }
  @media (max-width: 768px) {
    .gso-tira { gap: 8px; padding: 2px 0; border: none; background: transparent; border-radius: 0; }
    .gso-chip { min-height: 44px; padding: 0 14px; border-radius: 999px; border: 1px solid var(--color-border); background: var(--color-bg); }
    .gso-chip[data-activa='true'] { background: var(--color-primary-bg); border-color: var(--color-primary); }
    .gso-buscar { width: 100%; order: -1; }
    .gso-mas .rv-btn { width: 100%; }
  }
`

/** Cuántas filas se muestran de entrada y cuántas suma "Mostrar más": un gimnasio tiene cientos de socios. */
const PAGINA = 25

export default function Socios({ negocio, inscripciones, socios, onAgregar, onCambiar, onAvisar }: P) {
  const router = useRouter()
  const r = rubroPorKey(negocio.rubro)
  const [filtro, setFiltroEstado] = useState<Filtro>('todos')
  const [q, setQEstado] = useState('')
  const [mostrar, setMostrar] = useState(PAGINA)
  // Con otro filtro u otra búsqueda la lista vuelve a arrancar desde arriba.
  const setFiltro = (f: Filtro) => { setFiltroEstado(f); setMostrar(PAGINA) }
  const setQ = (v: string) => { setQEstado(v); setMostrar(PAGINA) }
  const abierto = q1(router.query.socio)
  const abrir = (id: string | null) => {
    const { socio: _s, ...resto } = router.query
    void _s
    void router.replace({ pathname: router.pathname, query: id ? { ...resto, socio: id } : resto }, undefined, { shallow: true, scroll: false })
  }
  const [nuevo, setNuevo] = useState(false)
  // Las inscripciones de cada socio, de una pasada (con cientos de socios, filtrar la lista entera por cada uno se notaba).
  const porSocio = useMemo(() => {
    const m = new Map<string, Inscripcion[]>()
    for (const i of inscripciones) { const l = m.get(i.socioId); if (l) l.push(i); else m.set(i.socioId, [i]) }
    return m
  }, [inscripciones])
  const filas = useMemo(() => socios.map(s => {
    const suyas = porSocio.get(s.id) ?? []
    const ultimas30 = suyas.filter(i => i.fecha >= sumarDias(HOY, -30) && i.fecha <= HOY)
    const vino = ultimas30.filter(i => i.estado === 'asistio').length
    const falto = ultimas30.filter(i => i.estado === 'ausente').length
    const estado = estadoPlanDe(s)
    return { s, estado, vino, falto, asistencia: vino + falto ? Math.round((vino / (vino + falto)) * 100) : null, suyas }
  }), [socios, porSocio])
  const orden: Record<EstadoPlan, number> = { 'por-vencer': 0, vencido: 1, agotado: 1, vigente: 2, 'sin-plan': 3 }
  const visibles = filas
    .filter(f => filtro === 'todos' || (filtro === 'vencido' ? f.estado === 'vencido' || f.estado === 'agotado' : f.estado === filtro))
    .filter(f => !q.trim() || plano(`${f.s.nombre} ${f.s.telefono}`).includes(plano(q.trim())))
    .sort((a, b) => orden[a.estado] - orden[b.estado] || (a.s.vence ?? '9').localeCompare(b.s.vence ?? '9'))
  const cuenta = (e: EstadoPlan | 'todos') => (e === 'todos' ? filas.length : filas.filter(f => (e === 'vencido' ? f.estado === 'vencido' || f.estado === 'agotado' : f.estado === e)).length)
  const fila = abierto ? filas.find(f => f.s.id === abierto) ?? null : null
  const FILTROS: { id: Filtro; label: string }[] = [{ id: 'todos', label: 'Todos' }, { id: 'vigente', label: 'Al día' }, { id: 'por-vencer', label: 'Vencen en 7 días' }, { id: 'vencido', label: 'Vencidos' }, { id: 'sin-plan', label: 'Sin plan' }]
  // El aviso de vencimientos: quiénes vencen en los próximos 7 días, el que vence primero adelante.
  const vencen = filas.filter(f => f.estado === 'por-vencer').sort((a, b) => (a.s.vence ?? '').localeCompare(b.s.vence ?? ''))

  return (
    <div className="rv-pagina">
      <style>{CSS}</style>
      <Encabezado rotulo={`${socios.length} en total`} titulo={r.socios} bajada="Quién tiene qué plan, cuándo vence y cuánto viene. Los que vencen pronto van primero."
        acciones={<button type="button" className="rv-btn rv-btn--primario" onClick={() => setNuevo(true)}><Plus size={16} aria-hidden /> Sumar {r.socio.toLowerCase()}</button>} />
      {vencen.length > 0 && (
        <div style={{ marginBottom: 16 }} role="status">
          <Nota tono="aviso">
            <BellRing size={16} aria-hidden style={{ flexShrink: 0, marginTop: 2 }} />
            <span style={{ flex: 1, minWidth: 0 }}>
              <b>{vencen.length === 1 ? 'Un plan vence' : `${vencen.length} planes vencen`} en los próximos 7 días:</b>{' '}
              {vencen.slice(0, 4).map(f => `${f.s.nombre.split(' ')[0]} (${f.s.vence ? fechaCorta(f.s.vence) : ''})`).join(', ')}{vencen.length > 4 ? ` y ${vencen.length - 4} más` : ''}. Avisales para que renueven.
            </span>
            {filtro !== 'por-vencer' && <button type="button" className="rv-btn rv-btn--sm" style={{ flexShrink: 0 }} onClick={() => setFiltro('por-vencer')}>Ver</button>}
          </Nota>
        </div>
      )}
      <div className="rv-kpis" style={{ marginBottom: 16 }}>
        <Kpi i={0} label="Al día" valor={String(cuenta('vigente') + cuenta('por-vencer'))} Icon={UserCheck} tono="ok" nota="con plan vigente" />
        <Kpi i={1} label="Vencen en 7 días" valor={String(cuenta('por-vencer'))} Icon={BellRing} tono="aviso" nota={cuenta('por-vencer') ? 'para avisarles esta semana' : 'nadie por ahora'} />
        <Kpi i={2} label="Vencidos" valor={String(cuenta('vencido'))} Icon={UserX} tono="error" nota="plan vencido o pack agotado" />
        <Kpi i={3} label="Sin plan" valor={String(cuenta('sin-plan'))} Icon={UserMinus} nota="de prueba, con clase suelta o sin clases" />
      </div>
      <div className="gso-filtros">
        <div className="gso-tira" role="group" aria-label="Filtrar por plan">
          {FILTROS.map(f => (
            <button key={f.id} type="button" className="ds-hover gso-chip" data-activa={filtro === f.id} aria-pressed={filtro === f.id} onClick={() => setFiltro(f.id)}>
              {f.label} <span className="gso-chip-n">{cuenta(f.id)}</span>
            </button>
          ))}
        </div>
        <label className="rv-campo gso-buscar">
          <span className="rv-sr">Buscar</span>
          <span className="rv-con-prefijo"><i><Search size={15} /></i><input className="rv-input" value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar por nombre o teléfono" style={{ paddingLeft: 36 }} /></span>
        </label>
      </div>
      {visibles.length === 0 ? <Vacio titulo="Nadie con ese filtro" texto={q.trim() ? `No hay nadie que se llame "${q.trim()}" ni con ese teléfono.` : undefined} /> : (
        <div className="rv-card" style={{ padding: '0 16px' }}>
          <table className="rv-tabla">
            <thead><tr><th>{r.socio}</th><th>Plan</th><th>Vence</th><th>Le quedan</th><th>Asistencia 30 d</th><th><span className="rv-sr">Abrir</span></th></tr></thead>
            <tbody>
              {visibles.slice(0, mostrar).map(f => {
                const plan = planDe(negocio, f.s.planId)
                return (
                  <tr key={f.s.id}>
                    <td data-label="Nombre"><span className="rv-fila" style={{ gap: 10, flexWrap: 'nowrap' }}><Sigla nombre={f.s.nombre} color={colorDe(f.s.nombre)} size={32} /><span style={{ minWidth: 0 }}><span className="gso-nombre">{f.s.nombre}</span><span className="rv-ayuda" style={{ fontWeight: 400 }}>{f.s.telefono}</span></span></span></td>
                    <td data-label="Plan"><span className="rv-fila" style={{ gap: 6, flexWrap: 'nowrap' }}><Chip tono={ESTADO_PLAN[f.estado].tono}>{ESTADO_PLAN[f.estado].label}</Chip><span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{plan?.nombre ?? '—'}</span></span></td>
                    <td data-label="Vence">{f.s.vence ? <span className="gso-vence" data-estado={f.estado === 'agotado' ? 'vencido' : f.estado}>{fechaCorta(f.s.vence)}{f.estado === 'por-vencer' ? ` · en ${diasEntre(HOY, f.s.vence)} d` : ''}</span> : '—'}</td>
                    {/* El número en mono va en su span: en la tarjeta de celular el rótulo de la celda (::before) quedaba en mono también. */}
                    <td data-label="Le quedan"><span className="rv-num">{f.s.clasesRestantes !== null ? `${f.s.clasesRestantes} clases` : plan?.porSemana ? `${plan.porSemana}/sem` : plan ? 'libre' : '—'}</span></td>
                    <td data-label="Asistencia 30 d">{f.asistencia !== null ? `${f.asistencia}% · ${f.vino} ${f.vino === 1 ? 'clase' : 'clases'}` : <span className="rv-muted">sin clases</span>}</td>
                    <td><button type="button" className="rv-btn rv-btn--sm" onClick={() => abrir(f.s.id)} aria-label={`Ver a ${f.s.nombre}`} aria-haspopup="dialog">Ver <ArrowRight size={14} aria-hidden /></button></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
      {visibles.length > mostrar && (
        <div className="gso-mas">
          <button type="button" className="rv-btn" onClick={() => setMostrar(mostrar + PAGINA)}>Mostrar {Math.min(PAGINA, visibles.length - mostrar)} más</button>
          <span className="rv-ayuda">Ves {mostrar} de {visibles.length}</span>
        </div>
      )}
      {fila && <Ficha negocio={negocio} socio={fila.s} estado={fila.estado} suyas={fila.suyas} vino={fila.vino} falto={fila.falto} onCerrar={() => abrir(null)} onCambiar={onCambiar} onAvisar={onAvisar} />}
      {nuevo && <NuevoSocio negocio={negocio} socioTxt={r.socio} onCerrar={() => setNuevo(false)} onAgregar={s => { onAgregar(s); setNuevo(false) }} />}
    </div>
  )
}

function Ficha({ negocio, socio: s, estado, suyas, vino, falto, onCerrar, onCambiar, onAvisar }: { negocio: NegocioGym; socio: Socio; estado: EstadoPlan; suyas: Inscripcion[]; vino: number; falto: number; onCerrar: () => void; onCambiar: P['onCambiar']; onAvisar: P['onAvisar'] }) {
  const plan = planDe(negocio, s.planId)
  // Se asigna un pack o una membresía: la prueba y la suelta son de una sola clase, no son un plan del socio.
  const asignables = negocio.planes.filter(p => p.tipo === 'pack' || p.tipo === 'membresia')
  const [renovar, setRenovar] = useState<string>(plan && asignables.some(p => p.id === plan.id) ? plan.id : asignables.find(p => p.tipo === 'membresia')?.id ?? asignables[0]?.id ?? '')
  const historial = [...suyas].sort((a, b) => b.fecha.localeCompare(a.fecha)).slice(0, 10)
  const claseDe = (i: Inscripcion) => negocio.clases.find(c => c.id === i.claseId)
  const nombre = s.nombre.split(' ')[0]
  const asignar = () => {
    const p = planDe(negocio, renovar)
    if (!p) return
    onCambiar(s.id, { planId: p.id, desde: HOY, vence: sumarDias(HOY, p.vigenciaDias), clasesRestantes: p.tipo === 'pack' ? p.clases ?? null : null, probo: true }, `${p.nombre} asignado a ${nombre}`, `Hasta el ${fechaCorta(sumarDias(HOY, p.vigenciaDias))}. El cobro se registra a mano.`)
  }
  // El aviso de vencimiento es la plantilla de Recordatorios y mensajes; mandarlo acá es simulado.
  const avisable = estado === 'por-vencer' || estado === 'vencido' || estado === 'agotado'
  const avisar = () => onAvisar(`Aviso enviado a ${nombre} por WhatsApp`, negocio.mensajes.plantillas.vence.on ? 'Demo: no se mandó nada.' : 'El aviso automático está apagado en Mensajes; este salió a mano. Demo: no se mandó nada.')
  return (
    <Modal titulo={s.nombre} bajada={`${s.telefono}${s.email ? ` · ${s.email}` : ''}${s.alta ? ` · desde ${mesTxt(s.alta)}` : ''}`} onCerrar={onCerrar} ancho={600} pie={<button type="button" className="rv-btn" onClick={onCerrar}>Cerrar</button>}>
      {s.nota && <p className="rv-nota" style={{ marginBottom: 12 }}>{s.nota}</p>}
      <div className="rv-card rv-card--pad" style={{ background: 'var(--color-surface)', marginBottom: 14 }}>
        <div className="rv-entre">
          <div><span className="rv-rotulo">Plan</span><div className="rv-h3" style={{ marginTop: 4 }}>{plan?.nombre ?? 'Sin plan'}</div>
            <div className="rv-ayuda" style={{ marginTop: 2 }}>{s.vence ? `${estado === 'vencido' ? 'Venció' : 'Vence'} el ${fechaLarga(s.vence).toLowerCase()}` : 'Nunca tuvo plan'}{s.clasesRestantes !== null ? ` · le quedan ${s.clasesRestantes} clases` : ''}</div></div>
          <Chip tono={ESTADO_PLAN[estado].tono}>{ESTADO_PLAN[estado].label}</Chip>
        </div>
        <div className="rv-fila" style={{ marginTop: 12, alignItems: 'flex-end' }}>
          <div style={{ flex: 1, minWidth: 200 }}><Selector label={plan ? 'Renovar o cambiar' : 'Asignar un plan'} valor={renovar} onChange={setRenovar} opciones={asignables.map(p => ({ id: p.id, label: `${p.nombre} · ${pesos(p.precio)}` }))} /></div>
          <button type="button" className="rv-btn rv-btn--primario" onClick={asignar} disabled={!asignables.length}><Check size={15} aria-hidden /> {plan ? 'Renovar' : 'Asignar'}</button>
        </div>
        <div className="rv-entre" style={{ marginTop: 10 }}>
          <p className="rv-ayuda" style={{ margin: 0 }}>Arranca hoy. El cobro se registra a mano (demo).</p>
          {avisable && <button type="button" className="rv-btn rv-btn--sm" onClick={avisar}><MessageCircle size={14} aria-hidden /> Avisar que vence</button>}
        </div>
      </div>
      <div className="rv-kpis rv-kpis--3" style={{ marginBottom: 14 }}>
        <Kpi label="Vino" valor={vino} nota="últimos 30 días" />
        <Kpi i={1} label="Faltó" valor={falto} nota="sin avisar" />
        <Kpi i={2} label="Asistencia" valor={vino + falto ? `${Math.round((vino / (vino + falto)) * 100)}%` : '—'} />
      </div>
      <div className="rv-rotulo" style={{ marginBottom: 6 }}>Últimas clases</div>
      <div className="rv-lista">
        {historial.map(i => {
          const c = claseDe(i)
          return (
            <div key={i.id} className="rv-item">
              <span className="rv-item-cuerpo"><span className="rv-item-titulo">{c ? actividadDe(negocio, c.actividadId)?.nombre : 'Clase quitada de la grilla'}</span><span className="rv-item-sub">{fechaCorta(i.fecha)}{c ? ` · ${hhmm(c.inicio)}` : ''}</span></span>
              <Chip tono={ESTADO_INSCRIPCION[i.estado].tono}>{ESTADO_INSCRIPCION[i.estado].label}</Chip>
            </div>
          )
        })}
        {historial.length === 0 && <p className="rv-ayuda" style={{ margin: '6px 0' }}>Todavía no reservó ninguna clase.</p>}
      </div>
    </Modal>
  )
}

function NuevoSocio({ negocio, socioTxt, onCerrar, onAgregar }: { negocio: NegocioGym; socioTxt: string; onCerrar: () => void; onAgregar: (s: Socio) => void }) {
  const [nombre, setNombre] = useState('')
  const [telefono, setTelefono] = useState('')
  const [email, setEmail] = useState('')
  const [planId, setPlanId] = useState('')
  const [error, setError] = useState('')
  const guardar = () => {
    if (nombre.trim().length < 3) { setError('Escribí nombre y apellido.'); return }
    if (telefono.replace(/\D/g, '').length < 8) { setError('Escribí un celular con código de área.'); return }
    const p = planDe(negocio, planId || null)
    onAgregar({ id: `sn${Date.now().toString(36)}`, nombre: nombre.trim(), telefono: telefono.trim(), email: email.trim() || undefined, planId: p?.id ?? null, desde: p ? HOY : null, vence: p ? sumarDias(HOY, p.vigenciaDias) : null, clasesRestantes: p?.tipo === 'pack' ? p.clases ?? null : null, probo: false, alta: HOY })
  }
  return (
    <Modal titulo={`Sumar ${socioTxt.toLowerCase()}`} bajada="Para quien se anota en el mostrador. Después reserva desde el sitio con su celular." onCerrar={onCerrar}
      pie={<><button type="button" className="rv-btn" onClick={onCerrar}>Cancelar</button><button type="button" className="rv-btn rv-btn--primario" onClick={guardar}><Check size={15} aria-hidden /> Sumar</button></>}>
      <div className="rv-pila">
        <Campo label="Nombre y apellido" value={nombre} onChange={setNombre} autoComplete="off" />
        <div className="rv-dos">
          <Campo label="Celular" value={telefono} onChange={setTelefono} inputMode="tel" />
          <Campo label="Email (opcional)" value={email} onChange={setEmail} inputMode="email" />
        </div>
        <Selector label="Plan" valor={planId} onChange={setPlanId} opciones={[{ id: '', label: 'Sin plan por ahora' }, ...negocio.planes.filter(p => p.tipo === 'pack' || p.tipo === 'membresia').map(p => ({ id: p.id, label: `${p.nombre} · ${pesos(p.precio)}` }))]} />
        {error && <p className="rv-error" role="alert" style={{ margin: 0 }}>{error}</p>}
      </div>
    </Modal>
  )
}
