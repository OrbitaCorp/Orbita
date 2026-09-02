// src/modules/propuestas/debate.ts — Votos y notas del equipo por propuesta,
// en localStorage (esta máquina). Es para la reunión, no es persistencia real.
// Se lee con useSyncExternalStore: el snapshot es el string crudo del
// storage (estable por valor), así no hay setState dentro de effects.

import { useCallback, useMemo, useSyncExternalStore } from 'react'

export type Voto = 'hacer' | 'tal-vez' | 'no'
export interface VotoEntrada { nombre: string; voto: Voto }
export interface Nota { id: string; nombre: string; texto: string; fecha: number }
interface Estado { votos: VotoEntrada[]; notas: Nota[] }

const KEY = (id: string) => `pr-debate-${id}`
const VACIO: Estado = { votos: [], notas: [] }

function parsear(raw: string | null): Estado {
  if (!raw) return VACIO
  try { return JSON.parse(raw) as Estado } catch { return VACIO }
}

export function leerDebate(id: string): Estado {
  try { return parsear(localStorage.getItem(KEY(id))) } catch { return VACIO }
}

function guardar(id: string, e: Estado) {
  try { localStorage.setItem(KEY(id), JSON.stringify(e)) } catch {}
  try { window.dispatchEvent(new CustomEvent('pr-debate', { detail: id })) } catch {}
}

function suscribir(cb: () => void) {
  window.addEventListener('storage', cb)
  window.addEventListener('pr-debate', cb)
  return () => { window.removeEventListener('storage', cb); window.removeEventListener('pr-debate', cb) }
}

/** Lee una clave de localStorage como store externo (string crudo o null). */
export function useClaveLocal(key: string): string | null {
  return useSyncExternalStore(
    suscribir,
    () => { try { return localStorage.getItem(key) } catch { return null } },
    () => null,
  )
}

export function escribirClaveLocal(key: string, valor: string) {
  try { localStorage.setItem(key, valor) } catch {}
  try { window.dispatchEvent(new CustomEvent('pr-debate', { detail: key })) } catch {}
}

export function useDebate(id: string) {
  const raw = useClaveLocal(KEY(id))
  const estado = useMemo(() => parsear(raw), [raw])

  const votar = useCallback((nombre: string, voto: Voto) => {
    const e = leerDebate(id)
    const otros = e.votos.filter(v => v.nombre !== nombre)
    const actual = e.votos.find(v => v.nombre === nombre)
    guardar(id, { ...e, votos: actual?.voto === voto ? otros : [...otros, { nombre, voto }] })
  }, [id])

  const agregarNota = useCallback((nombre: string, texto: string) => {
    const e = leerDebate(id)
    guardar(id, { ...e, notas: [{ id: Math.random().toString(36).slice(2), nombre, texto, fecha: Date.now() }, ...e.notas] })
  }, [id])

  const borrarNota = useCallback((nid: string) => {
    const e = leerDebate(id)
    guardar(id, { ...e, notas: e.notas.filter(n => n.id !== nid) })
  }, [id])

  return { votos: estado.votos, notas: estado.notas, votar, agregarNota, borrarNota }
}
