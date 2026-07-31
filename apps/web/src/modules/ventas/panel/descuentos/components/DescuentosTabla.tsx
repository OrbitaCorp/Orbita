import { useState } from 'react'
import { ChevronUp, ChevronDown, ChevronsUpDown, Pencil, Copy, BarChart2, Trash2, Tag } from 'lucide-react'
import { ToggleConfirmacion, MenuContextual } from '../../../_shared/components'
import type { ItemMenuContextual } from '../../../_shared/components'
import { BadgeEstado } from './BadgeEstado'
import { BadgeTipo } from './BadgeTipo'
import { useToggleDescuento } from '../hooks/useToggleDescuento'
import { useEliminarDescuento } from '../hooks/useEliminarDescuento'
import { useDuplicarDescuento } from '../hooks/useDuplicarDescuento'
import type { Descuento, OrdenDireccion } from '../types'

const MONO: React.CSSProperties = { fontFamily: '"Geist Mono", "Fira Code", monospace' }
const COLS = '2fr 1.1fr 1.3fr 1.3fr 0.9fr 0.75fr 1.1fr'
const HEADS = ['Nombre', 'Tipo', 'Alcance', 'Vigencia', 'Estado', 'Usos', 'Acciones']
const HEADS_ORD: Record<string, string> = { Nombre: 'nombre', Vigencia: 'vigencia', Estado: 'estado', Usos: 'usos' }

const ESTADO_ACCENT: Record<string, string> = {
  activo: 'var(--color-success)',
  inactivo: 'var(--color-muted)',
  programado: 'var(--color-primary)',
  expirado: 'var(--color-error)',
  agotado: 'var(--color-warning)',
}

// El backend manda ISO con hora ("2025-06-01T00:00:00.000Z"): se corta en la
// "T" antes de partir por "-" (sin eso, el día quedaba "01T00:00:00.000Z"). No
// se usa `new Date` a propósito — correría la fecha por zona horaria.
const soloFecha = (iso: string) => iso.split('T')[0].split('-') // [yyyy, mm, dd]

const fmtFecha = (iso: string | null) => {
  if (!iso) return '∞'
  const [y, m, d] = soloFecha(iso)
  return `${d}/${m}/${y}`
}

// Rango compacto: "01/06 – 30/06/2025" (omite el año del inicio si coincide con el fin).
const fmtRangoCompacto = (inicio: string, fin: string | null) => {
  const [yi, mi, di] = soloFecha(inicio)
  if (!fin) return `${di}/${mi}/${yi} – ∞`
  const [yf, mf, df] = soloFecha(fin)
  return yi === yf ? `${di}/${mi} – ${df}/${mf}/${yf}` : `${di}/${mi}/${yi} – ${df}/${mf}/${yf}`
}

// Mini barra de progreso de usos (mismo patrón que reportes/TopProductos).
function BarraUsos({ consumidos, total }: { consumidos: number; total: number }) {
  const pct = total > 0 ? Math.min(100, Math.round((consumidos / total) * 100)) : 0
  return (
    <div style={{ height: 4, background: 'var(--color-surface-alt)', borderRadius: 2, overflow: 'hidden', marginTop: 5 }}>
      <div style={{ height: '100%', width: `${pct}%`, background: 'var(--color-primary)', borderRadius: 2, transition: 'width 300ms ease' }} />
    </div>
  )
}

interface Props {
  datos: Descuento[]
  isLoading: boolean
  ordenColumna: string
  ordenDireccion: OrdenDireccion
  onOrdenar: (col: string) => void
  onVerDetalle: (id: string) => void
  onEditar: (id: string) => void
  onVerMetricas: () => void
}

function Th({ label, ordenColumna, ordenDireccion, onOrdenar }: {
  label: string; ordenColumna: string; ordenDireccion: OrdenDireccion; onOrdenar: (c: string) => void
}) {
  const colKey = HEADS_ORD[label]
  const [hover, setHover] = useState(false)
  const activo = colKey && ordenColumna === colKey
  // Estas columnas tienen los datos alineados a la derecha en la fila, así que
  // el header tiene que acompañar (antes quedaba a la izquierda, desalineado).
  const alinearDer = ['Usos', 'Acciones'].includes(label)
  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onClick={() => colKey && onOrdenar(colKey)}
      style={{
        display: 'flex', alignItems: 'center', gap: 4,
        justifyContent: alinearDer ? 'flex-end' : 'flex-start',
        fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em',
        color: activo ? 'var(--color-text)' : 'var(--color-muted)',
        cursor: colKey ? 'pointer' : 'default', userSelect: 'none',
      }}
    >
      {label}
      {colKey && (
        activo
          ? ordenDireccion === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />
          : <ChevronsUpDown size={12} style={{ opacity: hover ? 0.6 : 0.3 }} />
      )}
    </div>
  )
}

function FilaDescuentoCard({ descuento, onVerDetalle, onEditar, onVerMetricas }: {
  descuento: Descuento; onVerDetalle: (id: string) => void
  onEditar: (id: string) => void; onVerMetricas: () => void
}) {
  const [hover, setHover] = useState(false)
  const toggle = useToggleDescuento()
  const eliminar = useEliminarDescuento()
  const duplicar = useDuplicarDescuento()
  const items: ItemMenuContextual[] = [
    { label: 'Editar', Icono: Pencil, onClick: () => onEditar(descuento.id) },
    { label: 'Duplicar', Icono: Copy, onClick: () => duplicar.mutate(descuento.id) },
    { label: 'Ver métricas', Icono: BarChart2, onClick: onVerMetricas },
    { label: 'Eliminar', Icono: Trash2, destructivo: true, separadorAntes: true, onClick: () => eliminar.mutate(descuento.id) },
  ]
  const tieneLimite = descuento.limiteUsosTotal != null
  return (
    <div
      onClick={() => onVerDetalle(descuento.id)}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        background: hover ? 'var(--color-surface-alt)' : 'var(--color-bg)',
        border: '1px solid var(--color-border)',
        borderLeft: `3px solid ${ESTADO_ACCENT[descuento.estado] ?? 'var(--color-muted)'}`,
        borderRadius: 10, padding: 16,
        cursor: 'pointer', transition: 'background 150ms',
        display: 'flex', flexDirection: 'column', gap: 12,
      }}
    >
      {/* Nivel 1 — nombre + estado */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
        <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--color-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>
          {descuento.nombre}
        </span>
        <span style={{ flexShrink: 0 }}><BadgeEstado estado={descuento.estado} /></span>
      </div>

      {/* Nivel 2 — tipo + usos */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div><BadgeTipo tipo={descuento.tipo} aplicacion={descuento.aplicacion} /></div>
        <div>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text)', ...MONO }}>
            {descuento.usosConsumidos} / {descuento.limiteUsosTotal ?? '∞'} usos
          </span>
          {tieneLimite && <BarraUsos consumidos={descuento.usosConsumidos} total={descuento.limiteUsosTotal as number} />}
        </div>
      </div>

      {/* Nivel 3 — alcance + vigencia */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        <span style={{ fontSize: 12, color: 'var(--color-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {descuento.alcanceResumen}
        </span>
        <span style={{ fontSize: 12, color: 'var(--color-muted)', ...MONO }}>
          {fmtRangoCompacto(descuento.fechaInicio, descuento.fechaFin)}
        </span>
      </div>

      {/* Acciones */}
      <div onClick={e => e.stopPropagation()} style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8 }}>
        <ToggleConfirmacion activo={descuento.activo} onToggle={v => toggle.mutate({ id: descuento.id, activo: v })} />
        <MenuContextual items={items} />
      </div>
    </div>
  )
}

function FilaDescuento({ descuento, onVerDetalle, onEditar, onVerMetricas }: {
  descuento: Descuento; onVerDetalle: (id: string) => void
  onEditar: (id: string) => void; onVerMetricas: () => void
}) {
  const [hover, setHover] = useState(false)
  const toggle = useToggleDescuento()
  const eliminar = useEliminarDescuento()
  const duplicar = useDuplicarDescuento()

  const items: ItemMenuContextual[] = [
    { label: 'Duplicar', Icono: Copy, onClick: () => duplicar.mutate(descuento.id) },
    { label: 'Ver métricas', Icono: BarChart2, onClick: onVerMetricas },
    { label: 'Eliminar', Icono: Trash2, destructivo: true, separadorAntes: true, onClick: () => eliminar.mutate(descuento.id) },
  ]

  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onClick={() => onVerDetalle(descuento.id)}
      style={{
        display: 'grid', gridTemplateColumns: COLS, gap: 8, padding: '10px 16px',
        alignItems: 'center', cursor: 'pointer', position: 'relative',
        borderBottom: '1px solid var(--color-border)',
        background: hover ? 'var(--color-surface-alt)' : 'transparent',
        transition: 'background 100ms ease',
      }}
    >
      <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {descuento.nombre}
      </span>
      <span><BadgeTipo tipo={descuento.tipo} aplicacion={descuento.aplicacion} /></span>
      <span style={{ fontSize: 13, color: 'var(--color-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={descuento.alcanceResumen}>
        {descuento.alcanceResumen}
      </span>
      <span style={{ fontSize: 12, color: 'var(--color-muted)', display: 'flex', alignItems: 'center', gap: 6, ...MONO }}>
        {fmtFecha(descuento.fechaInicio)} – {fmtFecha(descuento.fechaFin)}
        {descuento.recurrente && (
          <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--color-primary)', fontFamily: 'inherit' }}>
            Recurrente
          </span>
        )}
      </span>
      <span><BadgeEstado estado={descuento.estado} /></span>
      <span style={{ fontSize: 13, color: 'var(--color-body)', textAlign: 'right', ...MONO }}>
        {descuento.usosConsumidos} / {descuento.limiteUsosTotal ?? '∞'}
      </span>
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'flex-end' }}
      >
        <ToggleConfirmacion
          activo={descuento.activo}
          onToggle={(v) => toggle.mutate({ id: descuento.id, activo: v })}
        />
        <button
          onClick={() => onEditar(descuento.id)}
          style={{ width: 30, height: 30, borderRadius: 6, border: '1px solid var(--color-border)', background: 'var(--color-bg)', color: 'var(--color-body)', cursor: 'pointer', display: 'grid', placeItems: 'center' }}
          title="Editar"
        >
          <Pencil size={14} />
        </button>
        <MenuContextual items={items} />
      </div>
    </div>
  )
}

export function DescuentosTabla({ datos, isLoading, ordenColumna, ordenDireccion, onOrdenar, onVerDetalle, onEditar, onVerMetricas }: Props) {
  if (isLoading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 8 }}>
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} style={{ height: 52, borderRadius: 8, background: 'var(--color-surface-alt)' }} />
        ))}
      </div>
    )
  }

  const emptyState = (
    <div style={{ padding: '56px 16px', textAlign: 'center' }}>
      <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'var(--color-surface-alt)', color: 'var(--color-muted)', display: 'grid', placeItems: 'center', margin: '0 auto 14px' }}>
        <Tag size={26} />
      </div>
      <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--color-text)', marginBottom: 6 }}>No hay descuentos</div>
      <div style={{ fontSize: 14, color: 'var(--color-muted)' }}>Intentá cambiar los filtros o creá tu primer descuento.</div>
    </div>
  )

  return (
    <>
      <style>{`
        .desc-table-wrap { display: block; }
        .desc-cards-wrap { display: none; }
        @media (max-width: 768px) {
          .desc-table-wrap { display: none !important; }
          .desc-cards-wrap { display: flex !important; flex-direction: column; gap: 8px; padding: 8px; }
        }
      `}</style>

      <div className="desc-table-wrap">
        <div style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 10, overflow: 'hidden' }}>
          <div style={{ display: 'grid', gridTemplateColumns: COLS, gap: 8, padding: '0 16px', height: 42, alignItems: 'center', background: 'var(--color-surface-alt)', borderBottom: '1px solid var(--color-border)' }}>
            {HEADS.map((h) => <Th key={h} label={h} ordenColumna={ordenColumna} ordenDireccion={ordenDireccion} onOrdenar={onOrdenar} />)}
          </div>
          {datos.length === 0 ? emptyState : datos.map((d) => (
            <FilaDescuento key={d.id} descuento={d} onVerDetalle={onVerDetalle} onEditar={onEditar} onVerMetricas={onVerMetricas} />
          ))}
        </div>
      </div>

      <div className="desc-cards-wrap">
        {datos.length === 0 ? emptyState : datos.map((d) => (
          <FilaDescuentoCard key={d.id} descuento={d} onVerDetalle={onVerDetalle} onEditar={onEditar} onVerMetricas={onVerMetricas} />
        ))}
      </div>
    </>
  )
}
