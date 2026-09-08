import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { Discount, DiscountScope } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { BusinessesService } from '../businesses/businesses.service';
import { UpsertDiscountDto } from './dto/upsert-discount.dto';

// "Oferta relámpago" (paquete Avanzado, RBT-675) — lado del PANEL.
//
// Para el dueño es un TIPO más del selector de Descuentos, al lado de
// "% Producto" o "$ Fijo Ticket": un porcentaje en productos elegidos que
// termina a una hora exacta y se muestra en la portada con un reloj. Para la
// API es un Discount PERCENT_PRODUCT con `countdown: true` en el DTO; este
// service escribe la fila `CountdownConfig` que apunta a ese descuento. No
// tiene título, fecha ni textos propios: todo sale del descuento (el nombre,
// el vencimiento, a qué productos aplica).
//
// Habilitarlo o no es un interruptor por negocio en la tarjeta de Avanzado
// (`Business.flashSaleEnabled`, ver CountdownService#setEnabled): con el
// interruptor apagado, Descuentos no ofrece el tipo y guardar uno da 400.
//
// Historia: hubo un módulo aparte en Avanzado con formulario propio (se
// descartó: el dueño lo buscaba en Descuentos y eran dos formularios para una
// sola promo) y después un interruptor al final del formulario del descuento
// más una píldora en el listado (se descartó: quedaba escondido y no se leía
// como "un tipo de promo"). De ahí el tipo.
//
// Se persiste en `CountdownConfig` (una fila por negocio, ver schema.prisma)
// con `discountId` apuntando al descuento elegido. Solo UN descuento por
// negocio puede tenerla a la vez: en la portada hay un solo reloj, y dos
// promos "urgentes" al mismo tiempo se anulan entre sí. Prenderla en otro
// descuento la mueve.
//
// Lo que se muestra en la tienda lo resuelve CountdownService (módulo
// countdown, endpoint público) leyendo esta misma fila; acá solo se escribe.
// Está en DiscountsModule y no allá porque StorefrontModule importa
// DiscountsModule, y DiscountsModule → CountdownModule → StorefrontModule
// sería un ciclo.
@Injectable()
export class DiscountCountdownService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly businesses: BusinessesService,
  ) {}

  // Todo lo que puede fallar se chequea ANTES de escribir el descuento, así
  // un 400 de acá no deja el descuento guardado a medias sin su reloj.
  async validarAntesDeGuardar(businessId: string, dto: UpsertDiscountDto): Promise<void> {
    if (dto.countdown !== true) return;
    await this.validar(businessId, { scope: dto.scope as DiscountScope, endDate: dto.endDate ? new Date(dto.endDate) : null });
  }

  // Las mismas reglas para un descuento que ya está en la base (la píldora
  // del listado prende el reloj sin pasar por el formulario).
  async validar(businessId: string, discount: Pick<Discount, 'scope' | 'endDate'>): Promise<void> {
    if (!(await this.businesses.hasActiveAddon(businessId, 'ADVANCED'))) {
      throw new ForbiddenException('La oferta relámpago es parte del paquete Avanzado.');
    }
    const negocio = await this.prisma.business.findUnique({ where: { id: businessId }, select: { flashSaleEnabled: true } });
    if (!negocio?.flashSaleEnabled) {
      throw new BadRequestException('La oferta relámpago está deshabilitada: prendela desde Avanzado para poder usarla.');
    }
    if (discount.scope === 'TICKET') {
      throw new BadRequestException('La oferta relámpago es para productos o categorías: son los que se muestran en la portada.');
    }
    if (!discount.endDate) {
      throw new BadRequestException('La oferta relámpago necesita fecha y hora de fin.');
    }
    if (discount.endDate.getTime() <= Date.now()) {
      throw new BadRequestException('La fecha de fin ya pasó: corré la fecha para poder mostrar la oferta relámpago.');
    }
  }

  // Prende o apaga la cuenta regresiva de un descuento ya guardado. Con
  // `prender` en true la fila pasa a apuntar a este descuento (si otro la
  // tenía, la pierde) y se refrescan nombre y fecha; con false solo se apaga
  // si era de este descuento. Se llama después de create/update, cuando el
  // Discount ya está en la base.
  async aplicar(businessId: string, discount: Pick<Discount, 'id' | 'name' | 'endDate'>, prender: boolean): Promise<void> {
    const actual = await this.prisma.countdownConfig.findUnique({
      where: { businessId },
      select: { discountId: true },
    });

    if (!prender) {
      if (actual?.discountId === discount.id) {
        await this.prisma.countdownConfig.update({ where: { businessId }, data: { isActive: false } });
      }
      return;
    }

    // validarAntesDeGuardar ya lo garantizó; el chequeo queda por si algún
    // día se llama desde otro lado.
    if (!discount.endDate) {
      throw new BadRequestException('Para mostrar la cuenta regresiva, el descuento necesita una fecha de fin.');
    }

    const datos = {
      // El título del reloj es el nombre del descuento: lo que el cliente lee
      // en la portada es lo mismo que ve después en el carrito.
      title: discount.name,
      subtitle: null,
      endDate: discount.endDate,
      finishedMessage: null,
      ctaText: null,
      ctaLink: null,
      placement: 'HOME' as const,
      showProductsOnHome: true,
      isActive: true,
      discountId: discount.id,
    };
    await this.prisma.countdownConfig.upsert({
      where: { businessId },
      create: { businessId, ...datos },
      update: datos,
    });
  }

  // Si el descuento se borra, su reloj se apaga (la fila queda, apagada, por
  // si el dueño la prende en otro descuento). Desactivar el descuento no pasa
  // por acá: eso lo resuelve el endpoint público al leer, mirando
  // `discount.isActive`, así volver a activarlo no obliga a prender el reloj
  // de nuevo.
  async apagarSiEsDe(businessId: string, discountId: string): Promise<void> {
    await this.prisma.countdownConfig.updateMany({
      where: { businessId, discountId },
      data: { isActive: false },
    });
  }

  // Qué descuento tiene la cuenta regresiva prendida, para marcarlo en el
  // listado y precargar el interruptor al editar. null si ninguno.
  async discountIdConCountdown(businessId: string): Promise<string | null> {
    const cfg = await this.prisma.countdownConfig.findUnique({
      where: { businessId },
      select: { discountId: true, isActive: true },
    });
    return cfg?.isActive ? cfg.discountId : null;
  }
}
