import { Controller, Get, Req } from '@nestjs/common';
import type { Request } from 'express';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthContext } from '../common/types/auth-context.type';
import { DemoIaService } from './demo-ia.service';

@Controller('demo')
export class DemoController {
  constructor(private readonly demoIa: DemoIaService) {}

  // Pruebas de IA que le quedan esta semana al visitante de la demo, para
  // que el panel lo diga antes de que las gaste ("Demo: te quedan 2 de 3").
  // Fuera de la demo no hay nada que contar.
  @Get('cupo-ia')
  cupoIa(@CurrentUser() user: AuthContext, @Req() req: Request) {
    if (!(user.type === 'member' && user.readOnly)) return { demo: false, funciones: [] };
    return this.demoIa.cupos(req).then((funciones) => ({ demo: true, funciones }));
  }
}
