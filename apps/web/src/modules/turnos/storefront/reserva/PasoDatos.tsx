// Datos del cliente y seña. El formulario pide lo mínimo (nombre y celular),
// valida en línea al salir de cada campo y, si se intenta seguir con algo mal,
// marca todos los errores juntos al lado de cada campo.
//
// Reservar NO pide cuenta: se reserva como invitado. Si el negocio ofrece
// beneficios (los define el dueño en Configuración → Reglas de reserva), acá
// mismo se puede crear la cuenta con los datos que ya se escribieron, o entrar
// con la que ya se tenía. Las dos cosas son opcionales y no frenan la reserva.
import { useState } from 'react'
import { BellRing, Check, Gift, Home, Info, Lock, MapPin, ShieldCheck, Store, UserRoundCheck, Wallet } from 'lucide-react'
import { pesos, esSalud, type RubroTurnos } from '@/modules/turnos/datos'
import { MODALIDAD_TXT, beneficiosTxt, plazoTxt, type BeneficiosCuenta, type Modalidad, type PoliticaReserva } from '@/modules/turnos/demo/negocioDemo'
import type { TemaNegocio } from '../tema'
import { teclasRadio } from './acciones'
import { BotonCarga, Campo, Interruptor, Tilde } from './piezas'

export interface DatosCliente { nombre: string; tel: string; email: string; nota: string; recordatorio: boolean; domicilio: string }
export type CampoValidado = 'nombre' | 'tel' | 'email' | 'domicilio'
export type Errores = Partial<Record<CampoValidado, string>>
/** Cómo reserva: sin cuenta (lo normal), creando una con estos datos o con la que ya tenía. */
export type Cuenta = 'invitado' | 'nueva' | 'ingresada'

export const DATOS_VACIOS: DatosCliente = { nombre: '', tel: '', email: '', nota: '', recordatorio: true, domicilio: '' }
export const idCampo = (c: string) => `tur-campo-${c}`
/** Sellos que ya junta la cuenta de ejemplo (la misma de "Mis turnos"). */
export const SELLOS_DEMO = 2

/** Celular argentino: 10 dígitos con código de área, sin el 0 ni el 15. */
const digitosTel = (tel: string) => tel.replace(/\D/g, '').replace(/^0/, '')

export function validar(d: DatosCliente, aDomicilio = false): Errores {
  const e: Errores = {}
  const nombre = d.nombre.trim()
  if (!nombre) e.nombre = 'Escribí tu nombre y apellido.'
  else if (nombre.length < 3) e.nombre = 'Ese nombre es muy corto. Poné nombre y apellido.'
  const tel = digitosTel(d.tel)
  if (!tel) e.tel = 'Escribí tu celular: ahí te llega la confirmación.'
  else if (tel.length < 10) e.tel = `Faltan dígitos: son 10 con el código de área (llevás ${tel.length}).`
  else if (tel.length > 10) e.tel = 'Sobran dígitos: va sin el 0 del área y sin el 15.'
  const email = d.email.trim()
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) e.email = 'Revisá el email: tiene que ser como nombre@mail.com.'
  if (aDomicilio) {
    const dom = d.domicilio.trim()
    if (!dom) e.domicilio = 'Escribí la dirección a la que tenemos que ir.'
    else if (!/\d/.test(dom) || dom.length < 5) e.domicilio = 'Poné la calle y la altura (por ejemplo, Thames 1820).'
  }
  return e
}

const ICONO_LUGAR: Record<Modalidad, typeof MapPin> = { local: MapPin, domicilio: Home }

/** Qué pasa con la seña si se cancela fuera de plazo o no se viene, según lo que definió el dueño. */
const senaFueraDePlazo = (p: PoliticaReserva) => (p.senaFueraDePlazo === 'se-pierde' ? 'la seña no se devuelve' : 'la seña te queda a favor para otro turno')

export function PasoDatos({ rubro, t, datos, onDatos, intento, conSena, onEnviar, lugar, onLugar, cuenta, onCuenta, beneficios, politica }: {
  rubro: RubroTurnos; t: TemaNegocio; datos: DatosCliente; onDatos: (d: DatosCliente) => void
  /** Ya quiso seguir con errores: se muestran todos, los haya tocado o no. */
  intento: boolean
  conSena: boolean
  /** Enter en cualquier campo hace lo mismo que el botón de seguir. */
  onEnviar: () => void
  /** Dónde se hace el turno. Solo se pregunta si el negocio atiende de más de una forma. */
  lugar: Modalidad
  onLugar: (m: Modalidad) => void
  cuenta: Cuenta
  onCuenta: (c: Cuenta) => void
  /** Lo que el dueño ofrece a quien crea su cuenta. */
  beneficios: BeneficiosCuenta
  /** Las reglas de cancelación que definió el dueño. */
  politica: PoliticaReserva
}) {
  const [tocados, setTocados] = useState<Partial<Record<CampoValidado, boolean>>>({})
  const [pidiendoCodigo, setPidiendoCodigo] = useState(false)
  const [codigo, setCodigo] = useState('')
  const errores = validar(datos, lugar === 'domicilio')
  const error = (c: CampoValidado) => (intento || tocados[c] ? errores[c] : undefined)
  const tocar = (c: CampoValidado) => () => setTocados(x => ({ ...x, [c]: true }))
  const salud = esSalud(rubro)
  const lista = beneficiosTxt(beneficios, rubro)
  const turno = rubro.modo === 'cupo' ? 'esta clase' : rubro.modo === 'cancha' ? 'esta reserva' : 'este turno'
  const detalleLugar: Record<Modalidad, string> = {
    local: [t.direccion, t.barrio].filter(Boolean).join(', ') || 'En el local',
    domicilio: `Vamos a ${t.zonas}`,
  }

  // "Ya tengo cuenta": se entra con el celular que ya se escribió arriba y un código por WhatsApp.
  const pedirCodigo = () => {
    if (errores.tel) { setTocados(x => ({ ...x, tel: true })); document.getElementById(idCampo('tel'))?.focus(); return }
    setPidiendoCodigo(true)
  }
  const ingresar = () => {
    if (codigo.length < 6) return
    setPidiendoCodigo(false)
    setCodigo('')
    // La cuenta de ejemplo ya sabe cómo se llama: completa el nombre si estaba vacío.
    if (!datos.nombre.trim()) onDatos({ ...datos, nombre: 'Sofía Martínez' })
    onCuenta('ingresada')
  }

  return (
    <form noValidate onSubmit={e => { e.preventDefault(); onEnviar() }}>
      {/* Sin un submit adentro, Enter no envía un formulario de varios campos */}
      <button type="submit" className="tur-sr" tabIndex={-1} aria-hidden>Continuar</button>

      {t.modalidades.length > 1 && (
        <div className="tur-donde">
          <div className="tur-rotulo" id="tur-donde-tit">¿Dónde lo hacemos?</div>
          <div role="radiogroup" aria-labelledby="tur-donde-tit" className="tur-donde-ops" onKeyDown={teclasRadio}>
            {t.modalidades.map(m => {
              const Icono = ICONO_LUGAR[m]
              return (
                <button key={m} type="button" role="radio" aria-checked={lugar === m} className="tur-op tur-donde-op" onClick={() => onLugar(m)}>
                  <Tilde />
                  <span className="tur-donde-ico" aria-hidden><Icono size={19} /></span>
                  <span style={{ minWidth: 0 }}><b>{MODALIDAD_TXT[m]}</b><span>{detalleLugar[m]}</span></span>
                </button>
              )
            })}
          </div>
          {lugar === 'domicilio' && (
            <Campo id={idCampo('domicilio')} label="Tu dirección" valor={datos.domicilio} onChange={v => onDatos({ ...datos, domicilio: v })} onBlur={tocar('domicilio')}
              error={error('domicilio')} ok={!errores.domicilio} autoComplete="street-address" maxLength={120} placeholder="Calle, altura, piso y depto"
              ayuda="Solo la ve el negocio, para llegar a tu casa." />
          )}
        </div>
      )}

      <div className="tur-campos">
        <Campo id={idCampo('nombre')} label="Nombre y apellido" valor={datos.nombre} onChange={v => onDatos({ ...datos, nombre: v })} onBlur={tocar('nombre')}
          error={error('nombre')} ok={!errores.nombre} autoComplete="name" autoCapitalize="words" maxLength={80}
          ayuda={salud ? 'Como figura en tu documento.' : 'Así te anotan en la agenda.'} />
        <Campo id={idCampo('tel')} label="Celular (WhatsApp)" valor={datos.tel} onChange={v => onDatos({ ...datos, tel: v })} onBlur={tocar('tel')}
          error={error('tel')} ok={!errores.tel} tipo="tel" inputMode="tel" autoComplete="tel-national" prefijo="+54" placeholder="11 5555 5555" maxLength={20}
          ayuda="Código de área sin el 0 y número sin el 15." />
        <Campo id={idCampo('email')} label="Email" opcional valor={datos.email} onChange={v => onDatos({ ...datos, email: v })} onBlur={tocar('email')}
          error={error('email')} ok={!!datos.email.trim() && !errores.email} tipo="email" inputMode="email" autoComplete="email" autoCapitalize="none" maxLength={120}
          ayuda="Para tener la confirmación también en tu correo." />
        <Campo id={idCampo('nota')} label={salud ? 'Obra social o prepaga' : 'Algo que debamos saber'} opcional valor={datos.nota} onChange={v => onDatos({ ...datos, nota: v })}
          autoComplete="off" maxLength={140} ayuda={salud ? 'Si te atendés particular, dejalo vacío.' : 'Una preferencia, una alergia, con quién venís.'} />
      </div>

      <div className="tur-aviso" style={{ marginTop: 8 }}>
        <BellRing size={21} aria-hidden style={{ flexShrink: 0, color: 'var(--color-text)' }} />
        <span style={{ flex: 1, minWidth: 0 }}>
          <b style={{ display: 'block', fontSize: 15, color: 'var(--color-text)' }}>Recordatorio por WhatsApp</b>
          <span style={{ display: 'block', fontSize: 13.5, lineHeight: 1.5, color: 'var(--color-muted)' }}>Te escribimos un día antes, con un link por si necesitás reprogramar.</span>
        </span>
        <Interruptor on={datos.recordatorio} onChange={v => onDatos({ ...datos, recordatorio: v })} etiqueta="Recordatorio por WhatsApp" />
      </div>

      {lista.length > 0 && (
        <div className="tur-cuenta" data-activa={cuenta !== 'invitado'}>
          {cuenta === 'ingresada' ? (
            <div className="tur-cuenta-cab">
              <span className="tur-cuenta-ico" aria-hidden><UserRoundCheck size={19} /></span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <b>Entraste con tu cuenta</b>
                <span>{beneficios.sellos > 0 ? `Tenés ${SELLOS_DEMO} de ${beneficios.sellos} sellos: con ${turno} sumás uno más.` : `Con ${turno} seguís sumando en tu cuenta.`}</span>
              </span>
              <button type="button" className="tur-enlace" onClick={() => onCuenta('invitado')}>Salir</button>
            </div>
          ) : (
            <>
              <div className="tur-cuenta-cab">
                <span className="tur-cuenta-ico" aria-hidden><Gift size={19} /></span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <b id="tur-cuenta-tit">Crear mi cuenta con estos datos</b>
                  <span>Opcional y gratis. Sin contraseña: entrás con tu celular.</span>
                </span>
                <Interruptor on={cuenta === 'nueva'} onChange={v => { onCuenta(v ? 'nueva' : 'invitado'); setPidiendoCodigo(false) }} etiqueta="Crear mi cuenta con estos datos" />
              </div>
              <ul className="tur-cuenta-lista" aria-label={`Lo que sumás con tu cuenta en ${t.nombre}`}>
                {lista.map(b => <li key={b.id}><Check size={15} strokeWidth={2.6} aria-hidden /><span><b>{b.titulo}.</b> {b.texto}</span></li>)}
              </ul>
              {pidiendoCodigo ? (
                <div className="tur-cuenta-codigo">
                  <label htmlFor="tur-cuenta-codigo" style={{ display: 'block', fontSize: 14.5, fontWeight: 700, color: 'var(--color-text)' }}>Código que te mandamos por WhatsApp</label>
                  <div className="tur-cuenta-codigo-fila">
                    <div className="tur-caja">
                      {/* autoFocus: el campo aparece porque la persona lo pidió (tocó "Ingresar con mi celular"). */}
                      <input id="tur-cuenta-codigo" autoFocus value={codigo} inputMode="numeric" autoComplete="one-time-code" maxLength={6} placeholder="6 dígitos" aria-describedby="tur-cuenta-codigo-ayuda"
                        onChange={e => setCodigo(e.target.value.replace(/\D/g, '').slice(0, 6))}
                        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); ingresar() } }} />
                    </div>
                    <button type="button" className="tur-btn tur-btn--chico" disabled={codigo.length < 6} onClick={ingresar}>Ingresar</button>
                    <button type="button" className="tur-btn tur-btn--sec tur-btn--chico" onClick={() => { setPidiendoCodigo(false); setCodigo('') }}>Cancelar</button>
                  </div>
                  <p id="tur-cuenta-codigo-ayuda" style={{ margin: '8px 0 0', fontSize: 13.5, lineHeight: 1.5, color: 'var(--color-muted)' }}>Va al celular que escribiste arriba. Vista previa: sirve cualquier código de 6 dígitos.</p>
                </div>
              ) : (
                <p className="tur-cuenta-pie">¿Ya tenés cuenta? <button type="button" className="tur-enlace" onClick={pedirCodigo}>Ingresar con mi celular</button></p>
              )}
            </>
          )}
        </div>
      )}

      <p style={{ display: 'flex', gap: 10, margin: '16px 0 0', fontSize: 13.5, lineHeight: 1.55, color: 'var(--color-muted)' }}>
        <Info size={16} aria-hidden style={{ flexShrink: 0, marginTop: 2 }} />
        <span>Podés cancelar o reprogramar sin cargo {plazoTxt(politica.cancelaHasta)}.{conSena && politica.cancelaHasta > 0 ? ` Pasado ese plazo, ${senaFueraDePlazo(politica)}.` : ''} {salud ? 'Tus datos los usa solo el consultorio, para este turno.' : 'Tus datos los usa solo el negocio, para este turno.'}</span>
      </p>
    </form>
  )
}

export function PasoPago({ rubro, precio, sena, pagando, onPagar, politica }: { rubro: RubroTurnos; precio: number; sena: number; pagando: boolean; onPagar: () => void; politica: PoliticaReserva }) {
  const resto = precio - sena
  return (
    <>
      <div className="tur-pago">
        <div style={{ padding: '26px 26px 24px' }}>
          <div className="tur-rotulo">Pagás ahora · seña del {rubro.sena}%</div>
          <div className="tur-num" style={{ fontSize: 'clamp(40px, 9vw, 54px)', fontWeight: 600, lineHeight: 1.1, color: 'var(--color-text)', margin: '8px 0 20px' }}>{pesos(sena)}</div>
          <div className="tur-pago-barra" role="img" aria-label={`La seña es el ${rubro.sena}% del total`}>
            <span style={{ width: `${rubro.sena}%` }} />
          </div>
          <div className="tur-pago-partes">
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13.5, color: 'var(--color-muted)' }}><Wallet size={14} aria-hidden /> Ahora, online</div>
              <div className="tur-num" style={{ fontSize: 18, fontWeight: 600, color: 'var(--color-text)', marginTop: 3 }}>{pesos(sena)}</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6, fontSize: 13.5, color: 'var(--color-muted)' }}><Store size={14} aria-hidden /> Después, el día del turno</div>
              <div className="tur-num" style={{ fontSize: 18, fontWeight: 600, color: 'var(--color-text)', marginTop: 3 }}>{pesos(resto)}</div>
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginTop: 16, paddingTop: 14, borderTop: '1px solid var(--color-border)', fontSize: 14.5, color: 'var(--color-body)' }}>
            <span>Total del servicio</span><span className="tur-num" style={{ fontWeight: 600, color: 'var(--color-text)' }}>{pesos(precio)}</span>
          </div>
        </div>

        <div style={{ padding: '22px 26px 26px', borderTop: '2px dashed var(--color-border)' }}>
          <div className="tur-rotulo" id="tur-medio-tit" style={{ marginBottom: 12 }}>Medio de pago</div>
          <div role="radiogroup" aria-labelledby="tur-medio-tit" onKeyDown={teclasRadio}>
            {/* Hoy hay un solo medio. Queda como radio elegido para que se entienda con qué se paga. */}
            <button type="button" role="radio" aria-checked className="tur-op tur-medio">
              <Tilde />
              <span className="tur-medio-logo" aria-hidden><Wallet size={22} /></span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <b style={{ display: 'block', fontSize: 16, color: 'var(--color-text)' }}>Mercado Pago</b>
                <span style={{ display: 'block', fontSize: 13.5, color: 'var(--color-muted)', marginTop: 2 }}>Tarjeta de crédito, débito o dinero en cuenta</span>
              </span>
            </button>
          </div>
          <BotonCarga cargando={pagando} textoCargando="Procesando el pago…" onClick={onPagar} className="tur-btn--ancho tur-solo-ancho" style={{ marginTop: 18 }}>
            <Lock size={17} aria-hidden /> Pagar {pesos(sena)}
          </BotonCarga>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 12, maxWidth: 620, marginTop: 20, padding: '16px 18px', borderRadius: 'var(--tur-r)', border: '1px solid var(--color-border)', background: 'var(--color-surface)' }}>
        <ShieldCheck size={20} aria-hidden style={{ flexShrink: 0, marginTop: 1, color: 'var(--color-text)' }} />
        <div style={{ fontSize: 14, lineHeight: 1.6, color: 'var(--color-body)' }}>
          <b style={{ color: 'var(--color-text)' }}>Política de cancelación.</b> Si cancelás o reprogramás {plazoTxt(politica.cancelaHasta)}, la seña se devuelve al mismo medio de pago. {politica.cancelaHasta > 0 ? 'Pasado ese plazo, o si no venís' : 'Si no venís'}, {senaFueraDePlazo(politica)}.{politica.tolerancia > 0 ? ` Te esperamos hasta ${politica.tolerancia} minutos.` : ''}
        </div>
      </div>
      <p style={{ fontSize: 13, color: 'var(--color-muted)', margin: '14px 0 0' }}>Vista previa: el pago está simulado, no se cobra nada.</p>
    </>
  )
}
