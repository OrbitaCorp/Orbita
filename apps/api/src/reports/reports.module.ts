import { Module } from '@nestjs/common';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';
import { SearchConsoleModule } from '../search-console/search-console.module';

@Module({
  // SearchConsoleModule: "Cómo te encuentran en Google" dentro de las métricas avanzadas del inicio.
  imports: [SearchConsoleModule],
  controllers: [ReportsController],
  providers: [ReportsService],
  exports: [ReportsService],
})
export class ReportsModule {}
