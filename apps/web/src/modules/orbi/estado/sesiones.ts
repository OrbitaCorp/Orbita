import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useOrbiStore } from '@/components/orbi/useOrbiStore'
import { sesionesApi, type ListaDeSesiones, type ResumenDeSesion } from '../api/sesiones'
import { mensajesDeLaSesion } from './sesion'
import { useOrbiV2 } from './useOrbiV2'

const CLAVE = ['orbi', 'sesiones'] as const

/**
 * La lista de sesiones, paginada por cursor. Solo se pide con `activa` (el
 * selector abierto o la página de Orbi): con el chat cerrado no hay pedidos.
 */
export function useListaDeSesiones(opciones: { activa: boolean; q: string; archivadas?: boolean }) {
  const q = opciones.q.trim()
  const consulta = useInfiniteQuery({
    queryKey: [...CLAVE, { q, archivadas: !!opciones.archivadas }],
    queryFn: ({ pageParam }) => sesionesApi.listar({ q, archivadas: opciones.archivadas, cursor: pageParam }),
    initialPageParam: null as string | null,
    getNextPageParam: (ultima: ListaDeSesiones) => ultima.siguiente,
    enabled: opciones.activa,
    staleTime: 15_000,
  })
  const paginas = consulta.data?.pages ?? []
  return {
    fijadas: paginas[0]?.fijadas ?? [],
    sesiones: paginas.flatMap(p => p.sesiones),
    cargando: consulta.isLoading,
    error: consulta.isError,
    hayMas: !!consulta.hasNextPage,
    cargarMas: () => void consulta.fetchNextPage(),
    cargandoMas: consulta.isFetchingNextPage,
  }
}

/** Abre una sesión guardada en el chat: sus mensajes y su id, para seguirla. */
export async function abrirSesion(id: string): Promise<boolean> {
  try {
    const sesion = await sesionesApi.abrir(id)
    useOrbiStore.getState().cargarConversacion(sesion.id, mensajesDeLaSesion(sesion.mensajes))
    useOrbiV2.getState().setTitulo(sesion.titulo)
    return true
  } catch {
    return false
  }
}

/** Sesión nueva: el chat vacío. La conversación se crea en el servidor con el primer mensaje. */
export function nuevaSesion(): void {
  useOrbiStore.getState().reset()
  useOrbiV2.getState().setTitulo(null)
}

/** Renombrar, fijar, archivar y borrar, con la lista refrescada al terminar. */
export function useAccionesDeSesion() {
  const qc = useQueryClient()
  const refrescar = () => qc.invalidateQueries({ queryKey: CLAVE })
  const editar = useMutation({
    mutationFn: (p: { id: string; cambios: { titulo?: string; fijada?: boolean; archivada?: boolean } }) => sesionesApi.editar(p.id, p.cambios),
    onSuccess: (r: ResumenDeSesion) => {
      if (useOrbiStore.getState().conversationId === r.id) useOrbiV2.getState().setTitulo(r.titulo)
      void refrescar()
    },
  })
  const borrar = useMutation({
    mutationFn: (id: string) => sesionesApi.borrar(id),
    onSuccess: (_: void, id: string) => {
      // Borrar la que está abierta deja el chat vacío: sus tarjetas ya no existen.
      if (useOrbiStore.getState().conversationId === id) nuevaSesion()
      void refrescar()
    },
  })
  return {
    editar: (id: string, cambios: { titulo?: string; fijada?: boolean; archivada?: boolean }) => editar.mutateAsync({ id, cambios }),
    borrar: (id: string) => borrar.mutateAsync(id),
    refrescar,
  }
}
