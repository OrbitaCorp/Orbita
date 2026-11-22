// Preview lateral del formulario para el tipo "Oferta relámpago": la misma pieza
// que dibuja la portada (OfertaDisenada), con el reloj corriendo de verdad hacia
// la fecha y hora elegidas y el formato y los colores que se estén eligiendo.
// Los productos son de muestra: los reales recién se conocen en la tienda.

import { useMemo } from 'react'
import { useAhora } from '@/hooks/useAhora'
import type { Producto } from '@/lib/storefront/types'
import { OfertaDisenada } from '@/modules/ventas/promos/OfertaDisenada'
import { useTokensTienda } from '@/modules/ventas/promos/PanelPromos'
import { localAInstante } from '../utils'

interface Props {
  nombre: string
  valor: string
  fechaFin: string
  horaFin: string
  cantidadProductos: number
  formato: string
  diseno: string
}

const PRECIO_MUESTRA = 10000

export function PreviewRelampago({ nombre, valor, fechaFin, horaFin, cantidadProductos, formato, diseno }: Props) {
  const tokens = useTokensTienda()
  const finIso = localAInstante(fechaFin, horaFin)
  const finMs = finIso ? new Date(finIso).getTime() : null
  const ahora = useAhora(finMs !== null, 1000, finMs ?? undefined)
  const restante = finMs !== null && ahora !== null ? finMs - ahora : null
  const pct = Math.round(parseFloat(valor) || 0)
  const cuantos = Math.min(4, Math.max(1, cantidadProductos || 1))
  const productos = useMemo<Producto[]>(() => Array.from({ length: cuantos }, (_, i) => ({
    id: `muestra-${i}`, nombre: 'Tu producto', cat: '', precio: Math.round(PRECIO_MUESTRA * (1 - pct / 100)),
    precioAnt: pct > 0 ? PRECIO_MUESTRA : null, badge: null, hue: 210 + i * 24, stock: true,
  })), [cuantos, pct])

  return (
    <div style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 10, padding: '16px 18px' }}>
      <p style={{ margin: '0 0 12px', fontSize: 13, fontWeight: 600, color: 'var(--color-text)' }}>
        Así se ve en tu portada
      </p>
      <div style={{ ...tokens, background: '#fff', borderRadius: 8 }}>
        <OfertaDisenada
          compacto
          formato={formato}
          diseno={diseno}
          titulo={nombre.trim() || 'Nombre de la oferta'}
          off={pct > 0 ? `${pct}% OFF` : null}
          restanteMs={restante !== null ? Math.max(restante, 0) : 0}
          productos={productos}
        />
      </div>
      <p style={{ margin: '12px 0 0', fontSize: 12.5, lineHeight: 1.5, color: 'var(--color-muted)' }}>
        {restante !== null && restante <= 0
          ? 'Con esa fecha y hora la oferta ya habría terminado.'
          : finMs === null
            ? 'Elegí la fecha y la hora de fin para ver el reloj.'
            : 'El reloj corre en vivo en la tienda y la oferta desaparece sola cuando llega a cero.'}
      </p>
    </div>
  )
}
