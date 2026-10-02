// Camino Tienda, paso 2: qué vende. Es el primer paso del alta real
// (modules/onboarding/tienda/Setup.tsx) tal cual: la grilla de subrubros a todo
// el ancho, se pueden marcar varios y "De todo un poco" es excluyente. Lo que
// cambia es la piel: tarjetas translúcidas sobre el cielo y el estado elegido
// del alta nueva. La etiqueta de cada tarjeta avisa qué le suma ese rubro al
// catálogo (variantes, número de serie o cantidad variable).
import { Check } from 'lucide-react'
import { SUBRUBROS_TIENDA, TIPOS, alternarTipo } from './subrubrosTienda'

export function PasoTipo({ elegidos, onCambio }: { elegidos: string[]; onCambio: (t: string[]) => void }) {
  return (
    <div className="tuob-ancho tuob-ancho--medio">
      <p className="tuob-contador" role="status" aria-live="polite">
        {elegidos.length === 0 ? 'Podés elegir varios' : `${elegidos.length} elegido${elegidos.length === 1 ? '' : 's'}`}
      </p>
      <div className="tuob-rubros tuob-rubros--tienda" role="group" aria-label="Qué vendés">
        {SUBRUBROS_TIENDA.map(s => {
          const sel = elegidos.includes(s.key)
          const { etiqueta } = TIPOS[s.tipo]
          return (
            <button key={s.key} type="button" className="tuob-rubro" aria-pressed={sel} onClick={() => onCambio(alternarTipo(elegidos, s.key))}>
              {sel && <span className="tuob-tilde" aria-hidden><Check size={13} strokeWidth={3.2} /></span>}
              <span className="tuob-rubro-icono"><s.Icon size={20} strokeWidth={1.75} aria-hidden /></span>
              <b>{s.label}</b>
              <small>{s.descripcion}</small>
              {etiqueta && <span className="tuob-etiqueta">{etiqueta}</span>}
            </button>
          )
        })}
      </div>
    </div>
  )
}
