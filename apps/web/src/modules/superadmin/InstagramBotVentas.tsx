import { useEffect, useMemo, useState } from 'react'
import { platformApi, PlatformApiError, type IgBotVentas } from '@/lib/platform/api'
import { Card, Loader, ErrorBox, btnPrimary, inputStyle } from './ui'

// Marketing → Instagram → Respuestas automáticas: el bot de ventas de la cuenta de Instagram de Órbita
// (apps/api/src/marketing/instagram-ventas). Contesta los mensajes y los comentarios con botones, tarjetas y, para las
// preguntas sueltas, IA con lo que dice la web; deriva al equipo lo que no sabe o cuando la persona pide alguien.
// Lo que dice cada respuesta está en el código (contenido.ts): acá se prende, se elige qué comentarios contesta y qué
// dice en ellos, y a quién se avisa.

const MAX_SALUDO = 900
const textarea: React.CSSProperties = { ...inputStyle, height: 'auto', minHeight: 92, padding: '10px 13px', lineHeight: 1.5, resize: 'vertical', width: '100%' }
const etiqueta: React.CSSProperties = { display: 'block', fontSize: 12.5, color: 'var(--color-muted)', marginBottom: 5 }
const titulo: React.CSSProperties = { fontSize: 14, fontWeight: 600, color: 'var(--color-text)', margin: '0 0 10px' }

type Form = {
  activo: boolean
  usarIa: boolean
  responderComentarios: boolean
  todosLosComentarios: boolean
  palabrasClave: string
  respuestasPublicas: string
  saludoComentario: string
  correosAviso: string
}

const aForm = (b: IgBotVentas): Form => ({
  activo: b.activo,
  usarIa: b.usarIa,
  responderComentarios: b.responderComentarios,
  todosLosComentarios: b.todosLosComentarios,
  palabrasClave: b.palabrasClave.join(', '),
  respuestasPublicas: b.respuestasPublicas.join('\n'),
  saludoComentario: b.saludoComentario,
  correosAviso: b.correosAviso.join(', '),
})
const lista = (s: string, sep: RegExp) => s.split(sep).map((x) => x.trim()).filter(Boolean)

function Interruptor({ marcado, onChange, texto, detalle, deshabilitado }: { marcado: boolean; onChange: (v: boolean) => void; texto: string; detalle?: string; deshabilitado?: boolean }) {
  return (
    <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: deshabilitado ? 'not-allowed' : 'pointer', padding: '6px 0' }}>
      <input type="checkbox" checked={marcado} disabled={deshabilitado} onChange={(e) => onChange(e.target.checked)} style={{ width: 16, height: 16, marginTop: 2, flexShrink: 0 }} />
      <span>
        <span style={{ display: 'block', fontSize: 13.5, color: deshabilitado ? 'var(--color-muted)' : 'var(--color-text)' }}>{texto}</span>
        {detalle && <span style={{ display: 'block', fontSize: 12.5, color: 'var(--color-muted)', lineHeight: 1.45 }}>{detalle}</span>}
      </span>
    </label>
  )
}

const fecha = (iso: string) => new Date(iso).toLocaleString('es-AR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })

export function InstagramBotVentas({ permitido }: { permitido: boolean }) {
  const [bot, setBot] = useState<IgBotVentas | null>(null)
  const [form, setForm] = useState<Form | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)
  const [mensaje, setMensaje] = useState<{ ok: boolean; texto: string } | null>(null)

  useEffect(() => {
    platformApi.igBot()
      .then((b) => { if (b) { setBot(b); setForm(aForm(b)) } else setError('No se encontró el negocio al que está conectada la cuenta de la empresa.') })
      .catch((e) => setError(e instanceof PlatformApiError ? e.message : 'No se pudo cargar la configuración del bot.'))
  }, [])

  const hayCambios = useMemo(() => !!bot && !!form && JSON.stringify(aForm(bot)) !== JSON.stringify(form), [bot, form])
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((f) => (f ? { ...f, [k]: v } : f))

  async function guardar() {
    if (!form || guardando) return
    setGuardando(true)
    setMensaje(null)
    try {
      const b = await platformApi.igGuardarBot({
        activo: form.activo,
        usarIa: form.usarIa,
        responderComentarios: form.responderComentarios,
        todosLosComentarios: form.todosLosComentarios,
        palabrasClave: lista(form.palabrasClave, /,/),
        respuestasPublicas: lista(form.respuestasPublicas, /\n/),
        saludoComentario: form.saludoComentario,
        correosAviso: lista(form.correosAviso, /[,\s]+/),
      })
      setBot(b)
      setForm(aForm(b))
      setMensaje({ ok: true, texto: b.activo ? 'Guardado. El bot ya contesta en la cuenta.' : 'Guardado. El bot está apagado.' })
    } catch (e) {
      setMensaje({ ok: false, texto: e instanceof PlatformApiError ? e.message : 'No se pudo guardar.' })
    } finally {
      setGuardando(false)
    }
  }

  if (error) return <Card title="Respuestas automáticas"><ErrorBox msg={error} /></Card>
  if (!bot || !form) return <Card title="Respuestas automáticas"><Loader /></Card>

  const meta = bot.estadoMeta
  const problemasMeta = meta && bot.activo ? [
    meta.suscripcion !== 'ok' && `no se pudo activar el aviso de comentarios y botones (${meta.suscripcion})`,
    meta.preguntasFrecuentes !== 'ok' && `no se pudieron cargar las preguntas frecuentes (${meta.preguntasFrecuentes})`,
  ].filter(Boolean) : []
  const deshabilitado = !permitido

  return (
    <>
      <Card
        title="Respuestas automáticas"
        subtitle="Contesta los mensajes y los comentarios de la cuenta para llevar a la persona a crear su cuenta en Órbita."
      >
        <div style={{ padding: '4px 20px 20px', display: 'flex', flexDirection: 'column', gap: 22, maxWidth: 760 }}>
          <div>
            <Interruptor
              marcado={form.activo} onChange={(v) => set('activo', v)} deshabilitado={deshabilitado}
              texto="Bot prendido"
              detalle="Responde con botones y tarjetas: cómo funciona, precios, la demo, empezar y hablar con alguien. Al prenderlo carga las cuatro preguntas frecuentes del chat."
            />
            <div style={{ fontSize: 12.5, color: 'var(--color-muted)', marginTop: 4 }}>
              En los últimos 7 días respondió {bot.resumen.respuestasUltimos7Dias} {bot.resumen.respuestasUltimos7Dias === 1 ? 'mensaje' : 'mensajes'}
              {bot.resumen.charlasEsperandoAlEquipo > 0 && <> · <span style={{ color: 'var(--color-text)' }}>{bot.resumen.charlasEsperandoAlEquipo} {bot.resumen.charlasEsperandoAlEquipo === 1 ? 'charla espera' : 'charlas esperan'} al equipo en Mensajes</span></>}
            </div>
            {bot.activo && bot.prendidoConOtraCuenta && (
              <div role="status" style={{ marginTop: 10, padding: '10px 14px', borderRadius: 10, background: 'var(--color-warning-bg)', color: 'var(--chip-warning-fg)', fontSize: 12.5, lineHeight: 1.5 }}>
                Lo prendiste con otra cuenta de Instagram, así que no está contestando en {bot.cuentaConectada ? `@${bot.cuentaConectada}` : 'la cuenta conectada'}. Guardá para que la atienda.
              </div>
            )}
            {problemasMeta.length > 0 && (
              <div role="status" style={{ marginTop: 10, padding: '10px 14px', borderRadius: 10, background: 'var(--color-warning-bg)', color: 'var(--chip-warning-fg)', fontSize: 12.5, lineHeight: 1.5 }}>
                Instagram respondió con un problema: {problemasMeta.join('; ')}. Revisá que la cuenta tenga el permiso de comentarios (Renovar la conexión) y volvé a guardar.
              </div>
            )}
          </div>

          <div>
            <p style={titulo}>Preguntas que no son un botón</p>
            <Interruptor
              marcado={form.usarIa} onChange={(v) => set('usarIa', v)} deshabilitado={deshabilitado}
              texto="Contestarlas con IA"
              detalle="Usa solo lo que dice la web de Órbita: preguntas frecuentes, funciones y precios vigentes. Si no encuentra la respuesta, no inventa: le avisa al equipo. Apagado, contesta con los botones."
            />
          </div>

          <div>
            <p style={titulo}>Comentarios en las publicaciones</p>
            <Interruptor
              marcado={form.responderComentarios} onChange={(v) => set('responderComentarios', v)} deshabilitado={deshabilitado}
              texto="Escribirle por privado a quien comenta"
              detalle="Instagram deja mandar un solo mensaje privado por comentario, hasta 7 días después. Para seguir, la persona tiene que contestar: por eso el mensaje lleva botones."
            />
            {form.responderComentarios && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 8, paddingLeft: 26 }}>
                <Interruptor
                  marcado={form.todosLosComentarios} onChange={(v) => set('todosLosComentarios', v)} deshabilitado={deshabilitado}
                  texto="A cualquier comentario"
                  detalle="Apagado, solo a los que tienen alguna de las palabras de abajo."
                />
                {!form.todosLosComentarios && (
                  <label>
                    <span style={etiqueta}>Palabras que disparan el mensaje (separadas por coma)</span>
                    <input value={form.palabrasClave} onChange={(e) => set('palabrasClave', e.target.value)} disabled={deshabilitado} style={{ ...inputStyle, width: '100%' }} />
                  </label>
                )}
                <label>
                  <span style={etiqueta}>Mensaje privado ({form.saludoComentario.length}/{MAX_SALUDO})</span>
                  <textarea value={form.saludoComentario} onChange={(e) => set('saludoComentario', e.target.value.slice(0, MAX_SALUDO))} disabled={deshabilitado} style={textarea} />
                </label>
                <label>
                  <span style={etiqueta}>Respuestas públicas al comentario, una por línea (se alternan; vacío = no contesta en público)</span>
                  <textarea value={form.respuestasPublicas} onChange={(e) => set('respuestasPublicas', e.target.value)} disabled={deshabilitado} style={textarea} />
                </label>
              </div>
            )}
          </div>

          <div>
            <p style={titulo}>Aviso al equipo</p>
            <label>
              <span style={etiqueta}>Correos que reciben un aviso cuando alguien pide una persona o el bot no sabe qué responder</span>
              <input value={form.correosAviso} onChange={(e) => set('correosAviso', e.target.value)} disabled={deshabilitado} placeholder="nombre@orbita-corp.com" style={{ ...inputStyle, width: '100%' }} />
            </label>
            <div style={{ fontSize: 12.5, color: 'var(--color-muted)', marginTop: 6, lineHeight: 1.5 }}>
              Esas charlas quedan marcadas en Mensajes y el bot no vuelve a contestar ahí hasta que lo reactiven. Lo mismo cuando contesta alguien del equipo.
            </div>
          </div>

          {permitido && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
              <button type="button" onClick={guardar} disabled={!hayCambios || guardando} style={{ ...btnPrimary, opacity: !hayCambios || guardando ? 0.5 : 1, cursor: !hayCambios || guardando ? 'not-allowed' : 'pointer' }}>
                {guardando ? 'Guardando…' : 'Guardar'}
              </button>
              {hayCambios && !guardando && <span style={{ fontSize: 12.5, color: 'var(--color-warning)' }}>Tenés cambios sin guardar</span>}
              {mensaje && <span role="status" style={{ fontSize: 12.5, color: mensaje.ok ? 'var(--color-success)' : 'var(--color-error)' }}>{mensaje.texto}</span>}
            </div>
          )}
        </div>
      </Card>

      <Card title="Últimos comentarios atendidos" subtitle="Los que tenían una palabra clave (o todos, si está prendido)">
        {bot.comentariosRecientes.length === 0 ? (
          <div style={{ padding: '4px 20px 20px', fontSize: 13, color: 'var(--color-muted)' }}>Todavía ninguno.</div>
        ) : (
          <div role="list">
            {bot.comentariosRecientes.map((c) => (
              <div key={c.id} role="listitem" style={{ padding: '11px 20px', borderTop: '1px solid var(--color-border)', display: 'flex', gap: 14, alignItems: 'baseline', flexWrap: 'wrap' }}>
                <span style={{ fontSize: 13.5, color: 'var(--color-text)', minWidth: 0, flex: '1 1 260px' }}>
                  <b style={{ fontWeight: 600 }}>{c.usuario ? `@${c.usuario}` : 'Alguien'}</b> {c.texto}
                </span>
                <span style={{ fontSize: 12.5, color: c.error ? 'var(--color-error)' : 'var(--color-muted)' }}>
                  {c.privado ? 'Mensaje privado enviado' : 'Sin mensaje privado'}{c.publico ? ' · respuesta pública' : ''}{c.error ? ` · ${c.error}` : ''}
                </span>
                <span style={{ fontSize: 12, color: 'var(--color-muted)' }}>{fecha(c.createdAt)}</span>
              </div>
            ))}
          </div>
        )}
      </Card>
    </>
  )
}
