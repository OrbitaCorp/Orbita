// Avanzado del panel de Turnos (DEMO visual): el catálogo del paquete. Un
// encabezado con cuántas funciones están prendidas, un buscador con filtro y,
// abajo, las funciones agrupadas por el objetivo que resuelven (llenar la
// agenda, cobrar mejor), con las que le calzan al rubro primero. Tocar una abre
// su pantalla de configuración con vista previa.
//
// La función abierta viaja por ?funcion= (replace + shallow) para que un link
// abra directo la pantalla y el botón "atrás" del navegador no la duplique;
// se conservan rubro, vista y el resto de la query.
import { useState, type ComponentType } from 'react'
import { useRouter } from 'next/router'
import { ArrowRight, Sparkles, SearchX } from 'lucide-react'
import { Encabezado } from '@/design-system/reservas/piezas'
import type { RubroTurnos } from '@/modules/turnos/datos'
import { useNegocioDemo } from '@/modules/turnos/datos/negocio'
import { pluralCliente } from '../Clientes'
import { Buscador } from '../piezasPanel'
import { FUNCIONES, GRUPOS, ACTIVAS_INICIALES, funcionPorId, grupoPorId, type Funcion, type FuncionId } from './datosAvanzado'
import { CSS_AVANZADO, BadgeEstado, Boton, Segmentado, Vacio } from './ui'
import type { PropsFuncion } from './tipos'
import Paquetes from './Paquetes'
import Membresias from './Membresias'
import PreciosHorario from './PreciosHorario'

const PANTALLAS: Record<FuncionId, ComponentType<PropsFuncion>> = {
  paquetes: Paquetes, membresias: Membresias, 'precios-horario': PreciosHorario,
}

type Filtro = 'todas' | 'recomendadas' | 'activas'

export default function AvanzadoTurnos({ rubro, avisar }: { rubro: RubroTurnos; avisar?: PropsFuncion['avisar'] }) {
  const router = useRouter()
  // El estado on/off vive en el negocio de la demo y no en cada pantalla: así
  // el hub refleja lo que se prendió adentro, y sigue prendido al ir a la agenda
  // y volver o al recargar.
  const { demo, guardar } = useNegocioDemo()
  const activas: Record<FuncionId, boolean> = { ...ACTIVAS_INICIALES, ...demo.avanzado }
  const [filtro, setFiltro] = useState<Filtro>('todas')
  const [busca, setBusca] = useState('')

  const idQuery = typeof router.query.funcion === 'string' ? router.query.funcion : undefined
  const abierta = idQuery ? funcionPorId(idQuery) : undefined

  const irA = (id?: FuncionId) => {
    const { funcion: _f, ...resto } = router.query
    void _f
    void router.replace({ pathname: router.pathname, query: id ? { ...resto, funcion: id } : resto }, undefined, { shallow: true, scroll: true })
  }
  const setActiva = (id: FuncionId) => (v: boolean) => guardar({ avanzado: { ...demo.avanzado, [id]: v } })

  if (abierta) {
    const Pantalla = PANTALLAS[abierta.id]
    // key por rubro: al cambiar de rubro la pantalla arranca con sus datos de ejemplo.
    return <Pantalla key={`${abierta.id}-${rubro.key}`} rubro={rubro} funcion={abierta} activo={activas[abierta.id]} onActivo={setActiva(abierta.id)} onVolver={() => irA()} avisar={avisar} />
  }

  const recomendadas = FUNCIONES.filter(f => f.recomendada(rubro))
  const hayRecomendadas = recomendadas.length > 0
  const nActivas = FUNCIONES.filter(f => activas[f.id]).length // lo guardado de funciones que ya no existen no cuenta
  const q = busca.trim().toLowerCase()
  const visibles = (f: Funcion) =>
    (filtro === 'todas' || (filtro === 'recomendadas' ? f.recomendada(rubro) : activas[f.id]))
    && (!q || `${f.label} ${f.desc} ${grupoPorId(f.grupo).label}`.toLowerCase().includes(q))
  const hayAlguna = FUNCIONES.some(visibles)
  const clientes = pluralCliente(rubro).toLowerCase()
  const filtros: { id: Filtro; label: string }[] = [
    { id: 'todas', label: `Todas (${FUNCIONES.length})` },
    ...(hayRecomendadas ? [{ id: 'recomendadas' as const, label: `Recomendadas (${recomendadas.length})` }] : []),
    { id: 'activas', label: `Activas (${nActivas})` },
  ]

  return (
    <div className="rv-pagina">
      <style>{CSS_AVANZADO}</style>
      <Encabezado
        rotulo="Paquete Avanzado"
        titulo="Avanzado"
        bajada={<>
          {FUNCIONES.length} herramientas para llenar huecos y cobrar por adelantado a tus {clientes}.
          {hayRecomendadas
            ? <> Las recomendadas son las que mejor le calzan a {rubro.label.toLowerCase()}.</>
            : <> Para {rubro.label.toLowerCase()} sirven todas por igual: elegí por lo que más te importa hoy.</>}
        </>}
        acciones={<span className="rv-chip rv-chip--primario" role="status"><b className="rv-num">{nActivas}</b> de {FUNCIONES.length} activas</span>}
      />

      <div className="tua-barra">
        <Buscador value={busca} onChange={setBusca} placeholder="Buscar una función" />
        <Segmentado label="Filtrar funciones" valor={filtro} onChange={setFiltro} opciones={filtros} />
      </div>

      <div aria-live="polite" className="rv-sr">{hayAlguna ? `${FUNCIONES.filter(visibles).length} funciones` : 'Ninguna función coincide'}</div>

      {GRUPOS.map(g => {
        // Recomendadas primero dentro de cada grupo; el resto conserva el orden del catálogo.
        const lista = FUNCIONES.filter(f => f.grupo === g.id && visibles(f))
          .sort((a, b) => Number(b.recomendada(rubro)) - Number(a.recomendada(rubro)))
        if (lista.length === 0) return null
        return (
          <section key={g.id} aria-labelledby={`tua-g-${g.id}`} className="tua-grupo">
            <div className="tua-grupo-cab">
              <span className="tuc-card-ico" aria-hidden><g.Icon size={16} strokeWidth={1.7} /></span>
              <div>
                <h2 id={`tua-g-${g.id}`} className="rv-h2">{g.label}</h2>
                <p className="tuc-card-bajada">{g.desc}</p>
              </div>
            </div>
            <div className="tua-hub">
              {lista.map(f => <TarjetaFuncion key={f.id} f={f} rubro={rubro} activa={activas[f.id]} onAbrir={() => irA(f.id)} />)}
            </div>
          </section>
        )
      })}

      {!hayAlguna && (
        <Vacio Icon={q ? SearchX : Sparkles}
          titulo={q ? `Nada coincide con “${busca.trim()}”` : filtro === 'activas' ? 'Todavía no prendiste ninguna función' : 'Sin recomendaciones especiales'}
          accion={<Boton variant="outline" size="sm" onClick={() => { setBusca(''); setFiltro('todas') }}>Ver todas las funciones</Boton>}>
          {q ? 'Probá con otra palabra, o mirá el catálogo completo.'
            : filtro === 'activas' ? 'Entrá a cualquiera, dejala configurada y prendela cuando quieras.'
              : `Para ${rubro.label.toLowerCase()} todas sirven por igual: elegí por el objetivo que más te importa hoy.`}
        </Vacio>
      )}
    </div>
  )
}

function TarjetaFuncion({ f, rubro, activa, onAbrir }: { f: Funcion; rubro: RubroTurnos; activa: boolean; onAbrir: () => void }) {
  const rec = f.recomendada(rubro)
  return (
    <button type="button" onClick={onAbrir} className="rv-card rv-card--accion tua-funcion" aria-label={`${f.label}. ${activa ? 'Activo' : 'Inactivo'}${rec ? `. Recomendado para ${rubro.label}` : ''}. Configurar`}>
      <span className="tua-funcion-cab">
        <span className="tuc-card-ico" aria-hidden><f.Icon size={16} strokeWidth={1.7} /></span>
        <BadgeEstado on={activa} />
      </span>
      <span className="rv-h3" style={{ display: 'block', marginTop: 14 }}>{f.label}</span>
      <span className="tua-funcion-desc" style={{ display: 'block' }}>{f.desc}</span>
      <span className="tua-funcion-pie">
        {rec
          ? <span className="rv-chip rv-chip--primario" style={{ height: 24, fontSize: 11.5 }}><Sparkles size={11} aria-hidden />Recomendado</span>
          : <span className="rv-rotulo">{grupoPorId(f.grupo).corto}</span>}
        <span className="tua-funcion-ir">Configurar<ArrowRight size={15} aria-hidden /></span>
      </span>
    </button>
  )
}
