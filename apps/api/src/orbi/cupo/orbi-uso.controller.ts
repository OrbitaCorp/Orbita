import { Body, Controller, ForbiddenException, Get, NotFoundException, Param, Put } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import type { AuthContext } from '../../common/types/auth-context.type';
import { mesArgentina } from '../../common/utils/hora-argentina';
import { AuditService } from '../../audit/audit.service';
import { PrismaService } from '../../prisma/prisma.service';
import { CupoOrbiService, porcentajeDe } from './cupo-orbi.service';
import { TopeMiembroDto } from './dto/tope-miembro.dto';

/**
 * Cupo mensual de Orbi visto desde el panel (spec 2026-10-03 §6). Negocio y
 * miembro salen SIEMPRE del token. Al panel solo viajan porcentajes (D9): ni
 * créditos, ni tokens, ni USD.
 */
@Controller('orbi/uso')
export class OrbiUsoController {
  constructor(
    private readonly cupo: CupoOrbiService,
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  @Get()
  async propio(@CurrentUser() user: AuthContext) {
    if (user.type !== 'member') throw new ForbiddenException('Solo para miembros del negocio');
    const e = await this.cupo.estado(user.businessId, user.memberId);
    return {
      mes: e.mes,
      bloquea: e.bloquea,
      negocio: { porcentaje: e.negocio.porcentaje },
      propio: { porcentaje: e.propio.porcentaje, topePorcentaje: e.propio.topePorcentaje },
    };
  }

  @Get('equipo')
  @Roles('owner', 'admin')
  async equipo(@CurrentUser() user: AuthContext) {
    if (user.type !== 'member') throw new ForbiddenException('Solo para miembros del negocio');
    const mes = mesArgentina(new Date());
    const [cupo, uso, topes, miembros, acciones] = await Promise.all([
      this.cupo.cupoDelNegocio(user.businessId, mes),
      this.cupo.usados(user.businessId, mes),
      this.cupo.topes(user.businessId),
      // Sin el visitante de la demo (readOnly) ni las invitaciones sin aceptar.
      this.prisma.member.findMany({
        where: { businessId: user.businessId, status: 'ACTIVE', readOnly: false },
        select: { id: true, name: true },
        orderBy: { name: 'asc' },
      }),
      this.prisma.orbiPendingAction.findMany({
        where: { businessId: user.businessId, status: { in: ['executed', 'failed'] } },
        orderBy: { resolvedAt: 'desc' },
        take: 50,
        select: { resolvedAt: true, memberId: true, tool: true, summary: true, status: true },
      }),
    ]);
    const nombre = new Map(miembros.map((m) => [m.id, m.name]));
    return {
      mes,
      negocio: { porcentaje: porcentajeDe(uso.negocio, cupo.total) },
      miembros: miembros.map((m) => {
        const tope = topes.get(m.id) ?? null;
        const disponible = tope === null ? cupo.total : Math.floor((cupo.total * tope) / 100);
        return {
          memberId: m.id,
          nombre: m.name,
          porcentaje: porcentajeDe(uso.porMiembro.get(m.id) ?? 0, disponible),
          topePorcentaje: tope,
        };
      }),
      acciones: acciones.map((a) => ({
        fecha: a.resolvedAt,
        miembro: nombre.get(a.memberId) ?? 'Ex miembro',
        tool: a.tool,
        resumen: a.summary,
        estado: a.status,
      })),
    };
  }

  @Put('equipo/:memberId')
  @Roles('owner')
  async fijarTope(@CurrentUser() user: AuthContext, @Param('memberId') memberId: string, @Body() dto: TopeMiembroDto) {
    if (user.type !== 'member') throw new ForbiddenException('Solo para miembros del negocio');
    const miembro = await this.prisma.member.findFirst({
      where: { id: memberId, businessId: user.businessId },
      select: { id: true },
    });
    if (!miembro) throw new NotFoundException('Ese miembro no es de este negocio');
    const antes = (await this.cupo.topes(user.businessId)).get(memberId) ?? null;
    await this.cupo.fijarTope(user.businessId, memberId, dto.topePorcentaje, user.memberId);
    await this.audit.registrar({
      businessId: user.businessId,
      memberId: user.memberId,
      entityType: 'orbi_cupo_miembro',
      entityId: memberId,
      action: 'UPDATE',
      changes: [{ field: 'topePorcentaje', before: antes, after: dto.topePorcentaje }],
    });
    return { ok: true };
  }
}
