import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpsertMessageTemplateDto } from './dto/upsert-message-template.dto';

// (RBT-657) Plantillas de mensaje del panel — respuestas hechas para el chat
// cliente↔tienda. Scopeadas a businessId, sin más reglas de negocio: es un
// CRUD simple sobre `message_templates` (ya migrada).
@Injectable()
export class MessageTemplatesService {
  constructor(private readonly prisma: PrismaService) {}

  private aRespuesta(t: { id: string; name: string; text: string; category: string; createdAt: Date; updatedAt: Date }) {
    return { id: t.id, name: t.name, text: t.text, category: t.category, createdAt: t.createdAt, updatedAt: t.updatedAt };
  }

  async findAll(businessId: string) {
    const rows = await this.prisma.messageTemplate.findMany({
      where: { businessId },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map((r) => this.aRespuesta(r));
  }

  async create(businessId: string, dto: UpsertMessageTemplateDto) {
    const t = await this.prisma.messageTemplate.create({
      data: { businessId, name: dto.name, text: dto.text, category: dto.category as never },
    });
    return this.aRespuesta(t);
  }

  async update(businessId: string, id: string, dto: UpsertMessageTemplateDto) {
    const escrito = await this.prisma.messageTemplate.updateMany({
      where: { id, businessId },
      data: { name: dto.name, text: dto.text, category: dto.category as never },
    });
    if (escrito.count === 0) throw new NotFoundException('Plantilla no encontrada');
    const t = await this.prisma.messageTemplate.findUniqueOrThrow({ where: { id } });
    return this.aRespuesta(t);
  }

  async remove(businessId: string, id: string) {
    const escrito = await this.prisma.messageTemplate.deleteMany({ where: { id, businessId } });
    if (escrito.count === 0) throw new NotFoundException('Plantilla no encontrada');
    return { ok: true };
  }
}
