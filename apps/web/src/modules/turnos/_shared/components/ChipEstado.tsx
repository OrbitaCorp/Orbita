// Estado de un turno como pill: mismo formato que design-system/Badge (alto,
// radio, punto de color), con los estados propios de la agenda.
import { ESTADO_TURNO, type EstadoTurno } from '@/modules/turnos/datos'

export function ChipEstado({ estado, size = 'md' }: { estado: EstadoTurno; size?: 'sm' | 'md' }) {
  const e = ESTADO_TURNO[estado]
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap',
      height: size === 'sm' ? 20 : 24, padding: `0 ${size === 'sm' ? 8 : 10}px`, borderRadius: 9999,
      background: e.bg, color: e.fg, fontSize: size === 'sm' ? 11 : 12, fontWeight: 600,
    }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: e.dot }} />
      {e.label}
    </span>
  )
}

// El "ahora" de la demo vive en horario.ts; se reexporta acá porque medio panel lo importa de este archivo.
export { AHORA_DEMO, FECHA_DEMO } from '@/modules/turnos/horario'
