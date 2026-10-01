// ─── OrbiPet ─────────────────────────────────────────────────────────────────
// Orbi como mascota del panel (diseño "Orbi Formas v2"): toma la forma del
// módulo en el que está la persona —bolsa en Pedidos, caja en Productos,
// engranaje en Configuración…— con su cara, su accesorio y su gesto. Inicio es
// la forma base y la que se usa cuando no se sabe el módulo.
//
// Grande (≥40px) está vivo: flota, parpadea, el satélite orbita y, si se lo
// toca, se ríe. Chico, o con `animated={false}`, queda quieto: un personaje
// moviéndose todo el tiempo al costado de la pantalla de trabajo distrae.
// Vivo o quieto, al cambiar de módulo SIEMPRE se lo ve transformarse (las
// formas se cruzan con un resorte y hace el gesto del módulo): es un movimiento
// corto que pasa solo en el cambio. Con `prefers-reduced-motion` no se mueve nada.
//
// Es un dibujo a colores fijos pensado para fondo oscuro: `disc` lo apoya sobre
// el disco navy, igual que la estrella que reemplaza, para que se lea en tema
// claro y oscuro.

import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { PET_GESTOS, PET_GESTOS_COSQUILLAS, PET_MODULOS, petModulo, type PetAccesorio, type PetCara, type PetGesto } from './petModulos'
import { Accesorio, Cara, Cuerpo, OrbitaAdelante, OrbitaAtras, PetDefs, Visor } from './petSimbolos'
import { useModuloPet } from './useModuloPet'
import { useMovimientoReducido } from './movimiento'

/** Lo que está haciendo Orbi, más allá del módulo: cambia la cara y el accesorio. */
export type PetEstado = 'normal' | 'escribiendo' | 'pensando'

const RESORTE = 'cubic-bezier(.34,1.56,.64,1)'
const DURACION_COSQUILLAS = 1800

export function OrbiPet({ modulo, size = 40, animated, disc = false, estado = 'normal', onCosquillas }: {
  /** Id del módulo del menú. Si no se pasa, se toma de la ruta actual. */
  modulo?: string
  size?: number
  /** Por defecto, animado desde 40px. */
  animated?: boolean
  disc?: boolean
  estado?: PetEstado
  /** Si está, tocar al pet le hace cosquillas y avisa cuándo empiezan y terminan. */
  onCosquillas?: (activas: boolean) => void
}) {
  const moduloRuta = useModuloPet()
  const m = petModulo(modulo ?? moduloRuta)
  const reducido = useMovimientoReducido()
  /** Vivo: animaciones continuas (flotar, parpadeo, órbita). */
  const anim = (animated ?? size >= 40) && !reducido
  /** Transformarse al cambiar de módulo: siempre, salvo movimiento reducido. */
  const trans = !reducido
  const interactivo = anim && !!onCosquillas

  // useId trae ":" — válido en ids pero incómodo dentro de url(#…).
  const uid = useId().replace(/:/g, '')
  const id = (n: string) => `${uid}-${n}`
  const u = (n: string) => `url(#${id(n)})`

  const flotarRef = useRef<SVGGElement>(null)
  const gestoRef = useRef<SVGGElement>(null)
  const [cosquillas, setCosquillas] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)

  const gesto = useCallback((g: PetGesto) => {
    const el = gestoRef.current
    if (!el || typeof el.animate !== 'function') return
    el.animate(PET_GESTOS[g], { duration: g === 'spin' ? 800 : 700, easing: 'cubic-bezier(.34,1.3,.64,1)' })
  }, [])

  // Flotar en el lugar, siempre que esté animado.
  useEffect(() => {
    const el = flotarRef.current
    if (!anim || !el || typeof el.animate !== 'function') return
    const a = el.animate(
      [{ transform: 'translateY(0) scale(1,1)' }, { transform: 'translateY(-2.5px) scale(.985,1.015)' }],
      { duration: 1800, iterations: Infinity, direction: 'alternate', easing: 'ease-in-out' },
    )
    return () => a.cancel()
  }, [anim])

  // El gesto del módulo: al aparecer solo si está vivo; al cambiar de módulo,
  // siempre (también el pet quieto del menú tiene que verse cambiar).
  const moduloPrevio = useRef<string | null>(null)
  useEffect(() => {
    const primera = moduloPrevio.current === null
    const cambio = !primera && moduloPrevio.current !== m.id
    moduloPrevio.current = m.id
    if ((primera && anim) || (cambio && trans)) gesto(m.gesto)
  }, [anim, trans, m.id, m.gesto, gesto])

  useEffect(() => () => clearTimeout(timer.current), [])

  const tocar = () => {
    if (!interactivo) return
    clearTimeout(timer.current)
    setCosquillas(true)
    onCosquillas?.(true)
    gesto(PET_GESTOS_COSQUILLAS[Math.floor(Math.random() * PET_GESTOS_COSQUILLAS.length)])
    timer.current = setTimeout(() => {
      setCosquillas(false)
      onCosquillas?.(false)
    }, DURACION_COSQUILLAS)
  }

  const cara: PetCara = cosquillas ? 'f2' : estado === 'escribiendo' ? 'f5' : estado === 'pensando' ? 'f4' : m.cara
  const accesorio: PetAccesorio | null = cosquillas ? null : estado === 'escribiendo' ? 'ac5' : estado === 'pensando' ? 'ac11' : m.accesorio
  const [vx, vy] = m.visor

  const lienzo = disc ? size * 0.8 : size

  return (
    <span
      className="orbi-pet"
      style={{
        width: size, height: size, flexShrink: 0,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        borderRadius: disc ? '50%' : undefined,
        background: disc ? '#0a0e1a' : undefined,
      }}
    >
      <svg
        viewBox="0 0 100 100"
        overflow="visible"
        style={{ width: lienzo, height: lienzo, display: 'block', overflow: 'visible', cursor: interactivo ? 'pointer' : undefined }}
        onClick={interactivo ? tocar : undefined}
        {...(interactivo ? { role: 'img', 'aria-label': `Orbi, ${m.nombre}` } : { 'aria-hidden': true, focusable: false })}
      >
        <PetDefs id={id} />
        <OrbitaAtras a={anim} u={u} />

        <g ref={flotarRef} style={{ transformOrigin: '50px 50px' }}>
          <g ref={gestoRef} style={{ transformOrigin: '50px 50px' }}>
            <g filter={u('sh')}>
              {trans
                // Están las nueve formas y se cruzan con un resorte al cambiar de
                // módulo. Solo la activa, y solo si está vivo, lleva sus animaciones
                // SMIL (engranaje, destellos).
                ? PET_MODULOS.map(x => {
                  const on = x.id === m.id
                  return (
                    <g key={x.id} style={{
                      transformOrigin: '50px 50px',
                      transform: on ? 'scale(1) translateY(0px)' : 'scale(.5) translateY(8px)',
                      opacity: on ? 1 : 0,
                      transition: `transform .6s ${RESORTE}, opacity .3s`,
                    }}>
                      <Cuerpo id={x.cuerpo} a={on && anim} u={u} />
                    </g>
                  )
                })
                : <Cuerpo id={m.cuerpo} a={false} u={u} />}
            </g>

            <g
              transform={trans ? undefined : `translate(${vx} ${vy})`}
              style={trans ? { transform: `translate(${vx}px, ${vy}px)`, transition: `transform .6s ${RESORTE}` } : undefined}
            >
              <Visor a={anim} u={u} />
              <g key={cara} className={trans ? 'orbi-pet-cara' : undefined}><Cara id={cara} a={anim} /></g>
            </g>

            {accesorio && (
              <g key={accesorio} className={trans ? 'orbi-pet-ac' : undefined} style={{ pointerEvents: 'none' }}>
                <Accesorio id={accesorio} a={anim} />
              </g>
            )}
          </g>
        </g>

        <OrbitaAdelante a={anim} u={u} />
      </svg>
      {trans && (
        <style>{`
          .orbi-pet-cara { animation: orbiPetAparece .2s ease-out }
          .orbi-pet-ac { transform-origin: 80px 22px; animation: orbiPetPop .5s ${RESORTE} }
          @keyframes orbiPetAparece { from { opacity: 0 } to { opacity: 1 } }
          @keyframes orbiPetPop { from { transform: scale(0) } to { transform: scale(1) } }
        `}</style>
      )}
    </span>
  )
}
