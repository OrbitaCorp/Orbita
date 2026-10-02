// Listas fijas de la configuración del negocio: medios de pago,
// transportistas y títulos de cada sección.

import type { VistaConfig } from '../ConfigTabs'

// Métodos que aplican a CUALQUIER forma de entrega (domicilio o retiro) —
// Efectivo, en cambio, solo tiene sentido con retiro en local y se muestra
// aparte, en su propia sección (ver vista === 'pagos' más abajo).
export const PAGOS_META: { key: 'acceptsMercadopago' | 'acceptsTransfer'; label: string; desc: string }[] = [
    { key: 'acceptsMercadopago', label: 'Mercado Pago', desc: 'Pagos online con tarjeta, débito y cuotas' },
    // Antes "Transferencia" (pedía CBU/alias de entrada) — ahora el negocio
    // coordina el pago directo por WhatsApp, sin mostrar ningún dato bancario.
    { key: 'acceptsTransfer', label: 'Coordinar por WhatsApp', desc: 'El negocio coordina el pago con el cliente, sin pedir CBU/alias' },
]

// Default del mapa cuando la sucursal todavía no tiene coordenadas — mismo
// centro (Buenos Aires) que usa el mapa del wizard de onboarding.
export const BA: [number, number] = [-34.6037, -58.3816]

// Título de arriba de página según la sección activa del menú guía.
export const TITULOS_SECCION: Partial<Record<VistaConfig, string>> = {
    negocio: 'Negocio', general: 'Negocio', contacto: 'Contacto', pagos: 'Pagos',
    envios: 'Envíos', redes: 'Redes sociales', postventa: 'Cancelaciones y devoluciones', peligro: 'Zona peligrosa',
}

// Mismo enum cerrado que el backend (update-business-config.dto.ts) — acá
// solo se mapea a label, la validación real vive del otro lado.
// MERCADOPAGO se filtra más abajo (solo tiene sentido ofrecer restringirlo
// en retiro si el negocio lo acepta en general). Coordinar por WhatsApp NO
// entra en esta lista a pedido: siempre sigue el toggle general
// (acceptsTransfer), sin restricción puntual para retiro. "Transferencia" sí:
// es informativa (se paga por transferencia en el local), como Débito/Crédito.
export const PICKUP_PAGO_META: { key: string; label: string }[] = [
    { key: 'CASH',         label: 'Efectivo' },
    { key: 'DEBIT',        label: 'Débito' },
    { key: 'CREDIT',       label: 'Crédito' },
    { key: 'TRANSFER',     label: 'Transferencia' },
    { key: 'MERCADOPAGO',  label: 'Mercado Pago' },
]

// Mismo enum cerrado que el checkout (CheckoutPago.tsx CARRIER_LABEL) — acá
// el negocio elige cuáles de estos ofrece de verdad. Vacío = todos (así un
// negocio que nunca tocó esto sigue viendo la lista completa en su checkout).
export const CARRIER_META: { key: string; label: string }[] = [
    { key: 'CORREO_ARGENTINO', label: 'Correo Argentino' },
    { key: 'OCA',              label: 'OCA' },
    { key: 'ANDREANI',         label: 'Andreani' },
    { key: 'VIA_CARGO',        label: 'Vía Cargo' },
    { key: 'DELIVERY_APP',     label: 'Delivery local (moto/app)' },
    { key: 'OTRO',             label: 'Otro / a coordinar' },
]
