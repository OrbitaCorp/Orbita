// Datos del negocio: lo que aparece en el sitio, en los mensajes y en el pie
// de cada recordatorio. El rubro no se edita acá: define cómo funciona la
// agenda entera (por profesional, por sala, con cupo), cambiarlo es otra cosa.
import { useState } from 'react'
import { Building2, MapPin, Phone, AtSign, Mail, Link2, Copy, QrCode, Check, X, MessageCircle, Download } from 'lucide-react'
import { temaDe } from '@/modules/turnos/storefront/tema'
import { FAMILIAS, MODO_LABEL } from '@/modules/turnos/datos'
import { QR, matrizQR } from '@/modules/turnos/_shared/components/QR'
import { Estrellas, Anillos } from '@/modules/turnos/_shared/orbita/Cielo'
import { useBorrador, Encabezado, SecCard, Campo, Dos, Rotulo, BarraGuardar, FilaSwitch, Boton, Dialogo, type PropsTab } from './ui'
import { subdominioDe, vozDe } from './datos'

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
  const v = b.valor
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
    <div className="panel-page panel-page--form">
      <Encabezado rotulo="Tu negocio" titulo="Datos del negocio" bajada={`Cómo te encuentran y te contactan tus ${voz.clientes}. Aparece en tu sitio y en cada recordatorio.`} />

      <div className="tuc-pila">
        {/* El link es lo que más se usa de esta pantalla: va primero y sobre el espacio de Órbita. */}
        <section aria-label="Tu link de reservas" className="tuo-espacio tuc-link-hero tuo-entra">
          <Estrellas cantidad={30} />
          <Anillos size={360} opacidad={0.8} />
          <div style={{ minWidth: 0, flex: '1 1 300px' }}>
            <div className="tuo-eyebrow" style={{ marginBottom: 10 }}><Link2 size={12} aria-hidden style={{ marginLeft: -2 }} />Tu link de reservas</div>
            <div className="tuc-link-url">
              <span aria-hidden className="tuo-late" style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--color-success)', flexShrink: 0 }} />
              <span className="tuo-num" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{link}</span>
            </div>
            <p style={{ fontSize: 13, lineHeight: 1.5, margin: '10px 0 0', color: 'var(--color-body)', maxWidth: 460 }}>Compartilo en tu bio de Instagram, en Google y en tu WhatsApp Business: quien lo abre reserva sin escribirte.</p>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Boton variant="primary" icon={copiado ? <Check size={15} aria-hidden /> : <Copy size={15} aria-hidden />} onClick={copiar}>{copiado ? 'Copiado' : 'Copiar link'}</Boton>
            <Boton variant="outline" icon={<QrCode size={15} aria-hidden />} onClick={() => setQr(true)}>Ver QR</Boton>
          </div>
          <div aria-live="polite" className="tuc-sr">{copiado ? 'Link copiado' : ''}</div>
        </section>

        <SecCard titulo="Negocio" Icon={Building2} bajada="El nombre y la descripción con los que te presentás.">
          <Campo label="Nombre del negocio" value={v.nombre} onChange={x => b.set('nombre', x)} maxLength={40} />
          <div style={{ marginBottom: 16 }}>
            <Rotulo ayuda="Define cómo se arma tu agenda. Para cambiarlo, escribinos a soporte.">Rubro</Rotulo>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              <span className="tuo-chip tuo-chip--primario" style={{ height: 32, padding: '0 12px', fontSize: 13 }}><rubro.Icon size={15} strokeWidth={1.8} aria-hidden /> {rubro.label}</span>
              <span className="tuo-chip" style={{ height: 32, padding: '0 12px', fontSize: 12.5, fontWeight: 500 }}>{familia?.label}</span>
              <span className="tuo-chip" style={{ height: 32, padding: '0 12px', fontSize: 12.5, fontWeight: 500 }}>Agenda: {MODO_LABEL[rubro.modo].toLowerCase()}</span>
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

      <BarraGuardar dirty={b.dirty} onDescartar={b.descartar} onGuardar={() => { b.guardar(); avisar('Datos guardados', 'Es una demo: no se guardó nada de verdad.') }} />

      {qr && (
        <Dialogo titulo="Código QR de tu link" onCerrar={() => setQr(false)}>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: 16 }}>
            <span className="tuo-h2" style={{ flex: 1 }}>QR para tu mostrador</span>
            <button type="button" aria-label="Cerrar" autoFocus onClick={() => setQr(false)} className="tuc-icono"><X size={17} aria-hidden /></button>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div className="tuc-qr-marco"><QR texto={`https://${link}`} size={184} titulo={`QR de ${link}`} /></div>
            <div className="tuo-num" style={{ fontSize: 12.5, color: 'var(--color-text)', margin: '14px 0 4px', overflowWrap: 'anywhere' }}>{link}</div>
            <div style={{ fontSize: 12.5, color: 'var(--color-muted)', marginBottom: 18, lineHeight: 1.5 }}>Imprimilo y pegalo en el mostrador: lo escanean y reservan desde el celular.</div>
            <Boton variant="primary" icon={<Download size={15} aria-hidden />} style={{ width: '100%' }} onClick={descargarQR}>Descargar PNG</Boton>
          </div>
        </Dialogo>
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

export const CSS_NEGOCIO = `
  .tuc-link-hero { border-radius: 20px; padding: 24px; display: flex; align-items: center; gap: 20px; flex-wrap: wrap; border: 1px solid var(--color-border); }
  .tuc-link-url { display: inline-flex; align-items: center; gap: 10px; max-width: 100%; min-height: 46px; padding: 0 16px; border-radius: 12px; font-size: 16px; font-weight: 500; color: var(--color-text);
    background: rgba(147,197,253,0.08); border: 1px solid var(--color-border-strong); box-sizing: border-box; }
  .tuc-qr-marco { display: inline-block; padding: 16px; background: #fff; border-radius: 18px; border: 1px solid var(--color-border); box-shadow: 0 0 0 6px var(--color-primary-bg); }
  .tuc-mapa { position: relative; height: 180px; border-radius: 14px; overflow: hidden; border: 1px solid var(--color-border); background: var(--color-surface); }
  .tuc-mapa-pin { position: absolute; left: 50%; top: 52%; transform: translate(-50%, -100%); display: flex; flex-direction: column; align-items: center; gap: 6px; transition: transform 300ms var(--tuo-ease, ease); }
  .tuc-mapa-cartel { padding: 5px 11px; border-radius: 9px; background: var(--color-bg); border: 1px solid var(--color-border); font-size: 11.5px; font-weight: 600; color: var(--color-text); white-space: nowrap;
    box-shadow: 0 6px 16px rgba(15,23,42,0.16); max-width: 230px; overflow: hidden; text-overflow: ellipsis; }
  .tuc-mapa-punto { width: 34px; height: 34px; border-radius: 50% 50% 50% 0; transform: rotate(-45deg); display: grid; place-items: center; color: #fff; background: var(--tuo-grad); box-shadow: 0 8px 18px rgba(37,99,235,0.45); }
  .tuc-mapa-punto > svg { transform: rotate(45deg); }
  @media (hover: hover) { .tuc-mapa:hover .tuc-mapa-pin { transform: translate(-50%, -108%); } }
  @media (max-width: 560px) { .tuc-link-hero { padding: 18px; } .tuc-link-url { font-size: 14px; } }
  @media (prefers-reduced-motion: reduce) { .tuc-mapa-pin { transition: none; } .tuc-mapa:hover .tuc-mapa-pin { transform: translate(-50%, -100%); } }
`
