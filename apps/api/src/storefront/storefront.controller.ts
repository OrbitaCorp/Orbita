import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { Public } from '../common/decorators/public.decorator';
import { FullModeOnly } from '../common/decorators/full-mode-only.decorator';
import { StorefrontService } from './storefront.service';
import { CheckoutDto } from './dto/checkout.dto';
import { StorefrontProductsQueryDto } from './dto/storefront-products-query.dto';

@Controller('storefront')
export class StorefrontController {
  constructor(private readonly storefrontService: StorefrontService) {}

  @Get(':slug')
  @Public()
  config(@Param('slug') slug: string) {
    return this.storefrontService.getConfig(slug);
  }

  @Get(':slug/products')
  @Public()
  products(@Param('slug') slug: string, @Query() query: StorefrontProductsQueryDto) {
    return this.storefrontService.listProducts(slug, query);
  }

  @Get(':slug/products/:id')
  @Public()
  productDetail(@Param('slug') slug: string, @Param('id') id: string) {
    return this.storefrontService.getProduct(slug, id);
  }

  @Get(':slug/categories')
  @Public()
  categories(@Param('slug') slug: string) {
    return this.storefrontService.listCategories(slug);
  }

  @Post(':slug/checkout')
  @Public()
  @FullModeOnly()
  checkout(@Param('slug') slug: string, @Body() dto: CheckoutDto) {
    void this.storefrontService;
    return { message: 'not implemented' };
  }

  @Get(':slug/orders/:orderNumber/tracking')
  @Public()
  @FullModeOnly()
  tracking(@Param('slug') slug: string, @Param('orderNumber') orderNumber: string) {
    void this.storefrontService;
    return { message: 'not implemented' };
  }

  @Get(':slug/coupons')
  @Public()
  @FullModeOnly()
  coupons(@Param('slug') slug: string) {
    void this.storefrontService;
    return { message: 'not implemented' };
  }

  @Get(':slug/exclusive-discount/:code')
  @Public()
  @FullModeOnly()
  exclusiveDiscount(@Param('slug') slug: string, @Param('code') code: string) {
    void this.storefrontService;
    return { message: 'not implemented' };
  }
}
