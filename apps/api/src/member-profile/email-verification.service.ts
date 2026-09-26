import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { createHash, randomInt } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { DIAS_PARA_VERIFICAR_EMAIL } from '../onboarding/onboarding.service';

// Verificación del email de un member (hallazgo `alta-sin-verificar-email`).
//
// Decisión del 2026-09-16: NO va en el wizard. Pedir un código en el medio del
// alta le suma fricción justo antes de cobrar, y el riesgo que cubre es bajo
// (para ocupar el email de otro hay que pagar). En vez de eso, el member nace
// sin verificar con 7 días de plazo y lo resuelve cuando quiere desde "Mi
// perfil" del panel, que es donde ya está trabajando.
//
// Qué pasa al vencerse el plazo: NADA automático, a propósito. El aviso del
// panel se pone urgente y listo. Bloquear el panel de un negocio que ya paga
// por un email sin verificar es un daño mucho mayor que el que evita; si
// alguna vez hace falta apretar, la fecha ya está guardada y se puede decidir
// después con los datos a la vista.
@Injectable()
export class EmailVerificationService {
  private readonly logger = new Logger(EmailVerificationService.name);

  // 30 minutos: más que los 15 del reset de contraseña, porque acá no hay
  // urgencia ni una sesión esperando del otro lado — el dueño puede ir a
  // buscar el mail, atender el local y volver.
  private static readonly TTL_MS = 30 * 60 * 1000;
  // Cuántos códigos errados aguanta una fila antes de quedar quemada. Mismo
  // criterio que el reset de contraseña.
  private static readonly MAX_INTENTOS = 5;
  // Ventana mínima entre dos envíos. Evita usar el endpoint como máquina de
  // mandar mails a una casilla ajena (el throttler del controller es por IP;
  // esto es por member, que es lo que de verdad importa acá).
  private static readonly ESPERA_REENVIO_MS = 60 * 1000;

  constructor(
    private readonly prisma: PrismaService,
    private readonly mail?: MailService,
  ) {}

  /** Lo que el panel necesita para dibujar el aviso, sin exponer nada del código. */
  async estado(memberId: string) {
    const m = await this.prisma.member.findUnique({
      where: { id: memberId },
      select: { email: true, emailVerified: true, emailVerifyDueAt: true },
    });
    if (!m) throw new NotFoundException('No se encontró tu usuario');

    const ultimo = m.emailVerified
      ? null
      : await this.prisma.emailVerificationToken.findFirst({
          where: { memberId, email: m.email, usedAt: null },
          orderBy: { createdAt: 'desc' },
          select: { createdAt: true, expiresAt: true, attempts: true },
        });

    const ahora = Date.now();
    const vigente = !!ultimo && ultimo.expiresAt.getTime() > ahora && ultimo.attempts < EmailVerificationService.MAX_INTENTOS;
    const esperaHasta = ultimo ? ultimo.createdAt.getTime() + EmailVerificationService.ESPERA_REENVIO_MS : 0;

    return {
      email: m.email,
      emailVerified: m.emailVerified,
      dueAt: m.emailVerifyDueAt,
      // Negativo = el plazo ya venció. El panel decide con esto si el aviso va
      // en tono informativo o urgente.
      diasRestantes: m.emailVerifyDueAt
        ? Math.ceil((m.emailVerifyDueAt.getTime() - ahora) / (24 * 60 * 60 * 1000))
        : null,
      hayCodigoVigente: vigente,
      // Segundos que faltan para poder pedir otro código. 0 = ya puede.
      esperaParaReenviar: Math.max(0, Math.ceil((esperaHasta - ahora) / 1000)),
    };
  }

  async enviarCodigo(memberId: string) {
    const m = await this.prisma.member.findUnique({
      where: { id: memberId },
      select: { email: true, name: true, emailVerified: true, business: { select: { id: true, name: true } } },
    });
    if (!m) throw new NotFoundException('No se encontró tu usuario');
    if (m.emailVerified) throw new BadRequestException('Tu email ya está verificado.');

    const ultimo = await this.prisma.emailVerificationToken.findFirst({
      where: { memberId },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
    });
    const espera = ultimo
      ? ultimo.createdAt.getTime() + EmailVerificationService.ESPERA_REENVIO_MS - Date.now()
      : 0;
    if (espera > 0) {
      throw new BadRequestException(`Esperá ${Math.ceil(espera / 1000)} segundos antes de pedir otro código.`);
    }

    const code = String(randomInt(0, 1_000_000)).padStart(6, '0');

    // Los códigos anteriores del member se queman en el mismo momento en que
    // se emite el nuevo: si no, el de hace media hora seguiría sirviendo y
    // pedir "otro código" no invalidaría nada.
    await this.prisma.$transaction([
      this.prisma.emailVerificationToken.updateMany({
        where: { memberId, usedAt: null },
        data: { usedAt: new Date() },
      }),
      this.prisma.emailVerificationToken.create({
        data: {
          memberId,
          email: m.email,
          codeHash: this.hash(code),
          expiresAt: new Date(Date.now() + EmailVerificationService.TTL_MS),
        },
      }),
    ]);

    // Sin await, igual que el reset de contraseña: el código ya quedó guardado
    // y esperar al SMTP solo haría que el panel se quede colgado si el
    // proveedor tarda. Si el mail no sale, se pide otro.
    void this.mail
      ?.sendMemberEmailVerification(
        m.email,
        { code, nombre: m.name, storeName: m.business.name, expiresIn: '30 minutos' },
        { businessId: m.business.id, memberId },
      )
      .catch((e: unknown) => {
        this.logger.error(`No se pudo enviar el código de verificación al member ${memberId}: ${e instanceof Error ? e.message : e}`);
      });

    return { enviado: true, email: m.email };
  }

  async confirmar(memberId: string, code: string) {
    const m = await this.prisma.member.findUnique({
      where: { id: memberId },
      select: { email: true, emailVerified: true },
    });
    if (!m) throw new NotFoundException('No se encontró tu usuario');
    if (m.emailVerified) return { emailVerified: true };

    // Contra el email ACTUAL: si lo cambió después de pedir el código, el
    // viejo no sirve para verificar el nuevo.
    const stored = await this.prisma.emailVerificationToken.findFirst({
      where: { memberId, email: m.email, usedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
    });
    if (!stored || stored.attempts >= EmailVerificationService.MAX_INTENTOS) {
      throw new BadRequestException('Código inválido o vencido. Pedí uno nuevo.');
    }

    if (stored.codeHash !== this.hash(code)) {
      await this.prisma.emailVerificationToken.update({
        where: { id: stored.id },
        data: { attempts: { increment: 1 } },
      });
      const quedan = EmailVerificationService.MAX_INTENTOS - (stored.attempts + 1);
      throw new BadRequestException(
        quedan > 0 ? `Código incorrecto. Te quedan ${quedan} intentos.` : 'Código incorrecto. Pedí uno nuevo.',
      );
    }

    await this.prisma.$transaction([
      this.prisma.emailVerificationToken.update({ where: { id: stored.id }, data: { usedAt: new Date() } }),
      this.prisma.member.update({
        where: { id: memberId },
        data: { emailVerified: true, emailVerifyDueAt: null },
      }),
    ]);

    return { emailVerified: true };
  }

  /**
   * Envía recordatorios automáticos por correo a los miembros activos que no han
   * verificado su email cuando faltan 7, 3 y 1 días para que expire su plazo.
   * Corre dentro de `nightly-subscriptions-maintenance` a las 3 AM UTC.
   */
  async avisarRecordatorios(ahora: Date = new Date()): Promise<{ avisados: number; omitidos: number; fallidos: number }> {
    const members = await this.prisma.member.findMany({
      where: {
        status: 'ACTIVE',
        emailVerified: false,
        emailVerifyDueAt: { not: null, gt: ahora },
      },
      select: {
        id: true,
        name: true,
        email: true,
        emailVerifyDueAt: true,
        business: {
          select: {
            id: true,
            name: true,
            subdomain: true,
          },
        },
      },
    });

    let avisados = 0;
    let omitidos = 0;
    let fallidos = 0;
    const DIA_MS = 24 * 60 * 60 * 1000;

    for (const m of members) {
      if (!m.emailVerifyDueAt) continue;
      const msRestantes = m.emailVerifyDueAt.getTime() - ahora.getTime();
      const diasRestantes = Math.ceil(msRestantes / DIA_MS);

      let hito: number | null = null;
      if (diasRestantes <= 1) hito = 1;
      else if (diasRestantes <= 3) hito = 3;
      else if (diasRestantes <= 7) hito = 7;

      if (hito === null) {
        omitidos++;
        continue;
      }

      const inicioHito = new Date(m.emailVerifyDueAt.getTime() - hito * DIA_MS);

      try {
        const yaEnviado = await this.prisma.emailLog.findFirst({
          where: {
            to: m.email,
            template: 'member-email-verification-reminder',
            status: 'SENT',
            createdAt: { gte: inicioHito },
          },
          select: { id: true },
        });

        if (yaEnviado) {
          omitidos++;
          continue;
        }

        const diasTexto = hito === 1 ? '1 día' : `${hito} días`;
        const perfilUrl = `https://${m.business.subdomain}.orbita.site/admin/ventas/perfil`;

        if (this.mail) {
          await this.mail.sendMemberEmailVerificationReminder(
            m.email,
            {
              nombre: m.name,
              storeName: m.business.name,
              email: m.email,
              diasRestantes: diasTexto,
              perfilUrl,
            },
            { businessId: m.business.id, memberId: m.id },
          );
          avisados++;
          this.logger.log(`Aviso de verificación enviado a ${m.email} (hito ${diasTexto} restantes)`);
        }
      } catch (err) {
        fallidos++;
        this.logger.error(
          `Error enviando aviso de verificación a ${m.email}: ${err instanceof Error ? err.message : err}`,
        );
      }
    }

    if (avisados > 0 || fallidos > 0) {
      this.logger.log(
        `Recordatorios de verificación de email: ${avisados} enviados, ${fallidos} fallidos, ${omitidos} omitidos`,
      );
    }

    return { avisados, omitidos, fallidos };
  }

  /**
   * Arranca el plazo de nuevo. La llama member-profile cuando el member cambia
   * su email: el nuevo tampoco está probado, así que vuelve a correr el reloj.
   * Va dentro de la misma transacción que el cambio, por eso recibe el `tx`.
   */
  static plazoNuevo(): Date {
    return new Date(Date.now() + DIAS_PARA_VERIFICAR_EMAIL * 24 * 60 * 60 * 1000);
  }

  private hash(code: string): string {
    return createHash('sha256').update(code).digest('hex');
  }
}

