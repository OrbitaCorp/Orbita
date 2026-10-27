// Lo que comparten las páginas de configuración del panel de Alquileres: el
// envoltorio de página (880 px, encabezado y la hoja de estilos de las filas
// editables), los helpers de los formularios y las clases de las filas.
//
// Cada página es un formulario con borrador y botón de guardar: el estado
// arranca con lo del negocio (useState) y el panel la remonta con la key
// `${tipo}:${hidratado ? 'guardado' : 'fabrica'}` cuando el navegador lee lo
// guardado; sin eso, al recargar se quedaban con el negocio de ejemplo.
//
// En celular cada fila de campos se apila: nada de anchos fijos que no entren
// en 390 px.
import type { ReactNode } from 'react'
import { hhmm } from '@/lib/reservas/fechas'
import type { NegocioAlquiler } from '../../datos'
import { Encabezado } from '@/design-system/reservas/piezas'

/** Lo que recibe cada página: el negocio y cómo guardar (con el aviso que se muestra, y un detalle opcional debajo). */
export type Form = { negocio: NegocioAlquiler; onGuardar: (cambio: Partial<NegocioAlquiler>, aviso?: string, detalle?: string) => void }

/** Id para lo que se agrega. Solo desde handlers: Date.now no va en el render. */
export const idNuevo = (prefijo: string) => `${prefijo}${Date.now().toString(36)}`

/** Un número entero y positivo escrito a mano ("$ 45.000" → 45000). */
export const num = (s: string) => Math.max(0, Math.round(Number(s.replace(/\D/g, '')) || 0))

export const HORAS = Array.from({ length: 25 }, (_, i) => ({ id: i * 60, label: i === 24 ? '24:00' : hhmm(i * 60) }))

/** Comparar dos borradores: alcanza con el JSON, son objetos chicos y sin funciones. */
export const igual = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)

export const CSS_CONFIG = `
  .alc-fila { display: grid; grid-template-columns: minmax(0, 1.2fr) minmax(0, 1fr) 120px auto; gap: 8px; align-items: end; }
  .alc-fila--extra { grid-template-columns: minmax(0, 1fr) 140px auto; }
  .alc-fila--paquete { grid-template-columns: minmax(0, 1fr) 110px 140px auto; }
  .alc-fila--temporada { grid-template-columns: minmax(0, 1fr) 150px 150px 140px auto; }
  .alc-paquete { display: flex; flex-direction: column; gap: 8px; }
  .alc-dias { display: flex; flex-wrap: wrap; gap: 6px; }
  .alc-horas { display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 8px; }
  .alc-fotos { display: grid; grid-template-columns: repeat(auto-fill, minmax(96px, 1fr)); gap: 8px; }
  .alc-fotos img { width: 100%; aspect-ratio: 4 / 3; object-fit: cover; border-radius: 8px; display: block; background: var(--color-surface-alt); }
  .alc .als-mapa { aspect-ratio: 16 / 9; border-radius: 12px; overflow: hidden; border: 1px solid var(--color-border); background: var(--color-surface-alt); }
  .alc .als-mapa iframe { width: 100%; height: 100%; border: 0; display: block; }
  .alc-bloqueos { margin: 0 0 4px 28px; padding: 0; list-style: none; display: flex; flex-direction: column; gap: 4px; font-size: 13px; color: var(--color-body); }
  .alc-bloqueos li { display: flex; flex-wrap: wrap; gap: 2px 10px; }
  .alc-bloqueos li span:first-child { font-weight: 600; color: var(--color-text); }
  /* Una persona del equipo, un extra, una temporada: la fila de una lista con su sigla o su ícono, el texto y la acción. */
  .alc-persona { display: flex; align-items: center; gap: 12px; padding: 12px 0; }
  .alc-persona > .rv-item-cuerpo .rv-item-titulo { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; white-space: normal; }
  /* El calendario de temporadas: cada día lleva el tinte de la temporada que rige y, debajo, el precio de esa noche. */
  .alc-temp-dias { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); gap: 2px; }
  .alc-temp-dia { min-height: 48px; border-radius: 8px; padding: 5px 2px 4px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px; font-family: var(--rv-mono); font-size: 13px; color: var(--color-text); background: var(--alc-tinte, transparent); }
  .alc-temp-dia[data-fuera='true'] { opacity: 0.4; }
  .alc-temp-dia[data-hoy='true'] { box-shadow: inset 0 0 0 2px var(--color-primary); }
  .alc-temp-dia small { font-size: 9.5px; color: var(--color-muted); letter-spacing: -0.02em; }
  .alc-leyenda { display: flex; flex-wrap: wrap; gap: 8px 14px; margin-top: 10px; font-size: 12.5px; color: var(--color-body); }
  .alc-leyenda i { display: inline-block; width: 12px; height: 12px; border-radius: 3px; vertical-align: -2px; margin-right: 6px; border: 1px solid var(--color-border); }
  /* La vista previa de un mensaje: una pantalla de chat neutra, con los colores del panel (un solo acento, nada de WhatsApp verde). */
  .alc-chat { border: 1px solid var(--color-border); border-radius: 12px; background: var(--color-surface); overflow: hidden; align-self: start; }
  .alc-chat-cab { display: flex; align-items: center; gap: 10px; padding: 10px 12px; border-bottom: 1px solid var(--color-border); background: var(--color-bg); }
  .alc-chat-cab b { display: block; font-size: 13px; font-weight: 600; color: var(--color-text); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .alc-chat-cab small { display: block; font-size: 11px; color: var(--color-muted); }
  .alc-chat-fondo { padding: 14px 12px 16px; min-height: 140px; }
  .alc-burbuja { position: relative; max-width: 92%; margin-left: auto; padding: 8px 10px 20px; border-radius: 10px 2px 10px 10px; background: var(--color-primary-bg); color: var(--color-text); font-size: 13.5px; line-height: 1.45; white-space: pre-wrap; overflow-wrap: anywhere; }
  .alc-burbuja b { font-weight: 600; }
  .alc-burbuja > span:last-child { position: absolute; right: 8px; bottom: 4px; display: inline-flex; align-items: center; gap: 3px; font-family: var(--rv-mono); font-size: 10.5px; color: var(--color-body); }
  .alc-llaves { display: flex; flex-wrap: wrap; gap: 6px; }
  .alc-llaves > button { font-family: var(--rv-mono); font-weight: 500; }
  .alc-mensaje { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 300px); gap: 18px; align-items: start; }
  .alc-mp { display: flex; align-items: center; gap: 14px; flex-wrap: wrap; padding: 14px; border-radius: 10px; border: 1px solid var(--color-border); background: var(--color-surface); }
  .alc-mp > .rv-item-cuerpo { flex: 1 1 200px; }
  @media (max-width: 768px) {
    /* El nombre arriba con el tachito al lado (solo en un renglón quedaba huérfano) y el resto de a dos,
       en dos mitades enteras: con una tercera columna para el tachito, las fechas no entraban. */
    .alc-fila, .alc-fila--extra, .alc-fila--paquete, .alc-fila--temporada { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); padding-bottom: 14px; border-bottom: 1px solid var(--color-border); }
    .alc-fila > :first-child { grid-column: 1 / -1; grid-row: 1; margin-right: 54px; }
    .alc-fila > button:last-child { grid-column: 2; grid-row: 1; justify-self: end; }
    .alc-fila > :nth-child(2n + 2):not(:last-child) { grid-column: 1; }
    .alc-fila > :nth-child(2n + 3):not(:last-child) { grid-column: 2; }
    .alc-paquete { padding-bottom: 14px; border-bottom: 1px solid var(--color-border); }
    .alc-paquete .alc-fila { padding-bottom: 0; border-bottom: none; }
    .alc-bloqueos { margin-left: 0; }
    .alc-mensaje { grid-template-columns: minmax(0, 1fr); }
    .alc-temp-dia { min-height: 44px; font-size: 12.5px; }
  }
`

/**
 * Una página de configuración: 880 px, el encabezado estándar y la hoja de
 * las filas editables. El rótulo es el del modo ("Salón para eventos").
 */
export function PaginaForm({ rotulo, titulo, bajada, acciones, children, ancha }: { rotulo?: string; titulo: string; bajada?: ReactNode; acciones?: ReactNode; children: ReactNode; ancha?: boolean }) {
  return (
    <div className={`rv-pagina alc${ancha ? '' : ' rv-pagina--form'}`}>
      <style>{CSS_CONFIG}</style>
      <Encabezado rotulo={rotulo} titulo={titulo} bajada={bajada} acciones={acciones} />
      {children}
    </div>
  )
}
