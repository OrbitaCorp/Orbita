import { useEffect, useRef, useState } from 'react'
import { Zap } from 'lucide-react'
import { listMessageTemplates, type MessageTemplateRow } from '@/lib/api'
import { useAuth } from '@/hooks/useAuth'
import { resolverVariables } from '../mensajes/mock/mensajes.mock'

// Respuestas rápidas del chat de Instagram: las plantillas de mensaje del negocio (las mismas del módulo Mensajes),
// con {nombre} y {tienda} ya completados. Se elige una y queda en el campo de texto, lista para editar y mandar.
// Las variables de un pedido ({id}, {tracking}) quedan tal cual: acá no hay un pedido de por medio.

interface Props {
  /** Nombre de la persona con la que se chatea (para completar {nombre}). */
  cliente: string
  onElegir: (texto: string) => void
  disabled?: boolean
}

export function RespuestasRapidas({ cliente, onElegir, disabled }: Props) {
  const { user } = useAuth()
  const tienda = user && 'business' in user ? user.business.name : undefined
  const [abierto, setAbierto] = useState(false)
  const [plantillas, setPlantillas] = useState<MessageTemplateRow[] | null>(null)
  const [error, setError] = useState(false)
  const [busqueda, setBusqueda] = useState('')
  const raiz = useRef<HTMLDivElement>(null)

  // Las plantillas se piden la primera vez que se abre.
  useEffect(() => {
    if (!abierto || plantillas !== null) return
    let cancelado = false
    listMessageTemplates()
      .then((r) => { if (!cancelado) setPlantillas(r) })
      .catch(() => { if (!cancelado) { setPlantillas([]); setError(true) } })
    return () => { cancelado = true }
  }, [abierto, plantillas])

  // Se cierra al tocar afuera o con Escape.
  useEffect(() => {
    if (!abierto) return
    const afuera = (e: MouseEvent) => { if (raiz.current && !raiz.current.contains(e.target as Node)) setAbierto(false) }
    const tecla = (e: KeyboardEvent) => { if (e.key === 'Escape') setAbierto(false) }
    document.addEventListener('mousedown', afuera)
    document.addEventListener('keydown', tecla)
    return () => { document.removeEventListener('mousedown', afuera); document.removeEventListener('keydown', tecla) }
  }, [abierto])

  const q = busqueda.trim().toLowerCase()
  const visibles = (plantillas ?? []).filter((p) => !q || p.name.toLowerCase().includes(q) || p.text.toLowerCase().includes(q))

  return (
    <div className="rr-raiz" ref={raiz}>
      <style>{CSS}</style>
      <button type="button" className="rr-boton" disabled={disabled} aria-haspopup="listbox" aria-expanded={abierto} aria-label="Respuestas rápidas" onClick={() => setAbierto((a) => !a)}>
        <Zap size={19} strokeWidth={1.8} />
      </button>
      {abierto && (
        <div className="rr-popover" role="listbox" aria-label="Respuestas rápidas">
          <div className="rr-cabecera">
            <p className="rr-titulo">Respuestas rápidas</p>
            <input className="rr-buscar" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Buscar" aria-label="Buscar respuesta" autoFocus />
          </div>
          <ul className="rr-lista">
            {plantillas === null && <li className="rr-vacio">Cargando…</li>}
            {plantillas !== null && visibles.length === 0 && (
              <li className="rr-vacio">
                {error ? 'No se pudieron cargar las plantillas.'
                  : plantillas.length === 0 ? 'Todavía no tenés plantillas. Creálas en Mensajes → Plantillas y aparecen acá.'
                    : 'Ninguna plantilla coincide con la búsqueda.'}
              </li>
            )}
            {visibles.map((p) => {
              const texto = resolverVariables(p.text, { nombre: cliente, tienda })
              return (
                <li key={p.id}>
                  <button type="button" role="option" aria-selected={false} className="rr-opcion" onClick={() => { onElegir(texto); setAbierto(false); setBusqueda('') }}>
                    <span className="rr-nombre">{p.name}</span>
                    <span className="rr-texto">{texto}</span>
                  </button>
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </div>
  )
}

const CSS = `
.rr-raiz { position: relative; flex-shrink: 0; }
.rr-boton { width: 36px; height: 36px; padding: 0; border: none; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; cursor: pointer; background: transparent; color: var(--color-muted); transition: background-color 150ms, color 150ms; }
.rr-boton:hover:not(:disabled), .rr-boton[aria-expanded="true"] { color: var(--color-text); background: var(--color-surface-alt); }
.rr-boton:disabled { opacity: 0.4; cursor: not-allowed; }
.rr-boton:focus-visible, .rr-opcion:focus-visible { outline: 2px solid var(--color-primary); outline-offset: 2px; }
.rr-popover { position: absolute; bottom: calc(100% + 10px); left: -40px; z-index: 30; width: min(360px, calc(100vw - 32px)); background: var(--color-surface); border: 1px solid var(--color-border); border-radius: 14px; box-shadow: 0 12px 32px -12px rgba(15,23,42,0.35); overflow: hidden; }
.rr-cabecera { padding: 12px 12px 8px; border-bottom: 1px solid var(--color-border); }
.rr-titulo { margin: 0 0 8px; font-size: 12.5px; font-weight: 600; color: var(--color-text); }
.rr-buscar { width: 100%; height: 34px; padding: 0 10px; box-sizing: border-box; border: 1px solid var(--color-border); border-radius: 8px; background: var(--color-surface-alt); font: inherit; font-size: 16px; color: var(--color-text); outline: none; }
.rr-buscar:focus { border-color: var(--color-primary); background: var(--color-surface); }
.rr-lista { list-style: none; margin: 0; padding: 6px; max-height: 280px; overflow-y: auto; }
.rr-vacio { padding: 18px 12px; text-align: center; font-size: 12.5px; line-height: 1.5; color: var(--color-muted); }
.rr-opcion { width: 100%; display: flex; flex-direction: column; gap: 2px; padding: 8px 10px; border: none; border-radius: 9px; background: transparent; cursor: pointer; font: inherit; text-align: left; transition: background-color 150ms; }
.rr-opcion:hover { background: var(--color-surface-alt); }
.rr-nombre { font-size: 13px; font-weight: 600; color: var(--color-text); }
.rr-texto { font-size: 12.5px; line-height: 1.4; color: var(--color-muted); display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
@media (max-width: 760px) { .rr-popover { left: -80px; } }
@media (prefers-reduced-motion: reduce) { .rr-boton, .rr-opcion { transition: none; } }
`
