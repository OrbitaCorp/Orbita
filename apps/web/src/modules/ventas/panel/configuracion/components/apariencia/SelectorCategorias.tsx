import { ArrowUp, ArrowDown, Plus, X } from 'lucide-react'
import type { ApiCategory } from '@/lib/api'
import { FieldLabel } from './Controles'
import { moverElemento } from './utils'

// Picker de categorías para índice/mosaico/tarjetas (ver CATEGORY_LAYOUT_MAX
// y resolverCategorias() en Inicio.tsx). Permite elegir y ordenar (1, 2, 3...)
// las categorías para determinar cuál va primero. `candidatas` ya viene filtrada por
// el caller a las que el estilo puede mostrar (todas para índice, solo con
// foto para mosaico/tarjetas). [] seleccionadas = automático (el storefront
// resuelve solo qué mostrar por defecto).
export function SelectorCategorias({ candidatas, seleccionadas, tope, necesitaFoto, onChange }: {
    candidatas: ApiCategory[]
    seleccionadas: string[]
    tope?: number
    necesitaFoto: boolean
    onChange: (ids: string[]) => void
}) {
    const candidatasMap = new Map(candidatas.map(c => [c.id, c]))
    const itemsOrdenados = seleccionadas
        .map(id => candidatasMap.get(id))
        .filter((c): c is ApiCategory => Boolean(c))

    const idsSeleccionados = new Set(itemsOrdenados.map(c => c.id))
    const noSeleccionadas = candidatas.filter(c => !idsSeleccionados.has(c.id))
    const enTope = tope !== undefined && itemsOrdenados.length >= tope

    function moveUp(index: number) {
        if (index <= 0) return
        const ids = itemsOrdenados.map(c => c.id)
        onChange(moverElemento(ids, index, index - 1))
    }

    function moveDown(index: number) {
        if (index >= itemsOrdenados.length - 1) return
        const ids = itemsOrdenados.map(c => c.id)
        onChange(moverElemento(ids, index, index + 1))
    }

    function remove(id: string) {
        onChange(itemsOrdenados.filter(c => c.id !== id).map(c => c.id))
    }

    function add(id: string) {
        if (enTope) return
        onChange([...itemsOrdenados.map(c => c.id), id])
    }

    function elegirTodas() {
        const aElegir = candidatas.slice(0, tope ?? candidatas.length)
        onChange(aElegir.map(c => c.id))
    }

    function agregarTodasRestantes() {
        if (enTope) return
        const cupo = tope !== undefined ? tope - itemsOrdenados.length : noSeleccionadas.length
        const aAgregar = noSeleccionadas.slice(0, cupo).map(c => c.id)
        onChange([...itemsOrdenados.map(c => c.id), ...aAgregar])
    }

    return (
        <div style={{ marginBottom: 18 }}>
            <FieldLabel help={necesitaFoto ? 'Solo se pueden elegir categorías con foto cargada — es lo que se ve en este estilo.' : 'Podés elegir qué categorías mostrar y ordenarlas con las flechas (1, 2, 3...) para determinar quién va primero. Sin elegir ninguna, se muestran todas automáticamente.'}>
                Qué categorías mostrar y su orden{tope !== undefined && <span style={{ color: 'var(--color-muted)', fontWeight: 400 }}> · hasta {tope}</span>}
            </FieldLabel>

            {candidatas.length === 0 ? (
                <div style={{ fontSize: 12, color: 'var(--color-muted)' }}>
                    {necesitaFoto
                        ? 'Ninguna categoría tiene foto todavía — cargá alguna en Catálogo → Categorías.'
                        : 'Todavía no tenés categorías activas.'}
                </div>
            ) : itemsOrdenados.length === 0 ? (
                // Modo automático: ninguna elegida a mano
                <>
                    <div style={{
                        padding: '12px 14px',
                        borderRadius: 8,
                        border: '1px dashed var(--color-border)',
                        background: 'var(--color-surface)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 12,
                        marginBottom: 10,
                        flexWrap: 'wrap',
                    }}>
                        <div style={{ fontSize: 12.5, color: 'var(--color-muted)', lineHeight: 1.45, minWidth: 200, flex: 1 }}>
                            <strong style={{ color: 'var(--color-text)', display: 'block', marginBottom: 2 }}>Modo automático</strong>
                            Se muestran todas las categorías{necesitaFoto ? ' con foto' : ''} en el orden por defecto. Podés determinar quién va primero y enumerarlas haciendo clic en "Elegir y ordenar todas" o agregándolas abajo.
                        </div>
                        <button
                            type="button"
                            onClick={elegirTodas}
                            className="ds-hover"
                            style={{
                                padding: '6px 12px',
                                borderRadius: 6,
                                border: '1px solid var(--color-border)',
                                background: 'var(--color-bg)',
                                color: 'var(--color-text)',
                                fontSize: 12,
                                fontWeight: 600,
                                cursor: 'pointer',
                                whiteSpace: 'nowrap',
                                fontFamily: 'inherit',
                                transition: 'border-color 150ms, color 150ms',
                            }}
                        >
                            Elegir y ordenar todas
                        </button>
                    </div>

                    <div style={{ border: '1px solid var(--color-border)', borderRadius: 8, padding: '2px 10px', maxHeight: 240, overflowY: 'auto' }}>
                        {candidatas.map((c, i) => (
                            <div key={c.id} style={{ borderBottom: i < candidatas.length - 1 ? '1px solid var(--color-border)' : 'none' }}>
                                <label
                                    className="ds-hover"
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 10,
                                        padding: '9px 4px',
                                        cursor: 'pointer',
                                    }}
                                >
                                    <input
                                        type="checkbox"
                                        checked={false}
                                        onChange={() => add(c.id)}
                                        style={{ width: 16, height: 16, flexShrink: 0, cursor: 'pointer' }}
                                    />
                                    {c.imageUrl && (
                                        <span style={{ width: 22, height: 22, borderRadius: 4, overflow: 'hidden', flexShrink: 0, border: '1px solid var(--color-border)' }}>
                                            <img src={c.imageUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                                        </span>
                                    )}
                                    <span style={{ flex: 1, minWidth: 0, fontSize: 13, color: 'var(--color-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                        {c.name}
                                    </span>
                                </label>
                            </div>
                        ))}
                    </div>

                    <div style={{ marginTop: 8, fontSize: 12, color: 'var(--color-muted)' }}>
                        Sin elegir ninguna: se muestran {tope ? `las primeras ${tope}` : 'todas'}{necesitaFoto ? ' con foto' : ''} automáticamente.
                    </div>
                </>
            ) : (
                // Modo orden manual activo: lista enumerada (1, 2, 3...)
                <>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text)' }}>
                            Orden de aparición ({itemsOrdenados.length}{tope ? ` de máx. ${tope}` : ''})
                        </span>
                        <span style={{ fontSize: 11, color: 'var(--color-muted)' }}>
                            Usá las flechas para determinar quién va primero
                        </span>
                    </div>

                    <div style={{ border: '1px solid var(--color-border)', borderRadius: 8, overflow: 'hidden', background: 'var(--color-bg)', marginBottom: 10 }}>
                        <div style={{ maxHeight: 260, overflowY: 'auto' }}>
                            {itemsOrdenados.map((c, i) => {
                                const canUp = i > 0
                                const canDown = i < itemsOrdenados.length - 1
                                return (
                                    <div
                                        key={c.id}
                                        className="ds-hover"
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: 10,
                                            padding: '8px 10px',
                                            borderBottom: i < itemsOrdenados.length - 1 ? '1px solid var(--color-border)' : 'none',
                                            background: 'var(--color-bg)',
                                        }}
                                    >
                                        {/* Badge de número / orden (1, 2, 3...) */}
                                        <span
                                            title={`Posición ${i + 1}`}
                                            style={{
                                                width: 22,
                                                height: 22,
                                                borderRadius: 6,
                                                background: 'var(--color-primary-bg)',
                                                color: 'var(--color-primary)',
                                                fontSize: 11.5,
                                                fontWeight: 700,
                                                display: 'grid',
                                                placeItems: 'center',
                                                flexShrink: 0,
                                                fontFamily: '"Geist Mono", monospace',
                                            }}
                                        >
                                            {i + 1}
                                        </span>

                                        {c.imageUrl && (
                                            <span style={{ width: 24, height: 24, borderRadius: 4, overflow: 'hidden', flexShrink: 0, border: '1px solid var(--color-border)' }}>
                                                <img src={c.imageUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                                            </span>
                                        )}

                                        <span style={{ flex: 1, minWidth: 0, fontSize: 13, fontWeight: 500, color: 'var(--color-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                            {c.name}
                                        </span>

                                        <div style={{ display: 'flex', alignItems: 'center', gap: 3, flexShrink: 0 }}>
                                            <button
                                                type="button"
                                                onClick={() => moveUp(i)}
                                                disabled={!canUp}
                                                title="Mover arriba"
                                                className="ds-hover"
                                                style={{
                                                    width: 24,
                                                    height: 24,
                                                    borderRadius: 5,
                                                    border: '1px solid var(--color-border)',
                                                    background: 'var(--color-surface)',
                                                    color: canUp ? 'var(--color-text)' : 'var(--color-subtle)',
                                                    cursor: canUp ? 'pointer' : 'not-allowed',
                                                    display: 'grid',
                                                    placeItems: 'center',
                                                    opacity: canUp ? 1 : 0.35,
                                                    transition: 'border-color 150ms, color 150ms',
                                                }}
                                            >
                                                <ArrowUp size={12} strokeWidth={2.2} />
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => moveDown(i)}
                                                disabled={!canDown}
                                                title="Mover abajo"
                                                className="ds-hover"
                                                style={{
                                                    width: 24,
                                                    height: 24,
                                                    borderRadius: 5,
                                                    border: '1px solid var(--color-border)',
                                                    background: 'var(--color-surface)',
                                                    color: canDown ? 'var(--color-text)' : 'var(--color-subtle)',
                                                    cursor: canDown ? 'pointer' : 'not-allowed',
                                                    display: 'grid',
                                                    placeItems: 'center',
                                                    opacity: canDown ? 1 : 0.35,
                                                    transition: 'border-color 150ms, color 150ms',
                                                }}
                                            >
                                                <ArrowDown size={12} strokeWidth={2.2} />
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => remove(c.id)}
                                                title="Quitar de la lista"
                                                style={{
                                                    width: 24,
                                                    height: 24,
                                                    borderRadius: 5,
                                                    border: '1px solid transparent',
                                                    background: 'transparent',
                                                    color: 'var(--color-muted)',
                                                    cursor: 'pointer',
                                                    display: 'grid',
                                                    placeItems: 'center',
                                                    marginLeft: 2,
                                                    transition: 'color 150ms, background 150ms',
                                                }}
                                                onMouseEnter={e => {
                                                    e.currentTarget.style.color = 'var(--color-error)'
                                                    e.currentTarget.style.background = 'var(--color-error-bg)'
                                                }}
                                                onMouseLeave={e => {
                                                    e.currentTarget.style.color = 'var(--color-muted)'
                                                    e.currentTarget.style.background = 'transparent'
                                                }}
                                            >
                                                <X size={13} strokeWidth={2} />
                                            </button>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    </div>

                    {noSeleccionadas.length > 0 && (
                        <div style={{ marginBottom: 10 }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 5 }}>
                                <span style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                                    Disponibles para agregar ({noSeleccionadas.length})
                                </span>
                                {!enTope && noSeleccionadas.length > 1 && (
                                    <button
                                        type="button"
                                        onClick={agregarTodasRestantes}
                                        className="ds-link"
                                        style={{ background: 'none', border: 'none', color: 'var(--color-primary)', fontSize: 11.5, cursor: 'pointer', fontFamily: 'inherit' }}
                                    >
                                        + Agregar todas
                                    </button>
                                )}
                            </div>
                            <div style={{ border: '1px solid var(--color-border)', borderRadius: 8, padding: '2px 8px', maxHeight: 150, overflowY: 'auto', background: 'var(--color-surface)' }}>
                                {noSeleccionadas.map((c, i) => {
                                    const bloqueada = enTope
                                    return (
                                        <div
                                            key={c.id}
                                            style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'space-between',
                                                gap: 10,
                                                padding: '6px 4px',
                                                borderBottom: i < noSeleccionadas.length - 1 ? '1px solid var(--color-border)' : 'none',
                                                opacity: bloqueada ? 0.45 : 1,
                                            }}
                                        >
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, flex: 1 }}>
                                                {c.imageUrl && (
                                                    <span style={{ width: 20, height: 20, borderRadius: 4, overflow: 'hidden', flexShrink: 0, border: '1px solid var(--color-border)' }}>
                                                        <img src={c.imageUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                                                    </span>
                                                )}
                                                <span style={{ fontSize: 12.5, color: 'var(--color-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                    {c.name}
                                                </span>
                                            </div>
                                            <button
                                                type="button"
                                                disabled={bloqueada}
                                                onClick={() => add(c.id)}
                                                title={bloqueada ? `Llegaste al tope de ${tope} categorías` : 'Agregar a la lista ordenada'}
                                                className="ds-hover"
                                                style={{
                                                    display: 'inline-flex',
                                                    alignItems: 'center',
                                                    gap: 3,
                                                    padding: '3px 8px',
                                                    borderRadius: 5,
                                                    border: '1px solid var(--color-border)',
                                                    background: 'var(--color-bg)',
                                                    color: bloqueada ? 'var(--color-subtle)' : 'var(--color-text)',
                                                    fontSize: 11.5,
                                                    fontWeight: 500,
                                                    cursor: bloqueada ? 'not-allowed' : 'pointer',
                                                    transition: 'border-color 150ms, color 150ms',
                                                    flexShrink: 0,
                                                }}
                                            >
                                                <Plus size={11} strokeWidth={2} />
                                                <span>Agregar</span>
                                            </button>
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    )}

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, fontSize: 12, color: 'var(--color-muted)' }}>
                        <span>
                            {itemsOrdenados.length} seleccionadas (se muestran en este orden en el home)
                        </span>
                        <button
                            type="button"
                            onClick={() => onChange([])}
                            className="ds-link"
                            style={{ background: 'none', border: 'none', color: 'var(--color-primary)', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0 }}
                        >
                            Volver a automático
                        </button>
                    </div>
                </>
            )}
        </div>
    )
}
