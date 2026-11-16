import { useState } from 'react'
import { Button } from '@/design-system/components/Button'
import { Modal } from '@/design-system/components/Modal'
import { ApiError, updateInstagramBot, type BotModo, type OrbiCanalCambios, type OrbiCanalEstado } from '@/lib/api'
import { MAX_INSTRUCCIONES, formularioDe, revisarFormulario, soloDigitos, textoDelCupo, type FormularioDeOrbi } from '../_shared/orbiAtencion'

// Difusión → Mensajes → "Orbi en Instagram": el dueño enciende a Orbi para que atienda los mensajes directos, igual que en
// WhatsApp (salvo el menú de opciones, que es de WhatsApp): en qué charlas contesta, si toma pedidos y con qué topes,
// indicaciones, y cuánto lleva del cupo del mes (uno solo para WhatsApp e Instagram). Es del paquete Avanzado.
// Los interruptores se guardan al tocarlos; lo que se escribe, con "Guardar cambios".

interface Props {
  bot: OrbiCanalEstado
  onCambio: (b: OrbiCanalEstado) => void
  onCerrar: () => void
}

export function OrbiInstagram({ bot, onCambio, onCerrar }: Props) {
  const [form, setForm] = useState<FormularioDeOrbi>(() => formularioDe(bot))
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)
  const campo = (k: keyof FormularioDeOrbi) => (v: string) => setForm((f) => ({ ...f, [k]: v }))

  const guardar = async (cambios: OrbiCanalCambios, listo: string, delFormulario = false) => {
    setGuardando(true); setError(null); setAviso(null)
    try {
      const nuevo = await updateInstagramBot(cambios)
      onCambio(nuevo)
      // Un interruptor no pisa lo que se está escribiendo; guardar el formulario sí lo vuelve a llenar con lo guardado.
      if (delFormulario) setForm(formularioDe(nuevo))
      setAviso(listo)
    } catch (e) {
      setError(e instanceof ApiError && e.status < 500 ? e.message : 'No se pudo guardar el cambio. Probá de nuevo.')
    } finally {
      setGuardando(false)
    }
  }

  const { topeValido, topesValidos, hayCambios, cambios } = revisarFormulario(form, bot)
  const bloqueado = !bot.disponible || !bot.conectado
  const { cupo } = bot

  return (
    <Modal
      isOpen
      onClose={() => { if (!guardando) onCerrar() }}
      dismissable={!guardando}
      title="Orbi en Instagram"
      maxWidth={560}
      footer={(
        <>
          <Button variant="secondary" disabled={guardando} onClick={onCerrar}>Cerrar</Button>
          <Button loading={guardando} disabled={bloqueado || !hayCambios || !topeValido || !topesValidos} onClick={() => void guardar(cambios, 'Cambios guardados', true)}>
            Guardar cambios
          </Button>
        </>
      )}
    >
      <style>{CSS}</style>
      <div className="oi-grupo">
        <p className="oi-suave">
          Orbi contesta tus mensajes directos por vos: qué productos tenés, precios, stock, promos, formas de pago, envíos y en qué estado está un pedido, siempre con los datos reales de tu tienda. Ante la duda no inventa: te pasa la charla.
        </p>

        {!bot.disponible && <p className="oi-aviso" role="status">Orbi en Instagram es una función del paquete Avanzado. Cuando lo tengas activo, lo encendés desde acá.</p>}
        {bot.disponible && !bot.conectado && <p className="oi-aviso" role="status">Primero conectá tu cuenta de Instagram.</p>}

        <section className="oi-bloque">
          <Interruptor
            id="oi-general" activo={bot.enabled} deshabilitado={guardando || (bloqueado && !bot.enabled)}
            titulo="Orbi atiende mis mensajes de Instagram" ayuda="Interruptor general. Apagado, Orbi no contesta en ninguna charla."
            onCambio={(v) => void guardar({ enabled: v }, v ? 'Orbi ya atiende tus mensajes de Instagram' : 'Orbi dejó de atender Instagram')}
          />
        </section>

        <section className={`oi-bloque${bot.enabled ? '' : ' oi-bloque-apagado'}`}>
          <p className="oi-titulo">En qué charlas contesta</p>
          <Opcion
            nombre="oi-modo" activa={bot.modo === 'SELECCIONADOS'} deshabilitada={guardando || bloqueado}
            titulo="Solo las que yo active (recomendado)" texto="En cada charla tocás “Activar Orbi”. Las demás las atendés vos."
            onElegir={() => void guardar({ modo: 'SELECCIONADOS' as BotModo }, 'Orbi contesta solo en las charlas que actives')}
          />
          <Opcion
            nombre="oi-modo" activa={bot.modo === 'TODOS'} deshabilitada={guardando || bloqueado}
            titulo="Todas las charlas" texto="Orbi contesta a cualquiera que te escriba, salvo en las charlas donde lo apagues."
            onElegir={() => void guardar({ modo: 'TODOS' as BotModo }, 'Orbi contesta en todas las charlas')}
          />
          <p className="oi-suave">
            Cuando escribís vos en una charla (desde acá o desde la app de Instagram), Orbi se calla ahí y <strong>no vuelve solo</strong>: lo reactivás con un toque. Mientras Orbi atiende una charla no salen la bienvenida ni el mensaje de ausencia: contesta Orbi.
          </p>
        </section>

        <section className="oi-bloque">
          <Interruptor
            id="oi-pedidos" activo={bot.tomaPedidos} deshabilitado={guardando || bloqueado || (!bot.pedidos.disponible && !bot.tomaPedidos)}
            titulo="Orbi puede tomar pedidos"
            ayuda="Arma el pedido con los precios y el stock reales de tu tienda, se lo muestra al cliente para que confirme y lo deja pendiente: vos coordinás el pago y la entrega por la misma charla. Orbi nunca cobra ni pide datos de pago."
            onCambio={(v) => void guardar({ tomaPedidos: v }, v ? 'Orbi ya puede tomar pedidos' : 'Orbi dejó de tomar pedidos')}
          />
          {!bot.pedidos.disponible && bot.pedidos.motivo && <p className="oi-error" role="status">{bot.pedidos.motivo}</p>}
          {(bot.tomaPedidos || bot.pedidos.disponible) && (
            <>
              <div className="oi-topes">
                <label>
                  <span className="oi-etiqueta">Máximo de unidades por pedido</span>
                  <input className="oi-campo oi-campo-chico" inputMode="numeric" value={form.maxUnidades} disabled={bloqueado} onChange={(e) => campo('maxUnidades')(soloDigitos(e.target.value))} />
                </label>
                <label>
                  <span className="oi-etiqueta">Monto máximo por pedido ($)</span>
                  <input className="oi-campo oi-campo-chico" inputMode="numeric" value={form.maxMonto} disabled={bloqueado} onChange={(e) => campo('maxMonto')(soloDigitos(e.target.value))} />
                </label>
              </div>
              {!topesValidos && <p className="oi-error" role="alert">Las unidades van de 1 a 1.000 y el monto, desde $1.000.</p>}
              <p className="oi-suave">Instagram solo te deja escribirle a un cliente dentro de las 24 horas de su último mensaje: cuando Orbi deja un pedido pendiente te llega un correo para que lo sigas a tiempo.</p>
            </>
          )}
        </section>

        <section className="oi-bloque">
          <label className="oi-titulo" htmlFor="oi-indicaciones">Qué querés que sepa Orbi</label>
          <p className="oi-suave">Opcional: tono, promociones del mes, políticas propias.</p>
          <textarea
            id="oi-indicaciones" className="oi-campo" rows={4} maxLength={MAX_INSTRUCCIONES} value={form.instrucciones} disabled={bloqueado}
            placeholder="Ej.: Hablá de vos. Este mes hay 10% de descuento pagando en efectivo."
            onChange={(e) => campo('instrucciones')(e.target.value)}
          />
          <p className="oi-contador">{form.instrucciones.length} / {MAX_INSTRUCCIONES}</p>
        </section>

        <section className="oi-bloque">
          <p className="oi-titulo">Cupo de este mes</p>
          <div className="oi-barra" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={cupo.porcentaje} aria-label="Cupo usado">
            <i style={{ width: `${cupo.porcentaje}%` }} />
          </div>
          <p className="oi-suave">{textoDelCupo(cupo, 'WhatsApp')} Es el mismo cupo de Orbi en WhatsApp y se renueva el 1° de cada mes. Si se agota, Orbi deja de contestar y te pasa las charlas.</p>
          <label className="oi-etiqueta" htmlFor="oi-tope">Tope propio para Instagram (opcional)</label>
          <input
            id="oi-tope" className="oi-campo oi-campo-chico" inputMode="numeric" value={form.tope} disabled={bloqueado}
            placeholder={`Hasta ${cupo.total.toLocaleString('es-AR')}`} onChange={(e) => campo('tope')(soloDigitos(e.target.value))}
          />
        </section>

        {error && <p className="oi-error" role="alert">{error}</p>}
        {aviso && !error && <p className="oi-suave" role="status">{aviso}</p>}
      </div>
    </Modal>
  )
}

function Interruptor({ id, activo, deshabilitado, titulo, ayuda, onCambio }: { id: string; activo: boolean; deshabilitado: boolean; titulo: string; ayuda: string; onCambio: (v: boolean) => void }) {
  return (
    <div className="oi-interruptor">
      <div>
        <label className="oi-titulo" htmlFor={id}>{titulo}</label>
        <p className="oi-suave" style={{ marginTop: 2 }}>{ayuda}</p>
      </div>
      <button id={id} type="button" role="switch" aria-checked={activo} disabled={deshabilitado} className={`oi-switch${activo ? ' oi-switch-activo' : ''}`} onClick={() => onCambio(!activo)}>
        <span />
      </button>
    </div>
  )
}

function Opcion({ nombre, activa, deshabilitada, titulo, texto, onElegir }: { nombre: string; activa: boolean; deshabilitada: boolean; titulo: string; texto: string; onElegir: () => void }) {
  return (
    <label className={`oi-opcion${activa ? ' oi-opcion-activa' : ''}`}>
      <input type="radio" name={nombre} checked={activa} disabled={deshabilitada} onChange={onElegir} />
      <span><strong>{titulo}</strong><small>{texto}</small></span>
    </label>
  )
}

const CSS = `
.oi-grupo { display: flex; flex-direction: column; gap: 14px; }
.oi-bloque { display: flex; flex-direction: column; gap: 8px; padding: 14px 16px; border: 1px solid var(--color-border); border-radius: 14px; background: var(--color-surface); }
.oi-bloque-apagado { opacity: 0.6; }
.oi-suave { margin: 0; font-size: 12.5px; line-height: 1.5; color: var(--color-muted); }
.oi-suave strong { font-weight: 600; color: var(--color-text); }
.oi-aviso { margin: 0; padding: 10px 12px; border-radius: 10px; font-size: 13px; line-height: 1.5; color: var(--color-text); background: var(--color-surface-alt); }
.oi-error { margin: 0; font-size: 12.5px; line-height: 1.5; color: var(--color-error); }
.oi-titulo { margin: 0; font-size: 14px; font-weight: 600; color: var(--color-text); }
.oi-etiqueta { display: block; font-size: 13px; font-weight: 600; color: var(--color-text); }
.oi-interruptor { display: flex; align-items: flex-start; justify-content: space-between; gap: 14px; }
.oi-switch { position: relative; width: 42px; height: 24px; flex-shrink: 0; margin-top: 2px; padding: 0; border: none; border-radius: 12px; cursor: pointer; background: var(--color-border); transition: background-color 150ms; }
.oi-switch span { position: absolute; top: 3px; left: 3px; width: 18px; height: 18px; border-radius: 50%; background: #fff; box-shadow: 0 1px 3px rgba(0,0,0,0.3); transition: transform 150ms; }
.oi-switch-activo { background: var(--color-primary); }
.oi-switch-activo span { transform: translateX(18px); }
.oi-switch:disabled { opacity: 0.5; cursor: not-allowed; }
.oi-switch:focus-visible { outline: 2px solid var(--color-primary); outline-offset: 2px; }
.oi-opcion { display: flex; align-items: flex-start; gap: 10px; padding: 10px 12px; border: 1px solid var(--color-border); border-radius: 10px; cursor: pointer; font-size: 13.5px; color: var(--color-text); }
.oi-opcion-activa { border-color: var(--color-text); }
.oi-opcion input { margin-top: 3px; accent-color: var(--color-primary); }
.oi-opcion input:focus-visible { outline: 2px solid var(--color-primary); outline-offset: 2px; }
.oi-opcion small { display: block; margin-top: 2px; font-size: 12.5px; line-height: 1.45; color: var(--color-muted); }
.oi-topes { display: flex; flex-wrap: wrap; gap: 14px; }
.oi-topes label { display: flex; flex-direction: column; gap: 6px; }
.oi-campo { width: 100%; box-sizing: border-box; padding: 10px 12px; border: 1px solid var(--color-border); border-radius: 10px; background: var(--color-surface-alt); font: inherit; font-size: 16px; line-height: 1.45; color: var(--color-text); resize: vertical; outline: none; }
.oi-campo:focus { border-color: var(--color-primary); background: var(--color-surface); box-shadow: 0 0 0 3px var(--color-primary-bg); }
.oi-campo:disabled { opacity: 0.6; cursor: not-allowed; }
.oi-campo-chico { width: 190px; }
.oi-contador { margin: 0; text-align: right; font-size: 11.5px; color: var(--color-muted); }
.oi-barra { height: 8px; border-radius: 4px; overflow: hidden; background: var(--color-surface-alt); }
.oi-barra i { display: block; height: 100%; border-radius: 4px; background: var(--color-text); transition: width 300ms; }
@media (prefers-reduced-motion: reduce) { .oi-switch, .oi-switch span, .oi-barra i { transition: none; } }
`
