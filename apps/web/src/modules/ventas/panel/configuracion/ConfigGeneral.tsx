// src/modules/ventas/panel/configuracion/ConfigGeneral.tsx — hub de Configuración
//
// Punto de entrada del módulo `configuracion` (registrado en el componentMap).
//
//   /admin/[negocioId]/ventas/configuracion               → Negocio (default, sin ?vista=)
//   …/configuracion?vista=contacto|pagos|envios|redes|peligro
//   …/configuracion?vista=apariencia|equipo|notificaciones
//
// (2026-08-20) Rediseño completo del módulo: antes "General" era una sola
// pantalla con 6 tarjetas apiladas de a dos columnas, y Apariencia/Equipo/
// Notificaciones vivían como pantallas sueltas elegidas desde el sidebar
// PRINCIPAL del panel. Ahora las 9 son secciones independientes ("raíces",
// no tabs ni cards agrupadas) de un menú guía propio (ConfigSidebar.tsx) que
// vive DENTRO de esta pantalla — el sidebar principal se colapsa solo a la
// franja de íconos apenas se entra a Configuración (ver Sidebar.tsx) para
// hacerle lugar, mismo patrón que un módulo de configuración típico.
//
// Cada sección trae sus propios datos y tiene su propio botón de guardar
// (así si falla una no se pierde lo del resto — sin cambios ahí). Usa la
// sesión real del login: si no entraste con tu cuenta, muestra un aviso con
// un botón para ir a iniciar sesión. "Eliminar espacio" está deshabilitado a
// propósito: eso llega con el módulo de suscripciones (decisión del equipo).

import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { MapPin, LocateFixed } from 'lucide-react'
import { Card } from '@/design-system/components/Card'
import { Button } from '@/design-system/components/Button'
import { Toast } from '@/design-system/components/Toast'
import { Skeleton, SkeletonText } from '@/design-system/components/Skeleton'
import { toastEsError } from '@/lib/utils'
import { Modal } from '@/design-system/components/Modal'
import { MapPicker } from '@/components/MapPicker'
import { useAuth } from '@/hooks/useAuth'
import {
    ApiError,
    panelGetBusiness, updateBusiness,
    panelGetBusinessConfig, panelUpdateBusinessConfig,
    panelListBranches, panelUpdateBranch,
    pauseBusiness, changeBusinessMode,
    panelGetMercadopagoStatus, panelGetMercadopagoConnectUrl, panelDisconnectMercadopago,
} from '@/lib/api'

import type { VistaConfig } from './components/ConfigTabs'
import { CfgField, Toggle } from './components/ConfigControls'
import { ConfigSidebar } from './components/ConfigSidebar'
import Apariencia from './Apariencia'
import Equipo from './Equipo'
import Notificaciones from './Notificaciones'

// Métodos que aplican a CUALQUIER forma de entrega (domicilio o retiro) —
// Efectivo, en cambio, solo tiene sentido con retiro en local y se muestra
// aparte, en su propia sección (ver vista === 'pagos' más abajo).
const PAGOS_META: { key: 'acceptsMercadopago' | 'acceptsTransfer'; label: string; desc: string }[] = [
    { key: 'acceptsMercadopago', label: 'Mercado Pago', desc: 'Pagos online con tarjeta, débito y cuotas' },
    // Antes "Transferencia" (pedía CBU/alias de entrada) — ahora el negocio
    // coordina el pago directo por WhatsApp, sin mostrar ningún dato bancario.
    { key: 'acceptsTransfer', label: 'Coordinar por WhatsApp', desc: 'El negocio coordina el pago con el cliente, sin pedir CBU/alias' },
]

// Default del mapa cuando la sucursal todavía no tiene coordenadas — mismo
// centro (Buenos Aires) que usa el mapa del wizard de onboarding.
const BA: [number, number] = [-34.6037, -58.3816]

// Título de arriba de página según la sección activa del menú guía.
const TITULOS_SECCION: Partial<Record<VistaConfig, string>> = {
    negocio: 'Negocio', general: 'Negocio', contacto: 'Contacto', pagos: 'Pagos',
    envios: 'Envíos', redes: 'Redes sociales', postventa: 'Cancelaciones y devoluciones', peligro: 'Zona peligrosa',
}

// Mismo enum cerrado que el backend (update-business-config.dto.ts) — acá
// solo se mapea a label, la validación real vive del otro lado.
// MERCADOPAGO se filtra más abajo (solo tiene sentido ofrecer restringirlo
// en retiro si el negocio lo acepta en general). Coordinar por WhatsApp NO
// entra en esta lista a pedido: siempre sigue el toggle general
// (acceptsTransfer), sin restricción puntual para retiro.
const PICKUP_PAGO_META: { key: string; label: string }[] = [
    { key: 'CASH',         label: 'Efectivo' },
    { key: 'DEBIT',        label: 'Débito' },
    { key: 'CREDIT',       label: 'Crédito' },
    { key: 'MERCADOPAGO',  label: 'Mercado Pago' },
]

// Mismo enum cerrado que el checkout (CheckoutPago.tsx CARRIER_LABEL) — acá
// el negocio elige cuáles de estos ofrece de verdad. Vacío = todos (así un
// negocio que nunca tocó esto sigue viendo la lista completa en su checkout).
const CARRIER_META: { key: string; label: string }[] = [
    { key: 'CORREO_ARGENTINO', label: 'Correo Argentino' },
    { key: 'OCA',              label: 'OCA' },
    { key: 'ANDREANI',         label: 'Andreani' },
    { key: 'VIA_CARGO',        label: 'Vía Cargo' },
    { key: 'DELIVERY_APP',     label: 'Delivery local (moto/app)' },
    { key: 'OTRO',             label: 'Otro / a coordinar' },
]

// ─── Skeleton ────────────────────────────────────────────────────────────────
// Silueta de carga con la forma real de la pantalla: 6 tarjetas a 2 columnas,
// cada una con su título, sus renglones y el botón de guardar abajo. Usa el
// componente compartido del design-system (la misma clase `.skel` que el resto
// del panel), así el barrido de luz y el corte por prefers-reduced-motion son
// idénticos en todas las pantallas — no un shimmer propio por pantalla. El
// `delay` escalona tarjeta por tarjeta y renglón por renglón para que la luz
// entre en cascada, no todo de golpe.

function CardSkeleton({ lineas, delay = 0 }: { lineas: number; delay?: number }) {
    return (
        <div style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 12, padding: 24 }}>
            <SkeletonText width={160} height={15} delay={delay} style={{ marginBottom: 16 }} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {Array.from({ length: lineas }).map((_, i) => (
                    <Skeleton key={i} height={38} radius={8} delay={delay + (i + 1) * 40} />
                ))}
            </div>
            <Skeleton width={140} height={36} radius={8} delay={delay + (lineas + 1) * 40} style={{ marginTop: 16 }} />
        </div>
    )
}

function GeneralViewSkeleton() {
    // Una sola tarjeta enfocada — mismo criterio que la pantalla real ahora
    // (cada sección del menú guía es una tarjeta a la vez, no un grid).
    return (
        <div style={pageWrap}>
            <SkeletonText width={180} height={30} delay={0} style={{ marginBottom: 20 }} />
            <div style={{ maxWidth: 640 }} aria-hidden="true">
                <CardSkeleton lineas={3} />
            </div>
        </div>
    )
}

// ─── General (V15) ────────────────────────────────────────────────────────────

function SectionTitle({ children }: { children: React.ReactNode }) {
    return <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--color-text)', marginBottom: 16 }}>{children}</div>
}

// Insignia de Mercado Pago para la card de conexión: azul de marca + un ícono
// de tarjeta/moneda (no el isotipo real de MP, para no reproducir su logo
// pixel a pixel) — alcanza para que se identifique de un vistazo de quién es
// la integración sin meter un asset externo nuevo al proyecto.
function MercadopagoBadge() {
    return (
        <div style={{
            width: 38, height: 38, borderRadius: 10, flexShrink: 0,
            background: 'linear-gradient(135deg, #00B1EA 0%, #0090D6 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 2px 6px rgba(0,144,214,0.35)',
        }}>
            <svg width="19" height="19" viewBox="0 0 24 24" fill="none">
                <rect x="2" y="6" width="20" height="14" rx="2.5" fill="#fff" fillOpacity="0.95" />
                <rect x="2" y="9.5" width="20" height="3" fill="#0090D6" />
                <circle cx="17" cy="16" r="2.4" fill="#FFE600" />
            </svg>
        </div>
    )
}

// Cartelito rojo que aparece abajo del botón cuando un guardado falla.
function ErrorInline({ msg }: { msg?: string | null }) {
    if (!msg) return null
    return <div style={{ fontSize: 13, color: 'var(--color-error)', marginTop: 10 }}>{msg}</div>
}

// Mismo aviso que ya tiene Apariencia (punto naranja + "Tenés cambios sin
// guardar") pero acá al lado del botón de cada tarjeta en vez de una barra
// flotante — cada sección de Configuración es su propia pantalla con una
// sola tarjeta, así que no hace falta una barra aparte para no perder de
// vista el estado: ya está pegada al botón que lo resuelve.
function DirtyHint({ show }: { show: boolean }) {
    if (!show) return null
    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, fontWeight: 500, color: 'var(--color-warning)', marginBottom: 10 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#F59E0B', flexShrink: 0 }} />
            Tenés cambios sin guardar
        </div>
    )
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

function GeneralView({ vista, onToast }: { vista: VistaConfig; onToast: (m: string) => void }) {
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
    // `pickupAddress` vive acá (no en `pagos`) a propósito — es dato del
    // NEGOCIO (dónde queda el local), no un método de pago. El toggle
    // "Retiro en local" (que sí es un método de pago/entrega) sigue en la
    // sección Pagos; esta dirección se usa ahí, pero se carga desde acá.
    const [negocio, setNegocio]   = useState({ name: '', industry: '', description: '', pickupAddress: '', latLng: BA })
    const [contacto, setContacto] = useState({ whatsapp: '', email: '', scheduleText: '' })
    const [pagos, setPagos]       = useState({
        acceptsMercadopago: false, acceptsCash: false, acceptsPickup: false, acceptsTransfer: false,
        pickupPaymentMethods: [] as string[],
        acceptsCoordinateLater: false,
        // Texto sanitizado a número (mismo patrón que freeShippingFrom, ver
        // envios más abajo) — vacío = sin descuento, nunca se fuerza a '0'.
        cashDiscountPercent: '',
    })
    // Sucursal de retiro (Branch, no BusinessConfig) — la principal/primera
    // activa, mismo criterio que ya usa storefront.service.ts para resolver
    // "el" punto de retiro (todavía no hay UI para elegir sucursal acá).
    const [branchId, setBranchId] = useState<string | null>(null)
    const [envios, setEnvios]     = useState({
        freeShippingFrom: '', shippingPolicy: '', enabledCarriers: [] as string[],
        // Costo de envío por transportista — todos arrancan vacíos ('' = sin
        // cargar, ese transportista no calcula envío, se sigue coordinando aparte).
        carrierShippingCosts: {} as Record<string, string>,
    })
    const [redes, setRedes]       = useState({ instagram: '', tiktok: '', facebook: '' })
    const [postventa, setPostventa] = useState({
        returnsEnabled: true, returnsCreditNoteEnabled: true, returnsMpRefundEnabled: false,
        cancellationsEnabled: true, cancellationsCreditNoteEnabled: false, cancellationsMpRefundEnabled: true,
    })
    const [isPaused, setIsPaused] = useState(false)
    // FULL = tienda online completa (carrito, checkout, mensajería, reseñas,
    // cupones). SHOWCASE = "vidriera digital": el storefront queda de solo
    // catálogo — el cliente consulta por WhatsApp, no compra desde acá.
    const [modo, setModo] = useState<'FULL' | 'SHOWCASE'>('FULL')

    const [guardando, setGuardando] = useState<string | null>(null)                // card que está guardando
    const [errores, setErrores]     = useState<Record<string, string | null>>({}) // error por card
    const [modalPausa, setModalPausa] = useState(false)
    const [modalModo, setModalModo]   = useState(false)

    // Estado real de la conexión OAuth con Mercado Pago (distinto del toggle
    // acceptsMercadopago, que solo dice "quiero mostrar este método" — hace
    // falta ADEMÁS estar conectado para que el checkout pueda cobrar).
    const [mp, setMp] = useState<{ connected: boolean; mpUserId: string | null; mpUserName: string | null; scopes: string[] } | null>(null)
    const [mpBusy, setMpBusy] = useState(false)
    const [mpError, setMpError] = useState<string | null>(null)
    const router = useRouter()

    // Vuelta del flujo de OAuth (mercadopago.controller.ts redirige acá con
    // ?mp=connected o ?mp=error) — avisa y limpia el query para que un F5 no
    // repita el toast.
    useEffect(() => {
        if (!router.isReady) return
        const mpParam = router.query.mp
        if (mpParam !== 'connected' && mpParam !== 'error') return
        onToast(mpParam === 'connected' ? 'Mercado Pago conectado' : 'No se pudo conectar Mercado Pago')
        if (mpParam === 'connected') panelGetMercadopagoStatus().then(setMp).catch(() => {})
        const { mp: _mp, ...rest } = router.query
        router.replace({ query: rest }, undefined, { shallow: true })
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [router.isReady, router.query.mp])

    useEffect(() => {
        if (authStatus === 'loading') return          // todavía no sabemos si hay sesión
        if (!esDueno) { setCargando(false); return }  // sin sesión de dueño → banner
        let cancelado = false
        async function cargar() {
            setCargando(true)
            try {
                const [biz, cfg, mpStatus, branches] = await Promise.all([
                    panelGetBusiness(), panelGetBusinessConfig(),
                    panelGetMercadopagoStatus().catch(() => null), // no bloquea el resto de la pantalla si falla
                    panelListBranches().catch(() => []), // ídem — sin sucursal, el campo de dirección queda vacío/no editable
                ])
                if (cancelado) return
                setMp(mpStatus)
                // Misma prioridad que sucursalDeVenta() del backend: la marcada
                // como default, si no la primera activa.
                const sucursal = branches.find(b => b.isDefault && b.isActive) ?? branches.find(b => b.isActive) ?? branches[0] ?? null
                setBranchId(sucursal?.id ?? null)
                const negocio0 = {
                    name: biz.name ?? '', industry: biz.industry ?? '', description: biz.description ?? '',
                    pickupAddress: sucursal?.address ?? '',
                    // Mismo default que el wizard de onboarding (Buenos Aires) cuando
                    // la sucursal todavía no tiene coordenadas cargadas.
                    latLng: (sucursal?.latitude != null && sucursal?.longitude != null
                        ? [Number(sucursal.latitude), Number(sucursal.longitude)]
                        : BA) as [number, number],
                }
                const contacto0 = { whatsapp: cfg.whatsapp ?? '', email: cfg.email ?? '', scheduleText: cfg.scheduleText ?? '' }
                const pagos0 = {
                    acceptsMercadopago: cfg.acceptsMercadopago,
                    acceptsCash: cfg.acceptsCash,
                    acceptsPickup: cfg.acceptsPickup,
                    acceptsTransfer: cfg.acceptsTransfer,
                    pickupPaymentMethods: cfg.pickupPaymentMethods ?? [],
                    acceptsCoordinateLater: cfg.acceptsCoordinateLater,
                    cashDiscountPercent: cfg.cashDiscountPercent != null ? String(cfg.cashDiscountPercent) : '',
                }
                const envios0 = {
                    // Los montos llegan del backend como texto: los muestro tal cual
                    // y los paso a número recién en el momento de guardar.
                    freeShippingFrom: cfg.freeShippingFrom != null ? String(cfg.freeShippingFrom) : '',
                    shippingPolicy: cfg.shippingPolicy ?? '',
                    enabledCarriers: cfg.enabledCarriers ?? [],
                    carrierShippingCosts: Object.fromEntries(
                        Object.entries(cfg.carrierShippingCosts ?? {}).map(([k, v]) => [k, String(v)]),
                    ),
                }
                const redes0 = { instagram: cfg.instagram ?? '', tiktok: cfg.tiktok ?? '', facebook: cfg.facebook ?? '' }
                const postventa0 = {
                    returnsEnabled: cfg.returnsEnabled, returnsCreditNoteEnabled: cfg.returnsCreditNoteEnabled, returnsMpRefundEnabled: cfg.returnsMpRefundEnabled,
                    cancellationsEnabled: cfg.cancellationsEnabled, cancellationsCreditNoteEnabled: cfg.cancellationsCreditNoteEnabled, cancellationsMpRefundEnabled: cfg.cancellationsMpRefundEnabled,
                }
                setNegocio(negocio0)
                setIsPaused(biz.isPaused)
                setModo(biz.mode === 'SHOWCASE' ? 'SHOWCASE' : 'FULL')
                setContacto(contacto0)
                setPagos(pagos0)
                setEnvios(envios0)
                setRedes(redes0)
                setPostventa(postventa0)
                setErrorCarga(null)
                // Snapshot para la detección de cambios por tarjeta.
                setOrig({
                    negocio: JSON.stringify(negocio0),
                    contacto: JSON.stringify(contacto0),
                    pagos: JSON.stringify(pagos0),
                    envios: JSON.stringify(envios0),
                    redes: JSON.stringify(redes0),
                    postventa: JSON.stringify(postventa0),
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
        async () => {
            await updateBusiness({ name: negocio.name, industry: negocio.industry, description: negocio.description })
            // La dirección vive en la sucursal (Branch), no en el negocio en
            // sí — se guarda en un segundo request. Ver el comentario en el
            // useState de `negocio` sobre por qué el campo vive acá.
            if (branchId) {
                await panelUpdateBranch(branchId, {
                    address: negocio.pickupAddress.trim(),
                    latitude: negocio.latLng[0],
                    longitude: negocio.latLng[1],
                })
            }
        },
        'Información del negocio guardada', negocio)

    // ── Mapa de "Dirección del local" — mismo mecanismo que StepUbicacion en
    // el wizard de onboarding (SetupUnificado.tsx): buscar por texto, GPS, o
    // arrastrar el pin. Nominatim (OpenStreetMap) para geocodificar en los
    // dos sentidos — gratis, sin API key, mismo que ya usa el wizard.
    const [buscandoDireccion, setBuscandoDireccion] = useState(false)
    const [localizando, setLocalizando] = useState(false)

    async function buscarDireccion() {
        const q = negocio.pickupAddress.trim()
        if (!q) return
        setBuscandoDireccion(true)
        try {
            const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&countrycodes=ar&limit=1`)
            const data = await res.json()
            const hit = data[0]
            if (hit) setNegocio(p => ({ ...p, latLng: [+hit.lat, +hit.lon], pickupAddress: hit.display_name }))
        } catch { /* sin resultados o sin red: el campo de texto queda como el dueño lo dejó */ }
        finally { setBuscandoDireccion(false) }
    }

    function usarUbicacionActual() {
        if (!navigator.geolocation) return
        setLocalizando(true)
        navigator.geolocation.getCurrentPosition(
            pos => {
                const latLng: [number, number] = [pos.coords.latitude, pos.coords.longitude]
                setNegocio(p => ({ ...p, latLng }))
                fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latLng[0]}&lon=${latLng[1]}`)
                    .then(r => r.json())
                    .then(d => { if (d.display_name) setNegocio(p => ({ ...p, pickupAddress: d.display_name })) })
                    .catch(() => {})
                    .finally(() => setLocalizando(false))
            },
            () => setLocalizando(false),
            { timeout: 8000 },
        )
    }

    function arrastrarPin(latLng: [number, number]) {
        setNegocio(p => ({ ...p, latLng }))
        fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latLng[0]}&lon=${latLng[1]}`)
            .then(r => r.json())
            .then(d => { if (d.display_name) setNegocio(p => ({ ...p, pickupAddress: d.display_name })) })
            .catch(() => {})
    }

    const guardarContacto = () => guardar('contacto',
        () => panelUpdateBusinessConfig({
            whatsapp: contacto.whatsapp,
            scheduleText: contacto.scheduleText,
            // Si el email está vacío directamente no lo mando: el backend no acepta un email en blanco.
            ...(contacto.email.trim() ? { email: contacto.email.trim() } : {}),
        }),
        'Datos de contacto guardados', contacto)

    const guardarPagos = () => {
        const descuento = Number(pagos.cashDiscountPercent)
        if (pagos.cashDiscountPercent.trim() !== '' && (Number.isNaN(descuento) || descuento < 0 || descuento > 100)) {
            setErrores(prev => ({ ...prev, pagos: 'El descuento por efectivo tiene que ser un número entre 0 y 100' })); return
        }
        guardar('pagos',
            () => panelUpdateBusinessConfig({
                acceptsMercadopago: pagos.acceptsMercadopago,
                acceptsCash: pagos.acceptsCash,
                acceptsPickup: pagos.acceptsPickup,
                acceptsTransfer: pagos.acceptsTransfer,
                pickupPaymentMethods: pagos.pickupPaymentMethods,
                acceptsCoordinateLater: pagos.acceptsCoordinateLater,
                ...(pagos.cashDiscountPercent.trim() !== '' ? { cashDiscountPercent: descuento } : {}),
            }),
            'Métodos de pago guardados', pagos)
    }

    const guardarEnvios = () => {
        const gratis = Number(envios.freeShippingFrom)
        if (envios.freeShippingFrom.trim() !== '' && Number.isNaN(gratis)) {
            setErrores(prev => ({ ...prev, envios: 'El monto de envío gratis debe ser un número' })); return
        }
        // Costos por transportista: solo se mandan los que tienen algo escrito
        // (vacío = "no cargué nada para este, no calcula envío").
        const carrierShippingCosts: Record<string, number> = {}
        for (const [carrier, valor] of Object.entries(envios.carrierShippingCosts)) {
            if (!valor.trim()) continue
            const n = Number(valor)
            if (Number.isNaN(n) || n < 0) {
                setErrores(prev => ({ ...prev, envios: `El costo de ${CARRIER_META.find(c => c.key === carrier)?.label ?? carrier} tiene que ser un número mayor o igual a 0` })); return
            }
            carrierShippingCosts[carrier] = n
        }
        guardar('envios', () => panelUpdateBusinessConfig({
            ...(envios.freeShippingFrom.trim() !== '' ? { freeShippingFrom: gratis } : {}),
            shippingPolicy: envios.shippingPolicy,
            enabledCarriers: envios.enabledCarriers,
            carrierShippingCosts,
        }), 'Configuración de envíos guardada', envios)
    }

    const guardarRedes = () => guardar('redes',
        () => panelUpdateBusinessConfig({ instagram: redes.instagram, tiktok: redes.tiktok, facebook: redes.facebook }),
        'Redes sociales guardadas', redes)

    const guardarPostventa = () => {
        // Mismo criterio que valida el backend (businesses.service.ts
        // updateConfig): si está habilitada, tiene que haber al menos un
        // método de reembolso activo — se corta acá antes para no depender
        // solo del 400 del backend.
        if (postventa.returnsEnabled && !postventa.returnsCreditNoteEnabled && !postventa.returnsMpRefundEnabled) {
            setErrores(prev => ({ ...prev, postventa: 'Si las devoluciones están habilitadas, activá al menos un método de reembolso' })); return
        }
        if (postventa.cancellationsEnabled && !postventa.cancellationsCreditNoteEnabled && !postventa.cancellationsMpRefundEnabled) {
            setErrores(prev => ({ ...prev, postventa: 'Si las cancelaciones están habilitadas, activá al menos un método de reembolso' })); return
        }
        guardar('postventa', () => panelUpdateBusinessConfig(postventa), 'Configuración de postventa guardada', postventa)
    }

    async function conectarMp() {
        setMpBusy(true)
        setMpError(null)
        try {
            const { authUrl } = await panelGetMercadopagoConnectUrl()
            // Navegación de página completa a propósito: el consent real pasa en
            // auth.mercadopago.com, no se puede hacer por fetch.
            window.location.href = authUrl
        } catch (e) {
            setMpError(e instanceof ApiError ? e.message : 'No se pudo iniciar la conexión con Mercado Pago')
            setMpBusy(false)
        }
    }

    async function desconectarMp() {
        setMpBusy(true)
        setMpError(null)
        try {
            await panelDisconnectMercadopago()
            setMp({ connected: false, mpUserId: null, mpUserName: null, scopes: [] })
            onToast('Mercado Pago desconectado')
        } catch (e) {
            setMpError(e instanceof ApiError ? e.message : 'No se pudo desconectar')
        } finally {
            setMpBusy(false)
        }
    }

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

    async function confirmarModo() {
        setModalModo(false)
        const nuevo = modo === 'FULL' ? 'SHOWCASE' : 'FULL'
        setGuardando('modo')
        setErrores(prev => ({ ...prev, modo: null }))
        try {
            const r = await changeBusinessMode(nuevo)
            setModo(r.mode === 'SHOWCASE' ? 'SHOWCASE' : 'FULL')
            onToast(r.mode === 'SHOWCASE' ? 'Tu tienda ahora es una vidriera digital' : 'Tu tienda ahora es una tienda online completa')
        } catch (e) {
            const msg = e instanceof ApiError ? e.message : 'Error inesperado'
            setErrores(prev => ({ ...prev, modo: msg }))
        } finally {
            setGuardando(null)
        }
    }

    // ── Pantallas especiales: sin sesión, cargando, o error al traer los datos ──

    if ((authStatus !== 'loading' && !esDueno) || sinSesion) {
        return (
            <div style={pageWrap}>
                <h1 style={h1Style}>Configuración general</h1>
                <Card>
                    <SectionTitle>No hay sesión activa</SectionTitle>
                    <div style={{ fontSize: 14, color: 'var(--color-body)', lineHeight: 1.6, marginBottom: 14 }}>
                        Esta pantalla usa datos reales de tu negocio y necesita que entres con tu
                        cuenta de propietario (o de tu equipo).
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
        return <GeneralViewSkeleton />
    }

    if (errorCarga) {
        return (
            <div style={pageWrap}>
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
            <h1 style={h1Style}>{TITULOS_SECCION[vista] ?? 'Negocio'}</h1>

            {/* Ya no es un grid de varias tarjetas — cada sección de
                Configuración es su propia raíz en el menú guía (ver
                ConfigSidebar.tsx) y ocupa la pantalla entera, una tarjeta
                enfocada a la vez. */}
            <div style={{ maxWidth: 640 }}>

                {(vista === 'negocio' || vista === 'general') && (
                    <Card style={{ display: 'flex', flexDirection: 'column' }}>
                        <SectionTitle>Información del negocio</SectionTitle>
                        <CfgField label="Nombre del negocio" value={negocio.name} onChange={v => setNegocio(p => ({ ...p, name: v }))} />
                        <CfgField label="Rubro" value={negocio.industry} onChange={v => setNegocio(p => ({ ...p, industry: v }))} />
                        <CfgField label="Descripción corta" value={negocio.description} area onChange={v => setNegocio(p => ({ ...p, description: v }))} />
                        {/* Mismo widget que "¿Dónde operás?" del wizard de onboarding
                            (SetupUnificado.tsx): buscar por texto, GPS, o arrastrar el
                            pin — las tres formas escriben el mismo par lat/lng. */}
                        <div style={{ marginBottom: 6 }}>
                            <label style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-body)', marginBottom: 6, display: 'block' }}>Dirección del local</label>
                            <div style={{ border: '1px solid var(--color-border)', borderRadius: 10, overflow: 'hidden' }}>
                                <div style={{ display: 'flex', alignItems: 'center', borderBottom: '1px solid var(--color-border)', background: 'var(--color-bg)', padding: '4px 4px 4px 12px', gap: 8 }}>
                                    <MapPin size={15} strokeWidth={2} color="var(--color-muted)" style={{ flexShrink: 0 }} />
                                    <input
                                        value={negocio.pickupAddress}
                                        onChange={e => setNegocio(p => ({ ...p, pickupAddress: e.target.value }))}
                                        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); buscarDireccion() } }}
                                        placeholder="Ej: Av. Corrientes 1234, CABA"
                                        style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', padding: '8px 0', fontSize: 13, color: 'var(--color-text)', fontFamily: 'inherit' }}
                                    />
                                    <Button size="sm" variant="secondary" loading={buscandoDireccion} onClick={buscarDireccion}>Buscar</Button>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', borderBottom: '1px solid var(--color-border)', background: 'var(--color-surface)', padding: '8px 12px' }}>
                                    <button
                                        type="button"
                                        onClick={usarUbicacionActual}
                                        disabled={localizando}
                                        style={{
                                            display: 'flex', alignItems: 'center', gap: 7,
                                            padding: '6px 14px', borderRadius: 20,
                                            border: `1.5px solid ${localizando ? 'var(--color-border)' : 'rgba(59,130,246,0.3)'}`,
                                            background: localizando ? 'transparent' : 'rgba(59,130,246,0.05)',
                                            color: localizando ? 'var(--color-muted)' : 'var(--color-primary)',
                                            fontSize: 12, fontWeight: 600, cursor: localizando ? 'default' : 'pointer',
                                        }}
                                    >
                                        <LocateFixed size={13} strokeWidth={2.2} />
                                        {localizando ? 'Obteniendo tu ubicación…' : 'Usar mi ubicación actual'}
                                    </button>
                                    <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--color-subtle)' }}>o arrastrá el pin</span>
                                </div>
                                <MapPicker center={negocio.latLng} onDragEnd={arrastrarPin} />
                            </div>
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--color-muted)', marginBottom: 4 }}>
                            Se muestra a tus clientes cuando activás &quot;Retiro en local&quot; en Pagos.
                        </div>
                        {pagos.acceptsPickup && !negocio.pickupAddress.trim() && (
                            <div style={{ fontSize: 12, color: 'var(--color-warning)' }}>
                                Tenés Retiro en local activado pero sin dirección cargada — el storefront le avisa al cliente que se la vas a pasar por WhatsApp.
                            </div>
                        )}
                        <div style={{ marginTop: 'auto', paddingTop: 14 }}>
                            <DirtyHint show={cambiado('negocio', negocio)} />
                            <Button variant="primary" loading={guardando === 'negocio'} disabled={!cambiado('negocio', negocio)} onClick={guardarNegocio}>Guardar cambios</Button>
                            <ErrorInline msg={errores.negocio} />
                        </div>
                    </Card>
                )}

                {vista === 'contacto' && (
                    <Card style={{ display: 'flex', flexDirection: 'column' }}>
                        <SectionTitle>Datos de contacto</SectionTitle>
                        <CfgField label="WhatsApp de atención" value={contacto.whatsapp} onChange={v => setContacto(p => ({ ...p, whatsapp: v }))} />
                        <CfgField label="Email de contacto" value={contacto.email} onChange={v => setContacto(p => ({ ...p, email: v }))} />
                        <CfgField label="Horario de atención" value={contacto.scheduleText} onChange={v => setContacto(p => ({ ...p, scheduleText: v }))} />
                        <div style={{ marginTop: 'auto', paddingTop: 14 }}>
                            <DirtyHint show={cambiado('contacto', contacto)} />
                            <Button variant="primary" loading={guardando === 'contacto'} disabled={!cambiado('contacto', contacto)} onClick={guardarContacto}>Guardar cambios</Button>
                            <ErrorInline msg={errores.contacto} />
                        </div>
                    </Card>
                )}

                {vista === 'pagos' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                    <Card style={{ display: 'flex', flexDirection: 'column' }}>
                        <SectionTitle>Métodos de pago</SectionTitle>

                        {pagos.acceptsCoordinateLater && (
                            <div style={{ marginBottom: 16, padding: '10px 14px', borderRadius: 10, background: 'var(--color-warning-bg)', border: '1px solid rgba(245,158,11,0.25)', fontSize: 12.5, color: 'var(--color-body)' }}>
                                Tenés activado &quot;Coordinar el pago después&quot; más abajo — mientras esté prendido, estos métodos no se usan en el checkout: el cliente no elige ninguno.
                            </div>
                        )}

                        {/* Segmentado por forma de entrega — antes era una sola lista
                            plana donde no quedaba claro que Efectivo solo aplica al
                            retirar en el local (el checkout ya lo filtra así, esto lo
                            hace explícito acá también). */}
                        <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--color-subtle)', marginBottom: 4 }}>
                            Con envío a domicilio
                        </div>
                        {PAGOS_META.map(({ key, label, desc }, i) => (
                            <div key={key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, padding: '12px 0', borderBottom: i < PAGOS_META.length - 1 ? '1px solid var(--color-border)' : 'none' }}>
                                <div>
                                    <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--color-body)' }}>{label}</div>
                                    <div style={{ fontSize: 12, color: 'var(--color-muted)', marginTop: 2 }}>{desc}</div>
                                </div>
                                <Toggle on={pagos[key]} onChange={v => setPagos(p => ({ ...p, [key]: v }))} />
                            </div>
                        ))}
                        {pagos.acceptsMercadopago && (
                            <div style={{
                                marginTop: 14, padding: '14px 16px', borderRadius: 12,
                                border: `1px solid ${mp?.connected ? 'rgba(0,177,234,0.35)' : 'var(--color-border)'}`,
                                background: mp?.connected ? 'rgba(0,177,234,0.06)' : 'var(--color-surface-alt)',
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                                        <MercadopagoBadge />
                                        <div style={{ minWidth: 0 }}>
                                            <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--color-text)' }}>Mercado Pago</div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3 }}>
                                                <span style={{
                                                    width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
                                                    background: mp?.connected ? 'var(--color-success)' : 'var(--color-muted)',
                                                }} />
                                                <span style={{ fontSize: 12, color: 'var(--color-muted)' }}>
                                                    {mp?.connected
                                                        ? `Conectado a: ${mp.mpUserName ?? (mp.mpUserId ? `usuario ${mp.mpUserId}` : 'tu cuenta')}`
                                                        : 'Sin conectar — activá esto para poder cobrar online'}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                    {mp?.connected ? (
                                        <Button variant="outline" size="sm" loading={mpBusy} onClick={desconectarMp}>Desconectar</Button>
                                    ) : (
                                        <Button
                                            size="sm" loading={mpBusy} onClick={conectarMp}
                                            style={{ background: '#009EE3', color: '#fff' }}
                                        >
                                            Conectar cuenta
                                        </Button>
                                    )}
                                </div>
                                <ErrorInline msg={mpError} />
                                {/* MP no tiene una tasa fija que mostrar acá — varía según
                                    medio de pago (débito/crédito/cuotas) y puede cambiar. La
                                    comisión REAL de cada cobro se ve en Pedidos → detalle, y
                                    el total del período en el Dashboard. */}
                                {mp?.connected && (
                                    <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid rgba(0,177,234,0.2)', fontSize: 12, color: 'var(--color-muted)', lineHeight: 1.5 }}>
                                        Mercado Pago te cobra una comisión por cada cobro — varía según el medio de pago y las cuotas, no es un % fijo. La vas a ver reflejada en el detalle de cada pedido y sumada por período en el Dashboard.{' '}
                                        <a href="https://www.mercadopago.com.ar/ayuda/comision-recibir-pagos_220" target="_blank" rel="noopener noreferrer" style={{ color: '#009EE3', fontWeight: 600 }}>
                                            Ver tasas oficiales de MP →
                                        </a>
                                    </div>
                                )}
                            </div>
                        )}
                        {pagos.acceptsTransfer && (
                            <div style={{ marginTop: 14, padding: 14, borderRadius: 10, background: 'var(--color-surface-alt)', border: '1px solid var(--color-border)', fontSize: 12.5, color: 'var(--color-body)', lineHeight: 1.5 }}>
                                No se le pide CBU ni alias al cliente — confirma el pedido y vos lo contactás por WhatsApp para coordinar cómo paga.
                            </div>
                        )}

                        <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--color-subtle)', marginTop: 22, marginBottom: 4 }}>
                            Con retiro en local
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, padding: '12px 0', borderBottom: pagos.acceptsPickup ? '1px solid var(--color-border)' : 'none' }}>
                            <div>
                                <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--color-body)' }}>Retiro en local</div>
                                <div style={{ fontSize: 12, color: 'var(--color-muted)', marginTop: 2 }}>El cliente retira y paga en el local</div>
                            </div>
                            <Toggle on={pagos.acceptsPickup} onChange={v => setPagos(p => ({ ...p, acceptsPickup: v }))} />
                        </div>
                        {pagos.acceptsPickup && (
                            <>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, padding: '12px 0', borderBottom: '1px solid var(--color-border)' }}>
                                    <div>
                                        <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--color-body)' }}>Efectivo</div>
                                        <div style={{ fontSize: 12, color: 'var(--color-muted)', marginTop: 2 }}>Pago presencial al retirar — no aplica a envío a domicilio</div>
                                    </div>
                                    <Toggle on={pagos.acceptsCash} onChange={v => setPagos(p => ({ ...p, acceptsCash: v }))} />
                                </div>
                                {pagos.acceptsCash && (
                                    <div style={{ padding: '12px 0', borderBottom: '1px solid var(--color-border)' }}>
                                        <CfgField
                                            label="Descuento por pagar en efectivo (%)"
                                            placeholder="Ej: 10"
                                            value={pagos.cashDiscountPercent}
                                            onChange={v => setPagos(p => ({ ...p, cashDiscountPercent: v.replace(/[^0-9.]/g, '') }))}
                                        />
                                        <div style={{ fontSize: 11.5, color: 'var(--color-muted)', marginTop: 4 }}>
                                            Se aplica solo en el checkout, cuando el cliente elige pagar en efectivo. Dejalo vacío para no aplicar descuento.
                                        </div>
                                    </div>
                                )}
                                <div style={{ marginTop: 14 }}>
                                    <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text)', marginBottom: 4 }}>
                                        Medios que aceptás al retirar
                                    </div>
                                    <div style={{ fontSize: 11.5, color: 'var(--color-muted)', marginBottom: 8 }}>
                                        {pagos.pickupPaymentMethods.length === 0
                                            ? 'Sin nada marcado, se aceptan todos los que tenés habilitados arriba (Mercado Pago, Efectivo) más Débito/Crédito con posnet. Marcá acá solo si querés restringir el retiro a medios puntuales. Coordinar por WhatsApp no se restringe acá — sigue siempre el toggle de arriba.'
                                            : 'El retiro queda limitado a lo marcado acá — el resto (aunque esté habilitado arriba) no se ofrece al retirar. Coordinar por WhatsApp es la excepción: sigue siempre el toggle de arriba.'}
                                    </div>
                                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                        {PICKUP_PAGO_META.filter(m => m.key !== 'MERCADOPAGO' || pagos.acceptsMercadopago).map(m => {
                                            const activo = pagos.pickupPaymentMethods.includes(m.key)
                                            return (
                                                <button
                                                    key={m.key}
                                                    type="button"
                                                    onClick={() => setPagos(p => ({
                                                        ...p,
                                                        pickupPaymentMethods: activo
                                                            ? p.pickupPaymentMethods.filter(x => x !== m.key)
                                                            : [...p.pickupPaymentMethods, m.key],
                                                    }))}
                                                    style={{
                                                        height: 32, padding: '0 14px', borderRadius: 999,
                                                        fontSize: 12.5, fontWeight: 600, cursor: 'pointer',
                                                        background: activo ? 'var(--color-primary)' : 'var(--color-bg)',
                                                        color: activo ? '#fff' : 'var(--color-text)',
                                                        border: `1px solid ${activo ? 'var(--color-primary)' : 'var(--color-border)'}`,
                                                        transition: 'all 150ms',
                                                    }}
                                                >
                                                    {m.label}
                                                </button>
                                            )
                                        })}
                                    </div>
                                </div>
                            </>
                        )}
                    </Card>

                    <Card style={{ display: 'flex', flexDirection: 'column' }}>
                        <SectionTitle>Coordinar el pago después</SectionTitle>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, padding: '12px 0' }}>
                            <div>
                                <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--color-body)' }}>Permitir pagar más tarde</div>
                                <div style={{ fontSize: 12, color: 'var(--color-muted)', marginTop: 2, maxWidth: 460 }}>
                                    Si lo activás, reemplaza a los métodos de pago de arriba: tus clientes NO
                                    ven Mercado Pago, Efectivo ni nada — solo cargan sus datos y confirman el
                                    pedido. Vos te encargás de coordinar el pago directamente con ellos después
                                    (por WhatsApp, por ejemplo).
                                </div>
                            </div>
                            <Toggle on={pagos.acceptsCoordinateLater} onChange={v => setPagos(p => ({ ...p, acceptsCoordinateLater: v }))} />
                        </div>
                        <div style={{ marginTop: 'auto', paddingTop: 14 }}>
                            <DirtyHint show={cambiado('pagos', pagos)} />
                            <Button variant="primary" loading={guardando === 'pagos'} disabled={!cambiado('pagos', pagos)} onClick={guardarPagos}>Guardar cambios</Button>
                            <ErrorInline msg={errores.pagos} />
                        </div>
                    </Card>
                    </div>
                )}

                {vista === 'envios' && (
                    <Card style={{ display: 'flex', flexDirection: 'column' }}>
                        <SectionTitle>Envíos</SectionTitle>
                        {/* Solo deja escribir números (nada de letras) */}
                        <CfgField label="Envío gratis desde ($)" placeholder="Ej: 20000" value={envios.freeShippingFrom} onChange={v => setEnvios(p => ({ ...p, freeShippingFrom: v.replace(/[^0-9.,]/g, '') }))} />
                        {/* Se muestra debajo del resumen del pedido en el checkout, si hay algo escrito. */}
                        <CfgField label="Texto de política de envíos" value={envios.shippingPolicy} area onChange={v => setEnvios(p => ({ ...p, shippingPolicy: v }))} />
                        <div style={{ marginTop: 14 }}>
                            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text)', marginBottom: 8 }}>
                                Transportistas que ofrecés
                            </div>
                            <div style={{ fontSize: 12, color: 'var(--color-muted)', marginBottom: 10 }}>
                                Ninguno marcado = se muestran todos en el checkout.
                            </div>
                            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                {CARRIER_META.map(c => {
                                    const activo = envios.enabledCarriers.includes(c.key)
                                    return (
                                        <button
                                            key={c.key}
                                            type="button"
                                            onClick={() => setEnvios(p => ({
                                                ...p,
                                                enabledCarriers: activo
                                                    ? p.enabledCarriers.filter(x => x !== c.key)
                                                    : [...p.enabledCarriers, c.key],
                                            }))}
                                            style={{
                                                height: 32, padding: '0 14px', borderRadius: 999,
                                                fontSize: 12.5, fontWeight: 600, cursor: 'pointer',
                                                background: activo ? 'var(--color-primary)' : 'var(--color-bg)',
                                                color: activo ? '#fff' : 'var(--color-text)',
                                                border: `1px solid ${activo ? 'var(--color-primary)' : 'var(--color-border)'}`,
                                                transition: 'all 150ms',
                                            }}
                                        >
                                            {c.label}
                                        </button>
                                    )
                                })}
                            </div>
                        </div>
                        <div style={{ marginTop: 18 }}>
                            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text)', marginBottom: 8 }}>
                                Costo de envío por transportista
                            </div>
                            <div style={{ fontSize: 12, color: 'var(--color-muted)', marginBottom: 10 }}>
                                Vacío = ese transportista no calcula envío (se sigue coordinando aparte por WhatsApp).
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                {CARRIER_META.map(c => (
                                    <div key={c.key} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                        <div style={{ fontSize: 13, color: 'var(--color-body)', width: 190, flexShrink: 0 }}>{c.label}</div>
                                        <input
                                            type="text"
                                            inputMode="decimal"
                                            placeholder="Ej: 2000"
                                            value={envios.carrierShippingCosts[c.key] ?? ''}
                                            onChange={e => {
                                                const v = e.target.value.replace(/[^0-9.,]/g, '')
                                                setEnvios(p => ({ ...p, carrierShippingCosts: { ...p.carrierShippingCosts, [c.key]: v } }))
                                            }}
                                            style={{
                                                flex: 1, height: 38, padding: '0 12px', borderRadius: 8,
                                                background: 'var(--color-bg)', border: '1px solid var(--color-border)',
                                                color: 'var(--color-text)', fontSize: 13, outline: 'none', boxSizing: 'border-box',
                                            }}
                                        />
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div style={{ marginTop: 'auto', paddingTop: 14 }}>
                            <DirtyHint show={cambiado('envios', envios)} />
                            <Button variant="primary" loading={guardando === 'envios'} disabled={!cambiado('envios', envios)} onClick={guardarEnvios}>Guardar cambios</Button>
                            <ErrorInline msg={errores.envios} />
                        </div>
                    </Card>
                )}

                {vista === 'redes' && (
                    <Card style={{ display: 'flex', flexDirection: 'column' }}>
                        <SectionTitle>Redes sociales</SectionTitle>
                        <div style={{ fontSize: 12, color: 'var(--color-muted)', marginTop: -6, marginBottom: 14 }}>
                            Solo tu usuario (sin @) — también podés pegar el link completo si preferís, las dos formas andan.
                        </div>
                        <CfgField label="Instagram" placeholder="mi_negocio" value={redes.instagram} onChange={v => setRedes(p => ({ ...p, instagram: v }))} />
                        <CfgField label="TikTok" placeholder="mi_negocio" value={redes.tiktok} onChange={v => setRedes(p => ({ ...p, tiktok: v }))} />
                        <CfgField label="Facebook" placeholder="mi.negocio" value={redes.facebook} onChange={v => setRedes(p => ({ ...p, facebook: v }))} />
                        <div style={{ marginTop: 'auto', paddingTop: 14 }}>
                            <DirtyHint show={cambiado('redes', redes)} />
                            <Button variant="primary" loading={guardando === 'redes'} disabled={!cambiado('redes', redes)} onClick={guardarRedes}>Guardar cambios</Button>
                            <ErrorInline msg={errores.redes} />
                        </div>
                    </Card>
                )}

                {vista === 'postventa' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                    <Card style={{ display: 'flex', flexDirection: 'column' }}>
                        <SectionTitle>Devoluciones</SectionTitle>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, padding: '12px 0', borderBottom: '1px solid var(--color-border)' }}>
                            <div>
                                <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--color-body)' }}>Habilitar devoluciones</div>
                                <div style={{ fontSize: 12, color: 'var(--color-muted)', marginTop: 2 }}>Si lo apagás, tus clientes no van a poder pedir devoluciones.</div>
                            </div>
                            <Toggle on={postventa.returnsEnabled} onChange={v => setPostventa(p => ({ ...p, returnsEnabled: v }))} />
                        </div>
                        {postventa.returnsEnabled && (
                            <>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, padding: '12px 0', borderBottom: '1px solid var(--color-border)' }}>
                                    <div>
                                        <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--color-body)' }}>Permitir nota de crédito</div>
                                        <div style={{ fontSize: 12, color: 'var(--color-muted)', marginTop: 2 }}>El cliente recibe saldo a favor para su próxima compra.</div>
                                    </div>
                                    <Toggle on={postventa.returnsCreditNoteEnabled} onChange={v => setPostventa(p => {
                                        // Sin ningún método de reembolso activo, "Habilitar
                                        // devoluciones" no tiene sentido prendido — se apaga solo
                                        // en vez de dejar guardar un estado inválido (antes solo
                                        // se avisaba con un error al tocar "Guardar cambios").
                                        const next = { ...p, returnsCreditNoteEnabled: v }
                                        if (!v && !next.returnsMpRefundEnabled) next.returnsEnabled = false
                                        return next
                                    })} />
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, padding: '12px 0' }}>
                                    <div>
                                        <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--color-body)' }}>Permitir reembolso a Mercado Pago</div>
                                        <div style={{ fontSize: 12, color: 'var(--color-muted)', marginTop: 2 }}>Solo disponible si el pedido se pagó por esa vía.</div>
                                    </div>
                                    <Toggle on={postventa.returnsMpRefundEnabled} onChange={v => setPostventa(p => {
                                        const next = { ...p, returnsMpRefundEnabled: v }
                                        if (!v && !next.returnsCreditNoteEnabled) next.returnsEnabled = false
                                        return next
                                    })} />
                                </div>
                                {postventa.returnsCreditNoteEnabled && postventa.returnsMpRefundEnabled && (
                                    <div style={{ fontSize: 12, color: 'var(--color-muted)', marginTop: -4, marginBottom: 4 }}>
                                        Con los dos activos, el cliente elige cuál prefiere al pedir la devolución.
                                    </div>
                                )}
                            </>
                        )}
                    </Card>

                    <Card style={{ display: 'flex', flexDirection: 'column' }}>
                        <SectionTitle>Cancelaciones</SectionTitle>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, padding: '12px 0', borderBottom: '1px solid var(--color-border)' }}>
                            <div>
                                <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--color-body)' }}>Habilitar cancelaciones</div>
                                <div style={{ fontSize: 12, color: 'var(--color-muted)', marginTop: 2 }}>
                                    Aplica a pedidos ya confirmados — un pedido recién hecho siempre se puede cancelar solo.
                                </div>
                            </div>
                            <Toggle on={postventa.cancellationsEnabled} onChange={v => setPostventa(p => ({ ...p, cancellationsEnabled: v }))} />
                        </div>
                        {postventa.cancellationsEnabled && (
                            <>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, padding: '12px 0', borderBottom: '1px solid var(--color-border)' }}>
                                    <div>
                                        <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--color-body)' }}>Permitir nota de crédito</div>
                                        <div style={{ fontSize: 12, color: 'var(--color-muted)', marginTop: 2 }}>El cliente recibe saldo a favor para su próxima compra.</div>
                                    </div>
                                    <Toggle on={postventa.cancellationsCreditNoteEnabled} onChange={v => setPostventa(p => {
                                        // Mismo criterio que devoluciones: sin ningún método de
                                        // reembolso activo, "Habilitar cancelaciones" se apaga solo.
                                        const next = { ...p, cancellationsCreditNoteEnabled: v }
                                        if (!v && !next.cancellationsMpRefundEnabled) next.cancellationsEnabled = false
                                        return next
                                    })} />
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, padding: '12px 0' }}>
                                    <div>
                                        <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--color-body)' }}>Permitir reembolso a Mercado Pago</div>
                                        <div style={{ fontSize: 12, color: 'var(--color-muted)', marginTop: 2 }}>Solo disponible si el pedido se pagó por esa vía.</div>
                                    </div>
                                    <Toggle on={postventa.cancellationsMpRefundEnabled} onChange={v => setPostventa(p => {
                                        const next = { ...p, cancellationsMpRefundEnabled: v }
                                        if (!v && !next.cancellationsCreditNoteEnabled) next.cancellationsEnabled = false
                                        return next
                                    })} />
                                </div>
                                {postventa.cancellationsCreditNoteEnabled && postventa.cancellationsMpRefundEnabled && (
                                    <div style={{ fontSize: 12, color: 'var(--color-muted)', marginTop: -4, marginBottom: 4 }}>
                                        Con los dos activos, el cliente elige cuál prefiere al pedir la cancelación.
                                    </div>
                                )}
                            </>
                        )}
                        <div style={{ marginTop: 'auto', paddingTop: 14 }}>
                            <DirtyHint show={cambiado('postventa', postventa)} />
                            <Button variant="primary" loading={guardando === 'postventa'} disabled={!cambiado('postventa', postventa)} onClick={guardarPostventa}>Guardar cambios</Button>
                            <ErrorInline msg={errores.postventa} />
                        </div>
                    </Card>
                    </div>
                )}

                {vista === 'peligro' && (
                    <>
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

                                {/* Modo de la tienda: completa o vidriera digital */}
                                <div style={cajaPeligro}>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                                        <div style={{ minWidth: 180, flex: 1 }}>
                                            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-body)' }}>
                                                {modo === 'SHOWCASE' ? 'Pasar a tienda online completa' : 'Pasar a vidriera digital'}
                                            </div>
                                            <div style={{ fontSize: 12, color: 'var(--color-muted)', marginTop: 2 }}>
                                                {modo === 'SHOWCASE'
                                                    ? 'Ahora mismo tu storefront es solo catálogo — reactivá el carrito y el pago online.'
                                                    : 'Tu storefront pasa a ser solo catálogo: tus clientes consultan por WhatsApp, no compran desde acá.'}
                                            </div>
                                        </div>
                                        <Button variant="outline" loading={guardando === 'modo'} onClick={() => setModalModo(true)}>
                                            {modo === 'SHOWCASE' ? 'Activar tienda completa' : 'Activar vidriera digital'}
                                        </Button>
                                    </div>
                                    <DetalleExpandible pregunta="¿Qué cambia con la vidriera digital?">
                                        <li>Se saca el carrito, el pago online y el seguimiento de pedidos — tus clientes solo navegan el catálogo.</li>
                                        <li>Cada producto suma un botón &quot;Consultar por WhatsApp&quot; con el mensaje ya armado (producto, variante y precio).</li>
                                        <li>Se apaga la mensajería del storefront, las reseñas de producto y los cupones/descuentos online.</li>
                                        <li>No podés pasar a vidriera si tenés pedidos online sin resolver — primero hay que entregarlos o cancelarlos.</li>
                                        <li>Tus productos, precios y todo lo demás se conservan — es solo cómo compra el cliente.</li>
                                    </DetalleExpandible>
                                    <ErrorInline msg={errores.modo} />
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

                        <Modal
                            isOpen={modalModo}
                            onClose={() => setModalModo(false)}
                            title={modo === 'SHOWCASE' ? '¿Pasar a tienda online completa?' : '¿Pasar a vidriera digital?'}
                            variant={modo === 'SHOWCASE' ? 'default' : 'danger'}
                            footer={
                                <>
                                    <Button variant="secondary" onClick={() => setModalModo(false)}>Cancelar</Button>
                                    <Button variant={modo === 'SHOWCASE' ? 'primary' : 'danger'} onClick={() => void confirmarModo()}>
                                        {modo === 'SHOWCASE' ? 'Sí, activar tienda completa' : 'Sí, pasar a vidriera'}
                                    </Button>
                                </>
                            }
                        >
                            <div style={{ fontSize: 14, color: 'var(--color-body)', lineHeight: 1.6 }}>
                                {modo === 'SHOWCASE'
                                    ? 'Volvés a vender online: carrito, pago, seguimiento de pedidos, mensajería y reseñas se reactivan.'
                                    : 'El carrito, el pago online, el seguimiento de pedidos, la mensajería y las reseñas dejan de estar disponibles. Cada producto va a mostrar un botón para consultar por WhatsApp en su lugar. Si tenés pedidos online sin resolver, no vas a poder confirmar el cambio hasta entregarlos o cancelarlos.'}
                            </div>
                        </Modal>
                    </>
                )}

            </div>
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
        // 'negocio' es el default (primera raíz del menú guía) — sin ?vista=
        // en la URL cae ahí, mismo criterio que 'general' antes.
        if (v !== 'negocio' && v !== 'general') q.vista = v
        router.push({ query: q })
    }

    const sub = (vista as VistaConfig | undefined) ?? 'negocio'
    let content
    if (sub === 'apariencia')          content = <Apariencia ir={ir} onToast={setToast} />
    else if (sub === 'equipo')         content = <Equipo ir={ir} onToast={setToast} />
    else if (sub === 'notificaciones') content = <Notificaciones ir={ir} />
    else                               content = <GeneralView vista={sub} onToast={setToast} />

    return (
        <>
            {/* Mobile: el sidebar pasa a ser una franja horizontal arriba
                (ConfigSidebar.tsx ya se encarga de su propio layout) — acá
                solo hace falta apilar en vez de poner uno al lado del otro,
                y sacar el padding-left fijo que era "aire" para la card
                flotante de escritorio. */}
            <style>{`
                @media (max-width: 768px) {
                    .cfg-hub-layout { flex-direction: column !important; padding: 12px !important; gap: 12px !important; }
                }
            `}</style>
            <div className="cfg-hub-layout" style={{ display: 'flex', alignItems: 'flex-start', gap: 20, padding: '20px 0 20px 20px' }}>
                <ConfigSidebar activa={sub} onNavigate={ir} />
                <div style={{ flex: 1, minWidth: 0, width: '100%' }}>
                    {content}
                </div>
            </div>
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
