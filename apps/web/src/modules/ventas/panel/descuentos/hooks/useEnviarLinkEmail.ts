import { useMutation } from '@tanstack/react-query'
import { sendCustomersEmail } from '@/lib/api'

interface Params {
  clienteId: string
  subject: string
  body: string
}

// POST /customers/email ya existe y lo usa ClienteLista.tsx para email
// individual/masivo — se reusa acá para el link del cupón en vez de armar un
// endpoint nuevo específico de cupones.
export function useEnviarLinkEmail() {
  return useMutation({
    mutationFn: async ({ clienteId, subject, body }: Params): Promise<void> => {
      await sendCustomersEmail([clienteId], subject, body)
    },
  })
}
