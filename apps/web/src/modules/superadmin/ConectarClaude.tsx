import { useState } from 'react'
import { platformApi } from '@/lib/platform/api'
import type { ToastVariant } from '@/design-system/components/Toast'
import { ConfirmModal, useFetch } from './ui'

// Conectar el Claude de cada persona a Órbita. Es UN solo conector para todo Marketing (prospección y videos): se agrega una vez
// en Claude, se autoriza con la cuenta de la organización y vale para las dos herramientas. Desconectar corta todos los Claude
// conectados con tu usuario. Servidor del conector: apps/api/src/marketing/prospeccion/mcp/.
//
// Es la única pieza de color de la pantalla a propósito: tiene que verse. Muestra si ESTA persona ya tiene Claude conectado
// (GET /platform/mcp/estado); si no, los pasos quedan abiertos para que no haya que buscar nada.

type Aviso = { variant: ToastVariant; title: string; description?: string }

export const URL_CONECTOR = 'https://api.orbita.site/api/v1/mcp'

const BLANCO = '#ffffff'
const AZUL_OSCURO = '#1e3a8a'

export function ConectarClaude({ puedeEditar, setAviso }: { puedeEditar: boolean; setAviso: (a: Aviso) => void }) {
  const [tick, setTick] = useState(0)
  const { data, loading } = useFetch(() => platformApi.mcpEstado(), [tick])
  // null = según el estado (abierto si todavía no está conectado); true/false = lo que eligió la persona.
  const [manual, setManual] = useState<boolean | null>(null)
  const [desconectar, setDesconectar] = useState(false)

  const conectado = data?.conectado === true
  const sabe = data !== null
  const abierto = manual ?? (sabe && !conectado)

  const copiar = async (texto: string, que: string) => {
    try {
      await navigator.clipboard.writeText(texto)
      setAviso({ variant: 'success', title: `${que} copiado` })
    } catch {
      setAviso({ variant: 'error', title: 'No se pudo copiar', description: 'Seleccionalo y copialo a mano.' })
    }
  }

  return (
    <>
      <style>{`
        .cl-btn { transition: background-color 160ms, border-color 160ms, transform 160ms; cursor: pointer; }
        .cl-btn-blanco:hover { background: #e8f0ff; }
        .cl-btn-borde:hover { background: rgba(255,255,255,.14); }
        .cl-btn:focus-visible { outline: 3px solid #ffffff; outline-offset: 2px; }
        @media (prefers-reduced-motion: reduce) { .cl-btn { transition: none; } }
      `}</style>
      <section
        aria-label="Conectar Claude a Órbita"
        style={{ position: 'relative', overflow: 'hidden', borderRadius: 18, padding: '22px 26px', color: BLANCO, background: 'linear-gradient(120deg, #1e3a8a 0%, #2563eb 58%, #3b82f6 100%)' }}
      >
        {/* Órbitas decorativas (no son información): SVG, no emojis */}
        <svg aria-hidden="true" width="300" height="300" viewBox="0 0 300 300" style={{ position: 'absolute', right: -70, top: -110, pointerEvents: 'none' }}>
          <circle cx="150" cy="150" r="140" fill="none" stroke="rgba(255,255,255,.18)" strokeWidth="1.5" />
          <circle cx="150" cy="150" r="96" fill="none" stroke="rgba(255,255,255,.14)" strokeWidth="1.5" />
          <circle cx="248" cy="104" r="7" fill="#bfdbfe" />
        </svg>

        <div style={{ position: 'relative', display: 'flex', gap: 20, alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 360px', minWidth: 0 }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, height: 26, padding: '0 11px', borderRadius: 99, background: 'rgba(255,255,255,.16)', fontSize: 12.5, fontWeight: 600 }}>
              <span aria-hidden="true" style={{ width: 8, height: 8, borderRadius: '50%', background: loading ? '#bfdbfe' : conectado ? '#4ade80' : '#fbbf24' }} />
              {loading ? 'Verificando…' : !sabe ? 'Claude' : conectado ? 'Tu Claude está conectado' : 'Tu Claude todavía no está conectado'}
            </span>
            <h2 style={{ margin: '10px 0 6px', fontSize: 21, fontWeight: 700, letterSpacing: '-0.02em', lineHeight: 1.2 }}>Conectá tu Claude a Órbita</h2>
            <p style={{ margin: 0, maxWidth: 580, fontSize: 13.5, lineHeight: 1.6, color: 'rgba(255,255,255,.92)' }}>
              Un solo conector para buscar clientes y generar videos con el Claude que ya usás. Se conecta una vez por persona, y todo lo que haga queda para que lo revise el equipo.
            </p>
          </div>

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            <button
              type="button" onClick={() => setManual(!abierto)} aria-expanded={abierto} className="cl-btn cl-btn-blanco"
              style={{ height: 44, padding: '0 22px', borderRadius: 12, border: 'none', background: BLANCO, color: AZUL_OSCURO, fontSize: 14, fontWeight: 700, fontFamily: 'inherit' }}
            >
              {abierto ? 'Ocultar los pasos' : conectado ? 'Ver cómo se conecta' : 'Conectar Claude'}
            </button>
            {conectado && puedeEditar && (
              <button
                type="button" onClick={() => setDesconectar(true)} className="cl-btn cl-btn-borde"
                style={{ height: 44, padding: '0 18px', borderRadius: 12, border: '1.5px solid rgba(255,255,255,.7)', background: 'transparent', color: BLANCO, fontSize: 13.5, fontWeight: 600, fontFamily: 'inherit' }}
              >
                Desconectar
              </button>
            )}
          </div>
        </div>

        {abierto && (
          <div style={{ position: 'relative', marginTop: 18, padding: '16px 18px', borderRadius: 14, background: 'rgba(255,255,255,.12)', display: 'flex', flexDirection: 'column', gap: 14 }}>
            <ol style={{ margin: 0, paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 8, fontSize: 13.5, lineHeight: 1.55 }}>
              <li>En Claude, abrí <b>Configuración → Conectores</b> y elegí <b>«Agregar conector personalizado»</b>.</li>
              <li>Llamalo «Órbita» y pegá esta dirección:</li>
              <li>Claude te manda a una pantalla del panel: iniciá sesión con tu cuenta de la organización y tocá <b>Autorizar</b>.</li>
            </ol>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              <code style={{ flex: '1 1 280px', minWidth: 0, padding: '10px 12px', borderRadius: 10, background: BLANCO, color: AZUL_OSCURO, fontSize: 13, fontWeight: 600, overflowWrap: 'anywhere' }}>{URL_CONECTOR}</code>
              <button type="button" onClick={() => copiar(URL_CONECTOR, 'La dirección')} className="cl-btn cl-btn-borde" style={{ height: 40, padding: '0 16px', borderRadius: 10, border: '1.5px solid rgba(255,255,255,.7)', background: 'transparent', color: BLANCO, fontSize: 13, fontWeight: 600, fontFamily: 'inherit' }}>Copiar dirección</button>
              <button type="button" onClick={() => { setManual(null); setTick((n) => n + 1) }} className="cl-btn cl-btn-borde" style={{ height: 40, padding: '0 16px', borderRadius: 10, border: '1.5px solid rgba(255,255,255,.7)', background: 'transparent', color: BLANCO, fontSize: 13, fontWeight: 600, fontFamily: 'inherit' }}>Ya lo conecté: verificar</button>
            </div>
            <p style={{ margin: 0, paddingTop: 12, borderTop: '1px solid rgba(255,255,255,.22)', fontSize: 13.5, lineHeight: 1.55 }}>
              <b>Para generar videos</b> usá el mismo conector desde <b>Claude Code</b> en tu computadora (aparece solo si entrás con la misma cuenta) y pedile «generame 3 videos». La primera vez Claude baja solo las herramientas de videos y te pide permiso. Para buscar clientes, comentar o leer videos alcanza con el chat de Claude.
            </p>
            <p style={{ margin: 0, fontSize: 12.5, color: 'rgba(255,255,255,.85)', lineHeight: 1.5 }}>
              Pueden conectarlo los superadmins con correo del equipo (@orbita.site o @orbita-corp.com). Claude no puede enviar mensajes, publicar ni aprobar: eso siempre lo hace una persona.
            </p>
          </div>
        )}
      </section>

      {desconectar && (
        <ConfirmModal
          title="Desconectar Claude"
          body="Se corta el acceso de todos los Claude conectados con tu usuario. Lo ya guardado (análisis y videos) no se toca. Para volver a usarlo hay que autorizar la conexión otra vez desde Claude."
          confirmLabel="Desconectar"
          onCancel={() => setDesconectar(false)}
          onConfirm={async () => {
            const r = await platformApi.mcpDesconectar()
            setDesconectar(false)
            setAviso({ variant: 'success', title: r.revocados ? 'Claude desconectado' : 'No había conexiones activas' })
            setTick((n) => n + 1)
          }}
        />
      )}
    </>
  )
}
