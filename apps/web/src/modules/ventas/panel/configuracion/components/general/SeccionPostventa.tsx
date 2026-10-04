import { Card } from '@/design-system/components/Card'
import { Button } from '@/design-system/components/Button'
import { CfgField, Toggle } from '../ConfigControls'
import { DirtyHint, ErrorInline, SectionTitle } from './comunes'
import type { ConfigGeneralState } from './useConfigGeneral'

export function SeccionPostventa({ cfg }: { cfg: ConfigGeneralState }) {
    const { postventa, setPostventa, cambiado, guardando, guardarPostventa, errores } = cfg
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <Card style={{ display: 'flex', flexDirection: 'column' }}>
            <SectionTitle>Devoluciones</SectionTitle>
            {/* Cartelito "Cambios" de la ficha de producto — independiente
                del toggle de abajo: es solo el texto que ve el cliente
                ANTES de comprar, vacío = se sigue mostrando "30 días
                gratis", el mismo texto fijo que había antes. */}
            <CfgField label="Ventana de cambios (opcional)" placeholder="Ej: 30 días gratis" value={postventa.returnsWindowText} onChange={v => setPostventa(p => ({ ...p, returnsWindowText: v }))} />
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
    )
}
