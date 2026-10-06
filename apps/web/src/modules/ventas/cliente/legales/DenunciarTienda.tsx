// "Denunciar esta tienda": el formulario al que lleva el link del pie de TODA tienda
// de Órbita (la clásica y las de plantilla).
//
// Lo manda cualquier visitante, sin cuenta, y no le llega a la tienda sino al
// equipo de Órbita (entra a la bandeja de soporte del superadmin y avisa por
// mail). Ahí una persona la revisa y decide qué hacer: ocultar la tienda de
// Google, suspenderla o descartar la denuncia. Acá no se actúa solo, para que
// una denuncia falsa no pueda bajar una tienda.
//
// Misma estructura que las otras páginas legales de la tienda (chrome, footer,
// WhatsApp flotante) para que se lea como parte de ella.

import { useEffect, useState, type CSSProperties, type FormEvent } from 'react'
import { useRouter } from 'next/router'
import { Flag, CheckCircle2 } from 'lucide-react'
import { StorefrontChrome } from '@/components/storefront/StorefrontChrome'
import { StorefrontFooter } from '@/components/storefront/StorefrontFooter'
import { FloatingWhatsapp } from '@/components/storefront/FloatingWhatsapp'
import { Breadcrumb } from '@/components/storefront/Breadcrumb'
import { denunciarTienda, getStorefrontConfig, toTiendaConfig, StorefrontApiError, type MotivoDenuncia, type StorefrontConfigResponse } from '@/lib/storefront/api'

const MOTIVOS: { value: MotivoDenuncia; label: string }[] = [
  { value: 'PRODUCTO_PROHIBIDO', label: 'Vende productos prohibidos o ilegales' },
  { value: 'FALSIFICACION', label: 'Falsificaciones o uso de una marca ajena' },
  { value: 'ESTAFA', label: 'Estafa o publicidad engañosa' },
  { value: 'DATOS_PERSONALES', label: 'Uso indebido de datos personales' },
  { value: 'OTRO', label: 'Otro motivo' },
]

const campo: CSSProperties = {
  width: '100%', boxSizing: 'border-box', border: '1px solid var(--color-border)', borderRadius: 8, padding: '0 12px',
  fontSize: 14, color: 'var(--color-text)', background: 'var(--color-bg)', fontFamily: 'inherit',
}
const etiqueta: CSSProperties = { display: 'block', fontSize: 12.5, fontWeight: 600, color: 'var(--color-text)', marginBottom: 6 }

export default function DenunciarTienda() {
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

  const [motivo, setMotivo] = useState<MotivoDenuncia | ''>('')
  const [detalle, setDetalle] = useState('')
  const [nombre, setNombre] = useState('')
  const [email, setEmail] = useState('')
  const [trampa, setTrampa] = useState('') // campo trampa para bots: una persona nunca lo ve ni lo llena
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState('')
  const [enviada, setEnviada] = useState(false)

  const completo = motivo !== '' && detalle.trim().length >= 10 && nombre.trim().length >= 2 && /^\S+@\S+\.\S+$/.test(email.trim())

  async function enviar(e: FormEvent) {
    e.preventDefault()
    if (!completo || enviando) return
    setEnviando(true)
    setError('')
    try {
      await denunciarTienda(slug, { reason: motivo, details: detalle, name: nombre, email, website: trampa })
      setEnviada(true)
    } catch (err) {
      setError(err instanceof StorefrontApiError && err.status === 429
        ? 'Mandaste varias denuncias seguidas. Esperá unos minutos y probá de nuevo.'
        : 'No pudimos enviar tu denuncia. Probá de nuevo en unos minutos.')
      setEnviando(false)
    }
  }

  return (
    <StorefrontChrome tienda={tienda} config={config}>
      <style>{`
        .sf-den { max-width: 640px; margin: 0 auto; padding: 32px 32px 72px; }
        .sf-den-head { display: flex; align-items: flex-start; gap: 16px; margin: 20px 0 8px; }
        .sf-den-icono { width: 44px; height: 44px; border-radius: 12px; flex-shrink: 0; display: grid; place-items: center; background: var(--color-primary-bg); color: var(--color-primary); }
        .sf-den h1 { font-size: 26px; font-weight: 800; letter-spacing: -0.02em; line-height: 1.2; color: var(--color-text); margin: 0; }
        .sf-den p { font-size: 14.5px; line-height: 1.7; color: var(--color-body); margin: 8px 0 0; }
        .sf-den-form { margin-top: 28px; display: flex; flex-direction: column; gap: 18px; }
        .sf-den-form input:focus-visible, .sf-den-form select:focus-visible, .sf-den-form textarea:focus-visible { outline: 2px solid var(--color-primary); outline-offset: 1px; }
        .sf-den-btn { min-height: 44px; border-radius: 8px; border: none; padding: 0 22px; font-size: 14px; font-weight: 700; cursor: pointer; background: var(--color-primary); color: var(--color-on-primary, #fff); font-family: inherit; }
        .sf-den-btn:disabled { opacity: 0.5; cursor: not-allowed; }
        @media (max-width: 768px) { .sf-den { padding: 20px 16px 56px; } .sf-den h1 { font-size: 22px; } }
      `}</style>

      <div className="sf-den">
        <Breadcrumb items={[{ label: 'Inicio', href: base }, { label: 'Denunciar esta tienda' }]} />

        <div className="sf-den-head">
          <div className="sf-den-icono" aria-hidden="true"><Flag size={22} strokeWidth={1.8} /></div>
          <h1>Denunciar esta tienda</h1>
        </div>

        {enviada ? (
          <div role="status" style={{ marginTop: 24, display: 'flex', gap: 12, alignItems: 'flex-start' }}>
            <CheckCircle2 size={22} strokeWidth={1.8} color="var(--color-success)" style={{ flexShrink: 0, marginTop: 2 }} />
            <p style={{ margin: 0 }}>
              Recibimos tu denuncia. La revisa el equipo de Órbita y, si hace falta algún dato más, te escribimos a <strong>{email.trim()}</strong>.
              Gracias por avisarnos.
            </p>
          </div>
        ) : (
          <>
            <p>
              Si esta tienda vende algo prohibido, usa una marca que no es suya o te parece una estafa, contanos.
              Tu denuncia no le llega a la tienda: la ve el equipo de Órbita, que la revisa y decide si corresponde actuar.
            </p>
            <form className="sf-den-form" onSubmit={enviar} noValidate>
              <div>
                <label htmlFor="den-motivo" style={etiqueta}>Motivo</label>
                <select id="den-motivo" value={motivo} onChange={e => setMotivo(e.target.value as MotivoDenuncia | '')} style={{ ...campo, height: 44 }} required>
                  <option value="" disabled>Elegí un motivo</option>
                  {MOTIVOS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                </select>
              </div>
              <div>
                <label htmlFor="den-detalle" style={etiqueta}>¿Qué pasó? <span style={{ fontWeight: 400, color: 'var(--color-muted)' }}>(si podés, indicá el producto o la página)</span></label>
                <textarea id="den-detalle" value={detalle} onChange={e => setDetalle(e.target.value)} rows={5} maxLength={3000}
                  style={{ ...campo, padding: '10px 12px', resize: 'vertical', lineHeight: 1.5 }} required />
              </div>
              <div>
                <label htmlFor="den-nombre" style={etiqueta}>Tu nombre</label>
                <input id="den-nombre" value={nombre} onChange={e => setNombre(e.target.value)} maxLength={80} autoComplete="name" style={{ ...campo, height: 44 }} required />
              </div>
              <div>
                <label htmlFor="den-email" style={etiqueta}>Tu email</label>
                <input id="den-email" type="email" value={email} onChange={e => setEmail(e.target.value)} maxLength={254} autoComplete="email" style={{ ...campo, height: 44 }} required />
                <span style={{ display: 'block', fontSize: 12, color: 'var(--color-muted)', marginTop: 6 }}>Solo lo usamos para responderte sobre esta denuncia.</span>
              </div>
              {/* Campo trampa: fuera de pantalla y fuera del orden de tabulación; solo un bot lo completa. */}
              <div aria-hidden="true" style={{ position: 'absolute', left: '-9999px', width: 1, height: 1, overflow: 'hidden' }}>
                <label>No completar este campo<input tabIndex={-1} autoComplete="off" value={trampa} onChange={e => setTrampa(e.target.value)} /></label>
              </div>
              {error && <div role="alert" style={{ fontSize: 13.5, color: 'var(--color-error)' }}>{error}</div>}
              <div>
                <button type="submit" className="sf-den-btn" disabled={!completo || enviando}>{enviando ? 'Enviando…' : 'Enviar denuncia'}</button>
              </div>
            </form>
          </>
        )}
      </div>

      <StorefrontFooter tienda={tienda} slug={slug} logoUrl={config?.appearance?.logoUrl} contact={config?.contact} showSocial={config?.appearance?.showSocialFooter ?? true} />
      <FloatingWhatsapp wpp={tienda.wpp} visible={!!config?.appearance?.showWhatsapp && !!tienda.wpp} message={config?.appearance?.whatsappText} />
    </StorefrontChrome>
  )
}
