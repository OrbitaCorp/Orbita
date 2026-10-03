// El estado de la configuración del negocio (Negocio, Contacto, Pagos,
// Envíos, Redes, Postventa y Zona peligrosa): carga todo junto y cada
// tarjeta guarda lo suyo por separado.

import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { useAuth } from '@/hooks/useAuth'
import {
    ApiError,
    panelGetBusiness, updateBusiness,
    panelGetBusinessConfig, panelUpdateBusinessConfig,
    panelListBranches, panelUpdateBranch,
    panelGetMercadopagoStatus, panelGetMercadopagoConnectUrl, panelDisconnectMercadopago,
} from '@/lib/api'
import { BA, CARRIER_META } from './constantes'

export function useConfigGeneral(onToast: (m: string) => void) {
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
    // cuit y legalName (hallazgo `legales-sin-cuit`) van a Términos y
    // Privacidad de la tienda; se guardan junto con el contacto.
    const [contacto, setContacto] = useState({ whatsapp: '', email: '', scheduleText: '', cuit: '', legalName: '' })
    // Una API anterior al CUIT no devuelve la clave `cuit` y descarta el campo
    // en silencio al guardar: sin esto el panel diría "guardado" sin guardar
    // nada mientras la web nueva convive con la API vieja.
    const [soportaFiscal, setSoportaFiscal] = useState(false)
    const [pagos, setPagos]       = useState({
        acceptsMercadopago: false, acceptsCash: false, acceptsPickup: false, acceptsTransfer: false,
        pickupPaymentMethods: [] as string[],
        acceptsCoordinateLater: false,
        // Texto sanitizado a número (mismo patrón que freeShippingFrom, ver
        // envios más abajo) — vacío = sin descuento, nunca se fuerza a '0'.
        cashDiscountPercent: '',
        // RBT-692 — mismo criterio, generalizado a Mercado Pago y
        // "Transferencia" (acceptsTransfer, hoy "Coordinar por WhatsApp").
        mercadopagoDiscountPercent: '',
        transferDiscountPercent: '',
        // RBT-691 — vive en BusinessConfig (por eso está acá, en `pagos`),
        // aunque se RENDERIZA en la vista "Negocio" (ver más abajo) — así se
        // guarda con el mismo ciclo guardarPagos()/panelUpdateBusinessConfig
        // sin duplicar fetch/guardado. '21' default hasta que cargue la config real.
        ivaRate: '21',
        // Pedido explícito del dueño (2026-09-06) — oculta la leyenda de IVA
        // por completo en checkout/detalle sin perder `ivaRate` (se guarda
        // igual, por si se reactiva). false hasta que cargue la config real.
        ivaDisabled: false,
    })
    // Sucursal de retiro (Branch, no BusinessConfig) — la principal/primera
    // activa, mismo criterio que ya usa storefront.service.ts para resolver
    // "el" punto de retiro (todavía no hay UI para elegir sucursal acá).
    const [branchId, setBranchId] = useState<string | null>(null)
    const [envios, setEnvios]     = useState({
        freeShippingFrom: '', shippingPolicy: '', shippingEstimateText: '', enabledCarriers: [] as string[],
        // Costo de envío por transportista — todos arrancan vacíos ('' = sin
        // cargar, ese transportista no calcula envío, se sigue coordinando aparte).
        carrierShippingCosts: {} as Record<string, string>,
    })
    const [redes, setRedes]       = useState({ instagram: '', tiktok: '', facebook: '' })
    const [postventa, setPostventa] = useState({
        returnsEnabled: true, returnsCreditNoteEnabled: true, returnsMpRefundEnabled: false, returnsWindowText: '',
        cancellationsEnabled: true, cancellationsCreditNoteEnabled: false, cancellationsMpRefundEnabled: true,
    })
    const [isPaused, setIsPaused] = useState(false)
    // FULL = tienda online completa (carrito, checkout, mensajería, reseñas,
    // cupones). SHOWCASE = "vidriera digital": el storefront queda de solo
    // catálogo — el cliente consulta por WhatsApp, no compra desde acá.
    const [modo, setModo] = useState<'FULL' | 'SHOWCASE'>('FULL')
    // Cancelación voluntaria (RBT — ciclo de vida de suscripciones, 2026-09):
    // cancelledAt no nulo = dentro de la ventana de 60 días, reactivable.
    const [cancelledAt, setCancelledAt] = useState<string | null>(null)
    const [scheduledDeletionAt, setScheduledDeletionAt] = useState<string | null>(null)

    const [guardando, setGuardando] = useState<string | null>(null)                // card que está guardando
    const [errores, setErrores]     = useState<Record<string, string | null>>({}) // error por card

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
                // La sucursal principal, y ninguna otra: la misma definición
                // que usa el backend en buscarSucursalPrincipal() (hallazgo
                // `sucursal-principal-doble`). Antes acá había un tercer
                // criterio propio ("la default entre las activas, si no
                // cualquier activa, si no la primera del listado"), así que
                // con la principal desactivada el dueño editaba acá la
                // dirección de una sucursal distinta de aquella contra la que
                // la tienda vende y el panel carga el stock.
                const sucursal = branches.find(b => b.isDefault) ?? null
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
                const contacto0 = { whatsapp: cfg.whatsapp ?? '', email: cfg.email ?? '', scheduleText: cfg.scheduleText ?? '', cuit: cfg.cuit ?? '', legalName: cfg.legalName ?? '' }
                setSoportaFiscal('cuit' in cfg)
                const pagos0 = {
                    acceptsMercadopago: cfg.acceptsMercadopago,
                    acceptsCash: cfg.acceptsCash,
                    acceptsPickup: cfg.acceptsPickup,
                    acceptsTransfer: cfg.acceptsTransfer,
                    pickupPaymentMethods: cfg.pickupPaymentMethods ?? [],
                    acceptsCoordinateLater: cfg.acceptsCoordinateLater,
                    cashDiscountPercent: cfg.cashDiscountPercent != null ? String(cfg.cashDiscountPercent) : '',
                    mercadopagoDiscountPercent: cfg.mercadopagoDiscountPercent != null ? String(cfg.mercadopagoDiscountPercent) : '',
                    transferDiscountPercent: cfg.transferDiscountPercent != null ? String(cfg.transferDiscountPercent) : '',
                    ivaRate: String(cfg.ivaRate),
                    ivaDisabled: cfg.ivaDisabled,
                }
                const envios0 = {
                    // Los montos llegan del backend como texto: los muestro tal cual
                    // y los paso a número recién en el momento de guardar.
                    freeShippingFrom: cfg.freeShippingFrom != null ? String(cfg.freeShippingFrom) : '',
                    shippingPolicy: cfg.shippingPolicy ?? '',
                    shippingEstimateText: cfg.shippingEstimateText ?? '',
                    enabledCarriers: cfg.enabledCarriers ?? [],
                    carrierShippingCosts: Object.fromEntries(
                        Object.entries(cfg.carrierShippingCosts ?? {}).map(([k, v]) => [k, String(v)]),
                    ),
                }
                const redes0 = { instagram: cfg.instagram ?? '', tiktok: cfg.tiktok ?? '', facebook: cfg.facebook ?? '' }
                const postventa0 = {
                    returnsEnabled: cfg.returnsEnabled, returnsCreditNoteEnabled: cfg.returnsCreditNoteEnabled, returnsMpRefundEnabled: cfg.returnsMpRefundEnabled,
                    returnsWindowText: cfg.returnsWindowText ?? '',
                    cancellationsEnabled: cfg.cancellationsEnabled, cancellationsCreditNoteEnabled: cfg.cancellationsCreditNoteEnabled, cancellationsMpRefundEnabled: cfg.cancellationsMpRefundEnabled,
                }
                setNegocio(negocio0)
                setIsPaused(biz.isPaused)
                setModo(biz.mode === 'SHOWCASE' ? 'SHOWCASE' : 'FULL')
                setCancelledAt(biz.cancelledAt)
                setScheduledDeletionAt(biz.scheduledDeletionAt)
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

    const guardarContacto = () => guardar('contacto',
        () => panelUpdateBusinessConfig({
            whatsapp: contacto.whatsapp,
            scheduleText: contacto.scheduleText,
            ...(soportaFiscal ? { cuit: contacto.cuit, legalName: contacto.legalName } : {}),
            // Si el email está vacío directamente no lo mando: el backend no acepta un email en blanco.
            ...(contacto.email.trim() ? { email: contacto.email.trim() } : {}),
        }),
        'Datos de contacto guardados', contacto)

    // RBT-692 — valida cada descuento por medio de pago con el mismo criterio
    // (0-100, y aviso si deja el precio en $0 o negativo — pedido explícito
    // del ticket). Devuelve el número a mandar, o null si el campo está vacío.
    function validarDescuento(valor: string, etiqueta: string): number | null | 'error' {
        if (valor.trim() === '') return null
        const n = Number(valor)
        if (Number.isNaN(n) || n < 0 || n > 100) {
            setErrores(prev => ({ ...prev, pagos: `El descuento por ${etiqueta} tiene que ser un número entre 0 y 100` }))
            return 'error'
        }
        if (n >= 100) {
            setErrores(prev => ({ ...prev, pagos: `Un descuento del 100% o más por ${etiqueta} deja el precio en $0 o negativo — revisá el valor` }))
            return 'error'
        }
        return n
    }

    const guardarPagos = () => {
        const cash = validarDescuento(pagos.cashDiscountPercent, 'efectivo')
        if (cash === 'error') return
        const mp = validarDescuento(pagos.mercadopagoDiscountPercent, 'Mercado Pago')
        if (mp === 'error') return
        const transfer = validarDescuento(pagos.transferDiscountPercent, 'transferencia/WhatsApp')
        if (transfer === 'error') return
        guardar('pagos',
            () => panelUpdateBusinessConfig({
                acceptsMercadopago: pagos.acceptsMercadopago,
                acceptsCash: pagos.acceptsCash,
                acceptsPickup: pagos.acceptsPickup,
                acceptsTransfer: pagos.acceptsTransfer,
                pickupPaymentMethods: pagos.pickupPaymentMethods,
                acceptsCoordinateLater: pagos.acceptsCoordinateLater,
                ...(cash !== null ? { cashDiscountPercent: cash } : {}),
                ...(mp !== null ? { mercadopagoDiscountPercent: mp } : {}),
                ...(transfer !== null ? { transferDiscountPercent: transfer } : {}),
                // RBT-691 — siempre se manda (selector cerrado, no texto libre vacío).
                ivaRate: Number(pagos.ivaRate),
                ivaDisabled: pagos.ivaDisabled,
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
            shippingEstimateText: envios.shippingEstimateText,
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

    return {
        authStatus, esDueno, cargando, sinSesion, errorCarga, setRecarga,
        negocio, setNegocio, contacto, setContacto, soportaFiscal, pagos, setPagos,
        envios, setEnvios, redes, setRedes, postventa, setPostventa,
        isPaused, setIsPaused, modo, setModo,
        cancelledAt, setCancelledAt, scheduledDeletionAt, setScheduledDeletionAt,
        guardando, setGuardando, errores, setErrores, cambiado,
        mp, mpBusy, mpError, conectarMp, desconectarMp,
        guardarNegocio, guardarContacto, guardarPagos, guardarEnvios, guardarRedes, guardarPostventa,
    }
}

export type ConfigGeneralState = ReturnType<typeof useConfigGeneral>
