// Preview lateral del formulario para el tipo "Oferta relámpago": una maqueta
// de la cartelera que dibuja la portada de la tienda (CountdownOfertaSection
// .tsx) con el reloj corriendo de verdad hacia la fecha y hora elegidas.
//
// Es una maqueta y no el componente real del storefront: ese depende de las
// variables de tema de la tienda, que en el panel no están montadas — mismo
// criterio que PreviewPOS.tsx. Reemplaza
// al preview de ticket (PreviewPOS) porque lo que el dueño quiere ver de esta
// promo no es el subtotal del carrito sino cómo queda en la portada.

import { useAhora } from '@/hooks/useAhora'
import { localAInstante } from '../utils'

interface Props {
  nombre: string
  valor: string
  fechaFin: string
  horaFin: string
  cantidadProductos: number
}

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
        <div className="prl-kicker">Oferta relámpago</div>
        <div className="prl-titulo">{nombre.trim() || 'Nombre de la oferta'}</div>
        {pct > 0 && <div className="prl-off">{pct}% OFF</div>}
        <div className="prl-reloj">
          {t ? (
            <>
              {t.dias > 0 && <Casilla n={t.dias} label={t.dias === 1 ? 'día' : 'días'} primera />}
              <Casilla n={t.horas} label="horas" primera={t.dias === 0} />
              <Casilla n={t.min} label="min" />
              <Casilla n={t.seg} label="seg" />
            </>
          ) : (
            <>
              <Casilla n={null} label="horas" primera />
              <Casilla n={null} label="min" />
              <Casilla n={null} label="seg" />
            </>
          )}
        </div>
      </div>

      <div className="prl-grid" aria-hidden="true">
        {Array.from({ length: tarjetas }).map((_, i) => (
          <div key={i} className="prl-card">
            <div className="prl-img">{pct > 0 && <span className="prl-pct">−{pct}%</span>}</div>
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

function Casilla({ n, label, primera }: { n: number | null; label: string; primera?: boolean }) {
  return (
    <>
      {!primera && <span className="prl-sep">:</span>}
      <span className="prl-casilla">
        <b>{n === null ? '--' : pad(n)}</b>
        <span>{label}</span>
      </span>
    </>
  )
}

const ESTILOS = `
.prl-cartel { padding: 14px 16px; border-radius: 12px 12px 0 0; background: var(--color-primary); color: var(--color-on-primary); }
.prl-kicker { font-size: 10.5px; opacity: 0.8; }
.prl-titulo { font-size: 14px; font-weight: 700; letter-spacing: -0.02em; line-height: 1.2; margin-top: 2px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.prl-off { margin-top: 8px; font-size: 26px; font-weight: 800; letter-spacing: -0.04em; line-height: 1; }
.prl-reloj { display: flex; align-items: flex-start; margin-top: 12px; }
.prl-casilla { display: flex; flex-direction: column; align-items: center; min-width: 2ch; }
.prl-casilla b { font-size: 18px; font-weight: 700; line-height: 1; font-variant-numeric: tabular-nums; }
.prl-casilla span { margin-top: 3px; font-size: 9px; opacity: 0.75; }
.prl-sep { padding: 0 4px; font-size: 15px; line-height: 1.1; opacity: 0.5; }
.prl-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; padding: 10px; border: 1px solid var(--color-border); border-top: 0; border-radius: 0 0 12px 12px; background: var(--color-surface); }
.prl-card { display: flex; flex-direction: column; gap: 5px; }
.prl-img { position: relative; width: 100%; aspect-ratio: 1; border-radius: 6px; background: var(--color-border); }
.prl-pct { position: absolute; top: 4px; left: 4px; padding: 1px 4px; border-radius: 4px; background: var(--color-primary); color: var(--color-on-primary); font-size: 8.5px; font-weight: 700; }
.prl-linea { height: 6px; border-radius: 3px; background: var(--color-border); }
.prl-linea--fuerte { background: var(--color-border-strong); height: 7px; }
.prl-precio { display: flex; align-items: center; gap: 5px; }
.prl-tachado { width: 22px; height: 5px; border-radius: 3px; background: var(--color-border); position: relative; }
.prl-tachado::after { content: ""; position: absolute; left: 0; right: 0; top: 2px; height: 1px; background: var(--color-muted); }
`
