import { useRef } from 'react'
import type { TouchEvent } from 'react'

// Deslizar con el dedo para pasar de un slide al siguiente (hero de la
// portada, galería de la ficha). Hasta ahora esos sliders solo se movían con
// sus flechas: en un teléfono lo natural es arrastrar, y el cliente que no
// encontraba la flecha quedaba mirando el primer slide.
//
// Solo toca la tarjeta del gesto, no el scroll: se mira dónde empezó y dónde
// terminó el dedo. Un gesto cuenta como "deslizar" si recorrió algo y fue más
// horizontal que vertical — así un scroll de la página que se desvía un poco
// hacia el costado no cambia el slide. No bloquea nada (los listeners son
// pasivos): la página sigue scrolleando igual.

/** Distancia mínima (px) para que un gesto cuente: menos que esto es un toque. */
export const DISTANCIA_MINIMA = 45
/** Cuántas veces más horizontal que vertical tiene que ser. */
export const PROPORCION_HORIZONTAL = 1.4

/**
 * Hacia dónde fue el gesto: `1` si arrastró hacia la izquierda (pasa al
 * siguiente), `-1` hacia la derecha (vuelve al anterior), `0` si no es un
 * deslizamiento. Pura, para poder probarla sin dedos.
 */
export function direccionDelGesto(dx: number, dy: number): 1 | -1 | 0 {
    if (Math.abs(dx) < DISTANCIA_MINIMA) return 0
    if (Math.abs(dx) < Math.abs(dy) * PROPORCION_HORIZONTAL) return 0
    return dx < 0 ? 1 : -1
}

/**
 * Handlers táctiles para esparcir sobre el contenedor del slider.
 * `desde` (opcional) decide si el gesto es válido según dónde empezó el dedo:
 * una portada que dibuja el hero adentro de un bloque más grande lo usa para
 * ignorar lo que no es el hero.
 */
export function useDeslizar(alDeslizar: (direccion: 1 | -1) => void, desde?: (e: TouchEvent) => boolean) {
    const inicio = useRef<{ x: number; y: number } | null>(null)
    return {
        onTouchStart: (e: TouchEvent) => {
            // Con dos dedos es un pellizco, no un deslizamiento.
            if (e.touches.length !== 1 || (desde && !desde(e))) { inicio.current = null; return }
            inicio.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }
        },
        onTouchEnd: (e: TouchEvent) => {
            const p = inicio.current
            inicio.current = null
            if (!p) return
            const t = e.changedTouches[0]
            const dir = direccionDelGesto(t.clientX - p.x, t.clientY - p.y)
            if (dir !== 0) alDeslizar(dir)
        },
        onTouchCancel: () => { inicio.current = null },
    }
}
