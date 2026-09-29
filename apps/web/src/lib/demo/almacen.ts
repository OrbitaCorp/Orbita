// ─── Lo que el visitante de la demo crea, edita o borra ─────────────────────
//
// Vive solo en su localStorage, por recurso ("products", "coupons"…), como
// una capa sobre los datos reales de la demo: los sembrados no se tocan
// nunca (ver lib/demo/modo.ts). Cada recurso guarda:
//
//   creados  → registros nuevos, completos, con un id `demo-…`
//   editados → cambios parciales sobre registros existentes, por id
//   borrados → ids a ocultar (sembrados o creados)
//
// Todo acceso a localStorage va con try/catch: en una ventana privada o con
// el almacenamiento bloqueado la demo sigue andando, solo que sin recordar.

export type Registro = { id: string } & Record<string, unknown>

export type Capa<T extends Registro = Registro> = {
  creados: T[]
  editados: Record<string, Partial<T>>
  borrados: string[]
}

// Subir la versión cuando cambie la forma de lo guardado o se resiembre la
// demo con ids distintos: lo viejo se descarta en vez de mezclarse mal.
const PREFIJO = 'orbita-demo:v1:'
const EVENTO = 'orbita-demo:cambio'

const vacia = <T extends Registro>(): Capa<T> => ({ creados: [], editados: {}, borrados: [] })

export function leerCapa<T extends Registro = Registro>(recurso: string): Capa<T> {
  try {
    const crudo = localStorage.getItem(PREFIJO + recurso)
    if (!crudo) return vacia<T>()
    const c = JSON.parse(crudo) as Partial<Capa<T>>
    return { creados: c.creados ?? [], editados: c.editados ?? {}, borrados: c.borrados ?? [] }
  } catch {
    return vacia<T>()
  }
}

function guardarCapa<T extends Registro>(recurso: string, capa: Capa<T>): void {
  try {
    localStorage.setItem(PREFIJO + recurso, JSON.stringify(capa))
  } catch {
    // Lleno (fotos grandes) o bloqueado: el cambio vale para esta pestaña
    // mientras no se recargue, no hay más que hacer.
  }
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(EVENTO, { detail: recurso }))
}

export function nuevoId(): string {
  const aleatorio = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`
  return `demo-${aleatorio}`
}

export function esIdLocal(id: string): boolean {
  return id.startsWith('demo-')
}

export function crear<T extends Registro>(recurso: string, registro: T): T {
  const capa = leerCapa<T>(recurso)
  capa.creados = [registro, ...capa.creados]
  guardarCapa(recurso, capa)
  return registro
}

/** Un creado se reemplaza entero; uno sembrado acumula el parche. */
export function editar<T extends Registro>(recurso: string, id: string, cambios: Partial<T>): void {
  const capa = leerCapa<T>(recurso)
  const i = capa.creados.findIndex((r) => r.id === id)
  if (i >= 0) capa.creados[i] = { ...capa.creados[i], ...cambios, id }
  else capa.editados[id] = { ...capa.editados[id], ...cambios }
  guardarCapa(recurso, capa)
}

export function borrar(recurso: string, id: string): void {
  const capa = leerCapa(recurso)
  capa.creados = capa.creados.filter((r) => r.id !== id)
  delete capa.editados[id]
  if (!capa.borrados.includes(id)) capa.borrados.push(id)
  guardarCapa(recurso, capa)
}

/** Lista real → lista vista por el visitante: creados primero, sin borrados, con parches. */
export function aplicarALista<T extends Registro>(recurso: string, reales: T[]): T[] {
  const capa = leerCapa<T>(recurso)
  const ocultos = new Set(capa.borrados)
  const sembrados = reales.filter((r) => !ocultos.has(r.id)).map((r) => (capa.editados[r.id] ? { ...r, ...capa.editados[r.id] } : r))
  return [...capa.creados.filter((r) => !ocultos.has(r.id)), ...sembrados]
}

/** Un registro por id: el creado local, o el real con su parche. null si lo borró. */
export function aplicarARegistro<T extends Registro>(recurso: string, id: string, real: T | null): T | null {
  const capa = leerCapa<T>(recurso)
  if (capa.borrados.includes(id)) return null
  const creado = capa.creados.find((r) => r.id === id)
  if (creado) return creado
  if (!real) return null
  return capa.editados[id] ? { ...real, ...capa.editados[id] } : real
}

/** Deja la demo como la sembró Órbita. */
export function reiniciarDemo(): void {
  try {
    const claves: string[] = []
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)
      if (k?.startsWith(PREFIJO)) claves.push(k)
    }
    claves.forEach((k) => localStorage.removeItem(k))
  } catch {
    // sin almacenamiento no hay nada que borrar
  }
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(EVENTO, { detail: '*' }))
}

/** ¿El visitante cambió algo? (para mostrar "Reiniciar demo" solo si hace falta) */
export function hayCambiosLocales(): boolean {
  try {
    for (let i = 0; i < localStorage.length; i++) {
      if (localStorage.key(i)?.startsWith(PREFIJO)) return true
    }
  } catch {
    // idem
  }
  return false
}

export function alCambiar(fn: (recurso: string) => void): () => void {
  const oyente = (e: Event) => fn((e as CustomEvent<string>).detail)
  window.addEventListener(EVENTO, oyente)
  return () => window.removeEventListener(EVENTO, oyente)
}
