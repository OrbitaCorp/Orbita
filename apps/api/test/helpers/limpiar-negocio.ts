import { PrismaClient } from '@prisma/client';

/**
 * Borra por completo un negocio creado por un e2e, con todo lo que le cuelga.
 *
 * Hallazgo `tiendas-prueba-publicadas` de la auditoría interna: los e2e venían
 * creando negocios de verdad (24 tiendas quedaron publicadas en producción) y
 * no limpiaban nada. Desde ahora, todo e2e que cree un negocio lo borra en su
 * `afterAll` con esto.
 *
 * Cómo funciona: `businesses` tiene 36 relaciones y solo una borra en cascada,
 * así que no alcanza con `business.delete()`. En vez de mantener a mano el
 * orden de 40 tablas, se borra por pasadas: en cada pasada se intenta con
 * todas las tablas que tienen `business_id` y las que fallan por una FK
 * quedan para la siguiente, cuando sus hijas ya no están. Los hijos sin
 * `business_id` (variantes, ítems de pedido, mensajes, reglas de descuento)
 * ya caen solos: sus FKs son `onDelete: Cascade` contra el padre.
 *
 * Nunca toca nada fuera de los ids que se le pasan.
 */
export async function limpiarNegocios(prisma: PrismaClient, businessIds: string[]): Promise<void> {
  const ids = businessIds.filter(Boolean);
  if (ids.length === 0) return;

  const tablas = await tablasConBusinessId(prisma);
  let pendientes = tablas;

  for (let pasada = 0; pasada < 8 && pendientes.length > 0; pasada++) {
    const fallaron: string[] = [];
    for (const tabla of pendientes) {
      try {
        await prisma.$executeRawUnsafe(`DELETE FROM public."${tabla}" WHERE business_id = ANY($1::text[])`, ids);
      } catch {
        fallaron.push(tabla); // la referencia alguna hija que todavía no se borró
      }
    }
    if (fallaron.length === pendientes.length) break; // no avanzó: no insistir
    pendientes = fallaron;
  }

  await prisma.$executeRawUnsafe(`DELETE FROM public."businesses" WHERE id = ANY($1::text[])`, ids);
}

/** Tablas de `public` con columna `business_id`, sin `businesses` misma. */
async function tablasConBusinessId(prisma: PrismaClient): Promise<string[]> {
  const filas = await prisma.$queryRawUnsafe<Array<{ table_name: string }>>(
    `SELECT c.table_name FROM information_schema.columns c
     JOIN information_schema.tables t ON t.table_schema = c.table_schema AND t.table_name = c.table_name
     WHERE c.table_schema = 'public' AND c.column_name = 'business_id' AND t.table_type = 'BASE TABLE'`,
  );
  return filas.map((f) => f.table_name);
}
