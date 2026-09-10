import { useMutation } from '@tanstack/react-query'
import { sendCouponLinkEmail } from '@/lib/api'

interface Params {
  couponId: string
  to: string
  nombreDestino?: string
}

// A propósito NO usa sendCustomersEmail() (POST /customers/email) — ese
// endpoint exige customerIds reales. El link de un cupón exclusivo tiene que
// poder mandarse a cualquier email, sea o no cliente registrado. El contenido
// del mail lo arma el servidor a partir del cupón.
export function useEnviarLinkEmail() {
  return useMutation({
    mutationFn: async ({ couponId, to, nombreDestino }: Params): Promise<void> => {
      await sendCouponLinkEmail(couponId, to, nombreDestino)
    },
  })
}
