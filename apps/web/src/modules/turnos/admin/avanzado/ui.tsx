// Piezas compartidas por las pantallas del Avanzado de Turnos: el armazón de
// cada función (volver, encabezado, el interruptor maestro, la configuración a
// la izquierda y "así lo ve tu cliente" a la derecha) y los controles chicos.
// Un solo armazón para que las tres funciones se lean igual.
//
// Todo pinta con el kit de reservas (rv-, design-system/reservas/estilo.tsx) y
// con las piezas de Configuración (tuc-, configuracion/ui.tsx), igual que el
// resto del panel. Lo único propio es el celular de la vista previa (tua-), que
// adentro se pinta con el tema del sitio del negocio (storefront/tema.ts):
// afuera es una tarjeta plana más del panel.
import { createContext, useCallback, useContext, useEffect, useState, type CSSProperties, type ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { Check, Eye, Signal, Sparkles, Wifi, BatteryFull } from 'lucide-react'
import { Encabezado, Kpi } from '@/design-system/reservas/piezas'
import type { RubroTurnos } from '@/modules/turnos/datos'
import { temaDe, variablesTema } from '@/modules/turnos/storefront/tema'
import { Llave, Volver } from '../piezasPanel'
import { Boton, FilaSwitch, Rotulo, SecCard, Segmentado, Vacio } from '../configuracion/ui'
import { cargarFuentesTurnos } from '../configuracion/datos'
import { grupoPorId, type Funcion } from './datosAvanzado'

export { Boton, FilaSwitch, SecCard, Segmentado, Vacio }

// ─── Estilos ──────────────────────────────────────────────────────────────────
// PanelTurnos monta CSS_UI_CONFIG una sola vez; acá va solo lo propio del Avanzado.
export const CSS_AVANZADO = `
  /* ── Hub: buscador y filtro en una tira, un bloque por objetivo, tarjetas que se tocan ── */
  .tua-barra { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin-bottom: 20px; }
  .tua-barra > .tu-buscar { flex: 1 1 240px; }
  .tua-grupo { margin-bottom: 26px; }
  .tua-grupo-cab { display: flex; align-items: center; gap: 12px; margin-bottom: 12px; }
  .tua-grupo-cab > div { flex: 1; min-width: 0; }
  /* El título del grupo queda suelto sobre el fondo de la página (la banda en claro). */
  .tua-grupo-cab .tuc-card-bajada { color: var(--rv-tinta-fondo, var(--color-muted)); }
  .tua-hub { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(280px, 100%), 1fr)); gap: 12px; }
  .tua-funcion { display: flex; flex-direction: column; align-items: stretch; min-height: 180px; padding: 18px; }
  .tua-funcion-cab { display: flex; align-items: center; gap: 10px; }
  .tua-funcion-cab > .rv-chip { margin-left: auto; }
  .tua-funcion-desc { font-size: 13px; line-height: 1.55; color: var(--color-muted); margin: 6px 0 0; }
  .tua-funcion-pie { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-top: auto; padding-top: 14px; }
  .tua-funcion-ir { display: inline-flex; align-items: center; gap: 4px; margin-left: auto; font-size: 13px; font-weight: 600; color: var(--chip-primary-fg); white-space: nowrap; }

  /* ── Una función: el interruptor maestro, los números y las dos columnas ── */
  .tua-maestro { display: flex; align-items: center; gap: 14px; margin-bottom: 16px; }
  .tua-maestro[data-on='true'] { border-color: var(--color-primary); }
  .tua-maestro > div { flex: 1; min-width: 0; }
  .tua-maestro b { display: block; font-size: 14px; font-weight: 600; color: var(--color-text); }
  .tua-maestro small { display: block; margin-top: 2px; font-size: 12.5px; line-height: 1.45; color: var(--color-muted); }
  .rv-kpis.tua-kpis { margin-bottom: 16px; }
  .tua-cols { display: grid; grid-template-columns: minmax(0, 1fr) minmax(300px, 380px); gap: 20px; align-items: start; }
  .tua-sticky { position: sticky; top: 16px; min-width: 0; }
  .tua-guardar { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
  .tua-2 { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }

  /* ── Renglones de una lista editable (un paquete, un plan, una franja) ── */
  .tua-item { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; padding: 10px 12px; border-radius: var(--rv-r-sm); border: 1px solid var(--color-border); background: var(--color-bg); }
  .tua-item[data-sel='true'] { border-color: var(--color-primary); background: var(--color-primary-bg); }
  .tua-item[data-sel='true'] small { color: var(--color-body); }
  .tua-item-txt { flex: 1 1 200px; min-width: 0; text-align: left; background: none; border: none; padding: 0; font: inherit; color: inherit; cursor: pointer; border-radius: 6px; }
  .tua-item-txt:focus-visible { outline: 2px solid var(--color-primary); outline-offset: 4px; }
  .tua-item-txt b { display: block; font-size: 13.5px; font-weight: 600; color: var(--color-text); }
  .tua-item-txt small { display: block; font-size: 12px; color: var(--color-muted); margin-top: 2px; }
  .tua-item-num { text-align: right; flex-shrink: 0; }
  .tua-item-num b { display: block; font-size: 14px; font-weight: 600; color: var(--color-text); }
  .tua-item-num small { display: block; font-size: 11.5px; color: var(--color-muted); margin-top: 1px; }
  .tua-bloque { padding: 12px; border-radius: var(--rv-r-sm); border: 1px solid var(--color-border); background: var(--color-bg); }
  .tua-bloque[data-sel='true'] { border-color: var(--color-primary); }
  .tua-estado { font-size: 12.5px; color: var(--color-muted); line-height: 1.45; min-height: 18px; margin-top: 8px; }
  /* El mapa de ocupación: una escala de un solo tono, del acento, que nunca pasa del 55 % para que el
     texto (siempre en tinta de texto) siga leyéndose AA en la celda más llena. */
  .tua-mapa { border-collapse: separate; border-spacing: 3px; width: 100%; min-width: 300px; font-size: 11px; }
  .tua-mapa th { font-weight: 500; color: var(--color-muted); padding: 0 0 4px; font-family: var(--rv-mono); font-size: 10.5px; letter-spacing: 0.06em; text-transform: uppercase; }
  .tua-mapa th[scope='row'] { text-align: left; padding: 0 6px 0 0; }
  .tua-mapa td { height: 32px; border-radius: 6px; text-align: center; font-family: var(--rv-mono); font-weight: 600; font-variant-numeric: tabular-nums; color: var(--color-text); background: color-mix(in srgb, var(--color-primary) var(--p, 0%), var(--color-surface-alt)); }
  .tua-mapa td[data-vacio='true'] { background: transparent; border: 1px dashed var(--color-border); color: var(--color-muted); }

  /* ── "Así lo ve tu cliente": un celular plano, con el tema del sitio adentro ── */
  .tua-vista-cab { display: flex; align-items: flex-start; gap: 10px; }
  .tua-vista-cab > div { flex: 1; min-width: 0; }
  .tua-escena { margin-top: 14px; padding: 18px 12px; border-radius: var(--rv-r-sm); border: 1px solid var(--color-border); background: var(--color-surface); display: grid; place-items: center; }
  .tua-tel { width: min(300px, 100%); padding: 8px; border-radius: 30px; border: 1px solid var(--color-border-strong); background: var(--color-bg); }
  .tua-pantalla { position: relative; border-radius: 22px; overflow: hidden; display: flex; flex-direction: column; height: clamp(460px, calc(100vh - 330px), 600px); }
  .tua-pantalla-estado { height: 34px; flex-shrink: 0; display: flex; align-items: center; justify-content: space-between; padding: 4px 18px 0; font-size: 12px; font-weight: 600; font-family: var(--rv-mono); }
  .tua-pantalla-cab { display: flex; align-items: center; gap: 9px; padding: 8px 16px 11px; flex-shrink: 0; }
  .tua-pantalla-cuerpo { flex: 1; min-height: 0; overflow-y: auto; overscroll-behavior: contain; scrollbar-width: none; display: flex; flex-direction: column; gap: 12px; }
  .tua-pantalla-cuerpo::-webkit-scrollbar { display: none; }
  .tua-pantalla-cuerpo > * { flex-shrink: 0; }
  .tua-tarjeta { border-radius: var(--tu-r2); border: 1px solid var(--color-border); background: var(--color-surface); padding: 14px; }
  .tua-eyebrow { font-size: 11px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: var(--color-primary); }
  .tua-titulo { font-family: var(--tu-fh); font-size: 21px; line-height: 1.1; font-weight: 700; color: var(--color-text); }
  /* Lo que se toca adentro del celular: el botón del sitio y un aviso que contesta qué pasaría. */
  .tua-vbtn { display: flex; align-items: center; justify-content: center; gap: 6px; width: 100%; min-height: 44px; box-sizing: border-box; padding: 0 12px; border: none; border-radius: var(--tu-r-btn, var(--tu-r)); background: var(--color-primary); color: var(--color-on-primary); font-family: inherit; font-weight: 700; font-size: 14px; line-height: 1.2; text-align: center; text-decoration: none; cursor: pointer; }
  .tua-vbtn--borde { background: transparent; color: var(--color-primary); border: 1.5px solid var(--color-primary); }
  .tua-vbtn:focus-visible { outline: 2px solid var(--color-text); outline-offset: 2px; }
  @media (hover: hover) { .tua-vbtn:hover { filter: brightness(1.06); } }
  .tua-toast-zona { position: absolute; left: 12px; right: 12px; bottom: 16px; z-index: 3; pointer-events: none; }
  .tua-toast { display: flex; align-items: flex-start; gap: 8px; padding: 10px 12px; border-radius: 10px; background: var(--color-text); color: var(--color-bg); font-size: 12px; font-weight: 600; line-height: 1.4; overflow-wrap: anywhere; }
  .tua-opc { position: relative; padding: 10px; border-radius: var(--tu-r); border: 1px solid var(--color-border); background: var(--color-surface); text-align: left; font-family: inherit; color: inherit; cursor: pointer; }
  .tua-opc[aria-checked='true'] { border-color: var(--color-primary); box-shadow: 0 0 0 1px var(--color-primary); }
  .tua-opc:focus-visible { outline: 2px solid var(--color-text); outline-offset: 2px; }

  @media (max-width: 1024px) {
    .tua-cols { grid-template-columns: minmax(0, 1fr); }
    .tua-sticky { position: static; }
  }
  @media (max-width: 768px) {
    .tua-barra > .rv-seg { width: 100%; display: flex; }
    .tua-barra > .rv-seg > button { flex: 1; }
    .tua-funcion { min-height: 0; }
    .tua-item-txt { min-height: 44px; }
    .tua-opc { min-height: 44px; }
  }
  @media (max-width: 640px) { .tua-2 { grid-template-columns: minmax(0, 1fr); } }
`

// ─── Controles ────────────────────────────────────────────────────────────────

/** Rótulo + lo que se pase + ayuda: para un select o un input armados a mano con rv-select / rv-input. */
export function CampoLibre({ label, htmlFor, ayuda, children, style }: { label: string; htmlFor?: string; ayuda?: ReactNode; children: ReactNode; style?: CSSProperties }) {
  return (
    <div style={{ marginBottom: 16, minWidth: 0, ...style }}>
      <Rotulo htmlFor={htmlFor}>{label}</Rotulo>
      {children}
      {ayuda && <div className="tuc-ayuda" style={{ marginTop: 7 }}>{ayuda}</div>}
    </div>
  )
}

/** Número de contexto de una función. La nota dice siempre si es un dato de ejemplo. */
export function Dato({ label, valor, nota, Icon }: { label: string; valor: string; nota?: string; Icon?: LucideIcon }) {
  return <Kpi label={label} valor={valor} nota={nota} Icon={Icon ?? Sparkles} />
}

/** Botón de solo ícono (borrar, subir, bajar): 34 px en escritorio, 44 en celular. Siempre con `label`. */
export function BotonIcono({ Icon, label, onClick, disabled, peligro, style }: { Icon: LucideIcon; label: string; onClick: () => void; disabled?: boolean; peligro?: boolean; style?: CSSProperties }) {
  return (
    <button type="button" className={`tuc-icono${peligro ? ' tuc-icono--peligro' : ''}`} aria-label={label} title={label} disabled={disabled} onClick={onClick} style={style}>
      <Icon size={15} aria-hidden />
    </button>
  )
}

export function BadgeEstado({ on }: { on: boolean }) {
  return <span className={`rv-chip ${on ? 'rv-chip--ok' : 'rv-chip--gris'}`} style={{ height: 24, fontSize: 11.5 }}>{on ? 'Activo' : 'Inactivo'}</span>
}

// ─── Armazón de cada función ──────────────────────────────────────────────────

interface ShellProps {
  funcion: Funcion
  rubro: RubroTurnos
  activo: boolean
  onActivo: (v: boolean) => void
  onVolver: () => void
  /** Aviso del panel (nada se guarda: es la demo). */
  avisar?: (titulo: string, descripcion?: string) => void
  /** Texto largo debajo del título. */
  bajada: string
  /** Qué pasa con el interruptor prendido, en una línea. */
  textoOn: string
  kpis?: ReactNode
  children: ReactNode
  preview: ReactNode
}

export function ShellFuncion({ funcion, rubro, activo, onActivo, onVolver, avisar, bajada, textoOn, kpis, children, preview }: ShellProps) {
  const grupo = grupoPorId(funcion.grupo)
  const recomendada = funcion.recomendada(rubro)
  return (
    <div className="rv-pagina">
      <style>{CSS_AVANZADO}</style>
      <Volver a="Avanzado" onClick={onVolver} />
      <Encabezado
        rotulo={`Avanzado · ${grupo.label}`}
        titulo={funcion.label}
        bajada={bajada}
        acciones={recomendada ? <span className="rv-chip rv-chip--primario"><Sparkles size={12} aria-hidden /> Recomendado para {rubro.label.toLowerCase()}</span> : undefined}
      />

      {/* Interruptor maestro: decide si todo lo de abajo se ve en el sitio. */}
      <div className="rv-card rv-card--pad tua-maestro" data-on={activo}>
        <div>
          <b>{activo ? 'Activo en tu sitio de reservas' : 'Apagado'}</b>
          <small>{activo ? textoOn : 'Podés dejar todo configurado y prenderlo cuando quieras. Tus clientes no ven nada mientras esté apagado.'}</small>
        </div>
        <Llave on={activo} onChange={onActivo} label={`${funcion.label}: ${activo ? 'activo' : 'apagado'}`} />
      </div>

      {kpis && <div className="rv-kpis rv-kpis--3 tua-kpis">{kpis}</div>}

      <div className="tua-cols">
        <div className="rv-pila" style={{ minWidth: 0 }}>
          {children}
          <div className="tua-guardar">
            <Boton variant="primary" icon={<Check size={15} strokeWidth={2.4} aria-hidden />} onClick={() => avisar?.('Cambios guardados', 'Es una demo: quedan solo en esta pantalla.')}>Guardar cambios</Boton>
          </div>
        </div>
        <aside className="tua-sticky" aria-label="Vista previa">{preview}</aside>
      </div>
    </div>
  )
}

// ─── "Así lo ve tu cliente" ───────────────────────────────────────────────────

const AvisoVistaCtx = createContext<(texto: string) => void>(() => {})
/** Muestra un aviso adentro del celular de la vista previa. Solo anda debajo de VistaCliente. */
export const useAvisoVista = () => useContext(AvisoVistaCtx)

/**
 * Botón del sitio adentro del celular. Con `href` abre esa página del sitio en
 * otra pestaña (así no se pierde lo que se estaba configurando); sin `href`
 * contesta con un aviso en el celular que cuenta qué pasaría en el sitio real.
 */
export function BotonVista({ children, aviso, href, variante = 'primario', style }: { children: ReactNode; aviso?: string; href?: string; variante?: 'primario' | 'borde'; style?: CSSProperties }) {
  const avisar = useAvisoVista()
  const clase = `tua-vbtn${variante === 'borde' ? ' tua-vbtn--borde' : ''}`
  if (href) return <a className={clase} href={href} target="_blank" rel="noreferrer" style={style}>{children}<span className="rv-sr"> (abre en otra pestaña)</span></a>
  return <button type="button" className={clase} style={style} onClick={() => avisar(aviso ?? 'Demo: en tu sitio este botón sigue al paso siguiente.')}>{children}</button>
}

/**
 * Celular pintado con la identidad del negocio (tema.ts): las mismas variables
 * --color-* que usa el sitio real, así la vista previa se ve como el sitio de
 * ese rubro y no como el panel. El marco es plano: una tarjeta más.
 */
export function VistaCliente({ rubro, titulo = 'Así lo ve tu cliente', nota, children }: { rubro: RubroTurnos; titulo?: string; nota?: ReactNode; children: ReactNode }) {
  const t = temaDe(rubro)
  useEffect(() => { cargarFuentesTurnos() }, [])
  // Aviso del celular: lo que se toca adentro de la vista previa responde acá. El número
  // hace que el mismo texto dos veces seguidas vuelva a entrar y reinicie el reloj.
  const [aviso, setAviso] = useState<{ texto: string; n: number } | null>(null)
  const avisar = useCallback((texto: string) => setAviso(a => ({ texto, n: (a?.n ?? 0) + 1 })), [])
  useEffect(() => {
    if (!aviso) return
    const id = setTimeout(() => setAviso(null), 3400)
    return () => clearTimeout(id)
  }, [aviso])
  return (
    <section aria-label={titulo} className="rv-card rv-card--pad">
      <div className="tua-vista-cab">
        <div>
          <div className="rv-rotulo" style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}><Eye size={12} aria-hidden style={{ color: 'var(--color-primary)' }} />Vista previa</div>
          <h2 className="rv-h2">{titulo}</h2>
          <p className="rv-ayuda" style={{ margin: '4px 0 0' }}>{nota ?? 'Con datos de ejemplo. Se actualiza mientras editás.'}</p>
        </div>
        <span className="rv-chip rv-chip--ok" style={{ height: 22, fontSize: 11 }}>En vivo</span>
      </div>

      <div className="tua-escena">
        <div className="tua-tel">
          <div className="tua-pantalla" style={{ ...(variablesTema(t) as CSSProperties), background: t.c.bg, color: t.c.body, fontFamily: t.fb }}>
            <div aria-hidden className="tua-pantalla-estado" style={{ color: t.c.text }}>
              <span>9:41</span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><Signal size={13} strokeWidth={2.4} /><Wifi size={13} strokeWidth={2.4} /><BatteryFull size={17} strokeWidth={1.8} /></span>
            </div>
            <div className="tua-pantalla-cab" style={{ borderBottom: `1px solid ${t.c.border}` }}>
              <span aria-hidden style={{ width: 28, height: 28, borderRadius: t.radio > 10 ? 9 : '50%', background: t.c.primary, color: t.c.onPrimary, display: 'grid', placeItems: 'center', fontSize: 13, fontWeight: 800, fontFamily: t.fh, flexShrink: 0 }}>{t.nombre[0]}</span>
              <span style={{ fontFamily: t.fh, fontWeight: 700, fontSize: 15, color: t.c.text, textTransform: t.mayus ? 'uppercase' : undefined, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.nombre}</span>
            </div>
            <div className="tua-pantalla-cuerpo" style={{ padding: '14px 14px 26px' }}>
              <AvisoVistaCtx.Provider value={avisar}>{children}</AvisoVistaCtx.Provider>
            </div>
            <div role="status" className="tua-toast-zona">
              {aviso && <div key={aviso.n} className="tua-toast"><Check size={14} strokeWidth={2.6} aria-hidden style={{ flexShrink: 0, marginTop: 1 }} />{aviso.texto}</div>}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
