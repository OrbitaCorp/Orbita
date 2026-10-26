// DEMO INTERNA — tira fija arriba de cada pantalla de /alquileres-demo: avisa
// que es una vista previa local, deja cambiar de modo (canchas, salón,
// estadía) y saltar entre pantallas. No forma parte del producto.
//
// Mide 40 px de alto y es siempre oscura, así se lee como una herramienta
// aparte y no como parte del negocio que se está mirando.
import { useEffect, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { X } from 'lucide-react'
import { OrbitaLogo } from '@/design-system/components/OrbitaLogo'
import { TIPOS, TIPOS_ORDEN, type TipoAlquiler } from '../datos'
import { useDemoAlquiler } from '../datos/negocio'

export const PANTALLAS = [
  { href: '/alquileres-demo', label: 'Índice' },
  { href: '/alquileres-demo/onboarding', label: 'Alta' },
  { href: '/alquileres-demo/panel', label: 'Panel' },
  { href: '/alquileres-demo/negocio', label: 'Sitio' },
  { href: '/alquileres-demo/reserva', label: 'Reserva' },
  { href: '/alquileres-demo/mis-reservas', label: 'Mis reservas' },
]

export const TIPO_DEFAULT: TipoAlquiler = 'cancha'

/** El modo activo de la demo: viaja en ?tipo= para que cada link lo conserve. */
export function useTipoDemo(): [TipoAlquiler, (t: TipoAlquiler) => void] {
  const router = useRouter()
  const q = router.query.tipo
  const tipo: TipoAlquiler = typeof q === 'string' && (TIPOS_ORDEN as string[]).includes(q) ? (q as TipoAlquiler) : TIPO_DEFAULT
  const set = (t: TipoAlquiler) => router.replace({ pathname: router.pathname, query: { ...router.query, tipo: t } }, undefined, { shallow: true, scroll: false })
  return [tipo, set]
}

const CSS = `
  .ald-barra { --color-bg: #0B101D; --color-border: rgba(147,197,253,0.18); --color-text: #F1F5FD; --color-muted: #8794B2; --color-primary: #60A5FA;
    position: sticky; top: 0; z-index: 120; box-sizing: border-box; height: 40px; display: flex; align-items: center; gap: 10px; padding: 0 12px 0 14px; font-size: 12px; color: #B6C2DA; background: #05080F; border-bottom: 1px solid rgba(147,197,253,0.2); }
  .ald-marca { display: inline-flex; align-items: center; gap: 8px; height: 40px; flex-shrink: 0; color: #F1F5FD; text-decoration: none; }
  .ald-marca b { font-size: 13px; font-weight: 700; letter-spacing: -0.01em; }
  .ald-marca i { font-style: normal; color: #8794B2; font-weight: 500; }
  .ald-pildora { display: inline-flex; align-items: center; height: 22px; padding: 0 9px; border-radius: 999px; flex-shrink: 0; font-family: "Geist Mono", ui-monospace, monospace; font-size: 10px; letter-spacing: 0.1em; text-transform: uppercase; white-space: nowrap; color: #FCD34D; background: rgba(251,191,36,0.10); border: 1px solid rgba(251,191,36,0.26); }
  .ald-barra nav { display: flex; align-items: stretch; gap: 2px; height: 40px; flex: 1; min-width: 0; overflow-x: auto; scrollbar-width: none; padding: 0 6px; }
  .ald-barra nav::-webkit-scrollbar { display: none; }
  .ald-barra nav a { display: inline-flex; align-items: center; height: 40px; padding: 0 10px; flex-shrink: 0; color: #9AA8C7; font-weight: 500; text-decoration: none; white-space: nowrap; border-bottom: 2px solid transparent; }
  .ald-barra nav a[aria-current='page'] { color: #F1F5FD; font-weight: 600; border-bottom-color: #60A5FA; }
  .ald-barra nav a:focus-visible, .ald-marca:focus-visible { outline: 2px solid #60A5FA; outline-offset: -3px; }
  .ald-sel:focus-visible, .ald-alta:focus-visible { outline: 2px solid #60A5FA; outline-offset: 2px; }
  .ald-alta { display: inline-flex; align-items: center; gap: 6px; height: 24px; max-width: 200px; padding: 0 4px 0 10px; flex-shrink: 0; border-radius: 999px; border: 1px solid rgba(96,165,250,0.4); background: rgba(59,130,246,0.14); color: #DBEAFE; font: inherit; font-size: 11.5px; font-weight: 600; cursor: pointer; }
  .ald-alta > span { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .ald-sel { height: 28px; border-radius: 999px; border: 1px solid rgba(147,197,253,0.3); background: rgba(147,197,253,0.08); color: #F1F5FD; font: inherit; font-size: 12px; font-weight: 600; padding: 0 10px; flex-shrink: 0; max-width: 180px; }
  @media (max-width: 1080px) { .ald-pildora { display: none; } }
  @media (max-width: 860px) { .ald-alta { display: none; } }
  @media (max-width: 640px) { .ald-barra { gap: 4px; padding: 0 8px 0 10px; } .ald-marca b, .ald-marca i { display: none; } .ald-barra nav a { padding: 0 9px; font-size: 13px; } .ald-sel { font-size: 16px; max-width: 120px; } }
`

export function BarraDemo() {
  const router = useRouter()
  const [tipo, setTipo] = useTipoDemo()
  const { demo, reiniciar } = useDemoAlquiler()
  const navRef = useRef<HTMLElement>(null)

  useEffect(() => {
    const nav = navRef.current
    const activa = nav?.querySelector<HTMLElement>('a[aria-current="page"]')
    if (!nav || !activa) return
    nav.scrollLeft = Math.max(0, activa.offsetLeft - (nav.clientWidth - activa.offsetWidth) / 2)
  }, [router.pathname])

  const hayCambios = Object.keys(demo.negocios).length > 0 || Object.keys(demo.cambios).length > 0 || Object.values(demo.reservas).some(l => l && l.length)
  return (
    <div className="ald-barra" role="region" aria-label="Barra de la demo de Alquileres">
      <style>{CSS}</style>
      <Link href={{ pathname: '/alquileres-demo', query: { tipo } }} className="ald-marca" aria-label="Órbita Alquileres: ir al índice de la demo">
        <OrbitaLogo size={18} />
        <b>Órbita <i>Alquileres</i></b>
      </Link>
      {hayCambios
        ? <button type="button" className="ald-alta" onClick={reiniciar} title="Borrar lo cargado en la demo y volver a los datos de ejemplo"><span>Con cambios tuyos</span><X size={14} aria-hidden /></button>
        : <span className="ald-pildora">Vista previa local</span>}
      <nav ref={navRef} aria-label="Pantallas de la demo">
        {PANTALLAS.map(p => (
          <Link key={p.href} href={{ pathname: p.href, query: { tipo } }} aria-current={router.pathname === p.href ? 'page' : undefined}>{p.label}</Link>
        ))}
      </nav>
      <select className="ald-sel" aria-label="Modo de ejemplo" value={tipo} onChange={e => setTipo(e.target.value as TipoAlquiler)}>
        {TIPOS_ORDEN.map(t => <option key={t} value={t}>{TIPOS[t].label}</option>)}
      </select>
    </div>
  )
}
