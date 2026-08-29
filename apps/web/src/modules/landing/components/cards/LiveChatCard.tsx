import { useState, useEffect, useRef } from 'react';
import { useTheme } from '@/modules/landing/context/ThemeContext';

interface Msg { id: number; side: 'in' | 'out'; text: string; time: string; }
interface Source {
  id: string; label: string; color: string; headerBg: string;
  chatBg: string; chatBgDark: string;
  outBubble: string; outText: string; inBubble: string; inText: string;
  inputBg: string; inputBgDark: string; initUnread: number;
  icon: React.ReactNode; msgs: Msg[]; pool: Omit<Msg, 'id'>[];
}

const SOURCES: Source[] = [
  {
    id: 'wa', label: 'WhatsApp', color: '#25D366', headerBg: '#075E54',
    chatBg: '#E5DDD5', chatBgDark: '#0b141a',
    outBubble: 'bg-[#DCF8C6] dark:bg-[#005c4b]', outText: 'text-gray-800 dark:text-[#e9edef]',
    inBubble: 'bg-white dark:bg-[#202c33]', inText: 'text-gray-800 dark:text-[#e9edef]',
    inputBg: '#f0f2f5', inputBgDark: '#1e2a30', initUnread: 3,
    icon: <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>,
    msgs: [{ id:1, side:'in', text:'¿Tenés la remera talle M?', time:'14:02' }, { id:2, side:'out', text:'Sí, M y L disponibles.', time:'14:04' }, { id:3, side:'in', text:'¿El precio con envío?', time:'14:05' }],
    pool: [{ side:'out', text:'$12.500 con envío incluido.', time:'14:06' }, { side:'in', text:'Perfecto, lo llevo.', time:'14:08' }, { side:'out', text:'Genial, te mando el link.', time:'14:09' }],
  },
  {
    id: 'ig', label: 'Instagram', color: '#E1306C', headerBg: '#1a0a2e',
    chatBg: '#fdf0f8', chatBgDark: '#121212',
    outBubble: 'bg-gradient-to-r from-blue-500 to-purple-600', outText: 'text-white',
    inBubble: 'bg-[#efefef] dark:bg-[#262626]', inText: 'text-gray-900 dark:text-[#f5f5f5]',
    inputBg: '#fafafa', inputBgDark: '#1a1a1a', initUnread: 1,
    icon: <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="currentColor"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/></svg>,
    msgs: [{ id:1, side:'in', text:'¿Precio de la campera?', time:'13:40' }, { id:2, side:'out', text:'Está en el link de la bio.', time:'13:42' }, { id:3, side:'in', text:'¿La tienen en negro?', time:'13:45' }],
    pool: [{ side:'out', text:'Sí, negro y azul marino', time:'13:47' }, { side:'in', text:'¿Cómo hago el pedido?', time:'13:49' }, { side:'out', text:'Por acá o por el link de la bio.', time:'13:51' }],
  },
  {
    id: 'mail', label: 'Gmail', color: '#EA4335', headerBg: '#1f1218',
    chatBg: '#fff8f7', chatBgDark: '#1a1a1a',
    outBubble: 'bg-blue-50 dark:bg-[#1a2744]', outText: 'text-gray-800 dark:text-[#d3e3fd]',
    inBubble: 'bg-white dark:bg-[#2a2a2a]', inText: 'text-gray-800 dark:text-[#e8e8e8]',
    inputBg: '#f8f9fa', inputBgDark: '#1e1e1e', initUnread: 2,
    icon: <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="currentColor"><path d="M24 5.457v13.909c0 .904-.732 1.636-1.636 1.636h-3.819V11.73L12 16.64l-6.545-4.91v9.273H1.636A1.636 1.636 0 010 19.366V5.457c0-2.023 2.309-3.178 3.927-1.964L5.455 4.64 12 9.548l6.545-4.91 1.528-1.145C21.69 2.28 24 3.434 24 5.457z"/></svg>,
    msgs: [{ id:1, side:'in', text:'¿Tienen envíos express?', time:'11:20' }, { id:2, side:'out', text:'Sí, express en 24 horas.', time:'11:35' }, { id:3, side:'in', text:'¿Cuánto cuesta?', time:'11:50' }],
    pool: [{ side:'out', text:'$800 adicionales por express', time:'12:01' }, { side:'in', text:'Hago el pedido ahora.', time:'12:05' }, { side:'out', text:'Perfecto, te confirmamos ya', time:'12:06' }],
  },
];

export function LiveChatCard() {
  const { isDark }  = useTheme();
  const [activeTab, setActiveTab] = useState(0);
  const [msgsByTab, setMsgsByTab] = useState(SOURCES.map(s => s.msgs));
  const [typing,    setTyping]    = useState<{ tabIdx: number; side: string } | null>(null);
  const [unread,    setUnread]    = useState(SOURCES.map(s => s.initUnread));
  const poolIdxRef   = useRef(SOURCES.map(() => 0));
  const bodyRef      = useRef<HTMLDivElement>(null);
  const activeTabRef = useRef(0);
  activeTabRef.current = activeTab;

  useEffect(() => {
    const id = setInterval(() => setActiveTab(t => (t + 1) % SOURCES.length), 5000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    setUnread(prev => { const u = [...prev]; u[activeTab] = 0; return u; });
  }, [activeTab]);

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];

    const addMsg = (tabIdx: number) => {
      const pool = SOURCES[tabIdx].pool;
      const next = pool[poolIdxRef.current[tabIdx] % pool.length];
      poolIdxRef.current[tabIdx]++;

      const t1 = setTimeout(() => {
        setTyping({ tabIdx, side: next.side });
        const t2 = setTimeout(() => {
          setTyping(null);
          setMsgsByTab(prev => { const u = [...prev]; u[tabIdx] = [...u[tabIdx].slice(-4), { ...next, id: Date.now() + tabIdx }]; return u; });
          if (next.side === 'in' && activeTabRef.current !== tabIdx) setUnread(prev => { const u = [...prev]; u[tabIdx]++; return u; });
          const t3 = setTimeout(() => addMsg(tabIdx), 3000 + tabIdx * 600);
          timers.push(t3);
        }, 1400);
        timers.push(t2);
      }, 900);
      timers.push(t1);
    };

    SOURCES.forEach((_, i) => { const t = setTimeout(() => addMsg(i), 1500 + i * 2200); timers.push(t); });
    return () => timers.forEach(clearTimeout);
  }, []);

  useEffect(() => {
    if (bodyRef.current) bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
  }, [msgsByTab, typing, activeTab]);

  const src = SOURCES[activeTab];
  const msgs = msgsByTab[activeTab];
  const isTypingHere = typing?.tabIdx === activeTab;

  return (
    <div className={`w-[270px] rounded-2xl overflow-hidden shadow-2xl ${isDark ? 'border border-white/10' : 'border border-slate-200'}`}>
      <div className={`flex ${isDark ? 'bg-[#0d1117]' : 'bg-slate-100'}`}>
        {SOURCES.map((s, i) => (
          <button key={s.id} onClick={() => setActiveTab(i)} className="flex-1 relative flex items-center justify-center gap-1.5 py-2.5 text-[10px] font-bold transition-colors hover:bg-black/5 dark:hover:bg-white/5"
            style={{ color: activeTab === i ? s.color : (isDark ? '#64748b' : '#475569') }}
          >
            {s.icon} {s.label}
            {unread[i] > 0 && <span className="w-4 h-4 rounded-full text-white text-[8px] font-black flex items-center justify-center" style={{ background: s.color }}>{unread[i]}</span>}
            {activeTab === i && <span className="absolute bottom-0 left-3 right-3 h-0.5 rounded-full" style={{ background: s.color }} />}
          </button>
        ))}
      </div>

      <div className="px-3 py-2.5 flex items-center gap-2.5 transition-colors duration-500" style={{ background: src.headerBg }}>
        <div className="relative flex-shrink-0">
          <div className="w-8 h-8 rounded-full bg-gray-400 flex items-center justify-center text-xs font-bold text-gray-700">C</div>
          <span className="absolute bottom-0 right-0 w-2 h-2 rounded-full bg-green-400 border border-white" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-white text-xs font-bold">Clientes</div>
          <div className="text-white/60 text-[10px]">En línea ahora</div>
        </div>
      </div>

      <div ref={bodyRef} className="p-3 h-44 overflow-hidden flex flex-col gap-1.5 transition-colors duration-500" style={{ background: isDark ? src.chatBgDark : src.chatBg }}>
        {msgs.map(m => (
          <div key={m.id} className={`msg-enter max-w-[88%] px-2.5 py-1.5 rounded-2xl text-[11px] leading-relaxed shadow-sm
            ${m.side === 'out' ? `self-end ${src.outBubble} ${src.outText} rounded-br-sm` : `self-start ${src.inBubble} ${src.inText} rounded-bl-sm`}`}
          >
            {m.text}
            <div className={`text-[8px] text-right mt-0.5 ${m.side === 'out' && src.id === 'ig' ? 'text-white/60' : 'text-gray-500 dark:text-gray-400'}`}>{m.time}</div>
          </div>
        ))}
        {isTypingHere && (
          <div className={`self-start flex gap-1 items-center px-3 py-2 rounded-2xl ${src.inBubble} rounded-bl-sm w-14 shadow-sm`}>
            {[0,1,2].map(i => <span key={i} className="typing-dot w-1.5 h-1.5 rounded-full bg-gray-400" style={{ animationDelay: `${i * 0.2}s` }} />)}
          </div>
        )}
      </div>

      <div className="px-2 py-2 flex items-center gap-2 transition-colors duration-500" style={{ background: isDark ? src.inputBgDark : src.inputBg }}>
        <div className={`flex-1 h-8 rounded-full border flex items-center px-3 ${isDark ? 'bg-white/5 border-white/10' : 'bg-white border-gray-200'}`}>
          <span className="text-[10px] text-slate-400">Responder con IA…</span>
        </div>
        <button className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: src.color }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="white"><path d="M2 21l21-9L2 3v7l15 2-15 2v7z"/></svg>
        </button>
      </div>
    </div>
  );
}
