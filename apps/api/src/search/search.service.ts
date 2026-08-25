import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

// Cuántos resultados por grupo. La búsqueda es para saltar rápido a algo,
// no para listar — para eso está cada sección con sus filtros.
const LIMITE_POR_GRUPO = 5;
const LARGO_MINIMO = 2;

// (Fase 4 — Alex) La búsqueda global del header del panel.
//
// Busca con `contains` case-insensitive en los campos que el dueño realmente
// usa para encontrar cosas: número de pedido, nombre/email/DNI del cliente,
// nombre/SKU/código de barras del producto, y nombre/código del descuento o
// cupón. Cada grupo se saltea si el miembro no tiene el permiso de ver esa
// sección (mismos códigos que usan los guards de cada módulo).
@Injectable()
export class SearchService {
  constructor(private readonly prisma: PrismaService) {}

  async search(businessId: string, permissions: string[], q: string) {
    const query = q.trim();
    if (query.length < LARGO_MINIMO) {
      return { query, pedidos: [], clientes: [], productos: [], descuentos: [] };
    }

    const puede = (permiso: string) => permissions.includes(permiso);
    const contains = { contains: query, mode: Prisma.QueryMode.insensitive };

    // Si lo tipeado es un número, también se busca por número de pedido exacto
    // o por prefijo (buscar "12" encuentra el #12, #120, #1234...).
    const numero = Number(query.replace(/^#/, ''));
    const esNumero = Number.isInteger(numero) && numero > 0;

    const [pedidos, clientes, productos, descuentos] = await Promise.all([
      puede('orders.view')
        ? this.prisma.order.findMany({
            where: {
              businessId,
              deletedAt: null,
              OR: [
                ...(esNumero ? [{ orderNumber: numero }] : []),
                { customer: { OR: [{ firstName: contains }, { lastName: contains }, { email: contains }] } },
              ],
            },
            orderBy: { createdAt: 'desc' },
            take: LIMITE_POR_GRUPO,
            select: {
              id: true,
              orderNumber: true,
              total: true,
              status: true,
              createdAt: true,
              customer: { select: { firstName: true, lastName: true } },
            },
          })
        : Promise.resolve([]),
      puede('customers.view')
        ? this.prisma.customer.findMany({
            where: {
              businessId,
              deletedAt: null,
              OR: [{ firstName: contains }, { lastName: contains }, { email: contains }, { phone: contains }, { dni: contains }],
            },
            orderBy: { createdAt: 'desc' },
            take: LIMITE_POR_GRUPO,
            select: { id: true, firstName: true, lastName: true, email: true, phone: true },
          })
        : Promise.resolve([]),
      puede('catalog.view')
        ? this.prisma.product.findMany({
            where: {
              businessId,
              deletedAt: null,
              OR: [
                { name: contains },
                { variants: { some: { OR: [{ sku: contains }, { barcode: contains }] } } },
              ],
            },
            orderBy: { createdAt: 'desc' },
            take: LIMITE_POR_GRUPO,
            select: {
              id: true,
              name: true,
              basePrice: true,
              status: true,
              // La foto principal, para que el resultado se reconozca de un
              // vistazo en el dropdown del header (pedido de Ale 24/08).
              images: {
                orderBy: [{ isPrimary: 'desc' as const }, { position: 'asc' as const }],
                take: 1,
                select: { url: true },
              },
            },
          })
        : Promise.resolve([]),
      // Descuentos y cupones comparten tabla: `code` null = descuento automático.
      // El módulo de descuentos no pide permiso para listar (solo para editar),
      // así que acá tampoco.
      this.prisma.discount.findMany({
        where: {
          businessId,
          OR: [{ name: contains }, { code: contains }],
        },
        orderBy: { createdAt: 'desc' },
        take: LIMITE_POR_GRUPO,
        select: { id: true, name: true, code: true, isActive: true },
      }),
    ]);

    return {
      query,
      pedidos: pedidos.map((o) => ({
        id: o.id,
        orderNumber: o.orderNumber,
        customerName: o.customer ? [o.customer.firstName, o.customer.lastName].filter(Boolean).join(' ') : null,
        total: Number(o.total),
        status: o.status,
        createdAt: o.createdAt.toISOString(),
      })),
      clientes: clientes.map((c) => ({
        id: c.id,
        nombre: [c.firstName, c.lastName].filter(Boolean).join(' '),
        email: c.email,
        phone: c.phone,
      })),
      productos: productos.map((p) => ({
        id: p.id,
        name: p.name,
        basePrice: Number(p.basePrice),
        status: p.status,
        imageUrl: p.images[0]?.url ?? null,
      })),
      descuentos: descuentos.map((d) => ({
        id: d.id,
        name: d.name,
        code: d.code,
        isActive: d.isActive,
        esCupon: d.code !== null,
      })),
    };
  }
}
