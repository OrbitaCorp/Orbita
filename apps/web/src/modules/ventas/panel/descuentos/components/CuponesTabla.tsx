import { useState } from 'react'
import { ChevronUp, ChevronDown, ChevronsUpDown, Pencil, Copy, BarChart2, Trash2, Clipboard, Ticket, Link2 } from 'lucide-react'
import { ToggleConfirmacion, MenuContextual } from '../../../_shared/components'
import type { ItemMenuContextual } from '../../../_shared/components'
import { BadgeEstado } from './BadgeEstado'
import { BadgeTipo } from './BadgeTipo'
import { LinkCompartibleModal } from './LinkCompartibleModal'
import { CuponCardMobile } from './CuponCardMobile'
import { useToggleCupon } from '../hooks/useToggleCupon'
import { useEliminarCupon } from '../hooks/useEliminarCupon'
import { useDuplicarCupon } from '../hooks/useDuplicarCupon'
import { tipoCuponLabelKey, TIPO_CUPON_LABELS } from '../types'
import type { Cupon, OrdenDireccion } from '../types'
import { fmtRangoVigencia } from '../utils'

const MONO: React.CSSProperties = { fontFamily: '"Geist Mono", "Fira Code", monospace' }
const COLS = '1fr 1.4fr 0.9fr 0.65fr 1.1fr 0.75fr 0.65fr 1.1fr'
const HEADS = ['Código', 'Nombre', 'Tipo', 'Valor', 'Vigencia', 'Estado', 'Usos', 'Acciones']
const HEADS_ORD: Record<string, string> = { Código: 'codigo', Nombre: 'nombre', Valor: 'valor', Vigencia: 'vigencia', Estado: 'estado', Usos: 'usos' }

const fmtValor = (c: Cupon) =>
  c.tipoDescuento === 'porcentaje'
    ? `${c.valor}%`
    : `$ ${c.valor.toLocaleString('es-AR')}`

interface Props {
  datos: Cupon[]
  isLoading: boolean
  ordenColumna: string
  ordenDireccion: OrdenDireccion
  onOrdenar: (col: string) => void
  onEditar: (id: string) => void
  onVerMetricas: () => void
}

function Th({ label, ordenColumna, ordenDireccion, onOrdenar }: {
  label: string; ordenColumna: string; ordenDireccion: OrdenDireccion; onOrdenar: (c: string) => void
}) {
  const colKey = HEADS_ORD[label]
  const [hover, setHover] = useState(false)
  const activo = colKey && ordenColumna === colKey
  const alinearDer = ['Valor', 'Estado', 'Usos', 'Acciones'].includes(label)
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

function FilaCupon({ cupon, onEditar, onVerMetricas }: {
  cupon: Cupon; onEditar: (id: string) => void; onVerMetricas: () => void
}) {
  const [hover, setHover] = useState(false)
  const [copiado, setCopiado] = useState(false)
  const [showLinkModal, setShowLinkModal] = useState(false)
  const toggle = useToggleCupon()
  const eliminar = useEliminarCupon()
  const duplicar = useDuplicarCupon()

  function copiarCodigo() {
    navigator.clipboard.writeText(cupon.codigo).catch(() => {})
    setCopiado(true)
    setTimeout(() => setCopiado(false), 1500)
  }

  const tipoLabel = TIPO_CUPON_LABELS[tipoCuponLabelKey(cupon.tipoDescuento, cupon.alcance)]

  const items: ItemMenuContextual[] = [
    { label: 'Duplicar', Icono: Copy, onClick: () => duplicar.mutate(cupon.id) },
    { label: 'Link compartible', Icono: Link2, onClick: () => setShowLinkModal(true) },
    { label: 'Ver métricas', Icono: BarChart2, onClick: onVerMetricas },
    { label: 'Eliminar', Icono: Trash2, destructivo: true, separadorAntes: true, onClick: () => eliminar.mutate(cupon.id) },
    { label: copiado ? 'Copiado' : 'Copiar código', Icono: Clipboard, onClick: copiarCodigo },
  ]

  return (
    <>
    {showLinkModal && <LinkCompartibleModal cupon={cupon} onClose={() => setShowLinkModal(false)} />}
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onClick={() => onEditar(cupon.id)}
      style={{
        display: 'grid', gridTemplateColumns: COLS, gap: 8, padding: '10px 16px',
        alignItems: 'center', cursor: 'pointer',
        borderBottom: '1px solid var(--color-border)',
        background: hover ? 'var(--color-surface-alt)' : 'transparent',
        transition: 'background 100ms ease',
      }}
    >
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 13, fontWeight: 600, color: 'var(--color-text)', letterSpacing: '0.01em', ...MONO }}>
        {cupon.codigo}
        {cupon.link_activo && <Link2 size={11} color="var(--color-primary)" style={{ flexShrink: 0 }} />}
      </span>
      <span style={{ fontSize: 13, color: 'var(--color-body)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {cupon.nombre}
      </span>
      <span><BadgeTipo label={tipoLabel} /></span>
      <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text)', textAlign: 'right', ...MONO }}>
        {fmtValor(cupon)}
      </span>
      <span style={{ fontSize: 12, color: 'var(--color-muted)', ...MONO }}>
        {fmtRangoVigencia(cupon.fechaInicio, cupon.fechaExpiracion)}
      </span>
      <span style={{ textAlign: 'right' }}><BadgeEstado estado={cupon.estado} /></span>
      <div style={{ textAlign: 'right' }}>
        <div style={{ fontSize: 13, color: 'var(--color-body)', ...MONO }}>
          {cupon.usosConsumidos} / {cupon.usosMaxTotal ?? '∞'}
        </div>
        {cupon.usosMaxPorCliente && (
          <div style={{ fontSize: 11, color: 'var(--color-muted)', marginTop: 2 }}>
            {cupon.usosMaxPorCliente === 1 ? '1 por cliente' : `${cupon.usosMaxPorCliente} por cliente`}
          </div>
        )}
      </div>
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'flex-end' }}
      >
        <ToggleConfirmacion
          activo={cupon.activo}
          onToggle={(v) => toggle.mutate({ id: cupon.id, activo: v })}
          textoConfirmacion="Los clientes no podrán canjearlo."
        />
        <button
          onClick={() => onEditar(cupon.id)}
          style={{ width: 30, height: 30, borderRadius: 6, border: '1px solid var(--color-border)', background: 'var(--color-bg)', color: 'var(--color-body)', cursor: 'pointer', display: 'grid', placeItems: 'center' }}
          title="Editar"
        >
          <Pencil size={14} />
        </button>
        <MenuContextual items={items} />
      </div>
    </div>
    </>
  )
}

export function CuponesTabla({ datos, isLoading, ordenColumna, ordenDireccion, onOrdenar, onEditar, onVerMetricas }: Props) {
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
        <Ticket size={26} />
      </div>
      <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--color-text)', marginBottom: 6 }}>No hay cupones</div>
      <div style={{ fontSize: 14, color: 'var(--color-muted)' }}>Intentá cambiar los filtros o creá tu primer cupón.</div>
    </div>
  )

  return (
    <>
      <style>{`
        .cup-table-wrap { display: block; }
        .cup-cards-wrap { display: none; }
        @media (max-width: 768px) {
          .cup-table-wrap { display: none !important; }
          .cup-cards-wrap { display: flex !important; flex-direction: column; gap: 8px; padding: 8px; }
        }
      `}</style>

      <div className="cup-table-wrap">
        <div style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 10, overflow: 'hidden' }}>
          <div style={{ display: 'grid', gridTemplateColumns: COLS, gap: 8, padding: '0 16px', height: 42, alignItems: 'center', background: 'var(--color-surface-alt)', borderBottom: '1px solid var(--color-border)' }}>
            {HEADS.map((h) => <Th key={h} label={h} ordenColumna={ordenColumna} ordenDireccion={ordenDireccion} onOrdenar={onOrdenar} />)}
          </div>
          {datos.length === 0 ? emptyState : datos.map((c) => (
            <FilaCupon key={c.id} cupon={c} onEditar={onEditar} onVerMetricas={onVerMetricas} />
          ))}
        </div>
      </div>

      <div className="cup-cards-wrap">
        {datos.length === 0 ? emptyState : datos.map((c) => (
          <CuponCardMobile key={c.id} cupon={c} onEditar={onEditar} onVerMetricas={onVerMetricas} />
        ))}
      </div>
    </>
  )
}
