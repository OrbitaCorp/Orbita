import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import type { VistaMensaje } from './components/MsgTabs'
import { BandejaLista } from './components/BandejaLista'
import { ChatPanel } from './components/ChatPanel'
import type { Conversacion, Plantilla, CategoriaPlantilla } from './mock/mensajes.mock'
import { listConversations, updateConversation, listMessageTemplates, type ConversationRow, type MessageTemplateRow } from '@/lib/api'

// El backend usa el enum en mayúsculas; el resto de esta pantalla trabaja en
// minúsculas — mismo criterio que Plantillas.tsx.
function aPlantilla(t: MessageTemplateRow): Plantilla {
  return { id: t.id, nombre: t.name, texto: t.text, categoria: t.category.toLowerCase() as CategoriaPlantilla }
}

const SK: React.CSSProperties = { background: 'var(--color-surface-alt)', borderRadius: 8 }

// Cada ~2.5s mientras la bandeja está montada (el dueño/staff tiene la
// pantalla de Mensajes abierta) — se corta al salir, nunca sigue sondeando
// en segundo plano.
const POLL_MS = 2500

function tiempoCorto(iso: string): string {
  const d = new Date(iso)
  const hoy = new Date()
  const mismoDia = d.toDateString() === hoy.toDateString()
  if (mismoDia) return d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })
  const ayer = new Date(hoy); ayer.setDate(hoy.getDate() - 1)
  if (d.toDateString() === ayer.toDateString()) return 'Ayer'
  return d.toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })
}

function aConversacion(c: ConversationRow): Conversacion {
  return {
    id: c.id,
    customerId: c.customerId,
    cliente: c.customerName,
    email: c.customerEmail ?? '',
    preview: c.lastMessage?.text ?? '',
    tiempo: tiempoCorto(c.lastMessage?.createdAt ?? c.updatedAt),
    unread: c.isUnread,
    archivado: c.isArchived,
    // La lista no resuelve "de qué pedido se está hablando" — hace falta leer
    // los mensajes para eso, y no vale la pena traerlos todos solo para el
    // preview. El chip de pedido SÍ es real dentro del chat (ChatHeader).
    pedido: null,
  }
}

function BandejaSkeleton() {
  const panelH = 'calc(100vh - 138px)'
  return (
    <div style={{ display: 'flex', height: panelH, minHeight: 480, border: '1px solid var(--color-border)', borderRadius: 12, overflow: 'hidden', background: 'var(--color-bg)' }}>
      {/* Lista skeleton */}
      <div style={{ width: 296, flexShrink: 0, borderRight: '1px solid var(--color-border)', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {/* Título */}
        <div style={{ ...SK, height: 14, width: 90 }} />
        {/* Buscador */}
        <div style={{ ...SK, height: 34, borderRadius: 8 }} />
        {/* Pills */}
        <div style={{ display: 'flex', gap: 6 }}>
          {[56, 70, 84].map((w, i) => <div key={i} style={{ ...SK, height: 26, width: w, borderRadius: 9999 }} />)}
        </div>
        {/* Conversaciones */}
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'center', paddingTop: 6 }}>
            <div style={{ ...SK, width: 36, height: 36, borderRadius: '50%', flexShrink: 0 }} />
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ ...SK, height: 11, width: '65%' }} />
              <div style={{ ...SK, height: 10, width: '90%' }} />
            </div>
          </div>
        ))}
      </div>
      {/* Chat panel skeleton */}
      <div style={{ flex: 1, background: 'var(--color-surface)', display: 'flex', flexDirection: 'column' }}>
        {/* Header */}
        <div style={{ height: 57, borderBottom: '1px solid var(--color-border)', padding: '0 20px', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ ...SK, width: 36, height: 36, borderRadius: '50%' }} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ ...SK, height: 12, width: 120 }} />
            <div style={{ ...SK, height: 10, width: 80 }} />
          </div>
        </div>
        {/* Mensajes */}
        <div style={{ flex: 1, padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
          {[180, 220, 140, 200, 160].map((w, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: i % 2 === 0 ? 'flex-start' : 'flex-end' }}>
              <div style={{ ...SK, height: 40, width: w, borderRadius: 12 }} />
            </div>
          ))}
        </div>
        {/* Composer */}
        <div style={{ height: 60, borderTop: '1px solid var(--color-border)', margin: '0 16px 12px', borderRadius: 10, ...SK }} />
      </div>
    </div>
  )
}

// ─── Vista Bandeja (split panel) ─────────────────────────────────────────────

interface BandejaProps {
  convId:   string | null
  onAbrir:  (id: string) => void
  onCerrar: () => void
  ir:       (v: VistaMensaje) => void
  onToast:  (m: string) => void
  onPerfil: () => void
}

function BandejaMensajes({ convId, onAbrir, onCerrar, ir, onToast, onPerfil }: BandejaProps) {
  const [loading, setLoading] = useState(true)
  const [rows, setRows] = useState<ConversationRow[]>([])
  const [plantillas, setPlantillas] = useState<Plantilla[]>([])

  useEffect(() => {
    let cancelado = false
    const cargar = () => listConversations().then(r => { if (!cancelado) setRows(r) }).catch(() => {}).finally(() => { if (!cancelado) setLoading(false) })
    cargar()
    const interval = setInterval(cargar, POLL_MS)
    // Mismo motivo que ChatPanel.tsx: el navegador throttlea los timers de
    // una pestaña sin foco — sin esto, la lista de conversaciones quedaba
    // vieja hasta el próximo tick real al volver a esta pestaña.
    const alVolver = () => { if (document.visibilityState === 'visible') cargar() }
    document.addEventListener('visibilitychange', alVolver)
    window.addEventListener('focus', alVolver)
    // Las plantillas no necesitan el mismo sondeo agresivo que las
    // conversaciones — se traen una vez al entrar a la bandeja.
    listMessageTemplates().then(r => { if (!cancelado) setPlantillas(r.map(aPlantilla)) }).catch(() => {})
    return () => {
      cancelado = true
      clearInterval(interval)
      document.removeEventListener('visibilitychange', alVolver)
      window.removeEventListener('focus', alVolver)
    }
  }, [])

  if (loading) return <BandejaSkeleton />

  const conversaciones = rows.map(aConversacion)
  const activaCV = conversaciones.find((cv) => cv.id === convId) ?? null

  // Abrir una conversación = navegación real (cambia la URL vía ?conv=<id>).
  // Marcarla leída de verdad lo hace el backend cuando ChatPanel pide los
  // mensajes — acá solo se limpia el punto azul al toque, para que no quede
  // colgado hasta el próximo sondeo.
  const handleSelect = (id: string) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, isUnread: false } : r)))
    onAbrir(id)
  }

  const handleArchivar = async (id: string) => {
    const cv = rows.find((r) => r.id === id)
    if (!cv) return
    const nuevoArchivado = !cv.isArchived
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, isArchived: nuevoArchivado } : r)))
    if (convId === id) onCerrar()
    onToast(nuevoArchivado ? 'Conversación archivada' : 'Conversación desarchivada')
    try {
      await updateConversation(id, { isArchived: nuevoArchivado })
    } catch {
      // Revertir si el backend lo rechazó -- no queda un estado optimista mintiendo.
      setRows((prev) => prev.map((r) => (r.id === id ? { ...r, isArchived: !nuevoArchivado } : r)))
    }
  }

  return (
    <>
      {/* Mobile: Estado 1 (lista) y Estado 2 (chat) son excluyentes; ambos quedan montados
          para conservar filtro y scroll de la lista al volver. Desktop: split sin cambios. */}
      <style>{`
        .msg-list { width: 296px; flex-shrink: 0; }
        .msg-chat { display: flex; flex: 1; min-width: 0; }
        @media (max-width: 768px) {
          .msg-list { width: 100% !important; }
          .msg-split.has-conv .msg-list { display: none !important; }
          .msg-split:not(.has-conv) .msg-chat { display: none !important; }
        }
      `}</style>
      <div className={`msg-split ${activaCV ? 'has-conv' : ''}`} style={{ display: 'flex', height: 'calc(100vh - 138px)', minHeight: 480, border: '1px solid var(--color-border)', borderRadius: 12, overflow: 'hidden', background: 'var(--color-bg)' }}>
        <div className="msg-list">
          <BandejaLista conversaciones={conversaciones} activaId={convId} onSelect={handleSelect} onArchivar={handleArchivar} />
        </div>
        <div className="msg-chat">
          <ChatPanel cv={activaCV} onToast={onToast} onPerfil={onPerfil} onArchivar={handleArchivar} plantillas={plantillas} onIrAPlantillas={() => ir('plantillas')} />
        </div>
      </div>
    </>
  )
}

// ─── Hub ─────────────────────────────────────────────────────────────────────

export function MensajesHub() {
  const router  = useRouter()
  const { vista } = router.query
  const convId = (router.query.conv as string) ?? null
  const [toast, setToast] = useState<string | null>(null)

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 3000)
    return () => clearTimeout(t)
  }, [toast])

  const ir = (v: VistaMensaje) => {
    const { vista: _v, conv: _c, ...rest } = router.query
    const q: Record<string, string | string[] | undefined> = { ...rest }
    if (v !== 'bandeja') q.vista = v
    router.push({ query: q })
  }

  const abrirConv = (id: string) => router.push({ query: { ...router.query, conv: id } })
  const cerrarConv = () => {
    const { conv: _c, ...rest } = router.query
    router.push({ query: rest })
  }

  const irPerfil = () => {
    const { negocioId, moduloPadre } = router.query
    router.push({ query: { negocioId: negocioId as string, moduloPadre: moduloPadre as string, seccion: 'clientes', vista: 'detalle', id: 'c1' } })
  }

  const esPlantillas = vista === 'plantillas'

  return (
    <div className="msg-hub" style={{ padding: '24px 32px', maxWidth: 1280, width: '100%', margin: '0 auto', boxSizing: 'border-box' }}>
      <style>{`@media (max-width: 768px) { .msg-hub { padding: 16px !important; } }`}</style>
      {esPlantillas
        ? <PlantillasInline onToast={setToast} />
        : <BandejaMensajes convId={convId} onAbrir={abrirConv} onCerrar={cerrarConv} ir={ir} onToast={setToast} onPerfil={irPerfil} />
      }
      {toast && (
        <div style={{ position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', zIndex: 9000, background: 'var(--color-text)', color: 'var(--color-bg)', padding: '10px 18px', borderRadius: 8, fontSize: 13, fontWeight: 500, boxShadow: '0 4px 16px rgba(0,0,0,.2)', whiteSpace: 'nowrap' }}>
          {toast}
        </div>
      )}
    </div>
  )
}

import { PlantillasMensajes as PlantillasInline } from './Plantillas'

export default MensajesHub
