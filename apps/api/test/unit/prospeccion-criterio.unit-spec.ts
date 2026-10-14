import { DatosDeCuenta, EQUIPO, NIVELES, SUBRUBROS, detectarSubrubro, evaluar } from '../../src/marketing/prospeccion/prospeccion.criterio';
import { normalizarUsuario, normalizarUsuarios, resumirCuenta } from '../../src/marketing/prospeccion/prospeccion.meta';

// El criterio de cliente ideal de la prospección. Estos tests fijan la fórmula del puntaje: si se cambia un peso
// a propósito, se actualiza el número acá y el documento "Criterio de cliente ideal".

function cuenta(over: Partial<DatosDeCuenta> = {}): DatosDeCuenta {
  return {
    usuario: 'zapateria_x',
    bio: 'Zapatillas y calzado 📍 Av. Brasil 100, Puerto Iguazú · Pedidos por WhatsApp +54 9 3757 123456',
    web: 'https://wa.me/5493757123456',
    enlace: 'WhatsApp',
    seguidores: 2500,
    publicaciones: 120,
    postsPorSemana: 3,
    diasDesdeUltimo: 2,
    engagementPct: 2.4,
    senales: { 'talles/stock': 5, 'catálogo': 4, 'precio/consulta': 3, 'pedidos/WhatsApp': 6, 'envíos': 0 },
    local: true,
    ...over,
  };
}

describe('puntaje del criterio de cliente ideal', () => {
  it('una zapatería activa que vende por WhatsApp suma 93 y es nivel A', () => {
    const e = evaluar(cuenta());
    expect(e.partes).toEqual({
      'Venta por mensaje': 25,
      'Dolor operativo': 20, // 4 de las 5 señales con 3 o más publicaciones
      'Tracción': 20, // recencia 8 + frecuencia 6 + respuesta 3 + tamaño 3
      'Encaje de rubro': 15, // Calzado = A
      'Contacto y zona': 10, // WhatsApp 6 + dirección 2 + Iguazú 2
      'Catálogo amplio': 3,
    });
    expect(e.puntaje).toBe(93);
    expect(e.nivel).toBe('A');
    expect(e.subrubro).toBe('Calzado');
  });

  it('el puntaje queda entre 0 y 100', () => {
    for (const over of [{}, { seguidores: 5, diasDesdeUltimo: 80 }, { senales: {}, enlace: 'tienda online', web: 'https://x.tiendanube.com' }]) {
      const p = evaluar(cuenta(over)).puntaje!;
      expect(p).toBeGreaterThanOrEqual(0);
      expect(p).toBeLessThanOrEqual(100);
    }
  });

  it('menos de 200 seguidores resta 10 y se explica en el motivo', () => {
    const grande = evaluar(cuenta({ seguidores: 400 })).puntaje!;
    const chica = evaluar(cuenta({ seguidores: 100 })).puntaje!;
    // 400 suma 3 por tamaño; 100 no suma esos 3 y además resta 10
    expect(grande - chica).toBe(13);
    expect(evaluar(cuenta({ seguidores: 100 })).motivo).toContain('menos de 200 seguidores');
  });

  it('con sitio propio puntúa mucho menos que vendiendo por mensaje', () => {
    const porMensaje = evaluar(cuenta({ enlace: 'sin enlace', web: null })).partes['Venta por mensaje'];
    const conSitio = evaluar(cuenta({ enlace: 'otro sitio', web: 'https://mitienda.com.ar' })).partes['Venta por mensaje'];
    expect(porMensaje).toBe(25);
    expect(conSitio).toBe(5);
  });

  it('los niveles cortan en 70, 50 y 30', () => {
    expect(NIVELES.map((n) => [n.desde, n.nivel])).toEqual([[70, 'A'], [50, 'B'], [30, 'C'], [0, 'D']]);
  });
});

describe('exclusiones', () => {
  it('una cuenta que ya usa Órbita no es prospecto', () => {
    const e = evaluar(cuenta({ web: 'https://venustyle.orbita.site', enlace: 'otro sitio' }));
    expect(e).toMatchObject({ puntaje: null, accion: 'Excluida', motivo: 'Ya usa Órbita' });
  });

  it('una cuenta vinculada al equipo se excluye para verificar', () => {
    const e = evaluar(cuenta({ bio: `Prendas · By: @${EQUIPO[0]}` }));
    expect(e).toMatchObject({ puntaje: null, accion: 'Excluida' });
  });

  it('más de 90 días sin publicar es nivel D con 10 puntos, y sin publicaciones también', () => {
    expect(evaluar(cuenta({ diasDesdeUltimo: 232 }))).toMatchObject({ puntaje: 10, nivel: 'D' });
    expect(evaluar(cuenta({ diasDesdeUltimo: null }))).toMatchObject({ puntaje: 10, nivel: 'D' });
  });
});

describe('detección de subrubro por palabras clave', () => {
  it('los 28 subrubros del alta están cargados, con claves distintas y encaje A, B o C', () => {
    expect(SUBRUBROS).toHaveLength(28);
    expect(new Set(SUBRUBROS.map((s) => s.key)).size).toBe(28);
    for (const s of SUBRUBROS) expect(['A', 'B', 'C']).toContain(s.encaje);
  });

  it.each([
    ['Tienda de Calzados 👠👡 Barrio 1 de Mayo. Enviamos a todo el país', 'Calzado'],
    ['INDUMENTARIA DEPORTIVA · Héctor Cámpora 153', 'Deportes / Fitness'],
    ['Perfumería Kadosh · envío a todo el país', 'Perfumería / Cosmética'],
    ['Neumáticos todas las medidas · llantas deportivas', 'Repuestos Automotor'],
  ])('«%s» es %s', (bio, esperado) => {
    expect(detectarSubrubro(bio.toLowerCase(), bio.toLowerCase())?.etiqueta).toBe(esperado);
  });

  it('una bio que nombra muchos rubros importados es «De todo un poco»', () => {
    const bio = 'productos importados• electronica • indumentaria• relojes• cosmética • joyas';
    expect(detectarSubrubro(bio, bio)?.etiqueta).toBe('De todo un poco');
  });

  it('sin palabras reconocibles no hay subrubro', () => {
    expect(detectarSubrubro('hola', 'hola')).toBeNull();
  });
});

describe('usuarios de Instagram', () => {
  it.each([
    ['@Tienda.Uno', 'tienda.uno'],
    ['https://www.instagram.com/tefaltacalleok/', 'tefaltacalleok'],
    ['instagram.com/moon_igz_', 'moon_igz_'],
    ['  alinne.indumentaria ', 'alinne.indumentaria'],
  ])('%s se normaliza a %s', (entrada, esperado) => {
    expect(normalizarUsuario(entrada)).toBe(esperado);
  });

  it.each(['', 'a b', 'tienda/uno', 'x'.repeat(31), '<script>', null, undefined, 42])('%p no es un usuario válido', (entrada) => {
    expect(normalizarUsuario(entrada as unknown)).toBeNull();
  });

  it('una lista se normaliza y se quitan los repetidos', () => {
    expect(normalizarUsuarios(['@A', 'a', 'https://instagram.com/b/', '???'])).toEqual(['a', 'b']);
  });
});

describe('resumen de una cuenta de Meta', () => {
  const AHORA = Date.parse('2026-10-14T12:00:00Z');
  const publicaciones = Array.from({ length: 10 }, (_, i) => ({
    caption: i % 2 ? `Nuevo ingreso, consultá talle y precio por mensaje @colaboradora #puertoiguazu` : 'Catálogo nuevo #moda',
    like_count: 50,
    comments_count: 5,
    timestamp: new Date(AHORA - (i + 1) * 3 * 86_400_000).toISOString(),
  }));

  it('calcula frecuencia, respuesta, señales, menciones y hashtags', () => {
    const { datos, evaluacion } = resumirCuenta('mi_tienda', {
      biography: 'Ropa 📍 Puerto Iguazú', website: 'https://wa.me/5493757000000', followers_count: 1000, media_count: 80, media: { data: publicaciones },
    }, AHORA);
    expect(datos.diasDesdeUltimo).toBe(3);
    expect(datos.postsPorSemana).toBe(2.6); // 10 publicaciones en 27 días
    expect(datos.engagementPct).toBe(5.5); // (50 + 5) por publicación / 1000 seguidores
    expect(datos.senales['talles/stock']).toBe(5);
    expect(datos.menciones).toEqual({ colaboradora: 5 });
    expect(datos.hashtagsTop).toContain('puertoiguazu');
    expect(datos.enlace).toBe('WhatsApp');
    expect(evaluacion.puntaje).not.toBeNull();
  });

  it('limpia los caracteres que Postgres rechaza y no corta un emoji a la mitad al recortar', () => {
    // 279 letras + un emoji (dos unidades UTF-16): recortar a 280 por unidades lo partiría. Más un carácter nulo y una sustituta suelta.
    const caption = 'a'.repeat(279) + '😀 fin\u0000\uD83D';
    const { datos } = resumirCuenta('mi_tienda', { biography: 'hola\u0000\uDE00 mundo', media: { data: [{ caption, timestamp: new Date(AHORA).toISOString() }] } }, AHORA);
    const texto = datos.ultimasPublicaciones[0].texto;
    expect(Array.from(texto)).toHaveLength(280);
    expect(texto.endsWith('😀')).toBe(true);
    expect(datos.bio).toBe('hola� mundo');
    // sin carácter nulo y sin ninguna sustituta suelta, que es lo que rompe el jsonb de Postgres
    expect(JSON.stringify(datos)).not.toContain('\\u0000');
    expect(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/.test(datos.bio + texto)).toBe(false);
  });

  it('no se menciona a sí misma y soporta una cuenta sin publicaciones', () => {
    const { datos } = resumirCuenta('mi_tienda', { biography: 'by @mi_tienda', followers_count: 10 }, AHORA);
    expect(datos.menciones).toEqual({});
    expect(datos.diasDesdeUltimo).toBeNull();
  });
});
