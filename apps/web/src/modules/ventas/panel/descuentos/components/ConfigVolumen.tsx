import { Plus, Trash2 } from 'lucide-react'
import { FormField } from './FormField'
import { SelectorProductoOCategoria } from './SelectorProductoOCategoria'
import type { AlcanceDescuento } from '../types'

export interface EscalaForm {
  desde: string
  hasta: string
  porcentaje: string
}

interface Props {
  alcance: AlcanceDescuento
  productosIds: string[]
  categoriasIds: string[]
  escalas: EscalaForm[]
  onChangeAlcance: (a: AlcanceDescuento) => void
  onChangeProductos: (ids: string[]) => void
  onChangeCategorias: (ids: string[]) => void
  onUpdateEscala: (idx: number, field: keyof EscalaForm, value: string) => void
  onAddEscala: () => void
  onRemoveEscala: (idx: number) => void
  errores?: Record<string, string>
}

export function ConfigVolumen({
  alcance, productosIds, categoriasIds, escalas,
  onChangeAlcance, onChangeProductos, onChangeCategorias,
  onUpdateEscala, onAddEscala, onRemoveEscala,
  errores = {},
}: Props) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <SelectorProductoOCategoria
        alcance={alcance}
        productosIds={productosIds}
        categoriasIds={categoriasIds}
        onChangeAlcance={onChangeAlcance}
        onChangeProductos={onChangeProductos}
        onChangeCategorias={onChangeCategorias}
        label="¿A qué productos aplica?"
        error={errores.seleccion}
      />

      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <p style={{ margin: 0, fontSize: 14, fontWeight: 500, color: 'var(--color-body)' }}>
            Escalas de descuento
          </p>
          <button
            type="button"
            className="ds-hover"
            onClick={onAddEscala}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 4, height: 32, padding: '0 12px',
              borderRadius: 8, border: '1px solid var(--color-primary)', background: 'var(--color-primary-bg)',
              color: 'var(--color-primary)', fontSize: 13, fontWeight: 500, cursor: 'pointer',
            }}
          >
            <Plus size={14} />
            Agregar escala
          </button>
        </div>

        <div style={{ border: '1px solid var(--color-border)', borderRadius: 8, overflow: 'hidden' }}>
          <div
            style={{
              display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 36px', gap: 0,
              padding: '8px 12px',
              background: 'var(--color-surface)',
              borderBottom: '1px solid var(--color-border)',
            }}
          >
            {['Desde (unid.)', 'Hasta (unid.)', 'Descuento', ''].map((h) => (
              <span key={h} style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '0.03em' }}>{h}</span>
            ))}
          </div>

          {escalas.map((escala, idx) => (
            <div
              key={idx}
              style={{
                display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 36px', gap: 8,
                padding: '10px 12px', alignItems: 'center',
                borderBottom: idx < escalas.length - 1 ? '1px solid var(--color-border)' : 'none',
              }}
            >
              <FormField
                type="number" min="1" placeholder="1"
                value={escala.desde}
                onChange={(e) => onUpdateEscala(idx, 'desde', e.target.value)}
                mono
              />
              <FormField
                type="number" min="1" placeholder="∞"
                value={escala.hasta}
                onChange={(e) => onUpdateEscala(idx, 'hasta', e.target.value)}
                mono
              />
              <FormField
                suffix="%" type="number" min="0" max="100" placeholder="10"
                value={escala.porcentaje}
                onChange={(e) => onUpdateEscala(idx, 'porcentaje', e.target.value)}
                mono
              />
              <button
                type="button"
                className="ds-hover"
                onClick={() => onRemoveEscala(idx)}
                style={{
                  width: 32, height: 32, borderRadius: 6, border: 'none',
                  background: 'transparent', color: 'var(--color-muted)', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}

          {escalas.length === 0 && (
            <div style={{ padding: '20px 12px', textAlign: 'center', color: 'var(--color-muted)', fontSize: 13 }}>
              Agregá al menos una escala
            </div>
          )}
        </div>
        {errores.escalas && (
          <p style={{ margin: '6px 0 0', fontSize: 12, color: 'var(--color-error)' }}>{errores.escalas}</p>
        )}
      </div>
    </div>
  )
}
