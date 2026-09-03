// Paginación estándar del panel: Anterior · "Página X de Y" · Siguiente.
//
// Antes cada listado resolvía la suya (unas con "Mostrando 1–2 de 2", otras con
// flechas, otras con números), y en celular varias no entraban en el ancho y se
// desbordaban. Esta es la que ya usaba la lista de productos, extraída para que
// todos los listados se vean y se usen igual. El tamaño de página del panel es
// 10 en todas las secciones.
//
// En celular los botones crecen a la mitad del ancho cada uno (área táctil
// cómoda) y el contador pasa abajo, centrado.

import { Button } from '@/design-system/components/Button'

/** Registros por página en TODO el panel. */
export const POR_PAGINA = 10

export function Paginacion({
    pagina,
    totalPaginas,
    onCambiar,
    cargando,
}: {
    pagina: number
    totalPaginas: number
    onCambiar: (p: number) => void
    /** Bloquea los botones mientras entra la página nueva. */
    cargando?: boolean
}) {
    if (totalPaginas <= 1) return null
    return (
        <>
            <style>{`
                @media (max-width: 480px) {
                    .ds-pag { flex-wrap: wrap !important; gap: 8px !important; }
                    .ds-pag > button { flex: 1 1 0 !important; min-height: 40px !important; }
                    .ds-pag > span { order: 3; width: 100% !important; text-align: center; }
                }
            `}</style>
            <div className="ds-pag" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, marginTop: 20 }}>
                <Button variant="outline" size="sm" disabled={pagina === 1 || cargando} onClick={() => onCambiar(Math.max(1, pagina - 1))}>
                    Anterior
                </Button>
                <span style={{ fontSize: 12, color: 'var(--color-muted)', fontFamily: '"Geist Mono", monospace' }}>
                    Página {pagina} de {totalPaginas}
                </span>
                <Button variant="outline" size="sm" disabled={pagina === totalPaginas || cargando} onClick={() => onCambiar(Math.min(totalPaginas, pagina + 1))}>
                    Siguiente
                </Button>
            </div>
        </>
    )
}
