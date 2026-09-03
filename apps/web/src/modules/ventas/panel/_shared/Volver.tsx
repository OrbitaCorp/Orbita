// ─── Volver ───────────────────────────────────────────────────────────────────
//
// UNA sola forma de volver en todo el panel. Antes convivían cinco: un botón
// con flecha de lucide y el nombre del destino (Avanzado), un "← Volver al
// listado" con la flecha escrita a mano (Descuentos), un "← Volver" pelado
// (Rendimiento), una flecha sola sin texto (Cupones) y una miga de pan
// "Lista › #33" (Pedidos, Clientes). Cada una con su tamaño y su color: al
// moverse entre secciones el botón cambiaba de lugar y de forma, y en varias
// pantallas directamente no había con qué volver.
//
// Reglas del estándar:
//   · Siempre arriba de todo, antes del título, alineado a la izquierda.
//   · Siempre dice ADÓNDE se vuelve ("Descuentos", "Lista de pedidos"), nunca
//     un "Volver" suelto: el destino es la información útil.
//   · Misma flecha, mismo tamaño y mismo color en escritorio, tablet y celular.
//   · En celular crece el área donde cae el dedo, no la letra.
//
// Uso:
//   <Volver a="Descuentos" onClick={irAListado} />

import { ArrowLeft } from 'lucide-react'

export function Volver({
    a,
    onClick,
    /** Separación con lo que sigue. 'suelto' cuando lo que sigue ya trae su propio aire. */
    espacio = 'normal',
}: {
    a: string
    onClick: () => void
    espacio?: 'normal' | 'suelto'
}) {
    return (
        <>
            <style>{`
                .ds-volver { transition: color 140ms ease; }
                .ds-volver:hover { color: var(--color-text) !important; }
                .ds-volver:focus-visible { outline: 2px solid var(--color-primary); outline-offset: 3px; border-radius: 6px; }
                @media (max-width: 768px) {
                    /* El área táctil sube a 44px sin mover el texto de su sitio:
                       el padding crece y el margen negativo lo devuelve. */
                    .ds-volver { padding: 11px 8px !important; margin: -11px 0 -11px -8px !important; }
                }
            `}</style>
            <button
                type="button"
                className="ds-volver"
                onClick={onClick}
                style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    background: 'none',
                    border: 'none',
                    padding: '4px 6px',
                    margin: `-4px 0 ${espacio === 'normal' ? 10 : 0}px -6px`,
                    fontSize: 13,
                    fontWeight: 500,
                    fontFamily: 'inherit',
                    color: 'var(--color-muted)',
                    cursor: 'pointer',
                }}
            >
                <ArrowLeft size={15} strokeWidth={2} style={{ flexShrink: 0 }} />
                {a}
            </button>
        </>
    )
}
