// src/modules/ventas/cliente/juegos/escenas.tsx — el ARTE de cada juego del
// paquete Avanzado. Vive aparte de JuegoInline.tsx a propósito: ese archivo
// tiene la lógica (timing, sesión, reclamo del premio) y esto es 100%
// presentación, sin estado propio. Agregar un juego nuevo es agregar una
// entrada acá + una en TEMAS/MECANICAS, sin tocar la mecánica.
//
// (2026-08-28) Nace del pedido del dueño tras ver juegos de referencia de
// otras tiendas: "quiero que los juegos de Órbita tengan calidad, buena
// jugabilidad y buen ux/ui, para todos los juegos". Antes 4 de las 5
// mecánicas eran una barra abstracta gris oscilando, y solo básquet tenía
// algo parecido a una escena. Ahora las 5 tienen ambientación propia
// (cancha, estadio, bar, fondo del mar, campo de golf).
//
// Convenciones comunes a todas:
//  - Colores FIJOS, nunca var(--color-*): son escenas (cielo, pasto, agua),
//    no superficies de UI que deban seguir el tema claro/oscuro del sitio.
//  - Los <defs> llevan ids prefijados por escena — los ids de SVG son
//    globales al documento y las 5 pueden llegar a coexistir en el DOM.
//  - Fondo llena el contenedor con preserveAspectRatio="none": el alto es
//    fijo (ALTO_ESCENA) y el ancho es el del modal, que cambia según la
//    pantalla; estirar unos px el cielo o el pasto no se nota, y evita
//    bandas vacías a los costados en pantallas anchas.

import type { ReactElement } from 'react'

// La escena se diseña SIEMPRE contra este lienzo fijo y después se escala
// entera (ver EscenaTiro) — como el canvas de un juego. Es lo que la hace
// de verdad responsive: fondo, objetivo y proyectil mantienen exactamente
// las mismas proporciones y posiciones relativas en cualquier pantalla.
//
// Antes el contenedor era fluido (width:100%) pero el objetivo tenía tamaño
// FIJO en px (el aro 132, el arco 146): en un celular la escena mide ~292px,
// así que el arco ocupaba media pantalla y, al oscilar hasta su extremo, se
// cortaba contra el borde — no se veía a qué apuntabas. Verificado
// renderizando las escenas a 292px, no leyendo el código.
//
// ANCHO_DISENO matchea el viewBox de todos los Fondo (400x290), así que no
// hay distorsión: el escalado es uniforme en los dos ejes.
export const ANCHO_DISENO = 400
export const ALTO_ESCENA = 290
// Tope de escalado, para que en pantallas anchas el juego no se vuelva
// gigante ni empuje el modal más allá del alto de la ventana.
export const ESCALA_MAX = 1.5

export type EstadoTiro = 'moviendo' | 'acierto' | 'fallo'

export interface EscenaConfig {
    // Se muestra en la barra de arriba mientras se juega ("Tocá para tirar").
    instruccion: string
    // Dónde vive el objetivo que oscila, en px desde arriba del contenedor.
    objetivoTop: number
    // Cuánto se aleja del centro, en % del ancho, hacia cada lado.
    amplitud: number
    // Adónde llega el proyectil (px desde abajo) cuando el tiro es bueno.
    destinoY: number
    // Alto del arco del tiro. `picoFallo` suele ser mayor: fallar se ve como
    // "se pasó de largo" en vez de simplemente no llegar.
    pico: number
    picoFallo: number
    // 'lanzar' = el proyectil sale desde abajo (pelota, dardo). 'soltar' = cae
    // desde arriba (el anzuelo de la pesca).
    direccion: 'lanzar' | 'soltar'
    Fondo: () => ReactElement
    Objetivo: (p: { estado: EstadoTiro }) => ReactElement
    Proyectil: (p: { estado: EstadoTiro }) => ReactElement
}

// ─── HOOP · Encestar ──────────────────────────────────────────────────────
// Cancha callejera: pared de ladrillos, asfalto y un poco de vegetación
// asomando arriba (referencia que mandó el dueño).

function FondoCancha() {
    return (
        <svg width="100%" height="100%" viewBox="0 0 400 290" preserveAspectRatio="none" style={{ position: 'absolute', inset: 0 }}>
            <defs>
                <pattern id="orbLadrillos" width="80" height="40" patternUnits="userSpaceOnUse">
                    <rect width="80" height="40" fill="#c9a07d" />
                    <rect x="1" y="1" width="38" height="18" rx="1" fill="#b1543c" />
                    <rect x="41" y="1" width="38" height="18" rx="1" fill="#a94d36" />
                    <rect x="0" y="21" width="19" height="18" rx="1" fill="#a94d36" />
                    <rect x="21" y="21" width="38" height="18" rx="1" fill="#b1543c" />
                    <rect x="61" y="21" width="19" height="18" rx="1" fill="#b1543c" />
                </pattern>
                <linearGradient id="orbCanchaSombra" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="rgba(0,0,0,0.28)" />
                    <stop offset="45%" stopColor="rgba(0,0,0,0)" />
                    <stop offset="100%" stopColor="rgba(0,0,0,0.22)" />
                </linearGradient>
                <linearGradient id="orbAsfalto" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#6b7280" />
                    <stop offset="100%" stopColor="#4b5563" />
                </linearGradient>
            </defs>
            <rect width="400" height="290" fill="url(#orbLadrillos)" />
            {/* Follaje asomando por arriba de la pared */}
            <g fill="#3f7d40" opacity="0.95">
                <circle cx="26" cy="12" r="26" /><circle cx="62" cy="6" r="20" />
                <circle cx="352" cy="10" r="24" /><circle cx="386" cy="20" r="22" />
            </g>
            <g fill="#4e9950" opacity="0.9">
                <circle cx="44" cy="4" r="16" /><circle cx="372" cy="2" r="18" />
            </g>
            {/* Cornisa + asfalto */}
            <rect y="248" width="400" height="7" fill="#8a5a44" />
            <rect y="255" width="400" height="35" fill="url(#orbAsfalto)" />
            <rect y="255" width="400" height="2" fill="rgba(255,255,255,0.18)" />
            <rect width="400" height="290" fill="url(#orbCanchaSombra)" />
        </svg>
    )
}

function AroCanasta({ estado }: { estado: EstadoTiro }) {
    return (
        <svg width="132" height="98" viewBox="0 0 132 98" fill="none" style={{ display: 'block' }}>
            <defs>
                <linearGradient id="orbTablero" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#ffffff" /><stop offset="100%" stopColor="#d5dde5" />
                </linearGradient>
                <linearGradient id="orbAro" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#fdba74" /><stop offset="100%" stopColor="#dc2626" />
                </linearGradient>
            </defs>
            <rect x="32" y="6" width="68" height="47" rx="4" fill="rgba(0,0,0,0.18)" />
            <rect x="30" y="3" width="68" height="47" rx="4" fill="url(#orbTablero)" stroke="#7c8794" strokeWidth="1.5" />
            <rect x="53" y="16" width="23" height="19" fill="none" stroke="#dc2626" strokeWidth="2.2" />
            <rect x="60" y="50" width="10" height="7" fill="#5b6673" />
            <ellipse cx="65" cy="57" rx="30" ry="7.5" fill="none" stroke="url(#orbAro)" strokeWidth="5" />
            <path d="M35 55.5 A30 7.5 0 0 1 95 55.5" stroke="#fed7aa" strokeWidth="1.6" fill="none" strokeLinecap="round" />
            {/* La red se "estira" cuando entra la pelota */}
            <g stroke="#f8fafc" strokeWidth="1.3" fill="none" strokeLinecap="round" opacity="0.95"
                style={{ transform: estado === 'acierto' ? 'scaleY(1.14)' : 'scaleY(1)', transformOrigin: '65px 60px', transition: 'transform 220ms ease-out' }}>
                <path d="M37 60 L42 90 M45 60.5 L48 91 M53 61 L54 92 M60 61.3 L60 92.5 M65 61.3 L65 92.5 M70 61.3 L70 92.5 M77 61 L76 92 M85 60.5 L82 91 M93 60 L88 90" />
                <path d="M39 69 Q65 75 91 69" strokeWidth="1.1" />
                <path d="M42 81 Q65 86 88 81" strokeWidth="1.1" />
            </g>
        </svg>
    )
}

function PelotaBasquet() {
    return (
        <svg width="34" height="34" viewBox="0 0 36 36" fill="none" style={{ display: 'block' }}>
            <defs>
                <radialGradient id="orbPelotaB" cx="35%" cy="30%" r="75%">
                    <stop offset="0%" stopColor="#fdba74" /><stop offset="55%" stopColor="#f97316" /><stop offset="100%" stopColor="#b23c06" />
                </radialGradient>
            </defs>
            <circle cx="18" cy="18" r="16.5" fill="url(#orbPelotaB)" stroke="#7c2d12" strokeWidth="1" />
            <path d="M1.5 18 H34.5 M18 1.5 V34.5 M5.8 5.8 Q18 18 5.8 30.2 M30.2 5.8 Q18 18 30.2 30.2" stroke="#7c2d12" strokeWidth="1.3" fill="none" />
        </svg>
    )
}

// ─── GOAL · Meter un gol ──────────────────────────────────────────────────
// Estadio de noche: torres de luz, tribuna en sombra y césped rayado.

function FondoEstadio() {
    return (
        <svg width="100%" height="100%" viewBox="0 0 400 290" preserveAspectRatio="none" style={{ position: 'absolute', inset: 0 }}>
            <defs>
                <linearGradient id="orbCieloNoche" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#0b1229" /><stop offset="100%" stopColor="#1e3a5f" />
                </linearGradient>
                <linearGradient id="orbCesped" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#2f6b34" /><stop offset="100%" stopColor="#4c9c46" />
                </linearGradient>
                <radialGradient id="orbFoco" cx="50%" cy="0%" r="70%">
                    <stop offset="0%" stopColor="rgba(255,247,214,0.42)" /><stop offset="100%" stopColor="rgba(255,247,214,0)" />
                </radialGradient>
            </defs>
            <rect width="400" height="185" fill="url(#orbCieloNoche)" />
            <g fill="#fff">
                <circle cx="42" cy="30" r="1.1" opacity="0.85" /><circle cx="118" cy="18" r="0.9" opacity="0.7" />
                <circle cx="196" cy="36" r="1.2" opacity="0.8" /><circle cx="268" cy="14" r="0.9" opacity="0.65" />
                <circle cx="330" cy="40" r="1.1" opacity="0.75" /><circle cx="86" cy="58" r="0.8" opacity="0.6" />
                <circle cx="242" cy="62" r="0.9" opacity="0.6" /><circle cx="368" cy="66" r="1" opacity="0.7" />
            </g>
            {/* Torres de luz */}
            <ellipse cx="46" cy="30" rx="80" ry="90" fill="url(#orbFoco)" />
            <ellipse cx="354" cy="30" rx="80" ry="90" fill="url(#orbFoco)" />
            <g fill="#111827">
                <rect x="42" y="26" width="7" height="130" /><rect x="26" y="14" width="40" height="16" rx="3" />
                <rect x="351" y="26" width="7" height="130" /><rect x="334" y="14" width="40" height="16" rx="3" />
            </g>
            <g fill="#fde68a">
                <circle cx="34" cy="22" r="3.4" /><circle cx="46" cy="22" r="3.4" /><circle cx="58" cy="22" r="3.4" />
                <circle cx="342" cy="22" r="3.4" /><circle cx="354" cy="22" r="3.4" /><circle cx="366" cy="22" r="3.4" />
            </g>
            {/* Tribuna */}
            <rect y="140" width="400" height="46" fill="#101a33" />
            <g fill="#1e2b4d">
                {Array.from({ length: 26 }).map((_, i) => <rect key={i} x={i * 16 + 2} y={146} width="12" height="34" rx="2" />)}
            </g>
            {/* Césped rayado */}
            <rect y="185" width="400" height="105" fill="url(#orbCesped)" />
            <g fill="rgba(255,255,255,0.05)">
                {Array.from({ length: 6 }).map((_, i) => <rect key={i} x={i * 68} y={185} width="34" height="105" />)}
            </g>
            <rect y="185" width="400" height="3" fill="rgba(255,255,255,0.32)" />
        </svg>
    )
}

function ArcoFutbol({ estado }: { estado: EstadoTiro }) {
    return (
        <svg width="146" height="92" viewBox="0 0 146 92" fill="none" style={{ display: 'block' }}>
            <defs>
                <pattern id="orbRedArco" width="9" height="9" patternUnits="userSpaceOnUse">
                    <path d="M9 0 L0 0 0 9" fill="none" stroke="rgba(255,255,255,0.55)" strokeWidth="0.9" />
                </pattern>
            </defs>
            {/* red */}
            <rect x="12" y="14" width="122" height="66" fill="url(#orbRedArco)"
                style={{ transform: estado === 'acierto' ? 'scaleX(1.03) scaleY(1.05)' : 'none', transformOrigin: '73px 14px', transition: 'transform 220ms ease-out' }} />
            <rect x="12" y="14" width="122" height="66" fill="rgba(148,163,184,0.16)" />
            {/* postes */}
            <g fill="#f8fafc">
                <rect x="8" y="10" width="7" height="72" rx="2" />
                <rect x="131" y="10" width="7" height="72" rx="2" />
                <rect x="8" y="10" width="130" height="7" rx="2" />
            </g>
            <rect x="8" y="10" width="130" height="2.5" fill="rgba(255,255,255,0.9)" />
        </svg>
    )
}

function PelotaFutbol() {
    return (
        <svg width="30" height="30" viewBox="0 0 36 36" fill="none" style={{ display: 'block' }}>
            <defs>
                <radialGradient id="orbPelotaF" cx="35%" cy="28%" r="78%">
                    <stop offset="0%" stopColor="#ffffff" /><stop offset="70%" stopColor="#e8edf2" /><stop offset="100%" stopColor="#9aa7b4" />
                </radialGradient>
            </defs>
            <circle cx="18" cy="18" r="16.5" fill="url(#orbPelotaF)" stroke="#475569" strokeWidth="1" />
            <path d="M18 7 L25.5 12.5 L22.5 21.5 L13.5 21.5 L10.5 12.5 Z" fill="#1f2937" />
            <path d="M18 2 L18 7 M25.5 12.5 L33 10.5 M22.5 21.5 L27 29.5 M13.5 21.5 L9 29.5 M10.5 12.5 L3 10.5" stroke="#1f2937" strokeWidth="1.5" />
        </svg>
    )
}

// ─── DART · Tiro al blanco ────────────────────────────────────────────────
// Bar: pared de madera, lámpara colgante con su cono de luz y estantería.

function FondoBar() {
    return (
        <svg width="100%" height="100%" viewBox="0 0 400 290" preserveAspectRatio="none" style={{ position: 'absolute', inset: 0 }}>
            <defs>
                <pattern id="orbMadera" width="34" height="290" patternUnits="userSpaceOnUse">
                    <rect width="34" height="290" fill="#6b4429" />
                    <rect x="1" width="31" height="290" fill="#7d5231" />
                    <rect x="6" width="2" height="290" fill="rgba(255,255,255,0.07)" />
                    <rect x="22" width="1.5" height="290" fill="rgba(0,0,0,0.16)" />
                </pattern>
                <radialGradient id="orbLuzBar" cx="50%" cy="8%" r="62%">
                    <stop offset="0%" stopColor="rgba(255,220,150,0.62)" /><stop offset="100%" stopColor="rgba(255,220,150,0)" />
                </radialGradient>
                <linearGradient id="orbBarraTop" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#a06a3c" /><stop offset="100%" stopColor="#6e4526" />
                </linearGradient>
                <radialGradient id="orbVinieta" cx="50%" cy="45%" r="72%">
                    <stop offset="55%" stopColor="rgba(0,0,0,0)" /><stop offset="100%" stopColor="rgba(0,0,0,0.42)" />
                </radialGradient>
            </defs>
            <rect width="400" height="290" fill="url(#orbMadera)" />
            {/* cono de luz de la lámpara */}
            <path d="M200 0 L96 290 L304 290 Z" fill="url(#orbLuzBar)" />
            {/* lámpara */}
            <rect x="198" y="0" width="4" height="18" fill="#2a1a10" />
            <path d="M176 18 L224 18 L214 36 L186 36 Z" fill="#1f2937" />
            <ellipse cx="200" cy="36" rx="14" ry="4" fill="#ffd98a" />
            {/* estantería con botellas, en sombra */}
            <rect y="196" width="400" height="6" fill="#3a2416" />
            <g opacity="0.55">
                <rect x="24" y="168" width="9" height="28" rx="2" fill="#1f4d3a" /><rect x="40" y="162" width="8" height="34" rx="2" fill="#3d2a4d" />
                <rect x="55" y="172" width="10" height="24" rx="2" fill="#4d3a1f" />
                <rect x="330" y="166" width="9" height="30" rx="2" fill="#1f3d4d" /><rect x="346" y="172" width="8" height="24" rx="2" fill="#4d1f2a" />
                <rect x="360" y="160" width="10" height="36" rx="2" fill="#2a4d1f" />
            </g>
            {/* barra */}
            <rect y="256" width="400" height="34" fill="#3a2416" />
            <rect y="252" width="400" height="8" rx="2" fill="url(#orbBarraTop)" />
            <rect y="252" width="400" height="2" fill="rgba(255,255,255,0.2)" />
            {/* Viñeta suave, solo en los bordes — antes era un velo parejo de
                0.16 sobre TODA la escena y hundía el dardo contra el fondo. */}
            <rect width="400" height="290" fill="url(#orbVinieta)" />
        </svg>
    )
}

function Diana({ estado }: { estado: EstadoTiro }) {
    const rot = estado === 'acierto' ? 'rotate(6deg)' : 'none'
    return (
        <svg width="96" height="96" viewBox="0 0 96 96" fill="none" style={{ display: 'block', transform: rot, transition: 'transform 240ms ease-out' }}>
            <circle cx="48" cy="48" r="46" fill="#1c1917" />
            <circle cx="48" cy="48" r="43" fill="#0c0a09" stroke="#57534e" strokeWidth="1.5" />
            {/* gajos alternados */}
            <g>
                {Array.from({ length: 12 }).map((_, i) => (
                    <path key={i} d={`M48 48 L${48 + 40 * Math.cos((i * 30 - 90) * Math.PI / 180)} ${48 + 40 * Math.sin((i * 30 - 90) * Math.PI / 180)} A40 40 0 0 1 ${48 + 40 * Math.cos(((i + 1) * 30 - 90) * Math.PI / 180)} ${48 + 40 * Math.sin(((i + 1) * 30 - 90) * Math.PI / 180)} Z`}
                        fill={i % 2 === 0 ? '#f5f0e4' : '#1c1917'} />
                ))}
            </g>
            <circle cx="48" cy="48" r="28" fill="none" stroke="#dc2626" strokeWidth="5" />
            <circle cx="48" cy="48" r="16" fill="none" stroke="#16a34a" strokeWidth="5" />
            <circle cx="48" cy="48" r="9" fill="#dc2626" />
            <circle cx="48" cy="48" r="4" fill="#16a34a" />
        </svg>
    )
}

// Dardo apuntando hacia ARRIBA (la dirección en la que viaja). Se dibuja
// derecho en vez de con un rotate(-90) sobre un viewBox chico como estaba
// antes: así quedaba de ~22×10px y prácticamente no se veía contra el fondo
// oscuro del bar.
function Dardo() {
    return (
        <svg width="26" height="54" viewBox="0 0 26 54" fill="none" style={{ display: 'block' }}>
            {/* punta */}
            <path d="M13 0 L18 14 L8 14 Z" fill="#e2e8f0" stroke="#94a3b8" strokeWidth="0.8" />
            {/* cuerpo */}
            <rect x="9" y="13" width="8" height="24" rx="2" fill="#dc2626" />
            <rect x="10.5" y="15" width="2" height="20" rx="1" fill="rgba(255,255,255,0.4)" />
            {/* aletas */}
            <path d="M4 52 L13 36 L22 52 L13 46 Z" fill="#facc15" stroke="#ca8a04" strokeWidth="0.8" />
        </svg>
    )
}

// ─── FISH · Pescá el premio ───────────────────────────────────────────────
// Bajo el agua: rayos de sol, burbujas, algas. Acá el anzuelo CAE desde
// arriba y lo que oscila es el pez (dirección 'soltar').

function FondoAgua() {
    return (
        <svg width="100%" height="100%" viewBox="0 0 400 290" preserveAspectRatio="none" style={{ position: 'absolute', inset: 0 }}>
            <defs>
                <linearGradient id="orbAgua" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#4bb3d4" /><stop offset="55%" stopColor="#1c6f9c" /><stop offset="100%" stopColor="#0c3f63" />
                </linearGradient>
                <linearGradient id="orbRayo" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="rgba(255,255,255,0.34)" /><stop offset="100%" stopColor="rgba(255,255,255,0)" />
                </linearGradient>
            </defs>
            <rect width="400" height="290" fill="url(#orbAgua)" />
            {/* rayos de sol */}
            <g fill="url(#orbRayo)">
                <path d="M60 0 L96 0 L142 220 L100 220 Z" /><path d="M180 0 L206 0 L232 210 L200 210 Z" />
                <path d="M290 0 L322 0 L344 200 L308 200 Z" />
            </g>
            {/* superficie */}
            <path d="M0 8 Q40 0 80 8 T160 8 T240 8 T320 8 T400 8 L400 0 L0 0 Z" fill="rgba(255,255,255,0.35)" />
            {/* burbujas */}
            <g fill="rgba(255,255,255,0.4)">
                <circle cx="54" cy="150" r="4" /><circle cx="62" cy="124" r="2.6" /><circle cx="50" cy="100" r="3.2" />
                <circle cx="330" cy="168" r="3.4" /><circle cx="340" cy="140" r="2.2" /><circle cx="326" cy="116" r="4" />
            </g>
            {/* fondo arenoso + algas */}
            <path d="M0 262 Q60 246 120 258 T260 254 T400 262 L400 290 L0 290 Z" fill="#c9a86a" />
            <path d="M0 268 Q60 254 120 264 T260 260 T400 268 L400 290 L0 290 Z" fill="#a98a51" />
            <g stroke="#16794f" strokeWidth="6" fill="none" strokeLinecap="round" opacity="0.9">
                <path d="M40 268 Q30 240 44 216 Q52 200 44 184" /><path d="M62 270 Q74 246 62 224" />
                <path d="M346 268 Q358 242 344 218 Q336 202 346 188" /><path d="M320 270 Q310 250 322 230" />
            </g>
        </svg>
    )
}

function Pez({ estado }: { estado: EstadoTiro }) {
    return (
        <svg width="76" height="46" viewBox="0 0 76 46" fill="none" style={{ display: 'block', transform: estado === 'acierto' ? 'rotate(-16deg)' : 'none', transition: 'transform 240ms ease-out' }}>
            <defs>
                <linearGradient id="orbPez" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#fbbf24" /><stop offset="100%" stopColor="#ea7317" />
                </linearGradient>
            </defs>
            <path d="M70 23 L52 10 L52 36 Z" fill="#ea7317" />
            <ellipse cx="32" cy="23" rx="24" ry="14" fill="url(#orbPez)" />
            <path d="M30 9 Q34 2 42 8" stroke="#c2410c" strokeWidth="3" fill="none" strokeLinecap="round" />
            <path d="M30 37 Q34 44 42 38" stroke="#c2410c" strokeWidth="3" fill="none" strokeLinecap="round" />
            <circle cx="18" cy="20" r="3.6" fill="#fff" /><circle cx="17" cy="20" r="1.9" fill="#1f2937" />
            <path d="M44 14 Q48 23 44 32" stroke="#c2410c" strokeWidth="1.6" fill="none" />
        </svg>
    )
}

// Anzuelo con boya y línea. Más grande y con más contraste que la primera
// versión (era un trazo gris de 1.6px que se perdía contra el azul del agua).
function Anzuelo() {
    return (
        <svg width="30" height="72" viewBox="0 0 30 72" fill="none" style={{ display: 'block' }}>
            {/* línea */}
            <path d="M15 0 V40" stroke="#f8fafc" strokeWidth="2.2" strokeLinecap="round" />
            <path d="M15 0 V40" stroke="rgba(15,23,42,0.25)" strokeWidth="0.8" />
            {/* boya */}
            <circle cx="15" cy="40" r="6" fill="#ef4444" stroke="#7f1d1d" strokeWidth="1" />
            <circle cx="13" cy="38" r="1.8" fill="rgba(255,255,255,0.65)" />
            {/* gancho */}
            <path d="M15 46 V56 Q15 66 8 66 Q1 66 4 57" stroke="#e2e8f0" strokeWidth="3.2" fill="none" strokeLinecap="round" />
            <path d="M15 46 V56 Q15 66 8 66 Q1 66 4 57" stroke="rgba(15,23,42,0.3)" strokeWidth="1" fill="none" strokeLinecap="round" />
        </svg>
    )
}

// ─── GOLF · Hoyo en uno ───────────────────────────────────────────────────
// Campo al atardecer: colinas, arboleda y green rayado con la bandera.

function FondoGolf() {
    return (
        <svg width="100%" height="100%" viewBox="0 0 400 290" preserveAspectRatio="none" style={{ position: 'absolute', inset: 0 }}>
            <defs>
                <linearGradient id="orbCieloGolf" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#5eb3e4" /><stop offset="70%" stopColor="#bfe3f2" /><stop offset="100%" stopColor="#ffe9b8" />
                </linearGradient>
                <linearGradient id="orbGreen" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#5aa84a" /><stop offset="100%" stopColor="#3d7f33" />
                </linearGradient>
            </defs>
            <rect width="400" height="290" fill="url(#orbCieloGolf)" />
            <circle cx="326" cy="52" r="26" fill="#fff3c4" opacity="0.9" />
            {/* nubes */}
            <g fill="rgba(255,255,255,0.85)">
                <ellipse cx="70" cy="42" rx="30" ry="13" /><ellipse cx="96" cy="38" rx="22" ry="15" />
                <ellipse cx="214" cy="26" rx="24" ry="10" /><ellipse cx="236" cy="24" rx="18" ry="12" />
            </g>
            {/* colinas */}
            <path d="M0 150 Q70 112 150 148 Q220 178 300 142 Q356 118 400 148 L400 290 L0 290 Z" fill="#7cb85f" />
            <path d="M0 176 Q90 146 180 178 Q270 208 400 172 L400 290 L0 290 Z" fill="#67a44e" />
            {/* arboleda */}
            <g>
                {[28, 62, 96, 300, 336, 370].map((x, i) => (
                    <g key={x}>
                        <rect x={x - 3} y={150 - (i % 2) * 6} width="6" height="26" fill="#5c3a21" />
                        <circle cx={x} cy={142 - (i % 2) * 6} r="17" fill="#2f7d3e" />
                        <circle cx={x - 9} cy={150 - (i % 2) * 6} r="12" fill="#37904a" />
                        <circle cx={x + 9} cy={150 - (i % 2) * 6} r="12" fill="#276b35" />
                    </g>
                ))}
            </g>
            {/* green rayado */}
            <path d="M0 198 Q200 176 400 198 L400 290 L0 290 Z" fill="url(#orbGreen)" />
            <g fill="rgba(255,255,255,0.06)">
                {Array.from({ length: 6 }).map((_, i) => <rect key={i} x={i * 68} y={198} width="34" height="92" />)}
            </g>
        </svg>
    )
}

function HoyoGolf({ estado }: { estado: EstadoTiro }) {
    return (
        <svg width="70" height="104" viewBox="0 0 70 104" fill="none" style={{ display: 'block' }}>
            {/* bandera — flamea un poco más fuerte al acertar */}
            <rect x="33" y="8" width="3" height="78" fill="#e2e8f0" />
            <path d={estado === 'acierto' ? 'M36 10 L64 20 L36 30 Z' : 'M36 10 L60 19 L36 28 Z'} fill="#dc2626"
                style={{ transition: 'd 200ms ease-out' }} />
            <ellipse cx="34" cy="90" rx="17" ry="6" fill="#2b5c25" />
            <ellipse cx="34" cy="88" rx="14" ry="5" fill="#12210f" />
        </svg>
    )
}

function PelotaGolf() {
    return (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" style={{ display: 'block' }}>
            <defs>
                <radialGradient id="orbPelotaG" cx="34%" cy="28%" r="76%">
                    <stop offset="0%" stopColor="#ffffff" /><stop offset="72%" stopColor="#eef2f6" /><stop offset="100%" stopColor="#9fb0bf" />
                </radialGradient>
            </defs>
            <circle cx="12" cy="12" r="11" fill="url(#orbPelotaG)" stroke="#94a3b8" strokeWidth="0.8" />
            <g fill="rgba(148,163,184,0.5)">
                <circle cx="9" cy="8" r="1.1" /><circle cx="14" cy="7" r="1.1" /><circle cx="17" cy="12" r="1.1" />
                <circle cx="12" cy="12" r="1.1" /><circle cx="8" cy="14" r="1.1" /><circle cx="14" cy="17" r="1.1" />
            </g>
        </svg>
    )
}

// ─── Registro ─────────────────────────────────────────────────────────────

// OJO con `destinoY`: es dónde TERMINA el proyectil, y tiene que caer justo
// en la boca del objetivo, si no se ve quedarse corto aunque el tiro haya
// sido bueno. Dos cosas a tener en cuenta al calcularlo:
//
//  1. La boca del objetivo, medida desde ABAJO de la escena:
//        boca = ALTO_ESCENA - (objetivoTop + <y de la boca dentro del SVG>)
//  2. `destinoY` posiciona el BORDE INFERIOR del proyectil (es un `bottom`),
//     no su centro. Para uno chico y simétrico (una pelota) alcanza con
//     restarle medio alto; para uno alto y asimétrico (el dardo, que apunta
//     hacia arriba y cuya punta está en el TOPE de su SVG) hay que restarle
//     casi todo el alto, si no queda flotando muy por encima del objetivo:
//        destinoY = boca - <distancia de la punta al borde inferior del SVG>
//
// La primera versión tenía 3 escenas desalineadas 25-45px por (1) y el dardo
// 54px por (2). Nada de esto se ve leyendo el código: salió de renderizar las
// escenas a un HTML estático con el proyectil ya en su posición final y
// mirarlas. Si tocás objetivoTop, el SVG del objetivo o el del proyectil,
// recalculá y volvé a mirarlo.
export const ESCENAS: Record<string, EscenaConfig> = {
    HOOP: {
        instruccion: 'Tocá la cancha para tirar',
        // aro: cy=57 → boca 290-(14+57)=219. Pelota de 34px, centro a mitad:
        // 219 - 17 = 202.
        objetivoTop: 14, amplitud: 36, destinoY: 202, pico: 118, picoFallo: 136,
        direccion: 'lanzar', Fondo: FondoCancha, Objetivo: AroCanasta, Proyectil: PelotaBasquet,
    },
    GOAL: {
        instruccion: 'Tocá la cancha para patear',
        // objetivoTop 118 (no 96): con 96 el arco quedaba flotando sobre la
        // tribuna en vez de apoyar en el césped, que arranca en y=185.
        // boca: y≈45 → 290-(118+45)=127. Pelota de 30px: 127 - 15 = 112.
        objetivoTop: 118, amplitud: 32, destinoY: 112, pico: 96, picoFallo: 116,
        direccion: 'lanzar', Fondo: FondoEstadio, Objetivo: ArcoFutbol, Proyectil: PelotaFutbol,
    },
    DART: {
        instruccion: 'Tocá para lanzar el dardo',
        // centro de la diana: cy=48 → 202. El dardo apunta hacia arriba y su
        // punta está en el TOPE de un SVG de 54px: 202 - 54 = 148.
        objetivoTop: 40, amplitud: 34, destinoY: 148, pico: 96, picoFallo: 118,
        direccion: 'lanzar', Fondo: FondoBar, Objetivo: Diana, Proyectil: Dardo,
    },
    FISH: {
        instruccion: 'Tocá para soltar el anzuelo',
        // el pez nada a media agua: cy≈23 → 91. El gancho del anzuelo está
        // casi al pie de su SVG (y≈66 de 72), así que apenas se corrige.
        objetivoTop: 176, amplitud: 34, destinoY: 85, pico: 0, picoFallo: 0,
        direccion: 'soltar', Fondo: FondoAgua, Objetivo: Pez, Proyectil: Anzuelo,
    },
    GOLF: {
        instruccion: 'Tocá para pegarle',
        // boca del hoyo: cy=88 → 52. Pelota de 20px: 52 - 10 = 42.
        objetivoTop: 150, amplitud: 33, destinoY: 42, pico: 124, picoFallo: 146,
        direccion: 'lanzar', Fondo: FondoGolf, Objetivo: HoyoGolf, Proyectil: PelotaGolf,
    },
}
