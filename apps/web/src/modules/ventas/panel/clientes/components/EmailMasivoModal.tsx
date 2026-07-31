// Modal de email masivo a segmentos de clientes, con plantillas y variables.
// Construido sobre el Modal genérico del design system.
//
// (Fase 3 — Ale, 30/07) Layout en dos columnas: el formulario a la izquierda
// (scrollea solo si el contenido no entra) y la vista previa fija a la
// derecha, para verla actualizarse en vivo sin tener que bajar. En mobile
// (o ventanas angostas) se apila en una sola columna, como antes.

import { useEffect, useRef, useState } from 'react'
import { Check } from 'lucide-react'
import { Modal } from '@/design-system/components/Modal'
import { Button } from '@/design-system/components/Button'
import { Loader } from '@/design-system/components/Loader'

type PlantillaKey = 'nueva' | 'oferta' | 'extrañamos' | 'gracias' | 'custom'

const PLANTILLAS: Record<PlantillaKey, { l: string; a: string; c: string }> = {
    nueva:      { l: '¡Nueva colección!',     a: '🆕 Nueva colección ya disponible en Rama Indumentaria', c: 'Hola {nombre},\n\nTenemos novedades esperándote. Entrá a nuestra tienda y descubrí las últimas piezas de la nueva colección.\n\nTe esperamos!\nEl equipo de Rama Indumentaria' },
    oferta:     { l: 'Oferta especial',       a: '🎉 Oferta exclusiva para vos, {nombre}',                c: 'Hola {nombre},\n\nQueremos premiarte por tu fidelidad. Usá el cupón VIP20 y llevate un 20% de descuento en tu próxima compra.\n\nVálido hasta el 30 de junio.\nRama Indumentaria' },
    extrañamos: { l: 'Te extrañamos',         a: 'Te extrañamos, {nombre} 💙',                            c: 'Hola {nombre},\n\nHace un tiempo que no te vemos por la tienda. Nos encantaría tenerte de vuelta.\n\nTenemos novedades y ofertas esperándote.\nRama Indumentaria' },
    gracias:    { l: 'Gracias por tu compra', a: 'Gracias por tu compra, {nombre} 🙏',                    c: 'Hola {nombre},\n\nQueremos agradecerte por elegir Rama Indumentaria. Tu apoyo hace posible lo que hacemos cada día.\n\n¡Hasta la próxima!\nEl equipo' },
    custom:     { l: 'Personalizado',         a: '',                                                       c: '' },
}

const DEST: [string, string, number][] = [
    ['todos', 'Todos los clientes', 10],
    ['vip', 'Clientes VIP', 3],
    ['recurrente', 'Recurrentes', 3],
    ['nuevo', 'Clientes nuevos', 3],
    ['inactivo', 'Inactivos', 1],
]

const VARIABLES = ['{nombre}', '{email}', '{ultima_compra}', '{total_gastado}']

interface EmailMasivoModalProps {
    isOpen:  boolean
    onClose: () => void
    // (Fase 2 — Alex) Si me pasan los destinatarios reales y la función de
    // envío, el modal manda emails DE VERDAD (a la lista filtrada, con las
    // variables completadas por persona en el backend). Sin estos datos sigue
    // funcionando como muestra, para no romper nada.
    negocio?:       string
    destinatarios?: { id: string; nombre: string; email: string }[]
    onEnviar?:      (ids: string[], asunto: string, cuerpo: string) => Promise<number>
}

export function EmailMasivoModal({ isOpen, onClose, negocio, destinatarios, onEnviar }: EmailMasivoModalProps) {
    const marca = negocio ?? 'Rama Indumentaria'
    const conMarca = (t: string) => t.replace(/Rama Indumentaria/g, marca)
    const esReal = !!(destinatarios && onEnviar)

    const [dest, setDest] = useState('todos')
    const [pl, setPl] = useState<PlantillaKey>('nueva')
    const [asunto, setAsunto] = useState(() => conMarca(PLANTILLAS.nueva.a))
    const [cuerpo, setCuerpo] = useState(() => conMarca(PLANTILLAS.nueva.c))
    const [enviando, setEnviando] = useState(false)
    const [enviado, setEnviado] = useState(false)
    const [enviadosReal, setEnviadosReal] = useState<number | null>(null)
    const [errorEnvio, setErrorEnvio] = useState<string | null>(null)
    const taRef = useRef<HTMLTextAreaElement>(null)

    const count = destinatarios ? destinatarios.length : DEST.find(d => d[0] === dest)![2]
    const pick = (k: PlantillaKey) => { setPl(k); setAsunto(conMarca(PLANTILLAS[k].a)); setCuerpo(conMarca(PLANTILLAS[k].c)) }
    const nombreEjemplo = destinatarios?.[0]?.nombre?.split(' ')[0] ?? 'María'
    const render = (txt: string) => txt.replace(/\{nombre\}/g, nombreEjemplo)

    // Cada vez que se abre, arranca una redacción fresca con el nombre del
    // negocio ya cargado (y limpia el resultado del envío anterior).
    useEffect(() => {
        if (!isOpen) return
        setEnviado(false)
        setEnviadosReal(null)
        setErrorEnvio(null)
        setAsunto(conMarca(PLANTILLAS[pl].a))
        setCuerpo(conMarca(PLANTILLAS[pl].c))
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen])

    // Al confirmarse el envío, cierra solo a los pocos segundos — además del
    // botón "Cerrar" manual, para quien quiera salir antes o revisar el
    // resultado con calma.
    useEffect(() => {
        if (!enviado) return
        const t = setTimeout(() => onClose(), 2500)
        return () => clearTimeout(t)
    }, [enviado, onClose])

    const insertVar = (v: string) => {
        const ta = taRef.current
        if (!ta) { setCuerpo(c => c + v); return }
        const s = ta.selectionStart, e = ta.selectionEnd
        setCuerpo(c => c.slice(0, s) + v + c.slice(e))
        setTimeout(() => { ta.focus(); ta.selectionStart = ta.selectionEnd = s + v.length }, 0)
    }

    // Con datos reales manda por el backend y cuenta cuántos salieron;
    // en modo muestra solo simula.
    const enviar = () => {
        if (destinatarios && onEnviar) {
            setEnviando(true)
            setErrorEnvio(null)
            onEnviar(destinatarios.map(d => d.id), asunto, cuerpo)
                .then(n => { setEnviadosReal(n); setEnviado(true) })
                .catch(() => setErrorEnvio('No se pudieron enviar los emails. Probá de nuevo.'))
                .finally(() => setEnviando(false))
            return
        }
        setEnviando(true); setTimeout(() => { setEnviando(false); setEnviado(true) }, 2000)
    }

    const inputBase: React.CSSProperties = {
        width: '100%', boxSizing: 'border-box', background: 'var(--color-bg)',
        border: '1px solid var(--color-border)', borderRadius: 8, color: 'var(--color-text)',
        fontFamily: 'inherit', outline: 'none',
    }

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="Enviar email a clientes"
            maxWidth={960}
            footer={enviado
                ? <>
                    <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--color-success)', fontWeight: 600 }}>
                        <Check size={16} strokeWidth={2.4} /> Email enviado a {enviadosReal ?? count} clientes
                    </div>
                    <Button variant="outline" onClick={onClose}>Cerrar</Button>
                </>
                : <>
                    <Button variant="ghost" onClick={onClose} disabled={enviando}>Cancelar</Button>
                    <Button variant="primary" disabled={enviando || count === 0} onClick={enviar}>{count === 0 ? 'Sin destinatarios' : `Enviar a ${count} cliente${count === 1 ? '' : 's'}`}</Button>
                </>}
        >
            <style>{`
                .ema-cols       { display:flex; gap:22px; align-items:flex-start; }
                .ema-form       { flex:1 1 54%; min-width:0; max-height:64vh; overflow-y:auto; padding-right:8px; }
                .ema-preview    { flex:1 1 46%; min-width:0; position:sticky; top:0; }
                @media (max-width: 760px) {
                    .ema-cols    { flex-direction:column; }
                    .ema-form    { max-height:none; overflow-y:visible; padding-right:0; width:100%; }
                    .ema-preview { position:static; width:100%; }
                }
            `}</style>
            {enviando ? (
                // Loader chico y con mensaje en vez del spinner del botón o
                // de tapar toda la pantalla — se ve adentro del modal nomás,
                // mientras se resuelve el envío.
                <div style={{ minHeight: 420, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Loader message="Enviando mails…" />
                </div>
            ) : (
            <div className="ema-cols">
                {/* ── Columna izquierda: formulario ── */}
                <div className="ema-form">
                    <label style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-body)', display: 'block', marginBottom: 8 }}>¿A quiénes enviás?</label>
                    {esReal ? (
                        <div style={{ padding: '10px 14px', border: '1px solid var(--color-primary)', background: 'var(--color-primary-bg)', borderRadius: 8, marginBottom: 16, fontSize: 13, color: 'var(--color-text)' }}>
                            A los <strong>{count}</strong> clientes de la lista filtrada que tienen email.
                        </div>
                    ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, marginBottom: 16 }}>
                        {DEST.map(([id, l, n]) => {
                            const a = dest === id
                            return (
                                <button key={id} onClick={() => setDest(id)} style={{ padding: 12, border: `${a ? 2 : 1}px solid ${a ? 'var(--color-primary)' : 'var(--color-border)'}`, borderRadius: 8, background: a ? 'var(--color-primary-bg)' : 'var(--color-surface)', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                        {id === 'vip' && <span style={{ color: '#F59E0B' }}>★</span>}
                                        <span style={{ fontSize: 12, fontWeight: a ? 600 : 500, color: a ? 'var(--color-primary)' : 'var(--color-text)' }}>{l}</span>
                                    </div>
                                    <span style={{ fontSize: 11, color: 'var(--color-muted)', fontFamily: '"Geist Mono", monospace' }}>{n} clientes</span>
                                </button>
                            )
                        })}
                    </div>
                    )}

                    {errorEnvio && (
                        <div style={{ marginBottom: 12, padding: '10px 12px', borderRadius: 8, background: 'var(--color-error-bg)', fontSize: 13, color: 'var(--color-error)' }}>{errorEnvio}</div>
                    )}

                    {/* Plantillas */}
                    <label style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-body)', display: 'block', marginBottom: 8 }}>Plantillas rápidas</label>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
                        {(Object.entries(PLANTILLAS) as [PlantillaKey, { l: string }][]).map(([k, v]) => {
                            const a = pl === k
                            return (
                                <button key={k} onClick={() => pick(k)} style={{ height: 30, padding: '0 12px', borderRadius: 9999, border: `1px solid ${a ? 'var(--color-primary)' : 'var(--color-border)'}`, background: a ? 'var(--color-primary-bg)' : 'var(--color-surface)', color: a ? 'var(--color-primary)' : 'var(--color-body)', fontSize: 12, fontWeight: a ? 600 : 500, cursor: 'pointer', fontFamily: 'inherit' }}>{v.l}</button>
                            )
                        })}
                    </div>

                    {/* Asunto */}
                    <label style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-body)', display: 'block', marginBottom: 6 }}>Asunto</label>
                    <input value={asunto} onChange={e => setAsunto(e.target.value.slice(0, 100))} style={{ ...inputBase, height: 40, padding: '0 12px', fontSize: 13, marginBottom: 4 }} />
                    <div style={{ textAlign: 'right', fontSize: 11, color: 'var(--color-subtle)', fontFamily: '"Geist Mono", monospace', marginBottom: 14 }}>{asunto.length}/100</div>

                    {/* Mensaje — recuadro más grande a pedido, para ver todo el texto sin scrollear adentro */}
                    <label style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-body)', display: 'block', marginBottom: 6 }}>Mensaje</label>
                    <textarea ref={taRef} value={cuerpo} onChange={e => setCuerpo(e.target.value)} rows={14} style={{ ...inputBase, resize: 'vertical', minHeight: 300, padding: '10px 12px', fontSize: 13, lineHeight: 1.6 }} />
                    <div style={{ fontSize: 11, color: 'var(--color-muted)', margin: '8px 0 6px' }}>Variables disponibles — hacé click para insertar</div>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {VARIABLES.map(v => (
                            <button key={v} onClick={() => insertVar(v)} style={{ height: 24, padding: '0 8px', borderRadius: 6, background: 'var(--color-surface-alt)', border: '1px solid var(--color-border)', color: 'var(--color-body)', fontSize: 11, fontFamily: '"Geist Mono", monospace', cursor: 'pointer' }}>{v}</button>
                        ))}
                    </div>
                </div>

                {/* ── Columna derecha: vista previa, fija, se actualiza en vivo ── */}
                <div className="ema-preview">
                    <div style={{ fontSize: 11, color: 'var(--color-muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 600 }}>Vista previa</div>
                    <div style={{ background: '#f1f5f9', border: '1px solid var(--color-border)', borderRadius: 12, padding: 14 }}>
                        {/* Mismo look que el mail real (email-layout.hbs): header con degradé de marca,
                            tarjeta blanca. Sin insignia de ícono — el email masivo/individual es texto
                            libre, no tiene un "tipo" con ícono propio (a diferencia de las 14 plantillas
                            fijas, que sí lo tienen). El color real sale de Apariencia — acá se muestra un
                            azul de ejemplo. */}
                        <div style={{ borderRadius: '20px 20px 0 0', padding: '20px 24px', background: 'linear-gradient(135deg, #2563eb, #1b47a9)' }}>
                            <span style={{ fontSize: 15, fontWeight: 700, color: '#ffffff', letterSpacing: '-0.01em' }}>{marca}</span>
                        </div>
                        <div style={{ background: '#ffffff', borderRadius: '0 0 20px 20px', boxShadow: '0 4px 24px rgba(15,23,42,0.08)' }}>
                            <div style={{ padding: '28px 24px 26px' }}>
                                <div style={{ fontSize: 11.5, color: 'var(--color-muted)', fontFamily: '"Geist Mono", monospace', marginBottom: 10, paddingBottom: 10, borderBottom: '1px solid var(--color-border)' }}>
                                    Para: {destinatarios?.[0]?.nombre ?? 'María Fernández'}{count > 1 ? ` (+${count - 1} más)` : ''}
                                </div>
                                <div style={{ fontSize: 15, fontWeight: 700, color: '#0f172a', marginBottom: 10 }}>{render(asunto) || '(sin asunto)'}</div>
                                <div style={{ fontSize: 13, color: '#334155', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{render(cuerpo) || '(sin contenido)'}</div>
                            </div>
                        </div>
                    </div>
                    <p style={{ fontSize: 11.5, color: 'var(--color-subtle)', marginTop: 8, lineHeight: 1.5 }}>
                        El email real usa el logo y los colores que cargaste en Apariencia — acá se muestra un azul de ejemplo.
                    </p>
                </div>
            </div>
            )}
        </Modal>
    )
}
