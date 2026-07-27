import { Body, Controller, Get, Post } from '@nestjs/common';
import { Public } from '../common/decorators/public.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { MercadopagoService } from './mercadopago.service';
import { CreateMpOrderDto } from './dto/create-mp-order.dto';

@Controller('mercadopago')
export class MercadopagoController {
  constructor(private readonly mercadopagoService: MercadopagoService) {}

  @Get('oauth/connect')
  @Roles('owner', 'admin')
  connect() {
    void this.mercadopagoService;
    return { message: 'not implemented' };
  }

  @Get('oauth/callback')
  @Public()
  callback() {
    void this.mercadopagoService;
    return { message: 'not implemented' };
  }

  @Post('oauth/disconnect')
  @Roles('owner', 'admin')
  disconnect() {
    void this.mercadopagoService;
    return { message: 'not implemented' };
  }

  @Get('status')
  status() {
    void this.mercadopagoService;
    return { message: 'not implemented' };
  }

  @Post('orders')
  createMpOrder(@Body() dto: CreateMpOrderDto) {
    void this.mercadopagoService;
    return { message: 'not implemented' };
  }
}
