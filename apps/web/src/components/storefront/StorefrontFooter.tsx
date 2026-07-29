import { Mail, Clock, MessageCircle } from 'lucide-react'
import type { TiendaConfig } from '@/lib/storefront/types'
import { openWpp } from '@/lib/storefront/utils'
import { InstagramIcon, FacebookIcon, TiktokIcon } from './SocialIcons'

type Contact = { scheduleText?: string | null; instagram?: string | null; tiktok?: string | null; facebook?: string | null }
type Props = {
  tienda: TiendaConfig
  slug: string
  logoUrl?: string | null
  contact?: Contact | null
  // Toggle de Apariencia — gatea solo la fila de íconos sociales, el resto del
  // footer (horario, email) se muestra automáticamente según haya o no dato real.
  showSocial?: boolean
}

export function StorefrontFooter({ tienda, slug, logoUrl, contact, showSocial = true }: Props) {
  const socialLinks = [
    contact?.instagram ? { href: contact.instagram, Icon: InstagramIcon, label: 'Instagram' } : null,
    contact?.tiktok ? { href: contact.tiktok, Icon: TiktokIcon, label: 'TikTok' } : null,
    contact?.facebook ? { href: contact.facebook, Icon: FacebookIcon, label: 'Facebook' } : null,
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
          .sf-footer-grid { grid-template-columns: 1fr !important; }
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
                style={{
                  marginTop: 16,
                  display: 'inline-flex', alignItems: 'center', gap: 8,
                  height: 38, padding: '0 14px', borderRadius: 8,
                  background: 'rgba(16,185,129,0.10)',
                  border: '1px solid rgba(16,185,129,0.30)',
                  color: 'var(--color-success)',
                  fontSize: 13, fontWeight: 600, cursor: 'pointer',
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
                    style={{ width: 32, height: 32, borderRadius: 8, display: 'grid', placeItems: 'center', background: 'var(--color-bg)', border: '1px solid var(--color-border)', color: 'var(--color-muted)', transition: 'color 150ms' }}
                    onMouseEnter={e => (e.currentTarget.style.color = 'var(--color-primary)')}
                    onMouseLeave={e => (e.currentTarget.style.color = 'var(--color-muted)')}
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
                <a key={label} href={href} style={{ fontSize: 13, color: 'var(--color-body)', textDecoration: 'none', transition: 'color 150ms' }}
                  onMouseEnter={e => (e.currentTarget.style.color = 'var(--color-primary)')}
                  onMouseLeave={e => (e.currentTarget.style.color = 'var(--color-body)')}>
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
                <a key={label} href={href} style={{ fontSize: 13, color: 'var(--color-body)', textDecoration: 'none', transition: 'color 150ms' }}
                  onMouseEnter={e => (e.currentTarget.style.color = 'var(--color-primary)')}
                  onMouseLeave={e => (e.currentTarget.style.color = 'var(--color-body)')}>
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
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontFamily: '"Geist Mono", monospace' }}>
            Powered by <strong style={{ color: 'var(--color-muted)' }}>Órbita</strong>
          </div>
          <div style={{ fontSize: 11, color: 'var(--color-subtle)', fontFamily: '"Geist Mono", monospace' }}>
            © 2026 {tienda.nombre} · Todos los derechos reservados
          </div>
        </div>
      </div>
    </footer>
  )
}
