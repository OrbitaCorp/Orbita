// Modal para enviar email a un miembro del equipo, con plantillas y variables.
//
// (Fase 3 — Ale, 30/07) Mismo tratamiento que EmailMasivoModal: layout en dos
// columnas (formulario a la izquierda, vista previa fija a la derecha) y
// recuadro de mensaje más grande — para que todas las modales que redactan
// un email con plantillas se vean y se sientan igual.

import { useRef, useState } from 'react'
import { Send } from 'lucide-react'
import { Modal } from '@/design-system/components/Modal'
import { Button } from '@/design-system/components/Button'
import { Lbl, Inp } from './FormBits'
import type { Miembro } from '../../types/equipo.types'

type PlantillaKey = 'bienvenida' | 'recordatorio' | 'password' | 'libre'

const PLANTILLAS: Record<PlantillaKey, { l: string; a: string; c: string }> = {
    bienvenida:   { l: 'Bienvenida al equipo',    a: '¡Bienvenido/a a Rama Indumentaria!', c: 'Hola {nombre},\n\nTe damos la bienvenida al equipo de {tienda}. Tu rol es {rol}.\n\n¡Que tengas excelentes ventas!' },
    recordatorio: { l: 'Recordatorio de acceso',  a: 'Recordatorio: acceso al panel',      c: 'Hola {nombre},\n\nTe recordamos que tenés acceso al panel de {tienda} con el email {email}.' },
    password:     { l: 'Cambio de contraseña',    a: 'Tu contraseña temporal',             c: 'Hola {nombre},\n\nTu contraseña temporal es: {password_temp}\n\nDeberás cambiarla en tu primer acceso.' },
    libre:        { l: 'Mensaje libre',           a: '',                                    c: '' },
}

const VARIABLES = ['{nombre}', '{email}', '{tienda}', '{rol}', '{password_temp}']

interface ModalEmailMiembroProps {
    miembro: Miembro
    onClose: () => void
    onSend:  (email: string) => void
}

export function ModalEmailMiembro({ miembro, onClose, onSend }: ModalEmailMiembroProps) {
    const [pl, setPl] = useState<PlantillaKey>('bienvenida')
    const [asunto, setAsunto] = useState(PLANTILLAS.bienvenida.a)
    const [cuerpo, setCuerpo] = useState(PLANTILLAS.bienvenida.c)
    const taRef = useRef<HTMLTextAreaElement>(null)

    const pick = (k: PlantillaKey) => { setPl(k); setAsunto(PLANTILLAS[k].a); setCuerpo(PLANTILLAS[k].c) }

    const insertVar = (v: string) => {
        const ta = taRef.current
        if (!ta) { setCuerpo(c => c + v); return }
        const s = ta.selectionStart, e = ta.selectionEnd
        setCuerpo(c => c.slice(0, s) + v + c.slice(e))
        setTimeout(() => { ta.focus(); ta.selectionStart = ta.selectionEnd = s + v.length }, 0)
    }

    // Vista previa con valores de ejemplo — el envío real todavía es un stub
    // (Config: Equipo, Fase 5), así que "tienda"/"rol" no salen resueltos de
    // ningún lado todavía; se usan de muestra, igual que en EmailMasivoModal.
    const render = (txt: string) => txt
        .replace(/\{nombre\}/g, miembro.nombre.split(' ')[0])
        .replace(/\{email\}/g, miembro.email)
        .replace(/\{tienda\}/g, 'Rama Indumentaria')
        .replace(/\{rol\}/g, 'Vendedor')
        .replace(/\{password_temp\}/g, 'Ab12cd34')

    return (
        <Modal
            isOpen
            onClose={onClose}
            title={`Enviar email a ${miembro.nombre}`}
            maxWidth={900}
            footer={<><Button variant="ghost" onClick={onClose}>Cancelar</Button><Button variant="primary" icon={<Send size={15} />} onClick={() => onSend(miembro.email)}>Enviar email</Button></>}
        >
            <style>{`
                .mem-cols       { display:flex; gap:22px; align-items:flex-start; }
                .mem-form       { flex:1 1 54%; min-width:0; max-height:64vh; overflow-y:auto; padding-right:8px; }
                .mem-preview    { flex:1 1 46%; min-width:0; position:sticky; top:0; }
                @media (max-width: 760px) {
                    .mem-cols    { flex-direction:column; }
                    .mem-form    { max-height:none; overflow-y:visible; padding-right:0; width:100%; }
                    .mem-preview { position:static; width:100%; }
                }
            `}</style>
            <div className="mem-cols">
                {/* ── Columna izquierda: formulario ── */}
                <div className="mem-form">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                        <span style={{ fontSize: 12, color: 'var(--color-muted)' }}>Para:</span>
                        <span style={{ height: 26, padding: '0 10px', borderRadius: 9999, background: 'var(--color-surface-alt)', color: 'var(--color-body)', fontSize: 12, fontFamily: '"Geist Mono", monospace', display: 'inline-flex', alignItems: 'center' }}>{miembro.email}</span>
                    </div>

                    <Lbl>Plantilla</Lbl>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 16 }}>
                        {(Object.entries(PLANTILLAS) as [PlantillaKey, { l: string }][]).map(([k, v]) => {
                            const a = pl === k
                            return <button key={k} onClick={() => pick(k)} style={{ padding: '10px 12px', borderRadius: 8, border: `1px solid ${a ? 'var(--color-primary)' : 'var(--color-border)'}`, background: a ? 'var(--color-primary-bg)' : 'var(--color-bg)', color: a ? 'var(--color-primary)' : 'var(--color-body)', fontSize: 13, fontWeight: a ? 600 : 500, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' }}>{v.l}</button>
                        })}
                    </div>

                    <Lbl>Asunto</Lbl>
                    <Inp value={asunto} onChange={setAsunto} />
                    <div style={{ height: 14 }} />

                    <Lbl>Mensaje</Lbl>
                    <textarea ref={taRef} value={cuerpo} onChange={e => setCuerpo(e.target.value)} rows={14} style={{ width: '100%', boxSizing: 'border-box', resize: 'vertical', minHeight: 300, background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 8, padding: '10px 12px', fontSize: 13, color: 'var(--color-text)', fontFamily: 'inherit', outline: 'none', lineHeight: 1.6 }} />
                    <div style={{ display: 'flex', justifyContent: 'flex-end', fontSize: 11, color: 'var(--color-subtle)', marginTop: 4, fontFamily: '"Geist Mono", monospace' }}>{cuerpo.length} caracteres</div>

                    <div style={{ marginTop: 8 }}>
                        <div style={{ fontSize: 11, color: 'var(--color-muted)', marginBottom: 6 }}>Hacé click para insertar:</div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                            {VARIABLES.map(v => <button key={v} onClick={() => insertVar(v)} style={{ height: 24, padding: '0 8px', borderRadius: 6, background: 'var(--color-surface-alt)', border: '1px solid var(--color-border)', color: 'var(--color-body)', fontSize: 11, fontFamily: '"Geist Mono", monospace', cursor: 'pointer' }}>{v}</button>)}
                        </div>
                    </div>
                </div>

                {/* ── Columna derecha: vista previa, fija, se actualiza en vivo ── */}
                <div className="mem-preview">
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
                                    Para: {miembro.nombre}
                                </div>
                                <div style={{ fontSize: 15, fontWeight: 700, color: '#0f172a', marginBottom: 10 }}>{render(asunto) || '(sin asunto)'}</div>
                                <div style={{ fontSize: 13, color: '#334155', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{render(cuerpo) || '(sin contenido)'}</div>
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
