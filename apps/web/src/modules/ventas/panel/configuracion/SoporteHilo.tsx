// src/modules/ventas/panel/configuracion/SoporteHilo.tsx
//
// Detalle de una consulta: cabecera, la conversación completa y el cuadro
// para responder. Se ve dentro de Soporte.tsx cuando la URL trae
// ?consulta=<id>; el padre se encarga de la navegación (volver, lista) y de
// anotar en localStorage hasta dónde se leyó, por eso este componente solo
// avisa con onDetalle cuando tiene datos nuevos.
//
// Los estilos de la conversación (.sop-msg, .sop-hilo) viven en el <style>
// de Soporte.tsx, que es quien siempre está montado cuando esto se ve.

import { useEffect, useId, useRef, useState } from 'react'
import { Lock, Send, User } from 'lucide-react'
import { Card } from '@/design-system/components/Card'
import { Button } from '@/design-system/components/Button'
import { Volver } from '../_shared/Volver'
import {
    ApiError, panelGetSupportRequest, panelReplySupportRequest, panelUploadSupportAttachment,
    type SupportAttachment, type SupportMessage, type SupportRequestDetail,
} from '@/lib/api'
import { SoporteAdjuntos, agregarAdjuntos, type AdjuntoLocal } from './SoporteAdjuntos'
import { EstadoPill, categoriaDe, fechaCompleta } from './SoporteComun'

export function SoporteHilo({
    id,
    onVolver,
    onDetalle,
}: {
    id: string
    onVolver: () => void
    /** Cada vez que hay un detalle fresco (al cargar y al responder). */
    onDetalle: (detalle: SupportRequestDetail, motivo: 'carga' | 'respuesta') => void
}) {
    const [detalle, setDetalle] = useState<SupportRequestDetail | null>(null)
    const [errorCarga, setErrorCarga] = useState<string | null>(null)
    const [intento, setIntento] = useState(0)

    const [respuesta, setRespuesta] = useState('')
    const [adjuntos, setAdjuntos] = useState<AdjuntoLocal[]>([])
    const [errorAdjuntos, setErrorAdjuntos] = useState<string | null>(null)
    const [errorRespuesta, setErrorRespuesta] = useState<string | null>(null)
    const [errorEnvio, setErrorEnvio] = useState<string | null>(null)
    const [enviando, setEnviando] = useState(false)
    const [progreso, setProgreso] = useState<string | null>(null)

    const textareaRef = useRef<HTMLTextAreaElement>(null)
    const respuestaId = useId()
    const errorRespuestaId = useId()

    useEffect(() => {
        let vivo = true
        setDetalle(null)
        setErrorCarga(null)
        panelGetSupportRequest(id)
            .then(d => {
                if (!vivo) return
                setDetalle(d)
                onDetalle(d, 'carga')
            })
            .catch(e => {
                if (!vivo) return
                setErrorCarga(e instanceof ApiError ? e.message : 'No pudimos abrir la consulta. Probá de nuevo en un momento.')
            })
        return () => { vivo = false }
        // onDetalle cambia con cada render del padre; volver a pedir el hilo
        // por eso sería pegarle a la API sin motivo. Solo el id (o reintentar) recarga.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [id, intento])

    // Se calcula fuera del updater de setState: agregarAdjuntos crea object
    // URLs, y un updater corre dos veces en StrictMode (quedaría una colgada).
    function agregar(archivos: File[]) {
        const r = agregarAdjuntos(adjuntos, archivos)
        setAdjuntos(r.lista)
        setErrorAdjuntos(r.error)
    }

    function quitar(idAdjunto: string) {
        setAdjuntos(adjuntos.filter(a => a.id !== idAdjunto))
        setErrorAdjuntos(null)
    }

    function onPaste(e: React.ClipboardEvent<HTMLTextAreaElement>) {
        const files = Array.from(e.clipboardData?.files ?? []).filter(f => f.type.startsWith('image/'))
        if (files.length === 0) return
        e.preventDefault()
        agregar(files)
    }

    async function responder() {
        if (enviando || !detalle) return
        const texto = respuesta.trim()
        if (texto.length < 3) {
            setErrorRespuesta('Escribí tu respuesta.')
            textareaRef.current?.focus()
            return
        }
        setErrorRespuesta(null)
        setErrorEnvio(null)
        setEnviando(true)
        try {
            const subidos: SupportAttachment[] = []
            for (let i = 0; i < adjuntos.length; i++) {
                setProgreso(`Subiendo ${i + 1} de ${adjuntos.length}…`)
                subidos.push(await panelUploadSupportAttachment(adjuntos[i].file, adjuntos[i].nombre))
            }
            setProgreso('Enviando…')
            const nuevo = await panelReplySupportRequest(detalle.id, {
                message: texto,
                ...(subidos.length > 0 ? { attachments: subidos } : {}),
            })
            setDetalle(nuevo)
            setRespuesta('')
            setAdjuntos([])
            setErrorAdjuntos(null)
            onDetalle(nuevo, 'respuesta')
        } catch (e) {
            setErrorEnvio(e instanceof ApiError ? e.message : 'No se pudo enviar tu respuesta. Probá de nuevo en un momento.')
        } finally {
            setEnviando(false)
            setProgreso(null)
        }
    }

    if (errorCarga) {
        return (
            <div>
                <Volver a="Soporte" onClick={onVolver} />
                <Card padding="md">
                    <div role="alert" style={{ fontSize: 13.5, color: 'var(--color-error)', marginBottom: 12 }}>{errorCarga}</div>
                    <Button variant="secondary" size="sm" onClick={() => setIntento(n => n + 1)}>Reintentar</Button>
                </Card>
            </div>
        )
    }

    if (!detalle) {
        return (
            <div>
                <Volver a="Soporte" onClick={onVolver} />
                <Card padding="md">
                    <div aria-live="polite" style={{ fontSize: 13.5, color: 'var(--color-muted)' }}>Abriendo la consulta…</div>
                </Card>
            </div>
        )
    }

    const cat = categoriaDe(detalle.category)
    const cerrada = detalle.status === 'CLOSED'

    return (
        <div>
            <Volver a="Soporte" onClick={onVolver} />
            <Card padding="md">
                {/* Cabecera */}
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap', marginBottom: 6 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-muted)', paddingTop: 3, fontVariantNumeric: 'tabular-nums' }}>#{detalle.number}</span>
                    <h2 style={{ flex: '1 1 240px', minWidth: 0, margin: 0, fontSize: 18, fontWeight: 700, letterSpacing: '-0.01em', color: 'var(--color-text)', lineHeight: 1.35, overflowWrap: 'anywhere' }}>
                        {detalle.subject}
                    </h2>
                    <EstadoPill estado={detalle.status} />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', fontSize: 12.5, color: 'var(--color-muted)', marginBottom: 18 }}>
                    <cat.Icon size={13} strokeWidth={2} aria-hidden="true" />
                    <span>{cat.label}</span>
                    <span aria-hidden="true">·</span>
                    <span>Creada el {fechaCompleta(detalle.createdAt)}</span>
                    <span aria-hidden="true">·</span>
                    <span>{detalle.member.name}</span>
                    {detalle.contactPhone && (
                        <>
                            <span aria-hidden="true">·</span>
                            <span>Tel. {detalle.contactPhone}</span>
                        </>
                    )}
                </div>

                {/* Conversación */}
                <ol className="sop-hilo" aria-label="Conversación" style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {detalle.messages.map(m => <Mensaje key={m.id} m={m} />)}
                </ol>

                {/* Respuesta */}
                <div style={{ marginTop: 22, paddingTop: 18, borderTop: '1px solid var(--color-border)' }}>
                    {cerrada && (
                        <div role="status" style={{
                            display: 'flex', alignItems: 'flex-start', gap: 8, padding: '10px 12px', borderRadius: 8, marginBottom: 14,
                            background: 'var(--color-surface-alt)', color: 'var(--color-body)', fontSize: 13, lineHeight: 1.5,
                        }}>
                            <Lock size={14} strokeWidth={2} aria-hidden="true" style={{ flexShrink: 0, marginTop: 3, color: 'var(--color-muted)' }} />
                            <span>Esta consulta está cerrada. Si necesitás seguir, escribí una respuesta y se vuelve a abrir.</span>
                        </div>
                    )}
                    <label htmlFor={respuestaId} style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--color-body)', marginBottom: 6 }}>
                        Tu respuesta
                    </label>
                    <textarea
                        id={respuestaId}
                        ref={textareaRef}
                        value={respuesta}
                        onChange={e => { setRespuesta(e.target.value); if (errorRespuesta) setErrorRespuesta(null) }}
                        onPaste={onPaste}
                        rows={4}
                        disabled={enviando}
                        placeholder="Contanos cómo sigue o respondé lo que te preguntamos."
                        aria-invalid={errorRespuesta ? true : undefined}
                        aria-describedby={errorRespuesta ? errorRespuestaId : undefined}
                        className="ds-field sop-textarea"
                        style={{ width: '100%', boxSizing: 'border-box', border: `1px solid ${errorRespuesta ? 'var(--color-error)' : 'var(--color-border)'}`, borderRadius: 8, padding: '10px 12px', fontSize: 14, color: 'var(--color-text)', background: 'var(--color-bg)', fontFamily: 'inherit', resize: 'vertical', minHeight: 96 }}
                    />
                    {errorRespuesta && <div id={errorRespuestaId} style={{ fontSize: 12.5, color: 'var(--color-error)', marginTop: 6 }}>{errorRespuesta}</div>}

                    <div style={{ marginTop: 12 }}>
                        <SoporteAdjuntos
                            adjuntos={adjuntos}
                            onAgregar={agregar}
                            onQuitar={quitar}
                            error={errorAdjuntos}
                            disabled={enviando}
                            titulo="Adjuntá una captura si ayuda"
                        />
                    </div>

                    {errorEnvio && <div role="alert" style={{ fontSize: 12.5, color: 'var(--color-error)', marginTop: 12 }}>{errorEnvio}</div>}

                    <div style={{ marginTop: 14 }}>
                        <Button variant="primary" className="sop-enviar" loading={enviando} onClick={responder} icon={enviando ? undefined : <Send size={14} strokeWidth={2} aria-hidden="true" />}>
                            {progreso ?? 'Responder'}
                        </Button>
                    </div>
                </div>
            </Card>
        </div>
    )
}

// ─── Un mensaje del hilo ─────────────────────────────────────────────────────
// Lo del miembro va a la derecha con el fondo de marca; lo del equipo a la
// izquierda, neutro, con la etiqueta "Soporte de Órbita": quien lee tiene
// que distinguir de un vistazo qué escribió y qué le respondieron.
function Mensaje({ m }: { m: SupportMessage }) {
    const propio = m.author === 'MEMBER'
    return (
        <li className="sop-msg" data-autor={m.author} style={{ display: 'flex', flexDirection: 'column', alignItems: propio ? 'flex-end' : 'flex-start' }}>
            <div style={{
                maxWidth: 'min(100%, 560px)', padding: '10px 14px', borderRadius: 12,
                borderTopRightRadius: propio ? 4 : 12, borderTopLeftRadius: propio ? 12 : 4,
                background: propio ? 'var(--color-primary-bg)' : 'var(--color-surface-alt)',
                color: 'var(--color-text)',
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5, color: 'var(--color-muted)', marginBottom: 4 }}>
                    <User size={12} strokeWidth={2} aria-hidden="true" />
                    <span style={{ fontWeight: 600, color: propio ? 'var(--color-primary)' : 'var(--color-body)' }}>
                        {propio ? m.authorName : `Soporte de Órbita · ${m.authorName}`}
                    </span>
                    <span aria-hidden="true">·</span>
                    <time dateTime={m.createdAt}>{fechaCompleta(m.createdAt)}</time>
                </div>
                <div style={{ fontSize: 14, lineHeight: 1.6, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{m.body}</div>
                {m.attachments.length > 0 && (
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
                        {m.attachments.map((a, i) => (
                            <a
                                key={`${a.url}-${i}`}
                                href={a.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="sop-adjunto"
                                aria-label={`Abrir ${a.name} en una pestaña nueva`}
                                style={{ display: 'block', width: 72, height: 72, borderRadius: 8, overflow: 'hidden', border: '1px solid var(--color-border)', background: 'var(--color-bg)' }}
                            >
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={a.url} alt={a.name} loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                            </a>
                        ))}
                    </div>
                )}
            </div>
        </li>
    )
}
