import { ConfigService } from '@nestjs/config';
import { cuerpoAHtml, extraerDestinatarios, firmaAHtml, remitenteParaFrom } from './correo-directo';
import { decodificarEntidades, esEmailDeCeo } from '../platform/correo/zoho-ceo';
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

  it('con firma completa la imagen reemplaza al texto y los datos van en el alt', () => {
    const base = { name: 'Mateo Rojas', email: 'mateo@orbita.site', jobTitle: 'CEO & Founder', banner: true };
    const html = firmaAHtml({ ...base, imageUrl: 'https://cdn.orbita.site/firma.gif' });
    expect(html).toContain('max-width:460px');
    expect(html).toContain('alt="Mateo Rojas · CEO &amp; Founder · Órbita · mateo@orbita.site"');
    expect(html).not.toContain('<table');
    // Sin imagen no hay tarjeta que mostrar: vuelve a la firma de texto.
    expect(firmaAHtml(base)).toContain('<table');
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

  it('separa múltiples destinatarios por coma o punto y coma y quita duplicados', () => {
    expect(extraerDestinatarios(' Alexander@orbita.site, alan@orbita.site ; alexander@orbita.site, ')).toEqual([
      'alexander@orbita.site',
      'alan@orbita.site',
    ]);
  });

  it('envía correo directo a varios destinatarios y rechaza si alguno es inválido', async () => {
    const send = jest.fn().mockResolvedValue({ error: null });
    const createLog = jest.fn().mockResolvedValue({});
    const mail = new MailService(
      { get: (k: string) => (k === 'RESEND_API_KEY' ? 're_test' : undefined) } as unknown as ConfigService,
      { emailLog: { create: createLog } } as unknown as PrismaService,
    );
    (mail as unknown as { _resend: unknown })._resend = { emails: { send } };

    const ok = await mail.sendDirecto({
      to: 'alexander@orbita.site, alan@orbita.site',
      subject: 'Reunión de equipo',
      cuerpo: 'Hola a los dos',
      firma: { name: 'Mateo Rojas', email: 'mateo@orbita.site' },
    });
    expect(ok.status).toBe('SENT');
    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({
        to: ['alexander@orbita.site', 'alan@orbita.site'],
        subject: 'Reunión de equipo',
      }),
    );

    send.mockClear();
    const fallo = await mail.sendDirecto({
      to: 'alexander@orbita.site, no-es-un-email',
      subject: 'Reunión de equipo',
      cuerpo: 'Hola a los dos',
      firma: { name: 'Mateo Rojas', email: 'mateo@orbita.site' },
    });
    expect(fallo.status).toBe('FAILED');
    expect(send).not.toHaveBeenCalled();
  });

  it('restringe la bandeja de recibidos únicamente a las cuentas del CEO y decodifica entidades de Zoho', () => {
    expect(esEmailDeCeo('ceo@orbita.site')).toBe(true);
    expect(esEmailDeCeo('mateo@orbita.site')).toBe(true);
    expect(esEmailDeCeo('ceo@orbita-corp.com')).toBe(true);
    expect(esEmailDeCeo('alan@orbita.site')).toBe(false);
    expect(esEmailDeCeo('cto@orbita-corp.com')).toBe(false);
    expect(decodificarEntidades('&lt;mateo@orbita.site&gt; &amp; &quot;Órbita&quot;')).toBe('<mateo@orbita.site> & "Órbita"');
  });
});
