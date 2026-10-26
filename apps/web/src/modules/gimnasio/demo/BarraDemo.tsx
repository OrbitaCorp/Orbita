// DEMO INTERNA — tira fija arriba de cada pantalla de /gimnasio-demo: avisa
// que es una vista previa local, deja cambiar de rubro y saltar entre
// pantallas. No forma parte del producto. Mide 40 px y es siempre oscura.
import { useEffect, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { X } from 'lucide-react'
import { OrbitaLogo } from '@/design-system/components/OrbitaLogo'
import { RUBROS_GYM, RUBRO_DEFAULT, rubroPorKey, type RubroGym } from '../datos'
import { useDemoGym } from '../datos/negocio'

export const PANTALLAS = [
  { href: '/gimnasio-demo', label: 'Índice' },
  { href: '/gimnasio-demo/onboarding', label: 'Alta' },
  { href: '/gimnasio-demo/panel', label: 'Panel' },
  { href: '/gimnasio-demo/negocio', label: 'Sitio' },
  { href: '/gimnasio-demo/reserva', label: 'Reservar clase' },
  { href: '/gimnasio-demo/mis-clases', label: 'Mis clases' },
]

/** El rubro activo de la demo: viaja en ?rubro= para que cada link lo conserve. */
export function useRubroDemo(): [RubroGym, (key: string) => void] {
  const router = useRouter()
  const key = typeof router.query.rubro === 'string' ? router.query.rubro : RUBRO_DEFAULT
  const set = (k: string) => router.replace({ pathname: router.pathname, query: { ...router.query, rubro: k } }, undefined, { shallow: true, scroll: false })
  return [rubroPorKey(key), set]
}

const CSS = `
  .gid-barra { position: sticky; top: 0; z-index: 120; box-sizing: border-box; height: 40px; display: flex; align-items: center; gap: 10px; padding: 0 12px 0 14px; font-size: 12px; color: #B6C2DA; background: #05080F; border-bottom: 1px solid rgba(147,197,253,0.2); }
  .gid-marca { display: inline-flex; align-items: center; gap: 8px; height: 40px; flex-shrink: 0; color: #F1F5FD; text-decoration: none; }
  .gid-marca b { font-size: 13px; font-weight: 700; }
  .gid-marca i { font-style: normal; color: #8794B2; font-weight: 500; }
  .gid-pildora { display: inline-flex; align-items: center; height: 22px; padding: 0 9px; border-radius: 999px; flex-shrink: 0; font-family: "Geist Mono", ui-monospace, monospace; font-size: 10px; letter-spacing: 0.1em; text-transform: uppercase; white-space: nowrap; color: #FCD34D; background: rgba(251,191,36,0.10); border: 1px solid rgba(251,191,36,0.26); }
  .gid-barra nav { display: flex; align-items: stretch; gap: 2px; height: 40px; flex: 1; min-width: 0; overflow-x: auto; scrollbar-width: none; padding: 0 6px; }
  .gid-barra nav::-webkit-scrollbar { display: none; }
  .gid-barra nav a { display: inline-flex; align-items: center; height: 40px; padding: 0 10px; flex-shrink: 0; color: #9AA8C7; font-weight: 500; text-decoration: none; white-space: nowrap; border-bottom: 2px solid transparent; }
  .gid-barra nav a[aria-current='page'] { color: #F1F5FD; font-weight: 600; border-bottom-color: #60A5FA; }
  .gid-barra nav a:focus-visible, .gid-marca:focus-visible { outline: 2px solid #60A5FA; outline-offset: -3px; }
  .gid-alta { display: inline-flex; align-items: center; gap: 6px; height: 24px; max-width: 200px; padding: 0 4px 0 10px; flex-shrink: 0; border-radius: 999px; border: 1px solid rgba(96,165,250,0.4); background: rgba(59,130,246,0.14); color: #DBEAFE; font: inherit; font-size: 11.5px; font-weight: 600; cursor: pointer; }
  .gid-sel { height: 28px; border-radius: 999px; border: 1px solid rgba(147,197,253,0.3); background: rgba(147,197,253,0.08); color: #F1F5FD; font: inherit; font-size: 12px; font-weight: 600; padding: 0 10px; flex-shrink: 0; max-width: 180px; }
  @media (max-width: 1080px) { .gid-pildora { display: none; } }
  @media (max-width: 860px) { .gid-alta { display: none; } }
  @media (max-width: 640px) { .gid-barra { gap: 4px; padding: 0 8px 0 10px; } .gid-marca b, .gid-marca i { display: none; } .gid-barra nav a { padding: 0 9px; font-size: 13px; } .gid-sel { font-size: 16px; max-width: 120px; } }
`

export function BarraDemo() {
  const router = useRouter()
  const [rubro, setRubro] = useRubroDemo()
  const { demo, reiniciar } = useDemoGym()
  const navRef = useRef<HTMLElement>(null)
  useEffect(() => {
    const nav = navRef.current
    const activa = nav?.querySelector<HTMLElement>('a[aria-current="page"]')
    if (!nav || !activa) return
    nav.scrollLeft = Math.max(0, activa.offsetLeft - (nav.clientWidth - activa.offsetWidth) / 2)
  }, [router.pathname])
  const hayCambios = Object.keys(demo.negocios).length > 0 || Object.keys(demo.cambios).length > 0 || Object.values(demo.inscripciones).some(l => l && l.length) || Object.values(demo.socios).some(l => l && l.length) || Object.keys(demo.cambiosSocio).length > 0
  return (
    <div className="gid-barra" role="region" aria-label="Barra de la demo de Gimnasio">
      <style>{CSS}</style>
      <Link href={{ pathname: '/gimnasio-demo', query: { rubro: rubro.key } }} className="gid-marca" aria-label="Órbita Gimnasio: ir al índice de la demo">
        <OrbitaLogo size={18} />
        <b>Órbita <i>Gimnasio</i></b>
      </Link>
      {hayCambios
        ? <button type="button" className="gid-alta" onClick={reiniciar} title="Borrar lo cargado en la demo y volver a los datos de ejemplo"><span>Con cambios tuyos</span><X size={14} aria-hidden /></button>
        : <span className="gid-pildora">Vista previa local</span>}
      <nav ref={navRef} aria-label="Pantallas de la demo">
        {PANTALLAS.map(p => <Link key={p.href} href={{ pathname: p.href, query: { rubro: rubro.key } }} aria-current={router.pathname === p.href ? 'page' : undefined}>{p.label}</Link>)}
      </nav>
      <select className="gid-sel" aria-label="Rubro de ejemplo" value={rubro.key} onChange={e => setRubro(e.target.value)}>
        {RUBROS_GYM.map(r => <option key={r.key} value={r.key}>{r.label}</option>)}
      </select>
    </div>
  )
}
