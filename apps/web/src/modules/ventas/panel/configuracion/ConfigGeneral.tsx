// src/modules/ventas/panel/configuracion/ConfigGeneral.tsx — Vista 15 + hub
//
// Punto de entrada del módulo `configuracion` (registrado en el componentMap).
// Hub con tabs: general (V15), apariencia (V16), equipo (V17), notificaciones (V18).
//
//   /admin/[negocioId]/ventas/configuracion              → general (V15)
//   …/configuracion?vista=apariencia                     → Apariencia (V16)
//   …/configuracion?vista=equipo                         → Equipo (V17)
//   …/configuracion?vista=notificaciones                 → Notificaciones (V18)
//
// (Fase 1 — Alex) La pestaña General ya trabaja con los datos reales del negocio:
// al abrir trae todo del backend, y cada tarjeta tiene su propio botón de guardar,
// así si falla una no se pierde lo del resto. Usa la sesión real del login: si no
// entraste con tu cuenta, muestra un aviso con un botón para ir a iniciar sesión.
// "Eliminar espacio" está deshabilitado a propósito: eso llega con el módulo de
// suscripciones (decisión del equipo, quedó anotado en PENDIENTES.md).

import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { Card } from '@/design-system/components/Card'
import { Button } from '@/design-system/components/Button'
import { Toast } from '@/design-system/components/Toast'
import { Skeleton, SkeletonText } from '@/design-system/components/Skeleton'
import { toastEsError } from '@/lib/utils'
import { Modal } from '@/design-system/components/Modal'
import { useAuth } from '@/hooks/useAuth'
import {
    ApiError,
    panelGetBusiness, updateBusiness,
    panelGetBusinessConfig, panelUpdateBusinessConfig,
    pauseBusiness,
} from '@/lib/api'

import { ConfigTabs, type VistaConfig } from './components/ConfigTabs'
import { CfgField, Toggle } from './components/ConfigControls'
import Apariencia from './Apariencia'
import Equipo from './Equipo'
import Notificaciones from './Notificaciones'

// Métodos de pago que se muestran en la card (mapean 1:1 a business_config).
const PAGOS_META: { key: 'acceptsMercadopago' | 'acceptsCash' | 'acceptsPickup' | 'acceptsTransfer'; label: string; desc: string }[] = [
    { key: 'acceptsMercadopago', label: 'Mercado Pago',    desc: 'Pagos online con tarjeta, débito y cuotas' },
    { key: 'acceptsCash',        label: 'Efectivo',        desc: 'Pago presencial o contra entrega' },
    { key: 'acceptsPickup',      label: 'Retiro en local', desc: 'El cliente retira y paga en el local' },
    { key: 'acceptsTransfer',    label: 'Transferencia',   desc: 'Transferencia bancaria — requiere un alias cargado' },
]

// ─── General (V15) ────────────────────────────────────────────────────────────

function SectionTitle({ children }: { children: React.ReactNode }) {
    return <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--color-text)', marginBottom: 16 }}>{children}</div>
}

// Cartelito rojo que aparece abajo del botón cuando un guardado falla.
function ErrorInline({ msg }: { msg?: string | null }) {
    if (!msg) return null
    return <div style={{ fontSize: 13, color: 'var(--color-error)', marginTop: 10 }}>{msg}</div>
}

// El botoncito "¿Qué pasa si...?" de la zona peligrosa: lo tocás y se abre la
// explicación completa. Así el texto queda corto (clave en el celular) pero la
// información está toda ahí igual.
function DetalleExpandible({ pregunta, children }: { pregunta: string; children: React.ReactNode }) {
    const [abierto, setAbierto] = useState(false)
    return (
        <div style={{ marginTop: 10 }}>
            <button
                onClick={() => setAbierto(a => !a)}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontFamily: 'inherit', fontSize: 12, fontWeight: 500, color: 'var(--color-primary)' }}
            >
                <span style={{ display: 'inline-block', transform: abierto ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 150ms' }}>▸</span>
                {pregunta}
            </button>
            {abierto && (
                <ul style={{ margin: '8px 0 0', paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12, color: 'var(--color-body)', lineHeight: 1.5 }}>
                    {children}
                </ul>
            )}
        </div>
    )
}

function GeneralView({ ir, onToast }: { ir: (v: VistaConfig) => void; onToast: (m: string) => void }) {
    // Acá me fijo si hay alguien con la sesión iniciada. Mientras la recupera
    // dice 'loading'; después queda logueado o anónimo. Esta pantalla es solo
    // para el dueño o su equipo, no para clientes.
    const { status: authStatus, user } = useAuth()
    const esDueno = authStatus === 'authenticated' && user?.type === 'member'

    // ── Carga inicial ──
    const [cargando, setCargando] = useState(true)
    const [sinSesion, setSinSesion] = useState(false)
    const [errorCarga, setErrorCarga] = useState<string | null>(null)
    const [recarga, setRecarga] = useState(0)
    // Snapshot de lo cargado, por tarjeta: sirve para saber si "hay cambios" y
    // deshabilitar el botón Guardar cuando la tarjeta está igual que la base.
    const [orig, setOrig] = useState<Record<string, string>>({})

    // ── Lo que se va escribiendo en cada tarjeta (cada una guarda lo suyo aparte) ──
    const [negocio, setNegocio]   = useState({ name: '', industry: '', description: '' })
    const [contacto, setContacto] = useState({ whatsapp: '', email: '', scheduleText: '' })
    const [pagos, setPagos]       = useState({ acceptsMercadopago: false, acceptsCash: false, acceptsPickup: false, acceptsTransfer: false, transferAlias: '' })
    const [envios, setEnvios]     = useState({ shippingBase: '', freeShippingFrom: '', deliveryZones: '', shippingPolicy: '' })
    const [redes, setRedes]       = useState({ instagram: '', tiktok: '', facebook: '' })
    const [isPaused, setIsPaused] = useState(false)

    const [guardando, setGuardando] = useState<string | null>(null)                // card que está guardando
    const [errores, setErrores]     = useState<Record<string, string | null>>({}) // error por card
    const [modalPausa, setModalPausa] = useState(false)

    useEffect(() => {
        if (authStatus === 'loading') return          // todavía no sabemos si hay sesión
        if (!esDueno) { setCargando(false); return }  // sin sesión de dueño → banner
        let cancelado = false
        async function cargar() {
            setCargando(true)
            try {
                const [biz, cfg] = await Promise.all([panelGetBusiness(), panelGetBusinessConfig()])
                if (cancelado) return
                const negocio0 = { name: biz.name ?? '', industry: biz.industry ?? '', description: biz.description ?? '' }
                const contacto0 = { whatsapp: cfg.whatsapp ?? '', email: cfg.email ?? '', scheduleText: cfg.scheduleText ?? '' }
                const pagos0 = {
                    acceptsMercadopago: cfg.acceptsMercadopago,
                    acceptsCash: cfg.acceptsCash,
                    acceptsPickup: cfg.acceptsPickup,
                    acceptsTransfer: cfg.acceptsTransfer,
                    transferAlias: cfg.transferAlias ?? '',
                }
                const envios0 = {
                    // Los montos llegan del backend como texto: los muestro tal cual
                    // y los paso a número recién en el momento de guardar.
                    shippingBase: cfg.shippingBase != null ? String(cfg.shippingBase) : '',
                    freeShippingFrom: cfg.freeShippingFrom != null ? String(cfg.freeShippingFrom) : '',
                    deliveryZones: (cfg.deliveryZones ?? []).join(', '),
                    shippingPolicy: cfg.shippingPolicy ?? '',
                }
                const redes0 = { instagram: cfg.instagram ?? '', tiktok: cfg.tiktok ?? '', facebook: cfg.facebook ?? '' }
                setNegocio(negocio0)
                setIsPaused(biz.isPaused)
                setContacto(contacto0)
                setPagos(pagos0)
                setEnvios(envios0)
                setRedes(redes0)
                setErrorCarga(null)
                // Snapshot para la detección de cambios por tarjeta.
                setOrig({
                    negocio: JSON.stringify(negocio0),
                    contacto: JSON.stringify(contacto0),
                    pagos: JSON.stringify(pagos0),
                    envios: JSON.stringify(envios0),
                    redes: JSON.stringify(redes0),
                })
            } catch (e) {
                if (cancelado) return
                if (e instanceof ApiError && e.status === 401) setSinSesion(true)
                else setErrorCarga(e instanceof Error ? e.message : 'No se pudo cargar la configuración')
            } finally {
                if (!cancelado) setCargando(false)
            }
        }
        cargar()
        return () => { cancelado = true }
    }, [authStatus, esDueno, recarga])

    // "Hay cambios" por tarjeta: el estado actual difiere del snapshot cargado.
    const cambiado = (card: string, actual: unknown) => orig[card] !== undefined && orig[card] !== JSON.stringify(actual)

    // El guardado que usan todas las tarjetas: pone el botón en "guardando", borra
    // el error viejo, manda los datos al backend y avisa cómo salió (cartel verde
    // si salió bien, cartelito rojo abajo del botón si no).
    // snapshotObj: el objeto de la tarjeta, para re-marcarla como "sin cambios"
    // cuando el guardado sale bien (así el botón se vuelve a deshabilitar).
    async function guardar(card: string, fn: () => Promise<unknown>, okMsg: string, snapshotObj?: unknown) {
        setGuardando(card)
        setErrores(prev => ({ ...prev, [card]: null }))
        try {
            await fn()
            if (snapshotObj !== undefined) setOrig(prev => ({ ...prev, [card]: JSON.stringify(snapshotObj) }))
            onToast(okMsg)
        } catch (e) {
            const msg = e instanceof ApiError ? e.message : 'Error inesperado al guardar'
            setErrores(prev => ({ ...prev, [card]: msg }))
        } finally {
            setGuardando(null)
        }
    }

    const guardarNegocio = () => guardar('negocio',
        () => updateBusiness({ name: negocio.name, industry: negocio.industry, description: negocio.description }),
        'Información del negocio guardada', negocio)

    const guardarContacto = () => guardar('contacto',
        () => panelUpdateBusinessConfig({
            whatsapp: contacto.whatsapp,
            scheduleText: contacto.scheduleText,
            // Si el email está vacío directamente no lo mando: el backend no acepta un email en blanco.
            ...(contacto.email.trim() ? { email: contacto.email.trim() } : {}),
        }),
        'Datos de contacto guardados', contacto)

    const guardarPagos = () => guardar('pagos',
        () => panelUpdateBusinessConfig({
            acceptsMercadopago: pagos.acceptsMercadopago,
            acceptsCash: pagos.acceptsCash,
            acceptsPickup: pagos.acceptsPickup,
            acceptsTransfer: pagos.acceptsTransfer,
            // El alias vacío no se manda; si activás transferencia sin poner el alias,
            // el backend lo rechaza y ese aviso es el que se ve abajo del botón.
            ...(pagos.transferAlias.trim() ? { transferAlias: pagos.transferAlias.trim() } : {}),
        }),
        'Métodos de pago guardados', pagos)

    const guardarEnvios = () => {
        const base = Number(envios.shippingBase)
        const gratis = Number(envios.freeShippingFrom)
        if (envios.shippingBase.trim() !== '' && Number.isNaN(base)) {
            setErrores(prev => ({ ...prev, envios: 'El costo base debe ser un número' })); return
        }
        if (envios.freeShippingFrom.trim() !== '' && Number.isNaN(gratis)) {
            setErrores(prev => ({ ...prev, envios: 'El monto de envío gratis debe ser un número' })); return
        }
        guardar('envios', () => panelUpdateBusinessConfig({
            ...(envios.shippingBase.trim() !== '' ? { shippingBase: base } : {}),
            ...(envios.freeShippingFrom.trim() !== '' ? { freeShippingFrom: gratis } : {}),
            deliveryZones: envios.deliveryZones.split(',').map(z => z.trim()).filter(Boolean),
            shippingPolicy: envios.shippingPolicy,
        }), 'Configuración de envíos guardada', envios)
    }

    const guardarRedes = () => guardar('redes',
        () => panelUpdateBusinessConfig({ instagram: redes.instagram, tiktok: redes.tiktok, facebook: redes.facebook }),
        'Redes sociales guardadas', redes)

    async function confirmarPausa() {
        setModalPausa(false)
        setGuardando('pausa')
        setErrores(prev => ({ ...prev, pausa: null }))
        try {
            const r = await pauseBusiness(!isPaused)
            setIsPaused(r.isPaused)
            onToast(r.isPaused ? 'Tienda pausada' : 'Tienda reactivada')
        } catch (e) {
            const msg = e instanceof ApiError ? e.message : 'Error inesperado'
            setErrores(prev => ({ ...prev, pausa: msg }))
        } finally {
            setGuardando(null)
        }
    }

    // ── Pantallas especiales: sin sesión, cargando, o error al traer los datos ──

    if ((authStatus !== 'loading' && !esDueno) || sinSesion) {
        return (
            <div style={pageWrap}>
                <ConfigTabs activo="general" ir={ir} />
                <h1 style={h1Style}>Configuración general</h1>
                <Card>
                    <SectionTitle>No hay sesión activa</SectionTitle>
                    <div style={{ fontSize: 14, color: 'var(--color-body)', lineHeight: 1.6, marginBottom: 14 }}>
                        Esta pantalla usa datos reales de tu negocio y necesita que entres con tu
                        cuenta de dueño (o de tu equipo).
                    </div>
                    {/* Va con recarga completa a propósito: es la forma en que el equipo
                        maneja la ida al login, y así anda bien también con subdominios. */}
                    <Button variant="primary" onClick={() => { window.location.href = '/login' }}>
                        Iniciar sesión
                    </Button>
                </Card>
            </div>
        )
    }

    if (cargando) {
        // Silueta con la forma de las tarjetas de configuración (2 por fila).
        return (
            <div style={pageWrap}>
                <ConfigTabs activo="general" ir={ir} />
                <h1 style={h1Style}>Configuración general</h1>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0,1fr))', gap: 16, maxWidth: 1080 }} aria-hidden="true">
                    {[0, 1, 2, 3].map(i => (
                        <div key={i} style={{ border: '1px solid var(--color-border)', borderRadius: 12, padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
                            <SkeletonText width="45%" height={13} delay={i * 80} />
                            <SkeletonText width="100%" height={34} delay={i * 80 + 40} style={{ borderRadius: 8 }} />
                            <SkeletonText width="100%" height={34} delay={i * 80 + 70} style={{ borderRadius: 8 }} />
                            <Skeleton width={120} height={36} radius={8} delay={i * 80 + 110} />
                        </div>
                    ))}
                </div>
            </div>
        )
    }

    if (errorCarga) {
        return (
            <div style={pageWrap}>
                <ConfigTabs activo="general" ir={ir} />
                <h1 style={h1Style}>Configuración general</h1>
                <Card>
                    <SectionTitle>No se pudo cargar la configuración</SectionTitle>
                    <div style={{ fontSize: 14, color: 'var(--color-error)', marginBottom: 14 }}>{errorCarga}</div>
                    <Button variant="primary" onClick={() => setRecarga(n => n + 1)}>Reintentar</Button>
                </Card>
            </div>
        )
    }

    return (
        <div style={pageWrap}>
            <ConfigTabs activo="general" ir={ir} />
            <h1 style={h1Style}>Configuración general</h1>

            {/* Las tarjetas van de a dos por fila en pantallas anchas (menos scroll);
                en celular vuelven a una sola columna. */}
            <style>{`
                .cfg-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; align-items: stretch; max-width: 1080px; }
                .cfg-grid > * { height: 100%; box-sizing: border-box; }
                @media (max-width: 980px) { .cfg-grid { grid-template-columns: 1fr; max-width: 720px; } }
            `}</style>
            <div className="cfg-grid">

                {/* ── Información del negocio ── */}
                <Card>
                    <SectionTitle>Información del negocio</SectionTitle>
                    <CfgField label="Nombre del negocio" value={negocio.name} onChange={v => setNegocio(p => ({ ...p, name: v }))} />
                    <CfgField label="Rubro" value={negocio.industry} onChange={v => setNegocio(p => ({ ...p, industry: v }))} />
                    <CfgField label="Descripción corta" value={negocio.description} area onChange={v => setNegocio(p => ({ ...p, description: v }))} />
                    <Button variant="primary" loading={guardando === 'negocio'} disabled={!cambiado('negocio', negocio)} onClick={guardarNegocio}>Guardar cambios</Button>
                    <ErrorInline msg={errores.negocio} />
                </Card>

                {/* ── Datos de contacto ── */}
                <Card>
                    <SectionTitle>Datos de contacto</SectionTitle>
                    <CfgField label="WhatsApp de atención" value={contacto.whatsapp} onChange={v => setContacto(p => ({ ...p, whatsapp: v }))} />
                    <CfgField label="Email de contacto" value={contacto.email} onChange={v => setContacto(p => ({ ...p, email: v }))} />
                    <CfgField label="Horario de atención" value={contacto.scheduleText} onChange={v => setContacto(p => ({ ...p, scheduleText: v }))} />
                    <Button variant="primary" loading={guardando === 'contacto'} disabled={!cambiado('contacto', contacto)} onClick={guardarContacto}>Guardar cambios</Button>
                    <ErrorInline msg={errores.contacto} />
                </Card>

                {/* ── Métodos de pago ── */}
                <Card>
                    <SectionTitle>Métodos de pago</SectionTitle>
                    {PAGOS_META.map(({ key, label, desc }, i) => (
                        <div key={key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, padding: '12px 0', borderBottom: i < PAGOS_META.length - 1 ? '1px solid var(--color-border)' : 'none' }}>
                            <div>
                                <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--color-body)' }}>{label}</div>
                                <div style={{ fontSize: 12, color: 'var(--color-muted)', marginTop: 2 }}>{desc}</div>
                            </div>
                            <Toggle on={pagos[key]} onChange={v => setPagos(p => ({ ...p, [key]: v }))} />
                        </div>
                    ))}
                    {pagos.acceptsTransfer && (
                        <div style={{ marginTop: 14 }}>
                            <CfgField label="Alias para transferencias" value={pagos.transferAlias} onChange={v => setPagos(p => ({ ...p, transferAlias: v }))} />
                        </div>
                    )}
                    <div style={{ marginTop: 14 }}>
                        <Button variant="primary" loading={guardando === 'pagos'} disabled={!cambiado('pagos', pagos)} onClick={guardarPagos}>Guardar cambios</Button>
                    </div>
                    <ErrorInline msg={errores.pagos} />
                </Card>

                {/* ── Envíos ── */}
                <Card>
                    <SectionTitle>Envíos</SectionTitle>
                    {/* Estos dos campos solo dejan escribir números (nada de letras) */}
                    <CfgField label="Costo base de envío ($)" value={envios.shippingBase} onChange={v => setEnvios(p => ({ ...p, shippingBase: v.replace(/[^0-9.,]/g, '') }))} />
                    <CfgField label="Envío gratis desde ($)" value={envios.freeShippingFrom} onChange={v => setEnvios(p => ({ ...p, freeShippingFrom: v.replace(/[^0-9.,]/g, '') }))} />
                    <CfgField label="Zonas de entrega (separadas por coma)" value={envios.deliveryZones} onChange={v => setEnvios(p => ({ ...p, deliveryZones: v }))} />
                    <CfgField label="Texto de política de envíos" value={envios.shippingPolicy} area onChange={v => setEnvios(p => ({ ...p, shippingPolicy: v }))} />
                    <Button variant="primary" loading={guardando === 'envios'} disabled={!cambiado('envios', envios)} onClick={guardarEnvios}>Guardar cambios</Button>
                    <ErrorInline msg={errores.envios} />
                </Card>

                {/* ── Redes sociales ── */}
                <Card>
                    <SectionTitle>Redes sociales</SectionTitle>
                    <CfgField label="Instagram" value={redes.instagram} onChange={v => setRedes(p => ({ ...p, instagram: v }))} />
                    <CfgField label="TikTok" value={redes.tiktok} onChange={v => setRedes(p => ({ ...p, tiktok: v }))} />
                    <CfgField label="Facebook" value={redes.facebook} onChange={v => setRedes(p => ({ ...p, facebook: v }))} />
                    <Button variant="primary" loading={guardando === 'redes'} disabled={!cambiado('redes', redes)} onClick={guardarRedes}>Guardar cambios</Button>
                    <ErrorInline msg={errores.redes} />
                </Card>

                {/* ── Zona peligrosa ── */}
                <Card>
                    <SectionTitle>Zona peligrosa</SectionTitle>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

                        {/* Pausar / reactivar */}
                        <div style={cajaPeligro}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                                <div style={{ minWidth: 180, flex: 1 }}>
                                    <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-body)' }}>
                                        {isPaused ? 'Reactivar tienda' : 'Pausar tienda'}
                                    </div>
                                    <div style={{ fontSize: 12, color: 'var(--color-muted)', marginTop: 2 }}>
                                        {isPaused
                                            ? 'Tu tienda está pausada: tus clientes no la ven.'
                                            : 'Tu tienda deja de estar visible para tus clientes. Tus datos se conservan.'}
                                    </div>
                                </div>
                                <Button variant="outline" loading={guardando === 'pausa'} onClick={() => setModalPausa(true)}>
                                    {isPaused ? 'Reactivar' : 'Pausar'}
                                </Button>
                            </div>
                            <DetalleExpandible pregunta="¿Qué pasa si pauso la tienda?">
                                <li>Nadie puede ver tu tienda ni comprarte mientras esté pausada.</li>
                                <li>Vos seguís entrando al panel con normalidad.</li>
                                <li>Tus datos, productos y pedidos quedan intactos.</li>
                                <li>La reactivás cuando quieras, con un click.</li>
                            </DetalleExpandible>
                            <ErrorInline msg={errores.pausa} />
                        </div>

                        {/* Eliminar espacio */}
                        <div style={cajaPeligro}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                                <div style={{ minWidth: 180, flex: 1 }}>
                                    <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-error)' }}>Eliminar espacio</div>
                                    <div style={{ fontSize: 12, color: 'var(--color-muted)', marginTop: 2 }}>
                                        Borra tu espacio con todos sus datos.
                                    </div>
                                </div>
                                <Button variant="danger" disabled>Eliminar</Button>
                            </div>
                            <DetalleExpandible pregunta="¿Qué pasa si elimino mi espacio?">
                                <li>Con una suscripción activa, la tienda se pausa hasta que termine el período que ya pagaste.</li>
                                <li>Al terminar, tenés 30 días para arrepentirte y recuperar todo (volviendo a pagar la suscripción).</li>
                                <li>Pasados esos 30 días, el espacio y todos sus datos se eliminan de forma definitiva.</li>
                                <li style={{ color: 'var(--color-muted)' }}>Esta parte todavía la estamos armando, así que por ahora el botón no anda.</li>
                            </DetalleExpandible>
                        </div>

                    </div>
                </Card>

            </div>

            <Modal
                isOpen={modalPausa}
                onClose={() => setModalPausa(false)}
                title={isPaused ? '¿Reactivar la tienda?' : '¿Pausar la tienda?'}
                variant={isPaused ? 'default' : 'danger'}
                footer={
                    <>
                        <Button variant="secondary" onClick={() => setModalPausa(false)}>Cancelar</Button>
                        <Button variant={isPaused ? 'primary' : 'danger'} onClick={confirmarPausa}>
                            {isPaused ? 'Sí, reactivar' : 'Sí, pausar'}
                        </Button>
                    </>
                }
            >
                <div style={{ fontSize: 14, color: 'var(--color-body)', lineHeight: 1.6 }}>
                    {isPaused
                        ? 'Tu tienda vuelve a estar visible para tus clientes.'
                        : 'Tu tienda deja de estar visible para tus clientes. Los datos se conservan y podés reactivarla cuando quieras.'}
                </div>
            </Modal>
        </div>
    )
}

// ─── Hub ──────────────────────────────────────────────────────────────────────

export default function ConfigGeneral() {
    const router = useRouter()
    const { vista } = router.query
    const [toast, setToast] = useState<string | null>(null)

    useEffect(() => {
        if (!toast) return
        const t = setTimeout(() => setToast(null), 3000)
        return () => clearTimeout(t)
    }, [toast])

    const ir = (v: VistaConfig) => {
        const { vista: _v, ...rest } = router.query
        const q: Record<string, string | string[] | undefined> = { ...rest }
        if (v !== 'general') q.vista = v
        router.push({ query: q })
    }

    const sub = vista as VistaConfig | undefined
    let content
    if (sub === 'apariencia')          content = <Apariencia ir={ir} onToast={setToast} />
    else if (sub === 'equipo')         content = <Equipo ir={ir} onToast={setToast} />
    else if (sub === 'notificaciones') content = <Notificaciones ir={ir} />
    else                               content = <GeneralView ir={ir} onToast={setToast} />

    return (
        <>
            {content}
            {toast && (
                <div style={{ position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', zIndex: 9000 }}>
                    <Toast variant={toastEsError(toast) ? 'error' : 'success'} title={toast} onClose={() => setToast(null)} />
                </div>
            )}
        </>
    )
}

const pageWrap: React.CSSProperties = { padding: '24px 32px 64px', maxWidth: 1280, width: '100%', margin: '0 auto', boxSizing: 'border-box' }
const h1Style: React.CSSProperties = { fontSize: 26, fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--color-text)', margin: '0 0 20px' }
const cajaPeligro: React.CSSProperties = { border: '1px solid var(--color-border)', borderRadius: 10, padding: '12px 14px' }
