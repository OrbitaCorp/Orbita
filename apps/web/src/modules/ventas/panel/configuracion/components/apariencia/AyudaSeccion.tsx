// src/modules/ventas/panel/configuracion/components/apariencia/AyudaSeccion.tsx
// El ícono de exclamación que explica una sección (o una opción suelta) de
// Apariencia, y el panel que se abre al tocarlo.
//
// Existe por mobile: ahí la vista previa en vivo se saca del todo (ver la
// media query de .ap-preview en Apariencia.tsx), así que el dueño mueve
// interruptores sin ver el resultado al lado. Pedido explícito: que cada
// sección y cada opción diga QUÉ es, DÓNDE se ve en la tienda y EN QUÉ
// afecta — "si desactivo el badge Nuevo, ¿qué significa eso?".
//
// Dos piezas y no un solo componente porque el botón y el panel viven en
// nodos distintos: el botón va en la fila del título (o de la opción) y el
// panel debajo, a todo el ancho. El estado abierto/cerrado lo guarda quien
// las usa (ver SecCard y ToggleRow en Apariencia.tsx).
//
// Desplegable inline y no tooltip flotante: un globo posicionado se recorta
// con cualquier ancestro con overflow, y en una columna de 320px no hay
// dónde ponerlo. Empujar el contenido siempre entra, en cualquier ancho.

import { CircleAlert } from 'lucide-react'
import type { CSSProperties } from 'react'

export interface Ayuda {
    // Qué es la cosa, en palabras del dueño de la tienda.
    que:     string
    // En qué parte de la tienda pública se ve.
    donde?:  string
    // Qué cambia si lo prende, lo apaga o lo edita.
    afecta?: string
}

export function AyudaBoton({ nombre, abierta, onToggle, panelId }: {
    // Para el lector de pantalla: "Qué es <nombre>" — un ícono solo no dice
    // nada, y en esta pantalla hay más de veinte iguales.
    nombre:   string
    abierta:  boolean
    onToggle: () => void
    panelId:  string
}) {
    return (
        // El ds-hover del design system acá no va: pinta un velo de
        // currentColor con un ::after en z-index negativo, y encima de eso el
        // botón ya tiene su propio relleno + escala en hover (globals.css,
        // .ds-ayuda-btn). Los dos juntos daban un gris embarrado.
        <button
            type="button"
            className="ds-ayuda-btn"
            onClick={e => { e.preventDefault(); e.stopPropagation(); onToggle() }}
            aria-expanded={abierta}
            aria-controls={panelId}
            aria-label={`Qué es ${nombre}`}
            title={`Qué es ${nombre}`}
        >
            <CircleAlert size={16} strokeWidth={1.9} />
        </button>
    )
}

// El panel se renderiza SIEMPRE, abierto o cerrado, y quien lo usa le pasa
// `abierta`. Es lo que permite que se despliegue en vez de aparecer de golpe:
// la altura se anima con el truco de grid-template-rows 0fr → 1fr (la única
// forma de transicionar hasta una altura `auto` sin medirla con JS), y eso
// necesita que el nodo exista de los dos lados de la transición. Montarlo y
// desmontarlo, como estaba antes, no deja nada que animar.
export function AyudaPanel({ ayuda, id, abierta, style }: { ayuda: Ayuda; id: string; abierta: boolean; style?: CSSProperties }) {
    const filas: [string, string | undefined][] = [
        ['Qué es', ayuda.que],
        ['Dónde se ve', ayuda.donde],
        ['En qué afecta', ayuda.afecta],
    ]
    return (
        // Tres nodos y no uno: el de afuera anima la altura, el del medio
        // recorta lo que todavía no entró (y se come los márgenes del panel
        // mientras está cerrado, para que no dejen un hueco), y el de adentro
        // es el panel que se ve.
        <div className="ds-ayuda-wrap" data-abierta={abierta ? 'true' : 'false'} aria-hidden={!abierta}>
            <div className="ds-ayuda-clip">
                <div
                    id={id}
                    role="note"
                    className="ds-ayuda-panel"
                    style={{
                        borderRadius: 10,
                        border: '1px solid color-mix(in srgb, var(--color-primary) 22%, transparent)',
                        background: 'var(--color-primary-bg)',
                        padding: '11px 13px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 8,
                        ...style,
                    }}
                >
                    {filas.filter(([, texto]) => !!texto).map(([rotulo, texto], i) => (
                        // Cada bloque entra un toque después del anterior
                        // (--ayuda-i): la explicación se lee como que se va
                        // escribiendo, en vez de aparecer entera de una.
                        <div key={rotulo} className="ds-ayuda-fila" style={{ ['--ayuda-i' as string]: i }}>
                            <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--color-primary)', marginBottom: 2 }}>{rotulo}</div>
                            <div style={{ fontSize: 12.5, lineHeight: 1.55, color: 'var(--color-body)' }}>{texto}</div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    )
}
