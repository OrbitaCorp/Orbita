import {
  LeadClasificacion,
  LeadRubro,
  UBICACION_MISIONES,
  claveLead,
  esPuertoIguazu,
  normalizarInstagram,
  normalizarWhatsappUrl,
  slugifyLead,
} from './leads-seed.data';

export const RUBROS_BUSQUEDA = ['TURNOS', 'ALQUILERES', 'GIMNASIO', 'POS'] as const;
export type RubroBusqueda = (typeof RUBROS_BUSQUEDA)[number];

export const LOCALIDADES_MISIONES_BUSQUEDA = [
  'Puerto Iguazú',
  'Posadas',
  'Oberá',
  'Eldorado',
  'Puerto Rico',
  'San Vicente',
  'Jardín América',
  'Montecarlo',
  'Leandro N. Alem',
  'Apóstoles',
  'Garupá',
  'Aristóbulo del Valle',
  'Puerto Esperanza',
  'Wanda',
  'Puerto Libertad',
  'San Pedro',
  'San Ignacio',
  'Candelaria',
  'El Soberbio',
  'Dos de Mayo',
  'Comandante Andresito',
  'Campo Grande',
  'Capioví',
  'Bernardo de Irigoyen',
] as const;

export const TERMINOS_POR_RUBRO: Record<RubroBusqueda, readonly string[]> = {
  TURNOS: [
    'barberia',
    'peluqueria',
    'centro de estetica',
    'odontologia consultorio dental',
    'kinesiologia fisioterapia',
    'manicura unas',
    'veterinaria',
  ],
  ALQUILERES: [
    'cancha futbol 5',
    'club de padel',
    'salon de eventos',
    'quincho eventos',
    'cabanas alquiler',
    'apart hotel',
  ],
  GIMNASIO: [
    'gimnasio',
    'pilates',
    'crossfit entrenamiento funcional',
    'yoga estudio',
    'boxeo artes marciales',
  ],
  POS: [
    'ferreteria',
    'pet shop alimentos mascotas',
    'dietetica',
    'vinoteca bebidas',
    'minimercado autoservicio',
    'bazar libreria',
  ],
};

export interface ConsultaPlanificada {
  claveConsulta: string;
  rubro: RubroBusqueda;
  localidad: string;
  termino: string;
  pagina: number;
}

const HUBS_PRIORITARIOS = 6;

const FRAGMENTOS_EXTRANJEROS_O_OTRA_PROVINCIA = [
  'brasil',
  'brazil',
  'paraguay',
  'foz do iguacu',
  'ciudad del este',
  'encarnacion',
  'presidente franco',
  'hernandarias',
  'capanema',
  'dionisio cerqueira',
  'barracao',
  'santa helena',
  'alto parana',
  'itapua',
  'parana, br',
  'ituzaingo, corrientes',
  'santo tome',
  'governador virasoro',
  'gdor. virasoro',
  'provincia de corrientes',
  ', corrientes',
  'corrientes, argentina',
  ', buenos aires',
  ', caba',
  ', cordoba',
  ', santa fe',
  ', entre rios',
  ', chaco',
  ', formosa',
  ', tucuman',
  ', salta',
  ', mendoza',
];

const CADENAS_E_INSTITUCIONES_EXCLUIDAS = [
  'carrefour',
  'coto ',
  'changomas',
  'chango mas',
  'hiper libertad',
  'california supermercados',
  'supermercados dia',
  'supermercado dia',
  'makro',
  'fravega',
  'musimundo',
  'cetrogar',
  'garbarino',
  'megatone',
  'coppel',
  'mcdonald',
  'burger king',
  'starbucks',
  'mostaza',
  'ypf',
  'shell ',
  'axion ',
  'puma energy',
  'refinor',
  'banco nacion',
  'banco macro',
  'banco galicia',
  'banco santander',
  'bbva',
  'hsbc',
  'banco provincia',
  'anses',
  'afip',
  'municipalidad',
  'ministerio de',
  'policia de',
  'gendarmeria',
  'prefectura naval',
  'escuela ',
  'colegio ',
  'universidad nacional',
  'hospital publico',
  'hospital samic',
  'hospital escuela',
  'farmacity',
  'dr. ahorro',
];

function fold(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

export function claveConsultaBusqueda(
  rubro: RubroBusqueda,
  localidad: string,
  termino: string,
  pagina = 1,
): string {
  return `${rubro.toLowerCase()}::${slugifyLead(localidad)}::${slugifyLead(termino)}::p${pagina}`;
}

function localidadesOrdenadasPorRubro(rubroIdx: number): string[] {
  const hubs = LOCALIDADES_MISIONES_BUSQUEDA.slice(0, HUBS_PRIORITARIOS);
  const resto = LOCALIDADES_MISIONES_BUSQUEDA.slice(HUBS_PRIORITARIOS);
  const rotacion = (rubroIdx * 4) % resto.length;
  const restoRotado = [...resto.slice(rotacion), ...resto.slice(0, rotacion)];
  return [...hubs, ...restoRotado];
}

export function generarPlanBusquedas(
  rubroFiltro: RubroBusqueda | 'TODOS' = 'TODOS',
  localidadFiltro?: string,
): ConsultaPlanificada[] {
  const rubros: readonly RubroBusqueda[] =
    rubroFiltro === 'TODOS' ? RUBROS_BUSQUEDA : [rubroFiltro];

  const colasPorRubro = rubros.map((rubro) => {
    const rubroIdx = RUBROS_BUSQUEDA.indexOf(rubro);
    const locs = localidadFiltro?.trim()
      ? [localidadFiltro.trim()]
      : localidadesOrdenadasPorRubro(Math.max(0, rubroIdx));
    const terminos = TERMINOS_POR_RUBRO[rubro];
    const items: ConsultaPlanificada[] = [];
    for (const termino of terminos) {
      for (const localidad of locs) {
        items.push({
          claveConsulta: claveConsultaBusqueda(rubro, localidad, termino, 1),
          rubro,
          localidad,
          termino,
          pagina: 1,
        });
      }
    }
    return items;
  });

  const plan: ConsultaPlanificada[] = [];
  const maxLen = Math.max(0, ...colasPorRubro.map((c) => c.length));
  for (let i = 0; i < maxLen; i += 1) {
    for (const cola of colasPorRubro) {
      if (i < cola.length) plan.push(cola[i]);
    }
  }
  return plan;
}

export function esTelefonoExtranjero(phone?: string | null): boolean {
  if (!phone) return false;
  const trimmed = phone.trim();
  const digits = trimmed.replace(/\D/g, '');
  if (!digits) return false;
  if (trimmed.startsWith('+55') || trimmed.startsWith('+595')) return true;
  if (digits.startsWith('55') && !digits.startsWith('54') && digits.length >= 11) return true;
  if (digits.startsWith('595') && digits.length >= 11) return true;
  return false;
}

export function esWhatsappArgentinoValido(whatsappUrl: string | null): boolean {
  if (!whatsappUrl) return false;
  const m = whatsappUrl.match(/^https:\/\/wa\.me\/549(\d+)$/);
  if (!m) return false;
  const local = m[1];
  if (local.startsWith('800') || local.startsWith('810')) return false;
  return local.length >= 9 && local.length <= 11;
}

export function esDeMisionesArgentina(
  address?: string | null,
  phone?: string | null,
  targetLocalidad?: string,
): boolean {
  if (esTelefonoExtranjero(phone)) return false;

  const addr = fold(address ?? '');
  if (!addr) {
    // Si no hay dirección, solo aceptamos si el teléfono tiene característica real de Misiones/Argentina.
    const wa = normalizarWhatsappUrl(phone);
    return esWhatsappArgentinoValido(wa) && /\b(3757|3755|3751|3743|3754|3756|3758|376)\b/.test(phone ?? '');
  }

  for (const frag of FRAGMENTOS_EXTRANJEROS_O_OTRA_PROVINCIA) {
    if (addr.includes(frag) && !addr.includes('misiones')) {
      return false;
    }
  }
  if (
    addr.includes('foz do iguacu') ||
    addr.includes('ciudad del este') ||
    addr.includes('encarnacion') ||
    addr.includes('presidente franco') ||
    addr.includes('hernandarias') ||
    addr.includes('capanema') ||
    addr.includes('dionisio cerqueira') ||
    addr.includes('barracao') ||
    addr.includes('santa helena') ||
    addr.includes('alto parana') ||
    addr.includes('itapua')
  ) {
    return false;
  }
  if (!addr.includes('misiones') && (addr.includes('brasil') || addr.includes('brazil') || addr.includes('paraguay'))) {
    return false;
  }

  if (addr.includes('misiones')) return true;
  if (/\bn?33\d{2}\b/.test(addr)) return true;

  if (targetLocalidad && addr.includes(fold(targetLocalidad)) && addr.includes('argentina')) {
    return true;
  }

  for (const loc of Object.keys(UBICACION_MISIONES)) {
    const lf = fold(loc);
    if (lf.length >= 5 && addr.includes(lf) && addr.includes('argentina')) {
      return true;
    }
  }
  return false;
}

const LOCALIDADES_ORDENADAS_MATCH = Object.keys(UBICACION_MISIONES).sort((a, b) => b.length - a.length);

export function detectarLocalidadReal(address: string | null | undefined, fallbackLocalidad: string): string {
  const addr = fold(address ?? '');
  if (!addr) return fallbackLocalidad;

  for (const loc of LOCALIDADES_ORDENADAS_MATCH) {
    const lf = fold(loc);
    const rx = new RegExp(`(?:^|[\\s,\\d-])${lf.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:$|[\\s,])`);
    if (rx.test(addr)) return loc;
  }

  if (/\biguazu\b/.test(addr) && !addr.includes('foz')) return 'Puerto Iguazú';
  if (/\bandresito\b/.test(addr)) return 'Comandante Andresito';
  if (/\birigoyen\b/.test(addr)) return 'Bernardo de Irigoyen';
  if (/\balem\b/.test(addr)) return 'Leandro N. Alem';
  if (/\baristobulo\b/.test(addr)) return 'Aristóbulo del Valle';

  return fallbackLocalidad;
}

export function esCadenaOInstitucionExcluida(title: string, category?: string | null): boolean {
  const texto = ` ${fold(title)} ${fold(category ?? '')} `;
  return CADENAS_E_INSTITUCIONES_EXCLUIDAS.some((patron) => texto.includes(patron));
}

export function extraerWebEInstagram(website?: string | null): {
  instagram: string | null;
  webActual: string;
} {
  if (!website) return { instagram: null, webActual: 'Sin sitio web' };
  const limpio = website.trim();
  if (!limpio) return { instagram: null, webActual: 'Sin sitio web' };

  const igPath = limpio.match(/instagram\.com\/([^/?#\s]+)/i);
  if (igPath) {
    const seg = igPath[1].toLowerCase();
    const reservados = new Set(['p', 'reel', 'reels', 'stories', 'explore', 'tv', 'accounts']);
    if (!reservados.has(seg)) {
      const ig = normalizarInstagram(limpio);
      if (ig) return { instagram: ig, webActual: 'Solo Instagram' };
    }
  }

  const fbMatch = limpio.match(/(?:https?:\/\/)?(?:www\.)?(facebook\.com\/[^?#\s]+)/i);
  if (fbMatch) {
    return { instagram: null, webActual: `Solo Facebook (${fbMatch[1].slice(0, 160)})` };
  }

  const linkMatch = limpio.match(/(?:https?:\/\/)?(?:www\.)?((?:linktr\.ee|taplink\.cc|beacons\.ai|wa\.me)\/[^?#\s]+)/i);
  if (linkMatch) {
    return { instagram: null, webActual: linkMatch[1].slice(0, 180) };
  }

  const sinProto = limpio.replace(/^https?:\/\/(?:www\.)?/i, '').replace(/\/+$/, '');
  return { instagram: null, webActual: sinProto.slice(0, 180) || 'Sin sitio web' };
}

export function clasificarLeadAutomatico(_rubro: LeadRubro, localidad: string): LeadClasificacion {
  return esPuertoIguazu(localidad) ? 'POTENCIAL_LOCAL' : 'LEAD';
}

export function formatearResenas(rating?: number | null, ratingCount?: number | null): string | null {
  if (typeof rating !== 'number' || Number.isNaN(rating) || rating <= 0) return null;
  const rTxt = rating.toFixed(1);
  if (typeof ratingCount === 'number' && ratingCount > 0) {
    return `${rTxt}★ (${Math.round(ratingCount)})`;
  }
  return `${rTxt}★`;
}

export function claveNombreLocalidad(rubro: string, localidad: string, negocio: string): string {
  return claveLead(rubro as LeadRubro, localidad, negocio);
}
