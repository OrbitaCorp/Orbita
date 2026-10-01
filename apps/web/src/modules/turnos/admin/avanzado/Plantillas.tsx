// Plantillas del sitio: la galería. Muestra las identidades disponibles con el
// negocio ya puesto adentro (su nombre, su foto, sus servicios), así se elige
// viendo cómo queda el sitio propio y no un ejemplo genérico.
//
// No duplica el editor: al tocar una plantilla se abre Configuración →
// Apariencia con esa plantilla pedida (?plantilla=), que es donde se ajustan
// colores, letra y fotos, y donde se guarda.
import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { ArrowRight, Palette } from 'lucide-react'
import { Volver } from '@/modules/ventas/panel/_shared/Volver'
import { cargarFuentes } from '@/modules/ventas/panel/avanzado/plantillas/piezas'
import { EstiloTurnos } from '@/modules/turnos/_shared/orbita/estilo'
import { PLANTILLAS, PLANTILLA_DE_FAMILIA, plantillasPara, plantillaRecomendada, temaConPlantilla } from '../configuracion/datos'
import { CSS_MINI, CSS_PLANTILLA, TarjetaPlantilla, datosMini } from '../configuracion/MiniSitio'
import { CSS_AVANZADO, BadgePlan, IconoOrbita, Vacio, Boton } from './ui'
import type { PropsFuncion } from './tipos'

type Filtro = 'todas' | 'recomendadas' | 'claras' | 'oscuras'

const CSS_GALERIA = `
  .tua-gal { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(300px, 100%), 1fr)); gap: 18px; }
  .tua-gal > div { display: flex; min-width: 0; }
  .tua-gal .tuc-plantilla { width: 100%; }
  .tua-gal-cab { display: flex; align-items: flex-start; gap: 16px; margin: 14px 0 22px; }
  .tua-gal-barra { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; margin-bottom: 20px; }
  .tua-gal-ir { display: inline-flex; align-items: center; gap: 5px; font-size: 12.5px; font-weight: 600; color: var(--color-primary); margin-top: 4px; }
  .tua-gal-ir > svg { transition: transform 260ms var(--tuo-ease, ease); }
  @media (hover: hover) { .tuc-plantilla:hover .tua-gal-ir > svg { transform: translateX(4px); } }
  @media (max-width: 560px) {
    .tua-gal-cab { gap: 12px; }
    .tua-gal-barra .tuo-seg { display: flex; width: 100%; overflow-x: auto; scrollbar-width: none; }
    .tua-gal-barra .tuo-seg > button { flex: 1; height: 44px; padding: 0 10px; }
    .tua-gal-barra > .tuo-btn { height: 44px; }
  }
  @media (prefers-reduced-motion: reduce) { .tua-gal-ir > svg { transition: none; } .tuc-plantilla:hover .tua-gal-ir > svg { transform: none; } }
`

export default function Plantillas({ rubro, funcion, onVolver }: PropsFuncion) {
  const router = useRouter()
  const [filtro, setFiltro] = useState<Filtro>('todas')
  useEffect(() => { cargarFuentes() }, [])

  const enUso = PLANTILLA_DE_FAMILIA[rubro.familia]
  const lista = plantillasPara(rubro).filter(p =>
    filtro === 'todas' || (filtro === 'recomendadas' ? plantillaRecomendada(p, rubro) : filtro === 'oscuras' ? p.oscuro : !p.oscuro))
  const nRec = PLANTILLAS.filter(p => plantillaRecomendada(p, rubro)).length

  const abrir = (id: string) => {
    const { funcion: _f, ...resto } = router.query
    void _f
    void router.replace({ pathname: router.pathname, query: { ...resto, vista: 'configuracion', tab: 'apariencia', plantilla: id } }, undefined, { shallow: true, scroll: true })
  }

  const filtros: [Filtro, string, number][] = [
    ['todas', 'Todas', PLANTILLAS.length], ['recomendadas', 'Para tu rubro', nRec],
    ['claras', 'Claras', PLANTILLAS.filter(p => !p.oscuro).length], ['oscuras', 'Oscuras', PLANTILLAS.filter(p => p.oscuro).length],
  ]

  return (
    <div className="tuo panel-page">
      <EstiloTurnos />
      <style>{CSS_AVANZADO + CSS_MINI + CSS_PLANTILLA + CSS_GALERIA}</style>
      <Volver a="Avanzado" onClick={onVolver} espacio="suelto" />

      <header className="tua-gal-cab tuo-entra">
        <IconoOrbita Icon={funcion.Icon} />
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <h1 className="tuo-h1">{funcion.label}</h1>
            <BadgePlan />
          </div>
          <p className="tuo-bajada">
            {PLANTILLAS.length} identidades completas para tu sitio de reservas, mostradas con tu negocio adentro.
            Elegí una y seguí en Apariencia para ajustar colores, letra y fotos.
          </p>
        </div>
      </header>

      <div className="tua-gal-barra tuo-entra" style={{ ['--i' as string]: 1 }}>
        <div className="tuo-seg" role="group" aria-label="Filtrar plantillas">
          {filtros.map(([id, label, n]) => (
            <button key={id} type="button" aria-pressed={filtro === id} onClick={() => setFiltro(id)}>
              {label} <span className="tuo-num" style={{ opacity: 0.7, marginLeft: 3 }}>{n}</span>
            </button>
          ))}
        </div>
        <span style={{ flex: 1 }} />
        <button type="button" className="tuo-btn" onClick={() => abrir(enUso)}><Palette size={15} aria-hidden /> Ir a Apariencia</button>
      </div>

      {lista.length === 0 ? (
        <Vacio Icon={Palette} titulo="Ninguna plantilla con ese filtro" accion={<Boton variant="outline" size="sm" onClick={() => setFiltro('todas')}>Ver todas</Boton>}>
          Probá con otro filtro o mirá el catálogo completo.
        </Vacio>
      ) : (
        <div role="radiogroup" aria-label="Plantillas del sitio" className="tua-gal">
          {lista.map((p, i) => {
            const tema = temaConPlantilla(rubro, p)
            return (
              <div key={p.id}>
                <TarjetaPlantilla
                  p={p} i={Math.min(i, 10)} tema={tema} datos={datosMini(rubro, tema)} activa={p.id === enUso}
                  recomendada={plantillaRecomendada(p, rubro)} onClick={() => abrir(p.id)}
                  extra={<span className="tua-gal-ir">{p.id === enUso ? 'Ajustarla en Apariencia' : 'Probarla en mi sitio'}<ArrowRight size={14} aria-hidden /></span>}
                />
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
