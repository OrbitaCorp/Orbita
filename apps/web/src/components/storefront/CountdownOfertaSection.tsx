// Sección de la PORTADA: la oferta relámpago. Un solo bloque con dos lados,
// como la "oferta del día" de los marketplaces: a la izquierda el cartel (qué
// promo es, cuánto descuenta y el reloj corriendo) y a la derecha, a la MISMA
// altura, los productos en oferta con el precio tachado y el nuevo.
//
// Antes el cartel iba a lo ancho y la grilla debajo: en una pantalla normal
// los productos quedaban fuera de la primera vista y el cliente veía "10% OFF"
// sin saber de qué. Ale (19/09): "que desde la primera vista vea el usuario
// qué producto tiene descuento y no tener que hacer click para ver".
//
// Es la cara visible del countdown CON DESCUENTO (paquete Avanzado): el dueño
// elige el %, a qué productos aplica y hasta cuándo. Nada de acá es texto suelto:
//
//   - la fecha es la del `Discount` real, así que cuando el reloj llega a cero
//     el descuento efectivamente deja de aplicarse;
//   - los productos salen de `?discountId=`, o sea del alcance guardado del
//     descuento — no de una lista paralela que se pueda desincronizar.
//
// Si el countdown no tiene descuento, o el dueño apagó la sección, o ya venció,
// esto no dibuja nada y la portada queda como si el componente no existiera.
// El banner del countdown (CountdownBanner.tsx) es independiente: se pueden
// tener los dos, uno, o ninguno.

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { storefrontBase } from '@/lib/tenant'
import { ProdImage } from './Thumb'
import { pedirCountdown } from './countdownCache'
import { getStorefrontProducts, toProducto, type StorefrontActiveCountdown } from '@/lib/storefront/api'
import type { Producto } from '@/lib/storefront/types'
import { fmt } from '@/lib/storefront/utils'
import { Skeleton } from '@/design-system/components/Skeleton'
import { useAhora } from '@/hooks/useAhora'

type Props = {
  slug: string
  // Los mismos toggles de Apariencia que usa el resto de la portada (se
  // aplican al mapear los productos).
  badges?: { showNew?: boolean; showOffer?: boolean; showLowStock?: boolean }
}

// Cuántos productos entran. Cuatro se ven de una en escritorio; del quinto en
// adelante la fila se desliza, y el quinto asoma cortado para que se note.
// Más que ocho deja de ser "la promo" y compite con el catálogo — el botón
// del cartel lleva a la página de la oferta con todos.
const MAX_PRODUCTOS = 8

function etiquetaDescuento(c: StorefrontActiveCountdown): string | null {
  if (c.descuentoValor == null) return null
  return c.descuentoTipo === 'PERCENT'
    ? `${Math.round(c.descuentoValor)}% OFF`
    : `$${c.descuentoValor.toLocaleString('es-AR')} OFF`
}

// El % de cada producto sale de SUS precios, no del descuento: con un monto
// fijo ("$5.000 OFF") el % cambia de un producto a otro, y si el producto ya
// tenía precio de lista tachado el número real es el total.
function pctProducto(p: Producto): number | null {
  if (!p.precioAnt || p.precioAnt <= p.precio) return null
  const pct = Math.round((1 - p.precio / p.precioAnt) * 100)
  return pct > 0 ? pct : null
}

function fechaLarga(iso: string): string {
  return new Date(iso).toLocaleDateString('es-AR', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })
}

export function CountdownOfertaSection({ slug, badges }: Props) {
  const [cfg, setCfg] = useState<StorefrontActiveCountdown | null>(null)
  const [productos, setProductos] = useState<Producto[] | null>(null)

  // Comparte el fetch con el banner y con la tira del header — en la portada
  // los tres consumidores piden lo mismo. Ver countdownCache.ts.
  useEffect(() => {
    let cancelado = false
    pedirCountdown(slug).then(c => { if (!cancelado) setCfg(c) })
    return () => { cancelado = true }
  }, [slug])

  // Los productos se piden recién cuando se sabe que hay una sección que
  // dibujar: la enorme mayoría de las tiendas no tiene esto prendido y no
  // tienen por qué pagar un GET extra en cada carga de la portada.
  const discountId = cfg?.showProductsOnHome ? cfg.discountId : null
  useEffect(() => {
    if (!discountId) return
    let cancelado = false
    getStorefrontProducts(slug, { discountId, limit: MAX_PRODUCTOS })
      // El 404 de un descuento que venció entre el GET del countdown y este
      // (ver resolverDescuentoVigentePorId en el backend) no es una falla que
      // valga la pena mostrar: la sección simplemente no aparece.
      .then(r => { if (!cancelado) setProductos(r.data.map(p => toProducto(p, badges ?? {}))) })
      .catch(() => { if (!cancelado) setProductos([]) })
    return () => { cancelado = true }
    // `badges` es un objeto nuevo en cada render del padre: se omite a
    // propósito para no re-pedir los productos en cada render. Los toggles de
    // Apariencia no cambian mientras la página está abierta.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug, discountId])

  const fin = cfg ? new Date(cfg.endDate).getTime() : null
  const ahora = useAhora(!!discountId, 1000, fin ?? undefined)
  const restante = fin !== null && ahora !== null ? fin - ahora : null

  // Nada que mostrar: sin descuento gestionado, con la sección apagada, o ya
  // vencida. A diferencia del banner, acá no hay "mensaje de cierre" que
  // valga: productos cuya promo terminó mostrarían precios que ya no son los
  // que se cobran.
  if (!cfg || !discountId || restante === null || restante <= 0) return null
  // Ningún producto quedó en pie (todos sin stock, despublicados, borrados):
  // la sección sin productos sería un cartel repetido del banner.
  if (productos !== null && productos.length === 0) return null

  const off = etiquetaDescuento(cfg)
  const base = storefrontBase(slug)
  // Con uno o dos productos las tarjetas van horizontales (foto al costado):
  // en columnas de a cuatro quedaban chiquitas y con el resto del bloque vacío.
  const n = productos?.length ?? 4
  const disposicion = n === 1 ? 'uno' : n === 2 ? 'dos' : n > 4 ? 'fila' : 'grilla'

  return (
    <section className="sf-w sf-of" aria-labelledby="sf-of-titulo">
      <style>{ESTILOS}</style>

      <div className="sf-of-caja">
        {/* ── El cartel ─────────────────────────────────────────────────────
            Color de marca liso (sin degradé) y el descuento como dato más
            grande: es lo primero que tiene que leerse. El reloj va aria-hidden
            y hay un texto para lector de pantalla con la fecha de fin:
            anunciar los segundos uno por uno taparía el resto de la página. */}
        <div className="sf-of-cartel">
          <p className="sf-of-kicker">Oferta relámpago</p>
          <h2 id="sf-of-titulo" className="sf-of-titulo">{cfg.title}</h2>
          {off && <p className="sf-of-off">{off}</p>}
          {cfg.subtitle && <p className="sf-of-sub">{cfg.subtitle}</p>}
          <p className="sf-of-sr">Termina el {fechaLarga(cfg.endDate)}.</p>

          <div className="sf-of-reloj" aria-hidden="true">
            <span className="sf-of-termina">Termina en</span>
            <Contador restanteMs={restante} />
          </div>

          {/* A la página de la oferta (la misma del link compartible): todos
              los productos con el descuento ya aplicado, sin códigos. */}
          <Link href={`${base}/oferta/${discountId}`} className="sf-of-cta">
            Ver toda la oferta <ArrowRight size={15} strokeWidth={2.4} aria-hidden="true" />
          </Link>
        </div>

        {/* ── Los productos ─────────────────────────────────────────────────
            Al lado del cartel y no debajo, para que entren en la primera
            vista. El alto se reserva con el skeleton para que la portada no
            salte cuando llega la respuesta. */}
        <ul className={`sf-of-lista sf-of-lista--${disposicion}`} aria-label="Productos en oferta">
          {productos === null
            ? Array.from({ length: 4 }, (_, i) => (
                <li key={i} className="sf-of-item" aria-hidden="true">
                  <div className="sf-of-sk-foto"><Skeleton height="100%" radius={10} delay={i * 80} /></div>
                  <div className="sf-of-info">
                    <Skeleton width="80%" height={12} delay={i * 80} />
                    <Skeleton width="45%" height={16} delay={i * 80} style={{ marginTop: 8 }} />
                  </div>
                </li>
              ))
            : productos.map(p => {
                const pct = pctProducto(p)
                return (
                  <li key={p.id} className="sf-of-item">
                    <Link href={`${base}/producto/${p.id}`} className="sf-of-link">
                      <div className="sf-of-foto">
                        <ProdImage hue={p.hue} imgUrl={p.imgUrl} height={0} radius={10} style={{ height: '100%' }} />
                        {pct !== null && <span className="sf-of-pct">−{pct}%</span>}
                      </div>
                      <div className="sf-of-info">
                        <p className="sf-of-nombre">{p.nombre}</p>
                        <p className="sf-of-precios">
                          <span className="sf-of-precio">{fmt(p.precio)}</span>
                          {p.precioAnt && p.precioAnt > p.precio && (
                            <s className="sf-of-antes">
                              <span className="sf-of-sr">Antes </span>{fmt(p.precioAnt)}
                            </s>
                          )}
                        </p>
                        {!p.stock && <p className="sf-of-sin">Sin stock</p>}
                      </div>
                    </Link>
                  </li>
                )
              })}
        </ul>
      </div>
    </section>
  )
}

function partes(ms: number) {
  const seg = Math.max(0, Math.floor(ms / 1000))
  return {
    dias: Math.floor(seg / 86400),
    horas: Math.floor((seg % 86400) / 3600),
    min: Math.floor((seg % 3600) / 60),
    seg: seg % 60,
  }
}

const pad = (n: number) => String(n).padStart(2, '0')

// El reloj: números grandes con la unidad chica debajo, separados por dos
// puntos. Sin fichas ni sombras — Ale (19/09) no quiso más las "hojitas" que
// giraban (el viejo FlipReloj). Cifras tabulares para que el renglón no baile cuando
// cambia un dígito. Los días solo si faltan: en las últimas horas un "00" al
// lado del resto le baja la urgencia justo cuando más la tiene.
function Contador({ restanteMs }: { restanteMs: number }) {
  const t = partes(restanteMs)
  const unidades: [number, string][] = [
    ...(t.dias > 0 ? [[t.dias, t.dias === 1 ? 'día' : 'días'] as [number, string]] : []),
    [t.horas, 'horas'], [t.min, 'min'], [t.seg, 'seg'],
  ]
  return (
    <div className="sf-of-cont">
      {unidades.map(([n, label], i) => (
        <div key={label} className="sf-of-cont-par">
          {i > 0 && <span className="sf-of-cont-sep">:</span>}
          <span className="sf-of-cont-u">
            <span className="sf-of-cont-n">{pad(n)}</span>
            <span className="sf-of-cont-l">{label}</span>
          </span>
        </div>
      ))}
    </div>
  )
}

const ESTILOS = `
.sf-of { padding-top: 36px; padding-bottom: 36px; }

/* Un solo bloque con borde fino: el cartel de un lado, los productos del
   otro. Sin sombra ni tarjetas dentro de tarjetas. */
.sf-of-caja {
  display: grid; grid-template-columns: minmax(260px, 300px) minmax(0, 1fr);
  border: 1px solid var(--color-border); border-radius: 16px; overflow: hidden;
  background: var(--color-surface);
}

/* color-on-primary y no #fff — una tienda con primario claro (amarillo,
   pastel) dejaba el texto blanco ilegible. Las fichas del reloj son negro
   translúcido: sobre el primario toman el tono de la marca. */
.sf-of-cartel {
  display: flex; flex-direction: column; align-items: flex-start;
  padding: 26px 24px; background: var(--color-primary); color: var(--color-on-primary);
}
.sf-of-kicker { margin: 0; font-size: 13px; font-weight: 500; opacity: 0.8; }
.sf-of-titulo {
  margin: 4px 0 0; font-size: 22px; font-weight: 700; letter-spacing: -0.02em; line-height: 1.2;
  overflow-wrap: anywhere;
}
.sf-of-off {
  margin: 14px 0 0; font-size: 44px; font-weight: 800; letter-spacing: -0.04em; line-height: 1;
  font-variant-numeric: tabular-nums;
}
.sf-of-sub { margin: 10px 0 0; font-size: 13.5px; line-height: 1.5; opacity: 0.85; }

.sf-of-reloj { display: flex; flex-direction: column; gap: 6px; margin-top: auto; padding-top: 24px; }
.sf-of-termina { font-size: 12.5px; opacity: 0.8; }

.sf-of-cont { display: flex; align-items: flex-start; }
.sf-of-cont-par { display: flex; align-items: flex-start; }
.sf-of-cont-u { display: flex; flex-direction: column; align-items: center; min-width: 2ch; }
.sf-of-cont-n {
  font-size: 32px; font-weight: 700; line-height: 1; letter-spacing: -0.02em;
  font-variant-numeric: tabular-nums;
}
.sf-of-cont-l { margin-top: 5px; font-size: 11.5px; opacity: 0.75; }
.sf-of-cont-sep { padding: 0 6px; font-size: 26px; font-weight: 500; line-height: 1.1; opacity: 0.5; }

.sf-of-cta {
  display: inline-flex; align-items: center; gap: 8px; margin-top: 20px;
  min-height: 44px; padding: 0 18px; border-radius: 10px;
  background: var(--color-on-primary); color: var(--color-primary);
  font-size: 14px; font-weight: 700; text-decoration: none;
  transition: opacity 160ms ease;
}
.sf-of-cta:hover { opacity: 0.9; }
.sf-of-cta:focus-visible { outline: 2px solid var(--color-on-primary); outline-offset: 3px; }

/* Texto solo para lector de pantalla. Fuera de pantalla pero no
   display:none, que no se anuncia. */
.sf-of-sr {
  position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px;
  overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; border: 0;
}

/* ── Productos ── */
.sf-of-lista {
  list-style: none; margin: 0; padding: 20px; gap: 16px;
  display: grid; grid-template-columns: repeat(4, minmax(0, 1fr));
  min-width: 0;
}
/* Más de cuatro: una fila que se desliza, con el quinto asomando. */
.sf-of-lista--fila {
  grid-template-columns: none; grid-auto-flow: column;
  grid-auto-columns: calc((100% - 3 * 16px) / 4.3);
  overflow-x: auto; scroll-snap-type: x mandatory; overscroll-behavior-x: contain;
  scroll-padding-inline: 20px; scrollbar-width: thin;
}
.sf-of-lista--fila .sf-of-item { scroll-snap-align: start; }
.sf-of-lista--uno { grid-template-columns: minmax(0, 1fr); }
.sf-of-lista--dos { grid-template-columns: repeat(2, minmax(0, 1fr)); }

.sf-of-item { min-width: 0; }
.sf-of-link {
  display: flex; flex-direction: column; gap: 10px; height: 100%;
  color: var(--color-text); text-decoration: none; border-radius: 12px;
}
.sf-of-link:focus-visible { outline: 2px solid var(--color-primary); outline-offset: 4px; }

.sf-of-foto, .sf-of-sk-foto { position: relative; aspect-ratio: 1 / 1; width: 100%; }
.sf-of-foto img { transition: transform 240ms ease; }
.sf-of-link:hover .sf-of-foto img { transform: scale(1.03); }

/* El % va sobre la foto: es lo que se busca con la vista. */
.sf-of-pct {
  position: absolute; top: 8px; left: 8px;
  padding: 3px 7px; border-radius: 6px;
  background: var(--color-primary); color: var(--color-on-primary);
  font-size: 12.5px; font-weight: 700; font-variant-numeric: tabular-nums;
}

.sf-of-info { min-width: 0; }
.sf-of-nombre {
  margin: 0; font-size: 14px; line-height: 1.35;
  display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
}
.sf-of-link:hover .sf-of-nombre { text-decoration: underline; text-underline-offset: 2px; }
.sf-of-precios { margin: 6px 0 0; display: flex; align-items: baseline; gap: 8px; flex-wrap: wrap; }
.sf-of-precio { font-size: 18px; font-weight: 700; letter-spacing: -0.01em; font-variant-numeric: tabular-nums; }
.sf-of-antes { font-size: 13px; color: var(--color-muted); font-variant-numeric: tabular-nums; }
.sf-of-sin { margin: 4px 0 0; font-size: 12.5px; color: var(--color-muted); }

/* Uno o dos productos: tarjeta horizontal, foto al costado y precio grande. */
.sf-of-lista--uno .sf-of-link, .sf-of-lista--dos .sf-of-link {
  flex-direction: row; align-items: center; gap: 20px;
}
.sf-of-lista--uno .sf-of-foto { width: min(280px, 45%); flex-shrink: 0; }
.sf-of-lista--dos .sf-of-foto { width: 46%; flex-shrink: 0; }
.sf-of-lista--uno .sf-of-nombre { font-size: 18px; }
.sf-of-lista--uno .sf-of-precio { font-size: 26px; }
.sf-of-lista--dos .sf-of-precio { font-size: 20px; }

@media (prefers-reduced-motion: reduce) {
  .sf-of-cta, .sf-of-foto img { transition: none; }
  .sf-of-link:hover .sf-of-foto img { transform: none; }
}

/* Tablet: el cartel sigue al costado pero los productos van de a tres. */
@media (max-width: 1024px) {
  .sf-of-lista--grilla { grid-template-columns: repeat(3, minmax(0, 1fr)); }
  .sf-of-lista--grilla .sf-of-item:nth-child(n+4) { display: none; }
  .sf-of-lista--fila { grid-auto-columns: calc((100% - 2 * 16px) / 3.3); }
}

/* Celular: el cartel arriba, compacto (el % y el reloj en un renglón), y los
   productos en una fila que se desliza con el siguiente asomando. */
@media (max-width: 720px) {
  .sf-of-caja { grid-template-columns: minmax(0, 1fr); border-radius: 14px; }
  .sf-of-cartel { padding: 18px 16px; }
  .sf-of-off { font-size: 34px; margin-top: 10px; }
  .sf-of-reloj { margin-top: 16px; padding-top: 0; }
  .sf-of-cont-n { font-size: 28px; }
  .sf-of-precio { font-size: 16px; }
  .sf-of-antes { font-size: 12px; }
  .sf-of-cta { width: 100%; justify-content: center; box-sizing: border-box; margin-top: 16px; }

  .sf-of-lista, .sf-of-lista--grilla, .sf-of-lista--fila {
    padding: 16px; gap: 12px;
    grid-template-columns: none; grid-auto-flow: column; grid-auto-columns: 44%;
    overflow-x: auto; scroll-snap-type: x mandatory; overscroll-behavior-x: contain;
    scroll-padding-inline: 16px; scrollbar-width: none;
  }
  .sf-of-lista::-webkit-scrollbar { display: none; }
  .sf-of-lista .sf-of-item { scroll-snap-align: start; }
  .sf-of-lista--grilla .sf-of-item:nth-child(n+4) { display: block; }
  .sf-of-lista--dos { grid-template-columns: repeat(2, minmax(0, 1fr)); grid-auto-flow: row; overflow: visible; }
  .sf-of-lista--dos .sf-of-link { flex-direction: column; align-items: stretch; gap: 10px; }
  .sf-of-lista--dos .sf-of-foto { width: 100%; }
  .sf-of-lista--uno .sf-of-foto { width: 42%; }
  .sf-of-lista--uno .sf-of-precio { font-size: 22px; }
  .sf-of-lista--uno .sf-of-nombre { font-size: 15px; }
}
`
