// Franja de la tienda demo (arriba de todo, en todas las páginas de las dos
// tiendas de la demo): dice que es una demo y deja pasar de la tienda de ropa
// a la de tecnología y al revés (lib/demo/modo.ts, TIENDAS_DEMO). Cada tienda
// es su propio negocio y subdominio, así que cambiar es navegar a la portada
// de la otra: los productos no son los mismos y no hay una "página
// equivalente". El panel de la demo es uno solo (el de Nébula Tech).
//
// Neutra a propósito: no usa los colores de la tienda (no es parte de su
// diseño) ni un acento propio; lo único que resalta es la tienda actual.
import { useEffect, useState } from 'react'
import { ROOT_DOMAIN, currentSlug, tenantUrl } from '@/lib/tenant'
import { DEMO_SLUG, TIENDAS_DEMO } from '@/lib/demo/modo'

// En el server no hay window: arranca con la URL de producción y se corrige
// al montar (dev con subdominios: http y :3001; dev sin subdominios: /tienda/<slug>).
const urlInicial = (slug: string, path: string) => `https://${slug}.${ROOT_DOMAIN}${path}`

function urlDe(slug: string, path: string): string {
  return currentSlug() ? tenantUrl(slug, path) : path === '/' ? `/tienda/${slug}` : path
}

export function BarraDemo({ slug }: { slug: string }) {
  const [urls, setUrls] = useState(() => ({
    tiendas: Object.fromEntries(TIENDAS_DEMO.map(t => [t.slug, urlInicial(t.slug, '/')])) as Record<string, string>,
    panel: urlInicial(DEMO_SLUG, '/panel'),
  }))
  useEffect(() => {
    setUrls({
      tiendas: Object.fromEntries(TIENDAS_DEMO.map(t => [t.slug, urlDe(t.slug, '/')])),
      // Sin subdominios (dev) el panel es /panel del mismo host.
      panel: currentSlug() ? tenantUrl(DEMO_SLUG, '/panel') : '/panel',
    })
  }, [])

  return (
    <div className="dm-barra" role="region" aria-label="Demo de Órbita">
      <style>{CSS}</style>
      <span className="dm-titulo">
        Demo de Órbita<span className="dm-largo"> · elegí qué tienda ver</span>
      </span>
      <nav className="dm-selector" aria-label="Tienda de la demo">
        {TIENDAS_DEMO.map(t => {
          const actual = t.slug === slug
          return (
            <a
              key={t.slug}
              href={urls.tiendas[t.slug]}
              className={actual ? 'dm-op dm-actual' : 'dm-op'}
              aria-current={actual ? 'page' : undefined}
            >
              <span className="dm-largo">{t.rubro}</span>
              <span className="dm-corto">{t.corto}</span>
            </a>
          )
        })}
      </nav>
      <a href={urls.panel} className="dm-panel">
        Ver el panel<span className="dm-largo"> como dueño</span>
      </a>
    </div>
  )
}

const CSS = `
.dm-barra{display:flex;align-items:center;justify-content:space-between;gap:12px;min-height:44px;padding:4px 16px;background:#0F172A;color:#CBD5E1;font-family:Inter,system-ui,-apple-system,'Segoe UI',sans-serif;font-size:13px;line-height:1.2}
.dm-titulo{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.dm-selector{display:flex;gap:2px;padding:2px;border-radius:9px;background:rgba(255,255,255,.08);flex-shrink:0}
.dm-op{display:inline-flex;align-items:center;min-height:32px;padding:0 12px;border-radius:7px;color:#E2E8F0;text-decoration:none;font-weight:500;white-space:nowrap;cursor:pointer;transition:background-color .15s ease,color .15s ease}
.dm-op:hover{background:rgba(255,255,255,.1);color:#fff}
.dm-op.dm-actual{background:#fff;color:#0F172A;font-weight:600;cursor:default}
.dm-panel{color:#E2E8F0;text-decoration:underline;text-underline-offset:3px;text-decoration-color:rgba(226,232,240,.4);white-space:nowrap;cursor:pointer;transition:color .15s ease}
.dm-panel:hover{color:#fff;text-decoration-color:#fff}
.dm-op:focus-visible,.dm-panel:focus-visible{outline:2px solid #fff;outline-offset:2px}
.dm-corto{display:none}
@media (max-width:640px){
  .dm-barra{padding:4px 12px;gap:8px;font-size:12.5px}
  .dm-largo{display:none}
  .dm-corto{display:inline}
  .dm-op{padding:0 10px}
}
@media (prefers-reduced-motion:reduce){.dm-op,.dm-panel{transition:none}}
`
