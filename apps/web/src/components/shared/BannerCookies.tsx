// Aviso de cookies flotante, abajo: lo usan TODAS las tiendas (con los colores
// de la tienda) y las páginas públicas de orbita.site (con su estética oscura).
// Se monta una sola vez en pages/_app.tsx.
//
// Qué se pregunta y qué significa cada opción: lib/cookies/consentimiento.ts.
// En una tienda hay algo opcional (las estadísticas de visitas), así que ofrece
// "Aceptar", "Solo necesarias" y "Personalizar". En orbita.site no hay nada
// opcional que apagar (no usa cookies de estadísticas ni de publicidad), así que
// solo informa y pide "Aceptar".
//
// No es un muro: no bloquea la página ni le roba el foco a nadie; aparece un
// instante después de cargar y se puede ignorar. Con "reducir movimiento"
// activado en el sistema, entra y sale sin desplazamientos.
import { useCallback, useEffect, useRef, useState } from 'react'
import { ChevronDown, Cookie } from 'lucide-react'
import { esPreview } from '@/lib/storefront/previewBridge'
import { EVENTO_ABRIR, guardarConsentimiento, leerConsentimiento } from '@/lib/cookies/consentimiento'

type Props = {
  variante: 'tienda' | 'orbita'
  /** Página de la política de cookies de este sitio. */
  hrefPolitica: string
}

const DEMORA_MS = 900
const SALIDA_MS = 320

const reducido = () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

export function BannerCookies({ variante, hrefPolitica }: Props) {
  const [abierto, setAbierto] = useState(false)
  const [saliendo, setSaliendo] = useState(false)
  const [detalle, setDetalle] = useState(false)
  const [estadisticas, setEstadisticas] = useState(true)
  const primerBoton = useRef<HTMLButtonElement>(null)
  const conDetalle = variante === 'tienda'

  useEffect(() => {
    // Adentro de la vista previa del panel (Apariencia) no se pregunta nada.
    if (esPreview()) return
    const guardado = leerConsentimiento()
    if (guardado) { setEstadisticas(guardado.estadisticas); return }
    const t = window.setTimeout(() => setAbierto(true), reducido() ? 0 : DEMORA_MS)
    return () => window.clearTimeout(t)
  }, [])

  // "Preferencias de cookies" del pie: vuelve a mostrar el aviso, ya abierto en el detalle.
  useEffect(() => {
    const reabrir = () => {
      setEstadisticas(leerConsentimiento()?.estadisticas ?? true)
      setDetalle(conDetalle)
      setSaliendo(false)
      setAbierto(true)
      window.setTimeout(() => primerBoton.current?.focus(), 60)
    }
    window.addEventListener(EVENTO_ABRIR, reabrir)
    return () => window.removeEventListener(EVENTO_ABRIR, reabrir)
  }, [conDetalle])

  const cerrar = useCallback(() => {
    if (reducido()) { setAbierto(false); return }
    setSaliendo(true)
    // Respaldo por si la animación de salida no llega a correr (pestaña en segundo plano).
    window.setTimeout(() => { setAbierto(false); setSaliendo(false) }, SALIDA_MS + 80)
  }, [])

  const decidir = (conEstadisticas: boolean) => {
    guardarConsentimiento(conEstadisticas)
    cerrar()
  }

  if (!abierto) return null

  return (
    <div
      className={`ckb ckb--${variante}${saliendo ? ' ckb--sale' : ''}`}
      role="dialog"
      aria-label="Cookies y privacidad"
      aria-live="polite"
    >
      <style>{CSS}</style>
      <div className="ckb-cab">
        <span className="ckb-ico" aria-hidden="true"><Cookie size={17} strokeWidth={1.8} /></span>
        <div className="ckb-titulo">Cookies y privacidad</div>
      </div>

      <p className="ckb-texto">
        {conDetalle
          ? 'Usamos cookies necesarias para que la tienda funcione (tu sesión y tu carrito) y, si nos dejás, contamos las visitas de forma anónima para mejorarla.'
          : 'Usamos cookies necesarias para que el sitio funcione y recordar tus preferencias. No usamos cookies de publicidad ni te seguimos por otros sitios.'}
      </p>

      {conDetalle && (
        <div className={`ckb-detalle${detalle ? ' abierto' : ''}`} aria-hidden={!detalle}>
          <div>
            <div className="ckb-fila">
              <div className="ckb-fila-txt">
                <span className="ckb-fila-nombre">Necesarias</span>
                <span className="ckb-fila-det">Mantienen tu sesión, el carrito y tus preferencias. Siempre activas.</span>
              </div>
              <span className="ckb-sw ckb-sw--fijo" role="switch" aria-checked="true" aria-disabled="true" aria-label="Necesarias, siempre activas"><i /></span>
            </div>
            <div className="ckb-fila">
              <div className="ckb-fila-txt">
                <span className="ckb-fila-nombre">Estadísticas</span>
                <span className="ckb-fila-det">Cuentan las visitas a la tienda, sin datos personales.</span>
              </div>
              <button
                type="button"
                className="ckb-sw"
                role="switch"
                aria-checked={estadisticas}
                aria-label="Estadísticas"
                tabIndex={detalle ? 0 : -1}
                onClick={() => setEstadisticas(v => !v)}
              ><i /></button>
            </div>
          </div>
        </div>
      )}

      <div className="ckb-acciones">
        <button ref={primerBoton} type="button" className="ckb-btn ckb-btn--principal" onClick={() => decidir(conDetalle && detalle ? estadisticas : true)}>
          {conDetalle && detalle ? 'Guardar elección' : 'Aceptar'}
        </button>
        {conDetalle ? (
          <button type="button" className="ckb-btn ckb-btn--suave" onClick={() => decidir(detalle ? true : false)}>
            {detalle ? 'Aceptar todo' : 'Solo necesarias'}
          </button>
        ) : (
          <a className="ckb-btn ckb-btn--suave" href={hrefPolitica}>Ver política</a>
        )}
      </div>

      <div className="ckb-pie">
        {conDetalle && (
          <button type="button" className="ckb-link" onClick={() => setDetalle(d => !d)} aria-expanded={detalle}>
            Personalizar <ChevronDown size={13} strokeWidth={2.2} className={detalle ? 'girada' : ''} />
          </button>
        )}
        {conDetalle && <a className="ckb-link" href={hrefPolitica}>Política de cookies</a>}
      </div>
    </div>
  )
}

// Encima del contenido y del WhatsApp flotante (z-index 900 la pestaña de promos,
// 1000 los modales de juegos y anuncios): un aviso que se puede ignorar no
// puede quedar tapado por lo que aparece solo al entrar.
const CSS = `
.ckb{--ck-bg:var(--color-bg);--ck-borde:var(--color-border);--ck-texto:var(--color-text);--ck-suave:var(--color-muted);--ck-cta-bg:var(--color-primary);--ck-cta-fg:var(--color-on-primary,#fff);--ck-hover:var(--color-surface);--ck-sombra:0 24px 64px rgba(15,23,42,.20),0 4px 16px rgba(15,23,42,.08);
  position:fixed;left:24px;bottom:max(24px,env(safe-area-inset-bottom));z-index:1100;box-sizing:border-box;width:min(432px,calc(100vw - 32px));padding:20px 20px 16px;border-radius:20px;background:var(--ck-bg);border:1px solid var(--ck-borde);box-shadow:var(--ck-sombra);color:var(--ck-texto);font-family:inherit;animation:ckb-entra .6s cubic-bezier(.2,.9,.25,1) both;will-change:transform,opacity}
.ckb--orbita{--ck-bg:rgba(5,9,20,.88);--ck-borde:rgba(147,197,253,.20);--ck-texto:#fff;--ck-suave:rgba(203,213,225,.78);--ck-cta-bg:#fff;--ck-cta-fg:#0f172a;--ck-hover:rgba(255,255,255,.08);--ck-sombra:0 24px 64px rgba(0,0,0,.55),0 0 0 1px rgba(255,255,255,.03) inset;backdrop-filter:blur(18px) saturate(1.3);-webkit-backdrop-filter:blur(18px) saturate(1.3)}
.ckb--sale{animation:ckb-sale ${SALIDA_MS}ms cubic-bezier(.4,0,1,1) both}
@keyframes ckb-entra{from{opacity:0;transform:translateY(28px) scale(.97)}to{opacity:1;transform:none}}
@keyframes ckb-sale{from{opacity:1;transform:none}to{opacity:0;transform:translateY(20px) scale(.98)}}
.ckb-cab{display:flex;align-items:center;gap:11px}
.ckb-ico{width:34px;height:34px;flex-shrink:0;display:grid;place-items:center;border-radius:50%;border:1px solid var(--ck-borde);color:var(--ck-suave)}
.ckb-titulo{font-size:15.5px;font-weight:700;letter-spacing:-.01em}
.ckb-texto{margin:12px 0 0;font-size:13.5px;line-height:1.55;color:var(--ck-suave)}
.ckb-detalle{display:grid;grid-template-rows:0fr;opacity:0;transition:grid-template-rows .45s cubic-bezier(.2,.8,.2,1),opacity .3s ease,margin .45s cubic-bezier(.2,.8,.2,1)}
.ckb-detalle>div{overflow:hidden;min-height:0}
.ckb-detalle.abierto{grid-template-rows:1fr;opacity:1;margin-top:14px}
.ckb-fila{display:flex;align-items:center;gap:14px;padding:12px 0;border-top:1px solid var(--ck-borde)}
.ckb-fila-txt{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px}
.ckb-fila-nombre{font-size:13.5px;font-weight:600}
.ckb-fila-det{font-size:12.5px;line-height:1.45;color:var(--ck-suave)}
.ckb-sw{position:relative;flex-shrink:0;width:42px;height:24px;padding:0;border:none;border-radius:999px;background:var(--ck-borde);cursor:pointer;transition:background .25s ease}
.ckb-sw i{position:absolute;top:3px;left:3px;width:18px;height:18px;border-radius:50%;background:#fff;box-shadow:0 1px 3px rgba(0,0,0,.3);transition:transform .3s cubic-bezier(.3,1.4,.5,1)}
.ckb-sw[aria-checked="true"]{background:var(--color-primary,#3b82f6)}
.ckb--orbita .ckb-sw[aria-checked="true"]{background:#3b82f6}
.ckb-sw[aria-checked="true"] i{transform:translateX(18px)}
.ckb-sw--fijo{opacity:.55;cursor:default}
.ckb-sw:focus-visible{outline:2px solid var(--ck-texto);outline-offset:2px}
.ckb-acciones{display:flex;gap:10px;margin-top:16px}
.ckb-btn{flex:1;display:inline-flex;align-items:center;justify-content:center;min-height:44px;padding:0 14px;border-radius:12px;font-family:inherit;font-size:13.5px;font-weight:700;text-decoration:none;cursor:pointer;transition:background .2s ease,transform .15s ease,border-color .2s ease,opacity .2s ease}
.ckb-btn:active{transform:scale(.97)}
.ckb-btn:focus-visible{outline:2px solid var(--ck-texto);outline-offset:2px}
.ckb-btn--principal{border:1px solid transparent;background:var(--ck-cta-bg);color:var(--ck-cta-fg)}
.ckb-btn--principal:hover{opacity:.9}
.ckb-btn--suave{border:1px solid var(--ck-borde);background:transparent;color:var(--ck-texto)}
.ckb-btn--suave:hover{background:var(--ck-hover)}
.ckb-pie{display:flex;align-items:center;justify-content:center;gap:18px;margin-top:10px}
.ckb-pie:empty{display:none}
.ckb-link{display:inline-flex;align-items:center;gap:4px;padding:6px 2px;border:none;background:none;font-family:inherit;font-size:12.5px;font-weight:500;color:var(--ck-suave);text-decoration:none;cursor:pointer;transition:color .2s ease}
.ckb-link:hover{color:var(--ck-texto);text-decoration:underline;text-underline-offset:3px}
.ckb-link:focus-visible{outline:2px solid var(--ck-texto);outline-offset:2px;border-radius:4px}
.ckb-link svg{transition:transform .3s ease}
.ckb-link svg.girada{transform:rotate(180deg)}
@media (max-width:520px){
  .ckb{left:12px;right:12px;width:auto;bottom:max(12px,env(safe-area-inset-bottom));padding:18px 16px 12px;border-radius:18px}
  .ckb-detalle.abierto{max-height:none}
}
@media (prefers-reduced-motion:reduce){
  .ckb,.ckb--sale{animation:none}
  .ckb-detalle,.ckb-sw,.ckb-sw i,.ckb-btn,.ckb-link svg{transition:none}
}
`
