import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { fechaArgentina } from '../common/utils/hora-argentina';
import { hmacIp } from '../common/utils/hash-ip';
import { ipDelCliente } from '../common/utils/proxy';
import { DEMO_LIMITE_IA, FUNCIONES_DEMO_IA, FuncionDemoIa, mensajeLimiteDemo } from './demo-ia';

type PedidoConIp = Parameters<typeof ipDelCliente>[0];

/** Semana ISO ("2026-W40") de una fecha "YYYY-MM-DD". */
export function semanaIso(fecha: string): string {
  const [a, m, d] = fecha.split('-').map(Number);
  const dia = new Date(Date.UTC(a, m - 1, d));
  const diaSemana = dia.getUTCDay() || 7; // lunes = 1 … domingo = 7
  dia.setUTCDate(dia.getUTCDate() + 4 - diaSemana); // el jueves de esa semana define el año
  const inicioAnio = new Date(Date.UTC(dia.getUTCFullYear(), 0, 1));
  const semana = Math.ceil(((dia.getTime() - inicioAnio.getTime()) / 86400000 + 1) / 7);
  return `${dia.getUTCFullYear()}-W${String(semana).padStart(2, '0')}`;
}

// Cuota semanal por IP de las pruebas de IA de la demo (ver demo-ia.ts). En
// la base y no en memoria: una semana no sobrevive a los reinicios de Cloud
// Run, y con varias instancias cada una tendría su propio contador.
@Injectable()
export class DemoIaService {
  private readonly sal: string;

  constructor(private readonly prisma: PrismaService, config: ConfigService) {
    this.sal = config.getOrThrow<string>('JWT_SECRET');
  }

  /** La IP nunca se guarda en texto plano: HMAC con un secreto del servidor. */
  private claveDe(req: PedidoConIp): string {
    return hmacIp('demo-ia', ipDelCliente(req), this.sal);
  }

  private semana(): string {
    return semanaIso(fechaArgentina(new Date()));
  }

  /**
   * Suma un uso si todavía queda cupo; si no, 429 con el mensaje de la demo.
   * Atómico (un solo INSERT … ON CONFLICT con tope): dos pedidos simultáneos
   * no pueden pasarse del límite.
   */
  async consumir(req: PedidoConIp, funcion: FuncionDemoIa): Promise<void> {
    const limite = FUNCIONES_DEMO_IA[funcion].limiteSemanal;
    const filas = await this.prisma.$queryRaw<{ count: number }[]>`
      INSERT INTO demo_ai_usage (id, ip_hash, feature, week, count, updated_at)
      VALUES (${randomUUID()}, ${this.claveDe(req)}, ${funcion}, ${this.semana()}, 1, now())
      ON CONFLICT (ip_hash, feature, week)
      DO UPDATE SET count = demo_ai_usage.count + 1, updated_at = now()
      WHERE demo_ai_usage.count < ${limite}
      RETURNING count`;
    if (filas.length === 0) {
      throw new HttpException(
        { error: DEMO_LIMITE_IA, message: mensajeLimiteDemo(funcion), funcion, limite },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  /** Devuelve el uso cuando la función falló: una prueba fallida no cuenta. */
  async devolver(req: PedidoConIp, funcion: FuncionDemoIa): Promise<void> {
    await this.prisma.$executeRaw`
      UPDATE demo_ai_usage SET count = GREATEST(count - 1, 0), updated_at = now()
      WHERE ip_hash = ${this.claveDe(req)} AND feature = ${funcion} AND week = ${this.semana()}`;
  }

  /** Lo que le queda al visitante esta semana, para mostrarlo en el panel. */
  async cupos(req: PedidoConIp) {
    const usados = await this.prisma.demoAiUsage.findMany({
      where: { ipHash: this.claveDe(req), week: this.semana() },
      select: { feature: true, count: true },
    });
    const porFuncion = new Map(usados.map((u) => [u.feature, u.count]));
    return (Object.keys(FUNCIONES_DEMO_IA) as FuncionDemoIa[]).map((funcion) => {
      const { nombre, limiteSemanal } = FUNCIONES_DEMO_IA[funcion];
      const usadas = Math.min(porFuncion.get(funcion) ?? 0, limiteSemanal);
      return { funcion, nombre, limite: limiteSemanal, usadas, restantes: limiteSemanal - usadas };
    });
  }
}
