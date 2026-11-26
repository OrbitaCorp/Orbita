import { Body, Controller, Delete, Get, Post, Query } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { CurrentBusiness } from '../common/decorators/current-business.decorator';
import { AuthContext } from '../common/types/auth-context.type';
import { assertMemberContext } from '../common/utils/assert-member-context';
import { AlquileresIngresosService } from './alquileres-ingresos.service';
import { ImportarCsvDto, IngresosQueryDto, VistaPreviaCsvDto } from './dto/ingresos.dto';

// El panel de Alquileres: lo que no es una reserva del motor. Hoy, lo que el
// alojamiento cobró por Airbnb. Usa los permisos de reservas (no suma otros):
// - reservas.view: ver lo importado (lo usan las Estadísticas).
// - reservas.config: importar el archivo de ganancias y borrar lo importado.
// businessId sale SIEMPRE del token (assertMemberContext), nunca de la URL.
@Controller('alquileres')
export class AlquileresPanelController {
  constructor(private readonly ingresosDeAfuera: AlquileresIngresosService) {}

  /** Las estadías importadas que tocan el rango, y el resumen de todo lo importado. */
  @Get('ingresos')
  @RequirePermission('reservas.view')
  ingresos(@CurrentBusiness() ctx: AuthContext, @Query() q: IngresosQueryDto) {
    const m = assertMemberContext(ctx);
    return this.ingresosDeAfuera.listar(m.businessId, q.desde, q.hasta);
  }

  /** Lee el archivo y cuenta qué trae. No guarda nada. */
  @Post('ingresos/airbnb/vista-previa')
  @RequirePermission('reservas.config')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  vistaPrevia(@CurrentBusiness() ctx: AuthContext, @Body() dto: VistaPreviaCsvDto) {
    const m = assertMemberContext(ctx);
    return this.ingresosDeAfuera.vistaPrevia(m.businessId, dto.texto);
  }

  /** Guarda las estadías del archivo, cada aviso con su propiedad. Todo o nada. */
  @Post('ingresos/airbnb/importar')
  @RequirePermission('reservas.config')
  @Throttle({ default: { limit: 6, ttl: 60_000 } })
  importar(@CurrentBusiness() ctx: AuthContext, @Body() dto: ImportarCsvDto) {
    const m = assertMemberContext(ctx);
    return this.ingresosDeAfuera.importar(m.businessId, m.memberId, { texto: dto.texto, avisos: dto.avisos });
  }

  /** Borra todo lo importado de Airbnb. Las uniones de avisos con propiedades se conservan. */
  @Delete('ingresos/airbnb')
  @RequirePermission('reservas.config')
  borrar(@CurrentBusiness() ctx: AuthContext) {
    const m = assertMemberContext(ctx);
    return this.ingresosDeAfuera.borrarTodo(m.businessId, m.memberId, 'airbnb');
  }
}
