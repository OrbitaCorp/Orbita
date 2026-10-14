import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { RequireAuth } from '@/lib/auth/RequireAuth'
import { platformApi, type McpSolicitud } from '@/lib/platform/api'
import { guardarConexionPendiente, olvidarConexionPendiente } from '@/lib/platform/conexionClaude'
import { OrbitLogo, btnGhost, btnPrimary } from '@/modules/superadmin/ui'

// Pantalla donde un superadmin autoriza que SU Claude se conecte a Órbita (Marketing: prospección y videos, con un solo conector).
//
// Claude abre `api.orbita.site/api/v1/mcp/oauth/authorize`, la API valida el pedido y manda a la persona acá con `req`
// (la solicitud firmada). Acá se ve a qué se está dando acceso y se aprueba o se cancela; la API devuelve la dirección
// de Claude a la que volver. Servidor del conector: apps/api/src/marketing/prospeccion/mcp/.
//
// Si todavía no hay sesión, RequireAuth manda al login y se pierde la dirección: por eso `req` se guarda en la pestaña
// y, al entrar al panel, pages/superadmin/index.tsx vuelve acá (ver RetomarConexionPendiente).

export default function ConectarClaudePage() {
  const router = useRouter()
  const req = typeof router.query.req === 'string' ? router.query.req : ''
  useEffect(() => { if (req) guardarConexionPendiente(req) }, [req])
  return (
    <RequireAuth type="platform_admin">
      <Consentimiento req={req} listo={router.isReady} />
    </RequireAuth>
  )
}

function Consentimiento({ req, listo }: { req: string; listo: boolean }) {
  const [datos, setDatos] = useState<McpSolicitud | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [enviando, setEnviando] = useState<'aprobar' | 'cancelar' | null>(null)

  useEffect(() => {
    if (!listo) return
    if (!req) { setError('Falta la solicitud de conexión. Volvé a agregar el conector desde Claude.'); return }
    let cancelado = false
    platformApi.mcpSolicitud(req)
      .then((d) => { if (!cancelado) setDatos(d) })
      .catch((e: unknown) => {
        if (cancelado) return
        olvidarConexionPendiente()
        setError(e instanceof Error ? e.message : 'No se pudo leer la solicitud')
      })
    return () => { cancelado = true }
  }, [listo, req])

  const resolver = async (decision: 'aprobar' | 'cancelar') => {
    setEnviando(decision)
    try {
      const { redirect } = await platformApi.mcpResolver(req, decision)
      olvidarConexionPendiente()
      window.location.href = redirect
    } catch (e) {
      olvidarConexionPendiente()
      setError(e instanceof Error ? e.message : 'No se pudo completar la conexión')
      setEnviando(null)
    }
  }

  return (
    <main style={{ minHeight: '100vh', background: 'var(--color-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ width: '100%', maxWidth: 460, border: '1px solid var(--color-border)', borderRadius: 16, background: 'var(--color-bg)', boxShadow: 'var(--shadow-card)', padding: '28px 28px 24px', display: 'flex', flexDirection: 'column', gap: 18 }}>
        <OrbitLogo />
        <h1 style={{ margin: 0, fontSize: 21, fontWeight: 700, color: 'var(--color-text)', letterSpacing: '-0.02em', lineHeight: 1.25 }}>
          Conectar Claude a Órbita
        </h1>

        {error ? (
          <>
            <div role="alert" style={{ padding: '12px 14px', borderRadius: 10, background: 'var(--color-warning-bg)', color: 'var(--chip-warning-fg)', fontSize: 13.5, lineHeight: 1.55 }}>{error}</div>
            <a href="/superadmin?seccion=marketing" style={{ ...btnGhost, textDecoration: 'none', alignSelf: 'flex-start' }}>Volver al panel</a>
          </>
        ) : !datos ? (
          <p style={{ margin: 0, fontSize: 13.5, color: 'var(--color-muted)' }}>Leyendo la solicitud…</p>
        ) : (
          <>
            <p style={{ margin: 0, fontSize: 14, color: 'var(--color-body)', lineHeight: 1.6 }}>
              <strong style={{ color: 'var(--color-text)' }}>{datos.cliente}</strong> ({datos.retorno}) pide acceso en tu nombre,
              con la cuenta <strong style={{ color: 'var(--color-text)' }}>{datos.usuario}</strong>.
            </p>
            <div style={{ fontSize: 13.5, color: 'var(--color-body)', lineHeight: 1.6, borderTop: '1px solid var(--color-border)', borderBottom: '1px solid var(--color-border)', padding: '14px 0' }}>
              <div style={{ color: 'var(--color-text)', fontWeight: 600, marginBottom: 6 }}>Qué podrá hacer</div>
              {datos.permiso}.
              <div style={{ marginTop: 10, color: 'var(--color-muted)' }}>
                No puede enviar mensajes, contactar a nadie, publicar ni borrar datos: todo mensaje y todo video lo revisa y lo aprueba una persona.
                El acceso se puede cortar cuando quieras desde Marketing → «Desconectar Claude».
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <button type="button" onClick={() => resolver('aprobar')} disabled={enviando !== null} style={{ ...btnPrimary, opacity: enviando ? 0.7 : 1 }}>
                {enviando === 'aprobar' ? 'Conectando…' : 'Autorizar'}
              </button>
              <button type="button" onClick={() => resolver('cancelar')} disabled={enviando !== null} className="ds-hover" style={btnGhost}>Cancelar</button>
            </div>
          </>
        )}
      </div>
    </main>
  )
}
