import { useState } from 'react'
import { platformApi, type TutorialDeLaLista, type TutorialEstado } from '@/lib/platform/api'
import type { ToastVariant } from '@/design-system/components/Toast'
import { useFetch, Card, Chip, Loader, ErrorBox, Empty, btnGhostSm, btnPrimary, inputStyle } from './ui'

// La lista de tutoriales: qué hay y qué falta. La actualiza el Claude de cada persona por el conector (marca «en proceso» al
// empezar uno, y «en revisión» / «hecho» salen solos al registrar y aprobar su video); acá se mira y, si hace falta, se corrige.
// Se corrige de a uno (el selector de cada fila) o de a varios: se tildan filas y una barra flotante pide confirmar el cambio.
// Apps/api/src/marketing/videos/tutoriales.service.ts.

type Aviso = { variant: ToastVariant; title: string; description?: string }
// «En revisión» no se elige a mano: sale solo al registrar el video de ese tutorial.
type EstadoManual = Exclude<TutorialEstado, 'EN_REVISION'>

const ESTADO: Record<TutorialEstado, { texto: string; tono: 'gray' | 'amber' | 'blue' | 'green' }> = {
  FALTA: { texto: 'Falta', tono: 'gray' },
  EN_PROCESO: { texto: 'En proceso', tono: 'amber' },
  EN_REVISION: { texto: 'En revisión', tono: 'blue' },
  HECHO: { texto: 'Hecho', tono: 'green' },
}
const OPCIONES: { id: EstadoManual; texto: string }[] = [
  { id: 'FALTA', texto: 'Falta' },
  { id: 'EN_PROCESO', texto: 'En proceso' },
  { id: 'HECHO', texto: 'Hecho' },
]

const casilla = { width: 17, height: 17, margin: 0, flexShrink: 0, cursor: 'pointer', accentColor: 'var(--color-primary)' } as const
// Un clic en un control de la fila (el selector, la casilla) no debe contar como clic en la fila.
const esControl = (el: EventTarget) => !!(el as HTMLElement).closest('select, input, button, a, label')

export function ListaDeTutoriales({ puedeEditar, setAviso }: { puedeEditar: boolean; setAviso: (a: Aviso) => void }) {
  const [tick, setTick] = useState(0)
  const { data, loading, error } = useFetch(() => platformApi.tutorialesLista(), [tick])
  const [soloFaltan, setSoloFaltan] = useState(false)
  const [seleccion, setSeleccion] = useState<Set<string>>(new Set())
  const [destino, setDestino] = useState<EstadoManual>('HECHO')
  const [guardando, setGuardando] = useState<Set<string>>(new Set())
  const [aplicando, setAplicando] = useState(false)

  const recargar = () => setTick((n) => n + 1)
  const marcar = (id: string, on: boolean) => setGuardando((prev) => {
    const sig = new Set(prev)
    if (on) sig.add(id)
    else sig.delete(id)
    return sig
  })

  // Un cambio de a uno. La lista NO se vuelve a dibujar de cero: se pide de nuevo por detrás y la fila cambia en su lugar.
  const cambiar = async (t: TutorialDeLaLista, estado: EstadoManual) => {
    marcar(t.id, true)
    try {
      await platformApi.tutorialActualizar(t.id, { estado })
      recargar()
    } catch (e) {
      setAviso({ variant: 'error', title: 'No se pudo actualizar', description: e instanceof Error ? e.message : undefined })
    } finally {
      marcar(t.id, false)
    }
  }

  const visibles = (data?.tutoriales ?? []).filter((t) => !(soloFaltan && t.estado === 'HECHO'))
  const grupos = new Map<string, TutorialDeLaLista[]>()
  for (const t of visibles) grupos.set(t.grupo, [...(grupos.get(t.grupo) ?? []), t])
  const r = data?.resumen

  // Solo se tildan los que se pueden cambiar a mano y se ven ahora: si uno pasa a «en revisión» o lo tapa el filtro, se suelta solo.
  const seleccionables = visibles.filter((t) => t.estado !== 'EN_REVISION')
  const elegidos = seleccionables.filter((t) => seleccion.has(t.id))
  const todosElegidos = seleccionables.length > 0 && elegidos.length === seleccionables.length

  const alternar = (id: string) => setSeleccion((prev) => {
    const sig = new Set(prev)
    if (sig.has(id)) sig.delete(id)
    else sig.add(id)
    return sig
  })
  // Tilda o destilda varios juntos (todos, o un grupo): si ya están todos tildados los suelta, si no, completa los que faltan.
  const alternarVarios = (items: TutorialDeLaLista[]) => {
    const ids = items.filter((t) => t.estado !== 'EN_REVISION').map((t) => t.id)
    setSeleccion((prev) => {
      const sig = new Set(prev)
      if (ids.every((id) => sig.has(id))) ids.forEach((id) => sig.delete(id))
      else ids.forEach((id) => sig.add(id))
      return sig
    })
  }

  // Aplicar a todos los tildados, de a uno y en orden. Los que fallan quedan tildados para reintentar.
  const confirmar = async () => {
    setAplicando(true)
    const fallidos = new Set<string>()
    let motivo: string | undefined
    for (const t of elegidos) {
      try {
        await platformApi.tutorialActualizar(t.id, { estado: destino })
      } catch (e) {
        fallidos.add(t.id)
        motivo ??= e instanceof Error ? e.message : undefined
      }
    }
    const hechos = elegidos.length - fallidos.size
    setSeleccion(fallidos)
    setAplicando(false)
    recargar()
    if (fallidos.size === 0) setAviso({ variant: 'success', title: `${hechos} ${hechos === 1 ? 'tutorial pasó' : 'tutoriales pasaron'} a «${ESTADO[destino].texto}»` })
    else setAviso({ variant: 'error', title: `No se pudieron actualizar ${fallidos.size} de ${elegidos.length}`, description: motivo })
  }

  return (
    <Card
      title="Lista de tutoriales"
      subtitle="Qué hay y qué falta. Tu Claude la actualiza solo: marca los que empieza y registra los que termina."
      action={(
        <span style={{ display: 'inline-flex', gap: 8, flexWrap: 'wrap' }}>
          <button type="button" onClick={() => { setSoloFaltan((v) => !v) }} aria-pressed={soloFaltan} className="ds-hover" style={{ ...btnGhostSm, height: 34 }}>{soloFaltan ? 'Ver todos' : 'Ver solo lo que falta'}</button>
          <button type="button" onClick={recargar} className="ds-hover" style={{ ...btnGhostSm, height: 34 }}>{loading && data ? 'Actualizando…' : 'Actualizar'}</button>
        </span>
      )}
    >
      {/* El Loader es solo para la primera carga: al recargar la lista se queda en pantalla, con su scroll y su selección. */}
      {!data && loading ? <Loader /> : !data ? (
        <ErrorBox msg="No se pudo leer la lista de tutoriales." action={<button type="button" onClick={recargar} style={btnGhostSm}>Reintentar</button>} />
      ) : (
        <>
          {r && (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16, alignItems: 'center' }}>
              <strong style={{ fontSize: 14, color: 'var(--color-text)' }}>{r.hechos} de {r.total} hechos</strong>
              <Chip text={`${r.enRevision} en revisión`} tone="blue" />
              <Chip text={`${r.enProceso} en proceso`} tone="amber" />
              <Chip text={`${r.faltan} faltan`} tone="gray" />
              {puedeEditar && seleccionables.length > 1 && (
                <label style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 600, color: 'var(--color-text)', cursor: 'pointer' }}>
                  <input type="checkbox" checked={todosElegidos} onChange={() => alternarVarios(seleccionables)} style={casilla} />
                  {todosElegidos ? 'Quitar la selección' : `Seleccionar todos (${seleccionables.length})`}
                </label>
              )}
            </div>
          )}
          {grupos.size === 0 ? <Empty text="No hay tutoriales para mostrar." /> : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {[...grupos.entries()].map(([grupo, items]) => {
                const delGrupo = items.filter((t) => t.estado !== 'EN_REVISION')
                const grupoCompleto = delGrupo.length > 0 && delGrupo.every((t) => seleccion.has(t.id))
                return (
                  <section key={grupo} aria-label={grupo}>
                    <h3 style={{ margin: '0 0 6px', padding: '0 10px', display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, fontWeight: 600, color: 'var(--color-text)' }}>
                      {puedeEditar && delGrupo.length > 0 && (
                        <input type="checkbox" checked={grupoCompleto} onChange={() => alternarVarios(items)} aria-label={`Seleccionar todo «${grupo}»`} style={casilla} />
                      )}
                      <span>
                        {grupo}
                        {items[0].prioridadAlta && <span style={{ marginLeft: 8, fontWeight: 400, color: 'var(--color-muted)' }}>· prioridad alta</span>}
                        {items[0].opcional && <span style={{ marginLeft: 8, fontWeight: 400, color: 'var(--color-muted)' }}>· opcionales (sirven también como promo)</span>}
                      </span>
                    </h3>
                    {items.map((t) => {
                      const elegible = puedeEditar && t.estado !== 'EN_REVISION'
                      const marcado = seleccion.has(t.id) && elegible
                      return (
                        <div
                          key={t.id}
                          // El velo de «ds-hover» marca la fila bajo el mouse; la fila tildada lleva el color de selección.
                          className="ds-hover"
                          data-selected={marcado ? 'true' : undefined}
                          onClick={elegible ? (e) => { if (!esControl(e.target)) alternar(t.id) } : undefined}
                          style={{
                            display: 'flex', gap: 12, alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap',
                            padding: '9px 10px', borderTop: '1px solid var(--color-border)',
                            background: marcado ? 'var(--color-primary-bg)' : undefined,
                            cursor: elegible ? 'pointer' : 'default',
                          }}
                        >
                          <div style={{ display: 'flex', gap: 10, alignItems: 'center', minWidth: 0, flex: '1 1 260px' }}>
                            {puedeEditar && (
                              <input
                                type="checkbox" checked={marcado} disabled={!elegible} onChange={() => alternar(t.id)}
                                aria-label={`Seleccionar «${t.titulo}»`} style={{ ...casilla, opacity: elegible ? 1 : 0.35, cursor: elegible ? 'pointer' : 'default' }}
                              />
                            )}
                            <div style={{ minWidth: 0 }}>
                              <div style={{ fontSize: 13.5, color: 'var(--color-text)' }}>{t.titulo}</div>
                              {t.notas && <div style={{ fontSize: 12.5, color: 'var(--color-muted)', marginTop: 2, overflowWrap: 'anywhere' }}>{t.notas}</div>}
                            </div>
                          </div>
                          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                            <Chip text={ESTADO[t.estado].texto} tone={ESTADO[t.estado].tono} dot />
                            {puedeEditar && t.estado !== 'EN_REVISION' && (
                              <select
                                aria-label={`Estado de ${t.titulo}`} value={t.estado} disabled={guardando.has(t.id) || aplicando}
                                onChange={(e) => cambiar(t, e.target.value as EstadoManual)}
                                style={{ ...inputStyle, height: 32, fontSize: 12.5, padding: '0 8px' }}
                              >
                                {OPCIONES.map((o) => <option key={o.id} value={o.id}>{o.texto}</option>)}
                              </select>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </section>
                )
              })}
            </div>
          )}
        </>
      )}

      {/* Barra flotante: aparece al tildar y queda a la vista aunque la lista sea larga. No cambia nada hasta tocar «Confirmar». */}
      {puedeEditar && elegidos.length > 0 && (
        <div
          role="region" aria-label="Cambiar el estado de los tutoriales seleccionados"
          style={{
            position: 'fixed', left: '50%', bottom: 24, transform: 'translateX(-50%)', zIndex: 40,
            width: 'max-content', maxWidth: 'calc(100vw - 32px)',
            display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', justifyContent: 'center',
            padding: '10px 14px', borderRadius: 14, border: '1px solid var(--color-border-strong)',
            background: 'var(--color-surface)', boxShadow: '0 10px 30px rgba(0,0,0,0.25)',
          }}
        >
          <span style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--color-text)' }}>
            {elegidos.length} {elegidos.length === 1 ? 'seleccionado' : 'seleccionados'}
          </span>
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--color-body)' }}>
            Pasar a
            <select
              value={destino} onChange={(e) => setDestino(e.target.value as EstadoManual)} disabled={aplicando}
              style={{ ...inputStyle, height: 34, fontSize: 13, padding: '0 8px' }}
            >
              {OPCIONES.map((o) => <option key={o.id} value={o.id}>{o.texto}</option>)}
            </select>
          </label>
          <button type="button" onClick={() => setSeleccion(new Set())} disabled={aplicando} className="ds-hover" style={{ ...btnGhostSm, height: 36, opacity: aplicando ? 0.6 : 1 }}>Cancelar</button>
          <button type="button" onClick={confirmar} disabled={aplicando} style={{ ...btnPrimary, height: 36, opacity: aplicando ? 0.6 : 1 }}>
            {aplicando ? 'Guardando…' : 'Confirmar'}
          </button>
        </div>
      )}
    </Card>
  )
}
