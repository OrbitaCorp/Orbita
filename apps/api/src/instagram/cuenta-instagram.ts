import type { PrismaService } from '../prisma/prisma.service';

/** La cuenta de Instagram que el negocio tiene conectada (o la última que tuvo, si está desconectado). */
export async function cuentaInstagramDe(prisma: Pick<PrismaService, 'instagramConnection'>, businessId: string): Promise<string | null> {
  const c = await prisma.instagramConnection.findUnique({ where: { businessId }, select: { igUserId: true } });
  return c?.igUserId ?? null;
}

/**
 * Para filtrar las charlas de Instagram de un negocio: solo las de la cuenta conectada. Las de una cuenta anterior no
 * se pueden contestar (el IGSID del cliente vale solo para esa cuenta), así que no se muestran; vuelven a verse si se
 * reconecta esa misma cuenta. Sin conexión, no filtra.
 */
export async function filtroDeCuentaInstagram(
  prisma: Pick<PrismaService, 'instagramConnection'>,
  businessId: string,
): Promise<{ instagramCuenta?: string }> {
  const cuenta = await cuentaInstagramDe(prisma, businessId);
  return cuenta ? { instagramCuenta: cuenta } : {};
}
