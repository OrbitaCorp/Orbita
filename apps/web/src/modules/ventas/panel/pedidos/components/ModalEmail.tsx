// Modal para enviar un email a un cliente, con plantillas rápidas.
// Construido sobre el Modal genérico del design system.
//
// (Fase 3 — Ale, 30/07) Mismo tratamiento que EmailMasivoModal: layout en dos
// columnas (formulario a la izquierda, vista previa fija a la derecha) y
// recuadro de mensaje más grande.

import { useState } from 'react'
import { Send } from 'lucide-react'
import { Modal } from '@/design-system/components/Modal'
import { Button } from '@/design-system/components/Button'

export interface ClienteEmail {
    nombre: string
    email:  string
}

interface ModalEmailProps {
    isOpen:   boolean
    onClose:  () => void
    cliente:  ClienteEmail
    onToast?: (msg: string) => void
}

type PlantillaKey = 'confirmado' | 'retiro' | 'gracias' | 'libre'

export function ModalEmail({ isOpen, onClose, cliente, onToast }: ModalEmailProps) {
    const plantillas: Record<PlantillaKey, { asunto: string; cuerpo: string }> = {
        confirmado: { asunto: 'Tu pedido fue confirmado', cuerpo: `Hola ${cliente.nombre}! Tu pedido fue confirmado y lo estamos preparando 😊` },
        retiro:     { asunto: 'Listo para retirar',       cuerpo: `Hola ${cliente.nombre}! Tu pedido está listo para retirar en nuestra tienda.` },
        gracias:    { asunto: 'Gracias por tu compra',    cuerpo: `Hola ${cliente.nombre}! Gracias por confiar en Rama Indumentaria 🙏` },
        libre:      { asunto: '',                          cuerpo: '' },
    }

    const [plantilla, setPlantilla] = useState<PlantillaKey>('confirmado')
    const [asunto,    setAsunto]    = useState(plantillas.confirmado.asunto)
    const [cuerpo,    setCuerpo]    = useState(plantillas.confirmado.cuerpo)

    const elegir = (k: PlantillaKey) => {
        setPlantilla(k)
        setAsunto(plantillas[k].asunto)
        setCuerpo(plantillas[k].cuerpo)
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
            footer={
                <>
                    <Button variant="ghost" onClick={onClose}>Cancelar</Button>
                    <Button variant="primary" icon={<Send size={15} />} onClick={() => { onClose(); onToast?.('El envío de emails individuales llega en una fase más adelante.') }}>
                        Enviar email
                    </Button>
                </>
            }
        >
            <style>{`
                .mep-cols       { display:flex; gap:22px; align-items:flex-start; }
                .mep-form       { flex:1 1 54%; min-width:0; max-height:64vh; overflow-y:auto; padding-right:8px; }
                .mep-preview    { flex:1 1 46%; min-width:0; position:sticky; top:0; }
                @media (max-width: 760px) {
                    .mep-cols    { flex-direction:column; }
                    .mep-form    { max-height:none; overflow-y:visible; padding-right:0; width:100%; }
                    .mep-preview { position:static; width:100%; }
                }
            `}</style>
            <div className="mep-cols">
                {/* ── Columna izquierda: formulario ── */}
                <div className="mep-form">
                    {/* Destinatario */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                        <span style={{ fontSize: 12, color: 'var(--color-muted)' }}>Para:</span>
                        <span style={{
                            display: 'inline-flex', alignItems: 'center', height: 24, padding: '0 10px',
                            borderRadius: 9999, background: 'var(--color-surface-alt)', color: 'var(--color-muted)',
                            fontSize: 12, fontFamily: '"Geist Mono", monospace',
                        }}>
                            {cliente.email}
                        </span>
                    </div>

                    {/* Plantillas */}
                    <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-body)', marginBottom: 8 }}>Plantilla</div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 8, marginBottom: 16 }}>
                        {([['confirmado', 'Pedido confirmado'], ['retiro', 'Listo para retirar'], ['gracias', 'Gracias por tu compra'], ['libre', 'Personalizado']] as [PlantillaKey, string][]).map(([k, l]) => {
                            const a = plantilla === k
                            return (
                                <button
                                    key={k}
                                    onClick={() => elegir(k)}
                                    style={{
                                        padding: '10px 12px', borderRadius: 8,
                                        border: `1px solid ${a ? 'var(--color-primary)' : 'var(--color-border)'}`,
                                        background: a ? 'var(--color-primary-bg)' : 'var(--color-surface)',
                                        color: a ? 'var(--color-primary)' : 'var(--color-body)',
                                        fontSize: 13, fontWeight: a ? 600 : 500, cursor: 'pointer',
                                        fontFamily: 'inherit', textAlign: 'left',
                                    }}
                                >
                                    {l}
                                </button>
                            )
                        })}
                    </div>

                    {/* Asunto */}
                    <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-body)', marginBottom: 6 }}>Asunto</div>
                    <input value={asunto} onChange={e => setAsunto(e.target.value)} style={{ ...inputBase, height: 40, padding: '0 12px', fontSize: 14, marginBottom: 14 }} />

                    {/* Mensaje — recuadro más grande, igual que en el resto de las modales de email */}
                    <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-body)', marginBottom: 6 }}>Mensaje</div>
                    <textarea value={cuerpo} onChange={e => setCuerpo(e.target.value)} rows={14} style={{ ...inputBase, resize: 'vertical', minHeight: 300, padding: '10px 12px', fontSize: 13, lineHeight: 1.6 }} />
                </div>

                {/* ── Columna derecha: vista previa, fija, se actualiza en vivo ── */}
                <div className="mep-preview">
                    <div style={{ fontSize: 11, color: 'var(--color-muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 600 }}>Vista previa</div>
                    <div style={{ background: '#f1f5f9', border: '1px solid var(--color-border)', borderRadius: 12, padding: 14 }}>
                        {/* Mismo look que el mail real (email-layout.hbs): header con degradé de marca,
                            tarjeta blanca. Sin insignia de ícono — el email individual es texto libre,
                            no tiene un "tipo" con ícono propio (a diferencia de las 14 plantillas fijas,
                            que sí lo tienen). El color real sale de Apariencia — acá se muestra un azul
                            de ejemplo. */}
                        <div style={{ borderRadius: '20px 20px 0 0', padding: '20px 24px', background: 'linear-gradient(135deg, #2563eb, #1b47a9)' }}>
                            <span style={{ fontSize: 15, fontWeight: 700, color: '#ffffff', letterSpacing: '-0.01em' }}>Rama Indumentaria</span>
                        </div>
                        <div style={{ background: '#ffffff', borderRadius: '0 0 20px 20px', boxShadow: '0 4px 24px rgba(15,23,42,0.08)' }}>
                            <div style={{ padding: '28px 24px 26px' }}>
                                <div style={{ fontSize: 11.5, color: 'var(--color-muted)', fontFamily: '"Geist Mono", monospace', marginBottom: 10, paddingBottom: 10, borderBottom: '1px solid var(--color-border)' }}>
                                    Para: {cliente.nombre}
                                </div>
                                <div style={{ fontSize: 15, fontWeight: 700, color: '#0f172a', marginBottom: 10 }}>{asunto || '(sin asunto)'}</div>
                                <div style={{ fontSize: 13, color: '#334155', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{cuerpo || '(sin contenido)'}</div>
                            </div>
                        </div>
                    </div>
                    <p style={{ fontSize: 11.5, color: 'var(--color-subtle)', marginTop: 8, lineHeight: 1.5 }}>
                        El email real usa el logo y los colores que la tienda cargó en Apariencia — acá se muestra un azul de ejemplo.
                    </p>
                </div>
            </div>
        </Modal>
    )
}
