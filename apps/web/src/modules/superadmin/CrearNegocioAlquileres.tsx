// Crear un negocio de Alquileres desde Superadmin (Módulos → Alquileres).
//
// El alta pública tiene Alquileres en "Próximamente": mientras tanto esta es la
// forma de tener un negocio real para probar el panel y el sitio en
// producción. El negocio nace oculto de buscadores, con cortesía y con el
// dueño con una contraseña temporal que cambia al entrar. Por ahora, solo
// alojamiento por noche (plan: docs/superpowers/plans/2026-11-23-alquileres-en-produccion.md).
import { useState, type FormEvent } from 'react'
import { ArrowRight, Check, Copy } from 'lucide-react'
import { platformApi } from '@/lib/platform/api'
import { tenantUrl } from '@/lib/tenant'
import { ErrorBox, Field, ModalShell, btnGhost, btnPrimary, inputStyle } from './ui'
import { RUBROS_PARA_CREAR, aSubdominio, erroresDeNegocio, type FormNegocio } from './negocioAlquileres'

const VACIO: FormNegocio = { nombre: '', subdominio: '', rubro: 'cabana', duenoNombre: '', duenoEmail: '', contrasenaTemporal: '' }
const errorTxt = { fontSize: 12, fontWeight: 500, color: 'var(--color-danger, #DC2626)' } as const

interface Creado { subdomain: string; name: string; email: string }

export default function CrearNegocioAlquileres({ onCerrar }: { onCerrar: () => void }) {
  const [f, setF] = useState<FormNegocio>(VACIO)
  // El subdominio sigue al nombre hasta que alguien lo toca a mano.
  const [subTocado, setSubTocado] = useState(false)
  const [intentado, setIntentado] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [falla, setFalla] = useState('')
  const [creado, setCreado] = useState<Creado | null>(null)
  const [copiado, setCopiado] = useState(false)

  const errores = erroresDeNegocio(f)
  const ver = (k: keyof FormNegocio) => (intentado ? errores[k] : undefined)
  const set = (c: Partial<FormNegocio>) => setF(prev => ({ ...prev, ...c }))

  const enviar = async (e: FormEvent) => {
    e.preventDefault()
    setIntentado(true)
    if (Object.keys(errores).length > 0 || enviando) return
    setEnviando(true)
    setFalla('')
    try {
      const r = await platformApi.createAlquileresBusiness({ ...f, nombre: f.nombre.trim(), duenoNombre: f.duenoNombre.trim(), duenoEmail: f.duenoEmail.trim() })
      setCreado({ subdomain: r.business.subdomain, name: r.business.name, email: r.owner.email })
    } catch (err) {
      setFalla(err instanceof Error && err.message ? err.message : 'No se pudo crear el negocio. Probá de nuevo.')
    } finally {
      setEnviando(false)
    }
  }

  if (creado) {
    const panel = tenantUrl(creado.subdomain, '/panel')
    const sitio = tenantUrl(creado.subdomain, '/')
    const copiar = () => { void navigator.clipboard?.writeText(panel).then(() => setCopiado(true)) }
    return (
      <ModalShell title="Negocio creado" onClose={onCerrar} cerrarAlClickAfuera={false} ancho={520}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, fontSize: 13.5, color: 'var(--color-body)', lineHeight: 1.55 }}>
          <p style={{ margin: 0 }}><b style={{ color: 'var(--color-text)' }}>{creado.name}</b> ya existe. Está oculto de buscadores y no se le cobra.</p>
          <ol style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <li>Cerrá tu sesión de superadmin o abrí una ventana privada: el dueño y el superadmin usan la misma sesión del navegador.</li>
            <li>Entrá con <b>{creado.email}</b> y la contraseña temporal que elegiste. Al entrar te pide cambiarla.</li>
            <li>El panel está en <a href={panel} style={{ color: 'var(--color-primary)', fontWeight: 600, overflowWrap: 'anywhere' }}>{panel.replace(/^https?:\/\//, '')}</a>.</li>
          </ol>
          <p style={{ margin: 0, fontSize: 12.5, color: 'var(--color-muted)' }}>El sitio público ({sitio.replace(/^https?:\/\//, '').replace(/\/$/, '')}) todavía muestra la tienda vacía: el sitio de Alquileres es la etapa siguiente.</p>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', flexWrap: 'wrap', marginTop: 4 }}>
            <button type="button" onClick={copiar} style={{ ...btnGhost, display: 'inline-flex', alignItems: 'center', gap: 6 }}>{copiado ? <Check size={15} aria-hidden /> : <Copy size={15} aria-hidden />} {copiado ? 'Link copiado' : 'Copiar el link del panel'}</button>
            <button type="button" onClick={onCerrar} style={btnPrimary}>Listo</button>
          </div>
        </div>
      </ModalShell>
    )
  }

  return (
    <ModalShell title="Crear negocio de Alquileres" onClose={onCerrar} cerrarAlClickAfuera={false} ancho={520}>
      <form onSubmit={enviar} noValidate style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <p style={{ margin: 0, fontSize: 13, color: 'var(--color-muted)', lineHeight: 1.5 }}>Nace oculto de buscadores y con cortesía. Por ahora, alojamiento por noche.</p>
        <Field label="Nombre del negocio">
          <input style={inputStyle} value={f.nombre} maxLength={80} autoFocus aria-invalid={!!ver('nombre')}
            onChange={e => set({ nombre: e.target.value, ...(subTocado ? {} : { subdominio: aSubdominio(e.target.value) }) })} />
          {ver('nombre') && <span role="alert" style={errorTxt}>{ver('nombre')}</span>}
        </Field>
        <Field label="Subdominio" hint={f.subdominio ? `Va a quedar en ${tenantUrl(f.subdominio, '/').replace(/^https?:\/\//, '').replace(/\/$/, '')}` : 'La dirección del negocio.'}>
          <input style={inputStyle} value={f.subdominio} maxLength={63} autoCapitalize="none" spellCheck={false} aria-invalid={!!ver('subdominio')}
            onChange={e => { setSubTocado(true); set({ subdominio: e.target.value.toLowerCase() }) }} />
          {ver('subdominio') && <span role="alert" style={errorTxt}>{ver('subdominio')}</span>}
        </Field>
        <Field label="Qué alquila">
          <select style={inputStyle} value={f.rubro} onChange={e => set({ rubro: e.target.value })}>
            {RUBROS_PARA_CREAR.map(r => <option key={r.key} value={r.key}>{r.label}</option>)}
          </select>
          {ver('rubro') && <span role="alert" style={errorTxt}>{ver('rubro')}</span>}
        </Field>
        <Field label="Nombre del dueño">
          <input style={inputStyle} value={f.duenoNombre} maxLength={80} autoComplete="off" aria-invalid={!!ver('duenoNombre')} onChange={e => set({ duenoNombre: e.target.value })} />
          {ver('duenoNombre') && <span role="alert" style={errorTxt}>{ver('duenoNombre')}</span>}
        </Field>
        <Field label="Email del dueño" hint="Con este email entra al panel. No puede ser el de otro negocio de Órbita.">
          <input style={inputStyle} type="email" inputMode="email" value={f.duenoEmail} maxLength={160} autoComplete="off" autoCapitalize="none" aria-invalid={!!ver('duenoEmail')} onChange={e => set({ duenoEmail: e.target.value })} />
          {ver('duenoEmail') && <span role="alert" style={errorTxt}>{ver('duenoEmail')}</span>}
        </Field>
        <Field label="Contraseña temporal" hint="10 caracteres o más. Al entrar por primera vez se le pide cambiarla.">
          <input style={inputStyle} type="text" value={f.contrasenaTemporal} maxLength={72} autoComplete="off" autoCapitalize="none" spellCheck={false} aria-invalid={!!ver('contrasenaTemporal')} onChange={e => set({ contrasenaTemporal: e.target.value })} />
          {ver('contrasenaTemporal') && <span role="alert" style={errorTxt}>{ver('contrasenaTemporal')}</span>}
        </Field>
        {falla && <ErrorBox msg={falla} />}
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
          <button type="button" onClick={onCerrar} style={btnGhost}>Cancelar</button>
          <button type="submit" disabled={enviando} aria-busy={enviando} style={{ ...btnPrimary, display: 'inline-flex', alignItems: 'center', gap: 6, opacity: enviando ? 0.7 : 1 }}>{enviando ? 'Creando…' : <>Crear negocio <ArrowRight size={15} aria-hidden /></>}</button>
        </div>
      </form>
    </ModalShell>
  )
}
