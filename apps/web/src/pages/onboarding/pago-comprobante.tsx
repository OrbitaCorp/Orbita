import { useRouter } from 'next/router'
import { ComprobanteBase } from '@/components/shared/ComprobanteBase'

const N_COMPROBANTE = 'OB-2025-004817'
const FECHA_HOY = new Date().toLocaleDateString('es-AR', {
  day: '2-digit', month: 'long', year: 'numeric',
})
const HORA_HOY = new Date().toLocaleTimeString('es-AR', {
  hour: '2-digit', minute: '2-digit',
})

export default function PagoComprobante() {
  const router = useRouter()
  const autoPrint = router.query.print === '1'

  return (
    <ComprobanteBase
      numero={N_COMPROBANTE}
      fecha={FECHA_HOY}
      hora={HORA_HOY}
      emisor={{ tipo: 'orbita' }}
      headerGradient="linear-gradient(135deg, #059669 0%, #10B981 100%)"
      metadatos={[
        ['Método',  'MercadoPago'],
        ['Estado',  'Aprobado'],
        ['Plan',    'Órbita Starter'],
        ['Período', '3 meses'],
      ]}
      items={[{
        descripcion: 'Órbita Starter: Plan inicial',
        subtitulo:   'Acceso completo al panel · 3 meses',
        qty:         1,
        subtotal:    5000,
      }]}
      totales={[
        { label: 'Subtotal',  valor: 5000, tipo: 'normal' },
        { label: 'IVA (21%)', valor: 0,    tipo: 'normal' },
        { label: 'Total',     valor: 5000, tipo: 'total'  },
      ]}
      textoFooter="Este comprobante acredita el pago realizado a través de MercadoPago."
      onBack={() => {
        // Si fue abierta como nueva pestaña no hay historial — cerramos la pestaña.
        // Si no se puede cerrar (el usuario la abrió directamente), navegamos al plan.
        if (window.history.length <= 1) {
          window.close()
        } else {
          router.back()
        }
      }}
      backLabel="Volver"
      autoPrint={autoPrint}
    />
  )
}
