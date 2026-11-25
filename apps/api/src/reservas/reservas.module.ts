import { Module } from '@nestjs/common';
import { StorefrontModule } from '../storefront/storefront.module';
import { ReservasPanelController } from './reservas-panel.controller';
import { ReservasPublicoController } from './reservas-publico.controller';
import { ReservasCatalogoService } from './reservas-catalogo.service';
import { DisponibilidadService } from './disponibilidad.service';
import { ReservasService } from './reservas.service';
import { ReservasAvisosService } from './reservas-avisos.service';
import { ReservasMantenimientoService } from './reservas-mantenimiento.service';
import { ReservasCalendariosService } from './calendarios/reservas-calendarios.service';

// El backend compartido de Turnos, Alquileres y Gimnasio (ver README.md).
// Importa StorefrontModule por resolveBusinessId (el slug del sitio público);
// Prisma, Mail y Audit son globales.
@Module({
  imports: [StorefrontModule],
  controllers: [ReservasPanelController, ReservasPublicoController],
  providers: [ReservasCatalogoService, DisponibilidadService, ReservasService, ReservasAvisosService, ReservasMantenimientoService, ReservasCalendariosService],
  // Los dos los usa el job de cada 5 minutos (internal-cron).
  exports: [ReservasMantenimientoService, ReservasCalendariosService],
})
export class ReservasModule {}
