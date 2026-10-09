import { useState } from 'react'
import { platformApi, type InstagramPedido } from '@/lib/platform/api'
import { Toast, type ToastVariant } from '@/design-system/components/Toast'
import { useFetch, Card, Table, Chip, Loader, ErrorBox, Empty, PageHeader, dateTime, btnGhostSm, btnPrimary } from './ui'

// Instagram: pedidos de acceso anticipado de los negocios.
//
// Mientras la app de Meta no tenga acceso avanzado, solo conectan las cuentas sumadas como
// evaluadoras. El dueño deja su @usuario en la bandeja de Mensajes; acá se ve el pedido, se
// suma la cuenta como evaluadora (Meta → app → Roles → Agregar personas → Evaluador de
// Instagram) y recién después se toca "Habilitar", que abre el botón de conectar de ese
// negocio. Cuando Meta apruebe el review, esta pestaña deja de hacer falta.

type Aviso = { variant: ToastVariant; title: string; description?: string }

export function TabInstagram({ puedeHabilitar, onCambio }: { puedeHabilitar: boolean; onCambio?: () => void }) {
  const [tick, setTick] = useState(0)
  const [trabajando, setTrabajando] = useState<string | null>(null)
  const [aviso, setAviso] = useState<Aviso | null>(null)
  const { data, error, loading } = useFetch(() => platformApi.instagramPedidos(), [tick])

  async function cambiar(p: InstagramPedido, habilitar: boolean) {
    setTrabajando(p.businessId)
    try {
      await (habilitar ? platformApi.instagramHabilitar(p.businessId) : platformApi.instagramDeshabilitar(p.businessId))
      setAviso({ variant: 'success', title: habilitar ? `${p.business.name} habilitado` : `${p.business.name}: acceso quitado` })
      setTick((t) => t + 1)
      onCambio?.()
    } catch {
      setAviso({ variant: 'error', title: 'No se pudo cambiar el acceso', description: 'Probá de nuevo en un momento.' })
    } finally {
      setTrabajando(null)
    }
  }

  const pendientes = (data ?? []).filter((p) => p.status === 'PENDING').length

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <PageHeader
        title="Instagram"
        subtitle={pendientes > 0 ? `${pendientes} pedido${pendientes === 1 ? '' : 's'} esperando` : 'Pedidos de acceso anticipado de los negocios'}
      />
      <p style={{ margin: 0, maxWidth: 680, fontSize: 13, lineHeight: 1.6, color: 'var(--color-muted)' }}>
        Orden: 1) sumá la cuenta como evaluadora en Meta (Roles → Agregar personas → Evaluador de Instagram), 2) recién ahí tocá <strong>Habilitar</strong>.
        Habilitar es avisarle al dueño que <strong>la invitación ya está enviada</strong>: le aparece &quot;Aceptá la invitación y conectá&quot;.
        Mientras no lo hagas, él ve &quot;Pendiente de confirmación&quot; y sabe que no tiene que buscar nada en Instagram.
      </p>
      {error ? <ErrorBox msg="No se pudieron cargar los pedidos." action={<button style={btnGhostSm} onClick={() => setTick((t) => t + 1)}>Reintentar</button>} /> : loading && !data ? <Loader /> : (
        <Card noPad>
          {data && data.length > 0 ? (
            <Table
              head={['Negocio', 'Instagram', 'Pedido', 'Estado', '']}
              alignRight={[4]}
              rows={data.map((p) => ({
                key: p.businessId,
                cells: [
                  <span key="n"><strong>{p.business.name}</strong> <span style={{ color: 'var(--color-muted)' }}>{p.business.subdomain}</span></span>,
                  <a key="u" href={`https://www.instagram.com/${p.username}/`} target="_blank" rel="noreferrer" style={{ color: 'var(--color-primary)' }}>@{p.username}</a>,
                  dateTime(p.requestedAt),
                  <Chip key="e" text={p.status === 'ENABLED' ? 'Habilitado' : 'Pendiente'} tone={p.status === 'ENABLED' ? 'green' : 'amber'} dot />,
                  puedeHabilitar ? (
                    <button
                      key="a"
                      type="button"
                      style={p.status === 'ENABLED' ? btnGhostSm : { ...btnPrimary, height: 30, padding: '0 12px', fontSize: 12.5 }}
                      disabled={trabajando === p.businessId}
                      onClick={() => cambiar(p, p.status !== 'ENABLED')}
                    >
                      {p.status === 'ENABLED' ? 'Quitar acceso' : 'Habilitar'}
                    </button>
                  ) : null,
                ],
              }))}
            />
          ) : (
            <Empty text="Todavía nadie pidió acceso a Instagram." />
          )}
        </Card>
      )}
      {aviso && <Toast variant={aviso.variant} title={aviso.title} description={aviso.description} onClose={() => setAviso(null)} />}
    </div>
  )
}
