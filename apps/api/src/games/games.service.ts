import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpsertGameDto } from './dto/upsert-game.dto';

// Fase 2.1 del paquete "Avanzado" — solo configuración (ver Game en
// schema.prisma). La mecánica jugable/reclamo/creación del Discount premio
// son Fase 2.2, todavía no existen.
@Injectable()
export class GamesService {
  constructor(private readonly prisma: PrismaService) {}

  async getForBusiness(businessId: string) {
    const games = await this.prisma.game.findMany({ where: { businessId } });
    return games.map((g) => this.toResponse(g));
  }

  async getOne(businessId: string, type: string) {
    const game = await this.prisma.game.findUnique({ where: { businessId_type: { businessId, type } } });
    if (!game) throw new NotFoundException('Este negocio todavía no configuró este juego');
    return this.toResponse(game);
  }

  async upsert(businessId: string, type: string, dto: UpsertGameDto) {
    if (dto.maxPercent < dto.percentPerWin) {
      throw new BadRequestException('El techo máximo no puede ser menor que el % por acierto');
    }
    const game = await this.prisma.game.upsert({
      where: { businessId_type: { businessId, type } },
      create: {
        businessId,
        type,
        name: dto.name ?? null,
        isActive: dto.isActive,
        percentPerWin: dto.percentPerWin,
        maxPercent: dto.maxPercent,
      },
      update: {
        name: dto.name ?? null,
        isActive: dto.isActive,
        percentPerWin: dto.percentPerWin,
        maxPercent: dto.maxPercent,
      },
    });
    return this.toResponse(game);
  }

  // Decimal de Prisma no serializa directo a JSON — mismo criterio que
  // subscriptions.service.ts (amount: Number(sub.amount)).
  private toResponse(game: {
    id: string;
    type: string;
    name: string | null;
    isActive: boolean;
    percentPerWin: unknown;
    maxPercent: unknown;
  }) {
    return {
      id: game.id,
      type: game.type,
      name: game.name,
      isActive: game.isActive,
      percentPerWin: Number(game.percentPerWin),
      maxPercent: Number(game.maxPercent),
    };
  }
}
