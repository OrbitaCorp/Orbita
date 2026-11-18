// "Actualizar precios con Excel" (Catálogo). Para el dueño que cambia los
// precios todos juntos —por cotización, por inflación—: descarga el Excel,
// cambia la columna Precio y lo vuelve a subir. Antes de guardar se muestra
// qué va a cambiar, con los cambios raros arriba (un cero de más o de menos),
// y recién ahí se aplica. Solo precios: el stock se maneja en Inventario (ver
// excelPrecios.ts por qué).
import { useRef, useState, type ChangeEvent } from 'react'
import { AlertCircle, Download, FileSpreadsheet, Loader2 } from 'lucide-react'
import { Modal } from '@/design-system/components/Modal'
import { Button } from '@/design-system/components/Button'
import { ApiError, panelActualizarPrecios, type ResultadoPreciosExcel } from '@/lib/api'
import { leerExcelPrecios, cambioRaro, variacion, type LecturaPrecios } from './excelPrecios'

const fmt = (n: number) => `$ ${n.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`
const MAX_VISIBLES = 150

export function ActualizarPreciosModal({ onClose, onExportar, exportando, onGuardado }: {
    onClose: () => void
    /** Descarga el Excel con los productos (el mismo de "Exportar Excel"). */
    onExportar: () => void
    exportando: boolean
    /** Mensaje para el toast; con éxito el listado se recarga. */
    onGuardado: (mensaje: string, ok: boolean) => void
}) {
    const entrada = useRef<HTMLInputElement>(null)
    const [archivo, setArchivo] = useState('')
    const [lectura, setLectura] = useState<LecturaPrecios | null>(null)
    const [simulado, setSimulado] = useState<ResultadoPreciosExcel | null>(null)
    const [cargando, setCargando] = useState(false)
    const [guardando, setGuardando] = useState(false)
    const [error, setError] = useState('')

    async function elegir(e: ChangeEvent<HTMLInputElement>) {
        const f = e.target.files?.[0]
        e.target.value = ''
        if (!f) return
        setArchivo(f.name); setError(''); setLectura(null); setSimulado(null); setCargando(true)
        try {
            const l = await leerExcelPrecios(await f.arrayBuffer())
            setLectura(l)
            if (l.items.length > 0) setSimulado(await panelActualizarPrecios(l.items, true))
        } catch (err) {
            setError(err instanceof ApiError || err instanceof Error ? err.message : 'No se pudo leer el archivo.')
        } finally {
            setCargando(false)
        }
    }

    async function guardar() {
        if (!lectura || !simulado || simulado.cambios.length === 0) return
        setGuardando(true)
        try {
            // Se manda solo lo que cambia: lo que quedó igual no hace falta tocarlo.
            const cambia = new Set(simulado.cambios.map(c => c.variantId))
            const r = await panelActualizarPrecios(lectura.items.filter(i => cambia.has(i.variantId)), false)
            onGuardado(`Se actualizaron ${r.cambios.length} precio${r.cambios.length === 1 ? '' : 's'}`, true)
            onClose()
        } catch (err) {
            setError(err instanceof ApiError ? err.message : 'No se pudieron guardar los precios. Probá de nuevo.')
        } finally {
            setGuardando(false)
        }
    }

    // Los raros primero (para mirarlos antes de guardar), después los que más se movieron.
    const cambios = [...(simulado?.cambios ?? [])].sort((a, b) =>
        Number(cambioRaro(b.antes, b.despues)) - Number(cambioRaro(a.antes, a.despues))
        || Math.abs(variacion(b.antes, b.despues)) - Math.abs(variacion(a.antes, a.despues)))
    const raros = cambios.filter(c => cambioRaro(c.antes, c.despues)).length
    const hayCambios = cambios.length > 0

    return (
        <Modal
            isOpen
            onClose={onClose}
            title="Actualizar precios con Excel"
            maxWidth={hayCambios ? 720 : 520}
            footer={
                <>
                    <Button variant="outline" onClick={onClose} disabled={guardando}>Cancelar</Button>
                    {hayCambios && (
                        <Button variant="primary" onClick={() => void guardar()} disabled={guardando}>
                            {guardando ? 'Guardando…' : `Guardar ${cambios.length} precio${cambios.length === 1 ? '' : 's'}`}
                        </Button>
                    )}
                </>
            }
        >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16, fontSize: 14, color: 'var(--color-body)', lineHeight: 1.55 }}>
                {!simulado && (
                    <ol style={{ margin: 0, paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 6 }}>
                        <li>Descargá el Excel con tus productos: trae una fila por cada variante.</li>
                        <li>Cambiá la columna <b>Precio</b>. No toques la columna <b>Código</b>: es la que dice qué producto es.</li>
                        <li>Subilo acá. Antes de guardar te mostramos qué va a cambiar.</li>
                    </ol>
                )}

                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {!simulado && (
                        <Button variant="outline" icon={<Download size={15} />} onClick={onExportar} disabled={exportando}>
                            {exportando ? 'Descargando…' : 'Descargar Excel'}
                        </Button>
                    )}
                    <Button variant={simulado ? 'outline' : 'primary'} icon={<FileSpreadsheet size={15} />} onClick={() => entrada.current?.click()} disabled={cargando || guardando}>
                        {simulado ? 'Subir otro archivo' : 'Subir Excel con precios nuevos'}
                    </Button>
                    <input ref={entrada} type="file" accept=".xlsx" onChange={e => void elegir(e)} style={{ display: 'none' }} />
                </div>

                {cargando && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--color-muted)' }}>
                        <Loader2 size={16} className="animate-spin" /> Leyendo {archivo}…
                    </div>
                )}

                {error && (
                    <div role="alert" style={{ display: 'flex', gap: 8, alignItems: 'flex-start', color: 'var(--color-error)' }}>
                        <AlertCircle size={16} style={{ flexShrink: 0, marginTop: 2 }} /> <span>{error}</span>
                    </div>
                )}

                {lectura && simulado && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        <div style={{ fontSize: 15, color: 'var(--color-text)' }}>
                            {hayCambios
                                ? <>Vas a cambiar <b>{cambios.length} precio{cambios.length === 1 ? '' : 's'}</b>.</>
                                : <>No hay ningún precio distinto al que ya tiene la tienda.</>}
                            {simulado.sinCambios > 0 && <span style={{ color: 'var(--color-muted)' }}> {simulado.sinCambios} quedan igual.</span>}
                        </div>
                        {raros > 0 && (
                            <div style={{ color: 'var(--color-warning, #B45309)' }}>
                                {raros === 1 ? 'Hay un precio que se duplica o cae a la mitad: está' : `Hay ${raros} precios que se duplican o caen a la mitad: están`} arriba de la lista, revisalos antes de guardar.
                            </div>
                        )}
                        {simulado.noEncontradas.length > 0 && (
                            <div style={{ color: 'var(--color-muted)' }}>
                                {simulado.noEncontradas.length} fila{simulado.noEncontradas.length === 1 ? '' : 's'} con un código que no es de tu tienda (un producto borrado o un código modificado): no se tocan.
                            </div>
                        )}
                        {lectura.errores.length > 0 && (
                            <div style={{ color: 'var(--color-muted)' }}>
                                {lectura.errores.length} fila{lectura.errores.length === 1 ? '' : 's'} sin usar:{' '}
                                {lectura.errores.slice(0, 5).map(e => `fila ${e.fila} (${e.mensaje.replace(/\.$/, '').toLowerCase()})`).join(', ')}
                                {lectura.errores.length > 5 ? ` y ${lectura.errores.length - 5} más.` : '.'}
                            </div>
                        )}
                    </div>
                )}

                {lectura && !simulado && !cargando && lectura.items.length === 0 && !error && (
                    <div style={{ color: 'var(--color-muted)' }}>El archivo no trae ninguna fila con código y precio para usar.</div>
                )}

                {hayCambios && (
                    <div style={{ maxHeight: 340, overflowY: 'auto', border: '1px solid var(--color-border)', borderRadius: 10 }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                            <thead>
                                <tr style={{ position: 'sticky', top: 0, background: 'var(--color-surface)', textAlign: 'left', color: 'var(--color-muted)', fontSize: 12 }}>
                                    <th style={{ padding: '8px 12px', fontWeight: 600 }}>Producto</th>
                                    <th style={{ padding: '8px 12px', fontWeight: 600, textAlign: 'right' }}>Antes</th>
                                    <th style={{ padding: '8px 12px', fontWeight: 600, textAlign: 'right' }}>Ahora</th>
                                    <th style={{ padding: '8px 12px', fontWeight: 600, textAlign: 'right' }}>Cambio</th>
                                </tr>
                            </thead>
                            <tbody>
                                {cambios.slice(0, MAX_VISIBLES).map(c => {
                                    const raro = cambioRaro(c.antes, c.despues)
                                    const pct = variacion(c.antes, c.despues)
                                    return (
                                        <tr key={c.variantId} style={{ borderTop: '1px solid var(--color-border)' }}>
                                            <td style={{ padding: '8px 12px', color: 'var(--color-text)' }}>
                                                {c.nombre}
                                                {c.variante && <span style={{ color: 'var(--color-muted)' }}> · {c.variante}</span>}
                                            </td>
                                            <td style={{ padding: '8px 12px', textAlign: 'right', color: 'var(--color-muted)', whiteSpace: 'nowrap' }}>{fmt(c.antes)}</td>
                                            <td style={{ padding: '8px 12px', textAlign: 'right', color: 'var(--color-text)', fontWeight: 600, whiteSpace: 'nowrap' }}>{fmt(c.despues)}</td>
                                            <td style={{ padding: '8px 12px', textAlign: 'right', whiteSpace: 'nowrap', color: raro ? 'var(--color-warning, #B45309)' : 'var(--color-muted)', fontWeight: raro ? 600 : 400 }}>
                                                {pct > 0 ? '+' : ''}{pct.toLocaleString('es-AR', { maximumFractionDigits: 1 })}%
                                            </td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                        {cambios.length > MAX_VISIBLES && (
                            <div style={{ padding: '8px 12px', fontSize: 12.5, color: 'var(--color-muted)', borderTop: '1px solid var(--color-border)' }}>
                                Y {cambios.length - MAX_VISIBLES} cambios más, que también se guardan.
                            </div>
                        )}
                    </div>
                )}
            </div>
        </Modal>
    )
}
