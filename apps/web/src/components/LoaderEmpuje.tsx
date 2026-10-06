// ─── LoaderEmpuje ────────────────────────────────────────────────────────────
// Loader de la landing (orbita.site, ruta '/'), diseño "Empuje": el anillo de
// la órbita se dibuja, el planeta y el satélite aparecen con un resorte y la
// palabra "Órbita" entra empujada desde el logo. El resto de la app sigue con
// PageLoader.
//
// La intro tarda ~2,2 s en mostrar el logo completo, así que se juega UNA vez
// por sesión (la primera carga de la landing). En una recarga, o con
// `prefers-reduced-motion`, el logo aparece ya armado y el loader se va en el
// tiempo mínimo de siempre. Para que ese caso no muestre un salto (logo
// animándose y de golpe completo), el script de tema que corre antes de
// hidratar (TEMA_SCRIPT, lib/csp.ts) marca <html data-intro-vista> y el CSS de
// abajo apaga las animaciones desde el primer pintado.

/** Hasta cuándo se muestra el loader la primera vez: la palabra termina de entrar a los 2,18 s. */
export const INTRO_LANDING_MS = 2500

/** Clave de sessionStorage. OJO: el mismo literal está en TEMA_SCRIPT (lib/csp.ts). */
const CLAVE_INTRO = 'orbita-intro-landing'

/**
 * Cuánto tiene que quedar el loader en la carga inicial de la landing: la intro
 * completa la primera vez de la sesión, el mínimo de siempre si ya se vio o si
 * la persona pidió menos movimiento. Marca la intro como vista.
 */
export function duracionLoaderLanding(minimo: number): number {
  try {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return minimo
    if (window.sessionStorage.getItem(CLAVE_INTRO)) return minimo
    window.sessionStorage.setItem(CLAVE_INTRO, '1')
    return INTRO_LANDING_MS
  } catch {
    // Sin sessionStorage el script de tema tampoco pudo marcar nada: la intro
    // se está animando, así que se la deja terminar.
    return INTRO_LANDING_MS
  }
}

// Tiempos del diseño (ciclo de 3,4 s) pasados a duración + demora de una sola
// pasada: anillo 0–28 %, planeta 6–22 %, satélite 20–32 %, palabra 32–64 %.
const CSS = `
.emp-ol{position:fixed;inset:0;z-index:9999;display:grid;place-items:center;overflow:hidden;background:radial-gradient(60% 60% at 50% 50%,#0b1122 0%,#05070d 100%);transition:opacity .4s ease}
.emp-row{display:flex;align-items:center}
.emp-lg{width:68px;height:68px;flex-shrink:0;overflow:visible;filter:drop-shadow(0 0 12px rgba(59,123,240,.45))}
.emp-ol svg *{transform-box:fill-box;transform-origin:center}
.emp-wmw{overflow:hidden;max-width:260px;animation:emp-push .952s cubic-bezier(.65,0,.35,1) 1.088s both}
.emp-wm{display:block;padding-left:20px;font:700 56px/1.15 'Geist',system-ui,-apple-system,"Segoe UI",sans-serif;letter-spacing:-.025em;color:#f5f8ff;white-space:nowrap;animation:emp-par 1.088s cubic-bezier(.16,1,.3,1) 1.088s both}
.emp-ring{animation:emp-draw .952s cubic-bezier(.65,0,.35,1) both}
.emp-core{animation:emp-pop .544s cubic-bezier(.34,1.56,.64,1) .204s both}
.emp-sat{animation:emp-pop .408s cubic-bezier(.34,1.56,.64,1) .68s both}
@keyframes emp-draw{from{stroke-dashoffset:73.85}to{stroke-dashoffset:0}}
@keyframes emp-pop{from{transform:scale(0)}to{transform:scale(1)}}
@keyframes emp-push{from{max-width:0}to{max-width:260px}}
@keyframes emp-par{from{transform:translateX(-40px);opacity:0}to{transform:none;opacity:1}}
@media (max-width:420px){.emp-lg{width:52px;height:52px}.emp-wm{font-size:42px;padding-left:14px}}
html[data-intro-vista] .emp-ol *{animation:none!important}
@media (prefers-reduced-motion:reduce){.emp-ol *{animation:none!important}}
`

export function LoaderEmpuje({ visible }: { visible: boolean }) {
  return (
    <div
      className="emp-ol"
      role="status"
      aria-label="Cargando"
      aria-hidden={!visible}
      style={{ opacity: visible ? 1 : 0, pointerEvents: visible ? 'auto' : 'none' }}
    >
      <style>{CSS}</style>
      <div className="emp-row">
        <svg className="emp-lg" viewBox="-15 -15 30 30" aria-hidden="true">
          <defs>
            <linearGradient id="emp-gR" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stopColor="#2a68ee" /><stop offset=".55" stopColor="#4f8ff7" /><stop offset="1" stopColor="#9ccbff" /></linearGradient>
            <linearGradient id="emp-gC" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stopColor="#3576ee" /><stop offset=".6" stopColor="#5698fa" /><stop offset="1" stopColor="#86c0ff" /></linearGradient>
            <linearGradient id="emp-gS" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stopColor="#5f9bf5" /><stop offset="1" stopColor="#a8d4ff" /></linearGradient>
          </defs>
          <circle className="emp-ring" r="12.9" fill="none" stroke="url(#emp-gR)" strokeWidth=".8" strokeLinecap="round" strokeDasharray="73.85 81.05" transform="rotate(326)" />
          <circle className="emp-core" r="5.6" fill="url(#emp-gC)" />
          <circle className="emp-sat" cx="8.01" cy="-9.55" r="2.5" fill="url(#emp-gS)" />
        </svg>
        <div className="emp-wmw"><span className="emp-wm">Órbita</span></div>
      </div>
    </div>
  )
}
