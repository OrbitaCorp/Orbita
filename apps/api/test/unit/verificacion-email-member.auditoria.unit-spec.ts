import { BadRequestException } from '@nestjs/common';
import { createHash } from 'crypto';
import { EmailVerificationService } from '../../src/member-profile/email-verification.service';

// Hallazgo `alta-sin-verificar-email`. Decisión del 2026-09-16: la
// verificación NO va en el wizard — el member nace sin verificar con 7 días de
// plazo y la resuelve desde "Mi perfil" con un código de 6 dígitos.

const MEMBER = 'm-1';
const hash = (c: string) => createHash('sha256').update(c).digest('hex');
const enMinutos = (m: number) => new Date(Date.now() + m * 60_000);

function armar(opts: { member?: Record<string, unknown>; token?: Record<string, unknown> | null } = {}) {
  const member = {
    email: 'ana@tienda.com', name: 'Ana', emailVerified: false, emailVerifyDueAt: enMinutos(60 * 24 * 7),
    business: { id: 'biz-1', name: 'Tienda' }, ...opts.member,
  };
  const token = opts.token === undefined
    ? { id: 't-1', memberId: MEMBER, email: member.email, codeHash: hash('123456'), attempts: 0, expiresAt: enMinutos(30), usedAt: null, createdAt: new Date(Date.now() - 5 * 60_000) }
    : opts.token;
  const prisma = {
    member: { findUnique: jest.fn().mockResolvedValue(member), update: jest.fn().mockResolvedValue({}) },
    emailVerificationToken: {
      findFirst: jest.fn().mockResolvedValue(token),
      create: jest.fn().mockResolvedValue({}),
      update: jest.fn().mockResolvedValue({}),
      updateMany: jest.fn().mockResolvedValue({}),
    },
    $transaction: jest.fn(async (ops: unknown[]) => Promise.all(ops)),
  };
  const mail = { sendMemberEmailVerification: jest.fn().mockResolvedValue(undefined) };
  const svc = new EmailVerificationService(prisma as never, mail as never);
  return { svc, prisma, mail, member };
}

describe('Verificar el email de un member', () => {
  describe('pedir el código', () => {
    it('manda un código de 6 dígitos y guarda solo su hash, nunca el código', async () => {
      const { svc, prisma, mail } = armar({ token: null });
      await svc.enviarCodigo(MEMBER);
      const guardado = prisma.emailVerificationToken.create.mock.calls[0][0].data;
      const enviado = mail.sendMemberEmailVerification.mock.calls[0][1].code;
      expect(enviado).toMatch(/^\d{6}$/);
      expect(guardado.codeHash).toBe(hash(enviado));
      expect(JSON.stringify(guardado)).not.toContain(enviado);
    });

    it('pedir otro código quema los anteriores, para que el viejo deje de servir', async () => {
      const { svc, prisma } = armar({ token: null });
      await svc.enviarCodigo(MEMBER);
      expect(prisma.emailVerificationToken.updateMany).toHaveBeenCalledWith({
        where: { memberId: MEMBER, usedAt: null },
        data: { usedAt: expect.any(Date) },
      });
    });

    it('no se puede pedir otro antes del minuto — si no, es una máquina de mandar mails a una casilla ajena', async () => {
      const { svc, mail } = armar({ token: { createdAt: new Date() } });
      await expect(svc.enviarCodigo(MEMBER)).rejects.toBeInstanceOf(BadRequestException);
      expect(mail.sendMemberEmailVerification).not.toHaveBeenCalled();
    });

    it('un email ya verificado no pide códigos', async () => {
      const { svc, mail } = armar({ member: { emailVerified: true } });
      await expect(svc.enviarCodigo(MEMBER)).rejects.toBeInstanceOf(BadRequestException);
      expect(mail.sendMemberEmailVerification).not.toHaveBeenCalled();
    });
  });

  describe('confirmar', () => {
    it('el código correcto verifica el email y apaga el plazo', async () => {
      const { svc, prisma } = armar();
      await expect(svc.confirmar(MEMBER, '123456')).resolves.toEqual({ emailVerified: true });
      expect(prisma.member.update).toHaveBeenCalledWith({
        where: { id: MEMBER },
        data: { emailVerified: true, emailVerifyDueAt: null },
      });
    });

    it('el código correcto se gasta: queda usado y no sirve dos veces', async () => {
      const { svc, prisma } = armar();
      await svc.confirmar(MEMBER, '123456');
      expect(prisma.emailVerificationToken.update).toHaveBeenCalledWith({
        where: { id: 't-1' },
        data: { usedAt: expect.any(Date) },
      });
    });

    it('un código errado suma un intento y NO verifica nada', async () => {
      const { svc, prisma } = armar();
      await expect(svc.confirmar(MEMBER, '000000')).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.emailVerificationToken.update).toHaveBeenCalledWith({
        where: { id: 't-1' },
        data: { attempts: { increment: 1 } },
      });
      expect(prisma.member.update).not.toHaveBeenCalled();
    });

    it('a los 5 intentos el código queda quemado, aunque después acierte', async () => {
      const { svc, prisma } = armar({ token: { id: 't-1', email: 'ana@tienda.com', codeHash: hash('123456'), attempts: 5, expiresAt: enMinutos(30), usedAt: null, createdAt: new Date() } });
      await expect(svc.confirmar(MEMBER, '123456')).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.member.update).not.toHaveBeenCalled();
    });

    it('sin código vigente no verifica', async () => {
      const { svc, prisma } = armar({ token: null });
      await expect(svc.confirmar(MEMBER, '123456')).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.member.update).not.toHaveBeenCalled();
    });

    it('el código se busca contra el email ACTUAL: si lo cambió, el viejo no sirve', async () => {
      const { svc, prisma } = armar({ member: { email: 'nuevo@tienda.com' } });
      await svc.confirmar(MEMBER, '123456').catch(() => {});
      expect(prisma.emailVerificationToken.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ email: 'nuevo@tienda.com' }) }),
      );
    });

    it('si ya estaba verificado no explota, devuelve que sí', async () => {
      const { svc, prisma } = armar({ member: { emailVerified: true } });
      await expect(svc.confirmar(MEMBER, '123456')).resolves.toEqual({ emailVerified: true });
      expect(prisma.member.update).not.toHaveBeenCalled();
    });
  });

  describe('estado que lee el panel', () => {
    it('cuenta los días que faltan y no filtra nada del código', async () => {
      const { svc } = armar();
      const e = await svc.estado(MEMBER);
      expect(e).toMatchObject({ email: 'ana@tienda.com', emailVerified: false, hayCodigoVigente: true });
      expect(e.diasRestantes).toBe(7);
      expect(JSON.stringify(e)).not.toContain('codeHash');
    });

    it('el plazo vencido da días negativos, para que el panel ponga el aviso urgente', async () => {
      const { svc } = armar({ member: { emailVerifyDueAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000) } });
      expect((await svc.estado(MEMBER)).diasRestantes).toBeLessThan(0);
    });

    it('un email verificado no tiene plazo ni código', async () => {
      const { svc } = armar({ member: { emailVerified: true, emailVerifyDueAt: null } });
      const e = await svc.estado(MEMBER);
      expect(e).toMatchObject({ emailVerified: true, dueAt: null, diasRestantes: null, hayCodigoVigente: false });
    });
  });
});
