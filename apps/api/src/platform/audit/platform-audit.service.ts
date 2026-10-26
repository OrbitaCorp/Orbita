import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, PlatformAuditArea, PlatformAuditEstado, PlatformAuditSeveridad } from '@prisma/client';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { AUDIT_SEED, SeedItem, SeedQuien, SeedTarea } from './audit-seed';
import { CreateAuditItemDto, UpdateAuditItemDto } from './dto/audit-item.dto';

// Auditoría interna (super admin → Auditoría). Todo cross-tenant y protegido
// por PlatformAdminGuard en el controller. Ver PlatformAuditItem en
// schema.prisma para el modelo y audit-seed.ts para la lista base.

export interface AuditCheck {
  id: string;
  texto: string;
  hecho: boolean;
  // Solo en los planes de Módulos (modulo.<slug>.plan): cada check es una
  // tarea diaria. Ver modulos-seed.ts y la pestaña Módulos del super admin.
  dia?: string;
  quien?: string;
  criterio?: string;
  semana?: number;
  semana1m?: number | null;
  // Key de la entrada de auditoría (auditoria.<slug>.*) que documenta la
  // tarea. Puede estar sin `hecho`: documentada en la sesión, falta que su
  // responsable la confirme. Sin entrada no hay tarea hecha (actualizar()).
  auditoria?: string;
}

// Los planes de Módulos y sus entradas de auditoría viven en la misma tabla
// pero no son parte del inventario: el tablero general, su resumen y el
// documento PDF los dejan afuera. El front usa el mismo criterio (Modulos.tsx).
export function esDeModulos(key: string): boolean {
  return key.startsWith('modulo.') || key.startsWith('auditoria.');
}

export function sinModulos<T extends { key: string }>(items: T[]): T[] {
  return items.filter((i) => !esDeModulos(i.key));
}

const PREFIJO_PLAN = 'modulo.';
const PREFIJO_ENTRADA = 'auditoria.';
const RE_DIA = /^\d{4}-\d{2}-\d{2}$/;

// La cuenta de cargo de cada uno, por si no tiene una con su nombre: Ale
// entra con la del CPO, Mateo es el CEO y Alan el CTO (los mismos cargos que
// la página Nosotros de la landing). Hoy en dev no hay cuenta personal de
// Mateo ni de Ale, así que sin esto sus planes quedaban sin responsable.
export const CUENTA_POR_CARGO: Record<SeedQuien, string> = {
  Ale: 'cpo@orbita-corp.com',
  Mateo: 'ceo@orbita-corp.com',
  Alan: 'cto@orbita-corp.com',
};

const sinAcentos = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

// De un nombre de pila ("Ale") a un admin activo. Nada de "el nombre lo
// contiene": "Ale" caería en "Valeria". Primero un admin con una palabra del
// nombre que EMPIECE así ("Alexander Ibarra"), sin distinguir mayúsculas ni
// acentos; si no hay, la cuenta de su cargo por email; si tampoco, null y se
// asigna a mano desde el tablero.
export function elegirResponsable(nombre: string, admins: { id: string; name: string; email: string }[]): string | null {
  const buscado = sinAcentos(nombre.trim());
  if (!buscado) return null;
  const porNombre = admins.find((a) => sinAcentos(a.name).split(/[^a-z0-9]+/).some((p) => p.startsWith(buscado)));
  if (porNombre) return porNombre.id;
  const cuenta = (CUENTA_POR_CARGO as Record<string, string | undefined>)[nombre.trim()];
  const porCargo = cuenta ? admins.find((a) => a.email.trim().toLowerCase() === cuenta) : undefined;
  return porCargo?.id ?? null;
}

const ADMIN_SELECT = { select: { id: true, name: true } } as const;

const ITEM_INCLUDE = {
  responsable: ADMIN_SELECT,
  hechoPor: ADMIN_SELECT,
  actualizadoPor: ADMIN_SELECT,
  decisionPor: ADMIN_SELECT,
} as const;

type ItemConInclude = Prisma.PlatformAuditItemGetPayload<{ include: typeof ITEM_INCLUDE }>;

// Los checks viven en un Json: se normalizan al leer para que el front nunca
// reciba algo con forma rara aunque alguien haya tocado la fila a mano.
export function normalizarChecks(raw: unknown): AuditCheck[] {
  if (!Array.isArray(raw)) return [];
  const out: AuditCheck[] = [];
  for (const c of raw) {
    if (!c || typeof c !== 'object') continue;
    const { id, texto, hecho, dia, quien, criterio, semana, semana1m, auditoria } = c as Record<string, unknown>;
    if (typeof id !== 'string' || typeof texto !== 'string') continue;
    const check: AuditCheck = { id, texto, hecho: hecho === true };
    // Los campos de tarea se conservan solo si vienen con el tipo correcto:
    // un `dia` que no sea fecha o una `semana` en string romperían el plan en
    // el front, así que se descartan como si no estuvieran.
    if (typeof dia === 'string' && RE_DIA.test(dia)) check.dia = dia;
    if (typeof quien === 'string' && quien.trim()) check.quien = quien;
    if (typeof criterio === 'string' && criterio.trim()) check.criterio = criterio;
    if (typeof semana === 'number' && Number.isInteger(semana)) check.semana = semana;
    if (semana1m === null || (typeof semana1m === 'number' && Number.isInteger(semana1m))) check.semana1m = semana1m;
    if (typeof auditoria === 'string' && auditoria.trim()) check.auditoria = auditoria;
    out.push(check);
  }
  return out;
}

export function checksDesdeSeed(item: Pick<SeedItem, 'checks' | 'checksHechos' | 'tareas'>): AuditCheck[] {
  const hecho = item.checksHechos === true;
  // Un plan de Módulos: cada tarea es un check con sus campos (ids t1, t2…).
  // Una tarea que se hizo en la sesión trae la key de su entrada pero nace
  // sin tildar: queda "documentada, falta confirmar" hasta que su
  // responsable la tilde en Módulos.
  if (item.tareas?.length) {
    return item.tareas.map((t, i) => ({
      id: `t${i + 1}`, texto: t.texto, hecho,
      dia: t.dia, quien: t.quien, criterio: t.criterio, semana: t.semana, semana1m: t.semana1m,
      ...(t.auditoria ? { auditoria: t.auditoria } : {}),
    }));
  }
  return item.checks.map((texto, i) => ({ id: `c${i + 1}`, texto, hecho }));
}

// Un plan que ya existía no recibe solo los links nuevos del seed
// (asegurarSeed nunca pisa un ítem). Esto completa SOLO las tareas sin
// entrada y cuyo texto coincide con el del seed: los ids t1, t2… son por
// posición, y si la lista cambió es mejor no adivinar. No toca lo tildado ni
// un link puesto desde Módulos. null = no hay nada que completar.
export function completarLinks(checks: AuditCheck[], tareas: Pick<SeedTarea, 'texto' | 'auditoria'>[]): AuditCheck[] | null {
  let cambio = false;
  const out = checks.map((c) => {
    const m = /^t(\d+)$/.exec(c.id);
    const t = m ? tareas[Number(m[1]) - 1] : undefined;
    if (!t?.auditoria || c.auditoria || t.texto !== c.texto) return c;
    cambio = true;
    return { ...c, auditoria: t.auditoria };
  });
  return cambio ? out : null;
}

@Injectable()
export class PlatformAuditService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Lectura ───────────────────────────────────────────────────────────────

  async listar() {
    await this.asegurarSeed();
    const [items, admins] = await Promise.all([
      this.prisma.platformAuditItem.findMany({ orderBy: [{ orden: 'asc' }, { createdAt: 'asc' }], include: ITEM_INCLUDE }),
      this.prisma.platformAdmin.findMany({ where: { isActive: true }, orderBy: { name: 'asc' }, select: { id: true, name: true } }),
    ]);
    const filas = items.map((i) => this.serializar(i));
    // Se devuelven todos (Módulos los necesita), pero los números del tablero
    // general no cambian por los planes ni por sus entradas.
    return { items: filas, resumen: resumir(sinModulos(filas)), admins };
  }

  // Crea los ítems del seed que todavía no existen (por key). Nunca toca los
  // que ya están: lo que cargó el equipo es la fuente de verdad. La única
  // excepción es sumarle a una tarea de plan el link a su entrada cuando no lo
  // tenía (completarLinks), que no pisa nada.
  async asegurarSeed() {
    const existentes = await this.prisma.platformAuditItem.findMany({ select: { key: true } });
    const keys = new Set(existentes.map((e) => e.key));
    const faltan = AUDIT_SEED.map((item, orden) => ({ item, orden })).filter(({ item }) => !keys.has(item.key));
    if (faltan.length === 0) return 0;
    const responsables = await this.resolverResponsables(faltan.map(({ item }) => item.responsable));
    await this.prisma.platformAuditItem.createMany({
      data: faltan.map(({ item, orden }) => ({
        key: item.key,
        area: item.area as PlatformAuditArea,
        grupo: item.grupo,
        titulo: item.titulo,
        ruta: item.ruta ?? null,
        foco: item.foco,
        severidad: (item.severidad ?? null) as PlatformAuditSeveridad | null,
        estado: (item.estado ?? 'PENDIENTE') as PlatformAuditEstado,
        checks: checksDesdeSeed(item) as unknown as Prisma.InputJsonValue,
        orden,
        informeUrl: item.informeUrl ?? null,
        notas: item.notas ?? null,
        // Las entradas de Módulos generadas en sesión llegan con su informe
        // (qué se hizo, archivos, capturas): ver modulos-entradas.ts.
        informe: item.informe ?? null,
        hechoAt: item.estado === 'HECHO' ? new Date() : null,
        responsableId: item.responsable ? (responsables.get(item.responsable) ?? null) : null,
      })),
      skipDuplicates: true,
    });
    // Solo cuando se creó algo: las entradas nuevas del seed llegan con un
    // deploy, y es ahí cuando un plan que ya existía puede necesitar su link.
    await this.completarLinksDePlanes(keys);
    return faltan.length;
  }

  private async completarLinksDePlanes(existentes: Set<string>) {
    const planes = AUDIT_SEED.filter((i) => existentes.has(i.key) && i.tareas?.some((t) => t.auditoria));
    if (planes.length === 0) return;
    const filas = await this.prisma.platformAuditItem.findMany({
      where: { key: { in: planes.map((p) => p.key) } }, select: { id: true, key: true, checks: true },
    });
    for (const fila of filas) {
      const tareas = planes.find((p) => p.key === fila.key)?.tareas;
      const nuevos = tareas ? completarLinks(normalizarChecks(fila.checks), tareas) : null;
      if (nuevos) await this.prisma.platformAuditItem.update({ where: { id: fila.id }, data: { checks: nuevos as unknown as Prisma.InputJsonValue } });
    }
  }

  // Los planes de Módulos y sus entradas traen el responsable por nombre de
  // pila ("Ale"); elegirResponsable explica cómo se busca. Una sola consulta
  // de admins para todos los nombres, y solo si algún ítem nuevo lo necesita.
  private async resolverResponsables(nombres: (string | undefined)[]): Promise<Map<string, string>> {
    const out = new Map<string, string>();
    const buscados = Array.from(new Set(nombres.filter((n): n is string => !!n)));
    if (buscados.length === 0) return out;
    const admins = await this.prisma.platformAdmin.findMany({
      where: { isActive: true }, orderBy: { name: 'asc' }, select: { id: true, name: true, email: true },
    });
    for (const nombre of buscados) {
      const id = elegirResponsable(nombre, admins);
      if (id) out.set(nombre, id);
    }
    return out;
  }

  // ── Escritura ─────────────────────────────────────────────────────────────

  async actualizar(adminId: string, id: string, dto: UpdateAuditItemDto) {
    const actual = await this.prisma.platformAuditItem.findUnique({ where: { id } });
    if (!actual) throw new NotFoundException('Ítem de auditoría no encontrado');

    if (dto.responsableId) {
      const admin = await this.prisma.platformAdmin.findUnique({ where: { id: dto.responsableId }, select: { isActive: true } });
      if (!admin || !admin.isActive) throw new BadRequestException('Ese responsable no existe o está inactivo');
    }

    let checks = normalizarChecks(actual.checks);
    if (dto.checks) {
      const toggles = new Map(dto.checks.map((c) => [c.id, c]));
      const esPlan = actual.key.startsWith(PREFIJO_PLAN);
      if (esPlan) {
        // En un plan de Módulos una tarea hecha es una tarea documentada: para
        // tildarla hace falta una entrada auditoria.<slug>.* que exista, la
        // que trae el toggle o la que la tarea ya tenía. Un toggle con
        // `auditoria` y hecho: false solo la vincula (la entrada la cargó otro
        // y falta que el responsable confirme). Los ids que no están en el
        // ítem se ignoran, como siempre, así que tampoco se validan.
        const porId = new Map(checks.map((c) => [c.id, c]));
        const aValidar = dto.checks
          .filter((t) => porId.has(t.id) && (t.hecho || t.auditoria))
          .map((t) => t.auditoria ?? porId.get(t.id)!.auditoria);
        await this.exigirEntradasDeAuditoria(aValidar);
      }
      checks = checks.map((c) => {
        const t = toggles.get(c.id);
        if (!t) return c;
        if (!esPlan) return { ...c, hecho: t.hecho };
        // Destildar conserva la entrada: lo documentado no se pierde.
        return { ...c, hecho: t.hecho, ...(t.auditoria ? { auditoria: t.auditoria.trim() } : {}) };
      });
    }
    if (dto.nuevosChecks?.length) {
      for (const texto of dto.nuevosChecks) checks.push({ id: `u${randomUUID().slice(0, 8)}`, texto: texto.trim(), hecho: false });
    }

    const data: Prisma.PlatformAuditItemUpdateInput = {
      checks: checks as unknown as Prisma.InputJsonValue,
      actualizadoPor: { connect: { id: adminId } },
    };
    if (dto.responsableId !== undefined) {
      data.responsable = dto.responsableId ? { connect: { id: dto.responsableId } } : { disconnect: true };
    }
    if (dto.informeUrl !== undefined) data.informeUrl = dto.informeUrl?.trim() || null;
    if (dto.notas !== undefined) data.notas = dto.notas?.trim() || null;
    if (dto.informe !== undefined) data.informe = dto.informe?.trim() || null;

    // La decisión viaja siempre con quién la tomó y cuándo: sin eso, leer el
    // tablero después no sirve para nada (no se sabe si opinó Mateo o Ale).
    // Volver a null limpia los tres campos de una: es un "me retracto".
    if (dto.decision !== undefined) {
      data.decision = dto.decision;
      if (dto.decision === null) {
        data.decisionPor = { disconnect: true };
        data.decisionAt = null;
        data.decisionNota = null;
      } else {
        data.decisionPor = { connect: { id: adminId } };
        data.decisionAt = new Date();
      }
    }
    // La nota se puede editar sin volver a elegir la decisión, pero no se
    // guarda si el ítem quedó sin decisión (el bloque de arriba ya la borró).
    if (dto.decisionNota !== undefined && dto.decision !== null) {
      data.decisionNota = dto.decisionNota?.trim() || null;
    }

    if (dto.estado && dto.estado !== actual.estado) {
      data.estado = dto.estado;
      if (dto.estado === 'HECHO') {
        data.hechoPor = { connect: { id: adminId } };
        data.hechoAt = new Date();
      } else if (actual.estado === 'HECHO') {
        data.hechoPor = { disconnect: true };
        data.hechoAt = null;
      }
    }

    const [item] = await this.prisma.$transaction([
      this.prisma.platformAuditItem.update({ where: { id }, data, include: ITEM_INCLUDE }),
      this.prisma.platformAdminLog.create({
        data: {
          adminId,
          action: 'audit_item_update',
          targetType: 'audit_item',
          targetId: id,
          details: {
            key: actual.key,
            titulo: actual.titulo,
            ...(dto.estado && dto.estado !== actual.estado ? { estado: dto.estado } : {}),
            ...(dto.responsableId !== undefined ? { responsableId: dto.responsableId } : {}),
            ...(dto.informeUrl !== undefined ? { informeUrl: dto.informeUrl } : {}),
            ...(dto.informe !== undefined ? { informe: dto.informe ? `${dto.informe.trim().length} caracteres` : null } : {}),
            ...(dto.checks?.length ? { checks: dto.checks.map((c) => ({ id: c.id, hecho: c.hecho, ...(c.auditoria ? { auditoria: c.auditoria } : {}) })) } : {}),
            ...(dto.nuevosChecks?.length ? { nuevosChecks: dto.nuevosChecks.length } : {}),
            ...(dto.decision !== undefined ? { decision: dto.decision } : {}),
          } as Prisma.InputJsonObject,
        },
      }),
    ]);
    return this.serializar(item);
  }

  async crear(adminId: string, dto: CreateAuditItemDto) {
    // Las entradas de Módulos (auditoria.<slug>.*) traen su propia key para
    // que el plan pueda apuntarlas; el resto sigue siendo custom.<uuid>. El
    // DTO ya limita los espacios de nombres permitidos.
    const key = dto.key?.trim() || `custom.${randomUUID()}`;
    if (dto.key) {
      const existe = await this.prisma.platformAuditItem.findUnique({ where: { key }, select: { id: true } });
      if (existe) throw new BadRequestException(`Ya existe un ítem con la key ${key}`);
    }
    // Una entrada de Módulos nace con el responsable de la tarea (quien la
    // hizo): misma validación que al reasignar desde el tablero.
    if (dto.responsableId) {
      const admin = await this.prisma.platformAdmin.findUnique({ where: { id: dto.responsableId }, select: { isActive: true } });
      if (!admin || !admin.isActive) throw new BadRequestException('Ese responsable no existe o está inactivo');
    }
    const estado = (dto.estado ?? 'PENDIENTE') as PlatformAuditEstado;
    const max = await this.prisma.platformAuditItem.aggregate({ _max: { orden: true } });
    const checks: AuditCheck[] = dto.checks.map((texto, i) => ({ id: `c${i + 1}`, texto: texto.trim(), hecho: false }));
    const [item] = await this.prisma.$transaction(async (tx) => {
      const creado = await tx.platformAuditItem.create({
        data: {
          key,
          area: dto.area,
          grupo: dto.grupo.trim(),
          titulo: dto.titulo.trim(),
          ruta: dto.ruta?.trim() || null,
          foco: dto.foco.trim(),
          severidad: dto.severidad ?? null,
          estado,
          checks: checks as unknown as Prisma.InputJsonValue,
          informe: dto.informe?.trim() || null,
          notas: dto.notas?.trim() || null,
          orden: (max._max.orden ?? 0) + 1,
          esPersonalizado: true,
          actualizadoPor: { connect: { id: adminId } },
          ...(dto.responsableId ? { responsable: { connect: { id: dto.responsableId } } } : {}),
          // Si nace HECHO lleva quién y cuándo, igual que al pasar un ítem a
          // HECHO desde el tablero.
          ...(estado === 'HECHO' ? { hechoPor: { connect: { id: adminId } }, hechoAt: new Date() } : {}),
        },
        include: ITEM_INCLUDE,
      });
      await tx.platformAdminLog.create({
        data: { adminId, action: 'audit_item_create', targetType: 'audit_item', targetId: creado.id, details: { key: creado.key, titulo: creado.titulo, area: creado.area } },
      });
      return [creado];
    });
    return this.serializar(item);
  }

  // Cada tarea que se tilda o se vincula en un plan necesita la key de una
  // entrada auditoria.<slug>.* que exista. Una sola consulta para todas.
  private async exigirEntradasDeAuditoria(entradas: (string | undefined)[]) {
    if (entradas.length === 0) return;
    const keys = entradas.map((k) => k?.trim() ?? '');
    const faltaOInvalida = keys.some((k) => !k.startsWith(PREFIJO_ENTRADA));
    const existentes = faltaOInvalida
      ? []
      : await this.prisma.platformAuditItem.findMany({ where: { key: { in: keys } }, select: { key: true } });
    const conocidas = new Set(existentes.map((e) => e.key));
    if (faltaOInvalida || keys.some((k) => !conocidas.has(k))) {
      throw new BadRequestException('Para marcar una tarea como hecha hace falta su entrada de auditoría');
    }
  }

  async borrar(adminId: string, id: string) {
    const actual = await this.prisma.platformAuditItem.findUnique({ where: { id } });
    if (!actual) throw new NotFoundException('Ítem de auditoría no encontrado');
    // Los del seed no se borran: si ya no aplica, se marca HECHO con una nota.
    // Así nadie pierde por accidente lo que otro cargó.
    if (!actual.esPersonalizado) throw new ForbiddenException('Los ítems de la lista base no se pueden borrar; marcalo como hecho con una nota');
    await this.prisma.$transaction([
      this.prisma.platformAuditItem.delete({ where: { id } }),
      this.prisma.platformAdminLog.create({
        data: { adminId, action: 'audit_item_delete', targetType: 'audit_item', targetId: id, details: { titulo: actual.titulo } },
      }),
    ]);
    return { ok: true as const };
  }

  // ── Serialización ─────────────────────────────────────────────────────────

  private serializar(i: ItemConInclude) {
    const checks = normalizarChecks(i.checks);
    return {
      id: i.id,
      key: i.key,
      area: i.area,
      grupo: i.grupo,
      titulo: i.titulo,
      ruta: i.ruta,
      foco: i.foco,
      severidad: i.severidad,
      estado: i.estado,
      checks,
      checksHechos: checks.filter((c) => c.hecho).length,
      orden: i.orden,
      esPersonalizado: i.esPersonalizado,
      responsable: i.responsable,
      informeUrl: i.informeUrl,
      notas: i.notas,
      informe: i.informe,
      hechoPor: i.hechoPor,
      hechoAt: i.hechoAt,
      actualizadoPor: i.actualizadoPor,
      decision: i.decision,
      decisionNota: i.decisionNota,
      decisionPor: i.decisionPor,
      decisionAt: i.decisionAt,
      updatedAt: i.updatedAt,
    };
  }
}

export type AuditItemSerializado = ReturnType<PlatformAuditService['serializar']>;

export function resumir(items: AuditItemSerializado[]) {
  const porArea: Record<string, { total: number; hechos: number; enCurso: number }> = {};
  let hechos = 0;
  let enCurso = 0;
  let sinResponsable = 0;
  let hallazgosAbiertos = 0;
  for (const it of items) {
    const a = (porArea[it.area] ??= { total: 0, hechos: 0, enCurso: 0 });
    a.total += 1;
    if (it.estado === 'HECHO') { hechos += 1; a.hechos += 1; }
    if (it.estado === 'EN_CURSO') { enCurso += 1; a.enCurso += 1; }
    if (!it.responsable && it.estado !== 'HECHO') sinResponsable += 1;
    if (it.area === 'HALLAZGO' && it.estado !== 'HECHO' && it.severidad !== 'INFO') hallazgosAbiertos += 1;
  }
  return { total: items.length, hechos, enCurso, pendientes: items.length - hechos - enCurso, sinResponsable, hallazgosAbiertos, porArea };
}
