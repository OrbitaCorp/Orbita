import { useEffect, useRef, useState } from 'react'
import { ChevronDown, ExternalLink, Maximize2, Minimize2, Search, SquarePen, X } from 'lucide-react'
import { OrbiPet } from '@/components/orbi/pet/OrbiPet'
import { usePetEstado } from '@/components/orbi/pet/usePetEstado'
import { useOrbiStore } from '@/components/orbi/useOrbiStore'
import { useOrbiV2 } from '../estado/useOrbiV2'
import { useListaDeSesiones, abrirSesion } from '../estado/sesiones'
import { horaCorta, TITULO_POR_DEFECTO } from '../estado/agrupar'
import { useOrbiV2Contexto } from './contexto'
import s from '../orbi.module.css'

const MAX_EN_EL_SELECTOR = 8

/**
 * El selector de sesiones (desde el título). Se cierra con Esc o tocando
 * afuera; elegir otra sesión no limpia el borrador de la actual.
 */
function SelectorDeSesiones({ onCerrar, onVerTodas }: { onCerrar: () => void; onVerTodas: () => void }) {
  const [q, setQ] = useState('')
  const [buscado, setBuscado] = useState('')
  const caja = useRef<HTMLDivElement>(null)
  const actual = useOrbiStore(st => st.conversationId)
  const { anunciar } = useOrbiV2Contexto()
  const { fijadas, sesiones, cargando, error } = useListaDeSesiones({ activa: true, q: buscado })
  const lista = [...fijadas, ...sesiones.filter(x => !fijadas.some(f => f.id === x.id))].slice(0, MAX_EN_EL_SELECTOR)
  const ahora = new Date()

  // Búsqueda con un respiro: no un pedido por tecla.
  useEffect(() => {
    const id = setTimeout(() => setBuscado(q), 250)
    return () => clearTimeout(id)
  }, [q])

  useEffect(() => {
    const fuera = (e: PointerEvent) => { if (!caja.current?.contains(e.target as Node)) onCerrar() }
    const tecla = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.stopPropagation(); onCerrar() }
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        const opciones = Array.from(caja.current?.querySelectorAll<HTMLElement>('[data-opcion]') ?? [])
        if (!opciones.length) return
        e.preventDefault()
        const i = opciones.indexOf(document.activeElement as HTMLElement)
        const siguiente = e.key === 'ArrowDown' ? (i + 1) % opciones.length : (i <= 0 ? opciones.length - 1 : i - 1)
        opciones[siguiente].focus()
      }
    }
    // En el mismo tick que el clic que lo abrió, el pointerdown lo cerraría.
    const id = setTimeout(() => document.addEventListener('pointerdown', fuera), 0)
    document.addEventListener('keydown', tecla, true)
    return () => {
      clearTimeout(id)
      document.removeEventListener('pointerdown', fuera)
      document.removeEventListener('keydown', tecla, true)
    }
  }, [onCerrar])

  const elegir = async (id: string) => {
    onCerrar()
    if (id === actual) return
    if (!(await abrirSesion(id))) anunciar('No se pudo abrir esa conversación')
  }

  return (
    <div ref={caja} className={s.selector} role="dialog" aria-label="Conversaciones">
      <label className={s.buscar}>
        <Search aria-hidden />
        <input autoFocus value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar conversaciones" aria-label="Buscar conversaciones" />
      </label>
      {cargando && <div className={s.vacioChico}>Cargando…</div>}
      {error && <div className={s.vacioChico}>No se pudieron cargar las conversaciones.</div>}
      {!cargando && !error && lista.length === 0 && (
        <div className={s.vacioChico}>{buscado ? 'Ninguna conversación con ese título.' : 'Todavía no hay conversaciones.'}</div>
      )}
      {lista.map(x => (
        <button key={x.id} type="button" data-opcion className={s.filaSesion} aria-current={x.id === actual} onClick={() => void elegir(x.id)}>
          <span>{x.titulo ?? TITULO_POR_DEFECTO}</span>
          {x.esperandoAprobacion && <span className={s.puntoEspera} title="Orbi espera tu aprobación" aria-label="Orbi espera tu aprobación" />}
          <span className={s.hora}>{horaCorta(x.ultimaActividad, ahora)}</span>
        </button>
      ))}
      <div className={s.separador} />
      <button type="button" data-opcion className={`${s.filaSesion} ${s.verTodas}`} onClick={() => { onCerrar(); onVerTodas() }}>
        <Maximize2 aria-hidden />Ver todas en la página de Orbi
      </button>
    </div>
  )
}

/**
 * Encabezado del chat (A2). El título abre el selector de sesiones; a la
 * derecha queda reservado el lugar de la barra de uso (fase 5).
 */
export function Encabezado({ onNueva, onExpandir, onSalir, onPestana, onCerrar, conSelector = true }: {
  onNueva: () => void
  onExpandir?: () => void
  onSalir?: () => void
  onPestana?: () => void
  onCerrar?: () => void
  conSelector?: boolean
}) {
  const titulo = useOrbiV2(st => st.titulo)
  // La mascota del menú lateral: toma la forma del módulo que se está viendo
  // y pone cara de "escribiendo" mientras Orbi responde.
  const estadoPet = usePetEstado()
  const abierto = useOrbiV2(st => st.selectorAbierto)
  const setAbierto = useOrbiV2(st => st.setSelectorAbierto)
  const botonTitulo = useRef<HTMLButtonElement>(null)
  const cerrarSelector = () => {
    setAbierto(false)
    botonTitulo.current?.focus()
  }

  return (
    <header className={s.encabezado}>
      {conSelector ? (
        <button
          ref={botonTitulo}
          type="button"
          className={`${s.titulo} ${s.foco}`}
          aria-expanded={abierto}
          aria-haspopup="dialog"
          title="Cambiar de conversación"
          onClick={() => setAbierto(!abierto)}
        >
          <OrbiPet size={36} animated={false} estado={estadoPet} />
          <span>{titulo ?? 'Nueva conversación'}</span>
          <ChevronDown className={s.chevron} aria-hidden />
        </button>
      ) : (
        <div className={s.titulo} style={{ cursor: 'default' }}>
          <OrbiPet size={36} animated={false} estado={estadoPet} />
          <span>{titulo ?? 'Nueva conversación'}</span>
        </div>
      )}
      <div className={s.reservado} aria-hidden />
      <button type="button" className={s.icono} onClick={onNueva} title="Nueva conversación" aria-label="Nueva conversación"><SquarePen aria-hidden /></button>
      {onExpandir && <button type="button" className={s.icono} onClick={onExpandir} title="Expandir a página" aria-label="Expandir a página"><Maximize2 aria-hidden /></button>}
      {onSalir && <button type="button" className={s.icono} onClick={onSalir} title="Volver al panel con Orbi al costado" aria-label="Salir de la pantalla completa"><Minimize2 aria-hidden /></button>}
      {onPestana && <button type="button" className={`${s.icono} ${s.soloEscritorio}`} onClick={onPestana} title="Abrir en pestaña nueva" aria-label="Abrir en pestaña nueva"><ExternalLink aria-hidden /></button>}
      {onCerrar && <button type="button" className={s.icono} onClick={onCerrar} title="Cerrar Orbi" aria-label="Cerrar Orbi"><X aria-hidden /></button>}
      {conSelector && abierto && <SelectorDeSesiones onCerrar={cerrarSelector} onVerTodas={() => onExpandir?.()} />}
    </header>
  )
}
