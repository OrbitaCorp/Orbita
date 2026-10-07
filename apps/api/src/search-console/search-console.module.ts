import { Module } from '@nestjs/common';
import { GoogleSearchClient } from './google-search.client';
import { SearchConsoleService } from './search-console.service';

// Verificar los dominios propios de las tiendas en Google Search Console, enviarle
// los sitemaps y leer cómo le va a cada tienda en el buscador. Ver el comentario
// de search-console.service.ts. No importa ningún otro módulo de negocio: lo usan
// DomainsModule (al activarse un dominio), InternalCronModule (nocturno) y
// PlatformModule (superadmin), y así no hay ciclos.
@Module({
  providers: [GoogleSearchClient, SearchConsoleService],
  exports: [SearchConsoleService],
})
export class SearchConsoleModule {}
