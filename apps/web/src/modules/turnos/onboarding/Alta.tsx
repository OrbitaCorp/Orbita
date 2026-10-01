// DEMO INTERNA — el alta única de Órbita: un solo recorrido para los dos
// módulos. Arranca eligiendo con qué se quiere empezar (Tienda o Turnos) y el
// arco de arriba suma las estaciones de ese módulo. Los dos caminos andan de
// punta a punta:
//
//   Tienda → módulo · qué vendés · tu negocio · ubicación · tu cuenta · pago
//   Turnos → módulo · rubro · servicios · tu negocio · ubicación · tu página ·
//            tu cuenta · pago
//
// Pide lo mismo que el alta real de Tienda (modules/onboarding): logo, nombre,
// teléfono, subdominio con chequeo, ubicación con mapa, cuenta con confirmación
// de contraseña, plan y pago. Turnos suma lo suyo: dónde atiende (local, a
// domicilio, online), días y horarios, y la forma de su página.
//
// Todo es local: no llama a la API ni crea ningún negocio. Lo que se carga
// vive en el navegador (estadoAlta.ts) y, al terminar el camino de Turnos, pasa
// al resto de la demo (demo/negocioDemo.ts): el sitio, la reserva y el panel
// muestran el negocio que se acaba de dar de alta.
//
// En Turnos, el rubro elegido ES el ?rubro= de la demo (no hay un estado
// aparte): si se cambia desde la tira de arriba, el alta lo sigue, y lo que se
// edita de cada rubro (servicios, seña) se guarda por rubro.
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/router'
import { ArrowRight, CalendarClock, ChevronLeft, Eye, Lock, ShoppingBag } from 'lucide-react'
import { OrbitaLogo } from '@/design-system/components/OrbitaLogo'
import { fmt } from '@/modules/landing/components/v2/planesDatos'
import { MODO_LABEL } from '@/modules/turnos/datos'
import { useRubroDemo } from '@/modules/turnos/demo/BarraDemo'
import { useNegocioDemo } from '@/modules/turnos/demo/negocioDemo'
import { EstiloTurnos } from '@/modules/turnos/_shared/orbita/estilo'
import { Estrellas, Anillos } from '@/modules/turnos/_shared/orbita/Cielo'
import { CSS_ONBOARDING } from './estilo'
import { useAlta } from './estadoAlta'
import { OrbitaPasos } from './OrbitaPasos'
import { PasoModulo } from './PasoModulo'
import { PasoTipo } from './PasoTipo'
import { PasoRubro } from './PasoRubro'
import { PasoServicios } from './PasoServicios'
import { PasoNegocio } from './PasoNegocio'
import { PasoUbicacion } from './PasoUbicacion'
import { PasoPagina } from './PasoPagina'
import { PasoCuenta } from './PasoCuenta'
import { PasoPago, importeDe } from './PasoPago'
import { Listo } from './Listo'
import {
  EMAIL_OK, aSlug, chequeoEmail, chequeoSubdominio, identidadDe, pasosDe, serviciosIniciales, validar,
  type ContextoAlta, type DatosAlta, type Modulo, type PasoId, type ServicioAlta,
} from './modelo'

interface Titulo { titulo: string; resalte: string; bajada: string }

const TITULOS: Record<PasoId, (m: Modulo | null) => Titulo> = {
  modulo: () => ({ titulo: '¿Con qué', resalte: 'querés arrancar?', bajada: 'Elegí el módulo de tu negocio. Te pedimos solo lo que ese módulo necesita, y en unos minutos queda funcionando.' }),
  tipo: () => ({ titulo: '¿Qué tipo de', resalte: 'productos vendés?', bajada: 'Podés elegir más de uno. Adaptamos tu catálogo según lo que vendas.' }),
  rubro: () => ({ titulo: '¿Qué tipo de', resalte: 'negocio tenés?', bajada: 'Elegí tu rubro y armamos la agenda con los servicios típicos. Después podés cambiar todo.' }),
  servicios: () => ({ titulo: '¿Qué', resalte: 'servicios ofrecés?', bajada: 'Te dejamos cargados los más comunes. Ajustá nombre, duración y precio, y sacá los que no uses.' }),
  negocio: m => ({ titulo: 'Contanos de', resalte: 'tu negocio.', bajada: m === 'tienda' ? 'Con estos datos armamos tu tienda. Los podés cambiar cuando quieras.' : 'Con estos datos armamos tu página de reservas. Los podés cambiar cuando quieras.' }),
  ubicacion: m => m === 'tienda'
    ? { titulo: '¿Dónde', resalte: 'operás?', bajada: 'Si tenés un local, lo ubicamos en el mapa para que tus clientes lo encuentren.' }
    : { titulo: '¿Dónde y cuándo', resalte: 'atendés?', bajada: 'Tus clientes solo van a poder reservar dentro de estos días y horarios.' },
  pagina: () => ({ titulo: '¿Cómo querés', resalte: 'tu página?', bajada: 'Es lo que ven tus clientes cuando entran a tu link para reservar.' }),
  cuenta: () => ({ titulo: 'Ahora,', resalte: 'tu cuenta.', bajada: 'Con esto entrás al panel para manejar tu negocio.' }),
  pago: () => ({ titulo: 'Último paso:', resalte: 'tu plan.', bajada: 'Revisá que esté todo bien y elegí cómo arrancar.' }),
}

const MODULO_TXT: Record<Modulo, string> = { tienda: 'Tienda online', turnos: 'Turnos y reservas' }
// Cómo se nombra al negocio en la botonera mientras todavía no tiene nombre.
const SIN_NOMBRE: Record<Modulo, string> = { tienda: 'Tu tienda en Órbita', turnos: 'Tu agenda en Órbita' }
// Pasos que en celular tienen una vista previa más abajo: la botonera ofrece un atajo.
const CON_PREVIA: PasoId[] = ['tipo', 'rubro', 'pagina']

export default function Alta() {
  const router = useRouter()
  const [rubroDemo, setRubroDemo] = useRubroDemo()
  // Sin ?rubro= en la URL no hay nada elegido: el default de la demo (barbería)
  // no cuenta como una elección del dueño.
  const rubro = typeof router.query.rubro === 'string' ? rubroDemo : null
  const { estado, cambiar, reiniciar: borrar } = useAlta()
  const { guardar } = useNegocioDemo()
  const { datos, editados, senas, alcanzado } = estado

  const [direccion, setDireccion] = useState<'adelante' | 'atras'>('adelante')
  const [intentados, setIntentados] = useState<PasoId[]>([])
  const [tocados, setTocados] = useState<string[]>([])
  const [pago, setPago] = useState<'no' | 'conectando' | 'creando'>('no')
  const raiz = useRef<HTMLDivElement>(null)
  const esperas = useRef<number[]>([])
  useEffect(() => () => esperas.current.forEach(x => window.clearTimeout(x)), [])

  // ── Pasos ──
  const pasos = pasosDe(datos.modulo)
  const n = pasos.length
  // En Turnos, sin rubro en la URL no se puede estar más allá del paso "Rubro".
  const iRubro = pasos.findIndex(p => p.id === 'rubro')
  const paso = datos.modulo === 'turnos' && !rubro && estado.paso > iRubro ? iRubro : Math.min(estado.paso, n)
  const terminado = paso >= n
  const id = pasos[Math.min(paso, n - 1)].id
  const ultimo = paso === n - 1

  // ── Chequeos simulados (el alta real le pregunta a la API) ──
  const [slugVisto, setSlugVisto] = useState('')
  const [mailVisto, setMailVisto] = useState('')
  const email = datos.email.trim().toLowerCase()
  useEffect(() => {
    if (aSlug(datos.slug).length < 3 || slugVisto === datos.slug) return
    const x = window.setTimeout(() => setSlugVisto(datos.slug), 700)
    return () => window.clearTimeout(x)
  }, [datos.slug, slugVisto])
  useEffect(() => {
    if (!EMAIL_OK.test(email) || mailVisto === email) return
    const x = window.setTimeout(() => setMailVisto(email), 700)
    return () => window.clearTimeout(x)
  }, [email, mailVisto])

  // ── Datos y validación ──
  const servicios: ServicioAlta[] = rubro ? (editados[rubro.key] ?? serviciosIniciales(rubro)) : []
  const sena = rubro ? (senas[rubro.key] ?? rubro.sena) : 0
  const ctx: ContextoAlta = { rubro, servicios, sub: chequeoSubdominio(datos.slug, slugVisto), mail: chequeoEmail(datos.email, mailVisto) }
  const errores = validar(id, datos, ctx)
  const cantErrores = Object.keys(errores).length
  const intentado = intentados.includes(id)

  const poner = <K extends keyof DatosAlta>(campo: K, valor: DatosAlta[K]) => cambiar(e => ({ ...e, datos: { ...e.datos, [campo]: valor } }))
  const tocar = (campo: string) => setTocados(t => (t.includes(campo) ? t : [...t, campo]))
  const error = (campo: string) => (intentado || tocados.includes(campo) ? errores[campo] : undefined)
  const marcar = (p: PasoId) => setIntentados(x => (x.includes(p) ? x : [...x, p]))

  const ir = (destino: number) => {
    setDireccion(destino > paso ? 'adelante' : 'atras')
    cambiar(e => ({ ...e, paso: destino, alcanzado: Math.max(e.alcanzado, Math.min(destino, n - 1)) }))
    window.scrollTo({ top: 0 })
    // El foco pasa al título del paso nuevo: quien navega con teclado o lector
    // de pantalla se entera de que cambió la pantalla y arranca desde arriba.
    requestAnimationFrame(() => raiz.current?.querySelector<HTMLElement>('[data-titulo]')?.focus({ preventScroll: true }))
  }
  // Al primer campo con error, que recién queda marcado en el próximo pintado.
  const alError = () => requestAnimationFrame(() => raiz.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus())

  const pagar = () => {
    setPago('conectando')
    esperas.current = [
      window.setTimeout(() => setPago('creando'), 1300),
      window.setTimeout(() => {
        // Turnos: lo cargado pasa al resto de la demo (sitio, reserva y panel).
        if (datos.modulo === 'turnos' && rubro) guardar({ identidad: identidadDe(datos, rubro, servicios, sena), forma: datos.forma, cuentas: datos.cuentas })
        setPago('no')
        ir(n)
      }, 2600),
    ]
  }

  const continuar = () => {
    if (pago !== 'no') return
    if (cantErrores) { marcar(id); alError(); return }
    if (ultimo) pagar()
    else ir(paso + 1)
  }

  /** Desde el arco: para atrás se vuelve siempre; para adelante, solo si lo del medio sigue en orden. */
  const irDesdeArco = (destino: number) => {
    for (let i = paso; i < destino; i++) {
      if (Object.keys(validar(pasos[i].id, datos, ctx)).length === 0) continue
      marcar(pasos[i].id)
      if (i !== paso) ir(i)
      alError()
      return
    }
    ir(destino)
  }

  const elegirModulo = (m: Modulo) => cambiar(e => (e.datos.modulo === m ? e : { ...e, alcanzado: 0, datos: { ...e.datos, modulo: m } }))

  const cambiarServicios = (cambio: (s: ServicioAlta[]) => ServicioAlta[]) => {
    if (!rubro) return
    cambiar(e => ({ ...e, editados: { ...e.editados, [rubro.key]: cambio(e.editados[rubro.key] ?? serviciosIniciales(rubro)) } }))
  }

  const reiniciar = () => {
    borrar()
    setIntentados([]); setTocados([]); setDireccion('atras')
    window.scrollTo({ top: 0 })
    requestAnimationFrame(() => raiz.current?.querySelector<HTMLElement>('[data-titulo]')?.focus({ preventScroll: true }))
  }

  // ── Botonera ──
  const t = TITULOS[id](datos.modulo)
  const turnos = datos.modulo === 'turnos'
  const nombre = datos.negocio.trim() || (datos.modulo ? SIN_NOMBRE[datos.modulo] : 'Tu negocio en Órbita')
  const pista: Partial<Record<PasoId, string>> = {
    modulo: datos.modulo ? `${MODULO_TXT[datos.modulo]} · ${n} pasos` : 'Elegí un módulo para seguir',
    tipo: datos.tipos.length ? `${datos.tipos.length} rubro${datos.tipos.length === 1 ? '' : 's'} elegido${datos.tipos.length === 1 ? '' : 's'}` : 'Elegí qué vendés para seguir',
    rubro: rubro ? `${rubro.label} · ${MODO_LABEL[rubro.modo].toLowerCase()}${rubro.sena ? ` · seña sugerida ${rubro.sena}%` : ''}` : 'Elegí tu rubro para seguir',
    servicios: `${servicios.length} servicio${servicios.length === 1 ? '' : 's'} · ${sena ? `seña del ${sena}%` : 'sin seña'}`,
  }
  const conError = intentado && cantErrores > 0
  const estadoTxt = conError
    ? (cantErrores === 1 ? Object.values(errores)[0] : `Faltan completar ${cantErrores} datos`)
    : pista[id] ?? `Paso ${paso + 1} de ${n} · ${pasos[paso]?.label}`
  const IconoPie = turnos ? (rubro?.Icon ?? CalendarClock) : datos.modulo === 'tienda' ? ShoppingBag : null
  const verPrevia = CON_PREVIA.includes(id) && (id !== 'rubro' || !!rubro) && (id !== 'tipo' || datos.tipos.length > 0)

  return (
    <div ref={raiz} className="tuo tuo-espacio tuob">
      <EstiloTurnos />
      <style>{CSS_ONBOARDING}</style>
      <Estrellas cantidad={70} />
      <div className="tuob-cielo" aria-hidden>
        <Anillos size={760} lado="derecha" opacidad={0.5} />
        <Anillos size={520} lado="izquierda" opacidad={0.28} style={{ position: 'fixed' }} />
      </div>

      <header className="tuob-cab">
        <span className="tuob-marca"><OrbitaLogo size={26} /> Órbita</span>
        <OrbitaPasos pasos={pasos} actual={paso} alcanzado={alcanzado} onIr={irDesdeArco} />
      </header>

      {/* key = paso: al cambiar se monta de nuevo y vuelve a correr la animación
          de entrada, desde la derecha al avanzar y desde la izquierda al volver. */}
      <main key={terminado ? 'listo' : id} className="tuob-paso" data-dir={direccion}>
        {terminado ? <Listo d={datos} rubro={turnos ? rubro : null} cantServicios={servicios.length} onReiniciar={reiniciar} /> : (
          <>
            <div className="tuob-ancho">
              <div className="tuob-titulo">
                <h1 className="tuob-h1" tabIndex={-1} data-titulo>{t.titulo} <em>{t.resalte}</em></h1>
                <p>{t.bajada}</p>
              </div>
            </div>
            {id === 'modulo' && <PasoModulo elegido={datos.modulo} onElegir={elegirModulo} />}
            {id === 'tipo' && <PasoTipo elegidos={datos.tipos} onCambio={v => poner('tipos', v)} />}
            {id === 'rubro' && <PasoRubro elegido={rubro} onElegir={r => setRubroDemo(r.key)} />}
            {id === 'servicios' && rubro && (
              <PasoServicios rubro={rubro} servicios={servicios} onCambio={cambiarServicios} sena={sena}
                onSena={p => cambiar(e => ({ ...e, senas: { ...e.senas, [rubro.key]: p } }))} errores={errores} intentado={intentado} />
            )}
            {id === 'negocio' && <PasoNegocio d={datos} poner={poner} error={error} tocar={tocar} sub={ctx.sub} />}
            {id === 'ubicacion' && <PasoUbicacion d={datos} poner={poner} error={error} tocar={tocar} rubro={turnos ? rubro : null} />}
            {id === 'pagina' && rubro && <PasoPagina d={datos} poner={poner} rubro={rubro} servicios={servicios} />}
            {id === 'cuenta' && <PasoCuenta d={datos} poner={poner} error={error} tocar={tocar} mail={ctx.mail} />}
            {id === 'pago' && <PasoPago d={datos} poner={poner} rubro={turnos ? rubro : null} servicios={servicios} sena={sena} />}
          </>
        )}
      </main>

      {!terminado && (
        <div className="tuob-pie" role="region" aria-label="Avanzar en el alta">
          <div className="tuob-ancho tuob-pie-in">
            <div className="tuob-pie-resumen">
              <span aria-hidden>{IconoPie ? <IconoPie size={19} strokeWidth={1.75} /> : <OrbitaLogo size={20} animated={false} />}</span>
              <div style={{ minWidth: 0, flex: 1 }}>
                <b>{nombre}</b>
                <small role="status" data-error={conError}>{estadoTxt}</small>
              </div>
              {verPrevia && <a href="#tuob-previa" className="tuo-btn tuo-btn--sm tuob-ver-previa"><Eye size={15} aria-hidden /> Ver cómo queda</a>}
            </div>
            <div className="tuob-pie-botones">
              {paso > 0 && (
                <button type="button" className="tuo-btn tuo-btn--lg tuob-volver" onClick={() => ir(paso - 1)} disabled={pago !== 'no'} aria-label="Volver al paso anterior">
                  <ChevronLeft size={18} className="tuob-flecha tuob-flecha--atras" aria-hidden /> <span>Volver</span>
                </button>
              )}
              <button type="button" className="tuo-btn tuo-btn--primario tuo-btn--lg" onClick={continuar} disabled={pago !== 'no'} aria-busy={pago !== 'no'}>
                {ultimo
                  ? <><Lock size={16} aria-hidden /> <span>Pagar <span className="tuo-num">{fmt(importeDe(datos).hoy)}</span><span className="tuob-solo-ancho"> con Mercado Pago</span></span></>
                  : <>Continuar <ArrowRight size={17} className="tuob-flecha" aria-hidden /></>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* El "pago": dos momentos, como pasaría de verdad. Tapa todo para que no se toque nada mientras tanto. */}
      {pago !== 'no' && (
        <div className="tuob-procesando" role="alertdialog" aria-modal="true" aria-labelledby="tuob-procesando-tit" aria-describedby="tuob-procesando-txt">
          <div className="tuob-procesando-caja">
            <svg width="92" height="92" viewBox="0 0 92 92" aria-hidden>
              <circle cx="46" cy="46" r="40" fill="none" stroke="rgba(147,197,253,0.2)" strokeDasharray="2 7" strokeLinecap="round" />
              <circle cx="46" cy="46" r="15" fill="url(#tuobProcesando)" />
              <defs>
                <radialGradient id="tuobProcesando" cx="36%" cy="30%" r="78%">
                  <stop offset="0%" stopColor="#BFDBFE" /><stop offset="45%" stopColor="#3B82F6" /><stop offset="100%" stopColor="#1E3A8A" />
                </radialGradient>
              </defs>
              <g className="tuob-gira" style={{ transformOrigin: '46px 46px', animation: 'tuoGira 1.6s linear infinite' }}>
                <circle cx="46" cy="6" r="8" fill="#93C5FD" opacity="0.25" />
                <circle cx="46" cy="6" r="4" fill="#EFF6FF" />
              </g>
            </svg>
            <strong id="tuob-procesando-tit" key={pago} className="tuo-entra">
              {pago === 'conectando' ? 'Conectando con Mercado Pago…' : turnos ? 'Pago aprobado. Armando tu agenda…' : 'Pago aprobado. Creando tu tienda…'}
            </strong>
            <span id="tuob-procesando-txt">Vista previa: no se cobra nada.</span>
          </div>
        </div>
      )}
    </div>
  )
}
