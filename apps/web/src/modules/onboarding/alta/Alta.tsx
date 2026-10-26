// El alta única de Órbita: un solo recorrido para los cuatro módulos (Tienda,
// Turnos, Alquileres y Gimnasio). Tiene dos usos, según la prop `real`:
//
//   - real (pages/onboarding/rubro.tsx): es el alta de producción. El subdominio
//     y el email se chequean contra la API y, al terminar "Tu cuenta", lo
//     cargado pasa al wizard de siempre (modules/onboarding/useOnboardingStore)
//     y sigue en /onboarding/plan, que es donde se elige el plan, se paga y
//     recién ahí se crea la cuenta. Acá no se crea nada. Los módulos de
//     MODULOS_PROXIMAMENTE (Turnos, Alquileres y Gimnasio) se muestran pero no
//     se pueden elegir: Tienda sigue igual que siempre.
//   - demo (pages/{turnos,alquileres,gimnasio}-demo/onboarding.tsx): lo que
//     sigue, todo local y con los cuatro módulos habilitados.
//
// DEMO INTERNA — arranca eligiendo con qué se quiere empezar (cada página de
// demo lo trae elegido con `modulo`, y cualquiera acepta ?modulo=) y el arco de
// arriba suma las estaciones de ese módulo. Los cuatro caminos andan de punta
// a punta:
//
//   Tienda     → módulo · qué vendés · tu negocio · ubicación · tu cuenta · pago
//   Turnos     → módulo · rubro · servicios · tu negocio · ubicación · tu página ·
//                tu cuenta · pago
//   Alquileres → módulo · qué alquilás · tus espacios · tu negocio · ubicación ·
//                tu página · tu cuenta · pago
//   Gimnasio   → módulo · rubro · actividades · precios · tu negocio · ubicación ·
//                tu página · tu cuenta · pago
//
// Pide lo mismo que el alta real de Tienda (modules/onboarding): logo, nombre,
// teléfono, subdominio con chequeo, ubicación con mapa, cuenta con confirmación
// de contraseña, plan y pago. Cada módulo suma lo suyo: los pasos propios de
// Alquileres y de Gimnasio son de cada módulo (su onboarding/pasos.tsx), y los
// textos de los pasos comunes cambian según el módulo (textos.ts).
//
// Todo es local: no llama a la API ni crea ningún negocio. Lo que se carga vive
// en el navegador (estadoAlta.ts) y, al terminar, pasa a la demo de su módulo:
// Turnos muestra el "¡Listo!" con su sitio y su panel, que ya muestran lo
// cargado (modules/turnos/datos/negocio.ts); Alquileres y Gimnasio guardan el
// negocio en su demo y siguen directo en su panel (CierreReservas.tsx).
//
// Lo de Alquileres y Gimnasio (sus pasos, "Tu página", el cierre y lo que se
// calcula con sus datos) se baja recién cuando se elige uno de los dos: el alta
// real, donde están en "Próximamente", no lo carga nunca. Por eso de esos
// módulos acá se importan solo tipos, y lo demás llega con next/dynamic o con
// import() (cargaReservas.ts).
//
// En Turnos, el rubro elegido ES el ?rubro= de la demo (no hay un estado
// aparte): si se cambia desde la tira de arriba, el alta lo sigue, y lo que se
// edita de cada rubro (servicios, seña) se guarda por rubro.
import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/router'
import dynamic, { type DynamicOptionsLoadingProps } from 'next/dynamic'
import { AlertCircle, ArrowRight, ChevronLeft, Eye, LoaderCircle, Lock, type LucideIcon } from 'lucide-react'
import { OrbitaLogo } from '@/design-system/components/OrbitaLogo'
import { fmt } from '@/modules/landing/components/v2/planesDatos'
import { MODO_LABEL, RUBROS_TURNOS } from '@/modules/turnos/datos'
import { useRubroDemo } from '@/modules/turnos/demo/BarraDemo'
import { useNegocioDemo } from '@/modules/turnos/datos/negocio'
import { EstiloTurnos } from '@/modules/turnos/_shared/orbita/estilo'
import type { AltaAlquiler } from '@/modules/alquileres/onboarding/pasos'
import type { AltaGym } from '@/modules/gimnasio/onboarding/pasos'
import { EscenaEspacial } from '@/modules/landing/components/v2/EscenaEspacial'
import { checkEmail, checkSubdomain } from '@/lib/api'
import { flush as flushAnalitica, track, trackDisponibilidad, trackPaso, trackVolverAtras } from '@/lib/analytics/wizardTracker'
import { useOnboardingHidratado, useOnboardingStore } from '@/modules/onboarding/useOnboardingStore'
import { CSS_ONBOARDING } from './estilo'
import { useAlta } from './estadoAlta'
import { OrbitaPasos } from './OrbitaPasos'
import { OrbiAlta } from './OrbiAlta'
import { ICONO_MODULO, PasoModulo } from './PasoModulo'
import { PasoTipo } from './PasoTipo'
import { PasoRubro } from './PasoRubro'
import { PasoServicios } from './PasoServicios'
import { PasoNegocio } from './PasoNegocio'
import { PasoUbicacion } from './PasoUbicacion'
import { PasoPagina } from './PasoPagina'
import { PasoCuenta } from './PasoCuenta'
import { PasoPago, importeDe } from './PasoPago'
import { Listo } from './Listo'
import { useReservas } from './cargaReservas'
import type { Destino } from './CierreReservas'
import { TEXTOS, TITULOS, rotuloQueAlquilas } from './textos'
import {
  EMAIL_OK, aSlug, chequeoEmail, chequeoSubdominio, esModulo, esPasoReservas, identidadDe, modalidadesAlta, moduloHabilitado, pasosDe, serviciosIniciales, validar,
  type Chequeo, type ContextoAlta, type DatosAlta, type Modulo, type PasoId, type ServicioAlta,
} from './modelo'

// Pasos que en celular tienen una vista previa más abajo: la botonera ofrece un atajo.
const CON_PREVIA: PasoId[] = ['rubro', 'pagina']

// Cómo se llama cada paso en el embudo (analytics): los mismos nombres que usaba
// el alta anterior, para que los gráficos sigan comparando lo mismo.
const NOMBRE_EMBUDO: Partial<Record<PasoId, string>> = { modulo: 'rubro', tipo: 'subrubros', negocio: 'tu-negocio', ubicacion: 'ubicacion', cuenta: 'cuenta' }
// Cómo se llama cada campo en la analítica de Orbi (los nombres del alta anterior): los gráficos siguen comparando lo mismo.
const NOMBRE_ORBI: Record<string, string> = { negocio: 'nombre', slug: 'subdominio' }
// El pago es el de siempre: la pantalla de plan de Tienda.
const PANTALLA_DE_PAGO = '/onboarding/plan?next=/onboarding/tienda/success'

/** Lo último que contestó la API sobre un subdominio o un email. */
interface Visto { valor: string; estado: Chequeo }
const SIN_VER: Visto = { valor: '', estado: 'vacio' }

/** El ícono de la botonera: el del rubro, el del modo o el del módulo; sin módulo, el logo. */
function IconoPie({ Icon }: { Icon: LucideIcon | null }) {
  return Icon ? <Icon size={19} strokeWidth={1.75} /> : <OrbitaLogo size={20} animated={false} />
}

/**
 * Mientras baja un paso de Alquileres o de Gimnasio: guarda el lugar, para que
 * no salte lo de abajo, y el aviso sale solo si tarda (pastDelay, a los 200 ms).
 * Si no se pudo bajar, se reintenta desde acá.
 */
function CargandoPaso({ error, pastDelay, retry }: DynamicOptionsLoadingProps) {
  return (
    <div className="tuob-ancho">
      <div className="tuob-cargando" role="status" aria-busy={!error}>
        {error
          ? <p className="tuob-error"><AlertCircle size={14} aria-hidden /> No pudimos cargar este paso. <button type="button" className="tuob-enlace" onClick={retry}>Reintentar</button></p>
          : pastDelay && <><LoaderCircle size={16} className="tuob-girando" aria-hidden /> Cargando…</>}
      </div>
    </div>
  )
}

// Las pantallas de Alquileres y de Gimnasio: se bajan la primera vez que se
// muestran (ver el comentario de arriba). El cierre lo baja el pago (terminar).
const PasosReservas = dynamic(() => import('./PasosReservas'), { ssr: false, loading: CargandoPaso })
const PasoPaginaReservas = dynamic(() => import('./PasoPaginaReservas').then(m => m.PasoPaginaReservas), { ssr: false, loading: CargandoPaso })
const CierreReservas = dynamic(() => import('./CierreReservas'), { ssr: false })

export default function Alta({ real = false, modulo: pedido }: {
  real?: boolean
  /** El módulo que la página trae elegido (las demos de cada módulo). Sin esto vale el ?modulo= de la URL. */
  modulo?: Modulo
}) {
  const router = useRouter()
  const [rubroDemo, setRubroDemo] = useRubroDemo()
  // Sin ?rubro= en la URL no hay nada elegido: el default de la demo (barbería)
  // no cuenta como una elección del dueño. Tampoco cuenta un ?rubro= que no es
  // de Turnos, como el de la demo de Gimnasio (crossfit, yoga…).
  const rubroQuery = router.query.rubro
  const rubro = typeof rubroQuery === 'string' && RUBROS_TURNOS.some(r => r.key === rubroQuery) ? rubroDemo : null
  const { estado, cambiar, reiniciar: borrar } = useAlta(real)
  const { guardar } = useNegocioDemo()
  const { datos, editados, senas, alcanzado, alquileres, gimnasio } = estado
  // Alquileres y Gimnasio: lo que se calcula con sus datos llega recién al elegir uno (null mientras tanto).
  const esReservas = datos.modulo === 'alquileres' || datos.modulo === 'gimnasio'
  const reservas = useReservas(esReservas)

  const [direccion, setDireccion] = useState<'adelante' | 'atras'>('adelante')
  const [intentados, setIntentados] = useState<PasoId[]>([])
  const [tocados, setTocados] = useState<string[]>([])
  const [pago, setPago] = useState<'no' | 'conectando' | 'creando'>('no')
  // Alquileres y Gimnasio, al terminar el pago: CierreReservas montado, guardando el negocio en su demo.
  const [cerrando, setCerrando] = useState(false)
  const raiz = useRef<HTMLDivElement>(null)
  // La botonera fija: Orbi se acomoda arriba de ella (ver OrbiAlta).
  const pie = useRef<HTMLDivElement>(null)
  const esperas = useRef<number[]>([])
  useEffect(() => () => esperas.current.forEach(x => window.clearTimeout(x)), [])

  // ── Pasos ──
  // En Alquileres, la estación de lo que se alquila toma el nombre del tipo ("Tu salón").
  const pasos = pasosDe(datos.modulo, { 'que-alquilas': rotuloQueAlquilas(alquileres.tipo ?? null) })
  const n = pasos.length
  // Sin la elección propia del módulo (el rubro de Turnos, que vive en la URL;
  // qué se alquila; el rubro de Gimnasio) no se puede estar más allá de ese paso.
  const sinElegir: PasoId | null = datos.modulo === 'turnos' && !rubro ? 'rubro'
    : datos.modulo === 'alquileres' && !alquileres.tipo ? 'tipo-alquiler'
    : datos.modulo === 'gimnasio' && !gimnasio.rubro ? 'rubro-gym'
    : null
  const tope = sinElegir ? pasos.findIndex(p => p.id === sinElegir) : n
  // En el alta real el último paso que se recorre acá es "Tu cuenta": el pago es otra pantalla.
  const iCuenta = pasos.findIndex(p => p.id === 'cuenta')
  const paso = real ? Math.min(estado.paso, iCuenta) : Math.min(estado.paso, tope)
  const terminado = paso >= n
  const id = pasos[Math.min(paso, n - 1)].id
  const ultimo = paso === n - 1

  // ── Chequeos: la demo los simula, el alta real le pregunta a la API ──
  const [slugVisto, setSlugVisto] = useState('')
  const [mailVisto, setMailVisto] = useState('')
  const [subReal, setSubReal] = useState<Visto>(SIN_VER)
  const [mailReal, setMailReal] = useState<Visto>(SIN_VER)
  const email = datos.email.trim().toLowerCase()
  const subdominio = aSlug(datos.slug)
  useEffect(() => {
    if (real || aSlug(datos.slug).length < 3 || slugVisto === datos.slug) return
    const x = window.setTimeout(() => setSlugVisto(datos.slug), 700)
    return () => window.clearTimeout(x)
  }, [real, datos.slug, slugVisto])
  useEffect(() => {
    if (real || !EMAIL_OK.test(email) || mailVisto === email) return
    const x = window.setTimeout(() => setMailVisto(email), 700)
    return () => window.clearTimeout(x)
  }, [real, email, mailVisto])
  // Si la API no contesta no se traba el alta (queda sin veredicto, como en el
  // alta anterior): el registro lo vuelve a validar del lado del servidor.
  useEffect(() => {
    if (!real || subdominio.length < 3 || subReal.valor === subdominio) return
    let vigente = true
    const x = window.setTimeout(() => {
      checkSubdomain(subdominio)
        .then(r => {
          if (!vigente) return
          setSubReal({ valor: subdominio, estado: r.available ? 'libre' : 'ocupado' })
          trackDisponibilidad('subdominio', 'tu-negocio', r.available ? 'disponible' : 'ocupado')
        })
        .catch(() => { if (vigente) setSubReal({ valor: subdominio, estado: 'vacio' }) })
    }, 700)
    return () => { vigente = false; window.clearTimeout(x) }
  }, [real, subdominio, subReal.valor])
  useEffect(() => {
    if (!real || !EMAIL_OK.test(email) || mailReal.valor === email) return
    let vigente = true
    const x = window.setTimeout(() => {
      checkEmail(email)
        .then(r => {
          if (!vigente) return
          setMailReal({ valor: email, estado: r.available ? 'libre' : 'ocupado' })
          trackDisponibilidad('email', 'cuenta', r.available ? 'disponible' : 'ocupado')
        })
        .catch(() => { if (vigente) setMailReal({ valor: email, estado: 'vacio' }) })
    }, 700)
    return () => { vigente = false; window.clearTimeout(x) }
  }, [real, email, mailReal.valor])
  const chequeoSub: Chequeo = !real ? chequeoSubdominio(datos.slug, slugVisto)
    : subdominio.length < 3 ? 'vacio' : subReal.valor !== subdominio ? 'verificando' : subReal.estado
  const chequeoMail: Chequeo = !real ? chequeoEmail(datos.email, mailVisto)
    : !EMAIL_OK.test(email) ? 'vacio' : mailReal.valor !== email ? 'verificando' : mailReal.estado

  // ── Alta real: el wizard de siempre, que es de donde lee /onboarding/plan ──
  const wizard = useOnboardingStore(st => st.wizard)
  const setWizard = useOnboardingStore(st => st.setWizard)
  const wizardListo = useOnboardingHidratado()
  // Quien vuelve desde el pago (?paso=cuenta, ver volverAPoner en
  // pages/onboarding/plan.tsx) en otra pestaña retoma en "Tu cuenta" con lo que
  // ya había cargado: lo de esta alta vive por pestaña y el wizard, en
  // localStorage. La contraseña se vuelve a pedir. Solo con ese parámetro: un
  // wizard viejo que quedó guardado no tiene que saltearle los pasos a quien
  // entra de cero.
  const retomado = useRef(false)
  useEffect(() => {
    if (!real || !wizardListo || !router.isReady || retomado.current) return
    retomado.current = true
    if (router.query.paso !== 'cuenta' || datos.modulo || wizard.rubro !== 'tienda' || !wizard.nombre) return
    const cuenta = pasosDe('tienda').findIndex(p => p.id === 'cuenta')
    cambiar(e => ({
      ...e, paso: cuenta, alcanzado: cuenta,
      datos: {
        ...e.datos, modulo: 'tienda', tipos: wizard.subrubros, modoVenta: wizard.modoVenta || 'ecommerce',
        negocio: wizard.nombre, descripcion: wizard.descripcion, telefono: wizard.telefono, slug: wizard.subdominio,
        modalidades: [...(wizard.operatesPhysical ? ['local' as const] : []), ...(wizard.operatesOnline ? ['domicilio' as const] : [])],
        direccion: wizard.direccion, latLng: wizard.latLng, nombre: wizard.ownerName, email: wizard.ownerEmail, acepta: true,
      },
    }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [real, wizardListo, router.isReady])

  // El módulo que trae la página (o el ?modulo= de la URL) queda elegido al
  // entrar. Si lo guardado era de otro módulo, ese recorrido arranca desde el
  // primer paso; si era del mismo, se sigue donde estaba. Una sola vez: después
  // se puede cambiar a mano. En el alta real solo vale uno habilitado (Tienda).
  const preelegido = useRef(false)
  useEffect(() => {
    if (!router.isReady || preelegido.current) return
    preelegido.current = true
    const q = router.query.modulo
    const m = pedido ?? (esModulo(q) ? q : null)
    if (!moduloHabilitado(m, real)) return
    cambiar(e => (e.datos.modulo === m ? e : { ...e, paso: 0, alcanzado: 0, datos: { ...e.datos, modulo: m } }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router.isReady])

  // Embudo: mismos eventos que el alta anterior (entrada, paso visto, volver atrás).
  useEffect(() => { if (real) track('session_start') }, [real])
  useEffect(() => {
    const nombrePaso = NOMBRE_EMBUDO[id]
    if (real && nombrePaso) trackPaso(paso, nombrePaso, datos.modulo ?? undefined)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [real, paso])

  // ── Datos y validación ──
  const servicios: ServicioAlta[] = rubro ? (editados[rubro.key] ?? serviciosIniciales(rubro)) : []
  const sena = rubro ? (senas[rubro.key] ?? rubro.sena) : 0
  const ctx: ContextoAlta = {
    rubro, servicios, sub: chequeoSub, mail: chequeoMail,
    validarReservas: reservas && (p => reservas.validarReservas(p, alquileres, gimnasio)),
  }
  const errores = validar(id, datos, ctx)
  const cantErrores = Object.keys(errores).length
  const intentado = intentados.includes(id)

  const poner = <K extends keyof DatosAlta>(campo: K, valor: DatosAlta[K]) => cambiar(e => ({ ...e, datos: { ...e.datos, [campo]: valor } }))
  // Campos que completó Orbi (alta real): se ven marcados hasta que la persona los edita a mano.
  const [sugeridos, setSugeridos] = useState<ReadonlySet<string>>(() => new Set())
  const marcarSugerido = (campo: string) => setSugeridos(s => (s.has(campo) ? s : new Set(s).add(campo)))
  // Lo que escribe la persona: si el campo venía sugerido por Orbi, deja de estarlo.
  const ponerAMano = <K extends keyof DatosAlta>(campo: K, valor: DatosAlta[K]) => {
    poner(campo, valor)
    if (!sugeridos.has(campo)) return
    // Pisó a mano lo que Orbi había puesto: la sugerencia no le sirvió. Es la
    // señal de calidad más honesta que hay, porque no depende de que nadie vote.
    track('orbi_suggestion_overridden', { field: NOMBRE_ORBI[campo] ?? campo })
    setSugeridos(s => { const sin = new Set(s); sin.delete(campo); return sin })
  }
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

  const terminar = async () => {
    // Alquileres y Gimnasio: el negocio queda en la demo de su módulo y se sigue
    // en su panel. Lo hace CierreReservas al montarse; su código se baja recién
    // acá, y si no llega el cartel se va y se puede volver a pagar. Mientras
    // tanto el cartel sigue arriba, hasta que cambia la pantalla.
    if (esReservas) {
      const llego = await import('./CierreReservas').then(() => true, () => false)
      if (llego) setCerrando(true)
      else setPago('no')
      return
    }
    // Turnos: lo cargado pasa al resto de la demo (sitio, reserva y panel).
    if (datos.modulo === 'turnos' && rubro) guardar({ identidad: identidadDe(datos, rubro, servicios, sena), forma: datos.forma, cuentas: datos.cuentas })
    setPago('no')
    ir(n)
  }

  const pagar = () => {
    setPago('conectando')
    esperas.current = [
      window.setTimeout(() => setPago('creando'), 1300),
      window.setTimeout(() => { void terminar() }, 2600),
    ]
  }

  /** CierreReservas ya guardó el negocio: se sigue en el panel de su demo. Si la navegación no sale, el cartel se va. */
  const irAlPanel = (destino: Destino) => {
    const fallo = () => { setCerrando(false); setPago('no') }
    void router.push(destino).then(fue => { if (!fue) fallo() }, fallo)
  }

  /**
   * Alta real, fin de "Tu cuenta": lo cargado pasa al wizard y se sigue en la
   * pantalla de plan y pago de siempre. La cuenta y el negocio se crean recién
   * ahí, con el pago aprobado (ver pages/onboarding/plan.tsx). La contraseña y
   * el logo quedan solo en memoria: el store no los persiste.
   */
  const pasarAlPago = () => {
    const modalidades = modalidadesAlta(datos, null)
    const conLocal = modalidades.includes('local')
    setWizard({
      rubro: 'tienda', subrubros: datos.tipos,
      nombre: datos.negocio.trim(), descripcion: datos.descripcion.trim(), telefono: datos.telefono.trim(),
      subdominio, modoVenta: datos.modoVenta, logoDataUrl: datos.logo ?? '',
      direccion: conLocal ? [datos.direccion.trim(), datos.ciudad.trim()].filter(Boolean).join(', ') : '',
      latLng: datos.latLng, operatesPhysical: conLocal, operatesOnline: modalidades.includes('domicilio'),
      ownerName: datos.nombre.trim(), ownerEmail: email, ownerPassword: datos.clave,
    })
    track('wizard_complete', { step: paso, stepName: 'cuenta', rubro: 'tienda' })
    flushAnalitica()
    void router.push(PANTALLA_DE_PAGO)
  }

  const volver = () => {
    const nombrePaso = NOMBRE_EMBUDO[id]
    if (real && nombrePaso) trackVolverAtras(paso, nombrePaso)
    ir(paso - 1)
  }

  const continuar = () => {
    if (pago !== 'no') return
    if (cantErrores) { marcar(id); alError(); return }
    if (real && id === 'cuenta') pasarAlPago()
    else if (ultimo) pagar()
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

  // Alquileres y Gimnasio: sus pasos devuelven el pedazo que cambió, y se guarda solo eso.
  const cambiarAlquiler = (c: Partial<AltaAlquiler>) => cambiar(e => ({ ...e, alquileres: { ...e.alquileres, ...c } }))
  const cambiarGym = (c: Partial<AltaGym>) => cambiar(e => ({ ...e, gimnasio: { ...e.gimnasio, ...c } }))

  const reiniciar = () => {
    borrar()
    setIntentados([]); setTocados([]); setDireccion('atras')
    window.scrollTo({ top: 0 })
    requestAnimationFrame(() => raiz.current?.querySelector<HTMLElement>('[data-titulo]')?.focus({ preventScroll: true }))
  }

  // ── Botonera ──
  const t = TITULOS[id](datos.modulo, alquileres.tipo ?? null)
  const turnos = datos.modulo === 'turnos'
  const textos = datos.modulo ? TEXTOS[datos.modulo] : null
  const nombre = datos.negocio.trim() || (textos?.sinNombre ?? 'Tu negocio en Órbita')
  const pista: Partial<Record<PasoId, string>> = {
    modulo: textos ? `${textos.nombre} · ${n} pasos` : 'Elegí un módulo para seguir',
    tipo: datos.tipos.length ? `${datos.tipos.length} rubro${datos.tipos.length === 1 ? '' : 's'} elegido${datos.tipos.length === 1 ? '' : 's'}` : 'Elegí qué vendés para seguir',
    rubro: rubro ? `${rubro.label} · ${MODO_LABEL[rubro.modo].toLowerCase()}${rubro.sena ? ` · seña sugerida ${rubro.sena}%` : ''}` : 'Elegí tu rubro para seguir',
    servicios: `${servicios.length} servicio${servicios.length === 1 ? '' : 's'} · ${sena ? `seña del ${sena}%` : 'sin seña'}`,
  }
  const conError = intentado && cantErrores > 0
  const estadoTxt = conError
    ? (cantErrores === 1 ? Object.values(errores)[0] : `Faltan completar ${cantErrores} datos`)
    : pista[id] ?? reservas?.pistaReservas(id, datos, alquileres, gimnasio) ?? `Paso ${paso + 1} de ${n} · ${pasos[paso]?.label}`
  const iconoPie = turnos ? (rubro?.Icon ?? ICONO_MODULO.turnos)
    : reservas?.iconoReservas(datos, alquileres, gimnasio) ?? (datos.modulo ? ICONO_MODULO[datos.modulo] : null)
  const verPrevia = CON_PREVIA.includes(id) && (id !== 'rubro' || !!rubro)

  return (
    <div ref={raiz} className="tuo tuo-espacio tuob">
      <EstiloTurnos />
      <style>{CSS_ONBOARDING}</style>
      {/* El mismo cielo del home (estrellas que titilan y cometas), sin el
          planeta ni los anillos. La escena es una capa fija; el envoltorio la
          deja por detrás de todo el contenido. */}
      <div className="tuob-cielo" aria-hidden>
        <EscenaEspacial planeta={false} />
      </div>

      <header className="tuob-cab">
        {/* En el alta real la marca vuelve al home; en la demo no lleva a ningún lado. */}
        {real
          ? <Link href="/" className="tuob-marca" aria-label="Órbita: volver al inicio"><OrbitaLogo size={26} /> Órbita</Link>
          : <span className="tuob-marca"><OrbitaLogo size={26} /> Órbita</span>}
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
            {id === 'modulo' && <PasoModulo elegido={datos.modulo} onElegir={elegirModulo} real={real} />}
            {id === 'modulo' && real && (
              <p className="tuob-ya-cuenta">¿Ya tenés cuenta? <Link href="/login">Iniciá sesión</Link></p>
            )}
            {id === 'tipo' && <PasoTipo elegidos={datos.tipos} onCambio={v => poner('tipos', v)} />}
            {id === 'rubro' && <PasoRubro elegido={rubro} onElegir={r => setRubroDemo(r.key)} />}
            {id === 'servicios' && rubro && (
              <PasoServicios rubro={rubro} servicios={servicios} onCambio={cambiarServicios} sena={sena}
                onSena={p => cambiar(e => ({ ...e, senas: { ...e.senas, [rubro.key]: p } }))} errores={errores} intentado={intentado} />
            )}
            {/* Los pasos propios de Alquileres y de Gimnasio: son de cada módulo, se pintan con su kit (rv-) y se bajan recién acá. */}
            {esPasoReservas(id) && (
              <PasosReservas id={id} alquiler={alquileres} gym={gimnasio} onAlquiler={cambiarAlquiler} onGym={cambiarGym} errores={errores} intentado={intentado} />
            )}
            {id === 'negocio' && <PasoNegocio d={datos} poner={ponerAMano} error={error} tocar={tocar} sub={ctx.sub} sugeridos={sugeridos} />}
            {id === 'ubicacion' && <PasoUbicacion d={datos} poner={ponerAMano} error={error} tocar={tocar} rubro={turnos ? rubro : null} />}
            {id === 'pagina' && turnos && rubro && <PasoPagina d={datos} poner={ponerAMano} rubro={rubro} servicios={servicios} />}
            {/* "Tu página" de Alquileres y Gimnasio: lo que va a ver el cliente, armado con lo cargado. */}
            {id === 'pagina' && esReservas && <PasoPaginaReservas d={datos} poner={ponerAMano} alquiler={alquileres} gym={gimnasio} />}
            {id === 'cuenta' && <PasoCuenta d={datos} poner={ponerAMano} error={error} tocar={tocar} mail={ctx.mail} />}
            {id === 'pago' && (
              <PasoPago d={datos} poner={ponerAMano} rubro={turnos ? rubro : null} servicios={servicios} sena={sena} filas={reservas?.filasResumen(datos, alquileres, gimnasio)} />
            )}
          </>
        )}
      </main>

      {/* Orbi, el asistente del alta: solo en el alta real (la demo no llama a la API). */}
      {real && !terminado && (
        <OrbiAlta id={id} paso={paso} total={n} datos={datos} errores={errores} pie={pie}
          onElegirModulo={elegirModulo} onPoner={poner} onSugerido={marcarSugerido} onContinuar={continuar} />
      )}

      {!terminado && (
        <div ref={pie} className="tuob-pie" role="region" aria-label="Avanzar en el alta">
          <div className="tuob-ancho tuob-pie-in">
            <div className="tuob-pie-resumen">
              <span aria-hidden><IconoPie Icon={iconoPie} /></span>
              <div style={{ minWidth: 0, flex: 1 }}>
                <b>{nombre}</b>
                <small role="status" data-error={conError}>{estadoTxt}</small>
              </div>
              {verPrevia && <a href="#tuob-previa" className="tuo-btn tuo-btn--sm tuob-ver-previa"><Eye size={15} aria-hidden /> Ver cómo queda</a>}
            </div>
            <div className="tuob-pie-botones">
              {/* En el primer paso no hay paso anterior: se vuelve al home. */}
              {paso === 0 && real && (
                <Link href="/" className="tuo-btn tuo-btn--lg tuob-volver" aria-label="Volver al inicio">
                  <ChevronLeft size={18} className="tuob-flecha tuob-flecha--atras" aria-hidden /> <span>Volver al inicio</span>
                </Link>
              )}
              {paso > 0 && (
                <button type="button" className="tuo-btn tuo-btn--lg tuob-volver" onClick={volver} disabled={pago !== 'no'} aria-label="Volver al paso anterior">
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
              {pago === 'conectando' ? 'Conectando con Mercado Pago…' : (textos ?? TEXTOS.tienda).procesando}
            </strong>
            <span id="tuob-procesando-txt">Vista previa: no se cobra nada.</span>
            {cerrando && <CierreReservas d={datos} alquiler={alquileres} gym={gimnasio} onListo={irAlPanel} />}
          </div>
        </div>
      )}
    </div>
  )
}
