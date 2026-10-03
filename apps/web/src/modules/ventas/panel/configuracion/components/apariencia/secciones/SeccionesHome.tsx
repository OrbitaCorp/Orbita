// Las secciones propias del home clásico: banner parallax, tira de marcas,
// videos y banner de WhatsApp. No se muestran con una plantilla activa.

import { BadgeCheck, Image as ImageIcon, MessageCircle, Plus, Trash2, Video } from 'lucide-react'
import { VIDEO_LAYOUTS, WHATSAPP_LAYOUTS, type VideoLayout, type WhatsappLayout } from '../../../mock/apariencia.mock'
import { AYUDA_SECCIONES } from '../ayudas'
import { Divider, FieldLabel, Inp, SecCard, ToggleRow } from '../Controles'
import { EditorVideos } from '../EditorVideos'
import { ImgUploader } from '../ImgUploader'
import { LogoPicker } from '../LogoPicker'
import { VisualPick } from '../VisualPick'
import { MINIATURA_VIDEO, MINIATURA_WHATSAPP } from '../miniaturas'
import { subirImagenApariencia, type PropsSeccion } from '../utils'

type PropsConToast = PropsSeccion & { onToast: (m: string) => void }

/* Banner con imagen de fondo fija (efecto parallax) en medio
    del home clásico — pedido explícito del dueño, con una
    tienda de referencia. Autocontenida (imagen + textos +
    su propio on/off) en vez de repartir el toggle en
    "¿Qué ven tus clientes?" y el contenido acá: mismo
    criterio que el Hero, es un bloque rico que no tiene
    sentido a medias. No aplica con una plantilla de Home
    activa (por eso vive acá, no en `tarjetasSecundarias`):
    mismo motivo que Paleta/Tipografía/Diseño, la portada
    de la plantilla es asunto suyo. */
export function SeccionParallax({ ap, set, onToast }: PropsConToast) {
    return (
        <SecCard id="ap-sec-parallax" title="Banner con efecto parallax" icon={ImageIcon} ayuda={AYUDA_SECCIONES.parallax}>
            <p style={{ fontSize: 12, color: 'var(--color-muted)', margin: '0 0 14px' }}>
                Una imagen grande a todo el ancho, en medio del home, que queda fija mientras el resto de la
                página se desplaza. Necesita una imagen cargada para mostrarse.
            </p>
            <div style={{ marginBottom: 14 }}>
                <ToggleRow label="Mostrar este banner en el home" on={ap.mostrarParallax} onChange={v => set('mostrarParallax', v)} />
            </div>
            <Divider />
            <FieldLabel help="Foto ancha y de buena resolución — se recomienda al menos 1600×900px.">Imagen de fondo</FieldLabel>
            <ImgUploader value={ap.parallaxImagen} onChange={v => set('parallaxImagen', v)} onUpload={subirImagenApariencia} shape="square" size={80} formats="JPG, PNG o HEIC · máx 10MB" onToast={onToast} />
            <Divider />
            <div style={{ marginBottom: 10 }}><FieldLabel>Título</FieldLabel><Inp value={ap.parallaxTitulo} onChange={v => set('parallaxTitulo', v)} /></div>
            <div style={{ marginBottom: 10 }}><FieldLabel>Subtítulo</FieldLabel><Inp value={ap.parallaxSubtitulo} onChange={v => set('parallaxSubtitulo', v)} /></div>
            <div style={{ marginBottom: 10 }}><FieldLabel>Texto del botón</FieldLabel><Inp value={ap.parallaxCtaTexto} onChange={v => set('parallaxCtaTexto', v)} maxLength={30} /></div>
            <div>
                <FieldLabel help="A dónde lleva al hacer click. Ej: /catalogo, /catalogo/camperas, o una URL completa">Link del botón</FieldLabel>
                <Inp value={ap.parallaxCtaLink} onChange={v => set('parallaxCtaLink', v)} />
            </div>
        </SecCard>
    )
}

/* Tira de marcas con las que trabaja el negocio — pedido
    explícito del dueño, con una tienda de referencia (una
    relojería: EUROTIME / QYQ / G-SHOCK / CASIO en gris,
    y la de abajo del mouse a color). Va acá y no en
    `tarjetasSecundarias` por el mismo motivo que el
    parallax: es una sección del home CLÁSICO, y con una
    plantilla activa la portada es asunto de la plantilla.
    El logo es opcional a propósito (ver LogoPicker y
    brand-item.dto.ts): sin logo, la tira dibuja el nombre
    en tipografía, que es justo como se ve la referencia. */
export function SeccionMarcas({ ap, set, onToast }: PropsConToast) {
    return (
        <SecCard id="ap-sec-marcas" title="Marcas con las que trabajás" icon={BadgeCheck} ayuda={AYUDA_SECCIONES.marcas}>
            <p style={{ fontSize: 12, color: 'var(--color-muted)', margin: '0 0 14px' }}>
                Una tira que se desliza sola en el home, con las marcas que vendés. Se ven en gris y toman
                color cuando el visitante les pasa el mouse por encima. Necesita al menos una marca cargada
                para mostrarse.
            </p>
            <div style={{ marginBottom: 14 }}>
                <ToggleRow label="Mostrar esta sección en el home" on={ap.mostrarMarcas} onChange={v => set('mostrarMarcas', v)} />
            </div>
            <Divider />
            <FieldLabel help="El texto chiquito que va arriba de los logos.">Título de la sección</FieldLabel>
            <Inp value={ap.marcasTitulo} onChange={v => set('marcasTitulo', v)} maxLength={80} placeholder="Trabajamos con las mejores marcas" />
            <Divider />
            <FieldLabel help="El logo es opcional: sin logo se muestra el nombre escrito. El nombre siempre hace falta — es lo que leen los lectores de pantalla.">
                Marcas
            </FieldLabel>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
                {ap.marcas.map((m, i) => (
                    <div key={m.id} style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                        <LogoPicker
                            value={m.logo}
                            nombre={m.name}
                            onChange={v => set('marcas', ap.marcas.map((x, j) => j === i ? { ...x, logo: v } : x))}
                            onUpload={subirImagenApariencia}
                            onToast={onToast}
                        />
                        <div style={{ flex: 1, minWidth: 0 }}>
                            <Inp
                                value={m.name}
                                onChange={v => set('marcas', ap.marcas.map((x, j) => j === i ? { ...x, name: v } : x))}
                                maxLength={60}
                                placeholder="Nombre de la marca"
                            />
                        </div>
                        <button
                            onClick={() => set('marcas', ap.marcas.filter((_, j) => j !== i))}
                            title="Quitar"
                            aria-label={`Quitar ${m.name.trim() || 'esta marca'}`}
                            style={{ width: 32, height: 32, flexShrink: 0, borderRadius: 6, border: 'none', background: 'transparent', color: 'var(--color-muted)', cursor: 'pointer', display: 'grid', placeItems: 'center', transition: 'color 150ms, background 150ms' }}
                            onMouseEnter={e => { e.currentTarget.style.color = 'var(--color-error)'; e.currentTarget.style.background = 'var(--color-error-bg)' }}
                            onMouseLeave={e => { e.currentTarget.style.color = 'var(--color-muted)'; e.currentTarget.style.background = 'transparent' }}
                        >
                            <Trash2 size={14} />
                        </button>
                    </div>
                ))}
            </div>
            {/* Mismo tope que el DTO del backend (ArrayMaxSize(20)):
                si acá se pudieran cargar más, el guardado fallaría
                entero con un error de validación poco claro. */}
            {ap.marcas.length < 20 && (
                <button
                    onClick={() => set('marcas', [...ap.marcas, { id: 'mk' + Date.now(), name: '', logo: null }])}
                    className="ds-hover"
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, height: 40, borderRadius: 8, border: '1.5px dashed var(--color-border-strong)', background: 'transparent', color: 'var(--color-muted)', fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', width: '100%' }}
                >
                    <Plus size={14} strokeWidth={2} /> Agregar marca
                </button>
            )}
        </SecCard>
    )
}

/* Video en el home — pedido explícito del dueño: "después
    del efecto parallax, antes del pie". Un LINK, no una
    subida: Órbita no aloja video propio (ver
    parseVideoEmbed, lib/storefront/utils.ts, para el
    porqué y qué formas de link acepta). Mismo criterio
    autocontenido que parallax/marcas: on/off propio, y
    vive acá (no en `tarjetasSecundarias`) porque es del
    home CLÁSICO — con una plantilla activa, la portada es
    asunto de la plantilla. */
export function SeccionVideo({ ap, set, onToast }: PropsConToast) {
    return (
        <SecCard id="ap-sec-video" title="Video en tu tienda" icon={Video} ayuda={AYUDA_SECCIONES.video}>
            <p style={{ fontSize: 12, color: 'var(--color-muted)', margin: '0 0 14px' }}>
                Uno o varios videos en el home, después del banner parallax. Cada uno puede ser un link de
                YouTube o de Vimeo, o un archivo de video que subas. Necesita al menos un video válido para mostrarse.
            </p>
            <div style={{ marginBottom: 14 }}>
                <ToggleRow label="Mostrar esta sección en el home" on={ap.mostrarVideo} onChange={v => set('mostrarVideo', v)} />
            </div>
            <Divider />
            <div style={{ marginBottom: 10 }}><FieldLabel help="Va arriba de los videos. Opcional.">Título de la sección</FieldLabel><Inp value={ap.videoTitulo} onChange={v => set('videoTitulo', v)} maxLength={120} placeholder="Mirá cómo funciona" /></div>
            <div><FieldLabel>Bajada</FieldLabel><Inp value={ap.videoSubtitulo} onChange={v => set('videoSubtitulo', v)} maxLength={300} /></div>
            <Divider />
            <FieldLabel help="Cómo se acomodan los videos en el home.">Diseño</FieldLabel>
            <div style={{ marginBottom: 4 }}>
                <VisualPick
                    value={ap.videoLayout}
                    onChange={v => set('videoLayout', v as VideoLayout)}
                    options={VIDEO_LAYOUTS.map(op => ({ id: op.id, label: op.label, ayuda: op.desc, svg: MINIATURA_VIDEO[op.id] }))}
                />
            </div>
            <Divider />
            <EditorVideos videos={ap.videos} layout={ap.videoLayout} onChange={v => set('videos', v)} onToast={onToast} />
        </SecCard>
    )
}

/* Banner de WhatsApp — antes un solo diseño fijo (pedido
    explícito: variedad). El toggle sigue siendo
    "WhatsApp flotante" de "¿Qué ven tus clientes?"; acá
    solo se elige CÓMO se ve, por eso el picker se apaga
    (no se oculta) cuando ese interruptor está apagado. */
export function SeccionWhatsapp({ ap, set }: PropsSeccion) {
    return (
        <SecCard id="ap-sec-whatsapp" title="Banner de WhatsApp" icon={MessageCircle} ayuda={AYUDA_SECCIONES.whatsapp}>
            <p style={{ fontSize: 12, color: 'var(--color-muted)', margin: '0 0 14px' }}>
                La invitación a escribir por WhatsApp, justo antes del pie. Se muestra con &quot;WhatsApp
                flotante&quot; prendido (en &quot;¿Qué ven tus clientes?&quot;) y un número real cargado en
                Configuración → Contacto.
            </p>
            <div style={{ opacity: ap.mostrarWhatsapp ? 1 : 0.5, pointerEvents: ap.mostrarWhatsapp ? 'auto' : 'none' }}>
                <FieldLabel help="Cómo se ve la invitación a escribir por WhatsApp.">Diseño</FieldLabel>
                <VisualPick
                    value={ap.estiloWhatsapp}
                    onChange={v => set('estiloWhatsapp', v as WhatsappLayout)}
                    options={WHATSAPP_LAYOUTS.map(op => ({ id: op.id, label: op.label, ayuda: op.desc, svg: MINIATURA_WHATSAPP[op.id] }))}
                />
            </div>
        </SecCard>
    )
}
