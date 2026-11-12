import { useEffect, useState } from 'react'
import { Search } from 'lucide-react'
import { platformApi, type BusinessContactRow } from '@/lib/platform/api'
import { ROOT_DOMAIN, tenantUrl } from '@/lib/tenant'
import { useFetch, Card, Table, Loader, ErrorBox, PageHeader, inputStyle } from './ui'

// Negocios para el rol MARKETING: solo cómo contactar a cada negocio y dónde está su tienda. Sin estado, suscripción,
// ventas ni conteos, y sin ficha: el servidor tampoco se los da (GET /platform/business-contacts, ver
// apps/api/src/platform/contactos-negocios.ts).

const link: React.CSSProperties = { color: 'var(--color-primary)', textDecoration: 'none', wordBreak: 'break-all' }
const secundario: React.CSSProperties = { fontSize: 12.5, color: 'var(--color-muted)' }
const mono = '"Geist Mono", monospace'
const vacio = <span style={{ color: 'var(--color-subtle)' }}>—</span>

const sinArroba = (v: string) => v.replace(/^@/, '')
const esUrl = (v: string) => /^https?:\/\//i.test(v)

const redes = (c: BusinessContactRow['contact']) =>
  [
    c.instagram && { red: 'Instagram', texto: esUrl(c.instagram) ? c.instagram : `@${sinArroba(c.instagram)}`, url: esUrl(c.instagram) ? c.instagram : `https://www.instagram.com/${sinArroba(c.instagram)}` },
    c.tiktok && { red: 'TikTok', texto: esUrl(c.tiktok) ? c.tiktok : `@${sinArroba(c.tiktok)}`, url: esUrl(c.tiktok) ? c.tiktok : `https://www.tiktok.com/@${sinArroba(c.tiktok)}` },
    c.facebook && { red: 'Facebook', texto: c.facebook, url: esUrl(c.facebook) ? c.facebook : `https://www.facebook.com/${c.facebook}` },
  ].filter((r): r is { red: string; texto: string; url: string } => !!r)

export function TabNegociosContacto() {
  const [search, setSearch] = useState('')
  const [debounced, setDebounced] = useState('')
  useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim()), 300)
    return () => clearTimeout(t)
  }, [search])

  const { data, error } = useFetch(() => platformApi.businessContacts({ search: debounced, limit: 100 }), [debounced])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <PageHeader title="Negocios" subtitle="Cómo contactar a cada negocio y la dirección de su tienda." />

      <div style={{ position: 'relative', width: '100%', maxWidth: 440 }}>
        <Search size={16} strokeWidth={1.75} style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-muted)', pointerEvents: 'none' }} />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por nombre, dirección web, rubro o dueño…"
          aria-label="Buscar negocios"
          className="ds-field"
          style={{ ...inputStyle, width: '100%', paddingLeft: 38 }}
        />
      </div>

      {error ? (
        <ErrorBox msg="No se pudo cargar la lista de negocios." />
      ) : !data ? (
        <Loader />
      ) : (
        <Card noPad>
          <Table
            head={['Negocio', 'Dueño/a', 'Contacto de la tienda', 'Tienda']}
            alignRight={[]}
            rows={data.data.map((b) => {
              const wa = b.contact.whatsapp?.replace(/\D/g, '')
              const rs = redes(b.contact)
              const tieneContacto = b.contact.email || wa || rs.length > 0
              return {
                key: b.id,
                cells: [
                  <div key="n">
                    <div style={{ fontWeight: 600, color: 'var(--color-text)', marginBottom: 2 }}>{b.name}</div>
                    <div style={secundario}>{b.industry}</div>
                  </div>,
                  b.owner ? (
                    <div key="o">
                      <div style={{ color: 'var(--color-text)', marginBottom: 2 }}>{b.owner.name}</div>
                      <a href={`mailto:${b.owner.email}`} style={{ ...link, fontSize: 12.5 }}>{b.owner.email}</a>
                    </div>
                  ) : <span key="o" style={{ color: 'var(--color-subtle)' }}>Sin dueño/a</span>,
                  tieneContacto ? (
                    <div key="c" style={{ display: 'flex', flexDirection: 'column', gap: 3, fontSize: 12.5 }}>
                      {b.contact.email && <a href={`mailto:${b.contact.email}`} style={link}>{b.contact.email}</a>}
                      {wa && (
                        <span>
                          <span style={{ color: 'var(--color-muted)' }}>WhatsApp </span>
                          <a href={`https://wa.me/${wa}`} target="_blank" rel="noreferrer" style={{ ...link, fontFamily: mono }}>{b.contact.whatsapp}</a>
                        </span>
                      )}
                      {rs.map((r) => (
                        <span key={r.red}>
                          <span style={{ color: 'var(--color-muted)' }}>{r.red} </span>
                          <a href={r.url} target="_blank" rel="noreferrer" style={link}>{r.texto}</a>
                        </span>
                      ))}
                    </div>
                  ) : <span key="c">{vacio}</span>,
                  <div key="t" style={{ display: 'flex', flexDirection: 'column', gap: 3, fontSize: 12.5, fontFamily: mono }}>
                    <a href={tenantUrl(b.store.subdomain)} target="_blank" rel="noreferrer" style={link}>{b.store.subdomain}.{ROOT_DOMAIN}</a>
                    {b.store.customDomains.map((d) => (
                      <a key={d} href={`https://${d}`} target="_blank" rel="noreferrer" style={link}>{d}</a>
                    ))}
                  </div>,
                ],
              }
            })}
          />
          <div style={{ padding: '12px 18px', fontSize: 12.5, color: 'var(--color-muted)', borderTop: '1px solid var(--color-border)' }}>
            {data.total === 1 ? '1 negocio' : `${data.total} negocios`}{data.total > data.data.length ? ` · se muestran los primeros ${data.data.length}` : ''}
          </div>
        </Card>
      )}
    </div>
  )
}
