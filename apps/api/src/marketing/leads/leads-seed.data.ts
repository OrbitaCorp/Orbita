export const RUBROS_LEAD = ['TIENDA', 'TURNOS', 'ALQUILERES', 'GIMNASIO', 'POS'] as const;
export type LeadRubro = (typeof RUBROS_LEAD)[number];

export const CLASIFICACIONES_LEAD = ['POTENCIAL_LOCAL', 'PILOTO', 'LEAD'] as const;
export type LeadClasificacion = (typeof CLASIFICACIONES_LEAD)[number];

export const ESTADOS_LEAD = [
  'NUEVO',
  'CONTACTADO',
  'RESPONDIO',
  'DEMO',
  'PILOTO_ACTIVO',
  'CLIENTE',
  'DESCARTADO',
  'NO_CONTACTAR',
] as const;
export type LeadEstado = (typeof ESTADOS_LEAD)[number];

export const MAX_PILOTOS_POR_RUBRO = 5;
export const LOCALIDAD_LOCAL = 'Puerto Iguazú';

export const UBICACION_MISIONES: Record<string, { zona: string; departamento: string }> = {
  'Puerto Iguazú': { zona: 'Norte', departamento: 'Iguazú' },
  'Puerto Esperanza': { zona: 'Norte', departamento: 'Iguazú' },
  Wanda: { zona: 'Norte', departamento: 'Iguazú' },
  'Puerto Libertad': { zona: 'Norte', departamento: 'Iguazú' },
  Eldorado: { zona: 'Norte', departamento: 'Eldorado' },
  Montecarlo: { zona: 'Norte', departamento: 'Montecarlo' },
  'Puerto Rico': { zona: 'Centro-Norte', departamento: 'Libertador Gral. San Martín' },
  'Jardín América': { zona: 'Centro', departamento: 'San Ignacio' },
  Oberá: { zona: 'Centro', departamento: 'Oberá' },
  'Aristóbulo del Valle': { zona: 'Centro', departamento: 'Cainguás' },
  'San Vicente': { zona: 'Centro-Este', departamento: 'Guaraní' },
  'Leandro N. Alem': { zona: 'Sur', departamento: 'Leandro N. Alem' },
  Apóstoles: { zona: 'Sur', departamento: 'Apóstoles' },
  Posadas: { zona: 'Sur', departamento: 'Capital' },
};

const AREA_CODES = ['3757', '3755', '3751', '3743', '3754', '3756', '3758', '2657', '376', '341', '11'];

export function esPuertoIguazu(localidad: string): boolean {
  const norm = localidad
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  return norm === 'puerto iguazu';
}

export function normalizarWhatsappUrl(telefono?: string | null): string | null {
  if (!telefono) return null;
  const limpio = telefono.trim();
  if (!limpio || limpio === '—') return null;
  let d = limpio.replace(/\D/g, '');
  if (!d) return null;
  if (d.startsWith('549') && d.length >= 12) return `https://wa.me/${d}`;
  if (d.startsWith('54')) {
    let rest = d.slice(2);
    if (rest.startsWith('0')) rest = rest.slice(1);
    for (const code of AREA_CODES) {
      if (rest.startsWith(`${code}15`)) {
        rest = `${code}${rest.slice(code.length + 2)}`;
        break;
      }
    }
    return `https://wa.me/549${rest}`;
  }
  if (d.startsWith('0')) d = d.slice(1);
  for (const code of AREA_CODES) {
    if (d.startsWith(`${code}15`)) {
      d = `${code}${d.slice(code.length + 2)}`;
      break;
    }
  }
  return `https://wa.me/549${d}`;
}

export function normalizarInstagram(ig?: string | null): string | null {
  if (!ig) return null;
  const limpio = ig.trim();
  if (!limpio || limpio === '—') return null;
  const urlMatch = limpio.match(/instagram\.com\/([A-Za-z0-9._]+)/i);
  const handle = (urlMatch ? urlMatch[1] : limpio).replace(/^@+/, '').replace(/\/+$/, '').toLowerCase();
  if (!handle || !/^[a-z0-9._]{1,30}$/.test(handle)) return null;
  return `@${handle}`;
}

export interface LeadSeedRow {
  clave: string;
  rubro: LeadRubro;
  subrubro: string;
  clasificacion: LeadClasificacion;
  negocio: string;
  zona: string;
  departamento: string;
  localidad: string;
  telefono: string | null;
  whatsappUrl: string | null;
  instagram: string | null;
  webActual: string | null;
  resenas: string | null;
  direccion: string | null;
  fuente: string;
}

type RawRow = readonly [
  rubro: LeadRubro,
  localidad: string,
  negocio: string,
  subrubro: string,
  clasificacion: LeadClasificacion,
  telefono: string | null,
  instagram: string | null,
  webActual: string | null,
  resenas: string | null,
  direccion: string | null,
  fuente: string,
];

function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

const RAW_LEADS: RawRow[] = [
  // ═══ 1. TIENDAS ONLINE (102) ══════════════════════════════════════════════
  // Puerto Iguazú (22 → POTENCIAL_LOCAL)
  ['TIENDA', 'Puerto Iguazú', 'Antonela Carvallo Modas Plus Size', 'Tienda de talles grandes', 'POTENCIAL_LOCAL', '+54 3757 50-7997', '@antonelacarvallo', 'Sin sitio web', null, null, 'Somaini'],
  ['TIENDA', 'Puerto Iguazú', 'El Percherito', 'Tienda de ropa infantil', 'POTENCIAL_LOCAL', '+54 3757 30-1441', '@elpercheritoiguazu_1', 'Sin sitio web', null, null, 'Somaini'],
  ['TIENDA', 'Puerto Iguazú', 'Elite Modas', 'Tienda de ropa de mujer', 'POTENCIAL_LOCAL', '+54 3757 30-2121', '@eliteiguazu', 'Sin sitio web', null, null, 'Somaini'],
  ['TIENDA', 'Puerto Iguazú', 'Guardián del Monte', 'Tienda de artesanías / Indumentaria', 'POTENCIAL_LOCAL', '+54 3757 34-4000', '@guardiandelmonteiguazu', 'Sin sitio web', null, null, 'Somaini'],
  ['TIENDA', 'Puerto Iguazú', 'Gustamas', 'Boutique / Ropa de mujer', 'POTENCIAL_LOCAL', '+54 3757 46-7285', '@gustamasboutique', 'Solo Instagram', '4.6★ (20)', 'Av. Victoria Aguirre 271, Puerto Iguazú', 'Somaini + Google Maps'],
  ['TIENDA', 'Puerto Iguazú', 'Junco Calzados', 'Zapatería', 'POTENCIAL_LOCAL', '+54 9 3757 55-0883', '@juncocalzados_', 'WhatsApp (wa.me/5493757550883)', null, null, 'Somaini'],
  ['TIENDA', 'Puerto Iguazú', 'Marquesa Boutique', 'Tienda de ropa de mujer', 'POTENCIAL_LOCAL', null, '@marquesa.marquesa', 'Sin sitio web', null, null, 'Somaini'],
  ['TIENDA', 'Puerto Iguazú', 'Mhappycreation', 'Regalería', 'POTENCIAL_LOCAL', '+54 11 2771-3907', '@m_happycreation', 'Sin sitio web', null, null, 'Somaini'],
  ['TIENDA', 'Puerto Iguazú', 'Mia Mia Boutique', 'Tienda de ropa de mujer', 'POTENCIAL_LOCAL', '+54 3757 43-2326', '@miamia_boutique_', 'Solo Instagram', '4.6★ (8)', 'Av. República Argentina 1024, Puerto Iguazú', 'Somaini + Google Maps'],
  ['TIENDA', 'Puerto Iguazú', 'Moda Evangélica (Vistiendo con Pudor)', 'Tienda de ropa de mujer', 'POTENCIAL_LOCAL', '+54 3757 67-7098', '@vistiendo_con_pudor_', 'Sin sitio web', null, null, 'Somaini'],
  ['TIENDA', 'Puerto Iguazú', 'Modas Jesi', 'Tienda de ropa de mujer', 'POTENCIAL_LOCAL', '+54 3757 33-3944', '@modasjesi', 'Sin sitio web', null, null, 'Somaini'],
  ['TIENDA', 'Puerto Iguazú', 'Valentina Modas', 'Tienda de ropa de mujer', 'POTENCIAL_LOCAL', '+54 3757 40-5161', '@valentina_modas___', 'Sin sitio web', null, null, 'Somaini'],
  ['TIENDA', 'Puerto Iguazú', 'Zapatería Siempre a la Moda', 'Zapatería', 'POTENCIAL_LOCAL', '+54 3757 40-6821', '@bombonas_shoes', 'Sin sitio web', null, null, 'Somaini'],
  ['TIENDA', 'Puerto Iguazú', 'Extreme', 'Tienda de ropa de mujer', 'POTENCIAL_LOCAL', null, null, 'Sin sitio web', '5.0★ (10)', 'C. Bonpland 155, Puerto Iguazú', 'Google Maps'],
  ['TIENDA', 'Puerto Iguazú', 'AM Iguazú', 'Tienda de ropa', 'POTENCIAL_LOCAL', '03757 42-3289', null, 'Solo Facebook (facebook.com/AMiguazu)', '4.0★ (10)', 'Av. República Argentina 110, Puerto Iguazú', 'Google Maps'],
  ['TIENDA', 'Puerto Iguazú', 'La Argentina Campo', 'Tienda de ropa', 'POTENCIAL_LOCAL', '02657 15-66-2596', null, 'Sin sitio web', '4.6★ (9)', 'Av. Misiones 177, Puerto Iguazú', 'Google Maps'],
  ['TIENDA', 'Puerto Iguazú', 'Alma Mía Zapatería', 'Zapatería', 'POTENCIAL_LOCAL', '03757 31-6452', null, 'Sin sitio web', '4.2★ (30)', 'Av. Brasil 82, Puerto Iguazú', 'Google Maps'],
  ['TIENDA', 'Puerto Iguazú', 'IMPARES CALZADOS', 'Zapatería', 'POTENCIAL_LOCAL', null, null, 'Solo Facebook (facebook.com/profile.php?id=100008615289848)', '4.0★ (5)', 'Av. República Argentina 1024, Puerto Iguazú', 'Google Maps'],
  ['TIENDA', 'Puerto Iguazú', 'Presentitos', 'Tienda de regalos', 'POTENCIAL_LOCAL', '03757 45-6571', null, 'Sin sitio web', '4.4★ (5)', 'Dr. O. Allende, Puerto Iguazú', 'Google Maps'],
  ['TIENDA', 'Puerto Iguazú', 'El Turista', 'Tienda de regalos', 'POTENCIAL_LOCAL', null, null, 'Sin sitio web', '5.0★ (10)', 'Av. Victoria Aguirre 1162, Puerto Iguazú', 'Google Maps'],
  ['TIENDA', 'Puerto Iguazú', 'Adan y Eva Indumentaria', 'Tienda de ropa', 'POTENCIAL_LOCAL', '03757 44-3183', null, 'Sin sitio web', '4.8★ (14)', 'Jangadero 102-200, Puerto Iguazú', 'Google Maps'],
  ['TIENDA', 'Puerto Iguazú', 'Friki Store', 'Tienda de ropa', 'POTENCIAL_LOCAL', '03757 55-0262', null, 'Sin sitio web', '4.0★ (8)', 'Av. Tres Fronteras 491, Puerto Iguazú', 'Google Maps'],

  // Puerto Esperanza (3)
  ['TIENDA', 'Puerto Esperanza', 'Coruja Boutique', 'Boutique', 'LEAD', '03757 62-9754', null, 'Solo Facebook (facebook.com/corujaboutique/)', '4.6★ (19)', null, 'Google Maps'],
  ['TIENDA', 'Puerto Esperanza', 'Francis Modas', 'Tienda de ropa', 'LEAD', '03757 44-4460', null, 'Sin sitio web', '4.8★ (12)', null, 'Google Maps'],
  ['TIENDA', 'Puerto Esperanza', 'solaar', 'Tienda de ropa', 'LEAD', '03757 62-4683', '@sol.aar_', 'Solo Instagram', '2.5★ (2)', null, 'Google Maps'],

  // Wanda (1)
  ['TIENDA', 'Wanda', 'Tienda Andrea', 'Tienda de ropa', 'LEAD', '03757 47-0611', null, 'Sin sitio web', '4.3★ (6)', null, 'Google Maps'],

  // Puerto Libertad (2)
  ['TIENDA', 'Puerto Libertad', 'Aloha boutique', 'Tienda de ropa', 'LEAD', '03757 67-4224', null, 'Sin sitio web', '5.0★ (1)', null, 'Google Maps'],
  ['TIENDA', 'Puerto Libertad', 'Tienda Damaris', 'Tienda de ropas mayorista', 'LEAD', '03757 15-31-9105', null, 'Sin sitio web', null, null, 'Google Maps'],

  // Eldorado (18)
  ['TIENDA', 'Eldorado', 'Angela Regalería', 'Regalería', 'LEAD', '+54 3751 37-8569', '@angelaaregaleria', 'Sin sitio web', null, null, 'Somaini'],
  ['TIENDA', 'Eldorado', 'Coquetas Boutique', 'Tienda de ropa de mujer', 'LEAD', '+54 3751 40-4175', '@coquetas10', 'Sin sitio web', null, null, 'Somaini'],
  ['TIENDA', 'Eldorado', 'Fémina Moda', 'Tienda de ropa de mujer', 'LEAD', '+54 376 458-8458', '@femina_eldorado', 'Sin sitio web', null, null, 'Somaini'],
  ['TIENDA', 'Eldorado', 'Joyería Doldan', 'Joyería', 'LEAD', '+54 3751 42-1272', '@joyeriadoldan', 'Sin sitio web', null, null, 'Somaini'],
  ['TIENDA', 'Eldorado', 'Luna Limón Accesorios y Calzados', 'Zapatería / Accesorios', 'LEAD', '+54 3751 57-3017', '@luna_limon.accesoriosycalzados', 'Sin sitio web', null, null, 'Somaini'],
  ['TIENDA', 'Eldorado', 'MM Shop', 'Tienda de accesorios de moda', 'LEAD', null, '@mmshop.ok', 'Sin sitio web', null, null, 'Somaini'],
  ['TIENDA', 'Eldorado', 'Yo Se Calzados', 'Zapatería', 'LEAD', null, '@yose.eldorado', 'Sin sitio web', null, null, 'Somaini'],
  ['TIENDA', 'Eldorado', 'Salomé Showroom', 'Indumentaria femenina', 'LEAD', null, '@salome__showroom', 'Sin sitio web', null, 'Av. San Martín 1391, Eldorado', 'Somaini'],
  ['TIENDA', 'Eldorado', 'EmmaFit', 'Tienda de ropa de mujer / Deportiva', 'LEAD', '+54 9 3751 34-6230', '@emmafit2025', 'Sin sitio web', null, null, 'Somaini'],
  ['TIENDA', 'Eldorado', 'Fidela', 'Tienda de ropa de mujer', 'LEAD', '+54 3751 63-4762', '@fidela.eldorado', 'Sin sitio web', null, null, 'Somaini'],
  ['TIENDA', 'Eldorado', 'Flapper Indumentaria', 'Tienda de ropa de mujer', 'LEAD', '+54 3751 52-0506', '@flapperindumentaria', 'Sin sitio web', null, null, 'Somaini'],
  ['TIENDA', 'Eldorado', 'Fonseca shop', 'Regalería', 'LEAD', null, '@fonseca_shopp', 'Sin sitio web', null, null, 'Somaini'],
  ['TIENDA', 'Eldorado', 'Gabylü', 'Tienda de ropa de mujer', 'LEAD', '+54 3751 53-4915', '@gabylu_eldorado', 'Sin sitio web', null, null, 'Somaini'],
  ['TIENDA', 'Eldorado', 'Jazmin Outfits', 'Tienda de ropa de mujer', 'LEAD', '+54 3751 35-5415', '@jazmineoutfitt', 'Sin sitio web', null, null, 'Somaini'],
  ['TIENDA', 'Eldorado', 'K-SKIN Skincare Coreano', 'Tienda de cuidado de la piel', 'LEAD', '+54 3751 33-1770', '@k_skincarecoreano', 'Sin sitio web', null, null, 'Somaini'],
  ['TIENDA', 'Eldorado', 'Kivan', 'Tienda de ropa infantil', 'LEAD', null, '@kivan_ok', 'Sin sitio web', null, null, 'Somaini'],
  ['TIENDA', 'Eldorado', 'Nina Indumentaria', 'Tienda de ropa de mujer', 'LEAD', '+54 3751 35-4163', '@nina.showroom.ok', 'Sin sitio web', null, null, 'Somaini'],
  ['TIENDA', 'Eldorado', 'ORIGAMI kids fashion', 'Tienda de ropa infantil', 'LEAD', '+54 376 416-9712', '@origami.eldo', 'Sin sitio web', null, null, 'Somaini'],

  // Montecarlo (5)
  ['TIENDA', 'Montecarlo', 'Idílico', 'Tienda de ropa de mujer', 'LEAD', '011 15-5384-4465', '@idilico_mns', 'Solo Instagram', '5.0★ (2)', null, 'Google Maps'],
  ['TIENDA', 'Montecarlo', 'Tienda Sueños', 'Tienda de ropa', 'LEAD', '03751 31-1372', null, 'Solo Facebook (facebook.com/tienda.sueno.5)', '4.7★ (23)', null, 'Google Maps'],
  ['TIENDA', 'Montecarlo', 'Jireh Moda', 'Tienda de ropa', 'LEAD', '03751 67-8899', null, 'Sin sitio web', '4.7★ (9)', null, 'Google Maps'],
  ['TIENDA', 'Montecarlo', 'Baby Boom Montecarlo', 'Tienda de ropa', 'LEAD', '011 2619-5496', null, 'Sin sitio web', '4.7★ (6)', null, 'Google Maps'],
  ['TIENDA', 'Montecarlo', 'Tokio Showroom', 'Tienda de ropa', 'LEAD', '03751 60-4858', null, 'Sin sitio web', '5.0★ (1)', null, 'Google Maps'],

  // Puerto Rico (4)
  ['TIENDA', 'Puerto Rico', 'No Me Olvides', 'Tienda de ropa', 'LEAD', '03743 47-7868', null, 'Solo Facebook (facebook.com/nomeolvides/)', '4.6★ (88)', null, 'Google Maps'],
  ['TIENDA', 'Puerto Rico', 'Moda Buenos Aires', 'Tienda de ropa', 'LEAD', '03743 55-8378', '@tiendamodabuenosaires', 'Solo Instagram', '4.4★ (7)', null, 'Google Maps'],
  ['TIENDA', 'Puerto Rico', 'FIFI! Showroom', 'Tienda de ropa', 'LEAD', null, '@fifishwrm', 'Solo Instagram', '4.9★ (12)', null, 'Google Maps'],
  ['TIENDA', 'Puerto Rico', 'Infinita', 'Tienda de ropa para jóvenes', 'LEAD', '03743 41-4648', null, 'Sin sitio web', '4.8★ (12)', null, 'Google Maps'],

  // Jardín América (4)
  ['TIENDA', 'Jardín América', 'Alas', 'Tienda de deportes', 'LEAD', '03743 15-45-1056', null, 'Sin sitio web', '4.6★ (349)', null, 'Google Maps'],
  ['TIENDA', 'Jardín América', 'In bloom', 'Tienda de ropa', 'LEAD', '03743 43-6023', '@in.bloom_store', 'Solo Instagram', '5.0★ (1)', null, 'Google Maps'],
  ['TIENDA', 'Jardín América', 'La esquina del bazar', 'Tienda de cubertería / Bazar', 'LEAD', '03757 36-5121', '@laesquinadelbazar_', 'Solo Instagram', '5.0★ (1)', null, 'Google Maps'],
  ['TIENDA', 'Jardín América', 'Lyctuestilo', 'Zapatería', 'LEAD', '011 2329-1001', null, 'Sin sitio web', '5.0★ (2)', null, 'Google Maps'],

  // Oberá (10)
  ['TIENDA', 'Oberá', 'Aba Moda Infantil', 'Tienda de ropa infantil / mujer', 'LEAD', '+54 3755 27-8529', '@aba.modainfantil', 'Sin sitio web', null, null, 'Somaini'],
  ['TIENDA', 'Oberá', 'BARDOCK - Indumentaria Deportiva', 'Tienda de ropa deportiva', 'LEAD', '+54 3755 34-6651', '@bardock.obera', 'Sin sitio web', null, null, 'Somaini'],
  ['TIENDA', 'Oberá', 'Belha Lencería, indumentaria y accesorios', 'Lencería / Accesorios', 'LEAD', '+54 3755 66-9608', '@belha_lenceria12', 'Sin sitio web', null, null, 'Somaini'],
  ['TIENDA', 'Oberá', 'Casa Lita', 'Tienda de accesorios de moda', 'LEAD', '+54 3755 32-8977', '@casa.lita', 'Sin sitio web', null, null, 'Somaini'],
  ['TIENDA', 'Oberá', 'Elens Indumentaria', 'Tienda de ropa de mujer', 'LEAD', '+54 3755 67-4618', '@elens_indumentaria_femenina', 'Sin sitio web', null, null, 'Somaini'],
  ['TIENDA', 'Oberá', 'Eusport', 'Tienda de ropa deportiva', 'LEAD', '+54 9 3755 61-2126', '@eusport.ar', 'Sin sitio web', null, null, 'Somaini'],
  ['TIENDA', 'Oberá', 'Génova Showroom', 'Tienda de ropa de mujer', 'LEAD', '+54 3755 50-8483', '@genova_7695', 'Sin sitio web', null, null, 'Somaini'],
  ['TIENDA', 'Oberá', 'Morha Mia Kids', 'Tienda de ropa infantil', 'LEAD', '+54 3755 54-2221', '@morhamiakids', 'Sin sitio web', null, null, 'Somaini'],
  ['TIENDA', 'Oberá', 'Msr zapatos Oberá', 'Zapatería', 'LEAD', '+54 3755 29-5250', '@msr_zapatos', 'Sin sitio web', null, null, 'Somaini'],
  ['TIENDA', 'Oberá', 'TRIMAUS Joyería y Orfebrería', 'Joyería', 'LEAD', '+54 9 3755 54-6222', '@trimausjoyeria', 'Sin sitio web', null, null, 'Somaini'],

  // Aristóbulo del Valle (3)
  ['TIENDA', 'Aristóbulo del Valle', 'LUSYMODAS', 'Boutique', 'LEAD', '03755 23-5026', '@lusymodas', 'Solo Instagram', '4.0★ (8)', null, 'Google Maps'],
  ['TIENDA', 'Aristóbulo del Valle', 'Blanco y Negro', 'Tienda de ropa', 'LEAD', '03755 67-0099', null, 'Sin sitio web', '4.7★ (7)', null, 'Google Maps'],
  ['TIENDA', 'Aristóbulo del Valle', 'Global Importados', 'Tienda de ropa de vestir', 'LEAD', '03755 38-0000', null, 'Sin sitio web', '5.0★ (2)', null, 'Google Maps'],

  // San Vicente (4)
  ['TIENDA', 'San Vicente', 'Tienda Sara', 'Tienda de ropa', 'LEAD', '03755 62-9513', null, 'Solo Facebook (facebook.com/profile.php?id=100054735551610)', '4.3★ (86)', null, 'Google Maps'],
  ['TIENDA', 'San Vicente', 'Doce mel Boutique', 'Boutique', 'LEAD', '03755 23-1637', null, 'Sin sitio web', '4.9★ (23)', null, 'Google Maps'],
  ['TIENDA', 'San Vicente', 'Tienda La Elegancia', 'Tienda de ropa de vestir', 'LEAD', '03755 20-9103', null, 'Sin sitio web', '4.9★ (19)', null, 'Google Maps'],
  ['TIENDA', 'San Vicente', 'Exclusiva moda sv', 'Tienda de ropa', 'LEAD', '03755 30-1168', null, 'Sin sitio web', '5.0★ (4)', null, 'Google Maps'],

  // Leandro N. Alem (3)
  ['TIENDA', 'Leandro N. Alem', 'TEMPORADA BEBÉS', 'Tienda de ropa infantil', 'LEAD', '03754 52-0686', null, 'Sin sitio web', '5.0★ (10)', null, 'Google Maps'],
  ['TIENDA', 'Leandro N. Alem', 'Afrodita Boutique', 'Tienda de ropa', 'LEAD', '03754 41-4627', null, 'Solo Facebook (facebook.com/AfoditaBoutique/)', '5.0★ (2)', null, 'Google Maps'],
  ['TIENDA', 'Leandro N. Alem', 'Indumentaria 9 de Julio', 'Tienda de ropa', 'LEAD', '03754 45-3152', null, 'Sin sitio web', '4.5★ (2)', null, 'Google Maps'],

  // Apóstoles (3)
  ['TIENDA', 'Apóstoles', 'Eufórica Style', 'Tienda de ropa', 'LEAD', '03756 64-0377', '@euforicastyle', 'Solo Instagram', '4.8★ (13)', null, 'Google Maps'],
  ['TIENDA', 'Apóstoles', 'Quimera', 'Tienda de ropa', 'LEAD', '0376 15-499-0320', null, 'Sin sitio web', '4.5★ (16)', null, 'Google Maps'],
  ['TIENDA', 'Apóstoles', 'El Paraíso De La Moda', 'Tienda de ropa', 'LEAD', '03758 40-3513', null, 'Sin sitio web', '4.5★ (2)', null, 'Google Maps'],

  // Posadas (20)
  ['TIENDA', 'Posadas', 'Idílica - Accesorios', 'Tienda de accesorios de moda', 'LEAD', '+54 376 476-0144', '@idilica.posadas', 'Sin sitio web', null, null, 'Somaini'],
  ['TIENDA', 'Posadas', 'Judith baby store', 'Tienda de ropa infantil', 'LEAD', '+54 376 486-3844', '@judithbaby.store', 'Sin sitio web', null, null, 'Somaini'],
  ['TIENDA', 'Posadas', 'Wolftergeist', 'Tienda de accesorios de moda', 'LEAD', '+54 376 411-3178', '@wolftergeist.posadas', 'Sin sitio web', null, null, 'Somaini'],
  ['TIENDA', 'Posadas', 'Showroom Guapas', 'Tienda de ropa', 'LEAD', '0376 432-7576', '@showroomguapas', 'Solo Instagram', '4.4★ (296)', null, 'Google Maps'],
  ['TIENDA', 'Posadas', 'Mi Tierra Roja – Regionales', 'Tienda de recuerdos / Regionales', 'LEAD', '0376 514-8323', '@mi_tierra_roja', 'Solo Instagram', '4.9★ (168)', null, 'Google Maps'],
  ['TIENDA', 'Posadas', 'Showroom Guapas (Av. Quaranta 4824)', 'Comercio / Showroom', 'LEAD', '0376 517-9513', '@xiomara.showroom', 'Solo Instagram', '4.3★ (120)', 'Av. Quaranta 4824, Posadas', 'Google Maps'],
  ['TIENDA', 'Posadas', 'Malibú Posadas', 'Tienda de ropa', 'LEAD', '0376 418-1155', '@malibu.posadas', 'Solo Instagram', '4.4★ (88)', null, 'Google Maps'],
  ['TIENDA', 'Posadas', 'Luna Mía', 'Tienda de ropa de deportes', 'LEAD', '0376 485-1315', '@lunamia_showroom', 'Solo Instagram', '4.8★ (60)', null, 'Google Maps'],
  ['TIENDA', 'Posadas', 'Faustina Accesorios', 'Tienda de accesorios de moda', 'LEAD', '0376 503-7688', '@faustina_accesorios21', 'Solo Instagram', '4.9★ (11)', null, 'Google Maps'],
  ['TIENDA', 'Posadas', 'Ruffina Boutique', 'Tienda de ropa', 'LEAD', '03755 62-9875', '@ruffina_boutique', 'Solo Instagram', '4.9★ (8)', null, 'Google Maps'],
  ['TIENDA', 'Posadas', 'Entre Patas Posadas', 'Tienda de productos para mascotas', 'LEAD', '0376 412-1182', '@entrepatasposadas', 'Solo Instagram', '5.0★ (5)', null, 'Google Maps'],
  ['TIENDA', 'Posadas', 'LUKZE Boutique', 'Boutique', 'LEAD', null, '@lukzemoda', 'Solo Instagram', '5.0★ (1)', null, 'Google Maps'],
  ['TIENDA', 'Posadas', 'Las Rudas Boutique', 'Tienda de ropa de tallas grandes', 'LEAD', '0376 439-0802', null, 'Catálogo WhatsApp (wa.me/c/5493764390802)', '4.8★ (54)', null, 'Google Maps'],
  ['TIENDA', 'Posadas', 'Matilda Pet Shop', 'Tienda de alimentos para animales', 'LEAD', '0376 464-4867', null, 'Beacons (beacons.ai/Matildaposadas)', '4.7★ (7)', null, 'Google Maps'],
  ['TIENDA', 'Posadas', 'La Casa de Angel', 'Tienda de regalos', 'LEAD', '0376 442-8877', null, 'Sin sitio web', '4.7★ (1019)', null, 'Google Maps'],
  ['TIENDA', 'Posadas', 'Lencería Julieta', 'Tienda de lencería', 'LEAD', '0376 463-0959', null, 'Sin sitio web', '4.4★ (382)', null, 'Google Maps'],
  ['TIENDA', 'Posadas', 'Indumentaria M & M', 'Tienda de ropa', 'LEAD', '0376 483-5158', null, 'Sin sitio web', '4.5★ (88)', null, 'Google Maps'],
  ['TIENDA', 'Posadas', 'LIMA BOUTIQUE', 'Tienda de ropa de mujer', 'LEAD', '0376 475-8245', null, 'Sin sitio web', '4.6★ (88)', null, 'Google Maps'],
  ['TIENDA', 'Posadas', 'Indumentaria Argentina', 'Tienda de ropa', 'LEAD', '0376 444-0238', null, 'Sin sitio web', '4.0★ (49)', null, 'Google Maps'],
  ['TIENDA', 'Posadas', 'Zapatería Jairo', 'Zapatería', 'LEAD', '0376 458-2503', null, 'Sin sitio web', '4.7★ (49)', null, 'Google Maps'],

  // ═══ 2. TURNOS (22) ══════════════════════════════════════════════════════
  // Puerto Iguazú (12: Top 5 PILOTO, resto LEAD)
  ['TURNOS', 'Puerto Iguazú', 'Ana cicuto', 'Centro de estética', 'PILOTO', '0376 472-5896', '@anacicuto_', 'Solo Instagram', '5.0★ (130)', 'Av. República Argentina 69, Puerto Iguazú', 'Google Maps'],
  ['TURNOS', 'Puerto Iguazú', 'Barbería Barber Club', 'Barbería', 'PILOTO', '03757 46-5921', null, 'Sin sitio web', '4.6★ (183)', 'Av. Nestor Kirchner N° 29, Puerto Iguazú', 'Google Maps'],
  ['TURNOS', 'Puerto Iguazú', 'Consultorio OdontoVital Iguazú', 'Clínica dental', 'PILOTO', '03757 57-1313', '@odontovital_iguazu', 'Solo Instagram', '5.0★ (10)', 'Jangadero 56, Puerto Iguazú', 'Google Maps'],
  ['TURNOS', 'Puerto Iguazú', 'CIR DENTAL', 'Clínica dental', 'PILOTO', '03757 32-3200', '@cir.dental', 'Solo Instagram', '5.0★ (4)', 'Estanislao López 78, Puerto Iguazú', 'Google Maps'],
  ['TURNOS', 'Puerto Iguazú', 'Barbershop_11', 'Barbería', 'PILOTO', '03757 51-4317', null, 'Sin sitio web', '5.0★ (21)', 'Av. Nestor Kirchner N3100, Puerto Iguazú', 'Google Maps'],
  ['TURNOS', 'Puerto Iguazú', 'Monica Cardozo', 'Peluquería', 'LEAD', '03757 61-9815', null, 'Sin sitio web', '4.6★ (28)', 'Juan Bautista Alberdi 1140, Puerto Iguazú', 'Google Maps'],
  ['TURNOS', 'Puerto Iguazú', 'Dentalgio - Consultorio Odontologico', 'Consultorio odontológico', 'LEAD', '03757 58-4357', null, 'Solo Facebook (facebook.com/DentalGioIguazu/)', '4.7★ (29)', 'Julio Silveira 81 2 OF 2, Puerto Iguazú', 'Google Maps'],
  ['TURNOS', 'Puerto Iguazú', 'Fisio Spine: Consultorio kinesiologia y Quiropraxia.', 'Kinesiología y Quiropraxia', 'LEAD', '03757 64-7323', null, 'Google Sites (sites.google.com/view/fisio-spine/contacto)', '4.8★ (25)', 'Perito Moreno 217, Puerto Iguazú', 'Google Maps'],
  ['TURNOS', 'Puerto Iguazú', 'NailsEnRosa', 'Salón de manicura y pedicura', 'LEAD', '03757 40-7424', null, 'Sin sitio web', '4.3★ (6)', 'Pancho Ramírez 127, Puerto Iguazú', 'Google Maps'],
  ['TURNOS', 'Puerto Iguazú', 'Neodent Odontología Iguazú', 'Dentista infantil', 'LEAD', '03757 42-3671', null, 'Solo Facebook (facebook.com/neodent.odontologia/)', '4.8★ (4)', 'Av. República Argentina 142, Puerto Iguazú', 'Google Maps'],
  ['TURNOS', 'Puerto Iguazú', 'BARBER LIFE', 'Barbería', 'LEAD', '03757 15-62-3856', null, 'Sin sitio web', '5.0★ (3)', 'Av. República Argentina 938, Puerto Iguazú', 'Google Maps'],
  ['TURNOS', 'Puerto Iguazú', 'Valhalla barber shop', 'Barbería', 'LEAD', '03757 15-67-8606', null, 'Sin sitio web', '5.0★ (2)', 'Sta. María, Puerto Iguazú', 'Google Maps'],
  // Resto de Misiones (10 → LEAD)
  ['TURNOS', 'Eldorado', 'La Vita Peluqueria - Barberia', 'Peluquería / Barbería', 'LEAD', '03751 15-61-8459', null, 'Sin sitio web', '4.9★ (93)', 'Av. San Martín 2432, Eldorado', 'Google Maps'],
  ['TURNOS', 'Eldorado', 'GV Barberia', 'Barbería', 'LEAD', '03751 40-7071', null, 'Sin sitio web', '4.8★ (42)', 'Av. San Martín 2195, Eldorado', 'Google Maps'],
  ['TURNOS', 'Eldorado', 'BARBER HOOD', 'Barbería', 'LEAD', '03751 50-8236', null, 'Sin sitio web', '5.0★ (1)', 'Alemania 1779, Eldorado', 'Google Maps'],
  ['TURNOS', 'Posadas', 'Cerella - Centro de bienestar y belleza', 'Centro de estética', 'LEAD', '0376 483-9013', null, 'Sin sitio web', '4.8★ (28)', 'Bolívar 1321, Posadas', 'Google Maps'],
  ['TURNOS', 'Posadas', 'Peluquería Matto Style', 'Peluquería', 'LEAD', '0376 412-2823', null, 'gurugo.com.ar/fichas/peluqueria-matto-style_16331385', '4.8★ (138)', 'Av. Roque Pérez 2198, Posadas', 'Google Maps'],
  ['TURNOS', 'Posadas', 'Luxury Beauty Salon', 'Peluquería', 'LEAD', '03754 57-9288', null, 'luxurysalon.com.ar', '4.9★ (52)', 'Felix de Azara 1250, Posadas', 'Google Maps'],
  ['TURNOS', 'Posadas', 'Keops Unisex Ayacucho', 'Peluquería', 'LEAD', '0376 411-1414', null, 'keopsunisex.com', '5.0★ (156)', 'Ayacucho 1825, Posadas', 'Google Maps'],
  ['TURNOS', 'Oberá', '01 Barber Studio', 'Barbería', 'LEAD', '03755 60-6028', '@01.barberstudio', 'Solo Instagram', '5.0★ (21)', 'Av. Libertad 145 (Galería del Centro), Oberá', 'Google Maps'],
  ['TURNOS', 'Oberá', 'Elite Barber Studio', 'Barbería', 'LEAD', null, '@elite_barberstudio1', 'Solo Instagram', '5.0★ (6)', 'Gdor. Barreyro 918, Oberá', 'Google Maps'],
  ['TURNOS', 'Oberá', 'Sztynka barbero', 'Barbería', 'LEAD', '03755 63-1622', null, 'sztynkabarbero.com', '4.7★ (71)', 'Juan Bautista Alberdi 1067, Oberá', 'Google Maps'],

  // ═══ 3. ALQUILERES (22) ══════════════════════════════════════════════════
  // Puerto Iguazú (12: Top 5 PILOTO, resto LEAD)
  ['ALQUILERES', 'Puerto Iguazú', 'Complejo de Padel 3 Fronteras', 'Club de pádel', 'PILOTO', '03757 15-55-2925', null, 'Sin sitio web', '4.4★ (119)', 'Rivadavia y Ramon Romero, Puerto Iguazú', 'Google Maps'],
  ['ALQUILERES', 'Puerto Iguazú', 'Flaco Pádel', 'Club de pádel', 'PILOTO', '03757 15-50-7575', null, 'Sin sitio web', '4.6★ (59)', 'Andresito 65, Puerto Iguazú', 'Google Maps'],
  ['ALQUILERES', 'Puerto Iguazú', 'PEKES SALA DE JUEGOS EN MULTIEVENTOS DON JULIO', 'Salón para eventos', 'PILOTO', '03757 51-1334', '@pekes_sala_de_juegos_', 'Solo Instagram', '4.4★ (55)', 'Irupe 570, Puerto Iguazú', 'Google Maps'],
  ['ALQUILERES', 'Puerto Iguazú', 'Terra Iguazú Apart', 'Apartotel', 'PILOTO', '0376 432-4459', '@terraiguazuapart', 'Solo Instagram', '4.2★ (353)', 'Palmera 33, Puerto Iguazú', 'Google Maps'],
  ['ALQUILERES', 'Puerto Iguazú', 'Apart- Hotel AVY´A', 'Apartamento turístico', 'PILOTO', '03757 55-1723', null, 'Sin sitio web', '4.8★ (30)', 'Salto Unión 153, Barrio Belén, Puerto Iguazú', 'Google Maps'],
  ['ALQUILERES', 'Puerto Iguazú', 'Poly Pádel', 'Pista de pádel', 'LEAD', '03757 15-43-1410', null, 'Solo Facebook (facebook.com/polypaddle)', '4.6★ (96)', 'Jangadero 586, Puerto Iguazú', 'Google Maps'],
  ['ALQUILERES', 'Puerto Iguazú', 'Santacruz Fútbol 5', 'Campo de fútbol', 'LEAD', '03757 43-1410', null, 'Solo Facebook (facebook.com/pg/santacruzfutbol5)', '4.2★ (27)', 'Jangadero 586, Puerto Iguazú', 'Google Maps'],
  ['ALQUILERES', 'Puerto Iguazú', 'La Jungla Salon Multieventos', 'Salón para eventos', 'LEAD', '03757 55-4991', null, 'Wix (mariaemiliamereb.wixsite.com/lajungla)', '4.4★ (88)', 'Dr. Luis Honorio Rolon, Puerto Iguazú', 'Google Maps'],
  ['ALQUILERES', 'Puerto Iguazú', 'Ojos de Cielo', 'Salón para eventos', 'LEAD', '03757 68-1685', null, 'Sin sitio web', '4.7★ (49)', 'Alciblades Alarcon 222, Puerto Iguazú', 'Google Maps'],
  ['ALQUILERES', 'Puerto Iguazú', 'Cristiano Eventos', 'Salón para eventos', 'LEAD', '03757 50-5629', null, 'Sin sitio web', '4.5★ (46)', 'Facundo Quiroga 163, Puerto Iguazú', 'Google Maps'],
  ['ALQUILERES', 'Puerto Iguazú', 'Sunset Eventos', 'Salón para eventos', 'LEAD', '03757 55-6852', null, 'Sin sitio web', '5.0★ (12)', 'Av. Río Paraná S/N, Puerto Iguazú', 'Google Maps'],
  ['ALQUILERES', 'Puerto Iguazú', 'Apart Tierra Viva', 'Apartamento turístico', 'LEAD', '011 5057-2110', null, 'tierravivaiguazu.com.ar', '4.6★ (556)', 'Corrientes 392, Puerto Iguazú', 'Google Maps'],
  // Resto de Misiones (10 → LEAD)
  ['ALQUILERES', 'Posadas', 'La Terraza - Canchas de Fútbol 5 y Padle', 'Campo de fútbol / Pádel', 'LEAD', '0376 443-2675', '@_laterraza5_', 'Solo Instagram', '4.4★ (1559)', 'Av. Sta. Catalina 4150, Posadas', 'Google Maps'],
  ['ALQUILERES', 'Posadas', 'BOX Padel', 'Club de pádel', 'LEAD', '0376 462-8119', '@box.padel', 'Solo Instagram', '4.5★ (45)', 'Calle 101 5588, Posadas', 'Google Maps'],
  ['ALQUILERES', 'Posadas', 'Arena Futbol 5', 'Campo de fútbol', 'LEAD', '0376 489-9659', '@arena.futbol5', 'Solo Instagram', '4.3★ (239)', 'Yerbal 3611, Posadas', 'Google Maps'],
  ['ALQUILERES', 'Posadas', 'Lo De Nachito Cancha de Futbol 5 y Padel', 'Campo de fútbol / Pádel', 'LEAD', '0376 15-425-2615', '@lodenachito.ok', 'Solo Instagram', '4.7★ (16)', 'Av. Francisco de Haro 5758, Posadas', 'Google Maps'],
  ['ALQUILERES', 'Eldorado', 'Hotel Cabañas Complejo Ysyry Eldorado Misiones', 'Cabañas / Salón de eventos', 'LEAD', '03751 15-59-2663', null, 'complejoysyry.com.ar', '4.6★ (375)', 'RN12 1549, Eldorado', 'Google Maps'],
  ['ALQUILERES', 'Eldorado', 'Cabañas Un Lugar', 'Cabañas', 'LEAD', '03751 15-66-6973', null, 'Sin sitio web', '4.3★ (514)', 'RN12 km 1550, Eldorado', 'Google Maps'],
  ['ALQUILERES', 'Eldorado', 'Quincho para Eventos Surucuá', 'Salón para eventos / Quincho', 'LEAD', '03751 50-4240', null, 'Sin sitio web', '4.9★ (7)', 'Capital Federal 644, Eldorado', 'Google Maps'],
  ['ALQUILERES', 'Oberá', 'Cabañas GUACURARI- MALU EVENTOS', 'Cabañas / Eventos', 'LEAD', '03755 31-0526', null, 'Sin sitio web', '4.3★ (353)', 'Oberá, Misiones', 'Google Maps'],
  ['ALQUILERES', 'Oberá', 'Cabañas Oberá', 'Cabañas', 'LEAD', '03755 56-7128', null, 'cabaniasobera.com.ar', '4.5★ (443)', 'Picada Sgto. Cabral 307, Oberá', 'Google Maps'],
  ['ALQUILERES', 'Oberá', 'LA FINCA eventos', 'Salón para eventos', 'LEAD', '03755 15-34-7870', null, 'Sin sitio web', '4.5★ (104)', 'Lote 92 Secc. BI, Picada Ameghino, Oberá', 'Google Maps'],

  // ═══ 4. GIMNASIOS (21) ══════════════════════════════════════════════════
  // Puerto Iguazú (11: Top 5 PILOTO, resto LEAD)
  ['GIMNASIO', 'Puerto Iguazú', 'Cataratas Gym', 'Gimnasio', 'PILOTO', '03757 44-5070', '@cataratasgym.ayala', 'Solo Instagram', '4.4★ (130)', 'Av. Misiones 94, Puerto Iguazú', 'Google Maps'],
  ['GIMNASIO', 'Puerto Iguazú', 'Academia Iguazú Muay Thai', 'Gimnasio (Muay Thai)', 'PILOTO', '03757 15-50-4734', '@iguazumuaythai', 'Solo Instagram', '5.0★ (13)', 'Salto Encantado 549, Puerto Iguazú', 'Google Maps'],
  ['GIMNASIO', 'Puerto Iguazú', 'Atlas Gym Iguazú', 'Gimnasio', 'PILOTO', '03757 51-3324', '@atlas_gym_iguazu', 'Solo Instagram', '4.5★ (6)', 'Julio Silveira 360, Puerto Iguazú', 'Google Maps'],
  ['GIMNASIO', 'Puerto Iguazú', 'Gimnasio BYS Bienestar y Salud', 'Gimnasio', 'PILOTO', '03757 44-5005', '@gimnasiobys', 'Solo Instagram', '5.0★ (3)', 'Ernesto Sabato y Gabriela Mistral, Puerto Iguazú', 'Google Maps'],
  ['GIMNASIO', 'Puerto Iguazú', 'Iguazú Pilates', 'Centro de pilates', 'PILOTO', '0341 652-0296', null, 'Sin sitio web', '4.9★ (15)', 'Salto Dos Hermanas y Vera Peñaloza 1° piso, Puerto Iguazú', 'Google Maps'],
  ['GIMNASIO', 'Puerto Iguazú', 'Academia Junco', 'Gimnasio', 'LEAD', '03757 51-6971', null, 'Sin sitio web', '4.6★ (11)', 'Vera Peñaloza, Puerto Iguazú', 'Google Maps'],
  ['GIMNASIO', 'Puerto Iguazú', 'ATHLOS', 'Centro de yoga', 'LEAD', '03757 57-5778', null, 'Sin sitio web', '4.5★ (8)', 'Perito Moreno 238, Puerto Iguazú', 'Google Maps'],
  ['GIMNASIO', 'Puerto Iguazú', 'ACADEMIA ÉLITE DE KICK BOXING', 'Gimnasio (Kick Boxing)', 'LEAD', '011 3469-8954', '@quique_villalbaa', 'Instagram / Facebook', '5.0★ (4)', 'Hipólito Yrigoyen 861, Puerto Iguazú', 'Google Maps'],
  ['GIMNASIO', 'Puerto Iguazú', 'Ladyfit gym', 'Gimnasio', 'LEAD', '03757 51-8566', null, 'Sin sitio web', '5.0★ (2)', 'Estanislao del Campo, Puerto Iguazú', 'Google Maps'],
  ['GIMNASIO', 'Puerto Iguazú', 'Sport Gym', 'Gimnasio', 'LEAD', '03757 61-5042', '@sport_gym80v', 'Solo Instagram', '5.0★ (1)', 'Puerto Iguazú, Misiones', 'Google Maps'],
  ['GIMNASIO', 'Puerto Iguazú', 'Starval GYM', 'Gimnasio', 'LEAD', null, '@starval.gym', 'Solo Instagram', null, 'Colibri y Tijereta, Puerto Iguazú', 'Google Maps'],
  // Resto de Misiones (10 → LEAD)
  ['GIMNASIO', 'Eldorado', 'Gimnasio Energy', 'Gimnasio', 'LEAD', '03751 66-6761', null, 'Sin sitio web', '4.7★ (137)', 'Talcahuano 1842, Eldorado', 'Google Maps'],
  ['GIMNASIO', 'Eldorado', 'Power Gym', 'Centro de deportes adaptados', 'LEAD', '03751 44-5616', null, 'Sin sitio web', '4.7★ (55)', 'Peteribí 126 km 10, Eldorado', 'Google Maps'],
  ['GIMNASIO', 'Eldorado', 'GIMNASIO FITNESS LIFE', 'Gimnasio', 'LEAD', '03751 50-8596', null, 'fitnesslife.virkana.com/sucursales', '4.6★ (29)', 'Av. San Martín 1621, Eldorado', 'Google Maps'],
  ['GIMNASIO', 'Posadas', 'Balance Centro de Pilates Sede 1', 'Centro de pilates', 'LEAD', '0376 505-7041', '@balance.centrodepilates', 'Solo Instagram', '4.6★ (21)', 'Av. Martín Fierro 3535, Posadas', 'Google Maps'],
  ['GIMNASIO', 'Posadas', 'Pilates City', 'Centro de pilates', 'LEAD', '0376 472-3638', '@pilatescityposadas', 'Solo Instagram', '5.0★ (11)', 'Av. Almte. Brown 3981, Posadas', 'Google Maps'],
  ['GIMNASIO', 'Posadas', 'ESPACIO ANAHATA 1 by Pauli (Villa Cabello)', 'Pilates / Yoga / Funcional', 'LEAD', '0376 493-2412', '@espacio_anahata_by_pauli', 'Solo Instagram', '4.9★ (8)', 'Av. López y Planes 5685, Posadas', 'Google Maps'],
  ['GIMNASIO', 'Posadas', 'Área Pilates by Sport Training', 'Centro de pilates', 'LEAD', '0376 470-9713', null, 'area-pilates.kumaly.io/reservar', '4.8★ (38)', 'Av. Trincheras de San José 2219, Posadas', 'Google Maps'],
  ['GIMNASIO', 'Oberá', 'Fitness Point', 'Gimnasio', 'LEAD', '03755 61-2383', null, 'fitnesspoint.com.ar / Linktree', '4.4★ (112)', 'Sta Fe 511, Oberá', 'Google Maps'],
  ['GIMNASIO', 'Oberá', 'Burpee Training', 'Gimnasio', 'LEAD', '03755 50-9207', null, 'Sin sitio web', '4.9★ (100)', 'Av. Beltrame 1248, Oberá', 'Google Maps'],
  ['GIMNASIO', 'Oberá', 'León Gym', 'Gimnasio', 'LEAD', '03755 15-52-2576', null, 'Solo Facebook', '4.8★ (76)', 'Bartolomé Mitre 1049, Oberá', 'Google Maps'],

  // ═══ 5. POS / MOSTRADOR (22) ═════════════════════════════════════════════
  // Puerto Iguazú (12: Top 5 PILOTO, resto LEAD)
  ['POS', 'Puerto Iguazú', 'HUELLITAS - PETSHOP', 'Pet Shop', 'PILOTO', '03757 32-3694', '@pet_shop_huellitas13', 'Solo Instagram', '4.9★ (16)', 'Juan Bautista Alberdi 545, Puerto Iguazú', 'Google Maps'],
  ['POS', 'Puerto Iguazú', 'Ferreteria Chumi II', 'Ferretería', 'PILOTO', '03757 36-1366', '@ferreteriachumi2', 'Solo Instagram', '4.7★ (118)', 'Los Mecánicos, Puerto Iguazú', 'Google Maps'],
  ['POS', 'Puerto Iguazú', 'VETERINARIA / Cataratas PET SHOP', 'Pet Shop', 'PILOTO', '03757 61-0803', '@comoperrosygatos2305', 'Solo Instagram', '4.9★ (11)', 'Av. Tres Fronteras 243, Puerto Iguazú', 'Google Maps'],
  ['POS', 'Puerto Iguazú', 'Autoservicio Miguelo', 'Mercado / Autoservicio', 'PILOTO', '03757 55-5433', null, 'Sin sitio web', '4.4★ (100)', 'Av. Nestor Kirchner, Puerto Iguazú', 'Google Maps'],
  ['POS', 'Puerto Iguazú', 'MATTEO Vinoteca', 'Tienda de vinos', 'PILOTO', '03757 15-21-4030', null, 'Taplink (taplink.cc/matteomayorista)', '5.0★ (798)', 'Hipólito Yrigoyen y Andresito, Puerto Iguazú', 'Google Maps'],
  ['POS', 'Puerto Iguazú', 'Caminos Wine Boutique - Vinoteca', 'Tienda de bebidas alcohólicas', 'LEAD', '03757 30-2155', null, 'Sin sitio web', '4.9★ (675)', 'Hipólito Yrigoyen 1162, Puerto Iguazú', 'Google Maps'],
  ['POS', 'Puerto Iguazú', 'Eduardo Materiales SRL', 'Ferretería', 'LEAD', '03757 42-1001', null, 'Sin sitio web', '4.4★ (194)', 'Av. República Argentina 840, Puerto Iguazú', 'Google Maps'],
  ['POS', 'Puerto Iguazú', 'Agroferr', 'Ferretería', 'LEAD', '03757 15-52-1782', null, 'Sin sitio web', '4.6★ (85)', 'Av. de los Trabajadores, Puerto Iguazú', 'Google Maps'],
  ['POS', 'Puerto Iguazú', 'Minimercado "La Amistad"', 'Supermercado / Minimercado', 'LEAD', '03757 55-5123', null, 'Sin sitio web', '4.2★ (13)', 'Salto 3 Mosqueteros, Puerto Iguazú', 'Google Maps'],
  ['POS', 'Puerto Iguazú', 'Agropecuaria Pet Show', 'Pet Shop', 'LEAD', '03757 51-3800', null, 'Sin sitio web', '5.0★ (5)', 'Vera Peñaloza, Salto Unión 1984, Puerto Iguazú', 'Google Maps'],
  ['POS', 'Puerto Iguazú', 'Minimarket carnicería 24 horas', 'Carnicería / Minimarket', 'LEAD', '03757 45-4790', null, 'laprimicia24.com', '4.9★ (13)', 'Av. Su Santidad Francisco, Puerto Iguazú', 'Google Maps'],
  ['POS', 'Puerto Iguazú', 'Mimat materiales, Puerto Iguazú', 'Materiales de construcción', 'LEAD', '03757 43-3838', null, 'mimat.com.ar', '4.4★ (279)', 'Obispo Angelelli 26, Puerto Iguazú', 'Google Maps'],
  // Resto de Misiones (10 → LEAD)
  ['POS', 'Posadas', 'Pachamama Colorada - Dietetica', 'Dietética', 'LEAD', '0376 480-9285', '@pachamamacolorada', 'Solo Instagram', '4.7★ (123)', 'Av. Rademacher 2880, Posadas', 'Google Maps'],
  ['POS', 'Posadas', 'Hogar Dietética y Herboristería', 'Dietética y Herboristería', 'LEAD', '0376 428-4422', null, 'Linktree (linktr.ee/hogardietetica)', '4.4★ (87)', 'Buenos Aires 1985, Posadas', 'Google Maps'],
  ['POS', 'Posadas', 'Kumandá Almacén Saludable', 'Dietética', 'LEAD', '0376 473-4499', null, 'Solo Facebook (facebook.com/KumandaDieteticaPosadas/)', '4.5★ (34)', 'Alberdi 1035, Posadas', 'Google Maps'],
  ['POS', 'Posadas', 'Dietetica El Girasol', 'Dietética', 'LEAD', '0376 442-4537', null, 'Sin sitio web', '4.4★ (37)', 'San Lorenzo 2365, Posadas', 'Google Maps'],
  ['POS', 'Eldorado', 'Plasticos Centro', 'Ferretería', 'LEAD', '03751 42-4650', null, 'Sin sitio web', '4.6★ (227)', 'Av. San Martín E 1472, Eldorado', 'Google Maps'],
  ['POS', 'Eldorado', 'Ferreteria Industrial JR Gonzalez S.R.L.', 'Ferretería industrial', 'LEAD', '03751 37-4519', null, 'Sin sitio web', '4.6★ (156)', 'Colcombet 32, Eldorado', 'Google Maps'],
  ['POS', 'Eldorado', 'Ferretería Industrial Lobato', 'Ferretería industrial', 'LEAD', '03751 42-0227', null, 'tiendalobato.com.ar', '4.2★ (104)', 'Av. San Martín 1636, Eldorado', 'Google Maps'],
  ['POS', 'Oberá', 'El Sembrador', 'Veterinario / Pet Shop', 'LEAD', '03755 42-5148', '@elsembrador_petshop', 'Solo Instagram', '4.6★ (283)', 'Av. de Las América 781, Oberá', 'Google Maps'],
  ['POS', 'Oberá', 'Domi. Pet shop Alimentos balanceados.', 'Pet Shop', 'LEAD', '03755 26-6997', null, 'Sin sitio web', '4.9★ (12)', 'Av. José Ingenieros 753, Oberá', 'Google Maps'],
  ['POS', 'Oberá', 'DE TODO UN POCO. Ferretería. Muebleria. Electricidad', 'Ferretería / Varios', 'LEAD', '03755 27-1582', null, 'Sin sitio web', '4.6★ (15)', 'Av. Libertad 622, Oberá', 'Google Maps'],
];

export const LEADS_SEMILLA: LeadSeedRow[] = RAW_LEADS.map(
  ([rubro, localidad, negocio, subrubro, clasificacion, telefono, instagram, webActual, resenas, direccion, fuente]) => {
    const ubic = UBICACION_MISIONES[localidad] ?? { zona: 'Misiones', departamento: localidad };
    return {
      clave: `${rubro.toLowerCase()}::${slugify(localidad)}::${slugify(negocio)}`,
      rubro,
      subrubro,
      clasificacion,
      negocio,
      zona: ubic.zona,
      departamento: ubic.departamento,
      localidad,
      telefono,
      whatsappUrl: normalizarWhatsappUrl(telefono),
      instagram: normalizarInstagram(instagram),
      webActual,
      resenas,
      direccion,
      fuente,
    };
  },
);
