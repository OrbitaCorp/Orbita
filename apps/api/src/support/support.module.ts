import { Module } from '@nestjs/common';
import { SupportController } from './support.controller';
import { SupportAdminController } from './support-admin.controller';
import { SupportService } from './support.service';

// Prisma, Mail y Supabase son módulos @Global: no hace falta importarlos acá.
@Module({
  controllers: [SupportController, SupportAdminController],
  providers: [SupportService],
})
export class SupportModule {}
