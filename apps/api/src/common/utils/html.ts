// Escapa texto para meterlo dentro de HTML (cuerpo de un mail, por ejemplo).
// Cualquier dato que escribió una persona —el dueño en el panel o un cliente
// al registrarse— va por acá antes de interpolarse en un template HTML.
export function escaparHtml(texto: string): string {
  return texto
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
