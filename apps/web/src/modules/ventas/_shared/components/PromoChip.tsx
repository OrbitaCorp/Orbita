// Chip "2x1 aplicado"/"3x2 aplicado" (RBT-675) — se usa en el carrito y el
// checkout del storefront cuando una línea tiene una promo BUY_X_PAY_Y
// ganando esa unidad (ver CartValidationItem.promoLabel en el backend). El
// color sale de un hash simple sobre `promoId` (mismo criterio que
// ProductoThumb/hueFromId en el resto del código) — con varias promos 2x1/
// 3x2 activas a la vez, cada una se ve en un color distinto y consistente
// (la MISMA promo siempre pinta igual), así una línea se identifica de un
// vistazo aunque el texto ("2x1") se repita entre promos distintas.
function hueDePromo(promoId: string): number {
  let h = 0
  for (let i = 0; i < promoId.length; i++) h = (h * 31 + promoId.charCodeAt(i)) % 360
  return h
}

interface Props {
  label: string
  promoId: string
}

export function PromoChip({ label, promoId }: Props) {
  const hue = hueDePromo(promoId)
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        fontSize: 10.5,
        fontWeight: 700,
        borderRadius: 999,
        padding: '3px 9px',
        color: '#fff',
        background: `oklch(0.52 0.14 ${hue})`,
        whiteSpace: 'nowrap',
      }}
    >
      {label} aplicado
    </span>
  )
}
