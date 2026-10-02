// Vista previa del sitio público del negocio, en un iframe de la demo
// (/turnos-demo/negocio, /simple o /reserva, según la forma de página elegida)
// dibujado a su ancho real y escalado, igual que StorePreview de Tienda.
//
// Sin backend el sitio no puede leer lo que se está editando, así que el
// iframe carga el sitio del rubro y, como es del mismo origen, se lo "viste"
// desde afuera con la plantilla elegida:
//   0. la plantilla va en la dirección (?probar=): el sitio se dibuja con su
//      composición, sus tarjetas y su textura de verdad, sin guardar nada;
//   1. una hoja de estilos que pisa las variables del tema (las que devuelve
//      variablesTema: colores, tipografías y radios);
//   2. un repintado de los colores que el sitio trae escritos en estilos
//      inline (se reemplaza cada color del tema original por el de la
//      plantilla, propiedad por propiedad);
//   3. la foto de la portada y las fuentes del par tipográfico.
// Lo que no se puede cambiar desde afuera (el estilo del botón, los textos y el
// orden de las secciones) se avisa abajo del marco.
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Monitor, Smartphone, ExternalLink, Lock, RotateCw } from 'lucide-react'
import type { RubroTurnos } from '@/modules/turnos/datos'
import type { FormaSitio } from '@/modules/turnos/demo/negocioDemo'
import { temaDe, variablesTema } from '@/modules/turnos/storefront/tema'
import type { AjustesPlantilla, Paleta, PlantillaSitio } from './datos'

const DESIGN_W = 1280
const MOVIL_W = 390
const MOVIL_H = 844

export type Pagina = 'negocio' | 'reserva'
export type Dispositivo = 'escritorio' | 'celular'

export interface Pisar {
  /** Paleta que tiene que quedar y paleta que trae el sitio del rubro (la que se reemplaza). */
  paleta: Paleta
  base: Paleta
  /** Variables CSS del tema, tal cual las arma variablesTema(). */
  vars: Record<string, string>
  mayus: boolean
  /** Specs de Google Fonts del par elegido. */
  google: string[]
  /** Foto del hero original del tema (la que se reemplaza) y la elegida. */
  fotoOriginal: string
  foto: string
}

/**
 * Arma lo que hay que pisar en el iframe. El iframe ya carga el sitio con la
 * plantilla puesta (?probar=), así que lo que se reemplaza es esa plantilla de
 * fábrica por la misma con los ajustes del editor (acento, letra, bordes y foto).
 */
export function armarPisar(rubro: RubroTurnos, p: PlantillaSitio, ajustes?: AjustesPlantilla): Pisar {
  const con = (a?: AjustesPlantilla) => temaDe({ ...rubro, apariencia: { rubro: rubro.key, plantilla: p.id, color: a?.color ?? '', tipo: a?.tipo ?? '', radio: a?.radio ?? 0, foto: a?.foto ?? '' } })
  const base = con()
  const fin = con(ajustes)
  return { paleta: fin.c, base: base.c, mayus: !!fin.mayus, google: fin.fuentes, vars: variablesTema(fin), fotoOriginal: base.fotoHero, foto: fin.fotoHero }
}

// ─── Repintado de colores inline ─────────────────────────────────────────────

const ROLES: (keyof Paleta)[] = ['bg', 'surface', 'surfaceAlt', 'border', 'text', 'body', 'muted', 'primary', 'primaryH', 'primaryBg', 'onPrimary']
const BLANCO = '255,255,255'
const NEGRO = '0,0,0'

/** "r,g,b" de un hex o de un rgb()/rgba(): es lo que queda en un style ya serializado por el navegador. */
function terna(color: string): string | null {
  const h = /^#([0-9a-f]{6})$/i.exec(color.trim())
  if (h) { const n = parseInt(h[1], 16); return `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255}` }
  const r = /rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})/i.exec(color)
  return r ? `${r[1]},${r[2]},${r[3]}` : null
}

type Uso = 'tinta' | 'fondo' | 'borde'

// El negro y el blanco puros no se tocan donde pueden ser otra cosa: un velo
// negro sobre una foto o un texto blanco arriba de la portada no son "el color
// de fondo del tema" aunque valgan lo mismo.
function mapaDe(origen: Paleta, destino: Paleta, uso: Uso): Map<string, string> {
  const m = new Map<string, string>()
  for (const rol of ROLES) {
    const de = terna(origen[rol]), a = terna(destino[rol])
    if (!de || !a || m.has(de) || de === NEGRO) continue
    if (de === BLANCO && uso !== 'fondo') continue
    m.set(de, a)
  }
  return m
}

const RE_DECL = /([a-z-]+)\s*:\s*([^;]+)/gi
const RE_TERNA = /(\d{1,3}),\s*(\d{1,3}),\s*(\d{1,3})(\s*,\s*[\d.]+)?/g
const RE_HEX = /#[0-9a-f]{6}\b/gi

function usoDe(prop: string): Uso | null {
  if (prop.startsWith('--')) return null
  if (prop.startsWith('background')) return 'fondo'
  if (prop.startsWith('border') || prop.startsWith('outline')) return 'borde'
  if (prop === 'color' || prop === 'fill' || prop === 'stroke' || prop === 'caret-color' || prop === 'text-decoration-color') return 'tinta'
  return null
}

// Cada elemento guarda el estilo con el que vino (data-tuc-de) y el que le
// dejamos (data-tuc-a). Siempre se repinta desde el original: así cambiar de
// plantilla dos veces no encadena reemplazos, y si el sitio le reescribe el
// estilo (lo que hay ya no es lo que dejamos) ese pasa a ser el nuevo original.
function repintar(doc: Document, p: Pisar) {
  const mapas: Record<Uso, Map<string, string>> = { tinta: mapaDe(p.base, p.paleta, 'tinta'), fondo: mapaDe(p.base, p.paleta, 'fondo'), borde: mapaDe(p.base, p.paleta, 'borde') }
  doc.querySelectorAll<HTMLElement>('[style]').forEach(el => {
    const actual = el.getAttribute('style') ?? ''
    const original = el.dataset.tucA === actual && el.dataset.tucDe !== undefined ? el.dataset.tucDe : actual
    if (!original.includes('rgb') && !original.includes('#')) return
    const n = original.replace(RE_DECL, (todo, prop: string, valor: string) => {
      const uso = usoDe(prop.toLowerCase())
      if (!uso) return todo
      const v = valor
        .replace(RE_TERNA, (t, r: string, g: string, b: string, alfa?: string) => {
          const clave = `${r},${g},${b}`
          // Un blanco con transparencia es un vidrio o un brillo, no el fondo del tema.
          if (clave === BLANCO && alfa) return t
          const a = mapas[uso].get(clave)
          return a ? `${a.replace(/,/g, ', ')}${alfa ?? ''}` : t
        })
        // Lo que vino del servidor todavía está en hex: el navegador recién lo
        // pasa a rgb() cuando alguien toca ese estilo desde JavaScript.
        .replace(RE_HEX, t => {
          const a = mapas[uso].get(terna(t) ?? '')
          return a ? `rgb(${a.replace(/,/g, ', ')})` : t
        })
      return `${prop}: ${v}`
    })
    if (n === original && el.dataset.tucDe === undefined) return
    el.dataset.tucDe = original
    el.dataset.tucA = n
    if (n !== actual) el.setAttribute('style', n)
  })
}

function cssPisado(p: Pisar) {
  const vars = Object.entries(p.vars).map(([k, v]) => `${k}:${v}!important`).join(';')
  return `.tu-barra-demo{display:none!important}
.tu-sitio{${vars}}
${p.mayus ? '.tu-sitio .tu-h{text-transform:uppercase!important}' : '.tu-sitio .tu-h{text-transform:none!important}'}`
}

// Aplica los ajustes al documento del iframe. Best effort: si el iframe todavía
// no cargó o cambió de página, se vuelve a aplicar en el próximo onLoad.
function aplicar(frame: HTMLIFrameElement | null, p: Pisar) {
  try {
    const d = frame?.contentDocument
    if (!d?.head || !d.body) return
    let s = d.getElementById('tuc-pisar') as HTMLStyleElement | null
    if (!s) { s = d.createElement('style'); s.id = 'tuc-pisar'; d.head.appendChild(s) }
    const css = cssPisado(p)
    if (s.textContent !== css) s.textContent = css
    for (const spec of p.google) {
      const id = 'tuc-font-' + spec.replace(/\W/g, '')
      if (d.getElementById(id)) continue
      const link = d.createElement('link')
      link.id = id; link.rel = 'stylesheet'; link.href = `https://fonts.googleapis.com/css2?family=${spec}&display=swap`
      d.head.appendChild(link)
    }
    d.querySelectorAll('img').forEach(img => {
      const orig = img.dataset.tucOrig ?? img.getAttribute('src') ?? ''
      if (orig === p.fotoOriginal || img.dataset.tucOrig) {
        img.dataset.tucOrig = orig
        if (img.getAttribute('src') !== p.foto) img.setAttribute('src', p.foto)
      }
    })
    repintar(d, p)
  } catch { /* otro origen o documento en transición: no hay nada que pisar */ }
}

/**
 * ¿El sitio de adentro ya terminó de hidratar? Lo marca SitioNegocio en
 * <html data-tu-listo>. Si se le pisan los estilos antes, React encuentra un
 * HTML distinto del que mandó el servidor y lo avisa en la consola.
 */
function hidratado(frame: HTMLIFrameElement | null): boolean {
  try { return frame?.contentDocument?.documentElement.dataset.tuListo === 'si' } catch { return false }
}

export const CSS_VISTA_PREVIA = `
  .tuc-vp { display: flex; flex-direction: column; min-height: 0; border-radius: 18px; overflow: hidden; border: 1px solid var(--color-border); background: var(--color-bg);
    box-shadow: 0 1px 0 rgba(255,255,255,0.04) inset, 0 24px 60px -24px rgba(15,23,42,0.35), 0 8px 24px -12px rgba(37,99,235,0.18); }
  .tuc-vp-barra { min-height: 48px; flex-shrink: 0; border-bottom: 1px solid var(--color-border); display: flex; align-items: center; gap: 8px; padding: 7px 10px; flex-wrap: wrap; background: var(--color-surface); }
  .tuc-vp-luces { display: inline-flex; gap: 6px; padding: 0 4px 0 2px; flex-shrink: 0; }
  .tuc-vp-luces > span { width: 10px; height: 10px; border-radius: 50%; background: var(--color-border-strong); }
  .tuc-vp-url { flex: 1; min-width: 0; display: flex; justify-content: center; }
  .tuc-vp-url > span { height: 28px; padding: 0 12px; border-radius: 999px; background: var(--color-bg); border: 1px solid var(--color-border); display: inline-flex; align-items: center; gap: 6px; font-size: 11.5px;
    color: var(--color-muted); font-family: var(--tuo-mono, "Geist Mono", monospace); max-width: 100%; overflow: hidden; }
  .tuc-vp-mini { display: inline-flex; padding: 2px; gap: 2px; border-radius: 10px; background: var(--color-surface-alt); border: 1px solid var(--color-border); flex-shrink: 0; }
  .tuc-vp-mini > button { height: 30px; min-width: 32px; padding: 0 11px; border-radius: 8px; border: none; cursor: pointer; font-family: inherit; display: grid; place-items: center; font-size: 12px; font-weight: 500;
    background: transparent; color: var(--color-muted); transition: background 180ms ease, color 160ms ease, box-shadow 180ms ease; }
  .tuc-vp-mini > button[data-icono='true'] { padding: 0; }
  .tuc-vp-mini > button[aria-checked='true'] { background: var(--color-bg); color: var(--color-text); font-weight: 600; box-shadow: 0 1px 3px rgba(15,23,42,0.16); }
  .tuc-vp-mini > button:focus-visible, .tuc-vp-accion:focus-visible { outline: 2px solid var(--color-primary); outline-offset: 1px; }
  .tuc-vp-accion { width: 32px; height: 32px; border-radius: 9px; display: grid; place-items: center; color: var(--color-muted); border: 1px solid var(--color-border); background: var(--color-bg); cursor: pointer; flex-shrink: 0;
    transition: color 150ms ease, border-color 150ms ease, background 150ms ease; }
  .tuc-vp-escena { position: relative; flex: 1; min-height: 0; overflow: clip; background: var(--color-bg); }
  .tuc-vp-escena--movil { display: grid; place-items: center;
    background: radial-gradient(520px 320px at 50% 0%, color-mix(in srgb, var(--color-primary) 16%, transparent), transparent 70%), var(--color-surface-alt); }
  .tuc-vp-tel { position: relative; flex-shrink: 0; box-sizing: content-box; overflow: hidden; background: #0B0F19; border-style: solid; border-color: #0B0F19;
    box-shadow: 0 0 0 1.5px #2A3350, 0 0 0 3px #0B0F19, 0 30px 60px -18px rgba(3,6,14,0.55), 0 0 60px -10px color-mix(in srgb, var(--color-primary) 35%, transparent); }
  .tuc-vp-isla { position: absolute; top: 0; left: 50%; transform: translateX(-50%); background: #0B0F19; z-index: 2; pointer-events: none; }
  .tuc-vp-carga { position: absolute; inset: 0; display: grid; place-items: center; background: var(--color-surface); }
  .tuc-spin { animation: tucSpin 800ms linear infinite; }
  @keyframes tucSpin { to { transform: rotate(360deg); } }
  @media (hover: hover) {
    .tuc-vp-mini > button:not([aria-checked='true']):hover { color: var(--color-text); }
    .tuc-vp-accion:hover { color: var(--color-primary); border-color: color-mix(in srgb, var(--color-primary) 45%, var(--color-border)); }
  }
  @media (max-width: 560px) {
    .tuc-vp-url, .tuc-vp-luces { display: none !important; }
    .tuc-vp-barra { justify-content: space-between; }
    .tuc-vp-mini > button { height: 40px; min-width: 44px; }
    .tuc-vp-accion { width: 44px; height: 44px; }
  }
  @media (prefers-reduced-motion: reduce) { .tuc-spin { animation-duration: 2.4s; } }
`

export default function VistaPrevia({ rubroKey, probar, diseno, pisar, alto, dispositivoInicial = 'escritorio', subdominio, forma = 'web' }: {
  rubroKey: string
  /** id de la plantilla con la que se dibuja el sitio (sin guardarla). */
  probar?: string
  /** Diseño de la página simple que se muestra (sin guardarlo). */
  diseno?: string
  pisar: Pisar; alto: string; dispositivoInicial?: Dispositivo; subdominio: string
  /** Sitio web completo o página simple: cambia qué página se carga como "portada". */
  forma?: FormaSitio
}) {
  const [pagina, setPagina] = useState<Pagina>('negocio')
  const [dispositivo, setDispositivo] = useState<Dispositivo>(dispositivoInicial)
  const [vuelta, setVuelta] = useState(0)
  const esMovil = dispositivo === 'celular'
  const simple = forma === 'simple'
  const q = `?rubro=${encodeURIComponent(rubroKey)}${probar ? `&probar=${encodeURIComponent(probar)}` : ''}`
  const src = pagina === 'negocio' ? `/turnos-demo/${simple ? `simple${q}${diseno ? `&diseno=${diseno}` : ''}` : `negocio${q}`}` : `/turnos-demo/reserva${q}${simple ? '&forma=simple' : ''}`
  // Cambiar de página o de dispositivo (o recargar) remonta el iframe: vuelve a cargar.
  const clave = `${src}|${dispositivo}|${vuelta}`
  const [cargado, setCargado] = useState('')
  const cargando = cargado !== clave

  const wrapRef = useRef<HTMLDivElement>(null)
  const frameRef = useRef<HTMLIFrameElement>(null)
  const [medida, setMedida] = useState({ escala: 0.5, alto: 800 })

  useLayoutEffect(() => {
    const wrap = wrapRef.current
    if (!wrap) return
    const medir = () => {
      if (wrap.clientWidth === 0) return
      const escala = esMovil
        ? Math.min((wrap.clientWidth - 40) / (MOVIL_W + 20), (wrap.clientHeight - 40) / (MOVIL_H + 20), 1)
        : wrap.clientWidth / DESIGN_W
      setMedida({ escala, alto: wrap.clientHeight })
    }
    const ro = new ResizeObserver(medir)
    ro.observe(wrap)
    return () => ro.disconnect()
  }, [esMovil])

  // Cada cambio del editor se pisa en el iframe ya cargado, sin recargarlo.
  const pisarRef = useRef(pisar)
  useEffect(() => { pisarRef.current = pisar; if (hidratado(frameRef.current)) aplicar(frameRef.current, pisar) }, [pisar])

  // onLoad puede llegar antes de que el sitio termine de hidratar: ahí todavía no se lo toca (lo hace `revisar`).
  const alCargar = () => { if (hidratado(frameRef.current)) { aplicar(frameRef.current, pisarRef.current); setCargado(clave) } }
  // El sitio se viste cuando terminó de cargar Y de hidratar. Cubre además el
  // caso en que el iframe cargó antes de que React conectara onLoad (pasa al
  // hidratar el panel): el evento se pierde y la vista previa quedaba en
  // "Cargando…". Si a los 8 segundos no hay señal de hidratación, se viste igual.
  useEffect(() => {
    const f = frameRef.current
    let intentos = 0
    const revisar = () => {
      const doc = f?.contentDocument
      const cargo = !!doc && doc.readyState === 'complete' && doc.location.href !== 'about:blank'
      if (cargo && (hidratado(f) || intentos >= 32)) { aplicar(f, pisarRef.current); setCargado(clave); return }
      if (++intentos < 48) t = setTimeout(revisar, 250)
    }
    let t = setTimeout(revisar, 250)
    return () => clearTimeout(t)
  }, [clave])

  // El sitio sigue vivo adentro del iframe (menús, animaciones de entrada,
  // secciones que aparecen al scrollear): cada vez que React le vuelve a
  // escribir un estilo, se repinta. Repintar lo ya repintado no cambia nada,
  // así que el observador no entra en bucle.
  useEffect(() => {
    if (cargando) return
    const doc = frameRef.current?.contentDocument
    if (!doc?.body) return
    let pendiente = 0
    const mo = new MutationObserver(() => {
      if (pendiente) return
      pendiente = requestAnimationFrame(() => { pendiente = 0; aplicar(frameRef.current, pisarRef.current) })
    })
    try { mo.observe(doc.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['style', 'src'] }) } catch { /* documento en transición */ }
    return () => { mo.disconnect(); if (pendiente) cancelAnimationFrame(pendiente) }
  }, [cargando, clave])

  const { escala } = medida
  const iframe = (w: number, h: number) => (
    <iframe
      key={clave} ref={frameRef} src={src} onLoad={alCargar} title="Vista previa de tu sitio de reservas"
      style={{ width: w, height: h, border: 'none', display: 'block', transformOrigin: 'top left', transform: `scale(${escala})`, background: pisar.paleta.bg, opacity: cargando ? 0 : 1, transition: 'opacity 320ms ease' }}
    />
  )

  return (
    <div className="tuc-vp" style={{ height: alto }}>
      <div className="tuc-vp-barra">
        <span className="tuc-vp-luces" aria-hidden><span /><span /><span /></span>
        <MiniRadio label="Página de la vista previa" valor={pagina} onChange={setPagina} opciones={[['negocio', simple ? 'Página' : 'Portada'], ['reserva', 'Reserva']]} />
        <div className="tuc-vp-url">
          <span>
            <Lock size={11} aria-hidden style={{ flexShrink: 0, color: 'var(--color-success)' }} />
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{subdominio}.orbita.site{pagina === 'reserva' ? '/reservar' : ''}</span>
          </span>
        </div>
        <MiniRadio label="Tamaño de pantalla" valor={dispositivo} onChange={setDispositivo} iconos opciones={[['escritorio', 'Ver como en una computadora'], ['celular', 'Ver como en un celular']]} />
        <button type="button" className="tuc-vp-accion" aria-label="Volver a cargar la vista previa" title="Volver a cargar" onClick={() => setVuelta(v => v + 1)}><RotateCw size={14} /></button>
        <a href={src} target="_blank" rel="noreferrer" aria-label="Abrir el sitio en otra pestaña" title="Abrir en otra pestaña" className="tuc-vp-accion"><ExternalLink size={14} /></a>
      </div>

      {/* overflow: clip (no hidden): el iframe mide 1280 de layout aunque se vea escalado, y con hidden
          el contenedor igual se podía desplazar solo y la vista previa quedaba corrida. */}
      <div ref={wrapRef} className={`tuc-vp-escena${esMovil ? ' tuc-vp-escena--movil' : ''}`}>
        {esMovil ? (
          // La caja tiene la medida YA escalada: transform no ocupa lugar y
          // sin ella el teléfono no queda centrado.
          <div className="tuc-vp-tel" style={{ width: MOVIL_W * escala, height: MOVIL_H * escala, borderRadius: 46 * escala, borderWidth: Math.max(5, 10 * escala) }}>
            <span className="tuc-vp-isla" aria-hidden style={{ width: 96 * escala, height: 24 * escala, marginTop: 8 * escala, borderRadius: 999 }} />
            {iframe(MOVIL_W, MOVIL_H)}
          </div>
        ) : iframe(DESIGN_W, medida.alto / (escala || 1))}
        {cargando && (
          <div aria-live="polite" className="tuc-vp-carga">
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
              <span className="tuc-spin" aria-hidden style={{ width: 24, height: 24, borderRadius: '50%', border: '2.5px solid var(--color-border)', borderTopColor: 'var(--color-primary)' }} />
              <span style={{ fontSize: 12.5, color: 'var(--color-muted)' }}>Cargando tu sitio…</span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function MiniRadio<T extends string>({ label, valor, onChange, opciones, iconos }: {
  label: string; valor: T; onChange: (v: T) => void; opciones: [T, string][]; iconos?: boolean
}) {
  return (
    <div role="radiogroup" aria-label={label} className="tuc-vp-mini">
      {opciones.map(([id, l]) => {
        const Icono = id === 'celular' ? Smartphone : Monitor
        return (
          <button key={id} type="button" role="radio" aria-checked={valor === id} aria-label={iconos ? l : undefined} title={iconos ? l : undefined} data-icono={iconos || undefined} onClick={() => onChange(id)}>
            {iconos ? <Icono size={15} strokeWidth={1.8} /> : l}
          </button>
        )
      })}
    </div>
  )
}
