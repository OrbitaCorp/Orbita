import { Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { SendSupportRequestDto, type SupportCategory } from './dto/send-support-request.dto';

// Configuración → Soporte: formulario genérico (no solo dominios, cualquier
// consulta posible) que cualquier miembro del panel puede mandar — sin
// permiso especial (mismo criterio que "cualquiera con sesión de panel
// puede pedir ayuda", no es una acción sensible como las que sí gatean
// @RequirePermission). El destino es SIEMPRE contacto@orbita-corp.com, fijo
// acá — el frontend nunca elige a quién le llega.
@Injectable()
export class SupportService {
  private readonly SUPPORT_EMAIL = 'contacto@orbita-corp.com';

  private readonly CATEGORY_LABEL: Record<SupportCategory, string> = {
    DOMINIO: 'Dominios',
    FACTURACION: 'Facturación / pagos',
    TECNICO: 'Problema técnico',
    CUENTA: 'Mi cuenta / plan',
    OTRO: 'Otra consulta',
  };

  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
  ) {}

  async send(businessId: string, memberId: string, dto: SendSupportRequestDto): Promise<{ ok: true }> {
    const [business, member] = await Promise.all([
      this.prisma.business.findUnique({ where: { id: businessId }, select: { name: true, subdomain: true } }),
      this.prisma.member.findUnique({ where: { id: memberId }, select: { name: true, email: true } }),
    ]);
    if (!business || !member) throw new NotFoundException('No se pudo resolver quién está escribiendo');

    const ok = await this.mail.sendSupportRequest(
      this.SUPPORT_EMAIL,
      {
        businessName: business.name,
        businessSlug: business.subdomain,
        memberName: member.name,
        memberEmail: member.email,
        category: this.CATEGORY_LABEL[dto.category],
        subject: dto.subject.trim(),
        message: dto.message.trim(),
        contactPhone: dto.contactPhone?.trim() || undefined,
      },
      { businessId, memberId },
    );
    if (!ok) throw new UnprocessableEntityException('No se pudo enviar tu consulta — probá de nuevo en un momento');
    return { ok: true };
  }
}
