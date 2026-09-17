// "Qué incluye" — la ficha de cada función del paquete Avanzado para quien
// TODAVÍA no lo tiene.
//
// Antes, las seis tarjetas bloqueadas de Avanzado.tsx tenían un botón que
// mandaba derecho a Configuración → Suscripción: el dueño llegaba a la
// pantalla de precios sin haber visto nunca qué hace la función que le
// interesaba. Acá se explica primero y se ofrece activar después.
//
// Las maquetas son ESQUEMAS, no capturas: una captura envejece con cada
// cambio de diseño, muestra datos de un negocio real y se ve distinta en
// claro que en oscuro. Se dibujan con las mismas reglas que las del manual
// (ver panel/manual/ilustraciones.tsx, que es el set de referencia):
//
//   · Un solo acento (--color-primary) y solo en LO QUE EL TEXTO EXPLICA.
//     Todo lo demás es la escala de grises del panel.
//   · Trazo de 1px, esquinas de 2-3px, sin sombras ni degradés.
//   · Sin texto adentro salvo dos o tres rótulos que evitan una confusión.
//   · viewBox único de 320×184, así las seis ocupan el mismo alto.

import type { CSSProperties, ReactElement } from 'react'
import { Modal } from '@/design-system/components/Modal'
import { Button } from '@/design-system/components/Button'

export type FeatureKey = 'juegos' | 'modales' | 'dos-por-uno' | 'plantillas' | 'prueba-social' | 'oferta-relampago'

const LINEA = 'var(--color-border)'
const BLOQUE = 'var(--color-surface-alt)'
const TENUE = 'var(--color-muted)'
const ACENTO = 'var(--color-primary)'

// ─── Primitivas ──────────────────────────────────────────────────────────────
// Mismas cuatro que el manual. Se repiten acá en vez de importarse para no
// atar dos módulos que no tienen nada más en común: lo que se comparte es la
// regla de dibujo (el comentario de arriba), no el código.

/** Ventana: el marco que comparten casi todos los esquemas. */
function Marco({ x = 0.5, y = 0.5, w = 319, h = 183 }: { x?: number; y?: number; w?: number; h?: number }) {
    return <rect x={x} y={y} width={w} height={h} rx={4} fill="none" stroke={LINEA} />
}

/** Renglón de texto simulado. */
function Texto({ x, y, w, fuerte }: { x: number; y: number; w: number; fuerte?: boolean }) {
    return <rect x={x} y={y} width={w} height={fuerte ? 5 : 4} rx={2} fill={fuerte ? TENUE : LINEA} opacity={fuerte ? 0.55 : 1} />
}

/** Caja rellena (tarjeta, foto, bloque). */
function Caja({ x, y, w, h, r = 3, fill = BLOQUE, stroke = LINEA }: { x: number; y: number; w: number; h: number; r?: number; fill?: string; stroke?: string | null }) {
    return <rect x={x + 0.5} y={y + 0.5} width={w} height={h} rx={r} fill={fill} stroke={stroke ?? 'none'} />
}

/** Pastilla (pestaña, chip, botón). */
function Pastilla({ x, y, w, h = 11, activa }: { x: number; y: number; w: number; h?: number; activa?: boolean }) {
    return (
        <rect
            x={x + 0.5} y={y + 0.5} width={w} height={h} rx={h / 2}
            fill={activa ? ACENTO : BLOQUE}
            opacity={activa ? 0.14 : 1}
            stroke={activa ? ACENTO : LINEA}
            strokeOpacity={activa ? 0.55 : 1}
        />
    )
}

const rotulo: CSSProperties = { fontSize: 8, fill: TENUE, fontFamily: 'inherit', letterSpacing: '0.02em' }
const rotuloAcento: CSSProperties = { ...rotulo, fill: ACENTO, fontWeight: 700 }

/** La tienda de fondo: header + grilla de productos. La usan los esquemas
 *  que muestran algo ENCIMA de la tienda (juegos, modales, prueba social). */
function TiendaDeFondo({ opacidad = 1 }: { opacidad?: number }) {
    return (
        <g opacity={opacidad}>
            <line x1={0.5} y1={26.5} x2={319.5} y2={26.5} stroke={LINEA} />
            <Texto x={14} y={11} w={30} fuerte />
            <circle cx={302} cy={13.5} r={5} fill="none" stroke={LINEA} />
            {[0, 1, 2].map(c => (
                <g key={c}>
                    <Caja x={14 + c * 100} y={40} w={88} h={56} />
                    <Texto x={14 + c * 100} y={102} w={62} />
                    <Texto x={14 + c * 100} y={112} w={34} fuerte />
                </g>
            ))}
        </g>
    )
}

// ─── Los seis esquemas ───────────────────────────────────────────────────────

/** Juegos con premio: el mini-juego abierto sobre la portada, con el premio. */
function Juegos() {
    return (
        <>
            <Marco />
            <TiendaDeFondo opacidad={0.4} />
            {/* La ventana del juego, encima de la tienda */}
            <Caja x={74} y={30} w={172} h={126} r={4} fill="var(--color-bg)" />
            <Texto x={88} y={42} w={58} fuerte />
            {/* El aro y la pelota: la mecánica, en gris. El tablero es una caja
                rellena y el aro una línea con su red, así se reconoce sin
                necesidad de un rótulo. */}
            <Caja x={214} y={58} w={6} h={32} r={1} stroke={null} />
            <line x1={192.5} y1={78.5} x2={214.5} y2={78.5} stroke={TENUE} strokeOpacity={0.75} strokeWidth={1.4} />
            <path d="M 193 79 l 4 11 M 213 79 l -4 11 M 197 90 h 12" fill="none" stroke={TENUE} strokeOpacity={0.45} />
            <circle cx={104} cy={112} r={7} fill="none" stroke={TENUE} strokeOpacity={0.75} />
            <path d="M 112 107 q 40 -38 78 -27" fill="none" stroke={LINEA} strokeDasharray="3 3" />
            {/* El premio: lo que el texto explica */}
            <Pastilla x={88} y={128} w={62} h={15} activa />
            <text x={100} y={139} style={rotuloAcento}>-10%</text>
            <Texto x={162} y={133} w={56} />
        </>
    )
}

/** Modales de anuncios: el cartel sobre la portada, con su botón. */
function Modales() {
    return (
        <>
            <Marco />
            <TiendaDeFondo opacidad={0.4} />
            <Caja x={68} y={36} w={184} h={112} r={4} fill="var(--color-bg)" />
            <path d="M 238 46 l 6 6 M 244 46 l -6 6" stroke={TENUE} strokeWidth={1.2} opacity={0.7} />
            <Texto x={84} y={56} w={92} fuerte />
            <Texto x={84} y={70} w={144} />
            <Texto x={84} y={80} w={116} />
            <rect x={84.5} y={96.5} width={152} height={16} rx={3} fill={BLOQUE} stroke={LINEA} />
            <Texto x={92} y={102} w={70} />
            <Pastilla x={84} y={122} w={72} h={15} activa />
        </>
    )
}

/** 2x1 y 3x2: el cartel en la tarjeta del producto y la unidad regalada en el carrito. */
function DosPorUno() {
    return (
        <>
            <Marco />
            {/* La tarjeta del producto, con el cartel de la promo */}
            <Caja x={14} y={16} w={116} h={152} fill="none" />
            <Caja x={14} y={16} w={116} h={92} r={3} stroke={null} />
            <Pastilla x={24} y={26} w={34} h={15} activa />
            <text x={31} y={37} style={rotuloAcento}>2x1</text>
            <Texto x={26} y={122} w={82} />
            <Texto x={26} y={134} w={44} fuerte />
            {/* El carrito */}
            <line x1={150.5} y1={16.5} x2={150.5} y2={167.5} stroke={LINEA} />
            <Texto x={166} y={22} w={40} fuerte />
            {[0, 1, 2].map(i => (
                <g key={i}>
                    <Caja x={166} y={40 + i * 34} w={22} h={22} />
                    <Texto x={196} y={44 + i * 34} w={58} />
                    <Texto x={196} y={54 + i * 34} w={30} />
                    {i < 2
                        ? <Texto x={276} y={48 + i * 34} w={26} fuerte />
                        : <text x={268} y={54 + i * 34} style={rotuloAcento}>Gratis</text>}
                </g>
            ))}
            <line x1={166.5} y1={148.5} x2={306.5} y2={148.5} stroke={LINEA} />
            <Texto x={166} y={158} w={34} />
            <Texto x={272} y={157} w={30} fuerte />
        </>
    )
}

/** Plantillas de Home: tres portadas distintas, una elegida. */
function Plantillas() {
    const elegida = 1
    return (
        <>
            {[0, 1, 2].map(i => {
                const x = 10 + i * 102
                const activa = i === elegida
                return (
                    <g key={i}>
                        <rect
                            x={x + 0.5} y={12.5} width={94} height={136} rx={4}
                            fill="none" stroke={activa ? ACENTO : LINEA} strokeOpacity={activa ? 0.6 : 1}
                        />
                        <line x1={x + 0.5} y1={28.5} x2={x + 94.5} y2={28.5} stroke={LINEA} />
                        <Texto x={x + 8} y={17} w={20} />
                        {/* Cada portada arma sus secciones distinto: eso es lo que se elige */}
                        {i === 0 && (
                            <>
                                <Caja x={x + 8} y={36} w={78} h={34} />
                                {[0, 1].map(c => [0, 1].map(f => (
                                    <Caja key={`${c}-${f}`} x={x + 8 + c * 41} y={78 + f * 32} w={37} h={26} />
                                )))}
                                <Texto x={x + 8} y={142} w={46} />
                            </>
                        )}
                        {i === 1 && (
                            <>
                                <Texto x={x + 8} y={40} w={40} fuerte />
                                <Texto x={x + 8} y={50} w={30} />
                                <Caja x={x + 8} y={62} w={78} h={28} />
                                {[0, 1, 2].map(c => <Caja key={c} x={x + 8 + c * 27} y={98} w={23} h={24} />)}
                                <Texto x={x + 8} y={132} w={54} />
                                <Texto x={x + 8} y={142} w={34} />
                            </>
                        )}
                        {i === 2 && (
                            <>
                                <Caja x={x + 8} y={36} w={46} h={48} />
                                <Caja x={x + 58} y={36} w={28} h={22} />
                                <Caja x={x + 58} y={62} w={28} h={22} />
                                <Caja x={x + 8} y={92} w={78} h={20} />
                                <Texto x={x + 8} y={122} w={62} />
                                <Texto x={x + 8} y={134} w={40} />
                                <Texto x={x + 8} y={144} w={52} />
                            </>
                        )}
                        {/* La elegida: el tilde es el dato, no decoración */}
                        {activa && (
                            <>
                                <circle cx={x + 86} cy={158} r={7} fill={ACENTO} fillOpacity={0.14} stroke={ACENTO} strokeOpacity={0.6} />
                                <path d={`M ${x + 83} 158 l 2 2.5 l 4.5 -5`} fill="none" stroke={ACENTO} strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round" />
                                <text x={x + 2} y={162} style={rotuloAcento}>Activa</text>
                            </>
                        )}
                    </g>
                )
            })}
        </>
    )
}

/** Prueba social: el aviso de una compra real, en un rincón de la tienda. */
function PruebaSocial() {
    return (
        <>
            <Marco />
            <TiendaDeFondo />
            {/* El aviso, abajo a la izquierda */}
            <rect x={12.5} y={124.5} width={156} height={44} rx={4} fill="var(--color-bg)" stroke={ACENTO} strokeOpacity={0.55} />
            <circle cx={36} cy={146} r={11} fill={BLOQUE} stroke={LINEA} />
            <Texto x={56} y={136} w={92} fuerte />
            <Texto x={56} y={146} w={70} />
            <Texto x={56} y={156} w={44} />
            <path d="M 158 134 l 5 5 M 163 134 l -5 5" stroke={TENUE} strokeWidth={1.1} opacity={0.6} />
        </>
    )
}

/** Oferta relámpago: el reloj sobre la portada y los productos en oferta. */
function OfertaRelampago() {
    return (
        <>
            <Marco />
            <line x1={0.5} y1={26.5} x2={319.5} y2={26.5} stroke={LINEA} />
            <Texto x={14} y={11} w={30} fuerte />
            <circle cx={302} cy={13.5} r={5} fill="none" stroke={LINEA} />
            {/* La cartelera con el reloj */}
            <Caja x={12} y={38} w={296} h={52} />
            <Texto x={26} y={52} w={74} fuerte />
            <text x={26} y={76} style={{ ...rotuloAcento, fontSize: 11 }}>-30%</text>
            {[0, 1, 2].map(i => (
                <g key={i}>
                    <rect x={196.5 + i * 36} y={50.5} width={28} height={26} rx={3} fill="var(--color-bg)" stroke={ACENTO} strokeOpacity={0.5} />
                    {i < 2 && <text x={228 + i * 36} y={68} style={{ ...rotulo, fill: TENUE }}>:</text>}
                </g>
            ))}
            <text x={200} y={68} style={rotuloAcento}>02</text>
            <text x={236} y={68} style={rotuloAcento}>14</text>
            <text x={272} y={68} style={rotuloAcento}>57</text>
            {/* Los productos alcanzados */}
            {[0, 1, 2].map(c => (
                <g key={c}>
                    <Caja x={14 + c * 100} y={102} w={88} h={44} />
                    <Texto x={14 + c * 100} y={152} w={60} />
                    <Texto x={14 + c * 100} y={162} w={32} fuerte />
                </g>
            ))}
        </>
    )
}

// ─── Contenido ───────────────────────────────────────────────────────────────

interface Ficha {
    /** Qué es, en una frase. Va arriba de todo, después de la maqueta. */
    resumen: string
    /** Lo concreto que incluye. Tres o cuatro, sin relleno. */
    puntos: string[]
    /** El recorrido real, cuando no es obvio con solo leer los puntos. */
    pasos: { titulo: string; texto: string }[]
    Esquema: () => ReactElement
    alt: string
}

const FICHAS: Record<FeatureKey, Ficha> = {
    juegos: {
        Esquema: Juegos,
        alt: 'Esquema: un mini-juego abierto sobre la portada de la tienda, y el descuento que se gana al acertar.',
        resumen: 'Un mini-juego aparece al entrar a tu tienda. El cliente juega y, si gana, se lleva un descuento que se crea solo y le queda listo para usar — vos no tenés que cargar nada en Descuentos.',
        puntos: [
            'Cinco mecánicas distintas (encestar, gol, puntería, pesca y más), y podés tener varias activas a la vez.',
            'Vos ponés cuánto se gana por acierto y el techo máximo, así nadie se lleva más de lo que decidiste.',
            'Cada juego tiene su vigencia: empieza y termina el día que vos digas.',
            'En Reportes ves quién ganó, cuánto y cuándo.',
        ],
        pasos: [
            { titulo: 'Elegís la mecánica', texto: 'Cada una es un juego distinto con el mismo sistema de premios.' },
            { titulo: 'Definís el premio', texto: 'El porcentaje que se gana y el máximo que puede llevarse una persona.' },
            { titulo: 'Se juega dentro de tu tienda', texto: 'Aparece en la portada, sin mandar al cliente a ninguna otra página.' },
        ],
    },
    modales: {
        Esquema: Modales,
        alt: 'Esquema: un cartel de anuncio abierto sobre la portada de la tienda, con su texto y su botón.',
        resumen: 'Un cartel que aparece sobre tu tienda cuando alguien entra: la bienvenida con un descuento, un aviso de envíos, el horario del finde, o lo que necesites comunicar ese día.',
        puntos: [
            'El texto es todo tuyo: título, mensaje y el botón los escribís vos.',
            'Tiene vigencia propia, así que se muestra solo entre las fechas que elijas.',
            '"Relanzar" vuelve a mostrárselo a quien ya lo había cerrado, sin crear un anuncio nuevo.',
            'Es un anuncio, no un descuento: si querés que además descuente, se combina con un cupón de Descuentos.',
        ],
        pasos: [
            { titulo: 'Escribís el anuncio', texto: 'Título, mensaje y el texto del botón.' },
            { titulo: 'Le ponés fechas', texto: 'Desde cuándo y hasta cuándo se muestra.' },
            { titulo: 'Lo prendés', texto: 'Aparece en la portada la próxima vez que alguien entre.' },
        ],
    },
    'dos-por-uno': {
        Esquema: DosPorUno,
        alt: 'Esquema: la tarjeta de un producto con el cartel "2x1" y el carrito con la tercera unidad en cero.',
        resumen: 'La promo "llevá X, pagá Y" que se aplica sola en el carrito, sin que el cliente tenga que escribir ningún código ni acordarse de nada.',
        puntos: [
            'Definís el alcance: productos puntuales o una categoría entera.',
            'Podés tener varias promos a la vez — un 2x1 en remeras y un 3x2 en medias, por ejemplo.',
            'Los productos alcanzados muestran el cartel de la promo en su tarjeta del catálogo.',
            'El descuento se calcula en el carrito y en el checkout, siempre regalando la unidad más barata del grupo.',
        ],
        pasos: [
            { titulo: 'Elegís el "llevá X, pagá Y"', texto: 'Un 2x1, un 3x2, o la combinación que te sirva.' },
            { titulo: 'Decidís sobre qué aplica', texto: 'Productos sueltos o una categoría completa.' },
            { titulo: 'Se aplica sola', texto: 'Cuando el carrito llega a la cantidad, el descuento aparece sin código.' },
        ],
    },
    plantillas: {
        Esquema: Plantillas,
        alt: 'Esquema: tres diseños distintos de portada, uno de ellos marcado como el activo.',
        resumen: 'Dieciséis diseños distintos para la portada de tu tienda. Elegís uno y la portada cambia entera, sin que tengas que tocar tu catálogo ni volver a cargar nada.',
        puntos: [
            'Cambia la estructura de la portada: qué secciones aparecen y en qué orden.',
            'El catálogo, el carrito y el checkout siguen funcionando exactamente igual.',
            'La paleta y la tipografía de la plantilla sí se aplican a todo el sitio, para que no quede a medias.',
            'La podés cambiar las veces que quieras, y se ve al instante en tu tienda.',
        ],
        pasos: [
            { titulo: 'Mirás la galería', texto: 'Las dieciséis, cada una con su portada de ejemplo.' },
            { titulo: 'Entrás a la que te gusta', texto: 'La ves completa antes de decidir.' },
            { titulo: 'La aplicás', texto: 'Tu portada queda con ese diseño y tus propios productos.' },
        ],
    },
    'prueba-social': {
        Esquema: PruebaSocial,
        alt: 'Esquema: un aviso de compra reciente en la esquina inferior izquierda de la tienda.',
        resumen: 'Avisos chicos en un rincón de tu tienda contando compras recientes: "Martín compró Zapatillas Retro, hace 6 minutos". Sirve para que quien está mirando vea que ahí se vende de verdad.',
        puntos: [
            'Cada aviso sale de un pedido real de tu tienda. Nunca se inventa una venta.',
            'Elegís de qué lado de la pantalla aparecen.',
            'Antes de prenderlo ves exactamente qué pedidos se mostrarían.',
            'Si todavía no tenés pedidos, simplemente no se muestra nada.',
        ],
        pasos: [
            { titulo: 'Mirás el preview', texto: 'Los pedidos reales que se usarían, tal como se verían.' },
            { titulo: 'Elegís el rincón', texto: 'Abajo a la izquierda o abajo a la derecha.' },
            { titulo: 'Lo prendés', texto: 'Los avisos empiezan a aparecer en tu tienda.' },
        ],
    },
    'oferta-relampago': {
        Esquema: OfertaRelampago,
        alt: 'Esquema: la portada de la tienda con la cartelera de la oferta, el reloj corriendo y los productos alcanzados.',
        resumen: 'Un descuento que dura poco y se ve en tu tienda con un reloj que muestra cuánto falta para que termine. La urgencia del reloj es lo que empuja a decidir.',
        puntos: [
            'La oferta se arma en Descuentos, como cualquier otro descuento; lo que suma este paquete es el reloj en la tienda.',
            'El reloj aparece en la portada mientras la oferta está corriendo, con los días, horas y minutos que quedan.',
            'Termina sola cuando llega la hora de fin, sin que tengas que acordarte de apagarla.',
            'Mientras haya una corriendo no se puede apagar el interruptor: primero termina o la borrás, así nunca queda el descuento sin el reloj.',
        ],
        pasos: [
            { titulo: 'Prendés el interruptor', texto: 'Habilita el tipo "Oferta relámpago" en Descuentos.' },
            { titulo: 'Armás la oferta', texto: 'El porcentaje, los productos y hasta qué día y hora dura.' },
            { titulo: 'Corre el reloj', texto: 'Tu portada muestra la cuenta regresiva hasta que termina.' },
        ],
    },
}

// ─── Modal ───────────────────────────────────────────────────────────────────

const TEXTO: CSSProperties = { fontSize: 13.5, lineHeight: 1.65, color: 'var(--color-body)' }
const TITULO_BLOQUE: CSSProperties = { fontSize: 12.5, fontWeight: 600, color: 'var(--color-text)', marginBottom: 9 }

export function ModalQueIncluye({ featureKey, label, onClose, onActivar }: {
    featureKey: FeatureKey
    label: string
    onClose: () => void
    onActivar: () => void
}) {
    const ficha = FICHAS[featureKey]
    if (!ficha) return null
    const { Esquema, alt, resumen, puntos, pasos } = ficha

    return (
        <Modal
            isOpen
            onClose={onClose}
            title={label}
            maxWidth={580}
            footer={<>
                <Button variant="ghost" size="sm" onClick={onClose}>Cerrar</Button>
                <Button variant="primary" size="sm" onClick={onActivar}>Activar el paquete</Button>
            </>}
        >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                <figure style={{
                    margin: 0, padding: 12, boxSizing: 'border-box',
                    border: `1px solid ${LINEA}`, borderRadius: 8, background: 'var(--color-bg)',
                }}>
                    <svg viewBox="0 0 320 184" role="img" aria-label={alt} preserveAspectRatio="xMidYMid meet" style={{ display: 'block', width: '100%', height: 'auto' }}>
                        <Esquema />
                    </svg>
                </figure>

                <p style={{ ...TEXTO, margin: 0 }}>{resumen}</p>

                <div>
                    <div style={TITULO_BLOQUE}>Qué incluye</div>
                    <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 7 }}>
                        {puntos.map((p, i) => (
                            <li key={i} style={{ display: 'flex', gap: 11, alignItems: 'baseline' }}>
                                {/* Raya al margen en vez de viñeta de color — mismo
                                    criterio que las listas del manual. */}
                                <span aria-hidden="true" style={{
                                    width: 7, height: 1, background: TENUE, opacity: 0.45,
                                    flexShrink: 0, transform: 'translateY(-4px)',
                                }} />
                                <span style={TEXTO}>{p}</span>
                            </li>
                        ))}
                    </ul>
                </div>

                <div>
                    <div style={TITULO_BLOQUE}>Cómo funciona</div>
                    <ol style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 11 }}>
                        {pasos.map((p, i) => (
                            <li key={i} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                                <span style={{
                                    flexShrink: 0, width: 15, textAlign: 'right',
                                    fontSize: 12, fontWeight: 500, color: TENUE,
                                    fontVariantNumeric: 'tabular-nums', lineHeight: 1.7,
                                }}>{i + 1}.</span>
                                <div style={{ minWidth: 0 }}>
                                    <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--color-text)', lineHeight: 1.5 }}>{p.titulo}</div>
                                    <div style={{ ...TEXTO, marginTop: 1 }}>{p.texto}</div>
                                </div>
                            </li>
                        ))}
                    </ol>
                </div>
            </div>
        </Modal>
    )
}
