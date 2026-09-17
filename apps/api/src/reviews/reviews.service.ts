import { ConflictException, Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateReviewDto } from './dto/create-review.dto';
import { HideReviewDto } from './dto/hide-review.dto';
import { AuditService } from '../audit/audit.service';

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
  constructor(
    private readonly prisma: PrismaService,
    // Moderar una reseña es tocar lo que ve un cliente sobre su propia
    // compra: tiene que quedar quién la ocultó y por qué. Opcional solo para
    // los tests, igual que en el resto de los services.
    private readonly audit?: AuditService,
  ) {}

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
  // Una sola reseña por cliente y producto (sin importar en qué pedido lo
  // compró — ver @@unique([customerId, productId]) en el schema): si ya
  // dejó una, no es elegible, punto. Si no, alcanza con CUALQUIER pedido
  // entregado que tenga el producto — se devuelve el más viejo (FIFO), pero
  // cualquiera sirve como `orderId` para crear la reseña.
  async eligibleFor(businessId: string, customerId: string, productId: string) {
    const yaReseniado = await this.prisma.review.findUnique({
      where: { customerId_productId: { customerId, productId } },
      select: { id: true },
    });
    if (yaReseniado) return { eligible: false, orderId: null };

    const item = await this.prisma.orderItem.findFirst({
      where: {
        isConcept: false,
        variant: { productId },
        order: { businessId, customerId, deletedAt: null, status: { in: [...ENTREGADOS] } },
      },
      select: { orderId: true },
      orderBy: { order: { createdAt: 'asc' } },
    });

    return { eligible: !!item, orderId: item?.orderId ?? null };
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
      // (customerId, productId) es @@unique — ya dejó una reseña de este
      // producto, sin importar en qué pedido (una sola por cliente y
      // producto, ver el comentario en el schema).
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictException('Ya dejaste una reseña de este producto.');
      }
      throw e;
    }
  }

  // ── Ocultar (panel, owner/admin) ──────────────────────────────────────────
  async hide(businessId: string, id: string, dto: HideReviewDto, memberId?: string) {
    const escrito = await this.prisma.review.updateMany({
      where: { id, businessId },
      data: { status: 'HIDDEN', hiddenReason: dto.hiddenReason },
    });
    if (escrito.count === 0) throw new NotFoundException('Reseña no encontrada');

    await this.audit?.registrar({
      businessId, memberId, entityType: 'review', entityId: id, action: 'UPDATE',
      changes: [
        { field: 'status', before: 'VISIBLE', after: 'HIDDEN' },
        { field: 'hiddenReason', before: null, after: dto.hiddenReason },
      ],
    });
    return { ok: true };
  }

  // Deshace el ocultamiento. Existe porque sin esto moderar era de una sola
  // vía: una reseña ocultada por error no volvía nunca (hallazgo
  // `resenas-sin-moderacion-panel`). Limpia el motivo: el que quedó guardado
  // era el de ESA vez y no aplica si mañana se vuelve a ocultar.
  async show(businessId: string, id: string, memberId?: string) {
    const actual = await this.prisma.review.findFirst({
      where: { id, businessId },
      select: { hiddenReason: true },
    });
    if (!actual) throw new NotFoundException('Reseña no encontrada');

    await this.prisma.review.update({
      where: { id },
      data: { status: 'VISIBLE', hiddenReason: null },
    });

    await this.audit?.registrar({
      businessId, memberId, entityType: 'review', entityId: id, action: 'UPDATE',
      changes: [
        { field: 'status', before: 'HIDDEN', after: 'VISIBLE' },
        { field: 'hiddenReason', before: actual.hiddenReason, after: null },
      ],
    });
    return { ok: true };
  }

  // ── Listado del panel (dueño/equipo) ──────────────────────────────────────
  // A diferencia del público, este trae TODAS: las ocultas también, con su
  // motivo y el nombre completo del cliente. No es la misma vista con un
  // filtro distinto — es otra audiencia, y por eso no reusa aPublico().
  async listForPanel(businessId: string, productId: string) {
    const producto = await this.prisma.product.findFirst({
      where: { id: productId, businessId, deletedAt: null },
      select: { id: true, name: true },
    });
    if (!producto) throw new NotFoundException('Producto no encontrado');

    const rows = await this.prisma.review.findMany({
      where: { businessId, productId },
      orderBy: { createdAt: 'desc' },
      take: 200,
      include: {
        customer: { select: { firstName: true, lastName: true, email: true } },
        order: { select: { orderNumber: true } },
      },
    });

    return {
      producto,
      // El resumen es lo que hace útil abrir esto: de un vistazo se sabe si
      // hay algo escondido sin tener que contar la lista.
      total: rows.length,
      ocultas: rows.filter((r) => r.status === 'HIDDEN').length,
      resenas: rows.map((r) => ({
        id: r.id,
        text: r.text,
        status: r.status,
        hiddenReason: r.hiddenReason,
        isVerified: r.isVerified,
        createdAt: r.createdAt,
        orderNumber: r.order.orderNumber,
        // Nombre completo y email: acá el dueño necesita saber quién escribió
        // para poder contestarle, no el "María G." del storefront.
        customerName: [r.customer.firstName, r.customer.lastName].filter(Boolean).join(' '),
        customerEmail: r.customer.email,
      })),
    };
  }

  // ── Listado público (storefront, sin login) ───────────────────────────────
  // Resuelve el negocio a partir del producto — esta ruta no vive bajo
  // /storefront/:slug, así que no hay slug de donde partir.
  async listForProduct(productId: string) {
    const producto = await this.prisma.product.findFirst({ where: { id: productId, deletedAt: null }, select: { id: true } });
    if (!producto) throw new NotFoundException('Producto no encontrado');

    // Las 100 más nuevas: antes venían todas, sin tope (auditoría interna
    // 10/09, ítem api.reviews).
    const rows = await this.prisma.review.findMany({
      where: { productId, status: 'VISIBLE' },
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: { customer: { select: { firstName: true, lastName: true } } },
    });
    return rows.map((r) => this.aPublico(r));
  }
}
