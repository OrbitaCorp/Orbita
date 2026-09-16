import { useCallback, useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { Check, CircleSlash, MessageCircleQuestion, PencilLine, X } from 'lucide-react'
import { platformApi, type AuditDecision, type AuditItemRow, type AuditListado } from '@/lib/platform/api'
import { Chip, btnGhostSm } from './ui'
import { MarkdownInforme, MD_CSS } from './MarkdownInforme'

// "Qué hacemos con esto" — la pantalla para recorrer, de a uno, todo lo que
// quedó abierto en la auditoría y NO se destraba escribiendo código: las
// decisiones de producto y legales, lo que hay que ejecutar en una consola, y
// lo que está en la cancha de Mateo.
//
// El flujo real que tiene que soportar: Mateo la recorre y marca qué haría con
// cada uno; Ale la lee después y da la orden final. Por eso lo que se guarda
// es una PROPUESTA con autor y fecha (`decision`, `decisionPor`, `decisionAt`),
// separada del `estado` del ítem: `estado` dice en qué anda el trabajo,
// `decision` dice si el trabajo va a existir.
//
// Dos decisiones de diseño, las dos para poder recorrer 22 ítems sin perderse:
//   1. Un ítem ya decidido COLAPSA a una tira de una línea. La lista se achica
//      a medida que avanzás, así que lo que queda en pantalla es siempre lo que
//      falta. Se vuelve a abrir con "Cambiar".
//   2. La barra de progreso está fija arriba. Es la única forma de saber
//      cuánto falta sin scrollear hasta el final.
//
// Se abre desde el botón "Decisiones", al lado de "Documento" (Auditoria.tsx).

const PREFIJO = 'decision.'

const OPCIONES: { id: AuditDecision; label: string; Icono: typeof Check; tone: 'green' | 'red' | 'amber'; ayuda: string }[] = [
  { id: 'HACER', label: 'Hacerlo', Icono: Check, tone: 'green', ayuda: 'Se hace. Queda para ejecutar.' },
  { id: 'NO_HACER', label: 'No hacerlo', Icono: CircleSlash, tone: 'red', ayuda: 'No se hace. Queda asentado como decisión, no como pendiente.' },
  { id: 'HABLAR', label: 'Hablarlo', Icono: MessageCircleQuestion, tone: 'amber', ayuda: 'Hace falta charlarlo antes de poder decidir.' },
]

const POR_ID = new Map(OPCIONES.map((o) => [o.id, o]))

const fechaCorta = (d: string) =>
  new Date(d).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })

export function DecisionesAuditoria({
  data,
  onClose,
  onCambio,
}: {
  data: AuditListado
  onClose: () => void
  onCambio: (item: AuditItemRow) => void
}) {
  const [soloSinDecidir, setSoloSinDecidir] = useState(false)
  // Ítems que el usuario volvió a abrir a mano para cambiarles la decisión.
  const [abiertos, setAbiertos] = useState<Set<string>>(new Set())
  const [guardando, setGuardando] = useState<string | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = prev }
  }, [onClose])

  const decisiones = useMemo(
    () => data.items.filter((i) => i.key.startsWith(PREFIJO)).sort((a, b) => a.orden - b.orden),
    [data.items],
  )

  // grupo → ítems, en el orden en el que aparecen (el `orden` del script que
  // los cargó ya los deja agrupados).
  const grupos = useMemo(() => {
    const out: { nombre: string; items: AuditItemRow[] }[] = []
    for (const it of decisiones) {
      const visible = !soloSinDecidir || !it.decision
      if (!visible) continue
      const g = out.find((x) => x.nombre === it.grupo)
      if (g) g.items.push(it)
      else out.push({ nombre: it.grupo, items: [it] })
    }
    return out
  }, [decisiones, soloSinDecidir])

  const decididas = decisiones.filter((i) => i.decision).length
  const total = decisiones.length
  const pct = total === 0 ? 0 : Math.round((decididas / total) * 100)

  const elegir = useCallback(async (item: AuditItemRow, decision: AuditDecision | null) => {
    setGuardando(item.id)
    setError('')
    try {
      const actualizado = await platformApi.updateAuditItem(item.id, { decision })
      onCambio(actualizado)
      // Al elegir, el ítem se colapsa solo: es la señal de que quedó listo.
      setAbiertos((prev) => { const s = new Set(prev); s.delete(item.id); return s })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo guardar la decisión')
    } finally {
      setGuardando(null)
    }
  }, [onCambio])

  const guardarNota = useCallback(async (item: AuditItemRow, decisionNota: string) => {
    if ((item.decisionNota ?? '') === decisionNota.trim()) return
    setGuardando(item.id)
    setError('')
    try {
      onCambio(await platformApi.updateAuditItem(item.id, { decisionNota }))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo guardar la nota')
    } finally {
      setGuardando(null)
    }
  }, [onCambio])

  return createPortal(
    <div style={{ position: 'fixed', inset: 0, zIndex: 95, background: 'var(--color-surface)', overflowY: 'auto' }}>
      <style>{`
        ${MD_CSS}
        .dec-opt:focus-visible, .dec-cerrar:focus-visible, .dec-tira:focus-visible {
          outline: 2px solid var(--color-primary); outline-offset: 2px;
        }
        .dec-opt { transition: background-color 180ms ease, border-color 180ms ease, color 180ms ease; }
        .dec-tira { transition: border-color 180ms ease; }
        .dec-tira:hover { border-color: var(--color-primary); }
        @media (prefers-reduced-motion: reduce) {
          .dec-opt, .dec-tira { transition: none; }
        }
      `}</style>

      {/* Barra fija: lo único que te dice cuánto falta sin scrollear. */}
      <header style={{
        position: 'sticky', top: 0, zIndex: 2,
        background: 'var(--color-bg)', borderBottom: '1px solid var(--color-border)',
        padding: '16px 24px 0',
      }}>
        <div style={{ maxWidth: 900, margin: '0 auto', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: 'var(--color-text)', letterSpacing: '-0.02em' }}>
              Qué hacemos con esto
            </h2>
            <p style={{ margin: '5px 0 0', fontSize: 13.5, color: 'var(--color-muted)', lineHeight: 1.45, maxWidth: 620 }}>
              Todo lo que quedó abierto y no se destraba escribiendo código. Cada uno trae la propuesta;
              elegí qué harías y, si hace falta, por qué.
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              type="button"
              onClick={() => setSoloSinDecidir((v) => !v)}
              className="ds-hover dec-cerrar"
              style={{ ...btnGhostSm, borderColor: soloSinDecidir ? 'var(--color-primary)' : 'var(--color-border)', color: soloSinDecidir ? 'var(--color-primary)' : 'var(--color-body)' }}
              aria-pressed={soloSinDecidir}
            >
              Solo sin decidir
            </button>
            <button type="button" onClick={onClose} aria-label="Cerrar" className="ds-hover dec-cerrar" style={{ ...btnGhostSm, width: 32, padding: 0 }}>
              <X size={15} />
            </button>
          </div>
        </div>

        <div style={{ maxWidth: 900, margin: '14px auto 0', paddingBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, marginBottom: 7 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text)' }}>
              {decididas} de {total} decididas
            </span>
            <span style={{ fontSize: 12.5, color: 'var(--color-muted)' }}>
              {total - decididas === 0 ? 'No queda ninguna' : `Faltan ${total - decididas}`}
            </span>
          </div>
          {/* role=progressbar y no solo color: un lector de pantalla también
              tiene que poder saber cuánto falta. */}
          <div
            role="progressbar"
            aria-valuenow={decididas}
            aria-valuemin={0}
            aria-valuemax={total}
            aria-label="Decisiones tomadas"
            style={{ height: 6, borderRadius: 999, background: 'var(--color-surface-alt)', overflow: 'hidden' }}
          >
            <div style={{ width: `${pct}%`, height: '100%', background: 'var(--color-primary)', borderRadius: 999, transition: 'width 220ms ease' }} />
          </div>
        </div>
      </header>

      <main style={{ maxWidth: 900, margin: '0 auto', padding: '22px 24px 80px' }}>
        {error && (
          <div role="alert" style={{ marginBottom: 16, padding: '11px 14px', borderRadius: 10, background: 'var(--color-error-bg)', color: 'var(--chip-error-fg)', fontSize: 13, fontWeight: 600 }}>
            {error}
          </div>
        )}

        {total === 0 && (
          <p style={{ fontSize: 14, color: 'var(--color-muted)' }}>
            Todavía no hay ítems de decisión cargados. Se cargan con el script{' '}
            <code>apps/api/scripts/auditoria/decisiones-16-09.cjs</code>.
          </p>
        )}

        {total > 0 && grupos.length === 0 && (
          <p style={{ fontSize: 14, color: 'var(--color-muted)' }}>
            Están todas decididas. Sacá el filtro para volver a verlas.
          </p>
        )}

        {grupos.map((g) => {
          const sinDecidir = g.items.filter((i) => !i.decision).length
          return (
            <section key={g.nombre} style={{ marginBottom: 34 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
                <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: 'var(--color-text)' }}>
                  {g.nombre.replace(/^Decisiones — /, '')}
                </h3>
                <Chip
                  text={sinDecidir === 0 ? 'Completo' : `${sinDecidir} sin decidir`}
                  tone={sinDecidir === 0 ? 'green' : 'gray'}
                />
              </div>

              <div style={{ display: 'grid', gap: 10 }}>
                {g.items.map((it) => (
                  <ItemDecision
                    key={it.id}
                    item={it}
                    abierto={abiertos.has(it.id) || !it.decision}
                    guardando={guardando === it.id}
                    onAbrir={() => setAbiertos((p) => new Set(p).add(it.id))}
                    onElegir={(d) => void elegir(it, d)}
                    onNota={(n) => void guardarNota(it, n)}
                  />
                ))}
              </div>
            </section>
          )
        })}
      </main>
    </div>,
    document.body,
  )
}

// Un ítem ya decidido se muestra como una tira de una línea; uno sin decidir,
// abierto con toda la propuesta. Así lo que ocupa pantalla es lo que falta.
function ItemDecision({
  item, abierto, guardando, onAbrir, onElegir, onNota,
}: {
  item: AuditItemRow
  abierto: boolean
  guardando: boolean
  onAbrir: () => void
  onElegir: (d: AuditDecision | null) => void
  onNota: (nota: string) => void
}) {
  const [nota, setNota] = useState(item.decisionNota ?? '')
  const elegida = item.decision ? POR_ID.get(item.decision) : null

  // Si otro la cambió desde su pantalla (la lista se refresca cada 20 s), la
  // nota local se pone al día — salvo que la estés editando en este momento.
  useEffect(() => { setNota(item.decisionNota ?? '') }, [item.decisionNota])

  if (!abierto && elegida) {
    return (
      <button
        type="button"
        onClick={onAbrir}
        className="dec-tira"
        style={{
          display: 'flex', alignItems: 'center', gap: 12, width: '100%', textAlign: 'left',
          padding: '12px 16px', borderRadius: 12, cursor: 'pointer', fontFamily: 'inherit',
          border: '1px solid var(--color-border)', background: 'var(--color-bg)',
        }}
      >
        <Chip text={elegida.label} tone={elegida.tone} dot />
        <span style={{ flex: 1, minWidth: 0, fontSize: 13.5, fontWeight: 600, color: 'var(--color-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {item.titulo}
        </span>
        {item.decisionPor && (
          <span style={{ fontSize: 12, color: 'var(--color-muted)', whiteSpace: 'nowrap' }}>
            {item.decisionPor.name}{item.decisionAt ? ` · ${fechaCorta(item.decisionAt)}` : ''}
          </span>
        )}
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12.5, fontWeight: 600, color: 'var(--color-primary)', whiteSpace: 'nowrap' }}>
          <PencilLine size={13} /> Cambiar
        </span>
      </button>
    )
  }

  return (
    <article style={{
      padding: '18px 20px', borderRadius: 14,
      border: `1px solid ${elegida ? 'var(--color-primary)' : 'var(--color-border)'}`,
      background: 'var(--color-bg)', boxShadow: 'var(--shadow-card)',
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 10 }}>
        <h4 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--color-text)', letterSpacing: '-0.01em', lineHeight: 1.35 }}>
          {item.titulo}
        </h4>
        {elegida
          ? <Chip text={elegida.label} tone={elegida.tone} dot />
          : <Chip text="Sin decidir" tone="gray" />}
      </div>

      {item.informe && <MarkdownInforme texto={item.informe} />}

      <fieldset style={{ border: 'none', margin: '16px 0 0', padding: 0 }}>
        <legend style={{ padding: 0, marginBottom: 8, fontSize: 12.5, fontWeight: 700, color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
          Qué harías
        </legend>
        <div role="radiogroup" aria-label={`Qué hacer con: ${item.titulo}`} style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {OPCIONES.map((o) => {
            const activa = item.decision === o.id
            return (
              <button
                key={o.id}
                type="button"
                role="radio"
                aria-checked={activa}
                title={o.ayuda}
                disabled={guardando}
                // Volver a tocar la elegida la deshace: es la única forma de
                // volver a "sin decidir" sin un botón más.
                onClick={() => onElegir(activa ? null : o.id)}
                className="ds-hover dec-opt"
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 7,
                  height: 40, padding: '0 16px', borderRadius: 10,
                  fontSize: 13.5, fontWeight: 600, fontFamily: 'inherit',
                  cursor: guardando ? 'progress' : 'pointer',
                  opacity: guardando ? 0.6 : 1,
                  border: `1px solid ${activa ? 'var(--color-primary)' : 'var(--color-border)'}`,
                  background: activa ? 'var(--color-primary-bg)' : 'var(--color-bg)',
                  color: activa ? 'var(--chip-primary-fg)' : 'var(--color-body)',
                }}
              >
                <o.Icono size={15} strokeWidth={2.2} /> {o.label}
              </button>
            )
          })}
        </div>
      </fieldset>

      {/* La nota aparece recién cuando hay algo que justificar: 22 tarjetas con
          un textarea vacío cada una es ruido. */}
      {elegida && (
        <label style={{ display: 'block', marginTop: 14 }}>
          <span style={{ display: 'block', marginBottom: 6, fontSize: 12.5, fontWeight: 600, color: 'var(--color-muted)' }}>
            Por qué (opcional)
          </span>
          <textarea
            value={nota}
            onChange={(e) => setNota(e.target.value)}
            onBlur={() => onNota(nota)}
            rows={2}
            maxLength={2000}
            placeholder="Ej: lo hablamos con Ale, va después de multi-sucursal."
            className="ds-field"
            style={{
              width: '100%', padding: '10px 13px', borderRadius: 10, resize: 'vertical',
              border: '1px solid var(--color-border)', background: 'var(--color-bg)',
              color: 'var(--color-text)', fontSize: 13.5, fontFamily: 'inherit', lineHeight: 1.5, outline: 'none',
            }}
          />
        </label>
      )}

      {elegida && item.decisionPor && (
        <p style={{ margin: '10px 0 0', fontSize: 12, color: 'var(--color-muted)' }}>
          Lo eligió {item.decisionPor.name}{item.decisionAt ? ` el ${fechaCorta(item.decisionAt)}` : ''}
        </p>
      )}
    </article>
  )
}
