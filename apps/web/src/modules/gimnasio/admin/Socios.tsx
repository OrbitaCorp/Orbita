// Socios: quién tiene qué plan, cuándo vence, cuántas clases le quedan y
// cuánto viene. Los que vencen en los próximos 7 días van primero: son la
// llamada que hay que hacer esta semana. Desde la ficha se asigna o renueva
// el plan y se ve el historial.
import { useMemo, useState } from 'react'
import { ArrowRight, BellRing, Plus, Search, Check } from 'lucide-react'
import { diasEntre, fechaCorta, fechaLarga, hhmm, sumarDias } from '@/lib/reservas/fechas'
import { pesos } from '@/lib/reservas/precio'
import { ESTADO_INSCRIPCION, ESTADO_PLAN, HOY, actividadDe, estadoPlanDe, planDe, rubroPorKey, type EstadoPlan, type Inscripcion, type NegocioGym, type Socio } from '../datos'
import { Campo, Chip, Encabezado, Filtros, Kpi, Modal, Nota, Selector, Sigla, Vacio } from '@/design-system/reservas/piezas'

interface P { negocio: NegocioGym; inscripciones: Inscripcion[]; socios: Socio[]; onAgregar: (s: Socio) => void; onCambiar: (id: string, cambio: Partial<Socio>, aviso?: string) => void }

type Filtro = 'todos' | 'vigente' | 'por-vencer' | 'vencido' | 'sin-plan'
// Sin tildes ni mayúsculas, para buscar "ramirez" y encontrar "Ramírez".
const plano = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()

// En celular el buscador va a todo el ancho, arriba de los filtros plegados.
const CSS = `
  .gic-buscar { width: 260px; max-width: 100%; }
  @media (max-width: 768px) { .gic-buscar { width: 100%; order: -1; } }
`

export default function Socios({ negocio, inscripciones, socios, onAgregar, onCambiar }: P) {
  const r = rubroPorKey(negocio.rubro)
  const [filtro, setFiltro] = useState<Filtro>('todos')
  const [q, setQ] = useState('')
  const [abierto, setAbierto] = useState<string | null>(null)
  const [nuevo, setNuevo] = useState(false)
  const filas = useMemo(() => socios.map(s => {
    const suyas = inscripciones.filter(i => i.socioId === s.id)
    const ultimas30 = suyas.filter(i => i.fecha >= sumarDias(HOY, -30) && i.fecha <= HOY)
    const vino = ultimas30.filter(i => i.estado === 'asistio').length
    const falto = ultimas30.filter(i => i.estado === 'ausente').length
    const estado = estadoPlanDe(s)
    return { s, estado, vino, falto, asistencia: vino + falto ? Math.round((vino / (vino + falto)) * 100) : null, suyas }
  }), [socios, inscripciones])
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
        <Kpi i={0} label="Al día" valor={cuenta('vigente') + cuenta('por-vencer')} nota="con plan vigente" />
        <Kpi i={1} label="Vencen en 7 días" valor={cuenta('por-vencer')} nota={cuenta('por-vencer') ? 'para avisarles esta semana' : 'nadie por ahora'} />
        <Kpi i={2} label="Vencidos" valor={cuenta('vencido')} nota="plan vencido o pack agotado" />
        <Kpi i={3} label="Sin plan" valor={cuenta('sin-plan')} nota="vinieron a probar o nunca se anotaron" />
      </div>
      <div className="rv-entre" style={{ marginBottom: 14, alignItems: 'flex-start' }}>
        <Filtros resumen={filtro === 'todos' ? undefined : FILTROS.find(f => f.id === filtro)?.label}>
          <div className="rv-fila" role="group" aria-label="Filtrar por plan">
            {FILTROS.map(f => <button key={f.id} type="button" className="rv-chip rv-chip--borde" aria-pressed={filtro === f.id} onClick={() => setFiltro(f.id)}>{f.label} <span className="rv-num" style={{ opacity: 0.7 }}>{cuenta(f.id)}</span></button>)}
          </div>
        </Filtros>
        <label className="rv-campo gic-buscar">
          <span className="rv-sr">Buscar</span>
          <span className="rv-con-prefijo"><i><Search size={15} /></i><input className="rv-input" value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar por nombre o teléfono" style={{ paddingLeft: 36 }} /></span>
        </label>
      </div>
      {visibles.length === 0 ? <Vacio titulo="Nadie con ese filtro" /> : (
        <div className="rv-card" style={{ padding: '0 16px' }}>
          <table className="rv-tabla">
            <thead><tr><th>{r.socio}</th><th>Plan</th><th>Vence</th><th>Le quedan</th><th>Asistencia 30 d</th><th><span className="rv-sr">Abrir</span></th></tr></thead>
            <tbody>
              {visibles.map(f => {
                const plan = planDe(negocio, f.s.planId)
                return (
                  <tr key={f.s.id}>
                    <td data-label="Nombre"><span className="rv-fila" style={{ gap: 10, flexWrap: 'nowrap' }}><Sigla nombre={f.s.nombre} size={32} /><span style={{ minWidth: 0 }}><span style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.s.nombre}</span><span className="rv-ayuda" style={{ fontWeight: 400 }}>{f.s.telefono}</span></span></span></td>
                    <td data-label="Plan"><span className="rv-fila" style={{ gap: 6, flexWrap: 'nowrap' }}><Chip tono={ESTADO_PLAN[f.estado].tono}>{ESTADO_PLAN[f.estado].label}</Chip><span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{plan?.nombre ?? '—'}</span></span></td>
                    <td data-label="Vence">{f.s.vence ? <span style={{ color: f.estado === 'por-vencer' ? 'var(--color-warning)' : f.estado === 'vencido' ? 'var(--color-error)' : undefined }}>{fechaCorta(f.s.vence)}{f.estado === 'por-vencer' ? ` · en ${diasEntre(HOY, f.s.vence)} d` : ''}</span> : '—'}</td>
                    <td data-label="Le quedan" className="rv-num">{f.s.clasesRestantes !== null ? `${f.s.clasesRestantes} clases` : plan?.porSemana ? `${plan.porSemana}/sem` : plan ? 'libre' : '—'}</td>
                    <td data-label="Asistencia">{f.asistencia !== null ? `${f.asistencia}% · ${f.vino} clases` : <span className="rv-muted">sin clases</span>}</td>
                    <td><button type="button" className="rv-btn rv-btn--sm" onClick={() => setAbierto(f.s.id)} aria-label={`Ver a ${f.s.nombre}`}>Ver <ArrowRight size={14} aria-hidden /></button></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
      {fila && <Ficha negocio={negocio} socio={fila.s} estado={fila.estado} suyas={fila.suyas} vino={fila.vino} falto={fila.falto} onCerrar={() => setAbierto(null)} onCambiar={onCambiar} />}
      {nuevo && <NuevoSocio negocio={negocio} socioTxt={r.socio} onCerrar={() => setNuevo(false)} onAgregar={s => { onAgregar(s); setNuevo(false) }} />}
    </div>
  )
}

function Ficha({ negocio, socio: s, estado, suyas, vino, falto, onCerrar, onCambiar }: { negocio: NegocioGym; socio: Socio; estado: EstadoPlan; suyas: Inscripcion[]; vino: number; falto: number; onCerrar: () => void; onCambiar: P['onCambiar'] }) {
  const plan = planDe(negocio, s.planId)
  // Se asigna un pack o una membresía: la prueba y la suelta son de una sola clase, no son un plan del socio.
  const asignables = negocio.planes.filter(p => p.tipo === 'pack' || p.tipo === 'membresia')
  const [renovar, setRenovar] = useState<string>(plan && asignables.some(p => p.id === plan.id) ? plan.id : asignables.find(p => p.tipo === 'membresia')?.id ?? asignables[0]?.id ?? '')
  const historial = [...suyas].sort((a, b) => b.fecha.localeCompare(a.fecha)).slice(0, 10)
  const claseDe = (i: Inscripcion) => negocio.clases.find(c => c.id === i.claseId)
  const asignar = () => {
    const p = planDe(negocio, renovar)
    if (!p) return
    onCambiar(s.id, { planId: p.id, desde: HOY, vence: sumarDias(HOY, p.vigenciaDias), clasesRestantes: p.tipo === 'pack' ? p.clases ?? null : null, probo: true }, `${p.nombre} asignado a ${s.nombre.split(' ')[0]} hasta el ${fechaCorta(sumarDias(HOY, p.vigenciaDias))}`)
  }
  return (
    <Modal titulo={s.nombre} bajada={`${s.telefono}${s.email ? ` · ${s.email}` : ''}`} onCerrar={onCerrar} ancho={600} pie={<button type="button" className="rv-btn" onClick={onCerrar}>Cerrar</button>}>
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
        <p className="rv-ayuda" style={{ margin: '8px 0 0' }}>Arranca hoy. El cobro se registra a mano (demo).</p>
      </div>
      <div className="rv-kpis" style={{ gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', marginBottom: 14 }}>
        <div className="rv-card rv-kpi"><span className="rv-rotulo">Vino</span><span className="rv-kpi-valor" style={{ fontSize: 20 }}>{vino}</span><span className="rv-kpi-nota">últimos 30 días</span></div>
        <div className="rv-card rv-kpi"><span className="rv-rotulo">Faltó</span><span className="rv-kpi-valor" style={{ fontSize: 20 }}>{falto}</span><span className="rv-kpi-nota">sin avisar</span></div>
        <div className="rv-card rv-kpi"><span className="rv-rotulo">Asistencia</span><span className="rv-kpi-valor" style={{ fontSize: 20 }}>{vino + falto ? `${Math.round((vino / (vino + falto)) * 100)}%` : '—'}</span></div>
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
    onAgregar({ id: `sn${Date.now().toString(36)}`, nombre: nombre.trim(), telefono: telefono.trim(), email: email.trim() || undefined, planId: p?.id ?? null, desde: p ? HOY : null, vence: p ? sumarDias(HOY, p.vigenciaDias) : null, clasesRestantes: p?.tipo === 'pack' ? p.clases ?? null : null, probo: false })
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
