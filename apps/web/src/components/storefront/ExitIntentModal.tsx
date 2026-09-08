// Aviso de salida (paquete Avanzado → Countdown y exit-intent).
//
// Se monta en StorefrontFooter.tsx, el mismo punto global que SocialProofToast
// y ReturnRequestModal: la gracia es justamente que aparezca en cualquier
// página —el carrito y la ficha de producto son donde más se abandona—, no
// solo en la portada.
//
// Qué cuenta como "se está por ir":
//   - Escritorio: el puntero sale de la ventana por ARRIBA (hacia la barra de
//     direcciones, las pestañas o la X). Es el gesto clásico y el único que se
//     puede detectar sin molestar a nadie.
//   - Celular: un scroll rápido hacia arriba (volver al buscador o a la barra
//     del navegador). A propósito NO se usa el botón Atrás: la técnica de
//     empujar una entrada al historial para interceptarlo rompe la navegación
//     de verdad —dos toques de Atrás para salir de la tienda— y es exactamente
//     el tipo de truco que hace que la gente no vuelva.
//
// Todo el "cuándo" se resuelve en el navegador. El backend solo dice qué
// mostrar y bajo qué condiciones (ver ExitIntentService): no hay tracking por
// visitante, igual que en el resto de los módulos de Avanzado.

import { useCallback, useEffect, useRef, useState } from 'react'
import { X } from 'lucide-react'
import { getActiveExitIntent, type StorefrontExitIntent } from '@/lib/storefront/api'
import { storefrontBase } from '@/lib/tenant'

type Props = { slug: string }

// Clave de "ya se lo mostramos". Incluye campaignVersion, así "Mostrar de
// nuevo" en el panel se lo vuelve a mostrar a quien ya lo había cerrado —
// mismo mecanismo que el dismiss de PromoModal y de Juegos en Inicio.tsx.
function claveVisto(slug: string, cfg: StorefrontExitIntent): string | null {
  const base = `orbita-exit-intent:${slug}:${cfg.campaignVersion}`
  if (cfg.frequency === 'ALWAYS') return null // nunca se recuerda
  if (cfg.frequency === 'ONCE_PER_DAY') return `${base}:${new Date().toISOString().slice(0, 10)}`
  return base
}

function yaLoVio(clave: string | null): boolean {
  if (!clave) return false
  try {
    return localStorage.getItem(clave) !== null
  } catch {
    // Sin localStorage (modo privado, cookies bloqueadas) no se puede recordar
    // nada; se prefiere mostrarlo que no mostrarlo nunca.
    return false
  }
}

function marcarVisto(clave: string | null) {
  if (!clave) return
  try {
    localStorage.setItem(clave, '1')
  } catch { /* ídem: no se puede recordar, pero tampoco rompe nada */ }
}

const ES_TACTIL = () => typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches

export function ExitIntentModal({ slug }: Props) {
  const [cfg, setCfg] = useState<StorefrontExitIntent | null>(null)
  const [abierto, setAbierto] = useState(false)
  const cerrarRef = useRef<HTMLButtonElement>(null)
  // En un ref y no en estado: lo leen los listeners, y no tiene sentido
  // re-renderizar la tienda entera porque cambió.
  const yaDisparado = useRef(false)

  useEffect(() => {
    let cancelado = false
    getActiveExitIntent(slug)
      .then(c => { if (!cancelado) setCfg(c) })
      .catch(() => {}) // contenido opcional: si falla, no se muestra nada
    return () => { cancelado = true }
  }, [slug])

  const disparar = useCallback(() => {
    if (yaDisparado.current) return
    yaDisparado.current = true
    setAbierto(true)
  }, [])

  useEffect(() => {
    if (!cfg) return
    const clave = claveVisto(slug, cfg)
    if (yaLoVio(clave)) return

    const tactil = ES_TACTIL()
    if (tactil && !cfg.onMobile) return

    // El piso de segundos arranca al montar. Antes de que se cumpla no se
    // engancha ningún listener: es más barato y hace imposible el caso de
    // "entró, movió el mouse arriba y le saltó el cartel sin ver nada".
    let limpiar: (() => void) | null = null
    const listo = setTimeout(() => {
      if (tactil) {
        // Scroll rápido hacia arriba: >600px/s y estando ya lejos del tope
        // (si está arriba de todo, subir es simplemente rebotar).
        let ultimoY = window.scrollY
        let ultimoT = Date.now()
        const onScroll = () => {
          const y = window.scrollY
          const t = Date.now()
          const dt = t - ultimoT
          if (dt > 0) {
            const velocidad = (ultimoY - y) / (dt / 1000) // positiva = subiendo
            if (velocidad > 600 && ultimoY > 400) disparar()
          }
          ultimoY = y
          ultimoT = t
        }
        window.addEventListener('scroll', onScroll, { passive: true })
        limpiar = () => window.removeEventListener('scroll', onScroll)
      } else {
        // clientY <= 0 = salió por arriba. `relatedTarget` nulo confirma que
        // se fue de la ventana y no que pasó a otro elemento de la página.
        const onMouseOut = (e: MouseEvent) => {
          if (e.clientY <= 0 && !e.relatedTarget) disparar()
        }
        document.addEventListener('mouseout', onMouseOut)
        limpiar = () => document.removeEventListener('mouseout', onMouseOut)
      }
    }, cfg.minSeconds * 1000)

    return () => {
      clearTimeout(listo)
      limpiar?.()
    }
  }, [cfg, slug, disparar])

  // Al abrirse: se marca como visto (aunque lo cierre sin leer — lo vio) y el
  // foco va al botón de cerrar, que es la salida.
  useEffect(() => {
    if (!abierto || !cfg) return
    marcarVisto(claveVisto(slug, cfg))
    cerrarRef.current?.focus()
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setAbierto(false) }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [abierto, cfg, slug])

  if (!cfg || !abierto) return null

  const link = cfg.ctaLink && cfg.ctaText ? `${storefrontBase(slug)}${cfg.ctaLink}` : null

  return (
    <>
      <style>{ESTILOS}</style>
      <div className="sf-ei-fondo" onClick={() => setAbierto(false)}>
        {/* stopPropagation para que un click DENTRO de la tarjeta no la cierre.
            El backdrop sí cierra: a diferencia del modal de juegos —donde el
            dueño pidió que solo cierre con la X— este aparece sin que nadie lo
            haya pedido, así que tiene que ser fácil de sacar de encima. */}
        <div
          className="sf-ei-card" role="dialog" aria-modal="true" aria-labelledby="sf-ei-titulo"
          onClick={e => e.stopPropagation()}
        >
          <button ref={cerrarRef} onClick={() => setAbierto(false)} className="sf-ei-x" aria-label="Cerrar el aviso">
            <X size={15} strokeWidth={2.2} />
          </button>

          {cfg.badge && <span className="sf-ei-badge">{cfg.badge}</span>}
          <h2 id="sf-ei-titulo" className="sf-ei-titulo">{cfg.title}</h2>
          {cfg.message && <p className="sf-ei-msg">{cfg.message}</p>}
          {cfg.code && (
            <div className="sf-ei-codigo">
              <span className="sf-ei-codigo-label">Tu código</span>
              <span className="sf-ei-codigo-valor">{cfg.code}</span>
            </div>
          )}

          {link ? (
            <a href={link} className="sf-ei-cta">{cfg.ctaText}</a>
          ) : cfg.ctaText ? (
            <button onClick={() => setAbierto(false)} className="sf-ei-cta">{cfg.ctaText}</button>
          ) : null}

          <button onClick={() => setAbierto(false)} className="sf-ei-no">No, gracias</button>
        </div>
      </div>
    </>
  )
}

const ESTILOS = `
.sf-ei-fondo {
  position: fixed; inset: 0; z-index: 1100;
  display: flex; align-items: center; justify-content: center; padding: 16px;
  background: rgba(0,0,0,0.5);
  animation: sf-ei-fade 200ms ease-out;
}
.sf-ei-card {
  position: relative; width: 100%; max-width: 420px; box-sizing: border-box;
  background: var(--color-bg); border-radius: 18px; padding: 30px 26px 22px;
  text-align: center; box-shadow: 0 24px 64px rgba(0,0,0,0.28);
  animation: sf-ei-subir 240ms cubic-bezier(0.2, 0.8, 0.3, 1);
  max-height: calc(100vh - 32px); overflow-y: auto;
}
@keyframes sf-ei-fade { from { opacity: 0 } to { opacity: 1 } }
@keyframes sf-ei-subir { from { opacity: 0; transform: translateY(14px) } to { opacity: 1; transform: none } }
/* La entrada es decorativa: quien pidió menos movimiento la ve aparecer y ya. */
@media (prefers-reduced-motion: reduce) {
  .sf-ei-fondo, .sf-ei-card { animation: none; }
}

.sf-ei-x {
  position: absolute; top: 12px; right: 12px;
  width: 32px; height: 32px; border-radius: 50%;
  border: 1px solid var(--color-border); background: var(--color-surface);
  color: var(--color-muted); display: grid; place-items: center;
  cursor: pointer; padding: 0; font-family: inherit;
  transition: color 180ms ease, border-color 180ms ease;
}
.sf-ei-x:hover { color: var(--color-text); border-color: var(--color-muted); }

.sf-ei-badge {
  display: inline-block; font-size: 10.5px; font-weight: 800; letter-spacing: 0.08em;
  padding: 4px 11px; border-radius: 999px;
  background: var(--color-primary-bg); color: var(--color-primary); margin-bottom: 12px;
}
.sf-ei-titulo { font-size: 21px; font-weight: 800; letter-spacing: -0.01em; color: var(--color-text); margin: 0; line-height: 1.25; }
.sf-ei-msg { font-size: 14px; color: var(--color-muted); line-height: 1.6; margin: 10px 0 0; }

.sf-ei-codigo {
  display: inline-flex; flex-direction: column; align-items: center; gap: 3px;
  margin-top: 16px; padding: 10px 20px; border-radius: 10px;
  border: 1px dashed var(--color-primary); background: var(--color-primary-bg);
}
.sf-ei-codigo-label { font-size: 10px; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; color: var(--color-muted); }
.sf-ei-codigo-valor { font-family: "Geist Mono", monospace; font-size: 17px; font-weight: 700; color: var(--color-primary); letter-spacing: 0.04em; }

.sf-ei-cta {
  display: block; width: 100%; box-sizing: border-box; margin-top: 18px;
  min-height: 46px; padding: 13px 20px; border: none; border-radius: 11px;
  background: var(--color-primary); color: var(--color-on-primary);
  font-size: 15px; font-weight: 700; font-family: inherit;
  text-decoration: none; cursor: pointer;
  transition: filter 180ms ease;
}
.sf-ei-cta:hover { filter: brightness(1.07); }

.sf-ei-no {
  margin-top: 10px; background: none; border: none; padding: 8px;
  min-height: 44px; width: 100%;
  font-size: 12.5px; color: var(--color-subtle); font-family: inherit; cursor: pointer;
  text-decoration: underline; text-underline-offset: 3px;
}
.sf-ei-no:hover { color: var(--color-muted); }

@media (max-width: 480px) {
  .sf-ei-card { padding: 26px 18px 18px; border-radius: 16px; }
  .sf-ei-titulo { font-size: 19px; }
}
`
