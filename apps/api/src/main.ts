import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { json, urlencoded } from 'express';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);

  // CORS va PRIMERO, antes que cualquier otro middleware — si algo más abajo
  // (body-parser, un guard, lo que sea) tira una excepción antes de llegar al
  // handler, la respuesta de error igual necesita los headers de CORS ya
  // puestos; si no, el browser reporta "blocked by CORS policy" tapando el
  // error real (pasó con el body-parser: quedó mal ordenado, ver más abajo).
  //
  // Sin esto, el navegador bloquea todas las llamadas del frontend (otro
  // origen) al backend por CORS. FRONTEND_URL ya se usaba para armar links
  // de email (ver members.service.ts / auth.service.ts) — se reusa acá.
  // localhost:3001 queda siempre permitido para no romper el dev local.
  // orbita.local (dev) y orbita.site (prod) se permiten vía regex, con y sin
  // subdominio, porque el subdominio de cada negocio es dinámico — el
  // storefront de cada tienda llama a la API directo desde el browser
  // (lib/api.ts), así que cada tienda.orbita.site necesita pasar CORS.
  const ORBITA_LOCAL_ORIGIN = /^http:\/\/([a-z0-9-]+\.)?orbita\.local:3001$/;
  const ORBITA_SITE_ORIGIN = /^https:\/\/([a-z0-9-]+\.)?orbita\.site$/;
  app.enableCors({
    origin: [
      process.env.FRONTEND_URL ?? 'http://localhost:3001',
      'http://localhost:3001',
      'http://localhost:3000',
      ORBITA_LOCAL_ORIGIN,
      ORBITA_SITE_ORIGIN,
    ],
    credentials: true,
  });

  // El límite default de Express/body-parser es demasiado chico para fotos
  // reales (confirmado en producción: "PayloadTooLargeError" al subir una
  // imagen de producto vía multipart). También cubre el logoDataUrl en
  // base64 que manda el onboarding en JSON — mismo riesgo, mismo fix.
  app.use(json({ limit: '10mb' }));
  app.use(urlencoded({ extended: true, limit: '10mb' }));

  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, transform: true }),
  );
  app.useGlobalFilters(new HttpExceptionFilter());

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
}

void bootstrap();
