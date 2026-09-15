// Lo que comparten el mail de dominio por vencer (MailService) y el barrido
// que lo manda (DomainExpiryService). El asunto lleva una marca fija por
// dominio, "dominio <dominio> vence", que el barrido busca en email_logs para
// no repetir el aviso. El plazo en días cambia cada noche, por eso la marca es
// solo esa parte. Lleva "dominio " adelante y " vence" atrás para que
// mitienda.com y tienda.com no se confundan (un contains sin delimitadores los
// mezclaba).

export const TEMPLATE_DOMINIO_POR_VENCER = 'domain-expiring-soon';

export const marcaAsuntoDominio = (domain: string): string => `dominio ${domain} vence`;

export function asuntoDominioPorVencer(domain: string, diasRestantes: number): string {
  const plazo = diasRestantes === 1 ? '1 día' : `${diasRestantes} días`;
  return `El ${marcaAsuntoDominio(domain)} en ${plazo}`;
}
