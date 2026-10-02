// src/modules/ventas/panel/configuracion/Apariencia.tsx — Vista 16
// Apariencia pública de la tienda: identidad de marca, paleta, tipografía,
// layout, visibilidad, textos y CSS custom — con vista previa en vivo.
//
// Este archivo solo arma la pantalla. El estado vive en useApariencia.ts y
// cada tarjeta en components/apariencia/secciones/; los controles que
// comparten (SecCard, ToggleRow, VisualPick…) están en components/apariencia/.

import { useState } from 'react'
// Para saber si la plantilla activa declara una sección de cupón — así esta
// pantalla no tiene una lista hardcodeada de qué plantilla tiene qué.
import { PLANTILLAS } from '@/modules/ventas/panel/avanzado/plantillas/datos'
import { seccionesDe } from '@/modules/ventas/panel/avanzado/plantillas/secciones'

import type { VistaConfig } from './components/ConfigTabs'
import { AparienciaBloqueada } from './components/apariencia/AparienciaBloqueada'
import { AparienciaSkeleton } from './components/apariencia/AparienciaSkeleton'
import { BarraGuardado } from './components/apariencia/BarraGuardado'
import { EncabezadoApariencia } from './components/apariencia/EncabezadoApariencia'
import { StorePreview } from './components/apariencia/StorePreview'
import { VistaPreviaCompleta } from './components/apariencia/VistaPreviaCompleta'
import { enlacesHeader } from './components/apariencia/enlacesHeader'
import { ESTILOS_APARIENCIA } from './components/apariencia/estilos'
import { useApariencia } from './components/apariencia/useApariencia'
import { SeccionHero } from './components/apariencia/secciones/SeccionHero'
import { SeccionHeaderPlantilla } from './components/apariencia/secciones/SeccionHeaderPlantilla'
import { SeccionLayout } from './components/apariencia/secciones/SeccionLayout'
import { SeccionVisibilidad } from './components/apariencia/secciones/SeccionVisibilidad'
import { SeccionCupon, SeccionEstadisticas, SeccionPie, SeccionTextos } from './components/apariencia/secciones/SeccionesContenido'
import { SeccionPaleta, SeccionTipografia } from './components/apariencia/secciones/SeccionesDiseno'
import { SeccionMarcas, SeccionParallax, SeccionVideo, SeccionWhatsapp } from './components/apariencia/secciones/SeccionesHome'
import { SeccionesPlantilla } from './components/apariencia/secciones/SeccionesPlantilla'
import type { Apariencia as Ap } from './mock/apariencia.mock'

interface AparienciaProps {
    ir:      (v: VistaConfig) => void
    onToast: (m: string) => void
    // Modo restringido: usado por PlantillasConfig.tsx para editar SOLO
    // anuncio/hero/confianza mientras una plantilla de Home está activa —
    // los mismos heroSlides/statsBar/shippingText de siempre (no hay un JSON
    // aparte por plantilla), pero sin exponer marca/colores/tipografía/layout
    // (esos los gestiona la plantilla, no el dueño, mientras esté puesta) ni
    // el gate de "Apariencia bloqueada" (este ES el lugar habilitado para
    // editar ese contenido con la plantilla activa).
    soloContenido?: boolean
}

// Editando una plantilla activa (soloContenido): antes esto era una grilla de
// dos columnas desparejas —Hero solo a la izquierda, Header + cinco tarjetas
// más apiladas a la derecha— así que apenas el Hero se quedaba sin contenido
// la columna izquierda quedaba en blanco mientras la derecha seguía sola
// varias pantallas más (pedido explícito del dueño, con capturas: "se feo
// todo asi en dos columnas, requiere mucho scroll igual"). Con pestañas cada
// vista muestra solo lo suyo, en una columna prolija — mismo patrón
// `role="tablist"` que ya usa JuegosConfig.tsx/ClienteDetalle.tsx.
type TabPlantilla = 'hero' | 'header' | 'secciones' | 'contenido' | 'pie'
// "Secciones" solo aparece si la plantilla activa declaró las suyas (ver
// plantillas/secciones.ts): son las que ninguna otra plantilla tiene, así que
// la pestaña no existe para las que todavía no las declararon.
const TABS_PLANTILLA: [TabPlantilla, string][] = [
    ['hero', 'Hero'],
    ['header', 'Header'],
    ['secciones', 'Secciones'],
    ['contenido', 'Contenido'],
    ['pie', 'Pie de página'],
]

export default function Apariencia({ ir, onToast, soloContenido = false }: AparienciaProps) {
    const {
        ap, set, actualizar, dirty, publicado, cargando, errorCarga, categorias, productos,
        guardando, errorGuardado, homeTemplate, setHomeTemplateLocal, subdomain, guardar, descartar,
    } = useApariencia(onToast)
    const [fullPreview, setFullPreview] = useState(false)

    // Tope de slides del hero de la plantilla activa (ver heroMaxSlides en
    // tipos.ts) — undefined = sin tope. Sin sentido fuera de soloContenido,
    // que es donde homeTemplate representa una plantilla realmente puesta.
    const heroMax = soloContenido ? PLANTILLAS.find(x => x.id === homeTemplate)?.heroMaxSlides : undefined
    // Escaparate (heroPropio): sus "campañas" son posiciones FIJAS del hero
    // (izquierda/derecha), no un carrusel que rota — a diferencia de Vidriera
    // (heroGrande), que sí usa el HeroCarousel genérico con N slides. Sirve
    // para no llamarlo "slider"/"carrusel" en la UI de una plantilla cuyo
    // diseño no contempla eso (pedido explícito, con capturas de la maqueta
    // original: dos imágenes fijas, nunca rotando).
    const heroNoRotativo = soloContenido && !!PLANTILLAS.find(x => x.id === homeTemplate)?.heroPropio
    // Escaparate (o cualquier plantilla que declare headerBold): el toggle
    // de "ícono de marca" solo tiene sentido ahí — las demás siempre
    // muestran el ícono, sin leer este campo (ver StorefrontChrome.tsx).
    const conIconoOpcional = soloContenido && !!PLANTILLAS.find(x => x.id === homeTemplate)?.headerBold
    // Las secciones propias de la plantilla activa, en el orden en que se ven
    // en la portada (lo define cada plantilla en secciones.ts).
    const seccionesPlantilla = soloContenido ? seccionesDe(homeTemplate) : []
    // Pestaña activa del editor de plantilla (ver TABS_PLANTILLA) — sin uso
    // fuera de soloContenido.
    const [tabPlantilla, setTabPlantilla] = useState<TabPlantilla>('hero')

    const enlaces = enlacesHeader(ap, categorias, set)

    // Editando una plantilla, solo se ofrece lo que ESA plantilla dibuja de
    // verdad. El anuncio de Apariencia no se ve en las que traen su propio
    // cintillo o cartel corriendo (`headerPropio` — ver StorefrontChrome, que
    // apaga el banner ahí), y la barra de estadísticas no se ve en las que
    // tienen su propia franja (`usaStats: false`: las tres promesas de
    // Premium, los números de Nocturno, los sellos de Glow). Ofrecerlos igual
    // era prometer un interruptor que no mueve nada (reportado con captura
    // sobre Premium).
    const plantillaActiva = soloContenido ? PLANTILLAS.find(x => x.id === homeTemplate) : undefined
    const usaAnuncio = soloContenido ? !plantillaActiva?.headerPropio : true
    const usaStats = soloContenido ? plantillaActiva?.usaStats !== false : true

    const toggles: [keyof Ap, string][] = soloContenido
        ? ([
            ...(usaAnuncio ? [['mostrarBannerEnvio', 'Anuncio arriba del header'] as [keyof Ap, string]] : []),
            ...(usaStats ? [['mostrarStats', 'Barra de confianza debajo del hero'] as [keyof Ap, string]] : []),
        ])
        // `mostrarFooter`/`mostrarRedesFooter` viven en la nueva sección
        // "Pie de página" (tienen su propia tarjeta ahí, con la descripción
        // debajo del logo), no acá mezclados con el resto de la visibilidad.
        : [['mostrarResenas', 'Opiniones de clientes'], ['mostrarBadgeNuevo', 'Badge "Nuevo"'], ['mostrarBadgeOferta', 'Badge "Oferta" con %'], ['mostrarStockBajo', 'Indicador de stock bajo'], ['mostrarWhatsapp', 'WhatsApp flotante'], ['mostrarBuscador', 'Barra de búsqueda'], ['mostrarCategorias', 'Sección de categorías'], ['mostrarBannerEnvio', 'Banner debajo del header'], ['mostrarStats', 'Barra de estadísticas debajo del slider']]

    // Tarjetas que se ven IGUAL con o sin plantilla activa (a diferencia de
    // Identidad/Paleta/Tipografía/Diseño, que solo tiene sentido tocar sin
    // plantilla — eso lo dibuja ella). Piezas sueltas (no un solo bloque):
    // en Apariencia completa fluyen todas juntas en la columna de controles
    // (ver `tarjetasSecundarias` más abajo); editando una plantilla activa
    // cada una vive en la pestaña que le corresponde (ver TABS_PLANTILLA),
    // para no volver a apilarlas todas de una en una sola columna larga.
    const secVisibilidad = <SeccionVisibilidad ap={ap} set={set} soloContenido={soloContenido} toggles={toggles} />
    const secTextos = <SeccionTextos ap={ap} set={set} soloContenido={soloContenido} />
    const secEstadisticas = <SeccionEstadisticas ap={ap} set={set} />
    const secPie = <SeccionPie ap={ap} set={set} />
    // El cupón es contenido de la PLANTILLA: solo si la activa declara uno.
    const secCupon = plantillaActiva?.cupon ? <SeccionCupon ap={ap} set={set} /> : null

    // Usada tal cual solo en Apariencia completa (ver el único lugar que la
    // usa, más abajo en el return) — editando una plantilla, las mismas
    // piezas de arriba se reparten entre pestañas en vez de venir juntas.
    const tarjetasSecundarias = (
        <>
            <div>{secVisibilidad}{secTextos}</div>
            {secEstadisticas}
            {secPie}
            {secCupon}
        </>
    )

    const heroCard = <SeccionHero ap={ap} set={set} soloContenido={soloContenido} heroMax={heroMax} heroNoRotativo={heroNoRotativo} onToast={onToast} />
    const seccionesCards = <SeccionesPlantilla ap={ap} set={set} seccionesPlantilla={seccionesPlantilla} categorias={categorias} productos={productos} onToast={onToast} />
    const headerCard = <SeccionHeaderPlantilla ap={ap} set={set} conIconoOpcional={conIconoOpcional} enlaces={enlaces} />

    // Las pestañas que esta plantilla en particular tiene algo que mostrar:
    // "Secciones" solo si declaró las suyas, "Contenido" solo si le queda
    // algún interruptor que de verdad mueva algo en su portada.
    const tabsVisibles = TABS_PLANTILLA.filter(([k]) => {
        if (k === 'secciones') return seccionesPlantilla.length > 0
        if (k === 'contenido') return usaAnuncio || usaStats
        return true
    })
    // Si la pestaña elegida no está entre las visibles (cambió la plantilla
    // activa, o esta no la tiene), se cae a la primera en vez de dejar el
    // formulario en blanco.
    const tabActiva: TabPlantilla = tabsVisibles.some(([k]) => k === tabPlantilla)
        ? tabPlantilla
        : (tabsVisibles[0]?.[0] ?? 'hero')

    if (cargando) {
        return <AparienciaSkeleton />
    }

    if (homeTemplate && !soloContenido) {
        return <AparienciaBloqueada homeTemplate={homeTemplate} onVolvio={() => setHomeTemplateLocal(null)} onToast={onToast} />
    }

    return (
        // Editando una plantilla (soloContenido) es un FORMULARIO de una sola
        // columna con tabs — no un editor con vista previa al lado — así que
        // usa el ancho angosto de "panel-page--form" (880px, ver globals.css),
        // no los 1760px de "panel-page--editor" que dejaban el formulario
        // apretado contra el borde izquierdo con medio kilómetro de aire a la
        // derecha (bug real, reportado: "se ve feo, requiere mucho scroll").
        <div className={`ap-page panel-page ${soloContenido ? 'panel-page--form' : 'panel-page--editor'}`}>
            <EncabezadoApariencia
                soloContenido={soloContenido}
                errorCarga={errorCarga}
                categorias={categorias}
                productos={productos}
                dirty={dirty}
                guardando={guardando}
                errorGuardado={errorGuardado}
                onGuardar={guardar}
                onVistaPrevia={() => setFullPreview(true)}
            />

            <style>{ESTILOS_APARIENCIA}</style>
            {soloContenido ? (
                // Editando una plantilla activa: un formulario de una sola
                // columna con pestañas — antes esto era la mitad izquierda
                // de una grilla de dos columnas desparejas (ver el porqué del
                // cambio en el comentario de TABS_PLANTILLA, arriba).
                <div>
                    <div className="ap-tabs-plantilla" role="tablist" aria-label="Secciones de la plantilla">
                        {tabsVisibles.map(([k, l]) => {
                            const a = tabActiva === k
                            return (
                                <button
                                    key={k}
                                    className="ap-tab-plantilla"
                                    onClick={() => setTabPlantilla(k)}
                                    role="tab"
                                    aria-selected={a}
                                    style={{
                                        color: a ? 'var(--color-primary)' : 'var(--color-muted)',
                                        fontWeight: a ? 600 : 500,
                                        borderBottomColor: a ? 'var(--color-primary)' : 'transparent',
                                    }}
                                >
                                    {l}
                                </button>
                            )
                        })}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                        {tabActiva === 'hero' && heroCard}
                        {tabActiva === 'header' && headerCard}
                        {tabActiva === 'secciones' && seccionesCards}
                        {tabActiva === 'contenido' && <>
                            {toggles.length > 0 && secVisibilidad}
                            {usaAnuncio && secTextos}
                            {usaStats && secEstadisticas}
                        </>}
                        {tabActiva === 'pie' && <>{secPie}{secCupon}</>}
                    </div>
                </div>
            ) : (
            <div className="ap-split">
                {/* Controles */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

                    {heroCard}

                    <SeccionPaleta ap={ap} set={set} />
                    <SeccionTipografia ap={ap} set={set} />
                    <SeccionLayout ap={ap} set={set} actualizar={actualizar} enlaces={enlaces} categorias={categorias} />
                    <SeccionParallax ap={ap} set={set} onToast={onToast} />
                    <SeccionMarcas ap={ap} set={set} onToast={onToast} />
                    <SeccionVideo ap={ap} set={set} onToast={onToast} />
                    <SeccionWhatsapp ap={ap} set={set} />

                    {tarjetasSecundarias}

                </div>

                <div className="ap-preview">
                    <StorePreview ap={ap} publicado={dirty ? publicado : null} subdomain={subdomain} />
                </div>
            </div>
            )}

            {fullPreview && !soloContenido && (
                <VistaPreviaCompleta ap={ap} publicado={dirty ? publicado : null} subdomain={subdomain} onCerrar={() => setFullPreview(false)} />
            )}

            {dirty && !fullPreview && (
                <BarraGuardado guardando={guardando} errorGuardado={errorGuardado} puedeDescartar={!!publicado} onDescartar={descartar} onGuardar={guardar} />
            )}
        </div>
    )
}
