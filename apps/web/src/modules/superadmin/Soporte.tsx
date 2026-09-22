import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/router'
import {
  Search, ChevronLeft, ChevronRight, X, ExternalLink, Mail, Phone, Send, RotateCcw, CircleCheck,
  ThumbsUp, ThumbsDown, Paperclip, CloudOff, RefreshCw, Inbox,
} from 'lucide-react'
import {
  platformApi,
  type AdminSupportDetail, type SupportSummary, type SupportManualChapter, type SupportMessageDto,
  type SupportAttachment, type SupportRequestStatus, type SupportCategory,
} from '@/lib/platform/api'
import {
  useFetch, Grid, Kpi, Card, Table, Pill, Chip, Loader, ErrorBox, Empty, ConfirmModal, PageHeader,
  btnGhost, btnGhostSm, btnPrimary, inputStyle, date, dateTime,
  SUPPORT_STATUS_LABELS, SUPPORT_CATEGORY_LABELS,
} from './ui'
import { CAPITULOS } from '@/modules/ventas/panel/manual/contenido'
import { fechaRelativa } from '@/modules/ventas/panel/configuracion/SoporteComun'

// Soporte (super admin → Soporte): la bandeja de consultas que los negocios
// mandan desde Configuración → Soporte de su panel.
//
// Antes esto vivía solo en la casilla soporte@orbita.site: se respondía por
// mail y no quedaba registro de qué se contestó ni a quién. Acá está el hilo
// completo de cada consulta, se responde desde el panel (al negocio le llega
// por mail Y le queda en su historial) y la lista viene con las abiertas
// primero, que son las que esperan al equipo.
//
// Al pie está lo que opinan los negocios del manual (pulgar arriba/abajo por
// capítulo): es la otra cara de "en qué se traban", y se lee junto con las
// consultas para decidir qué capítulo reescribir.

const TONO_ESTADO: Record<SupportRequestStatus, 'amber' | 'green' | 'gray'> = {
  OPEN: 'amber',
  ANSWERED: 'green',
  CLOSED: 'gray',
}
const ESTADOS: SupportRequestStatus[] = ['OPEN', 'ANSWERED', 'CLOSED']
const CATEGORIAS: SupportCategory[] = ['DOMINIO', 'FACTURACION', 'TECNICO', 'CUENTA', 'OTRO']
const POR_PAGINA = 20
const MIN_RESPUESTA = 10
const MAX_RESPUESTA = 5000

// chapterId → título del capítulo, tal como lo ve el negocio en su manual. Si
// un capítulo se renombra o se borra del manual, la opinión vieja sigue
// existiendo: se muestra el id crudo antes que esconderla.
const TITULO_CAPITULO: Record<string, string> = Object.fromEntries(CAPITULOS.map((c) => [c.id, c.titulo]))
const tituloCapitulo = (id: string) => TITULO_CAPITULO[id] ?? id

export function TabSoporte({ onCambio }: { currentAdminId: string; onCambio?: () => void }) {
  // Default "Abiertas": lo que espera respuesta es lo único que hay que mirar
  // al entrar. Lo demás está a un select de distancia.
  const [estado, setEstado] = useState<SupportRequestStatus | ''>('OPEN')
  const [categoria, setCategoria] = useState<SupportCategory | ''>('')
  const [busqueda, setBusqueda] = useState('')
  const [debounced, setDebounced] = useState('')
  const [page, setPage] = useState(1)
  const [reloadKey, setReloadKey] = useState(0)
  const [abierta, setAbierta] = useState<string | null>(null)

  // Cambiar un filtro vuelve a la primera página en el MISMO render (no en un
  // efecto aparte): si no, se pedía la página 3 con el filtro nuevo, llegaba
  // vacía, y recién ahí se corregía a la 1 con un segundo pedido.
  useEffect(() => {
    const t = setTimeout(() => {
      setDebounced(busqueda.trim())
      setPage(1)
    }, 300)
    return () => clearTimeout(t)
  }, [busqueda])
  const cambiarEstado = (v: SupportRequestStatus | '') => { setEstado(v); setPage(1) }
  const cambiarCategoria = (v: SupportCategory | '') => { setCategoria(v); setPage(1) }

  const { data: resumen, error: errorResumen, status: statusResumen } = useFetch(() => platformApi.supportSummary(), [reloadKey])
  const { data: lista, error: errorLista, status: statusLista, loading } = useFetch(
    () => platformApi.supportRequests({
      status: estado || undefined,
      category: categoria || undefined,
      q: debounced || undefined,
      page,
      limit: POR_PAGINA,
    }),
    [estado, categoria, debounced, page, reloadKey],
  )

  // Si se respondió la última abierta de la página 2, esa página queda vacía:
  // se retrocede sola en vez de mostrar "Sin resultados" con un "Anterior".
  useEffect(() => {
    if (lista && lista.data.length === 0 && page > 1) setPage((p) => p - 1)
  }, [lista, page])

  // Después de responder o cerrar: lista, KPIs y la pastilla del sidebar
  // (onCambio la refresca desde el dashboard) tienen que contar lo mismo.
  const recargar = () => {
    setReloadKey((k) => k + 1)
    onCambio?.()
  }

  const total = lista?.total ?? 0
  const desde = total === 0 ? 0 : (page - 1) * POR_PAGINA + 1
  const hasta = lista ? Math.min(page * POR_PAGINA, total) : 0
  const hayFiltros = estado !== '' || categoria !== '' || debounced !== ''

  // 404 en cualquiera de los dos pedidos = la API que está sirviendo no tiene
  // este módulo (frontend desplegado antes que la API). No es una caída: se
  // explica qué falta y se ofrece reintentar, en vez de dos cajas rojas.
  const moduloAusente = statusResumen === 404 || statusLista === 404
  const reintentar = (
    <button type="button" onClick={recargar} className="ds-hover" style={btnGhostSm}>
      <RefreshCw size={13} strokeWidth={2} aria-hidden="true" /> Reintentar
    </button>
  )

  if (moduloAusente) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <PageHeader
          title="Soporte"
          subtitle="Las consultas que mandan los negocios desde su panel. Todo lo que respondas acá les llega por mail y les queda en su historial."
        />
        <ModuloPendiente onReintentar={recargar} />
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <PageHeader
        title="Soporte"
        subtitle="Las consultas que mandan los negocios desde su panel. Todo lo que respondas acá les llega por mail y les queda en su historial."
      />

      {errorResumen ? (
        <ErrorBox msg="No se pudo cargar el resumen de soporte." action={reintentar} />
      ) : (
        <Grid>
          <Kpi
            label="Abiertas"
            value={resumen ? String(resumen.open) : '…'}
            accent={!!resumen && resumen.open > 0}
            hint={!resumen || resumen.open > 0 ? 'Esperan una respuesta del equipo' : 'Nada esperando respuesta'}
          />
          <Kpi label="Respondidas" value={resumen ? String(resumen.answered) : '…'} hint="Contestadas; ahora la pelota está del lado del negocio" />
          <Kpi label="Cerradas" value={resumen ? String(resumen.closed) : '…'} hint="Resueltas y archivadas" />
        </Grid>
      )}

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        {/* Estado como pestañas con el conteo al lado: es el filtro que se
            toca todo el tiempo y con el número ya se sabe si vale la pena
            entrar. Categoría y búsqueda quedan como controles comunes. */}
        <div role="group" aria-label="Estado" style={{ display: 'inline-flex', gap: 4, padding: 4, borderRadius: 12, background: 'var(--color-surface-alt)', border: '1px solid var(--color-border)' }}>
          {([...ESTADOS, ''] as (SupportRequestStatus | '')[]).map((s) => {
            const activo = estado === s
            const n = resumen ? (s === '' ? resumen.open + resumen.answered + resumen.closed : s === 'OPEN' ? resumen.open : s === 'ANSWERED' ? resumen.answered : resumen.closed) : null
            const label = s === '' ? 'Todas' : `${SUPPORT_STATUS_LABELS[s]}s`
            return (
              <button
                key={s || 'todas'}
                type="button"
                onClick={() => cambiarEstado(s)}
                aria-pressed={activo}
                className="ds-hover"
                style={{
                  height: 32, padding: '0 12px', borderRadius: 9, border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                  display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 13, fontWeight: 600,
                  background: activo ? 'var(--color-bg)' : 'transparent',
                  color: activo ? 'var(--color-text)' : 'var(--color-muted)',
                  boxShadow: activo ? 'var(--shadow-card)' : 'none',
                  transition: 'background 150ms ease, color 150ms ease',
                }}
              >
                {label}
                {n !== null && (
                  <span style={{ fontFamily: '"Geist Mono", monospace', fontSize: 11.5, fontWeight: 600, color: activo && s === 'OPEN' && n > 0 ? 'var(--color-primary)' : 'var(--color-subtle)' }}>{n}</span>
                )}
              </button>
            )
          })}
        </div>
        <select
          value={categoria}
          onChange={(e) => cambiarCategoria(e.target.value as SupportCategory | '')}
          aria-label="Categoría"
          className="ds-field"
          style={{ ...inputStyle, minWidth: 190 }}
        >
          <option value="">Todas las categorías</option>
          {CATEGORIAS.map((c) => <option key={c} value={c}>{SUPPORT_CATEGORY_LABELS[c]}</option>)}
        </select>
        <div style={{ position: 'relative', flex: 1, minWidth: 220, maxWidth: 380 }}>
          <Search size={16} strokeWidth={1.75} style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-muted)', pointerEvents: 'none' }} />
          <input
            type="search"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar por asunto o negocio…"
            aria-label="Buscar por asunto o negocio"
            className="ds-field"
            style={{ ...inputStyle, width: '100%', paddingLeft: 38 }}
          />
        </div>
      </div>

      {errorLista ? (
        <ErrorBox msg="No se pudieron cargar las consultas." action={reintentar} />
      ) : !lista ? (
        <Loader />
      ) : (
        // useFetch conserva la lista vieja mientras pide la nueva: se atenúa en
        // vez de reemplazarla por un spinner, así la página no salta de alto
        // con cada filtro.
        <Card noPad>
          <div style={{ opacity: loading ? 0.6 : 1, transition: 'opacity 150ms ease' }} aria-busy={loading || undefined}>
            {lista.data.length === 0 ? (
              hayFiltros ? (
                <Empty text={estado === 'OPEN' && !categoria && !debounced ? 'No hay consultas abiertas: nada espera respuesta.' : 'No hay consultas con esos filtros.'} />
              ) : (
                <div style={{ padding: '36px 16px', textAlign: 'center' }}>
                  <Inbox size={26} strokeWidth={1.5} aria-hidden="true" style={{ color: 'var(--color-subtle)' }} />
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-text)', marginTop: 10 }}>Todavía ningún negocio mandó una consulta</div>
                  <div style={{ fontSize: 13, color: 'var(--color-muted)', marginTop: 4, lineHeight: 1.5 }}>Cuando escriban desde Configuración → Soporte de su panel, aparecen acá y también llegan a soporte@orbita.site.</div>
                </div>
              )
            ) : (
              <Table
                head={['Nº', 'Negocio', 'Asunto', 'Quién', 'Estado', 'Última actividad', 'Acciones']}
                alignRight={[6]}
                rows={lista.data.map((r) => ({
                  key: r.id,
                  onClick: () => setAbierta(r.id),
                  cells: [
                    <span key="n" style={{ fontFamily: '"Geist Mono", monospace', fontWeight: 600, color: 'var(--color-text)', whiteSpace: 'nowrap' }}>#{r.number}</span>,
                    <div key="b" style={{ minWidth: 150 }}>
                      <div style={{ fontWeight: 600, color: 'var(--color-text)', marginBottom: 2 }}>{r.business.name}</div>
                      <div style={{ fontSize: 12, color: 'var(--color-muted)', fontFamily: '"Geist Mono", monospace' }}>{r.business.subdomain}.orbita.site</div>
                    </div>,
                    <div key="s" style={{ minWidth: 240, maxWidth: 420 }}>
                      <div style={{ fontWeight: 600, color: 'var(--color-text)', marginBottom: 5 }}>{r.subject}</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                        <Pill text={SUPPORT_CATEGORY_LABELS[r.category] ?? r.category} tone="gray" />
                        {/* El último mensaje, en una línea: dice si la pelota
                            está de este lado o del otro sin tener que abrir. */}
                        {r.lastMessage && (
                          <span style={{ fontSize: 12, color: 'var(--color-muted)', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {r.lastMessage.author === 'ADMIN' ? 'Órbita: ' : ''}{r.lastMessage.excerpt}
                          </span>
                        )}
                      </div>
                    </div>,
                    <span key="q" style={{ color: 'var(--color-body)' }}>{r.member.name}</span>,
                    <Pill key="e" text={SUPPORT_STATUS_LABELS[r.status] ?? r.status} tone={TONO_ESTADO[r.status] ?? 'gray'} />,
                    <span key="t" title={dateTime(r.lastMessageAt)} style={{ fontSize: 13, color: 'var(--color-body)', whiteSpace: 'nowrap' }}>{fechaRelativa(r.lastMessageAt)}</span>,
                    <button
                      key="a"
                      type="button"
                      onClick={(e) => { e.stopPropagation(); setAbierta(r.id) }}
                      aria-label={`Abrir consulta #${r.number}`}
                      className="ds-hover"
                      style={btnGhostSm}
                    >
                      Abrir
                    </button>,
                  ],
                }))}
              />
            )}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap', padding: '10px 18px', borderTop: '1px solid var(--color-border)', fontSize: 12.5, color: 'var(--color-muted)' }}>
            <span>{total === 0 ? 'Sin consultas' : total === 1 ? '1 consulta' : `${desde}–${hasta} de ${total}`}</span>
            <div style={{ display: 'flex', gap: 6 }}>
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                aria-label="Página anterior"
                className="ds-hover"
                style={{ ...btnGhostSm, opacity: page <= 1 ? 0.5 : 1 }}
              >
                <ChevronLeft size={14} strokeWidth={2} /> Anterior
              </button>
              <button
                type="button"
                onClick={() => setPage((p) => p + 1)}
                disabled={hasta >= total}
                aria-label="Página siguiente"
                className="ds-hover"
                style={{ ...btnGhostSm, opacity: hasta >= total ? 0.5 : 1 }}
              >
                Siguiente <ChevronRight size={14} strokeWidth={2} />
              </button>
            </div>
          </div>
        </Card>
      )}

      {resumen && <OpinionesManual capitulos={resumen.manual} />}

      {abierta && (
        <DrawerConsulta
          id={abierta}
          onClose={() => setAbierta(null)}
          onCambio={recargar}
        />
      )}
    </div>
  )
}

// ─── Detalle: panel lateral ──────────────────────────────────────────────────
// Drawer y no ModalShell: el hilo puede ser largo y se responde leyéndolo, así
// que conviene alto completo con el formulario fijo abajo; el ModalShell de
// ui.tsx es de 460px y para formularios cortos.

const DRAWER_CSS = `
  .sa-drawer-velo {
    position: fixed; inset: 0; z-index: 80;
    background: rgba(15,23,42,0.45); backdrop-filter: blur(2px);
    animation: sa-drawer-fade 180ms ease-out;
  }
  .sa-drawer {
    position: fixed; top: 0; right: 0; bottom: 0; z-index: 81;
    width: 560px; max-width: 100%;
    display: flex; flex-direction: column;
    background: var(--color-bg);
    border-left: 1px solid var(--color-border);
    box-shadow: -12px 0 40px rgba(15,23,42,0.18);
    animation: sa-drawer-in 240ms cubic-bezier(0.4, 0, 0.2, 1);
  }
  @keyframes sa-drawer-in { from { transform: translateX(100%); } to { transform: none; } }
  @keyframes sa-drawer-fade { from { opacity: 0; } to { opacity: 1; } }
  @media (max-width: 768px) {
    .sa-drawer { width: 100%; border-left: none; }
  }
  @media (prefers-reduced-motion: reduce) {
    .sa-drawer, .sa-drawer-velo { animation: none; }
  }
`

function DrawerConsulta({ id, onClose, onCambio }: { id: string; onClose: () => void; onCambio: () => void }) {
  const router = useRouter()
  const [reloadKey, setReloadKey] = useState(0)
  const { data, error, status } = useFetch(() => platformApi.supportRequest(id), [id, reloadKey])
  const [respuesta, setRespuesta] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [cambiandoEstado, setCambiandoEstado] = useState(false)
  const [errorAccion, setErrorAccion] = useState('')
  const [confirmarCierre, setConfirmarCierre] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)
  const tituloRef = useRef<HTMLHeadingElement>(null)
  const cuerpoRef = useRef<HTMLDivElement>(null)
  const formRef = useRef<HTMLFormElement>(null)
  // Recién después de mandar una respuesta se baja el hilo hasta el final,
  // para ver lo que uno acaba de escribir. Al abrir NO: una consulta se lee
  // desde el principio.
  const bajarAlFinalRef = useRef(false)

  // Foco al título al abrir y de vuelta a la fila (o al botón "Abrir") al
  // cerrar, que es donde el teclado estaba. Mientras está abierto, la página
  // de atrás no scrollea.
  useEffect(() => {
    const previo = document.activeElement as HTMLElement | null
    tituloRef.current?.focus()
    const overflowPrevio = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = overflowPrevio
      previo?.focus?.()
    }
  }, [])

  // Esc cierra (primero el modal de confirmación si está abierto, después el
  // drawer), y Tab queda dentro del panel: con aria-modal la lectora ya no
  // sale, pero el foco visual sí se iba a la tabla de atrás.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        if (confirmarCierre) setConfirmarCierre(false)
        else onClose()
        return
      }
      if (e.key !== 'Tab' || !panelRef.current) return
      const focables = Array.from(panelRef.current.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ))
      if (focables.length === 0) return
      const primero = focables[0]
      const ultimo = focables[focables.length - 1]
      const activo = document.activeElement as HTMLElement | null
      if (e.shiftKey && (activo === primero || !activo || !focables.includes(activo))) {
        e.preventDefault()
        ultimo.focus()
      } else if (!e.shiftKey && activo === ultimo) {
        e.preventDefault()
        primero.focus()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [confirmarCierre, onClose])

  useEffect(() => {
    if (!data || !bajarAlFinalRef.current || !cuerpoRef.current) return
    bajarAlFinalRef.current = false
    cuerpoRef.current.scrollTo({ top: cuerpoRef.current.scrollHeight })
  }, [data])

  const refrescar = () => {
    setReloadKey((k) => k + 1)
    onCambio()
  }

  async function enviar(e: React.FormEvent) {
    e.preventDefault()
    setErrorAccion('')
    const texto = respuesta.trim()
    if (texto.length < MIN_RESPUESTA) {
      setErrorAccion(`Escribí al menos ${MIN_RESPUESTA} caracteres: una respuesta de dos palabras no le sirve al negocio.`)
      return
    }
    setEnviando(true)
    try {
      await platformApi.supportReply(id, texto)
      setRespuesta('')
      bajarAlFinalRef.current = true
      refrescar()
    } catch (err) {
      setErrorAccion(err instanceof Error ? err.message : 'No se pudo enviar la respuesta.')
    } finally {
      setEnviando(false)
    }
  }

  async function reabrir() {
    setErrorAccion('')
    setCambiandoEstado(true)
    try {
      await platformApi.supportStatus(id, 'OPEN')
      refrescar()
    } catch (err) {
      setErrorAccion(err instanceof Error ? err.message : 'No se pudo reabrir la consulta.')
    } finally {
      setCambiandoEstado(false)
    }
  }

  const faltan = Math.max(0, MIN_RESPUESTA - respuesta.trim().length)

  return (
    <>
      <style>{DRAWER_CSS}</style>
      <div className="sa-drawer-velo" onClick={onClose} aria-hidden="true" />
      <div
        ref={panelRef}
        className="sa-drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby="sa-soporte-titulo"
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, padding: '18px 22px 14px', borderBottom: '1px solid var(--color-border)' }}>
          <div style={{ minWidth: 0 }}>
            <h2
              id="sa-soporte-titulo"
              ref={tituloRef}
              tabIndex={-1}
              style={{ margin: 0, fontSize: 17, fontWeight: 700, color: 'var(--color-text)', letterSpacing: '-0.01em', outline: 'none' }}
            >
              {data ? <><span style={{ fontFamily: '"Geist Mono", monospace', color: 'var(--color-muted)', fontWeight: 600 }}>#{data.number}</span> {data.subject}</> : 'Consulta'}
            </h2>
            {data && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
                <Pill text={SUPPORT_STATUS_LABELS[data.status] ?? data.status} tone={TONO_ESTADO[data.status] ?? 'gray'} />
                <Pill text={SUPPORT_CATEGORY_LABELS[data.category] ?? data.category} tone="gray" />
                <span style={{ fontSize: 12, color: 'var(--color-subtle)' }}>
                  {data.messagesCount === 1 ? '1 mensaje' : `${data.messagesCount} mensajes`}
                </span>
              </div>
            )}
          </div>
          {/* 44px: es el único control del encabezado y en celular se toca con
              el pulgar. */}
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="ds-hover"
            style={{ width: 44, height: 44, marginTop: -8, marginRight: -10, borderRadius: 10, border: 'none', background: 'transparent', color: 'var(--color-muted)', display: 'grid', placeItems: 'center', fontFamily: 'inherit', flexShrink: 0 }}
          >
            <X size={18} />
          </button>
        </div>

        <div ref={cuerpoRef} style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '18px 22px 22px', background: 'var(--color-surface)' }}>
          {error ? (
            <ErrorBox
              msg={status === 404 ? 'Esta consulta ya no existe o no se pudo encontrar.' : 'No se pudo cargar la consulta.'}
              action={status === 404 ? undefined : (
                <button type="button" onClick={() => setReloadKey((k) => k + 1)} className="ds-hover" style={btnGhostSm}>
                  <RefreshCw size={13} strokeWidth={2} aria-hidden="true" /> Reintentar
                </button>
              )}
            />
          ) : !data ? (
            <Loader />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              <FichaConsulta data={data} onIrAlNegocio={() => router.push(`/superadmin/negocios/${data.business.id}`)} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {data.messages.map((m) => <Burbuja key={m.id} mensaje={m} />)}
              </div>
            </div>
          )}
        </div>

        {data && (
          <form ref={formRef} onSubmit={enviar} style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '14px 22px 18px', borderTop: '1px solid var(--color-border)', background: 'var(--color-bg)' }}>
            {errorAccion && <ErrorBox msg={errorAccion} />}
            {data.status === 'CLOSED' && (
              <p style={{ margin: 0, fontSize: 12.5, color: 'var(--color-muted)', lineHeight: 1.5 }}>
                La consulta está cerrada. Si respondés igual, vuelve a quedar como respondida.
              </p>
            )}
            <label htmlFor="sa-soporte-respuesta" style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text)' }}>Respuesta</label>
            <textarea
              id="sa-soporte-respuesta"
              value={respuesta}
              onChange={(e) => setRespuesta(e.target.value)}
              placeholder="Escribile al negocio. Le llega por mail y le queda en el panel."
              rows={4}
              maxLength={MAX_RESPUESTA}
              disabled={enviando}
              // Ctrl/Cmd + Enter manda, como en cualquier cliente de mail: se
              // responde con las manos en el teclado. Enter solo sigue
              // haciendo salto de línea.
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && !enviando) {
                  e.preventDefault()
                  formRef.current?.requestSubmit()
                }
              }}
              className="ds-field"
              style={{ ...inputStyle, height: 'auto', minHeight: 96, padding: '10px 13px', lineHeight: 1.5, resize: 'vertical' }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 12, color: 'var(--color-subtle)' }}>
                {respuesta.trim().length === 0
                  ? `Mínimo ${MIN_RESPUESTA} caracteres`
                  : faltan > 0
                    ? `Faltan ${faltan} caracteres`
                    : `${respuesta.trim().length} / ${MAX_RESPUESTA} · Ctrl + Enter envía`}
              </span>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {data.status === 'CLOSED' ? (
                  <button type="button" onClick={reabrir} disabled={cambiandoEstado || enviando} className="ds-hover" style={btnGhost}>
                    <RotateCcw size={15} strokeWidth={2} /> {cambiandoEstado ? 'Reabriendo…' : 'Reabrir'}
                  </button>
                ) : (
                  <button type="button" onClick={() => setConfirmarCierre(true)} disabled={cambiandoEstado || enviando} className="ds-hover" style={btnGhost}>
                    <CircleCheck size={15} strokeWidth={2} /> Cerrar consulta
                  </button>
                )}
                <button type="submit" disabled={enviando} className="ds-hover" style={btnPrimary}>
                  <Send size={15} strokeWidth={2} /> {enviando ? 'Enviando…' : 'Enviar respuesta'}
                </button>
              </div>
            </div>
          </form>
        )}

        {confirmarCierre && data && (
          <ConfirmModal
            title={`¿Cerrar la consulta #${data.number}?`}
            body="Queda como resuelta y deja de contar entre las pendientes. Si el negocio vuelve a escribir en el mismo hilo, se reabre sola."
            confirmLabel="Cerrar consulta"
            onCancel={() => setConfirmarCierre(false)}
            onConfirm={async () => {
              await platformApi.supportStatus(id, 'CLOSED')
              setConfirmarCierre(false)
              refrescar()
            }}
          />
        )}
      </div>
    </>
  )
}

// La API que está sirviendo no tiene /platform/support: el panel se desplegó
// (Vercel) antes que la API (Cloud Run, a mano con deploy.sh). Es un estado
// esperable en cada release que toque apps/api, no una falla: se dice qué
// falta y a quién le toca, en el tono del equipo (esta pantalla es interna).
function ModuloPendiente({ onReintentar }: { onReintentar: () => void }) {
  const mono: React.CSSProperties = { fontFamily: '"Geist Mono", monospace', fontSize: 12.5 }
  return (
    <Card>
      <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <div style={{ width: 44, height: 44, borderRadius: 12, display: 'grid', placeItems: 'center', flexShrink: 0, background: 'var(--color-warning-bg)', color: 'var(--color-warning)' }}>
          <CloudOff size={22} strokeWidth={1.75} aria-hidden="true" />
        </div>
        <div style={{ flex: 1, minWidth: 240 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--color-text)', letterSpacing: '-0.01em' }}>
            La API en producción todavía no tiene el módulo de Soporte
          </div>
          <p style={{ margin: '6px 0 0', fontSize: 13.5, color: 'var(--color-body)', lineHeight: 1.55, maxWidth: 640 }}>
            El panel ya está actualizado, pero la API que está sirviendo es anterior a este módulo y responde 404 en <code style={mono}>/platform/support</code>.
            Falta desplegar la API desde <code style={mono}>apps/api</code> con <code style={mono}>deploy/deploy.sh</code> (ver DEPLOYMENT.md).
          </p>
          <p style={{ margin: '8px 0 0', fontSize: 13, color: 'var(--color-muted)', lineHeight: 1.55, maxWidth: 640 }}>
            Mientras tanto no se pierde nada: las consultas que manden los negocios siguen llegando por mail a soporte@orbita.site, y las que se guarden en la base van a aparecer acá apenas la API nueva esté sirviendo.
          </p>
          <div style={{ marginTop: 14 }}>
            <button type="button" onClick={onReintentar} className="ds-hover" style={btnGhost}>
              <RefreshCw size={15} strokeWidth={2} aria-hidden="true" /> Volver a intentar
            </button>
          </div>
        </div>
      </div>
    </Card>
  )
}

// Quién pregunta y desde dónde, arriba del hilo: para responder bien hay que
// tener la ficha del negocio a un clic (plan, dominio, si está pausado).
function FichaConsulta({ data, onIrAlNegocio }: { data: AdminSupportDetail; onIrAlNegocio: () => void }) {
  const fila: React.CSSProperties = { display: 'grid', gridTemplateColumns: '96px minmax(0, 1fr)', gap: 10, alignItems: 'baseline', fontSize: 13 }
  const etiqueta: React.CSSProperties = { color: 'var(--color-muted)', fontWeight: 500 }
  const enlace: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 5, color: 'var(--color-primary)', fontWeight: 600, textDecoration: 'none', minHeight: 24 }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '14px 16px', background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 12 }}>
      <div style={fila}>
        <span style={etiqueta}>Negocio</span>
        <span style={{ minWidth: 0 }}>
          <a
            href={`/superadmin/negocios/${data.business.id}`}
            onClick={(e) => { e.preventDefault(); onIrAlNegocio() }}
            className="ds-link"
            style={enlace}
          >
            {data.business.name} <ExternalLink size={13} strokeWidth={2} aria-hidden="true" />
          </a>
          <span style={{ display: 'block', fontSize: 12, color: 'var(--color-muted)', fontFamily: '"Geist Mono", monospace' }}>{data.business.subdomain}.orbita.site</span>
        </span>
      </div>
      <div style={fila}>
        <span style={etiqueta}>Quién</span>
        <span style={{ minWidth: 0 }}>
          <span style={{ color: 'var(--color-text)', fontWeight: 600 }}>{data.member.name}</span>
          <a href={`mailto:${data.member.email}`} className="ds-link" style={{ ...enlace, fontWeight: 500, fontSize: 12.5, display: 'flex', wordBreak: 'break-all' }}>
            <Mail size={13} strokeWidth={2} aria-hidden="true" /> {data.member.email}
          </a>
        </span>
      </div>
      {data.contactPhone && (
        <div style={fila}>
          <span style={etiqueta}>Teléfono</span>
          <a href={`tel:${data.contactPhone.replace(/\s+/g, '')}`} className="ds-link" style={{ ...enlace, fontWeight: 500 }}>
            <Phone size={13} strokeWidth={2} aria-hidden="true" /> {data.contactPhone}
          </a>
        </div>
      )}
      <div style={fila}>
        <span style={etiqueta}>Abierta el</span>
        <span style={{ color: 'var(--color-body)' }}>{dateTime(data.createdAt)}</span>
      </div>
      <div style={fila}>
        <span style={etiqueta}>Última actividad</span>
        <span style={{ color: 'var(--color-body)' }}>{dateTime(data.lastMessageAt)}</span>
      </div>
    </div>
  )
}

// El hilo se lee como un chat: el negocio a la izquierda, Órbita a la
// derecha. El color de fondo ya dice quién habla, el nombre lo confirma.
function Burbuja({ mensaje }: { mensaje: SupportMessageDto }) {
  const esOrbita = mensaje.author === 'ADMIN'
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: esOrbita ? 'flex-end' : 'flex-start' }}>
      <div style={{
        maxWidth: '88%', minWidth: 0,
        padding: '10px 14px', borderRadius: 14,
        borderBottomRightRadius: esOrbita ? 4 : 14, borderBottomLeftRadius: esOrbita ? 14 : 4,
        background: esOrbita ? 'var(--color-primary-bg)' : 'var(--color-surface-alt)',
        border: '1px solid var(--color-border)',
      }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: esOrbita ? 'var(--color-primary)' : 'var(--color-text)', marginBottom: 4 }}>
          {esOrbita ? `${mensaje.authorName} · Órbita` : mensaje.authorName}
        </div>
        <div style={{ fontSize: 13.5, color: 'var(--color-body)', lineHeight: 1.55, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{mensaje.body}</div>
        {mensaje.attachments.length > 0 && <Adjuntos items={mensaje.attachments} />}
      </div>
      <div style={{ fontSize: 11, color: 'var(--color-subtle)', marginTop: 4, padding: '0 4px' }}>{dateTime(mensaje.createdAt)}</div>
    </div>
  )
}

// Solo se aceptan imágenes al subir (ver support.controller), pero `type` es
// opcional en el JSON: sin tipo se asume imagen; con un tipo que no lo sea se
// muestra como link con nombre antes que una miniatura rota.
const esImagen = (a: SupportAttachment) => !a.type || a.type.startsWith('image/')

function Adjuntos({ items }: { items: SupportAttachment[] }) {
  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
      {items.map((a, i) => esImagen(a) ? (
        <a
          key={`${a.url}-${i}`}
          href={a.url}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Abrir adjunto ${a.name} en otra pestaña`}
          title={a.name}
          className="ds-hover"
          style={{ display: 'block', width: 72, height: 72, borderRadius: 10, overflow: 'hidden', border: '1px solid var(--color-border)', background: 'var(--color-bg)' }}
        >
          {/* Bucket público de Supabase, fuera de los dominios de next/image. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={a.url} alt={a.name} loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
        </a>
      ) : (
        <a
          key={`${a.url}-${i}`}
          href={a.url}
          target="_blank"
          rel="noopener noreferrer"
          className="ds-hover"
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, height: 32, padding: '0 10px', borderRadius: 8, border: '1px solid var(--color-border)', background: 'var(--color-bg)', fontSize: 12, fontWeight: 500, color: 'var(--color-body)', textDecoration: 'none' }}
        >
          <Paperclip size={13} strokeWidth={2} aria-hidden="true" /> {a.name}
        </a>
      ))}
    </div>
  )
}

// ─── Qué dice el manual ──────────────────────────────────────────────────────
function OpinionesManual({ capitulos }: { capitulos: SupportManualChapter[] }) {
  const conVotos = capitulos
    .filter((c) => c.helpful + c.notHelpful > 0)
    // Los más votados primero: es donde la opinión pesa más.
    .sort((a, b) => (b.helpful + b.notHelpful) - (a.helpful + a.notHelpful))
  const comentarios = capitulos
    .flatMap((c) => c.comments.map((k) => ({ ...k, chapterId: c.chapterId })))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))

  return (
    <Card
      title="Qué dice el manual"
      subtitle="Lo que marcan los negocios en cada capítulo del manual del panel: si les sirvió o no, y qué comentaron"
      noPad
    >
      {conVotos.length === 0 ? (
        <Empty text="Todavía nadie calificó capítulos del manual." />
      ) : (
        <>
          <Table
            head={['Capítulo', 'Útil', 'No útil', 'Cómo viene']}
            alignRight={[1, 2]}
            rows={conVotos.map((c) => {
              const total = c.helpful + c.notHelpful
              const pct = Math.round((c.helpful / total) * 100)
              return {
                key: c.chapterId,
                cells: [
                  <span key="c" style={{ fontWeight: 600, color: 'var(--color-text)' }}>{tituloCapitulo(c.chapterId)}</span>,
                  <span key="u" style={{ fontFamily: '"Geist Mono", monospace', color: c.helpful === 0 ? 'var(--color-subtle)' : 'var(--color-text)' }}>{c.helpful}</span>,
                  <span key="n" style={{ fontFamily: '"Geist Mono", monospace', color: c.notHelpful === 0 ? 'var(--color-subtle)' : 'var(--color-text)' }}>{c.notHelpful}</span>,
                  <BarraUtil key="b" pct={pct} />,
                ],
              }
            })}
          />
          <div style={{ borderTop: '1px solid var(--color-border)' }}>
            <div style={{ padding: '12px 18px 4px', fontSize: 12, fontWeight: 600, color: 'var(--color-muted)' }}>
              {comentarios.length === 0 ? 'Sin comentarios por ahora' : comentarios.length === 1 ? '1 comentario' : `${comentarios.length} comentarios`}
            </div>
            {comentarios.map((k, i) => (
              <div key={`${k.chapterId}-${k.createdAt}-${i}`} style={{ padding: '12px 18px', borderTop: i === 0 ? 'none' : '1px solid var(--color-border)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 6 }}>
                  <span style={{ fontWeight: 600, color: 'var(--color-text)', fontSize: 13 }}>{k.businessName}</span>
                  <span style={{ fontSize: 12, color: 'var(--color-subtle)' }}>{date(k.createdAt)}</span>
                  <Chip text={tituloCapitulo(k.chapterId)} tone="gray" />
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 600, color: k.helpful ? 'var(--color-success)' : 'var(--color-error)' }}>
                    {k.helpful ? <ThumbsUp size={13} strokeWidth={2} aria-hidden="true" /> : <ThumbsDown size={13} strokeWidth={2} aria-hidden="true" />}
                    {k.helpful ? 'Útil' : 'No útil'}
                  </span>
                </div>
                <p style={{ margin: 0, fontSize: 13.5, color: 'var(--color-body)', lineHeight: 1.55, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{k.comment}</p>
              </div>
            ))}
          </div>
        </>
      )}
    </Card>
  )
}

// Dos tramos y no una barra sola: "80% útil" con el 20% en rojo al lado se
// lee de un vistazo, y el color nunca es el único canal porque el número va
// escrito al lado.
function BarraUtil({ pct }: { pct: number }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 180 }}>
      <div role="img" aria-label={`${pct}% útil`} style={{ display: 'flex', flex: 1, maxWidth: 160, height: 6, borderRadius: 999, overflow: 'hidden', background: 'var(--color-surface-alt)' }}>
        <div style={{ width: `${pct}%`, background: 'var(--color-success)' }} />
        <div style={{ width: `${100 - pct}%`, background: 'var(--color-error)', opacity: 0.85 }} />
      </div>
      <span aria-hidden="true" style={{ fontSize: 12.5, fontWeight: 600, fontFamily: '"Geist Mono", monospace', color: 'var(--color-text)', whiteSpace: 'nowrap' }}>{pct}% útil</span>
    </div>
  )
}
