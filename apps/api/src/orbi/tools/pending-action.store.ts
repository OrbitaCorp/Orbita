import { Injectable } from '@nestjs/common';
import { randomBytes } from 'crypto';

/**
 * Acciones que Orbi propuso y todavía no ejecutó.
 *
 * Las herramientas que ESCRIBEN en la base no se ejecutan solas: se proponen,
 * el dueño ve un botón con lo que va a pasar, y recién cuando hace clic ocurre.
 * Esto es lo que contiene el daño de una inyección indirecta (RBT-695): un
 * texto malicioso metido en el nombre de un cliente puede convencer al modelo
 * de PEDIR un cupón del 100%, pero no puede hacer clic por el dueño.
 *
 * La propuesta se guarda ACÁ y no viaja al navegador. El endpoint de
 * confirmación recibe solo un id: si aceptara la herramienta y los argumentos
 * desde el cliente, sería el mismo agujero de siempre con un paso más — quien
 * quisiera escribir se saltearía a Orbi y postearía la acción directamente.
 *
 * Store en memoria, mismo supuesto de single-instance que
 * GoogleOAuthExchangeStore. Si el proceso reinicia con propuestas pendientes,
 * los botones dejan de funcionar y la persona vuelve a pedírselo a Orbi: no se
 * pierde nada ni queda nada a medio aplicar.
 */

const TTL_MS = 10 * 60 * 1000;

export interface PendingAction {
  tool: string;
  args: Record<string, unknown>;
  /** Para qué negocio y quién la pidió. Se re-verifica al confirmar. */
  businessId: string;
  memberId: string;
  /** Lo que se le muestra a la persona antes de que apriete. */
  resumen: string;
  expiraEn: number;
}

@Injectable()
export class PendingActionStore {
  private readonly acciones = new Map<string, PendingAction>();

  crear(accion: Omit<PendingAction, 'expiraEn'>): string {
    this.limpiarVencidas();

    const id = randomBytes(16).toString('hex');
    this.acciones.set(id, { ...accion, expiraEn: Date.now() + TTL_MS });
    return id;
  }

  /**
   * Devuelve la acción y la borra: de un solo uso, para que un botón no pueda
   * apretarse dos veces y crear dos cupones.
   *
   * Pide businessId y memberId y los compara: aunque alguien adivinara un id,
   * no puede confirmar una acción de otro negocio ni de otra persona.
   */
  consumir(id: string, businessId: string, memberId: string): PendingAction | null {
    const accion = this.acciones.get(id);
    if (!accion) return null;

    // Se borra antes de validar, igual que el store del OAuth: un intento
    // fallido tampoco deja el id disponible para reintentar.
    this.acciones.delete(id);

    if (accion.expiraEn < Date.now()) return null;
    if (accion.businessId !== businessId) return null;
    if (accion.memberId !== memberId) return null;

    return accion;
  }

  private limpiarVencidas(): void {
    const ahora = Date.now();
    for (const [id, accion] of this.acciones) {
      if (accion.expiraEn < ahora) this.acciones.delete(id);
    }
  }
}
