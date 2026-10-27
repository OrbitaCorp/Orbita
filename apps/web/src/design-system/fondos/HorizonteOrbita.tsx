// El horizonte de Órbita: la composición de la landing (el planeta con su línea de
// luz, los anillos de órbita y las estrellas) llevada a la banda de arriba de los
// paneles. Lo pidió Ale: "tiene que ser lo que es Órbita el diseño, no tan
// fantástico sino minimalista", después de probar fondos con shaders de colores.
//
// Misma marca que la escena de la landing (design-system/EscenaEspacial): se usan
// su paleta, su línea del amanecer, sus anillos (el del medio punteado) y su manera
// de dibujar el resplandor (trazos anchos y translúcidos en vez de un blur, que es
// carísimo). La composición también es la de la landing: arriba el cielo (ahí va el
// encabezado de la página), la línea del horizonte justo debajo, y el contenido
// apoyado sobre el planeta. El cuerpo del planeta es el surface del panel (salvo con
// `planetaOscuro`): lo que se ve es la luz del horizonte, no una mancha.
//
// `tope`: a cuántos px del borde de arriba va la cima del horizonte (el armazón lo
// pone debajo del encabezado de cada página). Sin `tope`, a un tercio del alto.
//
// Lo único que se mueve es un satélite (el del logo) que recorre el anillo de adentro
// despacio (ese anillo nunca pasa por detrás del encabezado); va en su propia capa para que el navegador no vuelva a pintar el
// resplandor en cada cuadro. Con prefers-reduced-motion no se mueve.
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { PALETAS, RING_SCALE_MOVIL, arco, generarEstrellas } from '@/design-system/EscenaEspacial'

const MOVIMIENTO_REDUCIDO = '(prefers-reduced-motion: reduce)'
const suscribir = (aviso: () => void) => {
  const mq = window.matchMedia(MOVIMIENTO_REDUCIDO)
  mq.addEventListener('change', aviso)
  return () => mq.removeEventListener('change', aviso)
}
const quieto = () => window.matchMedia(MOVIMIENTO_REDUCIDO).matches

// Anchos del resplandor del horizonte, de afuera hacia adentro (los de la landing).
const RESPLANDOR = [420, 220, 110, 48, 18, 6]
// En claro, anillos y línea un poco más marcados que en la landing: acá van sobre un cielo
// celeste y no sobre la página entera, y tienen que verse sin competir con el texto.
const ANILLO_CLARO = (n: number) => `rgba(37,99,235,${n === 1 ? 0.18 : 0.26})`
const LINEA_CLARA = 'rgba(37,99,235,.6)'
// El resplandor en claro, solo en azules de marca: el de la landing pasaba por índigo y en la
// banda celeste quedaba lavanda.
const GLOW_CLARO = ['rgba(59,130,246,.05)', 'rgba(59,130,246,.06)', 'rgba(96,165,250,.10)', 'rgba(147,197,253,.20)', 'rgba(191,219,254,.45)', 'rgba(219,234,254,.85)']
// Anillos en escritorio: px por encima del horizonte (en el centro). Con el arco chato de
// la banda, los factores de la landing (1,30 / 1,16 / 1,05 del radio) quedaban fuera de la
// banda; así se reparten en el cielo, detrás del encabezado.
const ANILLOS_PX: Record<number, number> = { 1: 112, 2: 68, 3: 30 }

export default function HorizonteOrbita({ oscuro = false, planetaOscuro = false, tope, className }: { oscuro?: boolean; planetaOscuro?: boolean; tope?: number; className?: string }) {
  const raiz = useRef<HTMLDivElement>(null)
  const [medidas, setMedidas] = useState({ W: 0, H: 0 })
  const sinMovimiento = useSyncExternalStore(suscribir, quieto, () => false)

  useEffect(() => {
    const el = raiz.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => {
      const W = Math.round(e.contentRect.width), H = Math.round(e.contentRect.height)
      setMedidas(m => (m.W === W && m.H === H ? m : { W, H }))
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const { W, H } = medidas
  const paleta = PALETAS[oscuro ? 'oscuro' : 'claro']
  const angosto = W > 0 && W <= 480
  // El arco: el de la landing en celular; más chato cuanto más ancho (se ve como desde más alto).
  const R = (angosto ? 1.1 : W <= 900 ? 1.6 : 2.5) * W
  const cima = tope ?? H / 3
  const cy = cima + R

  const dibujo = useMemo(() => {
    if (!W || !H) return null
    const horizonte = arco(W / 2, cy, R, W)
    const yHorizonte = (x: number) => cy - Math.sqrt(Math.max(R * R - (x - W / 2) ** 2, 0))
    // Solo las estrellas del cielo (arriba del horizonte), más ralas que en la landing.
    const estrellas = generarEstrellas(W, H).filter((e, i) => i % 2 === 0 && e.y < yHorizonte(e.x) - 10)
    const radio = (n: number) => (angosto ? RING_SCALE_MOVIL[n] * R : R + ANILLOS_PX[n])
    const anillos = ([1, 2, 3] as const).map(n => ({ n, d: arco(W / 2, cy, radio(n), W) }))
    return { horizonte, estrellas, anillos }
  }, [W, H, R, cy, angosto])

  return (
    <div ref={raiz} className={className} style={{ position: 'absolute', inset: 0, overflow: 'hidden', background: oscuro && planetaOscuro ? '#05080F' : undefined }} aria-hidden="true">
      {dibujo && (
        <>
          <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ position: 'absolute', inset: 0 }} focusable="false">
            {/* El cielo, solo arriba del horizonte: de noche en oscuro; en claro, celeste muy suave que
                se aclara hacia el horizonte (el amanecer de la landing). */}
            {oscuro && !planetaOscuro && <path d={`${dibujo.horizonte} L${W} 0 L0 0 Z`} fill="#05080F" />}
            {!oscuro && (
              <>
                <defs>
                  <linearGradient id="ho-cielo-claro" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0" stopColor="#DBEAFE" />
                    <stop offset="0.6" stopColor="#EAF2FF" />
                    <stop offset="1" stopColor="#F4F8FE" />
                  </linearGradient>
                </defs>
                <path d={`${dibujo.horizonte} L${W} 0 L0 0 Z`} fill="url(#ho-cielo-claro)" />
              </>
            )}
            {dibujo.estrellas.map((e, i) => (
              <circle key={i} cx={e.x.toFixed(1)} cy={e.y.toFixed(1)} r={e.r} fill={`${paleta.estrella}${(e.base * paleta.cieloOpacidad * (oscuro ? 1 : 1.6)).toFixed(3)})`} />
            ))}
            {dibujo.anillos.map(({ n, d }) => (
              <path key={n} d={d} fill="none" stroke={oscuro ? paleta.anillo(n) : ANILLO_CLARO(n)} strokeWidth={1} strokeDasharray={n === 2 ? '5 8' : undefined} />
            ))}
            {RESPLANDOR.map((ancho, i) => (
              <path key={ancho} d={dibujo.horizonte} fill="none" stroke={oscuro ? paleta.glow[i] : GLOW_CLARO[i]} strokeWidth={ancho} />
            ))}
            {/* El cuerpo del planeta tapa la mitad de adentro del resplandor: la luz queda arriba del horizonte. */}
            <path d={`${dibujo.horizonte} L${W} ${H} L0 ${H} Z`} fill={planetaOscuro ? paleta.planeta : 'var(--color-surface)'} />
            <path d={dibujo.horizonte} fill="none" stroke={oscuro ? paleta.linea : LINEA_CLARA} strokeWidth={1.6} />
          </svg>
          {!sinMovimiento && (
            <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ position: 'absolute', inset: 0, willChange: 'transform' }} focusable="false">
              <defs>
                <radialGradient id="ho-halo">
                  <stop offset="0" stopColor={oscuro ? '#FFFFFF' : '#3B82F6'} stopOpacity={oscuro ? 0.9 : 0.45} />
                  <stop offset="1" stopColor="#3B82F6" stopOpacity="0" />
                </radialGradient>
              </defs>
              {/* El satélite del logo, sobre el anillo de adentro: entra por un costado y sale por el otro. */}
              <g>
                <animateMotion path={dibujo.anillos[2].d} dur="38s" repeatCount="indefinite" />
                <animate attributeName="opacity" values="0;1;1;0" keyTimes="0;0.08;0.92;1" dur="38s" repeatCount="indefinite" />
                <circle r={9} fill="url(#ho-halo)" />
                <circle r={2.6} fill={oscuro ? '#FFFFFF' : '#3B82F6'} />
              </g>
            </svg>
          )}
        </>
      )}
    </div>
  )
}
