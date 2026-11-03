// ─── Los videos tutoriales, alojados en YouTube ──────────────────────────────
//
// "Ver tutorial" ofrece dos formas de aprender una pantalla: el video (este
// archivo) o el recorrido guiado sobre la pantalla real (recorridos.ts). Las
// claves son las mismas que las de los recorridos (claveDeAyuda).
//
// Para publicar un video, pegá en `youtube` el link del video (youtu.be/…,
// youtube.com/watch?v=…, /shorts/…) o solo su id. Mientras esté vacío, ese
// video no se ofrece; si una pantalla no tiene ninguno, la opción "Video" se
// ve deshabilitada. Un mismo video puede ir en más de una pantalla.
// Los originales están en docs/marketing/tutoriales/.

export interface VideoTutorial {
    titulo: string
    /** Link de YouTube o id del video. Vacío = todavía no se subió. */
    youtube: string
}

const VENTA_A_MANO: VideoTutorial = { titulo: 'Cargar una venta a mano', youtube: '' }
const VARIANTES: VideoTutorial = { titulo: 'Variantes y stock', youtube: '' }
const CUPON: VideoTutorial = { titulo: 'Crear y compartir un cupón', youtube: '' }

export const VIDEOS: Record<string, VideoTutorial[]> = {
    pedidos: [
        VENTA_A_MANO,
        { titulo: 'Pedidos en lote', youtube: '' },
        { titulo: 'Cancelaciones y devoluciones', youtube: '' },
    ],
    'pedidos/nuevo': [VENTA_A_MANO],
    catalogo: [VARIANTES, { titulo: 'Importar desde Excel', youtube: '' }],
    'catalogo/nuevo': [VARIANTES],
    categorias: [{ titulo: 'Organizar categorías', youtube: '' }],
    clientes: [{ titulo: 'Tus clientes', youtube: '' }],
    mensajes: [{ titulo: 'Responder mensajes', youtube: '' }],
    cupones: [CUPON],
    'cupones/crear': [CUPON],
    reportes: [{ titulo: '¿Qué promo funcionó?', youtube: '' }],
    'configuracion/apariencia': [
        { titulo: 'Armar la portada', youtube: '' },
        { titulo: 'Tu marca en la tienda', youtube: '' },
    ],
    'configuracion/dominios': [{ titulo: 'Dominio propio', youtube: '' }],
}

/** El id de 11 caracteres de un link de YouTube (o del id suelto), o null si no se reconoce. */
export function idDeYoutube(valor: string): string | null {
    const v = valor.trim()
    if (/^[\w-]{11}$/.test(v)) return v
    let url: URL
    try { url = new URL(v.startsWith('http') ? v : `https://${v}`) } catch { return null }
    const host = url.hostname.replace(/^(www\.|m\.)/, '')
    let id: string | null = null
    if (host === 'youtu.be') id = url.pathname.slice(1).split('/')[0]
    else if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
        id = url.searchParams.get('v')
            ?? url.pathname.match(/^\/(?:shorts|embed|live)\/([\w-]{11})/)?.[1]
            ?? null
    }
    return id && /^[\w-]{11}$/.test(id) ? id : null
}

/** Los videos ya publicados de esa pantalla, con su id. */
export function videosDe(clave: string): (VideoTutorial & { id: string })[] {
    return (VIDEOS[clave] ?? []).flatMap(v => {
        const id = idDeYoutube(v.youtube)
        return id ? [{ ...v, id }] : []
    })
}
