// Navbar de la propuesta de home.
//
// Es propio y no el Navbar viejo porque aquel apunta a secciones que esta página
// no tiene (#testimonios, #proximamente del home anterior) y llevaría a anclas
// muertas. Acá cada link va a una sección que existe de verdad, y se marca sola
// la que estás mirando.
//
// "Nosotros" es distinto al resto: no es un ancla dentro de esta misma página,
// es una página propia (pages/nosotros.tsx) — por eso su href empieza con "/"
// y no con "#", y por eso queda último en la lista (después de Preguntas): es
// la única que saca al usuario del flujo de la home.
//
// Este mismo navbar se usa en /nosotros (vía PaginaV2). Los anclas (#rubros,
// #precios, etc.) solo existen en el home — si se dejaran tal cual, en
// /nosotros un click no hacía NADA (el navegador solo le agrega el hash a la
// URL actual, que no tiene ningún elemento con ese id). `hrefReal` corrige
// esto: fuera del home, antepone "/" para volver ahí Y saltar a la sección.
//
// El color de los links va por inline `style`, con el hover controlado a
// mano (`hoverLink`), no por clase `hover:text-*` de Tailwind — probado y
// confirmado que NO se ve: PaginaV2.tsx tiene un bloque
// `.oc-page .text-slate-400/.text-white { color: ... !important }` para
// mapear la paleta clara/oscura, y como ese <style> vive más abajo en el HTML
// que la hoja de Tailwind, en un empate de especificidad gana por orden de
// aparición — la regla de "activo por defecto" le gana SIEMPRE al `:hover`,
// aunque el mouse esté encima. El fondo del hover sí puede ir por clase
// (`hover:bg-white/[0.06]`): nada intercepta clases de background acá.

import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { Menu, X } from 'lucide-react';
import { OrbitaLogo } from '@/design-system/components/OrbitaLogo';
import { useAuth } from '@/lib/auth/AuthContext';
import { tenantUrl } from '@/lib/tenant';

const LINKS = [
    { label: 'Qué incluye',   href: '#modulos'       },
    { label: 'Cómo funciona', href: '#como-funciona' },
    { label: 'Rubros',        href: '#rubros'        },
    { label: 'Precio',        href: '#precios'       },
    { label: 'Preguntas',     href: '#faq'           },
    { label: 'Nosotros',      href: '/nosotros'      },
];

export function NavbarV2() {
    const { status, user } = useAuth();
    const router = useRouter();
    const [scrolleado, setScrolleado] = useState(false);
    const [abierto, setAbierto] = useState(false);
    const [activa, setActiva] = useState('');
    const [hoverLink, setHoverLink] = useState<string | null>(null);

    // Mismo criterio que el navbar viejo: la landing la mira sobre todo gente
    // deslogueada, así que se muestra el estado deslogueado y recién cambia si
    // resulta haber sesión — nada de placeholders pulsando para todos.
    const hrefPanel = status === 'authenticated' && user?.type === 'member'
        ? tenantUrl(user.business.subdomain, '/panel')
        : null;

    useEffect(() => {
        const onScroll = () => setScrolleado(window.scrollY > 20);
        onScroll();
        window.addEventListener('scroll', onScroll, { passive: true });
        return () => window.removeEventListener('scroll', onScroll);
    }, []);

    // Marca el link de la sección que estás mirando — solo aplica a los
    // anclas (#seccion) de esta misma página; "Nosotros" al ser otra página
    // se marca activa por ruta, más abajo.
    useEffect(() => {
        const ids = LINKS.filter(l => l.href.startsWith('#')).map(l => l.href.slice(1));
        const obs = new IntersectionObserver(
            entradas => entradas.forEach(e => { if (e.isIntersecting) setActiva(e.target.id); }),
            { rootMargin: '-45% 0px -50% 0px' },
        );
        ids.forEach(id => { const el = document.getElementById(id); if (el) obs.observe(el); });
        return () => obs.disconnect();
    }, []);

    const esActivo = (href: string) => (href.startsWith('#') ? activa === href.slice(1) : router.pathname === href);

    const enHome = router.pathname === '/';
    const hrefReal = (href: string) => (href.startsWith('#') && !enHome ? `/${href}` : href);

    return (
        <header
            className="fixed inset-x-0 top-0 z-40 transition-colors duration-300"
            style={{
                background: scrolleado ? 'var(--oc-panel)' : 'transparent',
                borderBottom: `1px solid ${scrolleado ? 'var(--oc-card-bd)' : 'transparent'}`,
                backdropFilter: scrolleado ? 'blur(14px)' : undefined,
            }}
        >
            <nav className="mx-auto flex h-[68px] max-w-6xl items-center gap-6 px-6" aria-label="Principal">
                {/* En el home, "#" hace scroll-to-top suave sin recargar; fuera
                    de él (ej. /nosotros), tiene que ser "/" para volver ahí. */}
                <a href={enHome ? '#' : '/'} className="flex shrink-0 cursor-pointer items-center gap-2.5" aria-label="Ir al inicio">
                    <OrbitaLogo size={26} />
                    <span className="text-[17px] font-black tracking-[-0.02em] text-white">Órbita</span>
                </a>

                <ul className="ml-4 hidden flex-1 items-center gap-1 lg:flex">
                    {LINKS.map(l => {
                        const act = esActivo(l.href);
                        return (
                            <li key={l.href}>
                                {/* Mismo criterio que .oc-card-hover: solo color, nunca
                                    transform. Sin `act`, un hover en un link ya resaltado
                                    no se nota, que es lo esperable. */}
                                <a
                                    href={hrefReal(l.href)}
                                    onMouseEnter={() => setHoverLink(l.href)}
                                    onMouseLeave={() => setHoverLink(h => (h === l.href ? null : h))}
                                    className={`inline-flex cursor-pointer items-center rounded-lg px-3 py-2 text-[13.5px] font-semibold transition-colors duration-200 ${act ? '' : 'hover:bg-white/[0.06]'}`}
                                    style={{
                                        color: act || hoverLink === l.href ? 'var(--oc-text)' : 'var(--oc-text-3)',
                                        background: act ? 'var(--oc-accent-soft)' : undefined,
                                    }}
                                >
                                    {l.label}
                                </a>
                            </li>
                        );
                    })}
                </ul>

                <div className="ml-auto flex items-center gap-2">
                    {hrefPanel ? (
                        <a
                            href={hrefPanel}
                            className="oc-cta inline-flex cursor-pointer items-center gap-2 rounded-xl px-4 text-[13.5px] font-bold transition-colors duration-200"
                            style={{ minHeight: 40 }}
                        >
                            Ir a mi panel
                        </a>
                    ) : (
                        <>
                            {/* Siempre visible (sin hidden/breakpoint): en mobile chico
                                (<sm) es el ÚNICO de los dos que se ve acá — "Crear tu
                                espacio" queda oculto ahí (ver más abajo) porque ya está
                                repetido bien grande en el hero, mientras que loguearse no
                                tenía ningún otro lugar visible sin abrir el menú
                                hamburguesa. Pedido explícito: priorizar login en el navbar
                                mobile por sobre duplicar el CTA que ya está en el hero.
                                Con borde (`oc-ghost`, la misma clase que "Ver cómo
                                funciona" del hero) en vez de texto suelto: como texto
                                plano quedaba perdido contra el fondo oscuro — sin forma
                                de botón, costaba notar que se podía tocar. */}
                            <a
                                href="/login"
                                className="oc-ghost inline-flex cursor-pointer items-center rounded-xl px-3.5 text-[13.5px] font-semibold transition-colors duration-200 hover:bg-white/10"
                                style={{ minHeight: 40, border: '1px solid var(--oc-ghost-bd)', background: 'var(--oc-ghost-bg)' }}
                            >
                                Iniciar sesión
                            </a>
                            <a
                                href="/onboarding/rubro"
                                className="oc-cta hidden cursor-pointer items-center gap-2 rounded-xl px-4 text-[13.5px] font-bold transition-colors duration-200 sm:inline-flex"
                                style={{ minHeight: 40 }}
                            >
                                Crear tu espacio
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                    <path d="M5 12h14M12 5l7 7-7 7" />
                                </svg>
                            </a>
                        </>
                    )}

                    <button
                        onClick={() => setAbierto(a => !a)}
                        className="grid h-10 w-10 cursor-pointer place-items-center rounded-xl text-slate-300 transition-colors duration-200 hover:bg-white/10 lg:hidden"
                        aria-label={abierto ? 'Cerrar menú' : 'Abrir menú'}
                        aria-expanded={abierto}
                    >
                        {abierto ? <X size={19} /> : <Menu size={19} />}
                    </button>
                </div>
            </nav>

            {abierto && (
                <div
                    className="lg:hidden"
                    style={{ background: 'var(--oc-panel)', borderTop: '1px solid var(--oc-card-bd)' }}
                >
                    <ul className="mx-auto max-w-6xl px-6 py-3">
                        {LINKS.map(l => (
                            <li key={l.href}>
                                <a
                                    href={hrefReal(l.href)}
                                    onClick={() => setAbierto(false)}
                                    onMouseEnter={() => setHoverLink(l.href)}
                                    onMouseLeave={() => setHoverLink(h => (h === l.href ? null : h))}
                                    className="flex cursor-pointer items-center rounded-lg px-3 text-[14.5px] font-semibold transition-colors duration-200 hover:bg-white/[0.06]"
                                    style={{ minHeight: 46, color: hoverLink === l.href ? 'var(--oc-text)' : 'var(--oc-text-2)' }}
                                >
                                    {l.label}
                                </a>
                            </li>
                        ))}

                        {/* "Crear tu espacio", no "Iniciar sesión"/"Ir a mi panel": esos
                            dos ya quedaron SIEMPRE visibles en la fila de arriba (el
                            header es `fixed`, así que se ven en cualquier scroll) — este
                            <li> acá sería pura duplicación. Lo que sí se sacó de esa fila
                            en mobile chico (<sm) fue el CTA de "Crear tu espacio" (ver más
                            arriba): sin este link, alguien logueado afuera que scrolleó
                              más allá del hero se quedaba sin ninguna forma de llegar a
                            crear su espacio salvo volver a subir del todo. Solo aplica sin
                            sesión — con sesión ya tiene "Ir a mi panel" fijo arriba. */}
                        {!hrefPanel && (
                        <li className="mt-2 border-t pt-2" style={{ borderColor: 'var(--oc-card-bd)' }}>
                            <a
                                href="/onboarding/rubro"
                                onClick={() => setAbierto(false)}
                                onMouseEnter={() => setHoverLink('/onboarding/rubro')}
                                onMouseLeave={() => setHoverLink(h => (h === '/onboarding/rubro' ? null : h))}
                                className="flex cursor-pointer items-center gap-2 rounded-lg px-3 text-[14.5px] font-bold transition-colors duration-200 hover:bg-white/[0.06]"
                                style={{ minHeight: 46, color: 'var(--oc-accent)' }}
                            >
                                Crear tu espacio
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                    <path d="M5 12h14M12 5l7 7-7 7" />
                                </svg>
                            </a>
                        </li>
                        )}
                    </ul>
                </div>
            )}
        </header>
    );
}
