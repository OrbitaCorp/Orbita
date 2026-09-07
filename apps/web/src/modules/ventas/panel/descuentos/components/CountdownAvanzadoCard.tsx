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
//   - CON el paquete Avanzado: muestra si está prendida y cuánto falta, y
//     lleva a su configuración (Avanzado → Countdown y exit-intent), que es el
//     único lugar donde se edita. La ficha del Discount en este módulo es de
//     lectura.
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
import { SkeletonText } from '@/design-system/components/Skeleton'
import { adminPath, currentSlug } from '@/lib/tenant'
import { panelGetAddons, panelGetCountdown, type ApiCountdownConfig } from '@/lib/api'
import { useAhora } from '@/hooks/useAhora'

// Lo que hace la funcionalidad, en la tienda y no en abstracto: es la parte
// que tiene que convencer a quien todavía no la tiene.
const QUE_HACE = [
    'Un reloj en la portada con los días, las horas y los minutos que faltan, corriendo en vivo.',
    'Una sección con los productos en oferta, ya con el precio descontado.',
    '"Termina en 2d 4h" en la tarjeta de cada producto alcanzado.',
    'Un aviso a quien está por irse sin comprar, con el descuento que elijas.',
]

export function CountdownAvanzadoCard() {
    const router = useRouter()
    const [avanzado, setAvanzado] = useState<boolean | null>(null)
    const [cfg, setCfg] = useState<ApiCountdownConfig | null>(null)

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

    const fin = cfg?.isActive ? new Date(cfg.endDate).getTime() : null
    // Un minuto alcanza: es "faltan 2 días", no un reloj. Se apaga solo al
    // llegar a la fecha (tercer argumento).
    const ahora = useAhora(!!fin, 60000, fin ?? undefined)
    const vigente = fin !== null && ahora !== null && fin > ahora

    function irA(seccion: 'avanzado' | 'suscripcion') {
        const negocioId = currentSlug() ?? (router.query.negocioId as string) ?? 'rama-tienda'
        const moduloPadre = (router.query.moduloPadre as string) ?? 'ventas'
        router.push(
            seccion === 'avanzado'
                ? { pathname: adminPath(negocioId, moduloPadre, 'avanzado'), query: { vista: 'countdown' } }
                : { pathname: adminPath(negocioId, moduloPadre, 'configuracion'), query: { vista: 'suscripcion' } },
        )
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
                            <span className="cav-chip" data-encendida={vigente || undefined}>
                                <span className="cav-punto" />
                                {vigente ? 'Activa en tu tienda' : 'Apagada'}
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

                    {!bloqueada && vigente && cfg && (
                        <p className="cav-estado">
                            <strong>{cfg.title}</strong> — {textoFalta(new Date(cfg.endDate).getTime(), ahora!)}
                        </p>
                    )}
                </div>

                <div className="cav-accion">
                    <Button
                        variant={bloqueada ? 'primary' : 'outline'}
                        size="sm"
                        icon={<ArrowRight size={13} strokeWidth={2.2} />}
                        onClick={() => irA(bloqueada ? 'suscripcion' : 'avanzado')}
                    >
                        {bloqueada ? 'Ver qué incluye' : cfg ? 'Configurar' : 'Crear la promo'}
                    </Button>
                </div>
            </div>
        </Card>
    )
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

.cav-desc { font-size: 12.5px; line-height: 1.55; color: var(--color-muted); margin: 6px 0 0; max-width: 74ch; }
.cav-estado { font-size: 12.5px; line-height: 1.5; color: var(--color-body); margin: 8px 0 0; }
.cav-estado strong { color: var(--color-text); }

.cav-lista { margin: 10px 0 0; padding: 0 0 0 18px; display: flex; flex-direction: column; gap: 4px; }
.cav-lista li { font-size: 12.5px; line-height: 1.5; color: var(--color-body); }

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
