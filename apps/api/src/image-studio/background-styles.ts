// Catálogo curado de fondos para ImageStudioService.generateBackground().
// Cada uno apunta a un rubro distinto (no es lo mismo un fondo para
// perfumería que para ropa urbana o joyas — pedido explícito del vendedor).
//
// Los tres prompts comparten estructura a propósito: describen una ESCENA
// VACÍA (sin producto) con el tercio central limpio, para que el producto
// real se componga encima con sharp — nunca se le pide a la IA que dibuje
// el producto (ver comentario de PROMPT_FONDO_DEFAULT.md / resumen de la
// tarea: pedirle a Flux que "edite" la foto completa reinterpreta el
// producto, no solo el fondo).
export interface BackgroundStyle {
  label: string;
  prompt: string;
}

const CENTRO_VACIO =
  'IMPORTANT: the center third of the image must be empty, clean, with no objects, no clothing, ' +
  'no jewelry, no product of any kind, no text, no watermark, no people — just the background ' +
  'surface, ready for a product photo to be placed on top of later.';

export const BACKGROUND_STYLES: Record<string, BackgroundStyle> = {
  estudio_neutro: {
    label: 'Estudio neutro',
    prompt:
      'A professional studio product photography background, softly lit, seamless neutral backdrop, ' +
      `subtle soft shadows. ${CENTRO_VACIO}`,
  },
  madera: {
    label: 'Madera (ropa casual, calzado)',
    prompt:
      'A rustic warm wood plank floor background, natural wood grain texture, soft natural daylight, ' +
      `minimal casual styling, top-down flat lay surface. ${CENTRO_VACIO}`,
  },
  marmol_plantas: {
    label: 'Mármol con plantas (ropa urbana, casual chic)',
    prompt:
      'A bright white marble surface background with tropical monstera leaves arranged at the edges, ' +
      `natural bright daylight, modern editorial flat lay style. ${CENTRO_VACIO}`,
  },
  calle_urbana: {
    label: 'Calle urbana (streetwear)',
    prompt:
      'An urban city street background, textured concrete pavement or a weathered brick/graffiti wall, ' +
      `natural daylight, gritty streetwear editorial style, shallow depth of field. ${CENTRO_VACIO}`,
  },
  lino_flores: {
    label: 'Lino con flores secas (joyería, productos delicados)',
    prompt:
      "Soft cream linen fabric background with delicate dried baby's breath (gypsophila) flowers " +
      'arranged around the edges, warm golden natural window light, premium boutique catalog style, ' +
      `soft shadows. ${CENTRO_VACIO}`,
  },
  mantel_dorado: {
    label: 'Mantel dorado (perfumería, productos finos)',
    prompt:
      'An elegant dark surface with a subtle draped gold satin fabric, warm dramatic side lighting, ' +
      `luxury product photography style, soft reflections. ${CENTRO_VACIO}`,
  },
  ceramica: {
    label: 'Cerámica (hogar, cosmética)',
    prompt:
      'A matte light-toned ceramic tile surface background, soft even natural light, minimalist ' +
      `clean aesthetic, subtle texture. ${CENTRO_VACIO}`,
  },
};

export const BACKGROUND_STYLE_KEYS = Object.keys(BACKGROUND_STYLES);
export const DEFAULT_BACKGROUND_STYLE = 'estudio_neutro';
