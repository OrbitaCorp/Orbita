import { useState, useEffect, useRef } from 'react';

const DAYS = ['Lun','Mar','Mié','Jue','Vie','Sáb','Dom'];
const NUMS = [12,13,14,15,16,17,18];

interface Appt { time: string; name: string | null; svc: string | null; status: 'confirmed'|'pending'|'free'|'new'; }

const INITIAL_APPTS: Appt[] = [
  { time:'09:00', name:'Valentina M.', svc:'Coloración', status:'confirmed' },
  { time:'10:30', name:'Diego R.',     svc:'Corte',      status:'pending'   },
  { time:'12:00', name:'Laura S.',     svc:'Mechas',     status:'confirmed' },
  { time:'14:00', name:null,           svc:null,          status:'free'      },
];
const NEW_BOOKINGS = [
  { name:'Camila T.', svc:'Manicura',   time:'14:00' },
  { name:'Marco P.',  svc:'Coloración', time:'15:30' },
];
const WEEK_GRID = [
  { day:'L', num:12, appts:[{color:'#10b981'},{color:'#3b82f6'}] },
  { day:'M', num:13, appts:[{color:'#f59e0b'}] },
  { day:'X', num:14, today:true, appts:[{color:'#10b981'},{color:'#10b981'},{color:'#f59e0b'}] },
  { day:'J', num:15, appts:[{color:'#3b82f6'}] },
  { day:'V', num:16, appts:[{color:'#10b981'},{color:'#3b82f6'}] },
  { day:'S', num:17, appts:[{color:'#10b981'},{color:'#f59e0b'}] },
  { day:'D', num:18, appts:[] },
];

function StatusBadge({ status }: { status: Appt['status'] }) {
  if (status === 'confirmed') return <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 uppercase tracking-wide">Confirmado</span>;
  if (status === 'pending')   return <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-600 dark:text-amber-400 uppercase tracking-wide">Pendiente</span>;
  return null;
}

export function CalendarCard() {
  const [view, setView]       = useState<'dia'|'semana'>('dia');
  const [appts, setAppts]     = useState<Appt[]>(INITIAL_APPTS);
  const [toast, setToast]     = useState<{name:string;svc:string}|null>(null);
  const [booking, setBooking] = useState(false);
  const [barsIn, setBarsIn]   = useState(false);
  const bookingIdxRef         = useRef(0);

  useEffect(() => {
    const id = setInterval(() => {
      setView(v => { const next = v === 'dia' ? 'semana' : 'dia'; if (next === 'semana') setBarsIn(false); return next; });
    }, 7000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (view === 'semana') { const t = setTimeout(() => setBarsIn(true), 80); return () => clearTimeout(t); }
  }, [view]);

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    const cycle = () => {
      const nb = NEW_BOOKINGS[bookingIdxRef.current % NEW_BOOKINGS.length];
      bookingIdxRef.current++;
      setBooking(true);
      const t1 = setTimeout(() => {
        setAppts(prev => { const fi = prev.findIndex(a => a.status === 'free'); if (fi === -1) return prev; const n = [...prev]; n[fi] = { time:nb.time, name:nb.name, svc:nb.svc, status:'new' }; return n; });
        setToast({ name:nb.name, svc:nb.svc });
        setBooking(false);
        const t2 = setTimeout(() => {
          setAppts(prev => prev.map(a => a.status === 'new' ? { ...a, status:'confirmed' } : a));
          const t3 = setTimeout(() => {
            setToast(null);
            const t4 = setTimeout(() => { setAppts(INITIAL_APPTS); const t5 = setTimeout(cycle, 800); timers.push(t5); }, 3000);
            timers.push(t4);
          }, 2000);
          timers.push(t3);
        }, 1200);
        timers.push(t2);
      }, 1400);
      timers.push(t1);
    };
    const start = setTimeout(cycle, 2000);
    timers.push(start);
    return () => timers.forEach(clearTimeout);
  }, []);

  return (
    <div className="relative w-[400px] h-[420px] flex flex-col bg-white dark:bg-[#0a0f1e] border border-slate-200 dark:border-white/10 rounded-2xl shadow-2xl">
      <div className="flex items-center gap-2 p-4 border-b border-slate-100 dark:border-white/5">
        <div className="flex gap-1.5"><span className="w-3 h-3 rounded-full bg-red-400"/><span className="w-3 h-3 rounded-full bg-amber-400"/><span className="w-3 h-3 rounded-full bg-emerald-400"/></div>
        <div className="flex-1 flex justify-center">
          <div className="flex bg-slate-100 dark:bg-slate-800/60 rounded-lg p-0.5 gap-0.5">
            {(['dia','semana'] as const).map(v => (
              <button key={v} onClick={() => { setView(v); if (v === 'semana') { setBarsIn(false); setTimeout(() => setBarsIn(true), 80); } }}
                className={`px-3 py-1 rounded-md text-[11px] font-bold transition-all ${view === v ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm' : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300'}`}
              >{v === 'dia' ? 'Día' : 'Semana'}</button>
            ))}
          </div>
        </div>
        <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-500/10 px-2 py-1 rounded-lg">Hoy</span>
      </div>

      {view === 'dia' ? (
        <div className="flex-1 flex flex-col pb-4">
          <div className="grid grid-cols-7 px-4 py-3 gap-1">
            {DAYS.map((d, i) => (
              <div key={d} className="flex flex-col items-center gap-1.5">
                <span className="text-[9px] font-bold text-slate-400 uppercase">{d}</span>
                <span className={`w-7 h-7 flex items-center justify-center rounded-full text-xs font-bold ${i === 2 ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/40' : 'text-slate-600 dark:text-slate-300'}`}>{NUMS[i]}</span>
              </div>
            ))}
          </div>
          <div className="px-4 pb-4 flex flex-col gap-2">
            {appts.map((a, i) => (
              <div key={i} className={`flex items-center gap-3 p-3 rounded-xl border transition-all duration-500
                ${a.status === 'free'      ? 'border-dashed border-slate-200 dark:border-white/10 bg-transparent'
                : a.status === 'confirmed' ? 'border-l-4 border-l-emerald-500 border-t border-r border-b border-emerald-500/15 bg-emerald-500/[0.04]'
                : a.status === 'pending'   ? 'border-l-4 border-l-amber-400 border-t border-r border-b border-amber-400/15 bg-amber-500/[0.04]'
                :                           'border-l-4 border-l-blue-500 border-t border-r border-b border-blue-500/25 bg-blue-500/10 animate-pulse'}`}
              >
                <span className="text-xs font-bold text-slate-700 dark:text-slate-200 w-10 flex-shrink-0">{a.time}</span>
                {a.status === 'free' ? (
                  <>
                    <span className="flex-1 text-xs font-semibold text-slate-400">
                      {booking ? <span className="flex items-center gap-1.5 text-blue-500">{[0,1,2].map(j=><span key={j} className="typing-dot w-1.5 h-1.5 rounded-full bg-blue-500"/>)}<span>Reservando…</span></span> : 'Turno libre'}
                    </span>
                    <span className="w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center text-sm font-bold border border-blue-200 dark:border-blue-500/20">+</span>
                  </>
                ) : (
                  <>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate">{a.name}</div>
                      <div className="text-[10px] text-slate-400 mt-0.5">{a.svc}</div>
                    </div>
                    <StatusBadge status={a.status} />
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col justify-center px-4 pb-4 pt-2">
          <div className="grid grid-cols-7 gap-2">
            {WEEK_GRID.map((wd, dayI) => (
              <div key={wd.day} className="flex flex-col items-center gap-2">
                <span className="text-[9px] font-bold text-slate-400 uppercase">{wd.day}</span>
                <span className={`w-7 h-7 flex items-center justify-center rounded-full text-xs font-bold ${wd.today ? 'bg-blue-600 text-white' : 'text-slate-600 dark:text-slate-300'}`}>{wd.num}</span>
                <div className="w-full flex flex-col gap-1" style={{ minHeight: 80 }}>
                  {wd.appts.map((a, j) => (
                    <div key={j} className="w-full rounded-sm transition-all duration-700" style={{ height:16, background:a.color, opacity:barsIn?0.85:0, transform:barsIn?'scaleY(1)':'scaleY(0)', transformOrigin:'top', transitionDelay:`${dayI*55+j*90}ms` }} />
                  ))}
                  {wd.appts.length === 0 && <div className="w-full rounded-sm border border-dashed border-slate-200 dark:border-white/10" style={{height:16}} />}
                </div>
              </div>
            ))}
          </div>
          <div className="mt-5 grid grid-cols-3 gap-2">
            {[{color:'#10b981',label:'Confirmados',count:8},{color:'#f59e0b',label:'Pendientes',count:3},{color:'#3b82f6',label:'Nuevos',count:2}].map(item => (
              <div key={item.label} className="flex flex-col items-center gap-1 p-2 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-white/5">
                <span className="text-base font-black" style={{color:item.color}}>{item.count}</span>
                <span className="text-[9px] font-semibold text-slate-400 text-center leading-tight">{item.label}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {toast && (
        <div className="absolute -top-3 -right-3 bg-white dark:bg-slate-800 border border-emerald-200 dark:border-emerald-500/30 rounded-xl px-3 py-2 shadow-xl max-w-[200px]">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-emerald-500 flex items-center justify-center flex-shrink-0">
              <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5"/></svg>
            </div>
            <div>
              <div className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400">Nuevo turno</div>
              <div className="text-[10px] text-slate-600 dark:text-slate-300">{toast.name} · {toast.svc}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
