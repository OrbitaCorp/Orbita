import { Module } from '@nestjs/common';
import { BusinessesModule } from '../../businesses/businesses.module';
import { MercadopagoModule } from '../../mercadopago/mercadopago.module';
import { AppointmentResourcesController } from './appointment-resources.controller';
import { AppointmentResourcesService } from './appointment-resources.service';
import { AppointmentServicesController } from './appointment-services.controller';
import { AppointmentServicesService } from './appointment-services.service';
import { AppointmentsAgendaController } from './appointments-agenda.controller';
import { AppointmentsAgendaService } from './appointments-agenda.service';
import { AppointmentsPanelService } from './appointments-panel.service';
import { AppointmentsSeedService } from './appointments-seed.service';
import { AppointmentsSettingsController } from './appointments-settings.controller';
import { AppointmentsSettingsService } from './appointments-settings.service';
import { AppointmentsController } from './appointments.controller';
import { AppointmentsService } from './appointments.service';

// P1 — Núcleo del panel de Turnos (CONTRATO.md § P1).
//
// Exporta para los otros paquetes:
// - AppointmentsService: el núcleo de § 1 (crear / cambiarEstado / mover,
//   contexto del motor) con sus puntos de extensión (registrarExtensiones).
// - AppointmentsSettingsService: `delNegocio()`, el chequeo único de "este
//   negocio usa Turnos".
// - AppointmentsSeedService: el sembrado inicial para el alta.
//
// El orden de los controllers importa: AppointmentsController (con GET :id)
// va último para que las rutas fijas de los demás se registren antes.
@Module({
  imports: [
    BusinessesModule, // hasActiveAddon()
    MercadopagoModule, // getStatus() para la pestaña Pagos
  ],
  controllers: [
    AppointmentsSettingsController,
    AppointmentServicesController,
    AppointmentResourcesController,
    AppointmentsAgendaController,
    AppointmentsController,
  ],
  providers: [
    AppointmentsSettingsService,
    AppointmentsService,
    AppointmentServicesService,
    AppointmentResourcesService,
    AppointmentsPanelService,
    AppointmentsAgendaService,
    AppointmentsSeedService,
  ],
  exports: [AppointmentsService, AppointmentsSettingsService, AppointmentsSeedService],
})
export class AppointmentsPanelModule {}
