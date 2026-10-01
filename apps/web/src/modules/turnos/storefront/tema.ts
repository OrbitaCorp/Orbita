// DEMO INTERNA — identidad visual de cada negocio de ejemplo del lado del
// cliente. Igual que en las plantillas de Tienda, el negocio trae su paleta,
// su par de tipografías, su radio y sus fotos; los componentes pintan con las
// variables --color-* que este tema define en el envoltorio (SitioNegocio),
// así Avatar, EmptyState y el resto del design system se adaptan solos.
//
// Cada tema es una PLANTILLA, no una paleta: además del color define la
// composición del hero, la forma de las tarjetas y de las fotos, el botón y la
// textura de fondo. Por eso una barbería y un consultorio no se ven como el
// mismo sitio pintado de otro color.
//
// Hay cinco plantillas para cuatro familias: belleza se parte en "Estudio"
// (barbería, peluquería, tatuajes: oscuro y dorado) y "Atelier" (uñas, spa,
// maquillaje, estética: claro y rosado), porque un spa en negro con fotos de
// navajas no representa al rubro.
//
// Eso es el punto de partida de cada familia. Encima va la plantilla del rubro
// (plantillas.ts): cada rubro tiene cinco propias, y el dueño elige una y la
// ajusta en Configuración → Apariencia. temaDe() arma el tema final: el de
// ejemplo, vestido con la plantilla, con lo que el dueño cargó en el alta y con
// los horarios que haya guardado.
//
// Fotos: locales en public/turnos (Unsplash, verificadas una por una) y, para
// belleza no-barbería y clases particulares, algunas de public/plantillas que
// ya estaban en el repo.
import { semanaDe, type RubroTurnos, type FamiliaId } from '@/modules/turnos/datos'
import { modalidadesRubro, type AparienciaDemo, type IdentidadDemo, type Modalidad } from '@/modules/turnos/demo/negocioDemo'
import { SEMANA_PARTIDA, type Semana } from '@/modules/turnos/horario'
import { E_CLARO, E_OSCURO, aplicarPlantilla, esHex, lookDeFabrica, plantillasDe, type PlantillaSitio } from './plantillas'

export type EstiloTema = 'estudio' | 'atelier' | 'clinica' | 'box' | 'taller'

export interface TemaNegocio {
  nombre: string
  /** Una línea debajo del nombre. */
  tagline: string
  oscuro: boolean
  /** Hero a sangre (foto de fondo) o partido (texto + foto). */
  hero: 'sangre' | 'partido'
  fh: string
  fb: string
  /** Títulos en mayúsculas (deporte). */
  mayus?: boolean
  radio: number
  c: {
    bg: string; surface: string; surfaceAlt: string; border: string
    text: string; body: string; muted: string
    primary: string; primaryH: string; onPrimary: string; primaryBg: string
  }
  fotoHero: string
  galeria: string[]
  direccion: string
  barrio: string
  telefono: string
  instagram: string
  /** [día, horario] — '' = cerrado. Índice 0 = lunes. El horario va partido: "09:00 – 13:00 · 16:00 – 20:00" (ver horario.ts). */
  horarios: Semana
  /** Frase de confianza del hero, del rubro (no promete nada que Órbita no haga). */
  sello: string
  /** Sección "Nosotros": texto de ejemplo que el dueño reescribe en Configuración. */
  nosotros: Nosotros
  /** Logo del negocio (data URL del alta). Sin logo se dibuja el monograma con las iniciales. */
  logo: string | null
  /** Dónde atiende: en el local, a domicilio o las dos. */
  modalidades: Modalidad[]
  /** Zonas a las que va a domicilio. */
  zonas: string
  /** true cuando es el negocio que el dueño cargó en el alta, y no el de ejemplo del rubro. */
  propio?: boolean

  // ── Campos de plantilla (nuevos) ──────────────────────────────────────────
  /** Qué plantilla es. Sale en data-estilo de la raíz para los ajustes finos de CSS. */
  estilo: EstiloTema
  /** Composición del hero de la portada. */
  composicion: 'cine' | 'partido' | 'impacto' | 'collage'
  /** Forma de las tarjetas: filete doble, sombra suave, esquina cortada o papel. */
  tarjeta: 'filete' | 'suave' | 'corte' | 'papel'
  /** Forma del botón principal. */
  boton: 'recto' | 'suave' | 'pildora'
  /** Recorte de las fotos protagonistas (hero partido, equipo). */
  forma: 'recta' | 'redonda' | 'arco'
  /** Textura de fondo de la página. */
  textura: 'grano' | 'puntos' | 'trama' | 'papel' | 'ninguna'
  /** Tipografía de horas y precios: siempre mono con números tabulares. */
  fm: string
  /** Peso de los títulos (una serif fina y una condensada no piden lo mismo). */
  pesoTitulo: number
  /** Titular del hero: [arranque, remate]. El remate va destacado (itálica o color). */
  titular: [string, string]
  /** Colores de estado con contraste AA sobre bg y surface de ESTE tema. */
  e: { ok: string; aviso: string; lleno: string; estrella: string; acento: string }
  /** Luz ambiente del hero y del cierre (degradé con los colores de la marca). */
  grad: string
  /** Familias de Google Fonts que usa el tema (spec de css2), las carga SitioNegocio. */
  fuentes: string[]
}

export interface Nosotros {
  /** Título de la sección: [arranque, remate]. */
  titulo: [string, string]
  parrafos: string[]
  /** Tres compromisos cortos, en lista. */
  valores: string[]
  /** Año en que abrió. 0 = no se muestra. */
  desde: number
}

// El horario de cada negocio de ejemplo lo pone temaDe() con semanaDe(rubro): es
// el mismo que usan la reserva y el panel. Acá solo va un valor de relleno.

const MONO = '"Geist Mono", ui-monospace, "SFMono-Regular", Menlo, monospace'

const ESTUDIO: TemaNegocio = {
  nombre: 'Estudio Norte', tagline: 'Cortes, barba y estilo desde 2014', oscuro: true, hero: 'sangre',
  estilo: 'estudio', composicion: 'cine', tarjeta: 'filete', boton: 'recto', forma: 'recta', textura: 'grano',
  fh: "'Cormorant Garamond', Georgia, serif", fb: "'Manrope', system-ui, sans-serif", fm: MONO, pesoTitulo: 600, radio: 3,
  titular: ['El oficio de', 'verte bien'],
  c: { bg: '#0C0B09', surface: '#15130F', surfaceAlt: '#1F1C16', border: '#352F25', text: '#F7F1E6', body: '#D9D0C1', muted: '#A89E8E', primary: '#D2A96A', primaryH: '#E3BD82', onPrimary: '#15110A', primaryBg: 'rgba(210,169,106,0.14)' },
  e: { ...E_OSCURO, acento: '#C2664A' },
  grad: 'radial-gradient(900px 480px at 85% 0%, rgba(210,169,106,0.20), transparent 62%), radial-gradient(700px 420px at 0% 100%, rgba(194,102,74,0.16), transparent 60%)',
  fuentes: ['Cormorant+Garamond:ital,wght@0,500;0,600;0,700;1,500;1,600', 'Manrope:wght@400;500;600;700;800'],
  fotoHero: '/turnos/bel-hero.jpg',
  galeria: ['/turnos/bel-navaja.jpg', '/turnos/bel-herramientas.jpg', '/turnos/bel-tijeras.jpg', '/turnos/bel-salon.jpg', '/turnos/bel-corte.jpg'],
  direccion: 'Av. Santa Fe 3240', barrio: 'Palermo, CABA', telefono: '11 5555-0140', instagram: 'estudionorte', horarios: SEMANA_PARTIDA,
  sello: 'Reservá en 30 segundos, sin llamar',
  nosotros: {
    titulo: ['Un oficio,', 'bien hecho'], desde: 2014,
    parrafos: [
      'Abrimos con una idea simple: que cada persona se vaya mejor de lo que llegó. Trabajamos con turno para dedicarte el tiempo que hace falta, sin apuro y sin hacerte esperar.',
      'Somos un equipo chico. Nos gusta que vuelvas a sentarte con quien ya sabe cómo te gusta.',
    ],
    valores: ['Turnos puntuales', 'Herramientas esterilizadas en cada servicio', 'Productos profesionales'],
  },
  // Lo que el alta pisa cuando el dueño ya cargó su negocio (ver temaConIdentidad).
  logo: null, modalidades: ['local'], zonas: 'Palermo, Belgrano, Recoleta y alrededores',
}

const ATELIER: TemaNegocio = {
  ...ESTUDIO,
  nombre: 'Casa Calma', tagline: 'Belleza y bienestar, con turno', oscuro: false, hero: 'partido',
  estilo: 'atelier', composicion: 'partido', tarjeta: 'papel', boton: 'pildora', forma: 'arco', textura: 'papel',
  fh: "'Cormorant Garamond', Georgia, serif", fb: "'Jost', system-ui, sans-serif", pesoTitulo: 500, radio: 18,
  titular: ['Un rato', 'para vos'],
  c: { bg: '#FBF6F1', surface: '#FFFFFF', surfaceAlt: '#F4E9E1', border: '#E6D5C9', text: '#2B1D1A', body: '#4E3B36', muted: '#755F58', primary: '#9C4A3C', primaryH: '#833A2E', onPrimary: '#FFFFFF', primaryBg: '#F6E2DB' },
  e: { ...E_CLARO, acento: '#6E7B5A' },
  grad: 'radial-gradient(800px 460px at 90% 0%, rgba(156,74,60,0.14), transparent 62%), radial-gradient(640px 400px at 0% 100%, rgba(110,123,90,0.14), transparent 60%)',
  fuentes: ['Cormorant+Garamond:ital,wght@0,500;0,600;0,700;1,500;1,600', 'Jost:wght@400;500;600;700'],
  fotoHero: '/plantillas/belleza-spa.jpg',
  galeria: ['/plantillas/relato-modelo.jpg', '/plantillas/belleza-cosmetica.jpg', '/plantillas/casa-plantas.jpg', '/plantillas/belleza-manos.jpg', '/plantillas/belleza-spa.jpg'],
  direccion: 'Gurruchaga 1820', barrio: 'Palermo Soho, CABA', telefono: '11 5555-0162', instagram: 'casacalma',
  sello: 'Elegí día y horario desde el celular',
  nosotros: {
    titulo: ['Hecho con', 'tiempo y cuidado'], desde: 2018,
    parrafos: [
      'Armamos este espacio para que tengas un rato para vos, sin reloj y sin apuro. Atendemos solo con turno: así cada persona tiene su tiempo completo.',
      'Elegimos uno por uno los productos con los que trabajamos y te contamos cada paso antes de empezar.',
    ],
    valores: ['Atención personalizada', 'Productos elegidos uno por uno', 'Un espacio limpio y cuidado'],
  },
}

const TEMAS: Record<FamiliaId, TemaNegocio> = {
  belleza: ESTUDIO,
  salud: {
    nombre: 'Consultorio Palermo', tagline: 'Atención personalizada, sin esperas', oscuro: false, hero: 'partido',
    estilo: 'clinica', composicion: 'partido', tarjeta: 'suave', boton: 'suave', forma: 'redonda', textura: 'puntos',
    fh: "'Plus Jakarta Sans', 'Manrope', system-ui, sans-serif", fb: "'Inter', system-ui, sans-serif", fm: MONO, pesoTitulo: 700, radio: 16,
    titular: ['Atención cercana,', 'a tu tiempo'],
    c: { bg: '#FFFFFF', surface: '#F4F9F8', surfaceAlt: '#E6F1EF', border: '#D3E3E0', text: '#082B30', body: '#2C474B', muted: '#51666A', primary: '#0B6E66', primaryH: '#085850', onPrimary: '#FFFFFF', primaryBg: '#DFF2EF' },
    e: { ...E_CLARO, acento: '#C2621B' },
    grad: 'radial-gradient(820px 480px at 92% -10%, rgba(11,110,102,0.14), transparent 62%), radial-gradient(640px 420px at -5% 105%, rgba(56,140,190,0.12), transparent 60%)',
    fuentes: ['Plus+Jakarta+Sans:wght@500;600;700;800', 'Inter:wght@400;500;600;700'],
    fotoHero: '/turnos/sal-hero.jpg',
    galeria: ['/turnos/sal-consulta.jpg', '/turnos/sal-presion.jpg', '/turnos/sal-dentista.jpg', '/plantillas/casa-interior.jpg', '/turnos/sal-hero.jpg'],
    direccion: 'Gorriti 4870, piso 2', barrio: 'Palermo, CABA', telefono: '11 5555-0190', instagram: 'consultoriopalermo', horarios: SEMANA_PARTIDA,
    sello: 'Sacá tu turno a cualquier hora',
    nosotros: {
      titulo: ['Te escuchamos', 'con tiempo'], desde: 2012,
      parrafos: [
        'Creemos que una buena atención empieza por escuchar. Por eso los turnos son puntuales y cada consulta tiene el tiempo que necesita.',
        'Te explicamos cada paso con palabras claras y seguimos tu caso entre una visita y la otra.',
      ],
      valores: ['Turnos puntuales', 'Explicaciones claras', 'Seguimiento de tu caso'],
    },
    logo: null, modalidades: ['local'], zonas: 'Palermo, Villa Crespo, Colegiales y alrededores',
  },
  deporte: {
    nombre: 'Box Sur', tagline: 'Clases con cupo y coaches que te siguen de cerca', oscuro: true, hero: 'sangre', mayus: true,
    estilo: 'box', composicion: 'impacto', tarjeta: 'corte', boton: 'recto', forma: 'recta', textura: 'trama',
    fh: "'Barlow Condensed', 'Oswald', Impact, sans-serif", fb: "'Barlow', 'Inter', system-ui, sans-serif", fm: MONO, pesoTitulo: 800, radio: 2,
    titular: ['Entrená', 'en serio'],
    c: { bg: '#08080A', surface: '#121215', surfaceAlt: '#1B1B20', border: '#2E2E35', text: '#FAFAFA', body: '#D4D4D8', muted: '#A1A1AA', primary: '#D4FF3A', primaryH: '#E4FF7A', onPrimary: '#0A0A0A', primaryBg: 'rgba(212,255,58,0.12)' },
    e: { ...E_OSCURO, acento: '#FF5A36' },
    grad: 'radial-gradient(900px 460px at 88% -10%, rgba(212,255,58,0.16), transparent 60%), radial-gradient(700px 420px at 0% 110%, rgba(255,90,54,0.12), transparent 60%)',
    fuentes: ['Barlow+Condensed:ital,wght@0,600;0,700;0,800;1,700;1,800', 'Barlow:wght@400;500;600;700'],
    fotoHero: '/turnos/dep-hero.jpg',
    galeria: ['/turnos/dep-barra.jpg', '/turnos/dep-soga.jpg', '/plantillas/dep-pesas.jpg', '/turnos/dep-pesas.jpg', '/turnos/dep-yoga.jpg'],
    direccion: 'Av. Mitre 1520', barrio: 'Avellaneda', telefono: '11 5555-0177', instagram: 'boxsur', horarios: SEMANA_PARTIDA,
    sello: 'Tu lugar asegurado antes de llegar',
    nosotros: {
      titulo: ['Entrená', 'acompañado'], desde: 2017,
      parrafos: [
        'Somos un espacio para entrenar en serio y pasarla bien. Las clases tienen cupo: cada persona tiene su lugar y su corrección.',
        'Los profes te conocen por el nombre, adaptan los ejercicios a tu nivel y te siguen de cerca para que avances sin lastimarte.',
      ],
      valores: ['Grupos con cupo', 'Ejercicios adaptados a tu nivel', 'Todos los niveles'],
    },
    logo: null, modalidades: ['local'], zonas: 'Avellaneda, Lanús y alrededores',
  },
  clases: {
    nombre: 'Aula Viva', tagline: 'Talleres con las manos en la masa', oscuro: false, hero: 'partido',
    estilo: 'taller', composicion: 'collage', tarjeta: 'papel', boton: 'pildora', forma: 'arco', textura: 'papel',
    fh: "'Fraunces', 'Libre Baskerville', Georgia, serif", fb: "'Nunito', system-ui, sans-serif", fm: MONO, pesoTitulo: 600, radio: 20,
    titular: ['Aprendé', 'haciendo'],
    c: { bg: '#F7F1E7', surface: '#FFFCF6', surfaceAlt: '#EFE4D3', border: '#DFCFB8', text: '#2A1F17', body: '#4A3B2F', muted: '#6B5B4C', primary: '#A8481F', primaryH: '#8E3B18', onPrimary: '#FFFFFF', primaryBg: '#F4DFD0' },
    e: { ...E_CLARO, acento: '#55663A' },
    grad: 'radial-gradient(800px 460px at 90% 0%, rgba(168,72,31,0.14), transparent 62%), radial-gradient(640px 400px at 0% 100%, rgba(85,102,58,0.14), transparent 60%)',
    fuentes: ['Fraunces:ital,opsz,wght@0,9..144,500;0,9..144,600;0,9..144,700;1,9..144,500;1,9..144,600', 'Nunito:wght@400;600;700;800'],
    fotoHero: '/turnos/cla-hero.jpg',
    galeria: ['/turnos/cla-torno.jpg', '/turnos/cla-manos.jpg', '/turnos/cla-vasija.jpg', '/plantillas/casa-ceramica.jpg', '/turnos/cla-hero.jpg'],
    direccion: 'Honduras 5020', barrio: 'Palermo Soho, CABA', telefono: '11 5555-0123', instagram: 'aulaviva', horarios: SEMANA_PARTIDA,
    sello: 'Cupos limitados en cada encuentro',
    nosotros: {
      titulo: ['Aprender', 'con las manos'], desde: 2019,
      parrafos: [
        'Somos un taller de grupos chicos, donde se aprende haciendo. Cada encuentro tiene cupo limitado para que nadie se quede mirando.',
        'Los materiales están incluidos y no hace falta experiencia: venís, hacés y te llevás lo que hiciste.',
      ],
      valores: ['Grupos chicos', 'Materiales incluidos', 'Sin experiencia previa'],
    },
    logo: null, modalidades: ['local'], zonas: 'Palermo, Villa Crespo y alrededores',
  },
}

// Rubros de belleza que usan la plantilla clara (Atelier) en vez de Estudio.
const RUBROS_ATELIER = new Set(['maquillaje', 'estetica', 'unas', 'pestanas', 'depilacion', 'spa'])

// Foto del hero por rubro cuando la de la plantilla no representa bien al rubro.
const HERO_RUBRO: Record<string, string> = {
  maquillaje: '/plantillas/belleza-labial.jpg', estetica: '/plantillas/belleza-spa.jpg', spa: '/plantillas/belleza-spa.jpg',
  depilacion: '/plantillas/relato-modelo.jpg', unas: '/plantillas/belleza-manos.jpg', pestanas: '/plantillas/belleza-labial.jpg',
  peluqueria: '/turnos/bel-salon.jpg', tatuajes: '/turnos/bel-navaja.jpg', consulta: '/turnos/sal-consulta.jpg',
  yoga: '/turnos/dep-yoga.jpg', danza: '/turnos/dep-yoga.jpg', funcional: '/turnos/dep-soga.jpg', canchas: '/turnos/can-hero.jpg',
  clases: '/plantillas/libre-lectura.jpg', odonto: '/turnos/sal-dentista.jpg',
}
// Galería propia de los rubros cuyas fotos de plantilla no aplican.
const GALERIA_RUBRO: Record<string, string[]> = {
  maquillaje: ['/plantillas/belleza-maquillaje.jpg', '/plantillas/belleza-paleta-2.jpg', '/plantillas/belleza-coral.jpg', '/plantillas/belleza-paletas.jpg', '/plantillas/belleza-labial.jpg'],
  pestanas: ['/plantillas/belleza-labial.jpg', '/plantillas/belleza-cosmetica.jpg', '/plantillas/relato-modelo.jpg', '/plantillas/casa-plantas.jpg', '/plantillas/belleza-coral.jpg'],
  odonto: ['/turnos/sal-dentista.jpg', '/turnos/sal-consulta.jpg', '/plantillas/casa-interior.jpg', '/plantillas/casa-plantas.jpg'],
  clases: ['/plantillas/libre-cuaderno.jpg', '/plantillas/libre-lapices.jpg', '/plantillas/libre-lectura.jpg', '/plantillas/casa-interior.jpg'],
  canchas: ['/turnos/can-padel.jpg', '/turnos/can-partido.jpg', '/turnos/can-pelota.jpg', '/turnos/can-paletas.jpg', '/turnos/can-arco.jpg'],
}
const NOMBRE_RUBRO: Record<string, [string, string]> = {
  peluqueria: ['Estudio Norte', 'Color, corte y peinado'], estilista: ['Sol Rivas Estilista', 'Tu estilista, a tu tiempo'],
  maquillaje: ['Mía Make Up', 'Maquillaje para tus momentos'], estetica: ['Norte Estética', 'Tratamientos faciales y corporales'],
  unas: ['Nail Club', 'Uñas perfectas, sin esperar'], pestanas: ['Lash Studio', 'Mirada de impacto'], depilacion: ['Piel Lisa', 'Depilación láser y cera'],
  spa: ['Casa Calma', 'Masajes y circuitos de relax'], tatuajes: ['Tinta Norte', 'Tatuajes y piercing con turno'],
  odonto: ['Sonrisa Palermo', 'Odontología integral'], kinesio: ['Kine Palermo', 'Rehabilitación y kinesiología'], psico: ['Espacio Palermo', 'Psicología con turnos fijos'],
  nutricion: ['Nutrición Palermo', 'Planes a tu medida'], 'medicina-estetica': ['Clínica Lumen', 'Medicina estética'],
  yoga: ['Prana Studio', 'Yoga y pilates con cupos'], danza: ['Ritmo Sur', 'Clases de baile para todos'], natacion: ['Club Delta', 'Natación y pileta libre'],
  canchas: ['Complejo Sur', 'Canchas de fútbol y pádel'], clases: ['Aula Viva', 'Clases particulares a tu ritmo'],
}
// Titular del hero cuando el de la plantilla no le habla al rubro.
const TITULAR_RUBRO: Record<string, [string, string]> = {
  peluqueria: ['Tu pelo,', 'en buenas manos'], tatuajes: ['Tu idea,', 'en la piel'], maquillaje: ['Lista para', 'tu momento'],
  unas: ['Manos que', 'hablan de vos'], pestanas: ['Una mirada', 'que se nota'], depilacion: ['Piel suave,', 'sin vueltas'],
  odonto: ['Tu sonrisa,', 'bien cuidada'], psico: ['Un espacio', 'para vos'], kinesio: ['Volvé a', 'moverte bien'], nutricion: ['Comer mejor,', 'a tu medida'],
  canchas: ['Armá', 'el partido'], yoga: ['Respirá', 'y soltá'], danza: ['Vení', 'a bailar'], natacion: ['Tirate', 'al agua'],
  clases: ['Aprendé', 'a tu ritmo'],
}

// "Nosotros" cuando el texto de la plantilla no le habla al rubro. Lo que no se pisa, queda el de la plantilla.
const NOSOTROS_RUBRO: Record<string, Partial<Nosotros>> = {
  peluqueria: {
    titulo: ['Tu pelo,', 'con tiempo'],
    parrafos: [
      'Somos un salón de turnos: nadie espera sentado y cada trabajo tiene el tiempo que necesita, sea un corte o un color completo.',
      'Antes de empezar miramos tu pelo y charlamos qué buscás. Te decimos qué se puede y cuánto sale, sin sorpresas.',
    ],
    valores: ['Diagnóstico antes de empezar', 'Coloración profesional', 'Precio cerrado antes del servicio'],
  },
  estilista: {
    titulo: ['Todo el tiempo,', 'para vos'],
    parrafos: [
      'Soy estilista independiente. Trabajo con turno, en mi espacio o en tu casa, para dedicarte la atención completa.',
      'Antes de empezar charlamos qué querés y qué le conviene a tu pelo. Sin apuro y sin sorpresas en el precio.',
    ],
    valores: ['En mi espacio o a domicilio', 'Asesoramiento antes de empezar', 'Productos profesionales'],
  },
  tatuajes: {
    titulo: ['Tu idea,', 'bien trabajada'],
    parrafos: [
      'Cada pieza se diseña con vos. Trabajamos con turno y seña para dedicarle a tu idea el tiempo que merece.',
      'Material descartable, tintas habilitadas y los cuidados explicados paso a paso: el cuidado también es parte del trabajo.',
    ],
    valores: ['Diseños a medida', 'Material descartable', 'Cuidados explicados paso a paso'],
  },
  psico: {
    titulo: ['Un espacio', 'de escucha'],
    parrafos: [
      'Un lugar confidencial y sin apuro. Las sesiones tienen horario fijo para que el proceso tenga continuidad.',
      'La primera entrevista sirve para conocernos y definir juntos cómo seguir.',
    ],
    valores: ['Confidencialidad', 'Sesiones de 50 minutos', 'Horario fijo semanal'],
  },
  canchas: {
    titulo: ['Hecho para', 'jugar'],
    parrafos: [
      'Un complejo pensado para que el partido salga redondo: canchas cuidadas, buena luz y vestuarios.',
      'Reservás online la cancha y el horario, y el día del partido solo hay que llegar y jugar.',
    ],
    valores: ['Canchas en buen estado', 'Luz para jugar de noche', 'Vestuarios y estacionamiento'],
  },
  natacion: {
    titulo: ['Todo el año,', 'al agua'],
    parrafos: [
      'Una pileta climatizada para aprender, entrenar o nadar por tu cuenta. Hay cupo por andarivel: siempre hay lugar para nadar cómodo.',
      'Profes para todos los niveles, desde quien recién arranca hasta quien entrena.',
    ],
    valores: ['Pileta climatizada', 'Cupo por andarivel', 'Todos los niveles'],
  },
  yoga: {
    titulo: ['Un rato', 'para bajar un cambio'],
    parrafos: [
      'Un estudio tranquilo, de grupos reducidos. Las clases tienen cupo: cada persona tiene su espacio y su corrección.',
      'Te acompañamos desde la primera clase. No hace falta experiencia ni traer nada.',
    ],
    valores: ['Grupos reducidos', 'Todos los niveles', 'Mat y elementos en el estudio'],
  },
  danza: {
    titulo: ['Vení', 'a moverte'],
    parrafos: [
      'Una escuela para bailar a cualquier edad y con cualquier nivel. Los grupos tienen cupo para que haya lugar para moverse y aprender.',
      'Elegís el estilo y el horario, reservás tu lugar y venís a pasarla bien.',
    ],
    valores: ['Varios estilos y niveles', 'Grupos con cupo', 'No hace falta experiencia'],
  },
  clases: {
    titulo: ['A tu ritmo,', 'paso a paso'],
    parrafos: [
      'Clases uno a uno, al ritmo de cada alumno. Empezamos por ver dónde estás y armamos un plan para llegar a donde querés.',
      'Apoyo escolar, idiomas y música, con profes que explican las veces que haga falta.',
    ],
    valores: ['Clases uno a uno', 'Un plan a tu medida', 'En el estudio o en tu casa'],
  },
}

/**
 * El tema del negocio de un rubro, de adentro hacia afuera: el negocio de
 * ejemplo, vestido con la plantilla que eligió el dueño (`rubro.apariencia`),
 * con lo que cargó en el alta (`rubro.alta`) y con el horario que guardó en
 * Configuración (`rubro.horarios`). Las tres cosas las pone useRubroDemo.
 */
export function temaDe(rubro: RubroTurnos): TemaNegocio {
  const propio = temaConIdentidad(vestir(temaEjemplo(rubro), rubro, rubro.apariencia ?? null), rubro, rubro.alta ?? null)
  // El horario es uno solo para el sitio, la reserva y el panel: lo guardado en Configuración, lo
  // del alta o el de ejemplo, en ese orden (semanaDe).
  return { ...propio, horarios: semanaDe(rubro) }
}

// La identidad de cada familia tal como la define este archivo, con el nombre que tiene en plantillas.ts.
const LOOK_FAMILIA: Record<FamiliaId, string> = { belleza: 'oro', salud: 'clinica', deporte: 'carbon', clases: 'taller' }

/** Las fotos del negocio de ejemplo (portada y galería): con una distinta se muestra cada plantilla. */
const fotosDe = (t: TemaNegocio) => [t.fotoHero, ...t.galeria]

/** El negocio de ejemplo del rubro, tal como viene de las plantillas. */
function temaEjemplo(rubro: RubroTurnos): TemaNegocio {
  const base = RUBROS_ATELIER.has(rubro.key) ? ATELIER : TEMAS[rubro.familia]
  const [nombre, tagline] = NOMBRE_RUBRO[rubro.key] ?? [base.nombre, base.tagline]
  // La foto del diente solo tiene sentido en odontología.
  const propia = GALERIA_RUBRO[rubro.key] ?? base.galeria
  const galeria = rubro.familia === 'salud' && rubro.key !== 'odonto' ? propia.filter(f => !f.includes('dentista')) : propia
  // El Instagram sale del nombre: si el rubro cambia el nombre, no puede quedar el de la plantilla.
  const instagram = NOMBRE_RUBRO[rubro.key] ? usuarioDe(nombre) : base.instagram
  const t: TemaNegocio = {
    ...base, nombre, tagline, instagram, galeria, fotoHero: HERO_RUBRO[rubro.key] ?? base.fotoHero, titular: TITULAR_RUBRO[rubro.key] ?? base.titular,
    nosotros: { ...base.nosotros, ...NOSOTROS_RUBRO[rubro.key] }, modalidades: modalidadesRubro(rubro),
  }
  // Un estudio de yoga no se ve como un box de crossfit aunque los dos sean "deporte": si la
  // plantilla de fábrica del rubro no es la de su familia, el negocio de ejemplo ya sale con ella.
  const deFamilia = RUBROS_ATELIER.has(rubro.key) ? 'atelier' : LOOK_FAMILIA[rubro.familia]
  return lookDeFabrica(rubro.key) === deFamilia ? t : aplicarPlantilla(t, plantillasDe(rubro, fotosDe(t))[0])
}

/** Las cinco plantillas del rubro, mostradas con las fotos de su negocio de ejemplo. */
export function plantillasDelRubro(rubro: RubroTurnos): PlantillaSitio[] {
  const base = RUBROS_ATELIER.has(rubro.key) ? ATELIER : TEMAS[rubro.familia]
  const galeria = GALERIA_RUBRO[rubro.key] ?? base.galeria
  return plantillasDe(rubro, [HERO_RUBRO[rubro.key] ?? base.fotoHero, ...galeria.filter(f => rubro.key === 'odonto' || rubro.familia !== 'salud' || !f.includes('dentista'))])
}

/** El tema con la plantilla elegida en Apariencia (y sus ajustes). Solo si se guardó para ESTE rubro. */
function vestir(t: TemaNegocio, rubro: RubroTurnos, ap: AparienciaDemo | null): TemaNegocio {
  if (!ap || ap.rubro !== rubro.key) return t
  const p = plantillasDelRubro(rubro).find(x => x.id === ap.plantilla)
  if (!p) return t
  return aplicarPlantilla(t, p, { color: esHex(ap.color) ? ap.color : undefined, tipo: ap.tipo || undefined, radio: ap.radio > 0 ? ap.radio : undefined, foto: ap.foto || undefined })
}

const usuarioDe = (nombre: string) => nombre.normalize('NFD').replace(/[^a-zA-Z0-9]/g, '').toLowerCase()

/**
 * El tema con lo que el dueño cargó en el alta encima: nombre, descripción, logo,
 * teléfono, dónde atiende y horarios. Solo si hizo el alta para ESTE rubro; si
 * no, queda el negocio de ejemplo.
 */
export function temaConIdentidad(t: TemaNegocio, rubro: RubroTurnos, id: IdentidadDemo | null): TemaNegocio {
  if (!id || id.rubro !== rubro.key) return t
  const modalidades = id.modalidades.length ? id.modalidades : t.modalidades
  const conLocal = modalidades.includes('local')
  return {
    ...t,
    propio: true,
    nombre: id.nombre || t.nombre,
    tagline: id.descripcion || `${rubro.label} con turnos online`,
    instagram: id.nombre ? usuarioDe(id.nombre) : t.instagram,
    telefono: id.telefono || t.telefono,
    logo: id.logo,
    modalidades,
    // Sin local no hay dirección que mostrar: el sitio cuenta dónde atiende de otra forma.
    direccion: conLocal ? id.direccion || t.direccion : '',
    barrio: id.ciudad || (conLocal ? t.barrio : ''),
    zonas: id.zonas || t.zonas,
    horarios: id.horarios.length === 7 ? id.horarios : t.horarios,
    // El año de apertura es del negocio de ejemplo, no del que acaba de darse de alta.
    nosotros: { ...t.nosotros, desde: 0 },
  }
}

/** Retrato del profesional i (solo rubros por profesional). */
export const RETRATOS = ['/turnos/ret-1.jpg', '/turnos/ret-2.jpg', '/turnos/ret-3.jpg', '/turnos/ret-4.jpg']

/** Qué se ve en cada foto: texto alternativo y epígrafe de la galería. */
const ALT: Record<string, string> = {
  'bel-hero': 'El salón, con sus tres sillones', 'bel-navaja': 'Perfilado a máquina', 'bel-herramientas': 'Las herramientas del oficio', 'bel-tijeras': 'Corte a tijera y peine',
  'bel-salon': 'Los puestos de trabajo', 'bel-corte': 'Afeitado a navaja',
  'sal-hero': 'Una consulta en el consultorio', 'sal-consulta': 'Atención en el consultorio', 'sal-presion': 'Control de presión', 'sal-dentista': 'Explicación de un tratamiento',
  'dep-hero': 'El box, con los racks y los discos', 'dep-barra': 'La zona de barras', 'dep-soga': 'Trabajo con sogas', 'dep-pesas': 'Levantamiento con barra', 'dep-yoga': 'Una clase grupal', 'dep-pista': 'Largada en la pista',
  'can-hero': 'La cancha de fútbol, desde arriba', 'can-padel': 'Las canchas de pádel', 'can-partido': 'Un partido de fútbol 5', 'can-pelota': 'Césped sintético', 'can-paletas': 'Paletas y pelotas de pádel', 'can-arco': 'La cancha iluminada de noche',
  'cla-hero': 'El torno y las herramientas', 'cla-torno': 'Modelando una pieza', 'cla-manos': 'Manos en el torno', 'cla-vasija': 'Terminando una vasija',
  'belleza-spa': 'Tratamiento facial en cabina', 'belleza-manos': 'Cuidado de pies y manos', 'belleza-cosmetica': 'Los productos que usamos', 'belleza-maquillaje': 'Paleta y polvos', 'belleza-labial': 'Maquillaje de ojos y labios',
  'belleza-coral': 'Brochas y labiales', 'belleza-paletas': 'Paletas de sombras', 'belleza-paleta-2': 'Eligiendo los tonos', 'relato-modelo': 'Pelo cuidado', 'casa-plantas': 'La sala de espera', 'casa-interior': 'La recepción',
  'casa-ceramica': 'Piezas terminadas', 'libre-lectura': 'Material de lectura', 'libre-cuaderno': 'Cuaderno de apuntes', 'libre-lapices': 'Lápices de colores',
}
export const altFoto = (src: string) => {
  const clave = src.split('/').pop()!.replace('.jpg', '')
  // turnos/dep-pesas (salón) y plantillas/dep-pesas (barra) comparten nombre de archivo.
  if (src === '/turnos/dep-pesas.jpg') return 'El salón de musculación'
  return ALT[clave] ?? 'Foto del lugar'
}

const RADIO_BOTON: Record<TemaNegocio['boton'], (r: number) => string> = { recto: r => `${r}px`, suave: r => `${Math.max(10, r - 4)}px`, pildora: () => '999px' }

/** Variables CSS del negocio: las mismas que usa todo el design system. */
export function variablesTema(t: TemaNegocio): Record<string, string> {
  return {
    '--color-bg': t.c.bg, '--color-surface': t.c.surface, '--color-surface-alt': t.c.surfaceAlt,
    '--color-border': t.c.border, '--color-border-strong': t.c.muted,
    '--color-text': t.c.text, '--color-body': t.c.body, '--color-muted': t.c.muted, '--color-subtle': t.c.muted,
    '--color-primary': t.c.primary, '--color-primary-h': t.c.primaryH, '--color-on-primary': t.c.onPrimary, '--color-primary-bg': t.c.primaryBg,
    '--chip-primary-fg': t.c.primary,
    '--tu-fh': t.fh, '--tu-fb': t.fb, '--tu-r': `${t.radio}px`, '--tu-r2': `${Math.round(t.radio * 1.6)}px`,
    // Plantilla: mono, peso de títulos, radio del botón, estados y luz ambiente.
    '--tu-fm': t.fm, '--tu-peso': String(t.pesoTitulo), '--tu-r-btn': RADIO_BOTON[t.boton](t.radio),
    '--tu-ok': t.e.ok, '--tu-aviso': t.e.aviso, '--tu-lleno': t.e.lleno, '--tu-estrella': t.e.estrella, '--tu-acento': t.e.acento,
    '--tu-grad': t.grad,
    // Sombra de las tarjetas: en oscuro la sombra es negra, en claro toma el tinte del texto.
    '--tu-sombra': t.oscuro ? '0 28px 50px -28px rgba(0,0,0,.8)' : `0 1px 2px color-mix(in srgb, ${t.c.text} 7%, transparent), 0 22px 44px -26px color-mix(in srgb, ${t.c.text} 30%, transparent)`,
  }
}
