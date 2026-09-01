import { useEffect, useState } from 'react'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { WizardData } from '@/lib/api'

// Estado acumulado durante todo el onboarding, ANTES de que exista una
// cuenta — el flujo es: elegir rubro → completar el wizard paso a paso →
// pantalla de pago (MercadoPago) → recién cuando el pago se aprueba se crea
// la cuenta y se guarda todo junto (ver PENDIENTES.md). `persist` en
// localStorage para poder retomar si se recarga la página a mitad de
// camino — EXCEPTO la contraseña y el preview del logo, que se excluyen de
// `partialize`: la contraseña por seguridad (no dejarla en texto plano), el
// logo porque un data-URI en base64 puede pesar varios MB y no tiene
// sentido inflar localStorage con eso en cada tecla que escribe el usuario.

const initialWizard: WizardData = {
  rubro: '',
  subrubros: [],
  nombre: '',
  descripcion: '',
  telefono: '',
  subdominio: '',
  modoVenta: '',
  direccion: '',
  latLng: [-34.6037, -58.3816],
  operatesPhysical: false,
  operatesOnline: false,
  ownerName: '',
  ownerEmail: '',
  ownerPassword: '',
  logoDataUrl: '',
}

interface OnboardingState {
  wizard: WizardData
  setWizard: (patch: Partial<WizardData>) => void
  resetWizard: () => void
}

export const useOnboardingStore = create<OnboardingState>()(
  persist(
    (set) => ({
      wizard: initialWizard,
      setWizard: (patch) => set((state) => ({ wizard: { ...state.wizard, ...patch } })),
      resetWizard: () => set({ wizard: initialWizard }),
    }),
    {
      name: 'orbita_onboarding_wizard',
      partialize: (state) => ({
        wizard: { ...state.wizard, ownerPassword: '', logoDataUrl: '' },
      }),
    },
  ),
)

// ¿Ya se puede confiar en lo que dice el wizard?
//
// Hay DOS motivos por los que el primer render miente, y hacen falta los dos:
//  1. `persist` rehidrata desde localStorage recién en el cliente.
//  2. Aunque ya haya rehidratado, el primer commit del cliente es el de
//     hidratación de React, y ahí `useSyncExternalStore` devuelve a propósito
//     el snapshot del SERVIDOR — el wizard inicial vacío — para que el HTML
//     coincida. Recién en el render siguiente aparece el estado real.
//
// Por eso arranca en false SIEMPRE (no en `hasHydrated()`): así ninguna
// pantalla decide nada durante ese primer commit. Sin esto, el guard de
// /onboarding/plan veía un wizard vacío y rebotaba al paso 1 a alguien que
// tenía todo cargado, con solo recargar la página.
export function useOnboardingHidratado(): boolean {
  const [hidratado, setHidratado] = useState(false)
  useEffect(() => {
    // En el servidor `persist` no existe (sin localStorage el middleware ni lo
    // engancha), pero este efecto solo corre en el cliente.
    const persist = (useOnboardingStore as { persist?: OnboardingPersistApi }).persist
    if (!persist || persist.hasHydrated()) {
      setHidratado(true)
      return
    }
    return persist.onFinishHydration(() => setHidratado(true))
  }, [])
  return hidratado
}

type OnboardingPersistApi = {
  hasHydrated: () => boolean
  onFinishHydration: (fn: () => void) => () => void
}
