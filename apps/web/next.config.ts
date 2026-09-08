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
  // acá. Agregar cada tienda de prueba usada en local.
  allowedDevOrigins: [
    'orbita.local',
    'tienda1.orbita.local',
    'tienda2.orbita.local',
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
};

export default nextConfig;
