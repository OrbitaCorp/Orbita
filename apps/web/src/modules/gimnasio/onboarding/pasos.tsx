// Lo que el alta única le pide a quien elige Gimnasio: el rubro (gimnasio,
// crossfit, yoga…), las actividades con su cupo y los planes con sus precios.
// El resto del alta (negocio, ubicación, página, cuenta, pago) es el mismo
// para todos los módulos y vive en modules/onboarding/alta.
import { Check, Plus, Trash2 } from 'lucide-react'
import { pesos } from '@/lib/reservas/precio'
import { EstiloReservas } from '@/design-system/reservas/estilo'
import { Campo, FilaSwitch, Selector } from '@/design-system/reservas/piezas'
import { RUBROS_GYM, negocioDe, rubroPorKey, type NegocioGym, type Plan } from '../datos'

export interface AltaGym {
  rubro: string | null
  actividades: { id: string; nombre: string; duracion: number; cupo: number }[]
  planes: { prueba: boolean; suelta: number; packClases: number; packPrecio: number; membresia2: number; membresia3: number; libre: number }
}

export const ALTA_GYM_INICIAL: AltaGym = {
  rubro: null,
  actividades: [],
  planes: { prueba: true, suelta: 9000, packClases: 8, packPrecio: 56000, membresia2: 48000, membresia3: 62000, libre: 78000 },
}

/** Al elegir rubro, las actividades y los precios típicos de ese rubro quedan precargados. */
export function altaConRubro(a: AltaGym, rubro: string): AltaGym {
  const r = rubroPorKey(rubro)
  const suelta = r.planes.find(p => p.tipo === 'suelta')?.precio ?? 9000
  const pack = r.planes.find(p => p.tipo === 'pack')
  const m2 = r.planes.find(p => p.tipo === 'membresia' && p.porSemana === 2)?.precio ?? Math.round(suelta * 5.3 / 1000) * 1000
  const m3 = r.planes.find(p => p.tipo === 'membresia' && p.porSemana === 3)?.precio ?? Math.round(suelta * 6.9 / 1000) * 1000
  const libre = r.planes.find(p => p.tipo === 'membresia' && p.porSemana === 0)?.precio ?? Math.round(suelta * 8.7 / 1000) * 1000
  return {
    rubro,
    actividades: r.actividades.map((x, i) => ({ id: `a${i + 1}`, ...x })),
    planes: { prueba: a.planes.prueba, suelta, packClases: pack?.clases ?? 8, packPrecio: pack?.precio ?? suelta * 7, membresia2: m2, membresia3: m3, libre },
  }
}

export type Errores = Record<string, string>

export function validarGym(paso: 'rubro-gym' | 'actividades' | 'planes', a: AltaGym): Errores {
  const e: Errores = {}
  if (paso === 'rubro-gym' && !a.rubro) e.rubro = 'Elegí tu rubro para seguir.'
  if (paso === 'actividades') {
    if (a.actividades.length === 0) e.actividades = 'Cargá al menos una actividad.'
    a.actividades.forEach(x => { if (!x.nombre.trim()) e[`actividad-${x.id}`] = 'Ponele un nombre.' })
  }
  if (paso === 'planes') {
    // Alcanza con cualquier plan pago, el pack incluido (la prueba sola no sostiene un gimnasio).
    if (a.planes.suelta < 1 && a.planes.packPrecio < 1 && a.planes.libre < 1 && a.planes.membresia2 < 1 && a.planes.membresia3 < 1) e.planes = 'Cargá al menos un precio.'
  }
  return e
}

/** El negocio que queda armado al terminar el alta: el de ejemplo del rubro, con lo que cargó el dueño encima. */
export function negocioDesdeAlta(a: AltaGym, base: { nombre: string; descripcion: string; telefono: string; direccion: string; ciudad: string; latLng: [number, number]; slug: string; logo: string | null }): NegocioGym {
  const r = rubroPorKey(a.rubro ?? 'gym')
  const ejemplo = negocioDe(r)
  const colores = ['#2563EB', '#7C3AED', '#059669', '#D97706', '#DB2777', '#0891B2']
  const actividades = a.actividades.map((x, i) => ({ id: x.id, nombre: x.nombre.trim() || `Actividad ${i + 1}`, duracion: x.duracion, cupo: x.cupo, color: colores[i % colores.length] }))
  const p = a.planes
  const planes: Plan[] = [
    ...(p.prueba ? [{ id: 'pl1', tipo: 'prueba' as const, nombre: 'Clase de prueba', precio: 0, vigenciaDias: 30, activo: true }] : []),
    ...(p.suelta > 0 ? [{ id: 'pl2', tipo: 'suelta' as const, nombre: 'Clase suelta', precio: p.suelta, vigenciaDias: 1, activo: true }] : []),
    ...(p.packPrecio > 0 ? [{ id: 'pl3', tipo: 'pack' as const, nombre: `Pack de ${p.packClases} clases`, precio: p.packPrecio, clases: p.packClases, vigenciaDias: 90, activo: true }] : []),
    ...(p.membresia2 > 0 ? [{ id: 'pl4', tipo: 'membresia' as const, nombre: '2 veces por semana', precio: p.membresia2, porSemana: 2, vigenciaDias: 30, activo: true }] : []),
    ...(p.membresia3 > 0 ? [{ id: 'pl5', tipo: 'membresia' as const, nombre: '3 veces por semana', precio: p.membresia3, porSemana: 3, vigenciaDias: 30, activo: true }] : []),
    ...(p.libre > 0 ? [{ id: 'pl6', tipo: 'membresia' as const, nombre: 'Pase libre', precio: p.libre, porSemana: 0, vigenciaDias: 30, activo: true }] : []),
  ]
  // La grilla de ejemplo se rearma con las actividades nuevas, en el mismo orden.
  const clases = ejemplo.clases.map(c => ({ ...c, actividadId: actividades[Number(c.actividadId.slice(1)) - 1]?.id ?? actividades[0]?.id ?? c.actividadId, cupo: actividades[Number(c.actividadId.slice(1)) - 1]?.cupo ?? c.cupo })).filter(c => actividades.some(x => x.id === c.actividadId))
  return { ...ejemplo, ...base, nombre: base.nombre.trim() || ejemplo.nombre, descripcion: base.descripcion.trim() || ejemplo.descripcion, actividades, planes, clases, bloqueos: [], calendariosExternos: [] }
}

// ─── Paso: rubro ─────────────────────────────────────────────────────────────

export function PasoRubroGym({ valor, onElegir, error }: { valor: string | null; onElegir: (key: string) => void; error?: string }) {
  return (
    <div className="rv" style={{ maxWidth: 820, margin: '0 auto' }}>
      <EstiloReservas />
      <div className="rv-grid rv-grid--4" role="radiogroup" aria-label="Rubro">
        {RUBROS_GYM.map((r, i) => {
          const sel = valor === r.key
          return (
            <button key={r.key} type="button" role="radio" aria-checked={sel} className={`rv-card rv-card--pad rv-card--accion rv-entra${sel ? ' rv-card--sel' : ''}`} style={{ ['--i' as string]: i, display: 'flex', flexDirection: 'column', gap: 8, minHeight: 132, position: 'relative' } as React.CSSProperties} onClick={() => onElegir(r.key)}>
              <span style={{ width: 36, height: 36, borderRadius: 10, display: 'grid', placeItems: 'center', background: sel ? 'var(--color-primary)' : 'var(--color-primary-bg)', color: sel ? 'var(--color-on-primary)' : 'var(--color-primary)' }}><r.Icon size={18} strokeWidth={1.8} aria-hidden /></span>
              <span className="rv-h3" style={{ fontSize: 15 }}>{r.label}</span>
              <span style={{ fontSize: 12.5, color: 'var(--color-muted)', lineHeight: 1.45 }}>{r.descripcion}</span>
              {sel && <span aria-hidden style={{ position: 'absolute', top: 10, right: 10, width: 22, height: 22, borderRadius: '50%', display: 'grid', placeItems: 'center', background: 'var(--color-primary)', color: 'var(--color-on-primary)' }}><Check size={13} strokeWidth={3} /></span>}
            </button>
          )
        })}
      </div>
      {error && <p className="rv-error" role="alert" style={{ marginTop: 10, textAlign: 'center' }}>{error}</p>}
    </div>
  )
}

// ─── Paso: actividades ───────────────────────────────────────────────────────

// Una fila por actividad: nombre, duración, cupo y quitar. En celular no entran
// las cuatro en una línea: el nombre va solo arriba y el resto abajo.
const CSS_ACTIVIDADES = `
  .gia-fila { display: grid; grid-template-columns: minmax(0, 1.4fr) 120px 100px auto; gap: 8px; align-items: end; }
  @media (max-width: 640px) {
    .gia-fila { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) auto; }
    .gia-fila > :first-child { grid-column: 1 / -1; }
  }
`

export function PasoActividades({ a, onChange, errores, intentado }: { a: AltaGym; onChange: (cambio: Partial<AltaGym>) => void; errores: Errores; intentado: boolean }) {
  const err = (k: string) => (intentado ? errores[k] : undefined)
  const editar = (id: string, c: Partial<AltaGym['actividades'][number]>) => onChange({ actividades: a.actividades.map(x => (x.id === id ? { ...x, ...c } : x)) })
  return (
    <div className="rv rv-pila" style={{ maxWidth: 640, margin: '0 auto' }}>
      <EstiloReservas />
      <style>{CSS_ACTIVIDADES}</style>
      {a.actividades.map(x => (
        <div key={x.id} className="rv-card rv-card--pad rv-entra">
          <div className="gia-fila">
            <Campo label="Actividad" value={x.nombre} onChange={v => editar(x.id, { nombre: v })} error={err(`actividad-${x.id}`)} maxLength={40} />
            <Selector label="Dura" valor={x.duracion} onChange={v => editar(x.id, { duracion: v })} opciones={[30, 45, 50, 60, 75, 90, 120, 150].map(m => ({ id: m, label: `${m} min` }))} />
            <Campo label="Cupo" value={String(x.cupo)} onChange={v => editar(x.id, { cupo: Math.max(1, Number(v.replace(/\D/g, '')) || 1) })} inputMode="numeric" />
            <button type="button" className="rv-btn rv-btn--icono" onClick={() => onChange({ actividades: a.actividades.filter(y => y.id !== x.id) })} aria-label={`Quitar ${x.nombre || 'esta actividad'}`} disabled={a.actividades.length <= 1}><Trash2 size={16} /></button>
          </div>
        </div>
      ))}
      <button type="button" className="rv-btn" style={{ alignSelf: 'flex-start' }} onClick={() => onChange({ actividades: [...a.actividades, { id: `a${Date.now().toString(36)}`, nombre: '', duracion: 60, cupo: 12 }] })}><Plus size={15} aria-hidden /> Otra actividad</button>
      {err('actividades') && <p className="rv-error" role="alert">{errores.actividades}</p>}
      <p className="rv-ayuda">La grilla semanal (qué día y a qué hora) se arma después, en el panel.</p>
    </div>
  )
}

// ─── Paso: planes ────────────────────────────────────────────────────────────

export function PasoPlanes({ a, onChange, errores, intentado }: { a: AltaGym; onChange: (cambio: Partial<AltaGym>) => void; errores: Errores; intentado: boolean }) {
  const p = a.planes
  const set = (c: Partial<AltaGym['planes']>) => onChange({ planes: { ...p, ...c } })
  const num = (s: string) => Math.max(0, Math.round(Number(s.replace(/\D/g, '')) || 0))
  return (
    <div className="rv rv-pila" style={{ maxWidth: 640, margin: '0 auto' }}>
      <EstiloReservas />
      <div className="rv-card rv-card--pad rv-entra">
        <FilaSwitch titulo="Clase de prueba gratis" ayuda="Una vez por persona. Es lo que más socios trae." on={p.prueba} onChange={v => set({ prueba: v })} />
        <div className="rv-dos" style={{ marginTop: 12 }}>
          <Campo label="Clase suelta" prefijo="$" value={String(p.suelta)} onChange={v => set({ suelta: num(v) })} inputMode="numeric" ayuda="0 = no se vende suelta." />
          <div className="rv-dos" style={{ gap: 8 }}>
            <Campo label="Pack de" value={String(p.packClases)} onChange={v => set({ packClases: Math.max(1, num(v)) })} inputMode="numeric" ayuda="clases" />
            <Campo label="Precio del pack" prefijo="$" value={String(p.packPrecio)} onChange={v => set({ packPrecio: num(v) })} inputMode="numeric" />
          </div>
        </div>
      </div>
      <div className="rv-card rv-card--pad rv-entra">
        <span className="rv-rotulo">Membresías por mes</span>
        <div className="rv-grid rv-grid--3" style={{ marginTop: 10 }}>
          <Campo label="2 veces por semana" prefijo="$" value={String(p.membresia2)} onChange={v => set({ membresia2: num(v) })} inputMode="numeric" />
          <Campo label="3 veces por semana" prefijo="$" value={String(p.membresia3)} onChange={v => set({ membresia3: num(v) })} inputMode="numeric" />
          <Campo label="Pase libre" prefijo="$" value={String(p.libre)} onChange={v => set({ libre: num(v) })} inputMode="numeric" />
        </div>
        <p className="rv-ayuda" style={{ margin: '10px 0 0' }}>Con 0 el plan no se ofrece. {p.membresia3 ? `La de 3 por semana queda destacada en tu sitio a ${pesos(p.membresia3)}.` : ''}</p>
      </div>
      {intentado && errores.planes && <p className="rv-error" role="alert">{errores.planes}</p>}
    </div>
  )
}
