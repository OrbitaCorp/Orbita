import { useMutation } from '@tanstack/react-query'
import { sendCouponLinkEmail } from '@/lib/api'

interface Params {
  to: string
  subject: string
  body: string
}

// A propósito NO usa sendCustomersEmail() (POST /customers/email) — ese
// endpoint exige customerIds reales. El link de un cupón exclusivo tiene que
// poder mandarse a cualquier email, sea o no cliente registrado.
export function useEnviarLinkEmail() {
  return useMutation({
    mutationFn: async ({ to, subject, body }: Params): Promise<void> => {
      await sendCouponLinkEmail(to, subject, body)
    },
  })
}
