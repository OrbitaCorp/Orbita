import { NestFactory } from '@nestjs/core';
import { RequestMethod, ValidationPipe } from '@nestjs/common';
import { json, urlencoded } from 'express';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { crearOrigenPermitido, subdominiosDelFrontend } from './common/cors/origen-permitido';
import { saltosDeProxy } from './common/utils/proxy';
import { PrismaService } from './prisma/prisma.service';
import { DomainsService } from './domains/domains.service';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);

  // IP real del cliente detrás de Firebase Hosting + Cloud Run, solo si se
  // configuró el número exacto de saltos (ver common/utils/proxy.ts).
  const saltos = saltosDeProxy();
  if (saltos) app.getHttpAdapter().getInstance().set('trust proxy', saltos);

  // Headers de seguridad (RBT-661) — antes que nada, mismo criterio que CORS
  // más abajo. La API es puro JSON (sin HTML propio salvo los redirects sin
  // body de /auth/google/*), así que el CSP por default de helmet
  // (default-src 'self', object-src 'none', etc.) no rompe nada y le saca
  // filo a cualquier XSS que en algún momento aparezca en una respuesta HTML.
  //
  // crossOriginResourcePolicy y crossOriginEmbedderPolicy quedan
  // deshabilitados a propósito: el storefront de cada tienda llama a la API
  // directo desde el browser en un origen distinto (ver CORS más abajo), y
  // el default de helmet (`Cross-Origin-Resource-Policy: same-origin`)
  // bloquearía esas lecturas cross-origin aunque CORS las permita.
  app.use(
    helmet({
      crossOriginResourcePolicy: false,
      crossOriginEmbedderPolicy: false,
    }),
  );

  // CORS va PRIMERO (después de los headers de seguridad), antes que cualquier otro middleware — si algo más abajo
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
  //
  // Dominios propios (Configuración → Dominios): la tienda en
  // "tefaltacalleok.com" también llama a la API desde el browser, y no hay
  // forma de derivarlos del hostname — se consulta CustomDomain (solo ACTIVE
  // con DNS verificado) con caché en memoria de 5 minutos, positiva y
  // negativa, para no pegarle a la base en cada request (auditoría interna
  // 10/09, hallazgo `hallazgo.cors-dominios-propios`; ver
  // common/cors/origen-permitido.ts). Un dominio todavía pendiente se
  // verifica en el momento (ver esDominioPropioActivo). Uno eliminado o
  // suspendido sigue pasando ese mismo rato. Los orígenes fijos de abajo se
  // evalúan antes y nunca tocan la base.
  const ORBITA_LOCAL_ORIGIN = /^http:\/\/([a-z0-9-]+\.)?orbita\.local:3001$/;
  const ORBITA_SITE_ORIGIN = /^https:\/\/([a-z0-9-]+\.)?orbita\.site$/;
  const isProd = process.env.NODE_ENV === 'production';
  const prisma = app.get(PrismaService);
  const domains = app.get(DomainsService);
  app.enableCors({
    origin: crearOrigenPermitido({
      fijos: [
        process.env.FRONTEND_URL ?? 'http://localhost:3001',
        // Orígenes de desarrollo local — nunca en producción (RBT-665). El de
        // orbita.local:3001 también: quedaba permitido con credenciales en
        // producción (auditoría interna 10/09, ítem trans.cors-headers).
        ...(isProd ? [] : ['http://localhost:3001', 'http://localhost:3000', ORBITA_LOCAL_ORIGIN]),
        ORBITA_SITE_ORIGIN,
        // Staging: las tiendas en *.<dominio de FRONTEND_URL> (en producción
        // repite la regla de orbita.site).
        ...[subdominiosDelFrontend(process.env.FRONTEND_URL)].filter((re): re is RegExp => re !== null),
      ],
      esDominioPropioActivo: async (host) => {
        const activo = await prisma.customDomain.findFirst({
          where: { domain: host, status: 'ACTIVE', dnsVerified: true },
          select: { id: true },
        });
        if (activo) return true;
        // Un visitante entró por un dominio propio que todavía figura
        // pendiente: si llegó hasta acá, el DNS ya apunta a Órbita, así que
        // se verifica ahora en vez de esperar a que el dueño toque
        // "Verificar" (ver DomainsService.activarSiYaAnda). Pasa a lo sumo una
        // vez cada 5 minutos por host: el resultado entra en la caché de
        // arriba. Con tope de tiempo (las llamadas a Vercel no tienen uno
        // propio); si no llega, el disparo de cada 5 minutos lo termina.
        return Promise.race([
          domains.activarSiYaAnda(host),
          new Promise<boolean>((resolve) => setTimeout(() => resolve(false), 10_000)),
        ]).catch(() => false);
      },
    }),
    credentials: true,
  });

  // Freno de gasto automático (ver DEPLOYMENT.md § Freno de gasto automático):
  // si el gasto mensual de GCP llega al presupuesto configurado ($25), una
  // Cloud Function (deploy/budget-guard/) le agrega esta env var al servicio
  // y crea una revisión nueva. A partir de ahí, TODAS las requests devuelven
  // 503 con este mensaje en vez de llegar a la lógica real — no se procesa
  // nada más, así que no se sigue generando gasto de cómputo real por
  // request. Va DESPUÉS de CORS (para que el navegador pueda leer el body
  // del error) pero ANTES de todo lo demás (para no gastar ni un ciclo de
  // más en validar/autenticar/tocar la base antes de cortar).
  if (process.env.MAINTENANCE_MODE === 'true') {
    app.use((_req: import('express').Request, res: import('express').Response) => {
      res.status(503).json({
        error: 'maintenance',
        message: 'Estamos en mantenimiento por unos minutos. Volvemos enseguida — probá de nuevo en un rato.',
      });
    });
  }

  // El límite default de Express/body-parser es demasiado chico para fotos
  // reales (confirmado en producción: "PayloadTooLargeError" al subir una
  // imagen de producto vía multipart). También cubre el logoDataUrl en
  // base64 que manda el onboarding en JSON — mismo riesgo, mismo fix.
  //
  // `verify` conserva el body crudo del webhook de WhatsApp: la firma de Meta
  // (X-Hub-Signature-256) se calcula sobre esos bytes exactos, no sobre el
  // JSON ya parseado. Solo para esa ruta, para no retener en memoria una copia
  // de cada subida de fotos.
  app.use(
    json({
      limit: '10mb',
      verify: (req, _res, buf) => {
        const url = (req as { url?: string }).url;
        if (url?.includes('/webhooks/whatsapp') || url?.includes('/webhooks/instagram')) {
          (req as { rawBody?: Buffer }).rawBody = buf;
        }
      },
    }),
  );
  app.use(urlencoded({ extended: true, limit: '10mb' }));

  // Las direcciones de descubrimiento del conector MCP (RFC 9728 y RFC 8414) tienen que estar en la raíz del dominio,
  // fuera de api/v1: ahí las busca Claude. Ver marketing/prospeccion/mcp/.
  app.setGlobalPrefix('api/v1', {
    exclude: [
      { path: '.well-known/oauth-authorization-server', method: RequestMethod.GET },
      { path: '.well-known/oauth-protected-resource', method: RequestMethod.GET },
      { path: '.well-known/oauth-protected-resource/api/v1/mcp', method: RequestMethod.GET },
    ],
  });
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, transform: true }),
  );
  app.useGlobalFilters(new HttpExceptionFilter());

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
}

void bootstrap();
