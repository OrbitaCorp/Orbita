import type { Tema } from '@/modules/ventas/panel/avanzado/plantillas/tipos'

type Opciones = { name: string; isVisual: boolean; values: { value: string }[] }[] | undefined

/**
 * Las variantes que se pueden ELEGIR de un producto, como texto: "50 ml · 100 ml".
 * Sale de la primera opción con dos o más valores (Contenido, Talle, Color…);
 * una opción con un solo valor no es una elección y no se muestra. null = nada
 * para elegir. La usan todas las tarjetas (la clásica, la con tema y las propias
 * de cada plantilla) para que el comprador vea desde el listado que el producto
 * viene en más de un tamaño/talle/color (pedido 08/11, Cruzyparfums).
 *
 * `sinVisuales`: la tarjeta real ya dibuja los colores como círculos
 * (VariantesCard en ProductCard.tsx), así que ahí el texto es solo para
 * ml/talles y no repite los colores.
 */
export function textoVariantes(opciones: Opciones, sinVisuales = false): { nombre: string; texto: string } | null {
  const g = opciones?.find((o) => o.values.length > 1 && !(sinVisuales && o.isVisual))
  if (!g) return null
  return { nombre: g.name, texto: g.values.map((v) => v.value).join(' · ') }
}

// Una línea tenue debajo del nombre. Es un <span> en bloque para poder ir
// adentro del mismo elemento del nombre, sea el <div> de una tarjeta o el
// <span> de una fila, sin tocar el layout de cada plantilla. Una sola línea con
// "…" si no entra; el detalle completo queda en el title. Con tema toma su
// tipografía de cuerpo y su color tenue; sin tema, los tokens del storefront.
export function VariantesTexto({ de, t, sinVisuales, tamano = 12 }: {
  de?: { variantOptions?: Opciones } | null
  t?: Tema
  sinVisuales?: boolean
  tamano?: number
}) {
  const v = textoVariantes(de?.variantOptions, sinVisuales)
  if (!v) return null
  return (
    <span
      title={`${v.nombre}: ${v.texto}`}
      style={{
        display: 'block', marginTop: 3, fontFamily: t?.fb ?? 'inherit', fontSize: tamano, fontWeight: 400, lineHeight: 1.35,
        letterSpacing: 'normal', textTransform: 'none', color: t?.muted ?? 'var(--color-muted)',
        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
      }}
    >
      {v.texto}
    </span>
  )
}
