// Página de PROPUESTA del home rediseñado (orbita.site).
//
// Vive aparte de index.tsx a propósito: es un experimento para mirar y comparar
// contra el home actual sin tocarlo. Si la propuesta se aprueba, esto se muda a
// index.tsx y este archivo se borra.

import { ThemeProvider } from '@/modules/landing/context/ThemeContext';
import { Navbar } from '@/modules/landing/components/layout/Navbar';
import { Footer } from '@/modules/landing/components/layout/Footer';
import { HeroCinematic } from '@/modules/landing/components/sections/HeroCinematic';

export default function HomeV2Page() {
    return (
        <ThemeProvider>
            <div className="min-h-screen bg-black">
                <Navbar />
                <main>
                    <HeroCinematic />
                </main>
                <Footer />
            </div>
        </ThemeProvider>
    );
}
