import { Module } from '@nestjs/common';
import { StorefrontModule } from '../storefront/storefront.module';
import { ReservasPanelController } from './reservas-panel.controller';
import { ReservasPublicoController } from './reservas-publico.controller';
import { ReservasCatalogoService } from './reservas-catalogo.service';
import { DisponibilidadService } from './disponibilidad.service';
import { ReservasService } from './reservas.service';
import { ReservasAvisosService } from './reservas-avisos.service';
import { ReservasMantenimientoService } from './reservas-mantenimiento.service';

// El backend compartido de Turnos, Alquileres y Gimnasio (ver README.md).
// Importa StorefrontModule por resolveBusinessId (el slug del sitio público);
// Prisma, Mail y Audit son globales. Exporta el motor y el catálogo para los
// módulos que guardan lo suyo al lado (GimnasioModule: planes y alumnos): lo
// usan como está, por sus métodos, sin tocar sus tablas de reglas.
@Module({
  imports: [StorefrontModule],
  controllers: [ReservasPanelController, ReservasPublicoController],
  providers: [ReservasCatalogoService, DisponibilidadService, ReservasService, ReservasAvisosService, ReservasMantenimientoService],
  exports: [ReservasMantenimientoService, ReservasService, ReservasCatalogoService],
})
export class ReservasModule {}
