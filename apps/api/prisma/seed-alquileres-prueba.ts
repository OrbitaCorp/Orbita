// ─── Negocios de prueba de Alquileres, solo en la base de DEV ───────────────
//
// Arma un negocio por modo de Alquileres para probar el panel contra la API
// de reservas (tarea del 05/11 del plan de Alquileres, en superadmin →
// Módulos):
//
//   canchas-prueba   Complejo de Prueba   4 canchas por hora, con extras
//   salones-prueba   Salones de Prueba    2 salones por bloque, con paquetes (servicios del salón)
//   cabanas-prueba   Cabañas de Prueba    3 cabañas por noche, con check-in, check-out y noches mínimas
//
// Cada uno con su config de Alquileres, un par de bloqueos y reservas en
// todos los estados entre 90 días atrás y 90 adelante. El rubro va como en
// Turnos: `industry: "alquileres"` y `subrubros: ["canchas" | "salon-cumples" | "cabana"]`.
//
// Se puede correr las veces que haga falta: los negocios y sus dueños se crean
// la primera vez y se reusan; los recursos, servicios, bloqueos y reservas se
// borran y se vuelven a armar alrededor de hoy.
//
// Solo corre contra la base de dev (lo chequea antes de tocar nada, sin
// imprimir la URL). Nunca contra producción.
//
// Uso (desde apps/api, con el .env de dev):
//   ALQUILERES_PRUEBA_PASSWORD='...' pnpm seed:alquileres-prueba
//
// La contraseña es la de los tres dueños (dueno@<slug>.invalid). Hace falta
// la primera vez; pasarla de nuevo la cambia. No se imprime ni se guarda.
// Después: <slug>.orbita.local:3001/panel/alquileres (ver apps/web/src/pages/panel/alquileres.tsx).

process.loadEnvFile?.();

import { randomBytes } from 'node:crypto';
import { PrismaClient, type Prisma, type ReservaEstado } from '@prisma/client';
import * as argon2 from 'argon2';

const DEV_REF = 'hhaqlzrcskmwnvhgydon';
const PROD_REF = 'dgergykdihtvsglfumsb';
const url = process.env.DATABASE_URL ?? '';
if (!url.includes(DEV_REF) || url.includes(PROD_REF)) {
  throw new Error('Este seed solo corre contra la base de dev (el .env de apps/api). No se tocó nada.');
}

const prisma = new PrismaClient();
const MODULO = 'ALQUILERES' as const;
const DIAS = 90;

// ─── Fechas (Argentina, UTC−3 sin horario de verano) ─────────────────────────

const hoyArgentina = () => new Date(Date.now() - 3 * 3600_000).toISOString().slice(0, 10);
const sumarDias = (fecha: string, n: number) => new Date(Date.parse(`${fecha}T00:00:00Z`) + n * 86400_000).toISOString().slice(0, 10);
/** El instante UTC de un minuto del día de Argentina. */
const instante = (fecha: string, minuto: number) => new Date(Date.parse(`${fecha}T00:00:00Z`) + (minuto + 180) * 60_000);
const diaSemana = (fecha: string) => new Date(`${fecha}T12:00:00Z`).getUTCDay();

/** Azar con semilla: cada corrida del mismo día arma lo mismo. */
function azar(semilla: number) {
  let s = semilla >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Inventados. Los teléfonos empiezan con 0000 para que no sean de nadie.
const CLIENTES = [
  'Sofía Ramírez', 'Mateo Díaz', 'Valentina Gómez', 'Lucas Fernández', 'Camila Sosa', 'Benjamín Torres', 'Martina López',
  'Thiago Romero', 'Julieta Ruiz', 'Joaquín Benítez', 'Florencia Acosta', 'Tomás Medina', 'Agustina Castro', 'Nicolás Vera',
  'Paula Giménez', 'Santino Molina', 'Lara Ortiz', 'Facundo Ríos', 'Micaela Herrera', 'Ramiro Paz',
].map((nombre, i) => ({
  nombre,
  telefono: `0000 55-${String(100 + i).padStart(4, '0')}`,
  email: i % 3 === 0 ? `${nombre.split(' ')[0].normalize('NFD').replace(/[^a-zA-Z]/g, '').toLowerCase()}@ejemplo.invalid` : null,
}));

// ─── Los tres negocios ───────────────────────────────────────────────────────

interface Prueba { slug: string; nombre: string; subrubro: string; dueno: string }
const CANCHAS: Prueba = { slug: 'canchas-prueba', nombre: 'Complejo de Prueba', subrubro: 'canchas', dueno: 'Martín Acosta' };
const SALONES: Prueba = { slug: 'salones-prueba', nombre: 'Salones de Prueba', subrubro: 'salon-cumples', dueno: 'Laura Benítez' };
const CABANAS: Prueba = { slug: 'cabanas-prueba', nombre: 'Cabañas de Prueba', subrubro: 'cabana', dueno: 'Carla Rojas' };

const emailDe = (p: Prueba) => `dueno@${p.slug}.invalid`;

async function negocioBase(p: Prueba, password: string | undefined) {
  let negocio = await prisma.business.findUnique({ where: { subdomain: p.slug } });
  if (negocio && negocio.industry !== 'alquileres') {
    throw new Error(`El subdominio ${p.slug} ya es de otro negocio (${negocio.id}). No se toca.`);
  }
  if (!negocio) {
    if (!password) throw new Error('Primera vez: definí ALQUILERES_PRUEBA_PASSWORD (10+ caracteres) para los dueños.');
    const passwordHash = await argon2.hash(password, { type: argon2.argon2id });
    // El dueño tiene todos los permisos que existen, también los de reservas.
    const permisos = await prisma.permission.findMany({ select: { id: true } });
    negocio = await prisma.$transaction(async (tx) => {
      const b = await tx.business.create({
        data: { name: p.nombre, industry: 'alquileres', subrubros: [p.subrubro], subdomain: p.slug, mode: 'FULL', isActive: true, operatesOnline: true },
      });
      await tx.branch.create({ data: { businessId: b.id, name: 'Principal', isDefault: true } });
      const owner = await tx.role.create({ data: { businessId: b.id, name: 'owner', color: '#3B82F6', isDefault: true } });
      await tx.rolePermission.createMany({ data: permisos.map((x) => ({ roleId: owner.id, permissionId: x.id })) });
      await tx.member.create({
        data: { businessId: b.id, name: p.dueno, email: emailDe(p), roleId: owner.id, status: 'ACTIVE', passwordHash, emailVerified: true },
      });
      await tx.businessConfig.create({ data: { businessId: b.id, acceptsMercadopago: false, acceptsCash: true, acceptsTransfer: true, acceptsPickup: false } });
      await tx.storefrontConfig.create({ data: { businessId: b.id, storeName: p.nombre, colorMode: 'light' } });
      return b;
    }, { timeout: 30000 });
    console.log(`${p.slug}: negocio creado.`);
  } else if (password) {
    const passwordHash = await argon2.hash(password, { type: argon2.argon2id });
    await prisma.member.updateMany({ where: { businessId: negocio.id, email: emailDe(p) }, data: { passwordHash, failedLoginAttempts: 0, lockedUntil: null } });
  }

  // Cortesía sin vencimiento práctico y sin tutorial de primeros pasos: es para probar, no para vender.
  const ahora = new Date();
  const lejos = new Date(ahora.getFullYear() + 20, 0, 1);
  await prisma.subscription.upsert({
    where: { businessId: negocio.id },
    update: { status: 'ACTIVE', planActive: true, currentPeriodEnd: lejos },
    create: { businessId: negocio.id, origin: 'COMP', status: 'ACTIVE', amount: 0, currentPeriodStart: ahora, currentPeriodEnd: lejos, grantReason: 'Negocio de prueba de Alquileres (dev)' },
  });
  await prisma.business.update({
    where: { id: negocio.id },
    data: { industry: 'alquileres', subrubros: [p.subrubro], tutorial: { variante: 'checklist', fase: 'terminado', etapa: 2, paso: 0, hechas: [], minimizado: false } },
  });
  return negocio;
}

/** Borra lo de Alquileres del negocio y deja la config como la de la prueba. */
async function deCero(businessId: string, horario: Prisma.InputJsonValue) {
  const donde = { businessId, modulo: MODULO };
  await prisma.$transaction([
    prisma.reserva.deleteMany({ where: donde }), // el historial se va en cascada
    prisma.reservaEspera.deleteMany({ where: donde }),
    prisma.reservaBloqueo.deleteMany({ where: donde }),
    prisma.reservaServicio.deleteMany({ where: donde }),
    prisma.reservaRecurso.deleteMany({ where: donde }),
  ]);
  const reglas = { activo: true, horario, confirmacion: 'AUTOMATICA' as const, retencionMinutos: 15, cancelacionHastaHoras: 48, senaPorcentaje: 30, senaReembolsable: true };
  await prisma.reservaConfig.upsert({ where: { businessId_modulo: donde }, update: reglas, create: { ...donde, ...reglas } });
  return donde;
}

// ─── Una reserva ─────────────────────────────────────────────────────────────

interface Fila {
  recursoId: string; inicio: Date; fin: Date; fecha: string; precio: number;
  servicio?: { id: string; nombre: string; duracionMinutos: number; precio: number }; extras?: { id: string; nombre: string; precio: number }[];
}

const codigos = new Set<string>();

function reserva(donde: { businessId: string; modulo: typeof MODULO }, f: Fila, r: () => number) {
  const ahora = Date.now();
  const pasado = f.fin.getTime() <= ahora;
  const enCurso = f.inicio.getTime() <= ahora && !pasado;
  const p = r();
  const estado: ReservaEstado = enCurso ? 'CONFIRMADA'
    : pasado ? (p < 0.88 ? 'COMPLETADA' : p < 0.93 ? 'AUSENTE' : 'CANCELADA')
      : (p < 0.75 ? 'CONFIRMADA' : p < 0.9 ? 'PENDIENTE' : 'CANCELADA');
  const cliente = CLIENTES[Math.floor(r() * CLIENTES.length)];
  let codigo = '';
  do codigo = Array.from({ length: 6 }, () => 'ABCDEFGHJKLMNPQRSTUVWXYZ'[Math.floor(r() * 24)]).join(''); while (codigos.has(codigo));
  codigos.add(codigo);
  const sena = Math.round(f.precio * 0.3);
  const pagado = estado === 'COMPLETADA' ? f.precio : estado === 'CONFIRMADA' ? sena : 0;
  const creada = new Date(f.inicio.getTime() - (2 + Math.floor(r() * 20)) * 86400_000);
  return {
    ...donde, recursoId: f.recursoId, servicioId: f.servicio?.id ?? null, codigo, tokenAcceso: randomBytes(24).toString('base64url'),
    estado, origen: r() < 0.6 ? 'TIENDA' as const : 'PANEL' as const, inicio: f.inicio, fin: f.fin, fecha: f.fecha, cantidad: 1, exclusivo: true,
    clienteNombre: cliente.nombre, clienteTelefono: cliente.telefono, clienteEmail: cliente.email,
    ...(f.servicio ? { servicio: f.servicio } : {}), ...(f.extras?.length ? { extras: f.extras } : {}),
    precio: f.precio, sena, pagado, pagoMetodo: pagado > 0 ? (r() < 0.5 ? 'EFECTIVO' : 'TRANSFERENCIA') : null,
    confirmadaEn: estado === 'PENDIENTE' || estado === 'CANCELADA' ? null : creada,
    completadaEn: estado === 'COMPLETADA' ? f.fin : null,
    canceladaEn: estado === 'CANCELADA' ? new Date(Math.min(f.inicio.getTime() - 86400_000, ahora)) : null,
    canceladaPor: estado === 'CANCELADA' ? 'CLIENTE' as const : null,
    motivoCancelacion: estado === 'CANCELADA' ? 'Cambio de planes' : null,
    createdAt: creada,
  };
}

// ─── Canchas: por hora ───────────────────────────────────────────────────────

const EXTRAS_CANCHA = [{ id: 'luz', nombre: 'Iluminación', precio: 5000 }, { id: 'pelotas', nombre: 'Pelotas', precio: 3000 }, { id: 'pecheras', nombre: 'Pecheras', precio: 2000 }];
const LAS_CANCHAS = [
  { nombre: 'Cancha 1', detalle: 'Fútbol 5 · césped sintético', precio: 45000, foto: '/turnos/can-hero.jpg' },
  { nombre: 'Cancha 2', detalle: 'Fútbol 5 · techada', precio: 52000, foto: '/turnos/can-partido.jpg' },
  { nombre: 'Pádel 1', detalle: 'Pádel · cristal panorámico', precio: 36000, foto: '/turnos/can-padel.jpg' },
  { nombre: 'Tenis', detalle: 'Tenis · polvo de ladrillo', precio: 28000, foto: '/turnos/can-paletas.jpg' },
];

async function canchas(businessId: string) {
  // Todos los días de 9 a 24 (0 = domingo).
  const horario = Object.fromEntries([0, 1, 2, 3, 4, 5, 6].map((d) => [String(d), [[540, 1440]]]));
  const donde = await deCero(businessId, horario);
  const recursos: { id: string; precio: Prisma.Decimal }[] = [];
  for (const [i, c] of LAS_CANCHAS.entries()) {
    recursos.push(await prisma.reservaRecurso.create({
      data: { ...donde, tipo: 'CANCHA', nombre: c.nombre, descripcion: c.detalle, orden: i, cupo: 1, duracionMinutos: 60, pasoMinutos: 60, maximoSeguidos: 3, precio: c.precio, datos: { extras: EXTRAS_CANCHA, foto: c.foto } },
    }));
  }
  const hoy = hoyArgentina();
  const filas: ReturnType<typeof reserva>[] = [];
  for (let d = -DIAS; d <= DIAS; d++) {
    const fecha = sumarDias(hoy, d);
    const finde = [0, 5, 6].includes(diaSemana(fecha));
    for (const [ri, rec] of recursos.entries()) {
      const r = azar(Number(fecha.replace(/-/g, '')) * 10 + ri);
      const ocupacion = (d > 14 ? 0.15 : 0.3) + (finde ? 0.2 : 0);
      let t = 540;
      while (t < 1440) {
        const horas = r() < 0.25 && t + 120 <= 1440 ? 2 : 1;
        if (r() < ocupacion * (t >= 1080 ? 1.6 : 0.6)) {
          const extras = r() < 0.4 ? [EXTRAS_CANCHA[0]] : [];
          const precio = Number(rec.precio) * horas + extras.reduce((s, e) => s + e.precio, 0);
          filas.push(reserva(donde, { recursoId: rec.id, fecha, inicio: instante(fecha, t), fin: instante(fecha, t + horas * 60), precio, extras }, r));
          t += horas * 60;
        } else t += 60;
      }
    }
  }
  await prisma.reservaBloqueo.createMany({
    data: [
      { ...donde, recursoId: recursos[0].id, inicio: instante(sumarDias(hoy, 3), 0), fin: instante(sumarDias(hoy, 4), 0), motivo: 'Cambio del césped' },
      { ...donde, recursoId: null, inicio: instante(sumarDias(hoy, 12), 0), fin: instante(sumarDias(hoy, 13), 0), motivo: 'Torneo interno' },
    ],
  });
  await prisma.reserva.createMany({ data: filas.filter((f) => !(f.fecha === sumarDias(hoy, 3) && f.recursoId === recursos[0].id) && f.fecha !== sumarDias(hoy, 12)) });
  return { recursos: recursos.length, servicios: 0, bloqueos: 2, reservas: await prisma.reserva.count({ where: donde }) };
}

// ─── Salones: por bloque, con paquetes ───────────────────────────────────────

const LOS_SALONES = [
  { nombre: 'Salón Arcoíris', detalle: 'Pelotero y patio · hasta 60', capacidad: 60, deposito: 50000, paquetes: [
    { nombre: 'Cumple Clásico', precio: 260000, incluye: 'Salón 4 horas\nAnimación\nTorta' },
    { nombre: 'Cumple Completo', precio: 380000, incluye: 'Salón 4 horas\nAnimación\nTorta y mesa dulce\nDJ' },
  ] },
  { nombre: 'Salón Jardín', detalle: 'Parque y quincho · hasta 40', capacidad: 40, deposito: 40000, paquetes: [
    { nombre: 'Solo el salón', precio: 180000, incluye: 'Salón 4 horas\nLimpieza' },
    { nombre: 'Salón con catering', precio: 320000, incluye: 'Salón 4 horas\nCatering para 30' },
  ] },
];

async function salones(businessId: string) {
  // Viernes de 14 a 24, sábados y domingos de 10 a 24.
  const horario = { '5': [[840, 1440]], '6': [[600, 1440]], '0': [[600, 1440]] };
  const donde = await deCero(businessId, horario);
  const recursos: { id: string; precio: Prisma.Decimal }[] = [];
  const servicios = [];
  for (const [i, s] of LOS_SALONES.entries()) {
    const rec = await prisma.reservaRecurso.create({
      data: { ...donde, tipo: 'SALON', nombre: s.nombre, descripcion: s.detalle, orden: i, cupo: 1, duracionMinutos: 240, pasoMinutos: 300, margenMinutos: 60, maximoSeguidos: 1, precio: s.paquetes[0].precio, datos: { capacidad: s.capacidad, deposito: s.deposito, fotos: ['/plantillas/local-salon.jpg', '/plantillas/regalo-globos.jpg'] } },
    });
    recursos.push(rec);
    for (const [j, p] of s.paquetes.entries()) {
      servicios.push(await prisma.reservaServicio.create({
        data: { ...donde, nombre: p.nombre, descripcion: p.incluye, duracionMinutos: 240, precio: p.precio, orden: i * 10 + j, recursoIds: [rec.id] },
      }));
    }
  }
  const hoy = hoyArgentina();
  const filas: ReturnType<typeof reserva>[] = [];
  for (let d = -DIAS; d <= DIAS; d++) {
    const fecha = sumarDias(hoy, d);
    const tramo = (horario as Record<string, number[][]>)[String(diaSemana(fecha))]?.[0];
    if (!tramo) continue;
    for (const [ri, rec] of recursos.entries()) {
      const r = azar(Number(fecha.replace(/-/g, '')) * 10 + ri);
      const paquetes = servicios.filter((_, k) => Math.floor(k / 2) === ri);
      for (let t = tramo[0]; t + 240 <= tramo[1]; t += 300) {
        if (r() < (d > 30 ? 0.3 : 0.6)) {
          const s = paquetes[Math.floor(r() * paquetes.length)];
          const precio = Number(s.precio);
          filas.push(reserva(donde, { recursoId: rec.id, fecha, inicio: instante(fecha, t), fin: instante(fecha, t + 240), precio, servicio: { id: s.id, nombre: s.nombre, duracionMinutos: 240, precio } }, r));
        }
      }
    }
  }
  // Un feriado de todo el negocio, en el primer viernes con más de una semana por delante.
  let feriado = sumarDias(hoy, 8);
  while (diaSemana(feriado) !== 5) feriado = sumarDias(feriado, 1);
  await prisma.reservaBloqueo.createMany({
    data: [
      { ...donde, recursoId: null, inicio: instante(feriado, 0), fin: instante(sumarDias(feriado, 1), 0), motivo: 'Feriado' },
      { ...donde, recursoId: recursos[1].id, inicio: instante(sumarDias(hoy, 20), 0), fin: instante(sumarDias(hoy, 23), 0), motivo: 'Pintura del salón' },
    ],
  });
  const enBloqueo = (f: { fecha: string; recursoId: string }) => f.fecha === feriado || (f.recursoId === recursos[1].id && f.fecha >= sumarDias(hoy, 20) && f.fecha < sumarDias(hoy, 23));
  await prisma.reserva.createMany({ data: filas.filter((f) => !enBloqueo(f)) });
  return { recursos: recursos.length, servicios: servicios.length, bloqueos: 2, reservas: await prisma.reserva.count({ where: donde }) };
}

// ─── Cabañas: por noche ──────────────────────────────────────────────────────

const LAS_CABANAS = [
  { nombre: 'Cabaña Arrayán', precio: 85000, datos: { tipo: 'Cabaña', huespedes: 4, ambientes: 2, camas: 2, banos: 1, comodidades: ['Wi-Fi', 'Aire acondicionado', 'Parrilla', 'Cochera'] } },
  { nombre: 'Cabaña Lapacho', precio: 110000, datos: { tipo: 'Cabaña', huespedes: 6, ambientes: 3, camas: 3, banos: 2, comodidades: ['Wi-Fi', 'Aire acondicionado', 'Pileta', 'Parrilla'] } },
  { nombre: 'Depto Centro', precio: 60000, datos: { tipo: 'Departamento', huespedes: 2, ambientes: 1, camas: 1, banos: 1, comodidades: ['Wi-Fi', 'Aire acondicionado', 'Cocina equipada'] } },
];

async function cabanas(businessId: string) {
  // La estadía no tiene apertura: se entra y se sale a la hora de cada propiedad.
  const donde = await deCero(businessId, {});
  const recursos: { id: string; precio: Prisma.Decimal }[] = [];
  for (const [i, c] of LAS_CABANAS.entries()) {
    recursos.push(await prisma.reservaRecurso.create({
      data: {
        ...donde, tipo: 'ALOJAMIENTO', nombre: c.nombre, descripcion: `${c.datos.tipo} para ${c.datos.huespedes}, a 15 minutos de las Cataratas.`, orden: i, cupo: 1, maximoSeguidos: 1, precio: c.precio,
        datos: { ...c.datos, checkIn: 840, checkOut: 600, nochesMinimas: 2, fotos: ['/plantillas/casa-interior.jpg', '/plantillas/casa-living.jpg'], direccion: 'Av. Tres Fronteras 1450', ciudad: 'Puerto Iguazú', latLng: [-25.5972, -54.5786], modalidad: 'noche', tarifa: { temporadas: [], finDeSemanaPct: 0, limpieza: 15000 } },
      },
    }));
  }
  const hoy = hoyArgentina();
  const filas: ReturnType<typeof reserva>[] = [];
  const bloqueos: Prisma.ReservaBloqueoCreateManyInput[] = [];
  for (const [ri, rec] of recursos.entries()) {
    const r = azar(Number(hoy.replace(/-/g, '')) * 10 + ri);
    let entrada = sumarDias(hoy, -DIAS + Math.floor(r() * 4));
    let bloqueado = false;
    while (entrada < sumarDias(hoy, DIAS)) {
      // Un bloqueo del dueño por propiedad, pasadas las dos semanas.
      if (!bloqueado && entrada > sumarDias(hoy, 14 + ri * 9)) {
        bloqueos.push({ ...donde, recursoId: rec.id, inicio: instante(entrada, 0), fin: instante(sumarDias(entrada, 4), 0), motivo: ri === 0 ? 'Arreglo del techo' : 'Uso del dueño' });
        entrada = sumarDias(entrada, 4 + Math.floor(r() * 3));
        bloqueado = true;
        continue;
      }
      const noches = 2 + Math.floor(r() * 6);
      const salida = sumarDias(entrada, noches);
      filas.push(reserva(donde, { recursoId: rec.id, fecha: entrada, inicio: instante(entrada, 840), fin: instante(salida, 600), precio: Number(rec.precio) * noches }, r));
      // Entre una estadía y otra: a veces se pegan (sale una, entra otra), a veces quedan noches libres.
      entrada = sumarDias(salida, [0, 0, 1, 2, 3, 5][Math.floor(r() * 6)]);
    }
  }
  await prisma.reservaBloqueo.createMany({ data: bloqueos });
  await prisma.reserva.createMany({ data: filas });
  return { recursos: recursos.length, servicios: 0, bloqueos: bloqueos.length, reservas: await prisma.reserva.count({ where: donde }) };
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  const password = process.env.ALQUILERES_PRUEBA_PASSWORD;
  if (password !== undefined && password.length < 10) throw new Error('ALQUILERES_PRUEBA_PASSWORD: 10 caracteres o más.');
  for (const [p, armar] of [[CANCHAS, canchas], [SALONES, salones], [CABANAS, cabanas]] as const) {
    const negocio = await negocioBase(p, password);
    const c = await armar(negocio.id);
    console.log(`${p.slug}: ${c.recursos} recursos, ${c.servicios} paquetes, ${c.bloqueos} bloqueos, ${c.reservas} reservas.`);
  }
  console.log('Listo. Panel: http://<slug>.orbita.local:3001/panel/alquileres (login como dueno@<slug>.invalid).');
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
