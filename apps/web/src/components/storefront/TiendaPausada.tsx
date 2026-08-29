import { useEffect, useState } from 'react'
import { Store, Clock, SearchX } from 'lucide-react'
import type { StoreStatusSSR } from '@/lib/storefront/forceSSR'
import { apexUrl } from '@/lib/tenant'

type Props = {
  status: Exclude<StoreStatusSSR, 'ok'>
  nombre?: string | null
  logo?: string | null
}

const COPY: Record<Props['status'], { icon: typeof Store; titulo: string; cuerpo: string }> = {
  paused: {
    icon: Clock,
    titulo: 'Esta tienda está en pausa',
    cuerpo: 'El vendedor va a estar de vuelta pronto. Por ahora no se puede ver el catálogo ni hacer pedidos acá.',
  },
  inactive: {
    icon: Store,
    titulo: 'Esta tienda todavía no está disponible',
    cuerpo: 'Todavía no publicó su catálogo. Volvé a intentarlo más tarde.',
  },
  not_found: {
    icon: SearchX,
    titulo: 'Este subdominio no tiene una tienda todavía',
    cuerpo: 'No encontramos ningún negocio en esta dirección. Puede que el link esté mal escrito, o que todavía nadie haya creado una tienda acá.',
  },
}

// Se muestra en TODAS las rutas de /tienda/[slug]/** (vía _app.tsx +
// forceSSR.ts) cuando el negocio está pausado, nunca se publicó, o el
// subdominio no corresponde a ningún negocio (not_found) — a propósito NO
// se parece a una pantalla de error (nada de rojo, nada de "algo salió
// mal"): es un estado esperado, no una falla del sistema.
export function TiendaPausada({ status, nombre, logo }: Props) {
  const { icon: Icon, titulo, cuerpo } = COPY[status]

  // apexUrl() lee window.location — esta pantalla se resuelve en SSR
  // (forceSSR.ts + _app.tsx). Si se llamara directo en el render, el commit
  // de hidratación vería un mismatch (server sin window → sin puerto/host
  // real) y React 19 lo deja tal cual "sin parchear" (no lo corrige solo,
  // confirmado en consola: "This won't be patched up"). Arrancar en
  // `undefined` mantiene SSR y el primer render del cliente IDÉNTICOS (sin
  // mismatch), y el efecto post-hidratación dispara un update real que sí
  // se aplica — así el puerto no estándar de dev (o cualquier override de
  // ROOT_DOMAIN) queda bien.
  const [ctaHref, setCtaHref] = useState<string | undefined>(undefined)
  useEffect(() => { setCtaHref(apexUrl('/registro')) }, [])

  return (
    <div style={{
      minHeight: '100vh', background: 'var(--color-bg)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: '32px 24px', textAlign: 'center',
    }}>
      {logo
        ? <img src={logo} alt={nombre ?? ''} style={{ width: 56, height: 56, borderRadius: 14, objectFit: 'cover', marginBottom: 20 }} />
        : (
          <div style={{
            width: 64, height: 64, borderRadius: '50%',
            background: 'var(--color-primary-bg)', color: 'var(--color-primary)',
            display: 'grid', placeItems: 'center', marginBottom: 20,
          }}>
            <Icon size={28} strokeWidth={1.5} />
          </div>
        )}

      {nombre && (
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-muted)', letterSpacing: '0.02em', marginBottom: 6 }}>
          {nombre}
        </div>
      )}
      <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--color-text)', margin: '0 0 10px', maxWidth: 420 }}>
        {titulo}
      </h1>
      <p style={{ fontSize: 14, color: 'var(--color-muted)', lineHeight: 1.6, maxWidth: 380, margin: 0 }}>
        {cuerpo}
      </p>

      {status === 'not_found' ? (
        <div style={{ display: 'flex', gap: 10, marginTop: 28, flexWrap: 'wrap', justifyContent: 'center' }}>
          <a
            href={ctaHref ?? 'https://orbita.site'}
            className="ds-hover"
            style={{
              height: 44, padding: '0 20px', borderRadius: 8,
              background: 'var(--color-primary)', color: '#fff', border: 'none',
              fontSize: 14, fontWeight: 600, display: 'inline-flex', alignItems: 'center', textDecoration: 'none',
            }}
          >
            Creá tu tienda
          </a>
          <a
            href="https://orbita.site"
            className="ds-hover"
            style={{
              height: 44, padding: '0 20px', borderRadius: 8,
              background: 'transparent', color: 'var(--color-text)',
              border: '1px solid var(--color-border)', fontSize: 14, fontWeight: 600,
              display: 'inline-flex', alignItems: 'center', textDecoration: 'none',
            }}
          >
            Ir a orbita.site
          </a>
        </div>
      ) : (
        <a
          href="https://orbita.site"
          className="ds-hover"
          style={{
            marginTop: 28, height: 44, padding: '0 20px', borderRadius: 8,
            background: 'transparent', color: 'var(--color-text)',
            border: '1px solid var(--color-border)', fontSize: 14, fontWeight: 600,
            display: 'inline-flex', alignItems: 'center', textDecoration: 'none',
          }}
        >
          Ir a orbita.site
        </a>
      )}
    </div>
  )
}
