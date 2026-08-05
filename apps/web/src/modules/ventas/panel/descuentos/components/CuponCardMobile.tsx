import { useState } from 'react'
import { Pencil, Copy, BarChart2, Trash2, Clipboard, Link2 } from 'lucide-react'
import { ToggleConfirmacion, MenuContextual } from '../../../_shared/components'
import type { ItemMenuContextual } from '../../../_shared/components'
import { BadgeEstado } from './BadgeEstado'
import { BadgeTipo } from './BadgeTipo'
import { LinkCompartibleModal } from './LinkCompartibleModal'
import { useToggleCupon } from '../hooks/useToggleCupon'
import { useEliminarCupon } from '../hooks/useEliminarCupon'
import { useDuplicarCupon } from '../hooks/useDuplicarCupon'
import { tipoCuponLabelKey, TIPO_CUPON_LABELS } from '../types'
import type { Cupon } from '../types'
import { fmtRangoVigencia } from '../utils'

const MONO: React.CSSProperties = { fontFamily: '"Geist Mono", "Fira Code", monospace' }

const ESTADO_ACCENT: Record<string, string> = {
  activo: 'var(--color-success)',
  inactivo: 'var(--color-muted)',
  programado: 'var(--color-primary)',
  expirado: 'var(--color-error)',
  agotado: 'var(--color-warning)',
}

const fmtValor = (c: Cupon) =>
  c.tipoDescuento === 'porcentaje'
    ? `${c.valor}%`
    : `$ ${c.valor.toLocaleString('es-AR')}`

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
  cupon: Cupon
  onEditar: (id: string) => void
  onVerMetricas: () => void
}

export function CuponCardMobile({ cupon, onEditar, onVerMetricas }: Props) {
  const [hover, setHover] = useState(false)
  const [copiado, setCopiado] = useState(false)
  const [showLinkModal, setShowLinkModal] = useState(false)
  const toggle = useToggleCupon()
  const eliminar = useEliminarCupon()
  const duplicar = useDuplicarCupon()
  const tipoLabel = TIPO_CUPON_LABELS[tipoCuponLabelKey(cupon.tipoDescuento, cupon.alcance)]

  function copiarCodigo() {
    navigator.clipboard.writeText(cupon.codigo).catch(() => {})
    setCopiado(true)
    setTimeout(() => setCopiado(false), 1500)
  }

  const items: ItemMenuContextual[] = [
    { label: 'Editar', Icono: Pencil, onClick: () => onEditar(cupon.id) },
    { label: 'Duplicar', Icono: Copy, onClick: () => duplicar.mutate(cupon.id) },
    { label: 'Link compartible', Icono: Link2, onClick: () => setShowLinkModal(true) },
    { label: 'Ver métricas', Icono: BarChart2, onClick: onVerMetricas },
    { label: 'Eliminar', Icono: Trash2, destructivo: true, separadorAntes: true, onClick: () => eliminar.mutate(cupon.id) },
    { label: copiado ? 'Copiado' : 'Copiar código', Icono: Clipboard, onClick: copiarCodigo },
  ]
  const tieneLimite = cupon.usosMaxTotal != null

  return (
    <>
      {showLinkModal && <LinkCompartibleModal cupon={cupon} onClose={() => setShowLinkModal(false)} />}
      <div
        onClick={() => onEditar(cupon.id)}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        style={{
          background: hover ? 'var(--color-surface-alt)' : 'var(--color-bg)',
          border: '1px solid var(--color-border)',
          borderLeft: `3px solid ${ESTADO_ACCENT[cupon.estado] ?? 'var(--color-muted)'}`,
          borderRadius: 10, padding: 16,
          cursor: 'pointer', transition: 'background 150ms',
          display: 'flex', flexDirection: 'column', gap: 12,
        }}
      >
        {/* Nivel 1 — código + estado */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 15, fontWeight: 700, color: 'var(--color-primary)', overflow: 'hidden', minWidth: 0, ...MONO }}>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{cupon.codigo}</span>
            {cupon.link_activo && <Link2 size={13} color="var(--color-primary)" style={{ flexShrink: 0 }} />}
          </span>
          <span style={{ flexShrink: 0 }}><BadgeEstado estado={cupon.estado} /></span>
        </div>

        {/* Nivel 2 — tipo + valor + usos */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
            <BadgeTipo label={tipoLabel} />
            <span style={{ fontSize: 17, fontWeight: 700, color: 'var(--color-text)', flexShrink: 0, ...MONO }}>{fmtValor(cupon)}</span>
          </div>
          <div>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text)', ...MONO }}>
              {cupon.usosConsumidos} / {cupon.usosMaxTotal ?? '∞'} usos
            </span>
            {tieneLimite && <BarraUsos consumidos={cupon.usosConsumidos} total={cupon.usosMaxTotal as number} />}
          </div>
        </div>

        {/* Nivel 3 — nombre + vigencia */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          <span style={{ fontSize: 12, color: 'var(--color-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {cupon.nombre}
          </span>
          <span style={{ fontSize: 12, color: 'var(--color-muted)', ...MONO }}>
            {fmtRangoVigencia(cupon.fechaInicio, cupon.fechaExpiracion)}
          </span>
        </div>

        {/* Acciones */}
        <div onClick={e => e.stopPropagation()} style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <ToggleConfirmacion activo={cupon.activo} onToggle={v => toggle.mutate({ id: cupon.id, activo: v })} textoConfirmacion="Los clientes no podrán canjearlo." />
          <MenuContextual items={items} />
        </div>
      </div>
    </>
  )
}
