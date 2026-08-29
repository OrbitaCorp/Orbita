import { useState, useEffect, useRef } from 'react';
import { useTheme } from '@/modules/landing/context/ThemeContext';

const CATS = [{ id:'all', label:'Todo' }, { id:'ropa', label:'Ropa' }, { id:'acc', label:'Acces.' }];

const Shirt  = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20.38 3.46 16 2a8.59 8.59 0 0 0-8 0L3.62 3.46a2 2 0 0 0-1.34 2.23l.58 3.47a1 1 0 0 0 .99.84H6v10c0 1.1.9 2 2 2h8a2 2 0 0 0 2-2V10h2.15a1 1 0 0 0 .99-.84l.58-3.47a2 2 0 0 0-1.34-2.23z"/></svg>;
const Pants  = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 2h14l-1.5 20h-4L12 11l-1.5 11h-4L5 2z"/></svg>;
const Bag    = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>;
const Jacket = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M4 6h16v16H4z"/><path d="M12 6v16"/><path d="M8 2h8l2 4H6l2-4z"/></svg>;
const Belt   = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="10" width="20" height="4" rx="1"/><rect x="6" y="8" width="4" height="8" rx="1"/></svg>;
const Dress  = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M8 2h8l3 8-1.5 12h-11L5 10l3-8z"/></svg>;
const Hat    = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2C7.58 2 4 5.58 4 10v2h16v-2c0-4.42-3.58-8-8-8z"/><path d="M2 14h20v2H2z"/></svg>;
const Scarf  = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M4 8c2-2 6-2 8 0s6 2 8 0v4c-2 2-6 2-8 0s-6-2-8 0V8z"/><path d="M8 12v6"/><path d="M16 12v6"/></svg>;

const ALL_PRODUCTS = [
  { id:1, name:'Remera básica', price:'$8.500',  grad:'from-blue-500/25 to-blue-500/5',    cats:['all','ropa'], Icon: Shirt  },
  { id:2, name:'Jean mom',      price:'$15.900', grad:'from-emerald-500/25 to-emerald-500/5', cats:['all','ropa'], Icon: Pants  },
  { id:3, name:'Cartera',       price:'$12.000', grad:'from-amber-500/25 to-amber-500/5',  cats:['all','acc'],  Icon: Bag    },
  { id:4, name:'Campera',       price:'$22.000', grad:'from-rose-500/25 to-rose-500/5',    cats:['all','ropa'], Icon: Jacket },
  { id:5, name:'Cinturón',      price:'$5.500',  grad:'from-orange-500/25 to-orange-500/5',cats:['acc'],        Icon: Belt   },
  { id:6, name:'Vestido',       price:'$12.500', grad:'from-purple-500/25 to-purple-500/5',cats:['all','ropa'], Icon: Dress  },
  { id:7, name:'Sombrero',      price:'$8.800',  grad:'from-teal-500/25 to-teal-500/5',    cats:['acc'],        Icon: Hat    },
  { id:8, name:'Bufanda',       price:'$4.200',  grad:'from-pink-500/25 to-pink-500/5',    cats:['acc'],        Icon: Scarf  },
];

const SEARCH_TARGETS = ['vestido...','campera...','jean...'];

export function StoreCard() {
  const { isDark } = useTheme();
  const [catIdx, setCatIdx] = useState(0);
  const [cat, setCat] = useState('all');
  const [searchText, setSearchText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [searchIdx, setSearchIdx] = useState(0);
  const [addedId, setAddedId] = useState<number|null>(null);
  const [toast, setToast] = useState(false);
  const catRef = useRef('all');
  catRef.current = cat;

  useEffect(() => {
    const id = setInterval(() => {
      setCatIdx(i => { const next = (i+1)%CATS.length; setCat(CATS[next].id); return next; });
    }, 5000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const target = SEARCH_TARGETS[searchIdx % SEARCH_TARGETS.length];
    let timer: ReturnType<typeof setTimeout>;
    if (!isDeleting && searchText.length < target.length) timer = setTimeout(() => setSearchText(target.slice(0, searchText.length+1)), 100);
    else if (!isDeleting && searchText.length === target.length) timer = setTimeout(() => setIsDeleting(true), 2200);
    else if (isDeleting && searchText.length > 0) timer = setTimeout(() => setSearchText(p => p.slice(0,-1)), 45);
    else if (isDeleting && searchText.length === 0) { setIsDeleting(false); setSearchIdx(i => i+1); }
    return () => clearTimeout(timer);
  }, [searchText, isDeleting, searchIdx]);

  useEffect(() => {
    const cycle = () => {
      const visible = ALL_PRODUCTS.filter(p => p.cats.includes(catRef.current));
      if (!visible.length) return;
      const pick = visible[Math.floor(Math.random()*visible.length)];
      setAddedId(pick.id); setToast(true);
      const t1 = setTimeout(() => setAddedId(null), 2000);
      const t2 = setTimeout(() => setToast(false), 2600);
      return () => { clearTimeout(t1); clearTimeout(t2); };
    };
    const start = setTimeout(cycle, 3000);
    const id = setInterval(cycle, 6500);
    return () => { clearTimeout(start); clearInterval(id); };
  }, []);

  const products = ALL_PRODUCTS.filter(p => p.cats.includes(cat)).slice(0, 4);

  return (
    <div className={`w-[260px] rounded-[36px] border-[8px] shadow-2xl overflow-hidden ${isDark ? 'bg-[#0a0f1e] border-slate-800/80' : 'bg-white border-slate-200'}`}>
      <div className={`border-b px-4 py-3 flex items-center gap-3 ${isDark ? 'bg-blue-600/10 border-blue-500/20' : 'bg-blue-50 border-blue-100'}`}>
        <div className="w-9 h-9 rounded-full bg-blue-600 flex items-center justify-center font-bold text-white text-sm flex-shrink-0">C</div>
        <div>
          <div className={`text-xs font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>Tienda de Cami</div>
          <div className={`text-[10px] ${isDark ? 'text-blue-400' : 'text-blue-600'}`}>Ropa & accesorios</div>
        </div>
        <div className="ml-auto flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"/><span className="text-[9px] text-emerald-400 font-semibold">En vivo</span></div>
      </div>

      <div className="flex gap-1.5 px-3 pt-3">
        {CATS.map((c, i) => (
          <button key={c.id} onClick={() => { setCat(c.id); setCatIdx(i); }}
            className={`flex-1 py-1.5 rounded-lg text-[10px] font-bold transition-all duration-300
              ${cat === c.id ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-500/25' : isDark ? 'bg-white/5 hover:bg-white/10 text-slate-400 border border-white/10' : 'bg-slate-100 hover:bg-slate-200 text-slate-500 border border-slate-200'}`}
          >{c.label}</button>
        ))}
      </div>

      <div className={`mx-3 mt-2.5 flex items-center gap-2 rounded-full px-3 py-2 ${isDark ? 'bg-white/5 border border-white/10' : 'bg-slate-50 border border-slate-200'}`}>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
        <span className="text-[11px] text-slate-400 flex-1 min-w-0 truncate">
          {searchText || <span>Buscar producto…</span>}
          <span className="animate-pulse">|</span>
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2 p-3">
        {products.map(p => (
          <div key={p.id} className={`rounded-xl overflow-hidden transition-all duration-300 ${isDark ? 'bg-white/5 border border-white/10' : 'bg-slate-50 border border-slate-200'}`}>
            <div className={`w-full aspect-square bg-gradient-to-br ${p.grad} flex items-center justify-center`}>
              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${isDark ? 'bg-white/10 border border-white/20 text-white/80' : 'bg-white/60 border border-slate-200 text-slate-600'}`}>
                <p.Icon />
              </div>
            </div>
            <div className="p-2">
              <div className={`text-[10px] font-bold truncate mb-1.5 ${isDark ? 'text-white' : 'text-slate-800'}`}>{p.name}</div>
              <div className="flex items-center justify-between gap-1">
                <span className={`text-[11px] font-bold font-mono ${isDark ? 'text-blue-400' : 'text-blue-600'}`}>{p.price}</span>
                <button className={`text-[9px] font-bold px-1.5 py-1 rounded-md transition-all duration-300 flex-shrink-0 ${addedId === p.id ? 'bg-emerald-500 text-white scale-95' : 'bg-blue-600 text-white'}`}>
                  {addedId === p.id ? <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg> : '+'}
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {toast && (
        <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 bg-emerald-600 text-white text-[10px] font-bold px-3 py-1.5 rounded-full shadow-lg flex items-center gap-1.5 whitespace-nowrap">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
          Agregado al carrito
        </div>
      )}
    </div>
  );
}
