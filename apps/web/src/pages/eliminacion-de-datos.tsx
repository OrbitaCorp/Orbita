// orbita.site/eliminacion-de-datos — instrucciones para pedir la eliminación de
// los datos personales. Meta la exige como "URL de instrucciones para la
// eliminación de datos" en la configuración de la app de WhatsApp Business.
//
// Los plazos salen de la Ley 25.326 (art. 16: cinco días hábiles para suprimir
// desde el reclamo) y de la sección 7 de la Política de Privacidad (qué se borra
// y qué se conserva por obligación fiscal). Si cambia una, cambia la otra.
import type { DocumentoLegal } from '@/modules/landing/components/v2/PaginaLegal';
import { PaginaLegal } from '@/modules/landing/components/v2/PaginaLegal';

const DOCUMENTO: DocumentoLegal = {
    title: 'Eliminación de datos personales',
    date: 'Última actualización: 28 de septiembre, 2026',
    sections: [
        {
            subtitle: '1. Cómo pedir que eliminemos tus datos',
            text: 'Escribinos a soporte@orbita.site con el asunto "Eliminación de datos". Para poder identificarte y evitar que otra persona pida el borrado de tus datos, escribinos desde el mismo correo con el que te registraste en Órbita e indicanos:\n\n• Tu nombre y el correo de tu cuenta.\n• El nombre de tu tienda, si tenés una.\n• Si querés eliminar toda tu cuenta o solo algunos datos (por ejemplo, la conexión con WhatsApp).\n\nTe confirmamos la recepción del pedido y lo resolvemos dentro de los cinco días hábiles que fija la Ley N.° 25.326 (art. 16) desde que recibimos tu reclamo.',
        },
        {
            subtitle: '2. Si sos dueño de un negocio en Órbita',
            text: 'Podés dar de baja tu cuenta desde el panel, o pedirnos el borrado por el correo indicado arriba. Tenés 60 días para reactivarla; cumplido ese plazo sin reactivación, la eliminación se vuelve definitiva y los datos personales se suprimen de forma irreversible.\n\nSi conectaste WhatsApp Business, además podés desconectarlo cuando quieras desde tu cuenta de Meta (Configuración → Integraciones comerciales → Órbita → Quitar), o pedirnos que lo desconectemos. Al desconectarlo dejamos de recibir tus mensajes y eliminamos las credenciales de acceso que guardamos.',
        },
        {
            subtitle: '3. Si le escribiste a un negocio por WhatsApp o compraste en su tienda',
            text: 'Los datos de los clientes de cada tienda (nombre, teléfono, mensajes, historial de compra) están bajo la responsabilidad del negocio en el que compraste o al que le escribiste. Órbita los aloja por cuenta y orden de ese negocio.\n\nPara borrarlos, contactá directamente al negocio. Si no sabés cómo hacerlo, escribinos a soporte@orbita.site indicando el nombre de la tienda o el número de WhatsApp con el que conversaste, y trasladamos tu pedido al negocio correspondiente.',
        },
        {
            subtitle: '4. Qué se elimina',
            text: 'Se suprimen los datos de las cuentas de acceso al panel y de las cuentas de clientes de la tienda (nombre, correo electrónico, teléfono, DNI, fecha de nacimiento, imagen de perfil y contraseña), las direcciones guardadas, las sesiones abiertas, las conversaciones —incluidos los mensajes de WhatsApp que se hayan guardado—, las reseñas, el registro de correos enviados, las notificaciones y las credenciales de cobro y de conexión vinculadas.',
        },
        {
            subtitle: '5. Qué se conserva, y por qué',
            text: 'Los comprobantes de las operaciones realizadas (pedidos, pagos, devoluciones y notas de crédito) se conservan por el plazo que exige la normativa fiscal argentina, que es de diez años. Esos comprobantes incluyen los datos del comprador que forman parte del comprobante mismo. No se usan para ninguna otra finalidad.',
        },
        {
            subtitle: '6. Más información',
            text: 'El detalle completo de cómo tratamos tus datos está en nuestra Política de Privacidad (orbita.site/privacidad). Si considerás que no atendimos tu pedido, podés presentar un reclamo ante la Agencia de Acceso a la Información Pública (AAIP), el órgano de control de la Ley N.° 25.326.',
        },
    ],
};

export default function EliminacionDeDatosPage() {
    return (
        <PaginaLegal
            documento={DOCUMENTO}
            path="/eliminacion-de-datos"
            descripcion="Cómo pedir la eliminación de tus datos personales en Órbita, qué se borra, qué se conserva por obligación fiscal y a quién dirigirte si sos cliente de una tienda."
        />
    );
}
