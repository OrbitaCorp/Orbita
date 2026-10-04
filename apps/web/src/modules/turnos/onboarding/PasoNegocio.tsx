// "Tu negocio": lo mismo que pide el alta real de Tienda (logo, nombre,
// descripción, teléfono y subdominio con chequeo de disponibilidad), para los
// dos módulos. Tienda suma "¿Cómo vas a vender?".
import { useRef, useState, type ChangeEvent } from 'react'
import { Camera, Check, Eye, LoaderCircle, ShoppingCart, TriangleAlert, Wand2 } from 'lucide-react'
import { AreaTexto, Aviso, Entrada, MensajeError, Opcion, type PropsPaso } from './campos'
import { achicarLogo } from './imagen'
import { aSlug, aSlugEscribiendo, iniciales, type Chequeo } from './modelo'

function CampoLogo({ d, poner }: Pick<PropsPaso, 'd' | 'poner'>) {
  const archivo = useRef<HTMLInputElement>(null)
  const [cargando, setCargando] = useState(false)
  const [fallo, setFallo] = useState(false)
  const sigla = iniciales(d.negocio)

  const elegir = async (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    e.target.value = '' // así se puede volver a elegir el mismo archivo
    if (!f) return
    setCargando(true)
    setFallo(false)
    try { poner('logo', await achicarLogo(f)) } catch { setFallo(true) } finally { setCargando(false) }
  }

  return (
    <div className="tuob-logo">
      <input ref={archivo} type="file" accept="image/*" onChange={elegir} hidden tabIndex={-1} aria-hidden data-logo-archivo />
      <button type="button" className="tuob-logo-marco" onClick={() => archivo.current?.click()} aria-busy={cargando}
        aria-label={d.logo ? 'Cambiar el logo' : 'Subir el logo (opcional)'}>
        {d.logo
          // eslint-disable-next-line @next/next/no-img-element -- demo local: es una data URL recién armada
          ? <img src={d.logo} alt="" />
          : sigla ? <span className="tuob-logo-sigla">{sigla}</span> : <Camera size={24} strokeWidth={1.5} aria-hidden />}
        {(cargando || d.logo || sigla) && <i aria-hidden>{cargando ? <LoaderCircle size={13} className="tuob-girando" /> : <Camera size={13} />}</i>}
      </button>
      <div style={{ minWidth: 0 }}>
        <span className="tuob-leyenda">Logo <small>opcional</small></span>
        <p className="tuob-ayuda" style={{ marginTop: 4 }}>Una imagen cuadrada, JPG o PNG. Si no subís nada, usamos las iniciales de tu negocio.</p>
        <div className="tuob-logo-botones">
          <button type="button" className="tuo-btn tuo-btn--sm" onClick={() => archivo.current?.click()} disabled={cargando}>{d.logo ? 'Cambiar' : 'Subir logo'}</button>
          {d.logo && <button type="button" className="tuo-btn tuo-btn--sm tuo-btn--fantasma" onClick={() => poner('logo', null)}>Quitar</button>}
        </div>
        {fallo && <div style={{ marginTop: 8 }}><MensajeError id="tuob-logo-error">No pudimos leer esa imagen. Probá con un JPG o un PNG.</MensajeError></div>}
      </div>
    </div>
  )
}

function CampoSubdominio({ d, poner, error, tocar, sub }: PropsPaso & { sub: Chequeo }) {
  const sugerido = aSlug(d.negocio)
  // Mientras se verifica no se muestra error (dura un instante); "en uso" se avisa apenas se sabe.
  const err = sub === 'verificando' ? undefined : sub === 'ocupado' ? 'Ese subdominio ya está en uso. Probá con otro.' : error('slug')
  const describe = err ? 'tuob-slug-error' : sub === 'libre' || sub === 'verificando' ? 'tuob-slug-estado' : 'tuob-slug-ayuda'
  return (
    <div className="tuob-campo">
      <label htmlFor="tuob-slug">Subdominio</label>
      <span className="tuob-control" data-chequeo={err ? 'ocupado' : sub}>
        <input id="tuob-slug" className="tuob-input tuob-input--mono tuob-input--sufijo" value={d.slug} required
          onChange={e => poner('slug', aSlugEscribiendo(e.target.value))} onBlur={() => tocar('slug')}
          placeholder={sugerido || 'mi-negocio'} autoComplete="off" autoCapitalize="none" spellCheck={false}
          aria-invalid={err ? true : undefined} aria-describedby={describe} />
        <span className="tuob-sufijo" aria-hidden>.orbita.site</span>
      </span>
      {err ? <MensajeError id="tuob-slug-error">{err}</MensajeError>
        : sub === 'verificando' ? <p id="tuob-slug-estado" className="tuob-chequeo" role="status"><LoaderCircle size={14} className="tuob-girando" aria-hidden /> Viendo si está libre…</p>
        : sub === 'libre' ? <p id="tuob-slug-estado" className="tuob-chequeo" data-ok="true" role="status"><Check size={14} strokeWidth={3} aria-hidden /> Está disponible</p>
        : <p id="tuob-slug-ayuda" className="tuob-ayuda">Es la dirección de tu página. Después podés conectar un dominio propio, como tunegocio.com.ar.</p>}
      {sugerido.length >= 3 && sugerido !== d.slug && (
        <button type="button" className="tuob-enlace" onClick={() => { poner('slug', sugerido); tocar('slug') }}>
          <Wand2 size={13} aria-hidden /> Generar a partir del nombre
        </button>
      )}
    </div>
  )
}

export function PasoNegocio({ d, poner, error, tocar, sub }: PropsPaso & { sub: Chequeo }) {
  const tienda = d.modulo === 'tienda'
  // Al salir del nombre, si el subdominio sigue vacío se propone uno: un paso menos.
  const salirDelNombre = () => {
    tocar('negocio')
    if (!d.slug && aSlug(d.negocio).length >= 3) poner('slug', aSlug(d.negocio))
  }
  return (
    <div className="tuob-ancho tuob-ancho--form">
      <div style={{ display: 'grid', gap: 14 }}>
        <div className="tuob-form">
          <CampoLogo d={d} poner={poner} />
          <Entrada id="tuob-negocio" label="Nombre del negocio" valor={d.negocio} onCambio={v => poner('negocio', v)} onTocar={salirDelNombre}
            error={error('negocio')} placeholder={tienda ? 'Ej: Almacén del Sur' : 'Ej: Estudio Norte'} autoComplete="organization" maxLength={60} required />
          <AreaTexto id="tuob-descripcion" label="Descripción corta" opcional valor={d.descripcion} onCambio={v => poner('descripcion', v)} filas={2} maxLength={160}
            ayuda={tienda ? 'Una o dos líneas que cuenten qué vendés. Aparece en tu tienda.' : 'Una o dos líneas que cuenten qué hacen. Aparece debajo del nombre en tu página.'}
            placeholder={tienda ? 'Contá en pocas palabras qué vendés…' : 'Contá en pocas palabras qué ofrecés…'} />
          <div className="tuob-fila2">
            <Entrada id="tuob-telefono" label="Teléfono" type="tel" inputMode="tel" valor={d.telefono} onCambio={v => poner('telefono', v)} onTocar={() => tocar('telefono')}
              error={error('telefono')} ayuda="Es tu contacto público: tus clientes te escriben por WhatsApp a este número." placeholder="11 5555-0101" autoComplete="tel" mono required />
            <CampoSubdominio d={d} poner={poner} error={error} tocar={tocar} sub={sub} />
          </div>
        </div>

        {tienda && (
          <div className="tuob-form">
            <fieldset className="tuob-campo">
              <legend className="tuob-leyenda">¿Cómo vas a vender?</legend>
              <p className="tuob-ayuda" style={{ margin: '2px 0 5px' }}>Definí cómo van a operar tus clientes con vos. Podés cambiarlo más adelante.</p>
              <div className="tuob-opciones">
                <Opcion grupo="tuob-modo-venta" valor="ecommerce" elegido={d.modoVenta === 'ecommerce'} onElegir={() => poner('modoVenta', 'ecommerce')} Icon={ShoppingCart}
                  titulo="Tienda online" texto="Catálogo con carrito, checkout y cobro online completo." />
                <Opcion grupo="tuob-modo-venta" valor="vidriera" elegido={d.modoVenta === 'vidriera'} onElegir={() => poner('modoVenta', 'vidriera')} Icon={Eye}
                  titulo="Vidriera digital" texto="Solo mostrás tu catálogo. Tus clientes te consultan por WhatsApp." />
              </div>
            </fieldset>
            {d.modoVenta === 'vidriera' && (
              <Aviso tono="aviso" Icon={TriangleAlert}>
                <strong>Con vidriera digital no vas a tener:</strong> checkout ni carrito, módulo de clientes y pedidos, cupones, mensajes ni opiniones de compradores.
                Vas a poder seguir creando productos y aplicando descuentos, y cada producto lleva un botón para consultarte por WhatsApp.
              </Aviso>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
