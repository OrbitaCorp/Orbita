// Avanzado del panel de Turnos (DEMO visual): la vidriera del paquete. Un
// bloque de espacio profundo cuenta qué es y cuánto tiene prendido el negocio;
// abajo, las funciones agrupadas por el objetivo que resuelven (llenar la
// agenda, fidelizar, cobrar mejor, tu imagen), con las que le calzan al rubro
// primero. Al tocar una se abre su pantalla de configuración con vista previa.
//
// La función abierta viaja por ?funcion= (replace + shallow) para que un link
// abra directo la pantalla y el botón "atrás" del navegador no la duplique;
// se conservan rubro, vista y el resto de la query.
import { useState, type ComponentType, type CSSProperties } from 'react'
import { useRouter } from 'next/router'
import { ArrowRight, Sparkles, Search, SearchX, Images } from 'lucide-react'
import { MODO_LABEL, type RubroTurnos } from '@/modules/turnos/datos'
import { EstiloTurnos } from '@/modules/turnos/_shared/orbita/estilo'
import { Estrellas, Anillos } from '@/modules/turnos/_shared/orbita/Cielo'
import { Anillo } from '@/modules/turnos/_shared/orbita/OrbitaDia'
import { pluralCliente } from '../Clientes'
import { PLANTILLAS } from '../configuracion/datos'
import {
  FUNCIONES, GRUPOS, ACTIVAS_INICIALES, funcionPorId, grupoPorId, type Funcion, type FuncionId,
} from './datosAvanzado'
import { CSS_AVANZADO, BadgeEstado, Boton, Vacio } from './ui'
import type { PropsFuncion } from './tipos'
import Paquetes from './Paquetes'
import Membresias from './Membresias'
import GiftCards from './GiftCards'
import Fidelidad from './Fidelidad'
import ListaEspera from './ListaEspera'
import TurnoFijo from './TurnoFijo'
import Formularios from './Formularios'
import Recuperar from './Recuperar'
import BotonReserva from './BotonReserva'
import PreciosHorario from './PreciosHorario'
import Resenas from './Resenas'
import Plantillas from './Plantillas'

const PANTALLAS: Record<FuncionId, ComponentType<PropsFuncion>> = {
  paquetes: Paquetes, membresias: Membresias, 'gift-cards': GiftCards, fidelidad: Fidelidad,
  'lista-espera': ListaEspera, 'turno-fijo': TurnoFijo, formularios: Formularios, recuperar: Recuperar,
  'boton-reserva': BotonReserva, 'precios-horario': PreciosHorario, resenas: Resenas, plantillas: Plantillas,
}

type Filtro = 'todas' | 'recomendadas' | 'activas'

const CSS_HUB = `
  .tua-vidriera { border-radius: 24px; padding: 34px; margin-bottom: 24px; border: 1px solid var(--color-border); display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 28px; align-items: center; }
  .tua-vidriera h1 { font-size: 34px; line-height: 1.08; max-width: 18ch; }
  .tua-vidriera-panel { display: flex; align-items: center; gap: 18px; padding: 18px 20px; border-radius: 20px; background: rgba(11,16,29,0.62); border: 1px solid var(--color-border-strong); backdrop-filter: blur(8px); }
  .tua-barra { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; margin-bottom: 26px; }
  .tua-grupo { margin-bottom: 34px; }
  .tua-grupo-cab { display: flex; align-items: center; gap: 12px; margin-bottom: 14px; }
  .tua-grupo-ico { width: 40px; height: 40px; border-radius: 12px; display: grid; place-items: center; flex-shrink: 0; color: var(--tono); background: color-mix(in srgb, var(--tono) 13%, transparent); border: 1px solid color-mix(in srgb, var(--tono) 24%, transparent); }
  .tua-hub { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(290px, 100%), 1fr)); gap: 16px; }
  .tua-hub > div { display: flex; min-width: 0; }
  .tua-funcion { display: flex; flex-direction: column; width: 100%; min-height: 218px; padding: 20px; overflow: hidden; }
  .tua-funcion-ico { width: 46px; height: 46px; border-radius: 14px; display: grid; place-items: center; flex-shrink: 0; color: var(--tono); background: color-mix(in srgb, var(--tono) 13%, transparent);
    border: 1px solid color-mix(in srgb, var(--tono) 24%, transparent); transition: transform 320ms var(--tuo-ease, ease), box-shadow 320ms ease; }
  .tua-funcion[data-on='true'] .tua-funcion-ico { box-shadow: 0 0 0 4px color-mix(in srgb, var(--tono) 10%, transparent); }
  /* El resplandor del color del grupo asoma desde la esquina recién al pasar el mouse. */
  .tua-funcion::after { content: ''; position: absolute; right: -60px; top: -60px; width: 180px; height: 180px; border-radius: 50%; background: radial-gradient(closest-side, color-mix(in srgb, var(--tono) 22%, transparent), transparent);
    opacity: 0; transition: opacity 320ms ease; pointer-events: none; }
  .tua-funcion-ir { display: inline-flex; align-items: center; gap: 5px; font-size: 13px; font-weight: 600; color: var(--color-primary); white-space: nowrap; }
  .tua-funcion-ir > svg { transition: transform 260ms var(--tuo-ease, ease); }
  .tua-funcion[data-rec='true'] { border-color: color-mix(in srgb, var(--color-primary) 32%, var(--color-border)); }
  @media (hover: hover) {
    .tua-funcion:hover::after { opacity: 1; }
    .tua-funcion:hover .tua-funcion-ico { transform: scale(1.08) rotate(-4deg); }
    .tua-funcion:hover .tua-funcion-ir > svg { transform: translateX(4px); }
  }
  @media (max-width: 900px) {
    .tua-vidriera { grid-template-columns: minmax(0, 1fr); padding: 26px; }
    .tua-vidriera h1 { font-size: 28px; }
  }
  @media (max-width: 560px) {
    .tua-vidriera { padding: 20px; border-radius: 20px; }
    .tua-vidriera h1 { font-size: 24px; }
    .tua-vidriera-panel { padding: 14px; gap: 14px; }
    .tua-barra > .tuo-buscar { max-width: none; }
    .tua-barra > .tuo-buscar > input { height: 46px; font-size: 16px; }
    .tua-barra > .tuc-seg { display: flex; width: 100%; }
    .tua-barra > .tuc-seg > button { flex: 1; padding: 0 8px; }
    .tua-funcion { min-height: 0; }
  }
  @media (prefers-reduced-motion: reduce) {
    .tua-funcion-ico, .tua-funcion-ir > svg, .tua-funcion::after { transition: none; }
    .tua-funcion:hover .tua-funcion-ico, .tua-funcion:hover .tua-funcion-ir > svg { transform: none; }
  }
`

export default function AvanzadoTurnos({ rubro }: { rubro: RubroTurnos }) {
  const router = useRouter()
  // El estado on/off vive acá y no en cada pantalla: así el hub refleja lo
  // que se prendió adentro al volver.
  const [activas, setActivas] = useState<Record<FuncionId, boolean>>(ACTIVAS_INICIALES)
  const [filtro, setFiltro] = useState<Filtro>('todas')
  const [busca, setBusca] = useState('')

  const idQuery = typeof router.query.funcion === 'string' ? router.query.funcion : undefined
  const abierta = idQuery ? funcionPorId(idQuery) : undefined

  const irA = (id?: FuncionId) => {
    const { funcion: _f, ...resto } = router.query
    void _f
    void router.replace({ pathname: router.pathname, query: id ? { ...resto, funcion: id } : resto }, undefined, { shallow: true, scroll: true })
  }
  const setActiva = (id: FuncionId) => (v: boolean) => setActivas(a => ({ ...a, [id]: v }))

  if (abierta) {
    const Pantalla = PANTALLAS[abierta.id]
    // key por rubro: al cambiar de rubro la pantalla arranca con sus datos de ejemplo.
    return <Pantalla key={`${abierta.id}-${rubro.key}`} rubro={rubro} funcion={abierta} activo={activas[abierta.id]} onActivo={setActiva(abierta.id)} onVolver={() => irA()} />
  }

  const conLlave = FUNCIONES.filter(f => !f.externa)
  const recomendadas = FUNCIONES.filter(f => f.recomendada(rubro))
  const nActivas = conLlave.filter(f => activas[f.id]).length
  const q = busca.trim().toLowerCase()
  const visibles = (f: Funcion) =>
    (filtro === 'todas' || (filtro === 'recomendadas' ? f.recomendada(rubro) : !f.externa && activas[f.id]))
    && (!q || `${f.label} ${f.desc} ${grupoPorId(f.grupo).label}`.toLowerCase().includes(q))
  const hayAlguna = FUNCIONES.some(visibles)
  const clientes = pluralCliente(rubro).toLowerCase()
  const filtros: [Filtro, string, number][] = [['todas', 'Todas', FUNCIONES.length], ['recomendadas', 'Recomendadas', recomendadas.length], ['activas', 'Activas', nActivas]]

  let orden = 0
  return (
    <div className="tuo panel-page tua-pantalla-in">
      <EstiloTurnos />
      <style>{CSS_AVANZADO + CSS_HUB}</style>

      <section className="tuo-espacio tua-vidriera tuo-entra" aria-labelledby="tua-titulo">
        <Estrellas />
        <Anillos size={560} />
        <div style={{ minWidth: 0 }}>
          <div className="tuo-eyebrow" style={{ marginBottom: 14 }}>Paquete Avanzado</div>
          <h1 id="tua-titulo" className="tuo-h1">Que tu agenda trabaje con vos</h1>
          <p className="tuo-bajada" style={{ fontSize: 15, color: 'var(--color-body)', marginTop: 12 }}>
            {FUNCIONES.length} herramientas para llenar huecos, que tus {clientes} vuelvan y cobrar por adelantado.
            Las recomendadas son las que mejor le calzan a {rubro.label.toLowerCase()} ({MODO_LABEL[rubro.modo].toLowerCase()}).
          </p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 20 }}>
            <Boton variant="primary" icon={<Sparkles size={15} aria-hidden />} onClick={() => setFiltro('recomendadas')}>Ver las {recomendadas.length} recomendadas</Boton>
            <Boton variant="outline" icon={<Images size={15} aria-hidden />} onClick={() => irA('plantillas')}>Las {PLANTILLAS.length} plantillas</Boton>
          </div>
        </div>
        <div className="tua-vidriera-panel">
          <Anillo valor={nActivas / conLlave.length} size={84} grosor={8} color="#60A5FA" label={`${nActivas} de ${conLlave.length} funciones activas`}>
            <span style={{ fontSize: 20 }}>{nActivas}</span>
          </Anillo>
          <div style={{ minWidth: 0 }}>
            <div className="tuo-rotulo">Activas ahora</div>
            <div style={{ fontFamily: 'var(--tuo-fh)', fontSize: 17, fontWeight: 600, color: 'var(--color-text)', marginTop: 4, letterSpacing: '-0.01em' }}>
              <span className="tuo-num">{nActivas}</span> de <span className="tuo-num">{conLlave.length}</span> funciones
            </div>
            <div style={{ fontSize: 12.5, color: 'var(--color-muted)', marginTop: 3, lineHeight: 1.45 }}>
              {nActivas === 0 ? 'Todavía no prendiste ninguna.' : 'Se prenden y se apagan cuando quieras.'}
            </div>
          </div>
        </div>
      </section>

      <div className="tua-barra">
        <label className="tuo-buscar" style={{ flex: '1 1 240px' }}>
          <span className="tuc-sr">Buscar una función</span>
          <Search size={16} aria-hidden />
          <input type="search" value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar una función…" />
        </label>
        <div role="radiogroup" aria-label="Filtrar funciones" className="tuc-seg">
          {filtros.map(([id, label, n]) => (
            <button key={id} type="button" role="radio" aria-checked={filtro === id} onClick={() => setFiltro(id)}>
              {label} <span className="tuo-num" style={{ opacity: 0.7, marginLeft: 3 }}>{n}</span>
            </button>
          ))}
        </div>
      </div>

      <div aria-live="polite" className="tuc-sr">{hayAlguna ? `${FUNCIONES.filter(visibles).length} funciones` : 'Ninguna función coincide'}</div>

      {GRUPOS.map(g => {
        // Recomendadas primero dentro de cada grupo; el resto conserva el orden del catálogo.
        const lista = FUNCIONES.filter(f => f.grupo === g.id && visibles(f))
          .sort((a, b) => Number(b.recomendada(rubro)) - Number(a.recomendada(rubro)))
        if (lista.length === 0) return null
        return (
          <section key={g.id} aria-labelledby={`tua-g-${g.id}`} className="tua-grupo" style={{ ['--tono' as string]: g.tono } as CSSProperties}>
            <div className="tua-grupo-cab">
              <span className="tua-grupo-ico" aria-hidden><g.Icon size={19} strokeWidth={1.7} /></span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <h2 id={`tua-g-${g.id}`} className="tuo-h2" style={{ fontSize: 18 }}>{g.label}</h2>
                <p style={{ fontSize: 13, color: 'var(--color-muted)', margin: '2px 0 0', lineHeight: 1.45 }}>{g.desc}</p>
              </div>
              <span className="tuo-chip tuo-chip--borde tuo-num" style={{ height: 24, fontSize: 11.5 }}>{lista.length}</span>
            </div>
            <div className="tua-hub">
              {lista.map(f => <TarjetaFuncion key={f.id} f={f} rubro={rubro} activa={activas[f.id]} onAbrir={() => irA(f.id)} i={orden++} />)}
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

function TarjetaFuncion({ f, rubro, activa, onAbrir, i }: { f: Funcion; rubro: RubroTurnos; activa: boolean; onAbrir: () => void; i: number }) {
  const rec = f.recomendada(rubro)
  return (
    // La entrada va en el envoltorio y la elevación en el botón: si fueran el
    // mismo elemento, la animación le ganaría al transform del hover.
    <div className="tua-entra" style={{ ['--i' as string]: Math.min(i, 10) } as CSSProperties}>
      <button
        type="button" onClick={onAbrir} className="tuo-card tuo-card--accion tua-funcion" data-on={!f.externa && activa} data-rec={rec}
        aria-label={`${f.label}. ${f.externa ? 'Galería' : activa ? 'Activo' : 'Inactivo'}${rec ? `. Recomendado para ${rubro.label}` : ''}`}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%' }}>
          <span className="tua-funcion-ico" aria-hidden><f.Icon size={22} strokeWidth={1.7} /></span>
          <span style={{ flex: 1 }} />
          {f.externa
            ? <span className="tuo-chip tuo-chip--borde" style={{ height: 24, fontSize: 11.5 }}><Images size={11} aria-hidden />{PLANTILLAS.length} diseños</span>
            : <BadgeEstado on={activa} />}
        </span>
        <span className="tuo-h2" style={{ display: 'block', marginTop: 16, fontSize: 16.5 }}>{f.label}</span>
        <span style={{ display: 'block', fontSize: 13, color: 'var(--color-muted)', marginTop: 6, lineHeight: 1.55, flex: 1 }}>{f.desc}</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginTop: 18, width: '100%' }}>
          {rec
            ? <span className="tuo-chip tuo-chip--primario" style={{ height: 24, fontSize: 11.5 }}><Sparkles size={11} aria-hidden />Recomendado para {rubro.label.toLowerCase()}</span>
            : <span className="tuo-rotulo">{grupoPorId(f.grupo).corto}</span>}
          <span style={{ flex: 1 }} />
          <span className="tua-funcion-ir">{f.externa ? 'Ver galería' : 'Configurar'}<ArrowRight size={15} aria-hidden /></span>
        </span>
      </button>
    </div>
  )
}
