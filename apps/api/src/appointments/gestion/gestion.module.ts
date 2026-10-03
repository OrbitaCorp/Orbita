import { Module } from '@nestjs/common';
import { StorefrontModule } from '../../storefront/storefront.module';
import { MembersService } from '../../members/members.service';
import { RolesService } from '../../roles/roles.service';
import { GestionContextoService } from './comun/contexto.service';
import { ClasesController, ClasesPublicoController } from './clases/clases.controller';
import { ClasesService } from './clases/clases.service';
import { ClientesController } from './clientes/clientes.controller';
import { ClientesService } from './clientes/clientes.service';
import { EquipoController, RolesTurnosController } from './equipo/equipo.controller';
import { EquipoService } from './equipo/equipo.service';
import { RolesTurnosService } from './equipo/roles-turnos.service';
import { GananciasController } from './ganancias/ganancias.controller';
import { GananciasService } from './ganancias/ganancias.service';

// P3 de Turnos & Agenda (CONTRATO.md § P3): clases con cupo, clientes, equipo
// y roles, ganancias y liquidaciones.
//
// MembersService y RolesService se REUTILIZAN (mismas reglas, mismo mail de
// invitación, mismo registro de auditoría) pero no se tocan sus módulos de
// Tienda: como esos módulos no los exportan, acá se proveen de nuevo (son
// stateless; Prisma, Mail y Audit son @Global).
@Module({
  imports: [
    StorefrontModule, // resolveBusinessId() para las clases del sitio público
  ],
  controllers: [
    ClasesController,
    ClasesPublicoController,
    ClientesController,
    EquipoController,
    RolesTurnosController,
    GananciasController,
  ],
  providers: [
    GestionContextoService,
    ClasesService,
    ClientesService,
    EquipoService,
    RolesTurnosService,
    GananciasService,
    MembersService,
    RolesService,
  ],
  exports: [ClasesService],
})
export class AppointmentsGestionModule {}
