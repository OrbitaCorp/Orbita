// La ventana en la que se juega: en la tienda (fija sobre la página) y en la
// vista previa del panel (`enMarco`, adentro de la tienda de muestra). Es la
// misma pieza en los dos lados para que lo que el dueño prueba sea lo que ve
// su cliente. Cerrar solo con la X, a propósito (ver Inicio.tsx#cerrarModal).

import { useEffect, type ReactNode } from 'react'
import { ArrowLeft, X } from 'lucide-react'
import { cargarFuenteTematica, varsTematicaComoTienda, type PresentacionJuego } from './catalogo'

interface Props {
    titulo: string
    onVolver?: () => void
    onCerrar: () => void
    tema?: string | null
    presentacion?: string | null
    enMarco?: boolean
    children: ReactNode
}

export function MarcoJuego({ titulo, onVolver, onCerrar, tema, presentacion, enMarco, children }: Props) {
    useEffect(() => { cargarFuenteTematica(tema) }, [tema])
    const forma: PresentacionJuego = presentacion === 'lado' || presentacion === 'hoja' ? presentacion : 'centro'
    return (
        <div className={`pj pj--${forma}${enMarco ? ' pj--marco' : ''}`}>
            <style>{ESTILOS}</style>
            <div className="pj-velo" />
            <div className="pj-caja" role="dialog" aria-modal="true" aria-label={titulo} style={varsTematicaComoTienda(tema)}>
                {/* Tres columnas con los extremos iguales: el título queda
                    centrado contra la ventana y no contra lo que dejan los botones. */}
                <div className="pj-cabeza">
                    {onVolver ? <button onClick={onVolver} aria-label="Volver" className="pj-ico"><ArrowLeft size={15} /></button> : <span />}
                    <h2 className="pj-titulo">{titulo}</h2>
                    <button onClick={onCerrar} aria-label="Cerrar" className="pj-ico"><X size={15} /></button>
                </div>
                {children}
            </div>
        </div>
    )
}

const ESTILOS = `
.pj { position: fixed; inset: 0; z-index: 1000; display: flex; align-items: center; justify-content: center; padding: 16px; container-type: inline-size; }
.pj--marco { position: absolute; z-index: 5; padding: 12px; }
.pj-velo { position: absolute; inset: 0; background: rgba(0,0,0,0.45); }
.pj-caja {
  position: relative; box-sizing: border-box; width: 100%; max-width: 680px; max-height: calc(100vh - 32px); overflow-y: auto;
  background: var(--color-bg); color: var(--color-text); border-radius: 16px;
  box-shadow: 0 24px 64px rgba(0,0,0,0.22); padding: clamp(18px, 4.5cqw, 32px);
}
.pj--marco .pj-caja { max-height: 100%; padding: 16px; }
.pj-cabeza { display: grid; grid-template-columns: 36px 1fr 36px; align-items: center; gap: 8px; margin-bottom: 18px; }
.pj-titulo { margin: 0; font-size: 16px; font-weight: 800; letter-spacing: -0.01em; color: var(--color-text); text-align: center; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-family: var(--promo-fuente, inherit); }
.pj-ico { width: 36px; height: 36px; border-radius: 8px; border: 1px solid var(--color-border); background: transparent; color: var(--color-muted); cursor: pointer; display: grid; place-items: center; }
.pj-ico:focus-visible { outline: 2px solid var(--color-primary); outline-offset: 2px; }

.pj--lado { justify-content: flex-end; align-items: stretch; padding: 0; }
.pj--lado .pj-caja { max-width: 460px; max-height: none; height: 100%; border-radius: 0; }
.pj--hoja { align-items: flex-end; padding: 0; }
.pj--hoja .pj-caja { max-width: 720px; border-radius: 18px 18px 0 0; max-height: 92%; }

@container (max-width: 560px) {
  .pj--lado .pj-caja { height: auto; max-height: 92%; margin-top: auto; border-radius: 18px 18px 0 0; }
  .pj--lado { align-items: flex-end; }
}
`
