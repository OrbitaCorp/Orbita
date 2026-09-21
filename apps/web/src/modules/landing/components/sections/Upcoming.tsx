import type { ReactNode } from 'react';

interface UpcomingItem { icon: ReactNode; title: string; desc: string; eta: string; color: string; }

const UPCOMING: UpcomingItem[] = [
  {
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>,
    title: 'Chat Integrado', desc: 'Habla con tus clientes directamente desde la plataforma, sin salir a WhatsApp.', eta: 'Q3 2026', color: 'text-blue-500 bg-blue-500/10 border-blue-500/20',
  },
  {
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6"><path d="M12 2a10 10 0 0 1 10 10 10 10 0 0 1-10 10A10 10 0 0 1 2 12 10 10 0 0 1 12 2z"/><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>,
    title: 'Multi-Sucursal', desc: 'Gestioná varias sucursales desde un solo panel. Reportes cruzados y control total.', eta: 'Q4 2026', color: 'text-purple-500 bg-purple-500/10 border-purple-500/20',
  },
  {
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6"><path d="M12 20V10M18 20V4M6 20v-4"/></svg>,
    title: 'IA Predictiva', desc: 'Predicciones de demanda, stock inteligente y sugerencias automáticas basadas en datos.', eta: '2027', color: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20',
  },
];

export function Upcoming() {
  return (
    <section className="relative bg-transparent py-14 px-6 z-10 overflow-hidden">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] rounded-full bg-blue-600/5 dark:bg-blue-600/8 blur-[80px]" />
      </div>

      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-10">
          <span data-aos="fade-up" className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-bold uppercase tracking-widest border bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/25 text-amber-700 dark:text-amber-400 mb-5">
            <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
            Próximamente
          </span>
          <h2 data-aos="fade-up" data-aos-delay="120" className="text-4xl sm:text-5xl font-black tracking-tight text-slate-900 dark:text-white">
            Lo que viene para <span className="text-blue-500">Órbita.</span>
          </h2>
          <p data-aos="fade-up" data-aos-delay="220" className="mt-4 text-base text-slate-600 dark:text-slate-400 max-w-md mx-auto">
            Estamos construyendo el futuro del management para todo tipo de negocios. Acá está el roadmap.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {UPCOMING.map((item, i) => (
            <div key={item.title} data-aos="fade-up" data-aos-delay={String(320 + i * 120)}
              className="group relative bg-slate-50 dark:bg-slate-900/40 border border-dashed border-slate-200 dark:border-white/10 rounded-2xl p-7 text-center hover:border-blue-300 dark:hover:border-blue-500/30 hover:-translate-y-1 transition-all duration-300"
            >
              <div className={`w-12 h-12 rounded-2xl ${item.color} border flex items-center justify-center mx-auto mb-5`}>{item.icon}</div>
              <h3 className="text-lg font-black text-slate-900 dark:text-white mb-2">{item.title}</h3>
              <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed mb-5">{item.desc}</p>
              <span className="inline-flex items-center px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest bg-amber-100 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/25 text-amber-700 dark:text-amber-400">{item.eta}</span>
            </div>
          ))}
        </div>

      </div>
    </section>
  );
}
