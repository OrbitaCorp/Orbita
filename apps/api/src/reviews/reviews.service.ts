import { ConflictException, Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateReviewDto } from './dto/create-review.dto';
import { HideReviewDto } from './dto/hide-review.dto';

// Reseñas de productos: solo puede dejarla quien de verdad compró el
// producto y su pedido ya se entregó (isVerified siempre true acá — no hay
// forma de crear una reseña sin pasar por esta validación, así que la
// columna es más una constancia que un caso que se pueda dar en false).
//
// Estados considerados "ya lo tenés en tus manos": DELIVERED (online) y
// COMPLETED (venta de mostrador) — aunque en la práctica un cliente del
// storefront solo puede tener pedidos ONLINE, se deja COMPLETED por si algún
// día se linkea una cuenta de cliente a una venta de caja.
const ENTREGADOS = ['DELIVERED', 'COMPLETED'] as const;

type ReviewConCliente = {
  id: string;
  productId: string;
  orderId: string;
  text: string;
  status: string;
  hiddenReason: string | null;
  isVerified: boolean;
  createdAt: Date;
  customer: { firstName: string; lastName: string | null };
};

@Injectable()
export class ReviewsService {
  constructor(private readonly prisma: PrismaService) {}

  // "María G." — nunca el apellido completo ni el email en una reseña pública.
  private nombrePublico(c: { firstName: string; lastName: string | null }): string {
    const inicial = c.lastName?.trim()[0];
    return inicial ? `${c.firstName} ${inicial}.` : c.firstName;
  }

  private aPublico(r: ReviewConCliente) {
    return {
      id: r.id,
      productId: r.productId,
      text: r.text,
      isVerified: r.isVerified,
      createdAt: r.createdAt,
      customerName: this.nombrePublico(r.customer),
    };
  }

  // ── Elegibilidad (storefront, cliente logueado) ───────────────────────────
  // ¿Hay algún pedido entregado con este producto que este cliente todavía no
  // reseñó? Si hay más de uno, devuelve el más viejo primero (FIFO) — no
  // importa cuál, cualquiera sirve como `orderId` para crear la reseña.
  async eligibleFor(businessId: string, customerId: string, productId: string) {
    const items = await this.prisma.orderItem.findMany({
      where: {
        isConcept: false,
        variant: { productId },
        order: { businessId, customerId, deletedAt: null, status: { in: [...ENTREGADOS] } },
      },
      select: { orderId: true, order: { select: { createdAt: true } } },
      orderBy: { order: { createdAt: 'asc' } },
    });
    const orderIds = [...new Set(items.map((i) => i.orderId))];
    if (orderIds.length === 0) return { eligible: false, orderId: null };

    const yaReseniados = await this.prisma.review.findMany({
      where: { customerId, productId, orderId: { in: orderIds } },
      select: { orderId: true },
    });
    const reseniadosSet = new Set(yaReseniados.map((r) => r.orderId));
    const pendiente = orderIds.find((id) => !reseniadosSet.has(id)) ?? null;

    return { eligible: pendiente !== null, orderId: pendiente };
  }

  // ── Alta (storefront, cliente logueado) ───────────────────────────────────
  async create(businessId: string, customerId: string, dto: CreateReviewDto) {
    const order = await this.prisma.order.findFirst({
      where: { id: dto.orderId, businessId, customerId, deletedAt: null, status: { in: [...ENTREGADOS] } },
      select: { id: true },
    });
    if (!order) {
      throw new NotFoundException('Ese pedido no existe o todavía no se entregó, no se puede reseñar antes de eso.');
    }

    const tieneProducto = await this.prisma.orderItem.findFirst({
      where: { orderId: dto.orderId, isConcept: false, variant: { productId: dto.productId } },
    });
    if (!tieneProducto) {
      throw new UnprocessableEntityException('Ese producto no pertenece a este pedido.');
    }

    try {
      const r = await this.prisma.review.create({
        data: { businessId, productId: dto.productId, customerId, orderId: dto.orderId, text: dto.text, isVerified: true },
        include: { customer: { select: { firstName: true, lastName: true } } },
      });
      return this.aPublico(r);
    } catch (e) {
      // (customerId, productId, orderId) es @@unique — ya dejó una reseña de
      // este producto para este pedido puntual.
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictException('Ya dejaste una reseña de este producto para este pedido.');
      }
      throw e;
    }
  }

  // ── Ocultar (panel, owner/admin) ──────────────────────────────────────────
  async hide(businessId: string, id: string, dto: HideReviewDto) {
    const escrito = await this.prisma.review.updateMany({
      where: { id, businessId },
      data: { status: 'HIDDEN', hiddenReason: dto.hiddenReason },
    });
    if (escrito.count === 0) throw new NotFoundException('Reseña no encontrada');
    return { ok: true };
  }

  // ── Listado público (storefront, sin login) ───────────────────────────────
  // Resuelve el negocio a partir del producto — esta ruta no vive bajo
  // /storefront/:slug, así que no hay slug de donde partir.
  async listForProduct(productId: string) {
    const producto = await this.prisma.product.findFirst({ where: { id: productId, deletedAt: null }, select: { id: true } });
    if (!producto) throw new NotFoundException('Producto no encontrado');

    const rows = await this.prisma.review.findMany({
      where: { productId, status: 'VISIBLE' },
      orderBy: { createdAt: 'desc' },
      include: { customer: { select: { firstName: true, lastName: true } } },
    });
    return rows.map((r) => this.aPublico(r));
  }
}
