import { Module } from '@nestjs/common';
import { AppointmentsGestionModule } from './gestion/gestion.module';

// Turnos & Agenda: el segundo vertical de Órbita (Business.vertical =
// APPOINTMENTS). En el backend "turno" ya es el turno de conversación de Orbi
// (src/orbi/turno, OrbiTurn), por eso el módulo, los modelos y las tablas se
// llaman appointments / Appointment* / appointment_*.
//
// Hoy es la FUNDACIÓN: el esquema (prisma/schema.prisma), el catálogo de
// rubros y de roles (catalogo/), las utilidades de horarios (horarios/), el
// motor de disponibilidad (disponibilidad/) y los tipos de respuesta
// (appointments.types.ts). Todo eso es código puro, sin providers.
//
// Los controllers y services se suman acá por paquete de trabajo, según
// CONTRATO.md (mismo directorio):
//   P1 núcleo del panel · P2 sitio público · P3 clases, clientes, equipo y
//   ganancias · P4 Avanzado.
// Cada paquete agrega sus controllers/providers a este módulo y, si necesita
// resolver el slug de una tienda o chequear el add-on, importa StorefrontModule
// y BusinessesModule (ver CountdownModule como referencia).
@Module({
  imports: [
    AppointmentsGestionModule, // P3: clases, clientes, equipo y ganancias
  ],
})
export class AppointmentsModule {}
