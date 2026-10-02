// Las miniaturas SVG de los selectores visuales (VisualPick) de Apariencia.

import type { ReactNode } from 'react'
import type { MarcaModo } from '@/components/storefront/marca'
import type { CategoryLayout as CategoryLayoutT, VideoLayout, WhatsappLayout, ImageOverlay, BgPattern } from '../../mock/apariencia.mock'

export function hline(c: ReactNode) {
    return <svg width="60" height="34" viewBox="0 0 60 34">{c}</svg>
}

// Miniaturas de la marca del header (ver components/storefront/marca.tsx): el
// logo va en el color primario, el texto en gris — se lee de un vistazo qué
// muestra cada opción y dónde. Mismos tokens que el resto de los pickers.
export function miniMarca(modo: MarcaModo, estilo: string): ReactNode {
    const logo = 'var(--color-primary)'
    const txt  = 'var(--color-muted)'
    const barra = (x: number, y: number, w: number, h = 4) => <rect x={x} y={y} width={w} height={h} rx={h / 2} fill={txt} />
    if (modo === 'logo') {
        if (estilo === 'grande')  return hline(<rect x="12" y="8" width="36" height="18" rx="3" fill={logo} />)
        if (estilo === 'redondo') return hline(<circle cx="30" cy="17" r="9" fill={logo} />)
        return hline(<rect x="21" y="8" width="18" height="18" rx="4" fill={logo} />)
    }
    if (modo === 'nombre') {
        if (estilo === 'mayusculas') return hline(barra(10, 12, 40, 10))
        if (estilo === 'espaciado')  return hline(<g>{[0, 1, 2, 3, 4, 5].map(i => <rect key={i} x={9 + i * 8.5} y="14" width="4.5" height="6" rx="1" fill={txt} />)}</g>)
        if (estilo === 'italica')    return hline(<polygon points="12,22 16,11 50,11 46,22" fill={txt} />)
        return hline(barra(10, 13, 40, 8))
    }
    if (estilo === 'redondo')   return hline(<g><circle cx="12" cy="17" r="7" fill={logo} />{barra(23, 15, 30)}</g>)
    if (estilo === 'apilado')   return hline(<g><rect x="25" y="4" width="10" height="14" rx="3" fill={logo} />{barra(19, 22, 22, 3)}</g>)
    if (estilo === 'espaciado') return hline(<g><rect x="5" y="10" width="14" height="14" rx="3" fill={logo} /><rect x="24" y="8" width="1.5" height="18" fill="var(--color-border-strong)" />{barra(30, 15, 25, 3)}</g>)
    return hline(<g><rect x="5" y="10" width="14" height="14" rx="3" fill={logo} />{barra(24, 15, 30)}</g>)
}

// Miniaturas de los 6 estilos de la sección de categorías. Cada una tiene que
// leerse como el LAYOUT que representa de un vistazo, sin texto: el círculo
// del medallón, el filete del índice, el bloque grande del mosaico. Los
// rellenos van con los tokens del tema para que funcionen en claro y oscuro.
export const MINIATURA_CATEGORIA: Record<CategoryLayoutT, ReactNode> = {
    // Pastillas: cápsulas con un punto (el ícono) adentro.
    pills: hline(<g>
        {[2, 22, 42].map(x => <g key={x}>
            <rect x={x} y="12" width="17" height="11" rx="5.5" fill="none" stroke="var(--color-border)" strokeWidth="1.5" />
            <circle cx={x + 5.5} cy="17.5" r="2.6" fill="var(--color-primary)" />
            <rect x={x + 10} y="15.5" width="5" height="2" rx="1" fill="var(--color-muted)" />
        </g>)}
    </g>),
    // Índice: dos columnas de renglones grandes con filete debajo.
    indice: hline(<g>
        {[9, 19, 29].map(y => <g key={y}>
            <rect x="4" y={y - 4} width="17" height="3.5" rx="1.5" fill="var(--color-text)" />
            <rect x="4" y={y} width="24" height="1" fill="var(--color-border)" />
            <rect x="33" y={y - 4} width="14" height="3.5" rx="1.5" fill="var(--color-text)" />
            <rect x="33" y={y} width="24" height="1" fill="var(--color-border)" />
        </g>)}
    </g>),
    // Etiquetas: cápsulas chicas, sin ícono, en una línea.
    chips: hline(<g>
        {[3, 19, 32, 47].map((x, i) => (
            <rect key={x} x={x} y="14" width={i === 1 ? 11 : 13} height="7" rx="3.5" fill="none" stroke="var(--color-border)" strokeWidth="1.5" />
        ))}
    </g>),
    // Mosaico: un bloque grande a la izquierda y cuatro chicos a la derecha.
    mosaico: hline(<g>
        <rect x="4" y="6" width="24" height="22" rx="3" fill="var(--color-primary)" opacity="0.75" />
        {[[30, 6], [44, 6], [30, 18], [44, 18]].map(([x, y]) => (
            <rect key={`${x}-${y}`} x={x} y={y} width="12" height="10" rx="2.5" fill="var(--color-border)" />
        ))}
    </g>),
    // Tarjetas: cuatro cuadrados iguales con un renglón de texto debajo.
    tarjetas: hline(<g>
        {[4, 18, 32, 46].map(x => <g key={x}>
            <rect x={x} y="6" width="11" height="11" rx="2.5" fill="var(--color-border)" />
            <rect x={x} y="20" width="8" height="2.5" rx="1.25" fill="var(--color-muted)" />
        </g>)}
    </g>),
    // Círculos: medallones redondos con el nombre debajo.
    circulos: hline(<g>
        {[9, 24, 39, 54].map(cx => <g key={cx}>
            <circle cx={cx} cy="13" r="6" fill="var(--color-primary)" opacity="0.7" />
            <rect x={cx - 4.5} y="23" width="9" height="2.5" rx="1.25" fill="var(--color-muted)" />
        </g>)}
    </g>),
}

// Miniaturas de los 4 diseños de la sección de video — mismo criterio que
// las de categorías: que se lea el layout sin texto. El triangulito es el
// play; el bloque primario, el video.
function miniVideo(x: number, y: number, w: number, h: number, key?: string) {
    const cx = x + w / 2, cy = y + h / 2, t = Math.min(w, h) * 0.18
    return <g key={key}>
        <rect x={x} y={y} width={w} height={h} rx="2.5" fill="var(--color-primary)" opacity="0.75" />
        <path d={`M${cx - t * 0.6} ${cy - t} L${cx + t} ${cy} L${cx - t * 0.6} ${cy + t} Z`} fill="var(--color-bg)" />
    </g>
}
export const MINIATURA_VIDEO: Record<VideoLayout, ReactNode> = {
    // Grande: un video a lo ancho y el título debajo.
    cine: hline(<g>
        {miniVideo(8, 3, 44, 22)}
        <rect x="8" y="28" width="20" height="2.5" rx="1.25" fill="var(--color-muted)" />
    </g>),
    // Alternado: dos filas, el video cambia de lado.
    alternado: hline(<g>
        {miniVideo(4, 2, 24, 14, 'a')}
        <rect x="32" y="6" width="18" height="2.5" rx="1.25" fill="var(--color-text)" />
        <rect x="32" y="10.5" width="22" height="2" rx="1" fill="var(--color-border)" />
        <rect x="6" y="22" width="18" height="2.5" rx="1.25" fill="var(--color-text)" />
        <rect x="6" y="26.5" width="22" height="2" rx="1" fill="var(--color-border)" />
        {miniVideo(32, 18, 24, 14, 'b')}
    </g>),
    // Verticales: cuatro rectángulos parados.
    reels: hline(<g>
        {[5, 19, 33, 47].map(x => miniVideo(x, 3, 11, 25, String(x)))}
    </g>),
    // Con lista: uno grande a la izquierda y renglones a la derecha.
    lista: hline(<g>
        {miniVideo(3, 5, 34, 20)}
        {[6, 13, 20].map(y => <g key={y}>
            <rect x="40" y={y} width="7" height="5" rx="1" fill="var(--color-border)" />
            <rect x="49" y={y + 1.5} width="9" height="2" rx="1" fill="var(--color-muted)" />
        </g>)}
    </g>),
}

// Miniaturas de los 4 diseños del banner de WhatsApp — mismo criterio que
// las de video: se lee el LAYOUT (tarjeta grande + chat, línea sobria,
// franja, dos tarjetas), no el contenido real.
export const MINIATURA_WHATSAPP: Record<WhatsappLayout, ReactNode> = {
    // Clásico: bloque grande a la izquierda (tarjeta) y dos burbujas de
    // chat a la derecha.
    clasico: hline(<g>
        <rect x="2" y="3" width="35" height="28" rx="3" fill="var(--color-primary)" opacity="0.8" />
        <rect x="7" y="9" width="22" height="3" rx="1.5" fill="var(--color-bg)" />
        <rect x="7" y="15.5" width="16" height="2" rx="1" fill="var(--color-bg)" opacity="0.6" />
        <rect x="7" y="22" width="14" height="6" rx="3" fill="var(--color-bg)" />
        <rect x="41" y="6" width="14" height="7" rx="3.5" fill="var(--color-border)" />
        <rect x="45" y="18" width="13" height="7" rx="3.5" fill="var(--color-primary)" opacity="0.5" />
    </g>),
    // Sobrio: un círculo (ícono), dos renglones de texto y un botón chico,
    // todo en una fila con aire alrededor.
    minimal: hline(<g>
        <circle cx="9" cy="17" r="6" fill="var(--color-primary)" opacity="0.75" />
        <rect x="21" y="12.5" width="20" height="3" rx="1.5" fill="var(--color-text)" />
        <rect x="21" y="19" width="14" height="2" rx="1" fill="var(--color-border)" />
        <rect x="46" y="13" width="11" height="7" rx="3.5" fill="none" stroke="var(--color-border)" strokeWidth="1.5" />
    </g>),
    // Franja: una barra angosta a todo el ancho, con ícono y botón adentro.
    franja: hline(<g>
        <rect x="2" y="13" width="56" height="10" rx="5" fill="var(--color-primary)" opacity="0.75" />
        <circle cx="10" cy="18" r="3" fill="var(--color-bg)" />
        <rect x="17" y="16.5" width="20" height="3" rx="1.5" fill="var(--color-bg)" opacity="0.85" />
        <rect x="46" y="15.5" width="9" height="5" rx="2.5" fill="var(--color-bg)" />
    </g>),
    // Dos tarjetas: un bloque sólido (la consulta) y uno con borde (el
    // horario), del mismo tamaño, lado a lado.
    bento: hline(<g>
        <rect x="2" y="4" width="27" height="26" rx="3" fill="var(--color-primary)" opacity="0.8" />
        <rect x="7" y="11" width="16" height="3" rx="1.5" fill="var(--color-bg)" />
        <rect x="7" y="21" width="11" height="5" rx="2.5" fill="var(--color-bg)" />
        <rect x="32" y="4" width="26" height="26" rx="3" fill="none" stroke="var(--color-border)" strokeWidth="1.5" />
        <rect x="37" y="12" width="16" height="2.5" rx="1.25" fill="var(--color-muted)" />
        <rect x="37" y="18" width="12" height="2.5" rx="1.25" fill="var(--color-border)" />
    </g>),
}

// Mini-previews del velo de imagen para el VisualPick de "Overlay de imagen"
// (modo 'Imagen completa') — rectángulo grisáceo simula la foto, encima la
// forma de cada opción. Mismo criterio visual que patternPreview() de abajo.
export function overlayPreview(id: ImageOverlay): ReactNode {
    const foto = <rect x="2" y="2" width="56" height="30" rx="2" fill="var(--color-border-strong)" />
    switch (id) {
        case 'none':
            return hline(foto)
        case 'diagonal':
            // Mismo velo diagonal que dibuja Inicio.tsx sobre la foto real
            // (oscuro del lado del texto, transparente del otro) — acá en
            // dos franjas de opacidad decreciente en vez de un gradiente SVG
            // real, para no depender de un <linearGradient> con id propio
            // (choca si el mismo preview se repite en más de un slide abierto).
            return hline(<g>
                {foto}
                <polygon points="2,2 34,2 18,32 2,32" fill="#0F172A" opacity="0.6" />
                <polygon points="34,2 46,2 30,32 18,32" fill="#0F172A" opacity="0.3" />
            </g>)
        case 'bottom':
            return hline(<g>
                {foto}
                <rect x="2" y="24" width="56" height="8" fill="#0F172A" opacity="0.6" />
                <rect x="2" y="18" width="56" height="6" fill="#0F172A" opacity="0.3" />
            </g>)
        case 'top':
            return hline(<g>
                {foto}
                <rect x="2" y="2" width="56" height="8" fill="#0F172A" opacity="0.6" />
                <rect x="2" y="10" width="56" height="6" fill="#0F172A" opacity="0.3" />
            </g>)
        case 'radial':
            // Viñeta: oscuro concentrado del lado del texto (izquierda,
            // donde vive textoBloque('left') en Inicio.tsx), desvaneciendo
            // hacia la derecha — más suave/redondeado que 'diagonal'.
            return hline(<g>
                {foto}
                <ellipse cx="16" cy="17" rx="24" ry="20" fill="#0F172A" opacity="0.55" />
                <ellipse cx="12" cy="17" rx="14" ry="14" fill="#0F172A" opacity="0.35" />
            </g>)
        case 'marca':
            // Igual que 'diagonal' pero con el color primario del negocio en
            // vez de negro — el único overlay a color, pensado para tiendas
            // que quieren que el hero se sienta más "de marca".
            return hline(<g>
                {foto}
                <polygon points="2,2 34,2 18,32 2,32" fill="var(--color-primary)" opacity="0.7" />
                <polygon points="34,2 46,2 30,32 18,32" fill="var(--color-primary)" opacity="0.35" />
            </g>)
        case 'blanco':
            // Único overlay CLARO — velo blanco en vez de negro, con el
            // título en texto oscuro (ver textoOscuro en Inicio.tsx). El
            // rectángulo de "foto" queda más oscuro acá a propósito para
            // que el velo blanco se note en la miniatura.
            return hline(<g>
                <rect x="2" y="2" width="56" height="30" rx="2" fill="#64748B" />
                <polygon points="2,2 34,2 18,32 2,32" fill="#fff" opacity="0.88" />
                <polygon points="34,2 46,2 30,32 18,32" fill="#fff" opacity="0.4" />
            </g>)
        // 'tint' — comportamiento de siempre: tinte oscuro parejo + textura
        // de puntos, el default para no cambiarle el diseño a nadie.
        default:
            return hline(<g>
                {foto}
                <rect x="2" y="2" width="56" height="30" rx="2" fill="#0F172A" opacity="0.5" />
                <g fill="#fff" opacity="0.5">
                    {[0, 1, 2].flatMap(row => [0, 1, 2, 3, 4, 5, 6].map(col => (
                        <circle key={`${row}-${col}`} cx={5 + col * 8} cy={7 + row * 9} r="0.9" />
                    )))}
                </g>
            </g>)
    }
}

// Mini-previews del patrón decorativo para el VisualPick de "Patrón de fondo".
export function patternPreview(id: BgPattern): ReactNode {
    switch (id) {
        case 'rings':
            return hline(<g fill="none" stroke="var(--color-primary)" opacity="0.7">
                <circle cx="42" cy="17" r="14" strokeWidth="1.5" />
                <circle cx="42" cy="17" r="9" strokeWidth="1.5" />
                <circle cx="42" cy="17" r="4" strokeWidth="1.5" />
            </g>)
        case 'dots':
            return hline(<g fill="var(--color-primary)" opacity="0.6">
                {[0, 1, 2, 3].flatMap(row => [0, 1, 2, 3, 4].map(col => (
                    <circle key={`${row}-${col}`} cx={8 + col * 11} cy={5 + row * 8} r="1.4" />
                )))}
            </g>)
        case 'waves':
            return hline(<g fill="var(--color-primary)" opacity="0.55">
                <ellipse cx="20" cy="24" rx="16" ry="9" />
                <ellipse cx="42" cy="12" rx="14" ry="8" />
            </g>)
        case 'diagonal':
            return hline(<g>
                <rect x="2" y="2" width="56" height="30" rx="2" fill="var(--color-surface-alt)" />
                <polygon points="35,2 58,2 58,32 20,32" fill="var(--color-primary)" opacity="0.55" />
            </g>)
        case 'grid':
            return hline(<g stroke="var(--color-primary)" opacity="0.55" strokeWidth="1">
                {[10, 20, 30, 40, 50].map(x => <line key={`v${x}`} x1={x} y1="2" x2={x} y2="32" />)}
                {[8, 16, 24].map(y => <line key={`h${y}`} x1="2" y1={y} x2="58" y2={y} />)}
            </g>)
        case 'stripes':
            return hline(<g>
                <rect x="2" y="2" width="56" height="30" rx="2" fill="var(--color-surface-alt)" />
                <g stroke="var(--color-primary)" strokeWidth="2" opacity="0.55">
                    <line x1="6" y1="32" x2="20" y2="2" /><line x1="18" y1="32" x2="32" y2="2" />
                    <line x1="30" y1="32" x2="44" y2="2" /><line x1="42" y1="32" x2="56" y2="2" />
                </g>
            </g>)
        case 'confetti':
            return hline(<g fill="var(--color-primary)" opacity="0.6">
                <circle cx="8" cy="8" r="2" /><rect x="20" y="20" width="4" height="4" transform="rotate(20 22 22)" />
                <circle cx="36" cy="10" r="2" /><rect x="46" y="22" width="4" height="4" transform="rotate(20 48 24)" />
                <circle cx="52" cy="6" r="2" /><rect x="12" y="26" width="4" height="4" transform="rotate(20 14 28)" />
            </g>)
        case 'halo':
            return hline(<g>
                <rect x="2" y="2" width="56" height="30" rx="2" fill="var(--color-surface-alt)" />
                <circle cx="30" cy="17" r="15" fill="var(--color-primary)" opacity="0.35" />
                <circle cx="30" cy="17" r="7" fill="var(--color-primary)" opacity="0.4" />
            </g>)
        case 'arc':
            return hline(<g fill="none" stroke="var(--color-primary)" opacity="0.7" strokeWidth="2">
                <path d="M6 30a24 24 0 0 1 48 0" />
                <path d="M15 30a15 15 0 0 1 30 0" />
            </g>)
        case 'plus':
            return hline(<g stroke="var(--color-primary)" opacity="0.6" strokeWidth="1.4">
                <path d="M10 5v8M6 9h8" /><path d="M46 8v8M42 12h8" /><path d="M28 20v8M24 24h8" />
            </g>)
        // Los 3 de acá abajo se mueven en la tienda real (burbujas flotando,
        // destellos titilando, anillos girando) — la miniatura del selector
        // se queda quieta, es solo una referencia visual del ícono.
        case 'bubbles':
            return hline(<g fill="none" stroke="var(--color-primary)" opacity="0.65" strokeWidth="1.3">
                <circle cx="12" cy="26" r="5" /><circle cx="26" cy="12" r="3.5" />
                <circle cx="40" cy="22" r="4.5" /><circle cx="52" cy="9" r="3" />
            </g>)
        case 'sparkle':
            return hline(<g fill="var(--color-primary)" opacity="0.65">
                <path d="M12 4l1.6 5L19 11l-5.4 2-1.6 5-1.6-5L5 11l5.4-2z" />
                <path d="M42 15l1 3.2 3.2 1-3.2 1-1 3.2-1-3.2-3.2-1 3.2-1z" />
                <path d="M28 22l1.3 4 4 1.3-4 1.3-1.3 4-1.3-4-4-1.3 4-1.3z" />
            </g>)
        case 'orbit':
            return hline(<g fill="none" stroke="var(--color-primary)" opacity="0.7">
                <circle cx="30" cy="17" r="14" strokeWidth="1.4" strokeDasharray="2 4" />
                <circle cx="30" cy="17" r="8" strokeWidth="1.4" strokeDasharray="2 3" />
                <circle cx="44" cy="17" r="2" fill="var(--color-primary)" stroke="none" />
            </g>)
        default:
            return hline(<rect x="2" y="2" width="56" height="30" rx="2" fill="var(--color-surface-alt)" stroke="var(--color-border)" />)
    }
}
