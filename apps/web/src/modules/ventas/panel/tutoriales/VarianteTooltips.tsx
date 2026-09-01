// ─── Variante: Tooltips progresivos por sección ──────────────────────────────
//
// Aprendés al entrar: la primera vez que pisás una sección con tips aparece su
// secuencia de tarjetas (una por vez) señalando el elemento real con un Pulso
// NO bloqueante — nada de Recorte: el usuario puede seguir operando el panel.
// Una píldora fija abajo a la izquierda muestra el progreso global y abre un
// mini-popover con la lista de secciones (tilde en las ya vistas).

import { useEffect, useState } from 'react'
import type { PropsVariante } from './TutorialHost'
import { Button } from '@/design-system/components/Button'
import { SECCIONES, TEXTOS, TIPS_POR_SECCION } from './copy'
import { EstilosTutorial, LinkDiscreto, Pulso, TarjetaPaso, useRectAncla } from './piezas'

// Claves de TIPS_POR_SECCION que son subpantallas y no figuran en SECCIONES:
// su nombre visible (el label real de esas pantallas) se resuelve acá.
const NOMBRES_SUBPANTALLAS: Record<string, string> = {
    categorias: 'Categorías',
    cupones: 'Cupones',
}

const nombreSeccion = (clave: string): string =>
    SECCIONES.find(s => s.id === clave)?.titulo ?? NOMBRES_SUBPANTALLAS[clave] ?? clave

export default function VarianteTooltips(props: PropsVariante) {
    const { estado, actualizar, terminar, reiniciar, seccionActual } = props

    // Índice del tip dentro de la sección actual. Local a propósito: si el
    // usuario navega a mitad de secuencia la sección NO queda como vista, y
    // al volver los tips arrancan de nuevo desde el primero.
    const [idxTip, setIdxTip] = useState(0)
    // Ancla 'centro' o ancla que todavía no está en el DOM (pantalla cargando):
    // pasada la gracia, la tarjeta se muestra centrada igual, sin Pulso.
    const [graciaVencida, setGraciaVencida] = useState(false)
    // Asentamiento: recién pisada una sección la pantalla suele estar cargando
    // y el layout se acomoda (skeletons, datos async). Antes del PRIMER tip
    // esperamos ~500ms para no aparecer señalando algo que va a saltar de
    // lugar. Una sola vez por sección — los tips siguientes salen al toque —
    // e independiente de la gracia de 1200ms para anclas ausentes.
    const [asentado, setAsentado] = useState(false)
    const [popoverAbierto, setPopoverAbierto] = useState(false)

    const clavesSecciones = Object.keys(TIPS_POR_SECCION)
    const totalSecciones = clavesSecciones.length
    const vistas = clavesSecciones.filter(s => estado.seccionesVistas.includes(s))
    const completado = vistas.length === totalSecciones

    const tips = TIPS_POR_SECCION[seccionActual]
    const activo = !!tips && tips.length > 0 && !estado.seccionesVistas.includes(seccionActual)
    // Clamp: al cambiar de sección hay un render antes de que el efecto resetee
    // idxTip, y la secuencia nueva puede ser más corta que la anterior.
    const tip = activo && tips ? tips[Math.min(idxTip, tips.length - 1)] : null
    const esUltimo = !!tips && Math.min(idxTip, tips.length - 1) === tips.length - 1

    const rect = useRectAncla(tip ? tip.ancla : 'centro', tip !== null)

    // Cambio de sección → la secuencia arranca del primer tip. Reset puntual
    // ante un cambio de prop, no corre por render.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    useEffect(() => { setIdxTip(0) }, [seccionActual])

    // Timeout de asentamiento keyed por sección: si el usuario pasa de largo
    // antes del medio segundo, el cleanup lo cancela y no llega a verse nada
    // (mejor eso que un tip fugaz de una pantalla que ya dejó atrás). Corre
    // en paralelo con la gracia del ancla de acá abajo — son independientes.
    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setAsentado(false)
        if (!activo) return undefined
        const timer = window.setTimeout(() => setAsentado(true), 500)
        return () => window.clearTimeout(timer)
    }, [seccionActual, activo])

    // Gracia de ~1200ms por tip antes de rendirse con el ancla y centrar la
    // tarjeta. El polling de useRectAncla sigue vivo: si el ancla aparece
    // después (datos que tardan), la tarjeta se reengancha sola.
    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setGraciaVencida(false)
        if (!activo) return undefined
        const timer = window.setTimeout(() => setGraciaVencida(true), 1200)
        return () => window.clearTimeout(timer)
    }, [seccionActual, idxTip, activo])

    const avanzar = () => {
        if (!tips) return
        if (idxTip + 1 < tips.length) {
            setIdxTip(idxTip + 1)
            return
        }
        // Último tip: la sección queda vista (persistido → sobrevive navegación).
        if (!estado.seccionesVistas.includes(seccionActual)) {
            actualizar({ seccionesVistas: [...estado.seccionesVistas, seccionActual] })
        }
        setIdxTip(0)
    }

    // El host no remonta la variante al reiniciar (mismo patrón que el
    // acordeón de Checklist): el índice local se resetea acá.
    const reiniciarTutorial = () => {
        setIdxTip(0)
        reiniciar()
    }

    return (
        <>
            <EstilosTutorial />
            <style>{`@media (max-width: 768px){
                .tut-tooltips-pildora { left: 12px !important; bottom: 12px !important; }
                .tut-tooltips-popover { left: 12px !important; bottom: 56px !important; width: calc(100vw - 24px) !important; max-width: 300px !important; }
            }`}</style>

            {/* Tip de la sección actual: señala el elemento sin bloquear nada.
                Espera el asentamiento de la pantalla; sin rect y con la gracia
                corriendo tampoco se muestra nada todavía. */}
            {tip && tips && asentado && (rect !== null || graciaVencida) && (
                <>
                    <Pulso rect={rect} />
                    <TarjetaPaso
                        rect={rect}
                        // Variante NO bloqueante: la tarjeta va por encima del
                        // Pulso (260) pero DEBAJO de modales (300) y drawers.
                        zIndex={261}
                        titulo={tip.titulo}
                        progreso={`${Math.min(idxTip, tips.length - 1) + 1} de ${tips.length}`}
                        // Barra finita del borde superior: mismo clamp que el
                        // 'progreso' de arriba para que nunca se contradigan.
                        fraccion={(Math.min(idxTip, tips.length - 1) + 1) / tips.length}
                        // Sin capturarFoco a propósito: esto es NO bloqueante y
                        // robar el foco cortaría lo que el usuario está haciendo.
                        pie={
                            <>
                                <Button size="sm" onClick={avanzar}>
                                    {esUltimo ? TEXTOS.entendido : TEXTOS.siguiente}
                                </Button>
                                <span style={{ flex: 1 }} />
                                <LinkDiscreto onClick={terminar}>{TEXTOS.saltar}</LinkDiscreto>
                                <LinkDiscreto onClick={reiniciarTutorial}>{TEXTOS.reiniciar}</LinkDiscreto>
                            </>
                        }
                    >
                        {tip.texto}
                    </TarjetaPaso>
                </>
            )}

            {/* Píldora de progreso persistente: convive con el panel (z 250,
                debajo de modales 300 y lejos del toast en bottom-center). */}
            <button
                className="ds-hover tut-tooltips-pildora"
                onClick={() => setPopoverAbierto(a => !a)}
                aria-expanded={popoverAbierto}
                style={{
                    position: 'fixed', left: 252, bottom: 16, zIndex: 250,
                    display: 'inline-flex', alignItems: 'center', gap: 8,
                    background: 'var(--color-bg)', border: '1px solid var(--color-border)',
                    borderRadius: 9999, padding: '8px 14px', cursor: 'pointer',
                    fontFamily: 'inherit', fontSize: 12, fontWeight: 600, color: 'var(--color-text)',
                    boxShadow: 'var(--shadow-card-hover)',
                }}
            >
                <span style={{
                    width: 8, height: 8, borderRadius: 9999, flexShrink: 0,
                    background: completado ? 'var(--color-success)' : 'var(--color-primary)',
                }} />
                Consejos · {vistas.length}/{totalSecciones} secciones
            </button>

            {popoverAbierto && (
                <div
                    className="tut-tooltips-popover"
                    style={{
                        position: 'fixed', left: 252, bottom: 60, zIndex: 251,
                        width: 280, boxSizing: 'border-box',
                        background: 'var(--color-bg)', border: '1px solid var(--color-border)',
                        borderRadius: 12, padding: 16,
                        boxShadow: 'var(--shadow-card-hover)',
                        animation: 'orbita-tut-entrada 200ms ease',
                    }}
                >
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text)', marginBottom: 8 }}>
                        Consejos por sección
                    </div>
                    {clavesSecciones.map(clave => {
                        const vista = estado.seccionesVistas.includes(clave)
                        return (
                            <div
                                key={clave}
                                style={{
                                    display: 'flex', alignItems: 'center', gap: 8, padding: '3px 0',
                                    fontSize: 12.5, color: vista ? 'var(--color-body)' : 'var(--color-muted)',
                                }}
                            >
                                <span style={{
                                    width: 16, height: 16, borderRadius: 9999, flexShrink: 0,
                                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                                    fontSize: 10, fontWeight: 700,
                                    background: vista ? 'var(--color-success-bg)' : 'var(--color-surface-alt)',
                                    color: vista ? 'var(--color-success)' : 'var(--color-muted)',
                                }}>
                                    {vista ? '✓' : ''}
                                </span>
                                {nombreSeccion(clave)}
                            </div>
                        )
                    })}
                    {completado && (
                        <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--color-border)' }}>
                            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text)', marginBottom: 4 }}>
                                {TEXTOS.cierreTitulo}
                            </div>
                            <div style={{ fontSize: 12.5, lineHeight: 1.5, color: 'var(--color-body)', marginBottom: 10 }}>
                                {TEXTOS.cierre}
                            </div>
                            <Button size="sm" onClick={terminar}>{TEXTOS.listo}</Button>
                        </div>
                    )}
                    <div style={{ display: 'flex', gap: 12, marginTop: 12, paddingTop: 10, borderTop: '1px solid var(--color-border)' }}>
                        <LinkDiscreto onClick={reiniciarTutorial}>{TEXTOS.reiniciar}</LinkDiscreto>
                        <LinkDiscreto onClick={terminar}>No mostrar más</LinkDiscreto>
                    </div>
                </div>
            )}
        </>
    )
}
