// ─── Los videos tutoriales ───────────────────────────────────────────────────
//
// "Ver tutorial" ofrece dos formas de aprender una pantalla: el video (este
// archivo) o el recorrido guiado sobre la pantalla real (recorridos.ts).
//
// Hay dos fuentes:
//   - La lista de Marketing (YouTube): cada tutorial tiene su link y las
//     pantallas donde se ofrece (las mismas claves que los recorridos,
//     claveDeAyuda). Los carga el Claude de cada persona por el conector
//     (tutoriales_actualizar), así que un video nuevo aparece sin deploy.
//   - Los PROPIOS, alojados en Cloudflare R2 (no en YouTube, por decisión de la
//     dirección): WhatsApp y Difusión. Van después de los de la lista. Los de la
//     demo pública (SoloConTienda.tsx) son los mismos videos con otro cierre.
// Se piden una sola vez por sesión, recién cuando alguien abre "Ver tutorial".

import { useEffect, useState } from 'react'
import { panelGetVideosTutorial, type VideoTutorialRemoto } from '@/lib/api'

export interface VideoTutorial {
    titulo: string
    /** Identifica el video: el id de 11 caracteres de YouTube, o `r2:<nombre>` en los propios. */
    id: string
    /** Solo en los propios: el MP4 en R2 y su portada (se reproducen con <video>, no con YouTube). */
    src?: string
    portada?: string
}

const R2 = 'https://pub-4c590787fd69461f8d464b91d826c1b4.r2.dev/tutoriales'

/** Los videos propios (R2) de cada pantalla. */
export const VIDEOS_PROPIOS: Record<string, VideoTutorial[]> = {
    mensajes: [{ titulo: 'WhatsApp en tu panel', id: 'r2:whatsapp', src: `${R2}/whatsapp-en-tu-panel.mp4`, portada: `${R2}/whatsapp-en-tu-panel.jpg` }],
    difusion: [{ titulo: 'Difusión: tu Instagram desde Órbita', id: 'r2:difusion', src: `${R2}/difusion.mp4`, portada: `${R2}/difusion.jpg` }],
}

/** Los videos de cada pantalla, en el orden de la lista de tutoriales. */
export function agruparPorPantalla(videos: VideoTutorialRemoto[]): Map<string, VideoTutorial[]> {
    const mapa = new Map<string, VideoTutorial[]>()
    for (const v of videos) {
        if (!/^[\w-]{11}$/.test(v.youtubeId)) continue
        for (const p of v.pantallas) mapa.set(p, [...(mapa.get(p) ?? []), { titulo: v.titulo, id: v.youtubeId }])
    }
    return mapa
}

/** Suma los propios al final de cada pantalla (sin repetir si ya estuvieran). */
export function sumarPropios(mapa: Map<string, VideoTutorial[]>, propios: Record<string, VideoTutorial[]> = VIDEOS_PROPIOS): Map<string, VideoTutorial[]> {
    const res = new Map(mapa)
    for (const [clave, lista] of Object.entries(propios)) {
        const actuales = res.get(clave) ?? []
        res.set(clave, [...actuales, ...lista.filter(v => !actuales.some(a => a.id === v.id))])
    }
    return res
}

let pedido: Promise<Map<string, VideoTutorial[]>> | null = null
function cargar() {
    pedido ??= panelGetVideosTutorial()
        .then(r => sumarPropios(agruparPorPantalla(r.videos)))
        // Si falla la lista, igual quedan los propios; se vuelve a pedir la próxima vez.
        .catch(() => { pedido = null; return sumarPropios(new Map<string, VideoTutorial[]>()) })
    return pedido
}

/** Los videos de esa pantalla; null mientras se cargan. */
export function useVideosDe(clave: string): VideoTutorial[] | null {
    const [porPantalla, setPorPantalla] = useState<Map<string, VideoTutorial[]> | null>(null)
    useEffect(() => {
        let vigente = true
        cargar().then(m => { if (vigente) setPorPantalla(m) })
        return () => { vigente = false }
    }, [])
    return porPantalla ? (porPantalla.get(clave) ?? []) : null
}
