import { Card } from '@/design-system/components/Card'
import { Button } from '@/design-system/components/Button'
import { CfgField, Toggle } from '../ConfigControls'
import { DirtyHint, ErrorInline, SectionTitle } from './comunes'
import { PAGOS_META, PICKUP_PAGO_META } from './constantes'
import type { ConfigGeneralState } from './useConfigGeneral'

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

export function SeccionPagos({ cfg }: { cfg: ConfigGeneralState }) {
    const { pagos, setPagos, mp, mpBusy, mpError, conectarMp, desconectarMp, cambiado, guardando, guardarPagos, errores } = cfg
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        {/* RBT-691 — vive en BusinessConfig (mismo ciclo guardarPagos()
            de acá abajo), no en Business — por eso está en esta pestaña
            aunque conceptualmente sea "del negocio". */}
        <Card style={{ display: 'flex', flexDirection: 'column' }}>
            {/* Pedido explícito: "Impuestos" -> "IVA" — es lo único
                que este bloque desglosa de verdad (ivaRate), no
                impuestos en general. */}
            <SectionTitle>IVA</SectionTitle>
            <div style={{ fontSize: 12.5, color: 'var(--color-muted)', marginBottom: 12, lineHeight: 1.5 }}>
                Se aplica a todos tus productos — no hay carga producto por producto. Cumple con la normativa de exhibición de precios (precio final + monto sin impuestos).
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {(['21', '10.5', '0'] as const).map(v => {
                    const activo = !pagos.ivaDisabled && pagos.ivaRate === v
                    return (
                        <button
                            key={v}
                            type="button"
                            className="ds-hover"
                            onClick={() => setPagos(p => ({ ...p, ivaRate: v, ivaDisabled: false }))}
                            style={{
                                height: 40, padding: '0 18px', borderRadius: 8,
                                fontSize: 13.5, fontWeight: 600, cursor: 'pointer',
                                background: activo ? 'var(--color-primary-bg)' : 'var(--color-bg)',
                                color: activo ? 'var(--color-primary)' : 'var(--color-text)',
                                border: `1.5px solid ${activo ? 'var(--color-primary)' : 'var(--color-border)'}`,
                            }}
                        >
                            {v === '0' ? '0% (exento)' : `${v}%`}
                        </button>
                    )
                })}
                {/* Pedido explícito del dueño (2026-09-06) — pisa la
                    decisión original de RBT-691 ("la normativa no
                    permite 'no mostrar IVA', solo ajustar la
                    alícuota"). Guarda la alícuota elegida arriba tal
                    cual (no la pisa a 0) para no perderla si se
                    reactiva. */}
                <button
                    type="button"
                    className="ds-hover"
                    onClick={() => setPagos(p => ({ ...p, ivaDisabled: true }))}
                    style={{
                        height: 40, padding: '0 18px', borderRadius: 8,
                        fontSize: 13.5, fontWeight: 600, cursor: 'pointer',
                        background: pagos.ivaDisabled ? 'var(--color-error-bg)' : 'var(--color-bg)',
                        color: pagos.ivaDisabled ? 'var(--color-error)' : 'var(--color-text)',
                        border: `1.5px solid ${pagos.ivaDisabled ? 'var(--color-error)' : 'var(--color-border)'}`,
                    }}
                >
                    Deshabilitar IVA
                </button>
            </div>
            {/* Aclaración explícita — el % de acá es un desglose
                informativo del precio que vos ya cargaste (para
                cumplir la normativa de precios con impuestos
                discriminados), no un cálculo que la plataforma le
                suma o resta a nada. Ver order.ivaRatePercent en
                orders.service.ts: se guarda como dato aparte del
                total del pedido, nunca se usa para calcularlo. */}
            <div style={{ fontSize: 11.5, color: 'var(--color-subtle)', marginTop: 10, lineHeight: 1.5 }}>
                {pagos.ivaDisabled
                    ? 'No se va a mostrar ninguna leyenda de IVA en el detalle de producto ni en el checkout — solo el precio final. Tené en cuenta que la normativa de exhibición de precios pide discriminar los impuestos incluidos; esta decisión es tuya.'
                    : 'Es el IVA que ya está incluido en el precio que cargaste — Órbita no lo suma ni lo resta de nada. Solo se usa para mostrar el desglose (precio final + monto sin impuestos) que pide la ley; cambiar el % no cambia lo que cobrás ni lo que paga el cliente.'}
            </div>
        </Card>

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
                                            : 'Sin conectar. Es opcional: conectala si querés aceptar tarjeta y dinero en cuenta'}
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
                            Mercado Pago te cobra una comisión por cada cobro — varía según el medio de pago y las cuotas, no es un % fijo. La vas a ver reflejada en el detalle de cada pedido y sumada por período en Inicio.{' '}
                            <a href="https://www.mercadopago.com.ar/ayuda/33399#ctes" target="_blank" rel="noopener noreferrer" style={{ color: '#009EE3', fontWeight: 600 }}>
                                Ver tasas oficiales de MP →
                            </a>
                        </div>
                    )}
                    {/* RBT-692 — mismo campo que el de Efectivo, generalizado. */}
                    <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid rgba(0,177,234,0.2)' }}>
                        <CfgField
                            label="Descuento por pagar con Mercado Pago (%) (opcional)"
                            placeholder="Ej: 5"
                            value={pagos.mercadopagoDiscountPercent}
                            onChange={v => setPagos(p => ({ ...p, mercadopagoDiscountPercent: v.replace(/[^0-9.]/g, '') }))}
                        />
                        <div style={{ fontSize: 11.5, color: 'var(--color-muted)', marginTop: 4 }}>
                            Se aplica solo en el checkout, cuando el cliente elige pagar con Mercado Pago. Dejalo vacío para no aplicar descuento.
                        </div>
                    </div>
                </div>
            )}
            {pagos.acceptsTransfer && (
                <div style={{ marginTop: 14, padding: 14, borderRadius: 10, background: 'var(--color-surface-alt)', border: '1px solid var(--color-border)' }}>
                    <div style={{ fontSize: 12.5, color: 'var(--color-body)', lineHeight: 1.5 }}>
                        No se le pide CBU ni alias al cliente — confirma el pedido y vos lo contactás por WhatsApp para coordinar cómo paga (transferencia, link de pago, crédito, u otro medio que acuerden).
                    </div>
                    {/* RBT-692 — mismo campo que el de Efectivo, generalizado. Se
                        etiqueta "Transferencia" (así lo pidió el ticket) aunque el
                        método real sea "Coordinar por WhatsApp" — la aclaración de
                        arriba conecta ambos nombres para el dueño. */}
                    <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--color-border)' }}>
                        <CfgField
                            label="Descuento por transferencia / WhatsApp (%) (opcional)"
                            placeholder="Ej: 15"
                            value={pagos.transferDiscountPercent}
                            onChange={v => setPagos(p => ({ ...p, transferDiscountPercent: v.replace(/[^0-9.]/g, '') }))}
                        />
                        <div style={{ fontSize: 11.5, color: 'var(--color-muted)', marginTop: 4 }}>
                            Se aplica cuando el cliente coordina por WhatsApp. Dejalo vacío para no aplicar descuento.
                        </div>
                    </div>
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
                                label="Descuento por pagar en efectivo (%) (opcional)"
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
                                ? 'Sin nada marcado, se aceptan todos los que tenés habilitados arriba (Mercado Pago, Efectivo) más Débito/Crédito con posnet (Transferencia solo aparece si la marcás). Marcá acá solo si querés restringir el retiro a medios puntuales. Coordinar por WhatsApp no se restringe acá: sigue siempre el toggle de arriba.'
                                : 'El retiro queda limitado a lo marcado acá: el resto (aunque esté habilitado arriba) no se ofrece al retirar. Coordinar por WhatsApp es la excepción: sigue siempre el toggle de arriba.'}
                        </div>
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                            {PICKUP_PAGO_META.filter(m => m.key !== 'MERCADOPAGO' || pagos.acceptsMercadopago).map(m => {
                                const activo = pagos.pickupPaymentMethods.includes(m.key)
                                return (
                                    <button
                                        key={m.key}
                                        type="button"
                                        className="ds-hover"
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
    )
}

/* Barra flotante de guardado — mismo patrón que Apariencia.tsx.
    Pagos es la sección más larga de Configuración (IVA + Métodos
    de pago, todo en una sola tarjeta con un solo botón al final):
    el DirtyHint de ahí abajo queda fuera de vista apenas se toca
    algo arriba (ej. el IVA). Pedido explícito del dueño — el
    resto de las secciones son cortas y no lo necesitan. */
export function BarraGuardadoPagos({ cfg }: { cfg: ConfigGeneralState }) {
    const { guardando, guardarPagos, errores } = cfg
    return (
        <div style={{
            position: 'fixed', left: '50%', bottom: 20, zIndex: 80,
            transform: 'translateX(-50%)',
            display: 'flex', alignItems: 'center', gap: 12,
            background: 'var(--color-bg)', border: '1px solid var(--color-border)',
            borderRadius: 999, padding: '8px 8px 8px 18px',
            boxShadow: '0 10px 30px rgba(15,23,42,0.16)',
            animation: 'cfgStickyBarIn 220ms ease',
        }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#F59E0B', flexShrink: 0 }} />
            <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-text)', whiteSpace: 'nowrap' }}>
                Tenés cambios sin guardar
            </span>
            {errores.pagos && (
                <span style={{ fontSize: 12, color: 'var(--color-error)', whiteSpace: 'nowrap' }}>{errores.pagos}</span>
            )}
            <Button variant="primary" loading={guardando === 'pagos'} onClick={guardarPagos}>Guardar cambios</Button>
        </div>
    )
}
