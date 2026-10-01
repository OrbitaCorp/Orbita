// Cuentas de los dibujos orbitales (dial del día, anillos de progreso).
// Ángulos en grados, medidos como en SVG: 0° apunta a la derecha y crecen en
// sentido horario (el eje Y va para abajo).

export const punto = (cx: number, cy: number, r: number, grados: number): [number, number] => {
  const a = (grados * Math.PI) / 180
  return [+(cx + r * Math.cos(a)).toFixed(2), +(cy + r * Math.sin(a)).toFixed(2)]
}

/** Arco de `desde` a `hasta` grados, en sentido horario. */
export function arco(cx: number, cy: number, r: number, desde: number, hasta: number) {
  const [x1, y1] = punto(cx, cy, r, desde)
  const [x2, y2] = punto(cx, cy, r, hasta)
  return `M ${x1} ${y1} A ${r} ${r} 0 ${hasta - desde > 180 ? 1 : 0} 1 ${x2} ${y2}`
}

/** Largo de un arco, para animar el trazo con stroke-dasharray. */
export const largoArco = (r: number, grados: number) => +((Math.PI * r * grados) / 180).toFixed(1)
