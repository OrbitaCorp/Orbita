import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  reactStrictMode: true,
  // Se probó experimental.scrollRestoration acá para que el scroll se
  // mantuviera al recargar, pero su mecanismo interno restaura la posición en
  // un momento muy temprano del pintado (antes de que termine de calcularse
  // el alto real de la página) — en el home, con secciones largas y un fondo
  // con canvas, terminaba "clampeando" el scroll cerca del fondo en vez de
  // volver al lugar correcto. Se sacó de acá; la restauración se resuelve a
  // mano en PaginaV2.tsx, con control total de CUÁNDO se aplica (después del
  // pintado final, no durante).
  // Subdominios de tienda en desarrollo: Next 16 bloquea recursos de dev
  // (/_next/*) servidos a orígenes distintos de localhost salvo que se listen
  // acá. El comodín cubre cualquier tienda de prueba (negocio.orbita.local,
  // etc.): sin él, el WebSocket de HMR (/_next/hmr) se rechaza y el dev server
  // recarga la página sola cada tanto.
  allowedDevOrigins: [
    'orbita.local',
    '*.orbita.local',
  ],
  // /home-v2 fue la ruta de prueba del rediseño (2026-09-06/07) mientras se
  // comparaba contra el home viejo sin tocarlo. El 2026-09-07 pasó a ser el
  // home real (index.tsx) y ese archivo se borró — este redirect es para
  // cualquier link ya compartido a /home-v2 (Jira, chats, favoritos) durante
  // esos días, no para tráfico nuevo.
  async redirects() {
    return [
      { source: '/home-v2', destination: '/', permanent: true },
    ];
  },
  // Headers de seguridad para todo el sitio (auditoría interna 10/09, ítem
  // web.middleware — antes no había ninguno). Solo los que no pueden romper
  // nada: HSTS SIN includeSubDomains (también se sirve en los dominios propios
  // de los negocios, y no nos corresponde forzar HTTPS en sus otros
  // subdominios); anti-framing con SAMEORIGIN (no DENY: las vistas de celular
  // que se usan para revisar responsive son iframes del mismo origen); y una
  // CSP mínima sin script-src, porque armarla mal voltea la tienda. La CSP
  // completa de scripts (hallazgo csp-scripts) existe desde el 15/09 pero en
  // modo Report-Only y se emite desde src/middleware.ts, no desde acá: lleva
  // el hash del script inline de tema (src/lib/csp.ts) y este archivo no
  // puede importar ese módulo sin tocar el tsconfig. Cuando se pase a
  // bloqueante, la de acá se reemplaza por esa (no se suman).
  async headers() {
    return [
      {
        // En desarrollo se excluye /_next/static/development/*: ahí vive
        // `_clientMiddlewareManifest.js`, que Next sirve con Content-Type
        // `application/json` aunque su propio cliente lo carga con un
        // <script>. Con `nosniff` el navegador se niega a ejecutarlo
        // ("Refused to execute script... MIME type is not executable") y se
        // cae el bootstrap entero: ninguna página del panel llega a hidratar
        // y lo que se ve es el HTML crudo. Ese archivo NO existe en un build
        // de producción (es un artefacto del dev server), así que la
        // excepción no afloja ningún header del sitio real.
        source: process.env.NODE_ENV === 'production'
          ? '/:path*'
          : '/((?!_next/static/development).*)',
        headers: [
          { key: 'Strict-Transport-Security', value: 'max-age=63072000' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Content-Security-Policy', value: "frame-ancestors 'self'; base-uri 'self'; object-src 'none'" },
        ],
      },
    ];
  },
};

export default nextConfig;
