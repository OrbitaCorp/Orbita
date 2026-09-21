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
export interface BackgroundStyle {
  label: string;
  prompt: string;
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

// Regla dura #2 (feedback real): objetos "grandes" en las esquinas (zapatillas,
// auriculares, reloj, sombrero) compiten con el producto en el mismo plano —
// como el producto ocupa casi todo el cuadro, termina tapándolos de forma
// rara, como si "flotara por encima" de la escena. Los estilos que SÍ
// funcionan bien (madera, mármol, lino, invierno) solo tienen detalles
// CHICOS y sutiles (una hoja, una ramita, una flor seca), nunca objetos
// grandes tipo producto. Cualquier estilo nuevo debe seguir ese criterio.

export const BACKGROUND_STYLES: Record<string, BackgroundStyle> = {
  estudio_neutro: {
    label: 'Estudio neutro',
    prompt: `${VISTA_CENITAL} A soft neutral light gray fabric sheet texture, gentle natural wrinkles, subtle soft shadows, minimalist. ${CENTRO_VACIO}`,
  },
  madera: {
    label: 'Madera (ropa casual, calzado)',
    prompt: `${VISTA_CENITAL} A rustic warm wood plank floor texture, natural wood grain, soft natural daylight, minimal casual styling. ${CENTRO_VACIO}`,
  },
  marmol_plantas: {
    label: 'Mármol con plantas (ropa urbana, casual chic)',
    prompt: `${VISTA_CENITAL} A bright white marble surface texture with tropical monstera leaves arranged at the edges only, natural bright daylight, modern editorial style. ${CENTRO_VACIO}`,
  },
  calle_urbana: {
    label: 'Urbano retro (streetwear)',
    prompt: `${VISTA_CENITAL} A gray felt or weathered concrete textured surface, moody neutral gray tones, a few subtle scattered paint flecks or chalk marks, gritty streetwear editorial style, no large objects. ${CENTRO_VACIO}`,
  },
  lino_flores: {
    label: 'Lino con flores secas (joyería, productos delicados)',
    prompt: `${VISTA_CENITAL} Soft cream linen fabric texture with delicate dried baby's breath (gypsophila) flowers arranged around the edges only, warm golden natural light, premium boutique style. ${CENTRO_VACIO}`,
  },
  mantel_dorado: {
    label: 'Mantel dorado (perfumería, productos finos)',
    prompt: `${VISTA_CENITAL} An elegant dark surface with a subtle draped gold satin fabric texture, warm dramatic lighting, luxury product photography style, soft reflections. ${CENTRO_VACIO}`,
  },
  ceramica: {
    label: 'Cerámica (hogar, cosmética)',
    prompt: `${VISTA_CENITAL} A matte light-toned ceramic tile texture, soft even natural light, minimalist clean aesthetic, subtle grout lines. ${CENTRO_VACIO}`,
  },
  ropa_deportiva: {
    label: 'Deportivo urbano (indumentaria deportiva)',
    prompt: `${VISTA_CENITAL} A matte gray rubber gym flooring texture, subtle chalk dust marks, bold energetic sportswear editorial style, neutral gray tones, no large objects. ${CENTRO_VACIO}`,
  },
  ropa_elegante: {
    label: 'Elegante (indumentaria formal/de gala)',
    prompt: `${VISTA_CENITAL} A dark charcoal shaggy fabric or velvet texture, soft moody lighting, refined formalwear editorial style, subtle rich texture, no clutter. ${CENTRO_VACIO}`,
  },
  ropa_playa: {
    label: 'Playa/verano (indumentaria de verano, trajes de baño)',
    // Ojo con el wording acá: una versión anterior ("close-up sand texture,
    // seashells") disparó el filtro de contenido de Workers AI como falso
    // positivo NSFW (ver historial). Evitar "seashells"/"close-up" juntos.
    prompt: `${VISTA_CENITAL} A flat beige sand texture background with natural sand ripple patterns, warm sunny natural light, relaxed summer editorial style — no ocean, no horizon, no large objects, sand texture only. ${CENTRO_VACIO}`,
  },
  ropa_invierno: {
    label: 'Abrigo/invierno (indumentaria de invierno)',
    prompt: `${VISTA_CENITAL} A cozy chunky-knit cream blanket texture, warm ambient light, a few out-of-focus dried pine sprigs at the edges only, warm inviting editorial style. ${CENTRO_VACIO}`,
  },
};

export const BACKGROUND_STYLE_KEYS = Object.keys(BACKGROUND_STYLES);
export const DEFAULT_BACKGROUND_STYLE = 'estudio_neutro';
