import { LINEA_EJEMPLOS_DEMO, PRESETS_DEMO, type PresetDemo } from '@/lib/demo/orbiPresets'
import s from '../orbi.module.css'

/**
 * Reemplaza a la caja de texto en la demo pública: el visitante no escribe,
 * elige una pregunta y Orbi contesta con un texto prearmado (lib/demo/orbiPresets).
 * Así la demo no gasta modelo: cada mensaje real son llamadas pagas.
 */
export function PreguntasDemo({ onElegir, deshabilitado }: {
  onElegir: (preset: PresetDemo) => void
  /** Orbi está contestando: se elige otra cuando termine. */
  deshabilitado: boolean
}) {
  return (
    <>
      <div className={s.preguntasDemo} role="group" aria-label="Preguntas de ejemplo para Orbi">
        {PRESETS_DEMO.map(preset => (
          <button
            key={preset.id}
            type="button"
            className={`${s.preguntaDemo} ${s.foco}`}
            disabled={deshabilitado}
            onClick={() => onElegir(preset)}
          >
            {preset.pregunta}
          </button>
        ))}
      </div>
      <p className={s.avisoPrivacidad}>{LINEA_EJEMPLOS_DEMO}</p>
    </>
  )
}
