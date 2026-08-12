import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react'

// Tamaño del popover (fijo por diseño, ver el render más abajo) — se usa acá
// para decidir dónde abrirlo sin depender de medir el DOM después de montado
// (evitaría un salto visual o un loop de reposicionamiento).
const POPOVER_ANCHO = 264
const POPOVER_ALTO_EST = 330 // cubre el caso de 6 filas de días (peor caso)
const MARGEN_VIEWPORT = 8

const DIAS = ['Do', 'Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sá']
const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

function aISO(y: number, m: number, d: number): string {
  return `${y}-${pad(m + 1)}-${pad(d)}`
}

function isoADate(iso: string): Date | null {
  if (!iso) return null
  const [y, m, d] = iso.split('-').map(Number)
  if (!y || !m || !d) return null
  return new Date(y, m - 1, d)
}

function isoADisplay(iso: string): string {
  const d = isoADate(iso)
  if (!d) return ''
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`
}

function sameDay(a: Date, b: Date): boolean {
  return a.getDate() === b.getDate() && a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear()
}

function enRango(d: Date, a: Date | null, b: Date | null): boolean {
  if (!a || !b) return false
  return d > a && d < b
}

interface GridProps {
  anio: number
  mes: number
  inicio: Date | null
  fin: Date | null
  hover: Date | null
  today: Date
  onDia: (d: Date) => void
  onHover: (d: Date | null) => void
}

function MesGrid({ anio, mes, inicio, fin, hover, today, onDia, onHover }: GridProps) {
  const primerDiaSemana = new Date(anio, mes, 1).getDay()
  const diasEnMes = new Date(anio, mes + 1, 0).getDate()
  const celdas: (number | null)[] = [
    ...Array(primerDiaSemana).fill(null),
    ...Array.from({ length: diasEnMes }, (_, i) => i + 1),
  ]
  while (celdas.length % 7 !== 0) celdas.push(null)

  const finPreview = !fin && hover ? hover : fin

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', marginBottom: 4 }}>
        {DIAS.map((d) => (
          <div key={d} style={{ textAlign: 'center', fontSize: 10, fontWeight: 700, color: 'var(--color-muted)', padding: '2px 0 4px' }}>{d}</div>
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 2 }}>
        {celdas.map((dia, i) => {
          if (!dia) return <div key={i} />
          const fecha = new Date(anio, mes, dia)
          const esInicio = inicio ? sameDay(fecha, inicio) : false
          const esFin = finPreview ? sameDay(fecha, finPreview) : false
          const esPivote = esInicio || esFin
          const enRangoSel = enRango(fecha, inicio, finPreview)
          const esHoy = sameDay(fecha, today)
          const pasado = fecha < today

          return (
            <button
              key={i}
              type="button"
              disabled={pasado}
              onClick={() => onDia(fecha)}
              onMouseEnter={() => onHover(fecha)}
              onMouseLeave={() => onHover(null)}
              style={{
                height: 30, width: '100%', border: 'none',
                borderRadius: esPivote ? '50%' : enRangoSel ? 4 : 6,
                background: esPivote ? 'var(--color-primary)' : enRangoSel ? 'rgba(59,130,246,0.15)' : 'transparent',
                color: esPivote ? '#fff' : pasado ? 'var(--color-subtle)' : 'var(--color-text)',
                fontSize: 12.5, fontWeight: esPivote ? 700 : esHoy ? 600 : 400,
                cursor: pasado ? 'not-allowed' : 'pointer',
                fontFamily: '"Geist Mono", monospace',
                opacity: pasado ? 0.35 : 1,
                outline: esHoy && !esPivote ? '1.5px solid var(--color-primary)' : 'none',
                outlineOffset: -2,
                display: 'grid', placeItems: 'center',
              }}
            >
              {dia}
            </button>
          )
        })}
      </div>
    </div>
  )
}

interface Props {
  fechaInicio: string
  fechaFin: string
  onChangeInicio: (iso: string) => void
  onChangeFin: (iso: string) => void
  finDeshabilitado?: boolean
  error?: string
}

// Reemplaza el par de inputs de texto (uno para inicio, otro para fin) por un
// único trigger que abre un mini-calendario: primer click define el inicio
// (sin permitir fechas pasadas, una vigencia no puede empezar "ayer"), segundo
// click define el fin. Versión chica del DateRangePicker de reportes/ (ese
// tiene doble mes + accesos rápidos, pensado para filtrar rangos largos; acá
// alcanza con un mes y cerrar apenas se completa la selección).
export function RangoFechasPicker({ fechaInicio, fechaFin, onChangeInicio, onChangeFin, finDeshabilitado, error }: Props) {
  const [abierto, setAbierto] = useState(false)
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)
  const [hover, setHover] = useState<Date | null>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const popoverRef = useRef<HTMLDivElement>(null)

  const inicioDate = isoADate(fechaInicio)
  const finDate = isoADate(fechaFin)

  const [mes, setMes] = useState(() => (inicioDate ?? new Date()).getMonth())
  const [anio, setAnio] = useState(() => (inicioDate ?? new Date()).getFullYear())

  // Elige abrir abajo o arriba del trigger según dónde entre entero, y clampea
  // el horizontal — sin esto, un trigger cerca del borde inferior (o derecho)
  // de la pantalla tira el popover fuera del viewport en vez de acomodarlo.
  const actualizarPos = () => {
    const r = triggerRef.current?.getBoundingClientRect()
    if (!r) return
    const espacioAbajo = window.innerHeight - r.bottom
    const espacioArriba = r.top
    const abrirAbajo = espacioAbajo >= POPOVER_ALTO_EST + MARGEN_VIEWPORT || espacioAbajo >= espacioArriba
    const top = abrirAbajo
      ? Math.min(r.bottom + 6, window.innerHeight - POPOVER_ALTO_EST - MARGEN_VIEWPORT)
      : Math.max(MARGEN_VIEWPORT, r.top - POPOVER_ALTO_EST - 6)
    const left = Math.min(
      Math.max(MARGEN_VIEWPORT, r.left),
      Math.max(MARGEN_VIEWPORT, window.innerWidth - POPOVER_ANCHO - MARGEN_VIEWPORT),
    )
    setPos({ top, left })
  }

  useEffect(() => {
    if (!abierto) return
    actualizarPos()
    function handleClick(e: MouseEvent) {
      const target = e.target as Node
      if (triggerRef.current?.contains(target) || popoverRef.current?.contains(target)) return
      setAbierto(false)
    }
    document.addEventListener('mousedown', handleClick)
    window.addEventListener('scroll', actualizarPos, true)
    window.addEventListener('resize', actualizarPos)
    return () => {
      document.removeEventListener('mousedown', handleClick)
      window.removeEventListener('scroll', actualizarPos, true)
      window.removeEventListener('resize', actualizarPos)
    }
  }, [abierto])

  const abrir = () => {
    const base = inicioDate ?? new Date()
    setMes(base.getMonth())
    setAnio(base.getFullYear())
    setHover(null)
    setAbierto(true)
  }

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const handleDia = (fecha: Date) => {
    const iso = aISO(fecha.getFullYear(), fecha.getMonth(), fecha.getDate())

    if (finDeshabilitado) {
      onChangeInicio(iso)
      setAbierto(false)
      return
    }

    const eligiendoFin = !!inicioDate && !finDate
    if (eligiendoFin) {
      if (fecha < inicioDate!) {
        onChangeFin(fechaInicio)
        onChangeInicio(iso)
      } else {
        onChangeFin(iso)
      }
      setAbierto(false)
    } else {
      onChangeInicio(iso)
      onChangeFin('')
    }
  }

  const mesAnterior = () => {
    if (mes === 0) { setMes(11); setAnio((a) => a - 1) } else setMes((m) => m - 1)
  }
  const mesSiguiente = () => {
    if (mes === 11) { setMes(0); setAnio((a) => a + 1) } else setMes((m) => m + 1)
  }

  const textoInicio = isoADisplay(fechaInicio) || 'DD/MM/AAAA'
  const textoFin = finDeshabilitado ? 'Sin vencimiento' : (isoADisplay(fechaFin) || 'DD/MM/AAAA')
  const tieneValor = !!fechaInicio

  return (
    <>
      <button
        type="button"
        ref={triggerRef}
        onClick={abierto ? () => setAbierto(false) : abrir}
        style={{
          display: 'flex', alignItems: 'center', gap: 8,
          width: '100%', height: 40, padding: '0 12px',
          background: 'var(--color-bg)',
          border: `1px solid ${error ? 'var(--color-error)' : abierto ? 'var(--color-primary)' : 'var(--color-border)'}`,
          borderRadius: 8,
          boxShadow: abierto && !error ? '0 0 0 3px rgba(59,130,246,.12)' : 'none',
          cursor: 'pointer', fontFamily: 'inherit',
          transition: 'border-color 150ms ease, box-shadow 150ms ease',
        }}
      >
        <CalendarDays size={15} color="var(--color-muted)" style={{ flexShrink: 0 }} />
        <span style={{ fontSize: 14, color: tieneValor ? 'var(--color-text)' : 'var(--color-subtle)', fontFamily: '"Geist Mono", monospace', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {textoInicio}
        </span>
        <span style={{ color: 'var(--color-subtle)', flexShrink: 0 }}>→</span>
        <span style={{ fontSize: 14, color: (fechaFin || finDeshabilitado) ? 'var(--color-text)' : 'var(--color-subtle)', fontFamily: '"Geist Mono", monospace', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {textoFin}
        </span>
      </button>

      {abierto && pos && createPortal(
        <div
          ref={popoverRef}
          style={{
            position: 'fixed', top: pos.top, left: pos.left,
            width: POPOVER_ANCHO, zIndex: 9999,
            maxHeight: `calc(100vh - ${MARGEN_VIEWPORT * 2}px)`, overflowY: 'auto',
            background: 'var(--color-bg)', border: '1px solid var(--color-border)',
            borderRadius: 12, boxShadow: '0 12px 32px rgba(0,0,0,0.18), 0 2px 8px rgba(0,0,0,0.1)',
            padding: 14,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <button type="button" onClick={mesAnterior} style={navBtn}><ChevronLeft size={14} /></button>
            <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--color-text)' }}>{MESES[mes]} {anio}</span>
            <button type="button" onClick={mesSiguiente} style={navBtn}><ChevronRight size={14} /></button>
          </div>
          <MesGrid
            anio={anio} mes={mes}
            inicio={inicioDate} fin={finDate} hover={!finDeshabilitado && inicioDate && !finDate ? hover : null}
            today={today}
            onDia={handleDia} onHover={setHover}
          />
          <p style={{ margin: '10px 0 0', fontSize: 11, color: 'var(--color-muted)', textAlign: 'center' }}>
            {finDeshabilitado
              ? 'Elegí la fecha de inicio'
              : (!inicioDate || finDate) ? 'Elegí la fecha de inicio' : 'Ahora elegí la fecha de fin'}
          </p>
        </div>,
        document.body
      )}
    </>
  )
}

const navBtn: React.CSSProperties = {
  width: 24, height: 24, borderRadius: 6, border: 'none', background: 'transparent',
  color: 'var(--color-muted)', cursor: 'pointer', display: 'grid', placeItems: 'center', flexShrink: 0,
}
