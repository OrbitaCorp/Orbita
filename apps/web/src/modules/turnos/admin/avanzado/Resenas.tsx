// Reseñas después del turno: un WhatsApp unas horas después pidiendo una nota.
// Las notas altas se invitan a Google; las bajas le llegan solo al dueño, para
// que pueda responder antes de que se conviertan en una reseña pública.
//
// Lo que contesta el cliente NO se publica en el sitio del negocio: el sitio no
// lleva testimonios (decisión de producto del 01/10/2026).
import { useState } from 'react'
import { Star, MessageSquareText, Percent } from 'lucide-react'
import { ShellFuncion, Seccion, Campo, Segmentado, FilaSwitch, Dato, VistaCliente, ChatWhatsApp } from './ui'
import { servicioBase } from './datosAvanzado'
import { temaDe } from '@/modules/turnos/storefront/tema'
import type { PropsFuncion } from './tipos'

export default function Resenas(p: PropsFuncion) {
  const { rubro } = p
  const t = temaDe(rubro)
  const [horas, setHoras] = useState(3)
  const [google, setGoogle] = useState(true)
  const [privado, setPrivado] = useState(true)

  return (
    <ShellFuncion
      {...p}
      bajada="Unas horas después de cada turno atendido le llega un WhatsApp pidiendo una nota del 1 al 5. Las buenas pueden terminar en Google; las malas te llegan a vos primero."
      textoOn={`Sale ${horas === 24 ? 'al día siguiente' : `${horas} h después`} de cada turno marcado como atendido. Nunca a quien faltó.`}
      kpis={<>
        <Dato label="Nota promedio" valor="4,8" nota="Datos de ejemplo" Icon={Star} acento="#F59E0B" />
        <Dato label="Respuestas este mes" valor="26" nota="Datos de ejemplo" Icon={MessageSquareText} />
        <Dato label="Responden el mensaje" valor="38%" nota="Datos de ejemplo" Icon={Percent} acento="#8B5CF6" />
      </>}
      preview={
        <VistaCliente rubro={rubro} cabecera={false} titulo="El mensaje que le llega" nota="WhatsApp de ejemplo.">
          <ChatWhatsApp pantalla negocio={t.nombre} botones={['★★★★★  Excelente', '★★★★  Muy bien', 'Otra nota']} hora="19:12"
            respuesta={b => b === 'Otra nota'
              ? `Contanos qué nota le ponés, del 1 al 3, y qué podemos mejorar.${privado ? ` Tu mensaje le llega directo a ${t.nombre}, no se publica.` : ''}`
              : `¡Gracias, Sofía! Nos alegra un montón.${google ? ' ¿Nos dejás la reseña en Google? Es un minuto: g.page/r/tu-negocio/review' : ''}`}>
            {`¡Gracias por venir hoy, Sofía! ¿Cómo te fue con tu ${servicioBase(rubro).nombre.toLowerCase()}? Contanos con una nota del 1 al 5, nos ayuda un montón.`}
          </ChatWhatsApp>
        </VistaCliente>
      }
    >
      <Seccion titulo="Cuándo se pide">
        <Campo label="Después del turno" style={{ marginBottom: 0 }}>
          <Segmentado label="Cuándo se pide la reseña" valor={horas} onChange={setHoras} opciones={[{ valor: 1, label: '1 h' }, { valor: 3, label: '3 h' }, { valor: 24, label: 'Al día siguiente' }]} />
        </Campo>
      </Seccion>
      <Seccion titulo="Qué pasa con la nota">
        <FilaSwitch titulo="Invitar a Google con 4 o 5 estrellas" desc="Le mandamos el link a tu Perfil de Empresa para que deje la reseña ahí." on={google} onChange={setGoogle} />
        <FilaSwitch titulo="Avisarme las de 3 o menos" desc="Te llega una notificación para que puedas escribirle." on={privado} onChange={setPrivado} />
      </Seccion>
    </ShellFuncion>
  )
}
