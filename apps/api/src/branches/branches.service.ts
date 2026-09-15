import {
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateBranchDto } from './dto/create-branch.dto';
import { UpdateBranchDto } from './dto/update-branch.dto';
import { AuditService } from '../audit/audit.service';

// Lo que vale la pena ver en el registro de auditoría de una sucursal
// (hallazgo `auditoria-acciones-sin-registro`): nombre, dirección, ubicación
// y si está activa. isDefault no se edita desde acá.
const CAMPOS_AUDITADOS = ['name', 'address', 'latitude', 'longitude', 'isActive'];

@Injectable()
export class BranchesService {
  constructor(
    private readonly prisma: PrismaService,
    // Registro de auditoría de alta, edición y baja. Opcional solo para los tests.
    private readonly audit?: AuditService,
  ) {}

  findAll(businessId: string) {
    return this.prisma.branch.findMany({ where: { businessId } });
  }

  async findOne(businessId: string, id: string) {
    const branch = await this.prisma.branch.findFirst({ where: { id, businessId } });
    if (!branch) throw new NotFoundException('Sucursal no encontrada');
    return branch;
  }

  async create(businessId: string, dto: CreateBranchDto, actorId?: string) {
    const creada = await this.prisma.branch.create({
      data: {
        businessId,
        name: dto.name,
        address: dto.address,
        isActive: dto.isActive ?? true,
      },
    });
    await this.audit?.registrar({
      businessId, memberId: actorId, entityType: 'branch', entityId: creada.id, action: 'CREATE',
      changes: AuditService.diferencias({}, { ...creada }, CAMPOS_AUDITADOS),
    });
    return creada;
  }

  async update(businessId: string, id: string, dto: UpdateBranchDto, actorId?: string) {
    const existente = await this.findOne(businessId, id); // 404 si no existe o es de otro negocio

    // El `where` lleva businessId también acá: el aislamiento de tenant no puede
    // depender de que el findOne() de arriba haya corrido antes — la query en sí
    // tiene que garantizarlo, no el orden del código alrededor.
    const { count } = await this.prisma.branch.updateMany({
      where: { id, businessId },
      data: dto,
    });
    if (count === 0) throw new NotFoundException('Sucursal no encontrada');

    const actualizada = await this.findOne(businessId, id);
    // Solo lo que cambió de verdad (mismo criterio que productos y descuentos).
    const cambios = AuditService.diferencias({ ...existente }, { ...actualizada }, CAMPOS_AUDITADOS);
    if (cambios.length > 0) {
      await this.audit?.registrar({ businessId, memberId: actorId, entityType: 'branch', entityId: id, action: 'UPDATE', changes: cambios });
    }
    return actualizada;
  }

  async remove(businessId: string, id: string, actorId?: string) {
    const branch = await this.findOne(businessId, id);
    if (branch.isDefault) {
      throw new UnprocessableEntityException('No se puede eliminar la sucursal principal');
    }

    let result: Prisma.BatchPayload;
    try {
      result = await this.prisma.branch.deleteMany({ where: { id, businessId } });
    } catch (err) {
      // P2003/P2014: la sucursal tiene registros asociados (stock, órdenes, caja, etc.)
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        (err.code === 'P2003' || err.code === 'P2014')
      ) {
        throw new UnprocessableEntityException(
          'No se puede eliminar: la sucursal tiene registros asociados (stock, órdenes o caja)',
        );
      }
      throw err;
    }
    if (result.count === 0) throw new NotFoundException('Sucursal no encontrada');

    await this.audit?.registrar({
      businessId, memberId: actorId, entityType: 'branch', entityId: id, action: 'DELETE',
      changes: [{ field: 'name', before: branch.name, after: null }],
    });
    return { ok: true };
  }
}
