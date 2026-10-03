import { Module } from '@nestjs/common';
import { BusinessesModule } from '../../businesses/businesses.module';
import { MercadopagoModule } from '../../mercadopago/mercadopago.module';
import { StorefrontModule } from '../../storefront/storefront.module';
import { COBRO_ONLINE_TURNOS, CobroOnlineMercadoPago } from './comun/cobro-online';
import { AvanzadoContextoService } from './comun/contexto.service';
import { MENSAJERIA_TURNOS, MensajeriaRegistroLocal } from './comun/mensajeria';
import { FidelidadController } from './fidelidad/fidelidad.controller';
import { FidelidadService } from './fidelidad/fidelidad.service';
import { GiftCardsController } from './gift-cards/gift-cards.controller';
import { GiftCardsService } from './gift-cards/gift-cards.service';
import { HubAvanzadoController } from './hub/hub.controller';
import { HubAvanzadoService } from './hub/hub.service';
import { ListaEsperaController } from './lista-espera/lista-espera.controller';
import { ListaEsperaService } from './lista-espera/lista-espera.service';
import { MembresiasController } from './membresias/membresias.controller';
import { MembresiasService } from './membresias/membresias.service';
import { AvanzadoPagosService } from './pagos/pagos.service';
import { PaquetesController } from './paquetes/paquetes.controller';
import { PaquetesService } from './paquetes/paquetes.service';
import { PreciosHorarioController } from './precios-horario/precios-horario.controller';
import { PreciosHorarioService } from './precios-horario/precios-horario.service';
import { StorefrontAvanzadoController } from './publico/storefront-avanzado.controller';
import { RecuperarController } from './recuperar/recuperar.controller';
import { RecuperarService } from './recuperar/recuperar.service';
import { TurnoFijoController } from './turno-fijo/turno-fijo.controller';
import { TurnoFijoService } from './turno-fijo/turno-fijo.service';

// Avanzado de Turnos & Agenda (CONTRATO.md § P4): paquetes, membresías, gift
// cards, precios por horario, fidelidad, turno fijo, recuperar clientes y la
// lista de espera de turnos. Cada función tiene su subcarpeta.
//
// Lo que se enchufa en la reserva (P1/P2) sale por los services exportados:
// PreciosHorarioService.ajustarPrecio, PaquetesService.canjearSesionDePaquete /
// consumirSesionDePaquete / devolverSesionDePaquete, GiftCardsService.
// usarSaldoGiftCard / devolverSaldoGiftCard, MembresiasService.
// turnoCubiertoPorMembresia, FidelidadService.sumarSello / premioDisponible,
// TurnoFijoService (generarOcurrencias es pura, en turno-fijo.puro.ts),
// RecuperarService.clientesInactivos / canjearCuponRecuperar,
// ListaEsperaService.ofrecerLugarLiberado / vencerOfertas y
// AvanzadoPagosService.aplicarPagoAprobado (webhook de MP de P2).
//
// Puntos de extensión por token (los registra otro módulo cuando exista):
// - NUCLEO_TURNOS (opcional): `crearTurno` del núcleo de P1. Sin él, crear un
//   turno fijo o aceptar una oferta de lista de espera responde 503.
// - MENSAJERIA_TURNOS: hoy MensajeriaRegistroLocal (registra SIMULATED, no
//   manda); P2 lo reemplaza por AppointmentMessagingService.
// - COBRO_ONLINE_TURNOS: preferencia de MP del negocio para packs y gift cards.
@Module({
  imports: [
    StorefrontModule, // resolveBusinessId() de los endpoints públicos
    BusinessesModule, // hasActiveAddon(): el gate en rutas públicas y en lo que se enchufa en la reserva
    MercadopagoModule, // getValidAccessToken() para cobrar packs y gift cards
  ],
  controllers: [
    HubAvanzadoController,
    PaquetesController,
    MembresiasController,
    GiftCardsController,
    PreciosHorarioController,
    FidelidadController,
    TurnoFijoController,
    RecuperarController,
    ListaEsperaController,
    StorefrontAvanzadoController,
  ],
  providers: [
    AvanzadoContextoService,
    HubAvanzadoService,
    PaquetesService,
    MembresiasService,
    GiftCardsService,
    PreciosHorarioService,
    FidelidadService,
    TurnoFijoService,
    RecuperarService,
    ListaEsperaService,
    AvanzadoPagosService,
    { provide: MENSAJERIA_TURNOS, useClass: MensajeriaRegistroLocal },
    { provide: COBRO_ONLINE_TURNOS, useClass: CobroOnlineMercadoPago },
  ],
  exports: [
    AvanzadoContextoService,
    PaquetesService,
    MembresiasService,
    GiftCardsService,
    PreciosHorarioService,
    FidelidadService,
    TurnoFijoService,
    RecuperarService,
    ListaEsperaService,
    AvanzadoPagosService,
  ],
})
export class AppointmentsAvanzadoModule {}
