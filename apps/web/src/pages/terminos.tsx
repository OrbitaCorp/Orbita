// orbita.site/terminos — los Términos y Condiciones de Uso como página propia
// (antes solo existían en el modal del footer). El texto vive en LEGAL_CONTENT.
import { LEGAL_CONTENT } from '@/modules/landing/components/ui/LegalModal';
import { PaginaLegal } from '@/modules/landing/components/v2/PaginaLegal';

export default function TerminosPage() {
    return (
        <PaginaLegal
            documento={LEGAL_CONTENT.terminos}
            path="/terminos"
            descripcion="Términos y Condiciones de Uso de la plataforma Órbita: qué es el servicio, obligaciones del comercio, suscripción, baja de la cuenta y jurisdicción."
        />
    );
}
