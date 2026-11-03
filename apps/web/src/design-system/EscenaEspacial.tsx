// La escena espacial de fondo: estrellas, cometas, el planeta con su horizonte
// iluminado, los anillos de órbita y los satélites de los módulos.
//
// Vive en el design system porque la usan la landing, el alta, el login, el panel
// de Tienda (AdminLayout) y el armazón de los paneles de reservas (LayoutPanel),
// que por regla no puede importar módulos. El tema llega por la prop `oscuro`: la
// landing lo saca de su ThemeContext (modules/landing/components/v2/EscenaEspacial),
// los paneles de useDarkMode.
//
// Vive en una capa FIJA detrás de toda la página, no dentro del hero. Ese fue el
// pedido explícito del dueño: con la escena metida adentro del hero, se cortaba
// de golpe al terminar la primera pantalla y el resto del sitio parecía otra
// página.
//
// El recorrido es un viaje de ida y vuelta: el planeta arranca abajo del hero,
// se hunde mientras leés el medio de la página (queda un ambiente tenue y algún
// cometa lejano), y vuelve a asomar sobre el final para cerrar detrás del footer
// donde empezó.

import { useEffect, useId, useRef, useState, useSyncExternalStore } from 'react';

// Paleta de la escena por tema. En claro NO se invierte sin más: un planeta
// negro sobre fondo blanco quedaba como un agujero. Se convierte en un amanecer
// — cielo celeste pálido, planeta gris muy claro y el mismo halo azul, ahora
// oscureciendo hacia el horizonte en vez de iluminando.
export interface Paleta {
    cieloOpacidad: number;
    estrella: string;
    planeta: string;
    linea: string;
    anillo: (ring: number) => string;
    glow: string[];
    neblina: string;
    cometa: [string, string];
    /** El punto del satélite (prop `satelite`). */
    satelite: string;
    /** Cometas marcados: cola con un brillo ancho y suave debajo de la línea y cabeza con
     *  halo, en vez de los finos y lejanos de la landing (sobre un cielo claro la línea
     *  fina sola se perdía). */
    cometasMarcados?: boolean;
}

export const PALETAS: Record<'oscuro' | 'claro' | 'panelClaro', Paleta> = {
    // Resplandor en un solo azul (#3b82f6, el mismo celeste que ya usa el home
    // actual de orbita.site) en vez del degradé que pasaba por índigo/violeta
    // (#4f46e5, #6366f1, #818cf8). Pedido puntual: probar cómo se ve la escena
    // con el color de marca de siempre, sin el tinte violeta que sumaba la
    // versión anterior — más cerca de lo que ya se reconoce como "Órbita".
    oscuro: {
        cieloOpacidad: 0.7,
        estrella: 'rgba(226,240,255,',
        planeta: '#000',
        linea: 'rgba(240,248,255,.95)',
        anillo: r => `rgba(191,219,254,${r === 1 ? 0.16 : 0.3})`,
        glow: [
            'rgba(59,130,246,.10)', 'rgba(59,130,246,.16)', 'rgba(59,130,246,.24)',
            'rgba(96,165,250,.36)', 'rgba(147,197,253,.56)', 'rgba(219,234,254,.85)',
        ],
        neblina: 'radial-gradient(ellipse at 50% 100%, rgba(59,130,246,.36) 0%, rgba(59,130,246,.20) 24%, rgba(59,130,246,.09) 48%, rgba(0,0,0,0) 72%)',
        cometa: ['rgba(226,240,255,', 'rgba(96,165,250,'],
        satelite: '#FFFFFF',
    },
    claro: {
        cieloOpacidad: 0.16,
        estrella: 'rgba(51,65,85,',
        planeta: '#e7edf7',
        linea: 'rgba(37,99,235,.55)',
        anillo: r => `rgba(37,99,235,${r === 1 ? 0.10 : 0.16})`,
        glow: [
            'rgba(37,99,235,.05)', 'rgba(79,70,229,.06)', 'rgba(99,102,241,.09)',
            'rgba(129,140,248,.13)', 'rgba(147,197,253,.22)', 'rgba(191,219,254,.55)',
        ],
        neblina: 'radial-gradient(ellipse at 50% 100%, rgba(147,197,253,.42) 0%, rgba(129,140,248,.22) 24%, rgba(191,219,254,.12) 48%, rgba(255,255,255,0) 74%)',
        cometa: ['rgba(37,99,235,', 'rgba(99,102,241,'],
        satelite: '#3B82F6',
    },
    // El cielo claro de los paneles de reservas (reservas/LayoutPanel): la composición de la
    // landing, pero sobre un celeste muy suave y solo en azules de marca (el resplandor de
    // `claro` pasa por índigo y sobre el celeste quedaba lavanda). Estrellas blancas (las grises
    // de `claro` parecían polvo), el planeta es el surface del panel (el contenido se apoya
    // encima), la línea del horizonte más suave que en la landing y los anillos un poco más
    // marcados: el texto del cuerpo (#334155) que los cruza al scrollear tiene que seguir en AA.
    // Con la línea a .42 el píxel más oscuro de todo el fondo da 4,8:1 con ese gris.
    panelClaro: {
        cieloOpacidad: 0.16,
        estrella: 'rgba(255,255,255,',
        planeta: 'var(--color-surface)',
        linea: 'rgba(37,99,235,.42)',
        anillo: r => `rgba(37,99,235,${r === 1 ? 0.18 : 0.26})`,
        glow: [
            'rgba(59,130,246,.05)', 'rgba(59,130,246,.06)', 'rgba(96,165,250,.10)',
            'rgba(147,197,253,.20)', 'rgba(191,219,254,.45)', 'rgba(219,234,254,.85)',
        ],
        neblina: 'radial-gradient(ellipse at 50% 100%, rgba(147,197,253,.30) 0%, rgba(191,219,254,.16) 24%, rgba(219,234,254,.08) 48%, rgba(255,255,255,0) 74%)',
        cometa: ['rgba(37,99,235,', 'rgba(96,165,250,'],
        satelite: '#3B82F6',
        cometasMarcados: true,
    },
};

const MOVIMIENTO_REDUCIDO = '(prefers-reduced-motion: reduce)';
const suscribirMovimiento = (aviso: () => void) => {
    const mq = window.matchMedia(MOVIMIENTO_REDUCIDO);
    mq.addEventListener('change', aviso);
    return () => mq.removeEventListener('change', aviso);
};
const movimientoReducido = () => window.matchMedia(MOVIMIENTO_REDUCIDO).matches;

// Acá antes vivían los satélites (Stock, Ventas, Pedidos, Clientes): íconos que
// recorrían el arco de los anillos. Se sacaron a pedido explícito — se quería
// solo el diseño de la escena (planeta, anillos, estrellas, cometas), sin las
// etiquetas de características superpuestas. Los anillos y su radio
// (RING_SCALE, un poco más abajo) quedan igual: son parte del dibujo del
// planeta, no del sistema de satélites que se retiró.
// En escritorio los anillos abren bien y quedan lindos. En celular, con la
// pantalla angosta, esos mismos factores hacían que los anillos treparan muy
// por encima del horizonte y se comieran la zona del texto del hero — así que
// en ≤768px se usan factores más ajustados, más pegados a la línea del planeta.
export const RING_SCALE: Record<number, number> = { 1: 1.30, 2: 1.16, 3: 1.05 };
export const RING_SCALE_MOVIL: Record<number, number> = { 1: 1.11, 2: 1.06, 3: 1.028 };

/** Desde qué punto del scroll total el planeta empieza a volver a subir. */
const REGRESO_DESDE = 0.80;

// ── Estrellas ────────────────────────────────────────────────────────────────
// Se dibujan en el canvas, no con un background de CSS, porque tienen que
// TITILAR: cada una con su propio brillo, su ritmo y su fase, como se ven de
// verdad (unas pocas fuertes que mandan, y un montón tenues de fondo).
//
// La versión anterior era un patrón de gradientes que se repetía cada 360px:
// barato, pero completamente inmóvil y con la grilla a la vista si mirabas fijo.
// La de antes de esa eran ~160 box-shadow sobre un elemento fijo, y con eso el
// navegador dejaba de repintar bien la página al scrollear.
export interface Estrella { x: number; y: number; r: number; base: number; vel: number; fase: number }

export function generarEstrellas(W: number, H: number): Estrella[] {
    // Cantidad atada al área, para que en una pantalla ancha no quede vacío ni
    // en uno angosto se sature.
    const cantidad = Math.round(clamp((W * H) / 5200, 90, 340));
    const estrellas: Estrella[] = [];
    for (let i = 0; i < cantidad; i++) {
        // Determinístico (nada de Math.random en el render): la misma pantalla
        // devuelve siempre el mismo cielo.
        const a = Math.sin(i * 12.9898) * 43758.5453;
        const b = Math.sin(i * 78.233) * 12345.6789;
        const c = Math.sin(i * 3.1415) * 9876.5432;
        const fr = (v: number) => v - Math.floor(v);
        const grande = fr(c) > 0.88; // unas pocas mandan
        estrellas.push({
            x: fr(a) * W,
            y: fr(b) * H,
            r: grande ? 1.1 + fr(a * 3) * 0.7 : 0.4 + fr(b * 5) * 0.6,
            base: grande ? 0.55 + fr(c * 7) * 0.35 : 0.16 + fr(a * 11) * 0.34,
            // Las tenues titilan más rápido; las grandes, con calma.
            vel: (grande ? 0.5 : 1.1) + fr(b * 13) * 0.9,
            fase: fr(c * 17) * Math.PI * 2,
        });
    }
    return estrellas;
}

/**
 * Devuelve el tramo VISIBLE de una circunferencia como una polilínea.
 *
 * Importa que sea solo el tramo visible y no el círculo entero: el planeta tiene
 * un radio de ~1.1 × el ancho de la pantalla, así que un <circle> obliga al
 * navegador a manejar una figura de miles de píxeles de lado (con trazos de
 * cientos de px encima) de la que se ve apenas una franja. Con la polilínea la
 * caja de dibujo es exactamente la pantalla.
 */
export function arco(cx: number, cy: number, r: number, W: number, pasos = 44): string {
    const puntos: string[] = [];
    for (let i = 0; i <= pasos; i++) {
        const x = (W * i) / pasos;
        const dx = x - cx;
        const y = cy - Math.sqrt(Math.max(r * r - dx * dx, 0));
        puntos.push(`${i === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`);
    }
    return puntos.join(' ');
}

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

// ── Cometas ──────────────────────────────────────────────────────────────────
// Pocos y lejanos a propósito: uno cada tanto, chico, fino y tenue. La idea es
// que el fondo respire cuando ya no está el planeta, no montar una lluvia de
// meteoritos que le robe la atención al texto.
interface Cometa { x: number; y: number; vx: number; vy: number; largo: number; vida: number; total: number; brillo: number }

function nuevoCometa(W: number, H: number, marcado = false): Cometa {
    // Entran desde el borde superior o desde los laterales de arriba, siempre
    // bajando en diagonal, como se ven de verdad.
    const desdeArriba = Math.random() < 0.6;
    // Los marcados (paleta con cometasMarcados: los paneles en claro) entran más cerca del
    // borde, bajan menos inclinados y un poco más rápido, y son más largos y más brillantes:
    // tienen que lucirse sobre un cielo claro antes de fundirse, no leerse lejanos.
    const margen = marcado ? 30 : 60;
    const x = desdeArriba ? Math.random() * W : (Math.random() < 0.5 ? -margen : W + margen);
    const y = desdeArriba ? -margen : Math.random() * H * (marcado ? 0.35 : 0.5);
    const haciaLaDerecha = x < W / 2;
    const inclinacion = marcado ? 0.3 : 0.42;
    const ang = (haciaLaDerecha ? inclinacion : Math.PI - inclinacion) + (Math.random() - 0.5) * 0.22;
    // Lento: la lejanía se lee sobre todo en la velocidad y el tamaño.
    const vel = (marcado ? 1.1 : 0.9) + Math.random() * (marcado ? 0.8 : 0.7);
    const total = (marcado ? 3600 : 3200) + Math.random() * 2200;
    return {
        x, y,
        vx: Math.cos(ang) * vel,
        vy: Math.sin(ang) * vel,
        largo: (marcado ? 110 : 90) + Math.random() * 120,
        vida: 0, total,
        brillo: marcado ? 0.6 + Math.random() * 0.35 : 0.35 + Math.random() * 0.35,
    };
}

/**
 * `planeta` en false deja solo las estrellas y los cometas: se apagan el
 * planeta, los anillos, el resplandor del horizonte y la neblina.
 *
 * Es para páginas donde el fondo compite con el texto en vez de acompañarlo:
 * en /nosotros, el arco celeste del horizonte pasaba justo por arriba de las
 * tarjetas de misión y visión y no se podían leer. Las estrellas no dan ese
 * problema (son puntos chicos sobre negro), así que quedan: la página sigue
 * perteneciendo al mismo mundo visual que el home.
 */
/**
 * `paleta` elige una paleta distinta a la del tema (`panelClaro` para los paneles de
 * reservas en claro). `contenedor` pone la escena en una capa absoluta que mide a su propio
 * contenedor en vez de a la ventana: es para los paneles, donde el cielo vive detrás de un
 * <main> que scrollea adentro de un armazón y la ventana no se mueve (así que el viaje del
 * planeta con el scroll no aplica y queda fijo). `satelite` suma el satélite del logo
 * recorriendo el anillo de adentro, en su propia capa; la landing no lo usa.
 */
export function EscenaEspacial({ planeta = true, oscuro = true, paleta: nombrePaleta, contenedor = false, satelite = false }: { planeta?: boolean; oscuro?: boolean; paleta?: keyof typeof PALETAS; contenedor?: boolean; satelite?: boolean }) {
    // Sin indicación la escena va en oscuro, que es su diseño.
    const isDark = oscuro;
    const paleta = PALETAS[nombrePaleta ?? (isDark ? 'oscuro' : 'claro')];
    const [medidas, setMedidas] = useState({ W: 0, H: 0 });
    const raizRef = useRef<HTMLDivElement>(null);
    const escenaRef = useRef<HTMLDivElement>(null);
    const brilloRef = useRef<HTMLDivElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    // El satélite se anima con SMIL: con prefers-reduced-motion directamente no se dibuja.
    const sinMovimiento = useSyncExternalStore(suscribirMovimiento, movimientoReducido, () => false);
    const idReact = useId();
    const idHalo = `ee-halo-${idReact.replace(/\W/g, '')}`;

    useEffect(() => {
        // En un contenedor (los paneles) se mide el propio elemento, y cualquier cambio de
        // tamaño vuelve a armar la escena: ahí la ventana no scrollea, así que no existe el
        // rebote que explica el filtro de abajo.
        if (contenedor) {
            const el = raizRef.current;
            if (!el) return;
            const ro = new ResizeObserver(([e]) => {
                const W = Math.round(e.contentRect.width), H = Math.round(e.contentRect.height);
                setMedidas(m => (m.W === W && m.H === H ? m : { W, H }));
            });
            ro.observe(el);
            return () => ro.disconnect();
        }
        // En mobile, la barra de direcciones se esconde/aparece AL SCROLLEAR
        // (no solo al rotar o redimensionar) y eso cambia `window.innerHeight`
        // — dispara un `resize` en cada gesto de scroll, no solo en un resize
        // de verdad. Sin este filtro, cada uno de esos reiniciaba por completo
        // el efecto de abajo (`[medidas, ...]`), y con él la posición
        // suavizada del planeta volvía a arrancar de cero: se veía como un
        // "rebote" hacia arriba en cada scroll, algo que en desktop no pasa
        // porque ahí el alto del viewport no cambia al scrollear. Un cambio de
        // ancho, o de alto mayor a 150px (una rotación, no la barra del
        // navegador, que mueve ~50-90px), sigue disparando la remedición real.
        let anterior = { W: window.innerWidth, H: window.innerHeight };
        const medir = () => {
            const actual = { W: window.innerWidth, H: window.innerHeight };
            const cambioAncho = actual.W !== anterior.W;
            const cambioAltoGrande = Math.abs(actual.H - anterior.H) > 150;
            if (!cambioAncho && !cambioAltoGrande) return;
            anterior = actual;
            setMedidas(actual);
        };
        // La medida inicial va en el frame siguiente, no en el efecto mismo: el React
        // Compiler marca un setState sincrónico dentro de un efecto como render en cascada.
        const inicial = requestAnimationFrame(() => setMedidas(anterior));
        window.addEventListener('resize', medir);
        return () => { cancelAnimationFrame(inicial); window.removeEventListener('resize', medir); };
    }, [contenedor]);

    useEffect(() => {
        if (medidas.W === 0) return;

        const { W, H } = medidas;
        const canvas = canvasRef.current;

        let raf = 0;
        let cancelado = false;
        let limpiarInterna: (() => void) | null = null;

        const iniciar = () => {
        if (cancelado) return;
        const quieto = window.matchMedia(MOVIMIENTO_REDUCIDO).matches;

        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const ctx = canvas?.getContext('2d') ?? null;
        if (canvas && ctx) {
            canvas.width = W * dpr;
            canvas.height = H * dpr;
            ctx.scale(dpr, dpr);
        }

        let anterior = performance.now();
        const t0 = anterior;
        const suave = { objetivo: window.scrollY, actual: window.scrollY };
        const estrellas = generarEstrellas(W, H);
        const cometas: Cometa[] = [];
        let proximoCometa = 700;
        let altoCache = document.documentElement.scrollHeight - H;

        const onScroll = () => { suave.objetivo = window.scrollY; };
        const onResize = () => { altoCache = document.documentElement.scrollHeight - H; };
        window.addEventListener('scroll', onScroll, { passive: true });
        window.addEventListener('resize', onResize);

        const tick = (ahora: number) => {
            const dt = Math.min(ahora - anterior, 50);
            anterior = ahora;

            suave.actual += (suave.objetivo - suave.actual) * 0.1;
            const y = suave.actual;

            // Progreso total de la página, para saber cuándo estamos cerca del final.
            const alto = altoCache;
            const prog = alto > 0 ? clamp(y / alto, 0, 1) : 0;

            // Ida: el planeta se hunde mientras dejás atrás el hero.
            const hundimiento = Math.min(y * 0.24, H * 0.5);
            // Vuelta: sobre el final vuelve a asomar, para cerrar detrás del footer
            // donde empezó. Con ease para que no se sienta un salto.
            const t = clamp((prog - REGRESO_DESDE) / (1 - REGRESO_DESDE), 0, 1);
            const regreso = (t * t * (3 - 2 * t)) * (H * 0.5 + Math.min(y * 0.24, H * 0.5) * 0.9);
            const desplazamiento = hundimiento - regreso;

            const brilloIda = clamp(1 - y / (H * 1.15), 0.16, 1);
            const brillo = Math.max(brilloIda, t * 0.92);

            if (escenaRef.current) escenaRef.current.style.transform = `translate3d(0, ${desplazamiento}px, 0)`;
            if (brilloRef.current) brilloRef.current.style.opacity = String(brillo);

            // ── Cielo y cometas ──────────────────────────────────────────────
            if (ctx) {
                ctx.clearRect(0, 0, W, H);
                const seg = (ahora - t0) / 1000;

                // Estrellas: cada una con su ritmo. El seno da el latido y el
                // exponente lo hace asimétrico — más tiempo tenue y un pico
                // corto de brillo, que es como titila una estrella de verdad.
                for (const e of estrellas) {
                    const latido = quieto ? 0.75 : 0.5 + 0.5 * Math.sin(seg * e.vel + e.fase);
                    const alpha = e.base * (0.32 + 0.68 * latido * latido);
                    ctx.fillStyle = `${paleta.estrella}${alpha.toFixed(3)})`;
                    ctx.beginPath();
                    ctx.arc(e.x, e.y, e.r, 0, Math.PI * 2);
                    ctx.fill();

                    // Las más brillantes suman un halo cuando están en su pico:
                    // es lo que las hace destacar sobre el resto del cielo.
                    if (e.r > 1.1 && latido > 0.72) {
                        const halo = ctx.createRadialGradient(e.x, e.y, 0, e.x, e.y, e.r * 5);
                        halo.addColorStop(0, `${paleta.estrella}${(alpha * 0.5).toFixed(3)})`);
                        halo.addColorStop(1, `${paleta.estrella}0)`);
                        ctx.fillStyle = halo;
                        ctx.beginPath();
                        ctx.arc(e.x, e.y, e.r * 5, 0, Math.PI * 2);
                        ctx.fill();
                    }
                }
            }

            // Los cometas están desde el arranque; lo único que los apaga es el
            // regreso del planeta al final.
            if (ctx && !quieto) {
                // Están desde el arranque, también sobre el hero: lo único que
                // los apaga es el regreso del planeta al final, donde el
                // resplandor vuelve a mandar en la escena.
                const zonaCometas = 1 - t;

                proximoCometa -= dt;
                if (proximoCometa <= 0) {
                    if (zonaCometas > 0.2 && cometas.length < 4) cometas.push(nuevoCometa(W, H, paleta.cometasMarcados));
                    proximoCometa = 1300 + Math.random() * 2400;
                }

                // Sin clearRect acá: el canvas ya lo limpió el bloque de las
                // estrellas, y volver a limpiarlo las borraría.
                for (let i = cometas.length - 1; i >= 0; i--) {
                    const c = cometas[i];
                    c.vida += dt;
                    c.x += c.vx * dt * 0.06;
                    c.y += c.vy * dt * 0.06;

                    const vidaN = c.vida / c.total;
                    if (vidaN >= 1 || c.x < -200 || c.x > W + 200 || c.y > H + 200) { cometas.splice(i, 1); continue; }

                    // Entra y sale con un fundido: nunca aparece ni se corta de golpe.
                    const fundido = Math.min(vidaN / 0.25, (1 - vidaN) / 0.35, 1);
                    const alpha = c.brillo * fundido * zonaCometas;
                    if (alpha <= 0.01) continue;

                    const norma = Math.hypot(c.vx, c.vy) || 1;
                    const tx = c.x - (c.vx / norma) * c.largo;
                    const ty = c.y - (c.vy / norma) * c.largo;

                    // La cola: la línea fina de siempre; los marcados suman antes un brillo ancho
                    // y suave por debajo (sobre un cielo claro la línea sola se perdía).
                    const trazos: [number, number][] = paleta.cometasMarcados ? [[5, 0.22], [1.8, 1]] : [[1.3, 1]];
                    ctx.lineCap = 'round';
                    for (const [ancho, k] of trazos) {
                        const grad = ctx.createLinearGradient(c.x, c.y, tx, ty);
                        grad.addColorStop(0, `${paleta.cometa[0]}${(alpha * k).toFixed(3)})`);
                        grad.addColorStop(0.35, `${paleta.cometa[1]}${(alpha * k * 0.42).toFixed(3)})`);
                        grad.addColorStop(1, `${paleta.cometa[1]}0)`);
                        ctx.strokeStyle = grad;
                        ctx.lineWidth = ancho;
                        ctx.beginPath();
                        ctx.moveTo(c.x, c.y);
                        ctx.lineTo(tx, ty);
                        ctx.stroke();
                    }

                    // Cabeza: apenas un punto con halo, para que se lea lejano. En los marcados, un
                    // poco más grande y con el centro lleno: se lee como meteorito y no como una raya.
                    const rCabeza = paleta.cometasMarcados ? 6 : 5;
                    const halo = ctx.createRadialGradient(c.x, c.y, 0, c.x, c.y, rCabeza);
                    halo.addColorStop(0, `${paleta.cometa[0]}${alpha.toFixed(3)})`);
                    if (paleta.cometasMarcados) halo.addColorStop(0.4, `${paleta.cometa[0]}${(alpha * 0.5).toFixed(3)})`);
                    halo.addColorStop(1, `${paleta.cometa[0]}0)`);
                    ctx.fillStyle = halo;
                    ctx.beginPath();
                    ctx.arc(c.x, c.y, rCabeza, 0, Math.PI * 2);
                    ctx.fill();
                }
            }

            raf = requestAnimationFrame(tick);
        };

        raf = requestAnimationFrame(tick);
        limpiarInterna = () => { window.removeEventListener('scroll', onScroll); window.removeEventListener('resize', onResize); cancelAnimationFrame(raf); };
        }; // fin iniciar

        // requestIdleCallback no está en Safari: con setTimeout como reemplazo.
        const conIdle = window as Window & { requestIdleCallback?: (cb: () => void) => number; cancelIdleCallback?: (id: number) => void };
        const idle = conIdle.requestIdleCallback ? conIdle.requestIdleCallback(iniciar) : setTimeout(iniciar, 1);

        return () => {
            cancelado = true;
            if (conIdle.cancelIdleCallback) conIdle.cancelIdleCallback(idle as number);
            else clearTimeout(idle);
            limpiarInterna?.();
        };
    }, [medidas, paleta]);

    const { W, H } = medidas;
    const esMovil = W > 0 && W <= 768;
    const R = 1.1 * W;
    const cy = (esMovil ? 0.86 : 0.72) * H + R;
    const horizonte = W > 0 ? arco(W / 2, cy, R, W) : '';
    const escalaAnillo = esMovil ? RING_SCALE_MOVIL : RING_SCALE;

    return (
        <div ref={raizRef} className="pointer-events-none inset-0 z-0 overflow-hidden" style={{ position: contenedor ? 'absolute' : 'fixed' }} aria-hidden="true">
            {/* Estrellas y cometas: van juntos en el canvas, porque las estrellas
                ahora titilan y hay que repintarlas frame a frame igual que a los
                cometas. */}
            <canvas ref={canvasRef} className="absolute inset-0" style={{ width: '100%', height: '100%' }} />

            {/* Todo lo que se mueve con el scroll */}
            <div ref={escenaRef} className="absolute inset-0" style={{ willChange: 'transform' }}>
                <div ref={brilloRef} className="absolute inset-0" style={{ willChange: 'opacity' }}>
                    {/* Neblina atmosférica sobre el horizonte */}
                    {planeta && (
                        <div
                            className="absolute"
                            style={{
                                left: '50%', bottom: '-10%', width: 'min(1600px, 150vw)', height: 'min(900px, 90vh)',
                                transform: 'translateX(-50%)',
                                background: paleta.neblina,
                                filter: 'blur(24px)',
                            }}
                        />
                    )}

                    {planeta && W > 0 && (
                        <svg width="100%" height="100%" viewBox={`0 0 ${W} ${H}`}>
                            {/* Anillos, de afuera hacia adentro */}
                            {([1, 2, 3] as const).map(ring => (
                                <path
                                    key={ring}
                                    d={arco(W / 2, cy, escalaAnillo[ring] * R, W)}
                                    fill="none"
                                    stroke={paleta.anillo(ring)}
                                    strokeWidth={1}
                                    strokeDasharray={ring === 2 ? '5 8' : undefined}
                                />
                            ))}

                            {/* Resplandor del horizonte: trazos anchos y translúcidos,
                                de más ancho a más fino. Se usa esto en vez de un blur
                                porque un filtro sobre una figura de este tamaño es
                                carísimo de rasterizar. */}
                            <path d={horizonte} fill="none" stroke={paleta.glow[0]} strokeWidth={420} />
                            <path d={horizonte} fill="none" stroke={paleta.glow[1]} strokeWidth={220} />
                            <path d={horizonte} fill="none" stroke={paleta.glow[2]} strokeWidth={110} />
                            <path d={horizonte} fill="none" stroke={paleta.glow[3]} strokeWidth={48} />
                            <path d={horizonte} fill="none" stroke={paleta.glow[4]} strokeWidth={18} />
                            <path d={horizonte} fill="none" stroke={paleta.glow[5]} strokeWidth={6} />

                            {/* Cuerpo del planeta: el mismo arco cerrado contra el borde
                                de abajo. Va DESPUÉS del resplandor para tapar la mitad
                                que cae del lado de adentro — el planeta queda negro y la
                                luz se ve solo por encima del horizonte. */}
                            <path d={`${horizonte} L${W} ${H} L0 ${H} Z`} style={{ fill: paleta.planeta }} />

                            {/* La "línea del amanecer", nítida, al final de todo. */}
                            <path d={horizonte} fill="none" stroke={paleta.linea} strokeWidth={1.6} />
                        </svg>
                    )}

                    {/* El satélite del logo sobre el anillo de adentro: entra por un costado y sale
                        por el otro (la opacidad lo funde en las puntas). En su propia capa, para no
                        tocar el dibujo del planeta. */}
                    {planeta && satelite && W > 0 && !sinMovimiento && (
                        <svg width="100%" height="100%" viewBox={`0 0 ${W} ${H}`} className="absolute inset-0" focusable="false">
                            <defs>
                                <radialGradient id={idHalo}>
                                    <stop offset="0" stopColor={paleta.satelite} stopOpacity={isDark ? 0.9 : 0.45} />
                                    <stop offset="1" stopColor="#3B82F6" stopOpacity="0" />
                                </radialGradient>
                            </defs>
                            <g>
                                <animateMotion path={arco(W / 2, cy, escalaAnillo[3] * R, W)} dur="38s" repeatCount="indefinite" />
                                <animate attributeName="opacity" values="0;1;1;0" keyTimes="0;0.08;0.92;1" dur="38s" repeatCount="indefinite" />
                                <circle r={9} fill={`url(#${idHalo})`} />
                                <circle r={2.6} fill={paleta.satelite} />
                            </g>
                        </svg>
                    )}
                </div>
            </div>
        </div>
    );
}
