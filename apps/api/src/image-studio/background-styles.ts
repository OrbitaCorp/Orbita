// Catálogo curado de fondos para ImageStudioService.generateBackground().
// Cada uno apunta a un rubro/sub-rubro distinto (no es lo mismo un fondo para
// perfumería que para ropa urbana, deportiva o de gala — pedido explícito
// del vendedor). Foco actual: 2D/flat-lay (indumentaria) — los fondos 3D
// tipo "podio" (mate, reloj, perfume) o "percha colgada" quedaron pendientes
// como tarea aparte: necesitan metadata de dónde está la superficie/gancho
// en cada foto para componer con sombra/perspectiva creíbles, algo que este
// catálogo (pensado para composición plana) no resuelve.
//
// REGLA DURA (corregida a partir de feedback real — la primera versión de
// "deportivo"/"playa" salió con cancha y horizonte de mar, es decir 3D, y se
// veía pegado/falso al componer el producto plano encima): el fondo tiene
// que ser una textura fotografiada DIRECTO DESDE ARRIBA, sin perspectiva,
// sin horizonte, sin punto de fuga — como una tela o un piso fotografiado en
// cenital, nunca una escena "de pie" con profundidad. VISTA_CENITAL fuerza
// esto en TODOS los prompts, no es opcional por estilo.
//
// REGLA DURA #2 (feedback real): objetos "grandes" en las esquinas
// (zapatillas, auriculares, reloj, sombrero) compiten con el producto en el
// mismo plano — como el producto ocupa casi todo el cuadro, termina
// tapándolos de forma rara, como si "flotara por encima" de la escena. Los
// estilos que SÍ funcionan bien (madera, mármol, lino, invierno) solo tienen
// detalles CHICOS y sutiles (una hoja, una ramita, una flor seca), nunca
// objetos grandes tipo producto. Cualquier estilo nuevo debe seguir ese
// criterio.
//
// backgroundKeys: paths en R2 de las variantes YA generadas y subidas por
// scripts/image-studio/seed-backgrounds.ts (corrido el 21/09/2026) — ver ese
// script para el porqué: generar con Flux en vivo por cada uso real
// consumía cuota y agregaba 2-4s de espera por click para algo que ni
// depende del producto del vendedor (el fondo es genérico, centro vacío a
// propósito). ImageStudioService.generateBackground() usa una de estas por
// default (random) y compone local — SIN llamar a Flux — salvo que el
// vendedor pida una descripción personalizada, ver ese archivo.
export interface BackgroundStyle {
  label: string;
  prompt: string;
  backgroundKeys: string[];
}

const VISTA_CENITAL =
  "Shot directly from above (flat lay, top-down, bird's-eye view): a completely flat photograph of a " +
  'textured surface filling the ENTIRE frame edge to edge. NO perspective, NO horizon line, NO ' +
  'vanishing point, NO walls, NO sky, NO 3D depth, NO standing or angled camera — this is a flat ' +
  'surface texture only, like fabric or flooring photographed straight down.';

const CENTRO_VACIO =
  'IMPORTANT: the center third of the image must be empty, clean, with no objects, no clothing, ' +
  'no jewelry, no product of any kind, no text, no watermark, no people — just the background ' +
  'surface, ready for a product photo to be placed on top of later.';

export const BACKGROUND_STYLES: Record<string, BackgroundStyle> = {
  estudio_neutro: {
    label: 'Estudio neutro',
    prompt: `${VISTA_CENITAL} A soft neutral light gray fabric sheet texture, gentle natural wrinkles, subtle soft shadows, minimalist. ${CENTRO_VACIO}`,
    backgroundKeys: ['image-studio/backgrounds/estudio_neutro/0.jpg', 'image-studio/backgrounds/estudio_neutro/1.jpg', 'image-studio/backgrounds/estudio_neutro/2.jpg'],
  },
  madera: {
    label: 'Madera (ropa casual, calzado)',
    prompt: `${VISTA_CENITAL} A rustic warm wood plank floor texture, natural wood grain, soft natural daylight, minimal casual styling. ${CENTRO_VACIO}`,
    backgroundKeys: ['image-studio/backgrounds/madera/0.jpg', 'image-studio/backgrounds/madera/1.jpg', 'image-studio/backgrounds/madera/2.jpg'],
  },
  marmol_plantas: {
    label: 'Mármol con plantas (ropa urbana, casual chic)',
    prompt: `${VISTA_CENITAL} A bright white marble surface texture with tropical monstera leaves arranged at the edges only, natural bright daylight, modern editorial style. ${CENTRO_VACIO}`,
    backgroundKeys: ['image-studio/backgrounds/marmol_plantas/0.jpg', 'image-studio/backgrounds/marmol_plantas/1.jpg', 'image-studio/backgrounds/marmol_plantas/2.jpg'],
  },
  calle_urbana: {
    label: 'Urbano retro (streetwear)',
    prompt: `${VISTA_CENITAL} A gray felt or weathered concrete textured surface, moody neutral gray tones, a few subtle scattered paint flecks or chalk marks, gritty streetwear editorial style, no large objects. ${CENTRO_VACIO}`,
    backgroundKeys: ['image-studio/backgrounds/calle_urbana/0.jpg', 'image-studio/backgrounds/calle_urbana/1.jpg', 'image-studio/backgrounds/calle_urbana/2.jpg'],
  },
  lino_flores: {
    label: 'Lino con flores secas (joyería, productos delicados)',
    prompt: `${VISTA_CENITAL} Soft cream linen fabric texture with delicate dried baby's breath (gypsophila) flowers arranged around the edges only, warm golden natural light, premium boutique style. ${CENTRO_VACIO}`,
    backgroundKeys: ['image-studio/backgrounds/lino_flores/0.jpg', 'image-studio/backgrounds/lino_flores/1.jpg', 'image-studio/backgrounds/lino_flores/2.jpg'],
  },
  mantel_dorado: {
    label: 'Mantel dorado (perfumería, productos finos)',
    prompt: `${VISTA_CENITAL} An elegant dark surface with a subtle draped gold satin fabric texture, warm dramatic lighting, luxury product photography style, soft reflections. ${CENTRO_VACIO}`,
    backgroundKeys: ['image-studio/backgrounds/mantel_dorado/0.jpg', 'image-studio/backgrounds/mantel_dorado/1.jpg', 'image-studio/backgrounds/mantel_dorado/2.jpg'],
  },
  ceramica: {
    label: 'Cerámica (hogar, cosmética)',
    prompt: `${VISTA_CENITAL} A matte light-toned ceramic tile texture, soft even natural light, minimalist clean aesthetic, subtle grout lines. ${CENTRO_VACIO}`,
    backgroundKeys: ['image-studio/backgrounds/ceramica/0.jpg', 'image-studio/backgrounds/ceramica/1.jpg', 'image-studio/backgrounds/ceramica/2.jpg'],
  },
  ropa_deportiva: {
    label: 'Deportivo urbano (indumentaria deportiva)',
    prompt: `${VISTA_CENITAL} A matte gray rubber gym flooring texture, subtle chalk dust marks, bold energetic sportswear editorial style, neutral gray tones, no large objects. ${CENTRO_VACIO}`,
    backgroundKeys: ['image-studio/backgrounds/ropa_deportiva/0.jpg', 'image-studio/backgrounds/ropa_deportiva/1.jpg', 'image-studio/backgrounds/ropa_deportiva/2.jpg'],
  },
  ropa_elegante: {
    label: 'Elegante (indumentaria formal/de gala)',
    prompt: `${VISTA_CENITAL} A dark charcoal shaggy fabric or velvet texture, soft moody lighting, refined formalwear editorial style, subtle rich texture, no clutter. ${CENTRO_VACIO}`,
    backgroundKeys: ['image-studio/backgrounds/ropa_elegante/0.jpg', 'image-studio/backgrounds/ropa_elegante/1.jpg', 'image-studio/backgrounds/ropa_elegante/2.jpg'],
  },
  ropa_playa: {
    label: 'Playa/verano (indumentaria de verano, trajes de baño)',
    // Ojo con el wording acá: una versión anterior ("close-up sand texture,
    // seashells") disparó el filtro de contenido de Workers AI como falso
    // positivo NSFW (ver historial). Evitar "seashells"/"close-up" juntos.
    prompt: `${VISTA_CENITAL} A flat beige sand texture background with natural sand ripple patterns, warm sunny natural light, relaxed summer editorial style — no ocean, no horizon, no large objects, sand texture only. ${CENTRO_VACIO}`,
    backgroundKeys: ['image-studio/backgrounds/ropa_playa/0.jpg', 'image-studio/backgrounds/ropa_playa/1.jpg', 'image-studio/backgrounds/ropa_playa/2.jpg'],
  },
  ropa_invierno: {
    label: 'Abrigo/invierno (indumentaria de invierno)',
    prompt: `${VISTA_CENITAL} A cozy chunky-knit cream blanket texture, warm ambient light, a few out-of-focus dried pine sprigs at the edges only, warm inviting editorial style. ${CENTRO_VACIO}`,
    backgroundKeys: ['image-studio/backgrounds/ropa_invierno/0.jpg', 'image-studio/backgrounds/ropa_invierno/1.jpg', 'image-studio/backgrounds/ropa_invierno/2.jpg'],
  },
  // "papel_kraft" se sacó del catálogo (09/2026): medido a mano, el filtro
  // de contenido de Workers AI rechaza esta textura puntual como falso
  // positivo NSFW ~83% de las veces (5 de 6 intentos), pase lo que pase en
  // el wording exacto ("creases", "grain", con o sin ellas) — no es un
  // problema de una palabra específica, es la textura semántica en sí. Ni
  // con el reintento de CloudflareImageService (3 intentos) da una tasa de
  // éxito aceptable. No vale la pena seguir peleándolo — si hace falta un
  // fondo tipo packaging/artesanal, mejor una foto real (ver conversación
  // sobre bancos de fotos con licencia) que este prompt.
  piedra_clara: {
    label: 'Piedra clara (uso general, cosmética/hogar)',
    prompt: `${VISTA_CENITAL} A light beige travertine stone surface texture, soft natural light, subtle organic stone veining, clean minimalist style. ${CENTRO_VACIO}`,
    backgroundKeys: ['image-studio/backgrounds/piedra_clara/0.jpg', 'image-studio/backgrounds/piedra_clara/1.jpg', 'image-studio/backgrounds/piedra_clara/2.jpg'],
  },
  papel_pastel: {
    label: 'Papel color pastel (uso general, juvenil/colorido)',
    prompt: `${VISTA_CENITAL} A soft pastel-colored textured paper surface (light pink or mint), even soft studio light, minimalist playful style, subtle paper grain. ${CENTRO_VACIO}`,
    backgroundKeys: ['image-studio/backgrounds/papel_pastel/0.jpg', 'image-studio/backgrounds/papel_pastel/1.jpg', 'image-studio/backgrounds/papel_pastel/2.jpg'],
  },
  ropa_infantil: {
    label: 'Infantil (indumentaria de niños)',
    prompt: `${VISTA_CENITAL} A soft pastel yellow or mint textured fabric surface, a few small wooden toy blocks scattered only at the corners, playful gentle lighting, no large objects. ${CENTRO_VACIO}`,
    backgroundKeys: ['image-studio/backgrounds/ropa_infantil/0.jpg', 'image-studio/backgrounds/ropa_infantil/1.jpg', 'image-studio/backgrounds/ropa_infantil/2.jpg'],
  },
  denim_vintage: {
    label: 'Denim vintage (indumentaria, segunda mano)',
    prompt: `${VISTA_CENITAL} A raw denim fabric texture, faded indigo blue, natural stitching detail, warm nostalgic lighting, thrift-store editorial style, no large objects. ${CENTRO_VACIO}`,
    backgroundKeys: ['image-studio/backgrounds/denim_vintage/0.jpg', 'image-studio/backgrounds/denim_vintage/1.jpg', 'image-studio/backgrounds/denim_vintage/2.jpg'],
  },
  joyeria_terciopelo: {
    label: 'Terciopelo (joyería, productos finos)',
    prompt: `${VISTA_CENITAL} A deep emerald green velvet fabric texture, soft directional light creating gentle sheen, luxury jewelry display style, subtle rich folds. ${CENTRO_VACIO}`,
    backgroundKeys: ['image-studio/backgrounds/joyeria_terciopelo/0.jpg', 'image-studio/backgrounds/joyeria_terciopelo/1.jpg', 'image-studio/backgrounds/joyeria_terciopelo/2.jpg'],
  },
  industrial_metal: {
    label: 'Metal industrial (ferretería, electrónica, herramientas)',
    prompt: `${VISTA_CENITAL} A brushed steel metal surface texture, cool neutral tones, subtle diagonal brushed pattern, clean industrial lighting, no large objects. ${CENTRO_VACIO}`,
    backgroundKeys: ['image-studio/backgrounds/industrial_metal/0.jpg', 'image-studio/backgrounds/industrial_metal/1.jpg', 'image-studio/backgrounds/industrial_metal/2.jpg'],
  },
  // Tres estilos urbanos NUEVOS (21/09/2026, pedido explícito: "más fondos
  // de tipo urbano para ropa urbana") — distintos entre sí y de los urbanos
  // que ya había (calle_urbana es fieltro/concreto gris con tiza; ropa_deportiva
  // es piso de gimnasio). Sembrados con scripts/image-studio/seed-backgrounds.ts.
  //
  // "grafiti_chapa" se probó y se descartó: pese a pedir explícitamente "no
  // text, no letters, no words", 2 de 3 variantes salieron con letras de
  // grafiti bien legibles (nombres/tags armados a mano) — mismo problema que
  // "papel_kraft" (ver abajo): un concepto que el modelo no respeta de forma
  // confiable pase lo que pase en el wording exacto. No vale la pena seguir
  // peleándolo — si hace falta un fondo tipo grafiti/arte urbano, mejor una
  // foto real con licencia que este prompt.
  asfalto_tiza: {
    label: 'Asfalto con tiza (streetwear, skate)',
    prompt: `${VISTA_CENITAL} A dark gray asphalt/blacktop surface texture, subtle cracks and weathering, a few faint chalk or paint marks scattered only at the edges, gritty skatepark editorial style, no large objects. ${CENTRO_VACIO}`,
    backgroundKeys: ['image-studio/backgrounds/asfalto_tiza/0.jpg', 'image-studio/backgrounds/asfalto_tiza/1.jpg', 'image-studio/backgrounds/asfalto_tiza/2.jpg'],
  },
  cemento_pulido: {
    label: 'Cemento pulido (streetwear, loft industrial)',
    prompt: `${VISTA_CENITAL} A smooth polished concrete floor texture, cool moody gray tones, subtle imperfections and fine cracks, minimalist industrial loft editorial style. ${CENTRO_VACIO}`,
    backgroundKeys: ['image-studio/backgrounds/cemento_pulido/0.jpg', 'image-studio/backgrounds/cemento_pulido/1.jpg', 'image-studio/backgrounds/cemento_pulido/2.jpg'],
  },
  cuero_negro: {
    label: 'Cuero negro (streetwear, techwear)',
    prompt: `${VISTA_CENITAL} A dark black textured leather surface, subtle natural grain and soft sheen, moody dramatic lighting, urban techwear editorial style. ${CENTRO_VACIO}`,
    backgroundKeys: ['image-studio/backgrounds/cuero_negro/0.jpg', 'image-studio/backgrounds/cuero_negro/1.jpg', 'image-studio/backgrounds/cuero_negro/2.jpg'],
  },
};

export const BACKGROUND_STYLE_KEYS = Object.keys(BACKGROUND_STYLES);
export const DEFAULT_BACKGROUND_STYLE = 'estudio_neutro';

// "Sin fondo": no es un estilo del catálogo (no compone nada contra un fondo
// generado, ver ImageStudioService.generateBackground()) — es un atajo para
// llegar al mismo resultado que el toggle "Quitar fondo" de siempre, pero
// con preview inmediato acá mismo. Pedido explícito: que quien no repare en
// ese botón (ya existente, en cada miniatura) pueda llegar a lo mismo desde
// el selector de "Fondo con IA".
export const SIN_FONDO_KEY = 'sin_fondo';
