// orbita.site/privacidad — la Política de Privacidad como página propia (antes
// solo existía en el modal del footer). El texto vive en LEGAL_CONTENT.
import { LEGAL_CONTENT } from '@/modules/landing/components/ui/LegalModal';
import { PaginaLegal } from '@/modules/landing/components/v2/PaginaLegal';

export default function PrivacidadPage() {
    return (
        <PaginaLegal
            documento={LEGAL_CONTENT.privacidad}
            path="/privacidad"
            descripcion="Política de Privacidad de Órbita: qué datos recolectamos, para qué los usamos, cómo tratamos los mensajes de WhatsApp Business y cómo ejercer tus derechos."
        />
    );
}
