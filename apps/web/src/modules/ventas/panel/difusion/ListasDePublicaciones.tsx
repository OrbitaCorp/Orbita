import { CalendarClock, ExternalLink, FileText, Play, RotateCcw } from 'lucide-react'
import { Button } from '@/design-system/components/Button'
import type { InstagramPublicacion } from '@/lib/api'
import { cuando } from './fechaLocal'

// Lo que Órbita ya publicó, lo que está programado y lo que quedó a medias, en tres pestañas debajo del
// compositor. Cada fila dice qué es, cuándo sale o salió, y ofrece lo que se puede hacer con ella.

export type PestanaDePublicaciones = 'historial' | 'programadas' | 'borradores'

interface Props {
  publicaciones: InstagramPublicacion[]
  pestana: PestanaDePublicaciones
  onPestana: (p: PestanaDePublicaciones) => void
  /** Cargar un borrador o una programada en el compositor para seguir editándola. */
  onRetomar: (p: InstagramPublicacion) => void
  onPasarABorrador: (p: InstagramPublicacion) => void
  onDescartar: (p: InstagramPublicacion) => void
  /** Tomar el producto y el texto de una publicación hecha como punto de partida de otra. */
  onUsarComoBase: (p: InstagramPublicacion) => void
}

const nombreDelTipo = (p: InstagramPublicacion): string => {
  if (p.elementos.length > 1) return `Carrusel de ${p.elementos.length}`
  if (p.elementos.length === 0) return 'Sin fotos todavía'
  return p.elementos[0] === 'video' ? 'Reel' : 'Foto'
}

const tituloDe = (p: InstagramPublicacion): string => p.productName ?? (p.caption.split('\n')[0].slice(0, 60) || 'Publicación sin texto')

export function ListasDePublicaciones({ publicaciones, pestana, onPestana, onRetomar, onPasarABorrador, onDescartar, onUsarComoBase }: Props) {
  const programadas = publicaciones.filter((p) => p.estado === 'SCHEDULED').sort((a, b) => String(a.programadaPara).localeCompare(String(b.programadaPara)))
  const borradores = publicaciones.filter((p) => p.estado === 'DRAFT')
  const historial = publicaciones.filter((p) => p.estado !== 'SCHEDULED' && p.estado !== 'DRAFT')
  const filas = pestana === 'programadas' ? programadas : pestana === 'borradores' ? borradores : historial

  const pestanas: { clave: PestanaDePublicaciones; titulo: string; cuenta: number }[] = [
    { clave: 'historial', titulo: 'Publicadas', cuenta: historial.length },
    { clave: 'programadas', titulo: 'Programadas', cuenta: programadas.length },
    { clave: 'borradores', titulo: 'Borradores', cuenta: borradores.length },
  ]
  const vacio: Record<PestanaDePublicaciones, string> = {
    historial: 'Todavía no publicaste nada desde Órbita. Lo que subas aparece acá.',
    programadas: 'No tenés publicaciones programadas. Elegí "Programar" en el paso 3 para que una salga sola a la hora que quieras.',
    borradores: 'No tenés borradores. Con "Guardar borrador" dejás una publicación a medias para seguirla después.',
  }

  return (
    <section className="lpub-raiz" aria-label="Tus publicaciones">
      <style>{CSS}</style>
      <div className="lpub-pestanas" role="tablist" aria-label="Tus publicaciones">
        {pestanas.map((t) => (
          <button
            key={t.clave}
            type="button"
            role="tab"
            aria-selected={pestana === t.clave}
            className={`lpub-pestana${pestana === t.clave ? ' lpub-pestana-activa' : ''}`}
            onClick={() => onPestana(t.clave)}
          >
            {t.titulo} <span className="lpub-cuenta">{t.cuenta}</span>
          </button>
        ))}
      </div>

      {filas.length === 0 ? (
        <p className="lpub-vacio" role="tabpanel">{vacio[pestana]}</p>
      ) : (
        <ul className="lpub-lista" role="tabpanel">
          {filas.map((p) => (
            <li key={p.id} className="lpub-fila">
              <span className="lpub-miniatura">
                {p.miniatura ? <img src={p.miniatura} alt="" /> : <Play size={16} aria-hidden style={{ margin: 'auto', color: 'var(--color-muted)' }} />}
              </span>
              <div className="lpub-texto">
                <p className="lpub-titulo">{tituloDe(p)}</p>
                <p className="lpub-sub">
                  {nombreDelTipo(p)} ·{' '}
                  {p.estado === 'SCHEDULED' && p.programadaPara ? (
                    <span className="lpub-programada"><CalendarClock size={12} aria-hidden /> Sale el {cuando(p.programadaPara)}</span>
                  ) : p.estado === 'DRAFT' ? 'Borrador'
                    : new Date(p.createdAt).toLocaleString('es-AR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                </p>
                {p.estado === 'FAILED' && p.error && <p className="lpub-error">{p.error}</p>}
              </div>

              <div className="lpub-acciones">
                {p.estado === 'PUBLISHED' && p.permalink && (
                  <a className="lpub-enlace" href={p.permalink} target="_blank" rel="noopener noreferrer">Ver en Instagram <ExternalLink size={13} aria-hidden /></a>
                )}
                {(p.estado === 'PROCESSING' || p.estado === 'PUBLISHING') && <span className="lpub-estado">Procesando…</span>}
                {p.estado === 'FAILED' && <span className="lpub-estado lpub-estado-fallo">No salió</span>}
                {(p.estado === 'PUBLISHED' || p.estado === 'FAILED') && (
                  <Button size="sm" variant="ghost" onClick={() => onUsarComoBase(p)} icon={<RotateCcw size={13} aria-hidden />}>Usar como base</Button>
                )}
                {p.estado === 'SCHEDULED' && (
                  <>
                    <Button size="sm" variant="secondary" onClick={() => onRetomar(p)}>Editar</Button>
                    <Button size="sm" variant="ghost" onClick={() => onPasarABorrador(p)}>Pasar a borrador</Button>
                    <Button size="sm" variant="ghost" onClick={() => onDescartar(p)}>Cancelar</Button>
                  </>
                )}
                {p.estado === 'DRAFT' && (
                  <>
                    <Button size="sm" variant="secondary" onClick={() => onRetomar(p)} icon={<FileText size={13} aria-hidden />}>Seguir</Button>
                    <Button size="sm" variant="ghost" onClick={() => onDescartar(p)}>Eliminar</Button>
                  </>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

const CSS = `
.lpub-raiz { margin-top: 8px; }
.lpub-pestanas { display: flex; gap: 4px; margin-bottom: 14px; border-bottom: 1px solid var(--color-border); overflow-x: auto; }
.lpub-pestana { display: inline-flex; align-items: center; gap: 6px; min-height: 40px; padding: 0 14px; margin-bottom: -1px; border: none; border-bottom: 2px solid transparent; background: transparent; cursor: pointer; font: inherit; font-size: 14px; font-weight: 500; color: var(--color-muted); white-space: nowrap; transition: color 150ms, border-color 150ms; }
.lpub-pestana:hover { color: var(--color-text); }
.lpub-pestana-activa, .lpub-pestana-activa:hover { color: var(--color-text); font-weight: 600; border-bottom-color: var(--color-text); }
.lpub-pestana:focus-visible { outline: 2px solid var(--color-primary); outline-offset: -2px; border-radius: 6px; }
.lpub-cuenta { min-width: 20px; height: 20px; padding: 0 6px; box-sizing: border-box; border-radius: 10px; display: inline-flex; align-items: center; justify-content: center; font-size: 11.5px; font-weight: 600; font-variant-numeric: tabular-nums; color: var(--color-muted); background: var(--color-surface-alt); }

.lpub-vacio { margin: 0; padding: 22px; text-align: center; font-size: 13px; line-height: 1.55; color: var(--color-muted); background: var(--color-surface); border: 1px dashed var(--color-border); border-radius: 16px; }
.lpub-lista { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 10px; }
.lpub-fila { display: flex; align-items: center; gap: 12px; padding: 12px 14px; background: var(--color-surface); border: 1px solid var(--color-border); border-radius: 16px; box-shadow: var(--shadow-card); }
.lpub-miniatura { width: 46px; height: 46px; flex-shrink: 0; overflow: hidden; border-radius: 10px; border: 1px solid var(--color-border); background: #fff; display: inline-flex; }
.lpub-miniatura img { width: 100%; height: 100%; object-fit: contain; }
.lpub-texto { flex: 1; min-width: 0; }
.lpub-titulo { margin: 0; font-size: 14px; font-weight: 600; color: var(--color-text); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.lpub-sub { margin: 2px 0 0; font-size: 12.5px; color: var(--color-muted); }
.lpub-programada { display: inline-flex; align-items: center; gap: 4px; color: var(--color-text); font-weight: 500; }
.lpub-error { margin: 4px 0 0; font-size: 12.5px; line-height: 1.4; color: var(--color-error); }
.lpub-acciones { display: flex; align-items: center; justify-content: flex-end; flex-wrap: wrap; gap: 6px; flex-shrink: 0; }
.lpub-enlace { display: inline-flex; align-items: center; gap: 4px; font-size: 13px; font-weight: 500; color: var(--color-primary); text-decoration: none; }
.lpub-enlace:hover { text-decoration: underline; text-underline-offset: 3px; }
.lpub-estado { font-size: 12.5px; color: var(--color-muted); }
.lpub-estado-fallo { color: var(--color-error); }

@media (max-width: 640px) {
  .lpub-fila { flex-wrap: wrap; }
  .lpub-texto { flex-basis: calc(100% - 60px); }
  .lpub-acciones { width: 100%; justify-content: flex-start; }
}
@media (prefers-reduced-motion: reduce) { .lpub-pestana { transition: none; } }
`
