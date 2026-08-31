import { useState, useEffect } from 'react';
import { Menu, X, Moon, Sun } from 'lucide-react';
import { useTheme } from '@/modules/landing/context/ThemeContext';
import { OrbitaLogo } from '@/design-system/components/OrbitaLogo';
import { useAuth } from '@/lib/auth/AuthContext';
import { tenantUrl } from '@/lib/tenant';

const NAV_LINKS = [
  { label: 'Módulos',      href: '#modulos'      },
  { label: 'Rubros',       href: '#rubros'       },
  { label: 'Testimonios',  href: '#testimonios'  },
  { label: 'Próximamente', href: '#proximamente' },
];

export function Navbar() {
  const { isDark, toggleTheme } = useTheme();
  const { status, user } = useAuth();
  const [scrolled,  setScrolled]  = useState(false);
  const [menuOpen,  setMenuOpen]  = useState(false);
  const [active,    setActive]    = useState('');

  // Sin placeholder mientras resuelve la sesión: la landing la mira sobre todo
  // gente deslogueada, así que se muestra directamente el estado deslogueado y
  // recién cambia a "Ir a tu tienda" si resulta haber sesión. Dos rectángulos
  // pulsando en el header le hacían pagar a todo el mundo la espera de una
  // consulta que a la mayoría no le cambia nada.
  const ownerHref = status === 'authenticated' && user?.type === 'member'
    ? tenantUrl(user.business.subdomain, '/panel')
    : null;

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    const ids = NAV_LINKS.map(l => l.href.slice(1));
    const observer = new IntersectionObserver(
      entries => entries.forEach(e => { if (e.isIntersecting) setActive(e.target.id); }),
      { rootMargin: '-40% 0px -55% 0px' }
    );
    const t = setTimeout(() => {
      ids.forEach(id => { const el = document.getElementById(id); if (el) observer.observe(el); });
    }, 1500);
    return () => { clearTimeout(t); observer.disconnect(); };
  }, []);

  const handleClick = (e: React.MouseEvent, href: string) => {
    e.preventDefault();
    setMenuOpen(false);
    const el = document.getElementById(href.slice(1));
    if (!el) return;
    const top = el.getBoundingClientRect().top + window.scrollY - 80;
    window.scrollTo({ top, behavior: 'smooth' });
  };

  return (
    <header className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300
      ${scrolled
        ? 'py-3 backdrop-blur-xl bg-white/90 dark:bg-slate-950/80 shadow-[0_1px_0_0_rgba(0,0,0,0.06)] dark:shadow-[0_1px_0_0_rgba(255,255,255,0.06)]'
        : 'py-5 bg-transparent'}`}
    >
      <div className="max-w-7xl mx-auto px-6 flex items-center gap-6">
        <a href="#" className="flex items-center gap-2.5 flex-shrink-0 group">
          <OrbitaLogo size={32} />
          <span className="text-xl font-bold tracking-tight text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors leading-none mt-[1px]">
            Órbita
          </span>
        </a>

        <nav className="hidden md:flex items-center gap-0.5 ml-4">
          {NAV_LINKS.map(l => {
            const isActive = active === l.href.slice(1);
            return (
              <a key={l.label} href={l.href} onClick={e => handleClick(e, l.href)}
                className={`relative px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-200 group
                  ${isActive ? 'text-blue-600 dark:text-blue-400' : 'text-slate-700 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400'}`}
              >
                {l.label}
                <span className={`absolute bottom-0 left-1/2 -translate-x-1/2 h-[2px] rounded-full bg-blue-500 transition-all duration-300
                  ${isActive ? 'w-5 opacity-100' : 'w-0 opacity-0 group-hover:w-4 group-hover:opacity-60'}`} />
              </a>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-3">
          <button onClick={toggleTheme} aria-label="Cambiar tema"
            className="w-9 h-9 rounded-xl flex items-center justify-center border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 text-slate-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 hover:border-blue-400 dark:hover:border-blue-500/50 transition-all"
          >
            {isDark ? <Sun size={16} /> : <Moon size={16} />}
          </button>

          {ownerHref ? (
            <a href={ownerHref} className="hidden md:flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-bold transition-all shadow-lg shadow-blue-500/25 hover:-translate-y-0.5">
              Ir a tu tienda
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
            </a>
          ) : (
            <>
              <a href="/login" className="hidden md:flex text-sm font-semibold text-slate-700 dark:text-slate-300 hover:text-blue-600 dark:hover:text-white transition-colors px-3 py-2">
                Iniciar sesión
              </a>

              <a href="/onboarding/rubro" className="hidden md:flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-bold transition-all shadow-lg shadow-blue-500/25 hover:-translate-y-0.5">
                Crear tu espacio
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
              </a>
            </>
          )}

          <button className="md:hidden w-9 h-9 rounded-xl flex items-center justify-center border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 text-slate-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 hover:border-blue-400 dark:hover:border-blue-500/50 transition-all"
            onClick={() => setMenuOpen(o => !o)} aria-label="Abrir menú"
          >
            {menuOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
      </div>

      {menuOpen && (
        <div className="md:hidden absolute top-full left-0 right-0 bg-white dark:bg-slate-950 border-b border-slate-200 dark:border-white/10 px-6 py-4 flex flex-col gap-2">
          {NAV_LINKS.map(l => (
            <a key={l.label} href={l.href} onClick={e => handleClick(e, l.href)}
              className="px-4 py-3 rounded-xl text-sm font-semibold text-slate-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-white/5 transition-all"
            >
              {l.label}
            </a>
          ))}
          {ownerHref ? (
            <a href={ownerHref} className="mt-2 flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 transition-colors text-white text-sm font-bold">
              Ir a tu tienda →
            </a>
          ) : (
            <a href="/onboarding/rubro" className="mt-2 flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 transition-colors text-white text-sm font-bold">
              Crear tu espacio →
            </a>
          )}
        </div>
      )}
    </header>
  );
}
