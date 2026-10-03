import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { fechaArgentina } from '../utils/hora-argentina';

// Cuota diaria compartida en Postgres. Reemplaza al contador que vivía en
// memoria: con varias instancias de Cloud Run el tope real era por instancia
// (multiplicado por la cantidad que hubiera levantadas) y se perdía en cada
// reinicio. Ahora la cuentan Orbi, las ayudas de IA de productos y el estudio
// de imágenes con el mismo contador, cada uno con su prefijo de clave
// (`orbi-panel:<negocio>`, `orbi-wizard:<ipHash>`, `ai-assist:<negocio>`, …).
//
// El día es el de Argentina: la cuota se renueva a la medianoche de acá, no de
// Greenwich. Vive fuera de orbi/ para no armar la dependencia circular
// Orbi → Products → Orbi (PrismaModule es global, así que no hay imports).
@Injectable()
export class CuotaService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Suma un uso a `clave` y dice si todavía entraba en `limite`. Atómico: un
   * solo INSERT … ON CONFLICT con tope, así que dos pedidos simultáneos no
   * pueden pasarse del límite, y pasado el tope el contador no sigue subiendo
   * (mismo patrón que DemoIaService.consumir). Sin fila devuelta = rechazo.
   */
  async consumir(clave: string, limite: number): Promise<boolean> {
    const dia = fechaArgentina(new Date()); // 'YYYY-MM-DD'
    const filas = await this.prisma.$queryRaw<{ count: number }[]>`
      INSERT INTO daily_quota (key, day, count) VALUES (${clave}, ${dia}, 1)
      ON CONFLICT (key, day) DO UPDATE SET count = daily_quota.count + 1
      WHERE daily_quota.count < ${limite}
      RETURNING count`;
    return filas.length > 0;
  }

  /** Devuelve un uso del día (un mensaje que no se pudo atender). Nunca baja de 0. Best-effort. */
  async devolver(clave: string): Promise<void> {
    const dia = fechaArgentina(new Date());
    try {
      await this.prisma.$executeRaw`
        UPDATE daily_quota SET count = count - 1 WHERE key = ${clave} AND day = ${dia} AND count > 0`;
    } catch {
      // Si falla, el peor caso es el de hoy: el mensaje fallido igual contó.
    }
  }
}
