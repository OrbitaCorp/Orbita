import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/router'
import { Archive, ArchiveRestore, MoreHorizontal, Pencil, Pin, PinOff, Search, SquarePen, Trash2 } from 'lucide-react'
import { useOrbiStore } from '@/components/orbi/useOrbiStore'
import { useMediaQuery } from '@/components/orbi/useMediaQuery'
import { useDisponibilidadOrbi } from '@/components/orbi/useDisponibilidadOrbi'
import { OrbiV2Contexto } from '../piezas/contexto'
import { agruparSesiones, horaCorta, TITULO_POR_DEFECTO } from '../estado/agrupar'
import { abrirSesion, nuevaSesion, useAccionesDeSesion, useListaDeSesiones } from '../estado/sesiones'
import { useFlagOrbiV2 } from '../estado/flag'
import type { ResumenDeSesion } from '../api/sesiones'
import { OrbiChat } from './OrbiChat'
import { useAnunciador, useRutasDeOrbi } from './OrbiV2'
import s from '../orbi.module.css'

function MenuDeSesion({ sesion, onRenombrar, onBorrar }: { sesion: ResumenDeSesion; onRenombrar: () => void; onBorrar: () => void }) {
  const [abierto, setAbierto] = useState(false)
  const { editar } = useAccionesDeSesion()
  const caja = useRef<HTMLDivElement>(null)
  const boton = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!abierto) return
    caja.current?.querySelector<HTMLElement>('button')?.focus()
    const fuera = (e: PointerEvent) => { if (!caja.current?.contains(e.target as Node) && e.target !== boton.current) setAbierto(false) }
    document.addEventListener('pointerdown', fuera)
    return () => document.removeEventListener('pointerdown', fuera)
  }, [abierto])

  const cerrar = () => { setAbierto(false); boton.current?.focus() }
  const opcion = (fn: () => void) => () => { setAbierto(false); fn() }

  return (
    <div style={{ position: 'relative' }}>
      <button
        ref={boton}
        type="button"
        className={`${s.icono} ${s.menuBoton}`}
        aria-label={`Opciones de ${sesion.titulo ?? TITULO_POR_DEFECTO}`}
        aria-haspopup="menu"
        aria-expanded={abierto}
        onClick={() => setAbierto(a => !a)}
      >
        <MoreHorizontal aria-hidden />
      </button>
      {abierto && (
        <div
          ref={caja}
          role="menu"
          className={s.menu}
          style={{ right: 0, top: 34 }}
          onKeyDown={e => {
            if (e.key === 'Escape') { e.stopPropagation(); cerrar() }
            if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
              e.preventDefault()
              const items = Array.from(caja.current?.querySelectorAll<HTMLElement>('button') ?? [])
              const i = items.indexOf(document.activeElement as HTMLElement)
              items[e.key === 'ArrowDown' ? (i + 1) % items.length : (i <= 0 ? items.length - 1 : i - 1)]?.focus()
            }
          }}
        >
          <button type="button" role="menuitem" onClick={opcion(onRenombrar)}><Pencil aria-hidden />Renombrar</button>
          <button type="button" role="menuitem" onClick={opcion(() => void editar(sesion.id, { fijada: !sesion.fijada }))}>
            {sesion.fijada ? <PinOff aria-hidden /> : <Pin aria-hidden />}{sesion.fijada ? 'Desfijar' : 'Fijar'}
          </button>
          <button type="button" role="menuitem" onClick={opcion(() => void editar(sesion.id, { archivada: !sesion.archivada }))}>
            {sesion.archivada ? <ArchiveRestore aria-hidden /> : <Archive aria-hidden />}{sesion.archivada ? 'Desarchivar' : 'Archivar'}
          </button>
          <button type="button" role="menuitem" data-peligro="true" onClick={opcion(onBorrar)}><Trash2 aria-hidden />Borrar</button>
        </div>
      )}
    </div>
  )
}

function ItemDeSesion({ sesion, actual, ahora, onBorrar }: { sesion: ResumenDeSesion; actual: boolean; ahora: Date; onBorrar: () => void }) {
  const [renombrando, setRenombrando] = useState(false)
  const [titulo, setTitulo] = useState(sesion.titulo ?? '')
  const { editar } = useAccionesDeSesion()
  const guardar = () => {
    setRenombrando(false)
    const nuevo = titulo.trim()
    if (nuevo !== (sesion.titulo ?? '')) void editar(sesion.id, { titulo: nuevo })
  }
  return (
    <div className={s.itemSesion}>
      {renombrando ? (
        <input
          autoFocus
          className={s.renombrar}
          value={titulo}
          maxLength={80}
          aria-label="Nuevo título"
          onChange={e => setTitulo(e.target.value.replace(/[\r\n]/g, ' '))}
          onBlur={guardar}
          onKeyDown={e => {
            if (e.key === 'Enter') guardar()
            if (e.key === 'Escape') { e.stopPropagation(); setTitulo(sesion.titulo ?? ''); setRenombrando(false) }
          }}
        />
      ) : (
        <button type="button" className={s.filaSesion} aria-current={actual} onClick={() => { if (!actual) void abrirSesion(sesion.id) }}>
          <span>{sesion.titulo ?? TITULO_POR_DEFECTO}</span>
          {sesion.esperandoAprobacion && <span className={s.puntoEspera} title="Orbi espera tu aprobación" aria-label="Orbi espera tu aprobación" />}
          <span className={s.hora}>{horaCorta(sesion.ultimaActividad, ahora)}</span>
        </button>
      )}
      {!renombrando && <MenuDeSesion sesion={sesion} onRenombrar={() => { setTitulo(sesion.titulo ?? ''); setRenombrando(true) }} onBorrar={onBorrar} />}
    </div>
  )
}

function ConfirmarBorrado({ onCancelar, onBorrar }: { onCancelar: () => void; onBorrar: () => void }) {
  const cancelar = useRef<HTMLButtonElement>(null)
  useEffect(() => { cancelar.current?.focus() }, [])
  return (
    <div className={s.confirmar} role="presentation" onClick={onCancelar}>
      <div className={s.confirmarCaja} role="alertdialog" aria-modal="true" aria-labelledby="orbi-borrar-titulo" aria-describedby="orbi-borrar-texto"
        onClick={e => e.stopPropagation()} onKeyDown={e => { if (e.key === 'Escape') { e.stopPropagation(); onCancelar() } }}>
        <h2 id="orbi-borrar-titulo">¿Borrar la conversación?</h2>
        <p id="orbi-borrar-texto">Se borra la conversación. No se puede deshacer. Si Orbi tenía algún cambio esperando tu aprobación, se cancela.</p>
        <div style={{ display: 'flex', gap: 8 }}>
          <button ref={cancelar} type="button" className={`${s.boton} ${s.botonSecundario} ${s.foco}`} onClick={onCancelar}>Cancelar</button>
          <button type="button" className={`${s.boton} ${s.botonPeligro} ${s.foco}`} onClick={onBorrar}>Borrar</button>
        </div>
      </div>
    </div>
  )
}

function ColumnaDeSesiones() {
  const [q, setQ] = useState('')
  const [buscado, setBuscado] = useState('')
  const [archivadas, setArchivadas] = useState(false)
  const [aBorrar, setABorrar] = useState<string | null>(null)
  const actual = useOrbiStore(st => st.conversationId)
  const { borrar } = useAccionesDeSesion()
  const lista = useListaDeSesiones({ activa: true, q: buscado, archivadas })
  const ahora = new Date()
  const grupos = useMemo(() => agruparSesiones(lista.fijadas, lista.sesiones, ahora), [lista.fijadas, lista.sesiones]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const id = setTimeout(() => setBuscado(q), 250)
    return () => clearTimeout(id)
  }, [q])

  return (
    <nav className={s.columnaSesiones} aria-label="Conversaciones con Orbi">
      <div className={s.columnaArriba}>
        <button type="button" className={`${s.nueva} ${s.foco}`} onClick={nuevaSesion}><SquarePen aria-hidden />Nueva conversación</button>
        <label className={s.buscar} style={{ marginBottom: 0 }}>
          <Search aria-hidden />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar conversaciones" aria-label="Buscar conversaciones" />
        </label>
        <label className={s.filtroArchivadas}>
          <input type="checkbox" checked={archivadas} onChange={e => setArchivadas(e.target.checked)} />
          Ver archivadas
        </label>
      </div>
      <div className={s.listaSesiones}>
        {archivadas && <div className={s.notaArchivadas}>Las archivadas se borran solas a los 180 días sin actividad.</div>}
        {lista.cargando && <div className={s.vacioChico}>Cargando…</div>}
        {lista.error && <div className={s.vacioChico}>No se pudieron cargar las conversaciones.</div>}
        {!lista.cargando && !lista.error && grupos.length === 0 && (
          <div className={s.vacioChico}>{buscado ? 'Ninguna conversación con ese título.' : archivadas ? 'No hay conversaciones archivadas.' : 'Todavía no hay conversaciones.'}</div>
        )}
        {grupos.map(g => (
          <section key={g.grupo} aria-label={g.grupo}>
            <div className={s.grupo}>{g.grupo}</div>
            {g.sesiones.map(x => <ItemDeSesion key={x.id} sesion={x} actual={x.id === actual} ahora={ahora} onBorrar={() => setABorrar(x.id)} />)}
          </section>
        ))}
        {lista.hayMas && (
          <button type="button" className={`${s.filaSesion} ${s.verTodas}`} onClick={lista.cargarMas} disabled={lista.cargandoMas}>
            {lista.cargandoMas ? 'Cargando…' : 'Ver más'}
          </button>
        )}
      </div>
      {aBorrar && <ConfirmarBorrado onCancelar={() => setABorrar(null)} onBorrar={() => { const id = aBorrar; setABorrar(null); void borrar(id) }} />}
    </nav>
  )
}

/**
 * Página dedicada de Orbi (/admin/ventas/orbi?vista=chat). Desde 1024 px, las
 * sesiones a la izquierda; abajo de eso, el desplegable del título. El chat se
 * lee a 760 px como máximo.
 */
export default function OrbiPagina() {
  const router = useRouter()
  const prendido = useFlagOrbiV2()
  const ancha = useMediaQuery('(min-width: 1024px)')
  const rutas = useRutasDeOrbi()
  const { anunciar, region } = useAnunciador()
  useDisponibilidadOrbi('panel', prendido)

  const navegar = useCallback((ruta: string) => { void router.push(ruta) }, [router])
  const contexto = useMemo(() => ({ vista: 'pagina' as const, navegar, anunciar }), [navegar, anunciar])

  if (!prendido) {
    return (
      <div className={s.vacio} style={{ minHeight: '60vh' }}>
        <h2>Esta página todavía no está disponible</h2>
        <p>Orbi se abre desde el botón de la barra de arriba.</p>
      </div>
    )
  }

  return (
    <OrbiV2Contexto.Provider value={contexto}>
      {region}
      <div className={`${s.raiz} ${s.pagina}`} style={{ height: '100%' }}>
        {ancha && <ColumnaDeSesiones />}
        <div className={s.chatPagina}>
          <OrbiChat conSelector={!ancha} onAbrirManual={rutas.manual ? () => navegar(rutas.manual!) : undefined} />
        </div>
      </div>
    </OrbiV2Contexto.Provider>
  )
}
