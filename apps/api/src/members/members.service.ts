import { randomBytes } from 'crypto';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { InviteMemberDto } from './dto/invite-member.dto';
import { UpdateMemberDto } from './dto/update-member.dto';
import * as argon2 from 'argon2';

// Sin caracteres ambiguos (0/O, 1/l/I) para que sea legible al copiarla del email.
const TEMP_PASSWORD_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';

const INVITATION_TOKEN_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000; // 7 días

@Injectable()
export class MembersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
  ) {}

  async findAll(businessId: string) {
    const members = await this.prisma.member.findMany({
      where: { businessId },
      include: { role: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'asc' },
    });
    return members.map((m) => this.toResponse(m));
  }

  async invite(businessId: string, dto: InviteMemberDto) {
    const existing = await this.prisma.member.findUnique({
      where: { businessId_email: { businessId, email: dto.email } },
    });
    if (existing) throw new ConflictException('Ese email ya es miembro de este negocio');

    const role = await this.prisma.role.findFirst({ where: { id: dto.roleId, businessId } });
    if (!role) throw new BadRequestException('Rol inválido');

    const business = await this.prisma.business.findUnique({
      where: { id: businessId },
      include: { storefrontConfig: { select: { storeName: true } } },
    });
    if (!business) throw new NotFoundException('Negocio no encontrado');

    const tempPassword = this.genTempPassword();
    const invitationToken = randomBytes(32).toString('hex');
    const invitationTokenExpiresAt = new Date(Date.now() + INVITATION_TOKEN_EXPIRY_MS);

    const tempPasswordHash = await argon2.hash(tempPassword, { type: argon2.argon2id });

    const member = await this.prisma.member.create({
      data: {
        businessId,
        name: dto.name,
        email: dto.email,
        roleId: dto.roleId,
        status: 'PENDING',
        hasTempPassword: true,
        passwordHash: tempPasswordHash,
        invitationToken,
        invitationTokenExpiresAt,
      },
    });

    // El token de aceptación es un secreto aleatorio de un solo uso (32 bytes),
    // no el memberId — expira a los 7 días y se limpia al aceptar (ver auth.service).
    const storeName = business.storefrontConfig?.storeName ?? business.name;
    const panelUrl = `${process.env.FRONTEND_URL ?? 'http://localhost:3001'}/aceptar-invitacion?token=${invitationToken}`;
    await this.mail.sendMemberInvitation(
      dto.email,
      {
        storeName,
        roleName: role.name,
        panelUrl,
        tempPassword,
      },
      { businessId, memberId: member.id },
    );

    return {
      id: member.id,
      name: member.name,
      email: member.email,
      status: member.status,
      hasTempPassword: member.hasTempPassword,
    };
  }

  async update(businessId: string, id: string, dto: UpdateMemberDto) {
    await this.findOneRaw(businessId, id);

    if (dto.roleId) {
      const role = await this.prisma.role.findFirst({ where: { id: dto.roleId, businessId } });
      if (!role) throw new BadRequestException('Rol inválido');
    }

    // businessId va en el where del updateMany — la query garantiza el
    // aislamiento por sí misma, no depende del findOneRaw previo.
    const { count } = await this.prisma.member.updateMany({
      where: { id, businessId },
      data: { name: dto.name, roleId: dto.roleId },
    });
    if (count === 0) throw new NotFoundException('Miembro no encontrado');

    const updated = await this.findOneRaw(businessId, id);
    return this.toResponse(updated);
  }

  async remove(businessId: string, id: string) {
    const member = await this.findOneRaw(businessId, id);
    if (member.role.name === 'owner') {
      throw new UnprocessableEntityException('No se puede eliminar al owner');
    }

    // No se borra el usuario de Supabase Auth asociado — ver PENDIENTES.md
    // (decisión abierta: si conviene liberar el email para poder reinvitarlo).
    const { count } = await this.prisma.member.deleteMany({ where: { id, businessId } });
    if (count === 0) throw new NotFoundException('Miembro no encontrado');
    return { ok: true };
  }

  // ── Helpers ──────────────────────────────────────────────────────────────

  private async findOneRaw(businessId: string, id: string) {
    const member = await this.prisma.member.findFirst({
      where: { id, businessId },
      include: { role: { select: { id: true, name: true } } },
    });
    if (!member) throw new NotFoundException('Miembro no encontrado');
    return member;
  }

  private toResponse(member: {
    id: string;
    name: string;
    email: string;
    role: { id: string; name: string };
    status: string;
    hasTempPassword: boolean;
    lastAccessAt: Date | null;
  }) {
    return {
      id: member.id,
      name: member.name,
      email: member.email,
      role: member.role,
      status: member.status,
      hasTempPassword: member.hasTempPassword,
      lastAccessAt: member.lastAccessAt,
    };
  }

  private genTempPassword(): string {
    const bytes = randomBytes(12);
    let out = '';
    for (let i = 0; i < 12; i++) {
      out += TEMP_PASSWORD_CHARS[bytes[i] % TEMP_PASSWORD_CHARS.length];
    }
    return out;
  }
}
