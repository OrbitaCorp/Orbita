import { BarChart2, Plus } from 'lucide-react'
import { Paginacion } from '../../_shared/components'
import { DescuentosFiltros } from './components/DescuentosFiltros'
import { DescuentosTabla } from './components/DescuentosTabla'
import { useDescuentos } from './hooks/useDescuentos'
import { useDescuentosFiltros } from './hooks/useDescuentosFiltros'

const btnSecundario: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 6,
  height: 36, padding: '0 14px', borderRadius: 8,
  fontSize: 14, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit',
  background: 'var(--color-bg)', color: 'var(--color-body)', border: '1px solid var(--color-border)',
}

const btnPrimario: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 6,
  height: 36, padding: '0 14px', borderRadius: 8,
  fontSize: 14, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit',
  background: 'var(--color-primary)', color: 'var(--color-on-primary)', border: 'none',
}

interface Props {
  onVerDetalle: (id: string) => void
  onEditar: (id: string) => void
  onVerMetricas: () => void
  onCrear: () => void
}

export function DescuentosListado({ onVerDetalle, onEditar, onVerMetricas, onCrear }: Props) {
  const filtros = useDescuentosFiltros()
  const { data, isLoading } = useDescuentos(filtros.descuentosFiltros)

  return (
    <div>
      <style>{`
        .dl-bar { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 16px; }
        .dl-actions { display: flex; gap: 8px; flex-shrink: 0; }
        @media (max-width: 768px) {
          .dl-bar { flex-direction: column; align-items: stretch; }
          .dl-actions > button { flex: 1; justify-content: center; }
        }
      `}</style>
      <div className="dl-bar">
        <DescuentosFiltros />
        <div className="dl-actions">
          <button className="ds-hover" style={btnSecundario} onClick={onVerMetricas}>
            <BarChart2 size={16} /> Métricas
          </button>
          <button className="ds-hover" style={btnPrimario} onClick={onCrear}>
            <Plus size={16} /> Crear descuento
          </button>
        </div>
      </div>
      <DescuentosTabla
        datos={data?.data ?? []}
        isLoading={isLoading}
        ordenColumna={filtros.ordenColumna}
        ordenDireccion={filtros.ordenDireccion}
        onOrdenar={filtros.setOrden}
        onVerDetalle={onVerDetalle}
        onEditar={onEditar}
        onVerMetricas={onVerMetricas}
      />
      {(data?.total ?? 0) > 0 && (
        <Paginacion
          total={data?.total ?? 0}
          pagina={data?.pagina ?? 1}
          porPagina={data?.porPagina ?? 10}
          onCambiarPagina={filtros.setPagina}
          onCambiarPorPagina={filtros.setPorPagina}
        />
      )}
    </div>
  )
}
