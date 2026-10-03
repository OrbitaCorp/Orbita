// Las tarjetas de contenido que se ven igual con o sin plantilla activa:
// textos, barra de estadísticas, pie de página y cupón.

import { AlignLeft, Hash, PanelBottom, Plus, Ticket, Trash2 } from 'lucide-react'
import { AYUDA_SECCIONES, AYUDA_OPCIONES } from '../ayudas'
import { FieldLabel, Inp, SecCard, ToggleRow } from '../Controles'
import type { PropsSeccion } from '../utils'

export function SeccionTextos({ ap, set, soloContenido }: PropsSeccion & { soloContenido: boolean }) {
    return (
        <SecCard id="ap-sec-textos" title="Textos de tu tienda" icon={AlignLeft} ayuda={AYUDA_SECCIONES.textos}>
            {/* Varios ítems en el mismo campo (textoEnvio), uno por línea:
                ver mensajesAnuncio() en AnnouncementBar.tsx. El tope de 200
                caracteres es el del backend (shippingText), contando los
                saltos de línea. */}
            <div style={{ marginBottom: 6 }}>
                <FieldLabel help="Se muestra en el banner angosto debajo del header, si está activado en '¿Qué ven tus clientes?'. Podés cargar varios ítems: con la cartelera se deslizan uno tras otro, y fijo van rotando.">Mensajes del banner debajo del header</FieldLabel>
                {(() => {
                    const items = ap.textoEnvio.split('\n')
                    const guardar = (n: string[]) => set('textoEnvio', n.join('\n'))
                    return (
                        <>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 8 }}>
                                {items.map((t, i) => (
                                    <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <Inp value={t} onChange={v => guardar(items.map((x, j) => j === i ? v : x))} maxLength={Math.max(t.length, 200 - (ap.textoEnvio.length - t.length))} />
                                        </div>
                                        {items.length > 1 && (
                                            <button
                                                onClick={() => guardar(items.filter((_, j) => j !== i))}
                                                title="Quitar"
                                                style={{ width: 32, height: 32, flexShrink: 0, borderRadius: 6, border: 'none', background: 'transparent', color: 'var(--color-muted)', cursor: 'pointer', display: 'grid', placeItems: 'center', transition: 'color 150ms, background 150ms' }}
                                                onMouseEnter={e => { e.currentTarget.style.color = 'var(--color-error)'; e.currentTarget.style.background = 'var(--color-error-bg)' }}
                                                onMouseLeave={e => { e.currentTarget.style.color = 'var(--color-muted)'; e.currentTarget.style.background = 'transparent' }}
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        )}
                                    </div>
                                ))}
                            </div>
                            {items.length < 5 && ap.textoEnvio.length < 200 && (
                                <button
                                    onClick={() => guardar([...items, ''])}
                                    className="ds-hover"
                                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, height: 40, borderRadius: 8, border: '1.5px dashed var(--color-border-strong)', background: 'transparent', color: 'var(--color-muted)', fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', width: '100%' }}
                                >
                                    <Plus size={14} strokeWidth={2} /> Agregar ítem
                                </button>
                            )}
                        </>
                    )
                })()}
            </div>
            {/* Pedido explícito del dueño: que el banner se pueda
                mostrar como cartelera (se desliza en loop) en vez
                de quedarse fijo centrado — mandó de referencia
                una tienda con "3X1 + ENVÍO GRATIS" corriendo.
                Deshabilitado (no oculto) si el banner está
                apagado: así se ve que existe la opción, sin
                confundir con "¿por qué no aparece?". */}
            <div style={{ marginBottom: soloContenido ? 0 : 14, opacity: ap.mostrarBannerEnvio ? 1 : 0.5, pointerEvents: ap.mostrarBannerEnvio ? 'auto' : 'none' }}>
                <ToggleRow label="Mostrar como cartelera (se desliza)" on={ap.bannerDesplazable} onChange={v => set('bannerDesplazable', v)} ayuda={AYUDA_OPCIONES.bannerDesplazable} />
            </div>
            {/* Decía "Texto del botón de WhatsApp", y no es eso: el botón
                flotante es solo el ícono verde, sin texto (ver
                FloatingWhatsapp.tsx). Esto es el mensaje que queda YA ESCRITO
                en el chat cuando el cliente lo toca — vacío, WhatsApp abre
                con "Hola! Quería hacer una consulta.". */}
            {!soloContenido && <div><FieldLabel help="El mensaje que aparece ya escrito en el chat cuando tu cliente toca el botón de WhatsApp. Él lo puede borrar o cambiar antes de enviarlo.">Mensaje del botón de WhatsApp</FieldLabel><Inp value={ap.textoWhatsapp} onChange={v => set('textoWhatsapp', v)} maxLength={30} /></div>}
        </SecCard>
    )
}

export function SeccionEstadisticas({ ap, set }: PropsSeccion) {
    return (
        <SecCard id="ap-sec-estadisticas" title="Barra de estadísticas" icon={Hash} ayuda={AYUDA_SECCIONES.estadisticas}>
            <p style={{ fontSize: 12, color: 'var(--color-muted)', margin: '0 0 12px' }}>
                Aparece debajo del slider del hero, si está activada en "¿Qué ven tus clientes?". Son valores decorativos que escribís vos, no se calculan solos.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
                {ap.stats.map((s, i) => (
                    <div key={s.id} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <div className="ap-stat-val" style={{ width: 100, flexShrink: 0 }}>
                            <Inp value={s.value} onChange={v => set('stats', ap.stats.map((x, j) => j === i ? { ...x, value: v } : x))} maxLength={12} />
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                            <Inp value={s.label} onChange={v => set('stats', ap.stats.map((x, j) => j === i ? { ...x, label: v } : x))} maxLength={30} />
                        </div>
                        <button
                            onClick={() => set('stats', ap.stats.filter((_, j) => j !== i))}
                            title="Quitar"
                            style={{ width: 32, height: 32, flexShrink: 0, borderRadius: 6, border: 'none', background: 'transparent', color: 'var(--color-muted)', cursor: 'pointer', display: 'grid', placeItems: 'center', transition: 'color 150ms, background 150ms' }}
                            onMouseEnter={e => { e.currentTarget.style.color = 'var(--color-error)'; e.currentTarget.style.background = 'var(--color-error-bg)' }}
                            onMouseLeave={e => { e.currentTarget.style.color = 'var(--color-muted)'; e.currentTarget.style.background = 'transparent' }}
                        >
                            <Trash2 size={14} />
                        </button>
                    </div>
                ))}
            </div>
            {ap.stats.length < 6 && (
                <button
                    onClick={() => set('stats', [...ap.stats, { id: 'st' + Date.now(), value: '', label: '' }])}
                    className="ds-hover"
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, height: 40, borderRadius: 8, border: '1.5px dashed var(--color-border-strong)', background: 'transparent', color: 'var(--color-muted)', fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', width: '100%' }}
                >
                    <Plus size={14} strokeWidth={2} /> Agregar estadística
                </button>
            )}
        </SecCard>
    )
}

// Pie de página — la descripción vive en el MISMO campo que antes era
// "Tagline" de Identidad de marca (ap.tagline): es lo único que la usa en
// todo el storefront (ver StorefrontFooter, el párrafo debajo del logo).
// Estaba mal ubicada — nada en esa pantalla decía que era justo eso lo
// que se veía ahí abajo — así que se mudó acá, con el nombre y el
// ayuda-texto que sí lo dicen, junto a los dos toggles de footer que
// antes estaban sueltos dentro de "¿Qué ven tus clientes?". Sin gate de
// soloContenido: el pie de página es el MISMO en cualquier plantilla
// (Inicio.tsx lo dibuja aparte del home, no lo arma la plantilla) — a
// diferencia de Identidad/Paleta/Tipografía/Diseño, acá sí tiene sentido
// seguir editando aunque haya una plantilla activa.
// El pie de página no se puede apagar: lleva Términos y condiciones, Política de
// privacidad y el acceso a devoluciones. Por eso no hay interruptor acá.
export function SeccionPie({ ap, set }: PropsSeccion) {
    return (
        <SecCard id="ap-sec-pie" title="Pie de página" icon={PanelBottom} ayuda={AYUDA_SECCIONES.pie}>
            <div style={{ marginBottom: 14 }}>
                <FieldLabel help="Aparece debajo de tu logo, en el pie de página de la tienda.">Descripción</FieldLabel>
                <Inp value={ap.tagline} onChange={v => set('tagline', v)} maxLength={160} suffix={<span style={{ fontSize: 11, color: 'var(--color-subtle)', fontFamily: '"Geist Mono", monospace' }}>{ap.tagline.length}/160</span>} />
            </div>
            <ToggleRow label="Redes sociales en el pie de página" on={ap.mostrarRedesFooter} onChange={v => set('mostrarRedesFooter', v)} ayuda={AYUDA_OPCIONES.mostrarRedesFooter} />
        </SecCard>
    )
}

// Cupón — es contenido de la PLANTILLA, no de la tienda: solo aparece
// editando la plantilla activa (soloContenido) y solo si esa plantilla
// declara una sección de cupón en sus datos. Una plantilla futura que no
// la tenga no muestra esta tarjeta, y una que sí la tenga la muestra
// sola — sin tocar este archivo.
export function SeccionCupon({ ap, set }: PropsSeccion) {
    return (
        <SecCard id="ap-sec-cupon" title="Cupón" icon={Ticket} ayuda={AYUDA_SECCIONES.cupon}>
            <p style={{ fontSize: 12, color: 'var(--color-muted)', margin: '0 0 12px' }}>
                El bloque oscuro con el código, cerca del final del home. Dejá el código vacío para no mostrarlo.
            </p>
            <div style={{ marginBottom: 10 }}>
                <FieldLabel>Título</FieldLabel>
                <Inp value={ap.cupon.titulo} onChange={v => set('cupon', { ...ap.cupon, titulo: v })} maxLength={60} />
            </div>
            <div style={{ marginBottom: 10 }}>
                <FieldLabel help="La línea chica debajo del título — sirve para aclarar condiciones.">Aclaración</FieldLabel>
                <Inp value={ap.cupon.bajada} onChange={v => set('cupon', { ...ap.cupon, bajada: v })} maxLength={140} />
            </div>
            <div>
                <FieldLabel help="El código que tus clientes escriben al pagar. Tiene que existir en Cupones para que funcione de verdad.">Código</FieldLabel>
                <Inp value={ap.cupon.codigo} onChange={v => set('cupon', { ...ap.cupon, codigo: v })} maxLength={24} />
            </div>
        </SecCard>
    )
}
