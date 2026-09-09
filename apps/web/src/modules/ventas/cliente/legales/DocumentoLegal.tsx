// Página de un documento legal de la tienda (Términos y Condiciones de Compra
// o Política de Privacidad), linkeada desde el footer de todas las tiendas.
//
// El texto sale de lib/storefront/legales.ts, con los datos del Comercio ya
// completados: el dueño no tiene que redactar ni editar nada. Misma
// estructura que el resto de las páginas del storefront (chrome, footer,
// WhatsApp flotante) para que se lea como parte de la tienda y no como un
// PDF pegado.

import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { FileText, ShieldCheck } from 'lucide-react'
import { StorefrontChrome } from '@/components/storefront/StorefrontChrome'
import { StorefrontFooter } from '@/components/storefront/StorefrontFooter'
import { FloatingWhatsapp } from '@/components/storefront/FloatingWhatsapp'
import { Breadcrumb } from '@/components/storefront/Breadcrumb'
import { SkeletonText } from '@/design-system/components/Skeleton'
import { getStorefrontConfig, toTiendaConfig, type StorefrontConfigResponse } from '@/lib/storefront/api'
import { armarDocumentoLegal, type TipoDocumentoLegal } from '@/lib/storefront/legales'

const META: Record<TipoDocumentoLegal, { corto: string; Icon: typeof FileText; otro: TipoDocumentoLegal; otroLabel: string }> = {
  terminos: { corto: 'Términos y condiciones', Icon: FileText, otro: 'privacidad', otroLabel: 'Política de privacidad' },
  privacidad: { corto: 'Política de privacidad', Icon: ShieldCheck, otro: 'terminos', otroLabel: 'Términos y condiciones' },
}

export default function DocumentoLegal({ tipo }: { tipo: TipoDocumentoLegal }) {
  const router = useRouter()
  const { slug } = router.query as { slug: string }
  const base = `/tienda/${slug}`

  const [config, setConfig] = useState<StorefrontConfigResponse | null>(null)
  useEffect(() => {
    if (!slug) return
    let cancelado = false
    getStorefrontConfig(slug).then(cfg => { if (!cancelado) setConfig(cfg) }).catch(() => {})
    return () => { cancelado = true }
  }, [slug])
  const tienda = config ? toTiendaConfig(config) : { nombre: '', sub: '', slug: slug ?? '', dominio: '', wpp: '', email: '' }

  const meta = META[tipo]
  const doc = config ? armarDocumentoLegal(tipo, config) : null

  return (
    <StorefrontChrome tienda={tienda} config={config}>
      <style>{`
        .sf-legal { max-width: 820px; margin: 0 auto; padding: 32px 32px 72px; }
        .sf-legal-head { display: flex; align-items: flex-start; gap: 16px; margin: 20px 0 8px; }
        .sf-legal-icono { width: 44px; height: 44px; border-radius: 12px; flex-shrink: 0; display: grid; place-items: center; background: var(--color-primary-bg); color: var(--color-primary); }
        .sf-legal h1 { font-size: 26px; font-weight: 800; letter-spacing: -0.02em; line-height: 1.2; color: var(--color-text); margin: 0; }
        .sf-legal-fecha { font-size: 12.5px; color: var(--color-muted); margin: 6px 0 0; font-family: "Geist Mono", monospace; }
        .sf-legal-cuerpo { margin-top: 28px; display: flex; flex-direction: column; gap: 26px; }
        .sf-legal h2 { font-size: 16px; font-weight: 700; color: var(--color-text); margin: 0 0 10px; letter-spacing: -0.01em; }
        .sf-legal p { font-size: 14.5px; line-height: 1.7; color: var(--color-body); margin: 0 0 10px; }
        .sf-legal ul { margin: 0 0 10px; padding-left: 22px; }
        .sf-legal li { font-size: 14.5px; line-height: 1.7; color: var(--color-body); margin-bottom: 4px; }
        .sf-legal-pie { margin-top: 36px; padding-top: 20px; border-top: 1px solid var(--color-border); display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; font-size: 13px; color: var(--color-muted); }
        .sf-legal-pie a { color: var(--color-primary); font-weight: 600; text-decoration: none; }
        @media (max-width: 768px) {
          .sf-legal { padding: 20px 16px 56px; }
          .sf-legal h1 { font-size: 22px; }
          .sf-legal p, .sf-legal li { font-size: 14px; }
        }
      `}</style>

      <div className="sf-legal">
        <Breadcrumb items={[{ label: 'Inicio', href: base }, { label: meta.corto }]} />

        {!doc ? (
          <div aria-hidden="true" style={{ marginTop: 20 }}>
            <SkeletonText width="60%" height={26} style={{ marginBottom: 12 }} />
            <SkeletonText width="30%" height={12} style={{ marginBottom: 32 }} />
            {[0, 1, 2, 3].map(i => (
              <div key={i} style={{ marginBottom: 26 }}>
                <SkeletonText width="40%" height={16} delay={i * 60} style={{ marginBottom: 10 }} />
                <SkeletonText width="100%" height={12} delay={i * 60 + 30} style={{ marginBottom: 6 }} />
                <SkeletonText width="92%" height={12} delay={i * 60 + 60} style={{ marginBottom: 6 }} />
                <SkeletonText width="75%" height={12} delay={i * 60 + 90} />
              </div>
            ))}
          </div>
        ) : (
          <article aria-labelledby="sf-legal-titulo">
            <div className="sf-legal-head">
              <div className="sf-legal-icono" aria-hidden="true"><meta.Icon size={22} strokeWidth={1.8} /></div>
              <div style={{ minWidth: 0 }}>
                <h1 id="sf-legal-titulo">{doc.titulo}</h1>
                <p className="sf-legal-fecha">Última actualización: {doc.actualizado}</p>
              </div>
            </div>

            <div className="sf-legal-cuerpo">
              {doc.secciones.map(s => (
                <section key={s.titulo}>
                  <h2>{s.titulo}</h2>
                  {s.bloques.map((b, i) => b.tipo === 'parrafo'
                    ? <p key={i}>{b.texto}</p>
                    : <ul key={i}>{b.items.map(item => <li key={item}>{item}</li>)}</ul>)}
                </section>
              ))}
            </div>

            <div className="sf-legal-pie">
              <span>{tienda.nombre} · tienda creada con Órbita</span>
              <a href={`${base}/legales/${meta.otro}`} className="ds-link">{meta.otroLabel} →</a>
            </div>
          </article>
        )}
      </div>

      <StorefrontFooter tienda={tienda} slug={slug} logoUrl={config?.appearance?.logoUrl} contact={config?.contact} showSocial={config?.appearance?.showSocialFooter ?? true} visible={config?.appearance?.showFooter ?? true} />
      <FloatingWhatsapp wpp={tienda.wpp} visible={!!config?.appearance?.showWhatsapp && !!tienda.wpp} message={config?.appearance?.whatsappText} />
    </StorefrontChrome>
  )
}
