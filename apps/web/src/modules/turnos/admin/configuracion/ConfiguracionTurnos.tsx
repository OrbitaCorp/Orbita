// Configuración del panel de Turnos (demo): columna de secciones a la
// izquierda en escritorio y tira de chips en celular (el estándar .ds-tira del
// panel), con las pestañas de un negocio de turnos. La pestaña viaja en ?tab=
// para que un link abra directo en Reglas de reserva o en Mensajes,
// conservando el resto de la query (?rubro=, ?vista=).
//
// Acá se montan, una sola vez, todas las hojas de estilo de Configuración: la
// del lenguaje de Turnos, la de las piezas compartidas y la de cada pestaña.
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/router'
import { ArrowUpRight } from 'lucide-react'
import { Toast } from '@/design-system/components/Toast'
import type { RubroTurnos } from '@/modules/turnos/datos'
import { temaDe } from '@/modules/turnos/storefront/tema'
import { EstiloTurnos } from '@/modules/turnos/_shared/orbita/estilo'
import type { EquipoConfig } from '../equipoDemo'
import { GRUPOS_NAV, TABS, subdominioDe, type TabConfig } from './datos'
import { CSS_UI_CONFIG } from './ui'
import { CSS_MINI, CSS_PLANTILLA } from './MiniSitio'
import { CSS_VISTA_PREVIA } from './VistaPrevia'
import Apariencia, { CSS_APARIENCIA } from './Apariencia'
import Negocio, { CSS_NEGOCIO } from './Negocio'
import Horarios, { CSS_HORARIOS } from './Horarios'
import Reservas, { CSS_RESERVAS } from './Reservas'
import Mensajes, { CSS_MENSAJES } from './Mensajes'
import Pagos from './Pagos'
import { Dominio, Suscripcion, EquipoPermisos, CSS_CUENTA } from './Cuenta'

const CSS_CONFIG = `
  .tuc-cfg { display: flex; align-items: flex-start; min-height: 100%; }
  .tuc-nav { width: 236px; flex-shrink: 0; position: sticky; top: 0; align-self: flex-start; box-sizing: border-box;
    max-height: calc(100vh - 104px); min-height: calc(100vh - 104px); overflow-y: auto; padding: 22px 12px 16px; display: flex; flex-direction: column; gap: 20px;
    border-right: 1px solid var(--color-border); background: var(--color-bg); scrollbar-width: thin; }
  .tuc-nav-titulo { padding: 0 10px; }
  .tuc-nav-grupo { display: flex; flex-direction: column; gap: 2px; }
  .tuc-nav-label { padding: 0 10px 8px; }
  .tuc-nav-item { position: relative; display: flex; align-items: center; gap: 10px; width: 100%; min-height: 40px; padding: 8px 10px; border-radius: 10px; border: none; cursor: pointer; text-align: left;
    font-family: inherit; font-size: 13.5px; line-height: 1.3; font-weight: 500; color: var(--color-body); background: transparent; transition: background 160ms ease, color 160ms ease; }
  .tuc-nav-item > svg { flex-shrink: 0; color: var(--color-subtle); transition: color 160ms ease, transform 240ms var(--tuo-ease, ease); }
  .tuc-nav-item::before { content: ''; position: absolute; left: -12px; top: 9px; bottom: 9px; width: 3px; border-radius: 0 3px 3px 0; background: var(--tuo-grad); transform: scaleY(0); transition: transform 240ms var(--tuo-ease, ease); }
  .tuc-nav-item[aria-current='page'] { color: var(--color-text); font-weight: 600; background: var(--tuo-grad-suave); }
  .tuc-nav-item[aria-current='page'] > svg { color: var(--color-primary); }
  .tuc-nav-item[aria-current='page']::before { transform: none; }
  .tuc-nav-pie { margin-top: auto; padding: 12px; border-radius: 14px; border: 1px solid var(--color-border); background: var(--color-surface); display: flex; flex-direction: column; gap: 6px; }
  .tuc-cuerpo { flex: 1; min-width: 0; }
  /* Solo opacidad: un transform acá rompería los position: sticky de adentro mientras dura. */
  .tuc-pane { animation: tucPane 260ms ease backwards; }
  @keyframes tucPane { from { opacity: 0; } }
  .tuc-cfg :focus-visible { outline: 2px solid var(--color-primary); outline-offset: 2px; }
  .tuc-toast { position: fixed; right: 16px; bottom: 16px; left: auto; z-index: 400; max-width: calc(100vw - 32px); animation: tucToastIn 320ms var(--tuo-ease, ease) both; }
  @keyframes tucToastIn { from { opacity: 0; transform: translateY(14px) scale(0.97); } to { opacity: 1; transform: none; } }
  @media (hover: hover) {
    .tuc-nav-item:not([aria-current='page']):hover { background: var(--color-surface-alt); color: var(--color-text); }
    .tuc-nav-item:hover > svg { transform: scale(1.1); }
  }
  @media (max-width: 768px) {
    .tuc-cfg { flex-direction: column; align-items: stretch; }
    .tuc-nav { position: sticky; top: 0; z-index: 30; width: auto; max-height: none; min-height: 0; flex-direction: row; align-items: center;
      gap: 8px; padding: 10px 12px; border-right: none; border-bottom: 1px solid var(--color-border); background: var(--color-surface);
      overflow-x: auto; overflow-y: hidden; scrollbar-width: none; width: 100% !important; max-width: 100%; min-width: 0; margin: 0 !important; }
    .tuc-nav::-webkit-scrollbar { display: none; }
    .tuc-nav-titulo, .tuc-nav-label, .tuc-nav-pie { display: none !important; }
    .tuc-nav-grupo { flex-direction: row; flex-shrink: 0; gap: 8px; }
    .tuc-nav-item { min-height: 44px !important; }
    .tuc-nav-item::before { display: none; }
    .tuc-nav-item[aria-current='page'] > svg { color: inherit; }
    .tuc-toast { left: 16px; }
  }
  @media (prefers-reduced-motion: reduce) {
    .tuc-pane, .tuc-toast { animation: none !important; }
    .tuc-nav-item::before, .tuc-nav-item > svg { transition: none; }
    .tuc-nav-item:hover > svg { transform: none; }
  }
` + CSS_UI_CONFIG + CSS_MINI + CSS_PLANTILLA + CSS_VISTA_PREVIA + CSS_APARIENCIA + CSS_NEGOCIO + CSS_HORARIOS + CSS_RESERVAS + CSS_MENSAJES + CSS_CUENTA

export default function ConfiguracionTurnos({ rubro, equipo }: { rubro: RubroTurnos; /** Los roles y las personas del panel, para Equipo y permisos. */ equipo?: EquipoConfig }) {
  const router = useRouter()
  const q = typeof router.query.tab === 'string' ? router.query.tab : ''
  const tab: TabConfig = (TABS as string[]).includes(q) ? q as TabConfig : 'apariencia'
  const plantillaPedida = typeof router.query.plantilla === 'string' ? router.query.plantilla : ''
  const navRef = useRef<HTMLElement>(null)
  const tema = temaDe(rubro)

  const ir = (t: TabConfig) => {
    if (t === tab) return
    // La plantilla pedida desde Avanzado vale para una sola entrada a Apariencia.
    const { plantilla: _p, ...resto } = router.query
    void _p
    void router.replace({ pathname: router.pathname, query: { ...resto, tab: t } }, undefined, { shallow: true, scroll: false })
    // El área que scrollea es .admin-main (no la ventana): al cambiar de pestaña se vuelve arriba.
    navRef.current?.closest('main')?.scrollTo({ top: 0 })
  }

  // En celular la tira scrollea de costado: que la pestaña activa quede a la vista.
  useEffect(() => {
    const el = navRef.current?.querySelector<HTMLElement>('[aria-current="page"]')
    const nav = navRef.current
    if (el && nav && nav.scrollWidth > nav.clientWidth) {
      const quieto = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      nav.scrollTo({ left: el.offsetLeft - 12, behavior: quieto ? 'auto' : 'smooth' })
    }
  }, [tab])

  const [toast, setToast] = useState<{ id: number; titulo: string; descripcion?: string } | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const avisar = (titulo: string, descripcion?: string) => {
    if (timer.current) clearTimeout(timer.current)
    setToast({ id: Date.now(), titulo, descripcion })
    timer.current = setTimeout(() => setToast(null), 3200)
  }
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current) }, [])

  const props = { rubro, avisar }

  return (
    <div className="tuo tuc-cfg">
      <EstiloTurnos />
      <style>{CSS_CONFIG}</style>

      <nav ref={navRef} aria-label="Secciones de configuración" className="tuc-nav ds-tira">
        <div className="tuc-nav-titulo">
          <div className="tuo-eyebrow" style={{ marginBottom: 8 }}>Tu negocio</div>
          <div className="tuo-h2" style={{ fontSize: 18 }}>Configuración</div>
          <div style={{ fontSize: 12.5, color: 'var(--color-muted)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tema.nombre} · {rubro.label}</div>
        </div>
        {GRUPOS_NAV.map((g, gi) => (
          <div key={gi} className="tuc-nav-grupo">
            {g.label && <div className="tuc-nav-label tuo-rotulo">{g.label}</div>}
            {g.items.map(it => {
              const a = it.id === tab
              return (
                <button key={it.id} type="button" onClick={() => ir(it.id)} aria-current={a ? 'page' : undefined}
                  className="tuc-nav-item ds-tira-chip" data-activa={a || undefined}>
                  <it.Icon size={16} strokeWidth={1.7} aria-hidden />
                  {it.label}
                </button>
              )
            })}
          </div>
        ))}
        <div className="tuc-nav-pie">
          <span className="tuo-chip tuo-chip--ok" style={{ alignSelf: 'flex-start', height: 22, fontSize: 11 }}>
            <span aria-hidden className="tuo-late" style={{ width: 6, height: 6, borderRadius: '50%', background: 'currentColor' }} />Sitio publicado
          </span>
          <span className="tuo-num" style={{ fontSize: 12, color: 'var(--color-body)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{subdominioDe(tema.nombre)}.orbita.site</span>
          <a className="tuc-link" style={{ alignSelf: 'flex-start', padding: 0 }} href={`/turnos-demo/negocio?rubro=${encodeURIComponent(rubro.key)}`} target="_blank" rel="noreferrer">Ver mi sitio<ArrowUpRight size={13} aria-hidden /></a>
        </div>
      </nav>

      {/* key por rubro: al cambiar de rubro cada pestaña arranca con los valores de ese rubro.
          key por pestaña: la entrada se anima en cada cambio. */}
      <div className="tuc-cuerpo" key={rubro.key}>
        <div className="tuc-pane" key={tab}>
          {tab === 'apariencia' && <Apariencia key={plantillaPedida} {...props} />}
          {tab === 'negocio' && <Negocio {...props} />}
          {tab === 'horarios' && <Horarios {...props} />}
          {tab === 'reservas' && <Reservas {...props} />}
          {tab === 'mensajes' && <Mensajes {...props} />}
          {tab === 'pagos' && <Pagos {...props} />}
          {tab === 'dominio' && <Dominio {...props} />}
          {tab === 'suscripcion' && <Suscripcion {...props} />}
          {tab === 'equipo' && <EquipoPermisos {...props} equipo={equipo} />}
        </div>
      </div>

      {toast && (
        <div key={toast.id} className="tuc-toast" aria-live="polite">
          <Toast variant="success" title={toast.titulo} description={toast.descripcion} onClose={() => setToast(null)} />
        </div>
      )}
    </div>
  )
}
