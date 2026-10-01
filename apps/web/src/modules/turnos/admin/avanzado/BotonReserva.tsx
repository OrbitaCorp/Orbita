// Botón de reserva para Instagram y Google: el link directo a la reserva, un
// QR para el mostrador y el código de un botón para pegar en otra web. Con
// "saber de dónde vino" cada canal lleva su propio ?origen=, para después ver
// qué red trae más turnos.
import { useState } from 'react'
import { Copy, Check, Download, Link as LinkIcon, QrCode, Globe } from 'lucide-react'
import { Button } from '@/design-system/components/Button'
import { QR, matrizQR } from '@/modules/turnos/_shared/components/QR'
import { ShellFuncion, Seccion, Campo, Segmentado, FilaSwitch, Dato, VistaCliente, BotonVista, copiarTexto, linkSitio } from './ui'
import { temaDe } from '@/modules/turnos/storefront/tema'
import { slugDe } from './datosAvanzado'
import type { PropsFuncion } from './tipos'

type Canal = 'instagram' | 'google' | 'qr' | 'web'
const CANALES: { id: Canal; label: string; donde: string }[] = [
  { id: 'instagram', label: 'Instagram', donde: 'Pegalo en tu bio o en el botón de contacto del perfil.' },
  { id: 'google', label: 'Google', donde: 'En tu Perfil de Empresa, como link de reservas o de sitio web.' },
  { id: 'qr', label: 'QR del local', donde: 'Imprimilo para el mostrador, la vidriera o la tarjeta.' },
  { id: 'web', label: 'Tu web', donde: 'Pegá el código del botón en cualquier página.' },
]


export default function BotonReserva(p: PropsFuncion) {
  const { rubro } = p
  const t = temaDe(rubro)
  const base = `https://${slugDe(t.nombre)}.orbita.site/reservar`
  const [origen, setOrigen] = useState(true)
  const [texto, setTexto] = useState('Reservar turno')
  const [relleno, setRelleno] = useState(true)
  const [qrMarca, setQrMarca] = useState(false)
  const [copiado, setCopiado] = useState<string | null>(null)
  const [estado, setEstado] = useState('')

  const link = (c: Canal) => origen ? `${base}?origen=${c}` : base
  const snippet = `<a href="${link('web')}" target="_blank" style="display:inline-block;padding:12px 22px;border-radius:${t.radio}px;font:600 15px sans-serif;text-decoration:none;${relleno ? `background:${t.c.primary};color:${t.c.onPrimary}` : `border:2px solid ${t.c.primary};color:${t.c.primary}`}">${texto}</a>`

  const copiar = (clave: string, valor: string) => {
    void copiarTexto(valor).then(ok => {
      setEstado(ok ? 'Copiado al portapapeles.' : 'No se pudo copiar: seleccioná el texto y copialo a mano.')
      if (!ok) return
      setCopiado(clave)
      setTimeout(() => setCopiado(c => c === clave ? null : c), 1800)
    })
  }
  // El QR se dibuja en un lienzo con la misma matriz que se ve en pantalla y baja como PNG de 24 px por módulo.
  const descargarQR = () => {
    const m = matrizQR(link('qr'))
    const margen = 2
    const px = 24
    const lado = (m.length + margen * 2) * px
    const lienzo = document.createElement('canvas')
    lienzo.width = lado
    lienzo.height = lado
    const ctx = lienzo.getContext('2d')
    if (!ctx) { setEstado('Este navegador no pudo armar la imagen del QR.'); return }
    ctx.fillStyle = '#FFFFFF'
    ctx.fillRect(0, 0, lado, lado)
    ctx.fillStyle = qrMarca ? t.c.primary : '#111111'
    m.forEach((fila, y) => fila.forEach((on, x) => { if (on) ctx.fillRect((x + margen) * px, (y + margen) * px, px, px) }))
    const a = document.createElement('a')
    a.href = lienzo.toDataURL('image/png')
    a.download = `qr-reservas-${slugDe(t.nombre)}.png`
    document.body.appendChild(a)
    a.click()
    a.remove()
    setEstado(`Se descargó ${a.download}.`)
  }
  // Función y no componente: un componente definido en el render se remontaría en cada cambio.
  const botonCopiar = (clave: string, valor: string, label: string) => (
    <Button variant="secondary" size="sm" aria-label={label} icon={copiado === clave ? <Check size={14} /> : <Copy size={14} />} onClick={() => copiar(clave, valor)}>
      {copiado === clave ? 'Copiado' : 'Copiar'}
    </Button>
  )

  return (
    <ShellFuncion
      {...p}
      bajada="Tu link de reservas listo para pegar en Instagram y Google, un QR para imprimir y un botón para cualquier web. Quien lo toca cae directo en la reserva, sin pasar por el chat."
      textoOn="Los links y el QR funcionan siempre que tu sitio de reservas esté publicado."
      kpis={<>
        <Dato label="Reservas desde Instagram" valor="42%" nota="Últimos 30 días · ejemplo" Icon={LinkIcon} acento="#EC4899" />
        <Dato label="Reservas desde Google" valor="23%" nota="Últimos 30 días · ejemplo" Icon={Globe} />
        <Dato label="Escaneos del QR" valor="31" nota="Últimos 30 días · ejemplo" Icon={QrCode} acento="#8B5CF6" />
      </>}
      preview={<PreviewPerfil {...p} texto={texto} relleno={relleno} link={base} />}
    >
      <Seccion titulo="Tus links">
        <FilaSwitch titulo="Saber de dónde vino cada reserva" desc="Cada canal lleva su marca en el link y en Clientes ves de dónde llegó cada uno." on={origen} onChange={setOrigen} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 8 }}>
          {CANALES.filter(c => c.id !== 'web').map(c => (
            <div key={c.id} style={{ padding: 12, borderRadius: 10, border: '1px solid var(--color-border)', background: 'var(--color-bg)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <div style={{ flex: '1 1 220px', minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--color-text)' }}>{c.label}</div>
                  <div style={{ fontSize: 12, color: 'var(--color-primary)', fontFamily: '"Geist Mono", monospace', marginTop: 2, overflowWrap: 'anywhere' }}>{link(c.id)}</div>
                </div>
                {botonCopiar(c.id, link(c.id), `Copiar link para ${c.label}`)}
              </div>
              <div style={{ fontSize: 11.5, color: 'var(--color-muted)', marginTop: 6 }}>{c.donde}</div>
            </div>
          ))}
        </div>
      </Seccion>

      <Seccion titulo="QR para el local" desc="Escaneable de verdad: probalo con la cámara del celular.">
        <div style={{ display: 'flex', gap: 18, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ padding: 10, borderRadius: 14, background: '#fff', border: '1px solid var(--color-border)' }}>
            <QR texto={link('qr')} size={156} color={qrMarca ? t.c.primary : '#111111'} titulo={`QR que abre ${link('qr')}`} />
          </div>
          <div style={{ flex: '1 1 200px', minWidth: 0 }}>
            <div style={{ fontFamily: t.fh, fontSize: 18, fontWeight: 700, color: 'var(--color-text)' }}>Escaneá y reservá</div>
            <div style={{ fontSize: 12.5, color: 'var(--color-muted)', marginTop: 4, lineHeight: 1.5 }}>Abre la reserva de {t.nombre}. Imprimilo de al menos 3 cm para que se lea bien.</div>
            <div style={{ marginTop: 12 }}>
              <Segmentado label="Color del QR" valor={qrMarca ? 'marca' : 'negro'} onChange={v => setQrMarca(v === 'marca')} opciones={[{ valor: 'negro', label: 'Negro' }, { valor: 'marca', label: 'Color de tu marca' }]} />
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
              <Button variant="outline" size="sm" icon={<Download size={14} />} onClick={descargarQR}>Descargar QR</Button>
              {botonCopiar('qr-local', link('qr'), 'Copiar el link del QR')}
            </div>
          </div>
        </div>
      </Seccion>

      <Seccion titulo="Botón para tu web">
        <div className="tua-2">
          <Campo label="Texto del botón">
            <Segmentado label="Texto del botón" valor={texto} onChange={setTexto} opciones={['Reservar turno', 'Sacar turno', 'Reservá online'].map(x => ({ valor: x, label: x }))} />
          </Campo>
          <Campo label="Estilo">
            <Segmentado label="Estilo del botón" valor={relleno ? 'relleno' : 'borde'} onChange={v => setRelleno(v === 'relleno')} opciones={[{ valor: 'relleno', label: 'Relleno' }, { valor: 'borde', label: 'Solo borde' }]} />
          </Campo>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 14, borderRadius: 10, background: t.c.bg, border: '1px solid var(--color-border)', marginBottom: 10, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 12, color: t.c.muted }}>Vista:</span>
          {/* El botón de verdad: en la demo abre la reserva del sitio de ejemplo en otra pestaña. */}
          <a className="tua-opc" href={linkSitio(rubro, 'reserva')} target="_blank" rel="noreferrer" style={{ display: 'inline-flex', alignItems: 'center', minHeight: 44, boxSizing: 'border-box', padding: '0 20px', borderRadius: t.radio, fontWeight: 600, fontSize: 14, fontFamily: t.fb, textDecoration: 'none', ...(relleno ? { background: t.c.primary, color: t.c.onPrimary } : { border: `2px solid ${t.c.primary}`, color: t.c.primary }) }}>{texto}<span className="tuc-sr"> (abre la reserva de la demo en otra pestaña)</span></a>
        </div>
        <pre style={{ margin: 0, padding: 12, borderRadius: 8, background: 'var(--color-surface-alt)', border: '1px solid var(--color-border)', fontSize: 11.5, lineHeight: 1.5, color: 'var(--color-body)', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', fontFamily: '"Geist Mono", monospace' }}>{snippet}</pre>
        <div style={{ marginTop: 10 }}>{botonCopiar('snippet', snippet, 'Copiar código del botón')}</div>
      </Seccion>
      <div role="status" className="tua-estado" style={{ marginBottom: 12 }}>{estado}</div>
    </ShellFuncion>
  )
}

/** Perfil de red social genérico (sin marca de ninguna red) con el link en la bio. */
function PreviewPerfil({ rubro, texto, relleno, link }: PropsFuncion & { texto: string; relleno: boolean; link: string }) {
  const t = temaDe(rubro)
  return (
    <VistaCliente rubro={rubro} cabecera={false} titulo="Así se ve en tu perfil" nota="Perfil de ejemplo. Los números son ilustrativos.">
      <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <span style={{ width: 64, height: 64, borderRadius: '50%', padding: 3, background: `conic-gradient(${t.c.primary}, #EC4899, #F59E0B, ${t.c.primary})`, flexShrink: 0 }}>
            <span style={{ display: 'grid', placeItems: 'center', width: '100%', height: '100%', borderRadius: '50%', background: t.c.surfaceAlt, border: `3px solid ${t.c.bg}`, boxSizing: 'border-box', fontFamily: t.fh, fontWeight: 800, fontSize: 22, color: t.c.text }}>{t.nombre[0]}</span>
          </span>
          <div style={{ display: 'flex', flex: 1, justifyContent: 'space-around', textAlign: 'center' }}>
            {[['214', 'posts'], ['8.431', 'seguidores'], ['312', 'seguidos']].map(([n, l]) => (
              <div key={l}><div style={{ fontWeight: 700, fontSize: 14, color: t.c.text }}>{n}</div><div style={{ fontSize: 10.5, color: t.c.muted }}>{l}</div></div>
            ))}
          </div>
        </div>
        <div>
          <div style={{ fontWeight: 700, fontSize: 13.5, color: t.c.text }}>{t.nombre}</div>
          <div style={{ fontSize: 12.5, color: t.c.body, marginTop: 2 }}>{t.tagline}</div>
          <div style={{ fontSize: 12.5, color: t.c.body }}>{t.direccion} · {t.barrio}</div>
          <a className="tua-vlink" href={linkSitio(rubro, 'reserva')} target="_blank" rel="noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, minHeight: 32, fontSize: 12.5, marginTop: 2, overflowWrap: 'anywhere' }}>
            <LinkIcon size={12} aria-hidden style={{ flexShrink: 0 }} /> {link.replace('https://', '')}<span className="tuc-sr"> (abre la reserva de la demo en otra pestaña)</span>
          </a>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
          <BotonVista chico variante={relleno ? 'primario' : 'borde'} href={linkSitio(rubro, 'reserva')}>{texto}</BotonVista>
          <BotonVista chico variante="suave" aviso={`Demo: acá se abre el chat con ${t.nombre}.`}>Mensaje</BotonVista>
        </div>
        <div aria-hidden style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 2, marginTop: 4, marginInline: -16 }}>
          {[...t.galeria, ...t.galeria].slice(0, 6).map((src, i) => (
            <span key={i} style={{ aspectRatio: '1', background: `${t.c.surfaceAlt} url(${src}) center/cover` }} />
          ))}
        </div>
      </div>
    </VistaCliente>
  )
}
