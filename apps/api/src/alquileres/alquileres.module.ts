import { Module } from '@nestjs/common';
import { ReservasModule } from '../reservas/reservas.module';
import { AlquileresPanelController } from './alquileres-panel.controller';
import { AlquileresIngresosService } from './alquileres-ingresos.service';

// Lo propio de Alquileres en la API: lo que un alojamiento cobró afuera de
// Órbita (hoy, por Airbnb), importado del archivo de ganancias. Tablas
// propias, al lado del motor de reservas y sin tocarlo, como Gimnasio. Del
// motor usa el catálogo (ReservasModule lo exporta) para saber si una
// propiedad es del negocio. Prisma y Audit son globales. Ver README.md.
@Module({
  imports: [ReservasModule],
  controllers: [AlquileresPanelController],
  providers: [AlquileresIngresosService],
})
export class AlquileresModule {}
