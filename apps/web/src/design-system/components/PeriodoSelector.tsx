// ─── PeriodoSelector ──────────────────────────────────────────────────────────
// Selector de período con popover de rango de fechas para "Personalizado".
//
// Cuando el usuario elige "Personalizado", se abre un popover con:
//   - Sidebar de presets rápidos (Últimos 7 días, Mes actual, etc.)
//   - Calendario interactivo para elegir desde/hasta
//   - Pills de "Desde" y "Hasta" con el rango seleccionado
//
// El customRange se eleva al padre via onCustomRange — el Dashboard
// lo guarda en estado y lo manda al backend cuando llegue.

import { useState, useRef, useEffect, type ComponentType } from 'react'
import { ChevronDown, ChevronLeft, ChevronRight, Calendar } from 'lucide-react'
import { Button } from './Button'

export type Periodo = 'hoy' | 'semana' | 'mes' | 'custom'

export interface CustomRange {
    from:      Date
    to:        Date
    fromLabel: string   // ej: "11 may"
    toLabel:   string   // ej: "17 may"
}

export const PERIODOS: { id: Periodo; label: string }[] = [
    { id: 'hoy',    label: 'Hoy' },
    { id: 'semana', label: 'Esta semana' },
    { id: 'mes',    label: 'Este mes' },
    { id: 'custom', label: 'Personalizado' },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

// Formatea una fecha como "11 may"
function fmtShort(d: Date | null): string {
    if (!d) return '—'
    const meses = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic']
    return `${d.getDate()} ${meses[d.getMonth()]}`
}

// ─── DatePill ─────────────────────────────────────────────────────────────────
// Pill que muestra "Desde" o "Hasta" con la fecha seleccionada.
// Se resalta cuando está siendo editado (active).

function DatePill({ label, value, active, onClick }: {
    label:   string
    value:   string
    active:  boolean
    onClick: () => void
}) {
    return (
        <button
            className="ds-hover"
            onClick={onClick}
            style={{
                padding:    '6px 12px',
                borderRadius: 8,
                border:     `1.5px solid ${active ? 'var(--color-primary)' : 'var(--color-border)'}`,
                background: active ? 'var(--color-primary-bg)' : 'var(--color-surface)',
                fontFamily: 'inherit',
                textAlign:  'left',
                transition: 'border-color 150ms ease, background 150ms ease',
            }}
        >
            <div style={{
                fontSize:      9,
                fontWeight:    600,
                color:         'var(--color-muted)',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
            }}>
                {label}
            </div>
            <div style={{
                fontSize:    13,
                fontWeight:  600,
                color:       'var(--color-text)',
                fontFamily:  'Geist Mono, monospace',
            }}>
                {value}
            </div>
        </button>
    )
}

// ─── CalendarGrid ─────────────────────────────────────────────────────────────
// Grilla de días del mes con selección de rango.
// Los días futuros están deshabilitados.
// El rango seleccionado se resalta con fondo azul claro.
// Los extremos (from/to) tienen fondo azul sólido.

function CalendarGrid({ viewMonth, setViewMonth, from, to, hoverDate, setHoverDate, pickingEnd, onDayClick }: {
    viewMonth:     Date
    setViewMonth:  (d: Date) => void
    from:          Date
    to:            Date
    hoverDate:     Date | null
    setHoverDate:  (d: Date | null) => void
    pickingEnd:    boolean
    onDayClick:    (d: Date) => void
}) {
    const today = new Date()

    const meses = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre']
    const nombreMes = `${meses[viewMonth.getMonth()]} ${viewMonth.getFullYear()}`

    // Construye la grilla de 6 filas × 7 columnas
    // Los días vacíos al inicio son null
    const firstDay     = new Date(viewMonth.getFullYear(), viewMonth.getMonth(), 1)
    const startDayIdx  = (firstDay.getDay() + 6) % 7  // Lunes = 0
    const daysInMonth  = new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 0).getDate()
    const cells: (Date | null)[] = []

    for (let i = 0; i < startDayIdx; i++) cells.push(null)
    for (let d = 1; d <= daysInMonth; d++)
        cells.push(new Date(viewMonth.getFullYear(), viewMonth.getMonth(), d))
    while (cells.length % 7 !== 0) cells.push(null)

    const sameDay = (a: Date | null, b: Date | null) =>
        !!a && !!b &&
        a.getFullYear() === b.getFullYear() &&
        a.getMonth()    === b.getMonth() &&
        a.getDate()     === b.getDate()

    const inRange = (d: Date) => {
        // mientras el usuario está eligiendo el fin, usa hoverDate como fin provisional
        const hoverEnd = pickingEnd && hoverDate && hoverDate > from ? hoverDate : to
        return d > from && d < hoverEnd
    }

    const btnNav: React.CSSProperties = {
        width:        28,
        height:       28,
        borderRadius: 6,
        border:       'none',
        background:   'transparent',
        color:        'var(--color-body)',
        cursor:       'pointer',
        display:      'grid',
        placeItems:   'center',
    }

    return (
        <div>
            {/* Navegación mes */}
            <div style={{ display:'flex', alignItems:'center', marginBottom:8 }}>
                <button
                    className="ds-hover"
                    onClick={() => setViewMonth(new Date(viewMonth.getFullYear(), viewMonth.getMonth() - 1, 1))}
                    style={btnNav}
                >
                    <ChevronLeft size={14} strokeWidth={1.8} />
                </button>
                <div style={{
                    flex:1, textAlign:'center', fontSize:13,
                    fontWeight:600, color:'var(--color-text)', textTransform:'capitalize',
                }}>
                    {nombreMes}
                </div>
                <button
                    className="ds-hover"
                    onClick={() => setViewMonth(new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 1))}
                    style={btnNav}
                >
                    <ChevronRight size={14} strokeWidth={1.8} />
                </button>
            </div>

            {/* Headers días */}
            <div style={{ display:'grid', gridTemplateColumns:'repeat(7, 1fr)', gap:2, marginBottom:4 }}>
                {['Lu','Ma','Mi','Ju','Vi','Sá','Do'].map(d => (
                    <div key={d} style={{
                        fontSize:      10,
                        fontWeight:    600,
                        color:         'var(--color-muted)',
                        textAlign:     'center',
                        textTransform: 'uppercase',
                        letterSpacing: '0.04em',
                    }}>
                        {d}
                    </div>
                ))}
            </div>

            {/* Celdas de días */}
            <div style={{ display:'grid', gridTemplateColumns:'repeat(7, 1fr)', gap:2 }}>
                {cells.map((d, i) => {
                    if (!d) return <div key={i} />

                    const isFrom    = sameDay(d, from)
                    const isTo      = sameDay(d, to)
                    const isToday   = sameDay(d, today)
                    const isIn      = inRange(d)
                    const isFuture  = d > today

                    return (
                        <button
                            key={i}
                            disabled={isFuture}
                            onClick={() => onDayClick(d)}
                            onMouseEnter={() => setHoverDate(d)}
                            onMouseLeave={() => setHoverDate(null)}
                            style={{
                                height:       32,
                                borderRadius: 6,
                                border:       'none',
                                background:   (isFrom || isTo)
                                    ? 'var(--color-primary)'
                                    : isIn
                                    ? 'var(--color-primary-bg)'
                                    : 'transparent',
                                color: (isFrom || isTo)
                                    ? '#fff'
                                    : isFuture
                                    ? 'var(--color-muted)'
                                    : 'var(--color-text)',
                                fontSize:    12,
                                fontWeight:  (isFrom || isTo || isToday) ? 700 : 500,
                                cursor:      isFuture ? 'not-allowed' : 'pointer',
                                opacity:     isFuture ? 0.4 : 1,
                                fontFamily:  'Geist Mono, monospace',
                                outline:     isToday && !isFrom && !isTo
                                    ? '1px solid var(--color-primary)'
                                    : 'none',
                                transition: 'background 100ms ease',
                            }}
                        >
                            {d.getDate()}
                        </button>
                    )
                })}
            </div>
        </div>
    )
}

// ─── DateRangePopover ─────────────────────────────────────────────────────────
// Popover completo con presets rápidos + calendario interactivo.
// Se monta via createPortal para no quedar cortado por overflow del header.

function DateRangePopover({ customRange, onApply, onClose }: {
    customRange: CustomRange | null
    onApply:     (r: CustomRange) => void
    onClose:     () => void
}) {
    const today        = new Date()
    const initialFrom  = customRange?.from || new Date(today.getFullYear(), today.getMonth(), today.getDate() - 6)
    const initialTo    = customRange?.to   || today

    const [from,       setFrom]       = useState<Date>(initialFrom)
    const [to,         setTo]         = useState<Date>(initialTo)
    const [hoverDate,  setHoverDate]  = useState<Date | null>(null)
    const [pickingEnd, setPickingEnd] = useState(false)
    const [viewMonth,  setViewMonth]  = useState(new Date(today.getFullYear(), today.getMonth(), 1))

    const days = Math.round((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24)) + 1

    // Presets rápidos — calculan from/to desde hoy
    function applyPreset(id: string) {
        const t = new Date(today)
        let f: Date

        if (id === 'last7')  f = new Date(t.getFullYear(), t.getMonth(), t.getDate() - 6)
        else if (id === 'last14') f = new Date(t.getFullYear(), t.getMonth(), t.getDate() - 13)
        else if (id === 'last30') f = new Date(t.getFullYear(), t.getMonth(), t.getDate() - 29)
        else if (id === 'mtd')    f = new Date(t.getFullYear(), t.getMonth(), 1)
        else if (id === 'lastM') {
            f = new Date(t.getFullYear(), t.getMonth() - 1, 1)
            const lastDay = new Date(t.getFullYear(), t.getMonth(), 0)
            setFrom(f); setTo(lastDay)
            setViewMonth(new Date(f.getFullYear(), f.getMonth(), 1))
            return
        }
        else f = new Date(t.getFullYear(), 0, 1) // ytd

        setFrom(f); setTo(t)
        setViewMonth(new Date(f.getFullYear(), f.getMonth(), 1))
    }

    // Click en día del calendario
    function handleDayClick(d: Date) {
        if (!pickingEnd) {
            // primer click → setea inicio, espera el fin
            setFrom(d); setTo(d); setPickingEnd(true)
        } else {
            // segundo click → setea fin
            if (d < from) { setTo(from); setFrom(d) }
            else setTo(d)
            setPickingEnd(false)
        }
    }

    const PRESETS = [
        { id:'last7',  label:'Últimos 7 días'  },
        { id:'last14', label:'Últimos 14 días' },
        { id:'last30', label:'Últimos 30 días' },
        { id:'mtd',    label:'Mes actual'      },
        { id:'lastM',  label:'Mes pasado'      },
        { id:'ytd',    label:'Año actual'      },
    ]

    return (
        <div style={{
            position:     'absolute',
            top:          'calc(100% + 8px)',
            right:        0,
            zIndex:       50,
            background:   'var(--color-surface)',
            border:       '1px solid var(--color-border)',
            borderRadius: 14,
            boxShadow:    '0 24px 64px rgba(15,23,42,0.18), 0 4px 12px rgba(15,23,42,0.08)',
            display:      'flex',
            overflow:     'hidden',
            width:        'min(640px, calc(100vw - 32px))',
            // Animación de entrada
            animation:    'orbitaPopIn 180ms ease-out',
        }}>

            {/* Sidebar de presets */}
            <aside style={{
                background:   'var(--color-surface-alt)',
                borderRight:  '1px solid var(--color-border)',
                padding:      8,
                width:        160,
                flexShrink:   0,
            }}>
                <div style={{
                    fontSize:      10,
                    fontWeight:    600,
                    color:         'var(--color-muted)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    padding:       '8px 10px 6px',
                }}>
                    Rápidos
                </div>
                {PRESETS.map(p => (
                    <button
                        key={p.id}
                        className="ds-hover"
                        onClick={() => applyPreset(p.id)}
                        style={{
                            width:      '100%',
                            textAlign:  'left',
                            padding:    '8px 10px',
                            borderRadius: 6,
                            border:     'none',
                            background: 'transparent',
                            color:      'var(--color-body)',
                            fontSize:   13,
                            fontWeight: 500,
                            fontFamily: 'inherit',
                        }}
                    >
                        {p.label}
                    </button>
                ))}
            </aside>

            {/* Área del calendario */}
            <div style={{
                flex:           1,
                padding:        16,
                display:        'flex',
                flexDirection:  'column',
                gap:            12,
                minWidth:       0,
            }}>
                {/* Pills Desde/Hasta */}
                <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                    <DatePill
                        label="Desde"
                        value={fmtShort(from)}
                        active={!pickingEnd}
                        onClick={() => setPickingEnd(false)}
                    />
                    <ChevronRight size={14} strokeWidth={1.8} style={{ color:'var(--color-muted)' }} />
                    <DatePill
                        label="Hasta"
                        value={fmtShort(to)}
                        active={pickingEnd}
                        onClick={() => setPickingEnd(true)}
                    />
                    <span style={{
                        marginLeft:  'auto',
                        fontSize:    11,
                        color:       'var(--color-muted)',
                        fontFamily:  'Geist Mono, monospace',
                    }}>
                        {days} {days === 1 ? 'día' : 'días'}
                    </span>
                </div>

                {/* Calendario */}
                <CalendarGrid
                    viewMonth={viewMonth}
                    setViewMonth={setViewMonth}
                    from={from}
                    to={to}
                    hoverDate={hoverDate}
                    setHoverDate={setHoverDate}
                    pickingEnd={pickingEnd}
                    onDayClick={handleDayClick}
                />

                {/* Footer */}
                <div style={{
                    display:        'flex',
                    alignItems:     'center',
                    justifyContent: 'space-between',
                    paddingTop:     10,
                    borderTop:      '1px solid var(--color-border)',
                }}>
                    <span style={{ fontSize:11, color:'var(--color-muted)' }}>
                        Click en una fecha para inicio, otro para fin
                    </span>
                    <div style={{ display:'flex', gap:8 }}>
                        <Button variant="ghost" size="sm" onClick={onClose}>
                            Cancelar
                        </Button>
                        <Button
                            variant="primary"
                            size="sm"
                            onClick={() => onApply({
                                from,
                                to,
                                fromLabel: fmtShort(from),
                                toLabel:   fmtShort(to),
                            })}
                        >
                            Aplicar período
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    )
}

// ─── PeriodoSelector ──────────────────────────────────────────────────────────

interface PeriodoSelectorProps {
    value:          Periodo
    onChange:       (v: Periodo) => void
    customRange?:   CustomRange | null
    onCustomRange?: (r: CustomRange) => void
}

export function PeriodoSelector({ value, onChange, customRange, onCustomRange }: PeriodoSelectorProps) {
    const [open,        setOpen]        = useState(false)
    const wrapperRef                    = useRef<HTMLDivElement>(null)

    // Cierra el popover si el usuario clickea fuera
    useEffect(() => {
        if (!open) return
        const handler = (e: MouseEvent) => {
            if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node))
                setOpen(false)
        }
        window.addEventListener('mousedown', handler)
        return () => window.removeEventListener('mousedown', handler)
    }, [open])

    return (
        <div ref={wrapperRef} style={{ position:'relative', display:'inline-block' }}>
            <div style={{
                display:      'inline-flex',
                background:   'var(--color-surface)',
                border:       '1px solid var(--color-border)',
                borderRadius: 10,
                padding:      4,
                gap:          2,
                boxShadow:    '0 1px 3px rgba(15,23,42,0.06)',
            }}>
                {PERIODOS.map(p => {
                    const active   = value === p.id
                    const isCustom = p.id === 'custom'

                    return (
                        <button
                            key={p.id}
                            className="ds-hover"
                            onClick={() => {
                                if (isCustom) {
                                    // toggle del popover
                                    onChange('custom')
                                    setOpen(o => !o)
                                } else {
                                    onChange(p.id)
                                    setOpen(false)
                                }
                            }}
                            style={{
                                padding:      '0 14px',
                                height:       34,
                                borderRadius: 6,
                                border:       'none',
                                background:   active ? 'var(--color-bg)' : 'transparent',
                                color:        active ? 'var(--color-text)' : 'var(--color-muted)',
                                fontSize:     13,
                                fontWeight:   active ? 600 : 500,
                                cursor:       'pointer',
                                fontFamily:   'inherit',
                                boxShadow:    active ? '0 1px 2px rgba(15,23,42,0.06)' : 'none',
                                display:      'inline-flex',
                                alignItems:   'center',
                                gap:          6,
                                transition:   'background 150ms ease',
                            }}
                        >
                            {/* Ícono de calendario solo en Personalizado */}
                            {isCustom && <Calendar size={13} strokeWidth={1.5} />}

                            {/* Si está activo y tiene rango elegido, muestra el rango */}
                            {isCustom && active && customRange
                                ? `${customRange.fromLabel} → ${customRange.toLabel}`
                                : p.label
                            }

                            {/* Flecha que rota cuando el popover está abierto */}
                            {isCustom && (
                                <ChevronDown
                                    size={12}
                                    strokeWidth={1.8}
                                    style={{
                                        opacity:    0.6,
                                        transform:  open ? 'rotate(180deg)' : 'rotate(0deg)',
                                        transition: 'transform 150ms ease',
                                    }}
                                />
                            )}
                        </button>
                    )
                })}
            </div>

            {/* Popover de rango de fechas */}
            {open && (
                <DateRangePopover
                    customRange={customRange ?? null}
                    onApply={r => {
                        onCustomRange?.(r)
                        setOpen(false)
                    }}
                    onClose={() => setOpen(false)}
                />
            )}
        </div>
    )
}