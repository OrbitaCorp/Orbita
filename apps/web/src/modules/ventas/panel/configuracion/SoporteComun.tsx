// src/modules/ventas/panel/configuracion/SoporteComun.tsx
//
// Lo que comparten la pantalla de Soporte (formulario + lista) y el hilo de
// una consulta (SoporteHilo.tsx): categorías con su ícono, la pastilla de
// estado, fechas relativas y el registro local de "hasta dónde leí". Vive
// aparte para que el hilo no importe la pantalla entera (y viceversa).

import { Globe, Wallet, Wrench, UserCog, HelpCircle } from 'lucide-react'
import { ApiError, type SupportCategory, type SupportRequestStatus } from '@/lib/api'

export const CATEGORIAS: { value: SupportCategory; label: string; Icon: typeof Globe }[] = [
    { value: 'DOMINIO',      label: 'Dominios',            Icon: Globe },
    { value: 'FACTURACION',  label: 'Facturación / pagos', Icon: Wallet },
    { value: 'TECNICO',      label: 'Problema técnico',    Icon: Wrench },
    { value: 'CUENTA',       label: 'Mi cuenta / plan',    Icon: UserCog },
    { value: 'OTRO',         label: 'Otra consulta',       Icon: HelpCircle },
]

export function categoriaDe(value: SupportCategory) {
    return CATEGORIAS.find(c => c.value === value) ?? CATEGORIAS[CATEGORIAS.length - 1]
}

// ─── Estado ──────────────────────────────────────────────────────────────────
// El color nunca va solo: la etiqueta siempre dice el estado con palabras.
const ESTADOS: Record<SupportRequestStatus, { label: string; color: string; bg: string }> = {
    OPEN:     { label: 'Abierta',    color: 'var(--color-warning)', bg: 'var(--color-warning-bg)' },
    ANSWERED: { label: 'Respondida', color: 'var(--color-success)', bg: 'var(--color-success-bg)' },
    CLOSED:   { label: 'Cerrada',    color: 'var(--color-muted)',   bg: 'var(--color-surface-alt)' },
}

export function EstadoPill({ estado }: { estado: SupportRequestStatus }) {
    const e = ESTADOS[estado] ?? ESTADOS.OPEN
    return (
        <span style={{
            display: 'inline-flex', alignItems: 'center', height: 22, padding: '0 9px', borderRadius: 999,
            fontSize: 11.5, fontWeight: 600, letterSpacing: '0.01em', whiteSpace: 'nowrap',
            color: e.color, background: e.bg,
        }}>
            {e.label}
        </span>
    )
}

// ─── Fechas ──────────────────────────────────────────────────────────────────
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

/** "14:32". También la usa "Revisado hh:mm" del estado del sistema. */
export function hhmm(d: Date) {
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

function mismoDia(a: Date, b: Date) {
    return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

/** "hoy 14:32" / "ayer" / "14 sep" (con año solo si no es el actual). Para
 *  la columna "última actividad": lo que importa es cuán reciente es. */
export function fechaRelativa(iso: string, ahora: Date = new Date()): string {
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return ''
    if (mismoDia(d, ahora)) return `hoy ${hhmm(d)}`
    const ayer = new Date(ahora)
    ayer.setDate(ahora.getDate() - 1)
    if (mismoDia(d, ayer)) return 'ayer'
    const base = `${d.getDate()} ${MESES[d.getMonth()]}`
    return d.getFullYear() === ahora.getFullYear() ? base : `${base} ${d.getFullYear()}`
}

/** Fecha completa para la cabecera del hilo y cada mensaje: "14 sep 2026, 14:32". */
export function fechaCompleta(iso: string): string {
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return ''
    return `${d.getDate()} ${MESES[d.getMonth()]} ${d.getFullYear()}, ${hhmm(d)}`
}

// ─── Visto ───────────────────────────────────────────────────────────────────
// Qué fue lo último que el usuario vio de cada consulta, para pintar el punto
// de "sin leer" cuando el equipo respondió después. Es un detalle de esta
// pestaña/dispositivo, no del negocio: por eso vive en localStorage y no en
// la API. Cada acceso va con try/catch: en privado o con el storage
// bloqueado el getter tira, y un punto de más no justifica romper la pantalla.
export type Vistos = Record<string, string>

function claveVistos(businessId: string) {
    return `orbita:soporte:visto:${businessId}`
}

export function leerVistos(businessId: string): Vistos {
    try {
        const raw = window.localStorage.getItem(claveVistos(businessId))
        const parsed = raw ? JSON.parse(raw) : null
        return parsed && typeof parsed === 'object' ? (parsed as Vistos) : {}
    } catch {
        return {}
    }
}

export function marcarVisto(businessId: string, requestId: string, lastMessageAt: string): Vistos {
    const actual = leerVistos(businessId)
    const nuevo = { ...actual, [requestId]: lastMessageAt }
    try {
        window.localStorage.setItem(claveVistos(businessId), JSON.stringify(nuevo))
    } catch {
        // Sin storage no hay memoria de lo visto; el punto vuelve a aparecer y listo.
    }
    return nuevo
}

/** Hay algo del equipo que todavía no se abrió. */
export function sinLeer(vistos: Vistos, row: { id: string; lastMessageAt: string; lastMessage: { author: 'MEMBER' | 'ADMIN' } | null }): boolean {
    if (row.lastMessage?.author !== 'ADMIN') return false
    const visto = vistos[row.id]
    return !visto || visto < row.lastMessageAt
}

// ─── Texto ───────────────────────────────────────────────────────────────────
/** Sin tildes ni mayúsculas, para buscar "envio" y encontrar "Envíos". */
export function normalizar(s: string): string {
    return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

export function pesoLegible(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

// Qué le mostramos al negocio cuando una llamada falla. Solo dejamos pasar el
// texto de la API cuando es una validación (4xx) escrita para una persona
// ("El asunto es obligatorio"); un 404 de ruta ("Cannot GET /api/v1/support",
// mientras el backend desplegado es más viejo que el frontend), un 5xx o un
// fallo de red muestran nuestro texto. Nunca jerga de servidor en producción.
export function mensajeParaElNegocio(e: unknown, fallback: string): string {
    if (e instanceof ApiError && e.status >= 400 && e.status < 500 && e.status !== 404 && !/^Cannot (GET|POST|PUT|DELETE)/.test(e.message)) {
        return e.message
    }
    return fallback
}
