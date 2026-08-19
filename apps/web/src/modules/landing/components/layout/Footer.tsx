import { useState } from 'react';
import { LegalModal } from '@/modules/landing/components/ui/LegalModal';
import { OrbitaLogo } from '@/design-system/components/OrbitaLogo';

type LegalKey = 'terminos' | 'privacidad' | 'cookies';

const cols = [
  {
    title: 'Navegación',
    links: [
      { label: 'Módulos',      href: '#modulos'      },
      { label: 'Rubros',       href: '#rubros'       },
      { label: 'Testimonios',  href: '#testimonios'  },
      { label: 'Próximamente', href: '#proximamente' },
    ],
  },
  {
    title: 'Plataforma',
    links: [
      { label: 'Turnos',      href: '#modulos' },
      { label: 'Tienda',      href: '#modulos' },
      { label: 'Dashboard',   href: '#modulos' },
      { label: 'Clientes',    href: '#modulos' },
    ],
  },
  {
    title: 'Legal & Contacto',
    links: [
      { label: 'Términos de uso', action: 'terminos'   as LegalKey },
      { label: 'Privacidad',      action: 'privacidad' as LegalKey },
      { label: 'Cookies',         action: 'cookies'    as LegalKey },
    ],
  },
];

export function Footer() {
  const [modal, setModal] = useState<{ isOpen: boolean; contentKey: LegalKey | null }>({
    isOpen: false, contentKey: null,
  });

  const handleClick = (e: React.MouseEvent, link: { href?: string; action?: LegalKey }) => {
    e.preventDefault();
    if (link.action) { setModal({ isOpen: true, contentKey: link.action }); return; }
    if (!link.href) return;
    if (link.href === '#') { window.scrollTo({ top: 0, behavior: 'smooth' }); return; }
    const el = document.getElementById(link.href.slice(1));
    if (!el) return;
    const isSticky = ['#rubros', '#testimonios', '#proximamente'].includes(link.href);
    window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - (isSticky ? 0 : 80), behavior: 'smooth' });
  };

  return (
    <>
      <footer className="bg-transparent md:bg-white md:dark:bg-slate-950 border-t border-slate-200 dark:border-white/5 pt-16 pb-8 relative z-10">
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-12">
            <div className="md:col-span-1">
              <div className="flex items-center gap-2.5 mb-4 cursor-pointer" onClick={e => handleClick(e, { href: '#' })}>
                <OrbitaLogo size={28} animated={false} />
                <span className="text-lg font-bold text-slate-900 dark:text-white">Órbita</span>
              </div>
              <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed max-w-[240px]">
                La plataforma integral que pone tu negocio en órbita. Turnos, ventas, clientes y analytics en un solo lugar.
              </p>
            </div>

            {cols.map(col => (
              <div key={col.title}>
                <h4 className="text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-500 mb-4">{col.title}</h4>
                <ul className="space-y-3">
                  {col.links.map(link => (
                    <li key={link.label}>
                      <a href={(link as { href?: string }).href || '#'} onClick={e => handleClick(e, link as { href?: string; action?: LegalKey })}
                        className="text-sm text-slate-600 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors cursor-pointer"
                      >
                        {link.label}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <div className="pt-8 border-t border-slate-200 dark:border-white/5 flex flex-col sm:flex-row justify-between items-center gap-4">
            <span className="text-sm text-slate-400">© 2026 Órbita. Todos los derechos reservados.</span>
            <span className="text-sm text-slate-400">Hecho por emprendedores, para emprendedores</span>
          </div>
        </div>
      </footer>

      <LegalModal
        isOpen={modal.isOpen}
        contentKey={modal.contentKey}
        onClose={() => setModal(m => ({ ...m, isOpen: false }))}
      />
    </>
  );
}
