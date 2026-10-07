import { escaparHtml } from '../common/utils/html';

// Armado del correo que el equipo de Órbita escribe a mano desde el super
// panel (Correo). El cuerpo se escribe en un textarea, como texto: acá se pasa
// a HTML escapando TODO primero y agregando después un formato mínimo
// (párrafos, listas con "- " y **negrita**). No se acepta HTML del que escribe.

export type FirmaCorreo = {
  name: string;
  email: string;
  jobTitle?: string | null;
  phone?: string | null;
  imageUrl?: string | null;
};

const ES_ITEM = /^\s*[-•]\s+/;

function conNegrita(textoEscapado: string): string {
  return textoEscapado.replace(/\*\*([^*\n]+)\*\*/g, '<strong style="color:#1a1f36;">$1</strong>');
}

// Un bloque es lo que queda entre dos líneas en blanco. Si todas sus líneas
// arrancan con "- " es una lista; si no, un párrafo que respeta sus saltos.
export function cuerpoAHtml(texto: string): string {
  const bloques = texto.replace(/\r\n?/g, '\n').split(/\n{2,}/).map((b) => b.trim()).filter(Boolean);
  return bloques
    .map((bloque) => {
      const lineas = bloque.split('\n');
      if (lineas.every((l) => ES_ITEM.test(l))) {
        const items = lineas
          .map((l) => `<li style="margin:0 0 6px;">${conNegrita(escaparHtml(l.replace(ES_ITEM, '')))}</li>`)
          .join('');
        return `<ul style="margin:0 0 16px; padding-left:20px; color:#4f566b; font-size:14px; line-height:1.7;">${items}</ul>`;
      }
      const html = lineas.map((l) => conNegrita(escaparHtml(l))).join('<br>');
      return `<p style="margin:0 0 16px; color:#4f566b; font-size:14px; line-height:1.7;">${html}</p>`;
    })
    .join('');
}

// La imagen de la firma solo sale si es https: la URL la guarda un admin, pero
// termina en el HTML de un correo que lee un tercero.
export function firmaAHtml(firma: FirmaCorreo): string {
  const imagen = firma.imageUrl && /^https:\/\//i.test(firma.imageUrl)
    ? `<td style="padding-right:14px; vertical-align:middle;"><img src="${escaparHtml(firma.imageUrl)}" alt="" height="48" style="height:48px; width:auto; max-width:140px; display:block; border:0;"></td>`
    : '';
  const cargo = firma.jobTitle?.trim();
  const telefono = firma.phone?.trim();
  const contacto = [
    `<a href="mailto:${escaparHtml(firma.email)}" style="color:#8792a2; text-decoration:none;">${escaparHtml(firma.email)}</a>`,
    telefono ? escaparHtml(telefono) : '',
    '<a href="https://www.orbita.site" style="color:#8792a2; text-decoration:none;">orbita.site</a>',
  ].filter(Boolean).join(' &nbsp;·&nbsp; ');
  return (
    '<table role="presentation" cellpadding="0" cellspacing="0" style="margin-top:26px;"><tr>' +
    imagen +
    '<td style="vertical-align:middle;">' +
    `<div style="font-size:13.5px; font-weight:700; color:#1a1f36; line-height:1.4;">${escaparHtml(firma.name)}</div>` +
    `<div style="font-size:12.5px; color:#4f566b; line-height:1.5;">${cargo ? `${escaparHtml(cargo)} · Órbita` : 'Órbita'}</div>` +
    `<div style="font-size:11.5px; color:#8792a2; line-height:1.6; margin-top:2px;">${contacto}</div>` +
    '</td></tr></table>'
  );
}

// El nombre va entre comillas en el encabezado From: sin comillas, barras,
// ángulos ni caracteres de control, que es por donde se cuela otro encabezado.
export function remitenteParaFrom(name: string, email: string): string {
  const limpio = Array.from(name, (c) => (c.charCodeAt(0) < 32 || c.charCodeAt(0) === 127 ? ' ' : c))
    .join('')
    .replace(/["\\<>]/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim()
    .slice(0, 80);
  return `"${limpio || 'Órbita'}" <${email}>`;
}
