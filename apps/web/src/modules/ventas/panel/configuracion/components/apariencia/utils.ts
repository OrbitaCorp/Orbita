// Piezas sueltas que comparten los componentes de Apariencia: los tipos del
// formulario, las subidas de imagen/video y el reordenado de listas.

import type { ComponentType, CSSProperties } from 'react'
import { panelUploadStorefrontImage, panelPresignStorefrontVideo } from '@/lib/api'
import type { Apariencia as Ap } from '../../mock/apariencia.mock'

// Cómo una tarjeta escribe un campo del formulario (ver useApariencia.ts):
// cambia el valor y deja la pantalla con cambios sin guardar.
export type SetAp = <K extends keyof Ap>(k: K, v: Ap[K]) => void

// Lo mínimo que recibe una tarjeta: el formulario y cómo escribirlo.
export interface PropsSeccion { ap: Ap; set: SetAp }

export type IconT = ComponentType<{ size?: number; strokeWidth?: number; style?: CSSProperties }>

export const pageWrap: CSSProperties = { padding: '24px 32px 64px', maxWidth: 1760, width: '100%', margin: '0 auto', boxSizing: 'border-box' }

// Intercambia el elemento en `from` con el que está en `to` — usado para
// reordenar los sliders del hero con las flechas subir/bajar (ver SlideItem).
export function moverElemento<T>(arr: T[], from: number, to: number): T[] {
    if (to < 0 || to >= arr.length) return arr
    const next = arr.slice()
    ;[next[from], next[to]] = [next[to], next[from]]
    return next
}

export async function subirImagenApariencia(file: File): Promise<string> {
    const r = await panelUploadStorefrontImage(file, file.name)
    return r.url
}

// El archivo de la sección de video (VideoUploader) — alternativa a pegar
// un link. Sube directo a Cloudflare R2 desde el navegador (ver
// panelPresignStorefrontVideo en lib/api.ts), sin recodificar y sin pasar
// por este backend — por eso el tope real ya no son los 40 MB de
// panelUploadStorefrontVideo (que se mantiene solo por compatibilidad).
export async function subirVideoApariencia(file: File, onProgress?: (pct: number) => void): Promise<string> {
    return panelPresignStorefrontVideo(file, onProgress)
}

// Variante para la imagen de un slide: además de subir, puede pedirle al
// backend que le quite el fondo antes de convertir a webp (ver
// BackgroundRemovalService en el backend — corre 100% local, sin APIs externas).
export function subirImagenSlide(removeBg: boolean) {
    return async (file: File): Promise<string> => {
        const r = await panelUploadStorefrontImage(file, file.name, { removeBackground: removeBg })
        return r.url
    }
}
