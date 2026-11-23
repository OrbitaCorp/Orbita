// La oferta relámpago en los formatos que no son la cartelera de siempre (esa
// sigue en CountdownOfertaSection.tsx). Es la misma pieza en la portada y en la
// vista previa del formulario de Descuentos.
//
// No lleva ningún dato propio: nombre, % y fecha salen del descuento real, y los
// precios de los productos ya vienen con el descuento aplicado. Por eso el reloj
// no puede mentir: cuando llega a cero, el descuento deja de aplicarse.

import { useEffect, type ReactNode } from 'react'
import { ProdImage } from '@/components/storefront/Thumb'
import { fmt } from '@/lib/storefront/utils'
import type { Producto } from '@/lib/storefront/types'
import { cargarFuenteTematica, resolverDiseno, varsDiseno, type FormatoOferta } from './catalogo'

export interface PropsOferta {
    formato: string
    diseno?: string | null
    titulo: string
    off: string | null
    restanteMs: number
    productos: Producto[]
    // Cómo se arma un link: en la vista previa no hay adónde ir.
    enlace?: (destino: string, contenido: ReactNode, clase?: string) => ReactNode
    hrefOferta?: string
    hrefProducto?: (id: string) => string
    // La vista previa mide un marco angosto, la tienda mide la ventana.
    compacto?: boolean
}

function partes(ms: number) {
    const s = Math.max(0, Math.floor(ms / 1000))
    return { d: Math.floor(s / 86400), h: Math.floor((s % 86400) / 3600), m: Math.floor((s % 3600) / 60), s: s % 60 }
}
const dd = (n: number) => String(n).padStart(2, '0')

// Los días solo si faltan: en las últimas horas un "00" le baja la urgencia.
function relojTexto(ms: number) {
    const t = partes(ms)
    return `${t.d > 0 ? `${t.d}d ` : ''}${dd(t.h)}:${dd(t.m)}:${dd(t.s)}`
}

export function OfertaDisenada({ formato, diseno, titulo, off, restanteMs, productos, enlace, hrefOferta, hrefProducto, compacto }: PropsOferta) {
    const d = resolverDiseno(diseno)
    useEffect(() => { cargarFuenteTematica(diseno) }, [diseno])
    const f = formato as FormatoOferta
    const reloj = relojTexto(restanteMs)
    const t = partes(restanteMs)

    const link = (destino: string | undefined, contenido: ReactNode, clase?: string) =>
        destino && enlace ? enlace(destino, contenido, clase) : <span className={clase}>{contenido}</span>
    const verOferta = link(hrefOferta, 'Ver la oferta', 'po-bt')
    const encabezado = off ? `${titulo}, ${off}` : titulo

    const tarjeta = (p: Producto, conReloj = false) => {
        const contenido = (
            <>
                <span className="po-foto">
                    <ProdImage hue={p.hue} imgUrl={p.imgUrl} height={0} radius={6} style={{ height: '100%' }} />
                    {conReloj && <span className="po-minireloj" aria-hidden="true">{reloj}</span>}
                </span>
                <span className="po-nombre">{p.nombre}</span>
                <span className="po-precios">
                    <b>{fmt(p.precio)}</b>
                    {p.precioAnt && p.precioAnt > p.precio && <s>{fmt(p.precioAnt)}</s>}
                </span>
            </>
        )
        return <li key={p.id}>{link(hrefProducto?.(p.id), contenido, 'po-prod')}</li>
    }

    let cuerpo: ReactNode = null
    if (f === 'reloj') {
        cuerpo = (
            <div className="po-c po-reloj">
                <span className="po-mu">{encabezado}</span>
                <span className="po-big" aria-hidden="true">{reloj}</span>
                {verOferta}
            </div>
        )
    } else if (f === 'tablero') {
        const casillas: [number, string][] = [...(t.d > 0 ? [[t.d, t.d === 1 ? 'día' : 'días'] as [number, string]] : []), [t.h, 'horas'], [t.m, 'min'], [t.s, 'seg']]
        cuerpo = (
            <div className="po-c po-tablero">
                <div className="po-ti">{titulo}</div>
                <div className="po-casillas" aria-hidden="true">
                    {casillas.map(([n, l]) => <span key={l} className="po-casilla"><b>{dd(n)}</b><small>{l}</small></span>)}
                </div>
                {off && <span className="po-mu">{off} hasta que llegue a cero</span>}
                {verOferta}
            </div>
        )
    } else if (f === 'vidriera') {
        const p = productos[0]
        cuerpo = (
            <div className="po-c po-vidriera">
                {p?.imgUrl && <img src={p.imgUrl} alt="" />}
                <div className="po-vid-cu">
                    <div>
                        <div className="po-ti">{p?.nombre ?? titulo}</div>
                        {off && <div className="po-big">{off}</div>}
                    </div>
                    <div className="po-vid-der">
                        <span className="po-mu">Termina en</span>
                        <span className="po-reloj-t" aria-hidden="true">{reloj}</span>
                        {verOferta}
                    </div>
                </div>
            </div>
        )
    } else if (f === 'tarjetas') {
        cuerpo = (
            <div className="po-tarjetas">
                <div className="po-ti">{encabezado}</div>
                <ul className="po-grilla">{productos.slice(0, 4).map(p => tarjeta(p, true))}</ul>
                {hrefOferta && link(hrefOferta, 'Ver toda la oferta', 'po-link')}
            </div>
        )
    } else if (f === 'tira') {
        cuerpo = (
            <div className="po-c po-tira">
                <b>{titulo}</b>
                {off && <span>{off}</span>}
                <span className="po-reloj-t" aria-hidden="true">{reloj}</span>
                {link(hrefOferta, 'Ver', 'po-link')}
            </div>
        )
    } else if (f === 'marquesina') {
        const frase = `${titulo}${off ? ` · ${off}` : ''} · termina en ${reloj}`
        const contenido = (
            <div className="po-c po-marq">
                <div className="po-marq-in" aria-hidden="true">
                    {Array.from({ length: 8 }, (_, i) => <span key={i}>{frase}</span>)}
                </div>
                <span className="po-sr">{titulo}{off ? `, ${off}` : ''}</span>
            </div>
        )
        cuerpo = hrefOferta && enlace ? enlace(hrefOferta, contenido, 'po-marq-link') : contenido
    } else {
        // Cartelera (solo en la vista previa: en la tienda la dibuja
        // CountdownOfertaSection con sus productos reales).
        cuerpo = (
            <div className="po-cartelera">
                <div className="po-c po-cartel">
                    <span className="po-mu">Oferta relámpago</span>
                    <div className="po-ti">{titulo}</div>
                    {off && <div className="po-big">{off}</div>}
                    <span className="po-mu">Termina en</span>
                    <span className="po-reloj-t" aria-hidden="true">{reloj}</span>
                    {verOferta}
                </div>
                <ul className="po-grilla po-grilla--tres">{productos.slice(0, 3).map(p => tarjeta(p))}</ul>
            </div>
        )
    }

    return (
        <div className={`po${compacto ? ' po--compacto' : ''}`} style={varsDiseno(d)}>
            <style>{ESTILOS}</style>
            {cuerpo}
        </div>
    )
}

const ESTILOS = `
.po { container-type: inline-size; width: 100%; color: var(--color-text); }
.po-c { background: var(--pr-c); color: var(--pr-x); border-radius: var(--pr-r); }
.po-ti { font: 700 22px/1.15 var(--pr-f); overflow-wrap: anywhere; }
.po-mu { font-size: 13.5px; color: var(--pr-m); }
.po-big { font: 700 clamp(30px, 7cqw, 52px)/1.05 var(--pr-f); font-variant-numeric: tabular-nums; }
.po-reloj-t { font-size: 18px; font-weight: 700; font-variant-numeric: tabular-nums; }
.po-bt { display: inline-flex; align-items: center; justify-content: center; min-height: 44px; padding: 0 18px; background: var(--pr-b); color: var(--pr-o); border-radius: min(var(--pr-r), 10px); font-weight: 600; font-size: 14px; text-decoration: none; }
.po-link { color: inherit; font-weight: 600; font-size: 13.5px; text-decoration: underline; text-underline-offset: 3px; }
.po-sr { position: absolute; width: 1px; height: 1px; margin: -1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }

.po-reloj { display: flex; flex-direction: column; align-items: center; gap: 10px; padding: 26px 20px; text-align: center; }

.po-tablero { display: flex; flex-direction: column; align-items: center; gap: 12px; padding: 24px 16px; text-align: center; }
.po-casillas { display: flex; gap: 7px; justify-content: center; }
.po-casilla { display: flex; flex-direction: column; align-items: center; gap: 4px; font-size: 11.5px; color: var(--pr-m); }
.po-casilla b { position: relative; display: grid; place-items: center; width: clamp(50px, 13cqw, 74px); height: clamp(58px, 15cqw, 84px); background: var(--pr-b); color: var(--pr-o); border-radius: 6px; font: 700 clamp(28px, 7.5cqw, 42px)/1 var(--pr-f); font-variant-numeric: tabular-nums; }
.po-casilla b::after { content: ""; position: absolute; left: 0; right: 0; top: 50%; height: 1px; background: rgba(0,0,0,.35); }

.po-vidriera { position: relative; min-height: 320px; display: flex; align-items: flex-end; overflow: hidden; }
.po-vidriera > img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
.po-vidriera:has(> img) { color: #fff; background: #1a1a1a; }
.po-vidriera:has(> img)::after { content: ""; position: absolute; inset: 0; background: rgba(0,0,0,.42); }
.po-vidriera:has(> img) .po-mu { color: rgba(255,255,255,.9); }
.po-vid-cu { position: relative; z-index: 1; width: 100%; display: flex; justify-content: space-between; align-items: flex-end; gap: 14px; flex-wrap: wrap; padding: 20px; }
.po-vid-der { display: flex; flex-direction: column; align-items: flex-end; gap: 6px; }

.po-tarjetas { display: flex; flex-direction: column; gap: 12px; }
.po-grilla { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; }
.po-grilla--tres { grid-template-columns: repeat(3, minmax(0, 1fr)); padding: 14px; }
.po-grilla li { min-width: 0; }
.po-prod { display: flex; flex-direction: column; gap: 5px; color: var(--color-text); text-decoration: none; min-width: 0; }
.po-foto { position: relative; display: block; aspect-ratio: 1; width: 100%; }
.po-minireloj { position: absolute; left: 5px; right: 5px; bottom: 5px; text-align: center; background: var(--pr-c); color: var(--pr-x); border-radius: 4px; padding: 3px 0; font-size: 12.5px; font-weight: 700; font-variant-numeric: tabular-nums; }
.po-nombre { font-size: 13.5px; line-height: 1.3; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.po-precios { display: flex; flex-wrap: wrap; gap: 2px 6px; align-items: baseline; font-size: 14.5px; font-variant-numeric: tabular-nums; }
.po-precios s { font-size: 12.5px; color: var(--color-muted); }

.po-tira { display: flex; justify-content: center; align-items: center; flex-wrap: wrap; gap: 4px 14px; min-height: 46px; padding: 6px 14px; font-size: 14px; text-align: center; }
.po-tira .po-reloj-t { font-size: 15px; }

.po-marq-link { display: block; text-decoration: none; }
.po-marq { position: relative; overflow: hidden; white-space: nowrap; height: 44px; display: flex; align-items: center; font-size: 14px; font-weight: 600; }
.po-marq-in { display: inline-flex; flex-shrink: 0; animation: poMarq 26s linear infinite; }
.po-marq-in span { padding: 0 22px; font-variant-numeric: tabular-nums; }
@keyframes poMarq { to { transform: translateX(-50%); } }

.po-cartelera { display: grid; grid-template-columns: 210px minmax(0, 1fr); border: 1px solid var(--color-border); border-radius: var(--pr-r); overflow: hidden; }
.po-cartel { display: flex; flex-direction: column; align-items: flex-start; gap: 7px; padding: 18px; border-radius: 0; }

@container (max-width: 560px) {
  .po-grilla { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .po-grilla--tres { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .po-grilla--tres li:nth-child(n+3) { display: none; }
  .po-cartelera { grid-template-columns: 1fr; }
  .po-vidriera { min-height: 280px; }
  .po-vid-der { align-items: flex-start; }
}
@media (prefers-reduced-motion: reduce) {
  .po-marq-in { animation: none; }
}
`
