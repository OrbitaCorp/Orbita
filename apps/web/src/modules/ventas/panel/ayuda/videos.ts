// ─── Los videos tutoriales, alojados en YouTube ──────────────────────────────
//
// "Ver tutorial" ofrece dos formas de aprender una pantalla: el video (este
// archivo) o el recorrido guiado sobre la pantalla real (recorridos.ts).
//
// Los videos NO están en el código: cada tutorial de la lista de Marketing tiene
// su link de YouTube y las pantallas donde se ofrece (las mismas claves que los
// recorridos, claveDeAyuda). Los carga el Claude de cada persona por el conector
// (tutoriales_actualizar), así que un video nuevo aparece sin deploy. Se piden
// una sola vez por sesión, recién cuando alguien abre "Ver tutorial".

import { useEffect, useState } from 'react'
import { panelGetVideosTutorial, type VideoTutorialRemoto } from '@/lib/api'

export interface VideoTutorial {
    titulo: string
    /** El id de 11 caracteres del video en YouTube. */
    id: string
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

let pedido: Promise<Map<string, VideoTutorial[]>> | null = null
function cargar() {
    pedido ??= panelGetVideosTutorial()
        .then(r => agruparPorPantalla(r.videos))
        // Si falla, la opción Video queda apagada y se vuelve a intentar la próxima vez.
        .catch(() => { pedido = null; return new Map<string, VideoTutorial[]>() })
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
