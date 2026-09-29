// Página pública de un documento legal (orbita.site/terminos, /privacidad,
// /eliminacion-de-datos).
//
// Existe porque Meta exige, para aprobar la app de WhatsApp Business, una URL
// pública y propia para la política de privacidad, los términos y las
// instrucciones de eliminación de datos. Hasta acá los Términos y la Privacidad
// solo se veían en el modal del footer (LegalModal), que no tiene URL.
//
// El texto NO se duplica: los Términos y la Privacidad se leen de LEGAL_CONTENT
// (el mismo objeto que usa el modal y el onboarding), así una corrección se hace
// en un solo lugar.

import type { LEGAL_CONTENT } from '@/modules/landing/components/ui/LegalModal';
import { PaginaV2 } from './PaginaV2';
import { Seo } from '@/modules/landing/components/Seo';

export type DocumentoLegal = (typeof LEGAL_CONTENT)[keyof typeof LEGAL_CONTENT];

interface Props {
    documento: DocumentoLegal;
    path: string;
    descripcion: string;
}

export function PaginaLegal({ documento, path, descripcion }: Props) {
    return (
        <PaginaV2 scrollKey={path} planeta={false}>
            <Seo title={`${documento.title} — Órbita`} description={descripcion} path={path} />
            <main className="relative z-10 px-6 pb-8 pt-28 sm:pt-32">
                <article
                    className="mx-auto max-w-3xl rounded-2xl px-6 py-8 sm:px-10 sm:py-10"
                    style={{ background: 'var(--oc-panel)', border: '1px solid var(--oc-card-bd)' }}
                >
                    <h1 className="text-[26px] font-black leading-tight tracking-[-0.02em] text-white sm:text-[32px]">
                        {documento.title}
                    </h1>
                    <p className="mt-2 text-[13px] text-slate-500">{documento.date}</p>

                    <div className="mt-8 space-y-7">
                        {documento.sections.map(s => (
                            <section key={s.subtitle}>
                                <h2 className="mb-2 text-[15px] font-bold" style={{ color: 'var(--oc-accent)' }}>
                                    {s.subtitle}
                                </h2>
                                {/* whitespace-pre-line: los textos traen \n\n entre párrafos y
                                    viñetas "•" propias; sin esto HTML los colapsa. */}
                                <p className="whitespace-pre-line text-[14.5px] leading-relaxed text-slate-300">
                                    {s.text}
                                </p>
                            </section>
                        ))}
                    </div>
                </article>
            </main>
        </PaginaV2>
    );
}
