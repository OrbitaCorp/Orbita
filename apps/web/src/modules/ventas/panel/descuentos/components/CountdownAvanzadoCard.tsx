// Tarjeta de "Cuenta regresiva con descuento" arriba del listado de Descuentos.
//
// Por qué vive acá y no solo en Avanzado: para el dueño esto ES un descuento —
// elige el %, a qué productos aplica y hasta cuándo, y el módulo crea y
// mantiene un `Discount` real que después aparece en la tabla de abajo como
// cualquier otro. Si solo estuviera en Avanzado, quien entra a Descuentos a
// armar una promo con fecha no se entera de que existe.
//
// Dos estados:
//
//   - CON el paquete Avanzado: muestra si está prendida y cuánto falta, se
//     PRENDE Y SE APAGA desde acá mismo (el interruptor), y "Configurar" abre
//     el formulario adentro de Descuentos (DescuentosShell, vista=countdown) —
//     la misma pantalla que en Avanzado, sin mandar al dueño a otro módulo. La
//     ficha del Discount en la tabla de abajo es de lectura.
//     Si la fecha ya venció no se puede prender desde acá (el backend lo
//     rechaza): el interruptor se traba y se explica que hay que poner una
//     fecha nueva en Configurar.
//
//   - SIN el paquete: se ve ENTERA, legible, con el candado y "Solo con el
//     paquete Avanzado" — no gris ni borrosa. La decisión es deliberada: si no
//     se entiende qué hace, nadie la va a querer comprar. El gate real de
//     todos modos vive en el backend (AddonGuard); esto es la vidriera.

import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { ArrowRight, Lock, Timer } from 'lucide-react'
import { Card } from '@/design-system/components/Card'
import { Button } from '@/design-system/components/Button'
import { Toast } from '@/design-system/components/Toast'
import { SkeletonText } from '@/design-system/components/Skeleton'
import { Toggle } from '../../configuracion/components/ConfigControls'
import { adminPath, currentSlug } from '@/lib/tenant'
import { ApiError, panelGetAddons, panelGetCountdown, panelUpsertCountdown, type ApiCountdownConfig } from '@/lib/api'
import { toastEsError } from '@/lib/utils'
import { useAhora } from '@/hooks/useAhora'

// Lo que hace la funcionalidad, en la tienda y no en abstracto: es la parte
// que tiene que convencer a quien todavía no la tiene.
const QUE_HACE = [
    'Un reloj en la portada con los días, las horas y los minutos que faltan, corriendo en vivo.',
    'Una sección con los productos en oferta, ya con el precio descontado.',
    '"Termina en 2d 4h" en la tarjeta de cada producto alcanzado.',
    'Un aviso a quien está por irse sin comprar, con el descuento que elijas.',
]

export function CountdownAvanzadoCard({ onConfigurar }: { onConfigurar: () => void }) {
    const router = useRouter()
    const [avanzado, setAvanzado] = useState<boolean | null>(null)
    const [cfg, setCfg] = useState<ApiCountdownConfig | null>(null)
    const [cambiando, setCambiando] = useState(false)
    const [toast, setToast] = useState<string | null>(null)

    useEffect(() => {
        if (!toast) return
        const t = setTimeout(() => setToast(null), 3000)
        return () => clearTimeout(t)
    }, [toast])

    useEffect(() => {
        let cancelado = false
        panelGetAddons()
            .then(async r => {
                if (cancelado) return
                setAvanzado(r.advanced)
                // El endpoint del countdown está gateado por AddonGuard: sin el
                // paquete devuelve 403, así que ni se pide.
                if (!r.advanced) return
                const c = await panelGetCountdown().catch(() => null)
                if (!cancelado) setCfg(c)
            })
            // Sin poder saber el plan, la tarjeta no se muestra: es mejor que
            // mostrar el estado equivocado arriba del listado.
            .catch(() => { if (!cancelado) setAvanzado(false) })
        return () => { cancelado = true }
    }, [])

    const fin = cfg ? new Date(cfg.endDate).getTime() : null
    // Un minuto alcanza: es "faltan 2 días", no un reloj. Se apaga solo al
    // llegar a la fecha (tercer argumento).
    const ahora = useAhora(!!fin, 60000, fin ?? undefined)
    const vencida = fin !== null && ahora !== null && fin <= ahora
    const vigente = !!cfg?.isActive && fin !== null && ahora !== null && fin > ahora

    // Prender/apagar sin entrar al formulario: se manda la config tal cual
    // está guardada con `isActive` dado vuelta. Es el mismo PUT que hace
    // Guardar en la pantalla de configuración, así que el descuento gestionado
    // se prende y se apaga junto con el reloj.
    async function cambiarActiva(on: boolean) {
        if (!cfg || cambiando) return
        setCambiando(true)
        try {
            const r = await panelUpsertCountdown({
                title: cfg.title,
                subtitle: cfg.subtitle ?? undefined,
                endDate: cfg.endDate,
                finishedMessage: cfg.finishedMessage ?? undefined,
                ctaText: cfg.ctaText ?? undefined,
                ctaLink: cfg.ctaLink ?? undefined,
                placement: cfg.placement,
                isActive: on,
                conDescuento: cfg.conDescuento,
                ...(cfg.conDescuento && cfg.descuentoTipo && cfg.descuentoValor != null && cfg.descuentoAlcance
                    ? {
                        descuentoTipo: cfg.descuentoTipo,
                        descuentoValor: cfg.descuentoValor,
                        descuentoAlcance: cfg.descuentoAlcance,
                        productIds: cfg.productIds,
                        categoryIds: cfg.categoryIds,
                        showProductsOnHome: cfg.showProductsOnHome,
                    }
                    : {}),
            })
            setCfg(r)
            setToast(on ? 'Cuenta regresiva activada: ya se ve en tu tienda' : 'Cuenta regresiva apagada')
        } catch (e) {
            setToast(e instanceof ApiError ? e.message : 'No se pudo cambiar')
        } finally {
            setCambiando(false)
        }
    }

    function irASuscripcion() {
        const negocioId = currentSlug() ?? (router.query.negocioId as string) ?? 'rama-tienda'
        const moduloPadre = (router.query.moduloPadre as string) ?? 'ventas'
        router.push({ pathname: adminPath(negocioId, moduloPadre, 'configuracion'), query: { vista: 'suscripcion' } })
    }

    if (avanzado === null) {
        return (
            <Card padding="md" style={{ marginBottom: 16 }}>
                <SkeletonText width="34%" height={14} />
                <SkeletonText width="72%" height={11} style={{ marginTop: 8 }} />
            </Card>
        )
    }

    const bloqueada = !avanzado

    return (
        <Card padding="md" style={{ marginBottom: 16 }}>
            <style>{ESTILOS}</style>
            <div className="cav-fila">
                <div className="cav-icono" aria-hidden="true">
                    <Timer size={19} strokeWidth={1.8} color="var(--color-warning)" />
                </div>

                <div className="cav-copy">
                    <div className="cav-titulo-fila">
                        <span className="cav-titulo">Cuenta regresiva con descuento</span>
                        {bloqueada ? (
                            <span className="cav-chip cav-chip--pago">
                                <Lock size={11} strokeWidth={2.2} aria-hidden="true" />
                                Solo con el paquete Avanzado
                            </span>
                        ) : (
                            // El punto de color no viaja solo: al lado va la
                            // palabra, porque el color no puede ser el único
                            // indicador de estado.
                            <span className="cav-chip" data-encendida={vigente || undefined} data-vencida={(cfg?.isActive && vencida) || undefined}>
                                <span className="cav-punto" />
                                {!cfg ? 'Sin armar' : vigente ? 'Activa en tu tienda' : cfg.isActive && vencida ? 'Vencida' : 'Apagada'}
                            </span>
                        )}
                    </div>

                    <p className="cav-desc">
                        Una promo con fecha límite: elegís el descuento, a qué productos aplica y hasta cuándo, y la tienda entera lo cuenta hacia atrás. El descuento es real —se aplica en el carrito y aparece en la tabla de acá abajo—, así que cuando el reloj llega a cero deja de descontar solo.
                    </p>

                    {bloqueada && (
                        <ul className="cav-lista">
                            {QUE_HACE.map(t => <li key={t}>{t}</li>)}
                        </ul>
                    )}

                    {!bloqueada && cfg && fin !== null && ahora !== null && (
                        <p className="cav-estado">
                            <strong>{cfg.title}</strong>
                            {' — '}
                            {vencida
                                ? `terminó el ${fechaCorta(cfg.endDate)}`
                                : `${cfg.isActive ? 'termina' : 'terminaría'} en ${textoFalta(fin, ahora)}`}
                        </p>
                    )}

                    {!bloqueada && cfg && (
                        <div className="cav-switch">
                            {/* Prender con la fecha vencida lo rechaza el backend:
                                mejor trabar el interruptor y decir qué hacer. */}
                            <Toggle on={cfg.isActive && !vencida} onChange={cambiarActiva} disabled={cambiando || (vencida && !cfg.isActive)} />
                            <div>
                                <div className="cav-switch-titulo">{cfg.isActive && !vencida ? 'Activa' : 'Activar en tu tienda'}</div>
                                <div className="cav-switch-desc">
                                    {vencida
                                        ? 'La fecha ya pasó: poné una nueva en Configurar para volver a prenderla.'
                                        : cfg.isActive
                                            ? 'Apagala y deja de verse al instante, con su descuento incluido.'
                                            : 'Prendela y aparece el reloj en la portada, con los productos en oferta.'}
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                <div className="cav-accion">
                    <Button
                        variant={bloqueada ? 'primary' : 'outline'}
                        size="sm"
                        icon={<ArrowRight size={13} strokeWidth={2.2} />}
                        onClick={bloqueada ? irASuscripcion : onConfigurar}
                    >
                        {bloqueada ? 'Ver qué incluye' : cfg ? 'Configurar' : 'Crear la promo'}
                    </Button>
                </div>
            </div>

            {toast && (
                <div style={{ position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', zIndex: 9000 }}>
                    <Toast variant={toastEsError(toast) ? 'error' : 'success'} title={toast} onClose={() => setToast(null)} />
                </div>
            )}
        </Card>
    )
}

// "06/09", igual que la columna Vigencia de la tabla de abajo.
function fechaCorta(iso: string): string {
    const d = new Date(iso)
    return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`
}

function textoFalta(fin: number, ahora: number): string {
    const min = Math.floor((fin - ahora) / 60000)
    if (min < 60) return `termina en ${Math.max(min, 1)} min`
    const hs = Math.floor(min / 60)
    if (hs < 48) return `termina en ${hs} h`
    return `termina en ${Math.floor(hs / 24)} días`
}

const ESTILOS = `
.cav-fila { display: flex; align-items: flex-start; gap: 14px; }
.cav-icono {
    width: 40px; height: 40px; border-radius: 11px; flex-shrink: 0;
    display: grid; place-items: center; background: var(--color-warning-bg);
}
.cav-copy { flex: 1; min-width: 0; }

.cav-titulo-fila { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.cav-titulo { font-size: 15px; font-weight: 700; letter-spacing: -0.01em; color: var(--color-text); }

.cav-chip {
    display: inline-flex; align-items: center; gap: 5px;
    height: 22px; padding: 0 9px; border-radius: 999px;
    font-size: 11px; font-weight: 600; color: var(--color-muted);
    background: var(--color-bg); border: 1px solid var(--color-border);
}
.cav-chip--pago { color: var(--color-warning); background: var(--color-warning-bg); border-color: var(--color-warning); }
.cav-punto { width: 6px; height: 6px; border-radius: 50%; background: var(--color-border); }
.cav-chip[data-encendida] { color: var(--color-success); }
.cav-chip[data-encendida] .cav-punto { background: var(--color-success); }
.cav-chip[data-vencida] { color: var(--color-warning); }
.cav-chip[data-vencida] .cav-punto { background: var(--color-warning); }

.cav-desc { font-size: 12.5px; line-height: 1.55; color: var(--color-muted); margin: 6px 0 0; max-width: 74ch; }
.cav-estado { font-size: 12.5px; line-height: 1.5; color: var(--color-body); margin: 8px 0 0; }
.cav-estado strong { color: var(--color-text); }

.cav-lista { margin: 10px 0 0; padding: 0 0 0 18px; display: flex; flex-direction: column; gap: 4px; }
.cav-lista li { font-size: 12.5px; line-height: 1.5; color: var(--color-body); }

.cav-switch { display: flex; align-items: flex-start; gap: 10px; margin-top: 12px; }
.cav-switch > span { margin-top: 1px; }
.cav-switch-titulo { font-size: 13px; font-weight: 600; color: var(--color-text); }
.cav-switch-desc { font-size: 12px; line-height: 1.5; color: var(--color-muted); margin-top: 2px; }

.cav-accion { flex-shrink: 0; }

/* En celular el botón pasa abajo y a lo ancho: apretado a la derecha de un
   texto de cuatro renglones queda como un detalle, y es la acción principal
   de la tarjeta. */
@media (max-width: 768px) {
    .cav-fila { flex-wrap: wrap; }
    .cav-accion { width: 100%; }
    .cav-accion > button { width: 100%; justify-content: center; }
}
`
