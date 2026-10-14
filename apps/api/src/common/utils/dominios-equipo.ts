import { ConfigService } from '@nestjs/config';

// Los dominios de correo del equipo de Órbita: de ahí salen las personas que pueden conectar su Claude (conector MCP) y
// las que reciben los avisos de Marketing (por ejemplo, «hay videos para aprobar»). MCP_DOMINIOS_PERMITIDOS los cambia.
export const DOMINIOS_DEL_EQUIPO_POR_DEFECTO = 'orbita-corp.com,orbita.site';

export function dominiosDelEquipo(config: Pick<ConfigService, 'get'>): string[] {
  return (config.get<string>('MCP_DOMINIOS_PERMITIDOS') ?? DOMINIOS_DEL_EQUIPO_POR_DEFECTO)
    .split(',')
    .map((d) => d.trim().toLowerCase())
    .filter(Boolean);
}

export function esDelEquipo(email: string, dominios: string[]): boolean {
  return dominios.includes(email.toLowerCase().split('@').pop() ?? '');
}
