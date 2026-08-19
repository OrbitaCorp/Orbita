// Modal para enviar un email a un cliente, con plantillas rápidas.
// Construido sobre el Modal genérico del design system.
//
// (Fase 3 — Ale, 30/07) Mismo tratamiento que EmailMasivoModal: layout en dos
// columnas (formulario a la izquierda, vista previa fija a la derecha) y
// recuadro de mensaje más grande.
//
// (Fase 3 — Ale, 01/08) Ahora manda emails DE VERDAD: si me pasan `onEnviar`,
// el botón dispara ese envío real — con loader mientras sale, éxito con
// auto-cierre y error a la vista, igual que el masivo. Sin `onEnviar` queda en
// modo muestra, para las pantallas cuyo backend llega en otra tarjeta.

import { useEffect, useState } from 'react'
import { Check, Send } from 'lucide-react'
import { Modal } from '@/design-system/components/Modal'
import { Button } from '@/design-system/components/Button'
import { Loader } from '@/design-system/components/Loader'
import { useAuth } from '@/hooks/useAuth'

export interface ClienteEmail {
    nombre: string
    email:  string
}

interface ModalEmailProps {
    isOpen:   boolean
    onClose:  () => void
    cliente:  ClienteEmail
    onToast?: (msg: string) => void
    // El envío real. Si no viene, el modal queda en modo muestra.
    onEnviar?: (asunto: string, cuerpo: string) => Promise<void>
}

type PlantillaKey = 'confirmado' | 'retiro' | 'gracias' | 'libre'

export function ModalEmail({ isOpen, onClose, cliente, onToast, onEnviar }: ModalEmailProps) {
    // El nombre real de la tienda: estaba clavado "Rama Indumentaria", así que
    // cualquier otro negocio veía el nombre de otro comercio en su plantilla.
    const { user } = useAuth()
    const marca = user?.type === 'member' ? user.business.name : 'tu tienda'

    const plantillas: Record<PlantillaKey, { asunto: string; cuerpo: string }> = {
        confirmado: { asunto: 'Tu pedido fue confirmado', cuerpo: `Hola ${cliente.nombre}! Tu pedido fue confirmado y lo estamos preparando 😊` },
        retiro:     { asunto: 'Listo para retirar',       cuerpo: `Hola ${cliente.nombre}! Tu pedido está listo para retirar en nuestra tienda.` },
        gracias:    { asunto: 'Gracias por tu compra',    cuerpo: `Hola ${cliente.nombre}! Gracias por confiar en ${marca} 🙏` },
        libre:      { asunto: '',                          cuerpo: '' },
    }

    const [plantilla, setPlantilla]   = useState<PlantillaKey>('confirmado')
    const [asunto,    setAsunto]      = useState(plantillas.confirmado.asunto)
    const [cuerpo,    setCuerpo]      = useState(plantillas.confirmado.cuerpo)
    const [enviando,  setEnviando]    = useState(false)
    const [enviado,   setEnviado]     = useState(false)
    const [errorEnvio, setErrorEnvio] = useState<string | null>(null)

    // Un pedido de venta manual puede no tener email cargado (es opcional):
    // en ese caso el botón queda deshabilitado y se avisa el motivo.
    const sinEmail = !cliente.email

    // Cada vez que se abre arranca fresco y limpia el resultado anterior.
    useEffect(() => {
        if (!isOpen) return
        setEnviando(false)
        setEnviado(false)
        setErrorEnvio(null)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen])

    // Al confirmarse el envío, cierra solo a los pocos segundos — además del
    // botón "Cerrar" manual, para quien quiera salir antes.
    useEffect(() => {
        if (!enviado) return
        const t = setTimeout(() => onClose(), 2500)
        return () => clearTimeout(t)
    }, [enviado, onClose])

    const elegir = (k: PlantillaKey) => {
        setPlantilla(k)
        setAsunto(plantillas[k].asunto)
        setCuerpo(plantillas[k].cuerpo)
    }

    // Con `onEnviar` manda por el backend; en modo muestra solo avisa.
    const enviar = () => {
        if (!onEnviar) {
            onClose()
            onToast?.('El envío de emails desde esta pantalla llega en una fase más adelante.')
            return
        }
        setEnviando(true)
        setErrorEnvio(null)
        onEnviar(asunto.trim(), cuerpo)
            .then(() => setEnviado(true))
            // El backend explica por qué no salió (ej: el proveedor lo
            // rechazó) — ese motivo va directo al recuadro de error.
            .catch((e: unknown) => setErrorEnvio(e instanceof Error && e.message ? e.message : 'No se pudo enviar el email. Probá de nuevo.'))
            .finally(() => setEnviando(false))
    }

    const inputBase: React.CSSProperties = {
        width: '100%', boxSizing: 'border-box',
        background: 'var(--color-surface)', border: '1px solid var(--color-border)',
        borderRadius: 8, color: 'var(--color-text)', fontFamily: 'inherit', outline: 'none',
    }

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={`Enviar email a ${cliente.nombre}`}
            maxWidth={900}
            footer={enviado
                ? <>
                    <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--color-success)', fontWeight: 600 }}>
                        <Check size={16} strokeWidth={2.4} /> Email enviado a {cliente.email}
                    </div>
                    <Button variant="outline" onClick={onClose}>Cerrar</Button>
                </>
                : <>
                    <Button variant="ghost" onClick={onClose} disabled={enviando}>Cancelar</Button>
                    <Button
                        variant="primary"
                        icon={<Send size={15} />}
                        disabled={enviando || sinEmail || !asunto.trim() || !cuerpo.trim()}
                        onClick={enviar}
                    >
                        Enviar email
                    </Button>
                </>}
        >
            <style>{`
                .mep-cols       { display:flex; gap:22px; align-items:flex-start; }
                .mep-form       { flex:1 1 54%; min-width:0; max-height:64vh; overflow-y:auto; padding-right:8px; }
                .mep-preview    { flex:1 1 46%; min-width:0; position:sticky; top:0; }
                .mep-field:focus-visible {
                    border-color: var(--color-primary);
                    box-shadow: 0 0 0 3px rgba(59,130,246,0.28);
                }
                .mep-plantilla:focus-visible { outline: 2px solid var(--color-primary); outline-offset: 2px; }
                @media (max-width: 760px) {
                    .mep-field { font-size:16px !important; }
                    .mep-cols    { flex-direction:column; }
                    .mep-form    { max-height:none; overflow-y:visible; padding-right:0; width:100%; }
                    .mep-preview { position:static; width:100%; }
                }
            `}</style>
            {enviando ? (
                // Loader adentro del modal mientras el envío se resuelve.
                <div style={{ minHeight: '64vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Loader message="Enviando email…" />
                </div>
            ) : (
            <div className="mep-cols">
                {/* ── Columna izquierda: formulario ── */}
                <div className="mep-form">
                    {/* Destinatario */}
                    {sinEmail ? (
                        <div style={{ marginBottom: 16, padding: '10px 12px', borderRadius: 8, background: 'var(--color-error-bg)', fontSize: 13, color: 'var(--color-error)' }}>
                            Este pedido no tiene un email de contacto cargado — no hay a quién enviarle.
                        </div>
                    ) : (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                            <span style={{ fontSize: 12, color: 'var(--color-muted)' }}>Para:</span>
                            <span style={{
                                display: 'inline-flex', alignItems: 'center', height: 24, padding: '0 10px',
                                borderRadius: 9999, background: 'var(--color-surface-alt)', color: 'var(--color-body)',
                                fontSize: 12, fontFamily: '"Geist Mono", monospace',
                            }}>
                                {cliente.email}
                            </span>
                        </div>
                    )}

                    {errorEnvio && (
                        <div style={{ marginBottom: 12, padding: '10px 12px', borderRadius: 8, background: 'var(--color-error-bg)', fontSize: 13, color: 'var(--color-error)' }}>{errorEnvio}</div>
                    )}

                    {/* Plantillas */}
                    <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-body)', marginBottom: 8 }}>Plantilla</div>
                    <div role="radiogroup" aria-label="Plantilla de email" style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 8, marginBottom: 16 }}>
                        {([['confirmado', 'Pedido confirmado'], ['retiro', 'Listo para retirar'], ['gracias', 'Gracias por tu compra'], ['libre', 'Personalizado']] as [PlantillaKey, string][]).map(([k, l]) => {
                            const a = plantilla === k
                            return (
                                <button
                                    key={k}
                                    onClick={() => elegir(k)}
                                    className="mep-plantilla"
                                    role="radio"
                                    aria-checked={a}
                                    style={{
                                        padding: '10px 12px', minHeight: 44, borderRadius: 8,
                                        border: `1px solid ${a ? 'var(--color-primary)' : 'var(--color-border)'}`,
                                        background: a ? 'var(--color-primary-bg)' : 'var(--color-surface)',
                                        color: a ? 'var(--color-primary)' : 'var(--color-body)',
                                        fontSize: 13, fontWeight: a ? 600 : 500, cursor: 'pointer',
                                        fontFamily: 'inherit', textAlign: 'left', transition: 'background 150ms, border-color 150ms, color 150ms',
                                    }}
                                >
                                    {l}
                                </button>
                            )
                        })}
                    </div>

                    {/* Asunto */}
                    <label htmlFor="mep-asunto" style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--color-body)', marginBottom: 6 }}>Asunto</label>
                    <input id="mep-asunto" className="mep-field" value={asunto} onChange={e => setAsunto(e.target.value)} style={{ ...inputBase, height: 44, padding: '0 12px', fontSize: 14, marginBottom: 14 }} />

                    {/* Mensaje — recuadro más grande, igual que en el resto de las modales de email */}
                    <label htmlFor="mep-cuerpo" style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--color-body)', marginBottom: 6 }}>Mensaje</label>
                    <textarea id="mep-cuerpo" className="mep-field" value={cuerpo} onChange={e => setCuerpo(e.target.value)} rows={14} style={{ ...inputBase, resize: 'vertical', minHeight: 300, padding: '10px 12px', fontSize: 13, lineHeight: 1.6 }} />
                </div>

                {/* ── Columna derecha: vista previa, fija, se actualiza en vivo ── */}
                <div className="mep-preview">
                    <div style={{ fontSize: 11, color: 'var(--color-muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 600 }}>Vista previa</div>
                    <div style={{ background: '#f6f8fa', border: '1px solid var(--color-border)', borderRadius: 10, padding: 14 }}>
                        {/* Mismo look que el mail real (email-layout.hbs, estilo "Transaccional
                            sobrio" elegido por el equipo 19/08): tarjeta blanca con borde fino,
                            todo alineado a la izquierda, la marca en su color arriba. El color
                            real sale de Apariencia — acá se muestra un azul de ejemplo. */}
                        <div style={{ background: '#ffffff', border: '1px solid #e3e8ee', borderRadius: 8 }}>
                            <div style={{ padding: '24px 24px 22px', textAlign: 'left' }}>
                                <div style={{ fontSize: 13, fontWeight: 700, color: '#2563eb', letterSpacing: '-0.01em', marginBottom: 14 }}>{marca}</div>
                                <div style={{ fontSize: 11.5, color: '#8792a2', fontFamily: '"Geist Mono", monospace', marginBottom: 12, paddingBottom: 10, borderBottom: '1px solid #e3e8ee' }}>
                                    Para: {cliente.nombre}
                                </div>
                                <div style={{ fontSize: 15, fontWeight: 700, color: '#1a1f36', marginBottom: 8 }}>{asunto || '(sin asunto)'}</div>
                                <div style={{ fontSize: 13, color: '#4f566b', lineHeight: 1.65, whiteSpace: 'pre-wrap' }}>{cuerpo || '(sin contenido)'}</div>
                                <div style={{ borderTop: '1px solid #e3e8ee', marginTop: 18, paddingTop: 10, fontSize: 10.5, color: '#8792a2' }}>
                                    {marca} &nbsp;·&nbsp; Powered by Órbita
                                </div>
                            </div>
                        </div>
                    </div>
                    <p style={{ fontSize: 12, color: 'var(--color-muted)', marginTop: 8, lineHeight: 1.5, maxWidth: '60ch' }}>
                        El email real usa el logo y los colores que la tienda cargó en Apariencia — acá se muestra un azul de ejemplo.
                    </p>
                </div>
            </div>
            )}
        </Modal>
    )
}
