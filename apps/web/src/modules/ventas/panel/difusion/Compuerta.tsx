import { useState, type ReactNode } from 'react'
import { Button } from '@/design-system/components/Button'
import { ApiError, startInstagramConnect, type InstagramEstado } from '@/lib/api'

// Compuerta de las pantallas de Difusión (Publicaciones, Comentarios, Estadísticas): deja pasar al contenido
// solo si Instagram está conectado Y con el permiso que esa pantalla usa. Si no está conectado, ofrece
// conectarlo; si está conectado solo para mensajes (conexión vieja, o se destildó un permiso), ofrece volver
// a autorizar. Quien se conecta desde Difusión ya autoriza todo el kit de una vez, así que esto solo le
// aparece a quien conectó desde Mensajes.

export type PermisoDelKit = 'publicar' | 'comentar' | 'estadisticas' | 'mensajes'

const TEXTOS: Record<PermisoDelKit, { vista: 'difusion' | 'publicaciones' | 'comentarios' | 'estadisticas'; paraConectar: string; paraAutorizar: string }> = {
  publicar: {
    vista: 'publicaciones',
    paraConectar: 'Para publicar desde Órbita necesitamos tu cuenta profesional de Instagram conectada.',
    paraAutorizar: 'publicar fotos en tu nombre',
  },
  comentar: {
    vista: 'comentarios',
    paraConectar: 'Para leer y responder comentarios necesitamos tu cuenta profesional de Instagram conectada.',
    paraAutorizar: 'leer y responder los comentarios de tus publicaciones',
  },
  // Los mensajes directos se piden siempre al conectar: con la cuenta conectada no falta nada.
  mensajes: {
    vista: 'difusion',
    paraConectar: 'Para leer y responder tus mensajes de Instagram necesitamos tu cuenta profesional conectada.',
    paraAutorizar: 'leer y responder tus mensajes directos',
  },
  estadisticas: {
    vista: 'estadisticas',
    paraConectar: 'Para mostrarte estadísticas necesitamos tu cuenta profesional de Instagram conectada.',
    paraAutorizar: 'ver cuánta gente ve y reacciona a lo que publicás',
  },
}

function concedido(estado: Extract<InstagramEstado, { connected: true }>, permiso: PermisoDelKit): boolean {
  if (permiso === 'publicar') return estado.puedePublicar === true
  if (permiso === 'mensajes') return true
  if (permiso === 'comentar') return estado.puedeComentar === true
  return estado.puedeVerEstadisticas === true
}

interface Props {
  estado: InstagramEstado | null
  permiso: PermisoDelKit
  /** Abre el modal de conexión de Instagram (si todavía no está conectado). */
  onAbrirConexion: () => void
  /** El contenido de la pantalla; recibe el @usuario de la cuenta conectada. */
  children: (usuario: string | null) => ReactNode
}

export function Compuerta({ estado, permiso, onAbrirConexion, children }: Props) {
  if (estado === null) return <p className="cmp-suave" style={{ marginTop: 16 }}>Cargando…</p>
  if (!estado.connected) {
    return (
      <Aviso
        titulo="Primero conectá tu Instagram"
        texto={TEXTOS[permiso].paraConectar}
        boton="Conectar Instagram"
        onClick={onAbrirConexion}
      />
    )
  }
  if (!concedido(estado, permiso)) return <AutorizarKit permiso={permiso} usuario={estado.username} />
  return <>{children(estado.username)}</>
}

function AutorizarKit({ permiso, usuario }: { permiso: PermisoDelKit; usuario: string | null }) {
  const [trabajando, setTrabajando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const autorizar = async () => {
    setTrabajando(true); setError(null)
    try {
      // Vuelve a esta misma pantalla con los permisos del kit concedidos (la conexión se actualiza sola).
      const { url } = await startInstagramConnect(TEXTOS[permiso].vista, 'kit')
      window.location.href = url
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'No se pudo iniciar la autorización. Probá de nuevo.')
      setTrabajando(false)
    }
  }

  return (
    <Aviso
      titulo="Falta un permiso de Instagram"
      texto={`Tu cuenta${usuario ? ` @${usuario}` : ''} está conectada, pero todavía no le diste permiso a Órbita para ${TEXTOS[permiso].paraAutorizar}. Instagram te va a pedir que confirmes los permisos y volvés acá. Órbita solo publica y responde lo que vos confirmás.`}
      boton="Autorizar"
      cargando={trabajando}
      error={error}
      onClick={autorizar}
    />
  )
}

function Aviso({ titulo, texto, boton, onClick, cargando, error }: { titulo: string; texto: string; boton: string; onClick: () => void; cargando?: boolean; error?: string | null }) {
  return (
    <section className="cmp-aviso">
      <style>{CSS}</style>
      <h2 className="cmp-titulo">{titulo}</h2>
      <p className="cmp-suave">{texto}</p>
      {error && <p className="cmp-error" role="alert">{error}</p>}
      <Button size="lg" loading={cargando} onClick={onClick}>{boton}</Button>
    </section>
  )
}

const CSS = `
.cmp-aviso { margin-top: 16px; padding: 28px 24px; display: flex; flex-direction: column; align-items: center; text-align: center; background: var(--color-surface); border: 1px solid var(--color-border); border-radius: 16px; box-shadow: var(--shadow-card); }
.cmp-titulo { margin: 0 0 8px; font-size: 17px; font-weight: 700; letter-spacing: -0.01em; color: var(--color-text); }
.cmp-suave { margin: 0 0 14px; max-width: 46ch; font-size: 13px; line-height: 1.55; color: var(--color-muted); }
.cmp-error { margin: 0 0 12px; font-size: 12.5px; line-height: 1.4; color: var(--color-error); }
`
