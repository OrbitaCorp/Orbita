import { Global, Module } from '@nestjs/common';
import { AuditController } from './audit.controller';
import { AuditService } from './audit.service';

// Global: lo inyectan los services de las acciones sensibles (productos,
// roles, equipo, negocio, clientes) sin tener que importar el módulo en cada uno.
@Global()
@Module({
  controllers: [AuditController],
  providers: [AuditService],
  exports: [AuditService],
})
export class AuditModule {}
