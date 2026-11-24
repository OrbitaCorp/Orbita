import { Module } from '@nestjs/common';
import { StorefrontModule } from '../storefront/storefront.module';
import { ReservasModule } from '../reservas/reservas.module';
import { GimnasioPanelController } from './gimnasio-panel.controller';
import { GimnasioPublicoController } from './gimnasio-publico.controller';
import { GimnasioService } from './gimnasio.service';

// Lo propio de Gimnasio en la API: los planes, los alumnos y el plan de cada
// alumno (decisión del 16/11/2026: tablas propias, al lado del motor de
// reservas y sin tocarlo). Las clases, los lugares y la lista de espera son
// del motor: este módulo lo usa por sus servicios (ReservasModule los
// exporta) y solo decide con qué se paga cada lugar.
//
// Importa StorefrontModule por resolveBusinessId (el slug del sitio público);
// Prisma y Audit son globales.
@Module({
  imports: [StorefrontModule, ReservasModule],
  controllers: [GimnasioPanelController, GimnasioPublicoController],
  providers: [GimnasioService],
})
export class GimnasioModule {}
