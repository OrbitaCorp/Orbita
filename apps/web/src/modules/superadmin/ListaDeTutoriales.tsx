import { useState } from 'react'
import { platformApi, type TutorialDeLaLista, type TutorialEstado } from '@/lib/platform/api'
import type { ToastVariant } from '@/design-system/components/Toast'
import { useFetch, Card, Chip, Loader, ErrorBox, Empty, btnGhostSm, inputStyle } from './ui'

// La lista de tutoriales: qué hay y qué falta. La actualiza el Claude de cada persona por el conector (marca «en proceso» al
// empezar uno, y «en revisión» / «hecho» salen solos al registrar y aprobar su video); acá se mira y, si hace falta, se corrige.
// Apps/api/src/marketing/videos/tutoriales.service.ts.

type Aviso = { variant: ToastVariant; title: string; description?: string }

const ESTADO: Record<TutorialEstado, { texto: string; tono: 'gray' | 'amber' | 'blue' | 'green' }> = {
  FALTA: { texto: 'Falta', tono: 'gray' },
  EN_PROCESO: { texto: 'En proceso', tono: 'amber' },
  EN_REVISION: { texto: 'En revisión', tono: 'blue' },
  HECHO: { texto: 'Hecho', tono: 'green' },
}

export function ListaDeTutoriales({ puedeEditar, setAviso }: { puedeEditar: boolean; setAviso: (a: Aviso) => void }) {
  const [tick, setTick] = useState(0)
  const { data, loading, error } = useFetch(() => platformApi.tutorialesLista(), [tick])
  const [soloFaltan, setSoloFaltan] = useState(false)

  const cambiar = async (t: TutorialDeLaLista, estado: Exclude<TutorialEstado, 'EN_REVISION'>) => {
    try {
      await platformApi.tutorialActualizar(t.id, { estado })
      setTick((n) => n + 1)
    } catch (e) {
      setAviso({ variant: 'error', title: 'No se pudo actualizar', description: e instanceof Error ? e.message : undefined })
    }
  }

  const grupos = new Map<string, TutorialDeLaLista[]>()
  for (const t of data?.tutoriales ?? []) {
    if (soloFaltan && t.estado === 'HECHO') continue
    grupos.set(t.grupo, [...(grupos.get(t.grupo) ?? []), t])
  }
  const r = data?.resumen

  return (
    <Card
      title="Lista de tutoriales"
      subtitle="Qué hay y qué falta. Tu Claude la actualiza solo: marca los que empieza y registra los que termina."
      action={(
        <span style={{ display: 'inline-flex', gap: 8, flexWrap: 'wrap' }}>
          <button type="button" onClick={() => setSoloFaltan((v) => !v)} aria-pressed={soloFaltan} className="ds-hover" style={{ ...btnGhostSm, height: 34 }}>{soloFaltan ? 'Ver todos' : 'Ver solo lo que falta'}</button>
          <button type="button" onClick={() => setTick((n) => n + 1)} className="ds-hover" style={{ ...btnGhostSm, height: 34 }}>Actualizar</button>
        </span>
      )}
    >
      {loading ? <Loader /> : error || !data ? (
        <ErrorBox msg="No se pudo leer la lista de tutoriales." action={<button type="button" onClick={() => setTick((n) => n + 1)} style={btnGhostSm}>Reintentar</button>} />
      ) : (
        <>
          {r && (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16, alignItems: 'center' }}>
              <strong style={{ fontSize: 14, color: 'var(--color-text)' }}>{r.hechos} de {r.total} hechos</strong>
              <Chip text={`${r.enRevision} en revisión`} tone="blue" />
              <Chip text={`${r.enProceso} en proceso`} tone="amber" />
              <Chip text={`${r.faltan} faltan`} tone="gray" />
            </div>
          )}
          {grupos.size === 0 ? <Empty text="No hay tutoriales para mostrar." /> : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {[...grupos.entries()].map(([grupo, items]) => (
                <section key={grupo} aria-label={grupo}>
                  <h3 style={{ margin: '0 0 6px', fontSize: 13, fontWeight: 600, color: 'var(--color-text)' }}>
                    {grupo}
                    {items[0].prioridadAlta && <span style={{ marginLeft: 8, fontWeight: 400, color: 'var(--color-muted)' }}>· prioridad alta</span>}
                    {items[0].opcional && <span style={{ marginLeft: 8, fontWeight: 400, color: 'var(--color-muted)' }}>· opcionales (sirven también como promo)</span>}
                  </h3>
                  {items.map((t) => (
                    <div key={t.id} style={{ display: 'flex', gap: 12, alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', padding: '9px 0', borderTop: '1px solid var(--color-border)' }}>
                      <div style={{ minWidth: 0, flex: '1 1 260px' }}>
                        <div style={{ fontSize: 13.5, color: 'var(--color-text)' }}>{t.titulo}</div>
                        {t.notas && <div style={{ fontSize: 12.5, color: 'var(--color-muted)', marginTop: 2, overflowWrap: 'anywhere' }}>{t.notas}</div>}
                      </div>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <Chip text={ESTADO[t.estado].texto} tone={ESTADO[t.estado].tono} dot />
                        {puedeEditar && t.estado !== 'EN_REVISION' && (
                          <select
                            aria-label={`Estado de ${t.titulo}`} value={t.estado}
                            onChange={(e) => cambiar(t, e.target.value as Exclude<TutorialEstado, 'EN_REVISION'>)}
                            style={{ ...inputStyle, height: 32, fontSize: 12.5, padding: '0 8px' }}
                          >
                            <option value="FALTA">Falta</option>
                            <option value="EN_PROCESO">En proceso</option>
                            <option value="HECHO">Hecho</option>
                          </select>
                        )}
                      </div>
                    </div>
                  ))}
                </section>
              ))}
            </div>
          )}
        </>
      )}
    </Card>
  )
}
