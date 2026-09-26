// Ilustraciones del manual: esquemas anotados de cada pantalla del panel.
//
// Son esquemas, no capturas. Una captura real envejece con cada cambio de
// diseño, muestra datos de UN negocio (y de clientes reales) y se ve distinta
// en claro que en oscuro. Un esquema muestra la FORMA de la pantalla, con los
// rótulos justos para reconocerla, y los números señalan exactamente lo que
// el texto del capítulo explica: cada ilustración lleva su leyenda numerada
// abajo, generada del mismo registro que los callouts, así no se
// desincronizan.
//
// Reglas del set, para que las quince se lean como una sola familia:
//   · viewBox único de 320×184: todas ocupan el mismo alto en la página.
//   · Proporciones del panel real: menú lateral de 60px, barra de 16px.
//   · Trazo de 1px, esquinas de 2-4px, sin sombras ni degradés.
//   · Solo tokens del tema, así se ven bien en claro y en oscuro. El acento
//     (--color-primary) queda reservado a lo que el texto explica y a los
//     callouts; los estados usan success/warning/error/info.
//   · Rótulos cortos y plausibles de un negocio ficticio ("Rama Tienda"),
//     nunca datos reales ni lorem.
//   · Texto a 5-8px con fontFamily inherit: la letra del panel.

import { useId, type CSSProperties, type ReactElement, type ReactNode } from 'react'

export type IlustracionId =
    | 'panel-tienda' | 'layout-panel' | 'kpis' | 'alertas' | 'pedidos'
    | 'clientes' | 'productos' | 'chat' | 'cupon' | 'compartir'
    | 'reportes' | 'config' | 'avanzado' | 'perfil' | 'orbi'

// ─── Tokens ──────────────────────────────────────────────────────────────────

const FONDO = 'var(--color-bg)'
const SUPERFICIE = 'var(--color-surface)'
const BLOQUE = 'var(--color-surface-alt)'
const LINEA = 'var(--color-border)'
const LINEA_FUERTE = 'var(--color-border-strong)'
const TEXTO = 'var(--color-text)'
const TENUE = 'var(--color-muted)'
const SUTIL = 'var(--color-subtle)'
const ACENTO = 'var(--color-primary)'
const ACENTO_BG = 'var(--color-primary-bg)'
const SOBRE_ACENTO = 'var(--color-on-primary)'

type Tono = 'ok' | 'aviso' | 'error' | 'info' | 'neutro'
const TONOS: Record<Tono, { fg: string; bg: string }> = {
    ok: { fg: 'var(--color-success)', bg: 'var(--color-success-bg)' },
    aviso: { fg: 'var(--color-warning)', bg: 'var(--color-warning-bg)' },
    error: { fg: 'var(--color-error)', bg: 'var(--color-error-bg)' },
    info: { fg: 'var(--color-info)', bg: 'var(--color-info-bg)' },
    neutro: { fg: TENUE, bg: BLOQUE },
}

// ─── Primitivas ──────────────────────────────────────────────────────────────

const fuente: CSSProperties = { fontFamily: 'inherit' }

/** Texto real dentro del esquema. `y` es la línea base. */
function Rotulo({ x, y, children, size = 7, fuerte, color, centro, derecha }: {
    x: number; y: number; children: ReactNode; size?: number; fuerte?: boolean
    color?: string; centro?: boolean; derecha?: boolean
}) {
    return (
        <text
            x={x} y={y}
            textAnchor={centro ? 'middle' : derecha ? 'end' : 'start'}
            style={{ ...fuente, fontSize: size, fontWeight: fuerte ? 600 : 400, fill: color ?? (fuerte ? TEXTO : TENUE) }}
        >
            {children}
        </text>
    )
}

/** Renglón de texto simulado, para relleno donde un rótulo no aporta. */
function Texto({ x, y, w, fuerte }: { x: number; y: number; w: number; fuerte?: boolean }) {
    return <rect x={x} y={y} width={w} height={fuerte ? 4 : 3} rx={1.5} fill={fuerte ? TENUE : LINEA} opacity={fuerte ? 0.5 : 1} />
}

/** Caja rellena (bloque, foto). */
function Caja({ x, y, w, h, r = 3, fill = BLOQUE, stroke = LINEA }: {
    x: number; y: number; w: number; h: number; r?: number; fill?: string; stroke?: string | null
}) {
    return <rect x={x + 0.5} y={y + 0.5} width={w} height={h} rx={r} fill={fill} stroke={stroke ?? 'none'} />
}

/** Tarjeta del panel: superficie con borde. */
function Tarjeta({ x, y, w, h, r = 3 }: { x: number; y: number; w: number; h: number; r?: number }) {
    return <Caja x={x} y={y} w={w} h={h} r={r} fill={SUPERFICIE} />
}

/** Pastilla (pestaña, chip de estado). Con `activa` se pinta con el acento. */
function Pastilla({ x, y, w, h = 10, label, activa, tono, size = 5.5 }: {
    x: number; y: number; w: number; h?: number; label?: string; activa?: boolean; tono?: Tono; size?: number
}) {
    const t = tono ? TONOS[tono] : null
    const fill = activa ? ACENTO_BG : t ? t.bg : SUPERFICIE
    const stroke = activa ? ACENTO : t ? 'none' : LINEA
    const color = activa ? ACENTO : t ? t.fg : TENUE
    return (
        <g>
            <rect x={x + 0.5} y={y + 0.5} width={w} height={h} rx={h / 2} fill={fill} stroke={stroke} strokeOpacity={activa ? 0.6 : 1} />
            {label && <Rotulo x={x + 0.5 + w / 2} y={y + 0.5 + h / 2 + size * 0.36} size={size} centro color={color} fuerte={activa}>{label}</Rotulo>}
        </g>
    )
}

/** Botón: primario con el acento, secundario con borde. */
function Boton({ x, y, w, h = 11, label, primario, size = 6 }: {
    x: number; y: number; w: number; h?: number; label: string; primario?: boolean; size?: number
}) {
    return (
        <g>
            <rect x={x + 0.5} y={y + 0.5} width={w} height={h} rx={2.5} fill={primario ? ACENTO : SUPERFICIE} stroke={primario ? 'none' : LINEA_FUERTE} />
            <Rotulo x={x + 0.5 + w / 2} y={y + 0.5 + h / 2 + size * 0.36} size={size} centro fuerte color={primario ? SOBRE_ACENTO : TEXTO}>{label}</Rotulo>
        </g>
    )
}

/** Campo de formulario. `valor` lo muestra escrito; `placeholder`, en gris. */
function Campo({ x, y, w, h = 10, valor, placeholder, size = 5.5 }: {
    x: number; y: number; w: number; h?: number; valor?: string; placeholder?: string; size?: number
}) {
    return (
        <g>
            <rect x={x + 0.5} y={y + 0.5} width={w} height={h} rx={2} fill={SUPERFICIE} stroke={LINEA_FUERTE} />
            {(valor ?? placeholder) && (
                <Rotulo x={x + 4.5} y={y + 0.5 + h / 2 + size * 0.36} size={size} color={valor ? TEXTO : SUTIL}>{valor ?? placeholder}</Rotulo>
            )}
        </g>
    )
}

/** Círculo con inicial: avatar de una persona. */
function Avatar({ cx, cy, r = 5, inicial, size = 5 }: { cx: number; cy: number; r?: number; inicial: string; size?: number }) {
    return (
        <g>
            <circle cx={cx} cy={cy} r={r} fill={ACENTO_BG} stroke={ACENTO} strokeOpacity={0.5} />
            <Rotulo x={cx} y={cy + size * 0.36} size={size} centro fuerte color={ACENTO}>{inicial}</Rotulo>
        </g>
    )
}

/** Icono genérico: cuadradito redondeado. Reemplaza a los íconos de lucide. */
function Icono({ x, y, s = 4, color = TENUE, opacity = 0.6 }: { x: number; y: number; s?: number; color?: string; opacity?: number }) {
    return <rect x={x} y={y} width={s} height={s} rx={1} fill={color} opacity={opacity} />
}

/** Candado: la marca de "requiere el paquete Avanzado". */
function Candado({ x, y }: { x: number; y: number }) {
    return (
        <g>
            <rect x={x} y={y + 4} width={8} height={6} rx={1.5} fill={SUPERFICIE} stroke={TENUE} />
            <path d={`M ${x + 2} ${y + 4} v -1.5 a 2 2 0 0 1 4 0 v 1.5`} fill="none" stroke={TENUE} />
        </g>
    )
}

/**
 * Callout numerado. Va SIEMPRE sobre el elemento que explica y nunca tapa su
 * rótulo. El halo con el color del fondo hace que se lea sobre cualquier cosa.
 */
function Callout({ n, x, y }: { n: number; x: number; y: number }) {
    return (
        <g>
            <circle cx={x} cy={y} r={7} fill={ACENTO} stroke={FONDO} strokeWidth={2} />
            <text x={x} y={y} dy="0.35em" textAnchor="middle" style={{ ...fuente, fontSize: 8, fontWeight: 700, fill: SOBRE_ACENTO }}>{n}</text>
        </g>
    )
}

// ─── El marco del panel ──────────────────────────────────────────────────────
//
// Reproduce Sidebar.tsx y Header.tsx a escala: el menú de 60px con el selector
// de espacio, el buscador del menú, los módulos (con sus sub-secciones cuando
// están abiertos) y el botón de Orbi al pie; y la barra de 16px con la miga
// "Ventas › Sección", la búsqueda global, el modo oscuro, la campana y el
// avatar. El contenido de cada pantalla se dibuja en coordenadas absolutas
// dentro del área que queda (x 66-314, y 22-178).

type ModuloId = 'dashboard' | 'pedidos' | 'clientes' | 'productos' | 'mensajes' | 'descuentos' | 'config' | 'avanzado' | 'manual'

const MODULOS: { id: ModuloId; label: string; subs?: string[] }[] = [
    { id: 'dashboard', label: 'Dashboard' },
    { id: 'pedidos', label: 'Pedidos', subs: ['Lista', 'Historial', 'Canc. y devol.', 'Nuevo +'] },
    // Los rótulos largos van abreviados para entrar en los 60px del menú.
    { id: 'clientes', label: 'Clientes', subs: ['Lista', 'Rep. clientes'] },
    { id: 'productos', label: 'Productos', subs: ['Lista de productos', 'Crear producto', 'Categorías', 'Rep. productos'] },
    { id: 'mensajes', label: 'Mensajes', subs: ['Bandeja', 'Plantillas'] },
    { id: 'descuentos', label: 'Descuentos', subs: ['Descuentos', 'Cupones', 'Rendimiento'] },
    { id: 'config', label: 'Configuración' },
    { id: 'avanzado', label: 'Avanzado' },
    { id: 'manual', label: 'Manual' },
]

/** Ancho del menú lateral, normal y colapsado a íconos. */
const MENU_W = 60
const MENU_W_COLAPSADO = 20
/** Alto de la barra de arriba. */
const BARRA_H = 16

function Panel({ activo, abierto, sub, miga, colapsado, noLeidos, children }: {
    /** Módulo marcado en el menú. Sin él, ninguno (Mi perfil no es un módulo). */
    activo?: ModuloId
    /** Módulo desplegado con sus sub-secciones (solo uno, como en el panel). */
    abierto?: ModuloId
    /** Sub-sección marcada dentro del módulo abierto. */
    sub?: string
    /** Miga de la barra, después de "Ventas". */
    miga: string[]
    /** Menú principal reducido a íconos (pasa solo al entrar a Configuración). */
    colapsado?: boolean
    /** Puntito rojo en Mensajes. */
    noLeidos?: boolean
    children?: ReactNode
}) {
    const sbw = colapsado ? MENU_W_COLAPSADO : MENU_W
    const items: ReactElement[] = []
    let y = 31
    for (const m of MODULOS) {
        const esActivo = m.id === activo
        items.push(
            <g key={m.id}>
                {esActivo && <rect x={3.5} y={y + 0.5} width={sbw - 7} height={10} rx={2} fill={ACENTO_BG} />}
                <Icono x={8} y={y + 3.5} color={esActivo ? ACENTO : TENUE} opacity={esActivo ? 1 : 0.55} />
                {!colapsado && <Rotulo x={15} y={y + 7.8} size={5.8} fuerte={esActivo} color={esActivo ? ACENTO : TEXTO}>{m.label}</Rotulo>}
                {!colapsado && m.subs && (
                    <path d={abierto === m.id ? `M ${sbw - 9} ${y + 4} l 2 2 l 2 -2` : `M ${sbw - 8} ${y + 3} l 2 2 l -2 2`} fill="none" stroke={TENUE} strokeWidth={0.8} />
                )}
                {m.id === 'mensajes' && noLeidos && <circle cx={colapsado ? 13.5 : 44} cy={y + 3.5} r={1.6} fill={TONOS.error.fg} />}
            </g>,
        )
        y += 11
        if (!colapsado && abierto === m.id && m.subs) {
            for (const s of m.subs) {
                const esSub = s === sub
                items.push(
                    <g key={`${m.id}-${s}`}>
                        <line x1={10.5} y1={y} x2={10.5} y2={y + 8} stroke={LINEA} />
                        <Rotulo x={16} y={y + 6} size={5.2} fuerte={esSub} color={esSub ? ACENTO : TENUE}>{s}</Rotulo>
                    </g>,
                )
                y += 8
            }
        }
    }
    return (
        <>
            <rect x={0.5} y={0.5} width={319} height={183} rx={4} fill={FONDO} stroke={LINEA} />
            {/* Menú lateral */}
            <path d={`M 0.5 4.5 a 4 4 0 0 1 4 -4 h ${sbw - 4} v 183 h ${-(sbw - 4)} a 4 4 0 0 1 -4 -4 z`} fill={SUPERFICIE} />
            <line x1={sbw + 0.5} y1={0.5} x2={sbw + 0.5} y2={183.5} stroke={LINEA} />
            {colapsado ? (
                <Icono x={7} y={5.5} s={6} color={ACENTO} opacity={0.85} />
            ) : (
                <>
                    <rect x={4.5} y={4.5} width={42} height={11} rx={2} fill={BLOQUE} />
                    <Icono x={7} y={7} s={6} color={ACENTO} opacity={0.85} />
                    <Rotulo x={16} y={12.2} size={6} fuerte>Tienda</Rotulo>
                    {/* Colapsar el menú */}
                    <path d="M 55 7 l -2.5 3 l 2.5 3 M 52 7 l -2.5 3 l 2.5 3" fill="none" stroke={TENUE} strokeWidth={0.8} />
                    {/* Buscador del menú */}
                    <rect x={4.5} y={19.5} width={52} height={8} rx={4} fill={BLOQUE} />
                    <circle cx={9.5} cy={23.5} r={1.6} fill="none" stroke={SUTIL} strokeWidth={0.8} />
                    <Rotulo x={13} y={25.5} size={5} color={SUTIL}>Buscar pedidos...</Rotulo>
                </>
            )}
            {items}
            {/* Orbi, al pie del menú */}
            {colapsado ? (
                <circle cx={10.5} cy={175} r={5} fill={ACENTO_BG} stroke={ACENTO} strokeOpacity={0.5} />
            ) : (
                <>
                    <rect x={4.5} y={169.5} width={52} height={10} rx={5} fill={ACENTO_BG} stroke={ACENTO} strokeOpacity={0.5} />
                    <circle cx={11} cy={174.5} r={2} fill={ACENTO} />
                    <Rotulo x={16} y={176.7} size={5.8} fuerte color={ACENTO}>Orbi</Rotulo>
                    <Rotulo x={53} y={176.5} size={4.6} derecha>Ctrl+K</Rotulo>
                </>
            )}
            {/* Barra de arriba */}
            <path d={`M ${sbw + 1} 0.5 h ${315 - sbw} a 4 4 0 0 1 4 4 v ${BARRA_H - 4} h ${-(319 - sbw)} z`} fill={SUPERFICIE} />
            <line x1={sbw + 1} y1={BARRA_H + 0.5} x2={319.5} y2={BARRA_H + 0.5} stroke={LINEA} />
            {/* xml:space="preserve": sin eso el SVG colapsa los espacios al borde de cada tspan. */}
            <text x={sbw + 6} y={10.6} xmlSpace="preserve" style={{ ...fuente, fontSize: 6.2 }}>
                <tspan fill={TENUE}>Ventas</tspan>
                {miga.map((m, i) => (
                    <tspan key={i}>
                        <tspan fill={TENUE}>{' › '}</tspan>
                        <tspan fill={i === miga.length - 1 ? TEXTO : TENUE} fontWeight={i === miga.length - 1 ? 600 : 400}>{m}</tspan>
                    </tspan>
                ))}
            </text>
            {/* Búsqueda global, modo oscuro, campana, avatar */}
            <rect x={160.5} y={3.5} width={62} height={10} rx={5} fill={BLOQUE} />
            <circle cx={166} cy={8.5} r={1.8} fill="none" stroke={SUTIL} strokeWidth={0.8} />
            <Rotulo x={170.5} y={10.5} size={5} color={SUTIL}>Buscar en Orbita...</Rotulo>
            <path d="M 233 4.2 a 4 4 0 1 0 4 4.3 a 3 3 0 0 1 -4 -4.3 z" fill="none" stroke={TENUE} strokeWidth={0.9} />
            <path d="M 244.5 11 h 8 l -1.5 -2 v -2.5 a 2.5 2.5 0 0 0 -5 0 v 2.5 z" fill="none" stroke={TENUE} strokeWidth={0.9} strokeLinejoin="round" />
            <circle cx={252} cy={4.5} r={2.4} fill={TONOS.error.fg} />
            <Rotulo x={252} y={6} size={3.6} centro fuerte color={SOBRE_ACENTO}>3</Rotulo>
            <Avatar cx={265} cy={8.5} inicial="R" />
            <Rotulo x={273} y={10.6} size={5.5} color={TEXTO}>Rama G.</Rotulo>
            <path d="M 304 7 l 2.5 2.5 l 2.5 -2.5" fill="none" stroke={TENUE} strokeWidth={0.9} />
            {children}
        </>
    )
}

/** Gráfico de línea chico, para el Inicio y los Reportes. */
function Linea({ x, y, w, h, valores }: { x: number; y: number; w: number; h: number; valores: number[] }) {
    const max = Math.max(...valores)
    const paso = w / (valores.length - 1)
    const pts = valores.map((v, i) => [x + i * paso, y + h - (v / max) * h] as const)
    return (
        <g>
            <line x1={x} y1={y + h + 0.5} x2={x + w} y2={y + h + 0.5} stroke={LINEA} />
            <polyline points={pts.map(([px, py]) => `${px},${py}`).join(' ')} fill="none" stroke={ACENTO} strokeWidth={1.2} strokeLinejoin="round" strokeLinecap="round" />
            {pts.map(([px, py], i) => <circle key={i} cx={px} cy={py} r={1.3} fill={ACENTO} />)}
        </g>
    )
}

// ─── Los quince esquemas ─────────────────────────────────────────────────────
//
// Cada uno es un componente que devuelve el dibujo entero (marco incluido) y
// los callouts. El número de cada callout es la posición (desde 1) de su
// línea en la leyenda del registro ESQUEMAS, al final del archivo.

/** Arranque: el panel a la izquierda, la tienda a la derecha, y la flecha entre los dos. */
function PanelTienda() {
    return (
        <>
            {/* El panel, en miniatura: menú, barra, Inicio con "Publicar tienda" */}
            <rect x={4.5} y={8.5} width={146} height={144} rx={3} fill={FONDO} stroke={LINEA} />
            <path d="M 4.5 11.5 a 3 3 0 0 1 3 -3 h 25 v 144 h -25 a 3 3 0 0 1 -3 -3 z" fill={SUPERFICIE} />
            <line x1={32.5} y1={8.5} x2={32.5} y2={152.5} stroke={LINEA} />
            <line x1={32.5} y1={20.5} x2={150.5} y2={20.5} stroke={LINEA} />
            <Icono x={8} y={11} s={5} color={ACENTO} opacity={0.85} />
            <Texto x={15} y={12} w={12} fuerte />
            {[26, 36, 46, 56, 66, 76].map((y, i) => (
                <g key={y}>
                    <Icono x={8} y={y} s={3.5} color={i === 0 ? ACENTO : TENUE} opacity={i === 0 ? 1 : 0.5} />
                    <Texto x={14} y={y} w={i === 0 ? 14 : 11} />
                </g>
            ))}
            <Texto x={38} y={13} w={26} />
            <Avatar cx={142} cy={14.5} r={3.5} inicial="R" size={4} />
            <Rotulo x={38} y={31} size={6} fuerte>Inicio</Rotulo>
            <Boton x={100} y={24} w={46} h={9} label="Publicar tienda" primario size={4.8} />
            {[0, 1, 2].map(i => (
                <g key={i}>
                    <Tarjeta x={38 + i * 37} y={38} w={34} h={20} />
                    <Texto x={42 + i * 37} y={42} w={14} />
                    <Texto x={42 + i * 37} y={49} w={20} fuerte />
                </g>
            ))}
            <Tarjeta x={38} y={64} w={108} h={38} />
            <Texto x={43} y={69} w={34} fuerte />
            <Linea x={44} y={76} w={96} h={20} valores={[30, 44, 26, 52, 38, 60, 48]} />
            <Tarjeta x={38} y={108} w={108} h={38} />
            {[114, 124, 134].map(y => (
                <g key={y}>
                    <Texto x={43} y={y} w={12} fuerte />
                    <Texto x={60} y={y} w={40} />
                    <Texto x={124} y={y} w={16} fuerte />
                </g>
            ))}
            <Rotulo x={4} y={166} size={6.5} fuerte>El panel</Rotulo>
            <Rotulo x={4} y={175} size={5.5}>Tu trastienda: entrás con usuario y contraseña.</Rotulo>

            {/* La flecha: todo lo que tocás acá se ve allá, al instante */}
            <path d="M 154 80 h 10 m -3 -3 l 3 3 l -3 3" fill="none" stroke={ACENTO} strokeWidth={1.2} strokeLinecap="round" strokeLinejoin="round" />

            {/* La tienda: barra del navegador con la dirección, portada y catálogo */}
            <rect x={170.5} y={8.5} width={145} height={144} rx={3} fill={FONDO} stroke={LINEA} />
            <path d="M 170.5 11.5 a 3 3 0 0 1 3 -3 h 139 a 3 3 0 0 1 3 3 v 9 h -145 z" fill={BLOQUE} />
            <line x1={170.5} y1={20.5} x2={315.5} y2={20.5} stroke={LINEA} />
            {[176, 180.5, 185].map(x => <circle key={x} cx={x} cy={14.5} r={1.3} fill={SUTIL} />)}
            <rect x={191.5} y={10.5} width={116} height={8} rx={4} fill={SUPERFICIE} stroke={LINEA} />
            <Rotulo x={197} y={16.4} size={5} color={TEXTO}>ramatienda.orbita.site</Rotulo>
            <Rotulo x={178} y={31} size={6.5} fuerte>Rama Tienda</Rotulo>
            {[240, 258, 276].map(x => <Texto key={x} x={x} y={27} w={12} />)}
            <circle cx={306} cy={28} r={3} fill="none" stroke={TENUE} />
            <Caja x={176} y={36} w={134} h={24} />
            <Texto x={186} y={44} w={54} fuerte />
            <Texto x={186} y={51} w={36} />
            {[0, 1, 2].map(c => [0, 1].map(f => (
                <g key={`${c}-${f}`}>
                    <Caja x={176 + c * 45} y={66 + f * 40} w={40} h={22} />
                    <Texto x={176 + c * 45} y={92 + f * 40} w={30} />
                    <Rotulo x={176 + c * 45} y={102 + f * 40} size={5} fuerte>$ 4.900</Rotulo>
                </g>
            )))}
            <Rotulo x={170} y={166} size={6.5} fuerte>Tu tienda</Rotulo>
            <Rotulo x={170} y={175} size={5.5}>Pública, en tu dirección web. La ve tu cliente.</Rotulo>

            <Callout n={1} x={11} y={15} />
            <Callout n={2} x={177} y={15} />
            <Callout n={3} x={160} y={68} />
            <Callout n={4} x={96} y={34} />
            <Callout n={5} x={142} y={4} />
        </>
    )
}

/** Moverte por el panel: el menú de la izquierda (con Pedidos abierto) y la barra de arriba. */
function LayoutPanel() {
    return (
        <Panel activo="pedidos" abierto="pedidos" sub="Lista" miga={['Pedidos']} noLeidos>
            <Rotulo x={66} y={31} size={8} fuerte>Pedidos</Rotulo>
            <Boton x={258} y={22} w={56} label="Nuevo pedido" primario />
            {['Todos 41', 'Pendientes 3', 'Confirmados 5', 'En prep. 2', 'Enviados 4'].map((label, i) => (
                <Pastilla key={label} x={66 + i * 42} y={38} w={40} h={10} label={label} activa={i === 1} size={4.8} />
            ))}
            <Tarjeta x={66} y={54} w={248} h={120} />
            {[0, 1, 2, 3, 4, 5, 6].map(i => (
                <g key={i}>
                    <Texto x={74} y={64 + i * 16} w={12} fuerte />
                    <Texto x={96} y={64 + i * 16} w={44} />
                    <Texto x={160} y={64 + i * 16} w={30} />
                    <Pastilla x={210} y={60 + i * 16} w={34} h={8} tono={i < 2 ? 'aviso' : i < 4 ? 'ok' : 'neutro'} />
                    <Texto x={280} y={64 + i * 16} w={24} fuerte />
                    {i < 6 && <line x1={66.5} y1={73.5 + i * 16} x2={313.5} y2={73.5 + i * 16} stroke={LINEA} />}
                </g>
            ))}
            <Callout n={1} x={58} y={23.5} />
            <Callout n={2} x={54} y={47} />
            <Callout n={3} x={124} y={8.5} />
            <Callout n={4} x={155} y={8.5} />
            <Callout n={5} x={248} y={21} />
            <Callout n={6} x={266} y={21} />
        </Panel>
    )
}

/** Inicio: el período, "Publicar tienda", los cinco números, el gráfico, el top y la actividad. */
function Kpis() {
    const kpis: { label: string; valor: string; delta: string; tono: Tono; pie?: string }[] = [
        { label: 'Ventas', valor: '$ 128.400', delta: '+12%', tono: 'ok', pie: 'neto de devol.' },
        { label: 'Pedidos', valor: '34', delta: '+8%', tono: 'ok', pie: '3 pendientes' },
        { label: 'Ticket promedio', valor: '$ 3.776', delta: '+4%', tono: 'ok' },
        { label: 'Clientes nuevos', valor: '9', delta: '-2', tono: 'error' },
        { label: 'Comisión MP', valor: '$ 5.120', delta: '+3%', tono: 'error', pie: 'sobre pagos MP' },
    ]
    const actividad: { n: string; c: string; t: string; e: string; tono: Tono }[] = [
        { n: '#34', c: 'Lucía P.', t: '$ 4.900', e: 'Pendiente', tono: 'aviso' },
        { n: '#33', c: 'Martín S.', t: '$ 12.300', e: 'Confirmado', tono: 'ok' },
        { n: '#32', c: 'Ana R.', t: '$ 2.150', e: 'Entregado', tono: 'neutro' },
    ]
    return (
        <Panel activo="dashboard" miga={['Inicio']}>
            {/* Período */}
            <Pastilla x={66} y={23} w={18} h={9} label="Hoy" size={4.8} />
            <Pastilla x={86} y={23} w={28} h={9} label="Semana" activa size={4.8} />
            <Pastilla x={116} y={23} w={18} h={9} label="Mes" size={4.8} />
            <Pastilla x={136} y={23} w={44} h={9} label="Personalizado" size={4.8} />
            <Boton x={262} y={22} w={52} label="Publicar tienda" primario size={5.5} />
            {/* Los cinco números */}
            {kpis.map((k, i) => {
                const x = 66 + i * 50.25
                return (
                    <g key={k.label}>
                        <Tarjeta x={x} y={36} w={47} h={29} />
                        <Rotulo x={x + 4} y={44} size={4.8}>{k.label}</Rotulo>
                        <Rotulo x={x + 4} y={54} size={7} fuerte>{k.valor}</Rotulo>
                        <Rotulo x={x + 4} y={61.5} size={4.4} color={TONOS[k.tono].fg} fuerte>{k.delta}</Rotulo>
                        {k.pie && <Rotulo x={x + 18} y={61.5} size={4} color={SUTIL}>{k.pie}</Rotulo>}
                    </g>
                )
            })}
            {/* Gráfico de la semana */}
            <Tarjeta x={66} y={70} w={158} h={57} />
            <Rotulo x={71} y={79} size={5.5} fuerte>Ventas de la semana</Rotulo>
            <path d="M 214 75 h 4 v 4 M 218 75 l -4 4" fill="none" stroke={TENUE} strokeWidth={0.8} />
            <Linea x={73} y={85} w={144} h={32} valores={[30, 44, 26, 52, 38, 60, 48]} />
            {['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((d, i) => <Rotulo key={i} x={73 + i * 24} y={124.5} size={4} centro color={SUTIL}>{d}</Rotulo>)}
            {/* Top con sus tres pestañas */}
            <Tarjeta x={228} y={70} w={86} h={57} />
            <Pastilla x={231} y={74} w={28} h={8} label="Productos" activa size={4.4} />
            <Pastilla x={261} y={74} w={30} h={8} label="Categorías" size={4.4} />
            <Pastilla x={293} y={74} w={18} h={8} label="Canal" size={4.4} />
            {[0, 1, 2, 3].map(i => (
                <g key={i}>
                    <Texto x={232} y={89 + i * 9} w={26} />
                    <rect x={264} y={88.5 + i * 9} width={46 - i * 11} height={4} rx={1.5} fill={ACENTO} opacity={0.55 - i * 0.1} />
                </g>
            ))}
            {/* Actividad reciente */}
            <Tarjeta x={66} y={132} w={248} h={46} />
            <Rotulo x={71} y={141} size={5.5} fuerte>Actividad reciente</Rotulo>
            <Rotulo x={309} y={141} size={5} derecha color={ACENTO} fuerte>Ver todos →</Rotulo>
            {actividad.map((r, i) => (
                <g key={r.n}>
                    <Rotulo x={71} y={152 + i * 9.5} size={5} fuerte>{r.n}</Rotulo>
                    <Rotulo x={88} y={152 + i * 9.5} size={5} color={TEXTO}>{r.c}</Rotulo>
                    <Texto x={130} y={148.5 + i * 9.5} w={60} />
                    <Rotulo x={244} y={152 + i * 9.5} size={5} derecha fuerte>{r.t}</Rotulo>
                    <Pastilla x={256} y={146 + i * 9.5} w={40} h={7.5} label={r.e} tono={r.tono} size={4.2} />
                </g>
            ))}
            <Callout n={1} x={188} y={27.5} />
            <Callout n={2} x={313} y={19} />
            <Callout n={3} x={63} y={50} />
            <Callout n={4} x={63} y={68} />
            <Callout n={5} x={226} y={66} />
            <Callout n={6} x={63} y={131} />
        </Panel>
    )
}

/** Alertas del Inicio: la tira que aparece debajo de los números solo cuando hay algo que resolver. */
function Alertas() {
    const alertas: { titulo: string; desc: string; tono: Tono }[] = [
        { titulo: 'Pedidos sin atender +2hs', desc: '2 pedidos llevan más de dos horas sin tocarse', tono: 'error' },
        { titulo: 'Pedidos que necesitan tu atención', desc: '3 pendientes de confirmar el pago', tono: 'aviso' },
        { titulo: 'Productos con stock crítico', desc: 'Remera básica · Gorra negra', tono: 'aviso' },
        { titulo: 'Pagos por confirmar', desc: '1 transferencia sin validar', tono: 'aviso' },
    ]
    return (
        <Panel activo="dashboard" miga={['Inicio']}>
            {/* Los números, atenuados: la tira vive justo debajo */}
            <g opacity={0.45}>
                {[0, 1, 2, 3, 4].map(i => (
                    <g key={i}>
                        <Tarjeta x={66 + i * 50.25} y={22} w={47} h={16} />
                        <Texto x={70 + i * 50.25} y={26} w={18} />
                        <Texto x={70 + i * 50.25} y={31} w={24} fuerte />
                    </g>
                ))}
            </g>
            <Rotulo x={66} y={49} size={6} fuerte>Alertas</Rotulo>
            <Rotulo x={314} y={49} size={5} derecha>Limpiar todas</Rotulo>
            {alertas.map((a, i) => {
                const x = 66 + (i % 2) * 127
                const y = 54 + Math.floor(i / 2) * 48
                const t = TONOS[a.tono]
                return (
                    <g key={a.titulo}>
                        <Tarjeta x={x} y={y} w={121} h={44} />
                        <rect x={x + 0.5} y={y + 0.5} width={3} height={44} rx={1.5} fill={t.fg} />
                        <circle cx={x + 12} cy={y + 10} r={3.5} fill={t.bg} />
                        <Rotulo x={x + 12} y={y + 11.8} size={5} centro fuerte color={t.fg}>!</Rotulo>
                        <Rotulo x={x + 19} y={y + 12} size={5.3} fuerte>{a.titulo}</Rotulo>
                        <Rotulo x={x + 19} y={y + 22} size={4.8}>{a.desc}</Rotulo>
                        <Rotulo x={x + 19} y={y + 37} size={5.2} fuerte color={ACENTO}>Ir →</Rotulo>
                    </g>
                )
            })}
            <g opacity={0.45}>
                <Tarjeta x={66} y={152} w={248} h={26} />
                <Texto x={71} y={158} w={44} fuerte />
                <Texto x={71} y={166} w={200} />
            </g>
            <Callout n={1} x={96} y={47} />
            <Callout n={2} x={186} y={53} />
            <Callout n={3} x={186} y={101} />
            <Callout n={4} x={104} y={91} />
            <Callout n={5} x={276} y={47} />
        </Panel>
    )
}

/** Pedidos: pestañas por estado con contador, la lista, los tildes para operar en lote y los botones. */
function Pedidos() {
    const filas: { n: string; c: string; f: string; e: string; tono: Tono; t: string; tilde?: boolean }[] = [
        { n: '#34', c: 'Lucía Pérez', f: 'hoy 10:24', e: 'Pendiente', tono: 'aviso', t: '$ 4.900', tilde: true },
        { n: '#33', c: 'Martín Sosa', f: 'hoy 09:10', e: 'Pendiente', tono: 'aviso', t: '$ 12.300', tilde: true },
        { n: '#32', c: 'Ana Ruiz', f: 'ayer', e: 'Confirmado', tono: 'ok', t: '$ 2.150' },
        { n: '#31', c: 'Julián D.', f: 'ayer', e: 'En prep.', tono: 'info', t: '$ 8.700' },
        { n: '#30', c: 'Carla M.', f: '18/09', e: 'Enviado', tono: 'info', t: '$ 6.400' },
        { n: '#29', c: 'Pedro L.', f: '17/09', e: 'Entregado', tono: 'neutro', t: '$ 3.200' },
    ]
    // Posición de cada pestaña, acumulada de antemano (sin mutar durante el render).
    const pestanas = ([['Todos 41', 26], ['Pendientes 3', 36], ['Confirmados 5', 38], ['En prep. 2', 28], ['Enviados 4', 30], ['Entregados 25', 36], ['Cancelados 2', 34]] as [string, number][])
        .reduce<{ label: string; w: number; x: number }[]>((acc, [label, w]) => {
            const prev = acc[acc.length - 1]
            acc.push({ label, w, x: prev ? prev.x + prev.w + 2 : 66 })
            return acc
        }, [])
    return (
        <Panel activo="pedidos" abierto="pedidos" sub="Lista" miga={['Pedidos']}>
            <Rotulo x={66} y={31} size={8} fuerte>Pedidos</Rotulo>
            <Boton x={206} y={22} w={46} label="Exportar CSV" size={5.2} />
            <Boton x={258} y={22} w={56} label="Nuevo pedido" primario size={5.2} />
            {/* Pestañas por estado, con el contador real */}
            {pestanas.map((p, i) => (
                <Pastilla key={p.label} x={p.x} y={38} w={p.w} h={10} label={p.label} activa={i === 1} size={4.5} />
            ))}
            {/* Búsqueda y filtro por fecha */}
            <Campo x={66} y={52} w={100} placeholder="Buscar por número o cliente" size={5} />
            <Campo x={170} y={52} w={60} valor="Últimos 30 días" size={5} />
            <path d="M 222 56 l 2.5 2.5 l 2.5 -2.5" fill="none" stroke={TENUE} strokeWidth={0.9} />
            {/* La lista */}
            <Tarjeta x={66} y={67} w={248} h={98} />
            <Rotulo x={78} y={75} size={4.6} color={SUTIL}>Pedido</Rotulo>
            <Rotulo x={104} y={75} size={4.6} color={SUTIL}>Cliente</Rotulo>
            <Rotulo x={150} y={75} size={4.6} color={SUTIL}>Fecha</Rotulo>
            <Rotulo x={196} y={75} size={4.6} color={SUTIL}>Estado</Rotulo>
            <Rotulo x={309} y={75} size={4.6} color={SUTIL} derecha>Total</Rotulo>
            <line x1={66.5} y1={78.5} x2={313.5} y2={78.5} stroke={LINEA} />
            {filas.map((r, i) => {
                const y = 87 + i * 13
                return (
                    <g key={r.n}>
                        <rect x={68.5} y={y - 4.5} width={5} height={5} rx={1} fill={r.tilde ? ACENTO : SUPERFICIE} stroke={r.tilde ? ACENTO : LINEA_FUERTE} />
                        {r.tilde && <path d={`M 69.7 ${y - 2} l 1.3 1.3 l 2.3 -2.6`} fill="none" stroke={SOBRE_ACENTO} strokeWidth={0.9} />}
                        <Rotulo x={78} y={y} size={5.2} fuerte>{r.n}</Rotulo>
                        <Rotulo x={104} y={y} size={5} color={TEXTO}>{r.c}</Rotulo>
                        <Rotulo x={150} y={y} size={4.8}>{r.f}</Rotulo>
                        <Pastilla x={196} y={y - 6} w={36} h={8} label={r.e} tono={r.tono} size={4.3} />
                        <Rotulo x={309} y={y} size={5.2} derecha fuerte>{r.t}</Rotulo>
                        {i < filas.length - 1 && <line x1={66.5} y1={y + 4.5} x2={313.5} y2={y + 4.5} stroke={LINEA} />}
                    </g>
                )
            })}
            {/* Barra de lote: aparece al tildar */}
            <rect x={66.5} y={168.5} width={248} height={10} rx={2} fill={ACENTO_BG} stroke={ACENTO} strokeOpacity={0.5} />
            <Rotulo x={71} y={175.4} size={5} color={ACENTO} fuerte>2 seleccionados</Rotulo>
            <Rotulo x={309} y={175.4} size={5} derecha color={ACENTO} fuerte>Confirmar pago de los 2 →</Rotulo>
            <Callout n={1} x={312} y={50} />
            <Callout n={2} x={313} y={19} />
            <Callout n={3} x={183} y={87} />
            <Callout n={4} x={60} y={100} />
            <Callout n={5} x={236} y={57} />
            <Callout n={6} x={203} y={19} />
        </Panel>
    )
}

/** Clientes: la lista que se arma sola, sus números por persona, la flechita, el sobre y los botones. */
function Clientes() {
    const filas: { n: string; e: string; p: string; t: string; k: string; u: string }[] = [
        { n: 'Lucía Pérez', e: 'lucia@mail.com', p: '12', t: '$ 48.200', k: '$ 4.016', u: 'hace 3 días' },
        { n: 'Martín Sosa', e: 'msosa@mail.com', p: '4', t: '$ 22.900', k: '$ 5.725', u: 'hace 2 sem.' },
        { n: 'Ana Ruiz', e: 'ana.r@mail.com', p: '1', t: '$ 2.150', k: '$ 2.150', u: 'hace 3 meses' },
        { n: 'Julián Díaz', e: 'jdiaz@mail.com', p: '7', t: '$ 31.400', k: '$ 4.485', u: 'ayer' },
        { n: 'Carla Molina', e: 'carla.m@mail.com', p: '2', t: '$ 9.600', k: '$ 4.800', u: 'hace 1 mes' },
    ]
    // La primera fila está desplegada: corre a las demás hacia abajo.
    const yFila = (i: number) => (i === 0 ? 73 : 110 + (i - 1) * 15)
    return (
        <Panel activo="clientes" abierto="clientes" sub="Lista" miga={['Clientes']}>
            <Rotulo x={66} y={31} size={8} fuerte>Clientes</Rotulo>
            <Boton x={218} y={22} w={36} label="Exportar" size={5.2} />
            <Boton x={258} y={22} w={56} label="Email masivo" primario size={5.2} />
            <Campo x={66} y={38} w={110} placeholder="Buscar por nombre o email" size={5} />
            <Campo x={180} y={38} w={74} valor="Sin comprar hace +60 días" size={4.6} />
            <path d="M 246 42 l 2.5 2.5 l 2.5 -2.5" fill="none" stroke={TENUE} strokeWidth={0.9} />
            <Tarjeta x={66} y={53} w={248} h={125} />
            <Rotulo x={84} y={61} size={4.6} color={SUTIL}>Cliente</Rotulo>
            <Rotulo x={160} y={61} size={4.6} color={SUTIL} centro>Pedidos</Rotulo>
            <Rotulo x={190} y={61} size={4.6} color={SUTIL}>Total gastado</Rotulo>
            <Rotulo x={230} y={61} size={4.6} color={SUTIL}>Ticket prom.</Rotulo>
            <Rotulo x={266} y={61} size={4.6} color={SUTIL}>Última compra</Rotulo>
            <line x1={66.5} y1={64.5} x2={313.5} y2={64.5} stroke={LINEA} />
            {filas.map((r, i) => {
                const y = yFila(i)
                return (
                    <g key={r.n}>
                        <Avatar cx={76} cy={y - 1.5} r={5} inicial={r.n.charAt(0)} size={4.6} />
                        <Rotulo x={84} y={y - 1} size={5.2} fuerte>{r.n}</Rotulo>
                        <Rotulo x={84} y={y + 4.8} size={4.2} color={SUTIL}>{r.e}</Rotulo>
                        <Rotulo x={160} y={y + 1} size={5.2} centro fuerte>{r.p}</Rotulo>
                        <Rotulo x={190} y={y + 1} size={5} color={TEXTO}>{r.t}</Rotulo>
                        <Rotulo x={230} y={y + 1} size={5} color={TEXTO}>{r.k}</Rotulo>
                        <Rotulo x={266} y={y + 1} size={4.6}>{r.u}</Rotulo>
                        {/* El sobre: escribirle a esa persona sola */}
                        <rect x={297.5} y={y - 4} width={7} height={5} rx={0.8} fill="none" stroke={TENUE} strokeWidth={0.8} />
                        <path d={`M 297.5 ${y - 4} l 3.5 2.5 l 3.5 -2.5`} fill="none" stroke={TENUE} strokeWidth={0.8} />
                        {/* La flechita: despliega sus últimos pedidos */}
                        <path d={i === 0 ? `M 307 ${y - 3} l 2.5 2.5 l 2.5 -2.5` : `M 308 ${y - 4} l 2.5 2.5 l -2.5 2.5`} fill="none" stroke={TENUE} strokeWidth={0.9} />
                        {i < filas.length - 1 && <line x1={66.5} y1={y + 8.5 + (i === 0 ? 22 : 0)} x2={313.5} y2={y + 8.5 + (i === 0 ? 22 : 0)} stroke={LINEA} />}
                    </g>
                )
            })}
            {/* Fila desplegada: sus últimos pedidos y el link al perfil */}
            <rect x={70.5} y={80.5} width={240} height={20} rx={2} fill={BLOQUE} />
            <Rotulo x={76} y={88} size={4.6}>Últimos pedidos:</Rotulo>
            <Rotulo x={116} y={88} size={4.6} fuerte>#34</Rotulo>
            <Rotulo x={128} y={88} size={4.6}>$ 4.900 · hoy</Rotulo>
            <Rotulo x={166} y={88} size={4.6} fuerte>#21</Rotulo>
            <Rotulo x={178} y={88} size={4.6}>$ 6.100 · 02/09</Rotulo>
            <Rotulo x={76} y={97} size={4.8} fuerte color={ACENTO}>Ver perfil completo →</Rotulo>
            <Rotulo x={309} y={174} size={4.4} derecha color={SUTIL}>1-5 de 128</Rotulo>
            <Callout n={1} x={62} y={70} />
            <Callout n={2} x={196} y={52} />
            <Callout n={3} x={309} y={71} />
            <Callout n={4} x={300} y={108} />
            <Callout n={5} x={313} y={19} />
            <Callout n={6} x={215} y={19} />
        </Panel>
    )
}

/** Productos: los cinco números del catálogo, los filtros, la grilla con estado y stock, y los botones. */
function Productos() {
    const stats: [string, string][] = [['Total', '48'], ['Publicados', '41'], ['Sin stock', '3'], ['No publicados', '7'], ['Valor de inventario', '$ 1.240.000']]
    const productos: { n: string; e: string; tono: Tono; p: string; s: string }[] = [
        { n: 'Remera básica', e: 'Publicado', tono: 'ok', p: '$ 4.900', s: '12 u.' },
        { n: 'Gorra negra', e: 'Sin stock', tono: 'aviso', p: '$ 3.200', s: '0 u.' },
        { n: 'Buzo oversize', e: 'Publicado', tono: 'ok', p: '$ 12.300', s: '5 u.' },
        { n: 'Pantalón cargo', e: 'Borrador', tono: 'neutro', p: '$ 9.800', s: '8 u.' },
        { n: 'Zapatillas urbanas', e: 'Publicado', tono: 'ok', p: '$ 24.900', s: '3 u.' },
        { n: 'Campera puffer', e: 'Publicado', tono: 'ok', p: '$ 38.000', s: '2 u.' },
        { n: 'Medias x3', e: 'Publicado', tono: 'ok', p: '$ 2.150', s: '40 u.' },
        { n: 'Riñonera', e: 'Sin stock', tono: 'aviso', p: '$ 6.400', s: '0 u.' },
    ]
    return (
        <Panel activo="productos" abierto="productos" sub="Lista de productos" miga={['Catálogo']}>
            <Rotulo x={66} y={31} size={8} fuerte>Productos</Rotulo>
            <Boton x={204} y={22} w={50} label="Exportar Excel" size={5.2} />
            <Boton x={258} y={22} w={56} label="Crear producto" primario size={5.2} />
            {stats.map(([label, valor], i) => (
                <g key={label}>
                    <Tarjeta x={66 + i * 50.25} y={36} w={47} h={22} />
                    <Rotulo x={70 + i * 50.25} y={43.5} size={4.4}>{label}</Rotulo>
                    <Rotulo x={70 + i * 50.25} y={54} size={i === 4 ? 5.6 : 6.5} fuerte>{valor}</Rotulo>
                </g>
            ))}
            {/* Filtros: buscar, estado, orden, grilla o tabla */}
            <Campo x={66} y={63} w={90} placeholder="Buscar producto" size={5} />
            <Campo x={160} y={63} w={44} valor="Todos" size={5} />
            <path d="M 196 67 l 2.5 2.5 l 2.5 -2.5" fill="none" stroke={TENUE} strokeWidth={0.9} />
            <Campo x={208} y={63} w={54} valor="Más vendidos" size={5} />
            <path d="M 254 67 l 2.5 2.5 l 2.5 -2.5" fill="none" stroke={TENUE} strokeWidth={0.9} />
            <Pastilla x={266} y={63} w={22} h={10} label="Grilla" activa size={4.6} />
            <Pastilla x={290} y={63} w={24} h={10} label="Tabla" size={4.6} />
            {/* La grilla */}
            {productos.map((p, i) => {
                const x = 66 + (i % 4) * 63
                const y = 79 + Math.floor(i / 4) * 51
                return (
                    <g key={p.n}>
                        <Tarjeta x={x} y={y} w={59} h={47} />
                        <Caja x={x + 3} y={y + 3} w={53} h={16} r={2} stroke={null} />
                        <Pastilla x={x + 3} y={y + 22} w={p.e.length * 3.2 + 8} h={7} label={p.e} tono={p.tono} size={3.9} />
                        <Rotulo x={x + 4} y={y + 36} size={4.8} fuerte>{p.n}</Rotulo>
                        <Rotulo x={x + 4} y={y + 43.5} size={5} color={TEXTO}>{p.p}</Rotulo>
                        {/* Stock con subrayado punteado: clickeable, se edita sin abrir el producto */}
                        <Rotulo x={x + 56} y={y + 43.5} size={4.6} derecha color={p.s === '0 u.' ? TONOS.aviso.fg : TENUE}>{p.s}</Rotulo>
                        <line x1={x + 56 - p.s.length * 2.5} y1={y + 45} x2={x + 56} y2={y + 45} stroke={TENUE} strokeDasharray="1 1" strokeWidth={0.8} />
                    </g>
                )
            })}
            <Callout n={1} x={63} y={47} />
            <Callout n={2} x={313} y={19} />
            <Callout n={3} x={63} y={68} />
            <Callout n={4} x={104} y={128} />
            <Callout n={5} x={167} y={104} />
            <Callout n={6} x={201} y={19} />
        </Panel>
    )
}

/** Mensajes: la bandeja con los no leídos, el punto rojo del menú, la mención con #, los atajos y el campo. */
function Chat() {
    const convs: { n: string; m: string; noLeido?: boolean }[] = [
        { n: 'Lucía Pérez', m: '¿Cuándo llega el #33?', noLeido: true },
        { n: 'Martín Sosa', m: 'Genial, gracias!' },
        { n: 'Ana Ruiz', m: '¿Tenés talle M?', noLeido: true },
        { n: 'Julián Díaz', m: 'Listo, ya pagué' },
        { n: 'Carla Molina', m: '¿Hacen envíos a Córdoba?' },
    ]
    return (
        <Panel activo="mensajes" abierto="mensajes" sub="Bandeja" miga={['Mensajes']} noLeidos>
            {/* La bandeja */}
            <Tarjeta x={66} y={22} w={94} h={156} />
            <Rotulo x={71} y={31} size={6} fuerte>Bandeja</Rotulo>
            <line x1={66.5} y1={36.5} x2={159.5} y2={36.5} stroke={LINEA} />
            {convs.map((c, i) => {
                const y = 40 + i * 22
                return (
                    <g key={c.n}>
                        {i === 0 && <rect x={67} y={y - 1} width={92} height={21} fill={BLOQUE} />}
                        <Avatar cx={77} cy={y + 8} r={5} inicial={c.n.charAt(0)} size={4.6} />
                        <Rotulo x={86} y={y + 6} size={5} fuerte={c.noLeido}>{c.n}</Rotulo>
                        <Rotulo x={86} y={y + 13} size={4.2} color={c.noLeido ? TEXTO : SUTIL}>{c.m}</Rotulo>
                        {c.noLeido && <circle cx={154} cy={y + 5} r={2} fill={TONOS.error.fg} />}
                        {i < convs.length - 1 && <line x1={70.5} y1={y + 19.5} x2={155.5} y2={y + 19.5} stroke={LINEA} />}
                    </g>
                )
            })}
            {/* El chat abierto */}
            <Tarjeta x={164} y={22} w={150} h={156} />
            <Avatar cx={173} cy={30} r={5} inicial="L" size={4.6} />
            <Rotulo x={181} y={29} size={5.5} fuerte>Lucía Pérez</Rotulo>
            <Rotulo x={181} y={35} size={4.2} color={SUTIL}>lucia@mail.com</Rotulo>
            <Boton x={226} y={25} w={22} h={9} label="Perfil" size={4.4} />
            <Boton x={250} y={25} w={32} h={9} label="Pedido #33" size={4.4} />
            <Boton x={284} y={25} w={27} h={9} label="Archivar" size={4.4} />
            <line x1={164.5} y1={38.5} x2={313.5} y2={38.5} stroke={LINEA} />
            {/* Mensaje del cliente, con el pedido mencionado */}
            <rect x={170.5} y={44.5} width={90} height={19} rx={4} fill={BLOQUE} />
            <text x={175} y={51.5} style={{ ...fuente, fontSize: 4.6, fill: TEXTO }}>
                Hola! Hice el pedido <tspan fill={ACENTO} fontWeight={600}>#33</tspan>,
            </text>
            <Rotulo x={175} y={58.5} size={4.6} color={TEXTO}>¿cuándo llega?</Rotulo>
            {/* Tu respuesta */}
            <rect x={198.5} y={69.5} width={110} height={19} rx={4} fill={ACENTO_BG} stroke={ACENTO} strokeOpacity={0.4} />
            <Rotulo x={203} y={76.5} size={4.6} color={TEXTO}>Sale mañana por Andreani,</Rotulo>
            <Rotulo x={203} y={83.5} size={4.6} color={TEXTO}>te paso el seguimiento.</Rotulo>
            <rect x={170.5} y={94.5} width={56} height={11} rx={4} fill={BLOQUE} />
            <Rotulo x={175} y={102} size={4.6} color={TEXTO}>Genial, gracias!</Rotulo>
            {/* Al escribir #, aparece el selector de pedidos */}
            <Tarjeta x={170} y={130} w={92} h={22} />
            <Rotulo x={175} y={138} size={4.4} fuerte>#34</Rotulo>
            <Rotulo x={188} y={138} size={4.4}>Lucía Pérez · $ 4.900 · hoy</Rotulo>
            <Rotulo x={175} y={147} size={4.4} fuerte>#33</Rotulo>
            <Rotulo x={188} y={147} size={4.4}>Lucía Pérez · $ 12.300 · ayer</Rotulo>
            <Campo x={170} y={158} w={104} valor="#" size={5} />
            <rect x={278.5} y={158.5} width={14} height={10} rx={2} fill={SUPERFICIE} stroke={LINEA_FUERTE} />
            {[161.5, 163.5, 165.5].map(y => <line key={y} x1={281.5} y1={y} x2={289.5} y2={y} stroke={TENUE} strokeWidth={0.8} />)}
            <rect x={296.5} y={158.5} width={14} height={10} rx={2} fill={ACENTO} />
            <path d="M 300 163.5 h 7 m -2.5 -2.5 l 2.5 2.5 l -2.5 2.5" fill="none" stroke={SOBRE_ACENTO} strokeWidth={0.9} strokeLinecap="round" />
            <Callout n={1} x={154} y={43} />
            <Callout n={2} x={50} y={72} />
            <Callout n={3} x={265} y={138} />
            <Callout n={4} x={247} y={20} />
            <Callout n={5} x={313} y={20} />
            <Callout n={6} x={285} y={176} />
        </Panel>
    )
}

/** Cupones: pestañas del módulo, código, límites, estado y el menú de tres puntitos con Compartir. */
function Cupon() {
    const cupones: { c: string; d: string; u: string; v: string; e: string; tono: Tono; privado?: boolean }[] = [
        { c: 'BIENVENIDA10', d: '10 %', u: '12 / 100', v: 'hasta 30/09', e: 'Activo', tono: 'ok' },
        { c: 'INSTA15', d: '15 %', u: '3 / 50', v: 'desde 25/09', e: 'Programado', tono: 'info', privado: true },
        { c: 'VUELVE20', d: '20 %', u: '8 / ∞', v: 'sin venc.', e: 'Activo', tono: 'ok' },
        { c: 'PROMO2000', d: '− $ 2.000', u: '50 / 50', v: 'hasta 20/09', e: 'Agotado', tono: 'aviso' },
        { c: 'AMIGO5', d: '5 %', u: '0 / 20', v: 'sin venc.', e: 'Inactivo', tono: 'neutro' },
        { c: 'INVIERNO', d: '25 %', u: '40 / 40', v: 'venció 31/08', e: 'Expirado', tono: 'neutro' },
    ]
    return (
        <Panel activo="descuentos" abierto="descuentos" sub="Cupones" miga={['Descuentos', 'Cupones']}>
            <Pastilla x={66} y={23} w={40} label="Descuentos" size={5} />
            <Pastilla x={108} y={23} w={34} label="Cupones" activa size={5} />
            <Pastilla x={144} y={23} w={42} label="Rendimiento" size={5} />
            <Boton x={262} y={22} w={52} label="Nuevo cupón" primario size={5.2} />
            <Tarjeta x={66} y={38} w={248} h={132} />
            <Rotulo x={72} y={46} size={4.6} color={SUTIL}>Código</Rotulo>
            <Rotulo x={130} y={46} size={4.6} color={SUTIL}>Descuento</Rotulo>
            <Rotulo x={166} y={46} size={4.6} color={SUTIL}>Usos</Rotulo>
            <Rotulo x={200} y={46} size={4.6} color={SUTIL}>Vigencia</Rotulo>
            <Rotulo x={248} y={46} size={4.6} color={SUTIL}>Estado</Rotulo>
            <line x1={66.5} y1={49.5} x2={313.5} y2={49.5} stroke={LINEA} />
            {cupones.map((c, i) => {
                const y = 58 + i * 15
                return (
                    <g key={c.c}>
                        <rect x={71.5} y={y - 6} width={c.c.length * 3.3 + 6} height={9} rx={2} fill={BLOQUE} />
                        <Rotulo x={74.5} y={y + 0.5} size={4.8} fuerte>{c.c}</Rotulo>
                        {c.privado && <Rotulo x={103} y={y + 0.5} size={3.8} color={SUTIL}>privado</Rotulo>}
                        <Rotulo x={130} y={y + 0.5} size={5} color={TEXTO}>{c.d}</Rotulo>
                        <Rotulo x={166} y={y + 0.5} size={4.8}>{c.u}</Rotulo>
                        <Rotulo x={200} y={y + 0.5} size={4.8}>{c.v}</Rotulo>
                        <Pastilla x={248} y={y - 6} w={36} h={8} label={c.e} tono={c.tono} size={4.2} />
                        {[-3, 0, 3].map(d => <circle key={d} cx={306} cy={y - 2 + d} r={0.8} fill={TENUE} />)}
                        {i < cupones.length - 1 && <line x1={66.5} y1={y + 6.5} x2={313.5} y2={y + 6.5} stroke={LINEA} />}
                    </g>
                )
            })}
            {/* El menú de tres puntitos del primer cupón, abierto */}
            <rect x={252.5} y={62.5} width={60} height={54} rx={3} fill={SUPERFICIE} stroke={LINEA_FUERTE} />
            {(['Desactivar', 'Duplicar', 'Editar', 'Compartir', 'Eliminar'] as const).map((op, i) => (
                <Rotulo key={op} x={258} y={72 + i * 9.6} size={4.8} color={op === 'Compartir' ? ACENTO : op === 'Eliminar' ? TONOS.error.fg : TEXTO} fuerte={op === 'Compartir'}>{op}</Rotulo>
            ))}
            <Callout n={1} x={191} y={27.5} />
            <Callout n={2} x={62} y={58} />
            <Callout n={3} x={187} y={44} />
            <Callout n={4} x={240} y={58} />
            <Callout n={5} x={306} y={49} />
            <Callout n={6} x={300} y={99} />
        </Panel>
    )
}

/** Compartir un cupón: la ventana con el link (copiar, activar) y el envío por email. */
function Compartir() {
    return (
        <>
            {/* El panel de fondo, atenuado: la ventana flota sobre Cupones */}
            <g opacity={0.35}>
                <Panel activo="descuentos" abierto="descuentos" sub="Cupones" miga={['Descuentos', 'Cupones']}>
                    <Tarjeta x={66} y={38} w={248} h={132} />
                    {[0, 1, 2, 3, 4, 5].map(i => (
                        <g key={i}>
                            <Texto x={72} y={56 + i * 15} w={36} fuerte />
                            <Texto x={130} y={56 + i * 15} w={16} />
                            <Texto x={166} y={56 + i * 15} w={20} />
                            <Texto x={200} y={56 + i * 15} w={30} />
                            <Texto x={248} y={56 + i * 15} w={28} />
                        </g>
                    ))}
                </Panel>
            </g>
            <rect x={0.5} y={0.5} width={319} height={183} rx={4} fill={FONDO} opacity={0.5} />
            {/* La ventana */}
            <rect x={50.5} y={8.5} width={220} height={168} rx={4} fill={SUPERFICIE} stroke={LINEA_FUERTE} />
            <Rotulo x={60} y={21} size={7} fuerte>Compartir cupón</Rotulo>
            <Rotulo x={60} y={28.5} size={4.6}>BIENVENIDA10 · 10 % de descuento</Rotulo>
            <path d="M 258 15 l 6 6 m 0 -6 l -6 6" fill="none" stroke={TENUE} strokeWidth={1} strokeLinecap="round" />
            {/* 1 · El link */}
            <Rotulo x={60} y={41} size={5.5} fuerte>URL del link</Rotulo>
            <Campo x={60} y={45} w={150} h={11} valor="ramatienda.orbita.site/c/BIENVENIDA10" size={4.6} />
            <Boton x={214} y={45} w={46} h={11} label="Copiar" size={5} />
            <Pastilla x={60} y={62} w={32} h={8} label="Inactivo" tono="neutro" size={4.4} />
            <path d="M 98 66 a 2 2 0 0 1 3 -1.5 m 3 0 a 2 2 0 0 1 -3 1.5" fill="none" stroke={ACENTO} strokeWidth={0.9} />
            <Rotulo x={106} y={68.3} size={5} fuerte color={ACENTO}>Activar link</Rotulo>
            <line x1={60.5} y1={80.5} x2={260.5} y2={80.5} stroke={LINEA} />
            {/* 2 · Enviar por email */}
            <Rotulo x={60} y={92} size={5.5} fuerte>Enviar por email</Rotulo>
            <path d="M 254 88 l 3 3 l 3 -3" fill="none" stroke={TENUE} strokeWidth={0.9} />
            <Campo x={60} y={97} w={200} h={11} placeholder="Email del destinatario" size={5} />
            <Campo x={60} y={113} w={200} h={11} placeholder="Nombre (opcional)" size={5} />
            <Boton x={60} y={129} w={40} h={11} label="Enviar" primario size={5} />
            <Rotulo x={60} y={153} size={4.4}>El mail lo arma y lo manda Órbita: sale con el valor del cupón,</Rotulo>
            <Rotulo x={60} y={160} size={4.4}>el saludo y un botón que lleva a tu tienda con el descuento puesto.</Rotulo>
            <Callout n={1} x={52} y={50} />
            <Callout n={2} x={263} y={42} />
            <Callout n={3} x={146} y={66} />
            <Callout n={4} x={52} y={102} />
            <Callout n={5} x={52} y={118} />
            <Callout n={6} x={108} y={134} />
        </>
    )
}

/** Reportes: las cinco pestañas, el período, el gráfico y el atajo desde el menú de la izquierda. */
function Reportes() {
    const barras = [42, 66, 30, 78, 54, 88, 62, 40, 70, 52, 84, 60, 74]
    const kpis: [string, string, string][] = [['Facturación', '$ 1.284.000', '+18 %'], ['Pedidos', '312', '+9 %'], ['Ticket promedio', '$ 4.115', '+3 %']]
    return (
        <Panel activo="productos" abierto="productos" miga={['Reportes']}>
            <Pastilla x={66} y={23} w={32} label="Ventas" activa size={5} />
            <Pastilla x={100} y={23} w={36} label="Productos" size={5} />
            <Pastilla x={138} y={23} w={34} label="Clientes" size={5} />
            <Pastilla x={174} y={23} w={38} label="Inventario" size={5} />
            <Pastilla x={214} y={23} w={28} label="Pagos" size={5} />
            <Campo x={248} y={23} w={66} valor="Últimos 30 días" size={4.8} />
            <path d="M 305 27 l 2.5 2.5 l 2.5 -2.5" fill="none" stroke={TENUE} strokeWidth={0.9} />
            {kpis.map(([label, valor, delta], i) => (
                <g key={label}>
                    <Tarjeta x={66 + i * 84} y={38} w={80} h={22} />
                    <Rotulo x={70 + i * 84} y={45.5} size={4.4}>{label}</Rotulo>
                    <Rotulo x={70 + i * 84} y={55.5} size={6.5} fuerte>{valor}</Rotulo>
                    <Rotulo x={142 + i * 84} y={55.5} size={4.4} derecha fuerte color={TONOS.ok.fg}>{delta}</Rotulo>
                </g>
            ))}
            <Tarjeta x={66} y={65} w={248} h={113} />
            <Rotulo x={71} y={74} size={5.5} fuerte>Ventas por día</Rotulo>
            <rect x={262} y={69.5} width={6} height={4} rx={1} fill={ACENTO} opacity={0.5} />
            <Rotulo x={271} y={73.5} size={4.2}>vs. período anterior</Rotulo>
            {barras.map((h, i) => (
                <g key={i}>
                    <rect x={76 + i * 18} y={164 - h * 0.9} width={12} height={h * 0.9} rx={1.5} fill={ACENTO} opacity={i === barras.length - 1 ? 0.9 : 0.45} />
                    {/* El período anterior, como referencia finita al lado */}
                    <rect x={76 + i * 18 + 12.5} y={164 - h * 0.7} width={2} height={h * 0.7} rx={1} fill={TENUE} opacity={0.35} />
                    {i % 2 === 0 && <Rotulo x={82 + i * 18} y={171.5} size={3.8} centro color={SUTIL}>{`${1 + i * 2}/9`}</Rotulo>}
                </g>
            ))}
            <line x1={71.5} y1={164.5} x2={308.5} y2={164.5} stroke={LINEA} />
            <Callout n={1} x={63} y={27} />
            <Callout n={2} x={313} y={19} />
            <Callout n={3} x={63} y={66} />
            <Callout n={4} x={245} y={28} />
            <Callout n={5} x={61} y={103} />
        </Panel>
    )
}

/** Configuración: el menú principal colapsado, el menú propio, la sección Negocio y Guardar cambios. */
function Config() {
    // Grupos del menú propio (ConfigSidebar.tsx). El separador va entre grupos.
    const grupos: string[][] = [
        ['Suscripción'],
        ['Negocio', 'Contacto', 'Pagos', 'Envíos', 'Redes sociales', 'Dominios', 'Canc. y devol.'],
        ['Apariencia', 'Equipo', 'Notificaciones', 'Registro de actividad'],
        ['Soporte'],
        ['Zona peligrosa'],
    ]
    const items: ReactElement[] = []
    let y = 27
    grupos.forEach((g, gi) => {
        if (gi > 0) {
            items.push(<line key={`sep-${gi}`} x1={30.5} y1={y - 1.5} x2={92.5} y2={y - 1.5} stroke={LINEA} />)
            y += 2
        }
        for (const label of g) {
            const activo = label === 'Negocio'
            const peligro = label === 'Zona peligrosa'
            items.push(
                <g key={label}>
                    {activo && <rect x={28.5} y={y - 6.5} width={64} height={9.5} rx={2} fill={ACENTO_BG} />}
                    <Icono x={31} y={y - 4.5} s={3.5} color={activo ? ACENTO : peligro ? TONOS.error.fg : TENUE} opacity={activo || peligro ? 1 : 0.55} />
                    <Rotulo x={37} y={y} size={5} fuerte={activo} color={activo ? ACENTO : peligro ? TONOS.error.fg : TEXTO}>{label}</Rotulo>
                </g>,
            )
            y += 10.5
        }
    })
    return (
        <Panel colapsado activo="config" miga={['Configuración', 'Negocio']}>
            {/* El menú propio de Configuración */}
            <rect x={21} y={17} width={76} height={166.5} fill={SUPERFICIE} />
            <line x1={96.5} y1={17} x2={96.5} y2={183.5} stroke={LINEA} />
            {items}
            {/* La sección Negocio */}
            <Rotulo x={104} y={32} size={7} fuerte>Negocio</Rotulo>
            <Rotulo x={104} y={39.5} size={4.4}>Lo que ven tus clientes y lo que usa el envío para calcular distancias.</Rotulo>
            <Rotulo x={104} y={51} size={4.6}>Nombre del negocio</Rotulo>
            <Campo x={104} y={54} w={140} valor="Rama Tienda" size={5} />
            <Rotulo x={104} y={73} size={4.6}>Rubro</Rotulo>
            <Campo x={104} y={76} w={140} valor="Indumentaria" size={5} />
            <path d="M 236 80 l 2.5 2.5 l 2.5 -2.5" fill="none" stroke={TENUE} strokeWidth={0.9} />
            <Rotulo x={104} y={95} size={4.6}>Dirección del local</Rotulo>
            <Campo x={104} y={98} w={140} valor="Av. Corrientes 1234, CABA" size={5} />
            {/* El mapa para marcar el punto exacto */}
            <Caja x={250} y={54} w={64} h={54} r={3} />
            {[262, 274, 286, 298].map(x => <line key={x} x1={x + 0.5} y1={54.5} x2={x + 0.5} y2={108.5} stroke={LINEA} />)}
            {[66, 78, 90, 102].map(yy => <line key={yy} x1={250.5} y1={yy + 0.5} x2={314.5} y2={yy + 0.5} stroke={LINEA} />)}
            <path d="M 282 88 c -4 -5 -6 -8 -6 -11 a 6 6 0 0 1 12 0 c 0 3 -2 6 -6 11 z" fill={ACENTO} />
            <circle cx={282} cy={77} r={2} fill={SOBRE_ACENTO} />
            <Boton x={104} y={118} w={60} label="Guardar cambios" primario size={5.2} />
            <Callout n={1} x={13} y={52} />
            <Callout n={2} x={93} y={25} />
            <Callout n={3} x={313} y={22} />
            <Callout n={4} x={171} y={124} />
            <Callout n={5} x={88} y={171} />
        </Panel>
    )
}

/** Avanzado: las tarjetas por función, el candado, "Ver qué incluye", las plantillas y el interruptor. */
function Avanzado() {
    const funciones: { t: string; d1: string; d2: string }[] = [
        { t: 'Juegos con premio', d1: 'Encestar o meter un gol:', d2: 'descuento por acierto.' },
        { t: 'Modales de anuncios', d1: 'Avisos grandes en tu tienda,', d2: 'en el momento justo.' },
        { t: '2x1 y 3x2', d1: 'Llevá X, pagá Y: se arma', d2: 'solo en el carrito.' },
        { t: 'Plantillas de Home', d1: 'Diseños alternativos', d2: 'para la portada.' },
        { t: 'Prueba social', d1: '"Fulano compró tal producto",', d2: 'con pedidos reales.' },
        { t: 'Oferta relámpago', d1: 'Un % que termina a una hora,', d2: 'con reloj en la portada.' },
    ]
    return (
        <Panel activo="avanzado" miga={['Avanzado']}>
            <rect x={66.5} y={22.5} width={248} height={22} rx={3} fill={ACENTO_BG} stroke={ACENTO} strokeOpacity={0.4} />
            <Rotulo x={72} y={31} size={6} fuerte>Paquete Avanzado</Rotulo>
            <Rotulo x={72} y={39} size={4.6}>Se paga aparte de tu suscripción mensual. Todavía no está activo en tu negocio.</Rotulo>
            <Boton x={258} y={27} w={52} h={12} label="Ver qué incluye" primario size={5} />
            {funciones.map((f, i) => {
                const x = 66 + (i % 3) * 84
                const y = 50 + Math.floor(i / 3) * 66
                return (
                    <g key={f.t}>
                        <Tarjeta x={x} y={y} w={80} h={62} />
                        <rect x={x + 5.5} y={y + 5.5} width={11} height={11} rx={3} fill={ACENTO_BG} />
                        <Icono x={x + 9} y={y + 9} s={4} color={ACENTO} opacity={0.9} />
                        <Candado x={x + 66} y={y + 4} />
                        <Rotulo x={x + 5} y={y + 27} size={5.2} fuerte>{f.t}</Rotulo>
                        <Rotulo x={x + 5} y={y + 35} size={4.3}>{f.d1}</Rotulo>
                        <Rotulo x={x + 5} y={y + 41.5} size={4.3}>{f.d2}</Rotulo>
                        {f.t === 'Plantillas de Home' && <Rotulo x={x + 5} y={y + 54} size={4.8} fuerte color={ACENTO}>Ver cómo queda →</Rotulo>}
                        {f.t === 'Oferta relámpago' && (
                            <g>
                                <rect x={x + 5.5} y={y + 47.5} width={16} height={8} rx={4} fill={BLOQUE} stroke={LINEA_FUERTE} />
                                <circle cx={x + 9.5} cy={y + 51.5} r={3} fill={SUPERFICIE} stroke={LINEA_FUERTE} />
                                <Rotulo x={x + 25} y={y + 54} size={4.6}>Apagada</Rotulo>
                            </g>
                        )}
                        {f.t !== 'Plantillas de Home' && f.t !== 'Oferta relámpago' && <Rotulo x={x + 5} y={y + 54} size={4.8} fuerte color={TENUE}>Configurar →</Rotulo>}
                    </g>
                )
            })}
            <Callout n={1} x={63} y={49} />
            <Callout n={2} x={147} y={59} />
            <Callout n={3} x={313} y={20} />
            <Callout n={4} x={126} y={168} />
            <Callout n={5} x={296} y={166} />
        </Panel>
    )
}

/** Mi perfil: el menú del avatar, "Ir a la tienda", el código de 6 números, el tema y la contraseña. */
function Perfil() {
    return (
        <Panel miga={['Mi perfil']}>
            <Rotulo x={66} y={31} size={8} fuerte>Mi perfil</Rotulo>
            {/* Tus datos */}
            <Tarjeta x={66} y={38} w={178} h={32} />
            <Avatar cx={80} cy={54} r={9} inicial="R" size={7} />
            <Rotulo x={94} y={51} size={6} fuerte>Ramiro Gómez</Rotulo>
            <Rotulo x={94} y={59} size={4.6}>ramiro@ramatienda.com</Rotulo>
            <Pastilla x={168} y={53} w={40} h={8} label="Sin confirmar" tono="aviso" size={4.2} />
            <Rotulo x={94} y={66} size={4.4} color={SUTIL}>Propietario · Rama Tienda</Rotulo>
            {/* Confirmar el email */}
            <Tarjeta x={66} y={75} w={178} h={36} />
            <Rotulo x={71} y={84} size={5.5} fuerte>Confirmar tu email</Rotulo>
            <Rotulo x={71} y={91} size={4.4}>Te mandamos un código de 6 números. Tenés 14 días.</Rotulo>
            <Boton x={71} y={95} w={60} h={10} label="Enviarme el código" size={4.8} />
            {[0, 1, 2, 3, 4, 5].map(i => (
                <g key={i}>
                    <rect x={138.5 + i * 12} y={94.5} width={10} height={12} rx={2} fill={i < 2 ? BLOQUE : SUPERFICIE} stroke={i === 2 ? ACENTO : LINEA_FUERTE} />
                    {i < 2 && <Rotulo x={143.5 + i * 12} y={103} size={6} centro fuerte>{i === 0 ? '4' : '8'}</Rotulo>}
                </g>
            ))}
            {/* Apariencia */}
            <Tarjeta x={66} y={116} w={178} h={34} />
            <Rotulo x={71} y={125} size={5.5} fuerte>Apariencia</Rotulo>
            {(['Claro', 'Oscuro', 'Sistema'] as const).map((t, i) => (
                <g key={t}>
                    <rect x={71.5 + i * 40} y={129.5} width={36} height={17} rx={2.5} fill={SUPERFICIE} stroke={i === 0 ? ACENTO : LINEA} />
                    <rect x={74.5 + i * 40} y={132.5} width={30} height={7} rx={1.5} fill={t === 'Oscuro' ? TEXTO : t === 'Sistema' ? TENUE : BLOQUE} opacity={t === 'Claro' ? 1 : 0.8} />
                    <Rotulo x={89.5 + i * 40} y={145} size={4.2} centro fuerte={i === 0} color={i === 0 ? ACENTO : TENUE}>{t}</Rotulo>
                </g>
            ))}
            <Rotulo x={66} y={162} size={4.4}>El tema queda guardado en tu cuenta, no en el navegador.</Rotulo>
            {/* Contraseña */}
            <Tarjeta x={250} y={60} w={64} h={90} />
            <Rotulo x={255} y={69} size={5.2} fuerte>Contraseña</Rotulo>
            <Rotulo x={255} y={78} size={4.2}>Actual</Rotulo>
            <Campo x={255} y={80} w={54} h={9} valor="••••••••" size={4.6} />
            <Rotulo x={255} y={97} size={4.2}>Nueva</Rotulo>
            <Campo x={255} y={99} w={54} h={9} valor="••••••••••" size={4.6} />
            <Rotulo x={255} y={116} size={4.2}>Repetir</Rotulo>
            <Campo x={255} y={118} w={54} h={9} valor="••••••••••" size={4.6} />
            <Boton x={255} y={133} w={54} h={10} label="Cambiar" size={4.8} />
            {/* El menú del avatar, abierto */}
            <rect x={250.5} y={18.5} width={64} height={36} rx={3} fill={SUPERFICIE} stroke={LINEA_FUERTE} />
            <Rotulo x={256} y={27.5} size={4.8} fuerte color={ACENTO}>Mi perfil</Rotulo>
            <Rotulo x={256} y={38} size={4.8} color={TEXTO}>Ir a la tienda</Rotulo>
            <line x1={250.5} y1={42.5} x2={314.5} y2={42.5} stroke={LINEA} />
            <Rotulo x={256} y={50.5} size={4.8} color={TONOS.error.fg}>Cerrar sesión</Rotulo>
            <Callout n={1} x={247} y={21} />
            <Callout n={2} x={309} y={37} />
            <Callout n={3} x={216} y={100} />
            <Callout n={4} x={196} y={138} />
            <Callout n={5} x={313} y={62} />
        </Panel>
    )
}

/** Si te trabás: Orbi (botón, Ctrl+K, sugerencias, datos de tu negocio) y el tutorial de Primeros pasos. */
function Orbi() {
    return (
        <Panel activo="dashboard" miga={['Inicio']}>
            {/* El Inicio, atenuado detrás del panel de Orbi */}
            <g opacity={0.4}>
                {[0, 1].map(i => (
                    <g key={i}>
                        <Tarjeta x={66 + i * 66} y={36} w={62} h={29} />
                        <Texto x={70 + i * 66} y={41} w={20} />
                        <Texto x={70 + i * 66} y={49} w={32} fuerte />
                    </g>
                ))}
                <Tarjeta x={66} y={70} w={134} h={57} />
                <Texto x={71} y={75} w={44} fuerte />
                <Linea x={73} y={85} w={120} h={32} valores={[30, 44, 26, 52, 38, 60, 48]} />
            </g>
            {/* Primeros pasos: el tutorial guiado */}
            <Tarjeta x={66} y={132} w={134} h={46} />
            <Rotulo x={71} y={141} size={5.5} fuerte>Primeros pasos</Rotulo>
            <Rotulo x={195} y={141} size={4.4} derecha>3 de 7</Rotulo>
            <rect x={71.5} y={144.5} width={124} height={3} rx={1.5} fill={BLOQUE} />
            <rect x={71.5} y={144.5} width={53} height={3} rx={1.5} fill={ACENTO} />
            {(['Confirmá tu email', 'Completá los datos del negocio', 'Conectá Mercado Pago', 'Armá tus categorías'] as const).map((p, i) => (
                <g key={p}>
                    <circle cx={75} cy={154 + i * 6.5} r={2.2} fill={i < 3 ? ACENTO : SUPERFICIE} stroke={i < 3 ? 'none' : LINEA_FUERTE} />
                    {i < 3 && <path d={`M 73.6 ${154 + i * 6.5} l 1 1 l 2 -2.2`} fill="none" stroke={SOBRE_ACENTO} strokeWidth={0.8} />}
                    <Rotulo x={80} y={155.7 + i * 6.5} size={4.4} color={i < 3 ? SUTIL : TEXTO}>{p}</Rotulo>
                </g>
            ))}
            {/* El panel de Orbi, pegado a la derecha */}
            <path d="M 210.5 0.5 h 105 a 4 4 0 0 1 4 4 v 175 a 4 4 0 0 1 -4 4 h -105 z" fill={SUPERFICIE} stroke={LINEA_FUERTE} />
            <circle cx={220} cy={11} r={4} fill="none" stroke={ACENTO} />
            <circle cx={220} cy={11} r={1.5} fill={ACENTO} />
            <ellipse cx={220} cy={11} rx={6.5} ry={2.5} fill="none" stroke={ACENTO} strokeOpacity={0.5} transform="rotate(-24 220 11)" />
            <Rotulo x={228} y={13.5} size={6.5} fuerte>Orbi</Rotulo>
            <rect x={268.5} y={6.5} width={24} height={9} rx={2} fill={BLOQUE} stroke={LINEA} />
            <Rotulo x={280.5} y={12.7} size={4.4} centro color={TEXTO}>Ctrl+K</Rotulo>
            <path d="M 305 8 l 5 5 m 0 -5 l -5 5" fill="none" stroke={TENUE} strokeWidth={0.9} strokeLinecap="round" />
            <line x1={210.5} y1={20.5} x2={319.5} y2={20.5} stroke={LINEA} />
            <Rotulo x={216} y={31} size={6} fuerte>Hola, soy Orbi</Rotulo>
            <Rotulo x={216} y={38} size={4.4}>Te contesto con los datos de tu negocio.</Rotulo>
            <Pastilla x={216} y={44} w={72} h={9} label="¿Cuánto vendí esta semana?" size={4.2} />
            <Pastilla x={216} y={56} w={62} h={9} label="¿Qué pedidos tengo pendientes?" size={4.2} />
            <Pastilla x={216} y={68} w={56} h={9} label="¿Cómo creo un cupón?" size={4.2} />
            <rect x={236.5} y={84.5} width={76} height={11} rx={4} fill={ACENTO_BG} stroke={ACENTO} strokeOpacity={0.4} />
            <Rotulo x={241} y={92} size={4.4} color={TEXTO}>¿Cuánto vendí esta semana?</Rotulo>
            <rect x={216.5} y={101.5} width={94} height={40} rx={4} fill={BLOQUE} />
            <Rotulo x={221} y={109} size={4.4} color={TEXTO}>Esta semana vendiste:</Rotulo>
            <Tarjeta x={220} y={112} w={86} h={24} />
            <Rotulo x={225} y={123} size={7} fuerte>$ 128.400</Rotulo>
            <Rotulo x={225} y={131} size={4}>34 pedidos · +12 % vs. la semana pasada</Rotulo>
            <Rotulo x={221} y={150} size={4.4} fuerte color={ACENTO}>Ver en Reportes →</Rotulo>
            <Campo x={216} y={162} w={76} h={11} placeholder="Escribí un mensaje..." size={4.6} />
            <rect x={296.5} y={162.5} width={16} height={11} rx={2.5} fill={ACENTO} />
            <path d="M 301 168 h 7 m -2.5 -2.5 l 2.5 2.5 l -2.5 2.5" fill="none" stroke={SOBRE_ACENTO} strokeWidth={0.9} strokeLinecap="round" />
            <Callout n={1} x={60} y={165} />
            <Callout n={2} x={299} y={11} />
            <Callout n={3} x={294} y={48} />
            <Callout n={4} x={312} y={116} />
            <Callout n={5} x={206} y={167} />
            <Callout n={6} x={63} y={131} />
        </Panel>
    )
}

// ─── Registro ────────────────────────────────────────────────────────────────
//
// La leyenda y los callouts salen del mismo lugar: el callout n de un dibujo
// es la línea n (desde 1) de su leyenda. Si agregás o sacás un callout, tocá
// la leyenda en el mismo commit; no hay otra fuente de verdad.

interface Esquema {
    /** Va en el <title> del svg: lo que lee un lector de pantalla. */
    titulo: string
    /** Una línea por callout, en orden. */
    leyenda: string[]
    dibujo: ReactElement
}

const ESQUEMAS: Record<IlustracionId, Esquema> = {
    'panel-tienda': {
        titulo: 'A la izquierda el panel de administración, a la derecha la tienda que ve el cliente, y la flecha que los une.',
        leyenda: [
            'El panel: tu trastienda. Entrás con usuario y contraseña; no lo ve nadie más que vos y tu equipo.',
            'Tu tienda: pública, en tu dirección web. Es lo que ve tu cliente.',
            'Todo lo que tocás en el panel se refleja en la tienda al instante.',
            '"Publicar tienda", en el Inicio: hasta que no lo toques, nadie te puede comprar.',
            'Tu avatar: desde ahí, "Ir a la tienda" para verla como la ve un cliente.',
        ],
        dibujo: <PanelTienda />,
    },
    'layout-panel': {
        titulo: 'El panel con el menú de la izquierda desplegado en Pedidos y la barra de arriba con la miga, la búsqueda, la campana y el avatar.',
        leyenda: [
            'El buscador del menú: pedidos, clientes, productos y secciones, sin salir de ahí.',
            'El menú lateral: arriba el selector de espacio; cada módulo despliega sus sub-secciones. El puntito rojo en Mensajes es lo que te espera. Al pie, Orbi.',
            'La miga: en qué módulo y en qué pantalla estás.',
            'La búsqueda global: un pedido por número, un cliente, un producto o una sección del panel.',
            'La campana: lo que pasó mientras no estabas. A su izquierda, el modo oscuro.',
            'Tu avatar: Mi perfil, "Ir a la tienda" y Cerrar sesión.',
        ],
        dibujo: <LayoutPanel />,
    },
    kpis: {
        titulo: 'El Inicio: la tira de períodos, el botón Publicar tienda, los cinco números, el gráfico de la semana, el top y la actividad reciente.',
        leyenda: [
            'El período: Hoy, Semana, Mes o Personalizado. Todo lo de abajo responde a él.',
            '"Publicar tienda": mientras diga eso, la tienda está apagada. Al tocarlo pasa a "✓ Tienda online".',
            'Los cinco números: Ventas, Pedidos, Ticket promedio, Clientes nuevos y Comisión MP, cada uno comparado con el período anterior.',
            'Ventas de la semana: cuánto vendiste cada día. El ícono de la esquina lo abre grande.',
            'El top, con sus tres pestañas: Productos, Categorías y Canal.',
            'Actividad reciente: los últimos pedidos. Una fila te lleva al detalle; "Ver todos →", a la lista completa.',
        ],
        dibujo: <Kpis />,
    },
    alertas: {
        titulo: 'La tira de alertas del Inicio, debajo de los números: cuatro tarjetas con su botón Ir y el link Limpiar todas.',
        leyenda: [
            'La tira de alertas aparece debajo de los números solo si hay algo que resolver.',
            'Pedidos sin atender +2hs: la más urgente de todas, marcada en rojo.',
            'Productos con stock crítico: llegaron al mínimo que definiste. Te lleva a Productos.',
            '"Ir →": te deja parado en la pantalla donde se resuelve.',
            '"Limpiar todas": las saca de la vista hasta que vuelva a pasar algo.',
        ],
        dibujo: <Alertas />,
    },
    pedidos: {
        titulo: 'La lista de Pedidos: pestañas por estado con contador, búsqueda y filtro por fecha, filas con tilde y la barra para confirmar en lote.',
        leyenda: [
            'Las pestañas por estado, con el contador real de cada una.',
            '"Nuevo pedido": cargar una venta de mostrador, WhatsApp o teléfono.',
            'Clickeás la fila y se abre el detalle: productos, total, cliente, cómo pagó y cómo lo recibe.',
            'Tildás varios y los confirmás de una, desde la barra que aparece abajo.',
            'La búsqueda y el filtro por fecha achican la lista antes de operar.',
            '"Exportar CSV": baja lo que estás viendo, con los filtros aplicados.',
        ],
        dibujo: <Pedidos />,
    },
    clientes: {
        titulo: 'La lista de Clientes: una fila por persona con sus números, la primera desplegada con sus últimos pedidos, y los botones Exportar y Email masivo.',
        leyenda: [
            'Una fila por persona. La base se llena sola con cada venta: no hay que cargar nada.',
            'Sus números: Pedidos, Total gastado, Ticket promedio y Última compra.',
            'La flechita despliega sus últimos pedidos y el link "Ver perfil completo →".',
            'El sobre: le escribe a esa persona sola.',
            '"Email masivo": le escribe a toda la lista que estés viendo, con los filtros aplicados.',
            '"Exportar": baja toda tu base en CSV.',
        ],
        dibujo: <Clientes />,
    },
    productos: {
        titulo: 'La lista de Productos: los cinco números del catálogo, los filtros y la grilla de productos con su estado y su stock.',
        leyenda: [
            'Los cinco números: Total, Publicados, Sin stock, No publicados y Valor de inventario.',
            '"Crear producto": el alta, con nombre, fotos, precio, stock y categoría.',
            'Los filtros: buscar por nombre, ver solo un estado, ordenar, y elegir grilla o tabla.',
            'El stock, con subrayado punteado: tocalo y lo editás ahí mismo, sin abrir el producto.',
            'El estado: Publicado, Borrador o Sin stock (que pesa más que Publicado).',
            '"Exportar Excel": el catálogo completo en .xlsx.',
        ],
        dibujo: <Productos />,
    },
    chat: {
        titulo: 'Mensajes: la bandeja de conversaciones a la izquierda y el chat abierto a la derecha, con el selector de pedidos al escribir numeral.',
        leyenda: [
            'La bandeja: una fila por conversación, con los no leídos marcados.',
            'El punto rojo en Mensajes, en el menú: hay algo sin leer, sin entrar a chequear.',
            'Escribí # y elegís el pedido: queda linkeado en el mensaje.',
            'Desde el chat vas al perfil del cliente o al pedido, sin perder la conversación.',
            '"Archivar": cierra el tema y deja la bandeja limpia. No se borra, se guarda.',
            'El campo para responder; al lado, tus plantillas de respuesta.',
        ],
        dibujo: <Chat />,
    },
    cupon: {
        titulo: 'La lista de Cupones: código, descuento, usos, vigencia y estado de cada uno, con el menú de tres puntitos abierto.',
        leyenda: [
            'Las pestañas del módulo: Descuentos, Cupones y Rendimiento.',
            'El código: lo que escribe el cliente en el checkout. Corto y fácil de dictar funciona mejor.',
            'Usos (canjeados / máximos) y vigencia: los límites del cupón.',
            'El estado: Activo, Programado, Inactivo, Expirado o Agotado.',
            'El menú de tres puntitos: activar, desactivar, duplicar, editar, eliminar…',
            '…y "Compartir", que abre la ventana con el link y el envío por email.',
        ],
        dibujo: <Cupon />,
    },
    compartir: {
        titulo: 'La ventana Compartir cupón: arriba la URL del link con Copiar y Activar link, abajo el envío por email con destinatario, nombre y Enviar.',
        leyenda: [
            'URL del link: quien la abre entra a tu tienda con el descuento ya aplicado.',
            '"Copiar": te la deja en el portapapeles para pegarla en Instagram, WhatsApp o donde quieras.',
            'El link tiene su propio interruptor: "Activar link" lo prende sin tocar el cupón.',
            'Email del destinatario: cualquier casilla, no hace falta que sea cliente tuyo.',
            'Nombre (opcional): si lo cargás, el mail lo saluda por su nombre.',
            '"Enviar": Órbita arma y manda el mail, con el valor del cupón y un botón a tu tienda.',
        ],
        dibujo: <Compartir />,
    },
    reportes: {
        titulo: 'Reportes: las cinco pestañas arriba, el selector de período, los totales y el gráfico de barras del período.',
        leyenda: [
            'Las cinco pestañas: Ventas, Productos, Clientes, Inventario y Pagos.',
            'El período: cada pestaña se filtra por el que elijas.',
            'El gráfico del período, comparado contra el anterior.',
            'Pagos: por dónde te pagan y cuánto te queda después de comisiones.',
            'Los reportes de Productos y de Clientes también se abren desde el menú de la izquierda.',
        ],
        dibujo: <Reportes />,
    },
    config: {
        titulo: 'Configuración: el menú principal colapsado a íconos, el menú propio de Configuración y la sección Negocio con su botón Guardar cambios.',
        leyenda: [
            'El menú principal se colapsa solo a una franja de íconos al entrar.',
            'El menú propio de Configuración: cada ítem es una pantalla distinta.',
            'La pantalla de la sección elegida (acá, Negocio).',
            '"Guardar cambios": cada sección se guarda por separado.',
            'Zona peligrosa: lo que no tiene vuelta atrás, separado del resto.',
        ],
        dibujo: <Config />,
    },
    avanzado: {
        titulo: 'Avanzado: el aviso del paquete con Ver qué incluye y seis tarjetas con candado, una por función.',
        leyenda: [
            'Una tarjeta por función: juegos, modales, 2x1, plantillas, prueba social y oferta relámpago.',
            'El candado: el paquete todavía no está activo en tu negocio.',
            '"Ver qué incluye": te lleva a Suscripción, donde se activa. Se paga aparte.',
            'Plantillas de Home: "Ver cómo queda" antes de aplicar.',
            'Oferta relámpago: se arma en Descuentos y se prende o apaga desde acá.',
        ],
        dibujo: <Avanzado />,
    },
    perfil: {
        titulo: 'Mi perfil: el menú del avatar abierto, tus datos, el código de seis números para confirmar el email, el tema y la contraseña.',
        leyenda: [
            'El menú del avatar: Mi perfil, "Ir a la tienda" y Cerrar sesión.',
            '"Ir a la tienda": la ves tal cual la ve un comprador.',
            'Confirmar tu email: "Enviarme el código", te llega uno de 6 números y lo pegás. Tenés 14 días.',
            'El tema, claro u oscuro: queda guardado en tu cuenta y te sigue a cualquier dispositivo.',
            'Cambiar la contraseña, sin pasar por "olvidé mi contraseña".',
        ],
        dibujo: <Perfil />,
    },
    orbi: {
        titulo: 'Orbi abierto a la derecha del Inicio: el atajo Ctrl+K, las preguntas sugeridas, una respuesta con datos del negocio y el campo para escribir; y la tarjeta de Primeros pasos.',
        leyenda: [
            'El botón de Orbi, al pie del menú.',
            'Ctrl+K (Cmd+K en Mac) lo abre desde cualquier pantalla.',
            'Preguntas sugeridas para arrancar.',
            'Contesta con los datos de TU negocio, no con ayuda genérica.',
            'Escribile lo que quieras: un número, un pedido, cómo se hace algo.',
            'Primeros pasos: el tutorial guiado, que te lleva con el cursor y se tilda solo.',
        ],
        dibujo: <Orbi />,
    },
}

// ─── Componente público ──────────────────────────────────────────────────────

const estiloLeyenda: CSSProperties = {
    listStyle: 'none', margin: 0, padding: 0,
    display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '4px 14px',
    fontSize: 12.5, lineHeight: 1.35, color: 'var(--color-muted)',
}
const estiloNumero: CSSProperties = {
    flex: '0 0 16px', width: 16, height: 16, borderRadius: 999, marginTop: 1,
    background: ACENTO, color: SOBRE_ACENTO,
    fontSize: 10, fontWeight: 700, lineHeight: 1,
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
}

export function Ilustracion({ id }: { id: IlustracionId }) {
    // El id del <title> tiene que ser único por instancia: el manual puede
    // mostrar la misma ilustración dos veces en una página.
    const tituloId = useId()
    const esquema = ESQUEMAS[id]
    if (!esquema) return null
    return (
        <figure className="man-fig" style={{ margin: 0 }}>
            <svg viewBox="0 0 320 184" role="img" aria-labelledby={tituloId} preserveAspectRatio="xMidYMid meet">
                <title id={tituloId}>{esquema.titulo}</title>
                {/* Las formas son decorativas: lo que se lee es el título y la leyenda. */}
                <g aria-hidden="true">{esquema.dibujo}</g>
            </svg>
            <figcaption style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--color-border)' }}>
                <ol style={estiloLeyenda}>
                    {esquema.leyenda.map((texto, i) => (
                        <li key={i} style={{ display: 'flex', gap: 7, alignItems: 'flex-start' }}>
                            <span aria-hidden="true" style={estiloNumero}>{i + 1}</span>
                            <span>{texto}</span>
                        </li>
                    ))}
                </ol>
            </figcaption>
        </figure>
    )
}

// ─── Cómo agregar una ilustración ────────────────────────────────────────────
//
// 1. Sumá el id a IlustracionId y usalo en contenido.ts (`ilustracion: 'id'`).
// 2. Escribí el componente del dibujo. Si es una pantalla del panel, envolvelo
//    en <Panel activo=… abierto=… sub=… miga={[…]}> y dibujá el contenido en
//    coordenadas absolutas dentro de x 66-314, y 22-178 (con `colapsado`, el
//    área arranca en x 26). Usá Tarjeta / Campo / Boton / Pastilla / Rotulo;
//    solo tokens del tema; el acento reservado a lo que el texto explica.
// 3. Poné de 3 a 6 <Callout n x y /> sobre los elementos que el texto del
//    capítulo nombra, sin tapar sus rótulos, numerados en orden de lectura.
// 4. Agregalo a ESQUEMAS con su título (una frase descriptiva para el lector
//    de pantalla) y una línea de leyenda por callout, en el mismo orden.
// 5. Miralo en claro y en oscuro antes de commitear: la leyenda y el dibujo
//    se ven juntos en el Manual (Manual.tsx) apenas el capítulo lo referencia.
