import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthContext } from '../types/auth-context.type';

// ─── Demo pública de Órbita (demo.orbita.site) ──────────────────────────────
//
// La demo es un negocio real (Business.isDemo) con datos sembrados. Los
// visitantes recorren la tienda y el panel sin cuenta; lo que "crean" o
// "editan" vive solo en su localStorage (lo hace el frontend). Este guard es
// la garantía del lado del servidor de que nadie toca los datos sembrados,
// aunque le pegue a la API directo salteando el frontend:
//
//   1. Un miembro `readOnly` (la sesión anónima del panel de la demo, ver
//      AuthService.demoSession) no puede usar ningún método que escriba.
//   2. Las rutas públicas de la tienda (`/storefront/:slug/...`) no aceptan
//      escrituras sobre un negocio demo: checkout, visitas, juegos,
//      devoluciones. Excepción: validar el carrito, que es una lectura que
//      viaja por POST.
//
// El dueño real del negocio demo (miembro sin readOnly) sí escribe: así se
// cura la demo desde el panel de verdad. El registro y el login con Google
// de clientes se cortan en AuthService (no traen :slug en la ruta).

export const DEMO_SOLO_LECTURA = 'DEMO_SOLO_LECTURA';
export const MENSAJE_DEMO = 'Estás en la demo de Órbita: los cambios se guardan solo en tu navegador.';

const METODOS_SEGUROS = new Set(['GET', 'HEAD', 'OPTIONS']);

// Escrituras públicas permitidas sobre la tienda demo: son lecturas que
// viajan por POST (llevan un body) y no dejan nada guardado.
const PERMITIDAS_EN_TIENDA_DEMO = [/\/storefront\/[^/]+\/cart\/validate\/?$/];

interface RequestDemo {
  method: string;
  path?: string;
  url?: string;
  params?: Record<string, string | undefined>;
  user?: AuthContext;
}

export function errorDemo(): ForbiddenException {
  return new ForbiddenException({ error: DEMO_SOLO_LECTURA, message: MENSAJE_DEMO });
}

@Injectable()
export class DemoGuard implements CanActivate {
  // El único negocio demo no cambia de subdominio: se cachea por slug para
  // no sumar una consulta a cada escritura pública de cualquier tienda.
  private readonly cache = new Map<string, { esDemo: boolean; hasta: number }>();

  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<RequestDemo>();
    if (METODOS_SEGUROS.has(req.method.toUpperCase())) return true;

    if (req.user?.type === 'member' && req.user.readOnly) throw errorDemo();

    const slug = req.params?.slug;
    if (!slug) return true;
    const ruta = req.path ?? req.url ?? '';
    if (!ruta.includes('/storefront/')) return true;
    if (PERMITIDAS_EN_TIENDA_DEMO.some((re) => re.test(ruta))) return true;

    if (await this.esDemo(slug)) throw errorDemo();
    return true;
  }

  private async esDemo(slug: string): Promise<boolean> {
    const ahora = Date.now();
    const cacheado = this.cache.get(slug);
    if (cacheado && cacheado.hasta > ahora) return cacheado.esDemo;
    const negocio = await this.prisma.business.findUnique({
      where: { subdomain: slug },
      select: { isDemo: true },
    });
    const esDemo = negocio?.isDemo ?? false;
    this.cache.set(slug, { esDemo, hasta: ahora + 5 * 60 * 1000 });
    return esDemo;
  }
}
