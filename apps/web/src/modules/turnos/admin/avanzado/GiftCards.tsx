// Gift cards: "regalá un turno". Por monto (se descuenta del total) o por un
// servicio puntual, con cuatro diseños de tarjeta. La vista previa muestra la
// tarjeta tal cual la recibe quien la regala, lista para mandar.
import { useState, type CSSProperties } from 'react'
import { Gift, Wallet, Ticket, Copy } from 'lucide-react'
import { ShellFuncion, Seccion, Campo, Segmentado, FilaSwitch, Dato, VistaCliente, BotonVista, useAvisoVista, copiarTexto, linkSitio, inputStyle, textareaStyle } from './ui'
import { ars, serviciosVendibles, redondear, slugDe } from './datosAvanzado'
import { QR } from '@/modules/turnos/_shared/components/QR'
import { temaDe } from '@/modules/turnos/storefront/tema'
import type { RubroTurnos } from '@/modules/turnos/datos'
import type { PropsFuncion } from './tipos'

type Estilo = 'noche' | 'papel' | 'aurora' | 'marca'
const ESTILOS: { id: Estilo; label: string }[] = [
  { id: 'noche', label: 'Noche' }, { id: 'papel', label: 'Papel' }, { id: 'aurora', label: 'Aurora' }, { id: 'marca', label: 'Tu marca' },
]

/** Pinta de cada estilo. "marca" toma los colores del sitio del negocio. */
function pintura(e: Estilo, r: RubroTurnos): { fondo: string; texto: string; acento: string; suave: string } {
  const t = temaDe(r)
  switch (e) {
    case 'noche': return { fondo: 'radial-gradient(120% 90% at 100% 0%, #3A2F1E 0%, #15120D 55%, #0B0A08 100%)', texto: '#F6F1E8', acento: '#D8B477', suave: 'rgba(246,241,232,.62)' }
    case 'papel': return { fondo: 'radial-gradient(circle at 1px 1px, rgba(120,72,40,.13) 1px, transparent 0) 0 0/10px 10px, linear-gradient(160deg, #FBF5EA, #F1E4CF)', texto: '#3B2A1E', acento: '#B4532A', suave: 'rgba(59,42,30,.62)' }
    case 'aurora': return { fondo: 'radial-gradient(90% 120% at 0% 100%, #F472B6 0%, transparent 55%), radial-gradient(80% 110% at 100% 0%, #60A5FA 0%, transparent 60%), linear-gradient(135deg, #7C3AED, #4F46E5)', texto: '#FFFFFF', acento: '#FFFFFF', suave: 'rgba(255,255,255,.75)' }
    case 'marca': return { fondo: `linear-gradient(145deg, ${t.c.primary}, ${t.c.primaryH})`, texto: t.c.onPrimary, acento: t.c.onPrimary, suave: `color-mix(in srgb, ${t.c.onPrimary} 70%, transparent)` }
  }
}

export default function GiftCards(p: PropsFuncion) {
  const { rubro } = p
  const vendibles = serviciosVendibles(rubro)
  const base = vendibles[0].precio
  const montos = [redondear(base), redondear(base * 2), redondear(base * 4)]

  const [tipo, setTipo] = useState<'monto' | 'servicio'>('monto')
  const [monto, setMonto] = useState(montos[1])
  const [libre, setLibre] = useState(true)
  const [servicio, setServicio] = useState(vendibles[0].nombre)
  const [estilo, setEstilo] = useState<Estilo>('noche')
  const [para, setPara] = useState('Caro')
  const [de, setDe] = useState('Juli')
  const [mensaje, setMensaje] = useState('¡Feliz cumple! Para que te regales un rato para vos.')
  const [meses, setMeses] = useState(6)
  const [saldo, setSaldo] = useState(true)

  return (
    <ShellFuncion
      {...p}
      bajada="Tarjetas de regalo por un monto o por un servicio. Se compran online en tu sitio, llegan por WhatsApp o mail con un código, y quien la recibe la usa al reservar."
      textoOn="Aparece “Regalá un turno” en tu sitio. Cada gift card se cobra en el momento y se canjea con su código."
      kpis={<>
        <Dato label="Vendidas este mes" valor="12" nota="Datos de ejemplo" Icon={Gift} />
        <Dato label="Cobrado" valor={ars(montos[1] * 12)} nota="Datos de ejemplo" Icon={Wallet} acento="var(--color-success)" />
        <Dato label="Ya canjeadas" valor="7 de 12" nota="El resto sigue vigente" Icon={Ticket} acento="#8B5CF6" />
      </>}
      preview={<PreviewGift {...p} estilo={estilo} valor={tipo === 'monto' ? ars(monto) : servicio} esServicio={tipo === 'servicio'} para={para} de={de} mensaje={mensaje} meses={meses} />}
    >
      <Seccion titulo="Qué se regala">
        <Campo label="Tipo de gift card">
          <Segmentado label="Tipo de gift card" valor={tipo} onChange={setTipo} opciones={[{ valor: 'monto', label: 'Un monto' }, { valor: 'servicio', label: 'Un servicio' }]} />
        </Campo>
        {tipo === 'monto' ? (
          <>
            <Campo label="Montos sugeridos" ayuda="Tocá uno para verlo en la vista previa.">
              <Segmentado label="Montos sugeridos" valor={monto} onChange={setMonto} opciones={montos.map(m => ({ valor: m, label: ars(m) }))} />
            </Campo>
            <FilaSwitch titulo="Permitir monto libre" desc="Quien regala escribe el monto (desde el más chico de la lista)." on={libre} onChange={setLibre} />
            <FilaSwitch titulo="Se puede usar en varias visitas" desc="Si el turno sale menos, el saldo queda para la próxima." on={saldo} onChange={setSaldo} />
          </>
        ) : (
          <Campo label="Servicio" htmlFor="tua-gift-serv">
            <select id="tua-gift-serv" className="tuc-field" value={servicio} onChange={e => setServicio(e.target.value)} style={inputStyle}>
              {vendibles.map(s => <option key={s.nombre} value={s.nombre}>{s.nombre} · {ars(s.precio)}</option>)}
            </select>
          </Campo>
        )}
        <Campo label="Vencimiento" style={{ marginTop: 8, marginBottom: 0 }}>
          <Segmentado label="Vencimiento" valor={meses} onChange={setMeses} opciones={[3, 6, 12].map(n => ({ valor: n, label: `${n} meses` }))} />
        </Campo>
      </Seccion>

      <Seccion titulo="Diseño de la tarjeta">
        <div role="group" aria-label="Diseño de la tarjeta" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(118px, 1fr))', gap: 10 }}>
          {ESTILOS.map(e => {
            const sel = estilo === e.id
            const pt = pintura(e.id, rubro)
            return (
              <button key={e.id} type="button" className="tua-opc" aria-pressed={sel} onClick={() => setEstilo(e.id)} style={{ padding: 6, borderRadius: 12, cursor: 'pointer', fontFamily: 'inherit', border: `2px solid ${sel ? 'var(--color-primary)' : 'var(--color-border)'}`, background: 'var(--color-bg)', color: sel ? 'var(--color-primary)' : 'var(--color-body)' }}>
                <span aria-hidden style={{ display: 'block', aspectRatio: '1.586', borderRadius: 7, background: pt.fondo, position: 'relative' }}>
                  <span style={{ position: 'absolute', left: 8, bottom: 7, width: 30, height: 4, borderRadius: 2, background: pt.acento, opacity: 0.9 }} />
                </span>
                <span style={{ display: 'block', fontSize: 12.5, fontWeight: sel ? 700 : 500, marginTop: 6 }}>{e.label}</span>
              </button>
            )
          })}
        </div>
      </Seccion>

      <Seccion titulo="Mensaje de ejemplo" desc="Así se prueba el diseño; cada persona que regala escribe el suyo.">
        <div className="tua-2">
          <Campo label="Para" htmlFor="tua-gift-para"><input id="tua-gift-para" className="tuc-field" value={para} maxLength={24} onChange={e => setPara(e.target.value)} style={inputStyle} /></Campo>
          <Campo label="De" htmlFor="tua-gift-de"><input id="tua-gift-de" className="tuc-field" value={de} maxLength={24} onChange={e => setDe(e.target.value)} style={inputStyle} /></Campo>
        </div>
        <Campo label="Dedicatoria" htmlFor="tua-gift-msg" ayuda={`${mensaje.length}/140`} style={{ marginBottom: 0 }}>
          <textarea id="tua-gift-msg" className="tuc-field" value={mensaje} maxLength={140} onChange={e => setMensaje(e.target.value)} style={textareaStyle} />
        </Campo>
      </Seccion>
    </ShellFuncion>
  )
}

/** "Copiar código" del celular: copia de verdad y avisa adentro de la vista previa. */
function CopiarCodigo({ codigo }: { codigo: string }) {
  const avisar = useAvisoVista()
  return (
    <button type="button" className="tua-vbtn tua-vbtn--borde tua-vbtn--chico"
      onClick={() => { void copiarTexto(codigo).then(ok => avisar(ok ? `Código ${codigo} copiado.` : `No se pudo copiar. El código es ${codigo}.`)) }}>
      <Copy size={13} aria-hidden /> Copiar código
    </button>
  )
}

function PreviewGift({ rubro, estilo, valor, esServicio, para, de, mensaje, meses }: PropsFuncion & { estilo: Estilo; valor: string; esServicio: boolean; para: string; de: string; mensaje: string; meses: number }) {
  const t = temaDe(rubro)
  const pt = pintura(estilo, rubro)
  const chico: CSSProperties = { fontSize: 9.5, fontWeight: 700, letterSpacing: '.18em', textTransform: 'uppercase', color: pt.suave }
  return (
    <VistaCliente rubro={rubro} nota="Así le llega a quien la recibe. El código es de ejemplo.">
      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--color-primary)' }}>Regalá un turno</div>
      {/* La tarjeta: proporción de tarjeta de crédito para que se lea como "algo de valor". */}
      <div style={{ position: 'relative', aspectRatio: '1.586', borderRadius: 14, background: pt.fondo, color: pt.texto, padding: 16, display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 18px 36px -18px rgba(0,0,0,.55)' }}>
        <svg aria-hidden viewBox="0 0 100 100" style={{ position: 'absolute', right: -24, bottom: -30, width: 150, opacity: 0.16 }}>
          <circle cx="50" cy="50" r="46" fill="none" stroke={pt.acento} strokeWidth="1.2" />
          <circle cx="50" cy="50" r="34" fill="none" stroke={pt.acento} strokeWidth="1.2" />
          <circle cx="50" cy="50" r="22" fill="none" stroke={pt.acento} strokeWidth="1.2" />
        </svg>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
          <span style={{ fontFamily: t.fh, fontSize: 15, fontWeight: 700, textTransform: t.mayus ? 'uppercase' : undefined, lineHeight: 1.1 }}>{t.nombre}</span>
          <Gift size={16} color={pt.acento} />
        </div>
        <div style={{ ...chico, marginTop: 'auto' }}>{esServicio ? 'Vale por' : 'Gift card'}</div>
        <div style={{ fontFamily: t.fh, fontSize: esServicio ? 19 : 30, fontWeight: 700, lineHeight: 1.1, color: pt.acento, overflowWrap: 'anywhere' }}>{valor}</div>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginTop: 8, fontSize: 11, color: pt.suave }}>
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Para {para || '…'} · De {de || '…'}</span>
          <span style={{ fontFamily: '"Geist Mono", monospace', whiteSpace: 'nowrap' }}>GIFT-4K7Q</span>
        </div>
      </div>
      {mensaje && (
        <div style={{ borderRadius: 'var(--tu-r2)', background: 'var(--color-surface)', border: '1px solid var(--color-border)', padding: '12px 14px', fontFamily: 'var(--tu-fh)', fontStyle: 'italic', fontSize: 15, color: 'var(--color-text)', lineHeight: 1.4, overflowWrap: 'anywhere' }}>
          “{mensaje}”
          <div style={{ fontFamily: 'var(--tu-fb)', fontStyle: 'normal', fontSize: 12, color: 'var(--color-muted)', marginTop: 6 }}>— {de || 'Alguien que te quiere'}</div>
        </div>
      )}
      {/* Regla de Órbita Turnos: los códigos van siempre como QR, nunca como código de barras. */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 10, borderRadius: 'var(--tu-r2)', border: '1px solid var(--color-border)', background: 'var(--color-surface)' }}>
        <span style={{ padding: 4, borderRadius: 8, background: '#fff', flexShrink: 0 }}>
          <QR texto={`https://${slugDe(t.nombre)}.orbita.site/regalo/GIFT-4K7Q`} size={72} titulo="QR de la gift card de ejemplo" />
        </span>
        <div style={{ fontSize: 12, color: 'var(--color-muted)', lineHeight: 1.45 }}>
          Mostrá este QR o usá el código <b style={{ color: 'var(--color-text)', fontFamily: '"Geist Mono", monospace' }}>GIFT-4K7Q</b> al reservar. Válida por {meses} meses.
        </div>
      </div>
      <CopiarCodigo codigo="GIFT-4K7Q" />
      <BotonVista href={linkSitio(rubro, 'reserva')}>Reservar con mi gift card</BotonVista>
    </VistaCliente>
  )
}
