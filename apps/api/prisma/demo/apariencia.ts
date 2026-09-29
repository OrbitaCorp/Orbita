// ─── Apariencia de la tienda demo: marca y home ─────────────────────────────
//
// Separado del contenido (sembrar.ts) para poder iterar el diseño sin
// resembrar todo: `pnpm seed:demo --solo-apariencia` corre solo esto.
//
// Logo: diseño propio de la demo (media/marca/logo.svg, exportado a PNG) —
// una N con una chispa sobre el degradé "Nébula" de las pantallas de las fotos.
import type { PrismaClient } from '@prisma/client';
import { almacenamiento } from './sembrar';

export async function sembrarApariencia(prisma: PrismaClient, businessId: string) {
  const negocio = await prisma.business.findUniqueOrThrow({ where: { id: businessId } });
  if (!negocio.isDemo) throw new Error('sembrarApariencia solo corre sobre el negocio demo (isDemo).');
  const subir = almacenamiento(businessId);

  console.log('Apariencia: logo…');
  const logoUrl = await subir.imagen('marca/logo-512.png', 'business-logos');
  const faviconUrl = await subir.imagen('marca/favicon-64.png', 'business-logos');
  await prisma.storefrontConfig.update({ where: { businessId }, data: { logoUrl, faviconUrl } });
}
