// Sección de la PORTADA: "la cartelera" de la promo con cuenta regresiva —
// los días, horas, minutos y segundos corriendo en vivo— y abajo la grilla con
// los productos que están en oferta de verdad.
//
// Es la cara visible del countdown CON DESCUENTO (paquete Avanzado): el dueño
// elige el %, a qué productos aplica y hasta cuándo, y esto muestra esos
// mismos productos con su precio ya descontado. Nada de acá es texto suelto:
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
import { Timer } from 'lucide-react'
import { ProductCard } from './ProductCard'
import { pedirCountdown } from './countdownCache'
import { getStorefrontProducts, toProducto, type StorefrontActiveCountdown } from '@/lib/storefront/api'
import type { Producto } from '@/lib/storefront/types'
import { SkeletonProductGrid } from '@/design-system/components/Skeleton'
import { useAhora } from '@/hooks/useAhora'

type Props = {
  slug: string
  mode?: 'FULL' | 'SHOWCASE'
  transferPct?: number | null
  // Los mismos toggles de Apariencia que usa el resto de la portada, para que
  // las cards de acá no muestren insignias que el dueño apagó.
  badges?: { showNew?: boolean; showOffer?: boolean; showLowStock?: boolean }
  onVerTodo?: () => void
}

// Cuántos productos entran en la cartelera. Dos filas de cuatro en escritorio;
// más que eso deja de ser "la promo" y pasa a competir con el catálogo, que
// está a un click con "Ver todos".
const MAX_PRODUCTOS = 8

function partes(ms: number) {
  const seg = Math.floor(ms / 1000)
  return {
    dias: Math.floor(seg / 86400),
    horas: Math.floor((seg % 86400) / 3600),
    min: Math.floor((seg % 3600) / 60),
    seg: seg % 60,
  }
}

const pad = (n: number) => String(n).padStart(2, '0')

function etiquetaDescuento(c: StorefrontActiveCountdown): string | null {
  if (c.descuentoValor == null) return null
  return c.descuentoTipo === 'PERCENT'
    ? `${Math.round(c.descuentoValor)}% OFF`
    : `$${c.descuentoValor.toLocaleString('es-AR')} OFF`
}

function fechaLarga(iso: string): string {
  return new Date(iso).toLocaleDateString('es-AR', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })
}

export function CountdownOfertaSection({ slug, mode = 'FULL', transferPct, badges, onVerTodo }: Props) {
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
  // valga: una grilla de productos cuya promo terminó mostraría precios que
  // ya no son los que se cobran.
  if (!cfg || !discountId || restante === null || restante <= 0) return null
  // Ningún producto quedó en pie (todos sin stock, despublicados, borrados):
  // la sección sin productos sería un cartel repetido del banner.
  if (productos !== null && productos.length === 0) return null

  const t = partes(restante)
  const off = etiquetaDescuento(cfg)
  const cargando = productos === null

  return (
    <section className="sf-w sf-of" aria-labelledby="sf-of-titulo">
      <style>{ESTILOS}</style>

      {/* ── La cartelera ──────────────────────────────────────────────────
          El reloj va aria-hidden y al lado hay un texto para lector de
          pantalla con la fecha de fin: anunciar los segundos uno por uno
          taparía todo lo demás de la página. */}
      <div className="sf-of-cartel">
        <div className="sf-of-copy">
          <div className="sf-of-eyebrow">
            <Timer size={13} strokeWidth={2.4} aria-hidden="true" />
            Oferta por tiempo limitado
            {off && <span className="sf-of-off">{off}</span>}
          </div>
          <h2 id="sf-of-titulo" className="sf-of-titulo">{cfg.title}</h2>
          {cfg.subtitle && <p className="sf-of-sub">{cfg.subtitle}</p>}
          <p className="sf-of-sr">Termina el {fechaLarga(cfg.endDate)}.</p>
        </div>

        <div className="sf-of-reloj" aria-hidden="true">
          {/* Los días solo si faltan: en las últimas horas de la promo un
              "00 días" al lado del resto le baja la urgencia justo cuando
              más la tiene. */}
          {t.dias > 0 && <Casilla n={t.dias} label={t.dias === 1 ? 'día' : 'días'} />}
          <Casilla n={t.horas} label="hs" />
          <Casilla n={t.min} label="min" />
          {/* Los segundos son lo único que se mueve todo el tiempo; van en un
              ancho fijo (tabular-nums + minWidth de la casilla) para que el
              bloque entero no tiemble al pasar de 9 a 10. */}
          <Casilla n={t.seg} label="seg" />
        </div>
      </div>

      {/* ── Los productos ─────────────────────────────────────────────────
          El alto se reserva con el skeleton para que la portada no salte
          cuando llega la respuesta. */}
      {cargando ? (
        <SkeletonProductGrid cantidad={4} className="sf-g4" />
      ) : (
        <>
          <div className="sf-g4">
            {productos!.map(p => (
              <ProductCard key={p.id} producto={p} mode={mode} transferPct={transferPct} />
            ))}
          </div>
          {onVerTodo && (
            <div className="sf-of-pie">
              <button type="button" className="sf-of-ver ds-hover" onClick={onVerTodo}>
                Ver toda la tienda
              </button>
            </div>
          )}
        </>
      )}
    </section>
  )
}

function Casilla({ n, label }: { n: number; label: string }) {
  return (
    <span className="sf-of-casilla">
      <b>{pad(n)}</b>
      <span>{label}</span>
    </span>
  )
}

const ESTILOS = `
.sf-of { padding-top: 36px; padding-bottom: 36px; }

/* Mismo degradé que el banner del countdown: leídos juntos en la portada
   tienen que verse como la misma promo, no como dos avisos distintos.
   color-on-primary y no #fff — una tienda con primario claro (amarillo,
   pastel) dejaba el texto blanco ilegible. */
.sf-of-cartel {
  display: flex; align-items: center; justify-content: space-between;
  gap: 20px; flex-wrap: wrap;
  padding: 22px 26px; border-radius: 18px; margin-bottom: 20px;
  background: linear-gradient(100deg, var(--color-primary-h), var(--color-primary));
  color: var(--color-on-primary);
}

.sf-of-copy { min-width: 220px; flex: 1; }

.sf-of-eyebrow {
  display: inline-flex; align-items: center; gap: 7px; flex-wrap: wrap;
  font-size: 11px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase;
  opacity: 0.9;
}
.sf-of-off {
  padding: 2px 8px; border-radius: 999px; letter-spacing: 0.04em;
  background: color-mix(in srgb, var(--color-on-primary) 20%, transparent);
  opacity: 1;
}

.sf-of-titulo { font-size: 24px; font-weight: 800; letter-spacing: -0.02em; line-height: 1.2; margin: 8px 0 0; }
.sf-of-sub { font-size: 13.5px; line-height: 1.5; opacity: 0.88; margin: 6px 0 0; max-width: 52ch; }

/* La fecha de fin para lectores de pantalla — el reloj de al lado es
   aria-hidden. Fuera de pantalla pero no display:none, que no se anuncia. */
.sf-of-sr {
  position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px;
  overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; border: 0;
}

.sf-of-reloj { display: flex; align-items: stretch; gap: 8px; flex-shrink: 0; }
.sf-of-casilla {
  display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px;
  min-width: 62px; padding: 10px 8px; border-radius: 12px;
  background: color-mix(in srgb, var(--color-on-primary) 16%, transparent);
}
.sf-of-casilla b {
  font-family: "Geist Mono", monospace; font-size: 26px; font-weight: 700; line-height: 1;
  /* Ancho de dígito fijo: sin esto el bloque se mueve un pelo cada segundo. */
  font-variant-numeric: tabular-nums;
}
.sf-of-casilla span { font-size: 10px; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; opacity: 0.8; }

.sf-of-pie { display: flex; justify-content: center; margin-top: 20px; }
.sf-of-ver {
  min-height: 44px; padding: 0 22px; border-radius: 10px; cursor: pointer;
  font-family: inherit; font-size: 13.5px; font-weight: 600;
  background: var(--color-surface); color: var(--color-text);
  border: 1px solid var(--color-border);
}
.sf-of-ver:focus-visible { outline: 2px solid var(--color-primary); outline-offset: 2px; }

/* En celular la cartelera se apila: el reloj pasa abajo, a lo ancho, y las
   casillas se reparten el renglón en vez de quedar apretadas contra el
   título. */
@media (max-width: 720px) {
  .sf-of-cartel { padding: 18px 16px; border-radius: 14px; }
  .sf-of-titulo { font-size: 20px; }
  .sf-of-reloj { width: 100%; }
  .sf-of-casilla { flex: 1; min-width: 0; padding: 9px 4px; }
  .sf-of-casilla b { font-size: 22px; }
}
`
