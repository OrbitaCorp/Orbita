import { useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'

const DIAS  = ['Do', 'Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sá']
const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

export function fmtFull(d: Date | null): string {
    if (!d) return '—'
    return d.toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric' })
}

export function fmtChip(d: Date): string {
    return d.toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })
}

function sameDay(a: Date, b: Date) {
    return a.getDate() === b.getDate() && a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear()
}

function inRange(d: Date, a: Date | null, b: Date | null) {
    if (!a || !b) return false
    const [lo, hi] = a <= b ? [a, b] : [b, a]
    return d > lo && d < hi
}

interface GridProps {
    year: number; month: number
    selStart: Date | null; displayEnd: Date | null
    today: Date; isFutureDisabled: boolean
    onDay: (d: Date) => void
    onHover: (d: Date | null) => void
}

function MonthGrid({ year, month, selStart, displayEnd, today, isFutureDisabled, onDay, onHover }: GridProps) {
    const firstWeekday = new Date(year, month, 1).getDay()
    const daysInMonth  = new Date(year, month + 1, 0).getDate()
    const cells: (number | null)[] = [
        ...Array(firstWeekday).fill(null),
        ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
    ]
    while (cells.length % 7 !== 0) cells.push(null)

    return (
        <div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: '2px 0', marginBottom: 6 }}>
                {DIAS.map(d => (
                    <div key={d} style={{ textAlign: 'center', fontSize: 10.5, fontWeight: 700, color: 'var(--color-muted)', padding: '2px 0 6px', letterSpacing: '0.06em' }}>{d}</div>
                ))}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 2 }}>
                {cells.map((day, i) => {
                    if (!day) return <div key={i} />
                    const date   = new Date(year, month, day)
                    const isStart = selStart ? sameDay(date, selStart) : false
                    const isEnd   = displayEnd ? sameDay(date, displayEnd) : false
                    const isPivot = isStart || isEnd
                    const ranged  = inRange(date, selStart, displayEnd)
                    const isToday = sameDay(date, today)
                    const future  = isFutureDisabled && date > today

                    return (
                        <button
                            key={i}
                            className="ds-hover"
                            data-disabled={future || undefined}
                            onClick={() => !future && onDay(date)}
                            onMouseEnter={() => !future && onHover(date)}
                            onMouseLeave={() => onHover(null)}
                            style={{
                                height: 36, width: '100%', border: 'none',
                                borderRadius: isPivot ? '50%' : ranged ? 4 : 6,
                                background: isPivot
                                    ? 'var(--color-primary)'
                                    : ranged
                                    ? 'rgba(59,130,246,0.15)'
                                    : 'transparent',
                                color: isPivot ? '#fff' : future ? 'var(--color-subtle)' : 'var(--color-text)',
                                fontSize: 13, fontWeight: isPivot ? 700 : isToday ? 600 : 400,
                                cursor: future ? 'not-allowed' : 'pointer',
                                fontFamily: '"Geist Mono", monospace',
                                opacity: future ? 0.3 : 1,
                                outline: isToday && !isPivot ? '1.5px solid var(--color-primary)' : 'none',
                                outlineOffset: -2,
                                transition: 'background 100ms ease',
                                display: 'grid', placeItems: 'center',
                            }}
                        >
                            {day}
                        </button>
                    )
                })}
            </div>
        </div>
    )
}

interface Props {
    onApply:   (start: Date, end: Date | null) => void
    onClose:   () => void
    initStart?: Date | null
    initEnd?:   Date | null
    disableFuture?: boolean
}

export function DateRangePicker({ onApply, onClose, initStart, initEnd, disableFuture = true }: Props) {
    const today = new Date(); today.setHours(0, 0, 0, 0)

    // Display the two months so the current (or last-selected) month is on the right
    const baseMonth = initEnd ? initEnd.getMonth() : today.getMonth()
    const baseYear  = initEnd ? initEnd.getFullYear() : today.getFullYear()
    const [lMonth, setLMonth] = useState(baseMonth === 0 ? 11 : baseMonth - 1)
    const [lYear,  setLYear]  = useState(baseMonth === 0 ? baseYear - 1 : baseYear)

    const rMonth = (lMonth + 1) % 12
    const rYear  = lMonth === 11 ? lYear + 1 : lYear

    const [selStart, setSelStart] = useState<Date | null>(initStart ?? null)
    const [selEnd,   setSelEnd]   = useState<Date | null>(initEnd   ?? null)
    const [hover,    setHover]    = useState<Date | null>(null)
    const [phase,    setPhase]    = useState<'start' | 'end'>(initStart && !initEnd ? 'end' : 'start')

    const prevMonth = () => {
        if (lMonth === 0) { setLMonth(11); setLYear(y => y - 1) }
        else setLMonth(m => m - 1)
    }
    const nextMonth = () => {
        if (lMonth === 11) { setLMonth(0); setLYear(y => y + 1) }
        else setLMonth(m => m + 1)
    }

    const handleDay = (date: Date) => {
        if (phase === 'start' || !selStart) {
            setSelStart(date); setSelEnd(null); setPhase('end')
        } else {
            if (date < selStart) {
                setSelStart(date); setSelEnd(selStart)
            } else if (sameDay(date, selStart)) {
                setSelEnd(null); setPhase('end')
            } else {
                setSelEnd(date)
            }
            setPhase('start')
        }
    }

    // When in 'end' phase, show hover as preview end
    const displayEnd = phase === 'end' && hover ? hover : selEnd

    const applyPreset = (start: Date, end: Date) => {
        setSelStart(start); setSelEnd(end); setPhase('start')
    }

    // Los presets se anclan a HOY, no al calendario izquierdo (que arranca en el
    // mes anterior). Antes "Este mes" seleccionaba el mes pasado y "Este año" en
    // enero saltaba al año anterior.
    const hoyMes  = today.getMonth()
    const hoyAnio = today.getFullYear()
    const presets = [
        { label: 'Hoy',            fn: () => applyPreset(new Date(today), new Date(today)) },
        { label: 'Últimos 7 días', fn: () => { const s = new Date(today); s.setDate(s.getDate() - 6); applyPreset(s, new Date(today)) } },
        { label: 'Últimos 30 días',fn: () => { const s = new Date(today); s.setDate(s.getDate() - 29); applyPreset(s, new Date(today)) } },
        { label: 'Este mes',       fn: () => applyPreset(new Date(hoyAnio, hoyMes, 1), new Date(today)) },
        { label: 'Mes anterior',   fn: () => {
            const m = hoyMes === 0 ? 11 : hoyMes - 1
            const y = hoyMes === 0 ? hoyAnio - 1 : hoyAnio
            applyPreset(new Date(y, m, 1), new Date(y, m + 1, 0))
        }},
        { label: 'Este año',       fn: () => applyPreset(new Date(hoyAnio, 0, 1), new Date(today)) },
    ]

    const canApply = !!selStart

    return (
        <div style={{
            background:    'var(--color-bg)',
            border:        '1px solid var(--color-border)',
            borderRadius:  16,
            boxShadow:     '0 24px 64px rgba(0,0,0,0.28), 0 4px 20px rgba(0,0,0,0.14)',
            overflow:      'hidden',
            width:         700,
            maxWidth:      'calc(100vw - 32px)',
        }}>

            {/* ── Header: fecha desde/hasta ── */}
            <div style={{ padding: '14px 22px', borderBottom: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: 120 }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--color-muted)', letterSpacing: '0.1em', marginBottom: 3 }}>DESDE</div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: selStart ? 'var(--color-text)' : 'var(--color-subtle)', fontFamily: '"Geist Mono", monospace' }}>
                        {fmtFull(selStart)}
                    </div>
                </div>
                <div style={{ width: 28, height: 1, background: 'var(--color-border)', flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 120 }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--color-muted)', letterSpacing: '0.1em', marginBottom: 3 }}>HASTA</div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: (displayEnd ?? selEnd) ? 'var(--color-text)' : 'var(--color-subtle)', fontFamily: '"Geist Mono", monospace' }}>
                        {fmtFull(displayEnd ?? selEnd)}
                    </div>
                </div>
                <div style={{ fontSize: 11, color: 'var(--color-muted)', padding: '4px 10px', borderRadius: 6, background: 'var(--color-surface)', fontWeight: 600, flexShrink: 0, whiteSpace: 'nowrap' }}>
                    {phase === 'start' ? (selStart ? 'Clic para nuevo rango' : 'Seleccioná inicio') : 'Seleccioná fin'}
                </div>
            </div>

            {/* ── Body: presets + meses ── */}
            <div style={{ display: 'flex', minHeight: 300 }}>

                {/* Presets */}
                <div style={{ width: 156, borderRight: '1px solid var(--color-border)', padding: '14px 10px', flexShrink: 0 }}>
                    <div style={{ fontSize: 9.5, fontWeight: 700, color: 'var(--color-muted)', letterSpacing: '0.12em', marginBottom: 8, paddingLeft: 6 }}>ACCESOS RÁPIDOS</div>
                    {presets.map(p => (
                        <button key={p.label} className="ds-hover" onClick={p.fn} style={{
                            width: '100%', padding: '7px 10px', borderRadius: 7, border: 'none',
                            textAlign: 'left', background: 'transparent', color: 'var(--color-body)',
                            fontSize: 12.5, fontWeight: 500, fontFamily: 'inherit',
                            display: 'block',
                        }}>
                            {p.label}
                        </button>
                    ))}
                </div>

                {/* Calendarios */}
                <div style={{ flex: 1, padding: '16px 18px', overflow: 'hidden' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>

                        {/* Mes izquierdo */}
                        <div>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                                <button className="ds-hover" onClick={prevMonth} style={navBtn}><ChevronLeft size={14} /></button>
                                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-text)' }}>
                                    {MESES[lMonth]} {lYear}
                                </span>
                                <div style={{ width: 28 }} />
                            </div>
                            <MonthGrid
                                year={lYear} month={lMonth}
                                selStart={selStart} displayEnd={displayEnd}
                                today={today} isFutureDisabled={disableFuture}
                                onDay={handleDay} onHover={setHover}
                            />
                        </div>

                        {/* Mes derecho */}
                        <div>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                                <div style={{ width: 28 }} />
                                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-text)' }}>
                                    {MESES[rMonth]} {rYear}
                                </span>
                                <button className="ds-hover" onClick={nextMonth} style={navBtn}><ChevronRight size={14} /></button>
                            </div>
                            <MonthGrid
                                year={rYear} month={rMonth}
                                selStart={selStart} displayEnd={displayEnd}
                                today={today} isFutureDisabled={disableFuture}
                                onDay={handleDay} onHover={setHover}
                            />
                        </div>

                    </div>
                </div>
            </div>

            {/* ── Footer ── */}
            <div style={{ padding: '12px 22px', borderTop: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                <button
                    className="ds-link"
                    onClick={() => { setSelStart(null); setSelEnd(null); setPhase('start') }}
                    style={{ background: 'none', border: 'none', color: 'var(--color-muted)', fontSize: 12.5, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', padding: 0 }}
                >
                    Limpiar
                </button>
                <div style={{ display: 'flex', gap: 8 }}>
                    <button className="ds-hover" onClick={onClose} style={{ height: 36, padding: '0 18px', borderRadius: 8, border: '1px solid var(--color-border)', background: 'transparent', color: 'var(--color-text)', fontSize: 13, fontWeight: 500, fontFamily: 'inherit' }}>
                        Cancelar
                    </button>
                    <button
                        className="ds-hover"
                        onClick={() => canApply && onApply(selStart!, selEnd)}
                        disabled={!canApply}
                        style={{ height: 36, padding: '0 22px', borderRadius: 8, border: 'none', background: canApply ? 'var(--color-primary)' : 'var(--color-surface-alt)', color: canApply ? 'var(--color-on-primary)' : 'var(--color-subtle)', fontSize: 13, fontWeight: 600, cursor: canApply ? 'pointer' : 'not-allowed', fontFamily: 'inherit', transition: 'opacity 150ms' }}
                    >
                        Aplicar
                    </button>
                </div>
            </div>
        </div>
    )
}

const navBtn: React.CSSProperties = {
    width: 28, height: 28, borderRadius: 6, border: 'none', background: 'transparent',
    color: 'var(--color-muted)', cursor: 'pointer', display: 'grid', placeItems: 'center',
    flexShrink: 0,
}
