// orbita.site/cookies — la Política de Cookies como página propia (el aviso de cookies
// y el pie enlazan acá). El texto vive en LEGAL_CONTENT.
import { LEGAL_CONTENT } from '@/modules/landing/components/ui/LegalModal';
import { PaginaLegal } from '@/modules/landing/components/v2/PaginaLegal';

export default function CookiesPage() {
    return (
        <PaginaLegal
            documento={LEGAL_CONTENT.cookies}
            path="/cookies"
            descripcion="Política de Cookies de Órbita: qué guardamos en tu navegador, para qué, y cómo cambiar tu elección."
        />
    );
}
