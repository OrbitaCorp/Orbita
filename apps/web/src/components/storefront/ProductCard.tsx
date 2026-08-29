import { useState } from 'react'
import { Eye, Check, ShoppingCart } from 'lucide-react'
import { useRouter } from 'next/router'
import { ProdImage } from './Thumb'
import { VariantPickerModal } from './VariantPickerModal'
import { fmt, thumbGradient, thumbGradientAlt, imagenParaVariante, variantePrincipal } from '@/lib/storefront/utils'
import { useCart } from '@/lib/storefront/CartContext'
import { getStorefrontProduct, type StorefrontProductDetail } from '@/lib/storefront/api'
import type { Producto } from '@/lib/storefront/types'

type Props = {
  producto: Producto
  rank?:    number   // #1, #2… overlay (Más vendidos)
  // 'list' — fila horizontal angosta (toggle grilla/lista del catálogo, ver
  // Catalogo.tsx). Reutiliza toda la lógica de agregar/comprar de acá en vez
  // de duplicarla en un componente aparte.
  layout?:  'grid' | 'list'
  // Vidriera digital: no hay carrito — se sacan los botones de compra
  // rápida, la card solo lleva al detalle (ahí está "Consultar por
  // WhatsApp"). Default FULL para no romper ningún llamador existente.
  mode?: 'FULL' | 'SHOWCASE'
}

function badgeColor(badge: string): { bg: string; color: string } {
  // Dash/% — no lo produce ningún caller real hoy (toProducto() en
  // lib/storefront/api.ts arma el badge de descuento como el texto fijo
  // "Oferta", nunca un porcentaje) pero se deja por si alguna vez sí.
  if (badge.startsWith('−') || badge.startsWith('-') || badge.includes('%'))
    return { bg: '#DC2626', color: '#fff' }
  if (badge.toLowerCase() === 'nuevo')
    return { bg: '#059669', color: '#fff' }
  // "Oferta" (el badge de descuento real, ver arriba) y cualquier otro
  // genérico caen acá — "Nuevo" es el único con color fijo (verde) de
  // verdad. Responde a "Color de acento" de Apariencia (--color-accent, ver
  // _app.tsx), con un fallback fijo para negocios que nunca lo configuraron.
  return { bg: 'var(--color-accent, #2563EB)', color: '#fff' }
}

// Hash chico para el degradé de fallback de un swatch sin foto tagueada —
// mismo criterio que ya usa el detalle de producto (ProductoDetalle.tsx →
// hueFromId), pero sobre el VALOR ("Negro") en vez de un id, porque acá no
// se tiene el id real del OptionValue (el listado del catálogo no lo manda).
function hueDeValor(valor: string): number {
  let h = 0
  for (let i = 0; i < valor.length; i++) h = (h * 31 + valor.charCodeAt(i)) % 360
  return h
}

// Swatches de color de la card — pedido explícito de volver a esto: solo el
// tipo "visual" (con fotos, ej. Color), sin los talles como texto (se sacaron
// después de probarlo). TODOS los colores disponibles, sin tope — el backend
// igual manda hasta 2 tipos de opción por si se vuelve a pedir mostrar el
// segundo más adelante, acá se ignora todo lo que no sea `isVisual`. Hover Y
// click cambian la foto mostrada en la card (click además sirve para touch,
// que no tiene hover) — nunca agregan nada al carrito ni navegan, para eso
// ya está el picker de variante real al tocar "Agregar"/"Comprar ahora".
// `swatchSize` distinto entre grilla y lista porque la fila de lista es
// mucho más angosta.
function VariantesCard({ grupos, valorMostrado, onHover, onClick, swatchSize = 22 }: {
  grupos: { name: string; isVisual: boolean; values: { value: string; imageUrl: string | null }[] }[]
  valorMostrado: string | null
  onHover: (v: string | null) => void
  onClick: (v: string, e: React.MouseEvent) => void
  swatchSize?: number
}) {
  const colores = grupos.find(g => g.isVisual)?.values ?? []
  if (colores.length === 0) return null
  return (
    <div
      style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}
      onMouseLeave={() => onHover(null)}
      onClick={e => e.stopPropagation()}
    >
      {colores.map(v => (
        <button
          key={v.value}
          onMouseEnter={() => onHover(v.value)}
          onClick={e => onClick(v.value, e)}
          title={v.value}
          style={{
            width: swatchSize, height: swatchSize, borderRadius: '50%', padding: 0, overflow: 'hidden', flexShrink: 0,
            border: `2px solid ${valorMostrado === v.value ? 'var(--color-primary)' : 'var(--color-border)'}`,
            cursor: 'pointer', background: 'none', transition: 'border-color 120ms ease',
          }}
        >
          {v.imageUrl
            ? <img src={v.imageUrl} alt={v.value} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
            : <div style={{
                width: '100%', height: '100%',
                background: `repeating-linear-gradient(135deg, oklch(0.84 0.06 ${hueDeValor(v.value)}) 0px 5px, oklch(0.80 0.06 ${hueDeValor(v.value)}) 5px 10px)`,
              }} />}
        </button>
      ))}
    </div>
  )
}

export function ProductCard({ producto, rank, layout = 'grid', mode = 'FULL' }: Props) {
  const router = useRouter()
  const { slug } = router.query as { slug: string }
  const [hov, setHov] = useState(false)
  // Color en preview (hover o click sobre un swatch, ver Swatches más
  // arriba) — cambia la foto mostrada en la card sin tocar nada de lo que
  // se compraría (eso lo resuelve el picker real al agregar). Se limpia al
  // sacar el mouse de la fila de swatches, no de la card entera.
  const [valorMostrado, setValorMostrado] = useState<string | null>(null)
  const opcionVisual = producto.variantOptions?.find(g => g.isVisual)
  const varianteMostrada = opcionVisual?.values.find(v => v.value === valorMostrado)
  const imgMostrada = varianteMostrada?.imageUrl ?? producto.imgUrl
  // Hover de la CARD ENTERA (no un swatch puntual) pasa a la segunda foto
  // real del producto, si tiene una — pedido explícito del dueño ("si pasas
  // el mouse por encima se pone la imagen secundaria, o de variante, si es
  // que posee"). El swatch de color manda cuando está activo (es una
  // elección explícita del cliente, no solo pasar el mouse por la card) —
  // por eso el segundo `img` de abajo solo se muestra con `!valorMostrado`.
  const hoverMuestraSegunda = hov && !valorMostrado && !!producto.imgUrl2
  const { agregar } = useCart()
  // Cuál de las dos acciones está en vuelo (ambas piden el detalle al backend
  // antes de poder hacer nada) — bloquea las dos, para que un doble click no
  // agregue dos veces ni dispare las dos cosas a la vez.
  const [ocupado, setOcupado] = useState<'agregar' | 'comprar' | null>(null)
  const [agregado, setAgregado] = useState(false)
  // Se tocó "Agregar"/"Comprar ahora" pero ya no quedaba nada más para sumar
  // (el carrito ya tenía TODO el stock disponible de esta variante) — mismo
  // criterio de "avisar, no fallar en silencio" del resto del carrito.
  const [sinMas, setSinMas] = useState(false)
  // Producto con opciones (talle/color/etc.) recién pedido al backend — se
  // abre el selector rápido en vez de agregar cualquiera, porque desde la
  // grilla no hay forma honesta de adivinar cuál variante quiere el cliente.
  // `modo` decide el CTA final del modal: "agregar" se queda en la grilla,
  // "comprar" sigue al checkout apenas confirma.
  const [picker, setPicker] = useState<{ detalle: StorefrontProductDetail; modo: 'agregar' | 'comprar' } | null>(null)

  // Producto SIN opciones (una sola variante): agrega directo, sin pasar por
  // el selector. Pide el detalle real recién al tocar el botón (la grilla no
  // trae variantes, solo precio/stock a nivel producto).
  async function agregarVarianteUnica(detalle: StorefrontProductDetail, modo: 'agregar' | 'comprar') {
    // Normalmente hay una sola variante acá (producto sin opciones) — si por
    // algún dato corrupto hubiera más de una, se elige siempre la misma que
    // ya usó el backend para el precio/maxQty que se está mostrando en la
    // card (ver variantePrincipal() y precioRepresentativo() en
    // storefront.service.ts), nunca "la primera que venga".
    const variante = variantePrincipal(detalle.variants)
    if (!variante || !variante.inStock) return
    const agregadas = agregar({
      id: variante.id,
      productId: detalle.id,
      nombre: detalle.name,
      variante: '',
      precio: variante.price,
      precioAnt: variante.comparePrice,
      hue: producto.hue,
      imgUrl: imagenParaVariante(detalle.images, variante.optionValues.map(ov => ov.optionValueId)),
      maxQty: variante.maxQty,
    })
    aplicarResultado(agregadas, modo)
  }

  // Feedback compartido entre el agregado directo (sin opciones) y el que
  // vuelve del selector rápido (con opciones): si no se pudo sumar nada
  // avisa "ya tenés todo", si sí, checkmark o sigue al checkout según el CTA
  // que se tocó.
  function aplicarResultado(agregadas: number, modo: 'agregar' | 'comprar') {
    if (agregadas === 0) {
      setSinMas(true)
      setTimeout(() => setSinMas(false), 1800)
      return
    }
    if (modo === 'agregar') {
      setAgregado(true)
      setTimeout(() => setAgregado(false), 1400)
    } else {
      router.push(`/tienda/${slug}/checkout/datos`)
    }
  }

  async function accionar(modo: 'agregar' | 'comprar', e: React.MouseEvent) {
    e.stopPropagation()
    if (ocupado) return
    setOcupado(modo)
    try {
      const detalle = await getStorefrontProduct(slug, producto.id)
      if (detalle.options.length > 0) {
        setPicker({ detalle, modo })
      } else {
        await agregarVarianteUnica(detalle, modo)
      }
    } catch {
      // Sin conexión/producto ya no existe: no rompe la navegación normal de
      // la card, el cliente puede seguir mirando el catálogo igual.
    } finally {
      setOcupado(null)
    }
  }

  const handleAdd = (e: React.MouseEvent) => accionar('agregar', e)
  // Mismo destino que el "Comprar ahora" del detalle de producto
  // (ProductoDetalle.tsx): agrega y va derecho a cargar los datos de envío.
  // OJO: el checkout cobra TODO el carrito, no solo este producto — es el
  // mismo criterio que ya tenía el detalle, no una regla nueva de la card.
  const handleBuyNow = (e: React.MouseEvent) => accionar('comprar', e)

  if (layout === 'list') {
    return (
      <>
      <div
        onClick={() => router.push(`/tienda/${slug}/producto/${producto.id}`)}
        onMouseEnter={() => setHov(true)}
        onMouseLeave={() => setHov(false)}
        style={{
          display: 'flex', alignItems: 'center', gap: 14, padding: 10,
          background: 'var(--color-bg)',
          border: `1px solid ${hov ? 'var(--color-border-strong)' : 'var(--color-border)'}`,
          borderRadius: 12, cursor: 'pointer',
          boxShadow: hov ? '0 6px 18px rgba(15,23,42,0.08)' : 'none',
          transition: 'box-shadow 200ms ease, border-color 200ms ease',
        }}
      >
        <ProdImage hue={producto.hue} imgUrl={imgMostrada} radius={9} style={{ width: 76, height: 76, flexShrink: 0 }} />

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
            <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--color-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {producto.nombre}
            </div>
            {producto.badge && (() => {
              const { bg, color } = badgeColor(producto.badge)
              return <span style={{ flexShrink: 0, height: 18, padding: '0 7px', borderRadius: 999, background: bg, color, fontSize: 9.5, fontWeight: 700 }}>{producto.badge}</span>
            })()}
            {producto.lowStock && <span style={{ flexShrink: 0, fontSize: 11, fontWeight: 600, color: '#D97706' }}>⚡ Últimas unidades</span>}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 7 }}>
              <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--color-text)', fontFamily: '"Geist Mono", monospace' }}>{fmt(producto.precio)}</span>
              {producto.precioAnt && (
                <span style={{ fontSize: 11.5, color: 'var(--color-muted)', textDecoration: 'line-through', fontFamily: '"Geist Mono", monospace' }}>{fmt(producto.precioAnt)}</span>
              )}
            </div>
            {producto.variantOptions && (
              <VariantesCard grupos={producto.variantOptions} valorMostrado={valorMostrado} onHover={setValorMostrado} onClick={(v, e) => { e.stopPropagation(); setValorMostrado(v) }} swatchSize={18} />
            )}
          </div>
        </div>

        {mode !== 'SHOWCASE' && (
        <div style={{ position: 'relative', display: 'flex', gap: 8, flexShrink: 0 }}>
          {sinMas && (
            <span style={{ position: 'absolute', bottom: '100%', right: 0, marginBottom: 6, padding: '5px 8px', borderRadius: 6, background: 'var(--color-text)', color: 'var(--color-bg)', fontSize: 11, fontWeight: 600, textAlign: 'center', lineHeight: 1.3, whiteSpace: 'nowrap' }}>
              Ya tenés todo el stock en tu carrito
            </span>
          )}
          <button
            onClick={handleAdd}
            disabled={!!ocupado}
            title="Agregar al carrito"
            aria-label="Agregar al carrito"
            className="ds-hover"
            style={{ width: 38, height: 38, borderRadius: 8, background: agregado ? 'var(--color-success)' : 'var(--color-primary)', color: '#fff', border: 'none', display: 'grid', placeItems: 'center', opacity: ocupado ? 0.7 : 1, flexShrink: 0 }}
          >
            {agregado ? <Check size={15} strokeWidth={2.4} /> : <ShoppingCart size={15} strokeWidth={2} />}
          </button>
          <button
            onClick={handleBuyNow}
            disabled={!!ocupado}
            className="ds-hover"
            style={{ height: 38, padding: '0 14px', borderRadius: 8, background: 'transparent', color: 'var(--color-text)', border: '1px solid var(--color-border)', fontSize: 13, fontWeight: 600, opacity: ocupado ? 0.7 : 1, whiteSpace: 'nowrap' }}
          >
            Comprar ahora
          </button>
        </div>
        )}
      </div>

      {picker && (
        <VariantPickerModal
          producto={picker.detalle}
          hue={producto.hue}
          modo={picker.modo}
          onClose={() => setPicker(null)}
          onDone={agregadas => { const modo = picker.modo; setPicker(null); aplicarResultado(agregadas, modo) }}
        />
      )}
      </>
    )
  }

  return (
    <>
    {/* Íconos flotantes (bolsa/ojo) que deslizan desde afuera de la foto al
        hover — reglas .orb-pcard-accion/.orb-pcard-grupo en globals.css (una
        sola vez ahí, no repetidas por cada card de la grilla). Solo en
        dispositivos con hover de verdad: en touch quedan visibles siempre,
        ver el comentario en globals.css. */}
    <div
      className="orb-pcard-grupo"
      onClick={() => router.push(`/tienda/${slug}/producto/${producto.id}`)}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{ cursor: 'pointer' }}
    >
      {/* ── Imagen ──
          Pedido explícito del dueño: "quiero tener el diseño de esta
          referencia" — no solo la mecánica (aspectRatio/crossfade, ya
          hecho), la CARD entera: sin caja con borde, imagen más grande y
          protagonista, acciones como íconos flotantes sobre la foto en vez
          de un renglón de botones fijo abajo. aspectRatio 3:4 (no un alto
          fijo en px): escala sola con cualquier ancho de columna. Mismo
          contrato visual que ProdImage.tsx en el resto (fondo neutro +
          object-fit:contain con inset del 6%, NO cover — ver la decisión
          documentada en Thumb.tsx: fotos sin estándar de recorte entre
          productos, cover las recortaría de forma pareja e incorrecta). */}
      <div style={{
        position: 'relative', width: '100%', aspectRatio: '3 / 4', overflow: 'hidden', borderRadius: 16,
        background: imgMostrada ? 'var(--color-surface)' : thumbGradient(producto.hue),
      }}>
        {imgMostrada && (
          <img
            src={imgMostrada} alt=""
            style={{
              position: 'absolute', inset: '6%', width: '88%', height: '88%', objectFit: 'contain',
              opacity: hoverMuestraSegunda ? 0 : 1, transition: 'opacity 420ms ease',
            }}
          />
        )}

        {/* Segunda foto real (hover de la card, ver hoverMuestraSegunda) —
            si el producto tiene más de una foto cargada. Sin foto real
            ninguna, cae al degradé de fallback de siempre (hue2) más abajo. */}
        {producto.imgUrl2 && (
          <img
            src={producto.imgUrl2} alt=""
            style={{
              position: 'absolute', inset: '6%', width: '88%', height: '88%', objectFit: 'contain',
              opacity: hoverMuestraSegunda ? 1 : 0, transition: 'opacity 420ms ease',
            }}
          />
        )}

        {/* Segunda imagen (hover) — solo para el degradé de fallback, no tiene
            sentido con una foto real (no hay una "segunda foto" garantizada). */}
        {!producto.imgUrl && producto.hue2 !== undefined && (
          <div style={{
            position: 'absolute', inset: 0, zIndex: 1,
            background: thumbGradientAlt(producto.hue2),
            opacity: hov ? 1 : 0,
            transition: 'opacity 420ms ease',
          }} />
        )}

        {/* Rank overlay */}
        {rank !== undefined && (
          <span style={{
            position: 'absolute', top: 10, left: 10, zIndex: 3,
            width: 24, height: 24, borderRadius: '50%',
            background: 'rgba(15,23,42,0.80)', backdropFilter: 'blur(4px)',
            color: '#fff', fontSize: 10, fontWeight: 700,
            display: 'grid', placeItems: 'center',
            fontFamily: '"Geist Mono", monospace',
          }}>
            {rank}
          </span>
        )}

        {/* Badge top-left (solo si no hay rank, o usamos posición diferente) */}
        {producto.badge && rank === undefined && (() => {
          const { bg, color } = badgeColor(producto.badge)
          return (
            <span style={{
              position: 'absolute', top: 10, left: 10, zIndex: 3,
              height: 23, padding: '0 9px', borderRadius: 999,
              background: bg, color,
              fontSize: 10, fontWeight: 700, letterSpacing: '0.04em',
              display: 'inline-flex', alignItems: 'center',
              fontFamily: producto.badge.startsWith('−') ? '"Geist Mono", monospace' : 'inherit',
            }}>
              {producto.badge}
            </span>
          )
        })()}

        {/* Badge cuando hay rank (arriba a la derecha del rank) */}
        {producto.badge && rank !== undefined && (() => {
          const { bg, color } = badgeColor(producto.badge)
          return (
            <span style={{
              position: 'absolute', top: 10, left: 42, zIndex: 3,
              height: 23, padding: '0 9px', borderRadius: 999,
              background: bg, color,
              fontSize: 10, fontWeight: 700, letterSpacing: '0.04em',
              display: 'inline-flex', alignItems: 'center',
              fontFamily: producto.badge.startsWith('−') ? '"Geist Mono", monospace' : 'inherit',
            }}>
              {producto.badge}
            </span>
          )
        })()}

        {/* Stock bajo — badge abajo izquierda. Nunca la cantidad exacta (no
            se expone stock real al público, ver storefront.service.ts):
            solo avisa que queda poco, gateado por showLowStock. */}
        {producto.lowStock && (
          <span style={{
            position: 'absolute', bottom: 10, left: 10, zIndex: 3,
            height: 22, padding: '0 8px', borderRadius: 999,
            background: '#D97706',
            color: '#fff', fontSize: 10, fontWeight: 700,
            display: 'inline-flex', alignItems: 'center', gap: 4,
          }}>
            ⚡ Últimas unidades
          </span>
        )}

        {/* Acciones flotantes — bolsa (agregar) + ojo (ver detalle), apiladas
            verticalmente sobre la esquina superior derecha de la foto, tal
            cual la referencia. El ojo es decorativo (aria-hidden): la card
            entera ya navega al detalle con el click, no hace falta un
            segundo control clickeable que haga lo mismo.

            top/right en % (no px fijos) — bug real, reportado con captura:
            con la imagen ahora mucho más alta (aspectRatio 3:4, antes un
            alto chico en px), un offset fijo de 10px quedaba pegado
            literalmente en la esquina, sin ninguna relación con lo grande
            que se veía la foto. En % escala junto con la caja, se ve bien
            tanto en una card angosta de grilla como en una columna única de
            celular (mucho más alta). De paso, un poco más grandes (34→40px)
            — el pedido del dueño, "capaz que sea la solución": ayuda solas,
            se sienten menos como puntitos perdidos en la esquina. */}
        {mode !== 'SHOWCASE' && (
          <div style={{ position: 'absolute', top: '4%', right: '4%', zIndex: 3, display: 'flex', flexDirection: 'column', gap: 9 }}>
            <button
              className="orb-pcard-accion"
              onClick={handleAdd}
              disabled={!!ocupado}
              title="Agregar al carrito"
              aria-label="Agregar al carrito"
              style={{
                width: 40, height: 40, borderRadius: '50%', border: 'none', cursor: ocupado ? 'default' : 'pointer',
                background: agregado ? 'var(--color-success)' : '#fff',
                color: agregado ? '#fff' : 'var(--color-text)',
                display: 'grid', placeItems: 'center',
                opacity: ocupado ? 0.7 : 1,
                // box-shadow NO va acá — vive en .orb-pcard-accion
                // (globals.css) a propósito: tiene que apagarse junto con
                // el translateX en el estado "escondido" del hover, si no
                // se filtra fuera de la foto y se nota contra la card de al
                // lado (bug real, ver el comentario en globals.css).
                transition: 'transform 260ms ease, box-shadow 200ms ease, background 150ms, color 150ms',
              }}
              onMouseEnter={e => { if (!agregado) { e.currentTarget.style.background = 'var(--color-primary)'; e.currentTarget.style.color = '#fff' } }}
              onMouseLeave={e => { if (!agregado) { e.currentTarget.style.background = '#fff'; e.currentTarget.style.color = 'var(--color-text)' } }}
            >
              {agregado ? <Check size={17} strokeWidth={2.4} /> : <ShoppingCart size={17} strokeWidth={2} />}
            </button>
            <div
              aria-hidden
              className="orb-pcard-accion"
              style={{
                width: 40, height: 40, borderRadius: '50%',
                background: '#fff', color: 'var(--color-text)', display: 'grid', placeItems: 'center',
                transitionDelay: '60ms',
                // box-shadow: mismo motivo que el botón de arriba, ver el
                // comentario ahí y en globals.css.
                transition: 'transform 260ms ease, box-shadow 200ms ease',
              }}
            >
              <Eye size={17} strokeWidth={2} />
            </div>
          </div>
        )}

        {/* Ya tenés todo el stock disponible en el carrito — mismo criterio
            de avisar en vez de fallar en silencio que el resto del carrito. */}
        {sinMas && (
          <span style={{
            position: 'absolute', bottom: 10, left: 10, right: 10, zIndex: 3,
            padding: '6px 9px', borderRadius: 8,
            background: 'rgba(15,23,42,0.92)', color: '#fff',
            fontSize: 11, fontWeight: 600, textAlign: 'center', lineHeight: 1.3,
          }}>
            Ya tenés todo el stock disponible en tu carrito
          </span>
        )}
      </div>

      {/* ── Info ── Categoría en versalitas chicas, arriba del nombre — la
          referencia lo hace así y acá no existía ningún dato de categoría en
          la card (Producto.cat ya se traía, no se mostraba en ningún lado). */}
      <div style={{ paddingTop: 14 }}>
        {producto.cat && (
          <div style={{ fontSize: 10.5, fontWeight: 600, color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 4 }}>
            {producto.cat}
          </div>
        )}

        <div style={{
          fontSize: 15, fontWeight: 600, color: 'var(--color-text)', fontFamily: 'var(--font-heading, inherit)',
          lineHeight: 1.3, minHeight: 39,
          display: '-webkit-box', WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical', overflow: 'hidden',
          marginBottom: 6,
        }}>
          {producto.nombre}
        </div>

        {/* flexWrap: si en una columna muy angosta no entran precio +
            "Comprar ahora" en la misma línea (los dos ahora con flexShrink:0
            para que ninguno se corte a la mitad, ver más abajo), el botón
            cae a su propia línea entera en vez de superponerse o recortarse. */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, minHeight: 30, flexWrap: 'wrap' }}>
          {/* flexShrink:0 + nowrap en los dos precios — sin esto, en una
              columna angosta con "Comprar ahora" al lado, el precio podía
              partirse a la mitad ("$" en una línea, "70.500" en la
              siguiente): encontrado renderizando la card a 240px de ancho,
              no leyendo el código. El precio es el dato más importante de
              la card, nunca tiene que ceder espacio. */}
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 7, minWidth: 0, flexShrink: 0 }}>
            <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--color-text)', fontFamily: '"Geist Mono", monospace', whiteSpace: 'nowrap' }}>
              {fmt(producto.precio)}
            </span>
            {producto.precioAnt && (
              <span style={{ fontSize: 12, color: 'var(--color-muted)', textDecoration: 'line-through', fontFamily: '"Geist Mono", monospace', whiteSpace: 'nowrap' }}>
                {fmt(producto.precioAnt)}
              </span>
            )}
          </div>

          {/* "Comprar ahora" — la acción rápida de compra que ya tenía la
              card, reubicada como pill chico junto al precio (mismo lugar
              que el "Agregar" chico de la referencia) en vez del botón
              ancho de siempre. Sigue abriendo el picker de variante si
              corresponde (accionar() ya lo maneja, sin cambios ahí). */}
          {mode !== 'SHOWCASE' && (
            <button
              onClick={handleBuyNow}
              disabled={!!ocupado}
              className="ds-hover"
              style={{
                flexShrink: 0, height: 28, padding: '0 11px', borderRadius: 999,
                background: 'transparent', color: 'var(--color-text)',
                border: '1px solid var(--color-border)', fontSize: 11.5, fontWeight: 600,
                opacity: ocupado ? 0.7 : 1, whiteSpace: 'nowrap',
              }}
            >
              Comprar ahora
            </button>
          )}
        </div>

        {/* Los swatches de color NO se muestran acá abajo a propósito —
            pedido explícito del dueño: "sacá los íconos de colores abajo,
            la card queda muy larga". El layout 'list' (fila angosta, no
            compite por alto) los sigue mostrando sin cambios, ver más
            arriba. El swatch de color sigue funcionando igual como forma de
            PREVISUALIZAR una variante — pasar el mouse por la card entera
            ya cicla a la 2da foto real si existe (hoverMuestraSegunda);
            elegir el color de verdad sigue viviendo en el picker real al
            tocar "Agregar"/"Comprar ahora". */}
      </div>
    </div>

    {picker && (
      <VariantPickerModal
        producto={picker.detalle}
        hue={producto.hue}
        modo={picker.modo}
        onClose={() => setPicker(null)}
        onDone={agregadas => { const modo = picker.modo; setPicker(null); aplicarResultado(agregadas, modo) }}
      />
    )}
    </>
  )
}
