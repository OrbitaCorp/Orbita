// ─── Variante: Recorrido guiado con spotlight ────────────────────────────────
//
// El tour clásico de coach-marks: backdrop oscuro con un recorte iluminado
// sobre cada pieza del panel y una tarjeta al lado que la explica. Secuencia
// lineal: bienvenida → 8 secciones del sidebar → 5 herramientas del header →
// cierre. Navegar el tour NO navega el panel: todo pasa sobre la pantalla
// actual (el dashboard en la demo).
//
// El avance vive en estado.paso (el host lo persiste en localStorage), así
// que sobrevive a recargas y a la navegación interna.

import { useEffect } from 'react'
import { Button } from '@/design-system/components/Button'
import type { PropsVariante } from './TutorialHost'
import { HERRAMIENTAS, SECCIONES, TEXTOS } from './copy'
import type { HerramientaCopy, SeccionCopy } from './copy'
import { EstilosTutorial, LinkDiscreto, Recorte, TarjetaPaso, useRectAncla } from './piezas'

// ─── Secuencia ───────────────────────────────────────────────────────────────

type Paso =
    | { tipo: 'bienvenida' }
    | { tipo: 'seccion'; seccion: SeccionCopy; ancla: string; n: number }
    | { tipo: 'herramienta'; herramienta: HerramientaCopy; ancla: string; n: number }
    | { tipo: 'cierre' }

// `n` es el numerador del progreso DENTRO de su capítulo ("Secciones · N de 8",
// "Herramientas · N de 5"): un "4 de 13" plano no dice dónde estás parado, en
// cambio el capítulo sí. El avance global lo cuenta la barra `fraccion` de la
// tarjeta, así no se pierde la noción de cuánto falta en total.
const PASOS: Paso[] = [
    { tipo: 'bienvenida' },
    ...SECCIONES.map((seccion, i): Paso => ({
        tipo: 'seccion', seccion, ancla: `sidebar:${seccion.sidebarTexto}`, n: i + 1,
    })),
    ...HERRAMIENTAS.map((herramienta, i): Paso => ({
        tipo: 'herramienta', herramienta, ancla: `header:${herramienta.id}`, n: i + 1,
    })),
    { tipo: 'cierre' },
]

// Ajuste mobile: el pie lleva hasta 4 controles → que envuelva en vez de
// desbordar la tarjeta (que ya viene capada al ancho del viewport).
function EstilosRecorrido() {
    return (
        <style>{`
            @media (max-width: 768px) {
                .tut-recorrido-pie { flex-wrap: wrap !important; row-gap: 10px !important; }
                .tut-recorrido-links { margin-left: 0 !important; width: 100% !important; justify-content: space-between !important; }
            }
        `}</style>
    )
}

export default function VarianteRecorrido(props: PropsVariante) {
    const { estado, actualizar, terminar, reiniciar, irA, nombreUsuario } = props

    // Clamp defensivo: el paso guardado puede venir de otra variante o de una
    // versión vieja del estado.
    const idx = Math.min(Math.max(estado.paso, 0), PASOS.length - 1)
    const paso = PASOS[idx]
    const anclado = paso.tipo === 'seccion' || paso.tipo === 'herramienta'

    // El hook corre siempre (reglas de hooks); en las tapas queda inactivo y
    // devuelve null → tarjeta centrada.
    const rect = useRectAncla(anclado ? paso.ancla : 'centro', anclado)

    const esUltimo = idx === PASOS.length - 1

    // Progreso global 0..1 para la barrita del borde superior de la tarjeta:
    // la bienvenida arranca en 0 y el cierre llega a 1, así la barra cuenta el
    // tour ENTERO aunque el rótulo de progreso vaya por capítulos.
    const fraccion = idx / (PASOS.length - 1)

    // Teclado: ← → navegan, Escape salta. El backdrop bloquea el panel, así
    // que no hay inputs de fondo peleando por las teclas.
    useEffect(() => {
        const onTecla = (e: KeyboardEvent) => {
            if (e.key === 'ArrowRight' && !esUltimo) { e.preventDefault(); actualizar({ paso: idx + 1 }) }
            else if (e.key === 'ArrowLeft' && idx > 0) { e.preventDefault(); actualizar({ paso: idx - 1 }) }
            else if (e.key === 'Escape') { e.preventDefault(); terminar() }
        }
        window.addEventListener('keydown', onTecla)
        return () => window.removeEventListener('keydown', onTecla)
    }, [idx, esUltimo, actualizar, terminar])

    const avanzar = () => { if (!esUltimo) actualizar({ paso: idx + 1 }) }
    const retroceder = () => { if (idx > 0) actualizar({ paso: idx - 1 }) }

    // Saltar + Reiniciar: siempre a mano, discretos, a la derecha del pie.
    const links = (
        <span
            className="tut-recorrido-links"
            style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 12, whiteSpace: 'nowrap' }}
        >
            <LinkDiscreto onClick={terminar}>{TEXTOS.saltar}</LinkDiscreto>
            <LinkDiscreto onClick={reiniciar}>{TEXTOS.reiniciar}</LinkDiscreto>
        </span>
    )

    if (paso.tipo === 'bienvenida') {
        return (
            <>
                <EstilosTutorial />
                <EstilosRecorrido />
                <Recorte rect={null} />
                <TarjetaPaso
                    rect={null}
                    titulo={TEXTOS.bienvenidaTitulo(nombreUsuario)}
                    ancho={380}
                    fraccion={fraccion}
                    capturarFoco
                    pie={
                        <div className="tut-recorrido-pie" style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%' }}>
                            <Button onClick={avanzar}>{TEXTOS.empezar}</Button>
                            {links}
                        </div>
                    }
                >
                    {TEXTOS.bienvenidaIntro}
                    {/* Los atajos existen desde siempre; contarlos acá (una sola
                        vez, bien bajito) es lo que hace que alguien los use. */}
                    <div style={{ marginTop: 10, fontSize: 11.5, color: 'var(--color-muted)', fontFamily: '"Geist Mono", monospace' }}>
                        ← → para moverte · Esc para salir
                    </div>
                </TarjetaPaso>
            </>
        )
    }

    if (paso.tipo === 'cierre') {
        return (
            <>
                <EstilosTutorial />
                <EstilosRecorrido />
                <Recorte rect={null} />
                <TarjetaPaso
                    rect={null}
                    titulo={TEXTOS.cierreTitulo}
                    ancho={380}
                    fraccion={fraccion}
                    capturarFoco
                    pie={
                        <div className="tut-recorrido-pie" style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%' }}>
                            <Button size="sm" onClick={terminar}>{TEXTOS.listo}</Button>
                            {/* La primera parada real después del tour: llevarlo directo. */}
                            <Button
                                variant="secondary"
                                size="sm"
                                onClick={() => { irA('ventas', 'configuracion'); terminar() }}
                            >
                                Ir a Configuración
                            </Button>
                            <span className="tut-recorrido-links" style={{ marginLeft: 'auto', display: 'inline-flex', gap: 12 }}>
                                <LinkDiscreto onClick={reiniciar}>{TEXTOS.reiniciar}</LinkDiscreto>
                            </span>
                        </div>
                    }
                >
                    {TEXTOS.cierre}
                </TarjetaPaso>
            </>
        )
    }

    // Paradas ancladas. Si el ancla no está (drawer cerrado en mobile, sidebar
    // colapsado, elemento inexistente), rect llega null: el Recorte oscurece
    // todo parejo y la tarjeta se centra con el MISMO copy + una pista sutil
    // de ubicación (el título de la tarjeta ya da el contexto principal).
    const titulo = paso.tipo === 'seccion' ? paso.seccion.titulo : paso.herramienta.titulo

    return (
        <>
            <EstilosTutorial />
            <EstilosRecorrido />
            <Recorte rect={rect} />
            <TarjetaPaso
                rect={rect}
                titulo={titulo}
                progreso={paso.tipo === 'seccion'
                    ? `Secciones · ${paso.n} de ${SECCIONES.length}`
                    : `Herramientas · ${paso.n} de ${HERRAMIENTAS.length}`}
                fraccion={fraccion}
                capturarFoco
                pie={
                    <div className="tut-recorrido-pie" style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%' }}>
                        {/* Siguiente va primero en el DOM a propósito: capturarFoco
                            enfoca el primer botón del pie, y ese tiene que ser el
                            que AVANZA (Enter tras Enter recorre el tour) — si no,
                            cada Enter iría para atrás. `order: -1` deja a Anterior
                            visualmente a la izquierda, como estuvo siempre. */}
                        <Button size="sm" onClick={avanzar}>{TEXTOS.siguiente}</Button>
                        {idx > 0 && (
                            <Button variant="secondary" size="sm" style={{ order: -1 }} onClick={retroceder}>{TEXTOS.anterior}</Button>
                        )}
                        {links}
                    </div>
                }
            >
                {paso.tipo === 'seccion' ? (
                    <>
                        {/* Qué es, con más peso; para qué, debajo. */}
                        <div style={{ fontWeight: 600, color: 'var(--color-text)' }}>{paso.seccion.queEs}</div>
                        <div style={{ marginTop: 4 }}>{paso.seccion.paraQue}</div>
                    </>
                ) : (
                    paso.herramienta.texto
                )}
                {!rect && (
                    <div style={{ marginTop: 8, fontSize: 11.5, color: 'var(--color-muted)' }}>
                        {paso.tipo === 'seccion'
                            ? `Ítem «${paso.seccion.sidebarTexto}» del menú de la izquierda.`
                            : 'Está en la barra de arriba del panel.'}
                    </div>
                )}
            </TarjetaPaso>
        </>
    )
}
