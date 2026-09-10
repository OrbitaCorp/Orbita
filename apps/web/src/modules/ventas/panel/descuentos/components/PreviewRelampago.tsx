// Preview lateral del formulario para el tipo "Oferta relámpago": una maqueta
// de la cartelera que dibuja la portada de la tienda (CountdownOfertaSection
// .tsx) con el reloj corriendo de verdad hacia la fecha y hora elegidas.
//
// Es una maqueta y no el componente real del storefront: ese depende de las
// variables de tema de la tienda, que en el panel no están montadas — mismo
// criterio que PreviewPOS.tsx. Reemplaza
// al preview de ticket (PreviewPOS) porque lo que el dueño quiere ver de esta
// promo no es el subtotal del carrito sino cómo queda en la portada.

import { Timer } from 'lucide-react'
import { useAhora } from '@/hooks/useAhora'
import { localAInstante } from '../utils'

interface Props {
  nombre: string
  valor: string
  fechaFin: string
  horaFin: string
  cantidadProductos: number
}

const MONO = '"Geist Mono", "Fira Code", monospace'

function partes(ms: number) {
  const seg = Math.max(0, Math.floor(ms / 1000))
  return { dias: Math.floor(seg / 86400), horas: Math.floor((seg % 86400) / 3600), min: Math.floor((seg % 3600) / 60), seg: seg % 60 }
}
const pad = (n: number) => String(n).padStart(2, '0')

export function PreviewRelampago({ nombre, valor, fechaFin, horaFin, cantidadProductos }: Props) {
  const finIso = localAInstante(fechaFin, horaFin)
  const finMs = finIso ? new Date(finIso).getTime() : null
  const ahora = useAhora(finMs !== null, 1000, finMs ?? undefined)
  const restante = finMs !== null && ahora !== null ? finMs - ahora : null
  const t = restante !== null ? partes(restante) : null
  const pct = Math.round(parseFloat(valor) || 0)
  const tarjetas = Math.min(3, Math.max(1, cantidadProductos || 1))

  return (
    <div style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 10, padding: '16px 18px' }}>
      <style>{ESTILOS}</style>
      <p style={{ margin: '0 0 12px', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--color-muted)' }}>
        Así se ve en tu portada
      </p>

      <div className="prl-cartel" aria-hidden="true">
        <div className="prl-eyebrow">
          <Timer size={11} strokeWidth={2.4} />
          Oferta por tiempo limitado
          {pct > 0 && <span className="prl-off">{pct}% OFF</span>}
        </div>
        <div className="prl-titulo">{nombre.trim() || 'Nombre de la oferta'}</div>
        <div className="prl-reloj">
          {t ? (
            <>
              {t.dias > 0 && <Casilla n={t.dias} label={t.dias === 1 ? 'día' : 'días'} />}
              <Casilla n={t.horas} label="hs" />
              <Casilla n={t.min} label="min" />
              <Casilla n={t.seg} label="seg" />
            </>
          ) : (
            <>
              <Casilla n={null} label="hs" />
              <Casilla n={null} label="min" />
              <Casilla n={null} label="seg" />
            </>
          )}
        </div>
      </div>

      <div className="prl-grid" aria-hidden="true">
        {Array.from({ length: tarjetas }).map((_, i) => (
          <div key={i} className="prl-card">
            <div className="prl-img" />
            <div className="prl-linea" style={{ width: '70%' }} />
            <div className="prl-precio">
              <span className="prl-tachado" />
              <span className="prl-linea prl-linea--fuerte" style={{ width: 34 }} />
            </div>
          </div>
        ))}
      </div>

      <p style={{ margin: '12px 0 0', fontSize: 11.5, lineHeight: 1.5, color: 'var(--color-muted)' }}>
        {restante !== null && restante <= 0
          ? 'Con esa fecha y hora la oferta ya habría terminado.'
          : finMs === null
            ? 'Elegí la fecha y la hora de fin para ver el reloj.'
            : 'El reloj corre en vivo en la tienda y la sección desaparece sola cuando llega a cero.'}
      </p>
    </div>
  )
}

function Casilla({ n, label }: { n: number | null; label: string }) {
  return (
    <span className="prl-casilla">
      <b style={{ fontFamily: MONO }}>{n === null ? '--' : pad(n)}</b>
      <span>{label}</span>
    </span>
  )
}

const ESTILOS = `
.prl-cartel { padding: 12px 14px; border-radius: 12px; background: linear-gradient(100deg, var(--color-primary-h), var(--color-primary)); color: var(--color-on-primary); }
.prl-eyebrow { display: inline-flex; align-items: center; gap: 5px; flex-wrap: wrap; font-size: 9.5px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; opacity: 0.9; }
.prl-off { padding: 1px 6px; border-radius: 999px; letter-spacing: 0.04em; background: color-mix(in srgb, var(--color-on-primary) 20%, transparent); }
.prl-titulo { font-size: 15px; font-weight: 800; letter-spacing: -0.02em; line-height: 1.2; margin-top: 6px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.prl-reloj { display: flex; gap: 5px; margin-top: 10px; }
.prl-casilla { display: flex; flex: 1; flex-direction: column; align-items: center; justify-content: center; gap: 1px; min-width: 0; padding: 6px 4px; border-radius: 8px; background: color-mix(in srgb, var(--color-on-primary) 16%, transparent); }
.prl-casilla b { font-size: 15px; font-weight: 700; line-height: 1; font-variant-numeric: tabular-nums; }
.prl-casilla span { font-size: 8px; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; opacity: 0.8; }
.prl-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-top: 10px; }
.prl-card { padding: 6px; border-radius: 8px; border: 1px solid var(--color-border); background: var(--color-surface-alt); display: flex; flex-direction: column; gap: 5px; }
.prl-img { width: 100%; aspect-ratio: 1; border-radius: 6px; background: var(--color-border); }
.prl-linea { height: 6px; border-radius: 3px; background: var(--color-border); }
.prl-linea--fuerte { background: var(--color-border-strong); height: 7px; }
.prl-precio { display: flex; align-items: center; gap: 5px; }
.prl-tachado { width: 22px; height: 5px; border-radius: 3px; background: var(--color-border); position: relative; }
.prl-tachado::after { content: ""; position: absolute; left: 0; right: 0; top: 2px; height: 1px; background: var(--color-muted); }
`
