// ─── Negocio de prueba de Turnos, solo en la base de DEV ────────────────────
//
// Arma una barbería con Turnos configurado para probar el panel de Turnos
// contra la API de reservas (tarea del 05/11 del plan de Turnos, en
// superadmin → Módulos): config del módulo, tres barberos, los servicios de la
// barbería de la demo y unas 500 reservas entre dos semanas atrás y dos
// adelante, con todos los estados que el panel muestra.
//
// Va como lo decidió Mateo el 15/11: el rubro en lo que ya existe del negocio,
// `industry: "turnos"` y `subrubros: ["barberia"]`.
//
// Se puede correr las veces que haga falta: el negocio y el dueño se crean la
// primera vez y se reusan; las agendas, los servicios y las reservas se borran
// y se vuelven a armar alrededor de hoy, así "hoy" siempre tiene turnos.
//
// Solo corre contra la base de dev (lo chequea antes de tocar nada, sin
// imprimir la URL). Nunca contra producción.
//
// Uso (desde apps/api, con el .env de dev):
//   TURNOS_PRUEBA_PASSWORD='...' pnpm seed:turnos-prueba
//
// La contraseña es la del dueño (login con EMAIL_DUENO en orbita.local:3001/login).
// Hace falta la primera vez; pasarla de nuevo la cambia. No se imprime ni se guarda.
// Después: turnos-prueba.orbita.local:3001/panel/turnos (ver apps/web/src/pages/panel/turnos.tsx).

process.loadEnvFile?.();

import { randomBytes } from 'node:crypto';
import { Prisma, PrismaClient, type ReservaEstado } from '@prisma/client';
import * as argon2 from 'argon2';

const DEV_REF = 'hhaqlzrcskmwnvhgydon';
const PROD_REF = 'dgergykdihtvsglfumsb';
const url = process.env.DATABASE_URL ?? '';
if (!url.includes(DEV_REF) || url.includes(PROD_REF)) {
  throw new Error('Este seed solo corre contra la base de dev (el .env de apps/api). No se tocó nada.');
}

const prisma = new PrismaClient();

const SLUG = 'turnos-prueba';
const NOMBRE = 'Barbería de Prueba';
// Dominio .invalid (RFC 2606): ningún mail sale. El email de un member es único en toda la plataforma.
const EMAIL_DUENO = 'dueno@turnos-prueba.invalid';
const MODULO = 'TURNOS' as const;

// Minutos de Argentina, 0 = domingo: lunes a sábado de 9 a 13 y de 16 a 20 (la semana de la demo).
const PARTIDO = [[540, 780], [960, 1200]];
const HORARIO = Object.fromEntries([1, 2, 3, 4, 5, 6].map((d) => [String(d), PARTIDO]));
const SOLO_TARDE = Object.fromEntries([1, 2, 3, 4, 5, 6].map((d) => [String(d), [[960, 1200]]]));

const BARBEROS = [
  { nombre: 'Martín Ríos', color: '#3B82F6', horario: null },
  { nombre: 'Lucas Ferreyra', color: '#8B5CF6', horario: null },
  // Atiende solo a la tarde: prueba el horario propio de una agenda.
  { nombre: 'Nico Álvarez', color: '#10B981', horario: SOLO_TARDE },
];

const SERVICIOS = [
  { nombre: 'Corte clásico', duracion: 30, precio: 12000 },
  { nombre: 'Corte + barba', duracion: 45, precio: 16500 },
  { nombre: 'Perfilado de barba', duracion: 20, precio: 7000 },
  { nombre: 'Afeitado con toalla caliente', duracion: 30, precio: 9500 },
  { nombre: 'Corte infantil', duracion: 25, precio: 9000 },
];

// Inventados. Los teléfonos empiezan con 0000 para que no sean de nadie.
const CLIENTES = [
  'Juan Pérez', 'Tomás Gómez', 'Diego Fernández', 'Matías López', 'Santiago Díaz', 'Facundo Romero', 'Agustín Sosa',
  'Franco Torres', 'Joaquín Ruiz', 'Bruno Medina', 'Ignacio Castro', 'Emiliano Vera', 'Lautaro Molina', 'Gonzalo Paz',
].map((nombre, i) => ({
  nombre,
  telefono: `11 0000-${String(100 + i).padStart(4, '0')}`,
  email: i % 3 === 0 ? `${nombre.split(' ')[0].normalize('NFD').replace(/[^a-zA-Z]/g, '').toLowerCase()}@ejemplo.invalid` : null,
}));

// Azar con semilla: cada corrida del mismo día arma la misma agenda.
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

/** Hoy en Argentina (UTC−3, sin horario de verano), como AAAA-MM-DD. */
function hoyArgentina(): string {
  return new Date(Date.now() - 3 * 3600_000).toISOString().slice(0, 10);
}
const sumarDias = (fecha: string, n: number) => new Date(Date.parse(`${fecha}T00:00:00Z`) + n * 86400_000).toISOString().slice(0, 10);
/** El instante UTC de un minuto del día de Argentina. */
const instante = (fecha: string, minuto: number) => new Date(Date.parse(`${fecha}T00:00:00Z`) + (minuto + 180) * 60_000);
const diaSemana = (fecha: string) => new Date(`${fecha}T12:00:00Z`).getUTCDay();

async function negocioBase() {
  let negocio = await prisma.business.findUnique({ where: { subdomain: SLUG } });
  if (negocio && negocio.industry !== 'turnos') {
    throw new Error(`El subdominio ${SLUG} ya es de otro negocio (${negocio.id}). No se toca.`);
  }
  const password = process.env.TURNOS_PRUEBA_PASSWORD;
  if (password !== undefined && password.length < 10) throw new Error('TURNOS_PRUEBA_PASSWORD: 10 caracteres o más.');

  if (!negocio) {
    if (!password) throw new Error('Primera vez: definí TURNOS_PRUEBA_PASSWORD (10+ caracteres) para el dueño.');
    const passwordHash = await argon2.hash(password, { type: argon2.argon2id });
    // El dueño tiene todos los permisos que existen, también los de reservas (los crea su migración).
    const permisos = await prisma.permission.findMany({ select: { id: true } });
    negocio = await prisma.$transaction(async (tx) => {
      const b = await tx.business.create({
        data: { name: NOMBRE, industry: 'turnos', subrubros: ['barberia'], subdomain: SLUG, mode: 'FULL', isActive: true, operatesOnline: true },
      });
      await tx.branch.create({ data: { businessId: b.id, name: 'Principal', isDefault: true } });
      const owner = await tx.role.create({ data: { businessId: b.id, name: 'owner', color: '#3B82F6', isDefault: true } });
      await tx.rolePermission.createMany({ data: permisos.map((p) => ({ roleId: owner.id, permissionId: p.id })) });
      await tx.member.create({
        data: { businessId: b.id, name: 'Martín Ríos', email: EMAIL_DUENO, roleId: owner.id, status: 'ACTIVE', passwordHash, emailVerified: true },
      });
      await tx.businessConfig.create({ data: { businessId: b.id, acceptsMercadopago: false, acceptsCash: true, acceptsTransfer: true, acceptsPickup: false } });
      await tx.storefrontConfig.create({ data: { businessId: b.id, storeName: NOMBRE, colorMode: 'light' } });
      return b;
    }, { timeout: 30000 });
    console.log(`Negocio de prueba creado: ${negocio.id}`);
  } else if (password) {
    const passwordHash = await argon2.hash(password, { type: argon2.argon2id });
    await prisma.member.updateMany({
      where: { businessId: negocio.id, email: EMAIL_DUENO },
      data: { passwordHash, failedLoginAttempts: 0, lockedUntil: null },
    });
    console.log('Contraseña del dueño actualizada.');
  }

  // Cortesía sin vencimiento práctico y sin tutorial de primeros pasos: es para probar, no para vender.
  const ahora = new Date();
  const lejos = new Date(ahora.getFullYear() + 20, 0, 1);
  await prisma.subscription.upsert({
    where: { businessId: negocio.id },
    update: { status: 'ACTIVE', planActive: true, currentPeriodEnd: lejos },
    create: { businessId: negocio.id, origin: 'COMP', status: 'ACTIVE', amount: 0, currentPeriodStart: ahora, currentPeriodEnd: lejos, grantReason: 'Negocio de prueba de Turnos (dev)' },
  });
  await prisma.business.update({
    where: { id: negocio.id },
    data: { industry: 'turnos', subrubros: ['barberia'], tutorial: { variante: 'checklist', fase: 'terminado', etapa: 2, paso: 0, hechas: [], minimizado: false } },
  });
  return negocio;
}

async function turnos(businessId: string) {
  // De cero: lo de Turnos de este negocio se borra y se arma de nuevo alrededor de hoy.
  const donde = { businessId, modulo: MODULO };
  await prisma.$transaction([
    prisma.reserva.deleteMany({ where: donde }), // el historial se va en cascada
    prisma.reservaEspera.deleteMany({ where: donde }),
    prisma.reservaBloqueo.deleteMany({ where: donde }),
    prisma.reservaServicio.deleteMany({ where: donde }),
    prisma.reservaRecurso.deleteMany({ where: donde }),
  ]);

  // Cada corrida deja las reglas como de fábrica y sin `datos` (equipo, grilla y reglas extra del
  // panel): lo que se probó antes no se arrastra.
  const reglas = {
    activo: true, horario: HORARIO, confirmacion: 'AUTOMATICA' as const, retencionMinutos: 10, anticipacionMinimaMinutos: 60, anticipacionMaximaDias: 60,
    cancelacionHastaHoras: 24, reprogramacionHastaHoras: 24, reprogramacionesMaximas: 2, senaPorcentaje: 0, senaReembolsable: true,
    maximoActivasPorCliente: 2, listaDeEspera: true, margenMinutos: 0,
  };
  await prisma.reservaConfig.upsert({
    where: { businessId_modulo: donde },
    update: { ...reglas, datos: Prisma.DbNull },
    create: { ...donde, ...reglas },
  });

  const dueno = await prisma.member.findFirst({ where: { businessId, email: EMAIL_DUENO }, select: { id: true } });
  const recursos = [];
  for (const [i, b] of BARBEROS.entries()) {
    recursos.push(await prisma.reservaRecurso.create({
      data: {
        ...donde, tipo: 'PROFESIONAL', nombre: b.nombre, orden: i, cupo: 1,
        ...(b.horario ? { horario: b.horario } : {}),
        // rolId: el rol del equipo que el panel guarda en la agenda (la primera es la del dueño).
        datos: { rol: 'Barbero', color: b.color, rolId: i === 0 ? 'dueno' : 'profesional' },
        ...(i === 0 && dueno ? { memberId: dueno.id } : {}),
      },
    }));
  }
  const servicios = [];
  for (const [i, s] of SERVICIOS.entries()) {
    servicios.push(await prisma.reservaServicio.create({
      data: { ...donde, nombre: s.nombre, duracionMinutos: s.duracion, precio: s.precio, orden: i },
    }));
  }

  const hoy = hoyArgentina();
  const ahora = Date.now();
  const codigos = new Set<string>();
  const filas = [];
  for (let d = -14; d <= 14; d++) {
    const fecha = sumarDias(hoy, d);
    const dow = diaSemana(fecha);
    for (const [ri, recurso] of recursos.entries()) {
      const tramos = ((BARBEROS[ri].horario ?? HORARIO) as Record<string, number[][]>)[String(dow)] ?? [];
      const r = azar(Number(fecha.replace(/-/g, '')) * 10 + ri);
      // Más lleno cerca de hoy que lejos en el futuro, como una agenda de verdad.
      const ocupacion = d > 7 ? 0.35 : d > 2 ? 0.55 : 0.75;
      for (const [desde, hasta] of tramos) {
        let t = desde;
        while (t < hasta) {
          const s = servicios[Math.floor(r() * servicios.length)];
          const fin = t + s.duracionMinutos;
          if (fin > hasta) break;
          if (r() < ocupacion) {
            const inicio = instante(fecha, t);
            const termina = instante(fecha, fin);
            const pasado = termina.getTime() <= ahora;
            const enCurso = inicio.getTime() <= ahora && !pasado;
            const p = r();
            const estado: ReservaEstado = enCurso ? 'CONFIRMADA'
              : pasado ? (p < 0.85 ? 'COMPLETADA' : p < 0.93 ? 'AUSENTE' : 'CANCELADA')
                : (p < 0.8 ? 'CONFIRMADA' : p < 0.92 ? 'PENDIENTE' : 'CANCELADA');
            const cliente = CLIENTES[Math.floor(r() * CLIENTES.length)];
            let codigo = '';
            do codigo = Array.from({ length: 6 }, () => 'ABCDEFGHJKLMNPQRSTUVWXYZ'[Math.floor(r() * 24)]).join(''); while (codigos.has(codigo));
            codigos.add(codigo);
            const precio = Number(s.precio);
            const creada = new Date(inicio.getTime() - (1 + Math.floor(r() * 6)) * 86400_000);
            filas.push({
              ...donde, recursoId: recurso.id, servicioId: s.id, codigo, tokenAcceso: randomBytes(24).toString('base64url'),
              estado, origen: r() < 0.7 ? 'TIENDA' as const : 'PANEL' as const, inicio, fin: termina, fecha, cantidad: 1, exclusivo: true,
              clienteNombre: cliente.nombre, clienteTelefono: cliente.telefono, clienteEmail: cliente.email,
              servicio: { id: s.id, nombre: s.nombre, duracionMinutos: s.duracionMinutos, precio },
              precio, sena: 0, pagado: estado === 'COMPLETADA' ? precio : 0, pagoMetodo: estado === 'COMPLETADA' ? (r() < 0.6 ? 'EFECTIVO' : 'TRANSFERENCIA') : null,
              confirmadaEn: estado === 'PENDIENTE' || estado === 'CANCELADA' ? null : creada,
              completadaEn: estado === 'COMPLETADA' ? termina : null,
              canceladaEn: estado === 'CANCELADA' ? new Date(Math.min(inicio.getTime() - 3600_000, ahora)) : null,
              canceladaPor: estado === 'CANCELADA' ? 'CLIENTE' as const : null,
              motivoCancelacion: estado === 'CANCELADA' ? 'No llega' : null,
              createdAt: creada,
            });
          }
          // Entre turno y turno, a veces un rato libre.
          t = fin + [0, 0, 5, 15][Math.floor(r() * 4)];
        }
      }
    }
  }
  await prisma.reserva.createMany({ data: filas });
  const hoyCuenta = filas.filter((f) => f.fecha === hoy).length;
  console.log(`Turnos: ${recursos.length} agendas, ${servicios.length} servicios, ${filas.length} reservas (${hoyCuenta} hoy, ${hoy}).`);
}

async function main() {
  const negocio = await negocioBase();
  await turnos(negocio.id);
  console.log(`Listo. Panel: http://${SLUG}.orbita.local:3001/panel/turnos (login como ${EMAIL_DUENO}).`);
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
