#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');

const SEED_TS = path.join(ROOT, 'apps/api/src/marketing/leads/leads-seed.data.ts');
const EXPANSION_TS = path.join(ROOT, 'apps/api/src/marketing/leads/leads-expansion.data.ts');
const REGISTRO_JSON = path.join(ROOT, 'apps/api/data/leads-misiones-registro.json');
const MIGRATIONS_DIR = path.join(ROOT, 'apps/api/prisma/migrations');

const RUBROS_BUSQUEDA = ['TURNOS', 'ALQUILERES', 'GIMNASIO', 'POS'];

const LOCALIDADES_MISIONES_BUSQUEDA = [
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
];

const UBICACION_MISIONES = {
  'Puerto Iguazú': { zona: 'Norte', departamento: 'Iguazú' },
  'Puerto Esperanza': { zona: 'Norte', departamento: 'Iguazú' },
  Wanda: { zona: 'Norte', departamento: 'Iguazú' },
  'Puerto Libertad': { zona: 'Norte', departamento: 'Iguazú' },
  'Comandante Andresito': { zona: 'Norte', departamento: 'General Manuel Belgrano' },
  'Bernardo de Irigoyen': { zona: 'Norte', departamento: 'General Manuel Belgrano' },
  Eldorado: { zona: 'Norte', departamento: 'Eldorado' },
  Montecarlo: { zona: 'Norte', departamento: 'Montecarlo' },
  'San Pedro': { zona: 'Norte', departamento: 'San Pedro' },
  'Puerto Rico': { zona: 'Centro-Norte', departamento: 'Libertador Gral. San Martín' },
  Capioví: { zona: 'Centro-Norte', departamento: 'Libertador Gral. San Martín' },
  Garuhapé: { zona: 'Centro-Norte', departamento: 'Libertador Gral. San Martín' },
  'Jardín América': { zona: 'Centro', departamento: 'San Ignacio' },
  'San Ignacio': { zona: 'Centro', departamento: 'San Ignacio' },
  Oberá: { zona: 'Centro', departamento: 'Oberá' },
  'Aristóbulo del Valle': { zona: 'Centro', departamento: 'Cainguás' },
  'Campo Grande': { zona: 'Centro', departamento: 'Cainguás' },
  'Campo Viera': { zona: 'Centro', departamento: 'Oberá' },
  '25 de Mayo': { zona: 'Centro', departamento: '25 de Mayo' },
  'San Vicente': { zona: 'Centro-Este', departamento: 'Guaraní' },
  'El Soberbio': { zona: 'Centro-Este', departamento: 'Guaraní' },
  'Dos de Mayo': { zona: 'Centro-Este', departamento: 'Cainguás' },
  Posadas: { zona: 'Sur', departamento: 'Capital' },
  Garupá: { zona: 'Sur', departamento: 'Capital' },
  Candelaria: { zona: 'Sur', departamento: 'Candelaria' },
  'Leandro N. Alem': { zona: 'Sur', departamento: 'Leandro N. Alem' },
  Apóstoles: { zona: 'Sur', departamento: 'Apóstoles' },
  'San Javier': { zona: 'Sur', departamento: 'San Javier' },
  'Concepción de la Sierra': { zona: 'Sur', departamento: 'Concepción' },
};

const TERMINOS_POR_RUBRO = {
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

const AREA_CODES = ['3757', '3755', '3751', '3743', '3754', '3756', '3758', '2657', '376', '341', '11'];

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

function fold(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

function slugifyLead(s) {
  return fold(s)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function claveLead(rubro, localidad, negocio) {
  return `${rubro.toLowerCase()}::${slugifyLead(localidad)}::${slugifyLead(negocio)}`;
}

function claveConsultaBusqueda(rubro, localidad, termino, pagina = 1) {
  return `${rubro.toLowerCase()}::${slugifyLead(localidad)}::${slugifyLead(termino)}::p${pagina}`;
}

function esPuertoIguazu(localidad) {
  return fold(localidad) === 'puerto iguazu';
}

function normalizarWhatsappUrl(telefono) {
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

function esTelefonoExtranjero(phone) {
  if (!phone) return false;
  const trimmed = phone.trim();
  const digits = trimmed.replace(/\D/g, '');
  if (!digits) return false;
  if (trimmed.startsWith('+55') || trimmed.startsWith('+595')) return true;
  if (digits.startsWith('55') && !digits.startsWith('54') && digits.length >= 11) return true;
  if (digits.startsWith('595') && digits.length >= 11) return true;
  return false;
}

function esWhatsappArgentinoValido(whatsappUrl) {
  if (!whatsappUrl) return false;
  const m = whatsappUrl.match(/^https:\/\/wa\.me\/549(\d+)$/);
  if (!m) return false;
  const local = m[1];
  if (local.startsWith('800') || local.startsWith('810')) return false;
  return local.length >= 9 && local.length <= 11;
}

function normalizarInstagram(ig) {
  if (!ig) return null;
  const limpio = ig.trim();
  if (!limpio || limpio === '—') return null;
  const urlMatch = limpio.match(/instagram\.com\/([A-Za-z0-9._]+)/i);
  const handle = (urlMatch ? urlMatch[1] : limpio).replace(/^@+/, '').replace(/\/+$/, '').toLowerCase();
  if (!handle || !/^[a-z0-9._]{1,30}$/.test(handle)) return null;
  return `@${handle}`;
}

function extraerWebEInstagram(website) {
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

function esDeMisionesArgentina(address, phone, targetLocalidad) {
  if (esTelefonoExtranjero(phone)) return false;
  const addr = fold(address || '');
  if (!addr) {
    const wa = normalizarWhatsappUrl(phone);
    return esWhatsappArgentinoValido(wa) && /\b(3757|3755|3751|3743|3754|3756|3758|376)\b/.test(phone || '');
  }
  for (const frag of FRAGMENTOS_EXTRANJEROS_O_OTRA_PROVINCIA) {
    if (addr.includes(frag) && !addr.includes('misiones')) return false;
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
  if (targetLocalidad && addr.includes(fold(targetLocalidad)) && addr.includes('argentina')) return true;
  for (const loc of Object.keys(UBICACION_MISIONES)) {
    const lf = fold(loc);
    if (lf.length >= 5 && addr.includes(lf) && addr.includes('argentina')) return true;
  }
  return false;
}

const LOCALIDADES_ORDENADAS_MATCH = Object.keys(UBICACION_MISIONES).sort((a, b) => b.length - a.length);

function detectarLocalidadReal(address, fallbackLocalidad) {
  const addr = fold(address || '');
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

function esCadenaOInstitucionExcluida(title, category) {
  const texto = ` ${fold(title)} ${fold(category || '')} `;
  return CADENAS_E_INSTITUCIONES_EXCLUIDAS.some((patron) => texto.includes(patron));
}

function formatearResenas(rating, ratingCount) {
  if (typeof rating !== 'number' || Number.isNaN(rating) || rating <= 0) return null;
  const rTxt = rating.toFixed(1);
  if (typeof ratingCount === 'number' && ratingCount > 0) return `${rTxt}★ (${Math.round(ratingCount)})`;
  return `${rTxt}★`;
}

function localidadesOrdenadasPorRubro(rubroIdx) {
  const hubs = LOCALIDADES_MISIONES_BUSQUEDA.slice(0, 6);
  const resto = LOCALIDADES_MISIONES_BUSQUEDA.slice(6);
  const rotacion = (rubroIdx * 4) % resto.length;
  return [...hubs, ...resto.slice(rotacion), ...resto.slice(0, rotacion)];
}

function generarPlanBusquedas(rubroFiltro = 'TODOS', localidadFiltro) {
  const rubros = rubroFiltro === 'TODOS' ? RUBROS_BUSQUEDA : [rubroFiltro];
  const colas = rubros.map((rubro) => {
    const rubroIdx = RUBROS_BUSQUEDA.indexOf(rubro);
    const locs = localidadFiltro ? [localidadFiltro] : localidadesOrdenadasPorRubro(Math.max(0, rubroIdx));
    const lista = [];
    for (const termino of TERMINOS_POR_RUBRO[rubro]) {
      for (const localidad of locs) {
        lista.push({
          claveConsulta: claveConsultaBusqueda(rubro, localidad, termino, 1),
          rubro,
          localidad,
          termino,
          pagina: 1,
        });
      }
    }
    return lista;
  });

  const plan = [];
  const maxLen = Math.max(0, ...colas.map((c) => c.length));
  for (let i = 0; i < maxLen; i += 1) {
    for (const cola of colas) {
      if (i < cola.length) plan.push(cola[i]);
    }
  }
  return plan;
}

function leerClavesEnv() {
  const env = { ...process.env };
  const candidatos = [
    path.join(ROOT, 'apps/api/.env'),
    'c:\\Users\\Mateo\\Desktop\\Orbita\\Orbita-Frontend\\apps\\api\\.env',
  ];
  for (const p of candidatos) {
    if (!fs.existsSync(p)) continue;
    for (const line of fs.readFileSync(p, 'utf8').split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq === -1) continue;
      const k = trimmed.slice(0, eq).trim();
      const v = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
      if (!env[k] && v) env[k] = v;
    }
  }
  return [env.SERPER_API_KEY, env.SERPER_API_KEY_RESPALDO].filter(Boolean);
}

function cargarSemillaInicial() {
  const src = fs.readFileSync(SEED_TS, 'utf8');
  const m = src.match(/const RAW_LEADS:\s*RawRow\[\]\s*=\s*(\[[\s\S]*?\n\]);/);
  if (!m) throw new Error('No se encontró RAW_LEADS en leads-seed.data.ts');
  const rawRows = vm.runInNewContext(m[1], Object.create(null));
  return rawRows.map(([rubro, localidad, negocio, subrubro, clasificacion, telefono, instagram, webActual, resenas, direccion, fuente]) => {
    const ubic = UBICACION_MISIONES[localidad] ?? { zona: 'Misiones', departamento: localidad };
    return {
      clave: claveLead(rubro, localidad, negocio),
      placeId: null,
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
      origen: 'semilla',
    };
  });
}

function guardarRegistro(registro) {
  registro.updatedAt = new Date().toISOString();
  fs.mkdirSync(path.dirname(REGISTRO_JSON), { recursive: true });
  fs.writeFileSync(REGISTRO_JSON, JSON.stringify(registro, null, 2) + '\n', 'utf8');
}

function emitirExpansionTs(registro) {
  const nuevas = registro.leads.filter((l) => l.origen !== 'semilla');
  const lineas = nuevas.map((l) => {
    const arr = [
      l.rubro,
      l.localidad,
      l.negocio,
      l.subrubro,
      l.clasificacion === 'PILOTO' ? 'POTENCIAL_LOCAL' : l.clasificacion,
      l.telefono ?? null,
      l.instagram ?? null,
      l.webActual ?? null,
      l.resenas ?? null,
      l.direccion ?? null,
      l.fuente ?? 'Google Maps auto',
      l.placeId ?? null,
    ];
    return `  ${JSON.stringify(arr)},`;
  });

  const contenido = `// Generado automáticamente por scripts/buscar-leads-misiones.mjs — contiene los leads descubiertos fuera de la semilla inicial.
export type RawExpansionRow = readonly [
  rubro: 'TIENDA' | 'TURNOS' | 'ALQUILERES' | 'GIMNASIO' | 'POS',
  localidad: string,
  negocio: string,
  subrubro: string,
  clasificacion: 'POTENCIAL_LOCAL' | 'LEAD',
  telefono: string | null,
  instagram: string | null,
  webActual: string | null,
  resenas: string | null,
  direccion: string | null,
  fuente: string,
  placeId: string | null,
];

export const RAW_LEADS_EXPANSION: RawExpansionRow[] = [
${lineas.join('\n')}
];
`;
  fs.writeFileSync(EXPANSION_TS, contenido, 'utf8');
  console.log(`TS generado: ${EXPANSION_TS} (${nuevas.length} filas de expansión)`);
}

function sqlVal(v) {
  if (v === null || v === undefined) return 'NULL';
  if (typeof v === 'number') return String(v);
  if (typeof v === 'boolean') return v ? 'TRUE' : 'FALSE';
  return `'${String(v).replace(/'/g, "''")}'`;
}

function emitirMigracionSql(registro, nombreMigracion) {
  const dir = path.join(MIGRATIONS_DIR, nombreMigracion);
  fs.mkdirSync(dir, { recursive: true });
  const nuevas = registro.leads.filter((l) => l.origen !== 'semilla');
  const busquedas = Object.values(registro.busquedasRealizadas || {});

  const partes = [
    `-- Migración idempotente generada por scripts/buscar-leads-misiones.mjs (${new Date().toISOString()})`,
    `-- Inserta ${nuevas.length} leads de expansión y ${busquedas.length} checkpoints de búsqueda sin duplicar ni pisar existentes.`,
    '',
  ];

  if (nuevas.length > 0) {
    partes.push(
      'INSERT INTO "marketing_leads" ("id", "clave", "place_id", "rubro", "subrubro", "clasificacion", "negocio", "zona", "departamento", "localidad", "telefono", "whatsapp_url", "instagram", "web_actual", "resenas", "direccion", "fuente", "contactado", "estado", "updated_at") VALUES',
    );
    const valuesLeads = nuevas.map((l) => {
      const clasif = l.clasificacion === 'PILOTO' ? 'POTENCIAL_LOCAL' : l.clasificacion;
      return `  (${sqlVal(crypto.randomUUID())}, ${sqlVal(l.clave)}, ${sqlVal(l.placeId)}, ${sqlVal(l.rubro)}, ${sqlVal(l.subrubro)}, ${sqlVal(clasif)}, ${sqlVal(l.negocio)}, ${sqlVal(l.zona)}, ${sqlVal(l.departamento)}, ${sqlVal(l.localidad)}, ${sqlVal(l.telefono)}, ${sqlVal(l.whatsappUrl)}, ${sqlVal(l.instagram)}, ${sqlVal(l.webActual)}, ${sqlVal(l.resenas)}, ${sqlVal(l.direccion)}, ${sqlVal(l.fuente)}, FALSE, 'NUEVO', CURRENT_TIMESTAMP)`;
    });
    partes.push(valuesLeads.join(',\n'));
    partes.push('ON CONFLICT DO NOTHING;');
    partes.push('');
  }

  if (busquedas.length > 0) {
    partes.push(
      'INSERT INTO "marketing_lead_busquedas" ("id", "clave_consulta", "rubro", "localidad", "termino", "pagina", "fuente", "encontrados", "nuevos", "duplicados", "ejecutado_por") VALUES',
    );
    const valuesBusq = busquedas.map(
      (b) =>
        `  (${sqlVal(crypto.randomUUID())}, ${sqlVal(b.claveConsulta)}, ${sqlVal(b.rubro)}, ${sqlVal(b.localidad)}, ${sqlVal(b.termino)}, ${sqlVal(b.pagina ?? 1)}, ${sqlVal(b.fuente ?? 'serper_maps')}, ${sqlVal(b.encontrados ?? 0)}, ${sqlVal(b.nuevos ?? 0)}, ${sqlVal(b.duplicados ?? 0)}, ${sqlVal(b.ejecutadoPor ?? 'CLI')})`,
    );
    partes.push(valuesBusq.join(',\n'));
    partes.push('ON CONFLICT ("clave_consulta") DO NOTHING;');
    partes.push('');
  }

  const outPath = path.join(dir, 'migration.sql');
  fs.writeFileSync(outPath, partes.join('\n'), 'utf8');
  console.log(`Migración SQL generada: ${outPath}`);
}

async function consultarSerper(consulta, keys) {
  const q = `${consulta.termino} ${consulta.localidad} Misiones Argentina`;
  let lastErr;
  for (let i = 0; i < keys.length; i += 1) {
    const res = await fetch('https://google.serper.dev/maps', {
      method: 'POST',
      headers: { 'X-API-KEY': keys[i], 'Content-Type': 'application/json' },
      body: JSON.stringify({ q, gl: 'ar', hl: 'es' }),
    });
    if (res.ok) {
      const data = await res.json();
      return Array.isArray(data.places) ? data.places : [];
    }
    lastErr = new Error(`HTTP ${res.status}: ${(await res.text().catch(() => '')).slice(0, 140)}`);
    if (!((res.status === 401 || res.status === 402 || res.status === 429) && i < keys.length - 1)) {
      throw lastErr;
    }
  }
  throw lastErr;
}

function parseArgs(argv) {
  const args = { rubro: 'TODOS', localidad: undefined, maxQueries: 20, force: false, emitTs: false, emitMigration: null, dryRun: false };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--rubro') args.rubro = argv[++i] || 'TODOS';
    else if (a === '--localidad') args.localidad = argv[++i];
    else if (a === '--max-queries') args.maxQueries = Number(argv[++i] || 20);
    else if (a === '--force') args.force = true;
    else if (a === '--emit-ts') args.emitTs = true;
    else if (a === '--emit-migration') args.emitMigration = argv[++i];
    else if (a === '--dry-run') args.dryRun = true;
  }
  return args;
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  let registro;
  if (fs.existsSync(REGISTRO_JSON)) {
    registro = JSON.parse(fs.readFileSync(REGISTRO_JSON, 'utf8'));
  } else {
    registro = {
      version: 1,
      updatedAt: new Date().toISOString(),
      busquedasRealizadas: {},
      leads: cargarSemillaInicial(),
    };
    guardarRegistro(registro);
    console.log(`Registro inicializado desde semilla con ${registro.leads.length} leads.`);
  }

  // Asegurar que toda la semilla esté presente sin duplicados
  const dedup = {
    claves: new Set(),
    placeIds: new Set(),
    waPorRubro: new Map(),
    igPorRubro: new Map(),
    nomPorRubro: new Map(),
  };
  const getBucket = (m, k) => {
    if (!m.has(k)) m.set(k, new Set());
    return m.get(k);
  };
  for (const l of registro.leads) {
    if (l.clave) dedup.claves.add(l.clave);
    if (l.placeId) dedup.placeIds.add(l.placeId);
    if (l.whatsappUrl) getBucket(dedup.waPorRubro, l.rubro).add(l.whatsappUrl);
    if (l.instagram) getBucket(dedup.igPorRubro, l.rubro).add(l.instagram.toLowerCase());
    getBucket(dedup.nomPorRubro, l.rubro).add(claveLead(l.rubro, l.localidad, l.negocio));
  }

  const plan = generarPlanBusquedas(opts.rubro, opts.localidad);
  const hechas = registro.busquedasRealizadas || {};
  const candidatas = opts.force ? plan : plan.filter((c) => !hechas[c.claveConsulta]);
  const seleccionadas = candidatas.slice(0, Math.max(0, opts.maxQueries));

  console.log(`Plan total: ${plan.length} | Ya hechas: ${plan.length - candidatas.length} | Por correr ahora: ${seleccionadas.length}`);

  if (opts.dryRun) {
    for (const c of seleccionadas) console.log(`  DRY-RUN: ${c.claveConsulta} -> "${c.termino} ${c.localidad}"`);
    return;
  }

  const keys = leerClavesEnv();
  if (seleccionadas.length > 0 && keys.length === 0) {
    throw new Error('No se encontró SERPER_API_KEY en el entorno ni en apps/api/.env');
  }

  let totalNuevos = 0;
  let totalDup = 0;

  for (let idx = 0; idx < seleccionadas.length; idx += 1) {
    const c = seleccionadas[idx];
    const places = await consultarSerper(c, keys);
    let nuevosQ = 0;
    let dupQ = 0;
    const bWa = getBucket(dedup.waPorRubro, c.rubro);
    const bIg = getBucket(dedup.igPorRubro, c.rubro);
    const bNom = getBucket(dedup.nomPorRubro, c.rubro);

    for (const p of places) {
      const negocio = p.title?.trim();
      if (!negocio) continue;
      const subrubro = (p.category ?? p.type ?? p.types?.[0] ?? c.termino).trim().slice(0, 110);
      if (esCadenaOInstitucionExcluida(negocio, subrubro)) continue;
      if (!esDeMisionesArgentina(p.address, p.phoneNumber, c.localidad)) continue;

      const localidad = detectarLocalidadReal(p.address, c.localidad);
      const telefono = p.phoneNumber?.trim() || null;
      const waRaw = normalizarWhatsappUrl(telefono);
      const whatsappUrl = esWhatsappArgentinoValido(waRaw) ? waRaw : null;
      const { instagram, webActual } = extraerWebEInstagram(p.website);

      if (!esPuertoIguazu(localidad) && !whatsappUrl && !instagram) continue;

      const placeId = p.placeId?.trim() || (p.cid?.trim() ? `cid:${p.cid.trim()}` : null);
      const clave = claveLead(c.rubro, localidad, negocio);
      const claveAlt = claveLead(c.rubro, c.localidad, negocio);

      if (
        dedup.claves.has(clave) ||
        dedup.claves.has(claveAlt) ||
        (placeId && dedup.placeIds.has(placeId)) ||
        (whatsappUrl && bWa.has(whatsappUrl)) ||
        (instagram && bIg.has(instagram.toLowerCase())) ||
        bNom.has(clave)
      ) {
        dupQ += 1;
        continue;
      }

      dedup.claves.add(clave);
      if (placeId) dedup.placeIds.add(placeId);
      if (whatsappUrl) bWa.add(whatsappUrl);
      if (instagram) bIg.add(instagram.toLowerCase());
      bNom.add(clave);

      const ubic = UBICACION_MISIONES[localidad] ?? { zona: 'Misiones', departamento: localidad };
      registro.leads.push({
        clave,
        placeId,
        rubro: c.rubro,
        subrubro,
        clasificacion: esPuertoIguazu(localidad) ? 'POTENCIAL_LOCAL' : 'LEAD',
        negocio: negocio.slice(0, 155),
        zona: ubic.zona,
        departamento: ubic.departamento,
        localidad,
        telefono,
        whatsappUrl,
        instagram,
        webActual,
        resenas: formatearResenas(p.rating, p.ratingCount),
        direccion: p.address?.trim().slice(0, 235) || null,
        fuente: 'Google Maps auto (Ola 1)',
        origen: 'expansion',
      });
      nuevosQ += 1;
    }

    registro.busquedasRealizadas[c.claveConsulta] = {
      claveConsulta: c.claveConsulta,
      rubro: c.rubro,
      localidad: c.localidad,
      termino: c.termino,
      pagina: c.pagina,
      fuente: 'serper_maps',
      encontrados: places.length,
      nuevos: nuevosQ,
      duplicados: dupQ,
      ejecutadoPor: 'CLI (Ola)',
      ejecutadoAt: new Date().toISOString(),
    };
    guardarRegistro(registro);
    totalNuevos += nuevosQ;
    totalDup += dupQ;
    console.log(`[${idx + 1}/${seleccionadas.length}] ${c.claveConsulta} -> enc=${places.length}, nuevos=${nuevosQ}, dup=${dupQ}`);
  }

  console.log(`\nRESUMEN OLA: nuevos=${totalNuevos}, duplicados=${totalDup}, total en registro=${registro.leads.length}`);

  if (opts.emitTs) emitirExpansionTs(registro);
  if (opts.emitMigration) emitirMigracionSql(registro, opts.emitMigration);
}

main().catch((err) => {
  console.error('ERROR:', err);
  process.exit(1);
});
