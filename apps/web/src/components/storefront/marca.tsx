// Cómo se dibuja la MARCA (logo + nombre) en el header de la tienda.
//
// Antes era un solo diseño fijo: ícono cuadrado + nombre en negrita al lado.
// Ahora el dueño elige QUÉ muestra (logo y nombre / solo logo / solo nombre) y
// CÓMO (un puñado de estilos por modo). Este archivo es la única fuente de
// verdad: lo importan el header real (StorefrontHeader) y el selector del panel
// (Apariencia), así que lo que se elige es lo que se ve.
//
// Dónde se guarda: `homeTemplateData.secciones._marca` = { modo, estilo }. Va
// ahí (y no en una columna o un campo nuevo del DTO) porque esa bolsa ya acepta
// texto plano sin tocar el backend — un campo nuevo obligaría a desplegar la
// API a mano. Ver `leerMarca` / `escribirMarca`.
//
// Solo aplica al header CLÁSICO: una plantilla de Home con header propio
// (Vidriera, Escaparate, Circuito…) conserva el suyo, es su identidad.

import type { CSSProperties, ReactNode } from 'react'

export type MarcaModo = 'ambos' | 'logo' | 'nombre'

export interface Marca {
  modo:   MarcaModo
  estilo: string
}

export interface MarcaEstiloDef { id: string; label: string; ayuda: string }

export const MARCA_MODOS: { id: MarcaModo; label: string; ayuda: string }[] = [
  { id: 'ambos',  label: 'Logo y nombre', ayuda: 'El logo junto al nombre de tu tienda.' },
  { id: 'logo',   label: 'Solo logo',     ayuda: 'Solo tu logo. Ideal si ya incluye el nombre.' },
  { id: 'nombre', label: 'Solo nombre',   ayuda: 'Solo el nombre, en texto. No hace falta subir un logo.' },
]

export const MARCA_ESTILOS: Record<MarcaModo, MarcaEstiloDef[]> = {
  ambos: [
    { id: 'lado',      label: 'Clásico',    ayuda: 'Logo a la izquierda, nombre al lado.' },
    { id: 'redondo',   label: 'Redondo',    ayuda: 'Logo en círculo, nombre al lado.' },
    { id: 'apilado',   label: 'Apilado',    ayuda: 'Logo arriba, nombre chico debajo.' },
    { id: 'espaciado', label: 'Espaciado',  ayuda: 'Nombre en mayúsculas, separado del logo por una línea.' },
  ],
  logo: [
    { id: 'normal',  label: 'Normal',  ayuda: 'Cuadrado con esquinas suaves.' },
    { id: 'grande',  label: 'Grande',  ayuda: 'Más alto y sin recortar: respeta la forma de tu logo.' },
    { id: 'redondo', label: 'Redondo', ayuda: 'Recortado en círculo.' },
  ],
  nombre: [
    { id: 'negrita',    label: 'Negrita',    ayuda: 'El de siempre: claro y contundente.' },
    { id: 'mayusculas', label: 'Mayúsculas', ayuda: 'Todo en mayúsculas, bien pesado.' },
    { id: 'espaciado',  label: 'Espaciado',  ayuda: 'Mayúsculas finas y muy separadas. Elegante.' },
    { id: 'italica',    label: 'Cursiva',    ayuda: 'Más grande e inclinada, con carácter.' },
  ],
}

export const MARCA_DEFAULT: Marca = { modo: 'ambos', estilo: 'lado' }

export const estiloPorDefecto = (modo: MarcaModo): string => MARCA_ESTILOS[modo][0].id

/** Normaliza cualquier cosa guardada (dato viejo, modo/estilo que ya no existe) a una Marca válida. */
export function marcaValida(modo?: string | null, estilo?: string | null): Marca {
  const m = MARCA_MODOS.find(x => x.id === modo)?.id ?? 'ambos'
  const e = MARCA_ESTILOS[m].find(x => x.id === estilo)?.id ?? estiloPorDefecto(m)
  return { modo: m, estilo: e }
}

const CLAVE = '_marca'

/** Lee la marca de `homeTemplateData.secciones`. Sin nada guardado = el diseño de siempre. */
export function leerMarca(secciones?: Record<string, Record<string, string>> | null): Marca {
  const s = secciones?.[CLAVE]
  return marcaValida(s?.modo, s?.estilo)
}

export const esMarcaDefault = (m: Marca): boolean => m.modo === MARCA_DEFAULT.modo && m.estilo === MARCA_DEFAULT.estilo

/** Devuelve las secciones con `_marca` puesto (o sacado, si es el default: no se guarda ruido). */
export function escribirMarca(secciones: Record<string, Record<string, string>>, marca: Marca): Record<string, Record<string, string>> {
  const { [CLAVE]: _viejo, ...resto } = secciones
  void _viejo
  return esMarcaDefault(marca) ? resto : { ...resto, [CLAVE]: { modo: marca.modo, estilo: marca.estilo } }
}

/** Las secciones de la plantilla SIN la clave interna de la marca (para editarlas sin mezclar). */
export function sinMarca(secciones: Record<string, Record<string, string>>): Record<string, Record<string, string>> {
  const { [CLAVE]: _m, ...resto } = secciones
  void _m
  return resto
}

// ─── Render ────────────────────────────────────────────────────────────────

const TXT = 'var(--color-text)'
const FUENTE = 'var(--font-heading, inherit)'

function estiloNombre(estilo: string): CSSProperties {
  switch (estilo) {
    case 'mayusculas': return { fontSize: 20, fontWeight: 800, letterSpacing: '0.02em', textTransform: 'uppercase', lineHeight: 1.1 }
    case 'espaciado':  return { fontSize: 13.5, fontWeight: 600, letterSpacing: '0.28em', textTransform: 'uppercase', lineHeight: 1.2 }
    case 'italica':    return { fontSize: 22, fontWeight: 600, fontStyle: 'italic', letterSpacing: '-0.01em', lineHeight: 1.15 }
    default:           return { fontSize: 18, fontWeight: 700, letterSpacing: '-0.02em', lineHeight: 1.15 }
  }
}

interface MarcaVistaProps {
  marca:     Marca
  nombre:    string
  logoUrl?:  string | null
  /** Se dibuja cuando `modo` pide logo y el negocio no subió ninguno (el degradé genérico de siempre). */
  logoGenerico: ReactNode
  centrado?: boolean
}

export function MarcaVista({ marca, nombre, logoUrl, logoGenerico, centrado }: MarcaVistaProps) {
  const { modo, estilo } = marca
  const alinear: CSSProperties = centrado ? { textAlign: 'center' } : {}

  const texto = (est: string, extra?: CSSProperties) => (
    <div style={{ color: TXT, fontFamily: FUENTE, ...estiloNombre(est), ...alinear, ...extra }}>{nombre}</div>
  )

  // "Solo logo" sin logo subido: no se puede dibujar nada útil (un degradé
  // suelto no dice qué tienda es) — cae al nombre en texto.
  if (modo === 'nombre' || (modo === 'logo' && !logoUrl)) {
    return texto(modo === 'nombre' ? estilo : 'negrita')
  }

  if (modo === 'logo') {
    if (estilo === 'grande') {
      return <img src={logoUrl!} alt={nombre} style={{ height: 48, width: 'auto', maxWidth: 190, objectFit: 'contain', flexShrink: 0 }} />
    }
    const lado = estilo === 'redondo' ? 42 : 38
    return <img src={logoUrl!} alt={nombre} style={{ width: lado, height: lado, borderRadius: estilo === 'redondo' ? '50%' : 10, flexShrink: 0, objectFit: 'cover' }} />
  }

  // modo === 'ambos'
  const icono = (lado: number, radio: number | string) => logoUrl
    ? <img src={logoUrl} alt="" style={{ width: lado, height: lado, borderRadius: radio, flexShrink: 0, objectFit: 'cover' }} />
    : <div style={{ width: lado, height: lado, borderRadius: radio, flexShrink: 0, overflow: 'hidden', display: 'grid', placeItems: 'center' }}>{logoGenerico}</div>

  if (estilo === 'apilado') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
        {icono(34, 8)}
        <div style={{ color: TXT, fontFamily: FUENTE, fontSize: 10.5, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', lineHeight: 1, textAlign: 'center', maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{nombre}</div>
      </div>
    )
  }
  if (estilo === 'espaciado') {
    return (
      <>
        {icono(34, 8)}
        <span aria-hidden="true" style={{ width: 1, height: 24, background: 'var(--color-border-strong)', flexShrink: 0 }} />
        {texto('espaciado')}
      </>
    )
  }
  return (
    <>
      {icono(estilo === 'redondo' ? 40 : 38, estilo === 'redondo' ? '50%' : 10)}
      {texto('negrita', { fontSize: 16 })}
    </>
  )
}
