// Navbar de la propuesta de home.
//
// Es propio y no el Navbar viejo porque aquel apunta a secciones que esta página
// no tiene (#testimonios, #proximamente del home anterior) y llevaría a anclas
// muertas. Acá cada link va a una sección que existe de verdad, y se marca sola
// la que estás mirando.

import { useEffect, useState } from 'react';
import { Menu, X, Moon, Sun } from 'lucide-react';
import { OrbitaLogo } from '@/design-system/components/OrbitaLogo';
import { useAuth } from '@/lib/auth/AuthContext';
import { useTheme } from '@/modules/landing/context/ThemeContext';
import { tenantUrl } from '@/lib/tenant';

const LINKS = [
    { label: 'Qué incluye',   href: '#modulos'       },
    { label: 'Cómo funciona', href: '#como-funciona' },
    { label: 'Rubros',        href: '#rubros'        },
    { label: 'Precio',        href: '#precios'       },
    { label: 'Preguntas',     href: '#faq'           },
];

export function NavbarV2() {
    const { status, user } = useAuth();
    const { isDark, toggleTheme } = useTheme();
    const [scrolleado, setScrolleado] = useState(false);
    const [abierto, setAbierto] = useState(false);
    const [activa, setActiva] = useState('');

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

    // Marca el link de la sección que estás mirando.
    useEffect(() => {
        const ids = LINKS.map(l => l.href.slice(1));
        const obs = new IntersectionObserver(
            entradas => entradas.forEach(e => { if (e.isIntersecting) setActiva(e.target.id); }),
            { rootMargin: '-45% 0px -50% 0px' },
        );
        ids.forEach(id => { const el = document.getElementById(id); if (el) obs.observe(el); });
        return () => obs.disconnect();
    }, []);

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
                <a href="#" className="flex shrink-0 cursor-pointer items-center gap-2.5" aria-label="Órbita — inicio">
                    <OrbitaLogo size={26} />
                    <span className="text-[17px] font-black tracking-[-0.02em] text-white">Órbita</span>
                </a>

                <ul className="ml-4 hidden flex-1 items-center gap-1 lg:flex">
                    {LINKS.map(l => {
                        const act = activa === l.href.slice(1);
                        return (
                            <li key={l.href}>
                                <a
                                    href={l.href}
                                    className="inline-flex cursor-pointer items-center rounded-lg px-3 py-2 text-[13.5px] font-semibold transition-colors duration-200"
                                    style={{ color: act ? 'var(--oc-text)' : 'var(--oc-text-3)', background: act ? 'var(--oc-accent-soft)' : 'transparent' }}
                                >
                                    {l.label}
                                </a>
                            </li>
                        );
                    })}
                </ul>

                <div className="ml-auto flex items-center gap-2">
                    <button
                        onClick={toggleTheme}
                        className="grid h-10 w-10 cursor-pointer place-items-center rounded-xl transition-colors duration-200"
                        style={{ color: 'var(--oc-text-3)', background: 'var(--oc-ghost-bg)', border: '1px solid var(--oc-ghost-bd)' }}
                        aria-label={isDark ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro'}
                        title={isDark ? 'Tema claro' : 'Tema oscuro'}
                    >
                        {isDark ? <Sun size={16} /> : <Moon size={16} />}
                    </button>

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
                            <a
                                href="/login"
                                className="hidden cursor-pointer rounded-xl px-3 py-2 text-[13.5px] font-semibold text-slate-300 transition-colors duration-200 hover:text-white sm:inline-flex"
                            >
                                Iniciar sesión
                            </a>
                            <a
                                href="/onboarding/rubro"
                                className="oc-cta inline-flex cursor-pointer items-center gap-2 rounded-xl px-4 text-[13.5px] font-bold transition-colors duration-200"
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
                                    href={l.href}
                                    onClick={() => setAbierto(false)}
                                    className="flex cursor-pointer items-center rounded-lg px-3 text-[14.5px] font-semibold text-slate-200 transition-colors duration-200 hover:bg-white/5"
                                    style={{ minHeight: 46 }}
                                >
                                    {l.label}
                                </a>
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </header>
    );
}
