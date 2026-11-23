import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import * as argon2 from 'argon2';
import { PrismaService } from '../prisma/prisma.service';
import { PERMISSIONS } from '../common/permisos/catalogo';
import { motivoSubdominioInvalido } from '../common/utils/subdominio';
import { ROLE_DEFS, ROLE_PERMISSIONS } from '../onboarding/onboarding.service';
import { CrearNegocioAlquileresDto } from './dto/crear-negocio-alquileres.dto';

/**
 * Rubros de Alquileres que se pueden crear hoy: alojamiento por noche. Son
 * las claves de RUBROS_ALQUILERES del front (apps/web/src/modules/alquileres/datos).
 * Canchas, salones y alquiler por mes se suman cuando su panel escriba en la API.
 */
export const RUBROS_ALQUILERES_HABILITADOS = ['casa', 'depto', 'cabana', 'quinta', 'hostel', 'camping'] as const;

const MOTIVO_OCULTO = 'Negocio de prueba de Alquileres, creado desde Superadmin';
const MOTIVO_CORTESIA = 'Alquileres todavía no se cobra: negocio creado desde Superadmin';

/**
 * Crear un negocio de Alquileres desde Superadmin.
 *
 * El alta pública sigue con Alquileres en "Próximamente": mientras tanto esta
 * es la única forma de tener un negocio real de alquiler (plan
 * docs/superpowers/plans/2026-11-23-alquileres-en-produccion.md, etapa 1).
 * Arma lo mismo que OnboardingService.registerBusiness (sucursal, roles con
 * sus permisos, dueño, configs) y además:
 *  - el rubro en `industry: "alquileres"` y `subrubros`, como Turnos;
 *  - oculto de buscadores (`hiddenFromSearch`): se entra solo con el link;
 *  - cortesía por un año, sin cobro;
 *  - la config de reservas del módulo, con confirmación manual: una reserva
 *    del sitio queda pendiente hasta que el dueño registra la seña;
 *  - el dueño entra con la contraseña que eligió el superadmin. No se le fuerza
 *    el cambio al entrar: esa pantalla hoy vive en el panel de Tienda (Mi
 *    perfil), y el panel de Alquileres todavía no tiene la suya. Son negocios
 *    de prueba del equipo; la puede cambiar con "¿Olvidaste tu contraseña?".
 */
@Injectable()
export class NegociosAlquileresService {
  constructor(private readonly prisma: PrismaService) {}

  async crear(adminId: string, dto: CrearNegocioAlquileresDto) {
    const subdomain = dto.subdominio.trim().toLowerCase();
    const email = dto.duenoEmail.trim().toLowerCase();
    const nombre = dto.nombre.trim();

    if (!(RUBROS_ALQUILERES_HABILITADOS as readonly string[]).includes(dto.rubro)) {
      throw new BadRequestException('Por ahora se pueden crear negocios de alojamiento por noche (casa, depto, cabañas, quinta, hostel o camping).');
    }
    const motivo = motivoSubdominioInvalido(subdomain);
    if (motivo) throw new BadRequestException(motivo);
    if (await this.prisma.business.findUnique({ where: { subdomain }, select: { id: true } })) {
      throw new ConflictException('Ese subdominio ya está en uso.');
    }
    // El email de un miembro es único en toda la plataforma (mismo chequeo que el alta).
    if (await this.prisma.member.findFirst({ where: { email: { equals: email, mode: 'insensitive' } }, select: { id: true } })) {
      throw new ConflictException('Ese email ya tiene un negocio en Órbita.');
    }

    const passwordHash = await argon2.hash(dto.contrasena, { type: argon2.argon2id });

    // El catálogo de permisos es global: se asegura fuera de la transacción, como en el alta.
    for (const perm of PERMISSIONS) {
      await this.prisma.permission.upsert({ where: { code: perm.code }, update: {}, create: perm });
    }
    const permisos = await this.prisma.permission.findMany({ where: { code: { in: Object.values(ROLE_PERMISSIONS).flat() } } });
    const porCodigo = new Map(permisos.map((p) => [p.code, p.id]));

    const ahora = new Date();
    const finCortesia = new Date(ahora.getFullYear() + 1, ahora.getMonth(), ahora.getDate());

    const { business, member } = await this.prisma.$transaction(
      async (tx) => {
        const business = await tx.business.create({
          data: {
            name: nombre,
            industry: 'alquileres',
            subrubros: [dto.rubro],
            subdomain,
            mode: 'FULL',
            isActive: true,
            operatesOnline: true,
            hiddenFromSearch: true,
            hiddenFromSearchReason: MOTIVO_OCULTO,
            // Sin el tutorial de primeros pasos de Tienda: no aplica a este panel.
            tutorial: { variante: 'checklist', fase: 'terminado', etapa: 2, paso: 0, hechas: [], minimizado: false },
          },
        });
        await tx.branch.create({ data: { businessId: business.id, name: 'Principal', isDefault: true } });

        const roles: Record<string, { id: string }> = {};
        for (const def of ROLE_DEFS) {
          const role = await tx.role.create({ data: { businessId: business.id, name: def.name, color: def.color, isDefault: true } });
          roles[def.name] = role;
          const ids = (ROLE_PERMISSIONS[def.name] ?? []).map((c) => porCodigo.get(c)).filter((id): id is string => !!id);
          if (ids.length > 0) await tx.rolePermission.createMany({ data: ids.map((permissionId) => ({ roleId: role.id, permissionId })) });
        }

        const member = await tx.member.create({
          data: {
            businessId: business.id,
            name: dto.duenoNombre.trim(),
            email,
            roleId: roles.owner.id,
            status: 'ACTIVE',
            hasTempPassword: false,
            passwordHash,
            // Lo cargó un superadmin: no se le pide verificar el email.
            emailVerified: true,
          },
        });

        await tx.businessConfig.create({
          data: { businessId: business.id, acceptsMercadopago: false, acceptsCash: false, acceptsTransfer: false, acceptsPickup: false, acceptsCard: false, acceptsCoordinateLater: false },
        });
        await tx.storefrontConfig.create({
          data: { businessId: business.id, storeName: nombre, colorMode: 'light', showRating: true, showNewBadge: true, showWhatsapp: true, showLowStock: false },
        });
        await tx.notificationConfig.create({
          data: { businessId: business.id, matrix: { nuevo_pedido: { panel: true, email: true }, pago_confirmado: { panel: true, email: true } } },
        });
        await tx.subscription.create({
          data: {
            businessId: business.id, origin: 'COMP', status: 'ACTIVE', plan: 'standard', amount: new Prisma.Decimal(0),
            currentPeriodStart: ahora, currentPeriodEnd: finCortesia, grantedBy: adminId, grantReason: MOTIVO_CORTESIA,
          },
        });
        await tx.reservaConfig.create({
          data: {
            businessId: business.id, modulo: 'ALQUILERES', activo: true,
            // Manual: la reserva del sitio queda pendiente hasta que el dueño registra la seña.
            confirmacion: 'MANUAL',
            // La estadía no tiene horario de apertura: se entra y se sale a la hora de cada propiedad.
            horario: {},
            anticipacionMinimaMinutos: 0, anticipacionMaximaDias: 365,
            cancelacionHastaHoras: 48, reprogramacionHastaHoras: 48,
            senaPorcentaje: 30, senaReembolsable: true,
            maximoActivasPorCliente: 0, listaDeEspera: false,
          },
        });
        await tx.platformAdminLog.create({
          data: { adminId, action: 'create_alquileres_business', targetType: 'business', targetId: business.id, details: { subdomain, rubro: dto.rubro, ownerEmail: email } },
        });
        return { business, member };
      },
      { timeout: 15000 },
    );

    return { business: { id: business.id, name: business.name, subdomain: business.subdomain }, owner: { email: member.email } };
  }
}
