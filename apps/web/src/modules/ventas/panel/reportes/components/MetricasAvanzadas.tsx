// MetricasAvanzadas — desplegable del inicio del panel (Dashboard.tsx).
//
// Rentabilidad, conversión, cancelación, clientes que repiten, devoluciones y
// descuentos, más cuatro gráficos (ventas y ganancia, cuándo compran, clientes
// nuevos vs recurrentes y rentabilidad por categoría).
//
// Carga recién al abrirse (GET /reports/dashboard/advanced): trae los pedidos
// de dos períodos y no tiene sentido pagar ese costo en cada visita al inicio.
// Usa el MISMO rango que el selector de período del dashboard.
//
// Cada métrica tiene su ícono de exclamación (InfoTip) que explica qué mide,
// cómo se calcula y qué NO incluye: la ganancia es una estimación y el dueño
// tiene que poder saber de qué está hecha.

import { useEffect, useState, type ReactNode } from 'react'
import { ChevronDown } from 'lucide-react'
import { Card } from '@/design-system/components/Card'
import { Button } from '@/design-system/components/Button'
import { Skeleton } from '@/design-system/components/Skeleton'
import { ColumnChart } from '@/design-system/components/Chart'
import { InfoTip } from '../../_shared/InfoTip'
import { fmtMoney } from '@/lib/utils'
import { ApiError, panelGetDashboardAvanzado, type ApiDashboardAvanzado } from '@/lib/api'

const CLAVE_ABIERTO = 'orbita-dash-metricas-avanzadas'
const DIAS_SEMANA = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb']
// Lunes primero, que es como lee la semana un comercio.
const ORDEN_SEMANA = [1, 2, 3, 4, 5, 6, 0]

const fmtPct = (n: number) => `${n.toLocaleString('es-AR', { maximumFractionDigits: 1 })}%`
const fmtNum = (n: number) => n.toLocaleString('es-AR', { maximumFractionDigits: 1 })

// ─── Variación contra el período anterior ──────────────────────────────────────
// `invertir`: para métricas donde que suba es lo malo (cancelaciones, devoluciones).
// La flecha siempre muestra la dirección real; solo el color cambia de sentido.
type Variacion = { texto: string; color: string } | null

function variacion(actual: number, anterior: number, invertir = false): Variacion {
    if (anterior <= 0) return null
    const v = Math.round(((actual - anterior) / anterior) * 1000) / 10
    if (v === 0) return { texto: 'igual al período anterior', color: 'var(--color-muted)' }
    const bueno = invertir ? v < 0 : v > 0
    const abs = Math.abs(v)
    return { texto: `${v > 0 ? '▲' : '▼'} ${abs > 999 ? '>999' : abs.toLocaleString('es-AR', { maximumFractionDigits: 1 })}%`, color: bueno ? 'var(--color-success)' : 'var(--color-error)' }
}

// Para métricas que ya son un porcentaje: la diferencia se da en puntos.
function variacionPuntos(actual: number | null, anterior: number | null, invertir = false): Variacion {
    if (actual === null || anterior === null) return null
    const d = Math.round((actual - anterior) * 10) / 10
    if (d === 0) return { texto: 'igual al período anterior', color: 'var(--color-muted)' }
    const bueno = invertir ? d < 0 : d > 0
    return { texto: `${d > 0 ? '▲' : '▼'} ${Math.abs(d).toLocaleString('es-AR', { maximumFractionDigits: 1 })} pts`, color: bueno ? 'var(--color-success)' : 'var(--color-error)' }
}

// ─── Piezas de texto de las explicaciones ──────────────────────────────────────
function P({ children, primero = false }: { children: ReactNode; primero?: boolean }) {
    return <p style={{ margin: primero ? 0 : '8px 0 0' }}>{children}</p>
}
function Aviso({ children }: { children: ReactNode }) {
    return <p style={{ margin: '10px 0 0', padding: '8px 10px', borderRadius: 8, background: 'var(--color-warning-bg)', color: 'var(--color-text)' }}>{children}</p>
}

// ─── Tarjeta de una métrica ────────────────────────────────────────────────────
// Sin ícono de color ni mayúsculas: el color queda para el dato (la variación).
function Tile({ label, info, value, variacion: v, sub }: { label: string; info: ReactNode; value: ReactNode; variacion?: Variacion; sub?: ReactNode }) {
    return (
        // position: relative — el cuadro del InfoTip se ancla a la tarjeta.
        <Card padding="sm" style={{ position: 'relative', minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12.5, fontWeight: 500, color: 'var(--color-muted)' }}>
                <span style={{ minWidth: 0 }}>{label}</span>
                <InfoTip titulo={label}>{info}</InfoTip>
            </div>
            <div className="dav-value" style={{ fontSize: 24, fontWeight: 700, color: 'var(--color-text)', marginTop: 8, fontFamily: '"Geist Mono", monospace', letterSpacing: '-0.01em', lineHeight: 1.15, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {value}
            </div>
            <div style={{ marginTop: 6, minHeight: 16, fontSize: 12, display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '2px 8px' }}>
                {v && <span style={{ color: v.color, fontWeight: 600 }}>{v.texto}</span>}
                {sub && <span style={{ color: 'var(--color-muted)' }}>{sub}</span>}
            </div>
        </Card>
    )
}

// ─── Tarjeta de un gráfico ─────────────────────────────────────────────────────
function Panel({ titulo, info, derecha, children }: { titulo: string; info: ReactNode; derecha?: ReactNode; children: ReactNode }) {
    return (
        <Card style={{ position: 'relative', minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, fontWeight: 600, color: 'var(--color-text)' }}>
                    {titulo}
                    <InfoTip titulo={titulo}>{info}</InfoTip>
                </div>
                {derecha}
            </div>
            {children}
        </Card>
    )
}

export function MetricasAvanzadas({ from, to, onIrACatalogo }: { from: string; to: string; onIrACatalogo?: () => void }) {
    const [abierto, setAbierto] = useState(false)
    const [datos, setDatos] = useState<ApiDashboardAvanzado | null>(null)
    const [cargando, setCargando] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [reintento, setReintento] = useState(0)
    const [cuando, setCuando] = useState<'hora' | 'semana'>('hora')

    // Recuerda si el dueño la dejó abierta. Se lee después de montar (no en el
    // useState) para que el HTML del servidor y el del cliente coincidan.
    useEffect(() => {
        try { if (localStorage.getItem(CLAVE_ABIERTO) === '1') setAbierto(true) } catch { /* sin storage: arranca cerrada */ }
    }, [])
    const alternar = () => {
        setAbierto(a => {
            try { localStorage.setItem(CLAVE_ABIERTO, a ? '0' : '1') } catch { /* idem */ }
            return !a
        })
    }

    // Se pide solo con la sección abierta, y de nuevo al cambiar el período.
    useEffect(() => {
        if (!abierto) return
        let vigente = true
        setCargando(true)
        panelGetDashboardAvanzado(from, to)
            .then(r => {
                if (!vigente) return
                if (!r || !r.actual || !r.anterior || !r.porFranja || !r.inventario) {
                    throw new ApiError(0, 'La respuesta del servidor llegó incompleta. Reintentá en un momento.')
                }
                setDatos(r); setError(null)
            })
            .catch(e => { if (vigente) setError(e instanceof ApiError ? e.message : 'No se pudieron cargar las métricas avanzadas') })
            .finally(() => { if (vigente) setCargando(false) })
        return () => { vigente = false }
    }, [abierto, from, to, reintento])

    const m = datos?.actual
    const a = datos?.anterior
    const inv = datos?.inventario
    const primeraCarga = cargando && !datos
    const sinCostos = !!m && m.coberturaCostoPct === null
    const franja = datos?.porFranja
    const nombreFranja = franja?.granularidad === 'hora' ? 'hora' : franja?.granularidad === 'semana' ? 'semana' : 'día'

    return (
        <div className="dav" style={{ marginBottom: 16 }}>
            <style>{`
                .dav-tiles { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; margin-bottom: 16px; }
                .dav-row   { display: grid; gap: 16px; margin-bottom: 16px; }
                .dav-row-a { grid-template-columns: minmax(0, 1.7fr) minmax(0, 1fr); }
                .dav-row-b { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); }
                .dav-toggle:focus-visible { outline: 2px solid var(--color-primary); outline-offset: -2px; }
                @media (max-width: 960px) {
                    .dav-tiles { grid-template-columns: repeat(2, minmax(0, 1fr)); }
                    .dav-row-a, .dav-row-b { grid-template-columns: minmax(0, 1fr); }
                }
                @media (max-width: 460px) {
                    .dav-tiles { gap: 8px; }
                    .dav-value { font-size: 19px !important; }
                }
            `}</style>

            {/* Encabezado desplegable */}
            <Card padding="md" style={{ padding: 0 }}>
                <button
                    type="button"
                    className="ds-hover dav-toggle"
                    onClick={alternar}
                    aria-expanded={abierto}
                    aria-controls="dav-contenido"
                    style={{ width: '100%', padding: '14px 20px', border: 'none', background: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, fontFamily: 'inherit', textAlign: 'left', cursor: 'pointer', borderRadius: 11 }}
                >
                    <span style={{ minWidth: 0 }}>
                        <span style={{ display: 'block', fontSize: 14, fontWeight: 600, color: 'var(--color-text)' }}>Métricas avanzadas</span>
                        <span style={{ display: 'block', fontSize: 12, color: 'var(--color-muted)', marginTop: 2 }}>Ganancia, conversión, clientes que vuelven y cuándo te compran</span>
                    </span>
                    <ChevronDown size={16} style={{ color: 'var(--color-muted)', flexShrink: 0, transform: abierto ? 'rotate(180deg)' : 'none', transition: 'transform 200ms' }} />
                </button>
            </Card>

            {abierto && (
                <div id="dav-contenido" style={{ marginTop: 12, opacity: cargando && datos ? 0.6 : 1, transition: 'opacity 150ms' }} aria-busy={cargando}>
                    {error && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', background: 'var(--color-error-bg)', border: '1px solid var(--color-border)', borderRadius: 10, marginBottom: 12 }}>
                            <span style={{ fontSize: 13, color: 'var(--color-error)', flex: 1 }}>{error}</span>
                            <Button variant="outline" size="sm" onClick={() => setReintento(n => n + 1)}>Reintentar</Button>
                        </div>
                    )}

                    {/* Métricas */}
                    <div className="dav-tiles">
                        {primeraCarga ? (
                            Array.from({ length: 9 }).map((_, i) => (
                                <Card key={i} padding="sm">
                                    <Skeleton width="55%" height={11} delay={i * 50} />
                                    <div style={{ marginTop: 12 }}><Skeleton width="70%" height={22} delay={i * 50 + 40} /></div>
                                    <div style={{ marginTop: 10 }}><Skeleton width="40%" height={10} delay={i * 50 + 80} /></div>
                                </Card>
                            ))
                        ) : m && a && inv ? (
                            <>
                                <Tile
                                    label="Ganancia estimada"
                                    value={sinCostos ? '—' : fmtMoney(m.ganancia)}
                                    variacion={sinCostos ? null : variacion(m.ganancia, a.ganancia)}
                                    sub={sinCostos ? (m.pedidos > 0 ? 'Sin costos cargados' : undefined) : m.coberturaCostoPct !== null && m.coberturaCostoPct < 100 ? `sobre el ${fmtPct(m.coberturaCostoPct)} de lo vendido` : undefined}
                                    info={<>
                                        <P primero>Lo que te queda de lo vendido en el período después de restar lo que te costó la mercadería: <strong>ingresos de productos − costo</strong>.</P>
                                        <P>Ya tiene en cuenta los descuentos y cupones que diste. No resta el envío, las comisiones de cobro, las devoluciones ni tus gastos fijos.</P>
                                        <P>Usa el <strong>costo actual</strong> de cada producto, y solo cuenta los que tienen el campo <strong>Costo</strong> cargado.</P>
                                        {m.coberturaCostoPct !== null && m.coberturaCostoPct < 100 && <Aviso>Está calculada sobre el <strong>{fmtPct(m.coberturaCostoPct)}</strong> de lo que vendiste: el resto son productos sin costo cargado.</Aviso>}
                                        {sinCostos && m.pedidos > 0 && <Aviso>Ninguno de los productos que vendiste tiene costo cargado, por eso no se puede calcular.</Aviso>}
                                    </>}
                                />
                                <Tile
                                    label="Margen"
                                    value={m.margenPct === null ? '—' : fmtPct(m.margenPct)}
                                    variacion={variacionPuntos(m.margenPct, a.margenPct)}
                                    info={<>
                                        <P primero>De cada $100 que cobrás por tus productos, cuánto es ganancia: <strong>ganancia estimada ÷ ingresos</strong>.</P>
                                        <P>Un margen de 40% quiere decir que, después de pagar la mercadería, te quedan $40 de cada $100 vendidos.</P>
                                        <P>Solo cuenta los productos con costo cargado.</P>
                                    </>}
                                />
                                <Tile
                                    label="Ganancia potencial del stock"
                                    value={inv.margenPct === null ? '—' : fmtMoney(inv.gananciaPotencial)}
                                    sub={inv.margenPct === null ? 'Sin costos cargados' : `margen ${fmtPct(inv.margenPct)}${inv.sinCosto > 0 ? ` · ${inv.sinCosto} sin costo` : ''}`}
                                    info={<>
                                        <P primero>Lo que ganarías si vendieras hoy <strong>todo el stock que tenés</strong>, a los precios actuales: (precio − costo) × unidades de cada producto.</P>
                                        <P>Es una proyección, no plata que ya cobraste. Es la misma que ves en <strong>Productos</strong> como «Ganancia estimada» y no depende del período elegido.</P>
                                        <P>Solo cuenta productos con stock y con el campo <strong>Costo</strong> cargado.</P>
                                        {inv.sinCosto > 0 && (
                                            <Aviso>
                                                Hay <strong>{inv.sinCosto} {inv.sinCosto === 1 ? 'producto con stock sin costo cargado' : 'productos con stock sin costo cargado'}</strong> que no se {inv.sinCosto === 1 ? 'está sumando' : 'están sumando'}.
                                                {onIrACatalogo && <> <button type="button" className="ds-link" onClick={onIrACatalogo} style={{ background: 'none', border: 'none', padding: 0, color: 'var(--color-primary)', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', fontSize: 'inherit' }}>Ir a Productos →</button></>}
                                            </Aviso>
                                        )}
                                    </>}
                                />
                                <Tile
                                    label="Conversión"
                                    value={m.conversionPct === null ? '—' : fmtPct(m.conversionPct)}
                                    variacion={variacionPuntos(m.conversionPct, a.conversionPct)}
                                    sub={`${m.visitas.toLocaleString('es-AR')} ${m.visitas === 1 ? 'visita' : 'visitas'}`}
                                    info={<>
                                        <P primero>De cada 100 visitas a tu tienda, cuántas terminaron en un pedido: <strong>pedidos hechos por la tienda ÷ visitas</strong>.</P>
                                        <P>No cuenta los pedidos que cargaste a mano desde el panel.</P>
                                        <P>Si tenés muchas visitas y la conversión es baja, suele ser por los precios, las fotos o algo que traba en el checkout.</P>
                                    </>}
                                />
                                <Tile
                                    label="Cancelación"
                                    value={m.tasaCancelacionPct === null ? '—' : fmtPct(m.tasaCancelacionPct)}
                                    variacion={variacionPuntos(m.tasaCancelacionPct, a.tasaCancelacionPct, true)}
                                    sub={m.pedidos + m.cancelados > 0 ? `${m.cancelados} de ${m.pedidos + m.cancelados} ${m.pedidos + m.cancelados === 1 ? 'pedido' : 'pedidos'}` : undefined}
                                    info={<>
                                        <P primero>Qué porcentaje de los pedidos del período terminó cancelado: <strong>cancelados ÷ (pedidos + cancelados)</strong>.</P>
                                        <P>Los pedidos cancelados no suman a tus ventas ni a tu ganancia.</P>
                                        <P>Si sube, revisá que lo publicado tenga stock y los tiempos de entrega que prometés.</P>
                                    </>}
                                />
                                <Tile
                                    label="Clientes que vuelven"
                                    value={m.recurrentesPct === null ? '—' : fmtPct(m.recurrentesPct)}
                                    variacion={variacionPuntos(m.recurrentesPct, a.recurrentesPct)}
                                    sub={m.compradores > 0 ? `${m.recurrentes} de ${m.compradores} ${m.compradores === 1 ? 'comprador' : 'compradores'}` : undefined}
                                    info={<>
                                        <P primero>De los clientes que compraron en el período, cuántos <strong>ya te habían comprado antes</strong> (o compraron más de una vez dentro del período).</P>
                                        <P>Mide cuánto confían en vos: un cliente que vuelve cuesta mucho menos que conseguir uno nuevo.</P>
                                        <P>No incluye los pedidos de personas sin cuenta.</P>
                                    </>}
                                />
                                <Tile
                                    label="Unidades por pedido"
                                    value={fmtNum(m.unidadesPorPedido)}
                                    variacion={variacion(m.unidadesPorPedido, a.unidadesPorPedido)}
                                    sub={`${m.unidades.toLocaleString('es-AR')} ${m.unidades === 1 ? 'unidad vendida' : 'unidades vendidas'}`}
                                    info={<>
                                        <P primero>Cuántos productos lleva en promedio cada pedido: <strong>unidades vendidas ÷ pedidos</strong>.</P>
                                        <P>Subirlo (combos, 2x1, envío gratis desde cierto monto) aumenta lo que vendés por pedido sin necesitar más clientes.</P>
                                    </>}
                                />
                                <Tile
                                    label="Devoluciones"
                                    value={fmtMoney(m.devuelto)}
                                    variacion={variacion(m.devuelto, a.devuelto, true)}
                                    sub={m.tasaDevolucionPct !== null ? `${fmtPct(m.tasaDevolucionPct)} de las ventas` : undefined}
                                    info={<>
                                        <P primero>La plata que devolviste en el período por devoluciones <strong>aprobadas</strong>, y qué porcentaje representa de tus ventas.</P>
                                        <P>Se cuenta en la fecha en que se aprobó la devolución, no en la del pedido original.</P>
                                    </>}
                                />
                                <Tile
                                    label="Descuentos otorgados"
                                    value={fmtMoney(m.descuentos)}
                                    variacion={variacion(m.descuentos, a.descuentos, true)}
                                    info={<>
                                        <P primero>El total de descuentos y cupones aplicados en los pedidos del período (sin contar los cancelados).</P>
                                        <P>Sirve para medir cuánto estás «regalando» a cambio de ventas. Compará con la variación de tus ventas para saber si lo estás recuperando.</P>
                                    </>}
                                />
                            </>
                        ) : null}
                    </div>

                    {m && datos && franja && (
                        <>
                            {/* Ventas y ganancia + clientes */}
                            <div className="dav-row dav-row-a">
                                <Panel
                                    titulo={`Ventas y ganancia por ${nombreFranja}`}
                                    info={<>
                                        <P primero>Cada columna es una {nombreFranja}. La columna entera es lo <strong>vendido</strong> (igual que «Ventas» de arriba, con el envío) y la parte sólida es la <strong>ganancia estimada</strong> que hay dentro.</P>
                                        <P>Si ves poca parte sólida, o ninguna, es porque esos productos no tienen el costo cargado.</P>
                                    </>}
                                >
                                    <ColumnChart
                                        values={franja.ventas}
                                        inner={franja.ganancia}
                                        labels={franja.labels}
                                        height={190}
                                        valueName="Ventas"
                                        innerName="Ganancia"
                                        formatValue={v => fmtMoney(v)}
                                    />
                                </Panel>

                                <Panel
                                    titulo="Clientes nuevos y que vuelven"
                                    info={<>
                                        <P primero>Los compradores del período con cuenta: <strong>vuelven</strong> los que ya te habían comprado antes (o más de una vez en el período) y <strong>nuevos</strong> los que compran por primera vez.</P>
                                        <P>Los pedidos de personas sin cuenta no entran en este gráfico.</P>
                                    </>}
                                >
                                    {datos.clientes.compradores === 0 ? (
                                        <div style={{ padding: '28px 8px', textAlign: 'center', fontSize: 13, color: 'var(--color-muted)' }}>Sin compradores con cuenta en el período.</div>
                                    ) : (
                                        <div>
                                            <div style={{ fontSize: 26, fontWeight: 700, color: 'var(--color-text)', fontFamily: '"Geist Mono", monospace', letterSpacing: '-0.01em' }}>
                                                {datos.clientes.compradores}
                                                <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-muted)', fontFamily: 'inherit', marginLeft: 6 }}>{datos.clientes.compradores === 1 ? 'comprador' : 'compradores'}</span>
                                            </div>
                                            <div style={{ display: 'flex', height: 10, borderRadius: 5, overflow: 'hidden', background: 'var(--color-surface-alt)', margin: '14px 0 12px' }} role="img" aria-label={`${datos.clientes.recurrentes} que vuelven y ${datos.clientes.nuevos} nuevos`}>
                                                <div style={{ width: `${(datos.clientes.recurrentes / datos.clientes.compradores) * 100}%`, background: 'var(--color-primary)' }} />
                                                <div style={{ flex: 1, background: 'color-mix(in srgb, var(--color-primary) 28%, transparent)' }} />
                                            </div>
                                            <Leyenda color="var(--color-primary)" texto="Vuelven" valor={datos.clientes.recurrentes} total={datos.clientes.compradores} />
                                            <Leyenda color="color-mix(in srgb, var(--color-primary) 28%, transparent)" texto="Nuevos" valor={datos.clientes.nuevos} total={datos.clientes.compradores} />
                                            {datos.clientes.sinRegistrar > 0 && (
                                                <div style={{ fontSize: 11.5, color: 'var(--color-muted)', marginTop: 10 }}>
                                                    Además, {datos.clientes.sinRegistrar} {datos.clientes.sinRegistrar === 1 ? 'pedido' : 'pedidos'} sin cuenta.
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </Panel>
                            </div>

                            {/* Cuándo compran + rentabilidad por categoría */}
                            <div className="dav-row dav-row-b">
                                <Panel
                                    titulo="Cuándo te compran"
                                    info={<>
                                        <P primero>Cantidad de pedidos según el momento del día o de la semana, en horario de Argentina.</P>
                                        <P>Sirve para elegir cuándo publicar novedades, mandar un aviso o lanzar un descuento: conviene hacerlo un poco antes de tus horas fuertes.</P>
                                    </>}
                                    derecha={
                                        <div style={{ display: 'inline-flex', background: 'var(--color-surface-alt)', borderRadius: 8, padding: 2 }} role="group" aria-label="Ver por">
                                            {([['hora', 'Hora'], ['semana', 'Día']] as const).map(([id, l]) => (
                                                <button key={id} type="button" className="ds-hover" onClick={() => setCuando(id)} aria-pressed={cuando === id}
                                                    style={{ height: 24, padding: '0 10px', borderRadius: 6, border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 12, fontWeight: cuando === id ? 600 : 500, background: cuando === id ? 'var(--color-bg)' : 'transparent', color: cuando === id ? 'var(--color-text)' : 'var(--color-muted)' }}>
                                                    {l}
                                                </button>
                                            ))}
                                        </div>
                                    }
                                >
                                    {cuando === 'hora' ? (
                                        <ColumnChart
                                            values={datos.porHora}
                                            labels={datos.porHora.map((_, h) => `${h}h`)}
                                            height={170}
                                            maxLabels={12}
                                            valueName="Pedidos"
                                            formatValue={v => `${v} ${v === 1 ? 'pedido' : 'pedidos'}`}
                                        />
                                    ) : (
                                        <ColumnChart
                                            values={ORDEN_SEMANA.map(d => datos.porDiaSemana[d])}
                                            labels={ORDEN_SEMANA.map(d => DIAS_SEMANA[d])}
                                            height={170}
                                            valueName="Pedidos"
                                            formatValue={v => `${v} ${v === 1 ? 'pedido' : 'pedidos'}`}
                                        />
                                    )}
                                </Panel>

                                <Panel
                                    titulo="Rentabilidad por categoría"
                                    info={<>
                                        <P primero>Ingresos y ganancia estimada de las categorías que más vendieron en el período (hasta 6).</P>
                                        <P>El <strong>margen</strong> es ganancia ÷ ingresos. Las categorías donde ningún producto tiene el costo cargado no muestran ganancia.</P>
                                    </>}
                                >
                                    {datos.porCategoria.length === 0 ? (
                                        <div style={{ padding: '28px 8px', textAlign: 'center', fontSize: 13, color: 'var(--color-muted)' }}>Sin ventas en el período elegido.</div>
                                    ) : (
                                        <div>
                                            {datos.porCategoria.map((c, i, arr) => (
                                                <div key={c.label} style={{ padding: '9px 0', borderBottom: i < arr.length - 1 ? '1px solid var(--color-border)' : 'none' }}>
                                                    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10 }}>
                                                        <span style={{ fontSize: 13, color: 'var(--color-text)', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.label}</span>
                                                        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text)', fontFamily: '"Geist Mono", monospace', flexShrink: 0 }}>
                                                            {c.ganancia === null ? <span style={{ fontWeight: 500, color: 'var(--color-muted)', fontFamily: 'inherit' }}>sin costo cargado</span> : fmtMoney(c.ganancia)}
                                                        </span>
                                                    </div>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 6 }}>
                                                        <div style={{ flex: 1, height: 4, borderRadius: 2, background: 'var(--color-surface-alt)', overflow: 'hidden' }}>
                                                            {c.margenPct !== null && <div style={{ width: `${Math.max(0, Math.min(100, c.margenPct))}%`, height: '100%', background: 'var(--color-primary)' }} />}
                                                        </div>
                                                        <span style={{ fontSize: 11, color: 'var(--color-muted)', fontFamily: '"Geist Mono", monospace', flexShrink: 0 }}>
                                                            {c.margenPct !== null ? `${fmtPct(c.margenPct)} de ${fmtMoney(c.ingresos)}` : fmtMoney(c.ingresos)}
                                                        </span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </Panel>
                            </div>

                            <div style={{ fontSize: 11.5, color: 'var(--color-muted)', lineHeight: 1.5 }}>
                                Son estimaciones sobre los pedidos no cancelados. La ganancia usa el costo actual de cada producto y no resta envíos, comisiones de cobro ni gastos fijos.
                            </div>
                        </>
                    )}
                </div>
            )}
        </div>
    )
}

function Leyenda({ color, texto, valor, total }: { color: string; texto: string; valor: number; total: number }) {
    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, padding: '3px 0' }}>
            <span style={{ width: 9, height: 9, borderRadius: 2, background: color, flexShrink: 0 }} />
            <span style={{ color: 'var(--color-body)', flex: 1 }}>{texto}</span>
            <span style={{ color: 'var(--color-text)', fontWeight: 600, fontFamily: '"Geist Mono", monospace' }}>{valor}</span>
            <span style={{ color: 'var(--color-muted)', fontFamily: '"Geist Mono", monospace', minWidth: 44, textAlign: 'right' }}>{fmtPct(Math.round((valor / total) * 1000) / 10)}</span>
        </div>
    )
}
