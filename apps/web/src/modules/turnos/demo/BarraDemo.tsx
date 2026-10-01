// DEMO INTERNA — tira fija arriba de cada pantalla de /turnos-demo: avisa que
// es una vista previa local, deja cambiar de rubro y saltar entre pantallas.
// No forma parte del producto: cuando Turnos sea real, esta tira no existe.
//
// Mide SIEMPRE 40px de alto (el layout del panel hace calc(100vh - 40px)) y es
// siempre oscura, "espacio profundo", sin importar el tema de la pantalla de
// abajo: así se lee como una herramienta aparte y no como parte del producto.
import { useEffect, useMemo, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { ChevronDown, X } from 'lucide-react'
import { OrbitaLogo } from '@/design-system/components/OrbitaLogo'
import { FAMILIAS, RUBROS_TURNOS, RUBRO_DEFAULT, rubroPorKey, type RubroTurnos } from '@/modules/turnos/datos'
import { useNegocioDemo } from './negocioDemo'

export const PANTALLAS = [
  { href: '/turnos-demo',            label: 'Índice' },
  { href: '/turnos-demo/onboarding', label: 'Alta' },
  { href: '/turnos-demo/panel',      label: 'Panel' },
  { href: '/turnos-demo/negocio',    label: 'Sitio web' },
  { href: '/turnos-demo/simple',     label: 'Página simple' },
  { href: '/turnos-demo/negocio/servicios', label: 'Servicios' },
  { href: '/turnos-demo/reserva',    label: 'Reserva' },
  { href: '/turnos-demo/mis-turnos', label: 'Mis turnos' },
  { href: '/turnos-demo/landing',    label: 'Landing' },
]

/**
 * Rubro activo de la demo: viaja en ?rubro= para que cada link lo conserve.
 *
 * Si el dueño hizo el alta con este rubro, el rubro lleva pegado lo que cargó
 * (`alta`) y sus servicios y su seña pisan a los de ejemplo: así el sitio, la
 * reserva y el panel muestran su negocio y no el de muestra. Lo mismo con lo
 * que guardó en Configuración para este rubro: el horario (`horarios`) y la
 * plantilla con sus ajustes (`apariencia`).
 *
 * ?probar=<plantilla> viste la página con esa plantilla sin guardarla: lo usa
 * la vista previa de Apariencia, que carga el sitio en un iframe.
 */
export function useRubroDemo(): [RubroTurnos, (key: string) => void] {
  const router = useRouter()
  const { demo } = useNegocioDemo()
  const key = typeof router.query.rubro === 'string' ? router.query.rubro : RUBRO_DEFAULT
  const probar = typeof router.query.probar === 'string' ? router.query.probar : ''
  const set = (k: string) => router.replace({ pathname: router.pathname, query: { ...router.query, rubro: k } }, undefined, { shallow: true, scroll: false })
  const base = rubroPorKey(key)
  const alta = demo.identidad?.rubro === base.key ? demo.identidad : null
  const horarios = demo.horarios?.rubro === base.key ? demo.horarios.dias : null
  const guardada = demo.apariencia?.rubro === base.key ? demo.apariencia : null
  const rubro = useMemo(() => {
    const apariencia = probar ? { rubro: base.key, plantilla: probar, color: '', tipo: '', radio: 0, foto: '' } : guardada
    if (!alta && !horarios && !apariencia) return base
    return {
      ...base,
      ...(alta ? { alta, ...(alta.servicios.length ? { servicios: alta.servicios, sena: alta.sena } : {}) } : {}),
      ...(horarios ? { horarios } : {}),
      ...(apariencia ? { apariencia } : {}),
    }
  }, [base, alta, horarios, guardada, probar])
  return [rubro, set]
}

// El selector sigue siendo un <select> nativo a propósito: 32 rubros en cuatro
// grupos se eligen mejor con la rueda del celular que con un menú armado a
// mano, y el teclado y el lector de pantalla salen gratis. Lo que se dibuja es
// el marco: ícono del rubro a la izquierda y flecha propia a la derecha.
const CSS_SELECTOR = `
  .tu-selrubro { position: relative; display: inline-flex; align-items: center; max-width: 100%; min-width: 0; color: var(--color-text); }
  .tu-selrubro > svg { position: absolute; top: 50%; transform: translateY(-50%); pointer-events: none; transition: color 160ms ease, transform 200ms ease; }
  .tu-selrubro > svg:first-of-type { left: 10px; color: var(--color-primary); }
  .tu-selrubro > svg:last-of-type { right: 9px; color: var(--color-muted); }
  .tu-selrubro > select {
    appearance: none; -webkit-appearance: none; width: 100%; max-width: 100%; height: 38px; padding: 0 30px 0 32px;
    border-radius: 10px; border: 1px solid var(--color-border); background: var(--color-bg); color: inherit;
    font-family: inherit; font-size: 13.5px; font-weight: 600; cursor: pointer; text-overflow: ellipsis; outline: none;
    transition: border-color 160ms ease, box-shadow 200ms ease, background 160ms ease;
  }
  .tu-selrubro > select option, .tu-selrubro > select optgroup { background: var(--color-bg); color: var(--color-text); font-weight: 500; }
  .tu-selrubro[data-compacto='true'] > select { height: 28px; border-radius: 999px; font-size: 12px; padding: 0 26px 0 29px; background: rgba(147,197,253,0.08); }
  .tu-selrubro[data-compacto='true'] > svg:first-of-type { left: 9px; }
  .tu-selrubro > select:focus-visible { border-color: var(--color-primary); box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-primary) 24%, transparent); }
  @media (hover: hover) {
    .tu-selrubro:hover > select { border-color: var(--color-border-strong); box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-primary) 12%, transparent); }
    .tu-selrubro:hover > svg:last-of-type { color: var(--color-text); transform: translateY(-50%) translateY(1px); }
  }
  /* En celular, 16px: con menos, iOS hace zoom al abrir el selector. */
  @media (max-width: 640px) { .tu-selrubro > select { font-size: 16px; } .tu-selrubro[data-compacto='true'] > select { font-size: 16px; } }
  @media (prefers-reduced-motion: reduce) { .tu-selrubro > select, .tu-selrubro > svg { transition: none; } }
`

export function SelectorRubro({ valor, onChange, compacto }: { valor: string; onChange: (k: string) => void; compacto?: boolean }) {
  const rubro = rubroPorKey(valor)
  return (
    <span className="tu-selrubro" data-compacto={compacto ? 'true' : 'false'}>
      <style>{CSS_SELECTOR}</style>
      <rubro.Icon size={compacto ? 13 : 15} strokeWidth={1.9} aria-hidden />
      <select aria-label="Rubro de ejemplo" value={valor} onChange={e => onChange(e.target.value)}>
        {FAMILIAS.map(f => (
          <optgroup key={f.id} label={f.label}>
            {RUBROS_TURNOS.filter(r => r.familia === f.id).map(r => <option key={r.key} value={r.key}>{r.label}</option>)}
          </optgroup>
        ))}
      </select>
      <ChevronDown size={compacto ? 13 : 15} strokeWidth={2} aria-hidden />
    </span>
  )
}

const CSS_BARRA = `
  /* La tira define sus propios tokens oscuros: el selector de rubro pinta con
     --color-* y así sale bien acá adentro aunque la pantalla esté en claro. */
  .tu-barra {
    --color-bg: #0B101D; --color-border: rgba(147,197,253,0.18); --color-border-strong: rgba(147,197,253,0.42);
    --color-text: #F1F5FD; --color-muted: #8794B2; --color-primary: #60A5FA;
    position: sticky; top: 0; z-index: 120; box-sizing: border-box; height: 40px;
    display: flex; align-items: center; gap: 10px; padding: 0 12px 0 14px;
    font-size: 12px; color: #B6C2DA;
    background:
      radial-gradient(420px 90px at 8% -40%, rgba(59,130,246,0.30), transparent 70%),
      radial-gradient(380px 90px at 96% 140%, rgba(99,102,241,0.26), transparent 70%),
      #05080F;
  }
  /* Filo de luz abajo en vez de borde: no suma alto y marca el corte con la pantalla. */
  .tu-barra::after { content: ''; position: absolute; left: 0; right: 0; bottom: 0; height: 1px; pointer-events: none; background: linear-gradient(90deg, transparent, rgba(59,130,246,0.75) 18%, rgba(129,140,248,0.75) 50%, rgba(147,197,253,0.55) 82%, transparent); }

  .tu-barra-marca { display: inline-flex; align-items: center; gap: 8px; height: 40px; flex-shrink: 0; color: #F1F5FD; text-decoration: none; border-radius: 8px; padding: 0 4px; margin-left: -4px; cursor: pointer; transition: opacity 160ms ease; }
  .tu-barra-marca b { font-family: 'Sora', 'Geist', system-ui, sans-serif; font-size: 13px; font-weight: 700; letter-spacing: -0.02em; }
  .tu-barra-marca i { font-style: normal; color: #8794B2; font-weight: 500; }
  .tu-barra-pildora { display: inline-flex; align-items: center; gap: 6px; height: 22px; padding: 0 9px; border-radius: 999px; flex-shrink: 0; font-family: "Geist Mono", ui-monospace, monospace; font-size: 10px; font-weight: 500; letter-spacing: 0.1em; text-transform: uppercase; white-space: nowrap; color: #FCD34D; background: rgba(251,191,36,0.10); border: 1px solid rgba(251,191,36,0.26); }
  .tu-barra-pildora::before { content: ''; width: 5px; height: 5px; border-radius: 50%; background: #FBBF24; animation: tuBarraLate 2s ease-in-out infinite; }
  @keyframes tuBarraLate { 0%, 100% { opacity: 1 } 50% { opacity: 0.35 } }

  .tu-barra nav { position: relative; display: flex; align-items: stretch; gap: 2px; height: 40px; flex: 1; min-width: 0; overflow-x: auto; overscroll-behavior-x: contain; scrollbar-width: none; -webkit-overflow-scrolling: touch;
    /* Los bordes se desvanecen: avisa que la lista sigue para el costado. */
    -webkit-mask-image: linear-gradient(90deg, transparent, #000 14px, #000 calc(100% - 22px), transparent);
            mask-image: linear-gradient(90deg, transparent, #000 14px, #000 calc(100% - 22px), transparent);
    padding: 0 10px; }
  .tu-barra nav::-webkit-scrollbar { display: none; }
  .tu-barra nav a { position: relative; display: inline-flex; align-items: center; height: 40px; padding: 0 10px; flex-shrink: 0; color: #9AA8C7; font-weight: 500; text-decoration: none; white-space: nowrap; cursor: pointer; transition: color 160ms ease; }
  /* El fondo y el subrayado van en pseudo-elementos para animarlos con
     opacity/transform sin mover nada del layout. */
  .tu-barra nav a::before { content: ''; position: absolute; inset: 7px 1px; border-radius: 7px; background: rgba(147,197,253,0.10); opacity: 0; transition: opacity 160ms ease; }
  .tu-barra nav a::after { content: ''; position: absolute; left: 10px; right: 10px; bottom: 0; height: 2px; border-radius: 2px 2px 0 0; background: linear-gradient(90deg, #3B82F6, #93C5FD); box-shadow: 0 0 10px rgba(96,165,250,0.9); transform: scaleX(0); transition: transform 240ms cubic-bezier(0.22, 1, 0.36, 1); }
  .tu-barra nav a > span { position: relative; }
  .tu-barra nav a[aria-current='page'] { color: #F1F5FD; font-weight: 600; }
  .tu-barra nav a[aria-current='page']::before { opacity: 1; }
  .tu-barra nav a[aria-current='page']::after { transform: scaleX(1); }
  .tu-barra nav a:focus-visible, .tu-barra-marca:focus-visible { outline: 2px solid #60A5FA; outline-offset: -3px; border-radius: 8px; }
  @media (hover: hover) {
    .tu-barra nav a:hover { color: #F1F5FD; }
    .tu-barra nav a:hover::before { opacity: 1; }
    .tu-barra-marca:hover { opacity: 0.82; }
  }

  /* El alta cargada: avisa de quién son los datos que se ven y deja volver a los de ejemplo. */
  .tu-barra-alta { display: inline-flex; align-items: center; gap: 6px; height: 24px; max-width: 220px; padding: 0 4px 0 10px; flex-shrink: 0; border-radius: 999px; border: 1px solid rgba(96,165,250,0.4); background: rgba(59,130,246,0.14); color: #DBEAFE; font: inherit; font-size: 11.5px; font-weight: 600; cursor: pointer; transition: background 160ms ease, border-color 160ms ease; }
  .tu-barra-alta > span { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .tu-barra-alta > svg { flex-shrink: 0; padding: 2px; border-radius: 50%; background: rgba(147,197,253,0.18); }
  .tu-barra-alta:focus-visible { outline: 2px solid #60A5FA; outline-offset: 2px; }
  @media (hover: hover) { .tu-barra-alta:hover { background: rgba(59,130,246,0.26); border-color: rgba(147,197,253,0.7); } }

  .tu-barra-rubro { flex-shrink: 0; min-width: 0; max-width: 220px; display: inline-flex; }
  @media (max-width: 1080px) { .tu-barra-pildora { display: none; } }
  @media (max-width: 860px) { .tu-barra-alta { display: none; } }
  @media (max-width: 640px) {
    .tu-barra { gap: 4px; padding: 0 8px 0 10px; }
    .tu-barra-marca b, .tu-barra-marca i { display: none; }
    .tu-barra nav { padding: 0 6px; }
    .tu-barra nav a { padding: 0 9px; font-size: 13px; }
    .tu-barra-rubro { max-width: 128px; }
  }
  @media (prefers-reduced-motion: reduce) {
    .tu-barra-pildora::before { animation: none; }
    .tu-barra nav a, .tu-barra nav a::before, .tu-barra nav a::after, .tu-barra-marca { transition: none; }
  }
`

export function BarraDemo() {
  const router = useRouter()
  const [rubro, setRubro] = useRubroDemo()
  const { demo, reiniciar } = useNegocioDemo()
  const navRef = useRef<HTMLElement>(null)

  // En celular los links no entran: se corre la tira para que la pantalla
  // activa quede a la vista. Se mueve solo el scroll del <nav> (no
  // scrollIntoView, que también puede arrastrar el scroll de la página).
  useEffect(() => {
    const nav = navRef.current
    const activa = nav?.querySelector<HTMLElement>('a[aria-current="page"]')
    if (!nav || !activa) return
    nav.scrollLeft = Math.max(0, activa.offsetLeft - (nav.clientWidth - activa.offsetWidth) / 2)
  }, [router.pathname])

  return (
    // "tu-barra-demo" no pinta nada: es el nombre por el que la vista previa de
    // Configuración (VistaPrevia.tsx) esconde esta tira adentro de su iframe.
    <div className="tu-barra tu-barra-demo" role="region" aria-label="Barra de la demo de Turnos">
      <style>{CSS_BARRA}</style>
      <Link href={{ pathname: '/turnos-demo', query: { rubro: rubro.key } }} className="tu-barra-marca" aria-label="Órbita Turnos: ir al índice de la demo">
        <OrbitaLogo size={18} />
        <b>Órbita <i>Turnos</i></b>
      </Link>
      {demo.identidad
        ? (
          <button type="button" className="tu-barra-alta" onClick={reiniciar} title="Borrar lo cargado en el alta y volver a los datos de ejemplo" aria-label={`Estás viendo el alta de ${demo.identidad.nombre}. Borrarla y volver a los datos de ejemplo`}>
            <span>Tu alta: {demo.identidad.nombre}</span><X size={16} aria-hidden />
          </button>
        )
        : <span className="tu-barra-pildora">Vista previa local</span>}
      <nav ref={navRef} aria-label="Pantallas de la demo">
        {PANTALLAS.map(p => (
          <Link key={p.href} href={{ pathname: p.href, query: { rubro: rubro.key } }} aria-current={router.pathname === p.href ? 'page' : undefined}>
            <span>{p.label}</span>
          </Link>
        ))}
      </nav>
      <span className="tu-barra-rubro"><SelectorRubro valor={rubro.key} onChange={setRubro} compacto /></span>
    </div>
  )
}
