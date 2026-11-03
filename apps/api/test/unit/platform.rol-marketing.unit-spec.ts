import 'reflect-metadata';
import { readdirSync, readFileSync, statSync } from 'fs';
import { join } from 'path';
import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PlatformAdminGuard } from '../../src/common/guards/platform-admin.guard';
import { PLATFORM_ROLE_KEY } from '../../src/common/decorators/platform-role.decorator';
import { InstagramAdminController } from '../../src/instagram/instagram-admin.controller';
import { InstagramBandejaController } from '../../src/marketing/instagram-bandeja.controller';
import { InstagramContenidoController } from '../../src/marketing/instagram-contenido.controller';
import { MarketingController } from '../../src/marketing/marketing.controller';
import { McpConsentimientoController } from '../../src/marketing/prospeccion/mcp/mcp.controller';
import { ProspeccionController } from '../../src/marketing/prospeccion/prospeccion.controller';
import { TiktokController } from '../../src/marketing/tiktok/tiktok.controller';
import { TutorialesController, VideosController } from '../../src/marketing/videos/videos.controller';
import { PlatformAuditController } from '../../src/platform/audit/platform-audit.controller';
import { CorreoPlataformaController } from '../../src/platform/correo/correo.controller';
import { CostsController } from '../../src/platform/costs/costs.controller';
import { OrbiSaludController } from '../../src/platform/orbi-salud.controller';
import { ConversacionesPlataformaController } from '../../src/platform/orbi-uso/conversaciones.controller';
import { OrbiUsoPlataformaController } from '../../src/platform/orbi-uso/orbi-uso.controller';
import { PlatformController } from '../../src/platform/platform.controller';
import { SupportAdminController } from '../../src/support/support-admin.controller';

// Rol MARKETING (por ejemplo, Milagros): ve y usa SOLO lo que se le habilitó a propósito. Lo que no la nombra le queda cerrado,
// también la lectura (a diferencia del OPERATOR, que lee todo). Este archivo fija la lista exacta de lo que sí puede: si alguien
// habilita un endpoint más (o se le cierra uno), este test se rompe y obliga a decidirlo a conciencia.

const CONTROLADORES = [
  InstagramAdminController, InstagramBandejaController, InstagramContenidoController, MarketingController, McpConsentimientoController,
  ProspeccionController, TiktokController, VideosController, TutorialesController, PlatformAuditController, CorreoPlataformaController,
  CostsController, OrbiSaludController, ConversacionesPlataformaController, OrbiUsoPlataformaController, PlatformController, SupportAdminController,
];

type Clase = { name: string; prototype: object };

// Los roles que el guard mira para una ruta: los del método, y si no tiene, los de la clase.
const rolesDe = (clase: Clase, metodo: string): string[] | undefined => {
  const handler = (clase.prototype as Record<string, unknown>)[metodo];
  return (Reflect.getMetadata(PLATFORM_ROLE_KEY, handler as object) ?? Reflect.getMetadata(PLATFORM_ROLE_KEY, clase)) as string[] | undefined;
};
const rutasDe = (clase: Clase) =>
  Object.getOwnPropertyNames(clase.prototype).filter((m) => m !== 'constructor' && typeof (clase.prototype as Record<string, unknown>)[m] === 'function' && Reflect.getMetadata('path', (clase.prototype as Record<string, unknown>)[m] as object) !== undefined);

function contexto(rol: 'SUPERADMIN' | 'OPERATOR' | 'MARKETING', clase: Clase, metodo: string): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => ({ user: { type: 'platform_admin', adminId: 'a-1', adminRole: rol } }) }),
    getHandler: () => (clase.prototype as Record<string, unknown>)[metodo],
    getClass: () => clase,
  } as unknown as ExecutionContext;
}

const guard = new PlatformAdminGuard(new Reflector());

// Todo lo que un MARKETING puede llamar hoy, ni más ni menos.
const ABIERTO_A_MARKETING = [
  // Resumen (sin plata: overview le saca la facturación) y canales
  'PlatformController.overview', 'PlatformController.growthSeries', 'MarketingController.estadoDeLosCanales',
  // Correo: ver casillas y lo enviado, vista previa y enviar (tocar las casillas sigue siendo solo de superadmin)
  'CorreoPlataformaController.casillas', 'CorreoPlataformaController.vistaPrevia', 'CorreoPlataformaController.enviar', 'CorreoPlataformaController.enviados',
  // Conector de Claude (prospección y cola de videos)
  'McpConsentimientoController.solicitud', 'McpConsentimientoController.resolver', 'McpConsentimientoController.estado', 'McpConsentimientoController.desconectar',
  // Prospección
  'ProspeccionController.criterio', 'ProspeccionController.consultar', 'ProspeccionController.lotes', 'ProspeccionController.lote', 'ProspeccionController.guardarAnalisis', 'ProspeccionController.prospectos', 'ProspeccionController.actualizar',
].sort();

describe('Rol MARKETING — acceso por lista cerrada', () => {
  const abiertas = CONTROLADORES.flatMap((c) => rutasDe(c).filter((m) => rolesDe(c, m)?.includes('MARKETING')).map((m) => `${c.name}.${m}`)).sort();

  it('un endpoint que no nombra a MARKETING le queda cerrado, y el guard lo rechaza', () => {
    for (const c of CONTROLADORES) {
      for (const m of rutasDe(c)) {
        if (rolesDe(c, m)?.includes('MARKETING')) continue;
        expect(() => guard.canActivate(contexto('MARKETING', c, m))).toThrow(ForbiddenException);
      }
    }
  });

  it('lo que sí puede es exactamente la lista de lo habilitado (redes, videos, correo, prospección, conector, resumen)', () => {
    // Los de videos, tutoriales, TikTok e Instagram contenido se listan aparte por tamaño; el resto está pinchado arriba.
    const aparte = abiertas.filter((n) => /^(VideosController|TutorialesController|TiktokController|InstagramContenidoController|InstagramBandejaController)\./.test(n));
    expect(abiertas.filter((n) => !aparte.includes(n))).toEqual(ABIERTO_A_MARKETING);
    expect(aparte.filter((n) => n.startsWith('VideosController.'))).toEqual(
      rutasDe(VideosController).map((m) => `VideosController.${m}`).sort(),
    );
    expect(aparte.filter((n) => n.startsWith('TutorialesController.')).length).toBe(rutasDe(TutorialesController).length);
    expect(aparte.filter((n) => n.startsWith('InstagramContenidoController.')).length).toBe(rutasDe(InstagramContenidoController).length);
    // Las redes de la empresa (TikTok e Instagram, con la conexión de la cuenta y los mensajes directos) las maneja marketing.
    expect(aparte.filter((n) => n.startsWith('TiktokController.')).length).toBe(rutasDe(TiktokController).length);
    expect(aparte.filter((n) => n.startsWith('InstagramBandejaController.')).length).toBe(rutasDe(InstagramBandejaController).length);
  });

  it('nunca le abre lo que toca plata, accesos o cuentas de la empresa', () => {
    const cerrado: [Clase, string][] = [
      [PlatformController, 'suspend'], [PlatformController, 'grantComp'], [PlatformController, 'createAdmin'], [PlatformController, 'updateAdmin'], [PlatformController, 'removeAdmin'],
      [PlatformController, 'revenueSeries'], [PlatformController, 'listSubscriptions'], [PlatformController, 'listBusinesses'], [PlatformController, 'listAdmins'], [PlatformController, 'listLogs'],
      [CostsController, 'overview'], [InstagramAdminController, 'pedidos'],
      [CorreoPlataformaController, 'crearCasilla'], [CorreoPlataformaController, 'borrarCasilla'],
    ];
    for (const [c, m] of cerrado) {
      expect(typeof (c.prototype as Record<string, unknown>)[m]).toBe('function'); // atrapa un método renombrado
      expect(() => guard.canActivate(contexto('MARKETING', c, m))).toThrow(ForbiddenException);
    }
  });

  it('un OPERATOR sigue leyendo todo el panel, pero no entra a videos ni a Instagram contenido', () => {
    expect(guard.canActivate(contexto('OPERATOR', PlatformController, 'listBusinesses'))).toBe(true);
    expect(guard.canActivate(contexto('OPERATOR', PlatformController, 'overview'))).toBe(true);
    expect(() => guard.canActivate(contexto('OPERATOR', VideosController, 'listar'))).toThrow(ForbiddenException);
    expect(guard.canActivate(contexto('OPERATOR', TiktokController, 'estado'))).toBe(true); // la lectura de TikTok sigue abierta
    expect(() => guard.canActivate(contexto('OPERATOR', InstagramContenidoController, 'publicar' in InstagramContenidoController.prototype ? 'publicar' : rutasDe(InstagramContenidoController)[0]))).toThrow(ForbiddenException);
  });

  it('un SUPERADMIN pasa por todo lo que pasa MARKETING', () => {
    for (const nombre of abiertas) {
      const [clase, metodo] = nombre.split('.');
      const c = CONTROLADORES.find((x) => x.name === clase)!;
      expect(guard.canActivate(contexto('SUPERADMIN', c, metodo))).toBe(true);
    }
  });

  it('no hay un controlador del panel de plataforma que falte en esta lista (un controlador nuevo tiene que sumarse acá)', () => {
    const raiz = join(__dirname, '../../src');
    const archivos: string[] = [];
    const recorrer = (dir: string) => {
      for (const f of readdirSync(dir)) {
        const p = join(dir, f);
        if (statSync(p).isDirectory()) recorrer(p);
        else if (f.endsWith('.controller.ts')) archivos.push(p);
      }
    };
    recorrer(raiz);
    const conGuard = archivos.filter((p) => /UseGuards\([^)]*PlatformAdminGuard/.test(readFileSync(p, 'utf8')));
    const clases = conGuard.flatMap((p) => [...readFileSync(p, 'utf8').matchAll(/export class (\w+Controller)\b/g)].map((m) => m[1]));
    const conocidas = new Set(CONTROLADORES.map((c) => c.name));
    // Las clases sin guard (el callback de TikTok, el OAuth del conector) son públicas a propósito y no cuentan.
    const guardadas = clases.filter((n) => {
      const src = conGuard.map((p) => readFileSync(p, 'utf8')).join('\n');
      return new RegExp(`UseGuards\\([^)]*PlatformAdminGuard[^)]*\\)[\\s\\S]{0,160}export class ${n}\\b`).test(src);
    });
    expect(guardadas.filter((n) => !conocidas.has(n))).toEqual([]);
  });
});
