// ─── Paquete Avanzado de la demo: juegos con premio y modal de anuncio ─────
//
// Los seis juegos quedan activos y el modal de anuncio también, para que el
// panel de la demo los muestre configurados. En la tienda demo NO se abren
// solos: se prueban desde el menú flotante del home (MenuDemoTienda.tsx en
// apps/web), y las partidas y los cupones de premio los simula el navegador
// (apps/web/src/lib/demo/recursos/juegos.ts).
//
// Cada juego cumple maxPercent = percentPerWin × maxAttempts y usa 4 segundos
// por tiro: juegos.ts deduce esos dos datos de /games/active, que no los trae.
import { Prisma, type PrismaClient } from '@prisma/client';
import { idDemo } from './sembrar';

const JUEGOS: { type: string; name: string; percentPerWin: number; maxAttempts: number }[] = [
  { type: 'GOAL', name: 'Metela y ganá', percentPerWin: 3, maxAttempts: 5 },
  { type: 'HOOP', name: 'Encestá y ganá', percentPerWin: 3, maxAttempts: 5 },
  { type: 'DART', name: 'Al blanco y ganá', percentPerWin: 2, maxAttempts: 5 },
  { type: 'FISH', name: 'Pescá tu premio', percentPerWin: 4, maxAttempts: 3 },
  { type: 'GOLF', name: 'Hoyo en uno y ganá', percentPerWin: 5, maxAttempts: 3 },
  { type: 'CUT', name: 'Cortá y ganá', percentPerWin: 5, maxAttempts: 4 },
];

export async function sembrarAvanzado(prisma: PrismaClient, businessId: string) {
  console.log('Juegos con premio y modal de anuncio…');
  for (const [i, j] of JUEGOS.entries()) {
    const datos = {
      name: j.name,
      isActive: true,
      percentPerWin: new Prisma.Decimal(j.percentPerWin),
      maxPercent: new Prisma.Decimal(j.percentPerWin * j.maxAttempts),
      maxAttempts: j.maxAttempts,
      timeLimitSeconds: 4,
      startDate: null,
      endDate: null,
    };
    await prisma.game.upsert({
      where: { businessId_type: { businessId, type: j.type } },
      // createdAt escalonado: /games/active los ordena por fecha de creación.
      create: { id: idDemo(`juego:${j.type}`), businessId, type: j.type, ...datos, createdAt: new Date(Date.UTC(2026, 8, 1, 12, i)) },
      update: datos,
    });
  }

  // El mismo texto que el primer anuncio del menú de la demo (ANUNCIOS_DEMO).
  const modal = {
    isActive: true,
    title: '2x1 en accesorios para el celu',
    message: 'Llevá dos fundas, cargadores o soportes para auto y pagá uno. El descuento se aplica solo en el carrito.',
    badge: '2x1',
    code: null,
    ctaText: 'Ver accesorios',
    ctaLink: '/catalogo?cat=celulares-y-accesorios',
    startDate: null,
    endDate: null,
  };
  await prisma.promoModal.upsert({
    where: { businessId },
    create: { id: idDemo('modal-anuncio'), businessId, ...modal },
    update: modal,
  });
}
