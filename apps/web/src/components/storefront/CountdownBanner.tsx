// Cuenta regresiva de la tienda (paquete Avanzado → Oferta relámpago).
//
// El contenido y la fecha salen de la config propia del módulo — NO de
// Descuentos. Hubo una versión anterior que derivaba el countdown del
// descuento con "link compartible" más urgente y solo sabía decir "20% OFF ·
// nombre del descuento"; se descartó porque obligaba a crear un descuento para
// poder anunciar "Cyber Week termina el viernes". Ver CountdownConfig en
// schema.prisma.
//
// Se monta en DOS lugares y cada uno pide su variante; el que no corresponde
// al `placement` guardado no dibuja nada:
//   - `lugar="HOME"`      → Inicio.tsx, debajo del hero: banner ancho.
//   - `lugar="ALL_PAGES"` → StorefrontChrome.tsx, debajo del header: tira fina
//                           en todas las páginas.
// En la portada los dos están montados a la vez —y encima la sección de
// productos en oferta (CountdownOfertaSection.tsx) pide lo mismo—, así que la
// respuesta se comparte con el cache por slug de countdownCache.ts.

import { useEffect, useState } from 'react'
import { Timer, ArrowRight } from 'lucide-react'
import { type StorefrontActiveCountdown } from '@/lib/storefront/api'
import { pedirCountdown } from './countdownCache'
import { storefrontBase } from '@/lib/tenant'
import { useAhora } from '@/hooks/useAhora'

type Props = { slug: string; lugar: 'HOME' | 'ALL_PAGES' }

function partesRestantes(ms: number) {
  const seg = Math.floor(ms / 1000)
  return {
    dias: Math.floor(seg / 86400),
    horas: Math.floor((seg % 86400) / 3600),
    min: Math.floor((seg % 3600) / 60),
    seg: seg % 60,
  }
}

const pad = (n: number) => String(n).padStart(2, '0')

function fechaLarga(iso: string): string {
  return new Date(iso).toLocaleDateString('es-AR', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })
}

export function CountdownBanner({ slug, lugar }: Props) {
  const [cfg, setCfg] = useState<StorefrontActiveCountdown | null>(null)

  useEffect(() => {
    let cancelado = false
    pedirCountdown(slug).then(c => { if (!cancelado) setCfg(c) })
    return () => { cancelado = true }
  }, [slug])

  // El tercer argumento apaga el intervalo al llegar a la fecha de fin: pasado
  // ese punto ya no hay nada que actualizar (o se muestra el mensaje de cierre,
  // que es fijo, o no se muestra nada).
  const ahora = useAhora(!!cfg && cfg.placement === lugar, 1000, cfg ? new Date(cfg.endDate).getTime() : undefined)
  const restante = cfg && ahora !== null ? new Date(cfg.endDate).getTime() - ahora : null
  const termino = restante !== null && restante <= 0

  // Hasta que no hay config y primer "ahora" no se dibuja nada: un reloj en
  // 00h00m00s por un frame se ve peor que la ausencia del banner.
  if (!cfg || cfg.placement !== lugar || restante === null) return null
  // En la portada, cuando hay sección de productos (CountdownOfertaSection),
  // el reloj grande está ahí: un segundo reloj en el banner de arriba sería
  // el mismo dato dos veces en la misma pantalla.
  if (lugar === 'HOME' && cfg.showProductsOnHome) return null
  // El backend no devuelve un countdown vencido sin mensaje de cierre, pero se
  // chequea igual: el reloj llega a cero con la página abierta.
  if (termino && !cfg.finishedMessage) return null

  const t = partesRestantes(Math.max(restante, 0))
  const compacto = lugar === 'ALL_PAGES'
  // La oferta relámpago no trae textos propios (todo sale del descuento):
  // el CTA por defecto lleva a la página de la oferta, con los productos ya
  // rebajados. Si el dueño cargó un CTA a mano, manda el suyo.
  const ctaText = cfg.ctaText ?? (cfg.discountId ? 'Ver la oferta' : null)
  const ctaLink = cfg.ctaLink ?? (cfg.discountId ? `/oferta/${cfg.discountId}` : null)
  const etiqueta = termino
    ? cfg.finishedMessage!
    : `${cfg.title} — termina el ${fechaLarga(cfg.endDate)}`

  const reloj = termino ? null : (
    // aria-hidden: si el lector de pantalla anunciara los segundos, no se
    // podría escuchar nada más de la página. El texto de arriba (aria-label
    // del contenedor) ya dice cuándo termina, que es lo que importa.
    <span className="sf-cd-reloj" aria-hidden="true">
      {t.dias > 0 && <><b>{pad(t.dias)}</b>d</>}
      <b>{pad(t.horas)}</b>h<b>{pad(t.min)}</b>m<b>{pad(t.seg)}</b>s
    </span>
  )

  const contenido = (
    <>
      <span className="sf-cd-texto">
        {!compacto && (
          <span className="sf-cd-icono" aria-hidden="true">
            <Timer size={18} strokeWidth={1.8} />
          </span>
        )}
        <span className="sf-cd-copy">
          <strong>{termino ? cfg.finishedMessage : cfg.title}</strong>
          {!termino && !compacto && cfg.subtitle && <span className="sf-cd-sub">{cfg.subtitle}</span>}
        </span>
      </span>
      {reloj}
      {!termino && ctaText && (
        <span className="sf-cd-cta">
          {ctaText} <ArrowRight size={13} strokeWidth={2.4} aria-hidden="true" />
        </span>
      )}
    </>
  )

  const clase = `sf-cd ${compacto ? 'sf-cd--tira' : 'sf-cd--banner'}`

  return (
    <>
      <style>{ESTILOS}</style>
      {/* Con link es un <a>; sin link, un <div>: un ancla sin href no es
          navegable con teclado y el cursor de mano mentiría.
          El prefijo sale de storefrontBase() y no de `/tienda/${slug}` fijo:
          en un subdominio real (tienda.orbita.site) las rutas cuelgan de la
          raíz, y el prefijo fijo —que es lo que hacía la versión anterior de
          este archivo— daba un link roto. */}
      {!termino && ctaLink && ctaText ? (
        <div className={compacto ? undefined : 'sf-w'} style={compacto ? undefined : { marginTop: 20 }}>
          <a href={`${storefrontBase(slug)}${ctaLink}`} className={clase} aria-label={`${etiqueta}. ${ctaText}`}>
            {contenido}
          </a>
        </div>
      ) : (
        <div className={compacto ? undefined : 'sf-w'} style={compacto ? undefined : { marginTop: 20 }}>
          <div className={clase} role="status" aria-label={etiqueta}>
            {contenido}
          </div>
        </div>
      )}
    </>
  )
}

const ESTILOS = `
.sf-cd {
  display: flex; align-items: center; gap: 14px; flex-wrap: wrap;
  background: linear-gradient(90deg, var(--color-primary-h), var(--color-primary));
  /* color-on-primary y no #fff: una tienda con primario claro (amarillo,
     pastel) dejaba el texto blanco ilegible encima del banner. El token ya
     lo define el tema del storefront. */
  color: var(--color-on-primary); text-decoration: none;
}
a.sf-cd { transition: filter 200ms ease; }
a.sf-cd:hover { filter: brightness(1.06); }
a.sf-cd:focus-visible { outline: 2px solid var(--color-on-primary); outline-offset: -3px; }

.sf-cd--banner { padding: 16px 22px; border-radius: 14px; }
/* La tira de "todas las páginas" va de punta a punta debajo del header, como
   el AnnouncementBar de Apariencia — nunca en lugar de él: se pueden tener
   los dos. Y como los dos usan el color primario del negocio, apilados se leen
   como un solo bloque rojo: el inset de arriba es la línea que los separa. */
.sf-cd--tira {
  padding: 9px 16px; border-radius: 0; justify-content: center; gap: 10px;
  box-shadow: inset 0 1px 0 color-mix(in srgb, var(--color-on-primary) 30%, transparent);
}

.sf-cd-texto { display: flex; align-items: center; gap: 10px; flex: 1; min-width: 180px; }
.sf-cd--tira .sf-cd-texto { flex: 0 1 auto; min-width: 0; }
.sf-cd-icono { width: 38px; height: 38px; border-radius: 10px; background: color-mix(in srgb, var(--color-on-primary) 18%, transparent); display: grid; place-items: center; flex-shrink: 0; }
.sf-cd-copy { min-width: 0; font-size: 13px; font-weight: 700; line-height: 1.35; }
.sf-cd--tira .sf-cd-copy { font-size: 12.5px; }
.sf-cd-sub { display: block; font-size: 11.5px; font-weight: 400; opacity: 0.85; margin-top: 1px; }

.sf-cd-reloj { display: inline-flex; align-items: baseline; gap: 1px; font-family: "Geist Mono", monospace; font-size: 10.5px; opacity: 0.9; flex-shrink: 0; }
.sf-cd-reloj b { font-size: 16px; margin-left: 4px; }
.sf-cd--tira .sf-cd-reloj b { font-size: 13.5px; }

.sf-cd-cta { display: inline-flex; align-items: center; gap: 4px; font-size: 12.5px; font-weight: 700; flex-shrink: 0; }
.sf-cd--tira .sf-cd-cta { font-size: 12px; }

/* En un celular angosto el reloj y el botón se pelean el renglón con el
   título: el texto pasa a ocupar la fila entera y abajo quedan reloj y CTA. */
@media (max-width: 560px) {
  .sf-cd--banner { padding: 13px 15px; gap: 10px; }
  .sf-cd-texto { flex-basis: 100%; }
  .sf-cd-icono { width: 32px; height: 32px; border-radius: 9px; }
  .sf-cd--tira { padding: 8px 12px; }
  .sf-cd--tira .sf-cd-sub { display: none; }
}
`
