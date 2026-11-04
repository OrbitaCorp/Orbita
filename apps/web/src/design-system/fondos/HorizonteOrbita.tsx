// El horizonte de Órbita: la composición de la landing (el planeta con su línea de
// luz, los anillos de órbita, las estrellas y los cometas) llevada a la banda de
// arriba de los paneles. Lo pidió Ale: "tiene que ser lo que es Órbita el diseño,
// no tan fantástico sino minimalista", después de probar fondos con shaders de
// colores, y después "con el tema de los meteoritos, parecido a lo que está en
// oscuro, algo copado representativo de Órbita".
//
// Misma marca que la escena de la landing (design-system/EscenaEspacial): se usan
// su paleta, su línea del amanecer, sus anillos (el del medio punteado), su manera
// de dibujar el resplandor (trazos anchos y translúcidos en vez de un blur, que es
// carísimo), sus estrellas que titilan y sus cometas. La composición también es la
// de la landing: arriba el cielo (ahí va el encabezado de la página), la línea del
// horizonte justo debajo, y el contenido apoyado sobre el planeta. Los cometas cruzan
// el cielo en diagonal y se esconden detrás del planeta al llegar al horizonte. El
// cuerpo del planeta es el surface del panel (salvo con `planetaOscuro`).
//
// `tope`: a cuántos px del borde de arriba va la cima del horizonte (el armazón lo
// pone debajo del encabezado de cada página). Sin `tope`, a un tercio del alto.
// `evitar`: la caja del texto del encabezado; los cometas se desvanecen al acercarse,
// así nunca pasan por detrás de lo que se lee. `piso`: de ahí para abajo empieza el
// contenido (donde la curva baja puede haber texto suelto): los cometas se apagan antes.
//
// Capas: el cielo (SVG), las estrellas y los cometas (canvas), y adelante los anillos,
// el resplandor, el planeta y la línea (SVG): por eso el planeta tapa a los cometas.
// El satélite del logo recorre el anillo de adentro en su propia capa. El canvas se
// frena fuera de pantalla y con la pestaña oculta; con prefers-reduced-motion las
// estrellas quedan quietas y no hay cometas ni satélite.
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
// Cometas en claro: cabeza en el azul de marca y cola celeste (en oscuro, los de la landing).
const COMETA_CLARO: [string, string] = ['rgba(37,99,235,', 'rgba(96,165,250,']
// Anillos en escritorio: px por encima del horizonte (en el centro). Con el arco chato de
// la banda, los factores de la landing (1,30 / 1,16 / 1,05 del radio) quedaban fuera de la
// banda; así se reparten en el cielo, detrás del encabezado.
const ANILLOS_PX: Record<number, number> = { 1: 112, 2: 68, 3: 30 }

export interface Caja { x: number; y: number; w: number; h: number }
interface Cometa { x: number; y: number; vx: number; vy: number; largo: number; vida: number; total: number; brillo: number }

// Como los de la landing: entran por arriba o por los costados altos y bajan en diagonal.
// En la banda el cielo es bajo, así que bajan un poco menos inclinados para lucirse antes
// de esconderse detrás del planeta.
function nuevoCometa(W: number, H: number): Cometa {
  const desdeArriba = Math.random() < 0.55
  const x = desdeArriba ? Math.random() * W : (Math.random() < 0.5 ? -40 : W + 40)
  const y = desdeArriba ? -30 : Math.random() * H * 0.35
  const haciaLaDerecha = x < W / 2
  const ang = (haciaLaDerecha ? 0.3 : Math.PI - 0.3) + (Math.random() - 0.5) * 0.18
  const vel = 1.1 + Math.random() * 0.8
  return {
    x, y, vx: Math.cos(ang) * vel, vy: Math.sin(ang) * vel,
    largo: 110 + Math.random() * 130, vida: 0, total: 3600 + Math.random() * 2200,
    brillo: 0.6 + Math.random() * 0.35,
  }
}

// Distancia de un punto a una caja (0 adentro).
const distancia = (px: number, py: number, c: Caja) => Math.hypot(Math.max(c.x - px, 0, px - (c.x + c.w)), Math.max(c.y - py, 0, py - (c.y + c.h)))

export default function HorizonteOrbita({ oscuro = false, planetaOscuro = false, tope, evitar, piso, className }: { oscuro?: boolean; planetaOscuro?: boolean; tope?: number; evitar?: Caja | null; piso?: number; className?: string }) {
  const raiz = useRef<HTMLDivElement>(null)
  const lienzo = useRef<HTMLCanvasElement>(null)
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

  // Las primitivas de `evitar` (y no el objeto) para que el efecto no se rearme en cada render.
  const ex = evitar?.x ?? -1, ey = evitar?.y ?? -1, ew = evitar?.w ?? 0, eh = evitar?.h ?? 0
  const suelo = piso ?? Infinity

  // Estrellas que titilan y cometas, en el canvas (la misma cuenta que la escena de la landing).
  useEffect(() => {
    const canvas = lienzo.current
    const ctx = canvas?.getContext('2d') ?? null
    if (!canvas || !ctx || !dibujo) return
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    canvas.width = Math.round(W * dpr)
    canvas.height = Math.round(H * dpr)
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    const reducido = window.matchMedia(MOVIMIENTO_REDUCIDO).matches
    const caja: Caja | null = ew > 0 ? { x: ex, y: ey, w: ew, h: eh } : null
    const brilloEstrella = paleta.cieloOpacidad * (oscuro ? 1 : 1.6)
    const cometa = oscuro ? paleta.cometa : COMETA_CLARO
    const cometas: Cometa[] = []
    let proximo = 700
    let raf = 0
    let visible = true
    let anterior = performance.now()
    const t0 = anterior

    const cuadro = (ahora: number) => {
      raf = 0
      const dt = Math.min(ahora - anterior, 50)
      anterior = ahora
      const seg = (ahora - t0) / 1000
      ctx.clearRect(0, 0, W, H)

      // Estrellas: cada una con su ritmo, más tiempo tenue y un pico corto de brillo.
      for (const e of dibujo.estrellas) {
        const latido = reducido ? 0.75 : 0.5 + 0.5 * Math.sin(seg * e.vel + e.fase)
        const alpha = e.base * brilloEstrella * (0.32 + 0.68 * latido * latido)
        ctx.fillStyle = `${paleta.estrella}${alpha.toFixed(3)})`
        ctx.beginPath()
        ctx.arc(e.x, e.y, e.r, 0, Math.PI * 2)
        ctx.fill()
        if (e.r > 1.1 && latido > 0.72) {
          const halo = ctx.createRadialGradient(e.x, e.y, 0, e.x, e.y, e.r * 5)
          halo.addColorStop(0, `${paleta.estrella}${(alpha * 0.5).toFixed(3)})`)
          halo.addColorStop(1, `${paleta.estrella}0)`)
          ctx.fillStyle = halo
          ctx.beginPath()
          ctx.arc(e.x, e.y, e.r * 5, 0, Math.PI * 2)
          ctx.fill()
        }
      }
      if (reducido) return

      // Cometas: uno cada tanto, hasta tres a la vez.
      proximo -= dt
      if (proximo <= 0) {
        if (cometas.length < 3) cometas.push(nuevoCometa(W, H))
        proximo = 1100 + Math.random() * 2200
      }
      for (let i = cometas.length - 1; i >= 0; i--) {
        const c = cometas[i]
        c.vida += dt
        c.x += c.vx * dt * 0.06
        c.y += c.vy * dt * 0.06
        const vidaN = c.vida / c.total
        if (vidaN >= 1 || c.x < -240 || c.x > W + 240 || c.y > H + 240) { cometas.splice(i, 1); continue }
        const norma = Math.hypot(c.vx, c.vy) || 1
        const tx = c.x - (c.vx / norma) * c.largo
        const ty = c.y - (c.vy / norma) * c.largo
        // Entra y sale con un fundido; cerca del texto del encabezado se apaga.
        let alpha = c.brillo * Math.min(vidaN / 0.2, (1 - vidaN) / 0.3, 1)
        if (caja) {
          const d = Math.min(distancia(c.x, c.y, caja), distancia((c.x + tx) / 2, (c.y + ty) / 2, caja), distancia(tx, ty, caja))
          alpha *= Math.min(Math.max((d - 6) / 34, 0), 1)
        }
        // La cabeza es lo más bajo del cometa: se apaga en los últimos 28 px antes del piso.
        alpha *= Math.min(Math.max((suelo - c.y) / 28, 0), 1)
        if (alpha <= 0.01) continue
        // La cola, dos veces: un brillo ancho y suave abajo y la línea fina encima (en el cielo
        // claro, la línea sola se perdía).
        ctx.lineCap = 'round'
        for (const [ancho, k] of [[5, 0.22], [1.8, 1]] as const) {
          const grad = ctx.createLinearGradient(c.x, c.y, tx, ty)
          grad.addColorStop(0, `${cometa[0]}${(alpha * k).toFixed(3)})`)
          grad.addColorStop(0.35, `${cometa[1]}${(alpha * k * 0.45).toFixed(3)})`)
          grad.addColorStop(1, `${cometa[1]}0)`)
          ctx.strokeStyle = grad
          ctx.lineWidth = ancho
          ctx.beginPath()
          ctx.moveTo(c.x, c.y)
          ctx.lineTo(tx, ty)
          ctx.stroke()
        }
        // La cabeza: un punto con brillo, para que se lea como meteorito y no como una raya.
        const cabeza = ctx.createRadialGradient(c.x, c.y, 0, c.x, c.y, 6)
        cabeza.addColorStop(0, `${cometa[0]}${alpha.toFixed(3)})`)
        cabeza.addColorStop(0.4, `${cometa[0]}${(alpha * 0.5).toFixed(3)})`)
        cabeza.addColorStop(1, `${cometa[0]}0)`)
        ctx.fillStyle = cabeza
        ctx.beginPath()
        ctx.arc(c.x, c.y, 6, 0, Math.PI * 2)
        ctx.fill()
      }
      if (visible && !document.hidden) raf = requestAnimationFrame(cuadro)
    }

    const despertar = () => { if (!raf && visible && !document.hidden) { anterior = performance.now(); raf = requestAnimationFrame(cuadro) } }
    const io = new IntersectionObserver(([en]) => { visible = en.isIntersecting; despertar() })
    io.observe(canvas)
    document.addEventListener('visibilitychange', despertar)
    raf = requestAnimationFrame(cuadro)
    return () => {
      cancelAnimationFrame(raf)
      io.disconnect()
      document.removeEventListener('visibilitychange', despertar)
    }
  }, [dibujo, W, H, oscuro, paleta, ex, ey, ew, eh, suelo])

  const capa = { position: 'absolute', inset: 0 } as const
  return (
    <div ref={raiz} className={className} style={{ position: 'absolute', inset: 0, overflow: 'hidden', background: oscuro && planetaOscuro ? '#05080F' : undefined }} aria-hidden="true">
      {dibujo && (
        <>
          {/* El cielo, solo arriba del horizonte: de noche en oscuro; en claro, celeste muy suave que
              se aclara hacia el horizonte (el amanecer de la landing). */}
          <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={capa} focusable="false">
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
          </svg>
          <canvas ref={lienzo} style={{ ...capa, width: W, height: H }} />
          <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={capa} focusable="false">
            {dibujo.anillos.map(({ n, d }) => (
              <path key={n} d={d} fill="none" stroke={oscuro ? paleta.anillo(n) : ANILLO_CLARO(n)} strokeWidth={1} strokeDasharray={n === 2 ? '5 8' : undefined} />
            ))}
            {RESPLANDOR.map((ancho, i) => (
              <path key={ancho} d={dibujo.horizonte} fill="none" stroke={oscuro ? paleta.glow[i] : GLOW_CLARO[i]} strokeWidth={ancho} />
            ))}
            {/* El cuerpo del planeta tapa la mitad de adentro del resplandor (y a los cometas que bajan). */}
            <path d={`${dibujo.horizonte} L${W} ${H} L0 ${H} Z`} fill={planetaOscuro ? paleta.planeta : 'var(--color-surface)'} />
            <path d={dibujo.horizonte} fill="none" stroke={oscuro ? paleta.linea : LINEA_CLARA} strokeWidth={1.6} />
          </svg>
          {!sinMovimiento && (
            <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ ...capa, willChange: 'transform' }} focusable="false">
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
