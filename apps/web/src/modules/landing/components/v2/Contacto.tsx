// Contacto con Órbita para quien visita la landing (sin cuenta).
//
// Tres puertas al mismo lugar: la tarjeta del final del FAQ, la del final de
// /nosotros y la columna "Ayuda" del footer. Las tres abren el MISMO formulario
// (un modal que vive una sola vez en PaginaV2, vía <ContactoProvider>) y las
// tres muestran el mail, por si alguien prefiere escribir desde su casilla.
//
// El formulario pega en POST /support/public (apps/api/src/support): destino
// fijo soporte@orbita.site, con Reply-To al email que se escribe acá. El de
// Configuración → Soporte (panel) es otro: ese exige sesión.
//
// Anti-bots: campo trampa escondido + tope por IP en el backend. El input de
// la trampa NO se llama "website" en el DOM (aunque viaje con ese nombre en el
// body): un autocompletado que lo rellenara por error haría que el backend
// descartara en silencio el mensaje de una persona real.

import {
    createContext, useCallback, useContext, useEffect, useId, useMemo, useRef, useState,
    type FormEvent, type ReactNode,
} from 'react';
import { ApiError, sendPublicSupportRequest, type SupportCategory } from '@/lib/api';
import { Card } from './Reveal';

export const EMAIL_SOPORTE = 'soporte@orbita.site';

// Mismas categorías (y mismos textos) que el formulario del panel y que el
// mail que recibe el equipo — ver CATEGORY_LABEL en support.service.ts.
const CATEGORIAS: { value: SupportCategory; label: string }[] = [
    { value: 'TECNICO',     label: 'Problema técnico' },
    { value: 'CUENTA',      label: 'Mi cuenta / plan' },
    { value: 'FACTURACION', label: 'Facturación / pagos' },
    { value: 'DOMINIO',     label: 'Dominios' },
    { value: 'OTRO',        label: 'Otra consulta' },
];

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// ── Contexto: cualquiera puede abrir el formulario ───────────────────────────

const Ctx = createContext<{ abrir: () => void } | null>(null);

export function useContacto() {
    const c = useContext(Ctx);
    if (!c) throw new Error('useContacto tiene que usarse dentro de <ContactoProvider> (lo pone PaginaV2)');
    return c;
}

export function ContactoProvider({ children }: { children: ReactNode }) {
    const [abierto, setAbierto] = useState(false);
    // Quién lo abrió: al cerrar, el foco vuelve ahí (si no, quien navega con
    // teclado o lector de pantalla pierde el lugar y arranca de nuevo arriba).
    const disparador = useRef<HTMLElement | null>(null);

    const abrir = useCallback(() => {
        disparador.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        setAbierto(true);
    }, []);
    const cerrar = useCallback(() => {
        setAbierto(false);
        disparador.current?.focus();
    }, []);
    const valor = useMemo(() => ({ abrir }), [abrir]);

    return (
        <Ctx.Provider value={valor}>
            {children}
            {abierto && <ModalContacto onClose={cerrar} />}
        </Ctx.Provider>
    );
}

// ── Modal con el formulario ──────────────────────────────────────────────────

type Estado = 'editando' | 'enviando' | 'enviado';

function mensajeDeFallo(err: unknown): string {
    if (err instanceof ApiError && err.status === 429) {
        return `Enviaste varias consultas seguidas. Esperá unos minutos o escribinos a ${EMAIL_SOPORTE}.`;
    }
    if (err instanceof ApiError && err.status === 400) return 'Revisá los datos e intentá de nuevo.';
    // 422, 5xx o sin conexión: siempre dejamos el mail a la vista, para que
    // nadie se quede sin forma de llegar a nosotros.
    return `No pudimos enviar tu consulta ahora. Si sigue fallando, escribinos a ${EMAIL_SOPORTE}.`;
}

function ModalContacto({ onClose }: { onClose: () => void }) {
    const idTitulo = useId();
    const panel = useRef<HTMLDivElement>(null);
    const primero = useRef<HTMLInputElement>(null);

    const [estado, setEstado] = useState<Estado>('editando');
    const [error, setError] = useState<string | null>(null);
    // Los errores de campo recién se muestran después del primer intento de
    // enviar: mostrarlos mientras alguien todavía está escribiendo se siente
    // como un regaño.
    const [intento, setIntento] = useState(false);

    const [nombre, setNombre] = useState('');
    const [email, setEmail] = useState('');
    const [categoria, setCategoria] = useState<SupportCategory>('OTRO');
    const [asunto, setAsunto] = useState('');
    const [mensaje, setMensaje] = useState('');
    const [trampa, setTrampa] = useState('');

    // Mismos mínimos que el DTO del backend (send-public-support-request.dto.ts).
    const errores = {
        nombre: nombre.trim().length < 2 ? 'Escribí tu nombre.' : null,
        email: EMAIL_RE.test(email.trim()) ? null : 'Revisá el email: parece incompleto.',
        asunto: asunto.trim().length < 3 ? 'Ponele un asunto corto.' : null,
        mensaje: mensaje.trim().length < 10 ? 'Contanos un poco más (mínimo 10 caracteres).' : null,
    };
    const hayErrores = Object.values(errores).some(Boolean);

    // Bloqueo de scroll, Esc para cerrar y foco atrapado adentro mientras el
    // modal está abierto.
    useEffect(() => {
        const anterior = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        primero.current?.focus();

        const alTeclear = (e: KeyboardEvent) => {
            if (e.key === 'Escape') { onClose(); return; }
            if (e.key !== 'Tab' || !panel.current) return;
            const enfocables = panel.current.querySelectorAll<HTMLElement>(
                'a[href], button:not([disabled]), input:not([disabled]):not([tabindex="-1"]), textarea:not([disabled])',
            );
            if (!enfocables.length) return;
            const ini = enfocables[0];
            const fin = enfocables[enfocables.length - 1];
            if (e.shiftKey && document.activeElement === ini) { e.preventDefault(); fin.focus(); }
            else if (!e.shiftKey && document.activeElement === fin) { e.preventDefault(); ini.focus(); }
        };
        document.addEventListener('keydown', alTeclear);
        return () => {
            document.body.style.overflow = anterior;
            document.removeEventListener('keydown', alTeclear);
        };
    }, [onClose]);

    async function enviar(e: FormEvent) {
        e.preventDefault();
        setIntento(true);
        if (hayErrores || estado === 'enviando') return;
        setEstado('enviando');
        setError(null);
        try {
            await sendPublicSupportRequest({
                name: nombre.trim(),
                email: email.trim(),
                category: categoria,
                subject: asunto.trim(),
                message: mensaje.trim(),
                website: trampa,
            });
            setEstado('enviado');
        } catch (err) {
            setEstado('editando');
            setError(mensajeDeFallo(err));
        }
    }

    const campo = 'oc-campo w-full rounded-xl px-3.5 text-[16px] text-white placeholder:text-slate-500 sm:text-[14.5px]';
    const estiloCampo = (conError: boolean) => ({
        background: 'var(--oc-card-bg)',
        border: `1px solid ${conError ? 'rgba(248,113,113,.65)' : 'var(--oc-card-bd)'}`,
    });
    const etiqueta = 'mb-1.5 block text-[12.5px] font-semibold text-slate-300';
    const textoError = 'mt-1.5 text-[12px] text-red-300';
    const ver = (k: keyof typeof errores) => (intento ? errores[k] : null);

    return (
        <div className="fixed inset-0 z-[70] flex items-end justify-center sm:items-center sm:p-6">
            <style>{`
                @keyframes ocModalEntra { from { opacity: 0; transform: translate3d(0, 14px, 0); } to { opacity: 1; transform: none; } }
                @keyframes ocFondoEntra { from { opacity: 0; } to { opacity: 1; } }
                .oc-modal-fondo { animation: ocFondoEntra 180ms ease-out both; }
                .oc-modal-panel { animation: ocModalEntra 240ms cubic-bezier(.16,1,.3,1) both; }
                .oc-campo:focus-visible, .oc-chip:focus-visible, .oc-modal-panel button:focus-visible, .oc-modal-panel a:focus-visible {
                    outline: 2px solid var(--oc-accent); outline-offset: 2px;
                }
                @media (prefers-reduced-motion: reduce) { .oc-modal-fondo, .oc-modal-panel { animation: none; } }
            `}</style>

            <div className="oc-modal-fondo absolute inset-0 bg-black/70" onMouseDown={onClose} aria-hidden="true" />

            <div
                ref={panel}
                role="dialog"
                aria-modal="true"
                aria-labelledby={idTitulo}
                className="oc-modal-panel relative max-h-[100dvh] w-full overflow-y-auto rounded-t-2xl px-5 pb-6 pt-5 sm:max-w-[560px] sm:rounded-2xl sm:px-7 sm:pb-7 sm:pt-6"
                style={{ background: 'var(--oc-bg)', border: '1px solid var(--oc-panel-bd)', boxShadow: '0 30px 80px rgba(0,0,0,.6)' }}
            >
                <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <span
                            className="inline-grid h-10 w-10 shrink-0 place-items-center rounded-xl"
                            style={{ background: 'var(--oc-accent-soft)', border: '1px solid var(--oc-accent-bd)' }}
                        >
                            <IconoAyuda size={19} />
                        </span>
                        <h2 id={idTitulo} className="text-[19px] font-black tracking-[-0.02em] text-white sm:text-[21px]">
                            {estado === 'enviado' ? 'Recibimos tu consulta' : 'Escribinos'}
                        </h2>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        aria-label="Cerrar"
                        className="-mr-2 -mt-1 grid h-11 w-11 shrink-0 cursor-pointer place-items-center rounded-xl text-slate-400 transition-colors duration-200 hover:bg-white/10 hover:text-white"
                    >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <path d="M18 6 6 18" /><path d="m6 6 12 12" />
                        </svg>
                    </button>
                </div>

                {estado === 'enviado' ? (
                    <div className="mt-6 flex flex-col items-center px-2 pb-2 pt-2 text-center">
                        <span
                            className="grid h-14 w-14 place-items-center rounded-full"
                            style={{ background: 'rgba(74,222,128,.12)', border: '1px solid rgba(74,222,128,.35)' }}
                        >
                            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="var(--oc-ok)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                <path d="M20 6 9 17l-5-5" />
                            </svg>
                        </span>
                        <p className="mt-5 max-w-[360px] text-[14.5px] leading-relaxed text-slate-300">
                            Te vamos a responder por mail a <strong className="font-semibold text-white">{email.trim()}</strong>.
                        </p>
                        <button
                            type="button"
                            onClick={onClose}
                            className="oc-cta mt-6 inline-flex min-h-[46px] cursor-pointer items-center justify-center rounded-xl px-8 text-[14.5px] font-bold transition-colors duration-200"
                        >
                            Cerrar
                        </button>
                    </div>
                ) : (
                    <form onSubmit={enviar} noValidate className="mt-5">
                        <p className="mb-5 text-[14px] leading-relaxed text-slate-400">
                            Contanos qué necesitás y te respondemos por mail.
                        </p>

                        <fieldset className="mb-5">
                            <legend className={etiqueta}>¿Sobre qué es tu consulta?</legend>
                            <div role="radiogroup" className="flex flex-wrap gap-2">
                                {CATEGORIAS.map(c => {
                                    const activa = categoria === c.value;
                                    return (
                                        <button
                                            key={c.value}
                                            type="button"
                                            role="radio"
                                            aria-checked={activa}
                                            onClick={() => setCategoria(c.value)}
                                            className="oc-chip min-h-[44px] cursor-pointer rounded-full px-4 text-[13px] font-semibold transition-colors duration-200 sm:min-h-[38px]"
                                            style={{
                                                border: `1px solid ${activa ? 'var(--oc-accent-bd)' : 'var(--oc-card-bd)'}`,
                                                background: activa ? 'var(--oc-accent-soft)' : 'transparent',
                                                color: activa ? 'var(--oc-accent-fuerte)' : 'var(--oc-text-3)',
                                            }}
                                        >
                                            {c.label}
                                        </button>
                                    );
                                })}
                            </div>
                        </fieldset>

                        <div className="grid gap-4 sm:grid-cols-2">
                            <div>
                                <label htmlFor={`${idTitulo}-nombre`} className={etiqueta}>Nombre</label>
                                <input
                                    ref={primero}
                                    id={`${idTitulo}-nombre`}
                                    value={nombre}
                                    onChange={e => setNombre(e.target.value)}
                                    autoComplete="name"
                                    maxLength={80}
                                    aria-invalid={!!ver('nombre')}
                                    aria-describedby={ver('nombre') ? `${idTitulo}-nombre-e` : undefined}
                                    className={`${campo} h-12`}
                                    style={estiloCampo(!!ver('nombre'))}
                                />
                                {ver('nombre') && <p id={`${idTitulo}-nombre-e`} className={textoError}>{errores.nombre}</p>}
                            </div>
                            <div>
                                <label htmlFor={`${idTitulo}-email`} className={etiqueta}>Tu email</label>
                                <input
                                    id={`${idTitulo}-email`}
                                    type="email"
                                    inputMode="email"
                                    value={email}
                                    onChange={e => setEmail(e.target.value)}
                                    autoComplete="email"
                                    maxLength={254}
                                    aria-invalid={!!ver('email')}
                                    aria-describedby={ver('email') ? `${idTitulo}-email-e` : undefined}
                                    className={`${campo} h-12`}
                                    style={estiloCampo(!!ver('email'))}
                                />
                                {ver('email') && <p id={`${idTitulo}-email-e`} className={textoError}>{errores.email}</p>}
                            </div>
                        </div>

                        <div className="mt-4">
                            <label htmlFor={`${idTitulo}-asunto`} className={etiqueta}>Asunto</label>
                            <input
                                id={`${idTitulo}-asunto`}
                                value={asunto}
                                onChange={e => setAsunto(e.target.value)}
                                maxLength={120}
                                aria-invalid={!!ver('asunto')}
                                aria-describedby={ver('asunto') ? `${idTitulo}-asunto-e` : undefined}
                                className={`${campo} h-12`}
                                style={estiloCampo(!!ver('asunto'))}
                            />
                            {ver('asunto') && <p id={`${idTitulo}-asunto-e`} className={textoError}>{errores.asunto}</p>}
                        </div>

                        <div className="mt-4">
                            <label htmlFor={`${idTitulo}-mensaje`} className={etiqueta}>Contanos el detalle</label>
                            <textarea
                                id={`${idTitulo}-mensaje`}
                                value={mensaje}
                                onChange={e => setMensaje(e.target.value)}
                                rows={5}
                                maxLength={4000}
                                aria-invalid={!!ver('mensaje')}
                                aria-describedby={ver('mensaje') ? `${idTitulo}-mensaje-e` : undefined}
                                className={`${campo} resize-y py-3`}
                                style={{ ...estiloCampo(!!ver('mensaje')), minHeight: 120 }}
                            />
                            {ver('mensaje') && <p id={`${idTitulo}-mensaje-e`} className={textoError}>{errores.mensaje}</p>}
                        </div>

                        {/* Campo trampa: fuera de pantalla, fuera del orden de tab y
                            escondido para lectores. Una persona nunca lo llena. */}
                        <div aria-hidden="true" style={{ position: 'absolute', left: -10000, top: 'auto', width: 1, height: 1, overflow: 'hidden' }}>
                            <label>
                                No completar este campo
                                <input type="text" name="cf-extra" tabIndex={-1} autoComplete="off" value={trampa} onChange={e => setTrampa(e.target.value)} />
                            </label>
                        </div>

                        {error && (
                            <p role="alert" className="mt-4 rounded-xl px-3.5 py-3 text-[13px] leading-relaxed text-red-200" style={{ background: 'rgba(248,113,113,.10)', border: '1px solid rgba(248,113,113,.35)' }}>
                                {error}
                            </p>
                        )}

                        <button
                            type="submit"
                            disabled={estado === 'enviando'}
                            className="oc-cta mt-6 inline-flex min-h-[48px] w-full cursor-pointer items-center justify-center gap-2 rounded-xl px-7 text-[15px] font-bold transition-colors duration-200 disabled:cursor-wait disabled:opacity-70"
                        >
                            {estado === 'enviando' ? 'Enviando…' : 'Enviar consulta'}
                        </button>

                        <p className="mt-4 text-center text-[12.5px] text-slate-500">
                            O escribinos directo a{' '}
                            <a href={`mailto:${EMAIL_SOPORTE}`} className="cursor-pointer text-slate-300 underline-offset-4 transition-colors duration-200 hover:text-white hover:underline">
                                {EMAIL_SOPORTE}
                            </a>
                        </p>
                    </form>
                )}
            </div>
        </div>
    );
}

// ── Tarjeta reutilizable (FAQ, Nosotros) ─────────────────────────────────────

export function TarjetaContacto({
    titulo = '¿Necesitás ayuda?',
    texto = 'Escribinos por cualquier problema o duda y te respondemos por mail.',
    className = '',
}: {
    titulo?: string;
    texto?: string;
    className?: string;
}) {
    const { abrir } = useContacto();
    const [copia, setCopia] = useState<'ok' | 'error' | null>(null);
    const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
    useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

    async function copiar() {
        try {
            await navigator.clipboard.writeText(EMAIL_SOPORTE);
            setCopia('ok');
        } catch {
            // Sin permiso o sin API de portapapeles (http, navegador viejo): el
            // mail igual está ahí arriba para copiarlo a mano.
            setCopia('error');
        }
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(() => setCopia(null), 2200);
    }

    return (
        <Card destacada className={`p-6 sm:p-8 ${className}`}>
            <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start gap-4">
                    <span
                        className="inline-grid h-11 w-11 shrink-0 place-items-center rounded-2xl"
                        style={{ background: 'var(--oc-accent-soft)', border: '1px solid var(--oc-accent-bd)' }}
                    >
                        <IconoAyuda size={21} />
                    </span>
                    <div>
                        <h3 className="text-[18px] font-black tracking-[-0.02em] text-white sm:text-[20px]">{titulo}</h3>
                        <p className="mt-1.5 max-w-[420px] text-[14px] leading-relaxed text-slate-400">{texto}</p>
                    </div>
                </div>

                <div className="flex flex-col items-stretch gap-3 sm:items-end">
                    <button
                        type="button"
                        onClick={abrir}
                        className="oc-cta inline-flex min-h-[46px] cursor-pointer items-center justify-center gap-2 rounded-xl px-6 text-[14.5px] font-bold transition-colors duration-200"
                    >
                        Enviar consulta
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <path d="M5 12h14M12 5l7 7-7 7" />
                        </svg>
                    </button>
                    <div className="flex items-center justify-center gap-2.5 text-[12.5px] text-slate-400 sm:justify-end">
                        <a href={`mailto:${EMAIL_SOPORTE}`} className="cursor-pointer underline-offset-4 transition-colors duration-200 hover:text-white hover:underline">
                            {EMAIL_SOPORTE}
                        </a>
                        <span aria-hidden="true">·</span>
                        <button
                            type="button"
                            onClick={copiar}
                            className="cursor-pointer text-slate-400 underline-offset-4 transition-colors duration-200 hover:text-white hover:underline"
                        >
                            Copiar
                        </button>
                        <span role="status" aria-live="polite" className="min-w-0 text-[12px] text-slate-500">
                            {copia === 'ok' ? '¡Copiado!' : copia === 'error' ? 'No se pudo, copialo a mano' : ''}
                        </span>
                    </div>
                </div>
            </div>
        </Card>
    );
}

function IconoAyuda({ size }: { size: number }) {
    return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="var(--oc-accent)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="4" />
            <path d="m4.93 4.93 4.24 4.24" /><path d="m14.83 14.83 4.24 4.24" />
            <path d="m14.83 9.17 4.24-4.24" /><path d="m4.93 19.07 4.24-4.24" />
        </svg>
    );
}
