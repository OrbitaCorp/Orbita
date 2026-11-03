// Datos del negocio: lo que aparece en el sitio, en los mensajes y en el pie
// de cada recordatorio. El rubro no se edita acá: define cómo funciona la
// agenda entera (por profesional o por sala), cambiarlo es otra cosa.
import { useState } from 'react'
import { Building2, MapPin, Phone, AtSign, Mail, Link2, Copy, QrCode, Check, MessageCircle, Download } from 'lucide-react'
import { temaDe } from '@/modules/turnos/storefront/tema'
import { FAMILIAS, MODO_LABEL } from '@/modules/turnos/datos'
import { QR, matrizQR } from '@/modules/turnos/_shared/components/QR'
import { Encabezado, SecCard, Campo, Dos, Rotulo, FilaSwitch, Boton, Chip, type PropsTab } from './ui'
import { BarraGuardar, Modal, useBorrador } from '@/design-system/reservas/piezas'
import { subdominioDe, vozDe } from './datos'

const CSS = `
  .tuc-link-url { display: flex; align-items: center; gap: 10px; min-height: 46px; padding: 0 14px; margin-bottom: 14px; border-radius: var(--rv-r-sm); border: 1px solid var(--color-border); background: var(--color-surface); font-family: var(--rv-mono); font-size: 15px; font-weight: 500; color: var(--color-text); }
  .tuc-link-url > i { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; background: var(--color-success); }
  .tuc-link-url > span { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .tuc-qr-marco { display: inline-block; padding: 16px; background: #fff; border-radius: var(--rv-r); border: 1px solid var(--color-border); }
  .tuc-mapa { position: relative; height: 180px; border-radius: var(--rv-r-sm); overflow: hidden; border: 1px solid var(--color-border); background: var(--color-surface); }
  .tuc-mapa-pin { position: absolute; left: 50%; top: 52%; transform: translate(-50%, -100%); display: flex; flex-direction: column; align-items: center; gap: 6px; }
  .tuc-mapa-cartel { padding: 5px 11px; border-radius: 8px; background: var(--color-bg); border: 1px solid var(--color-border); font-size: 11.5px; font-weight: 600; color: var(--color-text); white-space: nowrap; max-width: 230px; overflow: hidden; text-overflow: ellipsis; }
  .tuc-mapa-punto { width: 34px; height: 34px; border-radius: 50% 50% 50% 0; transform: rotate(-45deg); display: grid; place-items: center; color: var(--color-on-primary); background: var(--color-primary); }
  .tuc-mapa-punto > svg { transform: rotate(45deg); }
  @media (max-width: 560px) { .tuc-link-url { font-size: 14px; } }
`

export default function Negocio({ rubro, avisar }: PropsTab) {
  const voz = vozDe(rubro)
  const b = useBorrador(() => {
    const t = temaDe(rubro)
    return {
      nombre: t.nombre,
      descripcion: `${t.tagline}. Reservá online tu ${voz.turno} en segundos y recibí el recordatorio por WhatsApp.`,
      direccion: t.direccion, barrio: t.barrio, piso: '', indicaciones: 'Timbre 2B. A media cuadra del subte.',
      telefono: t.telefono, whatsapp: t.telefono, mismoWhatsapp: true, instagram: t.instagram, email: `hola@${subdominioDe(t.nombre)}.com.ar`,
    }
  })
  const v = b.v
  const familia = FAMILIAS.find(f => f.id === rubro.familia)
  const link = `${subdominioDe(v.nombre)}.orbita.site`
  const [copiado, setCopiado] = useState(false)
  const [qr, setQr] = useState(false)

  const copiar = () => {
    void navigator.clipboard?.writeText(`https://${link}`).catch(() => undefined)
    setCopiado(true)
    setTimeout(() => setCopiado(false), 1800)
  }

  // El PNG se arma en el navegador: la misma matriz del QR, dibujada en un canvas.
  const descargarQR = () => {
    const m = matrizQR(`https://${link}`)
    const margen = 2, modulo = 24
    const lado = (m.length + margen * 2) * modulo
    const lienzo = document.createElement('canvas')
    lienzo.width = lado
    lienzo.height = lado
    const ctx = lienzo.getContext('2d')
    if (!ctx) { avisar('No se pudo armar el QR', 'Probá de nuevo desde otro navegador.'); return }
    ctx.fillStyle = '#FFFFFF'
    ctx.fillRect(0, 0, lado, lado)
    ctx.fillStyle = '#111111'
    m.forEach((fila, y) => fila.forEach((on, x) => { if (on) ctx.fillRect((x + margen) * modulo, (y + margen) * modulo, modulo, modulo) }))
    const archivo = `qr-${subdominioDe(v.nombre)}.png`
    const a = document.createElement('a')
    a.href = lienzo.toDataURL('image/png')
    a.download = archivo
    a.click()
    setQr(false)
    avisar('QR descargado', `Buscá ${archivo} en tus descargas.`)
  }

  return (
    <div className="rv-pagina rv-pagina--form">
      <style>{CSS}</style>
      <Encabezado titulo="Datos del negocio" bajada={`Cómo te encuentran y te contactan tus ${voz.clientes}. Aparece en tu sitio y en cada recordatorio.`} />

      <div className="rv-pila">
        {/* El link es lo que más se usa de esta pantalla: va primero. */}
        <SecCard titulo="Tu link de reservas" Icon={Link2} badge={<Chip tono="ok"><Check size={12} strokeWidth={3} aria-hidden />Publicado</Chip>} bajada="Compartilo en tu bio de Instagram, en Google y en tu WhatsApp Business: quien lo abre reserva sin escribirte.">
          <div className="tuc-link-url"><i aria-hidden /><span>{link}</span></div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Boton variant="primary" icon={copiado ? <Check size={15} aria-hidden /> : <Copy size={15} aria-hidden />} onClick={copiar}>{copiado ? 'Copiado' : 'Copiar link'}</Boton>
            <Boton variant="outline" icon={<QrCode size={15} aria-hidden />} onClick={() => setQr(true)}>Ver QR</Boton>
          </div>
          <div aria-live="polite" className="rv-sr">{copiado ? 'Link copiado' : ''}</div>
        </SecCard>

        <SecCard titulo="Negocio" Icon={Building2} bajada="El nombre y la descripción con los que te presentás.">
          <Campo label="Nombre del negocio" value={v.nombre} onChange={x => b.set('nombre', x)} maxLength={40} />
          <div style={{ marginBottom: 16 }}>
            <Rotulo ayuda="Define cómo se arma tu agenda. Para cambiarlo, escribinos a soporte.">Rubro</Rotulo>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              <span className="rv-chip rv-chip--primario" style={{ height: 32, padding: '0 12px', fontSize: 13 }}><rubro.Icon size={15} strokeWidth={1.8} aria-hidden /> {rubro.label}</span>
              <span className="rv-chip" style={{ height: 32, padding: '0 12px', fontSize: 12.5, fontWeight: 500 }}>{familia?.label}</span>
              <span className="rv-chip" style={{ height: 32, padding: '0 12px', fontSize: 12.5, fontWeight: 500 }}>Agenda: {MODO_LABEL[rubro.modo].toLowerCase()}</span>
            </div>
          </div>
          <Campo label="Descripción" value={v.descripcion} onChange={x => b.set('descripcion', x)} area maxLength={240} ayuda="Aparece debajo del nombre en tu sitio y cuando compartís el link." style={{ marginBottom: 0 }} />
        </SecCard>

        <SecCard titulo="Ubicación" Icon={MapPin} bajada="Dónde queda y cómo llegar.">
          <Dos>
            <Campo label="Dirección" value={v.direccion} onChange={x => b.set('direccion', x)} />
            <Campo label="Barrio y ciudad" value={v.barrio} onChange={x => b.set('barrio', x)} />
          </Dos>
          <Dos>
            <Campo label="Piso / depto (opcional)" value={v.piso} onChange={x => b.set('piso', x)} placeholder="2° B" />
            <Campo label="Cómo llegar (opcional)" value={v.indicaciones} onChange={x => b.set('indicaciones', x)} />
          </Dos>
          <Mapa direccion={`${v.direccion}, ${v.barrio}`} />
        </SecCard>

        <SecCard titulo="Contacto" Icon={Phone} bajada="Por dónde te escriben y te llaman.">
          <Dos>
            <Campo label="Teléfono" value={v.telefono} onChange={x => b.set('telefono', x)} prefijo="+54" type="tel" mono />
            <Campo label="Email" value={v.email} onChange={x => b.set('email', x)} prefijo={<Mail size={14} aria-hidden />} type="email" />
          </Dos>
          <FilaSwitch Icon={MessageCircle} titulo="Mismo número para WhatsApp" ayuda={`Tus ${voz.clientes} te escriben desde el botón de WhatsApp del sitio.`} on={v.mismoWhatsapp} onChange={x => b.set('mismoWhatsapp', x)} />
          {!v.mismoWhatsapp && <Campo label="WhatsApp" value={v.whatsapp} onChange={x => b.set('whatsapp', x)} prefijo="+54" type="tel" mono />}
          <Campo label="Instagram" value={v.instagram} onChange={x => b.set('instagram', x.replace(/^@/, ''))} prefijo={<AtSign size={14} aria-hidden />} style={{ marginTop: 6, marginBottom: 0 }} />
        </SecCard>
      </div>

      <BarraGuardar cambiado={b.cambiado} onDescartar={b.descartar} onGuardar={() => { b.guardar(); avisar('Datos guardados', 'Es una demo: no se guardó nada de verdad.') }} />

      {qr && (
        <Modal titulo="QR para tu mostrador" rotulo="Tu link de reservas" ancho={420} onCerrar={() => setQr(false)}
          pie={<><button type="button" className="rv-btn" onClick={() => setQr(false)}>Cerrar</button><Boton variant="primary" icon={<Download size={15} aria-hidden />} onClick={descargarQR}>Descargar PNG</Boton></>}>
          <div style={{ textAlign: 'center' }}>
            <div className="tuc-qr-marco"><QR texto={`https://${link}`} size={184} titulo={`QR de ${link}`} /></div>
            <div className="rv-num" style={{ fontSize: 12.5, color: 'var(--color-text)', margin: '14px 0 4px', overflowWrap: 'anywhere' }}>{link}</div>
            <p className="rv-ayuda" style={{ margin: 0 }}>Imprimilo y pegalo en el mostrador: lo escanean y reservan desde el celular.</p>
          </div>
        </Modal>
      )}
    </div>
  )
}

// Mapa de mentira: calles dibujadas con CSS y el pin. Suficiente para que se
// entienda que ahí va el mapa, sin cargar Google Maps en una demo.
function Mapa({ direccion }: { direccion: string }) {
  return (
    <div role="img" aria-label={`Mapa de ${direccion}`} className="tuc-mapa">
      <div aria-hidden style={{ position: 'absolute', inset: 0, opacity: 0.9, backgroundImage: 'linear-gradient(var(--color-border) 2px, transparent 2px), linear-gradient(90deg, var(--color-border) 2px, transparent 2px), linear-gradient(35deg, transparent 48%, var(--color-border-strong) 48%, var(--color-border-strong) 52%, transparent 52%)', backgroundSize: '56px 56px, 56px 56px, 100% 100%' }} />
      <div aria-hidden style={{ position: 'absolute', left: '8%', top: '62%', width: '28%', height: 34, borderRadius: 8, background: 'color-mix(in srgb, var(--color-success) 18%, transparent)' }} />
      <div className="tuc-mapa-pin">
        <span className="tuc-mapa-cartel">{direccion}</span>
        <span aria-hidden className="tuc-mapa-punto"><MapPin size={16} strokeWidth={2.2} /></span>
      </div>
      <span style={{ position: 'absolute', right: 8, bottom: 8, fontSize: 11, color: 'var(--color-muted)', background: 'var(--color-bg)', padding: '3px 9px', borderRadius: 999, border: '1px solid var(--color-border)' }}>Vista de ejemplo</span>
    </div>
  )
}
