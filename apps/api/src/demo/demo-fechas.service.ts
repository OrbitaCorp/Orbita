import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

// ─── Las fechas de la demo avanzan con el calendario ────────────────────────
//
// Los datos de la demo (pedidos, pagos, visitas, reseñas…) se sembraron
// relativos a un momento, anotado en Business.demoFechasAl. Si nadie los
// tocara, en unos meses "hoy", "esta semana" y "este mes" quedarían vacíos en
// el dashboard y los reportes. En vez de congelar el reloj (el "hoy" se
// calcula en el navegador Y en decenas de servicios), se corre cada fecha
// hacia adelante lo que pasó desde demoFechasAl: el visitante ve siempre la
// misma foto relativa ("hoy entraron 5 pedidos") con fechas actuales, y
// servidor y navegador coinciden sin tocar ningún reporte.
//
// Corre en la tarea nocturna (internal-cron) y, de respaldo, cada vez que un
// visitante abre el panel de la demo si pasó más de MARGEN (ver
// AuthService.demoSession) — así "hoy" sigue teniendo pedidos durante el día.

// Tabla → columnas de fecha a correr, y cómo se llega al negocio. Las
// columnas salen del schema (Prisma.dmmf); se dejan afuera las que no son
// "cuándo pasó algo" (Customer.birthDate, lockedUntil).
type Tabla = { tabla: string; columnas: string[]; negocio: string };
const DIRECTO = 'business_id = $1';
export const TABLAS_DEMO: Tabla[] = [
  { tabla: 'products', columnas: ['created_at', 'updated_at', 'deleted_at'], negocio: DIRECTO },
  { tabla: 'product_variants', columnas: ['created_at', 'updated_at'], negocio: 'product_id IN (SELECT id FROM products WHERE business_id = $1)' },
  { tabla: 'product_images', columnas: ['created_at'], negocio: 'product_id IN (SELECT id FROM products WHERE business_id = $1)' },
  { tabla: 'categories', columnas: ['created_at', 'updated_at'], negocio: DIRECTO },
  { tabla: 'tags', columnas: ['created_at'], negocio: DIRECTO },
  { tabla: 'customers', columnas: ['created_at', 'updated_at', 'deleted_at'], negocio: DIRECTO },
  { tabla: 'addresses', columnas: ['created_at', 'updated_at'], negocio: 'customer_id IN (SELECT id FROM customers WHERE business_id = $1)' },
  { tabla: 'orders', columnas: ['created_at', 'updated_at', 'deleted_at'], negocio: DIRECTO },
  { tabla: 'order_status_history', columnas: ['created_at'], negocio: 'order_id IN (SELECT id FROM orders WHERE business_id = $1)' },
  { tabla: 'payments', columnas: ['paid_at', 'verified_at', 'created_at', 'updated_at'], negocio: DIRECTO },
  { tabla: 'discounts', columnas: ['start_date', 'end_date', 'created_at', 'updated_at', 'deleted_at'], negocio: DIRECTO },
  { tabla: 'discount_redemptions', columnas: ['created_at'], negocio: DIRECTO },
  { tabla: 'stock_movements', columnas: ['created_at'], negocio: DIRECTO },
  { tabla: 'reviews', columnas: ['created_at', 'updated_at'], negocio: DIRECTO },
  { tabla: 'conversations', columnas: ['created_at', 'updated_at'], negocio: DIRECTO },
  { tabla: 'messages', columnas: ['created_at'], negocio: 'conversation_id IN (SELECT id FROM conversations WHERE business_id = $1)' },
  { tabla: 'returns', columnas: ['created_at', 'updated_at'], negocio: DIRECTO },
  { tabla: 'credit_notes', columnas: ['expires_at', 'created_at', 'updated_at'], negocio: DIRECTO },
  { tabla: 'cancellation_requests', columnas: ['created_at', 'updated_at'], negocio: DIRECTO },
  { tabla: 'game_sessions', columnas: ['created_at', 'finished_at', 'claimed_at'], negocio: DIRECTO },
  { tabla: 'store_visits', columnas: ['created_at'], negocio: DIRECTO },
  { tabla: 'notifications', columnas: ['created_at'], negocio: DIRECTO },
];

/** Menos que esto, no vale la pena reescribir miles de filas. */
export const MARGEN_MS = 30 * 60 * 1000;

@Injectable()
export class DemoFechasService {
  private readonly logger = new Logger(DemoFechasService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** Pone al día las fechas de todo negocio demo. Devuelve cuántos movió. */
  async ponerAlDia(ahora = new Date()): Promise<number> {
    const negocios = await this.prisma.business.findMany({
      where: { isDemo: true, demoFechasAl: { not: null, lt: new Date(ahora.getTime() - MARGEN_MS) } },
      select: { id: true, demoFechasAl: true },
    });
    let movidos = 0;
    for (const n of negocios) {
      if (await this.correr(n.id, n.demoFechasAl!, ahora)) movidos++;
    }
    return movidos;
  }

  private async correr(businessId: string, desde: Date, hasta: Date): Promise<boolean> {
    const ms = hasta.getTime() - desde.getTime();
    return this.prisma.$transaction(async (tx) => {
      // Primero el ancla, condicionada al valor leído: si dos pedidos llegan
      // juntos, el segundo no encuentra la fila (0 actualizadas) y no corre
      // las fechas dos veces. La fila queda bloqueada hasta el commit.
      const tomado = await tx.business.updateMany({
        where: { id: businessId, demoFechasAl: desde },
        data: { demoFechasAl: hasta },
      });
      if (tomado.count === 0) return false;
      for (const t of TABLAS_DEMO) {
        const sets = t.columnas.map((c) => `"${c}" = "${c}" + ($2 * interval '1 millisecond')`).join(', ');
        await tx.$executeRawUnsafe(`UPDATE "${t.tabla}" SET ${sets} WHERE ${t.negocio}`, businessId, ms);
      }
      this.logger.log(`Demo ${businessId}: fechas corridas ${Math.round(ms / 60000)} min`);
      return true;
    }, { timeout: 60000, isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted });
  }
}
