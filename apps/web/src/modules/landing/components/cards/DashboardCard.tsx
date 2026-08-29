import { useState, useEffect, useRef } from 'react';

const PERIODS = ['Hoy','Semana','Mes'] as const;
type Period = typeof PERIODS[number];

const DATA: Record<Period, { ventas:number; turnos:number; pedidos:number; bars:{label:string; h:number; today?:boolean}[] }> = {
  Hoy:    { ventas:47500,  turnos:12,  pedidos:8,   bars:[{label:'Lun',h:55},{label:'Mar',h:72},{label:'Mié',h:48},{label:'Jue',h:85},{label:'Vie',h:68},{label:'Sáb',h:78},{label:'Dom',h:92,today:true}] },
  Semana: { ventas:312000, turnos:67,  pedidos:43,  bars:[{label:'S-4',h:52},{label:'S-3',h:61},{label:'S-2',h:74},{label:'S-1',h:68},{label:'Esta',h:88,today:true}] },
  Mes:    { ventas:1250000,turnos:284, pedidos:178, bars:[{label:'Ene',h:55},{label:'Feb',h:62},{label:'Mar',h:70},{label:'Abr',h:58},{label:'May',h:92,today:true}] },
};

const SALES_POOL = [
  { initials:'VM', product:'Coloración completa', time:'14:32', amount:'+$8.500'  },
  { initials:'DR', product:'Jean mom azul',       time:'14:15', amount:'+$15.900' },
  { initials:'CT', product:'Manicura gel',        time:'13:50', amount:'+$4.800'  },
  { initials:'SP', product:'Campera oversize',    time:'13:22', amount:'+$22.000' },
];

function useCountUp(target: number, duration = 1100) {
  const [value, setValue] = useState(0);
  const rafRef = useRef<number>(0);
  useEffect(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    let start: number | null = null;
    const animate = (ts: number) => {
      if (!start) start = ts;
      const p = Math.min((ts - start) / duration, 1);
      setValue(Math.round((1 - Math.pow(1 - p, 3)) * target));
      if (p < 1) rafRef.current = requestAnimationFrame(animate);
    };
    rafRef.current = requestAnimationFrame(animate);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [target, duration]);
  return value;
}

function StatCard({ label, value, prefix = '', color }: { label:string; value:number; prefix?:string; color:string }) {
  const count = useCountUp(value);
  return (
    <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-white/5 rounded-xl p-3">
      <div className="text-[9px] font-bold uppercase tracking-widest text-slate-400 mb-1.5">{label}</div>
      <div className={`text-base font-black font-mono ${color}`}>{prefix}{count.toLocaleString('es-AR')}</div>
    </div>
  );
}

export function DashboardCard() {
  const [period, setPeriod] = useState<Period>('Hoy');
  const [barsGrown, setBars] = useState(false);
  const [sales, setSales] = useState(SALES_POOL.slice(0, 2));
  const [toast, setToast] = useState<typeof SALES_POOL[0]|null>(null);
  const saleIdxRef = useRef(2);

  useEffect(() => { const t = setTimeout(() => setBars(true), 400); return () => clearTimeout(t); }, []);

  useEffect(() => {
    const id = setInterval(() => {
      setPeriod(p => { const next = PERIODS[(PERIODS.indexOf(p)+1)%PERIODS.length]; setBars(false); setTimeout(() => setBars(true), 60); return next; });
    }, 6000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const cycle = () => {
      const next = SALES_POOL[saleIdxRef.current % SALES_POOL.length];
      saleIdxRef.current++;
      setToast(next);
      setSales(prev => [next, ...prev.slice(0,1)]);
      const t = setTimeout(() => setToast(null), 2800);
      return () => clearTimeout(t);
    };
    const start = setTimeout(cycle, 2500);
    const id = setInterval(cycle, 5500);
    return () => { clearTimeout(start); clearInterval(id); };
  }, []);

  const d = DATA[period];

  return (
    <div className="w-[420px] bg-white dark:bg-[#0a0f1e] border border-slate-200 dark:border-white/10 rounded-2xl overflow-hidden shadow-2xl">
      <div className="flex items-center gap-2 p-4 border-b border-slate-100 dark:border-white/5">
        <div className="flex gap-1.5"><span className="w-3 h-3 rounded-full bg-red-400"/><span className="w-3 h-3 rounded-full bg-amber-400"/><span className="w-3 h-3 rounded-full bg-emerald-400"/></div>
        <span className="flex-1 text-center text-xs font-bold text-slate-700 dark:text-slate-200">Panel de Órbita</span>
        <div className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"/><span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold">En vivo</span></div>
      </div>

      <div className="p-4 space-y-4">
        <div className="flex gap-1 bg-slate-100 dark:bg-slate-800/60 rounded-xl p-1">
          {PERIODS.map(p => (
            <button key={p} onClick={() => { setPeriod(p); setBars(false); setTimeout(() => setBars(true), 60); }}
              className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all ${period === p ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm' : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300'}`}
            >{p}</button>
          ))}
        </div>

        <div className="grid grid-cols-3 gap-3">
          <StatCard key={`v-${period}`} label="Ventas"  value={d.ventas}  prefix="$" color="text-emerald-600 dark:text-emerald-400" />
          <StatCard key={`t-${period}`} label="Turnos"  value={d.turnos}             color="text-blue-600 dark:text-blue-400" />
          <StatCard key={`p-${period}`} label="Pedidos" value={d.pedidos}            color="text-amber-600 dark:text-amber-400" />
        </div>

        <div key={period} className="flex items-end justify-between gap-2 h-24 px-1">
          {d.bars.map((bar, i) => (
            <div key={bar.label} className="flex flex-col items-center gap-1.5 flex-1 h-full">
              <div className="flex-1 w-full flex items-end">
                <div className={`w-full rounded-t-md transition-all duration-700 ease-out ${bar.today ? 'bg-blue-500 shadow-lg shadow-blue-500/30' : 'bg-blue-500/25 dark:bg-blue-500/20'}`}
                  style={{ height: barsGrown ? `${bar.h}%` : '0%', transitionDelay: `${i*60}ms` }} />
              </div>
              <span className="text-[9px] font-bold text-slate-400 uppercase">{bar.label}</span>
            </div>
          ))}
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Últimas ventas</span>
            <span className="text-[10px] text-blue-500 font-semibold">Ver todo →</span>
          </div>
          {sales.map((s, i) => (
            <div key={`${s.initials}-${i}`} className="flex items-center gap-3 p-2.5 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-100 dark:border-white/5">
              <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-500/15 text-blue-600 dark:text-blue-400 text-[10px] font-bold flex items-center justify-center flex-shrink-0">{s.initials}</div>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-bold text-slate-700 dark:text-slate-200 truncate">{s.product}</div>
                <div className="text-[10px] text-slate-400">{s.time}</div>
              </div>
              <span className="text-sm font-black text-emerald-600 dark:text-emerald-400 font-mono flex-shrink-0">{s.amount}</span>
            </div>
          ))}
        </div>
      </div>

      {toast && (
        <div className="absolute -top-3 -right-3 bg-white dark:bg-slate-800 border border-emerald-200 dark:border-emerald-500/30 rounded-xl px-3 py-2 shadow-xl">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-emerald-500 flex items-center justify-center flex-shrink-0 text-white text-[10px] font-bold">$</div>
            <div>
              <div className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400">Nueva venta</div>
              <div className="text-[10px] font-black text-slate-800 dark:text-white">{toast.amount}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
