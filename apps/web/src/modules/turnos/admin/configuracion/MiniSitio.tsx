// Miniatura del sitio de reservas: un mini-render de la portada con la paleta,
// la tipografía, los bordes y el tipo de portada REALES de una plantilla, y con
// el nombre, la foto y los servicios del negocio. No es una captura ni un
// iframe: son cajas livianas, así se pueden mostrar diez juntas en el selector
// de plantillas sin cargar diez sitios.
//
// Todo se mide en `em` y el tamaño de letra base sale del ancho de la caja
// (unidades cqw), por eso la misma miniatura sirve de 160 px o de 700 px sin
// recalcular nada con JavaScript.
import type { CSSProperties, ReactNode } from 'react'
import { Check, Sparkles } from 'lucide-react'
import { duracionTxt, pesos, type RubroTurnos } from '@/modules/turnos/datos'
import type { TemaNegocio } from '@/modules/turnos/storefront/tema'
import { iniciales, tipografiaPorId, type EstiloBoton, type PlantillaSitio } from './datos'

export interface DatosMini {
  nombre: string
  frase: string
  boton: string
  foto: string
  logo?: string | null
  servicios: { nombre: string; detalle: string; precio: string }[]
  /** Rótulo chico arriba del título ("Barbería · Palermo"). */
  ceja: string
}

export function datosMini(rubro: RubroTurnos, t: TemaNegocio, pisa?: Partial<DatosMini>): DatosMini {
  return {
    nombre: t.nombre, frase: t.tagline, boton: 'Reservar', foto: t.fotoHero, logo: null,
    ceja: `${rubro.label} · ${t.barrio.split(',')[0]}`,
    servicios: rubro.servicios.slice(0, 3).map(s => ({ nombre: s.nombre, detalle: duracionTxt(s.duracion), precio: pesos(s.precio) })),
    ...pisa,
  }
}

export const CSS_MINI = `
  .tuc-mini { container-type: inline-size; position: relative; overflow: hidden; width: 100%; aspect-ratio: 16 / 11; isolation: isolate; }
  .tuc-mini--movil { aspect-ratio: 9 / 17; }
  .tuc-mini-lienzo { position: absolute; inset: 0; display: flex; flex-direction: column; font-size: 10px; font-size: 2.5cqw; line-height: 1.3;
    transform-origin: 50% 35%; transition: transform 600ms var(--tuo-ease, ease); }
  .tuc-mini--movil .tuc-mini-lienzo { font-size: 14px; font-size: 5.6cqw; }
  .tuc-mini-foto { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; display: block; }
  .tuc-mini-una { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .tuc-mini-dos { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
  @media (prefers-reduced-motion: reduce) { .tuc-mini-lienzo { transition: none; } }
`

interface Props {
  tema: Pick<TemaNegocio, 'c' | 'fh' | 'fb' | 'mayus' | 'radio' | 'hero' | 'oscuro'>
  datos: DatosMini
  boton?: EstiloBoton
  movil?: boolean
  style?: CSSProperties
}

export function MiniSitio({ tema: t, datos: d, boton = 'relleno', movil, style }: Props) {
  const c = t.c
  const sangre = t.hero === 'sangre'
  const r = (k: number) => `${Math.min(t.radio, 22) * k / 10}em`
  const titulo: CSSProperties = { fontFamily: t.fh, fontWeight: 700, letterSpacing: t.mayus ? '0.01em' : '-0.015em', textTransform: t.mayus ? 'uppercase' : 'none', lineHeight: 1.06 }
  const sobreFoto = sangre
  const tinta = sobreFoto ? '#FFFFFF' : c.text

  const cta = (grande?: boolean): CSSProperties => ({
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', height: grande ? '2.7em' : '2.2em', padding: grande ? '0 1.4em' : '0 1em',
    borderRadius: r(1), fontFamily: t.fb, fontSize: grande ? '0.82em' : '0.68em', fontWeight: 700, whiteSpace: 'nowrap', boxSizing: 'border-box',
    ...(boton === 'relleno' ? { background: c.primary, color: c.onPrimary }
      : boton === 'borde' ? { border: `0.12em solid ${sobreFoto && grande ? '#FFFFFF' : c.primary}`, color: sobreFoto && grande ? '#FFFFFF' : c.primary }
        : { background: sobreFoto && grande ? 'rgba(255,255,255,0.18)' : c.primaryBg, color: sobreFoto && grande ? '#FFFFFF' : c.primary, backdropFilter: sobreFoto && grande ? 'blur(4px)' : undefined }),
  })

  const marca = (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.55em', minWidth: 0 }}>
      {d.logo
        ? <img src={d.logo} alt="" style={{ width: '1.9em', height: '1.9em', objectFit: 'contain', flexShrink: 0 }} />
        : <span style={{ ...titulo, width: '1.9em', height: '1.9em', borderRadius: t.radio > 10 ? '0.55em' : '50%', display: 'grid', placeItems: 'center', flexShrink: 0, background: c.primary, color: c.onPrimary, fontSize: '0.78em', letterSpacing: 0 }}>{iniciales(d.nombre)}</span>}
      <span className="tuc-mini-una" style={{ ...titulo, fontSize: '1em', color: tinta }}>{d.nombre}</span>
    </span>
  )

  const nav = (
    <div style={{
      position: sangre ? 'absolute' : 'relative', zIndex: 2, left: 0, right: 0, top: 0, height: '3.4em', flexShrink: 0, display: 'flex', alignItems: 'center', gap: '1.2em', padding: '0 1.6em',
      borderBottom: sangre ? 'none' : `0.08em solid ${c.border}`, background: sangre ? 'linear-gradient(to bottom, rgba(0,0,0,.5), transparent)' : c.bg, color: tinta,
    }}>
      {marca}
      <span style={{ flex: 1 }} />
      {movil ? (
        <span style={{ display: 'grid', gap: '0.28em', width: '1.3em' }}>
          {[0, 1, 2].map(i => <span key={i} style={{ height: '0.14em', borderRadius: 2, background: tinta, opacity: 0.85 }} />)}
        </span>
      ) : <>
        {['Servicios', 'Equipo', 'Nosotros'].map(l => <span key={l} style={{ fontFamily: t.fb, fontSize: '0.68em', fontWeight: 500, opacity: 0.78 }}>{l}</span>)}
        <span style={cta()}>{d.boton}</span>
      </>}
    </div>
  )

  const textoHero = (
    <div style={{ minWidth: 0, color: tinta }}>
      <div className="tuc-mini-una" style={{ fontFamily: t.fb, fontSize: '0.6em', fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', color: sobreFoto ? 'rgba(255,255,255,0.85)' : c.primary, marginBottom: '0.9em' }}>{d.ceja}</div>
      <div className="tuc-mini-dos" style={{ ...titulo, fontSize: movil ? '1.75em' : '2.35em' }}>{d.frase}</div>
      <div style={{ display: 'flex', gap: '0.6em', marginTop: '1.1em', alignItems: 'center' }}>
        <span style={cta(true)}>{d.boton}</span>
        {!movil && <span style={{ fontFamily: t.fb, fontSize: '0.72em', fontWeight: 600, color: sobreFoto ? 'rgba(255,255,255,0.85)' : c.body, borderBottom: `0.1em solid ${sobreFoto ? 'rgba(255,255,255,0.5)' : c.border}`, paddingBottom: '0.15em' }}>Ver servicios</span>}
      </div>
    </div>
  )

  const hero = sangre ? (
    <div style={{ position: 'relative', flex: movil ? '0 0 50%' : '1 1 0', minHeight: 0, display: 'flex', alignItems: 'flex-end', padding: movil ? '1.2em' : '1.6em', background: c.surfaceAlt }}>
      <img className="tuc-mini-foto" src={d.foto} alt="" loading="lazy" />
      <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(180deg, rgba(0,0,0,.18) 0%, rgba(0,0,0,.12) 35%, rgba(0,0,0,.78) 100%)` }} />
      <div style={{ position: 'relative', maxWidth: movil ? '100%' : '66%', minWidth: 0 }}>{textoHero}</div>
    </div>
  ) : movil ? (
    <div style={{ flex: '0 0 auto', padding: '1.3em 1.2em 0', display: 'flex', flexDirection: 'column', gap: '1.1em' }}>
      {textoHero}
      <div style={{ position: 'relative', height: '8.5em', borderRadius: r(1.6), overflow: 'hidden', background: c.surfaceAlt }}><img className="tuc-mini-foto" src={d.foto} alt="" loading="lazy" /></div>
    </div>
  ) : (
    <div style={{ flex: '1 1 0', minHeight: 0, display: 'grid', gridTemplateColumns: 'minmax(0, 1.05fr) minmax(0, 1fr)', gap: '1.6em', alignItems: 'center', padding: '1.4em 1.6em' }}>
      {textoHero}
      <div style={{ position: 'relative', height: '100%', minHeight: 0, borderRadius: r(1.6), overflow: 'hidden', background: c.surfaceAlt }}><img className="tuc-mini-foto" src={d.foto} alt="" loading="lazy" /></div>
    </div>
  )

  const servicio = (s: DatosMini['servicios'][number], i: number) => (
    <div key={i} style={{ minWidth: 0, display: 'flex', alignItems: 'center', gap: '0.7em', padding: movil ? '0.75em 0.9em' : '0.8em 0.9em', borderRadius: r(1.2), background: c.surface, border: `0.08em solid ${c.border}`, fontFamily: t.fb }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="tuc-mini-una" style={{ fontSize: '0.74em', fontWeight: 700, color: c.text }}>{s.nombre}</div>
        <div className="tuc-mini-una" style={{ fontSize: '0.6em', color: c.muted, marginTop: '0.15em' }}>{s.detalle}</div>
      </div>
      <span style={{ fontSize: '0.7em', fontWeight: 700, color: c.primary, whiteSpace: 'nowrap' }}>{s.precio}</span>
    </div>
  )

  return (
    <div aria-hidden className={`tuc-mini${movil ? ' tuc-mini--movil' : ''}`} style={{ background: c.bg, ...style }}>
      <div className="tuc-mini-lienzo" style={{ background: c.bg, color: c.body, fontFamily: t.fb }}>
        {nav}
        {hero}
        <div style={{ flexShrink: 0, padding: movil ? '1.1em 1.2em 0' : '0 1.6em 1.4em', marginTop: !movil && sangre ? '1.2em' : 0, display: movil ? 'flex' : 'grid', flexDirection: 'column', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: movil ? '0.55em' : '0.8em' }}>
          {(movil ? d.servicios : d.servicios.slice(0, 3)).map(servicio)}
        </div>
        {movil && (
          <div style={{ marginTop: 'auto', padding: '0.9em 1.2em 1.1em', background: `linear-gradient(to top, ${c.bg} 60%, transparent)` }}>
            <span style={{ ...cta(true), display: 'flex', width: '100%', ...(boton !== 'relleno' ? { color: c.primary, borderColor: c.primary, background: boton === 'suave' ? c.primaryBg : 'transparent', backdropFilter: undefined } : {}) }}>{d.boton}</span>
          </div>
        )}
      </div>
    </div>
  )
}

/** Muestra combinada de una paleta: fondo, superficie, acento y tinta, encimadas como fichas. */
export function MuestraPaleta({ colores, size = 22 }: { colores: string[]; size?: number }) {
  return (
    <span aria-hidden style={{ display: 'inline-flex', flexShrink: 0 }}>
      {colores.map((c, i) => (
        <span key={i} style={{ width: size, height: size, borderRadius: '50%', background: c, marginLeft: i ? -size * 0.32 : 0, boxShadow: '0 0 0 2px var(--color-bg), inset 0 0 0 1px rgba(128,128,128,0.28)', position: 'relative', zIndex: colores.length - i }} />
      ))}
    </span>
  )
}

// ─── Tarjeta de plantilla ────────────────────────────────────────────────────
// La misma tarjeta en el selector de Apariencia y en la galería de Avanzado →
// Plantillas: miniatura grande, nombre propio, para quién es, su paleta y su
// letra. Es un radio: va dentro de un role="radiogroup".

export const CSS_PLANTILLA = `
  /* Entrada propia y no .tuo-entra: aquella deja el transform final aplicado (fill both) y una animación
     le gana a cualquier :hover, así que la tarjeta no se podría elevar. Esta solo rellena hacia atrás. */
  @keyframes tucEntra { from { opacity: 0; transform: translateY(12px); } }
  .tuc-entra { animation: tucEntra 520ms var(--tuo-ease, ease) backwards; animation-delay: calc(var(--i, 0) * 55ms); }
  @media (prefers-reduced-motion: reduce) { .tuc-entra { animation: none; } }
  .tuc-plantilla { position: relative; display: flex; flex-direction: column; text-align: left; padding: 0; border-radius: 20px; border: 1px solid var(--color-border); background: var(--color-bg); color: inherit;
    font-family: inherit; cursor: pointer; min-width: 0; box-shadow: var(--shadow-card);
    transition: transform 300ms var(--tuo-ease, ease), box-shadow 300ms ease, border-color 180ms ease; }
  .tuc-plantilla-marco { position: relative; margin: 10px 10px 0; border-radius: 12px; overflow: hidden; border: 1px solid var(--color-border); background: var(--color-surface-alt); }
  .tuc-plantilla-cuerpo { padding: 14px 16px 16px; display: flex; flex-direction: column; gap: 8px; flex: 1; }
  .tuc-plantilla-nombre { font-family: var(--tuo-fh); font-size: 16px; font-weight: 700; letter-spacing: -0.02em; color: var(--color-text); }
  .tuc-plantilla-para { font-size: 12.5px; line-height: 1.45; color: var(--color-muted); margin: 0; }
  .tuc-plantilla-sello { position: absolute; top: 10px; left: 10px; z-index: 3; display: inline-flex; align-items: center; gap: 5px; height: 26px; padding: 0 10px 0 8px; border-radius: 999px; font-size: 11.5px; font-weight: 700;
    color: #fff; background: var(--tuo-grad); box-shadow: 0 6px 16px rgba(37,99,235,0.45); opacity: 0; transform: translateY(-4px) scale(0.92); transition: opacity 200ms ease, transform 280ms var(--tuo-ease, ease); }
  .tuc-plantilla[aria-checked='true'] { border-color: var(--color-primary); box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-primary) 24%, transparent), 0 22px 44px -22px color-mix(in srgb, var(--color-primary) 60%, transparent); }
  .tuc-plantilla[aria-checked='true'] .tuc-plantilla-sello { opacity: 1; transform: none; }
  .tuc-plantilla[aria-checked='true'] .tuc-plantilla-marco { border-color: color-mix(in srgb, var(--color-primary) 40%, var(--color-border)); }
  .tuc-plantilla:focus-visible { outline: 2px solid var(--color-primary); outline-offset: 3px; }
  .tuc-plantilla-aa { margin-left: auto; font-size: 12px; color: var(--color-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; min-width: 0; }
  @media (hover: hover) {
    .tuc-plantilla:hover { transform: translateY(-4px); box-shadow: var(--shadow-card-hover), 0 26px 50px -26px rgba(15,23,42,0.4); border-color: color-mix(in srgb, var(--color-primary) 45%, var(--color-border)); }
    .tuc-plantilla[aria-checked='true']:hover { border-color: var(--color-primary); box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-primary) 24%, transparent), 0 26px 50px -22px color-mix(in srgb, var(--color-primary) 60%, transparent); }
    .tuc-plantilla:hover .tuc-mini-lienzo { transform: scale(1.06); }
  }
  @media (prefers-reduced-motion: reduce) {
    .tuc-plantilla, .tuc-plantilla-sello { transition: none; }
    .tuc-plantilla:hover { transform: none; }
    .tuc-plantilla:hover .tuc-mini-lienzo { transform: none; }
  }
`

export function TarjetaPlantilla({ p, tema, datos, boton, activa, recomendada, onClick, extra, i = 0 }: {
  p: PlantillaSitio; tema: Props['tema']; datos: DatosMini; boton?: EstiloBoton; activa: boolean; recomendada?: boolean; onClick: () => void
  /** Pie opcional de la tarjeta (por ejemplo, un rótulo). */
  extra?: ReactNode; i?: number
}) {
  const tipo = tipografiaPorId(p.tipo)
  return (
    <button type="button" role="radio" aria-checked={activa} onClick={onClick} className="tuc-plantilla tuc-entra" style={{ ['--i' as string]: i }}
      aria-label={`Plantilla ${p.nombre}, ${p.caracter.toLowerCase()}. ${p.para}${recomendada ? ' Recomendada para tu rubro.' : ''}`}>
      <span className="tuc-plantilla-sello" aria-hidden><Check size={13} strokeWidth={3} />En uso</span>
      <span className="tuc-plantilla-marco"><MiniSitio tema={tema} datos={datos} boton={boton ?? p.boton} /></span>
      <span className="tuc-plantilla-cuerpo">
        <span style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span className="tuc-plantilla-nombre">{p.nombre}</span>
          <span className="tuo-chip tuo-chip--borde" style={{ height: 22, fontSize: 11, padding: '0 8px' }}>{p.caracter}</span>
          {recomendada && <span className="tuo-chip tuo-chip--primario" style={{ height: 22, fontSize: 11, padding: '0 8px' }}><Sparkles size={11} aria-hidden />Para tu rubro</span>}
        </span>
        <span className="tuc-plantilla-para">{p.para}</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 'auto', paddingTop: 4, minWidth: 0 }}>
          <MuestraPaleta colores={[p.c.bg, p.c.surfaceAlt, p.c.primary, p.c.text]} size={20} />
          <span className="tuc-plantilla-aa"><span aria-hidden style={{ fontFamily: tipo.fh, fontSize: 16, fontWeight: 700, color: 'var(--color-text)', textTransform: tipo.mayus ? 'uppercase' : 'none', marginRight: 6 }}>Aa</span>{tipo.titulo}</span>
        </span>
        {extra}
      </span>
    </button>
  )
}
