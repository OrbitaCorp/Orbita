// Props que recibe cada pantalla de función: el hub (AvanzadoTurnos) le pasa
// el rubro, su ficha del catálogo y el estado on/off, que vive en el hub.
import type { RubroTurnos } from '@/modules/turnos/datos'
import type { Funcion } from './datosAvanzado'

export interface PropsFuncion {
  rubro: RubroTurnos
  funcion: Funcion
  activo: boolean
  onActivo: (v: boolean) => void
  onVolver: () => void
  /** El aviso del panel: "Guardar" lo usa para confirmar (nada se guarda, es la demo). */
  avisar?: (titulo: string, descripcion?: string) => void
}
