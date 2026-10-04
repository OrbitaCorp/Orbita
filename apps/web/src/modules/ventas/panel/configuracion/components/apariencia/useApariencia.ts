// El estado de la pantalla de Apariencia: carga lo publicado, lleva el
// formulario con sus cambios sin guardar, y guarda o descarta.

import { useEffect, useState } from 'react'
import { ApiError, panelGetAppearance, panelGetBusiness, panelUpdateAppearance, panelGetCategoriesFlat, panelGetProducts, type ApiCategory, type ApiProductListItem } from '@/lib/api'
import { AP_DEFAULTS, loadFont, type Apariencia as Ap } from '../../mock/apariencia.mock'
import { apToUpdateDto, dtoToAp } from '../../mock/apariencia.mapper'
import { PLANTILLAS } from '@/modules/ventas/panel/avanzado/plantillas/datos'

// Las plantillas tenían un cintillo PROPIO (y las recetas, además, un
// parallax), cargados en la pestaña Secciones, aparte del anuncio y el
// parallax de Apariencia: el dueño cargaba lo mismo dos veces. Ahora usan los
// de Apariencia, y esos campos ya no tienen formulario.
//
// La tienda sigue mostrando lo que estaba guardado en ellos (ver
// plantillaReal.ts), así que acá se pasa a los campos de Apariencia al abrir
// el editor: el dueño lo ve donde ahora se edita, y al guardar queda en un
// solo lugar. Sin esto quedaba publicado un texto que no se podía cambiar ni
// borrar desde ninguna pantalla.
function pasarAApariencia(ap: Ap, homeTemplate: string | null): Ap {
    const plantilla = PLANTILLAS.find(x => x.id === homeTemplate)
    if (!plantilla) return ap
    const { cintillo, ...sinCintillo } = ap.seccionesPlantilla
    // El parallax propio era solo de las recetas.
    const parallax = plantilla.receta ? sinCintillo.parallax : undefined
    if (!cintillo && !parallax) return ap
    const resto = { ...sinCintillo }
    if (parallax) delete resto.parallax
    const out: Ap = { ...ap, seccionesPlantilla: resto }
    if (cintillo?.texto?.trim()) {
        out.textoEnvio = cintillo.texto.trim()
        out.mostrarBannerEnvio = true
        out.bannerDesplazable = cintillo.cartelera === 'si'
    }
    // Solo si el de Apariencia no se está mostrando: ese gana en la tienda.
    if (parallax?.foto && parallax?.titulo && !(ap.mostrarParallax && ap.parallaxImagen)) {
        out.mostrarParallax = true
        out.parallaxImagen = parallax.foto
        out.parallaxTitulo = parallax.titulo
        out.parallaxSubtitulo = parallax.texto ?? ''
        out.parallaxCtaTexto = parallax.cta || 'Ver el catálogo'
    }
    return out
}

// `editandoPlantilla` es el modo de Avanzado → Plantillas (ver soloContenido
// en Apariencia.tsx).
export function useApariencia(onToast: (m: string) => void, editandoPlantilla = false) {
    const [ap, setApRaw] = useState<Ap>(AP_DEFAULTS)
    const [dirty, setDirty] = useState(false)
    // Lo que la tienda muestra HOY (lo último cargado o guardado). La vista
    // previa lo usa para el "Publicado / Con tus cambios", y "Descartar"
    // vuelve el formulario a esto sin tocar el backend.
    const [publicado, setPublicado] = useState<Ap | null>(null)
    const [cargando, setCargando] = useState(true)
    const [errorCarga, setErrorCarga] = useState<string | null>(null)
    // Categorías reales del negocio — solo hacen falta editando una plantilla
    // (la tarjeta "Header" de más abajo las ofrece como enlaces). En Apariencia
    // completa no se piden: ahí el header se edita con la lista fija de
    // siempre, dentro de "Diseño y layout".
    const [categorias, setCategorias] = useState<ApiCategory[]>([])
    // El catálogo, para los campos `seleccion` de las secciones de plantilla
    // (ver TipoCampo en plantillas/tipos.ts): "Armá tu setup" de Nocturno deja
    // elegir una categoría O un producto concreto, así que hacen falta los dos.
    const [productos, setProductos] = useState<ApiProductListItem[]>([])
    const [guardando, setGuardando] = useState(false)
    const [errorGuardado, setErrorGuardado] = useState<string | null>(null)

    // Plantilla de Home activa (Avanzado → Plantillas) — mientras no sea null,
    // esta pantalla se bloquea: edita los MISMOS heroSlides/statsBar/
    // shippingText que Apariencia, así que las dos a la vez sería un
    // quilombo (pedido explícito del dueño). Se edita desde PlantillasConfig
    // en su lugar mientras la plantilla esté puesta.
    const [homeTemplate, setHomeTemplateLocal] = useState<string | null>(null)

    const set = <K extends keyof Ap>(k: K, v: Ap[K]) => { setApRaw(p => ({ ...p, [k]: v })); setDirty(true) }
    // Para un cambio que toca más de un campo a la vez (ver "Grilla de
    // productos" en SeccionLayout.tsx).
    const actualizar = (fn: (p: Ap) => Ap) => { setApRaw(fn); setDirty(true) }

    // Subdominio real, para la vista previa — antes ahí decía siempre
    // "rama.orbita.shop" fijo, ni fuera el negocio de verdad.
    const [subdomain, setSubdomain] = useState('')

    // El nombre del NEGOCIO es el default del "nombre de la tienda" mientras
    // el dueño no haya guardado uno propio en Apariencia. Antes el default era
    // el del mock ("Rama Indumentaria") y, como se guarda tal cual al tocar
    // "Guardar", terminaba siendo el nombre real de la tienda en la base — y
    // eso era lo que veían sus clientes. Si el pedido del negocio falla, el
    // campo queda vacío (con su placeholder): nunca se inventa una marca.
    useEffect(() => {
        let cancelado = false
        Promise.all([
            panelGetAppearance(),
            panelGetBusiness().catch(() => null),
        ])
            .then(([dto, biz]) => {
                if (cancelado) return
                const cargado = pasarAApariencia(
                    dtoToAp(dto, { ...AP_DEFAULTS, nombreTienda: biz?.name ?? AP_DEFAULTS.nombreTienda }),
                    editandoPlantilla ? dto.homeTemplate : null,
                )
                setApRaw(cargado)
                setPublicado(cargado)
                setHomeTemplateLocal(dto.homeTemplate)
                if (biz?.subdomain) setSubdomain(biz.subdomain)
            })
            .catch(e => { if (!cancelado) setErrorCarga(e instanceof ApiError ? e.message : 'No se pudo cargar la apariencia') })
            .finally(() => { if (!cancelado) setCargando(false) })
        return () => { cancelado = true }
    }, [])

    // Aparte del Promise.all de arriba: si el negocio no tiene categorías, o
    // el pedido falla, la pantalla igual carga — la tarjeta "Header" queda
    // con los enlaces fijos y sin categorías, en vez de trabar todo.
    // Ya no está gateado a `soloContenido`: además de los enlaces del header,
    // ahora se usa para saber si alguna categoría tiene FOTO cargada, que es
    // lo que habilita los estilos de categoría basados en imagen (ver
    // "Estilo de las categorías" más abajo).
    useEffect(() => {
        let cancelado = false
        panelGetCategoriesFlat()
            .then(cats => { if (!cancelado) setCategorias(cats.filter(c => c.isActive)) })
            .catch(() => { /* sin categorías: la tarjeta muestra solo los enlaces fijos */ })
        // 100 es el TOPE de la API (`@Max(100)` en find-products-query.dto.ts),
        // no una elección: pedir más devuelve 400 y el catch de abajo se lo
        // come en silencio, así que el desplegable quedaba sin productos y
        // ofrecía solo categorías. Si el negocio tiene más de 100, el selector
        // muestra los primeros 100.
        panelGetProducts({ limit: 100 })
            // Sin los borradores: la tienda no los publica, así que elegir uno
            // no mostraría nada (la portada no lo encontraría y llenaría ese
            // lugar con otro, sin avisar). OUT_OF_STOCK sí queda: está
            // publicado, se ve, y puede volver a tener stock.
            .then(r => { if (!cancelado) setProductos(r.data.filter(x => x.status !== 'DRAFT')) })
            .catch(() => { /* sin catálogo: el selector ofrece solo categorías */ })
        return () => { cancelado = true }
    }, [])

    useEffect(() => { loadFont(ap.fuenteHeading); loadFont(ap.fuenteBody) }, [ap.fuenteHeading, ap.fuenteBody])

    async function guardar() {
        setGuardando(true)
        setErrorGuardado(null)
        try {
            const actualizado = await panelUpdateAppearance(apToUpdateDto(ap))
            const guardado = dtoToAp(actualizado, AP_DEFAULTS)
            setApRaw(guardado)
            setPublicado(guardado)
            setDirty(false)
            onToast('Cambios guardados y publicados')
        } catch (e) {
            setErrorGuardado(e instanceof ApiError ? e.message : 'No se pudo guardar la apariencia')
        } finally {
            setGuardando(false)
        }
    }
    function descartar() {
        if (!publicado) return
        setApRaw(publicado)
        setDirty(false)
        setErrorGuardado(null)
    }

    return {
        ap, set, actualizar, dirty, publicado, cargando, errorCarga, categorias, productos,
        guardando, errorGuardado, homeTemplate, setHomeTemplateLocal, subdomain, guardar, descartar,
    }
}
