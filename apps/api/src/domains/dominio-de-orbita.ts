// Dominios que son de Órbita: ni se vinculan ni se compran como dominio propio
// de una tienda (auditoría interna 10/09, ítem `api.domains`).
//
// El middleware del front nunca consulta dominios propios para *.orbita.site
// (resuelve el subdominio directo), así que vincular "otratienda.orbita.site"
// no le robaba el tráfico a nadie. Pero agregarlos al proyecto de Vercel desde
// el panel de un negocio no tiene ningún uso legítimo, y quitarlos después
// ("Eliminar" en Dominios) le pega al proyecto de producción.
const DOMINIOS_DE_ORBITA = ['orbita.site', 'orbita-corp.com'];

export function esDominioDeOrbita(dominio: string): boolean {
  const d = dominio.trim().toLowerCase().replace(/\.$/, '');
  return DOMINIOS_DE_ORBITA.some((propio) => d === propio || d.endsWith(`.${propio}`));
}
