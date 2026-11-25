import { BadRequestException, Injectable, Logger, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import {
  ConsultaPlanificada,
  LOCALIDADES_MISIONES_BUSQUEDA,
  RUBROS_BUSQUEDA,
  RubroBusqueda,
  clasificarLeadAutomatico,
  detectarLocalidadReal,
  esCadenaOInstitucionExcluida,
  esDeMisionesArgentina,
  esWhatsappArgentinoValido,
  extraerWebEInstagram,
  formatearResenas,
  generarPlanBusquedas,
} from './leads-discovery.catalogo';
import { BuscarLeadsDto } from './leads.dto';
import {
  LeadRubro,
  UBICACION_MISIONES,
  claveLead,
  esPuertoIguazu,
  normalizarWhatsappUrl,
} from './leads-seed.data';
import { LeadsService } from './leads.service';

export interface SerperPlaceRaw {
  title?: string;
  address?: string;
  phoneNumber?: string;
  website?: string;
  category?: string;
  type?: string;
  types?: string[];
  rating?: number;
  ratingCount?: number;
  placeId?: string;
  cid?: string;
}

export interface DetalleConsultaBusqueda {
  claveConsulta: string;
  rubro: RubroBusqueda;
  localidad: string;
  termino: string;
  encontrados: number;
  nuevos: number;
  duplicados: number;
  error?: string;
}

interface DedupSets {
  claves: Set<string>;
  placeIds: Set<string>;
  waPorRubro: Map<string, Set<string>>;
  igPorRubro: Map<string, Set<string>>;
  nombreLocPorRubro: Map<string, Set<string>>;
}

function getBucket(map: Map<string, Set<string>>, key: string): Set<string> {
  let set = map.get(key);
  if (!set) {
    set = new Set<string>();
    map.set(key, set);
  }
  return set;
}

@Injectable()
export class LeadsDiscoveryService {
  private readonly logger = new Logger(LeadsDiscoveryService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly leads: LeadsService,
    @Optional() private readonly config?: ConfigService,
  ) {}

  private obtenerClavesSerper(): { primaria: string | null; respaldo: string | null } {
    const primaria =
      (this.config?.get<string>('SERPER_API_KEY') ?? process.env.SERPER_API_KEY)?.trim() || null;
    const respaldo =
      (this.config?.get<string>('SERPER_API_KEY_RESPALDO') ?? process.env.SERPER_API_KEY_RESPALDO)?.trim() || null;
    return { primaria, respaldo };
  }

  private async nombreAdmin(adminId: string): Promise<string | null> {
    const admin = await this.prisma.platformAdmin.findUnique({ where: { id: adminId }, select: { name: true } });
    return admin?.name ?? null;
  }

  async estadoBusquedas() {
    await this.leads.asegurarSemilla();
    const { primaria, respaldo } = this.obtenerClavesSerper();
    const plan = generarPlanBusquedas('TODOS');
    const hechasRows = await this.prisma.marketingLeadBusqueda.findMany({
      orderBy: { ejecutadoAt: 'desc' },
    });

    const clavesHechas = new Set(hechasRows.map((b) => b.claveConsulta));
    const porRubro: Record<RubroBusqueda, { hechas: number; totales: number; pendientes: number }> = {
      TURNOS: { hechas: 0, totales: 0, pendientes: 0 },
      ALQUILERES: { hechas: 0, totales: 0, pendientes: 0 },
      GIMNASIO: { hechas: 0, totales: 0, pendientes: 0 },
      POS: { hechas: 0, totales: 0, pendientes: 0 },
    };

    for (const item of plan) {
      const bucket = porRubro[item.rubro];
      bucket.totales += 1;
      if (clavesHechas.has(item.claveConsulta)) {
        bucket.hechas += 1;
      } else {
        bucket.pendientes += 1;
      }
    }

    const totalPlanificadas = plan.length;
    const totalPendientes = RUBROS_BUSQUEDA.reduce((acc, r) => acc + porRubro[r].pendientes, 0);

    return {
      serperConfigurado: Boolean(primaria || respaldo),
      totalPlanificadas,
      totalHechas: hechasRows.length,
      totalPendientes,
      porRubro,
      localidades: [...LOCALIDADES_MISIONES_BUSQUEDA],
      ultimasBusquedas: hechasRows.slice(0, 12),
    };
  }

  private async consultarSerperMaps(
    consulta: ConsultaPlanificada,
    claves: { primaria: string | null; respaldo: string | null },
  ): Promise<SerperPlaceRaw[]> {
    const keys = [claves.primaria, claves.respaldo].filter((k): k is string => Boolean(k));
    if (keys.length === 0) {
      throw new BadRequestException('No hay SERPER_API_KEY configurada en el servidor.');
    }

    const q = `${consulta.termino} ${consulta.localidad} Misiones Argentina`;
    let ultimoError: Error | null = null;

    for (let idx = 0; idx < keys.length; idx += 1) {
      const apiKey = keys[idx];
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15_000);
      try {
        const res = await fetch('https://google.serper.dev/maps', {
          method: 'POST',
          headers: {
            'X-API-KEY': apiKey,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ q, gl: 'ar', hl: 'es' }),
          signal: controller.signal,
        });

        if (res.ok) {
          const data = (await res.json()) as { places?: SerperPlaceRaw[] };
          return Array.isArray(data.places) ? data.places : [];
        }

        const errBody = await res.text().catch(() => '');
        const msg = `Serper Maps HTTP ${res.status}: ${errBody.slice(0, 160)}`;
        ultimoError = new Error(msg);
        const reintentable = (res.status === 401 || res.status === 402 || res.status === 429) && idx < keys.length - 1;
        if (!reintentable) {
          throw ultimoError;
        }
        this.logger.warn(`Clave Serper primaria rechazó (${res.status}); reintentando con respaldo.`);
      } finally {
        clearTimeout(timeout);
      }
    }

    throw ultimoError ?? new Error('No se pudo consultar Serper Maps.');
  }

  async buscarMas(adminId: string, dto: BuscarLeadsDto) {
    const clavesSerper = this.obtenerClavesSerper();
    if (!clavesSerper.primaria && !clavesSerper.respaldo) {
      throw new BadRequestException('Falta configurar SERPER_API_KEY en el servidor para buscar leads en Google Maps.');
    }

    await this.leads.asegurarSemilla();

    const rubroObjetivo = dto.rubro ?? 'TODOS';
    const localidadObjetivo = dto.localidad?.trim() || undefined;
    const maxConsultas = Math.min(Math.max(dto.maxConsultas ?? 6, 1), 25);
    const forzar = Boolean(dto.forzarRebusqueda);

    const [busquedasHechas, leadsExistentes, adminName] = await Promise.all([
      this.prisma.marketingLeadBusqueda.findMany({ select: { claveConsulta: true } }),
      this.prisma.marketingLead.findMany({
        select: { clave: true, placeId: true, rubro: true, localidad: true, negocio: true, whatsappUrl: true, instagram: true },
      }),
      this.nombreAdmin(adminId),
    ]);

    const clavesConsultasHechas = new Set(busquedasHechas.map((b) => b.claveConsulta));
    const dedup: DedupSets = {
      claves: new Set<string>(),
      placeIds: new Set<string>(),
      waPorRubro: new Map<string, Set<string>>(),
      igPorRubro: new Map<string, Set<string>>(),
      nombreLocPorRubro: new Map<string, Set<string>>(),
    };

    for (const l of leadsExistentes) {
      if (l.clave) dedup.claves.add(l.clave);
      if (l.placeId) dedup.placeIds.add(l.placeId);
      if (l.whatsappUrl) getBucket(dedup.waPorRubro, l.rubro).add(l.whatsappUrl);
      if (l.instagram) getBucket(dedup.igPorRubro, l.rubro).add(l.instagram.toLowerCase());
      getBucket(dedup.nombreLocPorRubro, l.rubro).add(claveLead(l.rubro as LeadRubro, l.localidad, l.negocio));
    }

    const plan = generarPlanBusquedas(rubroObjetivo, localidadObjetivo);
    const candidatas = forzar ? plan : plan.filter((c) => !clavesConsultasHechas.has(c.claveConsulta));
    const seleccionadas = candidatas.slice(0, maxConsultas);
    const consultasOmitidas = plan.length - candidatas.length;

    let encontradosTotal = 0;
    let nuevosTotal = 0;
    let duplicadosTotal = 0;
    let errores = 0;
    const detalle: DetalleConsultaBusqueda[] = [];

    for (const consulta of seleccionadas) {
      try {
        const places = await this.consultarSerperMaps(consulta, clavesSerper);
        const encontrados = places.length;
        encontradosTotal += encontrados;

        const nuevosLote: {
          clave: string;
          placeId: string | null;
          rubro: LeadRubro;
          subrubro: string;
          clasificacion: string;
          negocio: string;
          zona: string;
          departamento: string;
          localidad: string;
          telefono: string | null;
          whatsappUrl: string | null;
          instagram: string | null;
          webActual: string;
          resenas: string | null;
          direccion: string | null;
          fuente: string;
        }[] = [];

        let duplicados = 0;
        const bucketWa = getBucket(dedup.waPorRubro, consulta.rubro);
        const bucketIg = getBucket(dedup.igPorRubro, consulta.rubro);
        const bucketNom = getBucket(dedup.nombreLocPorRubro, consulta.rubro);

        for (const p of places) {
          const negocio = p.title?.trim();
          if (!negocio) continue;

          const subrubro = (p.category ?? p.type ?? p.types?.[0] ?? consulta.termino).trim().slice(0, 110);
          if (esCadenaOInstitucionExcluida(negocio, subrubro)) continue;
          if (!esDeMisionesArgentina(p.address, p.phoneNumber, consulta.localidad)) continue;

          const localidad = detectarLocalidadReal(p.address, consulta.localidad);
          const telefono = p.phoneNumber?.trim() || null;
          const waRaw = normalizarWhatsappUrl(telefono);
          const whatsappUrl = esWhatsappArgentinoValido(waRaw) ? waRaw : null;
          const { instagram, webActual } = extraerWebEInstagram(p.website);

          if (!esPuertoIguazu(localidad) && !whatsappUrl && !instagram) {
            continue;
          }

          const placeId = p.placeId?.trim() || (p.cid?.trim() ? `cid:${p.cid.trim()}` : null);
          const clave = claveLead(consulta.rubro, localidad, negocio);
          const claveAlt = claveLead(consulta.rubro, consulta.localidad, negocio);

          const yaExiste =
            dedup.claves.has(clave) ||
            dedup.claves.has(claveAlt) ||
            (placeId !== null && dedup.placeIds.has(placeId)) ||
            (whatsappUrl !== null && bucketWa.has(whatsappUrl)) ||
            (instagram !== null && bucketIg.has(instagram.toLowerCase())) ||
            bucketNom.has(clave);

          if (yaExiste) {
            duplicados += 1;
            continue;
          }

          dedup.claves.add(clave);
          if (placeId) dedup.placeIds.add(placeId);
          if (whatsappUrl) bucketWa.add(whatsappUrl);
          if (instagram) bucketIg.add(instagram.toLowerCase());
          bucketNom.add(clave);

          const ubic = UBICACION_MISIONES[localidad] ?? { zona: 'Misiones', departamento: localidad };
          nuevosLote.push({
            clave,
            placeId,
            rubro: consulta.rubro,
            subrubro,
            clasificacion: clasificarLeadAutomatico(consulta.rubro, localidad),
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
            fuente: adminName ? `Google Maps auto (${adminName})` : 'Google Maps auto',
          });
        }

        let insertados = 0;
        if (nuevosLote.length > 0) {
          const resInsert = await this.prisma.marketingLead.createMany({
            data: nuevosLote,
            skipDuplicates: true,
          });
          insertados = resInsert.count;
        }

        await this.prisma.marketingLeadBusqueda.upsert({
          where: { claveConsulta: consulta.claveConsulta },
          create: {
            claveConsulta: consulta.claveConsulta,
            rubro: consulta.rubro,
            localidad: consulta.localidad,
            termino: consulta.termino,
            pagina: consulta.pagina,
            fuente: 'serper_maps',
            encontrados,
            nuevos: insertados,
            duplicados,
            ejecutadoPor: adminName,
          },
          update: {
            encontrados,
            nuevos: insertados,
            duplicados,
            ejecutadoPor: adminName,
            ejecutadoAt: new Date(),
          },
        });

        clavesConsultasHechas.add(consulta.claveConsulta);
        nuevosTotal += insertados;
        duplicadosTotal += duplicados;
        detalle.push({
          claveConsulta: consulta.claveConsulta,
          rubro: consulta.rubro,
          localidad: consulta.localidad,
          termino: consulta.termino,
          encontrados,
          nuevos: insertados,
          duplicados,
        });
      } catch (err) {
        errores += 1;
        const msg = err instanceof Error ? err.message : String(err);
        this.logger.warn(`Falló búsqueda ${consulta.claveConsulta}: ${msg}`);
        detalle.push({
          claveConsulta: consulta.claveConsulta,
          rubro: consulta.rubro,
          localidad: consulta.localidad,
          termino: consulta.termino,
          encontrados: 0,
          nuevos: 0,
          duplicados: 0,
          error: msg,
        });
      }
    }

    const planTotal = generarPlanBusquedas('TODOS');
    const pendientesRestantes = planTotal.filter((c) => !clavesConsultasHechas.has(c.claveConsulta)).length;

    return {
      consultasEjecutadas: seleccionadas.length,
      consultasOmitidas,
      pendientesRestantes,
      encontrados: encontradosTotal,
      nuevos: nuevosTotal,
      duplicados: duplicadosTotal,
      errores,
      detalle,
    };
  }
}
