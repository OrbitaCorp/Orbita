// Ilustraciones del manual — wireframes de cada pantalla del panel.
//
// Son esquemas, no capturas. Una captura real envejece con cada cambio de
// diseño, muestra datos de UN negocio (y datos de clientes reales) y se ve
// distinta en claro que en oscuro. Un wireframe muestra la FORMA de la
// pantalla — dónde están las pestañas, dónde los números, dónde el botón —
// que es lo que hace falta para reconocerla al llegar, y no miente nunca.
//
// Reglas del set, para que las quince se lean como una sola familia:
//   · Un solo acento (--color-primary) y solo en LO QUE EL TEXTO EXPLICA.
//     Todo lo demás es la escala de grises del panel.
//   · Trazo de 1px, esquinas de 2-3px, sin sombras ni degradés.
//   · Sin texto adentro salvo dos o tres rótulos que evitan una confusión.
//   · viewBox único de 320×184, así todas ocupan el mismo alto en la página.

import type { CSSProperties, ReactElement } from 'react'

export type IlustracionId =
    | 'panel-tienda' | 'layout-panel' | 'kpis' | 'alertas' | 'pedidos'
    | 'clientes' | 'productos' | 'chat' | 'cupon' | 'compartir'
    | 'reportes' | 'config' | 'avanzado' | 'perfil' | 'orbi'

const LINEA = 'var(--color-border)'
const BLOQUE = 'var(--color-surface-alt)'
const TENUE = 'var(--color-muted)'
const ACENTO = 'var(--color-primary)'

// ─── Primitivas ──────────────────────────────────────────────────────────────

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

// ─── Los quince esquemas ─────────────────────────────────────────────────────

function PanelTienda() {
    return (
        <>
            {/* El panel */}
            <Caja x={4} y={10} w={146} h={140} fill="none" />
            <Caja x={4} y={10} w={34} h={140} />
            {[22, 34, 46, 58, 70].map(y => <Texto key={y} x={12} y={y} w={18} />)}
            <line x1={38.5} y1={30.5} x2={150.5} y2={30.5} stroke={LINEA} />
            {[42, 62, 82, 102, 122].map(y => (
                <g key={y}>
                    <Texto x={48} y={y} w={30} fuerte />
                    <Texto x={92} y={y} w={48} />
                </g>
            ))}
            <text x={12} y={168} style={rotulo}>Panel</text>

            {/* La tienda */}
            <Caja x={170} y={10} w={146} h={140} fill="none" />
            <line x1={170.5} y1={30.5} x2={316.5} y2={30.5} stroke={LINEA} />
            <Texto x={180} y={18} w={26} fuerte />
            <circle cx={306} cy={20.5} r={4} fill="none" stroke={LINEA} />
            {[0, 1, 2].map(c => [0, 1].map(f => (
                <g key={`${c}-${f}`}>
                    <Caja x={180 + c * 45} y={42 + f * 54} w={38} h={30} />
                    <Texto x={180 + c * 45} y={78 + f * 54} w={28} />
                    <Texto x={180 + c * 45} y={86 + f * 54} w={16} fuerte />
                </g>
            )))}
            <text x={178} y={168} style={rotulo}>Tienda</text>
        </>
    )
}

function LayoutPanel() {
    return (
        <>
            <Marco />
            {/* Menú */}
            <line x1={56.5} y1={0.5} x2={56.5} y2={183.5} stroke={LINEA} />
            <circle cx={16} cy={20} r={5} fill="none" stroke={LINEA} />
            <Texto x={26} y={18} w={20} fuerte />
            <Caja x={8} y={34} w={40} h={12} />
            {[56, 72, 88, 104, 120, 136].map((y, i) => (
                <g key={y}>
                    <Caja x={8} y={y - 4} w={5} h={5} r={1} stroke={null} fill={i === 2 ? ACENTO : LINEA} />
                    <Texto x={18} y={y - 3} w={i === 2 ? 30 : 26} fuerte={i === 2} />
                </g>
            ))}
            {/* Barra de arriba */}
            <line x1={56.5} y1={30.5} x2={319.5} y2={30.5} stroke={LINEA} />
            <Pastilla x={68} y={9} w={96} h={13} />
            {[250, 268, 286].map(x => <circle key={x} cx={x} cy={15.5} r={5} fill="none" stroke={LINEA} />)}
            <circle cx={304} cy={15.5} r={6} fill={BLOQUE} stroke={LINEA} />
            {/* Contenido */}
            <Texto x={68} y={44} w={54} fuerte />
            {[0, 1, 2].map(i => <Caja key={i} x={68 + i * 84} y={58} w={76} h={34} />)}
            <Caja x={68} y={102} w={244} h={64} />
        </>
    )
}

function Kpis() {
    const barras = [30, 44, 26, 52, 38, 60, 48]
    return (
        <>
            <Marco />
            {[0, 1, 2, 3, 4].map(i => (
                <g key={i}>
                    <Caja x={10 + i * 61} y={12} w={53} h={38} />
                    <Texto x={18 + i * 61} y={20} w={22} />
                    <rect x={18 + i * 61} y={29} width={30} height={7} rx={2} fill={i === 0 ? ACENTO : TENUE} opacity={i === 0 ? 0.75 : 0.5} />
                    <Texto x={18 + i * 61} y={41} w={16} />
                </g>
            ))}
            <Caja x={10} y={60} w={300} h={112} />
            <Texto x={20} y={70} w={44} fuerte />
            {/* Serie */}
            <polyline
                points={barras.map((v, i) => `${30 + i * 42},${160 - v}`).join(' ')}
                fill="none" stroke={ACENTO} strokeWidth={1.6} strokeLinejoin="round" strokeLinecap="round"
            />
            {barras.map((v, i) => <circle key={i} cx={30 + i * 42} cy={160 - v} r={1.8} fill={ACENTO} />)}
            <line x1={20.5} y1={160.5} x2={300.5} y2={160.5} stroke={LINEA} />
        </>
    )
}

function Alertas() {
    return (
        <>
            <Marco />
            <Texto x={14} y={16} w={40} fuerte />
            {[0, 1, 2].map(i => (
                <g key={i}>
                    <Caja x={12} y={34 + i * 46} w={296} h={36} />
                    <rect x={12.5} y={34.5} width={2.5} height={36} fill={i === 0 ? ACENTO : TENUE} opacity={i === 0 ? 1 : 0.4} transform={`translate(0 ${i * 46})`} />
                    <Texto x={26} y={44 + i * 46} w={128} fuerte />
                    <Texto x={26} y={56 + i * 46} w={92} />
                    <Pastilla x={262} y={45 + i * 46} w={34} />
                </g>
            ))}
        </>
    )
}

function Pedidos() {
    return (
        <>
            <Marco />
            {/* Pestañas por estado */}
            {[34, 44, 40, 36, 42, 38].reduce<{ nodos: ReactElement[]; x: number }>((acc, w, i) => {
                acc.nodos.push(<Pastilla key={i} x={acc.x} y={12} w={w} activa={i === 1} />)
                acc.x += w + 7
                return acc
            }, { nodos: [], x: 12 }).nodos}
            <line x1={0.5} y1={34.5} x2={319.5} y2={34.5} stroke={LINEA} />
            {/* Filas */}
            {[0, 1, 2, 3, 4].map(i => (
                <g key={i}>
                    <Texto x={14} y={48 + i * 26} w={22} fuerte />
                    <circle cx={56} cy={50 + i * 26} r={5} fill={BLOQUE} stroke={LINEA} />
                    <Texto x={68} y={48 + i * 26} w={64} />
                    <circle cx={200} cy={50 + i * 26} r={3} fill={i === 0 ? ACENTO : TENUE} opacity={i === 0 ? 1 : 0.4} />
                    <Texto x={210} y={48 + i * 26} w={30} />
                    <Texto x={272} y={48 + i * 26} w={30} fuerte />
                    {i < 4 && <line x1={12.5} y1={62.5 + i * 26} x2={307.5} y2={62.5 + i * 26} stroke={LINEA} />}
                </g>
            ))}
        </>
    )
}

function Clientes() {
    return (
        <>
            <Marco />
            <Pastilla x={12} y={12} w={120} h={14} />
            <Pastilla x={222} y={12} w={40} h={14} />
            <Pastilla x={268} y={12} w={40} h={14} activa />
            <line x1={0.5} y1={38.5} x2={319.5} y2={38.5} stroke={LINEA} />
            {[0, 1, 2, 3].map(i => (
                <g key={i}>
                    <circle cx={26} cy={56 + i * 32} r={8} fill={BLOQUE} stroke={LINEA} />
                    <Texto x={42} y={50 + i * 32} w={56} fuerte />
                    <Texto x={42} y={59 + i * 32} w={76} />
                    {[0, 1, 2, 3].map(c => <Texto key={c} x={150 + c * 42} y={54 + i * 32} w={24} />)}
                    <path d={`M 300 ${52 + i * 32} l 4 4 l -4 4`} fill="none" stroke={TENUE} strokeWidth={1.2} opacity={0.6} />
                    {i < 3 && <line x1={12.5} y1={72.5 + i * 32} x2={307.5} y2={72.5 + i * 32} stroke={LINEA} />}
                </g>
            ))}
        </>
    )
}

function Productos() {
    return (
        <>
            <Marco />
            {[0, 1, 2, 3, 4].map(i => (
                <g key={i}>
                    <Caja x={10 + i * 61} y={10} w={53} h={30} />
                    <Texto x={17 + i * 61} y={17} w={22} />
                    <rect x={17 + i * 61} y={26} width={22} height={6} rx={2} fill={TENUE} opacity={0.5} />
                </g>
            ))}
            <line x1={0.5} y1={50.5} x2={319.5} y2={50.5} stroke={LINEA} />
            {[0, 1, 2, 3].map(c => [0, 1].map(f => (
                <g key={`${c}-${f}`}>
                    <Caja x={12 + c * 76} y={60 + f * 60} w={66} h={52} fill="none" />
                    <Caja x={12 + c * 76} y={60 + f * 60} w={66} h={30} stroke={null} />
                    <Texto x={18 + c * 76} y={96 + f * 60} w={44} />
                    <Texto x={18 + c * 76} y={104 + f * 60} w={24} fuerte />
                </g>
            )))}
        </>
    )
}

function Chat() {
    return (
        <>
            <Marco />
            <line x1={112.5} y1={0.5} x2={112.5} y2={183.5} stroke={LINEA} />
            {/* Bandeja */}
            {[0, 1, 2, 3].map(i => (
                <g key={i}>
                    {i === 1 && <Caja x={4} y={20 + i * 38} w={104} h={34} stroke={null} />}
                    <circle cx={24} cy={36 + i * 38} r={7} fill={BLOQUE} stroke={LINEA} />
                    <Texto x={38} y={30 + i * 38} w={42} fuerte={i === 1} />
                    <Texto x={38} y={40 + i * 38} w={58} />
                    {i === 1 && <circle cx={100} cy={32 + i * 38} r={3} fill={ACENTO} />}
                </g>
            ))}
            {/* Conversación */}
            <line x1={112.5} y1={26.5} x2={319.5} y2={26.5} stroke={LINEA} />
            <Texto x={124} y={13} w={48} fuerte />
            <Caja x={124} y={40} w={110} h={26} />
            <rect x={190.5} y={76.5} width={118} height={26} rx={3} fill={ACENTO} fillOpacity={0.12} stroke={ACENTO} strokeOpacity={0.45} />
            <Caja x={124} y={112} w={92} h={22} />
            {/* Campo de respuesta */}
            <Pastilla x={124} y={152} w={158} h={16} />
            <circle cx={296} cy={160} r={8} fill={ACENTO} opacity={0.16} stroke={ACENTO} strokeOpacity={0.5} />
        </>
    )
}

function Cupon() {
    return (
        <>
            <Marco />
            {[0, 1].map(i => (
                <g key={i} opacity={i === 0 ? 1 : 0.45}>
                    <Caja x={20 + i * 150} y={34} w={130} h={92} fill="none" />
                    <line x1={54.5 + i * 150} y1={34.5} x2={54.5 + i * 150} y2={126.5} stroke={LINEA} strokeDasharray="3 3" />
                    <text x={28 + i * 150} y={86} style={{ ...rotulo, fontSize: 15, fill: i === 0 ? ACENTO : TENUE, fontWeight: 700 }}>%</text>
                    <Texto x={66 + i * 150} y={48} w={68} fuerte />
                    <rect x={66 + i * 150} y={62} width={54} height={12} rx={2} fill={BLOQUE} stroke={LINEA} />
                    <Texto x={66 + i * 150} y={86} w={44} />
                    <Texto x={66 + i * 150} y={96} w={58} />
                    <circle cx={70 + i * 150} cy={112} r={3} fill={i === 0 ? ACENTO : TENUE} opacity={i === 0 ? 1 : 0.5} />
                    <Texto x={78 + i * 150} y={110} w={26} />
                </g>
            ))}
            <Texto x={20} y={150} w={64} />
            <Texto x={20} y={162} w={104} />
        </>
    )
}

function Compartir() {
    return (
        <>
            {/* La ventana de "Compartir" */}
            <Caja x={40} y={6} w={238} h={170} fill="var(--color-bg)" />
            <line x1={40.5} y1={34.5} x2={278.5} y2={34.5} stroke={LINEA} />
            <Texto x={52} y={15} w={56} fuerte />
            <rect x={52} y={24} width={40} height={4} rx={2} fill={LINEA} />
            <path d="M 262 16 l 8 8 M 270 16 l -8 8" stroke={TENUE} strokeWidth={1.2} opacity={0.7} />

            {/* 1 · el link */}
            <Texto x={52} y={46} w={40} fuerte />
            <rect x={52.5} y={58.5} width={158} height={16} rx={3} fill={BLOQUE} stroke={LINEA} />
            <Texto x={60} y={65} w={132} />
            <Pastilla x={218} y={58} w={48} h={16} />
            <circle cx={57} cy={88} r={3} fill={ACENTO} />
            <Texto x={65} y={86} w={26} />
            <line x1={52.5} y1={102.5} x2={266.5} y2={102.5} stroke={LINEA} />

            {/* 2 · enviar por email */}
            <Texto x={52} y={112} w={62} fuerte />
            <rect x={52.5} y={124.5} width={214} height={14} rx={3} fill="none" stroke={LINEA} />
            <Texto x={60} y={130} w={72} />
            <rect x={52.5} y={144.5} width={214} height={14} rx={3} fill="none" stroke={LINEA} />
            <Texto x={60} y={150} w={54} />
            <Pastilla x={218} y={162} w={48} h={13} activa />
        </>
    )
}

function Reportes() {
    const barras = [42, 66, 30, 78, 54, 88, 62]
    return (
        <>
            <Marco />
            {[38, 44, 38, 48, 34].reduce<{ nodos: ReactElement[]; x: number }>((acc, w, i) => {
                acc.nodos.push(<Pastilla key={i} x={acc.x} y={12} w={w} activa={i === 0} />)
                acc.x += w + 8
                return acc
            }, { nodos: [], x: 12 }).nodos}
            <line x1={0.5} y1={34.5} x2={319.5} y2={34.5} stroke={LINEA} />
            <Texto x={14} y={46} w={48} fuerte />
            {barras.map((h, i) => (
                <rect
                    key={i} x={26 + i * 40} y={158 - h} width={24} height={h} rx={2}
                    fill={i === 5 ? ACENTO : TENUE} opacity={i === 5 ? 0.75 : 0.28}
                />
            ))}
            <line x1={18.5} y1={158.5} x2={302.5} y2={158.5} stroke={LINEA} />
            {barras.map((_, i) => <Texto key={i} x={30 + i * 40} y={166} w={16} />)}
        </>
    )
}

function Config() {
    return (
        <>
            <Marco />
            <line x1={96.5} y1={0.5} x2={96.5} y2={183.5} stroke={LINEA} />
            {[16, 34, 52, 70, 88, 106, 124, 142, 160].map((y, i) => (
                <g key={y}>
                    {i === 3 && <Caja x={6} y={y - 5} w={84} h={16} stroke={null} />}
                    <Caja x={12} y={y - 2} w={6} h={6} r={1} stroke={null} fill={i === 3 ? ACENTO : LINEA} />
                    <Texto x={24} y={y - 1} w={i === 3 ? 48 : 40} fuerte={i === 3} />
                </g>
            ))}
            <Texto x={110} y={16} w={56} fuerte />
            {[0, 1, 2].map(i => (
                <g key={i}>
                    <Texto x={110} y={38 + i * 40} w={40} />
                    <rect x={110.5} y={48.5 + i * 40} width={192} height={16} rx={3} fill="none" stroke={LINEA} />
                    <Texto x={118} y={54 + i * 40} w={92} />
                </g>
            ))}
            <Pastilla x={110} y={156} w={68} h={15} activa />
        </>
    )
}

function Avanzado() {
    return (
        <>
            <Marco />
            <Texto x={14} y={16} w={50} fuerte />
            {[0, 1, 2].map(c => [0, 1].map(f => {
                const bloqueada = c === 2 && f === 0
                return (
                    <g key={`${c}-${f}`} opacity={bloqueada ? 0.5 : 1}>
                        <Caja x={12 + c * 100} y={36 + f * 74} w={88} h={62} fill="none" />
                        <Caja x={24 + c * 100} y={48 + f * 74} w={16} h={16} r={4} />
                        <Texto x={24 + c * 100} y={74 + f * 74} w={50} fuerte />
                        <Texto x={24 + c * 100} y={84 + f * 74} w={64} />
                        {bloqueada && (
                            <g>
                                <rect x={48 + c * 100} y={60 + f * 74} width={16} height={12} rx={2} fill="var(--color-bg)" stroke={TENUE} />
                                <path d={`M ${52 + c * 100} ${60 + f * 74} v -4 a 4 4 0 0 1 8 0 v 4`} fill="none" stroke={TENUE} />
                            </g>
                        )}
                    </g>
                )
            }))}
        </>
    )
}

function Perfil() {
    return (
        <>
            <Marco />
            <circle cx={40} cy={40} r={16} fill={BLOQUE} stroke={LINEA} />
            <Texto x={66} y={32} w={70} fuerte />
            <Texto x={66} y={44} w={104} />
            <line x1={20.5} y1={70.5} x2={299.5} y2={70.5} stroke={LINEA} />
            <Texto x={20} y={84} w={88} fuerte />
            <Texto x={20} y={96} w={140} />
            {[0, 1, 2, 3, 4, 5].map(i => (
                <rect
                    key={i} x={20.5 + i * 30} y={112.5} width={24} height={28} rx={3}
                    fill={i < 2 ? BLOQUE : 'none'} stroke={i === 2 ? ACENTO : LINEA}
                />
            ))}
            <Pastilla x={210} y={118} w={80} h={16} activa />
            <Texto x={20} y={160} w={124} />
        </>
    )
}

function Orbi() {
    return (
        <>
            <Marco />
            <circle cx={30} cy={28} r={9} fill="none" stroke={ACENTO} />
            <circle cx={30} cy={28} r={3} fill={ACENTO} />
            <ellipse cx={30} cy={28} rx={14} ry={6} fill="none" stroke={ACENTO} strokeOpacity={0.45} transform="rotate(-24 30 28)" />
            <Texto x={52} y={25} w={30} fuerte />
            <line x1={0.5} y1={50.5} x2={319.5} y2={50.5} stroke={LINEA} />
            <Caja x={110} y={62} w={196} h={24} />
            <Texto x={120} y={71} w={150} />
            <Caja x={14} y={96} w={210} h={44} fill="none" />
            <Texto x={26} y={108} w={182} />
            <Texto x={26} y={118} w={158} />
            <Texto x={26} y={128} w={104} />
            <Pastilla x={14} y={154} w={230} h={16} />
            <rect x={258.5} y={154.5} width={48} height={16} rx={3} fill={BLOQUE} stroke={LINEA} />
            <text x={266} y={166} style={{ ...rotulo, fontSize: 7.5 }}>Ctrl+K</text>
        </>
    )
}

// ─── Registro y componente público ───────────────────────────────────────────

const ESQUEMAS: Record<IlustracionId, { Dibujo: () => ReactElement; alt: string }> = {
    'panel-tienda': { Dibujo: PanelTienda, alt: 'Esquema: a la izquierda el panel de administración, a la derecha la tienda que ve el cliente.' },
    'layout-panel': { Dibujo: LayoutPanel, alt: 'Esquema del panel: menú de módulos a la izquierda, barra de herramientas arriba y el contenido en el centro.' },
    kpis: { Dibujo: Kpis, alt: 'Esquema del Inicio: una fila de cinco tarjetas con los números principales y, debajo, el gráfico de ventas.' },
    alertas: { Dibujo: Alertas, alt: 'Esquema de las alertas del Inicio: filas apiladas, cada una con su botón para ir a resolverla.' },
    pedidos: { Dibujo: Pedidos, alt: 'Esquema de Pedidos: pestañas por estado arriba y la lista de pedidos debajo.' },
    clientes: { Dibujo: Clientes, alt: 'Esquema de Clientes: buscador y acciones arriba, y una fila por cliente con sus números.' },
    productos: { Dibujo: Productos, alt: 'Esquema de Productos: los cinco números del catálogo arriba y la grilla de productos debajo.' },
    chat: { Dibujo: Chat, alt: 'Esquema de Mensajes: la bandeja de conversaciones a la izquierda y el chat abierto a la derecha.' },
    cupon: { Dibujo: Cupon, alt: 'Esquema de un cupón: su código, su valor y su estado.' },
    compartir: { Dibujo: Compartir, alt: 'Esquema de la ventana Compartir: arriba la URL del link con el botón de copiar, abajo el envío por email.' },
    reportes: { Dibujo: Reportes, alt: 'Esquema de Reportes: las cinco pestañas arriba y el gráfico del período debajo.' },
    config: { Dibujo: Config, alt: 'Esquema de Configuración: su menú propio a la izquierda y el formulario de la sección elegida a la derecha.' },
    avanzado: { Dibujo: Avanzado, alt: 'Esquema de Avanzado: una grilla de tarjetas por función, con candado las que todavía no están activas.' },
    perfil: { Dibujo: Perfil, alt: 'Esquema de Mi perfil: tus datos arriba y el campo del código de seis números para confirmar el email.' },
    orbi: { Dibujo: Orbi, alt: 'Esquema de Orbi: la conversación con el asistente y el atajo Ctrl+K.' },
}

export function Ilustracion({ id }: { id: IlustracionId }) {
    const esquema = ESQUEMAS[id]
    if (!esquema) return null
    const { Dibujo, alt } = esquema
    return (
        <figure className="man-fig">
            <svg viewBox="0 0 320 184" role="img" aria-label={alt} preserveAspectRatio="xMidYMid meet">
                <Dibujo />
            </svg>
        </figure>
    )
}
