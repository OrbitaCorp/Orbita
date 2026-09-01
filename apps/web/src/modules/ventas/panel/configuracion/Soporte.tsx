// src/modules/ventas/panel/configuracion/Soporte.tsx — Vista "Soporte"
//
// Formulario genérico de contacto con Órbita — no solo para dominios,
// cualquier consulta posible (pedido explícito del dueño). Manda un mail
// real a contacto@orbita-corp.com (ver support.service.ts/mail.service.ts
// del lado del backend, plantilla support-request.hbs) con Reply-To al
// email de quien escribe, para que el equipo pueda responder directo desde
// su bandeja de entrada sin tener que copiar nada a mano.
//
// La categoría se puede precargar por query param (?vista=soporte&categoria=DOMINIO)
// — la usa Dominios.tsx para linkear acá con "Dominios" ya seleccionado
// cuando alguien pide un .com.ar.

import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { LifeBuoy, Globe, Wallet, Wrench, UserCog, HelpCircle, Check, Mail } from 'lucide-react'
import { Card } from '@/design-system/components/Card'
import { Button } from '@/design-system/components/Button'
import { ApiError, panelSendSupportRequest, type SupportCategory } from '@/lib/api'

const CATEGORIAS: { value: SupportCategory; label: string; Icon: typeof Globe }[] = [
    { value: 'DOMINIO',      label: 'Dominios',          Icon: Globe },
    { value: 'FACTURACION',  label: 'Facturación / pagos', Icon: Wallet },
    { value: 'TECNICO',      label: 'Problema técnico',  Icon: Wrench },
    { value: 'CUENTA',       label: 'Mi cuenta / plan',  Icon: UserCog },
    { value: 'OTRO',         label: 'Otra consulta',     Icon: HelpCircle },
]

export default function Soporte() {
    const router = useRouter()

    const [categoria, setCategoria] = useState<SupportCategory>('OTRO')
    const [asunto, setAsunto] = useState('')
    const [mensaje, setMensaje] = useState('')
    const [telefono, setTelefono] = useState('')
    const [enviando, setEnviando] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [enviado, setEnviado] = useState(false)

    // Precarga de categoría por query param — se limpia apenas se captura,
    // mismo criterio que otras vueltas con query param en el proyecto
    // (Inicio.tsx con la vuelta de Google), para no dejar la URL colgada
    // con un parámetro que ya cumplió su función.
    useEffect(() => {
        if (!router.isReady) return
        const { categoria: cat, ...resto } = router.query
        if (typeof cat === 'string' && CATEGORIAS.some(c => c.value === cat)) {
            setCategoria(cat as SupportCategory)
            router.replace({ pathname: router.pathname, query: resto }, undefined, { shallow: true })
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [router.isReady])

    const valido = asunto.trim().length >= 3 && mensaje.trim().length >= 10

    async function enviar() {
        if (!valido || enviando) return
        setEnviando(true)
        setError(null)
        try {
            await panelSendSupportRequest({ category: categoria, subject: asunto.trim(), message: mensaje.trim(), contactPhone: telefono.trim() || undefined })
            setEnviado(true)
        } catch (e) {
            setError(e instanceof ApiError ? e.message : 'No se pudo enviar tu consulta — probá de nuevo en un momento')
        } finally {
            setEnviando(false)
        }
    }

    function otraConsulta() {
        setEnviado(false)
        setAsunto('')
        setMensaje('')
        setTelefono('')
        setCategoria('OTRO')
    }

    return (
        <div style={pageWrap}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
                <div style={{ width: 40, height: 40, borderRadius: 10, flexShrink: 0, display: 'grid', placeItems: 'center', background: 'var(--color-primary-bg)' }}>
                    <LifeBuoy size={19} strokeWidth={1.8} color="var(--color-primary)" />
                </div>
                <h1 style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--color-text)', margin: 0 }}>Soporte</h1>
            </div>
            <div style={{ fontSize: 14, color: 'var(--color-muted)', margin: '0 0 22px', maxWidth: 640 }}>
                Escribinos por cualquier consulta — dominios, facturación, un problema técnico, o lo que sea. Te respondemos directo a tu correo.
            </div>

            <Card padding="md" style={{ maxWidth: 640 }}>
                {enviado ? (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 12, padding: '24px 8px' }}>
                        <div style={{ width: 52, height: 52, borderRadius: '50%', display: 'grid', placeItems: 'center', background: 'var(--color-success-bg)' }}>
                            <Check size={24} strokeWidth={2.5} color="var(--color-success)" />
                        </div>
                        <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--color-text)' }}>Recibimos tu consulta</div>
                        <div style={{ fontSize: 13.5, color: 'var(--color-muted)', maxWidth: 380, lineHeight: 1.6 }}>
                            Te vamos a responder por correo lo antes posible.
                        </div>
                        <Button variant="secondary" size="sm" onClick={otraConsulta} style={{ marginTop: 6 }}>Hacer otra consulta</Button>
                    </div>
                ) : (
                    <>
                        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text)', marginBottom: 10 }}>¿Sobre qué es tu consulta?</div>
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 18 }}>
                            {CATEGORIAS.map(c => {
                                const activa = categoria === c.value
                                return (
                                    <button
                                        key={c.value}
                                        type="button"
                                        onClick={() => setCategoria(c.value)}
                                        style={{
                                            display: 'inline-flex', alignItems: 'center', gap: 7, height: 34, padding: '0 14px',
                                            borderRadius: 999, cursor: 'pointer', fontFamily: 'inherit', fontSize: 12.5, fontWeight: 600,
                                            border: `1.5px solid ${activa ? 'var(--color-primary)' : 'var(--color-border)'}`,
                                            background: activa ? 'var(--color-primary-bg)' : 'var(--color-bg)',
                                            color: activa ? 'var(--color-primary)' : 'var(--color-body)',
                                        }}
                                    >
                                        <c.Icon size={14} strokeWidth={2} />
                                        {c.label}
                                    </button>
                                )
                            })}
                        </div>

                        <label style={{ display: 'block', marginBottom: 14 }}>
                            <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-body)', marginBottom: 6 }}>Asunto</div>
                            <input
                                value={asunto}
                                onChange={e => setAsunto(e.target.value)}
                                placeholder="Ej: Quiero comprar un dominio .com.ar"
                                className="ds-field"
                                style={{ width: '100%', boxSizing: 'border-box', height: 40, border: '1px solid var(--color-border)', borderRadius: 8, padding: '0 12px', fontSize: 14, color: 'var(--color-text)', background: 'var(--color-bg)', fontFamily: 'inherit' }}
                            />
                        </label>

                        <label style={{ display: 'block', marginBottom: 14 }}>
                            <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-body)', marginBottom: 6 }}>Contanos el detalle</div>
                            <textarea
                                value={mensaje}
                                onChange={e => setMensaje(e.target.value)}
                                placeholder="Cuanto más detalle nos des, más rápido te podemos ayudar."
                                rows={6}
                                className="ds-field"
                                style={{ width: '100%', boxSizing: 'border-box', border: '1px solid var(--color-border)', borderRadius: 8, padding: '10px 12px', fontSize: 14, color: 'var(--color-text)', background: 'var(--color-bg)', fontFamily: 'inherit', resize: 'vertical', minHeight: 120 }}
                            />
                        </label>

                        <label style={{ display: 'block', marginBottom: 8 }}>
                            <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-body)', marginBottom: 6 }}>Teléfono (opcional)</div>
                            <input
                                value={telefono}
                                onChange={e => setTelefono(e.target.value)}
                                placeholder="Por si preferís que te llamemos"
                                className="ds-field"
                                style={{ width: '100%', boxSizing: 'border-box', height: 40, border: '1px solid var(--color-border)', borderRadius: 8, padding: '0 12px', fontSize: 14, color: 'var(--color-text)', background: 'var(--color-bg)', fontFamily: 'inherit' }}
                            />
                        </label>

                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5, color: 'var(--color-subtle)', marginBottom: 16 }}>
                            <Mail size={12} strokeWidth={1.8} /> Te respondemos al correo de tu cuenta — no hace falta que lo escribas.
                        </div>

                        {error && <div style={{ fontSize: 12.5, color: 'var(--color-error)', marginBottom: 12 }}>{error}</div>}

                        <Button variant="primary" loading={enviando} disabled={!valido} onClick={enviar}>Enviar consulta</Button>
                    </>
                )}
            </Card>
        </div>
    )
}

const pageWrap: React.CSSProperties = { padding: '24px 32px 64px', maxWidth: 1280, width: '100%', margin: '0 auto', boxSizing: 'border-box' }
