import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  reactStrictMode: true,
  // Se probó experimental.scrollRestoration acá para que el scroll se
  // mantuviera al recargar, pero su mecanismo interno restaura la posición en
  // un momento muy temprano del pintado (antes de que termine de calcularse
  // el alto real de la página) — en home-v2, con secciones largas y un fondo
  // con canvas, terminaba "clampeando" el scroll cerca del fondo en vez de
  // volver al lugar correcto. Se sacó de acá; la restauración para esa página
  // se resuelve a mano en pages/home-v2.tsx, con control total de CUÁNDO se
  // aplica (después del pintado final, no durante).
  // Subdominios de tienda en desarrollo: Next 16 bloquea recursos de dev
  // (/_next/*) servidos a orígenes distintos de localhost salvo que se listen
  // acá. Agregar cada tienda de prueba usada en local.
  allowedDevOrigins: [
    'orbita.local',
    'tienda1.orbita.local',
    'tienda2.orbita.local',
  ],
};

export default nextConfig;
