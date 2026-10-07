import { ConfigService } from '@nestjs/config';
import { cuerpoAHtml, firmaAHtml, remitenteParaFrom } from './correo-directo';
import { MailService } from './mail.service';
import { PrismaService } from '../prisma/prisma.service';

describe('correo directo del super panel', () => {
  it('escapa el HTML que escribe el admin', () => {
    const html = cuerpoAHtml('Hola <script>alert(1)</script>');
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('separa párrafos por línea en blanco y respeta los saltos simples', () => {
    const html = cuerpoAHtml('Uno\nDos\n\nTres');
    expect(html.match(/<p /g)).toHaveLength(2);
    expect(html).toContain('Uno<br>Dos');
  });

  it('arma una lista cuando todas las líneas del bloque arrancan con guion', () => {
    const html = cuerpoAHtml('Intro\n\n- **Quiénes** somos\n- Qué pedimos');
    expect(html).toContain('<ul');
    expect(html.match(/<li /g)).toHaveLength(2);
    expect(html).toContain('<strong style="color:#1a1f36;">Quiénes</strong> somos');
  });

  it('la firma lleva cargo, teléfono e imagen solo si es https', () => {
    const base = { name: 'Mateo Rojas', email: 'mateo@orbita.site', jobTitle: 'CEO', phone: '+54 3757 000000' };
    const conImagen = firmaAHtml({ ...base, imageUrl: 'https://cdn.orbita.site/firma.webp' });
    expect(conImagen).toContain('CEO · Órbita');
    expect(conImagen).toContain('+54 3757 000000');
    expect(conImagen).toContain('<img');
    expect(firmaAHtml({ ...base, imageUrl: 'javascript:alert(1)' })).not.toContain('<img');
    expect(firmaAHtml({ name: 'Órbita', email: 'contacto@orbita-corp.com' })).toContain('>Órbita</div>');
  });

  it('el nombre del remitente no puede colar otro encabezado', () => {
    expect(remitenteParaFrom('Mateo "CEO" <x@y.com>\r\nBcc: z@z.com', 'mateo@orbita.site')).toBe(
      '"Mateo CEO x@y.com Bcc: z@z.com" <mateo@orbita.site>',
    );
    expect(remitenteParaFrom('  ', 'mateo@orbita.site')).toBe('"Órbita" <mateo@orbita.site>');
  });

  // El layout se compila en modo estricto: una variable que falte tira. Esto
  // arma el HTML completo, como la vista previa del panel.
  it('arma el correo completo con la plantilla de Órbita y sin el pie "para tu negocio"', () => {
    const mail = new MailService({ get: () => undefined } as unknown as ConfigService, {} as PrismaService);
    const html = mail.directoHtml('Hola\n\n- Uno\n- Dos', { name: 'Mateo Rojas', email: 'mateo@orbita.site', jobTitle: 'CEO' });
    expect(html).toContain('<ul');
    expect(html).toContain('Mateo Rojas');
    expect(html).toContain('orbita.site');
    expect(html).not.toContain('para tu negocio');
    expect(html).not.toContain('Hecho por Órbita');
  });
});
