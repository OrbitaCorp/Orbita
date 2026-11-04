// Lo que dicen los pasos del alta según el módulo elegido: los títulos de cada
// paso y los textos de los pasos comunes (tu negocio, ubicación, tu página, el
// pago). Un mapa por módulo en vez de preguntar "¿es Tienda?" en cada
// pantalla: sumar un módulo es sumar una entrada acá. Lo propio de cada módulo
// (qué vendés, rubro, qué alquilás, actividades…) vive en su paso.
import type { TipoAlquiler } from '@/modules/alquileres/datos'
import type { Modulo, PasoId } from './modelo'

export interface Titulo { titulo: string; resalte: string; bajada: string }

export interface TextosModulo {
  /** Cómo se lo nombra en las tarjetas del primer paso y en la botonera ("Turnos · 8 pasos"). */
  nombre: string
  /** El negocio mientras todavía no tiene nombre (botonera). */
  sinNombre: string
  negocio: { bajada: string; ejemplo: string; ayudaDescripcion: string; ejemploDescripcion: string }
  ubicacion: Titulo & {
    /** La pregunta y la ayuda de "dónde atendés" (solo si el módulo ofrece más de una opción). */
    leyenda: string
    ayuda: string
    errorDireccion: string
    errorCiudad: string
  }
  pagina: { bajada: string }
  /** El cartel del pago simulado, cuando ya "se aprobó". */
  procesando: string
  /** El aviso del último paso: los precios que se muestran son los de Tienda. */
  precios: string
}

const RESERVAS = 'Con estos datos armamos tu página de reservas. Los podés cambiar cuando quieras.'
const EN_EL_LUGAR = { leyenda: '¿Dónde queda?', ayuda: '', errorDireccion: 'Escribí la dirección.', errorCiudad: 'Escribí la ciudad.' }
const PRECIO_DE = (modulo: string) => `Los valores son los de los planes de Tienda de hoy, como referencia: el precio de ${modulo} todavía no está definido. `

export const TEXTOS: Record<Modulo, TextosModulo> = {
  tienda: {
    nombre: 'Tienda online',
    sinNombre: 'Tu tienda en Órbita',
    negocio: {
      bajada: 'Con estos datos armamos tu tienda. Los podés cambiar cuando quieras.',
      ejemplo: 'Ej: Almacén del Sur',
      ayudaDescripcion: 'Una o dos líneas que cuenten qué vendés. Aparece en tu tienda.',
      ejemploDescripcion: 'Contá en pocas palabras qué vendés…',
    },
    ubicacion: {
      titulo: '¿Dónde', resalte: 'operás?', bajada: 'Si tenés un local, lo ubicamos en el mapa para que tus clientes lo encuentren.',
      leyenda: '¿Dónde operás?', ayuda: 'Podés elegir una opción o las dos.',
      errorDireccion: 'Escribí la dirección del local.', errorCiudad: 'Escribí la ciudad.',
    },
    pagina: { bajada: 'Es lo que ven tus clientes cuando entran a tu tienda.' },
    procesando: 'Pago aprobado. Creando tu tienda…',
    precios: 'Los valores son los de los planes de Tienda de hoy. ',
  },
  turnos: {
    nombre: 'Turnos',
    sinNombre: 'Tu agenda en Órbita',
    negocio: {
      bajada: RESERVAS,
      ejemplo: 'Ej: Estudio Norte',
      ayudaDescripcion: 'Una o dos líneas que cuenten qué hacen. Aparece debajo del nombre en tu página.',
      ejemploDescripcion: 'Contá en pocas palabras qué ofrecés…',
    },
    ubicacion: {
      titulo: '¿Dónde y cuándo', resalte: 'atendés?', bajada: 'Tus clientes solo van a poder reservar dentro de estos días y horarios.',
      leyenda: '¿Dónde atendés?', ayuda: 'Marcá todas las que correspondan: tus clientes eligen al reservar.',
      errorDireccion: 'Escribí la dirección del local.', errorCiudad: 'Escribí la ciudad donde atendés.',
    },
    pagina: { bajada: 'Es lo que ven tus clientes cuando entran a tu link para reservar.' },
    procesando: 'Pago aprobado. Armando tu agenda…',
    precios: PRECIO_DE('Turnos'),
  },
  alquileres: {
    nombre: 'Alquileres',
    sinNombre: 'Tus espacios en Órbita',
    negocio: {
      bajada: RESERVAS,
      ejemplo: 'Ej: Complejo Tres Fronteras',
      ayudaDescripcion: 'Una o dos líneas que cuenten qué alquilás. Aparece debajo del nombre en tu página.',
      ejemploDescripcion: 'Contá en pocas palabras qué ofrecés…',
    },
    ubicacion: {
      titulo: '¿Dónde', resalte: 'queda?', bajada: 'Lo ubicamos en el mapa de tu página para que tus clientes sepan cómo llegar.',
      ...EN_EL_LUGAR,
    },
    pagina: { bajada: 'Es lo que ven tus clientes cuando entran a tu link para reservar.' },
    procesando: 'Pago aprobado. Armando tu calendario…',
    precios: PRECIO_DE('Alquileres'),
  },
  gimnasio: {
    nombre: 'Gimnasio',
    sinNombre: 'Tus clases en Órbita',
    negocio: {
      bajada: 'Con estos datos armamos tu página de clases. Los podés cambiar cuando quieras.',
      ejemplo: 'Ej: Box Norte',
      ayudaDescripcion: 'Una o dos líneas que cuenten qué clases das. Aparece debajo del nombre en tu página.',
      ejemploDescripcion: 'Contá en pocas palabras qué ofrecés…',
    },
    ubicacion: {
      titulo: '¿Dónde', resalte: 'entrenan?', bajada: 'Lo ubicamos en el mapa de tu página para que quienes entrenan con vos sepan cómo llegar.',
      ...EN_EL_LUGAR,
    },
    pagina: { bajada: 'Es lo que se ve cuando entran a tu link para anotarse a una clase.' },
    procesando: 'Pago aprobado. Armando tu grilla de clases…',
    precios: PRECIO_DE('Gimnasio'),
  },
}

// El segundo paso de Alquileres pide algo distinto según qué se alquila: cambia
// el título y también el nombre de la estación en el arco.
const QUE_ALQUILAS: Record<TipoAlquiler, Titulo & { rotulo: string }> = {
  cancha: { rotulo: 'Tus canchas', titulo: '¿Qué canchas o', resalte: 'espacios tenés?', bajada: 'Cargá cada cancha, sala o box con su precio por hora. Después podés cambiar todo.' },
  bloque: { rotulo: 'Tu salón', titulo: 'Contanos de', resalte: 'tu salón.', bajada: 'Cómo se llama, cuánta gente entra, cuánto dura cada bloque y los paquetes por cantidad de invitados. Si tenés más de uno, los demás van después.' },
  estadia: { rotulo: 'Tu propiedad', titulo: 'Contanos de', resalte: 'tu propiedad.', bajada: 'Por noche o por mes: lo mínimo para empezar a recibir reservas. Después podés cambiar todo.' },
}

/** El nombre de la estación "qué alquilás" en el arco, una vez elegido el tipo. */
export const rotuloQueAlquilas = (tipo: TipoAlquiler | null) => (tipo ? QUE_ALQUILAS[tipo].rotulo : undefined)

// Antes de elegir módulo los pasos comunes hablan como Turnos (página de reservas).
const de = (m: Modulo | null) => TEXTOS[m ?? 'turnos']

export const TITULOS: Record<PasoId, (m: Modulo | null, tipo: TipoAlquiler | null) => Titulo> = {
  modulo: () => ({ titulo: '¿Con qué', resalte: 'querés arrancar?', bajada: 'Elegí el módulo de tu negocio. Te pedimos solo lo que ese módulo necesita, y en unos minutos queda funcionando.' }),
  tipo: () => ({ titulo: '¿Qué tipo de', resalte: 'productos vendés?', bajada: 'Podés elegir más de uno. Adaptamos tu catálogo según lo que vendas.' }),
  rubro: () => ({ titulo: '¿Qué tipo de', resalte: 'negocio tenés?', bajada: 'Elegí tu rubro y armamos la agenda con los servicios típicos. Después podés cambiar todo.' }),
  servicios: () => ({ titulo: '¿Qué', resalte: 'servicios ofrecés?', bajada: 'Te dejamos cargados los más comunes. Ajustá nombre, duración y precio, y sacá los que no uses.' }),
  'tipo-alquiler': () => ({ titulo: '¿Qué', resalte: 'alquilás?', bajada: 'De esto depende cómo te reservan: por hora, por evento, por noche o por mes. Lo que sigue (tu negocio, tu página, tu cuenta y el pago) es igual para los tres.' }),
  'que-alquilas': (_, tipo) => QUE_ALQUILAS[tipo ?? 'cancha'],
  'rubro-gym': () => ({ titulo: '¿Qué clases', resalte: 'das?', bajada: 'Elegí tu rubro y te dejamos cargadas las actividades y los precios típicos. Después podés cambiar todo.' }),
  actividades: () => ({ titulo: '¿Qué', resalte: 'actividades tenés?', bajada: 'Cada una con su duración y su cupo por clase. La grilla de la semana la armás después, en el panel.' }),
  planes: () => ({ titulo: '¿Cuánto', resalte: 'cobrás?', bajada: 'Clase de prueba, clase suelta, packs y membresías por mes. Con 0, ese plan no se ofrece.' }),
  negocio: m => ({ titulo: 'Contanos de', resalte: 'tu negocio.', bajada: de(m).negocio.bajada }),
  ubicacion: m => ({ titulo: de(m).ubicacion.titulo, resalte: de(m).ubicacion.resalte, bajada: de(m).ubicacion.bajada }),
  pagina: m => ({ titulo: '¿Cómo querés', resalte: 'tu página?', bajada: de(m).pagina.bajada }),
  cuenta: () => ({ titulo: 'Ahora,', resalte: 'tu cuenta.', bajada: 'Con esto entrás al panel para manejar tu negocio.' }),
  pago: () => ({ titulo: 'Último paso:', resalte: 'tu plan.', bajada: 'Revisá que esté todo bien y elegí cómo arrancar.' }),
}
