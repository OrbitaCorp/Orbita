import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpsertAddressDto } from './dto/upsert-address.dto';

// (RBT-629) Direcciones del cliente del storefront. Todo scopeado por customerId
// (el del token, vía assertCustomerContext en el controller): nunca se lee ni se
// toca una dirección por id "a ciegas" — siempre se verifica que sea del cliente.
@Injectable()
export class AddressesService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(customerId: string) {
    return this.prisma.address.findMany({ where: { customerId }, orderBy: { createdAt: 'desc' } });
  }

  async create(customerId: string, dto: UpsertAddressDto) {
    if (dto.isDefault) await this.desmarcarDefaultAnterior(customerId);
    return this.prisma.address.create({ data: { customerId, ...dto } });
  }

  async update(customerId: string, id: string, dto: UpsertAddressDto) {
    await this.assertPertenece(customerId, id);
    if (dto.isDefault) await this.desmarcarDefaultAnterior(customerId);
    return this.prisma.address.update({ where: { id }, data: dto });
  }

  async remove(customerId: string, id: string) {
    await this.assertPertenece(customerId, id);
    await this.prisma.address.delete({ where: { id } });
    return { ok: true };
  }

  // Verifica que la dirección exista Y sea de este cliente. Si no, 404 (no revela
  // si existe pero es de otro — mismo criterio que el resto de la API).
  private async assertPertenece(customerId: string, id: string): Promise<void> {
    const direccion = await this.prisma.address.findFirst({ where: { id, customerId }, select: { id: true } });
    if (!direccion) throw new NotFoundException('Dirección no encontrada');
  }

  // Solo una dirección default por cliente: al marcar una, se desmarca la anterior.
  private async desmarcarDefaultAnterior(customerId: string): Promise<void> {
    await this.prisma.address.updateMany({ where: { customerId, isDefault: true }, data: { isDefault: false } });
  }
}
