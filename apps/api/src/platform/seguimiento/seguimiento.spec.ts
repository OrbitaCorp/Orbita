import { etapaDe, ETAPAS, type DatosSeguimiento } from './etapas';
import { PLANTILLAS, rellenar, nombreDePila } from './plantillas';
import { botonWhatsappAHtml, linkDeWhatsapp, normalizarWhatsapp } from '../../mail/correo-directo';

const AHORA = new Date('2026-11-08T12:00:00Z');
const dias = (n: number) => new Date(AHORA.getTime() - n * 24 * 60 * 60 * 1000);
const enDias = (n: number) => new Date(AHORA.getTime() + n * 24 * 60 * 60 * 1000);

const base = (o: Partial<DatosSeguimiento> = {}): DatosSeguimiento => ({
  creadoEl: dias(30),
  publicada: true,
  pausada: false,
  dadaDeBaja: false,
  productos: 10,
  pedidos: 3,
  ultimoAccesoDueno: dias(1),
  suscripcion: null,
  ...o,
});

describe('etapaDe', () => {
  it('armado: bienvenida, sin productos y sin publicar', () => {
    expect(etapaDe(base({ creadoEl: dias(1), productos: 0, publicada: false }), AHORA)).toBe('bienvenida');
    expect(etapaDe(base({ creadoEl: dias(4), productos: 0, publicada: false }), AHORA)).toBe('sin_productos');
    expect(etapaDe(base({ publicada: false }), AHORA)).toBe('sin_publicar');
  });

  it('publicada: sin ventas, vendiendo y se enfrió', () => {
    expect(etapaDe(base({ pedidos: 0 }), AHORA)).toBe('sin_ventas');
    expect(etapaDe(base(), AHORA)).toBe('vendiendo');
    expect(etapaDe(base({ ultimoAccesoDueno: dias(20) }), AHORA)).toBe('se_enfrio');
    // Nunca entró: cuenta desde que se creó.
    expect(etapaDe(base({ ultimoAccesoDueno: null, creadoEl: dias(20) }), AHORA)).toBe('se_enfrio');
  });

  it('lo que corta la tienda gana sobre el armado', () => {
    expect(etapaDe(base({ dadaDeBaja: true, productos: 0 }), AHORA)).toBe('baja');
    expect(etapaDe(base({ suscripcion: { status: 'PAST_DUE', currentPeriodEnd: enDias(2), renuevaSolo: true } }), AHORA)).toBe('pago_pendiente');
    expect(etapaDe(base({ pausada: true }), AHORA)).toBe('pausada');
  });

  it('por vencer solo si no se renueva solo', () => {
    expect(etapaDe(base({ suscripcion: { status: 'ACTIVE', currentPeriodEnd: enDias(3), renuevaSolo: false } }), AHORA)).toBe('por_vencer');
    expect(etapaDe(base({ suscripcion: { status: 'ACTIVE', currentPeriodEnd: enDias(3), renuevaSolo: true } }), AHORA)).toBe('vendiendo');
    expect(etapaDe(base({ suscripcion: { status: 'ACTIVE', currentPeriodEnd: enDias(20), renuevaSolo: false } }), AHORA)).toBe('vendiendo');
  });
});

describe('plantillas de seguimiento', () => {
  const v = { nombre: 'Ana', negocio: 'Kiosco Sol', tienda: 'https://sol.orbita.site', remitente: 'Mateo', vence: '12 de noviembre' };

  it('hay una por etapa y no queda ninguna variable sin reemplazar', () => {
    for (const e of ETAPAS) {
      const p = PLANTILLAS[e];
      expect(p.etapa).toBe(e);
      for (const texto of [p.asunto, p.cuerpo, p.mensajeWhatsapp]) {
        expect(rellenar(texto, v)).not.toMatch(/\{\w+\}/);
      }
    }
  });

  it('una llave que no es variable queda tal cual', () => {
    expect(rellenar('Hola {nombre}, {otra}', v)).toBe('Hola Ana, {otra}');
  });

  it('nombre de pila', () => {
    expect(nombreDePila('  Ana María Pérez ')).toBe('Ana');
    expect(nombreDePila(null)).toBe('');
  });
});

describe('botón de WhatsApp', () => {
  it('normaliza a dígitos con código de país', () => {
    expect(normalizarWhatsapp('+54 9 3757 12-3456')).toBe('5493757123456');
    expect(normalizarWhatsapp('3757')).toBeNull();
    expect(normalizarWhatsapp(null)).toBeNull();
  });

  it('el link lleva el mensaje codificado y el HTML lo escapa', () => {
    expect(linkDeWhatsapp('5493757123456', 'Hola & chau')).toBe('https://wa.me/5493757123456?text=Hola%20%26%20chau');
    const html = botonWhatsappAHtml({ numero: '5493757123456', texto: 'Escribime <ya>', mensaje: 'Hola' });
    expect(html).toContain('href="https://wa.me/5493757123456?text=Hola"');
    expect(html).toContain('Escribime &lt;ya&gt;');
    expect(html).toContain('+5493757123456');
  });
});

describe('SeguimientoService: número del botón', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { SeguimientoService } = require('./seguimiento.service');
  const negocio = {
    id: 'b1', name: 'Euge joyas', subdomain: 'euge', createdAt: new Date(), isActive: true, isPaused: false, cancelledAt: null,
    subscription: null, members: [{ name: 'Eugenia', email: 'euge@example.com', lastAccessAt: new Date() }],
    _count: { products: 3, orders: 0 },
  };
  const armar = (casilla: Record<string, unknown>) =>
    new SeguimientoService(
      { business: { findMany: jest.fn().mockResolvedValue([negocio]) } },
      {},
      { casilla: jest.fn().mockResolvedValue({ email: 'ceo@orbita.site', name: 'Mateo Rojas', ...casilla }), firma: () => ({}) },
    );
  const dto = { businessId: 'b1', etapa: 'sin_ventas', senderId: 's1' };

  it('sin WhatsApp cargado usa el teléfono de la casilla', async () => {
    const b = await armar({ whatsapp: null, phone: '+5493757673226' }).borrador(dto);
    expect(b.whatsapp?.numero).toBe('5493757673226');
  });

  it('el WhatsApp propio gana sobre el teléfono', async () => {
    const b = await armar({ whatsapp: '+54 9 11 5555 5555', phone: '+5493757673226' }).borrador(dto);
    expect(b.whatsapp?.numero).toBe('5491155555555');
  });

  it('un teléfono sin código de país no alcanza', async () => {
    const b = await armar({ whatsapp: null, phone: '3757' }).borrador(dto);
    expect(b.whatsapp).toBeNull();
  });
});
