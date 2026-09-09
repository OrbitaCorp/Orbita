import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { Printer, X } from 'lucide-react'
import type { AuditArea, AuditItemRow, AuditListado } from '@/lib/platform/api'
import { MarkdownInforme, MD_CSS } from './MarkdownInforme'

// Documento imprimible de la auditoría: "Cómo está construida Órbita".
//
// Junta todos los ítems (o solo los que ya tienen informe) en un documento
// largo con portada, índice y una sección por área → grupo → módulo, con las
// verificaciones tildadas y el informe en Markdown de cada uno. Se abre como
// capa sobre el panel y se guarda en PDF con la impresión del navegador
// (Ctrl+P → Guardar como PDF): en @media print se oculta todo lo demás.
//
// Paleta fija clara a propósito: un PDF se lee en papel o en pantalla ajena,
// no debe depender del tema del panel.

const AREA_ORDEN: AuditArea[] = ['BACKEND', 'FRONTEND', 'TRANSVERSAL', 'HALLAZGO']
const AREA_TITULO: Record<AuditArea, string> = {
  BACKEND: 'Backend · API',
  FRONTEND: 'Frontend · panel y tienda',
  TRANSVERSAL: 'Revisiones transversales',
  HALLAZGO: 'Hallazgos de auditorías anteriores',
}
const ESTADO_LABEL = { PENDIENTE: 'Pendiente', EN_CURSO: 'En curso', HECHO: 'Auditado' } as const
const SEV_LABEL = { CRITICA: 'Crítica', ALTA: 'Alta', MEDIA: 'Media', BAJA: 'Baja', INFO: 'Info' } as const

const fechaLarga = (d: Date | string) => new Date(d).toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' })

export function DocumentoAuditoria({ data, onClose }: { data: AuditListado; onClose: () => void }) {
  const [soloConInforme, setSoloConInforme] = useState(true)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = prev }
  }, [onClose])

  const items = useMemo(() => (soloConInforme ? data.items.filter((i) => i.informe) : data.items), [data.items, soloConInforme])
  const conInforme = data.items.filter((i) => i.informe).length

  // área → grupo → ítems, respetando el orden del seed.
  const secciones = useMemo(() => {
    return AREA_ORDEN.map((area) => {
      const grupos: { nombre: string; items: AuditItemRow[] }[] = []
      for (const it of items) {
        if (it.area !== area) continue
        const g = grupos.find((x) => x.nombre === it.grupo)
        if (g) g.items.push(it)
        else grupos.push({ nombre: it.grupo, items: [it] })
      }
      return { area, grupos }
    }).filter((s) => s.grupos.length > 0)
  }, [items])

  const responsables = useMemo(() => {
    const set = new Map<string, string>()
    for (const it of items) {
      if (it.responsable) set.set(it.responsable.id, it.responsable.name)
      if (it.hechoPor) set.set(it.hechoPor.id, it.hechoPor.name)
    }
    return Array.from(set.values()).sort((a, b) => a.localeCompare(b, 'es'))
  }, [items])

  const ultimaEdicion = useMemo(() => items.reduce<string | null>((max, it) => (!max || it.updatedAt > max ? it.updatedAt : max), null), [items])
  const auditados = items.filter((i) => i.estado === 'HECHO').length
  const totalChecks = items.reduce((n, i) => n + i.checks.length, 0)
  const checksHechos = items.reduce((n, i) => n + i.checksHechos, 0)

  const doc = (
    <div className="au-doc-root" role="dialog" aria-modal="true" aria-label="Documento de la auditoría">
      <style>{MD_CSS}</style>
      <style>{DOC_CSS}</style>

      <div className="au-doc-toolbar">
        <div className="au-doc-toolbar-in">
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#0F172A' }}>Documento del sistema</div>
            <div style={{ fontSize: 12, color: '#64748B' }}>{items.length} {items.length === 1 ? 'ítem' : 'ítems'} · se guarda en PDF con la impresión del navegador</div>
          </div>
          <div className="au-doc-seg" role="tablist" aria-label="Qué incluir">
            <button role="tab" aria-selected={soloConInforme} className={soloConInforme ? 'on' : ''} onClick={() => setSoloConInforme(true)}>Solo con informe ({conInforme})</button>
            <button role="tab" aria-selected={!soloConInforme} className={!soloConInforme ? 'on' : ''} onClick={() => setSoloConInforme(false)}>Todo el inventario ({data.items.length})</button>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="au-doc-btn primary" onClick={() => window.print()}>
              <Printer size={15} strokeWidth={2} /> Guardar como PDF
            </button>
            <button className="au-doc-btn" onClick={onClose} aria-label="Cerrar documento">
              <X size={15} strokeWidth={2} /> Cerrar
            </button>
          </div>
        </div>
      </div>

      <div className="au-doc-scroll">
        <article className="au-doc-paper">
          {/* Portada */}
          <header className="au-doc-portada">
            <div className="au-doc-marca">Órbita</div>
            <h1>Cómo está construido el sistema</h1>
            <p className="au-doc-sub">Documentación técnica y auditoría interna, módulo por módulo: qué hace cada parte, cómo está hecha, qué se verificó y qué quedó pendiente.</p>
            <dl className="au-doc-datos">
              <div><dt>Emitido</dt><dd>{fechaLarga(new Date())}</dd></div>
              <div><dt>Última edición</dt><dd>{ultimaEdicion ? fechaLarga(ultimaEdicion) : '—'}</dd></div>
              <div><dt>Módulos auditados</dt><dd>{auditados} de {items.length}</dd></div>
              <div><dt>Verificaciones</dt><dd>{checksHechos} de {totalChecks}</dd></div>
            </dl>
            {responsables.length > 0 && (
              <p className="au-doc-equipo"><strong>Equipo:</strong> {responsables.join(' · ')}</p>
            )}
            <p className="au-doc-aviso">Documento interno de Orbita Corp. Contiene detalles de arquitectura y seguridad: no compartir fuera del equipo.</p>
          </header>

          {/* Índice */}
          <section className="au-doc-indice">
            <h2>Índice</h2>
            {secciones.map((s) => (
              <div key={s.area} className="au-doc-indice-area">
                <div className="au-doc-indice-titulo">{AREA_TITULO[s.area]}</div>
                {s.grupos.map((g) => (
                  <div key={g.nombre} className="au-doc-indice-grupo">
                    <div className="au-doc-indice-grupo-nombre">{g.nombre}</div>
                    <ul>
                      {g.items.map((it) => (
                        <li key={it.id}>
                          <a href={`#au-doc-${it.id}`}>{it.titulo}</a>
                          <span className={`au-doc-estado ${it.estado.toLowerCase()}`}>{ESTADO_LABEL[it.estado]}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            ))}
            {secciones.length === 0 && <p className="au-doc-vacio">Todavía no hay ningún ítem con informe. Escribí el primero desde la pestaña Auditoría o cambiá a &ldquo;Todo el inventario&rdquo;.</p>}
          </section>

          {/* Cuerpo */}
          {secciones.map((s, si) => (
            <section key={s.area} className="au-doc-area">
              <div className="au-doc-area-num">Parte {si + 1}</div>
              <h2 className="au-doc-area-titulo">{AREA_TITULO[s.area]}</h2>
              {s.grupos.map((g) => (
                <div key={g.nombre} className="au-doc-grupo">
                  <h3 className="au-doc-grupo-titulo">{g.nombre}</h3>
                  {g.items.map((it) => <ItemDoc key={it.id} item={it} />)}
                </div>
              ))}
            </section>
          ))}
        </article>
      </div>
    </div>
  )

  return createPortal(doc, document.body)
}

function ItemDoc({ item }: { item: AuditItemRow }) {
  return (
    <section id={`au-doc-${item.id}`} className="au-doc-item">
      <div className="au-doc-item-cab">
        <h4>{item.titulo}</h4>
        <span className={`au-doc-estado ${item.estado.toLowerCase()}`}>{ESTADO_LABEL[item.estado]}</span>
        {item.severidad && <span className={`au-doc-sev ${item.severidad.toLowerCase()}`}>Severidad {SEV_LABEL[item.severidad]}</span>}
      </div>
      {item.ruta && <div className="au-doc-ruta">{item.ruta}</div>}
      <p className="au-doc-foco">{item.foco}</p>
      <div className="au-doc-meta">
        {item.responsable && <span>Responsable: <strong>{item.responsable.name}</strong></span>}
        {item.hechoPor && item.hechoAt && <span>Auditado por <strong>{item.hechoPor.name}</strong> el {fechaLarga(item.hechoAt)}</span>}
        {!item.hechoPor && item.actualizadoPor && <span>Última edición: {item.actualizadoPor.name}, {fechaLarga(item.updatedAt)}</span>}
      </div>

      {item.checks.length > 0 && (
        <div className="au-doc-checks">
          <div className="au-doc-rotulo">Verificaciones · {item.checksHechos} de {item.checks.length}</div>
          <ul>
            {item.checks.map((c) => (
              <li key={c.id} className={c.hecho ? 'ok' : ''}>
                <span className="au-doc-tick" aria-hidden>{c.hecho ? '✓' : '○'}</span>
                <span>{c.texto}</span>
                <span className="au-doc-sr">{c.hecho ? ' (verificado)' : ' (pendiente)'}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {item.informe ? (
        <div className="au-doc-informe">
          <div className="au-doc-rotulo">Informe</div>
          <MarkdownInforme texto={item.informe} />
        </div>
      ) : (
        <p className="au-doc-vacio">Sin informe todavía.</p>
      )}

      {item.notas && (
        <div className="au-doc-notas">
          <div className="au-doc-rotulo">Notas</div>
          <p>{item.notas}</p>
        </div>
      )}
    </section>
  )
}

const DOC_CSS = `
  .au-doc-root { position: fixed; inset: 0; z-index: 100; background: #E2E8F0; color: #0F172A; display: flex; flex-direction: column; font-family: inherit;
    --md-fg: #1E293B; --md-strong: #0F172A; --md-muted: #475569; --md-border: #E2E8F0; --md-accent: #4F46E5; --md-quote-bg: #F8FAFC; --md-code-bg: #F1F5F9; }
  .au-doc-toolbar { background: #fff; border-bottom: 1px solid #E2E8F0; flex-shrink: 0; }
  .au-doc-toolbar-in { max-width: 1040px; margin: 0 auto; padding: 12px 20px; display: flex; align-items: center; justify-content: space-between; gap: 14px; flex-wrap: wrap; }
  .au-doc-seg { display: inline-flex; background: #F1F5F9; border-radius: 999px; padding: 3px; gap: 2px; }
  .au-doc-seg button { height: 30px; padding: 0 12px; border-radius: 999px; border: none; background: transparent; color: #475569; font: inherit; font-size: 12.5px; font-weight: 600; cursor: pointer; transition: background 150ms ease, color 150ms ease; }
  .au-doc-seg button.on { background: #fff; color: #0F172A; box-shadow: 0 1px 2px rgba(15,23,42,0.12); }
  .au-doc-seg button:focus-visible, .au-doc-btn:focus-visible { outline: 2px solid #4F46E5; outline-offset: 2px; }
  .au-doc-btn { height: 36px; padding: 0 14px; border-radius: 10px; border: 1px solid #CBD5E1; background: #fff; color: #0F172A; font: inherit; font-size: 13px; font-weight: 600; cursor: pointer; display: inline-flex; align-items: center; gap: 7px; transition: background 150ms ease; }
  .au-doc-btn:hover { background: #F8FAFC; }
  .au-doc-btn.primary { background: #0F172A; color: #fff; border-color: #0F172A; }
  .au-doc-btn.primary:hover { background: #1E293B; }
  .au-doc-scroll { flex: 1; overflow-y: auto; padding: 28px 16px 60px; }
  .au-doc-paper { max-width: 860px; margin: 0 auto; background: #fff; border-radius: 6px; box-shadow: 0 8px 30px rgba(15,23,42,0.12); padding: 64px 72px 80px; font-size: 13.5px; line-height: 1.6; color: #1E293B; }
  .au-doc-paper h1, .au-doc-paper h2, .au-doc-paper h3, .au-doc-paper h4 { color: #0F172A; margin: 0; letter-spacing: -0.015em; }

  .au-doc-portada { min-height: 520px; display: flex; flex-direction: column; justify-content: center; border-bottom: 2px solid #0F172A; padding-bottom: 40px; margin-bottom: 40px; break-after: page; }
  .au-doc-marca { font-size: 13px; font-weight: 700; letter-spacing: 0.18em; text-transform: uppercase; color: #4F46E5; margin-bottom: 18px; }
  .au-doc-portada h1 { font-size: 38px; font-weight: 800; line-height: 1.1; max-width: 12ch; }
  .au-doc-sub { font-size: 15px; color: #475569; margin: 18px 0 32px; max-width: 58ch; }
  .au-doc-datos { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px 28px; margin: 0; max-width: 520px; }
  .au-doc-datos dt { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: #64748B; }
  .au-doc-datos dd { margin: 2px 0 0; font-size: 16px; font-weight: 600; color: #0F172A; }
  .au-doc-equipo { margin: 28px 0 0; font-size: 13px; color: #475569; }
  .au-doc-aviso { margin: 10px 0 0; font-size: 12px; color: #94A3B8; }

  .au-doc-indice { break-after: page; margin-bottom: 40px; }
  .au-doc-indice h2, .au-doc-area-titulo { font-size: 26px; font-weight: 800; margin-bottom: 18px; }
  .au-doc-indice-area { margin-bottom: 18px; }
  .au-doc-indice-titulo { font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: #4F46E5; margin-bottom: 8px; }
  .au-doc-indice-grupo { margin: 0 0 8px 0; }
  .au-doc-indice-grupo-nombre { font-weight: 700; font-size: 13px; color: #0F172A; margin-bottom: 2px; }
  .au-doc-indice ul { list-style: none; margin: 0; padding: 0 0 0 14px; }
  .au-doc-indice li { display: flex; align-items: baseline; gap: 8px; padding: 2px 0; font-size: 13px; border-bottom: 1px dotted #E2E8F0; }
  .au-doc-indice li a { color: #1E293B; text-decoration: none; flex: 1; }
  .au-doc-indice li a:hover { color: #4F46E5; text-decoration: underline; }

  .au-doc-area { break-before: page; margin-bottom: 36px; }
  .au-doc-area-num { font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.14em; color: #4F46E5; margin-bottom: 6px; }
  .au-doc-area-titulo { padding-bottom: 12px; border-bottom: 2px solid #0F172A; margin-bottom: 26px; }
  .au-doc-grupo-titulo { font-size: 18px; font-weight: 700; margin: 30px 0 14px; color: #0F172A; break-after: avoid; }

  .au-doc-item { padding: 18px 0 22px; border-top: 1px solid #E2E8F0; }
  .au-doc-item-cab { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; break-after: avoid; }
  .au-doc-item-cab h4 { font-size: 15.5px; font-weight: 700; }
  .au-doc-estado { font-size: 11px; font-weight: 700; padding: 2px 9px; border-radius: 999px; background: #F1F5F9; color: #475569; white-space: nowrap; }
  .au-doc-estado.hecho { background: #DCFCE7; color: #166534; }
  .au-doc-estado.en_curso { background: #FEF3C7; color: #92400E; }
  .au-doc-sev { font-size: 11px; font-weight: 700; padding: 2px 9px; border-radius: 999px; background: #F1F5F9; color: #475569; }
  .au-doc-sev.critica, .au-doc-sev.alta { background: #FEE2E2; color: #991B1B; }
  .au-doc-sev.media { background: #FEF3C7; color: #92400E; }
  .au-doc-sev.baja { background: #DBEAFE; color: #1E40AF; }
  .au-doc-ruta { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 11.5px; color: #64748B; margin-top: 4px; }
  .au-doc-foco { margin: 8px 0 6px; color: #334155; }
  .au-doc-meta { display: flex; gap: 14px; flex-wrap: wrap; font-size: 12px; color: #64748B; margin-bottom: 12px; }
  .au-doc-rotulo { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: #64748B; margin: 14px 0 6px; break-after: avoid; }
  .au-doc-checks ul { list-style: none; margin: 0; padding: 0; }
  .au-doc-checks li { display: flex; gap: 8px; align-items: flex-start; padding: 3px 0; font-size: 13px; color: #334155; break-inside: avoid; }
  .au-doc-checks li.ok { color: #0F172A; }
  .au-doc-tick { width: 16px; flex-shrink: 0; font-weight: 700; color: #94A3B8; text-align: center; }
  .au-doc-checks li.ok .au-doc-tick { color: #16A34A; }
  .au-doc-sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
  .au-doc-informe { margin-top: 6px; }
  .au-doc-notas p { margin: 0; white-space: pre-wrap; color: #334155; }
  .au-doc-vacio { color: #94A3B8; font-style: italic; margin: 8px 0 0; }

  @media (max-width: 720px) {
    .au-doc-paper { padding: 36px 22px 48px; }
    .au-doc-portada h1 { font-size: 30px; }
    .au-doc-datos { grid-template-columns: 1fr; }
  }

  @media print {
    @page { size: A4; margin: 18mm 16mm 20mm; }
    html, body { height: auto !important; overflow: visible !important; background: #fff !important; }
    body > *:not(.au-doc-root) { display: none !important; }
    .au-doc-root { position: static !important; inset: auto !important; display: block !important; background: #fff !important; height: auto !important; overflow: visible !important; }
    .au-doc-toolbar { display: none !important; }
    .au-doc-scroll { overflow: visible !important; padding: 0 !important; }
    .au-doc-paper { max-width: none !important; box-shadow: none !important; border-radius: 0 !important; padding: 0 !important; font-size: 12.5px; }
    .au-doc-portada { min-height: 70vh; }
    .au-doc-item { break-inside: auto; }
    .au-doc-item-cab, .au-doc-rotulo, .au-doc-grupo-titulo { break-after: avoid-page; }
    .md-informe .md-table-wrap, .md-informe pre { overflow: visible !important; }
    .md-informe pre { white-space: pre-wrap !important; }
    a { color: inherit; text-decoration: none; }
  }
  @media (prefers-reduced-motion: reduce) { .au-doc-seg button, .au-doc-btn { transition: none; } }
`
