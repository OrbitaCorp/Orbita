import { useEffect } from 'react';
import { X } from 'lucide-react';
import { useTheme } from '@/modules/landing/context/ThemeContext';

export type LegalKey = 'terminos' | 'privacidad' | 'cookies';

export const LEGAL_CONTENT: Record<LegalKey, { title: string; date: string; sections: { subtitle: string; text: string }[] }> = {
  // Reescritos por completo (2026-09-08) a partir del borrador acordado con
  // el equipo — reemplaza el texto genérico anterior. Pendiente de revisión
  // por un abogado antes de considerarse definitivo (ver nota del pedido
  // original): esto cubre lo que el equipo definió, no reemplaza esa revisión.
  terminos: {
    title: 'Términos y Condiciones de Uso de Órbita',
    date: 'Última actualización: 8 de septiembre, 2026',
    sections: [
      { subtitle: '1. Objeto y aceptación', text: 'Los presentes Términos y Condiciones ("Términos") regulan el uso de la plataforma Órbita (en adelante, "Órbita", "la Plataforma") por parte de las personas físicas o jurídicas que crean un espacio para gestionar y vender a través de ella (en adelante, "el Comercio", "vos").\n\nAl crear un espacio en Órbita, marcás la casilla de aceptación de estos Términos y de la Política de Privacidad de Órbita. Esa aceptación constituye un contrato de adhesión electrónico entre vos y Órbita, válido y vinculante conforme al Código Civil y Comercial de la Nación. Si no estás de acuerdo con estos Términos, no debés crear un espacio ni utilizar la Plataforma.\n\nSi aceptás estos Términos en representación de una empresa u otra entidad, declarás tener la facultad para obligar a esa entidad, en cuyo caso "vos" y "el Comercio" se refieren a dicha entidad.' },
      { subtitle: '2. Naturaleza del servicio', text: 'Órbita es una plataforma tecnológica que le permite al Comercio crear y administrar su propia tienda online, gestionar stock, catálogo, pedidos, medios de pago y herramientas de marketing.\n\nEs importante que quede claro el rol de cada parte:\n\n• Órbita es un proveedor de tecnología. No es vendedor, ni fabricante, ni distribuidor de los productos o servicios que el Comercio ofrece a través de su espacio en la Plataforma.\n• El Comercio es el único responsable de los productos que publica, de la veracidad de la información que carga, del cumplimiento de la normativa de defensa del consumidor, lealtad comercial, tributaria y de cualquier otra que le resulte aplicable por su actividad, y de la relación comercial que entabla con sus propios clientes.\n• Órbita nunca es parte de la operación de venta ni administra los fondos de esa venta. El Comercio conecta su propia cuenta de Mercado Pago (u otro medio de pago habilitado) y cobra directamente a través de ella; Órbita no percibe, retiene ni administra ese dinero en ningún momento.' },
      { subtitle: '3. Cuenta y registro', text: 'Para usar Órbita, el Comercio debe crear una cuenta con información veraz, completa y actualizada. El Comercio es responsable de mantener la confidencialidad de sus credenciales de acceso y de toda actividad que ocurra bajo su cuenta.' },
      { subtitle: '4. Obligaciones del Comercio frente a sus propios clientes', text: 'El Comercio se compromete a cumplir, respecto de las ventas que realiza a través de su espacio en Órbita, con la normativa vigente en materia de:\n\n• Exhibición de precios (incluyendo la indicación del precio final e impuestos, conforme a la normativa vigente).\n• Derecho de arrepentimiento y botón de arrepentimiento/devolución para compras a distancia.\n• Garantía legal por defectos de fabricación.\n• Veracidad en la publicidad de ofertas, promociones, cupones y descuentos.\n• Protección de datos personales de sus propios clientes.\n• Cualquier otra normativa de defensa del consumidor, lealtad comercial o tributaria que le resulte aplicable.\n\nÓrbita pone a disposición del Comercio herramientas para facilitar este cumplimiento (por ejemplo, exhibición automática de precios con impuestos, botón de devolución en la tienda, plantillas de política de privacidad y términos de compra), pero el cumplimiento efectivo de la normativa es responsabilidad exclusiva del Comercio.' },
      { subtitle: '5. Rol de Órbita frente a reclamos y disputas', text: 'Órbita no interviene en la evaluación ni resolución de disputas entre el Comercio y sus clientes (por ejemplo, si un producto devuelto está en condiciones, si corresponde reintegro, cambio o reparación). Órbita únicamente provee la infraestructura para registrar, dar trazabilidad y notificar dichas solicitudes (número de trámite, fecha, estado), pero la decisión sobre cada caso corresponde exclusivamente al Comercio.\n\nAnte un reclamo de un cliente final vinculado a una compra realizada en la tienda de un Comercio, Órbita podrá remitir dicho reclamo al Comercio correspondiente, sin asumir responsabilidad por el resultado del mismo.' },
      { subtitle: '6. Suscripción y pagos', text: 'El uso de Órbita está sujeto al pago de una suscripción, cuyo valor vigente es de $5.000 (pesos argentinos) cada 3 (tres) meses. El pago se realiza mediante débito automático a través de Mercado Pago, autorizado por el Comercio al momento de contratar — Órbita nunca ve ni almacena los datos de la tarjeta. Los valores y eventuales promociones vigentes en cada momento se informan en la Plataforma al momento de la contratación.\n\nEl plan no tiene permanencia mínima, salvo que el Comercio opte expresamente por un plan de mayor duración con condiciones especiales, en cuyo caso esas condiciones se informarán y aceptarán por separado. La renovación es automática al vencimiento de cada período, salvo que el Comercio dé de baja su cuenta con anterioridad (ver sección 10).\n\nÓrbita podrá modificar el valor de la suscripción, notificando al Comercio con razonable anticipación antes de que el nuevo valor entre en vigencia.' },
      { subtitle: '7. Disponibilidad del servicio', text: 'Órbita realiza sus mejores esfuerzos para mantener la Plataforma disponible y operativa de forma continua, pero no garantiza un porcentaje específico de disponibilidad (SLA) ni la ausencia total de interrupciones, errores o demoras.\n\n• Mantenimientos programados: cuando sea posible, Órbita notificará con anticipación razonable las interrupciones programadas por tareas de mantenimiento o actualización.\n• Interrupciones no programadas: ante caídas o fallas no programadas, Órbita trabajará para restablecer el servicio a la mayor brevedad posible.\n• Límite de responsabilidad: Órbita no garantiza ninguna compensación económica por interrupciones del servicio — su compromiso se limita a los mejores esfuerzos descriptos en esta sección — y no será responsable por lucro cesante, ni por pérdida de ventas, de clientes o de datos que puedan derivarse de dichas interrupciones.' },
      { subtitle: '8. Propiedad intelectual', text: 'La Plataforma, su software, diseño, marca "Órbita" y demás elementos asociados son propiedad de Mateo Amir David Rojas Arce (CUIT 20-44991093-2) o de sus licenciantes. El Comercio conserva la titularidad de su propio contenido (productos, imágenes, textos, marca) que carga en su tienda, y otorga a Órbita una licencia limitada para alojarlo, procesarlo y mostrarlo en el marco de la prestación del servicio.' },
      { subtitle: '9. Protección de datos personales', text: 'El tratamiento de los datos personales del Comercio, y el rol de Órbita respecto de los datos de los clientes finales de cada tienda, se rigen por la Política de Privacidad de Órbita (disponible en esta misma pantalla), que forma parte integral de estos Términos.' },
      { subtitle: '10. Baja de la cuenta', text: 'El Comercio puede solicitar la baja de su suscripción en cualquier momento escribiendo a soporte@orbita.site, sin que se le exija trámite adicional injustificado. La baja no genera reintegro de períodos ya abonados, salvo que la normativa aplicable disponga lo contrario.\n\nÓrbita podrá suspender o dar de baja una cuenta ante incumplimientos graves de estos Términos, uso fraudulento de la Plataforma, o incumplimiento reiterado de la normativa de defensa del consumidor por parte del Comercio, previa notificación cuando sea razonablemente posible.' },
      { subtitle: '11. Modificaciones a estos Términos', text: 'Órbita podrá modificar estos Términos en cualquier momento. Los cambios se notificarán al Comercio con antelación razonable, y el uso continuado de la Plataforma luego de la entrada en vigencia de los nuevos Términos implica su aceptación.' },
      { subtitle: '12. Legislación aplicable y jurisdicción', text: 'Estos Términos se rigen por las leyes de la República Argentina. Para cualquier controversia derivada de este contrato, las partes se someten a la jurisdicción de los tribunales ordinarios de Puerto Iguazú, provincia de Misiones, sin perjuicio de los fueros que la normativa de defensa del consumidor pudiera otorgar a los usuarios finales de cada Comercio.' },
      { subtitle: '13. Contacto', text: 'Para consultas sobre estos Términos, escribinos a soporte@orbita.site.' },
    ],
  },
  privacidad: {
    title: 'Política de Privacidad de Órbita',
    date: 'Última actualización: 8 de septiembre, 2026',
    sections: [
      { subtitle: '1. Quién es el responsable de tus datos', text: 'Esta Política de Privacidad aplica a los datos personales de las personas que crean y administran un espacio en Órbita (en adelante, "el Comercio", "vos"). El responsable del tratamiento de estos datos es Mateo Amir David Rojas Arce, CUIT 20-44991093-2 (en adelante, "Órbita"), en los términos de la Ley N.° 25.326 de Protección de Datos Personales.\n\nEsta política no es la política de privacidad que aplica a los clientes finales que compran en las tiendas creadas con Órbita — esos datos se rigen por la política de privacidad publicada en cada tienda individual, de la que cada Comercio es responsable (ver sección 5).' },
      { subtitle: '2. Qué datos recolectamos', text: 'Al crear tu cuenta y usar la Plataforma, Órbita recolecta:\n\n• Datos de registro: nombre, email, teléfono, CUIT/CUIL, datos de facturación.\n• Datos de uso de la Plataforma: productos cargados, configuración de tu tienda, historial de pedidos gestionados.\n• Datos de pago de tu suscripción a Órbita, procesados a través de Mercado Pago — Órbita no almacena datos completos de tarjetas.\n• Datos técnicos: dirección IP, tipo de dispositivo, navegador, con fines de seguridad y funcionamiento del servicio.' },
      { subtitle: '3. Para qué usamos tus datos', text: 'Usamos tus datos para:\n\n• Brindarte el servicio de la Plataforma (crear y administrar tu tienda, procesar tu suscripción).\n• Comunicarnos con vos por soporte, novedades del producto o cambios en estos términos.\n• Cumplir obligaciones legales y fiscales.\n• Mejorar la Plataforma (de forma agregada y/o anonimizada cuando sea posible).\n\nNo vendemos tus datos a terceros. Podemos compartirlos con proveedores que nos ayudan a operar la Plataforma (por ejemplo, hosting, procesamiento de pagos, envío de emails), quienes están obligados a resguardarlos con el mismo nivel de protección.' },
      { subtitle: '4. Tus derechos', text: 'Conforme a la Ley N.° 25.326, tenés derecho a acceder, rectificar, actualizar y solicitar la supresión de tus datos personales. Podés ejercer estos derechos escribiendo a soporte@orbita.site.\n\nLa Agencia de Acceso a la Información Pública (AAIP), en su carácter de Órgano de Control de la Ley N.° 25.326, tiene la atribución de atender denuncias y reclamos vinculados al incumplimiento de las normas sobre protección de datos personales.' },
      { subtitle: '5. Rol de Órbita respecto de los datos de los clientes finales de cada tienda', text: 'Cuando un cliente compra en la tienda de un Comercio creada con Órbita, sus datos (nombre, dirección, teléfono, email, historial de compra) son recolectados y utilizados por decisión del Comercio, quien determina para qué se usan esos datos. Frente a esos datos:\n\n• El Comercio es el responsable del tratamiento, conforme a la Ley N.° 25.326.\n• Órbita actúa como encargado del tratamiento: aloja, procesa y resguarda esos datos por cuenta y orden del Comercio, con la única finalidad de prestar el servicio de la Plataforma (por ejemplo, mostrar el catálogo, procesar pedidos, generar comunicaciones automáticas del pedido).\n• Órbita no utiliza los datos de los clientes finales de cada tienda para fines propios ajenos a la prestación del servicio, ni los comparte entre distintos Comercios.\n\nLos clientes finales que quieran ejercer sus derechos sobre sus propios datos deben dirigirse directamente al Comercio donde realizaron su compra, conforme a la política de privacidad publicada en esa tienda.' },
      { subtitle: '6. Seguridad', text: 'Órbita implementa medidas de seguridad técnicas y organizativas razonables para proteger los datos personales que trata. No almacenamos datos completos de tarjetas de crédito/débito: los pagos se procesan directamente a través de Mercado Pago, conforme a sus propios estándares de seguridad.' },
      { subtitle: '7. Conservación de datos', text: 'Conservamos tus datos mientras mantengas tu cuenta activa en Órbita, y por el plazo adicional que exijan obligaciones legales o fiscales aplicables una vez dada de baja la cuenta.' },
      { subtitle: '8. Cambios a esta política', text: 'Podemos actualizar esta Política de Privacidad. Te notificaremos los cambios relevantes con antelación razonable a través de la Plataforma o por email.' },
      { subtitle: '9. Contacto', text: 'Para consultas sobre esta política o el tratamiento de tus datos, escribinos a soporte@orbita.site.' },
    ],
  },
  cookies: {
    title: 'Política de cookies',
    date: 'Última actualización: 13 de Mayo, 2026',
    sections: [
      { subtitle: '1. ¿Qué son las cookies?', text: 'Las cookies son archivos con datos que se envían a tu navegador desde un sitio web y se almacenan en tu dispositivo.' },
      { subtitle: '2. Cómo las usamos', text: 'Utilizamos cookies para el correcto funcionamiento de la plataforma y recordar tus preferencias.' },
      { subtitle: '3. Tipos de cookies', text: 'Usamos cookies de sesión, preferencias y seguridad.' },
      { subtitle: '4. Gestión', text: 'Puedes configurar tu navegador para rechazar cookies, aunque algunas partes del servicio podrían dejar de funcionar.' },
    ],
  },
};

interface Props {
  isOpen:     boolean;
  contentKey: LegalKey | null;
  onClose:    () => void;
}

export function LegalModal({ isOpen, contentKey, onClose }: Props) {
  const { isDark } = useTheme();

  useEffect(() => {
    const onEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    if (isOpen) {
      window.addEventListener('keydown', onEsc);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      window.removeEventListener('keydown', onEsc);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose]);

  if (!isOpen || !contentKey) return null;
  const content = LEGAL_CONTENT[contentKey];
  if (!content) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose} />
      <div className={`legal-modal-in relative w-full max-w-2xl max-h-[85vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden
        ${isDark ? 'bg-slate-900 border border-white/10' : 'bg-white border border-slate-200'}`}
      >
        <div className={`flex items-center justify-between px-6 py-4 border-b ${isDark ? 'border-white/10 bg-slate-800/50' : 'border-slate-100 bg-slate-50'}`}>
          <div>
            <h2 className={`text-lg font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>{content.title}</h2>
            <p className="text-xs text-slate-500 mt-1">{content.date}</p>
          </div>
          <button onClick={onClose} aria-label="Cerrar"
            className={`p-2 rounded-lg transition-colors ${isDark ? 'text-slate-400 hover:text-white hover:bg-white/10' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-200'}`}
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-6">
          <div className="space-y-6">
            {content.sections.map((s, i) => (
              <div key={i}>
                <h3 className={`text-sm font-bold mb-2 ${isDark ? 'text-blue-400' : 'text-blue-600'}`}>{s.subtitle}</h3>
                {/* whitespace-pre-line: los textos de terminos/privacidad
                    (LEGAL_CONTENT más arriba) traen \n\n entre párrafos y
                    viñetas "•" propias — sin esto HTML colapsa todos los
                    saltos de línea y el texto largo queda ilegible, un
                    bloque único. */}
                <p className={`text-sm leading-relaxed whitespace-pre-line ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{s.text}</p>
              </div>
            ))}
          </div>
          <div className="mt-8 p-4 rounded-xl bg-blue-50 dark:bg-blue-500/10 border border-blue-100 dark:border-blue-500/20">
            <p className="text-xs text-blue-800 dark:text-blue-200 text-center">
              Para consultas legales contactá a <strong>soporte@orbita.site</strong>
            </p>
          </div>
        </div>

        <div className={`px-6 py-4 border-t flex justify-end ${isDark ? 'border-white/10 bg-slate-800/30' : 'border-slate-100 bg-slate-50'}`}>
          <button onClick={onClose} className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-bold transition-all">
            Entendido
          </button>
        </div>
      </div>
    </div>
  );
}
