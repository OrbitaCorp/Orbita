// El anuncio de la tienda en sus nueve formatos. Es la misma pieza en la tienda
// (fija sobre la página) y en la vista previa del panel (`enMarco`), y mide su
// contenedor y no la ventana: "celular" en la vista previa tiene que verse como
// un celular de verdad.
//
// Los formatos que no tapan la página (barra, esquina, cinta, pestaña) no llevan
// velo y dejan pasar los clics a la tienda: el cliente puede seguir comprando
// sin cerrarlos.

import { useEffect, useState } from 'react'
import { Check, Copy, X } from 'lucide-react'
import { cargarFuenteTematica, resolverDiseno, varsDiseno, type DisenoResuelto, type FormatoAnuncio } from './catalogo'

export interface DatosAnuncio {
    title: string
    message?: string | null
    badge?: string | null
    code?: string | null
    ctaText?: string | null
    imageUrl?: string | null
}

interface Props {
    anuncio: DatosAnuncio
    formato: string
    diseno?: string | null
    enMarco?: boolean
    onCerrar: () => void
    onCta?: () => void
}

const CON_VELO: FormatoAnuncio[] = ['centro', 'partido', 'hoja', 'cupon']

function Deco({ d }: { d: DisenoResuelto }) {
    if (!d.tematica) return null
    const t = d.tematica
    return (
        <svg className="pa-deco" viewBox="0 0 400 110" preserveAspectRatio="xMidYMid slice" aria-hidden="true"
            dangerouslySetInnerHTML={{ __html: `<rect width="400" height="110" fill="${t.p.cielo}"/>${t.decor(t.p).replace(/filter="[^"]*"/g, '')}` }} />
    )
}

export function AnuncioPromo({ anuncio, formato, diseno, enMarco, onCerrar, onCta }: Props) {
    const d = resolverDiseno(diseno)
    const [copiado, setCopiado] = useState(false)
    const [abierta, setAbierta] = useState(false)
    useEffect(() => { cargarFuenteTematica(diseno) }, [diseno])

    const f = formato as FormatoAnuncio
    const { title, message, badge, code, ctaText, imageUrl } = anuncio
    const copiar = () => {
        if (!code) return
        navigator.clipboard?.writeText(code).catch(() => {})
        setCopiado(true)
        setTimeout(() => setCopiado(false), 2000)
    }

    const cerrar = <button type="button" className="pa-x" onClick={onCerrar} aria-label="Cerrar anuncio"><X size={16} strokeWidth={2} /></button>
    const titulo = <div className="pa-ti">{title}</div>
    const texto = message ? <div className="pa-tx">{message}</div> : null
    const etiqueta = badge ? <div className="pa-eti">{badge}</div> : null
    const foto = imageUrl ? <img src={imageUrl} alt="" /> : null
    const cupon = code ? (
        <button type="button" className="pa-cod" onClick={copiar} aria-label={`Copiar el código ${code}`}>
            <span>{code}</span>{copiado ? <Check size={14} /> : <Copy size={14} />}
        </button>
    ) : null
    const boton = <button type="button" className="pa-bt" onClick={onCta}>{ctaText?.trim() || 'Ver catálogo'}</button>

    let cuerpo
    switch (f) {
        case 'barra':
            // Toda la barra lleva a la promo; la X va aparte para no dispararla.
            cuerpo = (
                <div className="pa-c pa-barra">
                    <button type="button" className="pa-barra-link" onClick={onCta} aria-label={ctaText?.trim() || 'Ver la promo'}>
                        {foto}
                        <span className="pa-barra-t">{titulo}{texto}</span>
                    </button>
                    {cerrar}
                </div>
            )
            break
        case 'partido':
            cuerpo = (
                <div className="pa-c pa-partido" role="dialog" aria-modal="true" aria-label={title}>
                    {foto ?? <Deco d={d} />}
                    <div className="pa-cu">{etiqueta}{titulo}{texto}{cupon}{boton}</div>
                    {cerrar}
                </div>
            )
            break
        case 'esquina':
            cuerpo = (
                <div className="pa-c pa-esquina">
                    {foto ?? <Deco d={d} />}
                    <div className="pa-cu">{titulo}{texto}{cupon}{boton}</div>
                    {cerrar}
                </div>
            )
            break
        case 'cinta':
            cuerpo = (
                <div className="pa-c pa-cinta">
                    <span className="pa-ti">{title}</span>
                    {code && <span className="pa-cinta-cod">{code}</span>}
                    <button type="button" className="pa-cinta-link" onClick={onCta}>{ctaText?.trim() || 'Ver catálogo'}</button>
                    {cerrar}
                </div>
            )
            break
        case 'hoja':
            cuerpo = (
                <div className="pa-c pa-hoja" role="dialog" aria-modal="true" aria-label={title}>
                    {foto}
                    <div className="pa-cu">{etiqueta}{titulo}{texto}{cupon}{boton}</div>
                    {cerrar}
                </div>
            )
            break
        case 'cupon':
            cuerpo = (
                <div className="pa-c pa-cupon" role="dialog" aria-modal="true" aria-label={title}>
                    <div className="pa-cu">{titulo}{texto}{cupon}{boton}</div>
                    <div className="pa-talon">{badge || 'Promo'}</div>
                    {cerrar}
                </div>
            )
            break
        case 'pantalla':
            cuerpo = (
                <div className={`pa-c pa-pantalla${imageUrl ? ' pa-pantalla--foto' : ''}`} role="dialog" aria-modal="true" aria-label={title}>
                    {foto ?? <Deco d={d} />}
                    <div className="pa-cu">{etiqueta}{titulo}{texto}{cupon}{boton}</div>
                    {cerrar}
                </div>
            )
            break
        case 'pestana':
            cuerpo = abierta ? (
                <div className="pa-c pa-esquina pa-esquina--der">
                    {foto ?? <Deco d={d} />}
                    <div className="pa-cu">{titulo}{texto}{cupon}{boton}</div>
                    <button type="button" className="pa-x" onClick={() => setAbierta(false)} aria-label="Minimizar anuncio"><X size={16} strokeWidth={2} /></button>
                </div>
            ) : (
                <button type="button" className="pa-c pa-pest" onClick={() => setAbierta(true)}>{badge || title}</button>
            )
            break
        default:
            cuerpo = (
                <div className="pa-c pa-centro" role="dialog" aria-modal="true" aria-label={title}>
                    {foto ?? <Deco d={d} />}
                    <div className="pa-cu">{etiqueta}{titulo}{texto}{cupon}{boton}</div>
                    {cerrar}
                </div>
            )
    }

    return (
        <div className={`pa${enMarco ? ' pa--marco' : ''}`} style={varsDiseno(d)}>
            <style>{ESTILOS}</style>
            {CON_VELO.includes(f) && <div className="pa-velo" />}
            {cuerpo}
        </div>
    )
}

const ESTILOS = `
.pa { position: fixed; inset: 0; z-index: 1000; pointer-events: none; container-type: size; font-family: inherit; }
.pa--marco { position: absolute; z-index: 6; }
.pa-velo { position: absolute; inset: 0; background: rgba(12,14,20,.48); pointer-events: auto; }
.pa-c { position: absolute; box-sizing: border-box; pointer-events: auto; background: var(--pr-c); color: var(--pr-x); animation: paEntra .24s ease-out both; }
@keyframes paEntra { from { opacity: 0; translate: 0 8px; } to { opacity: 1; translate: 0 0; } }
.pa-ti { font: 700 19px/1.15 var(--pr-f); overflow-wrap: anywhere; }
.pa-tx { font-size: 13.5px; line-height: 1.4; color: var(--pr-m); overflow-wrap: anywhere; }
.pa-eti { font-size: 13px; font-weight: 700; }
.pa-cu { display: flex; flex-direction: column; gap: 8px; min-width: 0; }
.pa-x { position: absolute; top: 4px; right: 4px; width: 40px; height: 40px; display: grid; place-items: center; background: none; border: 0; color: inherit; opacity: .85; cursor: pointer; }
.pa-x:hover { opacity: 1; }
.pa-bt { display: inline-flex; align-items: center; justify-content: center; align-self: flex-start; min-height: 44px; padding: 0 18px; border: 0; cursor: pointer; background: var(--pr-b); color: var(--pr-o); border-radius: min(var(--pr-r), 10px); font-weight: 600; font-size: 14px; font-family: inherit; transition: filter .15s; }
.pa-bt:hover { filter: brightness(1.08); }
.pa-cod { display: inline-flex; align-items: center; gap: 8px; align-self: flex-start; min-height: 38px; padding: 0 12px; background: none; color: inherit; cursor: pointer; border: 1.5px dashed var(--pr-m); border-radius: 6px; font: 600 14px "Geist Mono", ui-monospace, monospace; letter-spacing: .03em; }
.pa button:focus-visible { outline: 2px solid currentColor; outline-offset: 2px; }
.pa img { display: block; object-fit: cover; }
.pa-deco { display: block; width: 100%; height: 96px; }

.pa-barra { left: 50%; bottom: 20px; transform: translateX(-50%); width: min(calc(100% - 24px), 620px); display: flex; align-items: center; border-radius: calc(var(--pr-r) + 2px); box-shadow: 0 10px 28px -8px rgba(0,0,0,.5); }
.pa-barra-link { display: flex; align-items: center; gap: 13px; flex: 1; min-width: 0; padding: 9px 46px 9px 10px; background: none; border: 0; color: inherit; font-family: inherit; text-align: left; cursor: pointer; }
.pa-barra-link:not(:has(img)) { padding-left: 18px; }
.pa-barra img { width: 56px; height: 56px; border-radius: 10px; flex-shrink: 0; }
.pa-barra-t { display: flex; flex-direction: column; gap: 1px; min-width: 0; }
.pa-barra .pa-ti { font-size: 17px; }
.pa-barra .pa-x { top: 50%; transform: translateY(-50%); }

.pa-centro { left: 50%; top: 50%; transform: translate(-50%,-50%); width: min(calc(100% - 32px), 400px); max-height: calc(100% - 32px); overflow: auto; border-radius: var(--pr-r); text-align: center; box-shadow: 0 18px 50px -12px rgba(0,0,0,.5); }
.pa-centro img { width: 100%; height: 170px; }
.pa-centro .pa-cu { padding: 22px 20px; align-items: center; }
.pa-centro .pa-bt, .pa-centro .pa-cod { align-self: center; }

.pa-partido { left: 50%; top: 50%; transform: translate(-50%,-50%); width: min(calc(100% - 28px), 620px); max-height: calc(100% - 28px); overflow: auto; display: grid; grid-template-columns: 44% 1fr; border-radius: var(--pr-r); box-shadow: 0 18px 50px -12px rgba(0,0,0,.5); }
.pa-partido > img, .pa-partido > .pa-deco { width: 100%; height: 100%; min-height: 300px; }
.pa-partido .pa-cu { padding: 34px 20px 20px; justify-content: center; }
.pa-partido:not(:has(> img)):not(:has(> .pa-deco)) { grid-template-columns: 1fr; }

.pa-esquina { left: 16px; bottom: 16px; width: min(calc(100% - 32px), 290px); max-height: calc(100% - 32px); overflow: auto; border-radius: var(--pr-r); box-shadow: 0 12px 34px -8px rgba(0,0,0,.45); }
.pa-esquina--der { left: auto; right: 16px; bottom: auto; top: 50%; transform: translateY(-50%); }
.pa-esquina img { width: 100%; height: 130px; }
.pa-esquina .pa-cu { padding: 14px 16px 16px; }
.pa-esquina:has(> img) .pa-x, .pa-esquina:has(> .pa-deco) .pa-x { background: rgba(255,255,255,.9); color: #111; border-radius: 50%; width: 36px; height: 36px; opacity: 1; }

.pa-cinta { left: 0; right: 0; top: 0; display: flex; align-items: center; justify-content: center; gap: 14px; min-height: 46px; padding: 5px 46px; text-align: center; box-shadow: 0 4px 14px -6px rgba(0,0,0,.4); }
.pa-cinta .pa-ti { font-size: 14.5px; }
.pa-cinta .pa-x { top: 50%; transform: translateY(-50%); right: 3px; }
.pa-cinta-cod { font: 600 13px "Geist Mono", ui-monospace, monospace; }
.pa-cinta-link { background: none; border: 0; color: inherit; font: inherit; font-size: 13.5px; font-weight: 600; text-decoration: underline; text-underline-offset: 3px; white-space: nowrap; cursor: pointer; min-height: 36px; }

.pa-hoja { left: 0; right: 0; bottom: 0; max-height: 88%; overflow: auto; display: flex; align-items: center; justify-content: center; gap: 20px; padding: 22px 52px 22px 20px; border-radius: var(--pr-r) var(--pr-r) 0 0; box-shadow: 0 -10px 30px -10px rgba(0,0,0,.35); }
.pa-hoja img { width: 116px; height: 116px; border-radius: 8px; flex-shrink: 0; }

.pa-cupon { left: 50%; top: 50%; transform: translate(-50%,-50%); width: min(calc(100% - 32px), 470px); display: grid; grid-template-columns: 1fr 124px; border-radius: 10px; filter: drop-shadow(0 12px 22px rgba(0,0,0,.4)); }
.pa-cupon .pa-cu { padding: 26px 16px 20px 20px; }
.pa-talon { position: relative; border-left: 2px dashed var(--pr-m); display: flex; align-items: center; justify-content: center; padding: 34px 8px 12px; text-align: center; font: 700 26px/1.05 var(--pr-f); overflow-wrap: anywhere; }
.pa-talon::before, .pa-talon::after { content: ""; position: absolute; left: -10px; width: 18px; height: 18px; border-radius: 50%; background: #55575d; }
.pa-talon::before { top: -9px; } .pa-talon::after { bottom: -9px; }

.pa-pantalla { inset: 0; display: flex; align-items: flex-end; overflow: hidden; }
.pa-pantalla > img { position: absolute; inset: 0; width: 100%; height: 100%; }
.pa-pantalla > .pa-deco { position: absolute; left: 0; right: 0; top: 0; height: 45%; }
.pa-pantalla--foto { color: #fff; background: #111; }
.pa-pantalla--foto::after { content: ""; position: absolute; inset: 0; background: rgba(0,0,0,.42); }
.pa-pantalla--foto .pa-tx { color: rgba(255,255,255,.92); }
.pa-pantalla .pa-cu { position: relative; z-index: 1; padding: 30px; gap: 10px; max-width: 540px; }
.pa-pantalla .pa-ti { font-size: clamp(30px, 6cqw, 48px); line-height: 1.05; }
.pa-pantalla .pa-tx { font-size: 15px; }
.pa-pantalla .pa-x { z-index: 2; }

.pa-pest { right: 0; top: 50%; translate: 0 -50%; animation: none; writing-mode: vertical-rl; transform: rotate(180deg); max-height: 70%; overflow: hidden; padding: 16px 11px; min-width: 44px; border: 0; cursor: pointer; border-radius: 0 8px 8px 0; font-weight: 700; font-size: 14px; font-family: var(--pr-f); box-shadow: 0 6px 18px -6px rgba(0,0,0,.5); }

@container (max-width: 560px) {
  /* Arriba del botón de WhatsApp, que en celular vive abajo a la derecha. */
  .pa-barra { bottom: 84px; }
  .pa-partido { grid-template-columns: 1fr; }
  .pa-partido > img, .pa-partido > .pa-deco { min-height: 0; height: 160px; }
  .pa-partido .pa-cu { padding: 18px; }
  .pa-cinta { flex-wrap: wrap; gap: 2px 10px; }
  .pa-hoja { flex-direction: column; align-items: stretch; padding: 20px; }
  .pa-hoja img { width: 100%; height: 150px; }
  .pa-hoja:has(> img) .pa-x { background: rgba(255,255,255,.9); color: #111; border-radius: 50%; top: 26px; right: 26px; width: 36px; height: 36px; opacity: 1; }
  .pa-cupon { grid-template-columns: 1fr 90px; }
  .pa-talon { font-size: 19px; }
  .pa-pantalla .pa-cu { padding: 22px; }
}
@media (prefers-reduced-motion: reduce) { .pa-c { animation: none; } .pa-bt { transition: none; } }
`
