// src/modules/ventas/panel/configuracion/components/apariencia/ayudas.ts
// El texto de cada ayuda de Apariencia (el ícono de exclamación de cada
// tarjeta y de cada interruptor — ver AyudaSeccion.tsx).
//
// Separado de Apariencia.tsx porque es CONTENIDO, no UI: son treinta y pico
// de párrafos que hay que poder leer y corregir juntos, sin buscarlos entre
// dos mil líneas de formulario.
//
// Reglas para escribir acá, en este orden:
//   1. `que`    — qué es la cosa, en palabras del dueño de una tienda.
//   2. `donde`  — en qué parte de la tienda pública se ve. Concreto: "arriba
//                 del header", "sobre la foto del producto". Esto es lo que
//                 más falta en mobile, donde no hay vista previa al lado.
//   3. `afecta` — qué cambia si lo prende, lo apaga o lo edita, incluyendo
//                 las condiciones que hacen que NO se vea (sin imagen
//                 cargada, sin número de WhatsApp, etc.).
// Nada de prometer efectos que el storefront no tiene: cada línea de acá
// salió de leer el código que la dibuja, no del nombre del campo.

import type { Apariencia } from '../../mock/apariencia.mock'
import type { Ayuda } from './AyudaSeccion'

// ─── Secciones (el ícono al lado del título de cada tarjeta) ──────────────
// Claves lógicas, no ids del DOM: `identidad` y `hero` son la MISMA tarjeta
// (cambia según soloContenido, ver heroCard en Apariencia.tsx) y necesitan
// textos distintos, porque con una plantilla activa esa tarjeta ya no tiene
// logo ni nombre adentro.
export const AYUDA_SECCIONES: Record<string, Ayuda> = {
    identidad: {
        que: 'El logo, el ícono de la pestaña (favicon), el nombre de tu tienda y las imágenes grandes que rotan arriba del inicio (los sliders del hero).',
        donde: 'El logo, en el header de todas las páginas, y también en los emails y comprobantes que reciben tus clientes. El favicon, en la pestaña del navegador. Los sliders, en el bloque grande de arriba del inicio.',
        afecta: 'Es lo primero que ve alguien que entra. Si no cargás ningún slider, ese bloque grande no se dibuja y el inicio arranca directo con las secciones de abajo.',
    },
    hero: {
        que: 'Las imágenes grandes de arriba de la portada, con su título, su bajada y el botón que las acompaña.',
        donde: 'En lo más alto del inicio de tu tienda, arriba de todo lo demás.',
        afecta: 'Es la primera pantalla que ve un visitante. El botón de cada imagen lleva a donde vos digas (el catálogo, una categoría, una promo). Sin ninguna imagen cargada, el bloque no se dibuja.',
    },
    paleta: {
        que: 'Los tres colores de tu marca (primario, secundario y acento), el fondo de las páginas, y si la tienda se ve clara u oscura.',
        donde: 'En toda la tienda, no en una sección sola. El primario pinta botones, links y elementos de acción; el secundario los textos y fondos oscuros; el acento las etiquetas y detalles resaltados.',
        afecta: 'Cambiar un color repinta la tienda entera de una. En modo "Sistema", la misma tienda se ve clara u oscura según lo que tenga configurado el celular o la compu de cada visitante.',
    },
    tipografia: {
        que: 'Las dos tipografías de tu tienda: una para los títulos y otra para los textos comunes.',
        donde: 'En toda la tienda. La de títulos va en los títulos de sección y de producto; la de textos en descripciones, precios, botones y pie de página.',
        afecta: 'Es lo que más cambia la personalidad de la tienda sin tocar ni un color. Las dos se cargan desde Google Fonts, así que se ven igual en cualquier celular o compu.',
    },
    layout: {
        que: 'Cómo se acomodan las cosas: el estilo del header, qué enlaces muestra, de cuántas columnas es la grilla de productos y cómo se ven las categorías en el inicio.',
        donde: 'El header, en todas las páginas. La grilla, en el catálogo y en cada categoría. El estilo de categorías, en la sección "Comprá por categoría" del inicio.',
        afecta: 'Con 4 columnas entran más productos por pantalla pero se ven más chicos; en Lista se ve uno por fila, más grande. El estilo de header "Minimal" no muestra navegación ni buscador. Mosaico y Tarjetas necesitan que las categorías tengan foto cargada.',
    },
    parallax: {
        que: 'Una imagen grande, a todo el ancho, que queda quieta mientras el resto de la página se desplaza por encima (el efecto parallax), con un título y un botón arriba.',
        donde: 'En el medio del inicio, después de los productos y antes del video y del pie de página.',
        afecta: 'Corta el inicio con una imagen bien grande — sirve para una campaña o para mostrar el local. No se muestra si el interruptor está apagado O si no cargaste una imagen: con el interruptor prendido y sin imagen, no aparece nada.',
    },
    marcas: {
        que: 'Una tira con los logos de las marcas que vendés, que se desliza sola en loop.',
        donde: 'En el inicio, como una franja angosta entre las secciones.',
        afecta: 'Da confianza: muestra con qué trabajás sin que el visitante tenga que buscarlo. Los logos se ven en gris y toman color cuando les pasan el mouse por encima. El logo de cada marca es opcional (sin logo se muestra el nombre escrito), el nombre nunca. No se muestra si no cargaste al menos una marca.',
    },
    video: {
        que: 'Un video en el inicio, con su título y su bajada. Puede ser un link de YouTube o de Vimeo, o un archivo .mp4 que subas.',
        donde: 'En el inicio, después del banner parallax y antes del pie de página.',
        afecta: 'Sirve para mostrar el local, cómo se usa un producto, o una campaña. No se muestra si el link no es válido: si el campo avisa en rojo que no lo reconocemos, en la tienda no va a aparecer nada.',
    },
    visibilidad: {
        que: 'Los interruptores de lo que se muestra y lo que no en tu tienda: etiquetas de los productos, buscador, opiniones, WhatsApp y algunas secciones del inicio.',
        donde: 'Cada uno tiene su propio lugar — tocá el ícono de cada interruptor para ver dónde se muestra y qué pasa si lo apagás.',
        afecta: 'Apagar algo no borra nada: los datos quedan guardados y vuelven a mostrarse cuando lo prendés de nuevo.',
    },
    visibilidadPlantilla: {
        que: 'Los interruptores de las dos franjas que tu plantilla toma de acá: el anuncio de arriba y la barra de confianza.',
        donde: 'El anuncio, arriba del header, en todas las páginas. La barra de confianza, debajo del hero de la portada.',
        afecta: 'Apagar una no borra su contenido: los datos quedan guardados y vuelven a mostrarse cuando la prendés otra vez. El resto de la portada lo define la plantilla, no esta pantalla.',
    },
    textos: {
        que: 'El aviso de la franja finita de arriba, y el mensaje con el que arranca una charla de WhatsApp.',
        donde: 'El aviso, en la franja arriba del header, en todas las páginas de la tienda.',
        afecta: 'Esa franja es el lugar donde se anuncian los envíos gratis, un 3x1 o un feriado. Se muestra solo si el interruptor "Banner debajo del header" está prendido en "¿Qué ven tus clientes?".',
    },
    estadisticas: {
        que: 'Una franja con números cortos y su etiqueta — "+500 clientes", "24hs de envío", "10 años".',
        donde: 'En el inicio, justo debajo de las imágenes grandes del hero.',
        afecta: 'Son valores decorativos que escribís vos a mano: no se calculan solos ni salen de tus ventas reales. Podés cargar hasta 6. Se muestra solo si el interruptor de la barra de estadísticas está prendido en "¿Qué ven tus clientes?".',
    },
    pie: {
        que: 'El bloque del final de la tienda: tu logo, una descripción corta, los datos de contacto y los links a tus redes.',
        donde: 'Abajo de todo, en TODAS las páginas de la tienda (inicio, catálogo, producto, carrito).',
        afecta: 'La descripción va justo debajo del logo — es el lugar donde contás en una línea qué vendés. Apagar el pie de página también saca de ahí los datos de contacto y el acceso a devoluciones.',
    },
    header: {
        que: 'Qué muestra la fila de navegación de tu plantilla: las secciones fijas (catálogo, ofertas, más vendidos) y las categorías de tu propio catálogo.',
        donde: 'En el header, debajo del logo, en todas las páginas de la tienda.',
        afecta: 'Con 4 o 5 enlaces entra cómodo; más que eso empieza a apretarse, sobre todo en el celular. Cada categoría que prendas lleva al catálogo ya filtrado por esa categoría.',
    },
    cupon: {
        que: 'El bloque oscuro con un código de descuento para copiar.',
        donde: 'En la portada, cerca del final.',
        afecta: 'Es solo el cartel: para que el descuento funcione de verdad, el código tiene que existir en Ventas → Cupones. Dejá el código vacío para no mostrar el bloque.',
    },
}

// ─── Opciones sueltas (el ícono al lado de un interruptor) ────────────────
// Keyed por el campo de Apariencia que mueve el interruptor, así el mismo
// texto sirve donde sea que aparezca (visibilidad, pie de página, o la
// versión reducida de "Visibilidad" editando una plantilla activa).
export const AYUDA_OPCIONES: Partial<Record<keyof Apariencia, Ayuda>> = {
    mostrarResenas: {
        que: 'Las opiniones que dejan tus clientes sobre un producto, con sus estrellas.',
        donde: 'En la página de cada producto, más abajo de la descripción.',
        afecta: 'Apagado, la sección entera desaparece de la tienda: nadie ve las reseñas que ya hay, y nadie puede dejar una nueva. Las reseñas no se borran — vuelven a verse si lo prendés otra vez.',
    },
    mostrarBadgeNuevo: {
        que: 'La etiqueta verde "Nuevo" que marca los productos recién cargados (los de los últimos 7 días).',
        donde: 'Sobre la foto del producto, en las tarjetas del inicio, del catálogo y de cada categoría.',
        afecta: 'Apagado, esos productos se siguen vendiendo igual: lo único que pasa es que dejan de tener el cartelito que avisa que son nuevos. Ojo: un producto que además está en oferta o tiene una promo muestra ESA etiqueta y no la de "Nuevo" — hay un solo lugar para las dos.',
    },
    mostrarBadgeOferta: {
        que: 'La etiqueta que marca los productos que tienen un precio anterior más alto que el que se paga hoy.',
        donde: 'Sobre la foto del producto, en las tarjetas del inicio, del catálogo y de cada categoría.',
        afecta: 'Apagado, el precio anterior tachado se sigue viendo en la tarjeta: lo que se saca es el cartelito de color que llama la atención sobre la foto. No cambia ningún precio.',
    },
    mostrarStockBajo: {
        que: 'El aviso naranja "Últimas unidades" en los productos a los que les queda poco stock.',
        donde: 'Abajo a la izquierda de la foto del producto, en las tarjetas del inicio, del catálogo y de cada categoría.',
        afecta: 'Nunca muestra la cantidad exacta que te queda, solo que es poca. Apagado, tus clientes no se enteran de que está por agotarse: se pierde esa urgencia, pero tampoco parece que te quedás sin mercadería.',
    },
    mostrarWhatsapp: {
        que: 'El botón verde redondo de WhatsApp que queda flotando sobre la página.',
        donde: 'Abajo a la derecha, fijo en la pantalla, en todas las páginas de la tienda.',
        afecta: 'Al tocarlo se abre WhatsApp con tu número y un mensaje ya escrito (el que configurás en "Textos de tu tienda"). No aparece si no cargaste un número de WhatsApp en Configuración → General, aunque esto esté prendido.',
    },
    mostrarBuscador: {
        que: 'La barra para buscar productos por nombre.',
        donde: 'En el header, en todas las páginas de la tienda.',
        afecta: 'Con muchos productos es la forma más rápida de que encuentren uno puntual; con pocos, ocupa lugar al lado del logo. Con el estilo de header "Minimal" no se muestra igual, aunque esto esté prendido.',
    },
    mostrarCategorias: {
        que: 'La sección "Comprá por categoría" — la fila de accesos a cada categoría de tu catálogo.',
        donde: 'En el inicio, entre el hero y los productos.',
        afecta: 'Es el atajo para quien todavía no sabe qué quiere. Cómo se ve (pastillas, mosaico, tarjetas…) se elige en "Diseño y layout". Apagado, tus categorías se siguen pudiendo navegar desde el header y el catálogo.',
    },
    mostrarBannerEnvio: {
        que: 'La franja finita de color con un aviso corto — "Envío gratis a partir de $50.000", por ejemplo.',
        donde: 'Arriba del header, en el borde de arriba de todas las páginas.',
        afecta: 'El texto que dice lo escribís en "Textos de tu tienda". Apagado, se recupera ese espacio y el header queda pegado al borde de arriba de la pantalla.',
    },
    mostrarStats: {
        que: 'La franja con tus números de confianza: "+500 clientes", "24hs de envío", "10 años".',
        donde: 'En el inicio, justo debajo de las imágenes grandes del hero.',
        afecta: 'Los números los cargás a mano en "Barra de estadísticas" — no se calculan solos. Apagado, la franja desaparece pero los valores quedan guardados.',
    },
    bannerDesplazable: {
        que: 'Hace que el aviso de la franja de arriba se deslice de derecha a izquierda, en loop, como una cartelera.',
        donde: 'En la misma franja finita de arriba del header.',
        afecta: 'Moviéndose llama más la atención y entra un texto más largo sin cortarse; quieto y centrado se lee más tranquilo. Solo tiene efecto si la franja está prendida.',
    },
    mostrarFooter: {
        que: 'El pie de página completo: logo, descripción, datos de contacto, links y redes.',
        donde: 'Abajo de todo, en todas las páginas de la tienda.',
        afecta: 'Apagado se va TODO el bloque, incluidos los datos de contacto y el acceso a devoluciones. La tienda termina directo donde termina el contenido de cada página.',
    },
    mostrarRedesFooter: {
        que: 'Los iconitos que llevan a tus redes (Instagram, Facebook, TikTok).',
        donde: 'Dentro del pie de página, debajo de la descripción.',
        afecta: 'Solo saca los iconitos, el resto del pie queda igual. Cada red se muestra solo si cargaste su link en Configuración → General.',
    },
}
