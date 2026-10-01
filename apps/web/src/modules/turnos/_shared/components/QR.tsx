// Código QR real (escaneable) dibujado en SVG, sin dependencias.
// Implementa lo mínimo del estándar ISO/IEC 18004 para textos cortos: modo
// byte, corrección de errores nivel L, versiones 1 a 4 (hasta 78 bytes) y
// máscara 0. Alcanza para links de reserva y códigos de turno; si algún día
// hace falta algo más largo, reemplazar por una librería.
// Regla de diseño de Órbita Turnos: los códigos se muestran siempre como QR,
// nunca como código de barras.

// Capacidad en codewords de datos y de corrección (nivel L, un solo bloque).
const VERSIONES = [
  { v: 1, datos: 19, ec: 7 },
  { v: 2, datos: 34, ec: 10 },
  { v: 3, datos: 55, ec: 15 },
  { v: 4, datos: 80, ec: 20 },
]

function mulGF(x: number, y: number) {
  let z = 0
  for (let i = 7; i >= 0; i--) {
    z = (z << 1) ^ ((z >>> 7) * 0x11d)
    z ^= ((y >>> i) & 1) * x
  }
  return z & 0xff
}

function divisorRS(grado: number) {
  const r = new Array<number>(grado).fill(0)
  r[grado - 1] = 1
  let raiz = 1
  for (let i = 0; i < grado; i++) {
    for (let j = 0; j < grado; j++) {
      r[j] = mulGF(r[j], raiz)
      if (j + 1 < grado) r[j] ^= r[j + 1]
    }
    raiz = mulGF(raiz, 0x02)
  }
  return r
}

function restoRS(datos: number[], divisor: number[]) {
  const r = new Array<number>(divisor.length).fill(0)
  for (const b of datos) {
    const f = b ^ (r.shift() as number)
    r.push(0)
    for (let i = 0; i < r.length; i++) r[i] ^= mulGF(divisor[i], f)
  }
  return r
}

/** Devuelve la matriz del QR (true = módulo oscuro). */
export function matrizQR(texto: string): boolean[][] {
  const bytes = Array.from(new TextEncoder().encode(texto))
  const conf = VERSIONES.find(x => 4 + 8 + bytes.length * 8 <= x.datos * 8)
  if (!conf) throw new Error('Texto demasiado largo para el QR (máx. 78 bytes)')
  const { v, datos, ec } = conf

  // Bits de datos: modo byte (0100) + largo (8 bits) + bytes + terminador + relleno.
  const bits: number[] = []
  const poner = (val: number, n: number) => { for (let i = n - 1; i >= 0; i--) bits.push((val >>> i) & 1) }
  poner(0b0100, 4)
  poner(bytes.length, 8)
  bytes.forEach(b => poner(b, 8))
  poner(0, Math.min(4, datos * 8 - bits.length))
  poner(0, (8 - (bits.length % 8)) % 8)
  const cw: number[] = []
  for (let i = 0; i < bits.length; i += 8) cw.push(parseInt(bits.slice(i, i + 8).join(''), 2))
  for (let k = 0; cw.length < datos; k++) cw.push(k % 2 ? 0x11 : 0xec)
  const todo = [...cw, ...restoRS(cw, divisorRS(ec))]

  const n = 17 + 4 * v
  const m: boolean[][] = Array.from({ length: n }, () => new Array<boolean>(n).fill(false))
  const fn: boolean[][] = Array.from({ length: n }, () => new Array<boolean>(n).fill(false))
  const set = (x: number, y: number, oscuro: boolean) => { m[y][x] = oscuro; fn[y][x] = true }

  // Patrones de ubicación (con separador) y de sincronización.
  for (let i = 0; i < n; i++) { set(6, i, i % 2 === 0); set(i, 6, i % 2 === 0) }
  for (const [cx, cy] of [[3, 3], [n - 4, 3], [3, n - 4]]) {
    for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) {
      const x = cx + dx, y = cy + dy
      if (x < 0 || y < 0 || x >= n || y >= n) continue
      const d = Math.max(Math.abs(dx), Math.abs(dy))
      set(x, y, d !== 2 && d !== 4)
    }
  }
  // Patrón de alineación (versiones 2 a 4 tienen uno solo, abajo a la derecha).
  if (v >= 2) {
    const c = n - 7
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) set(c + dx, c + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1)
  }
  // Información de formato: nivel L (01) + máscara 0, con su BCH y la máscara fija.
  const dataFmt = (1 << 3) | 0
  let rem = dataFmt
  for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537)
  const fmt = ((dataFmt << 10) | rem) ^ 0x5412
  const bit = (i: number) => ((fmt >>> i) & 1) !== 0
  for (let i = 0; i <= 5; i++) set(8, i, bit(i))
  set(8, 7, bit(6)); set(8, 8, bit(7)); set(7, 8, bit(8))
  for (let i = 9; i < 15; i++) set(14 - i, 8, bit(i))
  for (let i = 0; i < 8; i++) set(n - 1 - i, 8, bit(i))
  for (let i = 8; i < 15; i++) set(8, n - 15 + i, bit(i))
  set(8, n - 8, true) // módulo oscuro fijo

  // Datos en zigzag desde abajo a la derecha, salteando la columna 6.
  let i = 0
  for (let der = n - 1; der >= 1; der -= 2) {
    if (der === 6) der = 5
    for (let vert = 0; vert < n; vert++) {
      for (let j = 0; j < 2; j++) {
        const x = der - j
        const arriba = ((der + 1) & 2) === 0
        const y = arriba ? n - 1 - vert : vert
        if (!fn[y][x] && i < todo.length * 8) {
          m[y][x] = ((todo[i >>> 3] >>> (7 - (i & 7))) & 1) !== 0
          i++
        }
      }
    }
  }
  // Máscara 0: invierte los módulos de datos donde (x + y) es par.
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (!fn[y][x] && (x + y) % 2 === 0) m[y][x] = !m[y][x]
  return m
}

interface Props {
  texto: string
  size?: number
  /** Color de los módulos; el fondo va siempre claro para que se pueda escanear. */
  color?: string
  fondo?: string
  titulo?: string
}

export function QR({ texto, size = 160, color = '#111111', fondo = '#FFFFFF', titulo }: Props) {
  const m = matrizQR(texto)
  const n = m.length
  const margen = 2
  const total = n + margen * 2
  let d = ''
  m.forEach((fila, y) => fila.forEach((on, x) => { if (on) d += `M${x + margen} ${y + margen}h1v1h-1z` }))
  return (
    <svg viewBox={`0 0 ${total} ${total}`} width={size} height={size} role="img" aria-label={titulo ?? `Código QR: ${texto}`} shapeRendering="crispEdges" style={{ display: 'block', background: fondo, borderRadius: 8 }}>
      <path d={d} fill={color} />
    </svg>
  )
}
