// "Termina en 2d 4h" para la columna Vigencia de una oferta relámpago: se
// actualiza solo (una vez por minuto, que es la resolución que muestra) y no
// dibuja nada si ya venció — el badge de estado "Expirado" ya lo dice.
//
// Ámbar y con el reloj para que en el listado se lea de un vistazo cuál es
// la oferta que hoy está corriendo en la portada.

import { Timer } from 'lucide-react'
import { useAhora } from '@/hooks/useAhora'
import { fmtFalta } from '../utils'

interface Props {
  fin: string | null // ISO
}

export function TerminaEn({ fin }: Props) {
  const finMs = fin ? new Date(fin).getTime() : null
  const ahora = useAhora(finMs !== null, 60_000, finMs ?? undefined)
  if (finMs === null || ahora === null) return null
  const texto = fmtFalta(finMs, ahora)
  if (!texto) return null
  return (
    <span
      title="Lo que falta para que termine la oferta relámpago"
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 4, height: 20, padding: '0 7px',
        borderRadius: 999, fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap', fontFamily: 'inherit',
        color: 'var(--color-warning)', background: 'var(--color-warning-bg)', border: '1px solid var(--color-warning)',
      }}
    >
      <Timer size={11} strokeWidth={2.2} aria-hidden />
      Termina en {texto}
    </span>
  )
}
