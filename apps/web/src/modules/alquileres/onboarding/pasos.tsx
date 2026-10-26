// Lo que el alta única le pide a quien elige Alquileres: qué alquila (por
// hora, por bloque o por noches) y lo mínimo para arrancar en ese modo (las
// canchas, el salón con sus paquetes, o la primera propiedad). El resto del
// alta (negocio, ubicación, página, cuenta, pago) es el mismo para todos los
// módulos y vive en modules/onboarding/alta.
//
// Pinta con el kit rv- del design system y con los tokens del lugar donde se
// monta: adentro del alta oscura sale oscuro, sin hacer nada.
import { useId } from 'react'
import { Check, Plus, Trash2 } from 'lucide-react'
import { pesos } from '@/lib/reservas/precio'
import { EstiloReservas } from '@/design-system/reservas/estilo'
import { Campo, Selector } from '@/design-system/reservas/piezas'
import { NEGOCIOS_DEMO, TIPOS, TIPOS_ORDEN, type NegocioAlquiler, type Propiedad, type TipoAlquiler } from '../datos'

export interface AltaAlquiler {
  tipo: TipoAlquiler | null
  unidades: { id: string; nombre: string; detalle: string; tarifaHora: number }[]
  salon: { capacidad: number; duracionBloque: number; limpieza: number; deposito: number; paquetes: { id: string; nombre: string; hastaInvitados: number; precio: number }[] }
  propiedad: { nombre: string; tipo: Propiedad['tipo']; huespedes: number; ambientes: number; precioNoche: number; minNoches: number; limpieza: number }
}

export const ALTA_ALQUILER_INICIAL: AltaAlquiler = {
  tipo: null,
  unidades: [{ id: 'u1', nombre: 'Cancha 1', detalle: 'Fútbol 5', tarifaHora: 45000 }, { id: 'u2', nombre: 'Cancha 2', detalle: 'Pádel', tarifaHora: 36000 }],
  salon: { capacidad: 60, duracionBloque: 240, limpieza: 90, deposito: 50000, paquetes: [{ id: 'p30', nombre: 'Hasta 30 invitados', hastaInvitados: 30, precio: 280000 }, { id: 'p60', nombre: 'Hasta 60 invitados', hastaInvitados: 60, precio: 420000 }] },
  propiedad: { nombre: 'Cabaña 1', tipo: 'Cabaña', huespedes: 4, ambientes: 2, precioNoche: 68000, minNoches: 2, limpieza: 25000 },
}

export type Errores = Record<string, string>

/** Qué le falta a este paso del alta para poder seguir. Vacío = se puede. */
export function validarAlquiler(paso: 'tipo-alquiler' | 'que-alquilas', a: AltaAlquiler): Errores {
  const e: Errores = {}
  if (paso === 'tipo-alquiler' && !a.tipo) e.tipo = 'Elegí qué alquilás para seguir.'
  if (paso === 'que-alquilas') {
    if (a.tipo === 'cancha') {
      if (a.unidades.length === 0) e.unidades = 'Cargá al menos una cancha o espacio.'
      a.unidades.forEach(u => { if (!u.nombre.trim()) e[`unidad-${u.id}`] = 'Ponele un nombre.' })
    }
    if (a.tipo === 'bloque') {
      if (a.salon.paquetes.length === 0) e.paquetes = 'Armá al menos un paquete.'
      if (a.salon.capacidad < 1) e.capacidad = 'Decinos cuánta gente entra.'
    }
    if (a.tipo === 'estadia') {
      if (a.propiedad.nombre.trim().length < 2) e.propiedad = 'Ponele un nombre a la propiedad.'
      if (a.propiedad.precioNoche < 1) e.precioNoche = 'Cargá el precio por noche.'
    }
  }
  return e
}

/** El negocio que queda armado al terminar el alta: el de ejemplo del modo, con lo que cargó el dueño encima. */
export function negocioDesdeAlta(a: AltaAlquiler, base: { nombre: string; descripcion: string; telefono: string; direccion: string; ciudad: string; latLng: [number, number]; slug: string; logo: string | null }): NegocioAlquiler {
  const tipo = a.tipo ?? 'cancha'
  const ejemplo = NEGOCIOS_DEMO[tipo]
  const comun = { ...ejemplo, ...base, nombre: base.nombre.trim() || ejemplo.nombre, descripcion: base.descripcion.trim() || ejemplo.descripcion, bloqueos: [], calendariosExternos: [] }
  if (tipo === 'cancha') return { ...comun, unidades: a.unidades.map((u, i) => ({ ...u, nombre: u.nombre.trim(), foto: ejemplo.unidades[i % ejemplo.unidades.length].foto })) }
  if (tipo === 'bloque') return { ...comun, salon: { ...ejemplo.salon!, ...a.salon, paquetes: a.salon.paquetes.map(p => ({ ...p, incluye: ['Mesas, sillas y vajilla'] })) } }
  const p0 = ejemplo.propiedades[0]
  return {
    ...comun,
    propiedades: [{ ...p0, id: 'c1', nombre: a.propiedad.nombre.trim(), tipo: a.propiedad.tipo, huespedes: a.propiedad.huespedes, ambientes: a.propiedad.ambientes, descripcion: '', direccion: base.direccion || p0.direccion, ciudad: base.ciudad || p0.ciudad, latLng: base.latLng,
      tarifa: { ...p0.tarifa, precioNoche: a.propiedad.precioNoche, minNoches: a.propiedad.minNoches, limpieza: a.propiedad.limpieza, temporadas: [] } }],
  }
}

// ─── Paso: qué alquilás ──────────────────────────────────────────────────────

export function PasoTipoAlquiler({ valor, onElegir, error }: { valor: TipoAlquiler | null; onElegir: (t: TipoAlquiler) => void; error?: string }) {
  const id = useId()
  return (
    <div className="rv" style={{ maxWidth: 760, margin: '0 auto' }}>
      <EstiloReservas />
      {/* Radios de verdad, como el paso Módulo del alta (rv-card--radio): una sola parada de
          Tab, las flechas mueven y eligen, Espacio elige. Con botones role=radio cada tarjeta
          era una parada y las flechas no hacían nada. */}
      <div className="rv-grid rv-grid--3" role="radiogroup" aria-label="Qué alquilás" aria-describedby={error ? `${id}-e` : undefined}>
        {TIPOS_ORDEN.map((t, i) => {
          const info = TIPOS[t]
          const sel = valor === t
          return (
            <div key={t} className={`rv-card rv-card--pad rv-card--accion rv-card--radio rv-entra${sel ? ' rv-card--sel' : ''}`} style={{ ['--i' as string]: i, display: 'flex', flexDirection: 'column', gap: 10, minHeight: 170 } as React.CSSProperties}>
              <input type="radio" name={id} value={t} checked={sel} onChange={() => onElegir(t)} aria-labelledby={`${id}-${t}`} aria-describedby={`${id}-${t}-d`} />
              <span style={{ width: 40, height: 40, borderRadius: 11, display: 'grid', placeItems: 'center', background: sel ? 'var(--color-primary)' : 'var(--color-primary-bg)', color: sel ? 'var(--color-on-primary)' : 'var(--color-primary)' }}><info.Icon size={20} strokeWidth={1.8} aria-hidden /></span>
              <span id={`${id}-${t}`} className="rv-h3" style={{ fontSize: 16 }}>{info.label}</span>
              <span id={`${id}-${t}-d`} style={{ fontSize: 13, color: 'var(--color-muted)', lineHeight: 1.5 }}>{info.descripcion}</span>
              {sel && <span aria-hidden style={{ position: 'absolute', top: 12, right: 12, width: 22, height: 22, borderRadius: '50%', display: 'grid', placeItems: 'center', background: 'var(--color-primary)', color: 'var(--color-on-primary)' }}><Check size={13} strokeWidth={3} /></span>}
            </div>
          )
        })}
      </div>
      {error && <p id={`${id}-e`} className="rv-error" role="alert" style={{ marginTop: 10, textAlign: 'center' }}>{error}</p>}
    </div>
  )
}

// ─── Paso: lo que alquilás ───────────────────────────────────────────────────

// Filas de campos: en escritorio, en una línea; en celular, el nombre arriba y el resto debajo (con anchos fijos no entraban en 390 px).
const CSS_PASOS = `
  .alob-fila { display: grid; gap: 8px; align-items: end; }
  .alob-fila--cancha { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) 130px auto; }
  .alob-fila--paquete { grid-template-columns: minmax(0, 1fr) 110px 140px auto; }
  @media (max-width: 640px) {
    .alob-fila--cancha, .alob-fila--paquete { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); }
    .alob-fila > :first-child { grid-column: 1 / -1; }
  }
`

export function PasoQueAlquilas({ a, onChange, errores, intentado }: { a: AltaAlquiler; onChange: (cambio: Partial<AltaAlquiler>) => void; errores: Errores; intentado: boolean }) {
  const num = (s: string) => Math.max(0, Math.round(Number(s.replace(/\D/g, '')) || 0))
  const err = (k: string) => (intentado ? errores[k] : undefined)
  return (
    <div className="rv" style={{ maxWidth: 640, margin: '0 auto' }}>
      <EstiloReservas />
      <style>{CSS_PASOS}</style>
      {a.tipo === 'cancha' && (
        <div className="rv-pila">
          {a.unidades.map(u => (
            <div key={u.id} className="rv-card rv-card--pad rv-entra">
              <div className="alob-fila alob-fila--cancha">
                <Campo label="Nombre" value={u.nombre} onChange={v => onChange({ unidades: a.unidades.map(x => (x.id === u.id ? { ...x, nombre: v } : x)) })} error={err(`unidad-${u.id}`)} maxLength={40} />
                <Campo label="Qué es" value={u.detalle} onChange={v => onChange({ unidades: a.unidades.map(x => (x.id === u.id ? { ...x, detalle: v } : x)) })} placeholder="Fútbol 5, pádel, sala…" maxLength={40} />
                <Campo label="Por hora" prefijo="$" value={String(u.tarifaHora)} onChange={v => onChange({ unidades: a.unidades.map(x => (x.id === u.id ? { ...x, tarifaHora: num(v) } : x)) })} inputMode="numeric" />
                <button type="button" className="rv-btn rv-btn--icono" onClick={() => onChange({ unidades: a.unidades.filter(x => x.id !== u.id) })} aria-label={`Quitar ${u.nombre || 'esta cancha'}`} disabled={a.unidades.length <= 1}><Trash2 size={16} /></button>
              </div>
            </div>
          ))}
          <button type="button" className="rv-btn" style={{ alignSelf: 'flex-start' }} onClick={() => onChange({ unidades: [...a.unidades, { id: `u${Date.now().toString(36)}`, nombre: `Cancha ${a.unidades.length + 1}`, detalle: '', tarifaHora: 40000 }] })}><Plus size={15} aria-hidden /> Otra cancha o espacio</button>
          {err('unidades') && <p className="rv-error" role="alert">{errores.unidades}</p>}
        </div>
      )}
      {a.tipo === 'bloque' && (
        <div className="rv-pila">
          <div className="rv-card rv-card--pad rv-entra">
            <div className="rv-dos">
              <Campo label="¿Cuánta gente entra?" value={String(a.salon.capacidad)} onChange={v => onChange({ salon: { ...a.salon, capacidad: num(v) } })} inputMode="numeric" error={err('capacidad')} />
              <Selector label="Cada bloque dura" valor={a.salon.duracionBloque} onChange={v => onChange({ salon: { ...a.salon, duracionBloque: v } })} opciones={[180, 240, 300].map(m => ({ id: m, label: `${m / 60} horas` }))} />
            </div>
            <div className="rv-dos" style={{ marginTop: 10 }}>
              <Selector label="Limpieza entre bloques" valor={a.salon.limpieza} onChange={v => onChange({ salon: { ...a.salon, limpieza: v } })} opciones={[30, 60, 90, 120].map(m => ({ id: m, label: `${m} minutos` }))} />
              <Campo label="Depósito de garantía (opcional)" prefijo="$" value={String(a.salon.deposito)} onChange={v => onChange({ salon: { ...a.salon, deposito: num(v) } })} inputMode="numeric" ayuda="Se registra, no se cobra desde Órbita." />
            </div>
          </div>
          <span className="rv-rotulo">Paquetes por invitados</span>
          {a.salon.paquetes.map(p => (
            <div key={p.id} className="rv-card rv-card--pad rv-entra">
              <div className="alob-fila alob-fila--paquete">
                <Campo label="Nombre" value={p.nombre} onChange={v => onChange({ salon: { ...a.salon, paquetes: a.salon.paquetes.map(x => (x.id === p.id ? { ...x, nombre: v } : x)) } })} maxLength={40} />
                <Campo label="Hasta" value={String(p.hastaInvitados)} onChange={v => onChange({ salon: { ...a.salon, paquetes: a.salon.paquetes.map(x => (x.id === p.id ? { ...x, hastaInvitados: num(v) } : x)) } })} inputMode="numeric" />
                <Campo label="Precio" prefijo="$" value={String(p.precio)} onChange={v => onChange({ salon: { ...a.salon, paquetes: a.salon.paquetes.map(x => (x.id === p.id ? { ...x, precio: num(v) } : x)) } })} inputMode="numeric" />
                <button type="button" className="rv-btn rv-btn--icono" onClick={() => onChange({ salon: { ...a.salon, paquetes: a.salon.paquetes.filter(x => x.id !== p.id) } })} aria-label={`Quitar ${p.nombre}`} disabled={a.salon.paquetes.length <= 1}><Trash2 size={16} /></button>
              </div>
            </div>
          ))}
          <button type="button" className="rv-btn" style={{ alignSelf: 'flex-start' }} onClick={() => onChange({ salon: { ...a.salon, paquetes: [...a.salon.paquetes, { id: `p${Date.now().toString(36)}`, nombre: 'Hasta 100 invitados', hastaInvitados: 100, precio: 620000 }] } })}><Plus size={15} aria-hidden /> Otro paquete</button>
          {err('paquetes') && <p className="rv-error" role="alert">{errores.paquetes}</p>}
          <p className="rv-ayuda">Los extras (DJ, inflables, animador, torta…) se cargan después, en Configuración.</p>
        </div>
      )}
      {a.tipo === 'estadia' && (
        <div className="rv-card rv-card--pad rv-entra">
          <div className="rv-pila">
            <div className="rv-dos">
              <Campo label="Nombre de la propiedad" value={a.propiedad.nombre} onChange={v => onChange({ propiedad: { ...a.propiedad, nombre: v } })} error={err('propiedad')} maxLength={40} placeholder="Cabaña Arrayán" />
              <Selector label="Qué es" valor={a.propiedad.tipo} onChange={v => onChange({ propiedad: { ...a.propiedad, tipo: v } })} opciones={(['Casa', 'Departamento', 'Cabaña', 'Quinta'] as const).map(t => ({ id: t, label: t }))} />
            </div>
            <div className="rv-dos">
              <Selector label="Huéspedes" valor={a.propiedad.huespedes} onChange={v => onChange({ propiedad: { ...a.propiedad, huespedes: v } })} opciones={[1, 2, 3, 4, 5, 6, 8, 10, 12].map(n => ({ id: n, label: `Hasta ${n}` }))} />
              <Selector label="Ambientes" valor={a.propiedad.ambientes} onChange={v => onChange({ propiedad: { ...a.propiedad, ambientes: v } })} opciones={[1, 2, 3, 4, 5].map(n => ({ id: n, label: String(n) }))} />
            </div>
            <div className="rv-grid rv-grid--3">
              <Campo label="Precio por noche" prefijo="$" value={String(a.propiedad.precioNoche)} onChange={v => onChange({ propiedad: { ...a.propiedad, precioNoche: num(v) } })} inputMode="numeric" error={err('precioNoche')} />
              <Selector label="Mínimo de noches" valor={a.propiedad.minNoches} onChange={v => onChange({ propiedad: { ...a.propiedad, minNoches: v } })} opciones={[1, 2, 3, 5, 7].map(n => ({ id: n, label: String(n) }))} />
              <Campo label="Limpieza por estadía" prefijo="$" value={String(a.propiedad.limpieza)} onChange={v => onChange({ propiedad: { ...a.propiedad, limpieza: num(v) } })} inputMode="numeric" />
            </div>
            <p className="rv-ayuda" style={{ margin: 0 }}>Con esto ya se puede reservar desde {pesos(a.propiedad.precioNoche)} la noche. Más propiedades, fotos, temporadas y bloqueos van después, en Configuración.</p>
          </div>
        </div>
      )}
    </div>
  )
}
