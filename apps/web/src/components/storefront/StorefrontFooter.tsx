import { useState } from 'react'
import { Mail, Clock, MessageCircle, RotateCcw } from 'lucide-react'
import type { TiendaConfig } from '@/lib/storefront/types'
import { openWpp, urlRedSocial } from '@/lib/storefront/utils'
import { InstagramIcon, FacebookIcon, TiktokIcon } from './SocialIcons'
import { ReturnRequestModal } from './ReturnRequestModal'
import { SocialProofToast } from './SocialProofToast'

type Contact = { scheduleText?: string | null; instagram?: string | null; tiktok?: string | null; facebook?: string | null }
type Props = {
  tienda: TiendaConfig
  slug: string
  logoUrl?: string | null
  contact?: Contact | null
  // Toggle de Apariencia — gatea solo la fila de íconos sociales, el resto del
  // footer (horario, email) se muestra automáticamente según haya o no dato real.
  showSocial?: boolean
  // Toggle maestro "Mostrar footer" de Apariencia — antes no se chequeaba en
  // ningún lado y el footer se veía siempre sin importar el valor guardado.
  visible?: boolean
}

export function StorefrontFooter({ tienda, slug, logoUrl, contact, showSocial = true, visible = true }: Props) {
  const [devolucionAbierta, setDevolucionAbierta] = useState(false)
  if (!visible) return null
  const socialLinks = [
    // El dueño puede haber cargado el usuario solo ("mi_negocio") o el link
    // completo — urlRedSocial() arma la URL de verdad en cualquiera de los
    // dos casos (ver el comentario ahí).
    contact?.instagram ? { href: urlRedSocial(contact.instagram, 'instagram'), Icon: InstagramIcon, label: 'Instagram' } : null,
    contact?.tiktok ? { href: urlRedSocial(contact.tiktok, 'tiktok'), Icon: TiktokIcon, label: 'TikTok' } : null,
    contact?.facebook ? { href: urlRedSocial(contact.facebook, 'facebook'), Icon: FacebookIcon, label: 'Facebook' } : null,
  ].filter((x): x is { href: string; Icon: typeof InstagramIcon; label: string } => x !== null)

  const base = `/tienda/${slug}`
  return (
    <footer style={{
      borderTop: '1px solid var(--color-border)',
      background: 'var(--color-surface)',
      padding: '48px 32px 24px',
    }}>
      <style>{`
        @media (max-width: 768px) {
          .sf-footer-outer  { padding: 32px 16px 20px !important; }
          .sf-footer-grid   { grid-template-columns: 1fr 1fr !important; gap: 28px !important; }
          .sf-footer-bottom { flex-direction: column !important; align-items: flex-start !important; gap: 8px !important; }
        }
        @media (max-width: 480px) {
          .sf-footer-grid { grid-template-columns: minmax(0,1fr) !important; }
        }
      `}</style>
      <div style={{ maxWidth: 1280, margin: '0 auto' }}>
        <div className="sf-footer-grid" style={{
          display: 'grid', gridTemplateColumns: '1.4fr 1fr 1fr 1.2fr',
          gap: 40, marginBottom: 32,
        }}>
          {/* Marca */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              {logoUrl ? (
                <img src={logoUrl} alt="" style={{ width: 26, height: 26, borderRadius: 7, objectFit: 'cover' }} />
              ) : (
                <div style={{
                  width: 26, height: 26, borderRadius: 7,
                  background: 'linear-gradient(135deg, #2563EB, #3B82F6)',
                  display: 'grid', placeItems: 'center',
                }}>
                  <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#fff' }} />
                </div>
              )}
              <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--color-text)' }}>{tienda.nombre}</span>
            </div>
            <p style={{ fontSize: 13, color: 'var(--color-muted)', maxWidth: 220, lineHeight: 1.5 }}>
              {tienda.sub}
            </p>
            {tienda.wpp && (
              <button
                onClick={() => openWpp(tienda.wpp, 'Hola! Quería hacer una consulta.')}
                className="ds-hover"
                style={{
                  marginTop: 16,
                  display: 'inline-flex', alignItems: 'center', gap: 8,
                  height: 38, padding: '0 14px', borderRadius: 8,
                  background: 'rgba(16,185,129,0.10)',
                  border: '1px solid rgba(16,185,129,0.30)',
                  color: 'var(--color-success)',
                  fontSize: 13, fontWeight: 600,
                }}
              >
                <MessageCircle size={16} strokeWidth={1.5} /> Escribinos
              </button>
            )}
            {showSocial && socialLinks.length > 0 && (
              <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
                {socialLinks.map(({ href, Icon, label }) => (
                  <a
                    key={label} href={href} target="_blank" rel="noopener noreferrer" aria-label={label}
                    className="ds-hover"
                    style={{ width: 32, height: 32, borderRadius: 8, display: 'grid', placeItems: 'center', background: 'var(--color-bg)', border: '1px solid var(--color-border)', color: 'var(--color-muted)' }}
                  >
                    <Icon size={15} />
                  </a>
                ))}
              </div>
            )}
          </div>

          {/* Tienda */}
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--color-subtle)', marginBottom: 14 }}>
              Tienda
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[
                ['Inicio', base],
                ['Catálogo', `${base}/catalogo`],
                ['Novedades', `${base}/catalogo`],
                ['Ofertas', `${base}/catalogo`],
              ].map(([label, href]) => (
                <a key={label} href={href} className="ds-link" style={{ fontSize: 13, color: 'var(--color-body)', textDecoration: 'none' }}>
                  {label}
                </a>
              ))}
            </div>
          </div>

          {/* Mi cuenta */}
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--color-subtle)', marginBottom: 14 }}>
              Mi cuenta
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[
                ['Ingresar', `${base}/login`],
                ['Crear cuenta', `${base}/registro`],
                ['Mis pedidos', `${base}/pedido`],
                ['Iniciar cambio', `${base}/pedido`],
              ].map(([label, href]) => (
                <a key={label} href={href} className="ds-link" style={{ fontSize: 13, color: 'var(--color-body)', textDecoration: 'none' }}>
                  {label}
                </a>
              ))}
            </div>
          </div>

          {/* Contacto */}
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--color-subtle)', marginBottom: 14 }}>
              Contacto
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 13, color: 'var(--color-body)' }}>
              {tienda.email && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Mail size={14} strokeWidth={1.5} color="var(--color-muted)" /> {tienda.email}
                </div>
              )}
              {contact?.scheduleText && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Clock size={14} strokeWidth={1.5} color="var(--color-muted)" /> {contact.scheduleText}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Bottom */}
        <div className="sf-footer-bottom" style={{
          borderTop: '1px solid var(--color-border)', paddingTop: 20,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          fontSize: 12, color: 'var(--color-subtle)', gap: 12, flexWrap: 'wrap',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontFamily: '"Geist Mono", monospace' }}>
              Powered by <strong style={{ color: 'var(--color-muted)' }}>Órbita</strong>
            </div>
            {/* Jerarquía visual propia (botón real, no un link más) — RBT-683:
                derecho de arrepentimiento y garantía legal, sin login. */}
            <button
              type="button"
              className="ds-hover"
              onClick={() => setDevolucionAbierta(true)}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 7,
                height: 34, padding: '0 14px', borderRadius: 999,
                background: 'var(--color-primary-bg)',
                border: '1px solid var(--color-primary)',
                color: 'var(--color-primary)',
                fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              <RotateCcw size={13} strokeWidth={2} /> Arrepentimiento / Devolución
            </button>
          </div>
          <div style={{ fontSize: 11, color: 'var(--color-subtle)', fontFamily: '"Geist Mono", monospace' }}>
            © 2026 {tienda.nombre} · Todos los derechos reservados
          </div>
        </div>
      </div>

      <ReturnRequestModal isOpen={devolucionAbierta} onClose={() => setDevolucionAbierta(false)} slug={slug} tienda={tienda} />
      <SocialProofToast slug={slug} />
    </footer>
  )
}
